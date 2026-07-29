// Solution Engine — behavioural smoke test.
//
// This one does not check that files contain strings. It imports the real modules
// and asserts the rules the owner definition calls non-negotiable actually hold:
// the safety screen fires, triage routes, a case cannot close without a
// connection, delivery cannot happen with unproven acceptance lines, and no
// machine vocabulary reaches a person.
//
// Runs offline — nothing here touches the network or the database.

import { screenForSafety, getCrisisResources, getEscalationMessage } from "../src/lib/solution-engine/safety.ts";
import { decideTriage, requiresCovenant, isRepeatReliefRequest } from "../src/lib/solution-engine/triage.ts";
import { canTransition, closureSatisfied, describeStateForPerson } from "../src/lib/solution-engine/state-machine.ts";
import { summarizeStreak, encouragementFor, draftCovenant } from "../src/lib/solution-engine/covenant.ts";
import { rankMatches, classifyProblem, draftIntro, findGroupCandidates } from "../src/lib/solution-engine/connection.ts";
import { summarizeAcceptance, draftAcceptanceWalkthrough } from "../src/lib/solution-engine/first-attempt.ts";
import { buildOffer } from "../src/lib/solution-engine/offer.ts";
import { scrubMachineLanguage, containsMachineLanguage } from "../src/lib/solution-engine/voice.ts";

let failures = 0;
let checks = 0;

function step(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  checks += 1;

  if (!condition) {
    throw new Error(message);
  }
}

console.log("Solution Engine smoke\n");

// -- §4d safety ------------------------------------------------------------

step("safety screen catches crisis language", () => {
  assert(screenForSafety("honestly I just want to die")?.category === "self_harm", "self-harm not caught");
  assert(screenForSafety("I've been thinking about killing myself")?.category === "self_harm", "explicit self-harm not caught");
  assert(screenForSafety("my husband hits me and I'm scared")?.category === "abuse", "abuse not caught");
  assert(screenForSafety("I'm having chest pain right now")?.category === "medical_crisis", "medical crisis not caught");
});

step("safety screen does not trip on idioms", () => {
  assert(screenForSafety("this commute is killing me") === null, "idiom 'killing me' tripped the screen");
  assert(screenForSafety("I'm dying to get back to work") === null, "idiom 'dying to' tripped the screen");
  assert(screenForSafety("I need more customers for my cleaning business") === null, "ordinary text tripped the screen");
  assert(screenForSafety("I have three deadlines this week") === null, "'deadline' tripped the screen");
});

step("every escalation gives real numbers and never diagnoses", () => {
  for (const category of ["self_harm", "abuse", "medical_crisis"]) {
    const resources = getCrisisResources(category);
    assert(resources.length > 0, `${category} produced no resources`);
    assert(
      resources.some((resource) => /988|911|741741|1-800/.test(resource.contact)),
      `${category} resources have no reachable number`
    );
    assert(!containsMachineLanguage(getEscalationMessage(category)), `${category} message leaked machine language`);
  }
});

// -- §4c triage ------------------------------------------------------------

step("sudden bounded first-time need routes to relief", () => {
  const decision = decideTriage({ duration: "new", suddenEvent: true, firstTimeAsker: true, boundedNeed: true });
  assert(decision.triage === "relief", `expected relief, got ${decision.triage}`);
  assert(requiresCovenant(decision.triage) === false, "relief must not require a covenant");
});

step("years-long repeat asking routes to development", () => {
  const decision = decideTriage({ duration: "years", soughtHelpBefore: true, needDescribedAsMoney: true });
  assert(decision.triage === "development", `expected development, got ${decision.triage}`);
  assert(requiresCovenant(decision.triage) === true, "development must require a covenant");
});

step("mixed signals route to crisis-first", () => {
  const decision = decideTriage({ duration: "new", suddenEvent: true, soughtHelpBefore: true, needDescribedAsMoney: true });
  assert(decision.triage === "crisis_first", `expected crisis_first, got ${decision.triage}`);
  assert(requiresCovenant(decision.triage) === false, "crisis-first must not gate the acute help behind a covenant");
});

step("a second relief request is treated as repeat relief", () => {
  assert(isRepeatReliefRequest([{ triage: "relief", closed_at: null }]) === true, "prior relief not detected");
  assert(isRepeatReliefRequest([{ triage: "development", closed_at: null }]) === false, "development wrongly flagged");
  assert(isRepeatReliefRequest([]) === false, "first-timer wrongly flagged");
});

// -- §7 the connection rule ------------------------------------------------

