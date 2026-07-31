// Group Buy — shared types for the ecosystem's collective purchasing spine.
//
// One buying group (a church, neighborhood, club, association) aggregates many
// members' individual orders into a single vendor order, so the group clears a
// bulk threshold nobody could clear alone. The vendor then drop-ships each
// member direct — the group never touches, stores, or reships the goods.

export type VendorKind =
  | "gpo"
  | "distributor"
  | "retailer"
  | "manufacturer"
  | "marketplace"
  | "print_on_demand";

export type VendorStatus = "prospect" | "applied" | "active" | "declined" | "inactive";

export type Vendor = {
  id: string;
  slug: string;
  name: string;
  kind: VendorKind;
  website: string | null;
  join_url: string | null;
  membership_fee_cents: number;
  eligibility: string[];
  categories: string[];
  drop_ship: boolean;
  ships_to_member_addresses: boolean;
  drop_ship_notes: string | null;
  min_order_cents: number | null;
  min_order_units: number | null;
  lead_time_days: number | null;
  discount_summary: string | null;
  status: VendorStatus;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  research_source: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupKind =
  | "church"
  | "neighborhood"
  | "club"
  | "association"
  | "school"
  | "ecosystem"
  | "other";

export type BuyingGroup = {
  id: string;
  slug: string;
  name: string;
  kind: GroupKind;
  app_slug: string | null;
  org_ref: string | null;
  region: string | null;
  contact_email: string | null;
  member_count_estimate: number;
  tax_exempt: boolean;
  tax_exempt_id: string | null;
  status: "active" | "paused" | "closed";
  created_at: string;
  updated_at: string;
};

export type GroupVendorAccount = {
  id: string;
  group_id: string;
  vendor_id: string;
  account_number: string | null;
  account_status: "pending" | "applied" | "active" | "suspended" | "closed";
  ships_to_members: boolean;
  tax_exempt_certificate_on_file: boolean;
  credential_note: string | null;
  applied_at: string | null;
  activated_at: string | null;
  notes: string | null;
};

// org_use  — the organization buys for its own use. Its exemption may apply.
// member_benefit — members buy for themselves and pool only to clear a threshold.
//   ALWAYS taxable to the member. The group's exemption must never be asserted;
//   the DB enforces this (gb_guard_po_tax_exemption).
export type PurchaseMode = "org_use" | "member_benefit";

export type Fulfillment = "drop_ship_member" | "ship_to_group" | "pickup";

export type CampaignStatus =
  | "draft"
  | "open"
  | "threshold_met"
  | "locked"
  | "ordered"
  | "shipped"
  | "closed"
  | "cancelled";

export type Campaign = {
  id: string;
  group_id: string;
  vendor_id: string;
  slug: string;
  title: string;
  description: string | null;
  purchase_mode: PurchaseMode;
  fulfillment: Fulfillment;
  status: CampaignStatus;
  opens_at: string | null;
  closes_at: string | null;
  min_units: number;
  min_subtotal_cents: number;
  max_units: number | null;
  currency: string;
  commission_bps: number;
  member_pays_shipping: boolean;
  tax_note: string | null;
  app_slug: string | null;
  created_by: string | null;
  po_number: string | null;
  cancel_reason: string | null;
  locked_at: string | null;
  ordered_at: string | null;
  shipped_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignTier = {
  id: string;
  campaign_id: string;
  label: string;
  min_units: number;
  min_subtotal_cents: number;
  unit_price_cents: number | null;
  discount_bps: number;
  sort_order: number;
};

export type CampaignItem = {
  id: string;
  campaign_id: string;
  catalog_item_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  unit: string;
  list_price_cents: number;
  unit_price_cents: number;
  max_qty_per_member: number | null;
  sort_order: number;
  is_active: boolean;
};

// Derived, read-only. The single source of truth for "are we there yet".
// Only confirmed/fulfilled orders count — pending is a cart, not a promise.
export type CampaignProgress = {
  campaign_id: string;
  group_id: string;
  vendor_id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  purchase_mode: PurchaseMode;
  fulfillment: Fulfillment;
  min_units: number;
  min_subtotal_cents: number;
  opens_at: string | null;
  closes_at: string | null;
  committed_units: number;
  committed_subtotal_cents: number;
  committed_list_subtotal_cents: number;
  savings_cents: number;
  member_count: number;
  ship_to_count: number;
  percent_to_threshold: number;
  threshold_met: boolean;
  units_remaining: number;
  subtotal_remaining_cents: number;
  current_tier_label: string | null;
  current_tier_unit_price_cents: number | null;
  current_tier_discount_bps: number | null;
};

export type Member = {
  id: string;
  group_id: string;
  app_slug: string;
  external_user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};

export type ShipTo = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
};

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "refunded" | "fulfilled";

export type Order = {
  id: string;
  campaign_id: string;
  member_id: string;
  status: OrderStatus;
  unit_count: number;
  subtotal_cents: number;
  list_subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  ship_to: ShipTo;
  payment_status: "unpaid" | "authorized" | "paid" | "refunded" | "failed";
  payment_ref: string | null;
  carrier: string | null;
  tracking_number: string | null;
  placed_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  campaign_item_id: string | null;
  sku: string;
  name: string;
  qty: number;
  unit_price_cents: number;
  list_price_cents: number;
  line_total_cents: number;
};

export type PurchaseOrder = {
  id: string;
  campaign_id: string;
  vendor_id: string;
  group_vendor_account_id: string | null;
  po_number: string;
  status: "draft" | "submitted" | "confirmed" | "shipped" | "received" | "cancelled";
  total_units: number;
  subtotal_cents: number;
  list_subtotal_cents: number;
  savings_cents: number;
  commission_cents: number;
  ship_to_count: number;
  tax_exemption_asserted: boolean;
  vendor_ref: string | null;
  manifest: DropShipManifest | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
};

// What we hand the vendor: every member's destination and lines, batched into
// cohorts because real channels cap addresses per order group (Amazon Business
// ship-to-multiple is capped at 50 addresses).
export type ManifestLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_cents: number;
};

export type ManifestDestination = {
  order_id: string;
  member_ref: string;
  member_name: string | null;
  ship_to: ShipTo;
  lines: ManifestLine[];
  unit_count: number;
  subtotal_cents: number;
};

export type ManifestCohort = {
  index: number;
  destination_count: number;
  unit_count: number;
  subtotal_cents: number;
  destinations: ManifestDestination[];
};

export type DropShipManifest = {
  po_number: string;
  campaign_slug: string;
  campaign_title: string;
  vendor_slug: string;
  vendor_name: string;
  group_slug: string;
  group_name: string;
  purchase_mode: PurchaseMode;
  fulfillment: Fulfillment;
  tax_exemption_asserted: boolean;
  tax_note: string;
  generated_at: string;
  address_cap: number;
  total_units: number;
  total_destinations: number;
  subtotal_cents: number;
  list_subtotal_cents: number;
  savings_cents: number;
  commission_cents: number;
  cohorts: ManifestCohort[];
};
