import { NextResponse } from "next/server";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { resolveTopProspectTier } from "@/lib/engine/av-prospects-core";
import { loadTopProspects } from "@/lib/engine/lpl-crm";

// Owner-only read. Rest of Georgia (tier 1) and any other tier are not on this list.
export async function GET(request: Request) {
  if (!(await canAccessEngineOwner())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const resolved = resolveTopProspectTier(new URL(request.url).searchParams.get("tier"));
  if (!resolved.ok) {
    return NextResponse.json({ detail: resolved.detail }, { status: 422 });
  }
  const list = await loadTopProspects(resolved.tier).catch(() => null);
  if (!list || !list.ok) {
    return NextResponse.json(
      { detail: list?.message || "Churches couldn't be read just now. Try again in a minute." },
      { status: 503 }
    );
  }
  return NextResponse.json({ open: list.open, won: list.won, counts: list.counts });
}
