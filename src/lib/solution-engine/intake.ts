// §4 — the intake engine. The heart of the app.
//
// Three layers are being worked down at once: what they SAID, what is actually
// BROKEN in their day, and the ROOT condition that keeps regenerating it. Only
// the first is ever spoken about out loud. The other two are routing.
//
// A language model phrases the questions when one is reachable. It is not load
// bearing: the same ladder runs deterministically without it, because a drained
// person typing at 11pm should not get an error page because a provider is down.

import { recordLlmUsage, extractUsage } from "@/lib/engine/llm-usage";
import { screenForSafety, type SafetyHit } from "./safety";
import { decideTriage } from "./triage";
import type { CaseMessage, SolutionCase, SolutionType, TriageSignals } from "./types";
import { scrubMachineLanguage } from "./voice";

export { scrubMachineLanguage };

export const MAX_EXCHANGES = 10;

// The internal ladder. Each rung is a thing we still need to know; the phrasing
// is the model's job (or the fallback's), the ORDER is ours.
export type IntakeSlot = "situation" | "day" | "history" | "barrier" | "change";

export const slotLadder: IntakeSlot[] = ["situation", "day", "history", "barrier", "change"];

// "Ask about the day, not the feelings" (§4b) — every fallback question below is
// concrete on purpose. None of them ask how anything feels.
const fallbackQuestions: Record<IntakeSlot, string> = {
  situation: "Tell me a bit more — what does this actually stop you from doing?",
  day: "Walk me through yesterday. What did the day actually look like, start to finish?",
  history:
    "Is this new, or has it been going on a while? And have you tried getting help with it before — what happened?",
  barrier: "What have you already tried? What got in the way?",
  change: "If this one thing were handled by next month, what would be different on a normal Tuesday?"
};

export type IntakeExtraction = {
  functionalProblem?: string;
  rootClass?: string;
  solutionType?: SolutionType;
  signals?: TriageSignals;
  filledSlots?: IntakeSlot[];
};

export type IntakeTurn = {
  say: string;
  extraction: IntakeExtraction;
  readyToReflect: boolean;
  reflection?: string;
  safety?: SafetyHit;
  source: "model" | "ladder";
};

export type IntakeContext = {
  theCase: SolutionCase;
  messages: CaseMessage[];
  personSaid: string;
};

export async function runIntakeTurn(context: IntakeContext): Promise<IntakeTurn> {
  // The deterministic screen runs first, always, on the raw text. Nothing else
  // happens on this turn if it fires.
  const safety = screenForSafety(context.personSaid);

  if (safety) {
    return {
      say: "",
      extraction: {},
      readyToReflect: false,
      safety,
      source: "ladder"
    };
  }

  const filled = filledSlotsFrom(context.messages, context.theCase);
  const nextSlot = slotLadder.find((slot) => !filled.includes(slot));
  const exchanges = countPersonTurns(context.messages) + 1;
  const mustWrapUp = exchanges >= MAX_EXCHANGES || !nextSlot;

  const modelTurn = await tryModelTurn(context, { filled, nextSlot, exchanges, mustWrapUp });

  if (modelTurn) {
    return modelTurn;
  }

  return ladderTurn(context, { filled, nextSlot, mustWrapUp });
}

type LadderInput = {
  filled: IntakeSlot[];
  nextSlot?: IntakeSlot;
  mustWrapUp: boolean;
};

function ladderTurn(context: IntakeContext, input: LadderInput): IntakeTurn {
  const signals = inferSignalsFromText(context.personSaid, context.messages);
  const slotJustFilled = input.nextSlot;
  const filled = slotJustFilled ? [...input.filled, slotJustFilled] : input.filled;
  const remaining = slotLadder.find((slot) => !filled.includes(slot));

  if (input.mustWrapUp || !remaining) {
    const reflection = buildReflection(context, signals);

    return {
      say: reflection,
      extraction: {
        signals,
        filledSlots: filled,
        functionalProblem: inferFunctionalProblem(context),
        solutionType: inferSolutionType(context)
      },
      readyToReflect: true,
      reflection,
      source: "ladder"
    };
  }

  return {
    say: fallbackQuestions[remaining],
    extraction: { signals, filledSlots: filled },
    readyToReflect: false,
    source: "ladder"
  };
}

// "Reflect before proposing." Restate the problem in the person's own words and
// get a yes before any offer. Feeling heard is half the product (§4b).
function buildReflection(context: IntakeContext, signals: TriageSignals): string {
  const stated = (context.theCase.stated_problem || context.personSaid).trim();
  const shortened = stated.length > 220 ? `${stated.slice(0, 217).trim()}…` : stated;
  const weight = signals.duration === "years" || signals.duration === "months" ? "carrying this for a while" : "dealing with this";

  return `So here's what I'm hearing: ${shortened} — and you've been ${weight} without much help. Did I get that right?`;
}

