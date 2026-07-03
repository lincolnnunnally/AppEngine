import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isLocalMode } from "@/lib/engine/local-mode";
import { getOpsSnapshot } from "@/lib/engine/ops-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ops stats for the owner dashboard: every managed app with its live counts
// (users, open tickets, recent orders) where the app reports them, and an
// honest "not reporting yet" where it doesn't. Owner/admin only — the numbers
// describe Lincoln's business, not the public site.
export async function GET() {
  if (!isLocalMode() && !(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await getOpsSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}

// Force a fresh poll of every reporting app (the dashboard's refresh action).
export async function POST() {
  if (!isLocalMode() && !(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await getOpsSnapshot({ refresh: true });
  return NextResponse.json({ ok: true, snapshot });
}
