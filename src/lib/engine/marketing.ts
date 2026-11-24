// Server reads for /marketing (owner, 2026-11-24). Uses the same LPL connection as the other owner
// reports (lib/engine/lpl-ops-stats.ts getLplConfig: service key, server only). Titles and counts only;
// no reader data. A read that fails is reported as not connected, never as zero. SERVER ONLY.
import { estimateLlmCostUsd } from "@/lib/engine/llm-usage";
import { getLplConfig } from "@/lib/engine/lpl-ops-stats";
import {
  MARKETING_SITES,
  monthStartUtc,
  summarizeResults,
  summarizeSites,
  summarizeSocial,
  type GuideResult,
  type GuideResultRow,
  type SiteResults,
  sumUsage,
  type PageSummary,
  type PieceRow,
  type SiteSummary,
  type SocialPost,
  type UsageRow
} from "@/lib/engine/marketing-core";

export type MarketingReport =
  | {
      state: "ok";
      sites: SiteSummary[];
      pages: PageSummary[] | null; // null = posts table not readable
      usage: { guides: number; inputTokens: number; outputTokens: number; estimatedUsd: number } | null;
      results: { bySite: SiteResults[]; top: GuideResult[] } | null; // null = results could not be read
    }
  | { state: "not_connected"; reason: string };

async function rest<T>(table: string, query: string): Promise<T[] | null> {
  const config = getLplConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers: { apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    return (await response.json()) as T[];
  } catch {
    return null;
  }
}

async function guideResults(days: number): Promise<GuideResultRow[] | null> {
  const config = getLplConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/marketing_guide_results`, {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        authorization: `Bearer ${config.serviceKey}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({ p_days: days }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return Array.isArray(data) ? (data as GuideResultRow[]) : null;
  } catch {
    return null;
  }
}

export async function loadMarketing(now = new Date()): Promise<MarketingReport> {
  if (!getLplConfig()) return { state: "not_connected", reason: "The shared database key is not set on this desk." };
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const since7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const apps = MARKETING_SITES.map((s) => s.app).join(",");
  const [pieces, posts, connections, usage, results] = await Promise.all([
    rest<PieceRow>(
      "lpl_articles",
      `select=app,slug,title,status,source,publish_at,published_at,created_at&app=in.(${apps})` +
        `&or=(status.eq.scheduled,published_at.gte.${since30},created_at.gte.${monthStartUtc(now)})&order=publish_at.asc&limit=3000`
    ),
    rest<{ doc: SocialPost }>("cc_social_media_posts", `select=doc&doc->>church_id=eq.platform:churchconnect&created_at=gte.${since7}&limit=500`),
    rest<{ doc: { id?: string; account_name?: string; platform?: string } }>(
      "cc_social_media_connections",
      "select=doc&doc->>church_id=eq.platform:churchconnect&limit=50"
    ),
    rest<UsageRow>("marketing_ai_usage", `select=app,input_tokens,output_tokens&created_at=gte.${monthStartUtc(now)}&limit=5000`),
    guideResults(30)
  ]);
  if (!pieces) return { state: "not_connected", reason: "The shared library could not be read." };
  // The window above keeps counts small; a site whose last piece is older than 30 days still shows it.
  const nowIso = now.toISOString();
  const latest = await Promise.all(
    MARKETING_SITES.map((s) =>
      rest<PieceRow>(
        "lpl_articles",
        `select=app,slug,title,status,source,publish_at,published_at,created_at&app=eq.${s.app}&status=eq.published` +
          `&or=(published_at.lte.${nowIso},and(published_at.is.null,publish_at.lte.${nowIso}))&order=published_at.desc.nullslast,publish_at.desc&limit=1`
      )
    )
  );
  const seen = new Set(pieces.map((r) => `${r.app}/${r.slug}`));
  for (const row of latest.flat()) {
    if (row && !seen.has(`${row.app}/${row.slug}`)) pieces.push(row);
  }
  const names: Record<string, string> = {};
  for (const c of connections || []) {
    if (c.doc?.id) names[c.doc.id] = `${c.doc.account_name || "Channel"} (${c.doc.platform || "?"})`;
  }
  const total = usage ? sumUsage(usage) : null;
  return {
    state: "ok",
    sites: summarizeSites(pieces, now),
    pages: posts ? summarizeSocial(posts.map((p) => p.doc || {}), names) : null,
    usage: total ? { ...total, estimatedUsd: estimateLlmCostUsd(total.inputTokens, total.outputTokens) } : null,
    results: results ? summarizeResults(results) : null
  };
}