function inferFunctionalProblem(context: IntakeContext): string {
  const personTurns = context.messages.filter((message) => message.role === "person").map((message) => message.body);
  const all = [...personTurns, context.personSaid].join(" ").toLowerCase();

  if (/\bcustomer|sell|sales|orders?|clients?|bookings?\b/.test(all)) {
    return "No reliable way to reach or take money from the people who would pay them.";
  }

  if (/\bpaperwork|admin|invoic|schedul|spreadsheet|track(ing)?\b/.test(all)) {
    return "Day-to-day admin is eating the hours that would otherwise produce income.";
  }

  if (/\bjob|resume|apply|applications?|interview|laid off|fired\b/.test(all)) {
    return "No working system for finding and landing the next job.";
  }

  if (/\bchildcare|kids|daycare|babysit\b/.test(all)) {
    return "No usable window of time in which to work.";
  }

  return "Unclear from the conversation; needs an operator read.";
}

function inferSolutionType(context: IntakeContext): SolutionType {
  const personTurns = context.messages.filter((message) => message.role === "person").map((message) => message.body);
  const all = [...personTurns, context.personSaid].join(" ").toLowerCase();

  if (/\bsell|customers?|clients?|booking|orders?|side (job|hustle|business)|business\b/.test(all)) {
    return "business_starter";
  }

  if (/\bjob|resume|apply|applications?|interview\b/.test(all)) {
    return "job_search_kit";
  }

  if (/\btrack|schedul|budget|form|letter|list|remind\b/.test(all)) {
    return "personal_tool";
  }

  return "personal_tool";
}

