// Data for the public apps.unitedundergod.org showcase — "a unified page that
// displays all our apps and helps people understand the things we offer"
// (owner directive 2026-07-09).
//
// ONE RULE — the roster is NOT hand-written here. It is derived from the two
// existing registries:
//   1. source-of-truth/ecosystem-portfolio-registry.json (owner-verified
//      domains + urlStatus, 24 apps) — read via the existing
//      getPortfolioUrlStatusBoard() in portfolio-url-status.ts.
//   2. The code registry's imported ecosystem records
//      (src/lib/engine/imported-ecosystem-apps.ts, consumed by
//      app-portfolio-registry.ts) — merged in by slug for extra roster entries
//      and freshness notes.
//
// What IS authored here is presentation-only metadata keyed by slug:
//   - a one-line human description condensed faithfully from the owner's
//     ecosystem map (life-produces-life/_SOURCE_OF_TRUTH/01_ECOSYSTEM_MAP.md —
//     each app's Problem/Solution block) or, for apps not in the map, from the
//     registry's own status text. No invented philosophy.
//   - the preferred public URL for live apps: the unitedundergod.org
//     subdomains (owner directive 2026-07-09; each verified serving HTTP 200
//     on 2026-07-09), falling back to the registry's serving URL.
//   - group labels matching the ecosystem map's Group 1–4 structure.
//   - hide reasons for registry entries that the registry itself says are not
//     standalone public products (tenant configs, monorepo modules, content
//     brands, doctrine-gated future apps).
//
// A registry app with no metadata here still shows up (as "coming soon", name
// only) — new roster entries can never be silently dropped by this page.

