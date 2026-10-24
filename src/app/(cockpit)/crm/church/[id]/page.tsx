import { redirect } from "next/navigation";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { CrmChurchDetail } from "@/components/engine/crm-church-detail";
import { directoryPreviewRows } from "@/lib/engine/crm-directory-core";
import { loadChurchDetail } from "@/lib/engine/crm-directory";
import { crmSavingConfigured } from "@/lib/engine/lpl-crm-write";
import { SIGNAL_STAFF, TECHNICAL_DIRECTOR_TAG } from "@/lib/engine/tech-director-core";
import type { CrmCard } from "@/lib/engine/lpl-crm-core";

export const dynamic = "force-dynamic";

function previewDetail(id: string) {
  const row = directoryPreviewRows().find((item) => item.id === id) ?? directoryPreviewRows()[0];
  const card: CrmCard = {
    key: `preview:${row.id}`,
    name: row.name,
    town: [row.city, row.state].filter(Boolean).join(", "),
    state: row.state,
    kinds: ["org"],
    apps: ["churchconnect"],
    matchedBy: [],
    recordCount: 1,
    touches: [],
    lastOutreach: null,
    lastTouch: null,
    repeat: { level: null, text: "" },
    stops: [],
    possibleMatches: [],
    tokens: [],
    events: [],
    locations: [],
    nextActionDate: null,
    nextActionMovedFrom: null,
    nextAction: "",
    nextStep: "",
    followUpReasons: [],
    recordPaths: { churchconnect: `/super-admin#crm/lead/${row.id}` },
    churchId: row.id,
    leadId: null,
    contacts: [
      {
        id: "preview-contact",
        name: "Jane Doe",
        title: "Director of Media",
        email: "jane@example.org",
        phone: "(478) 555-0142",
        source: "saved",
        tags: [TECHNICAL_DIRECTOR_TAG],
        sourceUrl: "https://example.org/staff",
        status: "contacted"
      }
    ],
    deskDoNotContact: false,
    org: { kind: "church", id: row.id, name: row.name, city: row.city, state: row.state, website: "https://example.org", phone: "(478) 555-0100", email: "office@example.org", offers: ["churchconnect"] },
    signals: [
      {
        id: "preview-signal",
        tag: SIGNAL_STAFF,
        evidenceQuote: "Jane Doe leads media.",
        sourceUrl: "https://example.org/staff",
        signalDate: "2026-04-01",
        score: 80
      }
    ],
    crmStatus: row.crmStatus,
    avlTier: row.tier,
    jevAvlFit: row.jevAvlFit,
    existingAvlTalks: row.existingAvlTalks
  };
  return {
    row,
    card,
    history: [
      { id: "h1", at: "2026-09-12", kind: "visit", what: "Met the pastor and left a brochure." },
      { id: "h2", at: "2026-06-02", kind: "email", what: "Invite sent (sent)" },
      { id: "h3", at: "2026-03-18", kind: "note", what: "Called the office. No answer." }
    ],
    website: "https://example.org",
    phone: "(478) 555-0100",
    email: "office@example.org"
  };
}

export default async function ChurchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  if (!(await canAccessEngineOwner())) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const preview = process.env.NODE_ENV !== "production" && query.preview === "1";
  const detail = preview ? previewDetail(id) : await loadChurchDetail(id);
  const canSave = (await canAccessEngineOwner()) && (await crmSavingConfigured());
  return (
    <main className="shell wide-shell crm-page">
      {detail === "unconfigured" ? (
        <section className="panel">
          <p className="dx-callout dx-callout--alert">This deploy cannot read the church directory yet.</p>
        </section>
      ) : detail === "unread" ? (
        <section className="panel">
          <p className="dx-callout dx-callout--alert">That church couldn&apos;t be read just now. Try again in a minute.</p>
        </section>
      ) : !detail ? (
        <section className="panel">
          <p className="crm-empty">That church isn&apos;t in the directory.</p>
        </section>
      ) : (
        <CrmChurchDetail
          row={detail.row}
          card={detail.card}
          history={detail.history}
          website={detail.website}
          phone={detail.phone}
          email={detail.email}
          canSave={preview ? true : canSave}
          backHref={preview ? "/crm?preview=directory" : "/crm"}
        />
      )}
    </main>
  );
}
