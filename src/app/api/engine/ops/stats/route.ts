import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { getOpsSnapshot } from "@/lib/engine/ops-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ops stats for the owner dashboard: every managed app with its live counts
// (users, open tickets, recent orders) where the app reports them, honest
// "not reporting yet" where it doesn't, plus the attention findings.
// STRICTLY owner/admin — no local-mode bypass: this route reads env-audit
// results and triggers token-authenticated outbound calls, so a DB-less prod
// deploy (where isLocalMode() is true) must not open it to the public. Local
// dev still works via the development admin mode inside canAccessEngineAdmin.
export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await getOpsSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}

// Force a fresh poll of every reporting app (the dashboard's refresh action).
export async function POST() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await getOpsSnapshot({ refresh: true });
  return NextResponse.json({ ok: true, snapshot });
}
