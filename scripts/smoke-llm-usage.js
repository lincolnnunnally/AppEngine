import fs from "node:fs";
import path from "node:path";

// Structural smoke for LLM usage metering + the per-run spend guard. (Engine
// modules use path aliases / extensionless TS imports that plain node can't
// resolve, so this asserts the wiring + key constants rather than importing.)
// Run: node scripts/smoke-llm-usage.js
const repoRoot = process.cwd();

runStep("metering module exposes the metering + guard contract", () => {
  const text = read("src/lib/engine/llm-usage.ts");
  for (const sym of [
    "export function estimateLlmCostUsd",
    "export function extractUsage",
    "export function buildUsageRecord",
    "export async function recordLlmUsage",
    "export async function getLlmUsageTotals",
    "export function getMaxLlmCallsPerRun"
  ]) {
    assertIncludes(text, sym, "export");
  }
  // exact token counts; only the $ conversion is rate-based (env-overridable).
  assertIncludes(text, "APP_ENGINE_LLM_USD_PER_1K_INPUT", "input rate env");
  assertIncludes(text, "APP_ENGINE_LLM_USD_PER_1K_OUTPUT", "output rate env");
  // both provider usage shapes handled
  assertIncludes(text, "input_tokens", "responses/messages usage shape");
  assertIncludes(text, "prompt_tokens", "chat-completions usage shape");
  // metering must not break a build
  assertIncludes(text, "best-effort", "writes swallow errors");
  // default per-run cap is sane
  assertIncludes(text, "APP_ENGINE_LLM_MAX_CALLS_PER_RUN", "per-run cap env");
  assertIncludes(text, "? Math.floor(value) : 24", "per-run cap default 24");
});

runStep("adapters meter every successful call", () => {
  const text = read("src/lib/engine/worker-adapters.ts");
  const openai = text.slice(text.indexOf("class OpenAiWorkerAdapter"), text.indexOf("class AnthropicWorkerAdapter"));
  const anthropic = text.slice(text.indexOf("class AnthropicWorkerAdapter"), text.indexOf("async function readProviderPayload"));
  assertIncludes(openai, "recordLlmUsage", "openai adapter records usage");
  assertIncludes(anthropic, "recordLlmUsage", "anthropic adapter records usage");
});

runStep("execution applies the per-run spend guard (degrades to free local)", () => {
  const text = read("src/lib/engine/execution.ts");
  assertIncludes(text, "getMaxLlmCallsPerRun", "imports the cap");
  assertIncludes(text, "realCalls", "tracks real calls");
  assertIncludes(text, "deterministic output to cap cost", "degrades to free local when capped");
});

runStep("llm_usage durable store kind is registered", () => {
  const text = read("src/lib/engine/durable-state-adapter.ts");
  assertIncludes(text, '"llm_usage"', "state kind in union");
  assertIncludes(text, 'store("llm_usage"', "state store definition");
});

console.log("llm-usage smoke ok");

function read(p) {
  return fs.readFileSync(path.join(repoRoot, p), "utf8");
}
function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) throw new Error(`${label}: expected to contain "${phrase}"`);
}
function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
