// §4c — relief vs. development. The single most important classification the
// intake makes, and the one place the app is allowed to be immovable.
//
// The decision is made from SIGNALS, not from vibes, so it can be re-read later
// and argued with. The conversation collects the signals; this file turns them
// into a route.

import type { RootClass, Triage, TriageSignals } from "./types";

export type TriageDecision = {
  triage: Triage;
  reliefScore: number;
  developmentScore: number;
  rationale: string[];
};

export function decideTriage(signals: TriageSignals): TriageDecision {
  const rationale: string[] = [];
  let reliefScore = 0;
  let developmentScore = 0;

  // "Is this new, or has this been going on a while?" — the single question that
  // separates crisis from chronic (§4b).
  if (signals.duration === "new") {
    reliefScore += 2;
    rationale.push("The situation is new.");
  } else if (signals.duration === "months") {
    developmentScore += 2;
    rationale.push("This has been going on for months.");
  } else if (signals.duration === "years") {
    developmentScore += 3;
    rationale.push("This has been going on for years.");
  }

  if (signals.suddenEvent) {
    reliefScore += 2;
    rationale.push("A sudden event triggered it.");
  }

  if (signals.firstTimeAsker) {
    reliefScore += 1;
    rationale.push("First time asking for help with this.");
  }

  if (signals.boundedNeed) {
    reliefScore += 1;
    rationale.push("The need is specific and bounded.");
  }

  if (signals.soughtHelpBefore) {
    developmentScore += 2;
    rationale.push("They have sought help for this before.");
  }

  // "Need described as money itself rather than what money would fix" — the
  // clearest chronic-scarcity tell in the brief.
  if (signals.needDescribedAsMoney) {
    developmentScore += 2;
    rationale.push("The need is described as money itself, not as what money would fix.");
  }

  if (reliefScore === 0 && developmentScore === 0) {
    // Nothing learned yet. Default to development: the participation offer is the
    // warm, boundaried default, and a genuine crisis produces loud signals fast.
    return {
      triage: "development",
      reliefScore,
      developmentScore,
      rationale: ["No clear signals yet; defaulting to the participation track."]
    };
  }

  const gap = Math.abs(reliefScore - developmentScore);

  // Mixed signals → treat the acute piece as relief, then move to development at
  // the first follow-up (§4c).
  if (gap <= 1 && reliefScore > 0 && developmentScore > 0) {
    return { triage: "crisis_first", reliefScore, developmentScore, rationale };
  }

  return {
    triage: reliefScore > developmentScore ? "relief" : "development",
    reliefScore,
    developmentScore,
    rationale
  };
}

export function requiresCovenant(triage: Triage | null): boolean {
  // Relief is fast, generous, no strings (§4c). Crisis-first gets the acute help
  // now and the covenant at the first follow-up — not at the door.
  return triage === "development";
}

// A returning person on the chronic track gets the development offer again,
// warmly, every time — and nothing else (§4c hard rule). This is what keeps the
// app from becoming a repeat-relief dispenser, which is precisely what a tired
// human helper cannot hold.
export function isRepeatReliefRequest(priorCases: { triage: Triage | null; closed_at: string | null }[]): boolean {
  const priorRelief = priorCases.filter((prior) => prior.triage === "relief" || prior.triage === "crisis_first");
  return priorRelief.length >= 1;
}

export const rootClasses: RootClass[] = [
  "scarcity_focus",
  "isolation",
  "crisis_event",
  "skill_gap",
  "identity_collapse",
  "capacity_overload",
  "unknown"
];

export function normalizeRootClass(value: unknown): RootClass {
  const candidate = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (rootClasses as string[]).includes(candidate) ? (candidate as RootClass) : "unknown";
}

// Root class is routing metadata. It is never rendered to the person and never
// spoken back to them — §4b, "never diagnose out loud".
export const rootClassIsInternalOnly = true;
