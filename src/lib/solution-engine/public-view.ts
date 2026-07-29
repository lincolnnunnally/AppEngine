// The projection that decides what a person is allowed to see about their own case.
//
// This exists because §4b — "never diagnose out loud" — is not just a rule about
// what the guide SAYS. The functional problem, the root class, the triage decision
// and the signals behind it are routing metadata. If they were in the JSON the
// browser receives, they would be one "view source" away from telling someone the
// app decided they have a scarcity mindset. So they never leave the server.

import { summarizeAcceptance, type AcceptanceCheck, type Assumption } from "./first-attempt";
import { getCrisisResources, getEscalationMessage, type CrisisResource, type SafetyCategory } from "./safety";
import { describeStateForPerson } from "./state-machine";
import type { CaseMessage, Commitment, Covenant, FollowUp, Intro, SolutionCase } from "./types";
import { encouragementFor, summarizeStreak } from "./covenant";

export type PublicCase = {
  token: string;
  state: string;
  statusLine: string;
  statedProblem: string | null;
  reflection: string | null;
  offer: SolutionCase["offer"];
  readyBy: string | null;
  artifactUrl: string | null;
  walkthroughUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  region: string | null;
  needsContact: boolean;
  safetyFlagged: boolean;
  safetyCategory: string | null;
  crisisResources: CrisisResource[];
  escalationMessage: string | null;
  exchangeCount: number;
};

export function toPublicCase(theCase: SolutionCase): PublicCase {
  return {
    token: theCase.token,
    state: theCase.state,
    statusLine: describeStateForPerson(theCase.state),
    statedProblem: theCase.stated_problem,
    reflection: theCase.reflection,
    offer: theCase.offer,
    readyBy: theCase.promised_for,
    artifactUrl: theCase.artifact_url,
    walkthroughUrl: theCase.walkthrough_url,
    contactName: theCase.contact_name,
    contactEmail: theCase.contact_email,
    region: theCase.region,
    needsContact: !theCase.contact_email && !theCase.contact_phone,
    safetyFlagged: theCase.safety_flagged,
    // The category is needed to pick the right resource list; it is a routing
    // label, not a diagnosis, and the person is already being told plainly that
    // we've stopped and why.
    safetyCategory: theCase.safety_flagged ? theCase.safety_reason : null,
    crisisResources: theCase.safety_flagged ? getCrisisResources((theCase.safety_reason || "self_harm") as SafetyCategory) : [],
    escalationMessage: theCase.safety_flagged ? getEscalationMessage((theCase.safety_reason || "self_harm") as SafetyCategory) : null,
    exchangeCount: theCase.exchange_count
  };
}

export function toPublicMessages(messages: CaseMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    body: message.body,
    turnIndex: message.turn_index,
    // Deliberately omitted: meta. It carries slot names and the routing source.
    reflecting: Boolean((message.meta as { reflecting?: boolean })?.reflecting)
  }));
}

export function toPublicCovenant(covenant: Covenant | null, commitments: Commitment[]) {
  if (!covenant) {
    return null;
  }

  const streak = summarizeStreak(commitments);

  return {
    weBring: covenant.we_bring,
    theyBring: covenant.they_bring,
    firstStep: covenant.first_step,
    agreed: Boolean(covenant.agreed_at),
    declined: Boolean(covenant.declined_at),
    encouragement: encouragementFor(streak),
    kept: streak.kept,
    currentStreak: streak.currentStreak,
    stalled: streak.stalled,
    commitments: commitments.map((commitment) => ({
      periodIndex: commitment.period_index,
      description: commitment.description,
      dueOn: commitment.due_on,
      status: commitment.status
    }))
  };
}

export function toPublicIntro(intro: Intro | null, matchName: string | null) {
  if (!intro) {
    return null;
  }

  return {
    // The draft is written to be read by both sides; that's the point of it.
    draft: intro.draft,
    matchName,
    state: intro.state,
    // Contact details are never in this payload. They cross only after both sides
    // confirm, and then by email — not through the browser (§7).
    awaitingYou: !intro.person_confirmed_at,
    awaitingThem: Boolean(intro.person_confirmed_at) && !intro.match_confirmed_at,
    attempt: intro.attempt_number
  };
}

// The two lists that make first-attempt delivery possible: what we decided
// without stopping to ask, and what "finished" will mean. Both are on the offer
// screen, where changing one is free.
export function toPublicAssumptions(assumptions: Assumption[]) {
  return assumptions.map((assumption) => ({
    id: assumption.id,
    question: assumption.question,
    assumed: assumption.assumed,
    rationale: assumption.rationale,
    status: assumption.status,
    correctedTo: assumption.corrected_to
  }));
}

export function toPublicAcceptance(checks: AcceptanceCheck[]) {
  const summary = summarizeAcceptance(checks);

  return {
    steps: checks.map((check) => ({
      stepIndex: check.step_index,
      description: check.description,
      status: check.status
    })),
    passing: summary.passing,
    total: summary.total,
    deliverable: summary.deliverable
  };
}

export function toPublicFollowUp(followUp: FollowUp | null) {
  if (!followUp) {
    return null;
  }

  return { dueAt: followUp.due_at, answered: Boolean(followUp.answered_at) };
}
