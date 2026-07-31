import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { GroupBuyDbError, isGroupBuyConfigured } from "@/lib/group-buy/db";
import { createCampaign, listAllCampaigns, setCampaignStatus } from "@/lib/group-buy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Operator access required." }, { status: 403 });
  }

  if (!isGroupBuyConfigured()) {
    return NextResponse.json({ ok: false, message: "Group Buy storage is not configured." }, { status: 503 });
  }

  try {
    const rows = await listAllCampaigns();
    return NextResponse.json({ ok: true, campaigns: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list campaigns.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Operator access required." }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Expected a JSON body." }, { status: 400 });
  }

  try {
    // Status-only transitions (open a draft, close a campaign) share this route.
    if (body.campaign_id && body.status) {
      const campaign = await setCampaignStatus(
        String(body.campaign_id),
        body.status as Parameters<typeof setCampaignStatus>[1],
        "cockpit"
      );

      return NextResponse.json({ ok: true, campaign });
    }

    const campaign = await createCampaign({
      groupSlug: String(body.group || body.group_slug || ""),
      vendorSlug: String(body.vendor || body.vendor_slug || ""),
      slug: String(body.slug || ""),
      title: String(body.title || ""),
      description: typeof body.description === "string" ? body.description : null,
      purchaseMode: body.purchase_mode as never,
      fulfillment: body.fulfillment as never,
      minUnits: Number(body.min_units ?? 0),
      minSubtotalCents: Number(body.min_subtotal_cents ?? 0),
      closesAt: typeof body.closes_at === "string" ? body.closes_at : null,
      commissionBps: Number(body.commission_bps ?? 0),
      appSlug: typeof body.app_slug === "string" ? body.app_slug : null,
      createdBy: "cockpit",
      open: body.open === true,
      tiers: Array.isArray(body.tiers) ? (body.tiers as never) : undefined,
      items: Array.isArray(body.items) ? (body.items as never) : undefined
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof GroupBuyDbError) {
      return NextResponse.json({ ok: false, message: error.message, detail: error.detail }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Could not create the campaign.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
