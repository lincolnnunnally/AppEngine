import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const strict = process.env.SOURCE_CHECK_STRICT === "true";
const allowOffline = process.env.SOURCE_CHECK_OFFLINE === "true";
const failures = [];
const warnings = [];

const branch = runGit("branch --show-current");
const head = runGit("rev-parse HEAD");
const localOriginMain = runGit("rev-parse origin/main");
const liveMain = getLiveMainSha();

if (!liveMain && !allowOffline) {
  failures.push("Could not verify live GitHub main. Run with network access or set SOURCE_CHECK_OFFLINE=true only for offline local checks.");
}

if (liveMain && localOriginMain && liveMain !== localOriginMain) {
  failures.push(`Local origin/main is stale. Run git fetch origin main before building. live=${short(liveMain)} local=${short(localOriginMain)}`);
}

if (strict && liveMain && branch === "main" && head !== liveMain) {
  failures.push(`Local main is not at live GitHub main. live=${short(liveMain)} head=${short(head)}`);
} else if (liveMain && branch === "main" && head !== liveMain) {
  warnings.push(`Local main is not at live GitHub main. live=${short(liveMain)} head=${short(head)}. Finish or rebase local work before treating this as current.`);
}

validateManifestFiles();

for (const warning of warnings) {
  console.warn(`source-check warning: ${warning}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`source-check failed: ${failure}`);
  }
  process.exit(1);
}

console.log("source-check ok");

function validateManifestFiles() {
  const manifestPath = path.join(repoRoot, "agents", "manifest.yaml");

  if (!fs.existsSync(manifestPath)) {
    failures.push("agents/manifest.yaml is missing.");
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf8");
  const sharedContextFiles = collectListAfterKey(manifest, "shared_context_files");
  const promptFiles = collectPromptFiles(manifest);
  const requiredFiles = [...sharedContextFiles, ...promptFiles];

  for (const filePath of requiredFiles) {
    if (!fs.existsSync(path.join(repoRoot, filePath))) {
      failures.push(`Manifest references missing file: ${filePath}`);
    }
  }

  if (!sharedContextFiles.includes("agents/context/source-of-truth.md")) {
    failures.push("agents/manifest.yaml must include agents/context/source-of-truth.md in shared_context_files.");
  }
}

function collectListAfterKey(source, key) {
  const lines = source.split(/\r?\n/);
  const values = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`${key}:`)) {
      inSection = true;
      continue;
    }

    if (inSection && /^[a-zA-Z_]+:/.test(line)) break;

    if (inSection) {
      const match = line.match(/^  -\s*(.+)$/);
      if (match) values.push(match[1].trim());
    }
  }

  return values;
}

function collectPromptFiles(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(/^    prompt:\s*(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function getLiveMainSha() {
  const result = runGit("ls-remote origin refs/heads/main");
  if (!result || result === "unavailable") return "";
  return result.split(/\s+/)[0] || "";
}

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unavailable";
  }
}

function short(value) {
  return value ? value.slice(0, 7) : "unknown";
}
