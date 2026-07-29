// §5 + the Offer stage of §3. A plain-English proposal: what we'll build, what it
// costs (usually nothing), and — on the chronic track only — what they contribute.
//
// The offer text is a template, not a model output, on purpose. This is the one
// screen where a person decides whether to trust us, and it should say the same
// honest thing every time.

import type { Offer, SolutionType, Triage } from "./types";
import { requiresCovenant } from "./triage";

type OfferTemplate = {
  headline: string;
  whatWeBuild: string;
  bullets: string[];
  theyBring: string;
  firstStep: string;
};

const templates: Record<SolutionType, OfferTemplate> = {
  business_starter: {
    headline: "A working front door for what you already know how to do",
    whatWeBuild:
      "A single page that says what you do, a way for people to book or order it, and a link that takes their money. Live on the internet, with your name on it.",
    bullets: [
      "One page — not a website you have to maintain",
      "A booking or order form that emails you when someone uses it",
      "A payment link that works from a phone",
      "A ten-minute walkthrough so you never have to figure it out"
    ],
    theyBring: "Post your open hours and take one booking or one order this week.",
    firstStep: "Send us the three things you'd charge for and what you'd charge. Fifteen minutes, tonight."
  },
  personal_tool: {
    headline: "One small thing that does the part you keep dropping",
    whatWeBuild:
      "A simple tool built around your actual week — the tracking, the reminding, or the paperwork that keeps falling through. Nothing to install, nothing to set up.",
    bullets: [
      "Built for your situation, not a general-purpose app",
      "Opens on your phone with one link",
      "No account to maintain, no settings to learn",
      "A ten-minute walkthrough so you never have to figure it out"
    ],
    theyBring: "Use it three times this week, even badly.",
    firstStep: "Write down the three things you most often forget or lose track of. Ten minutes, tonight."
  },
  job_search_kit: {
    headline: "A search that runs on a system instead of on your nerve",
    whatWeBuild:
      "Your resume rebuilt around what you actually did, a tracker for every application so nothing gets lost, and a weekly plan you can follow on a bad day.",
    bullets: [
      "Resume rewritten for the jobs you're actually going for",
      "A tracker that tells you who owes you an answer",
      "A weekly plan sized for a tired week, not a perfect one",
      "A ten-minute walkthrough so you never have to figure it out"
    ],
    theyBring: "Send three applications a week and log them.",
    firstStep: "Send us your current resume, or a list of the last three jobs you held. Twenty minutes, tonight."
  },
  action_plan: {
    headline: "A plan, in plain words, that fits on one page",
    whatWeBuild:
      "Software isn't the answer to this one, and we're not going to pretend it is. What we'll give you is the sequence — what to do first, who to call, and what to say — written out plainly.",
    bullets: [
      "Written for your situation, not general advice",
      "Ordered, so you only have to do the next thing",
      "Names the calls to make and what to say on them",
      "One page. That's it."
    ],
    theyBring: "Do step one and tell us what happened.",
    firstStep: "Take the first step on the plan. Under an hour."
  }
};

export type OfferInput = {
  solutionType: SolutionType;
  triage: Triage;
  statedProblem: string;
  readyBy?: Date;
};

export function buildOffer(input: OfferInput): Offer {
  const template = templates[input.solutionType] || templates.personal_tool;
  const readyBy = input.readyBy || nextThursday();
  const chronic = requiresCovenant(input.triage);

  return {
    headline: template.headline,
    whatWeBuild: template.whatWeBuild,
    // "Never surprise costs" (§5). If a real cost ever exists it is stated here,
    // at the offer, and nowhere later.
    whatItCosts: "Nothing. If something ever costs real money — a web address, materials — we'll tell you the number before we spend it.",
    whatYouBring: chronic ? template.theyBring : null,
    readyBy: formatReadyBy(readyBy),
    bullets: template.bullets
  };
}

export function offerFirstStep(solutionType: SolutionType): string {
  return (templates[solutionType] || templates.personal_tool).firstStep;
}

export function offerTheyBring(solutionType: SolutionType): string {
  return (templates[solutionType] || templates.personal_tool).theyBring;
}

// "Come back Thursday" — the brief's own words. A real date beats a vague soon.
export function nextThursday(from: Date = new Date()): Date {
  const target = new Date(from);
  const daysAhead = (4 - target.getUTCDay() + 7) % 7 || 7;
  target.setUTCDate(target.getUTCDate() + daysAhead);
  return target;
}

export function formatReadyBy(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Relief track gets resources immediately and without conditions (§4c: "fast,
// generous, no strings"). This is what goes on the offer screen alongside the build.
export function reliefResources(region?: string | null): { name: string; contact: string; detail: string }[] {
  const local = region ? ` (near ${region})` : "";

  return [
    {
      name: "211",
      contact: "Call or text 211",
      detail: `Free local help with rent, utilities, food, and childcare${local}. Real people, no application.`
    },
    {
      name: "Findhelp",
      contact: "findhelp.org",
      detail: "Search by zip code for free and reduced-cost programs near you."
    },
    {
      name: "Local churches and benevolence funds",
      contact: "Ask us and we'll make the call with you",
      detail: "Many hold funds for exactly this and never get asked."
    }
  ];
}
