// Owner weekly income goal on dashboard.unitedundergod.org.
// Lincoln: $1,000/week starting Monday 2026-09-14 (America/New_York), then
// grow weekly income by at least 25%. This board only counts Stripe this desk
// can actually read. Unread keys and unlabeled charges are gaps, never $0.

import type { RevenueStreamId } from "./revenue-streams";

export const WEEKLY_GOAL_TZ = "America/New_York";
export const WEEKLY_GOAL_START_ISO = "2026-09-14";
export const WEEKLY_GOAL_START_CENTS = 100_000;
export const WEEKLY_GROWTH_RATE = 1.25;

export const MIX_STREAM_IDS: RevenueStreamId[] = [
  "churchconnect",
  "appengine",
  "easypeazy",
  "ai-website-design",
  "laser"
];

export type WeeklyCharge = {
  created: number;
  amount: number;
  streamId: RevenueStreamId;
  streamLabel: string;
  streamSlug: string | null;
  service?: string;
  invoice?: string | null;
};

export type WeeklyAccount = {
  sourceId: string;
  label: string;
  state: "ok" | "denied" | "error" | "no_key";
};

export type StreamWeek = {
  id: RevenueStreamId;
  label: string;
  slug: string | null;
  cents: number;
  charges: number;
  recurringCents: number;
};

export type WeekBucket = {
  startUnix: number;
  endUnix: number;
  label: string;
  weekIndex: number;
  ladderCents: number;
  growthFloorCents: number;
  goalCents: number;
  actualCents: number;
  recurringCents: number;
  oneOffCents: number;
  charges: number;
  byStream: StreamWeek[];
};

export type Opportunity = {
  id: string;
  severity: "act" | "watch";
  title: string;
  detail: string;
  href?: string;
};

export type WeeklyGoalReport = {
  timezone: string;
  nowUnix: number;
  goalStarted: boolean;
  startLabel: string;
  thisWeek: WeekBucket;
  lastWeek: WeekBucket;
  nextWeekGoalCents: number;
  percentOfGoal: number | null;
  gapCents: number;
  aheadCents: number;
  onPace: boolean | null;
  expectedByNowCents: number | null;
  daysElapsed: number;
  daysLeft: number;
  upcoming: Array<{ startUnix: number; endUnix: number; label: string; weekIndex: number; ladderCents: number }>;
  opportunities: Opportunity[];
  truncated: boolean;
};

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function tzOffsetMs(unixMs: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date(unixMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - unixMs;
}

export function nyMidnightUnix(year: number, month: number, day: number): number {
  const probe = Date.UTC(year, month - 1, day, 12, 0, 0);
  const offset = tzOffsetMs(probe, WEEKLY_GOAL_TZ);
  return Math.floor((Date.UTC(year, month - 1, day, 0, 0, 0) - offset) / 1000);
}

export function nyParts(at: Date): { year: number; month: number; day: number; weekday: number } {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: WEEKLY_GOAL_TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short"
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    weekday: WEEKDAY[bag.weekday] ?? 0
  };
}

export function mondayUnixContaining(at: Date): number {
  const parts = nyParts(at);
  const daysFromMonday = (parts.weekday + 6) % 7;
  const utcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0) - daysFromMonday * 86_400_000;
  const monday = nyParts(new Date(utcNoon));
  return nyMidnightUnix(monday.year, monday.month, monday.day);
}

export function addDaysUnix(startUnix: number, days: number): number {
  const shifted = new Date((startUnix + 12 * 3600) * 1000 + days * 86_400_000);
  const parts = nyParts(shifted);
  return nyMidnightUnix(parts.year, parts.month, parts.day);
}

export function weekIndexForMonday(mondayUnix: number): number {
  const start = nyMidnightUnix(2026, 9, 14);
  return Math.round((mondayUnix - start) / (7 * 86_400));
}

