// Shared-database fallback for owner ops stats. Many ecosystem apps already
// live on the LPL Supabase (owner ruling 2026-07-04). When an app has not
// adopted GET /api/admin/stats yet, the command deck still reads COUNTS from
// the tables we know are real — never invented numbers, never PII. A missing
// table is null, not zero. SERVER ONLY.

type AppOpsStats = {
  users: number | null;
  ticketsOpen: number | null;
  ordersRecent: number | null;
  activeUsers30d: number | null;
  newUsers7d: number | null;
  newUsersPrev7d: number | null;
};

type LplConfig = { url: string; serviceKey: string };

function getLplConfig(): LplConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function lplOpsConfigured(): boolean {
  return getLplConfig() !== null;
}

async function countRows(
  table: string,
  query = "select=id",
  schema = "public"
): Promise<number | null> {
  const config = getLplConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}&limit=0`, {
      method: "GET",
      headers: {
        apikey: config.serviceKey,
        authorization: `Bearer ${config.serviceKey}`,
        prefer: "count=exact",
        "accept-profile": schema
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const range = response.headers.get("content-range") || "";
    const total = range.split("/")[1];
    if (total === undefined || total === "*") return null;
    const n = Number(total);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function empty(): AppOpsStats {
  return {
    users: null,
    ticketsOpen: null,
    ordersRecent: null,
    activeUsers30d: null,
    newUsers7d: null,
    newUsersPrev7d: null
  };
}

type Source = {
  users?: { table: string; schema?: string };
  newUsers?: { table: string; created: string; schema?: string };
  tickets?: { table: string; openQuery: string; schema?: string };
  orders?: { table: string; recentQuery: string; schema?: string };
};

// Only tables we have seen in this workspace's migrations. Do not guess.
const SOURCES: Record<string, Source> = {
  "live-on-mission": {
    users: { table: "lom_user_profiles" },
    newUsers: { table: "lom_user_profiles", created: "created_at" },
    tickets: { table: "lom_admin_ops_reports", openQuery: "select=id&status=eq.open" }
  },
  "kindred-connections": {
    users: { table: "kindred_profiles" },
    newUsers: { table: "kindred_profiles", created: "created_at" }
  },
  "aligned-souls": {
    users: { table: "as_profiles" },
    newUsers: { table: "as_profiles", created: "created_at" }
  },
  neighborly: {
    users: { table: "neighbors", schema: "neighborly" },
    newUsers: { table: "neighbors", created: "created_at", schema: "neighborly" }
  },
  "kids-need-dads": {
    users: { table: "knd_user_profiles" },
    newUsers: { table: "knd_user_profiles", created: "created_at" },
    orders: { table: "knd_donations", recentQuery: "select=id&created_at=gte." }
  },
  "childfirst-solutions": {
    users: { table: "childfirst_members" },
    newUsers: { table: "childfirst_members", created: "created_at" }
  },
  furfriend: {
    users: { table: "ff_profiles" },
    newUsers: { table: "ff_profiles", created: "created_at" }
  },
  dreamstand: {
    users: { table: "dstand_profiles" },
    newUsers: { table: "dstand_profiles", created: "created_at" }
  },
  sandlot: {
    users: { table: "swaparound_profiles" },
    newUsers: { table: "swaparound_profiles", created: "created_at" }
  },
  immerse: {
    tickets: { table: "immerse_stay_requests", openQuery: "select=id" }
  },
  presence: {
    tickets: { table: "presence_join_requests", openQuery: "select=id&status=eq.pending" }
  },
  "united-under-god": {
    users: { table: "uug_interest" },
    newUsers: { table: "uug_interest", created: "created_at" }
  },
  churchconnect: {
    users: { table: "cc_people" },
    newUsers: { table: "cc_people", created: "created_at" }
  }
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export async function readLplOpsStats(slug: string): Promise<{ reporting: boolean; stats: AppOpsStats; note: string } | null> {
  const source = SOURCES[slug];
  if (!source || !lplOpsConfigured()) return null;

  const stats = empty();
  if (source.users) {
    stats.users = await countRows(source.users.table, "select=id", source.users.schema);
  }
  if (source.newUsers) {
    const col = source.newUsers.created;
    stats.newUsers7d = await countRows(
      source.newUsers.table,
      `select=id&${col}=gte.${isoDaysAgo(7)}`,
      source.newUsers.schema
    );
    stats.newUsersPrev7d = await countRows(
      source.newUsers.table,
      `select=id&${col}=gte.${isoDaysAgo(14)}&${col}=lt.${isoDaysAgo(7)}`,
      source.newUsers.schema
    );
  }
  if (source.tickets) {
    stats.ticketsOpen = await countRows(source.tickets.table, source.tickets.openQuery, source.tickets.schema);
  }
  if (source.orders) {
    stats.ordersRecent = await countRows(
      source.orders.table,
      `${source.orders.recentQuery}${isoDaysAgo(30)}`,
      source.orders.schema
    );
  }

  const any = Object.values(stats).some((value) => typeof value === "number");
  if (!any) return null;
  return {
    reporting: true,
    stats,
    note: "From the shared database — the app's own stats endpoint is not wired yet."
  };
}

export function lplKnownSlugs(): string[] {
  return Object.keys(SOURCES);
}
