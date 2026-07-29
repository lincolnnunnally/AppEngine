// §7 — the connection layer. The step that cannot be skipped.
//
// "The metric that matters is intros-accepted, not solutions-shipped." Everything
// in this file exists to get one person in front of one other person who has been
// where they are.

import { insertRow, selectOne, selectRows, updateOne } from "./db";
import type { Intro, PoolMember, SolutionCase } from "./types";

// The shared vocabulary between a case and a volunteer. Deliberately small — a
// long taxonomy produces zero matches, which is the only truly useless outcome.
export const problemClasses = [
  "money_income",
  "job_loss",
  "business_start",
  "admin_overwhelm",
  "childcare",
  "isolation",
  "other"
] as const;

export type ProblemClass = (typeof problemClasses)[number];

export const problemClassLabels: Record<ProblemClass, string> = {
  money_income: "Not enough coming in",
  job_loss: "Out of work",
  business_start: "Starting something of their own",
  admin_overwhelm: "Buried in the day-to-day",
  childcare: "No window to work in",
  isolation: "Doing it alone",
  other: "Something else"
};

export function classifyProblem(theCase: Pick<SolutionCase, "solution_type" | "root_class" | "stated_problem" | "functional_problem">): ProblemClass {
  const text = `${theCase.stated_problem || ""} ${theCase.functional_problem || ""}`.toLowerCase();

  if (theCase.solution_type === "job_search_kit" || /\blaid off\b|\bfired\b|\bout of work\b|\bunemploy/.test(text)) {
    return "job_loss";
  }

  if (theCase.solution_type === "business_starter" || /\bstart(ing)? (a|my) (business|shop)\b|\bside (hustle|business)\b/.test(text)) {
    return "business_start";
  }

  if (/\bchildcare\b|\bdaycare\b|\bkids?\b|\bbabysit/.test(text)) {
    return "childcare";
  }

  if (/\badmin\b|\bpaperwork\b|\binvoic|\bschedul|\bburied\b|\bbehind on\b/.test(text)) {
    return "admin_overwhelm";
  }

  if (theCase.root_class === "isolation" || /\balone\b|\bno one\b|\bnobody\b|\bisolat/.test(text)) {
    return "isolation";
  }

  if (/\bmoney\b|\bincome\b|\brent\b|\bbills?\b|\bpaid enough\b|\bafford\b/.test(text)) {
    return "money_income";
  }

  return "other";
}

export type MatchCandidate = {
  member: PoolMember;
  score: number;
  why: string;
};