export function ladderCentsForWeek(weekIndex: number): number {
  if (weekIndex < 0) return 0;
  return Math.round(WEEKLY_GOAL_START_CENTS * WEEKLY_GROWTH_RATE ** weekIndex);
}

export function goalCentsForWeek(weekIndex: number, lastWeekActualCents: number): number {
  const ladder = ladderCentsForWeek(weekIndex);
  if (weekIndex < 0) return 0;
  if (weekIndex === 0) return ladder;
  return Math.max(ladder, Math.round(lastWeekActualCents * WEEKLY_GROWTH_RATE));
}

export function chargeLooksRecurring(charge: { invoice?: string | null; service?: string }): boolean {
  if (charge.invoice) return true;
  return /subscription|invoice|recurring|monthly|ministry pro/.test((charge.service || "").toLowerCase());
}

function formatWeekLabel(startUnix: number, endUnix: number): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: WEEKLY_GOAL_TZ,
    month: "short",
    day: "numeric"
  });
  const start = fmt.format(new Date(startUnix * 1000));
  const end = fmt.format(new Date((endUnix - 1) * 1000));
  return `${start} – ${end}`;
}

const MIX_LABELS: Record<RevenueStreamId, { label: string; slug: string | null }> = {
  churchconnect: { label: "ChurchConnect Pro", slug: "churchconnect" },
  appengine: { label: "App Engine credits", slug: "appengine" },
  easypeazy: { label: "EasyPeazy", slug: "easy-peasy-website" },
  "ai-website-design": { label: "AI Website Design", slug: "ai-website-design" },
  laser: { label: "Laser Engrave Market", slug: "laser-engrave-market" },
  "kids-need-dads": { label: "Kids Need Dads", slug: "kids-need-dads" },
  "united-under-god": { label: "United Under God gifts", slug: "united-under-god" },
  toner: { label: "Toner family", slug: "toner-management" },
  unattributed: { label: "This Stripe account — not labeled", slug: null }
};

function emptyStreams(): StreamWeek[] {
  return MIX_STREAM_IDS.map((id) => ({
    id,
    label: MIX_LABELS[id].label,
    slug: MIX_LABELS[id].slug,
    cents: 0,
    charges: 0,
    recurringCents: 0
  }));
}

function bucketCharges(charges: WeeklyCharge[], startUnix: number, endUnix: number, weekIndex: number, lastWeekActualCents: number): WeekBucket {
  const inWeek = charges.filter((charge) => charge.created >= startUnix && charge.created < endUnix);
  const streams = emptyStreams();
  const extras = new Map<string, StreamWeek>();
  let actual = 0;
  let recurring = 0;
  for (const charge of inWeek) {
    actual += charge.amount;
    const isRecurring = chargeLooksRecurring(charge);
    if (isRecurring) recurring += charge.amount;
    const known = streams.find((stream) => stream.id === charge.streamId);
    if (known) {
      known.cents += charge.amount;
      known.charges += 1;
      if (isRecurring) known.recurringCents += charge.amount;
    } else {
      const key = charge.streamId;
      const existing = extras.get(key);
      if (existing) {
        existing.cents += charge.amount;
        existing.charges += 1;
        if (isRecurring) existing.recurringCents += charge.amount;
      } else {
        extras.set(key, {
          id: charge.streamId,
          label: charge.streamLabel,
          slug: charge.streamSlug,
          cents: charge.amount,
          charges: 1,
          recurringCents: isRecurring ? charge.amount : 0
        });
      }
    }
  }
  const byStream = [...streams, ...extras.values()].sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
  const ladder = ladderCentsForWeek(weekIndex);
  const growthFloor = weekIndex > 0 ? Math.round(lastWeekActualCents * WEEKLY_GROWTH_RATE) : 0;
  return {
    startUnix,
    endUnix,
    label: formatWeekLabel(startUnix, endUnix),
    weekIndex,
    ladderCents: ladder,
    growthFloorCents: growthFloor,
    goalCents: goalCentsForWeek(weekIndex, lastWeekActualCents),
    actualCents: actual,
    recurringCents: recurring,
    oneOffCents: actual - recurring,
    charges: inWeek.length,
    byStream
  };
}

