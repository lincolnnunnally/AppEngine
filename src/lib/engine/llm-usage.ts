// LLM usage metering + cost estimate. Captures per-call token usage from the
// model providers so we can (a) learn the real cost per build before pricing, and
// (b) guard spend. Records go through the durable state adapter — they accumulate
// durably only when the database is enabled; otherwise they're best-effort/local.
// Metering must NEVER break a build, so all writes are wrapped and swallow errors.
import { getAppEngineStateAdapter } from "./durable-state-adapter";

export type LlmUsageProvider = "openai" | "anthropic";

export type LlmUsage = { inputTokens: number; outputTokens: number };

export type LlmUsageRecord = {
  at: string;
  provider: LlmUsageProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  agent?: string;
  project?: string;
  task?: string;
};

function ratePer1k(envName: string, fallback: number): number {
  const value = Number(process.env[envName]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// $ per 1,000 tokens. Defaults are ESTIMATES — set the real numbers for the model
// in use via env (and re-check when the model changes). Token counts are exact;
// only the dollar conversion depends on these rates.
export function estimateLlmCostUsd(inputTokens: number, outputTokens: number): number {
  const inputUsd = (inputTokens / 1000) * ratePer1k("APP_ENGINE_LLM_USD_PER_1K_INPUT", 0.0015);
  const outputUsd = (outputTokens / 1000) * ratePer1k("APP_ENGINE_LLM_USD_PER_1K_OUTPUT", 0.006);
  return Number((inputUsd + outputUsd).toFixed(6));
}

export function extractUsage(payload: unknown): LlmUsage {
  const usage = (payload as { usage?: Record<string, unknown> } | null)?.usage || {};
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0;
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0;
  return { inputTokens, outputTokens };
}

type RecordInput = {
  at?: string;
  provider: LlmUsageProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  agent?: string;
  project?: string;
  task?: string;
};

export function buildUsageRecord(input: RecordInput): LlmUsageRecord {
  const totalTokens = input.inputTokens + input.outputTokens;
  return {
    at: input.at || new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens,
    estimatedCostUsd: estimateLlmCostUsd(input.inputTokens, input.outputTokens),
    agent: input.agent,
    project: input.project,
    task: input.task
  };
}

export async function recordLlmUsage(input: RecordInput): Promise<LlmUsageRecord> {
  const record = buildUsageRecord(input);

  try {
    await getAppEngineStateAdapter().appendJson({ kind: "llm_usage", key: "records" }, record);
  } catch {
    // Metering is best-effort; never fail a build because a usage write failed.
  }

  return record;
}

export type LlmUsageTotals = {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  byModel: Record<string, { calls: number; tokens: number; costUsd: number }>;
  byDay: Record<string, number>;
  durable: boolean;
};

export async function getLlmUsageTotals(): Promise<LlmUsageTotals> {
  const adapter = getAppEngineStateAdapter();
  const records = await adapter.readJson<LlmUsageRecord[]>({ kind: "llm_usage", key: "records" }, []);
  const durable = adapter.describe().durable;

  const totals: LlmUsageTotals = {
    totalCalls: records.length,
    totalTokens: 0,
    totalCostUsd: 0,
    byModel: {},
    byDay: {},
    durable
  };

  for (const record of records) {
    totals.totalTokens += record.totalTokens;
    totals.totalCostUsd += record.estimatedCostUsd;

    const model = (totals.byModel[record.model] ||= { calls: 0, tokens: 0, costUsd: 0 });
    model.calls += 1;
    model.tokens += record.totalTokens;
    model.costUsd = Number((model.costUsd + record.estimatedCostUsd).toFixed(6));

    const day = record.at.slice(0, 10);
    totals.byDay[day] = Number(((totals.byDay[day] || 0) + record.estimatedCostUsd).toFixed(6));
  }

  totals.totalCostUsd = Number(totals.totalCostUsd.toFixed(6));
  return totals;
}

// Per-run guard: bound how many real (paid) model calls a single build makes, so
// one build can't fan out into a runaway bill. In-memory, no persistence needed.
// Default high enough for a normal task graph; override via env.
export function getMaxLlmCallsPerRun(): number {
  const value = Number(process.env.APP_ENGINE_LLM_MAX_CALLS_PER_RUN);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 24;
}
