import fs from "node:fs";
import path from "node:path";
import {
  runPriorWorkCheck,
  run001ExampleRequest,
  unreachableRepoExampleRequest,
  buildNewExampleRequest
} from "./lib/prior-work-check.js";

const inputPath = process.env.PRIOR_WORK_CHECK_INPUT || "";
const example = (process.env.PRIOR_WORK_CHECK_EXAMPLE || "").trim();
const artifactOutput = process.env.PRIOR_WORK_CHECK_OUTPUT || "";
const markdownOutput = process.env.PRIOR_WORK_CHECK_MARKDOWN_OUTPUT || "";
const strict = process.env.PRIOR_WORK_CHECK_STRICT === "true";

const input = loadInput();
const artifact = runPriorWorkCheck(input);

if (artifactOutput) writeJson(artifactOutput, artifact);
if (markdownOutput) writeText(markdownOutput, `${artifact.ownerReadableReport}\n`);

console.log(`prior-work-check: ${artifact.sourceRequest.runId} -> ${artifact.verdict}`);
console.log(artifact.ownerReadableReport);

// A blocking gate: when it does not pass, surface a non-zero exit so callers and
// CI cannot silently proceed past a blocked_cannot_verify result.
if (strict && !artifact.passed) {
  process.exitCode = 2;
}

function loadInput() {
  if (inputPath) return readInput(inputPath);
  if (example === "run-001") return run001ExampleRequest();
  if (example === "unreachable") return unreachableRepoExampleRequest();
  if (example === "build-new") return buildNewExampleRequest();
  if (example) throw new Error(`Unknown PRIOR_WORK_CHECK_EXAMPLE: ${example}`);
  throw new Error("Provide PRIOR_WORK_CHECK_INPUT=<file.json> or PRIOR_WORK_CHECK_EXAMPLE=run-001|unreachable|build-new");
}

function readInput(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Input file not found: ${filePath}`);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, value);
}
