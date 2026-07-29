// The first-attempt spine.
//
// The burden this solves is not "how fast can a build run" — it's how many times
// a build STOPS. A project that needs thirty clarifications doesn't cost thirty
// answers, it costs thirty round-trips of calendar time, and that is the whole
// difference between a thing that ships Thursday and a thing that is still not
// finished a year later.
//
// Three moves, and none of them is "ask better questions up front":
//
//   1. NEVER STOP. Every unknown becomes a recorded assumption with a default,
//      not a question. The person corrects it after they can see the thing —
//      judging something real takes seconds, answering an abstract question takes
//      days, and on disposable code a wrong default costs a regeneration, not a
//      rewrite. Stops are the expensive thing; being wrong is cheap.
//
//   2. MAKE "DONE" MACHINE-CHECKABLE BEFORE THE BUILD STARTS. At the offer we
//      write the walkthrough of one person using the finished thing. That list is
//      simultaneously the spec they approve, the acceptance test the build must
//      pass, and the walkthrough script we deliver. One artifact, three jobs, no
//      drift between them.
//
//   3. KEEP THE UNIT SMALL ENOUGH TO FINISH. One problem per solution. A thing
//      with 400 tables can't be finished on the first attempt by anyone; a thing
//      one person uses to do one thing can.
//
// The module catalog answers "what code do we write". This answers "how do we
// stop needing to ask" — a different axis, and the one that costs the year.

import { insertRow, insertRows, selectRows, updateOne } from "./db";
import type { SolutionCase, SolutionType } from "./types";

export type Assumption = {
  id: string;
  case_id: string;
  question: string;
  assumed: string;
  rationale: string | null;
  confidence: "low" | "medium" | "high";
  status: "assumed" | "confirmed" | "corrected";
  corrected_to: string | null;
  responded_at: string | null;
  created_at: string;
};

export type AcceptanceCheck = {
  id: string;
  case_id: string;
  step_index: number;
  description: string;
  status: "pending" | "passing" | "failing";
  evidence: string | null;
  checked_at: string | null;
  created_at: string;
};

// The six questions the parked appengine-intake-SEED.md said the engine must ask
// before building. We do not ask them. We answer them — with the most likely
// answer for this kind of solution — and show our work.
type DefaultAnswer = { question: string; assumed: string; rationale: string; confidence: "low" | "medium" | "high" };

function defaultsFor(solutionType: SolutionType, theCase: SolutionCase): DefaultAnswer[] {
  const audience = theCase.contact_name ? `${theCase.contact_name} and the people they serve` : "you and the people you serve";

  const shared: DefaultAnswer[] = [
    {
      question: "Do people log in, and does it remember them between visits?",
      assumed:
        solutionType === "business_starter"
          ? "Your customers don't log in at all — they just use it. You get an email every time someone does."
          : "No logins. The link is yours; anyone with it can use it, and it remembers what you put in.",
      rationale: "Accounts are the single biggest source of setup friction, and almost nothing at this size needs them.",
      confidence: "high"
    },
    {
      question: "Where should it live — your own web address, or the link we give you?",
      assumed: "The link we give you. It works immediately and costs nothing.",
      rationale: "A domain is real money and a real wait; if you want one later we can point it at the same thing.",
      confidence: "high"
    },
    {
      question: "Is there anything it must NOT do?",
      assumed: "It won't email anyone but you, and it won't collect anything from people beyond what's needed to do the job.",
      rationale: "The safe default. Anything louder than this should be a decision you make on purpose.",
      confidence: "medium"
    },
    {
      question: "Who is it for?",
      assumed: `Built for ${audience} — not for a general audience.`,
      rationale: "A tool for one situation beats a tool for everyone, and it's the only kind that can be finished this week.",
      confidence: "high"
    }
  ];

  if (solutionType === "business_starter") {
    shared.push({
      question: "How does money actually move?",
      assumed: "A payment link that works on a phone. The money goes to you directly — we never touch it.",
      rationale: "Anything else needs accounts, verification, and a week you don't have.",
      confidence: "medium"
    });
  }

  return shared;
}

export async function recordDefaults(theCase: SolutionCase): Promise<Assumption[]> {
  const existing = await listAssumptions(theCase.id);

  if (existing.length > 0) {
    return existing;
  }

  const solutionType = (theCase.solution_type || "personal_tool") as SolutionType;

  return insertRows<Assumption>(
    "se_assumptions",
    defaultsFor(solutionType, theCase).map((entry) => ({
      case_id: theCase.id,
      question: entry.question,
      assumed: entry.assumed,
      rationale: entry.rationale,
      confidence: entry.confidence
    }))
  );
}

export async function listAssumptions(caseId: string): Promise<Assumption[]> {
  return selectRows<Assumption>("se_assumptions", `case_id=eq.${caseId}&select=*&order=created_at.asc`);
}

