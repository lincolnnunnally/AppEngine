"use client";

import { useActionState } from "react";
import { loadAvProspectsAction, type AvProspectState } from "@/app/(cockpit)/crm/actions";
import { MESSENGER_AVL_URL } from "@/lib/engine/church-offer-rule";
import { recordLink, type CrmApp, type CrmCard } from "@/lib/engine/lpl-crm-core";

// AV prospects (Messenger AVL kit). OWNER ONLY, read only: churches that may
// want help with sound, video, lighting or streaming, nearest Vidalia first.
// Read on tap, never on page load. Nothing is saved or sent from here.

type Props = {
  cards: CrmCard[];
  adminUrls: Partial<Record<CrmApp, string>>;
  onOpen: (key: string) => void;
};

function safeHref(url: string): string {
  const text = url.trim();
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export function AvProspects({ cards, adminUrls, onOpen }: Props) {
  const [state, action, pending] = useActionState<AvProspectState, FormData>(loadAvProspectsAction, null);
  const prospects = state?.ok ? state.prospects ?? [] : [];
  return (
    <div className="crm-av" data-testid="crm-av-prospects">
      <p className="crm-dim crm-section-note">
        Churches that may want help with sound, video, lighting, or streaming from our partner,{" "}
        <a href={MESSENGER_AVL_URL} target="_blank" rel="noopener noreferrer">
          Messenger AVL
        </a>
        . Lincoln&apos;s territory first: central &amp; South Georgia, then the rest of Georgia, then Florida, then South Carolina; nearest Vidalia first in each. Reasons say only what is on file; a missing link may just mean we don&apos;t have it.
        Nothing is sent from here.
      </p>
      <form action={action}>
        <button type="submit" className="dx-btn dx-btn--primary" disabled={pending}>
          {pending ? "Reading churches…" : state?.ok ? "Read the list again" : "Show the list"}
        </button>
      </form>
      {state && !state.ok ? (
        <p className="crm-form-status crm-warn-text" role="status">
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        prospects.length ? (
          <ol className="crm-follow crm-av-list">
            {prospects.map((item) => {
              const card = cards.find((entry) => entry.churchId === item.churchId);
              const record = card ? null : recordLink("churchconnect", { recordPaths: { churchconnect: `/super-admin#crm/lead/${item.churchId}` } }, adminUrls);
              const site = safeHref(item.website);
              return (
                <li key={item.churchId} className="crm-follow-row" data-testid="crm-av-row">
                  <div className="crm-follow-main">
                    <strong>{item.name}</strong>
                    <span className="crm-dim">
                      {" "}
                      · {item.town ? `${item.town}, ` : ""}
                      {item.miles} mi from Vidalia · {item.tierLabel}
                    </span>
                    <ul className="crm-av-reasons">
                      {item.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="crm-av-actions">
                    {card ? (
                      <button type="button" className="dx-btn crm-follow-open" onClick={() => onOpen(card.key)}>
                        Open card
                      </button>
                    ) : record ? (
                      <a className="dx-btn crm-follow-open" href={record.href} target="_blank" rel="noopener noreferrer">
                        Open in ChurchConnect
                      </a>
                    ) : null}
                    {site ? (
                      <a className="crm-link-btn" href={site} target="_blank" rel="noopener noreferrer nofollow">
                        Their website
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="crm-empty">No churches match right now.</p>
        )
      ) : null}
      {state?.ok ? (
        <p className="crm-dim crm-pad">
          Read {state.read ?? 0} churches with a website or Facebook page on file, tier by tier, until the top {prospects.length} were settled. Central &amp; South
          Georgia means south of 33.25° N (Macon and Milledgeville in; Augusta and Atlanta out). Left out: do-not-contact, lost, merged, churches that already
          stream (a stream link on file), and churches Messenger AVL already shows as its own work. If one record of a church is left out, its copies are too.
        </p>
      ) : null}
    </div>
  );
}
