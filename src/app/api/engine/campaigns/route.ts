import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { cleanBrief } from "@/lib/engine/campaign-builder-core";
import { generateCampaign } from "@/lib/engine/campaign-builder";
import { createCampaign, listCampaigns } from "@/lib/engine/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for the optional AI polish; the template alone answers instantly.
export const maxDuration = 120;

export async function GET() {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const campaigns = await listCampaigns(50);
  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, message: "That request was empty." }, { status: 400 });
  }
  const cleaned = cleanBrief(payload.brief);
  if (!cleaned.ok) {
    return NextResponse.json({ ok: false, message: cleaned.errors.join(" "), errors: cleaned.errors }, { status: 400 });
  }
  const generated = await generateCampaign(cleaned.brief, { polish: payload.polish === true });
  const campaign = await createCampaign(cleaned.brief, generated.kit);
  return NextResponse.json({
    ok: true,
    campaign,
    kit: generated.kit,
    problems: generated.problems,
    polishNote: generated.polishNote
  });
}
