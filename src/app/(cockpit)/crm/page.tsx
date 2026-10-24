import { redirect } from "next/navigation";
import { canAccessEngineAdmin, canAccessEngineOwner } from "@/lib/auth/access";
import { loadCrmSnapshot, rememberCrmFollowUpCount } from "@/lib/engine/lpl-crm";
import { CRM_APP_LABEL, DONT_REPEAT_DAYS, DROP_OFF_REST_DAYS, contactsForViewer, orgForViewer, type CrmCard } from "@/lib/engine/lpl-crm-core";
import { SIGNAL_BUILDING, SIGNAL_STAFF, TECHNICAL_DIRECTOR_TAG } from "@/lib/engine/tech-director-core";
import { crmSavingConfigured, savingOffNote } from "@/lib/engine/lpl-crm-write";
import { CrmDesk } from "@/components/engine/crm-desk";
import type { AvProspectState, TopProspectState } from "@/app/(cockpit)/crm/actions";

export const dynamic = "force-dynamic";

function techPreviewCards(): CrmCard[] {
  const grace: CrmCard = {
    key: "preview-tech",
    name: "Grace Chapel",
    town: "Vidalia, GA",
    state: "GA",
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
    recordPaths: { churchconnect: "/super-admin#crm/lead/11111111-1111-4111-8111-111111111111" },
    churchId: "11111111-1111-4111-8111-111111111111",
    leadId: null,
    contacts: [
      {
        id: "td-preview",
        name: "Jane Doe",
        title: "Director of Media",
        email: "jane@gracechapel.example",
        phone: "(912) 555-0148",
        source: "saved",
        tags: [TECHNICAL_DIRECTOR_TAG],
        sourceUrl: "https://gracechapel.example/staff"
      }
    ],
    deskDoNotContact: false,
    org: null,
    signals: [
      {
        id: "sig-preview-staff",
        tag: SIGNAL_STAFF,
        evidenceQuote: "Jane Doe leads media.",
        sourceUrl: "https://gracechapel.example/staff",
        signalDate: "2026-04-01",
        score: 80
      }
    ]
  };
  const palm: CrmCard = {
    ...grace,
    key: "preview-building",
    name: "Palm Chapel",
    town: "Orlando, FL",
    state: "FL",
    churchId: "22222222-2222-4222-8222-222222222222",
    recordPaths: { churchconnect: "/super-admin#crm/lead/22222222-2222-4222-8222-222222222222" },
    contacts: [],
    signals: [
      {
        id: "sig-preview-building",
        tag: SIGNAL_BUILDING,
        evidenceQuote: "The sanctuary is being renovated.",
        sourceUrl: "https://palmchapel.example/build",
        signalDate: "2025-11-01",
        score: 95
      }
    ]
  };
  const river: CrmCard = {
    ...grace,
    key: "preview-staff-low",
    name: "River Church",
    town: "Macon, GA",
    state: "GA",
    churchId: "33333333-3333-4333-8333-333333333333",
    recordPaths: { churchconnect: "/super-admin#crm/lead/33333333-3333-4333-8333-333333333333" },
    contacts: [],
    signals: [
      {
        id: "sig-preview-staff-low",
        tag: SIGNAL_STAFF,
        evidenceQuote: "A media volunteer is listed.",
        sourceUrl: "https://riverchurch.example/staff",
        signalDate: "2026-02-02",
        score: 20
      }
    ]
  };
  return [river, grace, palm];
}

