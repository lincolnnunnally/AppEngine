import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isGroupBuyConfigured } from "@/lib/group-buy/db";
import { listVendors } from "@/lib/group-buy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The researched supply side: GPOs that unlock contract pricing, and the
// channels that can actually ship one group order to many member addresses.
export async function GET(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Operator access required." }, { status: 403 });
  }

  if (!isGroupBuyConfigured()) {
    return NextResponse.json({ ok: false, message: "Group Buy storage is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);

  try {
    const vendors = await listVendors({
      dropShipOnly: url.searchParams.get("drop_ship") === "true",
      status: url.searchParams.get("status") || undefined
    });

    return NextResponse.json({ ok: true, vendors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list vendors.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
