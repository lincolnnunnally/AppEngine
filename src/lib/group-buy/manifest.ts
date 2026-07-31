// The drop-ship manifest — what we actually hand the vendor.
//
// A group order is one purchase order with many destinations. Every real channel
// caps how many addresses ride on a single order group (Amazon Business
// ship-to-multiple is capped at 50 shared addresses), so the manifest is emitted
// as cohorts of at most `addressCap` destinations. Submitting a 180-member
// campaign means four cohorts, not one rejected upload.

import type {
  Campaign,
  DropShipManifest,
  ManifestCohort,
  ManifestDestination,
  Vendor,
  BuyingGroup
} from "./types";

// Amazon Business: "The group must have 50 or fewer addresses."
export const DEFAULT_ADDRESS_CAP = 50;

export const ADDRESS_CAP_BY_VENDOR: Record<string, number> = {
  "amazon-business": 50
};

export function addressCapFor(vendorSlug: string): number {
  return ADDRESS_CAP_BY_VENDOR[vendorSlug] ?? DEFAULT_ADDRESS_CAP;
}

// A member_benefit campaign is a pooled purchase of goods that belong to the
// members, not the organization. The group's sales-tax exemption does not reach
// it. This string travels on the manifest so the vendor's AP desk and ours agree.
export function taxNoteFor(campaign: Pick<Campaign, "purchase_mode" | "tax_note">): string {
  if (campaign.tax_note && campaign.tax_note.trim()) {
    return campaign.tax_note.trim();
  }

  if (campaign.purchase_mode === "member_benefit") {
    return (
      "TAXABLE. Goods are purchased for individual members' own use; the group's " +
      "tax-exempt status does not apply and is not asserted on this order."
    );
  }

  return "Organizational use. Apply the group's exemption certificate only if one is on file with this vendor.";
}

export function chunkDestinations(destinations: ManifestDestination[], cap: number): ManifestCohort[] {
  const size = Math.max(1, cap);
  const cohorts: ManifestCohort[] = [];

  for (let i = 0; i < destinations.length; i += size) {
    const slice = destinations.slice(i, i + size);

    cohorts.push({
      index: cohorts.length + 1,
      destination_count: slice.length,
      unit_count: slice.reduce((sum, d) => sum + d.unit_count, 0),
      subtotal_cents: slice.reduce((sum, d) => sum + d.subtotal_cents, 0),
      destinations: slice
    });
  }

  return cohorts;
}

export function buildManifest(input: {
  poNumber: string;
  campaign: Campaign;
  vendor: Vendor;
  group: BuyingGroup;
  destinations: ManifestDestination[];
  listSubtotalCents: number;
  generatedAt?: string;
}): DropShipManifest {
  const { poNumber, campaign, vendor, group, destinations, listSubtotalCents } = input;

  const cap = addressCapFor(vendor.slug);
  const cohorts = chunkDestinations(destinations, cap);
  const totalUnits = destinations.reduce((sum, d) => sum + d.unit_count, 0);
  const subtotalCents = destinations.reduce((sum, d) => sum + d.subtotal_cents, 0);
  const commissionCents = Math.round((subtotalCents * campaign.commission_bps) / 10000);

  return {
    po_number: poNumber,
    campaign_slug: campaign.slug,
    campaign_title: campaign.title,
    vendor_slug: vendor.slug,
    vendor_name: vendor.name,
    group_slug: group.slug,
    group_name: group.name,
    purchase_mode: campaign.purchase_mode,
    fulfillment: campaign.fulfillment,
    // Never true for member_benefit; the DB refuses it too.
    tax_exemption_asserted: campaign.purchase_mode === "org_use" && group.tax_exempt,
    tax_note: taxNoteFor(campaign),
    generated_at: input.generatedAt || new Date().toISOString(),
    address_cap: cap,
    total_units: totalUnits,
    total_destinations: destinations.length,
    subtotal_cents: subtotalCents,
    list_subtotal_cents: listSubtotalCents,
    savings_cents: Math.max(0, listSubtotalCents - subtotalCents),
    commission_cents: commissionCents,
    cohorts
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One row per member per SKU — the shape every vendor's bulk upload wants.
export function manifestToCsv(manifest: DropShipManifest): string {
  const header = [
    "po_number",
    "cohort",
    "order_id",
    "member_ref",
    "ship_name",
    "ship_line1",
    "ship_line2",
    "ship_city",
    "ship_state",
    "ship_postal_code",
    "ship_country",
    "ship_phone",
    "sku",
    "item_name",
    "qty",
    "unit_price_usd",
    "line_total_usd"
  ];

  const rows: string[][] = [];

  for (const cohort of manifest.cohorts) {
    for (const destination of cohort.destinations) {
      for (const line of destination.lines) {
        rows.push([
          manifest.po_number,
          String(cohort.index),
          destination.order_id,
          destination.member_ref,
          destination.ship_to.name || destination.member_name || "",
          destination.ship_to.line1 || "",
          destination.ship_to.line2 || "",
          destination.ship_to.city || "",
          destination.ship_to.state || "",
          destination.ship_to.postal_code || "",
          destination.ship_to.country || "US",
          destination.ship_to.phone || "",
          line.sku,
          line.name,
          String(line.qty),
          (line.unit_price_cents / 100).toFixed(2),
          ((line.unit_price_cents * line.qty) / 100).toFixed(2)
        ]);
      }
    }
  }

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
