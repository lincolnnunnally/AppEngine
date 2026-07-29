// The operator read model. This is the ONE place the internal layers — functional
// problem, root class, triage, signals — are allowed to be visible, because an
// operator has to be able to argue with a routing decision. None of it goes
// anywhere near the public projection (see public-view.ts).

import { selectRows } from "./db";
import { listAcceptanceChecks, listAssumptions, summarizeAcceptance } from "./first-attempt";
import { findGroupCandidates } from "./connection";
import { computeNorthStar, readRootPatterns } from "./knowledge";
import type { Intro, PoolMember, SafetyEscalation, SolutionCase } from "./types";

export type OperatorCase = SolutionCase & {
  acceptancePassing: number;
  acceptanceTotal: number;
  openAssumptions: number;
};

export type OperatorDashboard = {
  metrics: Awaited<ReturnType<typeof computeNorthStar>>;
  rootPatterns: Awaited<ReturnType<typeof readRootPatterns>>;
  // The attention queue, in the order a person's time is best spent.
  needsSafetyAck: SafetyEscalation[];
  awaitingConnection: SolutionCase[];
  awaitingBuild: SolutionCase[];
  awaitingOfferReview: SolutionCase[];
  openIntros: Intro[];
  cases: SolutionCase[];
  pool: PoolMember[];
  groupCandidates: ReturnType<typeof findGroupCandidates>;
};

export async function loadOperatorDashboard(): Promise<OperatorDashboard> {
  const [metrics, rootPatterns, safety, cases, pool, openIntros] = await Promise.all([
    computeNorthStar(),
    readRootPatterns(),
    selectRows<SafetyEscalation>("se_safety_escalations", "acknowledged_at=is.null&select=*&order=created_at.desc"),
    selectRows<SolutionCase>("se_cases", "select=*&order=created_at.desc&limit=200"),
    selectRows<PoolMember>("se_connection_pool", "select=*&order=created_at.desc"),
    selectRows<Intro>("se_intros", "state=in.(drafted,sent)&select=*&order=created_at.desc")
  ]);

  return {
    metrics,
    rootPatterns,
    needsSafetyAck: safety,
    // Ordered by what the owner definition says matters: connections first.
    awaitingConnection: cases.filter((theCase) => theCase.state === "delivered_pending_connection"),
    awaitingBuild: cases.filter((theCase) => theCase.state === "accepted" || theCase.state === "building"),
    awaitingOfferReview: cases.filter((theCase) => theCase.state === "offered" || theCase.state === "covenant_pending"),
    openIntros,
    cases,
    pool,
    groupCandidates: findGroupCandidates(cases)
  };
}

export async function loadOperatorCase(caseId: string) {
  const [checks, assumptions] = await Promise.all([listAcceptanceChecks(caseId), listAssumptions(caseId)]);

  return {
    checks,
    assumptions,
    acceptance: summarizeAcceptance(checks)
  };
}
