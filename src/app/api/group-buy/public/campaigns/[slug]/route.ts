import { corsJson, corsPreflight, groupBuyErrorResponse } from "@/lib/group-buy/http";
import { isGroupBuyConfigured } from "@/lib/group-buy/db";
import { getCampaignDetail } from "@/lib/group-buy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One campaign: what's for sale, at what price, how far the group has got, and
// the tax posture. Everything a satellite app needs to render a buy sheet.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isGroupBuyConfigured()) {
    return corsJson({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  const { slug } = await params;

  try {
    const detail = await getCampaignDetail(slug);

    if (!detail) {
      return corsJson({ ok: false, message: `No campaign named "${slug}".` }, 404);
    }

    const { campaign, progress, items, tiers, vendor, group, tax_note } = detail;

    return corsJson({
      ok: true,
      campaign: {
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        purchase_mode: campaign.purchase_mode,
        fulfillment: campaign.fulfillment,
        opens_at: campaign.opens_at,
        closes_at: campaign.closes_at,
        min_units: campaign.min_units,
        currency: campaign.currency,
        member_pays_shipping: campaign.member_pays_shipping,
        // Set on every response so no app can render a member_benefit buy sheet
        // that implies the group's exemption covers the member.
        tax_note
      },
      group: group ? { slug: group.slug, name: group.name, kind: group.kind } : null,
      vendor: vendor
        ? { slug: vendor.slug, name: vendor.name, kind: vendor.kind, lead_time_days: vendor.lead_time_days }
        : null,
      progress: progress
        ? {
            committed_units: progress.committed_units,
            units_remaining: progress.units_remaining,
            member_count: progress.member_count,
            percent_to_threshold: progress.percent_to_threshold,
            threshold_met: progress.threshold_met,
            savings_cents: progress.savings_cents,
            current_tier_label: progress.current_tier_label
          }
        : null,
      items: items.map((item) => ({
        sku: item.sku,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        unit: item.unit,
        list_price_cents: item.list_price_cents,
        unit_price_cents: item.unit_price_cents,
        max_qty_per_member: item.max_qty_per_member
      })),
      tiers: tiers.map((tier) => ({
        label: tier.label,
        min_units: tier.min_units,
        unit_price_cents: tier.unit_price_cents,
        discount_bps: tier.discount_bps
      }))
    });
  } catch (error) {
    return groupBuyErrorResponse(error);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