function closerCount(gapCents: number, unitCents: number): number {
  if (gapCents <= 0 || unitCents <= 0) return 0;
  return Math.ceil(gapCents / unitCents);
}

export function dollarsPlain(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildOpportunities(args: {
  goalStarted: boolean;
  thisWeek: WeekBucket;
  accounts: WeeklyAccount[];
  truncated: boolean;
}): Opportunity[] {
  const { goalStarted, thisWeek, accounts, truncated } = args;
  const out: Opportunity[] = [];
  const unread = accounts.filter((account) => account.state !== "ok");
  if (unread.length) {
    out.push({
      id: "unread-stripe",
      severity: "act",
      title: "Stripe we cannot read",
      detail: `${unread.map((account) => account.label.replace(/^Vault — /, "")).join(", ")} ${
        unread.length === 1 ? "has" : "have"
      } no usable key on this desk. That money is missing from the score — it is not $0.`,
      href: "/integrations"
    });
  }

  const unlabeled = thisWeek.byStream.find((stream) => stream.id === "unattributed" && stream.cents > 0);
  if (unlabeled) {
    out.push({
      id: "unlabeled",
      severity: "act",
      title: "Charges with no product name",
      detail: `${unlabeled.charges} payment${unlabeled.charges === 1 ? "" : "s"} (${dollarsPlain(unlabeled.cents)}) this week did not name an app. Put the product on the Stripe charge so we know which lever worked.`,
      href: "/reports/money?stream=unattributed"
    });
  }

  const church = thisWeek.byStream.find((stream) => stream.id === "churchconnect");
  if (!church?.cents) {
    out.push({
      id: "cc-zero",
      severity: "act",
      title: "No ChurchConnect Pro this week",
      detail: "Each Pro church is $49/month and recurs. 21 churches is $1,029 — a full $1,000 week as a standing base.",
      href: "https://www.churchconnect.cloud/for-churches"
    });
  }

  const laser = thisWeek.byStream.find((stream) => stream.id === "laser");
  if (!laser?.cents) {
    out.push({
      id: "laser-zero",
      severity: "act",
      title: "No labeled laser charges this week",
      detail: "Church and community samples start at $20 (coaster). A $1,000 week is about 50 coaster-level orders, or fewer larger pieces. In-person cash does not show here.",
      href: "https://laser.unitedundergod.org/s/church"
    });
  }

  const sites = thisWeek.byStream.filter((stream) => stream.id === "easypeazy" || stream.id === "ai-website-design");
  if (sites.every((stream) => !stream.cents)) {
    out.push({
      id: "sites-zero",
      severity: "act",
      title: "No labeled website charges this week",
      detail: "EasyPeazy and AI Website Design only count when their Stripe key is on this desk and the charge names the product.",
      href: "/reports/money"
    });
  }

  const apps = thisWeek.byStream.find((stream) => stream.id === "appengine");
  if (!apps?.cents) {
    out.push({
      id: "apps-zero",
      severity: "watch",
      title: "No labeled App Engine charges this week",
      detail: "App and service work counts when the charge is on a readable Stripe and named. Selling the app is one lever of the mix.",
      href: "/apps/appengine"
    });
  }

  const gap = Math.max(0, thisWeek.goalCents - thisWeek.actualCents);
  if (goalStarted && gap > 0) {
    const churches = closerCount(gap, 4900);
    const samples = closerCount(gap, 2000);
    out.unshift({
      id: "gap",
      severity: "act",
      title: `${dollarsPlain(gap)} still needed this week`,
      detail: `${churches} ChurchConnect Pro church${churches === 1 ? "" : "es"} at $49 would close the gap and recur. Or about ${samples} $20 laser sample${samples === 1 ? "" : "s"} this week (not recurring). Websites and services count too — only if Stripe here can see them.`,
      href: "/reports/money#weekly-goal"
    });
  }

  if (truncated) {
    out.push({
      id: "truncated",
      severity: "watch",
      title: "Charge list was truncated",
      detail: "At least one Stripe account has more than this desk pulled. Totals may be low, not high."
    });
  }

  out.push({
    id: "off-stripe",
    severity: "watch",
    title: "Cash, checks, and in-person laser are invisible here",
    detail: "This score is Stripe this desk can read. A check, Zelle, or cash engraving does not move the bar until it hits a readable Stripe."
  });

  return out;
}

export function buildWeeklyGoal(input: {
  charges: WeeklyCharge[];
  accounts: WeeklyAccount[];
  truncated?: boolean;
  now?: Date;
}): WeeklyGoalReport {
  const now = input.now ?? new Date();
  const thisMonday = mondayUnixContaining(now);
  const lastMonday = addDaysUnix(thisMonday, -7);
  const nextMonday = addDaysUnix(thisMonday, 7);
  const weekAfter = addDaysUnix(nextMonday, 7);
  const thisIndex = weekIndexForMonday(thisMonday);
  const lastIndex = weekIndexForMonday(lastMonday);

  const lastWeek = bucketCharges(input.charges, lastMonday, thisMonday, lastIndex, 0);
  const thisWeek = bucketCharges(input.charges, thisMonday, nextMonday, thisIndex, lastWeek.actualCents);
  const nextLadder = ladderCentsForWeek(thisIndex + 1);
  const nextGrowth = thisIndex >= 0 ? Math.round(thisWeek.actualCents * WEEKLY_GROWTH_RATE) : 0;
  const nextWeekGoalCents = thisIndex + 1 === 0 ? nextLadder : Math.max(nextLadder, nextGrowth);

  const parts = nyParts(now);
  const daysElapsed = ((parts.weekday + 6) % 7) + 1;
  const daysLeft = Math.max(0, 7 - daysElapsed);
  const goalStarted = thisIndex >= 0;
  const expectedByNowCents = goalStarted && thisWeek.goalCents ? Math.round((thisWeek.goalCents * daysElapsed) / 7) : null;
  const gapCents = Math.max(0, thisWeek.goalCents - thisWeek.actualCents);
  const aheadCents = Math.max(0, thisWeek.actualCents - thisWeek.goalCents);
  const percentOfGoal = thisWeek.goalCents > 0 ? Math.round((thisWeek.actualCents / thisWeek.goalCents) * 100) : null;
  const onPace = expectedByNowCents == null ? null : thisWeek.actualCents >= expectedByNowCents;

  const upcomingMonday = thisIndex >= 0 ? thisMonday : nyMidnightUnix(2026, 9, 14);
  const upcoming: WeeklyGoalReport["upcoming"] = [];
  let cursor = upcomingMonday;
  for (let i = 0; i < 6; i += 1) {
    const idx = weekIndexForMonday(cursor);
    const end = addDaysUnix(cursor, 7);
    upcoming.push({
      startUnix: cursor,
      endUnix: end,
      label: formatWeekLabel(cursor, end),
      weekIndex: idx,
      ladderCents: ladderCentsForWeek(idx)
    });
    cursor = end;
  }

  const opportunities = buildOpportunities({
    goalStarted,
    thisWeek,
    accounts: input.accounts,
    truncated: Boolean(input.truncated)
  });

  return {
    timezone: WEEKLY_GOAL_TZ,
    nowUnix: Math.floor(now.getTime() / 1000),
    goalStarted,
    startLabel: "Mon Sep 14, 2026",
    thisWeek,
    lastWeek,
    nextWeekGoalCents,
    percentOfGoal,
    gapCents,
    aheadCents,
    onPace,
    expectedByNowCents,
    daysElapsed,
    daysLeft,
    upcoming,
    opportunities,
    truncated: Boolean(input.truncated)
  };
}
