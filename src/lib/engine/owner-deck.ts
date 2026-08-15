// Owner command deck — the data behind the owner's home page. This module
// BUILDS NOTHING NEW: it merges the sources that already exist (the URL-status
// board, the ops-stats snapshot with its attention queue, the credential
// attention items) into one glanceable model, by slug. Every number is real or
// absent — no source here ever fakes a value. SERVER ONLY.
import {
  getPortfolioUrlStatusBoard,
  URL_STATUS_LABEL,
  type PortfolioUrlStatus,
  type PortfolioUrlStatusEntry
} from "@/lib/engine/portfolio-url-status";
import { getOpsSnapshot, type OpsStatsRecord } from "@/lib/engine/ops-stats";
import type { OpsAttentionItem } from "@/lib/engine/ops-attention";
import {
  getCredentialAttentionItems,
  type CredentialAttentionItem
} from "@/lib/engine/ecosystem-credential-registry";
import {
  APP_FAMILIES,
  familyForSlug,
  familyLabel,
  resolveAdminDoor,
  type AppFamilyId
} from "@/lib/engine/app-ops-catalog";
import { getInboxCounts } from "@/lib/engine/ecosystem-inbox";

export type DeckGrowth = "up" | "down" | "steady" | null;

export type DeckApp = {
  slug: string;
  name: string;
  status: PortfolioUrlStatus;
  statusLabel: string;
  url: string | null; // the door that answers today
  domain: string; // intended domain ("" when undecided)
  adminUrl: string | null;
  users: number | null;
  activeUsers30d: number | null;
  newUsers7d: number | null;
  newUsersPrev7d: number | null;
  ticketsOpen: number | null; // ops-reported open tickets (count only)
  inboxOpen: number; // tickets that landed in the central inbox
  ordersRecent: number | null;
  growth: DeckGrowth;
  family: AppFamilyId;
  familyLabel: string;
  reporting: boolean;
  nextStep: string;
  attentionCount: number;
};

export type DeckInsight = {
  kind: "opportunity" | "challenge";
  slug: string;
  appName: string;
  text: string;
  href: string;
};

export type DeckAttention = {
  appName: string;
  severity: "act" | "watch";
  finding: string;
  action: string;
  link: string | null; // where clicking the row takes the owner to actually fix it
};

export type OwnerDeck = {
  factsAsOf: string;
  liveCount: number;
  totalApps: number;
  usersAcrossApps: number | null; // sum over reporting apps; null when none report
  reportingApps: number;
  openTickets: number; // central inbox (open + in progress)
  attention: DeckAttention[];
  insights: DeckInsight[];
  families: Array<{ id: AppFamilyId; label: string; count: number }>;
  apps: DeckApp[];
  opsCheckedAt: string | null; // null = ops snapshot unavailable (still honest)
};

function growthFrom(newUsers7d: number | null, newUsersPrev7d: number | null): DeckGrowth {
  if (typeof newUsers7d !== "number" || typeof newUsersPrev7d !== "number") return null;
  if (newUsers7d > newUsersPrev7d) return "up";
  if (newUsers7d < newUsersPrev7d) return "down";
  return "steady";
}

