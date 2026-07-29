// The case service — the one place the journey is actually driven. Everything the
// public routes and the operator console do goes through here, so the rules in
// 08_SOLUTION_ENGINE__OWNER_DEFINITION.md are enforced once rather than per screen.

import { insertRow, selectOne, selectRows, updateOne } from "./db";
import { agreeToCovenant, createCovenant, declineCovenant, getCovenant, listCommitments, summarizeStreak } from "./covenant";
import { classifyProblem, confirmIntro, declineIntro, getOpenIntro, listIntros, proposeIntro } from "./connection";
import {
  correctAssumption,
  listAcceptanceChecks,
  listAssumptions,
  recordDefaults,
  reviseAcceptanceCheck,
  seedAcceptanceChecks,
  summarizeAcceptance,
  type AcceptanceCheck,
  type Assumption
} from "./first-attempt";
import { answerFollowUp, getOpenFollowUp, scheduleFollowUp } from "./followup";
import { MAX_EXCHANGES, countPersonTurns, runIntakeTurn, scrubMachineLanguage } from "./intake";
import { recordCommitmentStreak, recordConnectionOutcome, upsertKnowledgeRecord } from "./knowledge";
import { alertSafetyEscalation, notifyDelivered, notifyIntroDrafted, notifyOfferReady } from "./notify";
import { buildOffer, nextThursday, toDateOnly } from "./offer";
import { getEscalationMessage, screenForSafety, type SafetyHit } from "./safety";
import { getCaseByToken, transitionCase } from "./state-machine";
import { decideTriage, isRepeatReliefRequest, normalizeRootClass, requiresCovenant } from "./triage";
import type { CaseMessage, FollowUp, Intro, SolutionCase, SolutionType, Triage, TriageSignals } from "./types";

export function newToken(): string {
  // Long enough that guessing one is not a thing, short enough to paste in a text.
  return `${randomChunk()}${randomChunk()}${randomChunk()}`;
}

