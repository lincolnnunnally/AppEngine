// Honest labels for money on the Stripe account the desk can read.
// A charge is assigned only when the charge itself says so (metadata,
// description, product name). Leftovers stay "unattributed" — never guessed.

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

export type RevenueStreamId =
  | "churchconnect"
  | "easypeazy"
  | "appengine"
  | "laser"
  | "kids-need-dads"
  | "united-under-god"
  | "toner"
  | "ai-website-design"
  | "unattributed";

export type RevenueStream = {
  id: RevenueStreamId;
  slug: string | null;
  label: string;
  revenue30d: number;
  charges30d: number;
  evidence: string;
};

const KNOWN: Array<{
  id: Exclude<RevenueStreamId, "unattributed">;
  slug: string;
  label: string;
  evidence: string;
  match: (blob: string, meta: Record<string, string>) => boolean;
}> = [
  {
    id: "churchconnect",
    slug: "churchconnect",
    label: "ChurchConnect Pro",
    evidence: "description or metadata names ChurchConnect / Ministry Pro",
    match: (blob, meta) =>
      meta.app_slug === "churchconnect" ||
      meta.app === "churchconnect" ||
      /churchconnect|ministry pro/.test(blob)
  },
  {
    id: "easypeazy",
    slug: "easy-peasy-website",
    label: "EasyPeazy",
    evidence: "Easy Peazy product name, or domain/email/hosting metadata",
    match: (blob, meta) =>
      meta.app_slug === "easy-peasy-website" ||
      meta.app === "easypeazy" ||
      /easy\s*peazy|easy\s*peasy/.test(blob)
  },
  {
    id: "appengine",
    slug: "appengine",
    label: "App Engine credits",
    evidence: "We Succeed credits, or credit_cents metadata",
    match: (blob, meta) =>
      meta.app_slug === "appengine" ||
      Boolean(meta.credit_cents) ||
      /we succeed credits|app engine credits/.test(blob)
  },
  {
    id: "laser",
    slug: "laser-engrave-market",
    label: "Laser Engrave Market",
    evidence: "Order description plus order_id, or laser metadata",
    match: (blob, meta) =>
      meta.app_slug === "laser-engrave-market" ||
      meta.app === "laser" ||
      (Boolean(meta.order_id || meta.order_number) && /^order\s/i.test(blob))
  },
  {
    id: "kids-need-dads",
    slug: "kids-need-dads",
    label: "Kids Need Dads",
    evidence: "donation / Brotherhood / Kids Need Dads on the charge",
    match: (blob, meta) =>
      meta.app_slug === "kids-need-dads" ||
      /kids need dads|brotherhood fund|knd_/.test(blob)
  },
  {
    id: "united-under-god",
    slug: "united-under-god",
    label: "United Under God gifts",
    evidence: "unitedundergod.org/give or UUG donation metadata",
    match: (blob, meta) =>
      meta.app_slug === "united-under-god" ||
      meta.app === "united-under-god" ||
      /united under god|uug give|uug gift/.test(blob)
  },
  {
    id: "toner",
    slug: "toner-management",
    label: "Toner family",
    evidence: "toner / monitoring / coordination on the charge",
    match: (blob, meta) =>
      meta.app_slug === "toner-management" ||
      meta.app === "toner-management" ||
      /toner|printer protector|coordination fee/.test(blob)
  },
  {
    id: "ai-website-design",
    slug: "ai-website-design",
    label: "AI Website Design",
    evidence: "AI Website Design product or app metadata",
    match: (blob, meta) =>
      meta.app_slug === "ai-website-design" ||
      meta.app === "ai-website-design" ||
      /ai website design/.test(blob)
  }
];

export function listKnownStreams(): Array<{ id: Exclude<RevenueStreamId, "unattributed">; slug: string; label: string }> {
  return KNOWN.map((stream) => ({ id: stream.id, slug: stream.slug, label: stream.label }));
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
  const hinted = KNOWN.find((stream) => stream.slug === slugHint || stream.id === slugHint);
  if (hinted) {
    return { id: hinted.id, slug: hinted.slug, label: hinted.label, evidence: "charge metadata.app_slug" };
  }
  for (const stream of KNOWN) {
    if (stream.match(blob, meta)) {
      return { id: stream.id, slug: stream.slug, label: stream.label, evidence: stream.evidence };
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
