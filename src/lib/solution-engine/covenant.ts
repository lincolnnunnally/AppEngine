// §6 — the participation mechanic. Chronic track only.
//
// The app removes barriers and excuses; it never removes the showing-up. What is
// tracked here is KEPT COMMITMENTS, not outcomes: week one is not "did you make
// money", it is "did you do the thing".

import { insertRow, insertRows, selectOne, selectRows, updateOne } from "./db";
import { offerFirstStep, offerTheyBring } from "./offer";
import type { Commitment, Covenant, SolutionCase, SolutionType } from "./types";

export const WEEKS_TRACKED = 8;

export function draftCovenant(theCase: SolutionCase): { we_bring: string[]; they_bring: string; first_step: string } {
  const solutionType = (theCase.solution_type || "personal_tool") as SolutionType;

  return {
    we_bring: [
      "We build the thing and put it online with your name on it.",
      "We set it up so there's nothing for you to configure.",
      "We walk you through it in ten minutes.",
      "We introduce you to someone who's been where you are."
    ],
    they_bring: offerTheyBring(solutionType),
    // "The first required action must be completable in under an hour" (§6.2).
    first_step: offerFirstStep(solutionType)
  };
}

export async function createCovenant(theCase: SolutionCase): Promise<Covenant> {
  const existing = await selectOne<Covenant>("se_covenants", `case_id=eq.${theCase.id}&select=*`);

  if (existing) {
    return existing;
  }

  const draft = draftCovenant(theCase);

  return insertRow<Covenant>("se_covenants", {
    case_id: theCase.id,
    we_bring: draft.we_bring,
    they_bring: draft.they_bring,
    first_step: draft.first_step
  });
}

export async function agreeToCovenant(theCase: SolutionCase): Promise<Covenant> {
  const covenant = await createCovenant(theCase);
  const agreed = await updateOne<Covenant>("se_covenants", `id=eq.${covenant.id}`, {
    agreed_at: new Date().toISOString(),
    declined_at: null
  });

  await seedCommitments(theCase, agreed);
  return agreed;
}

// The refusal is data, not failure (§6.5). We log it, stay warm, and hold the line.
export async function declineCovenant(theCase: SolutionCase): Promise<Covenant> {
  const covenant = await createCovenant(theCase);

  return updateOne<Covenant>("se_covenants", `id=eq.${covenant.id}`, {
    declined_at: new Date().toISOString()
  });
}

export async function seedCommitments(theCase: SolutionCase, covenant: Covenant): Promise<Commitment[]> {
  const existing = await selectRows<Commitment>("se_commitments", `covenant_id=eq.${covenant.id}&select=id`);

  if (existing.length > 0) {
    return [];
  }

  const start = new Date();
  const rows = Array.from({ length: WEEKS_TRACKED }, (_, index) => {
    const due = new Date(start);
    due.setUTCDate(due.getUTCDate() + 7 * (index + 1));

    return {
      case_id: theCase.id,
      covenant_id: covenant.id,
      period_index: index + 1,
      // Week one is the small first step; every week after is the recurring action.
      description: index === 0 ? covenant.first_step : covenant.they_bring,
      due_on: due.toISOString().slice(0, 10)
    };
  });

  return insertRows<Commitment>("se_commitments", rows);
}

export async function getCovenant(caseId: string): Promise<Covenant | null> {
  return selectOne<Covenant>("se_covenants", `case_id=eq.${caseId}&select=*`);
}

export async function listCommitments(caseId: string): Promise<Commitment[]> {
  return selectRows<Commitment>("se_commitments", `case_id=eq.${caseId}&select=*&order=period_index.asc`);
}

export async function answerCommitment(
  commitment: Commitment,
  status: "kept" | "missed" | "shrunk",
  note?: string
): Promise<Commitment> {
  return updateOne<Commitment>("se_commitments", `id=eq.${commitment.id}`, {
    status,
    note: note || null,
    responded_at: new Date().toISOString()
  });
}

export type StreakSummary = {
  kept: number;
  missed: number;
  currentStreak: number;
  longestStreak: number;
  consecutiveMissed: number;
  // Two missed commitments trips the stall protocol (§6.4).
  stalled: boolean;
};

export function summarizeStreak(commitments: Commitment[]): StreakSummary {
  const answered = commitments
    .filter((commitment) => commitment.status !== "pending")
    .sort((a, b) => a.period_index - b.period_index);

  let currentStreak = 0;
  let longestStreak = 0;
  let consecutiveMissed = 0;
  let kept = 0;
  let missed = 0;

  for (const commitment of answered) {
    if (commitment.status === "missed") {
      missed += 1;
      currentStreak = 0;
      consecutiveMissed += 1;
      continue;
    }

    // "shrunk" still counts as showing up — the step got smaller, not skipped.
    kept += 1;
    currentStreak += 1;
    consecutiveMissed = 0;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return {
    kept,
    missed,
    currentStreak,
    longestStreak,
    consecutiveMissed,
    stalled: consecutiveMissed >= 2
  };
}

// Streaks of kept commitments are surfaced back to the person as evidence against
// their own scarcity story (§6.3). This is the sentence they read — never a
// scoreboard, never a guilt trip.
export function encouragementFor(streak: StreakSummary): string {
  if (streak.kept === 0) {
    return "Nothing logged yet. The first one is the only hard one.";
  }

  if (streak.currentStreak >= 4) {
    return `${streak.currentStreak} weeks straight. That's not luck, and it isn't nothing — that's you showing up ${streak.currentStreak} times in a row.`;
  }

  if (streak.currentStreak >= 2) {
    return `${streak.currentStreak} weeks in a row. You said you'd do it and you did it.`;
  }

  if (streak.kept >= 1) {
    return `${streak.kept} kept so far. Back on it this week.`;
  }

  return "Back on it this week.";
}

// The stall message. No shame language, no nagging loop — offer to make the step
// smaller, and if that doesn't land, the case pauses with the door open.
export function stallMessage(covenant: Covenant): string {
  return `Two weeks have gone by without the step, and that's usually a sign the step is too big — not that you're not trying. Want to shrink it? Right now it's "${covenant.they_bring}". We can cut that in half and it still counts.`;
}
