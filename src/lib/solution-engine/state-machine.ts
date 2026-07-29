// The case state machine.
//
// Principle 5 of the owner definition: "Connection is in the delivery path, not
// bolted on. The solution is not marked delivered until the human handoff happens.
// This is enforced in the workflow state machine, not left to goodwill."
//
// So: `closed` has exactly one road into it, and that road runs through the
// connection layer. The database carries the same guard as a trigger
// (se_guard_closure) — this is the layer that produces a kind error message, and
// that one is the layer that makes the rule true even if someone writes SQL by hand.

import { insertRow, selectOne, selectRows, updateOne } from "./db";
import type { CaseState, Intro, SolutionCase } from "./types";

const transitions: Record<CaseState, CaseState[]> = {
  intake: ["intake", "reflected", "escalated", "paused"],
  reflected: ["intake", "diagnosed", "escalated", "paused"],
  diagnosed: ["offered", "escalated", "paused"],
  offered: ["accepted", "covenant_pending", "declined", "escalated", "paused"],
  covenant_pending: ["accepted", "declined", "escalated", "paused"],
  accepted: ["building", "escalated", "paused"],
  building: ["delivered_pending_connection", "escalated", "paused"],
  // Note what is absent here: `closed`. A working solution is not a finished case.
  delivered_pending_connection: ["connecting", "escalated", "paused"],
  connecting: ["connecting", "connected", "closed", "escalated", "paused"],
  connected: ["follow_up", "closed", "escalated", "paused"],
  follow_up: ["closed", "connecting", "escalated", "paused"],
  closed: ["intake"],
  // The door is explicitly left open (§6.4) — a paused case can pick up anywhere.
  paused: ["intake", "diagnosed", "offered", "covenant_pending", "accepted", "building", "connecting", "escalated"],
  declined: ["intake", "offered", "escalated"],
  // A safety case belongs to a human now. It does not re-enter the solution flow.
  escalated: ["escalated"]
};

export class CaseTransitionError extends Error {
  readonly from: CaseState;
  readonly to: CaseState;

  constructor(message: string, from: CaseState, to: CaseState) {
    super(message);
    this.name = "CaseTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from: CaseState, to: CaseState): boolean {
  return (transitions[from] || []).includes(to);
}

export function allowedTransitions(from: CaseState): CaseState[] {
  return [...(transitions[from] || [])];
}

// The connection rule, stated once so nothing can drift from it: a case may be
// closed when an intro was accepted, or when three separate attempts are on the
// record. Safety cases are exempt — they left the solution flow entirely.
export function closureSatisfied(theCase: Pick<SolutionCase, "intro_attempts" | "state">, intros: Pick<Intro, "state">[]): boolean {
  if (theCase.state === "escalated") {
    return true;
  }

  if (intros.some((intro) => intro.state === "accepted")) {
    return true;
  }

  const loggedAttempts = intros.filter((intro) => intro.state === "declined" || intro.state === "expired").length;
  return Math.max(theCase.intro_attempts, loggedAttempts) >= 3;
}

export type TransitionOptions = {
  reason?: string;
  actor?: string;
  patch?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export async function transitionCase(
  theCase: SolutionCase,
  to: CaseState,
  options: TransitionOptions = {}
): Promise<SolutionCase> {
  const from = theCase.state;

  if (!canTransition(from, to)) {
    throw new CaseTransitionError(`A case in "${from}" cannot move to "${to}".`, from, to);
  }

  const patch: Record<string, unknown> = { state: to, ...(options.patch || {}) };

  if (to === "closed") {
    const intros = await selectRows<Intro>("se_intros", `case_id=eq.${theCase.id}&select=state`);

    if (!closureSatisfied(theCase, intros)) {
      throw new CaseTransitionError(
        "This case cannot be closed yet: the person has not been introduced to anyone, and fewer than three attempts are on the record.",
        from,
        to
      );
    }

    patch.closed_at = new Date().toISOString();
  }

  if (to === "paused") {
    patch.paused_at = new Date().toISOString();
  }

  const updated = await updateOne<SolutionCase>("se_cases", `id=eq.${theCase.id}`, patch);

  await insertRow("se_case_events", {
    case_id: theCase.id,
    from_state: from,
    to_state: to,
    reason: options.reason || null,
    actor: options.actor || "system",
    meta: options.meta || {}
  });

  return updated;
}

export async function getCaseByToken(token: string): Promise<SolutionCase | null> {
  if (!token || !/^[a-z0-9-]{8,64}$/i.test(token)) {
    return null;
  }

  return selectOne<SolutionCase>("se_cases", `token=eq.${encodeURIComponent(token)}&select=*`);
}

export async function getCaseById(id: string): Promise<SolutionCase | null> {
  if (!isUuid(id)) {
    return null;
  }

  return selectOne<SolutionCase>("se_cases", `id=eq.${id}&select=*`);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// What the person is told they're waiting on. Deliberately plain, and deliberately
// free of the machinery behind it (principle 4: the machine stays behind the counter).
export function describeStateForPerson(state: CaseState): string {
  switch (state) {
    case "intake":
    case "reflected":
      return "We're still talking.";
    case "diagnosed":
      return "We've got it. Putting together what we'd build for you.";
    case "offered":
      return "There's a proposal waiting for you.";
    case "covenant_pending":
      return "One thing to agree to, then we start.";
    case "accepted":
      return "You're in the queue. We'll start shortly.";
    case "building":
      return "We're building it.";
    case "delivered_pending_connection":
      return "Your solution is ready — and there's one more thing.";
    case "connecting":
      return "We found someone you should meet.";
    case "connected":
      return "You're connected. We'll check back in two weeks.";
    case "follow_up":
      return "Quick check-in waiting for you.";
    case "closed":
      return "All done — and the door stays open.";
    case "paused":
      return "This is here whenever you're ready.";
    case "declined":
      return "Nothing owed. Come back any time.";
    case "escalated":
      return "Please reach out to the people below.";
    default:
      return "";
  }
}
