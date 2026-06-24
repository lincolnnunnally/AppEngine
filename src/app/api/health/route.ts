import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Trivial internal health endpoint — the single artifact for the Lane 1
// loop-to-live proof. Public, read-only, no product logic: returns {status:"ok"}.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