step("a delivered solution cannot go straight to closed", () => {
  assert(canTransition("delivered_pending_connection", "closed") === false, "delivery leaked straight into closure");
  assert(canTransition("delivered_pending_connection", "connecting") === true, "delivery cannot reach the connection step");
  assert(canTransition("building", "delivered_pending_connection") === true, "build cannot reach delivery");
});

step("closure needs an accepted intro or three logged attempts", () => {
  const base = { state: "connecting", intro_attempts: 0 };
  assert(closureSatisfied(base, []) === false, "closed with no intro at all");
  assert(closureSatisfied({ ...base, intro_attempts: 2 }, []) === false, "closed on two attempts");
  assert(closureSatisfied({ ...base, intro_attempts: 3 }, []) === true, "three attempts should permit closure");
  assert(closureSatisfied(base, [{ state: "accepted" }]) === true, "an accepted intro should permit closure");
  assert(
    closureSatisfied(base, [{ state: "declined" }, { state: "declined" }, { state: "expired" }]) === true,
    "three logged declines should permit closure"
  );
  assert(closureSatisfied({ state: "escalated", intro_attempts: 0 }, []) === true, "a safety case must be exempt");
});

step("matching prefers one-step-ahead and respects capacity", () => {
  const pool = [
    { id: "a", display_name: "Same stage", active: true, capacity: 3, stage: "same_stage", problem_classes: ["job_loss"], region: "Conyers" },
    { id: "b", display_name: "One ahead", active: true, capacity: 3, stage: "one_step_ahead", problem_classes: ["job_loss"], region: "Conyers" },
    { id: "c", display_name: "Full up", active: true, capacity: 1, stage: "one_step_ahead", problem_classes: ["job_loss"], region: "Conyers" }
  ];

  const ranked = rankMatches({ region: "Conyers", problem_class: "job_loss" }, pool, { c: 1 });
  assert(ranked[0].member.id === "b", `expected the one-step-ahead match first, got ${ranked[0]?.member.id}`);
  assert(!ranked.some((candidate) => candidate.member.id === "c"), "an at-capacity volunteer was offered");
});

step("the intro draft never leaks contact details", () => {
  const draft = draftIntro(
    { contact_name: "Dana", stated_problem: "I lost my job in March", contact_email: "dana@example.com", contact_phone: "555-1234" },
    { display_name: "Ray", story: "was laid off two years ago and rebuilt", contact_email: "ray@example.com", contact_phone: "555-9999" }
  );

  assert(!draft.includes("dana@example.com"), "the person's email leaked into the draft");
  assert(!draft.includes("ray@example.com"), "the volunteer's email leaked into the draft");
  assert(!draft.includes("555"), "a phone number leaked into the draft");
  assert(draft.includes("Ray"), "the volunteer is not named in the intro");
});

step("four people in one place and one problem propose a meetup", () => {
  const cases = Array.from({ length: 4 }, (_, index) => ({ id: `case-${index}`, region: "Conyers", problem_class: "job_loss" }));
  assert(findGroupCandidates(cases).length === 1, "four matching cases did not propose a group");
  assert(findGroupCandidates(cases.slice(0, 3)).length === 0, "three cases wrongly proposed a group");
});

// -- §6 participation ------------------------------------------------------

step("streaks count kept commitments and stall at two misses", () => {
  const kept = summarizeStreak([
    { period_index: 1, status: "kept", covenant_id: "x" },
    { period_index: 2, status: "shrunk", covenant_id: "x" },
    { period_index: 3, status: "kept", covenant_id: "x" }
  ]);

  assert(kept.currentStreak === 3, `expected a 3-week streak, got ${kept.currentStreak}`);
  assert(kept.stalled === false, "a kept streak reported as stalled");

  const stalled = summarizeStreak([
    { period_index: 1, status: "kept", covenant_id: "x" },
    { period_index: 2, status: "missed", covenant_id: "x" },
    { period_index: 3, status: "missed", covenant_id: "x" }
  ]);

  assert(stalled.stalled === true, "two consecutive misses did not trip the stall protocol");
  assert(stalled.currentStreak === 0, "streak survived a miss");
});

step("nothing said back to the person shames them", () => {
  const messages = [
    encouragementFor(summarizeStreak([])),
    encouragementFor(summarizeStreak([{ period_index: 1, status: "missed", covenant_id: "x" }])),
    encouragementFor(summarizeStreak([{ period_index: 1, status: "kept", covenant_id: "x" }]))
  ];

  for (const message of messages) {
    assert(!/fail|lazy|excuse|should have|disappoint/i.test(message), `shame language in: ${message}`);
  }
});