import { IMPORTED_ECOSYSTEM_APPS } from "@/lib/engine/imported-ecosystem-apps";
import { getPortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";

export type ShowcaseGroup =
  | "Hope & transformation"
  | "Church & community"
  | "Everyday services"
  | "The builder"
  | "The movement";

export type ShowcaseApp = {
  slug: string;
  name: string; // public-facing name (registry name unless a cleaner form exists)
  tagline: string; // one line, condensed from the ecosystem map / registry
  group: ShowcaseGroup;
  liveUrl: string; // "" when not live
  liveHost: string; // display form of liveUrl ("" when not live)
};

export type AppsShowcase = {
  live: ShowcaseApp[];
  comingSoon: ShowcaseApp[];
};

type DisplayMeta = {
  publicName?: string; // outward-facing name when the registry name is internal-flavored
  tagline: string;
  group: ShowcaseGroup;
  liveUrl?: string; // preferred public URL (UUG subdomain directive); overrides registry servingUrl
  hide?: string; // registry-grounded reason this entry is not a public product card
};

// Slug aliases between the JSON registry and the code registry.
const CODE_REGISTRY_SLUG_ALIASES: Record<string, string> = {
  ideas: "ideas-idea-capture"
};

// Presentation metadata per registry slug. Taglines condense the owner's
// ecosystem map (01_ECOSYSTEM_MAP.md) Problem/Solution lines; sources noted
// where they come from elsewhere.
const DISPLAY: Record<string, DisplayMeta> = {
  appengine: {
    publicName: "App Engine",
    tagline:
      "Describe a problem you want solved or a tool you want to build, and App Engine builds you a real, working app for it.",
    group: "The builder",
    liveUrl: "https://www.we-succeed.org"
  },
  "united-under-god": {
    publicName: "United Under God",
    tagline: "The movement home — who we are, and the vision that holds all of this together.",
    group: "The movement",
    liveUrl: "https://www.unitedundergod.org"
  },
  churchconnect: {
    tagline:
      "A church operating platform — communication, events, groups, volunteers, giving, discipleship, and growth in one system.",
    group: "Church & community",
    liveUrl: "https://churchconnect.unitedundergod.org"
  },
  "spark-of-hope": {
    tagline: "Real, living testimony — stories of what God is doing, with daily encouragement for anyone ready to give up.",
    group: "Hope & transformation",
    liveUrl: "https://spark.unitedundergod.org"
  },
  "live-on-mission": {
    tagline: "Small, practical acts of service — local opportunities to put hope into practice.",
    group: "Hope & transformation",
    liveUrl: "https://live-on-mission.com"
  },
  "kids-need-dads": {
    tagline: "Support, mentorship, encouragement, and restoration for fathers — because children need their dads.",
    group: "Hope & transformation",
    liveUrl: "https://dads.unitedundergod.org"
  },
  "easy-peasy-website": {
    publicName: "EasyPeazy",
    tagline: "Domains, hosting, websites, and launch support in one simple package — without the tech overwhelm.",
    group: "Everyday services",
    liveUrl: "https://easypeazy.unitedundergod.org"
  },
  "toner-management": {
    tagline: "Printer monitoring, toner prediction, and ordering — so businesses never run out.",
    group: "Everyday services",
    liveUrl: "https://toner.unitedundergod.org"
  },
  "laser-engrave-market": {
    publicName: "Laser Engrave Market",
    tagline: "Custom laser engraving with design assistance — personalized products, gifts, and business branding.",
    group: "Everyday services",
    liveUrl: "https://laser.unitedundergod.org"
  },
  "kindred-connections": {
    tagline: "Genuine friendships and encouraging groups for people who feel alone — connection that builds you up.",
    group: "Hope & transformation",
    liveUrl: "https://kindred.unitedundergod.org"
  },
  "aligned-souls": {
    // Tagline condenses the owner's mission line in soul-dating-app-spec.md.
    tagline:
      "A companion who helps you become who God designed you to be — found by knowing people deeply, not endless swiping.",
    group: "Hope & transformation",
    liveUrl: "https://alignedsouls.unitedundergod.org"
  },
  opportunity: {
    tagline: "Name the problem, find the opportunity hidden inside it, and take a practical next step.",
    group: "Hope & transformation"
  },
  "best-life": {
    tagline: "Growth pathways across every aspect of life — relational, financial, spiritual, mental, emotional, and physical.",
    group: "Hope & transformation"
  },
  "childfirst-solutions": {
    tagline: "Co-parenting support, mediation, and child-focused decision tools for families in conflict or transition.",
    group: "Hope & transformation",
    liveUrl: "https://childfirst.unitedundergod.org"
  },
  "community-connections": {
    tagline: "A platform for communities to get involved in their own renewal — local tools, events, service, and belonging.",
    group: "Church & community"
  },
  milstead: {
    tagline: "The first demonstration community — where Community Connections comes to life at neighborhood scale.",
    group: "Church & community"
  },
  "snip-show": {
    publicName: "Snip.Show",
    tagline: "AI-assisted clipping, publishing, and monetization support for content creators.",
    group: "Everyday services"
  },
  iconium: {
    // Not in the ecosystem map; line condensed from the registry status text.
    tagline: "Brand kits generated for new ventures — identity and assets to launch with.",
    group: "Everyday services"
  },
  ideas: {
    publicName: "Ideas",
    // Not in the ecosystem map; line condensed from the registry status text.
    tagline: "Capture ideas the moment they arrive and forge them into content.",
    group: "Everyday services"
  },
  // Registry entries that the registry itself marks as not standalone public
  // products — hidden from the outward-facing page, with the registry reason.
  "milstead-church": {
    tagline: "",
    group: "Church & community",
    hide: "ChurchConnect tenant config, not a standalone app (registry blocker)."
  },
  "churchconnect-bridge": {
    tagline: "",
    group: "Church & community",
    hide: "Monorepo integration module with no public surface (registry blocker)."
  },
  "million-mistakes": {
    tagline: "",
    group: "Hope & transformation",
    hide: "Content/principle brand, not a standalone app (registry blocker: no standalone build planned)."
  },
  "printer-protector-monitoring": {
    tagline: "",
    group: "Everyday services",
    hide: "Folds into the Toner Management product family (owner ruling 2026-07-04)."
  },
  "kindred-dating": {
    tagline: "",
    group: "Hope & transformation",
    hide: "Superseded — shipped as its own owner-approved app, Aligned Souls (see the aligned-souls card; live 2026-07-10)."
  },
  honestly: {
    tagline: "",
    group: "Hope & transformation",
    hide: "Module-vs-standalone boundary undecided; registry says DO_NOT_DEPLOY."
  },
  // Code-registry-only slugs whose registry records say they fold into other
  // apps rather than ship standalone.
  association: {
    tagline: "",
    group: "Church & community",
    hide: "Registry decision: fold association-tier features into ChurchConnect (not a separate app)."
  },
  jeepfix: {
    tagline: "",
    group: "Everyday services",
    hide: "Registry decision: becomes a config of the shared troubleshooting engine."
  },
  racketpro: {
    tagline: "",
    group: "Everyday services",
    hide: "Registry decision: becomes a sports config of the shared connection/growth engine."
  }
};

// Groups in display order — people-facing expressions first, infrastructure last,
// mirroring the ecosystem map's Group 1 -> 4 ordering.
export const GROUP_ORDER: ShowcaseGroup[] = [
  "Hope & transformation",
  "Church & community",
  "Everyday services",
  "The builder",
  "The movement"
];

function groupRank(group: ShowcaseGroup): number {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getAppsShowcase(): AppsShowcase {
  const board = getPortfolioUrlStatusBoard();

  const live: ShowcaseApp[] = [];
  const comingSoon: ShowcaseApp[] = [];

  const place = (slug: string, registryName: string, servingUrl: string, urlStatusLive: boolean) => {
    const meta = DISPLAY[slug];
    if (meta?.hide) return;

    // Live = a preferred public URL is directed (owner directive, verified), or
    // the owner registry marks the URL live with a serving address.
    const liveUrl = meta?.liveUrl ?? (urlStatusLive && servingUrl ? servingUrl : "");

    const app: ShowcaseApp = {
      slug,
      name: meta?.publicName ?? registryName,
      // Never fall back to registry status text — that is operator language,
      // not something to show the public. Unknown apps show name-only.
      tagline: meta?.tagline ?? "",
      group: meta?.group ?? "Everyday services",
      liveUrl,
      liveHost: liveUrl ? hostLabel(liveUrl) : ""
    };

    (liveUrl ? live : comingSoon).push(app);
  };

  // Primary roster: the owner-verified JSON registry (domain facts win).
  const jsonSlugs = new Set<string>();
  for (const entry of board.entries) {
    jsonSlugs.add(entry.slug);
    place(entry.slug, entry.appName, entry.servingUrl, entry.status === "live");
  }

  // Union with the code registry's imported records: any slug the JSON registry
  // does not track (directly or via alias) still joins the roster.
  const aliasedJsonSlugs = new Set(
    [...jsonSlugs].map((slug) => CODE_REGISTRY_SLUG_ALIASES[slug] ?? slug)
  );
  for (const record of IMPORTED_ECOSYSTEM_APPS) {
    if (jsonSlugs.has(record.slug) || aliasedJsonSlugs.has(record.slug)) continue;
    const servingUrl = record.productionUrl.startsWith("https://") ? record.productionUrl : "";
    place(record.slug, record.name, servingUrl, record.deploymentState === "production_live" && Boolean(servingUrl));
  }

  const bySection = (a: ShowcaseApp, b: ShowcaseApp) =>
    groupRank(a.group) - groupRank(b.group) || a.name.localeCompare(b.name);
  live.sort(bySection);
  comingSoon.sort(bySection);

  return { live, comingSoon };
}
