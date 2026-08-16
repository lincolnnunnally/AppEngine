import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { GroupBuyDbError, isGroupBuyConfigured, selectOne } from "@/lib/group-buy/db";
import { readVendorPayout, refreshVendorPayout, startVendorOnboarding } from "@/lib/group-buy/connect";
import { listVendors } from "@/lib/group-buy/service";
import type { Vendor } from "@/lib/group-buy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function payoutPayload(vendor: Vendor) {
  const payout = readVendorPayout(vendor);
  return {
    account_id: payout.accountId,
    charges_enabled: payout.chargesEnabled,
    payouts_enabled: payout.payoutsEnabled,
    details_submitted: payout.detailsSubmitted,
    ready: Boolean(payout.accountId && payout.payoutsEnabled)
  };
}

// The researched supply side: GPOs that unlock contract pricing, and the
// channels that can actually ship one group order to many member addresses.
export async function GET(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return json({ ok: false, message: "Operator access required." }, 403);
  }

  if (!isGroupBuyConfigured()) {
    return json({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  const url = new URL(request.url);

  try {
    const vendors = await listVendors({
      dropShipOnly: url.searchParams.get("drop_ship") === "true",
      status: url.searchParams.get("status") || undefined
    });

    return json({
      ok: true,
      vendors: vendors.map((vendor) => ({ ...vendor, payout: payoutPayload(vendor) }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list vendors.";
    return json({ ok: false, message }, 500);
  }
}

// Start (or resume) Stripe Express onboarding for a catalog vendor.
export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return json({ ok: false, message: "Operator access required." }, 403);
  }

  if (!isGroupBuyConfigured()) {
    return json({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  let body: { vendorId?: unknown; action?: unknown };

  try {
    body = (await request.json()) as { vendorId?: unknown; action?: unknown };
  } catch {
    return json({ ok: false, message: "Expected a JSON body." }, 400);
  }

  const vendorId = String(body.vendorId || "").trim();
  const action = String(body.action || "onboard");

  if (!vendorId) {
    return json({ ok: false, message: "vendorId is required." }, 400);
  }

  const session = await auth();
  const actor = session?.user?.email || "operator";

  try {
    if (action === "refresh") {
      const vendor = await selectOne<Vendor>("gb_vendors", `select=*&id=eq.${vendorId}`);

      if (!vendor) {
        return json({ ok: false, message: "Vendor not found." }, 404);
      }

      const refreshed = await refreshVendorPayout(vendor);
      return json({ ok: true, vendor_id: vendor.id, payout: payoutPayload(refreshed.vendor) });
    }

    const started = await startVendorOnboarding(vendorId, actor);
    return json({ ok: true, url: started.url, payout: started.payout });
  } catch (error) {
    if (error instanceof GroupBuyDbError) {
      return json({ ok: false, message: error.message, detail: error.detail }, error.status);
    }

    const message = error instanceof Error ? error.message : "Could not start vendor payout setup.";
    return json({ ok: false, message }, 502);
  }
}
