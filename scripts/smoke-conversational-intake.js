import {
  buildIntakeSubmission,
  conversationSteps,
  isAnswerComplete,
  reflectBack
} from "../src/lib/engine/conversational-intake.ts";

// Proves the guided conversation collects exactly what the EXISTING intake APIs
// require, so a completed conversation never 400s, and that both frames map to
// the right endpoint. Run: node scripts/smoke-conversational-intake.js

// The required fields each existing API validates (see problem-intake-lite.ts /
// opportunity-intake.ts normalize()). The mapping MUST populate all of these.
const REQUIRED = {
  "/api/problem-intake-lite": ["problemSummary", "affectedPeople", "desiredChange", "urgency", "currentBarriers"],
  "/api/opportunity-intake": ["problemPain", "affectedPeople", "betterOutcome", "currentBarriers", "desiredImpact"]
};

const sampleAnswers = {
  problem: "People ask for help but the next step gets lost", // >= 12 chars
  affected: "Staff and the people waiting on follow-up",
  outcome: "Nobody falls through the cracks",
  barriers: "No single place to track it",
  fifth: "Would help soon",
  idea: "A simple shared follow-up list"
};

runStep("conversation asks the shared slots in order", () => {
  const slots = conversationSteps.map((s) => s.slot);
  assertEqual(slots.join(","), "problem,affected,outcome,barriers,fifth,idea", "slot order");
  for (const s of conversationSteps) {
    assert(Boolean(s.prompt.problem) && Boolean(s.prompt.build), `${s.slot} has both frame prompts`);
  }
  const idea = conversationSteps.find((s) => s.slot === "idea");
  assert(idea.optional === true, "idea step is optional");
});

runStep("problem frame maps to problem-intake-lite with every required field filled", () => {
  const sub = buildIntakeSubmission("problem", sampleAnswers);
  assertEqual(sub.endpoint, "/api/problem-intake-lite", "endpoint");
  assertEqual(sub.formHref, "/problem-intake-lite", "form fallback href");
  for (const field of REQUIRED[sub.endpoint]) {
    assert((sub.payload[field] || "").length >= 3, `required ${field} present`);
  }
  assert(sub.payload.problemSummary.length >= 12, "problemSummary >= 12");
  assertEqual(sub.payload.mode, "problem_first", "mode");
});

runStep("build frame maps to opportunity-intake with every required field filled", () => {
  const sub = buildIntakeSubmission("build", sampleAnswers);
  assertEqual(sub.endpoint, "/api/opportunity-intake", "endpoint");
  assertEqual(sub.formHref, "/opportunity-intake", "form fallback href");
  for (const field of REQUIRED[sub.endpoint]) {
    assert((sub.payload[field] || "").length >= 3, `required ${field} present`);
  }
  assert(sub.payload.problemPain.length >= 12, "problemPain >= 12");
  assertEqual(sub.payload.mode, "vision_first", "mode");
});

runStep("answer completion enforces minimums and honors optional", () => {
  const problemStep = conversationSteps.find((s) => s.slot === "problem");
  assert(!isAnswerComplete(problemStep, "too short"), "problem under 12 rejected");
  assert(isAnswerComplete(problemStep, "this is a long enough problem"), "problem >= 12 accepted");
  const ideaStep = conversationSteps.find((s) => s.slot === "idea");
  assert(isAnswerComplete(ideaStep, ""), "optional idea accepts empty");
});

runStep("reflect-back is plain-language and non-empty for both frames", () => {
  assert(reflectBack("problem", sampleAnswers).length > 20, "problem reflect-back");
  assert(reflectBack("build", sampleAnswers).length > 20, "build reflect-back");
});

console.log("conversational-intake smoke ok");

function assert(cond, label) {
  if (!cond) throw new Error(`assertion failed: ${label}`);
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
