// Convert a verified nationwide CSV and hand it to import-tech-directors.
// Dry-run and apply use that script's guards. This file does not write churches
// and does not send email.
//
// Skip verify_status=do_not_use, directory_ready other than yes, and campaign_fit=skip.
// Tags on each contact: verify:, fit:, size:, role:, src:nationwide-20261031.
// Size is a tag only. estimated_size is not copied. Unmatched rows stay church-leads.
//
// Dry run (no writes):
//   node --experimental-strip-types scripts/import-nationwide-verified.ts --dry-run path/to/large_avl_tech_verified.csv
//   node --experimental-strip-types scripts/import-nationwide-verified.ts --dry-run path/to/small_medium_pro_verified.csv
//
// Apply on a non-production host:
//   node --experimental-strip-types scripts/import-nationwide-verified.ts --apply path/to/large_avl_tech_verified.csv
//
// Production needs the same two opt-ins as import-tech-directors, then --yes.
// The banner prints the project ref, never the key. Do not apply from an agent.
//   IMPORT_ALLOW_PROD=uqhqulrqcygsmmzdzemx node --experimental-strip-types scripts/import-nationwide-verified.ts --apply --allow-production --yes path/to/large_avl_tech_verified.csv
//
// Run the large AVL file first, then the small and medium file.
// Optional: --report <unmatched.csv>  --out <converted.csv>  --skip-file  --flagged-file  --include-flagged

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptVerifiedNationwideCsv, nationwideChildArgs } from "../src/lib/engine/nationwide-verified.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const valueFlags = new Set(["--report", "--skip-file", "--jev", "--flagged-file", "--out"]);

function flagValue(args: string[], flag: string): string {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] ?? "" : "";
}

function positionalFile(args: string[]): string {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (valueFlags.has(arg)) {
      i += 1;
      continue;
    }
    if (!arg.startsWith("--")) return arg;
  }
  return "";
}

const args = process.argv.slice(2);
const file = positionalFile(args);
const dryRun = args.includes("--dry-run");
const apply = args.includes("--apply");
if (dryRun === apply || !file || (args.includes("--out") && !flagValue(args, "--out")) || (args.includes("--report") && !flagValue(args, "--report"))) {
  console.error(`Usage:
  node --experimental-strip-types scripts/import-nationwide-verified.ts --dry-run <verified.csv>
  node --experimental-strip-types scripts/import-nationwide-verified.ts --apply <verified.csv>

Converts verified nationwide rows and runs scripts/import-tech-directors.ts.
--dry-run writes nothing. --apply uses that script's host guard.
Production also needs --allow-production, IMPORT_ALLOW_PROD, and --yes.
Run large_avl_tech_verified.csv first, then small_medium_pro_verified.csv.
Optional: --report <unmatched.csv>  --out <converted.csv>  --skip-file  --flagged-file  --include-flagged  --allow-production  --yes`);
  process.exit(1);
}

let source = "";
try {
  source = readFileSync(resolve(file), "utf8");
} catch {
  console.error(`Could not read ${resolve(file)}.`);
  process.exit(1);
}

const adapted = adaptVerifiedNationwideCsv(source);
if (!adapted.ok) {
  console.error(adapted.message);
  process.exit(1);
}

const skipped = adapted.skipped;
console.log(
  `nationwide verified: ${adapted.inputRows} in, ${adapted.readyRows} ready, skipped do_not_use ${skipped.doNotUse}, not directory_ready ${skipped.notReady}, campaign_fit skip ${skipped.skipFit}, no church name ${skipped.noChurch}`
);
console.log("tags only. nothing is sent. size is a contact tag. estimated_size is not copied.");

if (!adapted.readyRows) {
  console.log("nothing ready to import. nothing was written.");
  process.exit(0);
}

const outFlag = flagValue(args, "--out");
const tempDir = outFlag ? "" : mkdtempSync(join(tmpdir(), "nationwide-verified-"));
const convertedPath = outFlag ? resolve(outFlag) : join(tempDir, "tech-directors.csv");
writeFileSync(convertedPath, adapted.csv);
console.log(`converted: ${convertedPath}`);

const childArgs = nationwideChildArgs(args, convertedPath);
const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/import-tech-directors.ts", ...childArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});

child.on("close", (code) => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exit(code ?? 1);
});