// Derived only from recorded numbers. Never invents a trend or a revenue idea.
export function deriveAppInsights(app: DeckApp, inboxOpen: number): DeckInsight[] {
  const insights: DeckInsight[] = [];
  const href = `/apps/${app.slug}`;

  if (inboxOpen > 0) {
    insights.push({
      kind: "challenge",
      slug: app.slug,
      appName: app.name,
      text: `${inboxOpen} ${inboxOpen === 1 ? "person is" : "people are"} waiting for help.`,
      href: `/inbox?app=${encodeURIComponent(app.slug)}`
    });
  }

  if (app.status === "live" && app.reporting && app.growth === "up") {
    insights.push({
      kind: "opportunity",
      slug: app.slug,
      appName: app.name,
      text: `Growing this week — ${app.newUsers7d ?? 0} new ${app.newUsers7d === 1 ? "person" : "people"} vs ${app.newUsersPrev7d ?? 0} the week before.`,
      href
    });
  }

  if (app.status === "live" && app.reporting && app.growth === "down") {
    insights.push({
      kind: "challenge",
      slug: app.slug,
      appName: app.name,
      text: `Slowing — ${app.newUsers7d ?? 0} new this week vs ${app.newUsersPrev7d ?? 0} the week before.`,
      href
    });
  }

  if (app.status === "live" && !app.reporting) {
    insights.push({
      kind: "challenge",
      slug: app.slug,
      appName: app.name,
      text: "Live, but not reporting usage yet — we cannot see how it is doing.",
      href
    });
  }

  if (app.status === "live" && app.reporting && app.users === 0) {
    insights.push({
      kind: "challenge",
      slug: app.slug,
      appName: app.name,
      text: "Live with zero users — the door is open and no one has walked in yet.",
      href
    });
  }

  if (app.status === "live" && app.reporting && typeof app.activeUsers30d === "number" && app.activeUsers30d === 0 && (app.users ?? 0) > 3) {
    insights.push({
      kind: "challenge",
      slug: app.slug,
      appName: app.name,
      text: `${app.users} signed up, none active in the last 30 days.`,
      href
    });
  }

  if (app.status === "domain_owned_not_serving") {
    insights.push({
      kind: "challenge",
      slug: app.slug,
      appName: app.name,
      text: "A domain is owned and nothing is serving on it.",
      href
    });
  }

  if (app.status === "deployed_awaiting_domain") {
    insights.push({
      kind: "opportunity",
      slug: app.slug,
      appName: app.name,
      text: "Deployed and waiting on a real domain — one step from a public door.",
      href
    });
  }

  if (typeof app.ordersRecent === "number" && app.ordersRecent > 0) {
    insights.push({
      kind: "opportunity",
      slug: app.slug,
      appName: app.name,
      text: `${app.ordersRecent} order${app.ordersRecent === 1 ? "" : "s"} in the last 30 days.`,
      href
    });
  }

  return insights;
}

// The board and the ops collector grew separate slugs for the same app (a known
// roster drift): the board says "appengine", ops-stats registers the self target
// as "appengine-core". Alias them so AppEngine's own card reflects its own stats.
const SLUG_ALIASES: Record<string, string> = { appengine: "appengine-core" };

function canonicalSlug(slug: string): string {
  const aliased = Object.entries(SLUG_ALIASES).find(([, opsSlug]) => opsSlug === slug);
  return aliased ? aliased[0] : slug;
}

function opsRecordFor(entry: PortfolioUrlStatusEntry, records: OpsStatsRecord[]): OpsStatsRecord | undefined {
  const bySlug = records.find(
    (record) => record.slug === entry.slug || record.slug === SLUG_ALIASES[entry.slug]
  );
  if (bySlug) return bySlug;
  if (!entry.servingUrl) return undefined;
  try {
    const host = new URL(entry.servingUrl).host;
    return records.find((record) => {
      try {
        return record.url ? new URL(record.url).host === host : false;
      } catch {
        return false;
      }
    });
  } catch {
    return undefined;
  }
}

