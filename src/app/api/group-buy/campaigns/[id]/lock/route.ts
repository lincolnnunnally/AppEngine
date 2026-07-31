import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { GroupBuyDbError } from "@/lib/group-buy/db";
import { generatePurchaseOrder, lockCampaign } from "@/lib/group-buy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Locking is the irreversible moment: the group stops taking orders and commits
// to the vendor. Everyone is repriced to the tier the whole group earned (never
// upward), then the drop-ship purchase order is generated in the same call — a
// locked campaign with no PO would be a group that promised and never ordered.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Operator access required." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const locked = await lockCampaign(id, "cockpit");
    const { purchaseOrder, manifest } = await generatePurchaseOrder(id, "cockpit");

    return NextResponse.json({
      ok: true,
      campaign: { id: locked.campaign.id, slug: locked.campaign.slug, status: locked.campaign.status },
      repriced_lines: locked.repriced,
      final_tier: locked.tier?.label ?? null,
      purchase_order: {
        po_number: purchaseOrder.po_number,
        total_units: purchaseOrder.total_units,
        subtotal_cents: purchaseOrder.subtotal_cents,
        savings_cents: purchaseOrder.savings_cents,
        commission_cents: purchaseOrder.commission_cents,
        ship_to_count: purchaseOrder.ship_to_count,
        tax_exemption_asserted: purchaseOrder.tax_exemption_asserted,
        cohorts: manifest.cohorts.length,
        address_cap: manifest.address_cap
      }
    });
  } catch (error) {
    if (error instanceof GroupBuyDbError) {
      return NextResponse.json({ ok: false, message: error.message, detail: error.detail }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Lock failed.";
    return NextResponse.json({ ok: false, message }, { status: 409 });
  }
}
