// Suggested next step (CRM v2 slice 4): the server side. SERVER ONLY — imported
// by the CRM server action, never by a "use client" file. Rules live in
// crm-suggest-core.ts; this file only asks the model, caches, and fails closed.
//
// Cost controls:
//  * Nothing is asked on page load. One call only when the owner taps
//    "Suggest a next step" on one card.
//  * One answer per org per Eastern day (same inputs → cached; a card that
//    changed, e.g. a new visit, asks again). In-memory per server instance.
//  * A daily cap per server instance (CRM_SUGGEST_DAILY_CAP, default 60).
//  * Short answers (max 300 tokens) and a 12-second timeout.
// Fail closed: no key, a timeout, an error, or an answer that doesn't pass the
// rules → "Suggestions aren't available right now." / "No suggestion…".

import { hasAiProvider, xaiJson } from "@/lib/xai";
import {
  SUGGEST_NONE,
  SUGGEST_UNAVAILABLE,
  cleanSuggestion,
  suggestCacheKey,
  suggestGate,
  suggestInput,
  suggestKind,
  type SuggestCard,
  type SuggestInput,
  type Suggestion
} from "@/lib/engine/crm-suggest-core";

// Kept on the server (not in the shared rules file) so the instructions never ship to the browser.
export function suggestPrompt(input: SuggestInput): { system: string; user: string } {
  const system = [
    "You help the owner of a small ministry-and-business studio plan the next in-person step with one organization.",
    "Suggest ONE short, concrete next step the owner can do themselves (a visit, a drop-off, a call back), and at most one app from allowed_apps.",
    "Only pick an app whose id is in allowed_apps. If none fits, use an empty string. Never mention any other product.",
    input.org_type === "church"
      ? "This is a church. Use warm, plain words. Never use the word marketing. Never suggest business tools."
      : "This is a local business. Use plain words.",
    "Do not invent names, emails, phone numbers or facts. Keep next_step under 120 characters and why under 160.",
    'Answer with JSON only: {"next_step": string, "app": string, "when_days": integer 0-30, "why": string}.'
  ].join(" ");
  return { system, user: JSON.stringify(input) };
}

export type SuggestResult =
  | { ok: true; suggestion: Suggestion; cached: boolean }
  | { ok: false; message: string; reason: "stopped" | "resting" | "blocked" | "unavailable" | "none" };

const TIMEOUT_MS = 12_000;
const MAX_TOKENS = 300;
const CACHE_MAX = 500;

const cache = new Map<string, Suggestion | null>();
let spent = { day: "", calls: 0 };

function dailyCap(): number {
  const value = Number(process.env.CRM_SUGGEST_DAILY_CAP);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 60;
}

/** Local screenshots only: a canned answer. Never on any Vercel deploy (VERCEL_ENV is always set there). */
function mockAnswer(kind?: "church" | "business"): string | null {
  if (process.env.VERCEL_ENV || process.env.NODE_ENV !== "development") return null;
  const mock = process.env.CRM_SUGGEST_MOCK;
  if (!mock) return null;
  try {
    const byKind = JSON.parse(mock) as Record<string, unknown>;
    if (kind && byKind && typeof byKind[kind] === "object") return JSON.stringify(byKind[kind]);
  } catch {
    // a plain answer
  }
  return mock;
}

export function suggestionsConfigured(): boolean {
  return hasAiProvider() || mockAnswer() !== null;
}

export async function suggestNextStep(
  card: SuggestCard,
  outreachHidden: boolean,
  now = new Date(),
  ask: (system: string, user: string) => Promise<string> = (system, user) => xaiJson({ system, user, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS, model: (process.env.XAI_CRM_MODEL || "").trim() || undefined })
): Promise<SuggestResult> {
  const gate = suggestGate(card, outreachHidden);
  if (gate.kind !== "ok") return { ok: false, message: gate.message, reason: gate.kind };
  const kind = suggestKind(card);
  const input = suggestInput(card, kind, now);
  const key = suggestCacheKey(card.key, input);
  if (cache.has(key)) {
    const hit = cache.get(key) ?? null;
    return hit ? { ok: true, suggestion: hit, cached: true } : { ok: false, message: SUGGEST_NONE, reason: "none" };
  }
  const mock = mockAnswer(kind);
  if (!mock && !hasAiProvider()) return { ok: false, message: SUGGEST_UNAVAILABLE, reason: "unavailable" };
  if (spent.day !== input.today) spent = { day: input.today, calls: 0 };
  if (!mock && spent.calls >= dailyCap()) return { ok: false, message: SUGGEST_UNAVAILABLE, reason: "unavailable" };
  let answer: string;
  try {
    spent.calls += 1;
    const prompt = suggestPrompt(input);
    answer = mock ?? (await ask(prompt.system, prompt.user));
  } catch {
    // Never log the error body: it can echo the request.
    return { ok: false, message: SUGGEST_UNAVAILABLE, reason: "unavailable" };
  }
  const suggestion = cleanSuggestion(kind, answer, card, input.today);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, suggestion);
  return suggestion ? { ok: true, suggestion, cached: false } : { ok: false, message: SUGGEST_NONE, reason: "none" };
}
