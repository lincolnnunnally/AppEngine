// Honest labels for money on the Stripe account the desk can read.
// A charge is assigned only when the charge itself says so (metadata,
// description, product name). Leftovers stay "unattributed" — never guessed.
// Paid products live in income-doors.ts so the weekly board and vault scan
// cannot drift apart.

import { INCOME_DOORS, type IncomeStreamId } from "./income-doors.ts";

export type StripeChargeHint = {
  amount: number;
  currency?: string;
  paid?: boolean;
  refunded?: boolean;
  description?: string | null;
  statement_descriptor?: string | null;
  statement_descriptor_suffix?: string | null;
  metadata?: Record<string, string | undefined> | null;
};

export type RevenueStreamId = IncomeStreamId | "unattributed";

export type RevenueStream = {
  id: RevenueStreamId;
  slug: string | null;
  label: string;
  revenue30d: number;
  charges30d: number;
  evidence: string;
};

type StreamDef = {
  id: IncomeStreamId;
  slug: string;
  label: string;
  evidence: string;
};

function uniqueStreamDefs(): StreamDef[] {
  const seen = new Map<IncomeStreamId, StreamDef>();
  for (const door of INCOME_DOORS) {
    if (seen.has(door.streamId)) continue;
    seen.set(door.streamId, {
      id: door.streamId,
      slug: door.slug,
      label: streamLabel(door.streamId),
      evidence: door.evidence
    });
  }
  return [...seen.values()];
}

function streamLabel(id: IncomeStreamId): string {
  if (id === "toner") return "Toner family";
  if (id === "operate") return "Operate / Backoffice";
  if (id === "laser") return "Laser Engrave Market";
  const door = INCOME_DOORS.find((entry) => entry.streamId === id);
  return door?.label || id;
}

const KNOWN = uniqueStreamDefs();

export function listKnownStreams(): Array<{ id: IncomeStreamId; slug: string; label: string }> {
  return KNOWN.map((stream) => ({ id: stream.id, slug: stream.slug, label: stream.label }));
}

export function streamMeta(id: RevenueStreamId): { label: string; slug: string | null } {
  if (id === "unattributed") {
    return { label: "This Stripe account — not labeled", slug: null };
  }
  const known = KNOWN.find((stream) => stream.id === id);
  return { label: known?.label || id, slug: known?.slug || null };
}

export function serviceLabel(charge: StripeChargeHint): string {
  const meta = metaOf(charge);
  const named =
    charge.description?.trim() ||
    [meta.product, meta.plan_type, meta.type, meta.kind, meta.stream].filter(Boolean).join(" · ") ||
    charge.statement_descriptor_suffix?.trim() ||
    charge.statement_descriptor?.trim();
  return named || "Unlabeled charge";
}

function blobOf(charge: StripeChargeHint): string {
  return [
    charge.description,
    charge.statement_descriptor,
    charge.statement_descriptor_suffix,
    charge.metadata?.product,
    charge.metadata?.plan_type,
    charge.metadata?.type
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function metaOf(charge: StripeChargeHint): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(charge.metadata || {})) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

export function classifyCharge(charge: StripeChargeHint): {
  id: RevenueStreamId;
  slug: string | null;
  label: string;
  evidence: string;
} {
  const blob = blobOf(charge);
  const meta = metaOf(charge);
  const slugHint = (meta.app_slug || meta.app || "").trim();
  const hinted = INCOME_DOORS.find((door) => door.slug === slugHint || door.streamId === slugHint);
  if (hinted) {
    const known = streamMeta(hinted.streamId);
    return { id: hinted.streamId, slug: known.slug, label: known.label, evidence: "charge metadata.app_slug" };
  }
  for (const door of INCOME_DOORS) {
    if (door.match(blob, meta)) {
      const known = streamMeta(door.streamId);
      return { id: door.streamId, slug: known.slug, label: known.label, evidence: door.evidence };
    }
  }
  return {
    id: "unattributed",
    slug: null,
    label: "This Stripe account — not labeled",
    evidence: "no product name or app metadata on the charge"
  };
}

export function groupRevenueStreams(charges: StripeChargeHint[]): RevenueStream[] {
  const buckets = new Map<RevenueStreamId, RevenueStream>();
  for (const known of KNOWN) {
    buckets.set(known.id, {
      id: known.id,
      slug: known.slug,
      label: known.label,
      revenue30d: 0,
      charges30d: 0,
      evidence: known.evidence
    });
  }
  buckets.set("unattributed", {
    id: "unattributed",
    slug: null,
    label: "This Stripe account — not labeled",
    revenue30d: 0,
    charges30d: 0,
    evidence: "charges this key can read that do not name an app"
  });

  for (const charge of charges) {
    if (!charge.paid || charge.refunded) continue;
    if ((charge.currency ?? "usd").toLowerCase() !== "usd") continue;
    const classified = classifyCharge(charge);
    const bucket = buckets.get(classified.id);
    if (!bucket) continue;
    bucket.revenue30d += charge.amount;
    bucket.charges30d += 1;
  }

  const labeled = KNOWN.map((known) => buckets.get(known.id)!);
  const leftover = buckets.get("unattributed")!;
  return [...labeled, leftover];
}
