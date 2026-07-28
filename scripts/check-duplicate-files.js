import fs from "node:fs";
import path from "node:path";

// Cloud-sync conflict copies ("foo 2.ts" beside "foo.ts") are created silently by
// iCloud Drive when two processes write the same file — which happens constantly
// here, because the repos live under ~/Documents and more than one agent works the
// tree at once. They are dangerous in a way ordinary clutter is not: a stale copy
// looks like real source, gets imported or edited by mistake, and re-introduces work
// that was already finished. This guard makes them a build failure instead.
//
//   npm run dupes:check   report and fail
//   npm run dupes:clean   delete the provably-redundant ones, still fail on the rest

const repoRoot = process.cwd();
const fix = process.argv.includes("--fix");

const skipDirs = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  ".codex-worktrees",
  ".claude",
  "dist",
  "build",
  "out",
  "coverage"
]);

// "foo 2.ts" -> base "foo", ext ".ts".  "bar 3" -> base "bar", no ext.
const conflictName = /^(.+) (\d+)(\.[^.]*)?$/;

const redundant = []; // provably safe to delete
const review = []; // differs from its original — a human decides

walk(repoRoot);

for (const entry of redundant) {
  if (!fix) continue;
  fs.rmSync(entry.absolutePath, { recursive: true, force: true });
}

report();

function walk(dir) {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const names = new Set(entries.map((entry) => entry.name));

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory() && skipDirs.has(entry.name)) {
      continue;
    }

    const match = conflictName.exec(entry.name);
    const originalName = match ? `${match[1]}${match[3] ?? ""}` : null;

    // Only a name that sits beside its own original is a sync artifact. A file
    // genuinely called "chapter 2.md" is left alone unless "chapter.md" exists too.
    if (originalName && names.has(originalName)) {
      classify(absolutePath, path.join(dir, originalName), entry.isDirectory());
      continue;
    }

    if (entry.isDirectory()) {
      walk(absolutePath);
    }
  }
}

function classify(absolutePath, originalPath, isDirectory) {
  const record = { absolutePath, relativePath: toRelative(absolutePath), original: toRelative(originalPath) };

  if (isDirectory) {
    const extra = filesOnlyInCopy(absolutePath, originalPath);
    record.reason = extra.length === 0 ? "empty or fully mirrored by the original" : `holds ${extra.length} file(s) the original does not`;
    (extra.length === 0 ? redundant : review).push(record);
    return;
  }

  const identical = sameBytes(absolutePath, originalPath);
  record.reason = identical ? "byte-identical to the original" : "content differs from the original";
  (identical ? redundant : review).push(record);
}

function filesOnlyInCopy(copyDir, originalDir) {
  const extra = [];

  for (const relativePath of listFiles(copyDir)) {
    const counterpart = path.join(originalDir, relativePath);

    if (!fs.existsSync(counterpart) || !sameBytes(path.join(copyDir, relativePath), counterpart)) {
      extra.push(relativePath);
    }
  }

  return extra;
}

function listFiles(dir, prefix = "") {
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name);

    if (entry.isDirectory()) {
      found.push(...listFiles(path.join(dir, entry.name), relativePath));
      continue;
    }

    found.push(relativePath);
  }

  return found;
}

function sameBytes(a, b) {
  try {
    const left = fs.statSync(a);
    const right = fs.statSync(b);

    if (!left.isFile() || !right.isFile() || left.size !== right.size) {
      return false;
    }

    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

function toRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function report() {
  if (redundant.length === 0 && review.length === 0) {
    console.log("duplicate-files ok (no cloud-sync conflict copies)");
    process.exit(0);
  }

  for (const entry of redundant) {
    console.log(`${fix ? "removed" : "redundant"}: ${entry.relativePath} — ${entry.reason}`);
  }

  for (const entry of review) {
    console.log(`NEEDS REVIEW: ${entry.relativePath} — ${entry.reason} (${entry.original})`);
  }

  if (review.length > 0) {
    const one = review.length === 1;
    console.error(
      `\n${review.length} conflict cop${one ? "y" : "ies"} ${one ? "differs" : "differ"} from the original and ${one ? "was" : "were"} not touched.` +
        `\nDiff ${one ? "it" : "each one"}, fold in anything real, then delete it.`
    );
    process.exit(1);
  }

  if (fix) {
    console.log(`\ncleaned ${redundant.length} conflict cop${redundant.length === 1 ? "y" : "ies"}`);
    process.exit(0);
  }

  console.error(`\n${redundant.length} cloud-sync conflict cop${redundant.length === 1 ? "y" : "ies"} present. Run: npm run dupes:clean`);
  process.exit(1);
}
