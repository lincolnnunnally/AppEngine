// Operator-desk payloads for the existing Group Buy tables.
// Pure parsing so the cockpit and /api/group-buy/* agree before anything is written.

import {
  FULFILLMENTS,
  GROUP_KINDS,
  PURCHASE_MODES,
  VENDOR_KINDS,
  VENDOR_STATUSES,
  type Fulfillment,
  type GroupKind,
  type PurchaseMode,
  type VendorKind,
  type VendorStatus
} from "./types.ts";

export class OperatorInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "OperatorInputError";
  }
}

const STRIPE_NOTE = /<!--gb-stripe:[\s\S]*?-->/;

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// Keep an existing slug intact, including underscores. Free text still becomes a slug.
export function asSlug(value: string): string {
  const raw = value.trim().toLowerCase();

  if (!raw) {
    return "";
  }

  if (/^[a-z0-9][a-z0-9_-]*$/.test(raw)) {
    return raw.slice(0, 64);
  }

  return slugify(raw);
}

export function dollarsToCents(value: unknown, label: string): number {
  const raw =
    typeof value === "number"
      ? String(value)
      : String(value ?? "")
          .trim()
          .replace(/^\$/, "")
          .replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new OperatorInputError(`${label} must be a dollar amount like 12.50.`);
  }

  const [whole, frac = ""] = raw.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function notesForOperator(notes: string | null | undefined): string {
  return (notes || "").replace(new RegExp(STRIPE_NOTE.source, "g"), "").trim();
}

export function mergeVendorNotes(existing: string | null | undefined, next: string | null | undefined): string | null {
  const marker = (existing || "").match(STRIPE_NOTE)?.[0] || "";
  const body = notesForOperator(next);

  if (!marker) {
    return body || null;
  }

  return body ? `${body}\n\n${marker}` : marker;
}

export type VendorSaveInput = {
  id?: string;
  slug: string;
  name: string;
  kind: VendorKind;
  website: string | null;
  join_url: string | null;
  membership_fee_cents: number;
  eligibility: string[];
  ships_to_member_addresses: boolean;
  discount_summary: string | null;
  min_order_units: number | null;
  status: VendorStatus;
  contact_email: string | null;
  notes: string | null;
};

export type ParsedCampaignItem = {
  sku: string;
  name: string;
  description?: string | null;
  unit?: string;
  list_price_cents: number;
  unit_price_cents: number;
  max_qty_per_member?: number | null;
};

export type ParsedCampaignWrite = {
  newGroup: { slug: string; name: string; kind: GroupKind } | null;
  input: {
    groupSlug: string;
    vendorSlug: string;
    slug: string;
    title: string;
    description: string | null;
    purchaseMode: PurchaseMode;
    fulfillment: Fulfillment;
    minUnits: number;
    minSubtotalCents: number;
    closesAt: string | null;
    commissionBps: number;
    appSlug: string | null;
    open: boolean;
    items: ParsedCampaignItem[];
    tiers?: Array<{ label: string; min_units: number; unit_price_cents?: number | null; discount_bps?: number }>;
  };
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function optionalText(value: unknown): string | null {
  const raw = text(value);
  return raw || null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string, fallback: T): T {
  const raw = text(value);

  if (!raw) {
    return fallback;
  }

  if ((allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }

  throw new OperatorInputError(`${label} must be one of: ${allowed.join(", ")}.`);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => text(entry)).filter(Boolean);
  }

  return text(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function flag(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function wholeNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  const raw = text(value);

  if (!/^\d+$/.test(raw)) {
    throw new OperatorInputError(`${label} must be a whole number.`);
  }

  return Number(raw);
}

function optionalUrl(value: unknown, label: string): string | null {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withScheme);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("bad protocol");
    }

    return url.toString();
  } catch {
    throw new OperatorInputError(`${label} needs to be a web address.`);
  }
}

