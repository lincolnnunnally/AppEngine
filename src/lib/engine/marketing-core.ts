// Marketing at a glance (owner, 2026-11-24: "is the marketing component accessible and usable from my
// dashboards?"). Pure helpers for /marketing: which sites publish from the shared library
// (public.lpl_articles, written by the Ideas app), what went out, what is queued, what was shared to the
// company Facebook Pages (ChurchConnect cc_social_media_posts, church_id platform:churchconnect), and what
// the writing cost (marketing_ai_usage). No database here; lib/engine/marketing.ts reads the rows.

export type MarketingSite = {
  app: string; // lpl_articles.app
  label: string;
  group: "business" | "ministry";
  guides: string; // where its pieces show up
  live: boolean; // the site renders these rows today
};

// Mirrors ideas-app src/lib/lanes.ts (LANES: app, url, live). Keep in step when a lane changes.
export const MARKETING_SITES: MarketingSite[] = [
  { app: "furfriend", label: "FurFriend", group: "business", guides: "https://furfriend.pet/guides", live: false },
  { app: "kidsafe", label: "Kid Safe", group: "business", guides: "https://kidsafe.unitedundergod.org/guides", live: false },
  { app: "laser", label: "Laser Engrave Market", group: "business", guides: "https://laser.engrave.market/guides", live: false },
  { app: "easypeazy", label: "EasyPeazy", group: "business", guides: "https://easypeazy.site/guides", live: false },
  { app: "sanctuary-avl", label: "Sanctuary AVL", group: "business", guides: "https://sanctuaryavl.unitedundergod.org/guides", live: false },
  { app: "commons", label: "Commons", group: "business", guides: "https://commons.unitedundergod.org/guides", live: false },
  { app: "ai-website-design", label: "AI Website Design", group: "business", guides: "https://ai-website.design/guides", live: false },
  { app: "churchconnect", label: "ChurchConnect", group: "ministry", guides: "https://www.churchconnect.cloud/guides", live: true },
  { app: "uug", label: "United Under God", group: "ministry", guides: "https://www.unitedundergod.org/articles", live: true },
  { app: "kids-need-dads", label: "Kids Need Dads", group: "ministry", guides: "https://kidsneeddad.com/articles", live: true },
  { app: "rally", label: "Rally", group: "ministry", guides: "https://rally.unitedundergod.org/articles", live: true },
  { app: "spark-of-hope", label: "Spark of Hope", group: "ministry", guides: "https://spark-of-hope.com/articles", live: false },
  { app: "best-life", label: "Best Life", group: "ministry", guides: "https://bestlife.unitedundergod.org/articles", live: false }
];

export type PieceRow = {
  app: string;
  slug: string;
  title: string;
  status: string;
  source?: string | null;
  publish_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

export type SiteSummary = MarketingSite & {
  published7d: number;
  queued: number;
  demandThisMonth: number;
  next: { title: string; at: string } | null;
  last: { title: string; at: string; url: string } | null;
};

const DAY = 86_400_000;

function time(value: string | null | undefined): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

export function monthStartUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function summarizeSites(rows: PieceRow[], now: Date, sites: MarketingSite[] = MARKETING_SITES): SiteSummary[] {
  const nowMs = now.getTime();
  const monthMs = time(monthStartUtc(now));
  return sites.map((site) => {
    const mine = rows.filter((r) => r.app === site.app);
    const published = mine
      .filter((r) => r.status === "published" && time(r.published_at ?? r.publish_at) <= nowMs)
      .sort((a, b) => time(b.published_at ?? b.publish_at) - time(a.published_at ?? a.publish_at));
    const queued = mine
      .filter((r) => r.status === "scheduled")
      .sort((a, b) => time(a.publish_at) - time(b.publish_at));
    const lastRow = published[0];
    return {
      ...site,
      published7d: published.filter((r) => nowMs - time(r.published_at ?? r.publish_at) <= 7 * DAY).length,
      queued: queued.length,
      demandThisMonth: mine.filter((r) => r.source === "demand" && time(r.created_at) >= monthMs).length,
      next: queued[0] ? { title: queued[0].title, at: String(queued[0].publish_at || "") } : null,
      last: lastRow
        ? { title: lastRow.title, at: String(lastRow.published_at ?? lastRow.publish_at ?? ""), url: `${site.guides}/${lastRow.slug}` }
        : null
    };
  });
}

export type SocialPost = {
  connection_id?: string;
  status?: string;
  source?: string;
  post_url?: string | null;
  content?: string;
  created_at?: string;
  error_message?: string | null;
};

export type PageSummary = {
  page: string;
  published: number;
  scheduled: number;
  failed: number;
  automatic: number; // shared by the library job (source 'library') and actually posted
  latest: { text: string; url: string | null; at: string } | null;
  lastError: string | null;
};

export function summarizeSocial(posts: SocialPost[], pageNames: Record<string, string>): PageSummary[] {
  const byPage = new Map<string, SocialPost[]>();
  for (const p of posts) {
    const name = pageNames[String(p.connection_id || "")] || "Unknown channel";
    byPage.set(name, [...(byPage.get(name) || []), p]);
  }
  return [...byPage.entries()]
    .map(([page, list]) => {
      const sorted = [...list].sort((a, b) => time(b.created_at) - time(a.created_at));
      const latest = sorted.find((p) => p.status === "published");
      const failed = sorted.find((p) => p.status === "failed");
      return {
        page,
        published: list.filter((p) => p.status === "published").length,
        scheduled: list.filter((p) => p.status === "scheduled" || p.status === "publishing").length,
        failed: list.filter((p) => p.status === "failed").length,
        automatic: list.filter((p) => p.source === "library" && p.status === "published").length,
        latest: latest
          ? { text: String(latest.content || "").split("\n")[0].slice(0, 120), url: latest.post_url || null, at: String(latest.created_at || "") }
          : null,
        lastError: failed ? String(failed.error_message || "Failed").slice(0, 200) : null
      };
    })
    .sort((a, b) => a.page.localeCompare(b.page));
}

export type UsageRow = { app: string; input_tokens: number; output_tokens: number };

export function sumUsage(rows: UsageRow[]): { guides: number; inputTokens: number; outputTokens: number } {
  return rows.reduce(
    (acc, r) => ({
      guides: acc.guides + 1,
      inputTokens: acc.inputTokens + (Number(r.input_tokens) || 0),
      outputTokens: acc.outputTokens + (Number(r.output_tokens) || 0)
    }),
    { guides: 0, inputTokens: 0, outputTokens: 0 }
  );
}
