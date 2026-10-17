"use client";

import { useActionState } from "react";
import { loadAvProspectsAction, type AvProspectState } from "@/app/(cockpit)/crm/actions";
import { avReasonText, type AvProspect } from "@/lib/engine/av-prospects-core";
import { recordLink, type CrmApp, type CrmCard } from "@/lib/engine/lpl-crm-core";

// AV prospects. OWNER ONLY, read only: churches that may
// want help with sound, video, lighting or streaming. Read on tap, never on
// page load. Nothing is saved or sent from here.
//
// The screen shows the tier once, in the subline. It does not explain the
// sort. Central & South Georgia is a Georgia church south of 33.25° N
// (Macon and Milledgeville in; Augusta and Atlanta out). The reader walks
// rings around Vidalia (40/80/160/320/700 mi) and groups copies
// (possible_same_as, same website, same name in the same town): if one
// copy is left out, all are. See av-prospects-core.ts.

type Props = {
  cards: CrmCard[];
  adminUrls: Partial<Record<CrmApp, string>>;
  onOpen: (key: string) => void;
  /** Already-read rows for a local preview. The desk omits this and reads on tap. */
  initial?: AvProspectState;
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

function subline(item: AvProspect): string {
  return [item.town, `${item.miles} mi`, item.tierLabel].filter(Boolean).join(" · ");
}

const OPEN_LABEL = "Open in ChurchConnect";

export function AvProspects({ cards, adminUrls, onOpen, initial = null }: Props) {
  const [state, action, pending] = useActionState<AvProspectState, FormData>(loadAvProspectsAction, initial);
  const prospects = state?.ok ? state.prospects ?? [] : [];
  return (
    <div className="crm-av" data-testid="crm-av-prospects">
      <p className="crm-section-note">
        Churches that may want help with sound, video, lighting, or streaming.
        Your territory first: central and South Georgia, then the rest of Georgia, then Florida, then South Carolina; nearest Vidalia first in each.
        Reasons say only what is on file. Nothing is sent from here.
      </p>
      <form action={action}>
        <button type="submit" className="dx-btn dx-btn--primary crm-av-open" disabled={pending}>
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
              const record = recordLink("churchconnect", { recordPaths: { churchconnect: `/super-admin#crm/lead/${item.churchId}` } }, adminUrls);
              const site = safeHref(item.website);
              return (
                <li key={item.churchId} className="crm-follow-row" data-testid="crm-av-row">
                  <div className="crm-av-main">
                    <strong className="crm-av-name">{item.name}</strong>
                    <span className="crm-av-meta">{subline(item)}</span>
                    <ul className="crm-av-reasons">
                      {item.reasons.map((reason) => {
                        const text = avReasonText(reason, item.tierLabel);
                        return <li key={reason}>{text}</li>;
                      })}
                    </ul>
                  </div>
                  <div className="crm-av-actions">
                    {record ? (
                      <a className="dx-btn crm-av-open" href={record.href} target="_blank" rel="noopener noreferrer">
                        {OPEN_LABEL}
                      </a>
                    ) : card ? (
                      <button type="button" className="dx-btn crm-av-open" onClick={() => onOpen(card.key)}>
                        {OPEN_LABEL}
                      </button>
                    ) : null}
                    {site ? (
                      <a className="crm-link-btn crm-av-open" href={site} target="_blank" rel="noopener noreferrer nofollow">
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
        <p className="crm-av-foot">
          Up to 30 churches with a website or Facebook page, nearest first in each area. Leaves out churches that already stream or asked not to be contacted.
        </p>
      ) : null}
    </div>
  );
}
