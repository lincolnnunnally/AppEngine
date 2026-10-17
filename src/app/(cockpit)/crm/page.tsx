import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadCrmSnapshot } from "@/lib/engine/lpl-crm";
import { CRM_APP_LABEL, DONT_REPEAT_DAYS } from "@/lib/engine/lpl-crm-core";
import { CrmDesk } from "@/components/engine/crm-desk";

export const dynamic = "force-dynamic";

// CRM v1 — owner only, read-only. One card per org or person across
// ChurchConnect, Laser, and Presence, read from the tables those apps already
// keep. Nothing on this page sends, saves, or changes anything.
export default async function CrmPage() {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const snapshot = await loadCrmSnapshot();

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
          One card for each church, place, or person across ChurchConnect, Laser, and Presence. If any app reached out in the
          last {DONT_REPEAT_DAYS} days, the card says to let it rest. This page only reads. To act, open the app that owns
          the record.
        </p>
        {snapshot.configured ? (
          <div className="dx-stat-grid">
            <a className={`dx-stat ${snapshot.followUps.length ? "dx-stat--lime" : ""}`} href="#crm-today">
              <strong>{snapshot.followUps.length}</strong>
              <span>follow-ups today</span>
              <p>due, warm, waiting, unpaid, events, tokens</p>
            </a>
            <a className="dx-stat dx-stat--cyan" href="#crm-cards">
              <strong>{snapshot.cards.length}</strong>
              <span>cards</span>
              <p>{multi} in more than one app</p>
            </a>
            <div className={`dx-stat ${resting ? "dx-stat--purple" : ""}`}>
              <strong>{resting}</strong>
              <span>resting</span>
              <p>reached out in the last {DONT_REPEAT_DAYS} days</p>
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
              <span>tokens printed</span>
              <p>
                {snapshot.presence.events} event{snapshot.presence.events === 1 ? "" : "s"} · {snapshot.presence.places} places
              </p>
            </div>
          </div>
        ) : null}
        <p className="dx-note crm-asof">
          As of {asOf} ET. Times are Eastern.
          {unreadable.length ? ` Could not read: ${unreadable.map((source) => source.label.toLowerCase()).join(", ")}.` : ""}
        </p>
      </section>

      {snapshot.configured ? (
        <CrmDesk cards={snapshot.cards} followUps={snapshot.followUps} adminUrls={snapshot.adminUrls} />
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
              Read live from each app&apos;s own records. People appear by first name and last initial. Emails and phone
              numbers are used only to match records and are never shown. Tokens count as printed once Presence marks them
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