// One unknown discovered mid-build does not become a question. It becomes this.
export async function assume(
  caseId: string,
  input: { question: string; assumed: string; rationale?: string; confidence?: "low" | "medium" | "high" }
): Promise<Assumption> {
  return insertRow<Assumption>("se_assumptions", {
    case_id: caseId,
    question: input.question,
    assumed: input.assumed,
    rationale: input.rationale || null,
    confidence: input.confidence || "medium"
  });
}

export async function correctAssumption(assumption: Assumption, correctedTo: string): Promise<Assumption> {
  return updateOne<Assumption>("se_assumptions", `id=eq.${assumption.id}`, {
    status: "corrected",
    corrected_to: correctedTo,
    responded_at: new Date().toISOString()
  });
}

export async function confirmAssumption(assumption: Assumption): Promise<Assumption> {
  return updateOne<Assumption>("se_assumptions", `id=eq.${assumption.id}`, {
    status: "confirmed",
    responded_at: new Date().toISOString()
  });
}

// ---------------------------------------------------------------------------
// The acceptance walkthrough — spec, test, and manual in one list
// ---------------------------------------------------------------------------

const walkthroughs: Record<SolutionType, string[]> = {
  // Every line is written so the PERSON can prove it themselves, in one sitting,
  // without us. A check only someone else can perform isn't a check.
  business_starter: [
    "I open my link on my phone and see my name, what I do, and what it costs.",
    "I can walk through my own link the way a customer would and place an order without asking anyone anything.",
    "When I do that, I get an email with the name, what they wanted, and how to reach them.",
    "I can pay for that test order from my phone, without creating an account.",
    "I can send the link in a text message and it looks right when it opens."
  ],
  personal_tool: [
    "I open my link on my phone and immediately see the thing I'm tracking — no setup screen.",
    "I can add something new in under ten seconds, with my thumb, one-handed.",
    "What I added is still there tomorrow, and on a different device.",
    "I can see at a glance what still needs doing, without reading everything.",
    "I can get rid of something I added by mistake without hunting for how."
  ],
  job_search_kit: [
    "I open my link and see my resume, rewritten, ready to send.",
    "I can log an application in under thirty seconds — company, role, date.",
    "I can see who owes me an answer and who I need to follow up with this week.",
    "I can see this week's plan, and it's short enough that I could finish it on a bad day.",
    "I can download the resume as a file and attach it to an application."
  ],
  action_plan: [
    "I open my link and see step one, on its own, without the other steps shouting at me.",
    "Each step tells me who to contact and what to say.",
    "I can mark a step done and the next one comes up.",
    "It fits on one page if I print it.",
    "Nothing on it assumes I already know how any of this works."
  ]
};

export function draftAcceptanceWalkthrough(theCase: SolutionCase): string[] {
  return walkthroughs[(theCase.solution_type || "personal_tool") as SolutionType] || walkthroughs.personal_tool;
}

export async function seedAcceptanceChecks(theCase: SolutionCase): Promise<AcceptanceCheck[]> {
  const existing = await listAcceptanceChecks(theCase.id);

  if (existing.length > 0) {
    return existing;
  }

  return insertRows<AcceptanceCheck>(
    "se_acceptance_checks",
    draftAcceptanceWalkthrough(theCase).map((description, index) => ({
      case_id: theCase.id,
      step_index: index + 1,
      description
    }))
  );
}

export async function listAcceptanceChecks(caseId: string): Promise<AcceptanceCheck[]> {
  return selectRows<AcceptanceCheck>("se_acceptance_checks", `case_id=eq.${caseId}&select=*&order=step_index.asc`);
}

export async function markAcceptanceCheck(
  check: AcceptanceCheck,
  status: "passing" | "failing" | "pending",
  evidence?: string
): Promise<AcceptanceCheck> {
  return updateOne<AcceptanceCheck>("se_acceptance_checks", `id=eq.${check.id}`, {
    status,
    evidence: evidence || null,
    checked_at: status === "pending" ? null : new Date().toISOString()
  });
}

export type AcceptanceSummary = {
  total: number;
  passing: number;
  failing: number;
  pending: number;
  deliverable: boolean;
};

export function summarizeAcceptance(checks: AcceptanceCheck[]): AcceptanceSummary {
  const passing = checks.filter((check) => check.status === "passing").length;
  const failing = checks.filter((check) => check.status === "failing").length;

  return {
    total: checks.length,
    passing,
    failing,
    pending: checks.length - passing - failing,
    // This is the whole definition of done. Not "looks finished" — this.
    deliverable: checks.length > 0 && passing === checks.length
  };
}

// A person correcting a line here BEFORE the build is the cheapest correction
// available anywhere in the process — it costs one tap and zero calendar.
export async function reviseAcceptanceCheck(check: AcceptanceCheck, description: string): Promise<AcceptanceCheck> {
  return updateOne<AcceptanceCheck>("se_acceptance_checks", `id=eq.${check.id}`, {
    description,
    status: "pending",
    evidence: null,
    checked_at: null
  });
}