step("the first step is small and the covenant is concrete", () => {
  const covenant = draftCovenant({ solution_type: "business_starter" });
  assert(covenant.we_bring.length >= 3, "we bring too little");
  assert(/\b(minutes|tonight|hour)\b/i.test(covenant.first_step), "the first step is not time-bounded");
  assert(covenant.they_bring.length > 0, "nothing is asked of them");
});

// -- the first-attempt spine ----------------------------------------------

step("delivery is blocked until every acceptance line is proven", () => {
  const checks = draftAcceptanceWalkthrough({ solution_type: "personal_tool" }).map((description, index) => ({
    step_index: index + 1,
    description,
    status: index === 0 ? "passing" : "pending"
  }));

  assert(checks.length >= 4, "the walkthrough is too thin to be a definition of done");
  assert(summarizeAcceptance(checks).deliverable === false, "delivery allowed with unproven lines");

  const allPassing = checks.map((check) => ({ ...check, status: "passing" }));
  assert(summarizeAcceptance(allPassing).deliverable === true, "delivery blocked when everything is proven");
  assert(summarizeAcceptance([]).deliverable === false, "an empty checklist must not count as done");
});

step("every acceptance line describes something the person can DO", () => {
  for (const solutionType of ["business_starter", "personal_tool", "job_search_kit", "action_plan"]) {
    for (const line of draftAcceptanceWalkthrough({ solution_type: solutionType })) {
      // Written from the person's point of view and observable by them — that's
      // what makes a line testable rather than a wish.
      assert(/\b(I|me|my)\b/.test(line), `not written from the person's point of view: ${line}`);
      // A line is only a test if it can come out false. Subjective words make it
      // unfalsifiable, which is how "done" quietly becomes an opinion again.
      assert(
        !/\b(easy|simple|intuitive|nice|better|good|fast|clean|modern|user-friendly|seamless)\b/i.test(line),
        `not falsifiable — subjective wording: ${line}`
      );
      assert(!containsMachineLanguage(line), `machine language in an acceptance line: ${line}`);
    }
  }
});

// -- principle 4 -----------------------------------------------------------

step("machine vocabulary never reaches a person", () => {
  const scrubbed = scrubMachineLanguage("As an AI language model, I generated this with the algorithm.");
  assert(!containsMachineLanguage(scrubbed), `machine language survived the scrub: ${scrubbed}`);
  assert(scrubMachineLanguage("We built this for you.") === "We built this for you.", "the scrub damaged clean copy");
});

step("nothing the person reads mentions the machinery", () => {
  const states = [
    "intake",
    "reflected",
    "diagnosed",
    "offered",
    "covenant_pending",
    "accepted",
    "building",
    "delivered_pending_connection",
    "connecting",
    "connected",
    "follow_up",
    "closed",
    "paused",
    "declined",
    "escalated"
  ];

  for (const state of states) {
    const line = describeStateForPerson(state);
    assert(line.length > 0, `no status line for ${state}`);
    assert(!containsMachineLanguage(line), `machine language in the ${state} status line`);
  }

  for (const solutionType of ["business_starter", "personal_tool", "job_search_kit", "action_plan"]) {
    const offer = buildOffer({ solutionType, triage: "development", statedProblem: "test" });
    const text = [offer.headline, offer.whatWeBuild, offer.whatItCosts, offer.whatYouBring, ...offer.bullets].join(" ");
    assert(!containsMachineLanguage(text), `machine language in the ${solutionType} offer`);
  }
});

step("the relief offer asks for nothing and the development offer asks for something", () => {
  assert(buildOffer({ solutionType: "personal_tool", triage: "relief", statedProblem: "x" }).whatYouBring === null, "relief attached strings");
  assert(
    buildOffer({ solutionType: "personal_tool", triage: "development", statedProblem: "x" }).whatYouBring !== null,
    "development asked for nothing"
  );
  assert(
    /\bnothing\b/i.test(buildOffer({ solutionType: "personal_tool", triage: "relief", statedProblem: "x" }).whatItCosts),
    "the cost line is not plainly free"
  );
});

step("problem classification lands somewhere usable", () => {
  assert(classifyProblem({ solution_type: "job_search_kit", stated_problem: "I got laid off" }) === "job_loss", "job loss misclassified");
  assert(
    classifyProblem({ solution_type: "business_starter", stated_problem: "I want to sell my baking" }) === "business_start",
    "business start misclassified"
  );
  assert(classifyProblem({ stated_problem: "I can't afford rent" }) === "money_income", "money problem misclassified");
});

console.log(`\n${checks} assertions, ${failures} failed step(s).`);

if (failures > 0) {
  process.exit(1);
}
