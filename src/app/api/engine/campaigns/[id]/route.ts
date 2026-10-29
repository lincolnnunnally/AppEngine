import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { copyProblems } from "@/lib/engine/campaign-builder-core";
import { getCampaign, isCampaignStatus, updateCampaignStatus } from "@/lib/engine/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ ok: false, message: "That campaign is gone." }, { status: 404 });
  return NextResponse.json({ ok: true, campaign, problems: copyProblems(campaign.kit) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = payload?.status;
  if (!isCampaignStatus(status)) {
    return NextResponse.json({ ok: false, message: "Status must be draft, live, paused or done." }, { status: 400 });
  }
  const campaign = await updateCampaignStatus(id, status);
  if (!campaign) return NextResponse.json({ ok: false, message: "That campaign is gone." }, { status: 404 });
  return NextResponse.json({ ok: true, campaign });
}
