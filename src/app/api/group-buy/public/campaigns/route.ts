import { corsJson, corsPreflight, groupBuyErrorResponse } from "@/lib/group-buy/http";
import { isGroupBuyConfigured } from "@/lib/group-buy/db";
import { listOpenCampaigns } from "@/lib/group-buy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open group orders any ecosystem app can render. Read-only and PII-free, so it
// is deliberately unauthenticated — a "12 more units and everyone saves 22%"
// card should be as easy to embed as an image.
export async function GET(request: Request) {
  if (!isGroupBuyConfigured()) {
    return corsJson({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  const url = new URL(request.url);
  const groupSlug = url.searchParams.get("group") || undefined;
  const appSlug = url.searchParams.get("app") || undefined;

  try {
    const rows = await listOpenCampaigns({ groupSlug, appSlug });

    return corsJson({
      ok: true,
      campaigns: rows.map(({ campaign, progress }) => ({
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        purchase_mode: campaign.purchase_mode,
        fulfillment: campaign.fulfillment,
        closes_at: campaign.closes_at,
        currency: campaign.currency,
        min_units: campaign.min_units,
        committed_units: progress?.committed_units ?? 0,
        units_remaining: progress?.units_remaining ?? campaign.min_units,
        member_count: progress?.member_count ?? 0,
        percent_to_threshold: progress?.percent_to_threshold ?? 0,
        threshold_met: progress?.threshold_met ?? false,
        savings_cents: progress?.savings_cents ?? 0,
        current_tier_label: progress?.current_tier_label ?? null
      }))
    });
  } catch (error) {
    return groupBuyErrorResponse(error);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