export function inferSignalsFromText(latest: string, messages: CaseMessage[]): TriageSignals {
  const personTurns = messages.filter((message) => message.role === "person").map((message) => message.body);
  const all = [...personTurns, latest].join(" ").toLowerCase();
  const signals: TriageSignals = { notes: [] };

  if (/\byears?\b|\ball my life\b|\bas long as i can remember\b|\balways been\b/.test(all)) {
    signals.duration = "years";
  } else if (/\bmonths?\b|\bsince (january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(all)) {
    signals.duration = "months";
  } else if (/\bthis (week|month)\b|\blast (week|month)\b|\bjust (got|lost|happened)\b|\bsuddenly\b|\brecently\b/.test(all)) {
    signals.duration = "new";
  }

  if (/\blaid off\b|\bfired\b|\bevict\w*\b|\bhospital\b|\baccident\b|\bdiagnos\w*\b|\bfire\b|\bflood\b|\bdied\b|\bpassed away\b|\bdivorce\b/.test(all)) {
    signals.suddenEvent = true;
  }

  if (/\btried (getting|to get) help\b|\bwent to\b.*\b(church|agency|program|charity)\b|\bapplied for (assistance|help|benefits)\b|\bbeen through this\b|\blast time\b/.test(all)) {
    signals.soughtHelpBefore = true;
  } else if (/\bnever asked\b|\bfirst time\b|\bnever done this\b/.test(all)) {
    signals.firstTimeAsker = true;
  }

  // The need described as money itself, rather than as what money would fix.
  if (/\b(need|want) (some )?(money|cash|\$|a loan|funds)\b|\bhelp with (rent|the bill|bills|money)\b/.test(all)) {
    signals.needDescribedAsMoney = true;
  }

  if (/\bjust need\b|\bone time\b|\bonly need\b|\ball i need\b/.test(all)) {
    signals.boundedNeed = true;
  }

  return signals;
}

function filledSlotsFrom(messages: CaseMessage[], theCase: SolutionCase): IntakeSlot[] {
  // The cumulative slot list is written onto the guide's turn (that's the turn we
  // control), so the union has to look at every message — reading only the
  // person's turns leaves the ladder stuck on its first rung forever.
  const recorded = messages.flatMap((message) => {
    const slots = (message.meta as { slots?: unknown })?.slots;
    return Array.isArray(slots) ? (slots as IntakeSlot[]) : [];
  });

  const filled = new Set<IntakeSlot>(recorded);

  // The landing box answers "situation" before the conversation even starts.
  if (theCase.stated_problem) {
    filled.add("situation");
  }

  return slotLadder.filter((slot) => filled.has(slot));
}

export function countPersonTurns(messages: CaseMessage[]): number {
  return messages.filter((message) => message.role === "person").length;
}

// ---------------------------------------------------------------------------
// Model path
// ---------------------------------------------------------------------------

type ModelInput = LadderInput & { exchanges: number };

function modelConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const systemPrompt = `You are the intake guide for a service that builds people a small, custom solution to a problem in their life, free, within days — and then introduces them to a real human being fighting the same battle.

You are talking to someone who is probably tired. Sound like a warm, practical friend texting them back. Short. Plain words. No bullet points, no headings, no emoji.

HARD RULES — breaking any of these is a failure:
1. Never mention artificial intelligence, models, agents, automation, algorithms, or that anything is "generated". You are simply the person answering. If asked directly, say you're part of the team here.
2. Never diagnose out loud. Never use mindset, therapy, or self-help language. Never say things like "it sounds like you're focused on lack" or "that's a scarcity mindset". Never tell them what their real problem is.
3. Ask about their day, not their feelings. "Walk me through yesterday" beats "how do you feel about money".
4. Ask ONE question per turn. Never stack two questions except the history question, which is allowed to ask whether it's new and whether they've sought help before.
5. Never promise a specific solution yet, never quote a price, never mention what you might build. That comes later.
6. Do not counsel, and do not comfort with platitudes. Acknowledge briefly, then ask the next concrete thing.

You return ONLY a JSON object, no prose around it, with these keys:
{
  "say": "your next message to them — one or two sentences, ending in one question (or the reflection if reflecting)",
  "readyToReflect": boolean,
  "reflection": "if readyToReflect, restate their problem in THEIR OWN words and ask 'Did I get that right?' — otherwise empty string",
  "slotsFilled": ["situation"|"day"|"history"|"barrier"|"change"],
  "functionalProblem": "internal only — what is actually broken in their day-to-day, one sentence",
  "rootClass": one of "scarcity_focus" | "isolation" | "crisis_event" | "skill_gap" | "identity_collapse" | "capacity_overload" | "unknown",
  "solutionType": one of "business_starter" | "personal_tool" | "job_search_kit" | "action_plan",
  "signals": {
    "duration": "new" | "months" | "years" | "unknown",
    "soughtHelpBefore": boolean,
    "suddenEvent": boolean,
    "needDescribedAsMoney": boolean,
    "boundedNeed": boolean,
    "firstTimeAsker": boolean
  }
}

"functionalProblem", "rootClass", "solutionType" and "signals" are internal routing fields. They are NEVER shown to the person and must never leak into "say".`;

async function tryModelTurn(context: IntakeContext, input: ModelInput): Promise<IntakeTurn | null> {
  if (!modelConfigured()) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.1";
  const transcript = [...context.messages.map((message) => `${message.role === "person" ? "Them" : "You"}: ${message.body}`), `Them: ${context.personSaid}`].join(
    "\n"
  );

  const stillNeeded = input.nextSlot ? slotLadder.slice(slotLadder.indexOf(input.nextSlot)) : [];
  const instruction = [
    `This is exchange ${input.exchanges} of at most ${MAX_EXCHANGES}.`,
    stillNeeded.length ? `Still to learn, in this order: ${stillNeeded.join(", ")}.` : "You have what you need.",
    input.mustWrapUp
      ? "You MUST reflect back now: set readyToReflect true and put the reflection in both 'say' and 'reflection'."
      : "Ask the next thing. Set readyToReflect true only if you already know enough to restate their problem accurately."
  ].join(" ");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions: `${systemPrompt}\n\n${instruction}`,
        input: `What they first wrote: ${context.theCase.stated_problem || "(nothing yet)"}\n\nConversation so far:\n${transcript}`,
        max_output_tokens: 700
      }),
      signal: AbortSignal.timeout(getIntakeTimeoutMs())
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const usage = extractUsage(payload);

    await recordLlmUsage({
      provider: "openai",
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      agent: "solution-engine-intake",
      task: "intake_turn"
    });

    const parsed = parseModelJson(extractOutputText(payload));

    if (!parsed || !parsed.say) {
      return null;
    }

    return {
      say: scrubMachineLanguage(parsed.say),
      readyToReflect: Boolean(parsed.readyToReflect) || input.mustWrapUp,
      reflection: parsed.reflection ? scrubMachineLanguage(parsed.reflection) : undefined,
      extraction: {
        functionalProblem: parsed.functionalProblem,
        rootClass: parsed.rootClass,
        solutionType: parsed.solutionType as SolutionType | undefined,
        signals: mergeSignals(inferSignalsFromText(context.personSaid, context.messages), parsed.signals),
        filledSlots: Array.isArray(parsed.slotsFilled)
          ? (parsed.slotsFilled.filter((slot: unknown) => slotLadder.includes(slot as IntakeSlot)) as IntakeSlot[])
          : input.nextSlot
            ? [...input.filled, input.nextSlot]
            : input.filled
      },
      source: "model"
    };
  } catch {
    // Provider hiccup: fall through to the ladder. The person never sees this.
    return null;
  }
}

function getIntakeTimeoutMs(): number {
  const value = Number(process.env.SOLUTION_ENGINE_INTAKE_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 20000;
}

type ParsedTurn = {
  say?: string;
  readyToReflect?: boolean;
  reflection?: string;
  slotsFilled?: unknown[];
  functionalProblem?: string;
  rootClass?: string;
  solutionType?: string;
  signals?: Partial<TriageSignals>;
};

function parseModelJson(text: string): ParsedTurn | null {
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as ParsedTurn;
  } catch {
    return null;
  }
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = payload.output as { content?: { text?: string; type?: string }[] }[] | undefined;

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => item.content || [])
      .map((part) => part.text || "")
      .join("")
      .trim();
  }

  return "";
}

function mergeSignals(inferred: TriageSignals, reported?: Partial<TriageSignals>): TriageSignals {
  if (!reported) {
    return inferred;
  }

  return {
    ...inferred,
    ...Object.fromEntries(Object.entries(reported).filter(([, value]) => value !== undefined && value !== "unknown"))
  } as TriageSignals;
}

export function summarizeTriage(signals: TriageSignals) {
  return decideTriage(signals);
}
