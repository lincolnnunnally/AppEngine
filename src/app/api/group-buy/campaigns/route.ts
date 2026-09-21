import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { GroupBuyDbError, isGroupBuyConfigured } from "@/lib/group-buy/db";
import { OperatorInputError, parseCampaignWrite } from "@/lib/group-buy/operator-input";
import { assertReadyToOpen, createCampaign, ensureGroup, listAllCampaigns, setCampaignStatus } from "@/lib/group-buy/service";

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

  if (!isGroupBuyConfigured()) {
    return NextResponse.json({ ok: false, message: "Group Buy storage is not configured." }, { status: 503 });
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

    const parsed = parseCampaignWrite(body);

    if (parsed.input.open) {
      assertReadyToOpen(parsed.input.minUnits, parsed.input.minSubtotalCents, parsed.input.items);
    }

    if (parsed.newGroup) {
      await ensureGroup(parsed.newGroup);
    }

    const campaign = await createCampaign({
      ...parsed.input,
      createdBy: "cockpit"
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorInputError || error instanceof GroupBuyDbError) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          detail: error instanceof GroupBuyDbError ? error.detail : undefined
        },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : "Could not create the campaign.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