// CRM — owner and admins can view. One card per org or person across
// ChurchConnect, Laser, and Presence, read from the tables those apps already
// keep. Only the owner can save (church visits and contacts, through
// ChurchConnect); admins see names and titles, never emails or phones.
// Nothing on this page sends anything to anyone.
export default async function CrmPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const params = await searchParams;
  const isOwner = await canAccessEngineOwner();
  // Dev preview only, and only for the owner. The non-production guard keeps the fixture out of the production bundle.
  const previewTop = process.env.NODE_ENV !== "production" && isOwner && params.preview === "top";
  const previewAv = process.env.NODE_ENV !== "production" && isOwner && params.preview === "av";
  const previewTech = process.env.NODE_ENV !== "production" && isOwner && params.preview === "tech";
  let topInitial: TopProspectState = null;
  let avInitial: AvProspectState = null;
  if (previewTop) {
    const { rankTopProspects } = await import("@/lib/engine/av-prospects-core");
    const fixture = (await import("../../../../scripts/fixtures/top-prospects-golden.json")).default as {
      now: string;
      tier: 0 | 1 | 2 | 3;
      rows: Array<Record<string, unknown>>;
      suppressions?: { emails?: string[]; domains?: string[]; phones?: string[] };
    };
    const blockedEmails = new Set((fixture.suppressions?.emails ?? []).map((value) => value.trim().toLowerCase()));
    const rows = fixture.rows.map((row) => {
      if (row.id === "stream") return { ...row, church_name: "The Stream" };
      if (row.id === "alpha") return { ...row, website: "https://www.alphabaptist.example" };
      if (row.id === "won-new") return { ...row, crawl_title: "Won New" };
      return row;
    });
    const ranked = rankTopProspects(
      rows,
      (row) => blockedEmails.has(String(row.email ?? "").trim().toLowerCase()),
      { tier: fixture.tier, now: new Date(fixture.now) }
    );
    topInitial = { ok: true, message: "", at: Date.parse(fixture.now), tier: fixture.tier, open: ranked.open, won: ranked.won, counts: ranked.counts };
  }
  if (previewAv) {
    const { rankAvProspects } = await import("@/lib/engine/av-prospects-core");
    const at = Date.parse("2026-10-17T16:00:00Z");
    const ranked = rankAvProspects(
      [
        {
          id: "discovery",
          name: "DISCOVERY CHURCH PROPERTIES INC",
          church_name: "Discovery Church",
          city: "Vidalia",
          state: "GA",
          lat: "32.2177",
          lng: "-82.4135",
          website: "https://discoverchurch.example"
        },
        {
          id: "holy-family",
          name: "United States Catholic Conference",
          city: "Orlando",
          state: "FL",
          lat: "28.5383",
          lng: "-81.3792",
          website: "https://www.holyfamilyorlando.org"
        },
        {
          id: "fbc-vidalia",
          name: "FIRST BAPTIST CHURCH OF VIDALIA INC",
          city: "Vidalia",
          state: "GA",
          lat: "32.22",
          lng: "-82.41",
          facebook_url: "https://facebook.com/fbcvidalia"
        }
      ],
      () => false,
      { now: new Date(at) }
    );
    avInitial = { ok: true, message: "", at, prospects: ranked };
  }
  const canSave = isOwner && (await crmSavingConfigured());
  // Owner-only note when this deploy can't save (an AppEngine preview has no server key).
  const savingOff = isOwner && !canSave ? savingOffNote() : "";
  const snapshot = await loadCrmSnapshot();
  rememberCrmFollowUpCount(snapshot);
  // Admins see names and titles only: strip church contact emails and phones before anything reaches the browser.
  const viewCards = [
    ...(previewTech ? techPreviewCards() : []),
    ...snapshot.cards.map((card) => ({
      ...card,
      contacts: contactsForViewer(card.contacts, isOwner),
      org: orgForViewer(card.org, isOwner),
      signals: isOwner ? card.signals ?? [] : []
    }))
  ];

  const todayRows = snapshot.followUps.filter((row) => row.today).length;
  const waitRows = snapshot.followUps.filter((row) => !row.today).length;
  const resting = snapshot.cards.filter((card) => card.repeat.level === "hold").length;
  const stops = snapshot.cards.filter((card) => card.stops.length > 0).length;
  const multi = snapshot.cards.filter((card) => card.apps.length > 1).length;
  const unreadable = snapshot.sources.filter((source) => !source.ok);
  const asOf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(snapshot.generatedAt));

  return (
    <main className="shell wide-shell crm-page">
      <section className="panel biz-hero">
        <p className="dx-label">People and places</p>
        <h1 className="dx-display">
          Who we have <em>reached</em>, and who is next.
        </h1>
        <p className="dx-lede">
          One card for each church, business lead, place, or person across ChurchConnect, Laser, Presence, and business leads. If any app reached out in the
          last {DONT_REPEAT_DAYS} days ({DROP_OFF_REST_DAYS} after a drop-off), the card says to let it rest.
          {canSave
            ? " You can add a church or business, pick its apps, log a visit or drop-off, and save a contact here; for anything else, open the app that owns the record."
            : " To act, open the app that owns the record."}
        </p>
        {snapshot.configured ? (
          <div className="dx-stat-grid crm-stat-grid">
            <a className={`dx-stat ${todayRows ? "dx-stat--lime" : ""}`} href="#crm-today">
              <strong>{todayRows}</strong>
              <span>follow-ups today</span>
              <p>
                {todayRows === 1 ? "1 church, place, or person" : `${todayRows} churches, places, or people`}
                {waitRows ? ` · ${waitRows} resting` : ""}
              </p>
            </a>
            <a className="dx-stat dx-stat--cyan" href="#crm-cards">
              <strong>{snapshot.cards.length}</strong>
              <span>cards</span>
              <p>{multi} in more than one app</p>
            </a>
            <div className={`dx-stat ${resting ? "dx-stat--purple" : ""}`}>
              <strong>{resting}</strong>
              <span>resting</span>
              <p>reached out recently ({DONT_REPEAT_DAYS} days, {DROP_OFF_REST_DAYS} after a drop-off)</p>
            </div>
            <div className={`dx-stat ${stops ? "dx-stat--pink" : ""}`}>
              <strong>{stops}</strong>
              <span>do not pitch</span>
              <p>do-not-contact, already a customer, or said no</p>
            </div>
            <div className={`dx-stat ${snapshot.presence.notPrinted ? "dx-stat--pink" : ""}`}>
              <strong>
                {snapshot.presence.printed}/{snapshot.presence.tokens}
              </strong>
              <span>
                {snapshot.presence.printed} of {snapshot.presence.tokens} token{snapshot.presence.tokens === 1 ? "" : "s"} printed
              </span>
              <p>
                {snapshot.presence.events} event{snapshot.presence.events === 1 ? "" : "s"} · {snapshot.presence.places} place{snapshot.presence.places === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        ) : null}
        {snapshot.outreachHidden ? (
          <p className="dx-callout dx-callout--alert" role="alert">
            The do-not-contact list could not be read, so no outreach is suggested right now. Only event and token prep is
            listed. Reload in a minute.
          </p>
        ) : null}
        {savingOff ? (
          <p className="dx-callout" role="status">
            {savingOff}
          </p>
        ) : null}
        <p className="dx-note crm-asof">
          As of {asOf} ET. Times are Eastern.
          {unreadable.length ? ` Could not read: ${unreadable.map((source) => source.label.toLowerCase()).join(", ")}.` : ""}
        </p>
      </section>

      {snapshot.configured || previewTop || previewAv || previewTech ? (
        <CrmDesk
          cards={viewCards}
          followUps={snapshot.followUps}
          adminUrls={previewTop || previewAv || previewTech ? { ...snapshot.adminUrls, churchconnect: snapshot.adminUrls.churchconnect || "https://churchconnect.example" } : snapshot.adminUrls}
          canSave={canSave}
          isOwner={isOwner}
          outreachHidden={snapshot.outreachHidden}
          topInitial={topInitial}
          avInitial={avInitial}
          techFirst={previewTech}
        />
      ) : (
        <section className="panel">
          <p className="dx-callout dx-callout--alert">
            This deploy cannot read the shared database yet, so there are no cards to show. Nothing is invented. When the
            database keys are set on this deploy, this page fills in by itself.
          </p>
        </section>
      )}

      {snapshot.configured ? (
        <section className="panel crm-sources" aria-label="Where this comes from">
          <details>
            <summary>Where this comes from</summary>
            <p className="dx-note">
              Read live from each app&apos;s own records. People in timelines appear by first name and last initial. Emails and
              phone numbers are used to match records. A church&apos;s saved contacts show their email and phone to the
              owner only. Tokens count as printed once Presence marks them
              engraved.
            </p>
            <ul className="crm-list">
              {snapshot.sources.map((source) => (
                <li key={source.label}>
                  <span>
                    {source.app === "shared" ? "All apps" : CRM_APP_LABEL[source.app]} · {source.label}
                  </span>
                  <span className={source.ok ? "crm-dim" : "crm-warn-text"}>{source.ok ? `${source.rows} read` : "could not read"}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
    </main>
  );
}