// "Prefer one-step-ahead over same-stage where available. Someone six months past
// the same problem is the highest-value match — it helps both parties."
export function rankMatches(
  theCase: Pick<SolutionCase, "region" | "problem_class">,
  pool: PoolMember[],
  activeLoad: Record<string, number> = {}
): MatchCandidate[] {
  const problemClass = theCase.problem_class || "other";

  return pool
    .filter((member) => member.active)
    .filter((member) => (activeLoad[member.id] || 0) < member.capacity)
    .map((member) => {
      let score = 0;
      const why: string[] = [];

      if (member.problem_classes.includes(problemClass)) {
        score += 5;
        why.push("has been through the same thing");
      }

      if (member.stage === "one_step_ahead") {
        score += 3;
        why.push("came out the other side of it");
      }

      if (theCase.region && member.region && sameRegion(theCase.region, member.region)) {
        score += 2;
        why.push("is nearby");
      }

      return { member, score, why: why.join(", ") };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

function sameRegion(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// A warm three-line mutual intro (§7). Both parties confirm before any contact
// detail is shared — that ordering is the whole safety model of this layer.
export function draftIntro(theCase: SolutionCase, member: PoolMember): string {
  const name = theCase.contact_name?.trim() || "someone we've been working with";
  const problem = (theCase.stated_problem || "").trim();
  const shortProblem = problem.length > 140 ? `${problem.slice(0, 137).trim()}…` : problem;
  const story = member.story?.trim();

  return [
    `${name} — you should meet ${member.display_name}.`,
    story
      ? `${member.display_name} was where you are: ${story}`
      : `${member.display_name} has been through the same thing you're dealing with${shortProblem ? ` — ${shortProblem.toLowerCase()}` : ""}.`,
    "If you both say yes, we'll pass along the way to reach each other and get out of the way."
  ].join("\n\n");
}

export async function listActivePool(): Promise<PoolMember[]> {
  return selectRows<PoolMember>("se_connection_pool", "active=eq.true&select=*&order=created_at.asc");
}

export async function currentPoolLoad(): Promise<Record<string, number>> {
  const open = await selectRows<Pick<Intro, "match_id" | "state">>(
    "se_intros",
    "state=in.(drafted,sent)&select=match_id,state"
  );

  return open.reduce<Record<string, number>>((carry, intro) => {
    if (intro.match_id) {
      carry[intro.match_id] = (carry[intro.match_id] || 0) + 1;
    }

    return carry;
  }, {});
}

export async function listIntros(caseId: string): Promise<Intro[]> {
  return selectRows<Intro>("se_intros", `case_id=eq.${caseId}&select=*&order=attempt_number.asc`);
}

export async function proposeIntro(theCase: SolutionCase): Promise<{ intro: Intro; member: PoolMember } | null> {
  const [pool, load, existing] = await Promise.all([listActivePool(), currentPoolLoad(), listIntros(theCase.id)]);

  const alreadyTried = new Set(existing.map((intro) => intro.match_id).filter(Boolean) as string[]);
  const ranked = rankMatches(theCase, pool, load).filter((candidate) => !alreadyTried.has(candidate.member.id));

  if (ranked.length === 0) {
    return null;
  }

  const best = ranked[0];
  const attemptNumber = existing.length + 1;

  const intro = await insertRow<Intro>("se_intros", {
    case_id: theCase.id,
    match_id: best.member.id,
    attempt_number: attemptNumber,
    state: "drafted",
    draft: draftIntro(theCase, best.member)
  });

  await updateOne("se_cases", `id=eq.${theCase.id}`, { intro_attempts: attemptNumber });

  return { intro, member: best.member };
}

export async function getOpenIntro(caseId: string): Promise<Intro | null> {
  return selectOne<Intro>("se_intros", `case_id=eq.${caseId}&state=in.(drafted,sent)&select=*&order=attempt_number.desc`);
}

export type IntroSide = "person" | "match";

export async function confirmIntro(intro: Intro, side: IntroSide): Promise<Intro> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = side === "person" ? { person_confirmed_at: now } : { match_confirmed_at: now };
  const personConfirmed = side === "person" ? now : intro.person_confirmed_at;
  const matchConfirmed = side === "match" ? now : intro.match_confirmed_at;

  // Contact details cross only when BOTH sides have said yes.
  if (personConfirmed && matchConfirmed) {
    patch.state = "accepted";
    patch.contact_shared_at = now;
  } else {
    patch.state = "sent";
  }

  return updateOne<Intro>("se_intros", `id=eq.${intro.id}`, patch);
}

export async function declineIntro(intro: Intro, side: IntroSide): Promise<Intro> {
  return updateOne<Intro>("se_intros", `id=eq.${intro.id}`, {
    state: "declined",
    declined_at: new Date().toISOString(),
    declined_by: side
  });
}

export function introIsAccepted(intro: Intro | null): boolean {
  return intro?.state === "accepted";
}

// §7, group formation: when ≥4 people in a region share a problem class, propose a
// meetup. This returns the candidate groups; creating one is an operator action.
export const GROUP_THRESHOLD = 4;

export type GroupCandidate = {
  region: string;
  problemClass: string;
  caseIds: string[];
};

export function findGroupCandidates(cases: Pick<SolutionCase, "id" | "region" | "problem_class">[]): GroupCandidate[] {
  const buckets = new Map<string, GroupCandidate>();

  for (const theCase of cases) {
    if (!theCase.region || !theCase.problem_class) {
      continue;
    }

    const key = `${theCase.region.trim().toLowerCase()}::${theCase.problem_class}`;
    const bucket = buckets.get(key) || { region: theCase.region, problemClass: theCase.problem_class, caseIds: [] };
    bucket.caseIds.push(theCase.id);
    buckets.set(key, bucket);
  }

  return [...buckets.values()].filter((bucket) => bucket.caseIds.length >= GROUP_THRESHOLD);
}
