import fs from "node:fs";
import path from "node:path";

// DC-1: generated apps must not show fabricated people/records as real.
// Module files emit fallback arrays as quoted source lines. Collapse those
// emitted arrays to `[]` and stop refilling empty DB results with samples.

const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (name.endsWith(".ts") && !["types.ts", "registry.ts"].includes(name)) files.push(full);
  }
}
walk(path.join(process.cwd(), "src/lib/engine/modules"));
files.push(path.join(process.cwd(), "src/lib/engine/foundation-modules.ts"));

let changed = 0;
for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  const lines = original.split("\n");
  const out = [];
  let i = 0;
  let fileChanged = false;
  while (i < lines.length) {
    const line = lines[i];
    const quotedStart = line.match(
      /^(\s*)(["'`])const (fallback[A-Za-z0-9]*): ([A-Za-z0-9_]+)\[\] = \[(?:",)?\s*$/
    );
    if (quotedStart) {
      const indent = quotedStart[1];
      const q = quotedStart[2];
      out.push(`${indent}${q}const ${quotedStart[3]}: ${quotedStart[4]}[] = [];${q},`);
      fileChanged = true;
      i += 1;
      while (i < lines.length) {
        const cur = lines[i];
        i += 1;
        if (/^\s*(["'`])\];\1,?\s*$/.test(cur)) break;
      }
      continue;
    }
    const rawStart = line.match(/^(\s*)const (fallback[A-Za-z0-9]*): ([A-Za-z0-9_]+)\[\] = \[\s*$/);
    if (rawStart) {
      out.push(`${rawStart[1]}const ${rawStart[2]}: ${rawStart[3]}[] = [];`);
      fileChanged = true;
      i += 1;
      while (i < lines.length) {
        const cur = lines[i];
        i += 1;
        if (/^\s*\];\s*$/.test(cur)) break;
      }
      continue;
    }
    // Also handle single-line: "const fallbackX: T[] = [ ... ];"
    const single = line.replace(
      /(["'`])const (fallback[A-Za-z0-9]*): ([A-Za-z0-9_]+)\[\] = \[.*\];\1/,
      "$1const $2: $3[] = [];$1"
    );
    if (single !== line) fileChanged = true;
    out.push(single.replace(/if \(!rows\.length\) return fallback[A-Za-z0-9]*;/g, "if (!rows.length) return [];"));
    i += 1;
  }
  const next = out.join("\n");
  if (next !== original) {
    fs.writeFileSync(filePath, next);
    changed += 1;
    console.log("ok - emptied samples in", path.relative(process.cwd(), filePath));
  } else if (fileChanged) {
    fs.writeFileSync(filePath, next);
    changed += 1;
    console.log("ok - emptied samples in", path.relative(process.cwd(), filePath));
  }
}

console.log(`empty-sample-fallbacks: ${changed} files updated`);
