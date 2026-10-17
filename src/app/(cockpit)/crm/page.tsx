import { redirect } from "next/navigation";
import { canAccessEngineAdmin, canAccessEngineOwner } from "@/lib/auth/access";
import { loadCrmSnapshot, rememberCrmFollowUpCount } from "@/lib/engine/lpl-crm";
import { CRM_APP_LABEL, DONT_REPEAT_DAYS, DROP_OFF_REST_DAYS, contactsForViewer, orgForViewer } from "@/lib/engine/lpl-crm-core";
import { crmSavingConfigured, savingOffMessage } from "@/lib/engine/lpl-crm-write";
import { CrmDesk } from "@/components/engine/crm-desk";

export const dynamic = "force-dynamic";

// CRM — owner and admins can view. One card per org or person across
// ChurchConnect, Laser, and Presence, read from the tables those apps already
// keep. Only the owner can save (church visits and contacts, through
// ChurchConnect); admins see names and titles, never emails or phones.
// Nothing on this page sends anything to anyone.
export default async function CrmPage() {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const isOwner = await canAccessEngineOwner();
  const canSave = isOwner && (await crmSavingConfigured());
  // Owner-only note when this deploy can't save (an AppEngine preview has no server key).
  const savingOff = isOwner && !canSave ? savingOffMessage() : "";
  const snapshot = await loadCrmSnapshot();
  rememberCrmFollowUpCount(snapshot);
  // Admins see names and titles only: strip church contact emails and phones before anything reaches the browser.
  const viewCards = snapshot.cards.map((card) => ({ ...card, contacts: contactsForViewer(card.contacts, isOwner), org: orgForViewer(card.org, isOwner) }));

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
            ? " You can add a church or business, pick its apps,, and log a visit or drop-off or save a contact on a church or business here; for anything else, open the app that owns the record."
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
            {savingOff} You can look, but orgs, visits, and contacts can&apos;t be saved from here.
          </p>
        ) : null}
        <p className="dx-note crm-asof">
          As of {asOf} ET. Times are Eastern.
          {unreadable.length ? ` Could not read: ${unreadable.map((source) => source.label.toLowerCase()).join(", ")}.` : ""}
        </p>
      </section>

      {snapshot.configured ? (
        <CrmDesk cards={viewCards} followUps={snapshot.followUps} adminUrls={snapshot.adminUrls} canSave={canSave} />
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