export async function loadOwnerDeck(): Promise<OwnerDeck> {
  const board = getPortfolioUrlStatusBoard();
  const snapshot = await getOpsSnapshot().catch(() => null);
  const credentialItems = await getCredentialAttentionItems().catch(() => [] as CredentialAttentionItem[]);
  const inbox = await getInboxCounts().catch(() => ({ open: 0, inProgress: 0, resolved: 0, bySlug: {} as Record<string, number> }));

  const records = snapshot?.apps ?? [];
  const opsAttention = snapshot?.attention ?? [];

  const attentionBySlug = new Map<string, number>();
  const bump = (slug: string) => {
    const canonical = canonicalSlug(slug);
    attentionBySlug.set(canonical, (attentionBySlug.get(canonical) ?? 0) + 1);
  };
  for (const item of opsAttention) bump(item.slug);
  for (const item of credentialItems) bump(item.slug);
  for (const [slug, count] of Object.entries(inbox.bySlug)) {
    if (count > 0) bump(slug);
  }

  const apps: DeckApp[] = board.entries.map((entry) => {
    const ops = opsRecordFor(entry, records);
    const family = familyForSlug(entry.slug);
    const door = resolveAdminDoor(entry.slug, entry.servingUrl || null);
    const newUsers7d = ops?.stats.newUsers7d ?? null;
    const newUsersPrev7d = ops?.stats.newUsersPrev7d ?? null;
    const inboxOpen = inbox.bySlug[entry.slug] ?? 0;
    return {
      slug: entry.slug,
      name: entry.appName,
      status: entry.status,
      statusLabel: URL_STATUS_LABEL[entry.status],
      url: entry.servingUrl || null,
      domain: entry.intendedDomain,
      adminUrl: door?.url || null,
      users: ops?.stats.users ?? null,
      activeUsers30d: ops?.stats.activeUsers30d ?? null,
      newUsers7d,
      newUsersPrev7d,
      ticketsOpen: ops?.stats.ticketsOpen ?? null,
      inboxOpen,
      ordersRecent: ops?.stats.ordersRecent ?? null,
      growth: growthFrom(newUsers7d, newUsersPrev7d),
      family,
      familyLabel: familyLabel(family),
      reporting: Boolean(ops?.reporting),
      nextStep: entry.nextStep,
      attentionCount: (attentionBySlug.get(entry.slug) ?? 0) + inboxOpen
    };
  });

  // Live first, then the ones waiting on something, alphabetical inside a rank.
  const rank: Record<PortfolioUrlStatus, number> = {
    live: 0,
    deployed_awaiting_domain: 1,
    domain_owned_not_serving: 2,
    awaiting_url: 3,
    unknown: 4
  };
  apps.sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));

  // One merged attention list, act-first: the ops queue already carries live
  // findings (unreachable, deploy failing, missing env); credential blockers
  // join it so the owner has ONE list to clear, not two.
  const inboxAttention: DeckAttention[] = apps
    .filter((app) => app.inboxOpen > 0)
    .map((app) => ({
      appName: app.name,
      severity: "act" as const,
      finding: `${app.inboxOpen} open ${app.inboxOpen === 1 ? "request" : "requests"} for help`,
      action: "Read it and reply — someone on this app is waiting.",
      link: `/inbox?app=${encodeURIComponent(app.slug)}`
    }));

  const attention: DeckAttention[] = [
    ...inboxAttention,
    ...opsAttention.map((item: OpsAttentionItem) => ({
      appName: item.appName,
      severity: item.severity === "action_needed" ? ("act" as const) : ("watch" as const),
      finding: item.finding,
      action: item.action,
      link: item.link ?? null
    })),
    ...credentialItems.map((item) => ({
      appName: item.appName,
      severity: item.priority === "blocker" ? ("act" as const) : ("watch" as const),
      finding: item.displayName,
      action: item.action,
      // Credential items are entered/checked on the keys page.
      link: "/integrations"
    }))
  ].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "act" ? -1 : 1));

  const reportingRecords = records.filter((record) => record.reporting && typeof record.stats.users === "number");
  const usersAcrossApps = reportingRecords.length
    ? reportingRecords.reduce((sum, record) => sum + (record.stats.users ?? 0), 0)
    : null;

  const insights = apps
    .flatMap((app) => deriveAppInsights(app, app.inboxOpen))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "challenge" ? -1 : 1));

  const familyCounts = new Map<AppFamilyId, number>();
  for (const app of apps) {
    familyCounts.set(app.family, (familyCounts.get(app.family) ?? 0) + 1);
  }
  const families = (Object.keys(APP_FAMILIES) as AppFamilyId[])
    .filter((id) => (familyCounts.get(id) ?? 0) > 0)
    .map((id) => ({ id, label: APP_FAMILIES[id].label, count: familyCounts.get(id) ?? 0 }));

  return {
    factsAsOf: board.factsAsOf,
    liveCount: board.counts.live,
    totalApps: board.entries.length,
    usersAcrossApps,
    reportingApps: snapshot?.reportingApps ?? 0,
    openTickets: inbox.open + inbox.inProgress,
    attention,
    insights,
    families,
    apps,
    opsCheckedAt: snapshot?.generatedAt ?? null
  };
}
