// The church rule — the ONE list of what may ever be suggested to a church
// from AppEngine (the CRM desk's suggestions, slice 4 recommendations).
//
// Lincoln, Oct 17 2026: churches get exactly these, nothing else:
//   ChurchConnect (its own doors, like the Find a Church directory, count as ChurchConnect),
//   the Easy Peazy church website (through the existing ChurchConnect → Easy Peazy connection),
//   Laser church gifts,
//   Outreach, which points to Live On Mission.
// Never Operate, never toner, never any business tool. For a church this is
// never called "marketing". Unclear whether an org is a church? Treat it as one.
//
// ChurchConnect keeps the same list in backend/utils/church_offer_rule.py for
// its lead-panel pitch helper. Both sides pin this exact list in a test, so a
// change has to be made in both places on purpose. Check this list BEFORE
// asking for suggestions (only offer these) and AFTER (drop anything else).

export const CHURCH_ALLOWED_OFFERS = {
  churchconnect: "ChurchConnect",
  easypeazy: "Easy Peazy church website",
  laser: "Laser church gifts",
  outreach: "Outreach"
} as const;

export type ChurchOffer = keyof typeof CHURCH_ALLOWED_OFFERS;

export const CHURCH_OFFER_IDS = Object.keys(CHURCH_ALLOWED_OFFERS) as ChurchOffer[];

/** Door ids that belong to an allowed product. */
const DOOR_PRODUCT: Record<string, ChurchOffer> = {
  churchconnect: "churchconnect",
  directory: "churchconnect",
  easypeazy: "easypeazy",
  laser: "laser",
  outreach: "outreach"
};

export const OUTREACH_URL = "https://www.churchconnect.cloud/mission";

/** Named only so tests and filters can prove they never reach a church. */
export const NEVER_FOR_CHURCHES: ReadonlySet<string> = new Set([
  "operate", "toner", "neighborly", "leads", "local_leads", "awd", "ai_website_design",
  "spark", "best_life", "live_on_mission", "presence", "group_buy"
]);

const FORBIDDEN_RE = /\bmarket(ing|er|ers)?\b/i;

export function churchProductOf(doorId: unknown): ChurchOffer | "" {
  return DOOR_PRODUCT[String(doorId ?? "").trim().toLowerCase()] ?? "";
}

export function allowedForChurch(doorId: unknown): boolean {
  return churchProductOf(doorId) !== "";
}

export function hasForbiddenChurchWord(text: unknown): boolean {
  return FORBIDDEN_RE.test(String(text ?? ""));
}

/** Keep only allowed offers whose words are safe for a church. */
export function filterChurchOffers<T extends { id: string } | string>(items: readonly T[]): T[] {
  return items.filter((item) => {
    const id = typeof item === "string" ? item : item.id;
    if (!allowedForChurch(id)) return false;
    if (typeof item === "string") return true;
    return !Object.values(item).some((value) => typeof value === "string" && hasForbiddenChurchWord(value));
  });
}
