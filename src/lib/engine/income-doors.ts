// Money-taking doors the owner desk must actually try to read.
// Not every ecosystem app bills. These do, or are about to (Rally lessons).
// Vault slots, stream labels, and the weekly mix all derive from this list
// so a new paid product is not forgotten on the $1,000/week board.

export type IncomeStreamId =
  | "churchconnect"
  | "easypeazy"
  | "ai-website-design"
  | "laser"
  | "toner"
  | "appengine"
  | "rally"
  | "operate"
  | "furfriend"
  | "kids-need-dads"
  | "united-under-god"
  | "iconium"
  | "dreamstand";

export type IncomeDoor = {
  streamId: IncomeStreamId;
  slug: string;
  label: string;
  vaultLabel: string;
  keys: string[];
  /** Always on the weekly mix even at $0 labeled. */
  primary: boolean;
  evidence: string;
  match: (blob: string, meta: Record<string, string>) => boolean;
  href: string;
};

export const INCOME_DOORS: IncomeDoor[] = [
  {
    streamId: "churchconnect",
    slug: "churchconnect",
    label: "ChurchConnect Pro",
    vaultLabel: "ChurchConnect",
    keys: ["STRIPE_SECRET_KEY"],
    primary: true,
    evidence: "description or metadata names ChurchConnect / Ministry Pro",
    match: (blob, meta) =>
      meta.app_slug === "churchconnect" ||
      meta.app === "churchconnect" ||
      /churchconnect|ministry pro/.test(blob),
    href: "https://www.churchconnect.cloud/for-churches"
  },
  {
    streamId: "easypeazy",
    slug: "easy-peasy-website",
    label: "EasyPeazy",
    vaultLabel: "EasyPeazy",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
    primary: true,
    evidence: "Easy Peazy product name, or domain/email/hosting metadata",
    match: (blob, meta) =>
      meta.app_slug === "easy-peasy-website" ||
      meta.app === "easypeazy" ||
      /easy\s*peazy|easy\s*peasy/.test(blob),
    href: "/apps/easy-peasy-website"
  },
  {
    streamId: "ai-website-design",
    slug: "ai-website-design",
    label: "AI Website Design",
    vaultLabel: "AI Website Design",
    keys: ["STRIPE_SECRET_KEY"],
    primary: true,
    evidence: "AI Website Design product or app metadata",
    match: (blob, meta) =>
      meta.app_slug === "ai-website-design" ||
      meta.app === "ai-website-design" ||
      /ai website design/.test(blob),
    href: "/apps/ai-website-design"
  },
  {
    streamId: "laser",
    slug: "laser-engrave-market",
    label: "Laser Engrave Market",
    vaultLabel: "Laser",
    keys: ["STRIPE_API_KEY", "STRIPE_SECRET_KEY"],
    primary: true,
    evidence: "Order description plus order_id, or laser metadata",
    match: (blob, meta) =>
      meta.app_slug === "laser-engrave-market" ||
      meta.app === "laser" ||
      /laser(\s*engrave|\.engrave\.market|\.unitedundergod)/.test(blob) ||
      (Boolean(meta.order_id || meta.order_number) && /^order\s/i.test(blob)),
    href: "https://laser.engrave.market"
  },
  {
    streamId: "toner",
    slug: "toner-management",
    label: "Toner Management",
    vaultLabel: "Toner Management",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
    primary: true,
    evidence: "toner / monitoring / coordination on the charge",
    match: (blob, meta) =>
      meta.app_slug === "toner-management" ||
      meta.app === "toner-management" ||
      /toner\.management|toner-management|printer protector|coordination fee|total toner|\btoner\b/.test(blob),
    href: "https://toner.management"
  },
  {
    streamId: "toner",
    slug: "toner-connect",
    label: "Toner Connect",
    vaultLabel: "Toner Connect",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
    primary: true,
    evidence: "Toner Connect / tonerconnect.io on the charge",
    match: (blob, meta) =>
      meta.app_slug === "toner-connect" ||
      meta.app === "toner-connect" ||
      /toner\s*connect|tonerconnect/.test(blob),
    href: "https://tonerconnect.io"
  },
  {
    streamId: "appengine",
    slug: "appengine",
    label: "App Engine",
    vaultLabel: "App Engine",
    keys: ["STRIPE_SECRET_KEY"],
    primary: true,
    evidence: "We Succeed credits, or credit_cents metadata",
    match: (blob, meta) =>
      meta.app_slug === "appengine" ||
      Boolean(meta.credit_cents) ||
      /we succeed credits|app engine credits/.test(blob),
    href: "/apps/appengine"
  },
  {
    streamId: "rally",
    slug: "rally",
    label: "Rally coaching",
    vaultLabel: "Rally",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
    primary: true,
    evidence: "Rally / tennis / pickleball lesson on the charge",
    match: (blob, meta) =>
      meta.app_slug === "rally" ||
      meta.app === "rally" ||
      /rally|pickleball|tennis (lesson|coach|court)/.test(blob),
    href: "https://rally.unitedundergod.org"
  },
  {
    streamId: "operate",
    slug: "operate",
    label: "Operate",
    vaultLabel: "Operate",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
    primary: true,
    evidence: "Operate desk / shop packaging on the charge",
    match: (blob, meta) =>
      meta.app_slug === "operate" ||
      meta.app === "operate" ||
      /\boperate\b/.test(blob),
    href: "https://operate.unitedundergod.org"
  },
  {
    streamId: "operate",
    slug: "backoffice",
    label: "Backoffice.works",
    vaultLabel: "Backoffice",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
    primary: true,
    evidence: "backoffice.works on the charge — product direction still open",
    match: (blob, meta) =>
      meta.app_slug === "backoffice" ||
      meta.app === "backoffice" ||
      /backoffice\.works|\bbackoffice\b/.test(blob),
    href: "https://backoffice.works"
  },
  {
    streamId: "furfriend",
    slug: "furfriend",
    label: "FurFriend",
    vaultLabel: "FurFriend",
    keys: ["STRIPE_SECRET_KEY"],
    primary: false,
    evidence: "FurFriend / pet sitting on the charge",
    match: (blob, meta) =>
      meta.app_slug === "furfriend" ||
      meta.app === "furfriend" ||
      /furfriend|pet sitt/.test(blob),
    href: "/apps/furfriend"
  },
  {
    streamId: "kids-need-dads",
    slug: "kids-need-dads",
    label: "Kids Need Dads",
    vaultLabel: "Kids Need Dads",
    keys: ["STRIPE_SECRET_KEY"],
    primary: false,
    evidence: "donation / Brotherhood / Kids Need Dads on the charge",
    match: (blob, meta) =>
      meta.app_slug === "kids-need-dads" ||
      /kids need dads|brotherhood fund|knd_/.test(blob),
    href: "/apps/kids-need-dads"
  },
  {
    streamId: "united-under-god",
    slug: "united-under-god",
    label: "United Under God gifts",
    vaultLabel: "United Under God",
    keys: ["STRIPE_SECRET_KEY"],
    primary: false,
    evidence: "unitedundergod.org/give or UUG donation metadata",
    match: (blob, meta) =>
      meta.app_slug === "united-under-god" ||
      meta.app === "united-under-god" ||
      /united under god|uug give|uug gift/.test(blob),
    href: "/apps/united-under-god"
  },
  {
    streamId: "iconium",
    slug: "iconium",
    label: "Iconium",
    vaultLabel: "Iconium",
    keys: ["STRIPE_SECRET_KEY"],
    primary: false,
    evidence: "Iconium / logo product on the charge",
    match: (blob, meta) =>
      meta.app_slug === "iconium" ||
      meta.app === "iconium" ||
      /\biconium\b/.test(blob),
    href: "/apps/iconium"
  },
  {
    streamId: "dreamstand",
    slug: "dreamstand",
    label: "Dreamstand",
    vaultLabel: "Dreamstand",
    keys: ["STRIPE_SECRET_KEY"],
    primary: false,
    evidence: "Dreamstand on the charge",
    match: (blob, meta) =>
      meta.app_slug === "dreamstand" ||
      meta.app === "dreamstand" ||
      /\bdreamstand\b/.test(blob),
    href: "/apps/dreamstand"
  }
];

export function primaryMixStreamIds(): IncomeStreamId[] {
  return [...new Set(INCOME_DOORS.filter((door) => door.primary).map((door) => door.streamId))];
}

export function vaultSlotsFromIncomeDoors(): Array<{
  sourceId: string;
  label: string;
  livesAt: string;
  slug: string;
  keys: string[];
}> {
  return INCOME_DOORS.map((door) => ({
    sourceId: `vault-${door.slug}`,
    label: `Vault — ${door.vaultLabel}`,
    livesAt: `Owner vault · ${door.slug}`,
    slug: door.slug,
    keys: door.keys
  }));
}
