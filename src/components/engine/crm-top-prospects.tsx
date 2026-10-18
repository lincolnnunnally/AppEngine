"use client";

import { useActionState } from "react";
import { loadTopProspectsAction, type TopProspectState } from "@/app/(cockpit)/crm/actions";
import type { AvTierIndex, TopProspect } from "@/lib/engine/av-prospects-core";
import { recordLink, type CrmApp, type CrmCard } from "@/lib/engine/lpl-crm-core";

// Top prospects. OWNER ONLY, read only: the 25 best ChurchConnect matches in
// one territory tier. Read on tap, never on page load. Nothing is saved or
// sent from here. A row opens the church in ChurchConnect.

type Props = {
  cards: CrmCard[];
  adminUrls: Partial<Record<CrmApp, string>>;
  /** Already-ranked rows for a local preview. The desk omits this and reads on tap. */
  initial?: TopProspectState;
};

// Rest of Georgia stays hidden until those churches are scored.
// Scoring stays on the central/south ZIP3 list. Widening it is Lincoln's call.
const TIERS: Array<{ id: AvTierIndex; label: string }> = [
  { id: 0, label: "Central & South GA" },
  { id: 2, label: "Florida" },
  { id: 3, label: "South Carolina" }
];

function churchHref(churchId: string, adminUrls: Partial<Record<CrmApp, string>>): string {
  const record = recordLink("churchconnect", { recordPaths: { churchconnect: `/super-admin#crm/lead/${churchId}` } }, adminUrls);
  return record?.href || `/super-admin#crm/lead/${churchId}`;
}

function Status({ item }: { item: TopProspect }) {
  return (
    <span className="crm-top-badges">
      <span className={`crm-top-status crm-top-status--${item.status.toLowerCase()}`}>{item.status}</span>
      {item.claimed && item.status !== "Claimed" ? <span className="crm-top-status crm-top-status--claimed">Claimed</span> : null}
    </span>
  );
}

export function TopProspects({ cards: _cards, adminUrls, initial = null }: Props) {
  const [state, action, pending] = useActionState<TopProspectState, FormData>(loadTopProspectsAction, initial);
  const open = state?.ok ? state.open ?? [] : [];
  const won = state?.ok ? state.won ?? [] : [];
  const tier = state?.tier ?? 0;
  const floridaEmpty = state?.ok && tier === 2 && open.length === 0 && won.length === 0;
  const areaEmpty = state?.ok && !floridaEmpty && open.length === 0 && won.length === 0;

  return (
    <div className="crm-top" data-testid="crm-top-prospects">
      <p className="crm-section-note">
        The 25 churches in this area most ready for ChurchConnect. Central and South Georgia first.
        A resting church stays on the list. A church that joins moves to Won, and the next one fills in.
        Nothing is sent from here.
      </p>
      <form action={action} className="crm-top-tiers" role="group" aria-label="Territory">
        {TIERS.map((item) => (
          <button
            key={item.id}
            type="submit"
            name="tier"
            value={item.id}
            className={`dx-chip crm-chip${tier === item.id ? " dx-chip--active" : ""}`}
            aria-pressed={tier === item.id}
            disabled={pending}
          >
            {item.label}
          </button>
        ))}
      </form>
      {state && !state.ok ? (
        <p className="crm-form-status crm-warn-text" role="status">
          {state.message}
        </p>
      ) : null}
      {!state ? <p className="crm-empty">Pick an area to read the list.</p> : null}
      {floridaEmpty ? <p className="crm-empty">No scored churches in Florida yet.</p> : null}
      {areaEmpty ? <p className="crm-empty">No scored churches in this area yet.</p> : null}
      {open.length ? (
        <ol className="crm-top-list">
          {open.map((item) => (
            <li key={item.churchId}>
              <a className="crm-top-row" href={churchHref(item.churchId, adminUrls)} data-testid="crm-top-row">
                <span className="crm-top-rank">{item.rank}</span>
                <span className="crm-top-main">
                  <span className="crm-top-title">
                    <strong className="crm-top-name">{item.commonName || item.name}</strong>
                    <Status item={item} />
                  </span>
                  {item.commonName ? (
                    <span className="crm-legal-name" data-testid="crm-legal-name">
                      {item.name}
                    </span>
                  ) : null}
                  <span className="crm-top-town">{item.town || "Town not on file"}</span>
                  <span className="crm-top-score">
                    {item.score}
                    {item.reason ? ` · ${item.reason}` : ""}
                  </span>
                  {item.restLabel ? <span className="crm-top-rest">{item.restLabel}</span> : null}
                  <span className="crm-top-meta">Last touch: {item.lastTouch || "No touch yet"}</span>
                  <span className="crm-top-meta">Next step: {item.nextStep}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : null}
      {state?.ok && won.length ? (
        <section className="crm-top-won" aria-label="Won">
          <h3 className="crm-top-won-title">Won</h3>
          <ul className="crm-top-won-list">
            {won.map((item) => (
              <li key={item.churchId}>
                <a href={churchHref(item.churchId, adminUrls)}>
                  <span className="crm-top-who">
                    <strong>{item.commonName || item.name}</strong>
                    {item.commonName ? (
                      <span className="crm-legal-name" data-testid="crm-legal-name">
                        {item.name}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.town}</span>
                  <span>{item.wonAt}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {state?.ok && state.counts ? (
        <p className="crm-top-foot">
          {open.length ? `Showing ${open.length} of ${state.counts.ranked}. ` : ""}
          Up to 25 churches, best match first. Anyone who opted out of any of our messages is left off this list. Nothing is sent from here.
        </p>
      ) : null}
    </div>
  );
}
