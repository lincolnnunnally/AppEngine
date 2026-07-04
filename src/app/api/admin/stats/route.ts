import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSelfOpsStats } from "@/lib/engine/ops-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AppEngine practices the standard it ships: the same token-gated ops stats
// endpoint every generated app carries, reporting the platform's own counts
// (users; builds in the last 30 days as its "orders"). Numbers only, no PII.
// Gated by APP_ENGINE_STATS_TOKEN — unset means the endpoint stays closed.
function tokenMatches(request: Request): boolean {
  const expected = (process.env.APP_ENGINE_STATS_TOKEN || "").trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!tokenMatches(request)) {
    return NextResponse.json({ ok: false, message: "A valid stats token is required." }, { status: 401 });
  }
  const self = await getSelfOpsStats();
  return NextResponse.json({
    ok: true,
    reporting: self.reporting,
    users: self.stats.users,
    ticketsOpen: self.stats.ticketsOpen,
    ordersRecent: self.stats.ordersRecent,
    revenueCentsRecent: self.stats.revenueCentsRecent,
    revenueCurrency: self.stats.revenueCurrency,
    activity: self.stats.activity,
    generatedAt: new Date().toISOString()
  });
}