function optionalEmail(value: unknown): string | null {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    throw new OperatorInputError("Contact email needs to look like a real email address.");
  }

  return raw;
}

function moneyCents(source: Record<string, unknown>, centsKey: string, dollarsKey: string, label: string, fallback?: number): number {
  const cents = source[centsKey];

  if (cents !== undefined && cents !== null && cents !== "") {
    const parsed = wholeNumber(cents, label);

    if (parsed === null) {
      throw new OperatorInputError(`${label} must be a whole number of cents.`);
    }

    return parsed;
  }

  const dollars = source[dollarsKey];

  if (dollars !== undefined && dollars !== null && dollars !== "") {
    return dollarsToCents(dollars, label);
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new OperatorInputError(`${label} is required.`);
}

function optionalIso(value: unknown): string | null {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new OperatorInputError("Close date is not a real date.");
  }

  return date.toISOString();
}

function commissionBps(body: Record<string, unknown>): number {
  if (body.commission_bps !== undefined && body.commission_bps !== null && body.commission_bps !== "") {
    const parsed = wholeNumber(body.commission_bps, "Commission");

    if (parsed === null || parsed > 10000) {
      throw new OperatorInputError("Commission basis points must be a whole number from 0 to 10000.");
    }

    return parsed;
  }

  const raw = text(body.commission_percent);

  if (!raw) {
    return 0;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new OperatorInputError("Commission percent must look like 2.5.");
  }

  const bps = Math.round(Number(raw) * 100);

  if (bps > 10000) {
    throw new OperatorInputError("Commission percent cannot be more than 100.");
  }

  return bps;
}

function parseItem(raw: unknown, index: number): ParsedCampaignItem | null {
  if (!raw || typeof raw !== "object") {
    throw new OperatorInputError(`SKU row ${index + 1} is not an item.`);
  }

  const row = raw as Record<string, unknown>;
  const sku = text(row.sku);
  const name = text(row.name);
  const listBlank = row.list_price_cents === undefined || row.list_price_cents === null || row.list_price_cents === "";
  const listDollarsBlank = row.list_price === undefined || row.list_price === null || row.list_price === "";
  const unitBlank = row.unit_price_cents === undefined || row.unit_price_cents === null || row.unit_price_cents === "";
  const unitDollarsBlank = row.unit_price === undefined || row.unit_price === null || row.unit_price === "";

  if (!sku && !name && listBlank && listDollarsBlank && unitBlank && unitDollarsBlank) {
    return null;
  }

  if (!sku || !name) {
    throw new OperatorInputError(`SKU row ${index + 1} needs both a SKU and a name.`);
  }

  const list = moneyCents(row, "list_price_cents", "list_price", `List price for ${sku}`);
  const unit = moneyCents(row, "unit_price_cents", "unit_price", `Group price for ${sku}`, list);

  return {
    sku,
    name,
    description: optionalText(row.description),
    unit: text(row.unit) || "each",
    list_price_cents: list,
    unit_price_cents: unit,
    max_qty_per_member: wholeNumber(row.max_qty_per_member, `Max quantity for ${sku}`)
  };
}

export function parseVendorSave(body: Record<string, unknown>): VendorSaveInput {
  const name = text(body.name).slice(0, 200);

  if (!name) {
    throw new OperatorInputError("A vendor needs a name.");
  }

  const explicitSlug = text(body.slug);
  const slug = explicitSlug ? asSlug(explicitSlug) : slugify(name);

  if (!slug) {
    throw new OperatorInputError("A vendor needs a name that can become a slug.");
  }

  const id = text(body.id || body.vendorId);

  return {
    id: id || undefined,
    slug,
    name,
    kind: oneOf(body.kind, VENDOR_KINDS, "Vendor kind", "distributor"),
    website: optionalUrl(body.website, "Website"),
    join_url: optionalUrl(body.join_url, "Join link"),
    membership_fee_cents: moneyCents(body, "membership_fee_cents", "membership_fee", "Membership fee", 0),
    eligibility: stringList(body.eligibility),
    ships_to_member_addresses: flag(body.ships_to_member_addresses),
    discount_summary: optionalText(body.discount_summary),
    min_order_units: wholeNumber(body.min_order_units, "Minimum units"),
    status: oneOf(body.status, VENDOR_STATUSES, "Vendor status", "prospect"),
    contact_email: optionalEmail(body.contact_email),
    notes: optionalText(body.notes)
  };
}

