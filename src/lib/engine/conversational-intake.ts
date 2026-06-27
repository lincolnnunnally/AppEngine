// Conversational intake — the shared, guided discovery that replaces the wall of
// form boxes. Both entry intents ("a problem I'm facing" / "something I want to
// build") are the SAME question set in a different frame, so this defines one
// ordered conversation and maps the collected answers onto the EXISTING intake
// APIs (problem-intake-lite / opportunity-intake) — no backend/pipeline change.
//
// Deterministic and free today (the component drives these steps directly). The
// step list is data, so a future Claude clarification worker (worker-adapters)
// can adapt/augment the questions without changing this contract.

export type IntakeFrame = "problem" | "build";

export type IntakeSlot = "problem" | "affected" | "outcome" | "barriers" | "fifth" | "idea";

export type ConversationStep = {
  slot: IntakeSlot;
  kind: "textarea" | "chips";
  optional?: boolean;
  minLength?: number;
  // Frame-aware copy. `fifth` differs by frame on purpose: urgency (problem) vs
  // desired impact (build) — the one field the two original forms didn't share.
  prompt: Record<IntakeFrame, string>;
  placeholder?: Record<IntakeFrame, string>;
  chips?: Partial<Record<IntakeFrame, string[]>>;
};

// The opening turn (frame choice) is rendered specially by the component; these
// are the questions that follow, asked one at a time.
export const conversationSteps: ConversationStep[] = [
  {
    slot: "problem",
    kind: "textarea",
    minLength: 12,
    prompt: {
      problem: "What's the problem you want an app or tool to solve?",
      build: "What do you want to build? Describe the app or tool."
    },
    placeholder: {
      problem: "Example: People ask for help, but the next step gets unclear or forgotten — so we lose them.",
      build: "Example: A simple way for visitors to sign up and actually get followed up with."
    }
  },
  {
    slot: "affected",
    kind: "textarea",
    minLength: 3,
    prompt: {
      problem: "Who would use the app?",
      build: "Who's it for?"
    },
    placeholder: {
      problem: "Staff, volunteers, members, customers, families...",
      build: "Leaders, teams, members, customers, families..."
    }
  },
  {
    slot: "outcome",
    kind: "textarea",
    minLength: 3,
    prompt: {
      problem: "When the app works, what should it let them do?",
      build: "What should the app let them do?"
    },
    placeholder: {
      problem: "See every open request, assign it, mark it done...",
      build: "What does a good day look like once this is working?"
    }
  },
  {
    slot: "barriers",
    kind: "textarea",
    minLength: 3,
    prompt: {
      problem: "How is this handled today, and what makes it hard?",
      build: "What's made it hard to build so far?"
    },
    placeholder: {
      problem: "Spread across texts, email, and memory — nothing in one place...",
      build: "Time, tools, know-how, budget, where to start..."
    }
  },
  {
    slot: "fifth",
    kind: "chips",
    prompt: {
      problem: "How soon do you need it?",
      build: "What's the bigger impact you're going for?"
    },
    placeholder: {
      problem: "",
      build: "Who does it help, and how much would it change for them?"
    },
    // Problem frame uses quick chips for urgency; build frame answers in text
    // (the component switches to a textarea when no chips exist for the frame).
    chips: {
      problem: ["Just exploring", "Would help soon", "Pretty urgent"]
    }
  },
  {
    slot: "idea",
    kind: "textarea",
    optional: true,
    minLength: 3,
    prompt: {
      problem: "Any thoughts on how the app should work? Totally fine if not — we'll figure it out.",
      build: "Anything specific in mind for how it should work? Optional."
    },
    placeholder: {
      problem: "A screen, a flow, a feature — or leave this blank.",
      build: "A feature, a flow, a look — or leave this blank."
    }
  }
];

export type ConversationAnswers = Partial<Record<IntakeSlot, string>>;

export type IntakeSubmission = {
  endpoint: string;
  formHref: string;
  payload: Record<string, string>;
};

// Map the collected answers onto the existing intake API payloads. Frame decides
// which endpoint + field names — both satisfy that endpoint's required fields.
export function buildIntakeSubmission(frame: IntakeFrame, answers: ConversationAnswers): IntakeSubmission {
  const problem = (answers.problem || "").trim();
  const affected = (answers.affected || "").trim();
  const outcome = (answers.outcome || "").trim();
  const barriers = (answers.barriers || "").trim();
  const fifth = (answers.fifth || "").trim();
  const idea = (answers.idea || "").trim();

  if (frame === "problem") {
    return {
      endpoint: "/api/problem-intake-lite",
      formHref: "/problem-intake-lite",
      payload: {
        mode: "problem_first",
        problemSummary: problem,
        affectedPeople: affected,
        desiredChange: outcome,
        currentBarriers: barriers,
        urgency: fifth,
        possibleSolutionIdeas: idea
      }
    };
  }

  return {
    endpoint: "/api/opportunity-intake",
    formHref: "/opportunity-intake",
    payload: {
      mode: "vision_first",
      problemPain: problem,
      affectedPeople: affected,
      betterOutcome: outcome,
      currentBarriers: barriers,
      desiredImpact: fifth,
      existingIdeaVision: idea
    }
  };
}

// Plain-language reflect-back shown before submit — "here's what I heard."
// Each fragment is the user's own words, tidied of trailing punctuation so the
// pieces read as clean sentences instead of running together.
export function reflectBack(frame: IntakeFrame, answers: ConversationAnswers): string {
  const tidy = (value: string | undefined, fallback: string) => {
    const trimmed = (value || "").trim().replace(/[.!?]+$/, "");
    return trimmed || fallback;
  };
  const who = tidy(answers.affected, "the people involved");
  const outcome = tidy(answers.outcome, "things get better");
  const problem = tidy(answers.problem, "");

  if (frame === "problem") {
    return `We'll build an app for ${who} that solves: ${problem}. So they can ${outcome}.`;
  }
  return `We'll build ${problem} for ${who}. So they can ${outcome}.`;
}

// Whether a given step should be shown for a frame (currently all steps apply to
// both frames; kept as a hook for future frame-specific branching).
export function stepAppliesToFrame(_step: ConversationStep, _frame: IntakeFrame): boolean {
  return true;
}

// Does an answer satisfy a step's minimum (used to gate "next")?
export function isAnswerComplete(step: ConversationStep, value: string | undefined): boolean {
  const trimmed = (value || "").trim();
  if (step.optional && trimmed.length === 0) return true;
  return trimmed.length >= (step.minLength ?? 1);
}