function randomChunk(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function listMessages(caseId: string): Promise<CaseMessage[]> {
  return selectRows<CaseMessage>("se_case_messages", `case_id=eq.${caseId}&select=*&order=turn_index.asc`);
}

async function appendMessage(
  theCase: SolutionCase,
  role: "person" | "guide",
  body: string,
  meta: Record<string, unknown> = {}
): Promise<CaseMessage> {
  const existing = await selectRows<Pick<CaseMessage, "turn_index">>(
    "se_case_messages",
    `case_id=eq.${theCase.id}&select=turn_index&order=turn_index.desc&limit=1`
  );

  const nextIndex = existing.length > 0 ? existing[0].turn_index + 1 : 0;

  return insertRow<CaseMessage>("se_case_messages", {
    case_id: theCase.id,
    turn_index: nextIndex,
    role,
    body,
    meta
  });
}

export type CaseView = {
  theCase: SolutionCase;
  messages: CaseMessage[];
};

// ---------------------------------------------------------------------------
// LAND + TALK
// ---------------------------------------------------------------------------

export async function startCase(input: { statedProblem: string; anonId?: string | null }): Promise<CaseView> {
  const statedProblem = input.statedProblem.trim();

  const theCase = await insertRow<SolutionCase>("se_cases", {
    token: newToken(),
    state: "intake",
    stated_problem: statedProblem,
    anon_id: input.anonId || null,
    exchange_count: 1
  });

  await appendMessage(theCase, "person", statedProblem, { slots: ["situation"] });

  // The screen runs on the very first thing they type, before anything else.
  const hit = screenForSafety(statedProblem);

  if (hit) {
    const escalated = await escalate(theCase, hit);
    return { theCase: escalated, messages: await listMessages(theCase.id) };
  }

  const turn = await runIntakeTurn({ theCase, messages: [], personSaid: statedProblem });
  const after = await applyTurn(theCase, turn);

  return { theCase: after, messages: await listMessages(theCase.id) };
}

export async function replyToCase(theCase: SolutionCase, text: string): Promise<CaseView> {
  if (theCase.state === "escalated") {
    return { theCase, messages: await listMessages(theCase.id) };
  }

  const body = text.trim();
  const messages = await listMessages(theCase.id);

  await appendMessage(theCase, "person", body);

  const hit = screenForSafety(body);

  if (hit) {
    const escalated = await escalate(theCase, hit);
    return { theCase: escalated, messages: await listMessages(theCase.id) };
  }

  // A paused case picking back up re-enters the conversation rather than starting over.
  const working = theCase.state === "paused" ? await transitionCase(theCase, "intake", { reason: "person came back", actor: "person" }) : theCase;

  const turn = await runIntakeTurn({ theCase: working, messages, personSaid: body });
  const after = await applyTurn(working, turn);

  return { theCase: after, messages: await listMessages(after.id) };
}

async function applyTurn(theCase: SolutionCase, turn: Awaited<ReturnType<typeof runIntakeTurn>>): Promise<SolutionCase> {
  if (turn.safety) {
    return escalate(theCase, turn.safety);
  }

  const messages = await listMessages(theCase.id);
  const exchanges = countPersonTurns(messages);

  const patch: Record<string, unknown> = {
    exchange_count: exchanges,
    triage_signals: mergeSignals(theCase.triage_signals, turn.extraction.signals)
  };

  if (turn.extraction.functionalProblem) {
    patch.functional_problem = turn.extraction.functionalProblem;
  }

  if (turn.extraction.rootClass) {
    patch.root_class = normalizeRootClass(turn.extraction.rootClass);
  }

  if (turn.extraction.solutionType) {
    patch.solution_type = turn.extraction.solutionType;
  }

  const say = scrubMachineLanguage(turn.say);

  if (turn.readyToReflect) {
    patch.reflection = turn.reflection || say;
  }

  const updated = await updateOne<SolutionCase>("se_cases", `id=eq.${theCase.id}`, patch);

  await appendMessage(updated, "guide", say, {
    slots: turn.extraction.filledSlots || [],
    source: turn.source,
    reflecting: turn.readyToReflect
  });

  if (turn.readyToReflect && updated.state === "intake") {
    return transitionCase(updated, "reflected", { reason: "reflected the problem back", actor: "guide" });
  }

  return updated;
}

function mergeSignals(current: TriageSignals | null, incoming?: TriageSignals): TriageSignals {
  return { ...(current || {}), ...(incoming || {}) };
}

export function exchangesRemaining(messages: CaseMessage[]): number {
  return Math.max(0, MAX_EXCHANGES - countPersonTurns(messages));
}

// ---------------------------------------------------------------------------
// Safety (§4d) — the flow stops here and a human takes over.
// ---------------------------------------------------------------------------

async function escalate(theCase: SolutionCase, hit: SafetyHit): Promise<SolutionCase> {
  const updated = await updateOne<SolutionCase>("se_cases", `id=eq.${theCase.id}`, {
    safety_flagged: true,
    safety_reason: hit.category
  });

  await insertRow("se_safety_escalations", {
    case_id: theCase.id,
    category: hit.category,
    detected_by: "screen",
    excerpt: hit.excerpt
  });

  await appendMessage(updated, "guide", getEscalationMessage(hit.category), { escalation: hit.category });

  const escalated = await transitionCase(updated, "escalated", {
    reason: `safety screen: ${hit.category}`,
    actor: "safety_screen",
    meta: { category: hit.category }
  });

  const alert = await alertSafetyEscalation(escalated, hit.category, hit.excerpt);

  // Record the outcome either way. A failed alert used to look exactly like an
  // alert that hadn't been attempted yet — and this is the one path where nobody
  // finding out is the worst thing that can happen. Now the console shows it.
  await updateRowsQuietly("se_safety_escalations", `case_id=eq.${escalated.id}&notified_at=is.null`, {
    notified_at: alert.sent ? new Date().toISOString() : null,
    notify_error: alert.sent ? null : alert.reason || "the alert did not send"
  });

  if (!alert.sent) {
    console.error(`[solution-engine] SAFETY ALERT NOT DELIVERED for case ${escalated.id}: ${alert.reason}`);
  }

  return escalated;
}

async function updateRowsQuietly(table: string, query: string, values: Record<string, unknown>) {
  try {
    await updateOne(table, query, values);
  } catch {
    // Bookkeeping only.
  }
}

// ---------------------------------------------------------------------------
// DIAGNOSE → OFFER
// ---------------------------------------------------------------------------

export async function confirmReflection(theCase: SolutionCase, confirmed: boolean, correction?: string): Promise<CaseView> {
  if (!confirmed) {
    // "Reflect before proposing" means the yes is load-bearing. A no goes back to
    // the conversation, not forward to an offer.
    const back = await transitionCase(theCase, "intake", { reason: "person said the reflection was off", actor: "person" });

    if (correction?.trim()) {
      return replyToCase(back, correction);
    }

    await appendMessage(back, "guide", "Then I've got it wrong — tell me what I'm missing.");
    return { theCase: back, messages: await listMessages(back.id) };
  }

  const decision = decideTriage(theCase.triage_signals || {});
  const problemClass = classifyProblem(theCase);

  const diagnosed = await transitionCase(theCase, "diagnosed", {
    reason: "person confirmed the reflection",
    actor: "person",
    meta: { triage: decision.triage, rationale: decision.rationale },
    patch: {
      reflection_confirmed_at: new Date().toISOString(),
      triage: decision.triage,
      triage_decided_at: new Date().toISOString(),
      problem_class: problemClass,
      solution_type: theCase.solution_type || "personal_tool"
    }
  });

  const offered = await makeOffer(diagnosed);
  await upsertKnowledgeRecord(offered);

  return { theCase: offered, messages: await listMessages(offered.id) };
}

export async function makeOffer(theCase: SolutionCase): Promise<SolutionCase> {
  const offer = buildOffer({
    solutionType: (theCase.solution_type || "personal_tool") as SolutionType,
    triage: (theCase.triage || "development") as Triage,
    statedProblem: theCase.stated_problem || ""
  });

  const readyBy = nextThursday();

  const offered = await transitionCase(theCase, "offered", {
    reason: "offer prepared",
    actor: "system",
    patch: {
      offer,
      offer_made_at: new Date().toISOString(),
      promised_for: toDateOnly(readyBy)
    }
  });

  // The first-attempt spine (see first-attempt.ts). Both of these happen BEFORE
  // the person accepts, on purpose: the walkthrough they're approving is the same
  // list the build has to pass, and the defaults we chose are on the screen where
  // correcting one is free. Every correction that happens here is a stop that
  // doesn't happen mid-build.
  await recordDefaults(offered);
  await seedAcceptanceChecks(offered);

  await appendMessage(offered, "guide", `Here's what we'd build for you — have a look and tell me if it's right.`, { offer: true });

  return offered;
}

export async function provideContact(
  theCase: SolutionCase,
  contact: { name?: string; email?: string; phone?: string; channel?: string; region?: string; postalCode?: string }
): Promise<SolutionCase> {
  const email = contact.email?.trim().toLowerCase() || null;

  let updated = await updateOne<SolutionCase>("se_cases", `id=eq.${theCase.id}`, {
    contact_name: contact.name?.trim() || theCase.contact_name,
    contact_email: email || theCase.contact_email,
    contact_phone: contact.phone?.trim() || theCase.contact_phone,
    contact_channel: contact.channel || theCase.contact_channel || "email",
    region: contact.region?.trim() || theCase.region,
    postal_code: contact.postalCode?.trim() || theCase.postal_code
  });

  // §4c hard rule: the app never becomes a repeat-relief dispenser. Now that we
  // know who this is, a second relief request becomes the development offer —
  // warmly, and every time. A tired human helper cannot hold this line. We can.
  if (email && (updated.triage === "relief" || updated.triage === "crisis_first")) {
    const prior = await selectRows<Pick<SolutionCase, "triage" | "closed_at">>(
      "se_cases",
      `contact_email=eq.${encodeURIComponent(email)}&id=neq.${updated.id}&select=triage,closed_at`
    );

    if (isRepeatReliefRequest(prior)) {
      updated = await updateOne<SolutionCase>("se_cases", `id=eq.${updated.id}`, {
        triage: "development",
        triage_signals: { ...(updated.triage_signals || {}), notes: [...(updated.triage_signals?.notes || []), "repeat relief request — routed to the participation track"] }
      });

      await insertRow("se_case_events", {
        case_id: updated.id,
        from_state: updated.state,
        to_state: updated.state,
        reason: "repeat relief request; re-routed to the development track",
        actor: "triage_rule"
      });

      if (updated.state === "offered") {
        updated = await updateOne<SolutionCase>("se_cases", `id=eq.${updated.id}`, {
          offer: buildOffer({
            solutionType: (updated.solution_type || "personal_tool") as SolutionType,
            triage: "development",
            statedProblem: updated.stated_problem || ""
          })
        });
      }
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// OFFER → COVENANT → BUILD
// ---------------------------------------------------------------------------

export async function acceptOffer(theCase: SolutionCase): Promise<CaseView> {
  const patch = { offer_accepted_at: new Date().toISOString() };

  if (requiresCovenant(theCase.triage)) {
    await createCovenant(theCase);
    const pending = await transitionCase(theCase, "covenant_pending", { reason: "offer accepted; covenant required", actor: "person", patch });
    return { theCase: pending, messages: await listMessages(pending.id) };
  }

  const accepted = await transitionCase(theCase, "accepted", { reason: "offer accepted (relief track, no strings)", actor: "person", patch });
  await notifyOfferReady(accepted);

  return { theCase: accepted, messages: await listMessages(accepted.id) };
}

export async function declineOffer(theCase: SolutionCase): Promise<CaseView> {
  const declined = await transitionCase(theCase, "declined", {
    reason: "offer declined",
    actor: "person",
    patch: { offer_declined_at: new Date().toISOString() }
  });

  return { theCase: declined, messages: await listMessages(declined.id) };
}

export async function signCovenant(theCase: SolutionCase): Promise<CaseView> {
  await agreeToCovenant(theCase);
  const accepted = await transitionCase(theCase, "accepted", { reason: "covenant signed", actor: "person" });
  await notifyOfferReady(accepted);

  return { theCase: accepted, messages: await listMessages(accepted.id) };
}

export async function refuseCovenant(theCase: SolutionCase): Promise<CaseView> {
  await declineCovenant(theCase);

  // The refusal is data, not failure (§6.5). Warm, logged, and the boundary holds.
  const declined = await transitionCase(theCase, "declined", { reason: "covenant declined", actor: "person" });
  await appendMessage(
    declined,
    "guide",
    "That's a fair call, and there's nothing owed here. If you ever want to take it on, this is exactly where you left it."
  );

  return { theCase: declined, messages: await listMessages(declined.id) };
}

// ---------------------------------------------------------------------------
// Operator actions
// ---------------------------------------------------------------------------

export async function startBuild(theCase: SolutionCase, buildRef?: string): Promise<SolutionCase> {
  return transitionCase(theCase, "building", {
    reason: "build started",
    actor: "operator",
    patch: { build_started_at: new Date().toISOString(), build_ref: buildRef || null }
  });
}

// Note the state this lands in: delivered_pending_connection. There is no path
// from here to closed that does not pass through the connection layer.
export async function deliver(theCase: SolutionCase, artifactUrl: string, walkthroughUrl: string): Promise<SolutionCase> {
  const delivered = await transitionCase(theCase, "delivered_pending_connection", {
    reason: "solution delivered; connection still owed",
    actor: "operator",
    patch: {
      artifact_url: artifactUrl,
      walkthrough_url: walkthroughUrl,
      delivered_at: new Date().toISOString()
    }
  });

  await upsertKnowledgeRecord(delivered);
  await notifyDelivered(delivered);

  return delivered;
}

export async function openConnection(theCase: SolutionCase): Promise<{ theCase: SolutionCase; intro: Intro | null; reason?: string }> {
  const proposal = await proposeIntro(theCase);

  if (!proposal) {
    return { theCase, intro: null, reason: "No one in the pool matches this person yet." };
  }

  const connecting =
    theCase.state === "connecting"
      ? theCase
      : await transitionCase(theCase, "connecting", { reason: `intro drafted (attempt ${proposal.intro.attempt_number})`, actor: "operator" });

  await notifyIntroDrafted(connecting, proposal.member.display_name);

  return { theCase: connecting, intro: proposal.intro };
}

// ---------------------------------------------------------------------------
// CONNECT
// ---------------------------------------------------------------------------

export async function respondToIntro(theCase: SolutionCase, side: "person" | "match", accept: boolean): Promise<CaseView> {
  const intro = await getOpenIntro(theCase.id);

  if (!intro) {
    return { theCase, messages: await listMessages(theCase.id) };
  }

  if (!accept) {
    await declineIntro(intro, side);
    const intros = await listIntros(theCase.id);
    const logged = intros.filter((entry) => entry.state === "declined" || entry.state === "expired").length;

    await recordConnectionOutcome(theCase, logged >= 3 ? "three_attempts_logged" : "declined");
    await appendMessage(
      theCase,
      "guide",
      logged >= 3
        ? "Understood. We've tried three times and we'll stop asking — but if you change your mind, say the word."
        : "No problem at all. We'll look for someone else."
    );

    return { theCase, messages: await listMessages(theCase.id) };
  }

  const confirmed = await confirmIntro(intro, side);

  if (confirmed.state !== "accepted") {
    return { theCase, messages: await listMessages(theCase.id) };
  }

  const connected = await transitionCase(theCase, "connected", { reason: "both sides accepted the intro", actor: "person" });
  await recordConnectionOutcome(connected, "accepted");
  await scheduleFollowUp(connected);
  const awaitingFollowUp = await transitionCase(connected, "follow_up", { reason: "two-week check-in scheduled", actor: "system" });

  return { theCase: awaitingFollowUp, messages: await listMessages(awaitingFollowUp.id) };
}

// ---------------------------------------------------------------------------
// FOLLOW-UP → CLOSE
// ---------------------------------------------------------------------------

export async function submitFollowUp(
  theCase: SolutionCase,
  answers: { stillWorking: boolean; stillMeeting: boolean; testimony?: string }
): Promise<CaseView> {
  const followUp = await getOpenFollowUp(theCase.id);

  if (followUp) {
    await answerFollowUp(followUp, answers);
  }

  const commitments = await listCommitments(theCase.id);

  await upsertKnowledgeRecord(theCase, {
    usage_at_two_weeks: answers.stillWorking,
    testimony: answers.testimony?.trim() || undefined,
    commitment_streak: summarizeStreak(commitments).longestStreak
  });

  if (!answers.stillWorking) {
    // Regenerate over configure (principle 1). A broken solution goes back through
    // a mini-intake; it does not become a settings screen.
    const back = await transitionCase(theCase, "connecting", { reason: "solution stopped working; regeneration needed", actor: "person" });
    await appendMessage(back, "guide", "Then we'll rebuild it rather than have you fight with it. Tell me what stopped working.");
    return { theCase: back, messages: await listMessages(back.id) };
  }

  const closed = await transitionCase(theCase, "closed", { reason: "follow-up complete", actor: "system" });
  await recordCommitmentStreak(closed, commitments);

  return { theCase: closed, messages: await listMessages(closed.id) };
}

export async function pauseCase(theCase: SolutionCase, reason: string): Promise<SolutionCase> {
  return transitionCase(theCase, "paused", { reason, actor: "system" });
}

// ---------------------------------------------------------------------------
// Read model for the public page
// ---------------------------------------------------------------------------

export type PublicCaseBundle = {
  theCase: SolutionCase;
  messages: CaseMessage[];
  covenant: Awaited<ReturnType<typeof getCovenant>>;
  commitments: Awaited<ReturnType<typeof listCommitments>>;
  intro: Intro | null;
  matchName: string | null;
  followUp: FollowUp | null;
  assumptions: Assumption[];
  acceptance: AcceptanceCheck[];
};

export async function loadPublicCase(token: string): Promise<PublicCaseBundle | null> {
  const theCase = await getCaseByToken(token);

  if (!theCase) {
    return null;
  }

  const [messages, covenant, commitments, intro, followUp, assumptions, acceptance] = await Promise.all([
    listMessages(theCase.id),
    getCovenant(theCase.id),
    listCommitments(theCase.id),
    getOpenIntro(theCase.id),
    getOpenFollowUp(theCase.id),
    listAssumptions(theCase.id),
    listAcceptanceChecks(theCase.id)
  ]);

  let matchName: string | null = null;

  if (intro?.match_id) {
    const member = await selectOne<{ display_name: string }>("se_connection_pool", `id=eq.${intro.match_id}&select=display_name`);
    matchName = member?.display_name || null;
  }

  return { theCase, messages, covenant, commitments, intro, matchName, followUp, assumptions, acceptance };
}

// The person can rewrite a line of the walkthrough or overturn a default while the
// offer is still on the table. This is the cheapest correction in the whole
// process — one tap, zero calendar — which is exactly why it belongs here and not
// in a mid-build email.
export async function reviseBeforeBuild(
  theCase: SolutionCase,
  revision: { assumptionId?: string; correctedTo?: string; checkStepIndex?: number; description?: string }
): Promise<void> {
  if (revision.assumptionId && revision.correctedTo) {
    const assumptions = await listAssumptions(theCase.id);
    const target = assumptions.find((assumption) => assumption.id === revision.assumptionId);

    if (target) {
      await correctAssumption(target, revision.correctedTo);
    }
  }

  if (revision.checkStepIndex && revision.description) {
    const checks = await listAcceptanceChecks(theCase.id);
    const target = checks.find((check) => check.step_index === revision.checkStepIndex);

    if (target) {
      await reviseAcceptanceCheck(target, revision.description);
    }
  }
}

// Delivery is gated on the acceptance list, not on anyone's judgement that it
// "looks done". The database carries the same rule (se_guard_delivery).
export async function acceptanceStatus(caseId: string) {
  return summarizeAcceptance(await listAcceptanceChecks(caseId));
}
