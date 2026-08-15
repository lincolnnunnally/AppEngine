// Per-app business dossier — the page behind a command-deck card. Merges
// sources that already exist (deck, ops stats, inbox, catalog). Every
// opportunity and challenge is derived from a real number or a recorded
// fact. Nothing here invents a trend. SERVER ONLY.
import { deriveAppInsights, loadOwnerDeck, type DeckApp, type DeckAttention, type DeckInsight } from "@/lib/engine/owner-deck";
import {
  APP_FAMILIES,
  familyForSlug,
  getAppOpsCatalogEntry,
  resolveAdminDoor,
  siblingsInFamily,
  type AppFamilyId
} from "@/lib/engine/app-ops-catalog";
import { listInboxTickets, type InboxTicket } from "@/lib/engine/ecosystem-inbox";

export type AppDossier = {
  app: DeckApp;
  purpose: string;
  family: AppFamilyId;
  familyLabel: string;
  familyBlurb: string;
  adminNote: string;
  siblings: Array<{ slug: string; name: string }>;
  tickets: InboxTicket[];
  attention: DeckAttention[];
  insights: DeckInsight[];
  helpUrl: string;
};

export async function loadAppDossier(slug: string): Promise<AppDossier | null> {
  const deck = await loadOwnerDeck();
  const app = deck.apps.find((entry) => entry.slug === slug);
  if (!app) return null;

  const catalog = getAppOpsCatalogEntry(slug);
  const family = familyForSlug(slug);
  const tickets = await listInboxTickets({ slug, status: "all", limit: 50 });
  const inboxOpen = tickets.filter((ticket) => ticket.status !== "resolved").length;
  const door = resolveAdminDoor(slug, app.url);
  const siblingSlugs = siblingsInFamily(slug);

  return {
    app,
    purpose: catalog?.purpose || app.nextStep,
    family,
    familyLabel: APP_FAMILIES[family].label,
    familyBlurb: APP_FAMILIES[family].blurb,
    adminNote: door?.note || catalog?.adminNote || "",
    siblings: siblingSlugs
      .map((sibling) => {
        const match = deck.apps.find((entry) => entry.slug === sibling);
        return match ? { slug: match.slug, name: match.name } : null;
      })
      .filter((entry): entry is { slug: string; name: string } => Boolean(entry)),
    tickets,
    attention: deck.attention.filter((item) => item.appName === app.name),
    insights: deriveAppInsights(app, inboxOpen),
    helpUrl: `/help?app=${encodeURIComponent(slug)}`
  };
}
