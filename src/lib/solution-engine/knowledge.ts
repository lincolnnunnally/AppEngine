// §9 — the knowledge layer. Principle 3: "The durable asset is what we learn about
// problems and what actually resolves them — not the code. Code is regenerable
// exhaust."
//
// So this file writes the record that outlives the solution, and computes the
// north-star metrics in the order Lincoln put them in. Note what is NOT the north
// star: solutions shipped.

import { insertRow, selectOne, selectRows, updateOne } from "./db";
import { summarizeStreak } from "./covenant";
import type { Commitment, FollowUp, Intro, KnowledgeRecord, SolutionCase } from "./types";

export async function upsertKnowledgeRecord(theCase: SolutionCase, patch: Partial<KnowledgeRecord> = {}): Promise<KnowledgeRecord> {
  const base = {
    stated_problem: theCase.stated_problem,
    functional_problem: theCase.functional_problem,
    root_class: theCase.root_class,
    triage: theCase.triage,
    solution_type: theCase.solution_type,
    intake_to_delivery_hours: hoursBetween(theCase.created_at, theCase.delivered_at),
    ...stripUndefined(patch)
  };

  const existing = await selectOne<KnowledgeRecord>("se_knowledge_records", `case_id=eq.${theCase.id}&select=*`);

  if (existing) {
    return updateOne<KnowledgeRecord>("se_knowledge_records", `id=eq.${existing.id}`, base);
  }

  return insertRow<KnowledgeRecord>("se_knowledge_records", { case_id: theCase.id, ...base });
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function hoursBetween(from: string, to: string | null): number | null {
  if (!to) {
    return null;
  }

  const delta = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(delta) ? Math.round(delta / 3_600_000) : null;
}

export async function recordConnectionOutcome(theCase: SolutionCase, outcome: string): Promise<KnowledgeRecord> {
  return upsertKnowledgeRecord(theCase, { connection_outcome: outcome });
}

export async function recordCommitmentStreak(theCase: SolutionCase, commitments: Commitment[]): Promise<KnowledgeRecord> {
  return upsertKnowledgeRecord(theCase, { commitment_streak: summarizeStreak(commitments).longestStreak });
}

export type NorthStarMetrics = {
  // 1. Accepted human connections per month — the metric that matters.
  acceptedConnectionsThisMonth: number;
  acceptedConnectionsAllTime: number;
  // 2. Kept-commitment streaks (chronic track)
  activeStreaks: number;
  longestStreak: number;
  // 3. Solutions still in use at 2 weeks
  stillInUseAtTwoWeeks: number;
  twoWeekResponses: number;
  // 4. Time from intake to delivery
  medianIntakeToDeliveryHours: number | null;
  // 5. Testimonies captured
  testimonies: number;
  // Deliberately last, and deliberately labelled: this is not the score.
  solutionsDelivered: number;
  openCases: number;
  casesAwaitingConnection: number;
};

export async function computeNorthStar(): Promise<NorthStarMetrics> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [intros, records, commitments, followups, cases] = await Promise.all([
    selectRows<Pick<Intro, "state" | "contact_shared_at">>("se_intros", "select=state,contact_shared_at"),
    selectRows<Pick<KnowledgeRecord, "intake_to_delivery_hours" | "testimony" | "commitment_streak">>(
      "se_knowledge_records",
      "select=intake_to_delivery_hours,testimony,commitment_streak"
    ),
    selectRows<Commitment>("se_commitments", "select=*"),
    selectRows<Pick<FollowUp, "answered_at" | "still_working">>("se_followups", "select=answered_at,still_working"),
    selectRows<Pick<SolutionCase, "state" | "delivered_at">>("se_cases", "select=state,delivered_at")
  ]);

  const accepted = intros.filter((intro) => intro.state === "accepted");
  const byCovenant = groupBy(commitments, (commitment) => commitment.covenant_id);
  const streaks = Object.values(byCovenant).map((group) => summarizeStreak(group));
  const deliveryHours = records
    .map((record) => record.intake_to_delivery_hours)
    .filter((hours): hours is number => typeof hours === "number");

  const answered = followups.filter((followup) => followup.answered_at);

  return {
    acceptedConnectionsThisMonth: accepted.filter((intro) => intro.contact_shared_at && new Date(intro.contact_shared_at) >= monthStart).length,
    acceptedConnectionsAllTime: accepted.length,
    activeStreaks: streaks.filter((streak) => streak.currentStreak > 0).length,
    longestStreak: streaks.reduce((max, streak) => Math.max(max, streak.longestStreak), 0),
    stillInUseAtTwoWeeks: answered.filter((followup) => followup.still_working).length,
    twoWeekResponses: answered.length,
    medianIntakeToDeliveryHours: median(deliveryHours),
    testimonies: records.filter((record) => Boolean(record.testimony?.trim())).length,
    solutionsDelivered: cases.filter((theCase) => Boolean(theCase.delivered_at)).length,
    openCases: cases.filter((theCase) => !["closed", "declined", "escalated"].includes(theCase.state)).length,
    casesAwaitingConnection: cases.filter((theCase) => theCase.state === "delivered_pending_connection" || theCase.state === "connecting").length
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((carry, item) => {
    const bucket = key(item);
    (carry[bucket] ||= []).push(item);
    return carry;
  }, {});
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

// What the knowledge layer is FOR: reading back across cases to see which root
// conditions we actually resolve, and which we only ever put a tool on top of.
export type RootPattern = {
  rootClass: string;
  cases: number;
  delivered: number;
  connected: number;
  stillInUse: number;
};

export async function readRootPatterns(): Promise<RootPattern[]> {
  const records = await selectRows<KnowledgeRecord>("se_knowledge_records", "select=*");
  const buckets = new Map<string, RootPattern>();

  for (const record of records) {
    const rootClass = record.root_class || "unknown";
    const bucket = buckets.get(rootClass) || { rootClass, cases: 0, delivered: 0, connected: 0, stillInUse: 0 };
    bucket.cases += 1;

    if (record.solution_type) {
      bucket.delivered += 1;
    }

    if (record.connection_outcome === "accepted") {
      bucket.connected += 1;
    }

    if (record.usage_at_two_weeks) {
      bucket.stillInUse += 1;
    }

    buckets.set(rootClass, bucket);
  }

  return [...buckets.values()].sort((a, b) => b.cases - a.cases);
}