export function parseCampaignWrite(body: Record<string, unknown>): ParsedCampaignWrite {
  const title = text(body.title).slice(0, 200);

  if (!title) {
    throw new OperatorInputError("A campaign needs a title.");
  }

  const explicitSlug = text(body.slug);
  const slug = explicitSlug ? asSlug(explicitSlug) : slugify(title);

  if (!slug) {
    throw new OperatorInputError("A campaign needs a title that can become a slug.");
  }

  const vendorSlug = asSlug(text(body.vendor || body.vendor_slug));

  if (!vendorSlug) {
    throw new OperatorInputError("Choose the vendor this campaign buys from.");
  }

  const selectedGroup = asSlug(text(body.group || body.group_slug));
  const newName = text(body.group_name).slice(0, 200);
  let newGroup: ParsedCampaignWrite["newGroup"] = null;
  let groupSlug = selectedGroup;

  if (!groupSlug) {
    if (!newName) {
      throw new OperatorInputError("Choose a buying group, or name a new one for these orders to pool into.");
    }

    const explicitGroupSlug = text(body.new_group_slug);
    const newSlug = explicitGroupSlug ? asSlug(explicitGroupSlug) : slugify(newName);

    if (!newSlug) {
      throw new OperatorInputError("The buying group needs a name.");
    }

    newGroup = {
      slug: newSlug,
      name: newName,
      kind: oneOf(body.group_kind, GROUP_KINDS, "Buying group kind", "other")
    };
    groupSlug = newSlug;
  }

  const items = (Array.isArray(body.items) ? body.items : [])
    .map((item, index) => parseItem(item, index))
    .filter((item): item is ParsedCampaignItem => item !== null);

  const tiers = Array.isArray(body.tiers)
    ? body.tiers.map((tier, index) => {
        if (!tier || typeof tier !== "object") {
          throw new OperatorInputError(`Tier ${index + 1} is not a tier.`);
        }

        const row = tier as Record<string, unknown>;
        const label = text(row.label);

        if (!label) {
          throw new OperatorInputError(`Tier ${index + 1} needs a label.`);
        }

        return {
          label,
          min_units: wholeNumber(row.min_units, `Tier ${index + 1} units`) ?? 0,
          unit_price_cents:
            row.unit_price_cents === undefined || row.unit_price_cents === null || row.unit_price_cents === ""
              ? null
              : wholeNumber(row.unit_price_cents, `Tier ${index + 1} price`),
          discount_bps: wholeNumber(row.discount_bps, `Tier ${index + 1} discount`) ?? 0
        };
      })
    : undefined;

  return {
    newGroup,
    input: {
      groupSlug,
      vendorSlug,
      slug,
      title,
      description: optionalText(body.description),
      purchaseMode: oneOf(body.purchase_mode, PURCHASE_MODES, "Purchase mode", "member_benefit"),
      fulfillment: oneOf(body.fulfillment, FULFILLMENTS, "Fulfillment", "drop_ship_member"),
      minUnits: wholeNumber(body.min_units, "Unit threshold") ?? 0,
      minSubtotalCents: moneyCents(body, "min_subtotal_cents", "min_subtotal", "Dollar threshold", 0),
      closesAt: optionalIso(body.closes_at),
      commissionBps: commissionBps(body),
      appSlug: optionalText(body.app_slug),
      open: flag(body.open),
      items,
      tiers
    }
  };
}
