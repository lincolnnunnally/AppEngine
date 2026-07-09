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

// Where each app's own admin lives, when we KNOW it. Cards only show an Admin
// door when a real URL is recorded here — never a guessed path that may 404.
// Extend as apps grow admin surfaces.
const ADMIN_DOORS: Record<string, string> = {
  appengine: "/admin"
};

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
  reporting: boolean;
  nextStep: string;
  attentionCount: number;
};

export type DeckAttention = {
  appName: string;
  severity: "act" | "watch";
  finding: string;
  action: string;
};

export type OwnerDeck = {
  factsAsOf: string;
  liveCount: number;
  totalApps: number;
  usersAcrossApps: number | null; // sum over reporting apps; null when none report
  reportingApps: number;
  attention: DeckAttention[];
  apps: DeckApp[];
  opsCheckedAt: string | null; // null = ops snapshot unavailable (still honest)
};

function opsRecordFor(entry: PortfolioUrlStatusEntry, records: OpsStatsRecord[]): OpsStatsRecord | undefined {
  const bySlug = records.find((record) => record.slug === entry.slug);
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

  const records = snapshot?.apps ?? [];
  const opsAttention = snapshot?.attention ?? [];

  const attentionBySlug = new Map<string, number>();
  const bump = (slug: string) => attentionBySlug.set(slug, (attentionBySlug.get(slug) ?? 0) + 1);
  for (const item of opsAttention) bump(item.slug);
  for (const item of credentialItems) bump(item.slug);

  const apps: DeckApp[] = board.entries.map((entry) => {
    const ops = opsRecordFor(entry, records);
    return {
      slug: entry.slug,
      name: entry.appName,
      status: entry.status,
      statusLabel: URL_STATUS_LABEL[entry.status],
      url: entry.servingUrl || null,
      domain: entry.intendedDomain,
      adminUrl: ADMIN_DOORS[entry.slug] ?? null,
      users: ops?.stats.users ?? null,
      activeUsers30d: ops?.stats.activeUsers30d ?? null,
      reporting: Boolean(ops?.reporting),
      nextStep: entry.nextStep,
      attentionCount: attentionBySlug.get(entry.slug) ?? 0
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
  const attention: DeckAttention[] = [
    ...opsAttention.map((item: OpsAttentionItem) => ({
      appName: item.appName,
      severity: item.severity === "action_needed" ? ("act" as const) : ("watch" as const),
      finding: item.finding,
      action: item.action
    })),
    ...credentialItems.map((item) => ({
      appName: item.appName,
      severity: item.priority === "blocker" ? ("act" as const) : ("watch" as const),
      finding: item.displayName,
      action: item.action
    }))
  ].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "act" ? -1 : 1));

  const reportingRecords = records.filter((record) => record.reporting && typeof record.stats.users === "number");
  const usersAcrossApps = reportingRecords.length
    ? reportingRecords.reduce((sum, record) => sum + (record.stats.users ?? 0), 0)
    : null;

  return {
    factsAsOf: board.factsAsOf,
    liveCount: board.counts.live,
    totalApps: board.entries.length,
    usersAcrossApps,
    reportingApps: snapshot?.reportingApps ?? 0,
    attention,
    apps,
    opsCheckedAt: snapshot?.generatedAt ?? null
  };
}
