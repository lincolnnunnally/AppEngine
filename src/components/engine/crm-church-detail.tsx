"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setChurchStatusAction, type CrmFormState } from "@/app/(cockpit)/crm/actions";
import { ChurchSignals, PeopleTools, Status } from "@/components/engine/crm-church-tools";
import { SuggestNextStep } from "@/components/engine/crm-suggest";
import { directoryStatusLabel, type DirectoryRow } from "@/lib/engine/crm-directory-core";
import { CRM_CHURCH_STATUSES, type CrmCard } from "@/lib/engine/lpl-crm-core";

type HistoryItem = { id: string; at: string; kind: string; what: string };

function when(value: string): string {
  if (!value) return "";
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value.slice(0, 16);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

function kindLabel(kind: string): string {
  const text = kind.replace(/[_-]+/g, " ").trim();
  if (!text) return "Note";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function CrmChurchDetail({
  row,
  card,
  history,
  website,
  phone,
  email,
  canSave,
  backHref
}: {
  row: DirectoryRow;
  card: CrmCard;
  history: HistoryItem[];
  website: string;
  phone: string;
  email: string;
  canSave: boolean;
  backHref: string;
}) {
  return (
    <article className="crm-card crm-detail" data-testid="crm-church-detail">
      <header className="crm-card-head">
        <div className="crm-card-title">
          <p className="dx-label">Church</p>
          <h1 className="crm-h2">{row.name}</h1>
          <p className="crm-card-sub">
            {[row.city, row.state].filter(Boolean).join(", ") || "Town not recorded"}
            {row.county ? ` · ${row.county}` : ""}
            {row.zip ? ` · ${row.zip}` : ""}
          </p>
        </div>
        <Link className="dx-btn" href={backHref}>
          Back to churches
        </Link>
      </header>
      <dl className="crm-facts">
        <div>
          <dt>Status</dt>
          <dd>{row.statusLabel}</dd>
        </div>
        <div>
          <dt>Lead tier</dt>
          <dd>{row.tierLabel || "—"}</dd>
        </div>
        <div>
          <dt>AVL fit</dt>
          <dd>{row.jevAvlFit === null ? "—" : row.jevAvlFit}</dd>
        </div>
        <div>
          <dt>Last contact</dt>
          <dd>{row.lastContact ? when(row.lastContact) : "Not contacted"}</dd>
        </div>
        {website ? (
          <div>
            <dt>Website</dt>
            <dd>
              <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer">
                {website.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </div>
        ) : null}
        {phone ? (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
            </dd>
          </div>
        ) : null}
        {email ? (
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
        ) : null}
      </dl>
      {canSave ? <StatusForm churchId={row.id} status={row.crmStatus} /> : null}
      <ChurchSignals signals={card.signals ?? []} />
      <PeopleTools card={card} canSave={canSave} />
      <SuggestNextStep card={card} isOwner canSave={canSave} outreachHidden={false} />
      <section className="crm-sub" aria-label="Contact history">
        <h4>Contact history</h4>
        {history.length ? (
          <ol className="crm-follow">
            {history.map((item: HistoryItem) => (
              <li key={item.id} className="crm-follow-row">
                <span className="crm-follow-tag">{when(item.at) || "No date"}</span>
                <div>
                  <p className="crm-follow-name">{kindLabel(item.kind)}</p>
                  <p>{item.what}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="crm-dim">No visits, calls, emails, or notes on file.</p>
        )}
      </section>
    </article>
  );
}

function StatusForm({ churchId, status }: { churchId: string; status: string }) {
  const [state, action, pending] = useActionState<CrmFormState, FormData>(setChurchStatusAction, null);
  return (
    <form action={action} className="crm-form crm-status-form" data-testid="crm-status-form">
      <input type="hidden" name="church_id" value={churchId} />
      <label className="crm-field">
        <span>Change status</span>
        <select name="crm_status" defaultValue={status}>
          <option value="">Not contacted</option>
          {CRM_CHURCH_STATUSES.map((item) => (
            <option value={item} key={item}>
              {directoryStatusLabel(item)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="dx-btn dx-btn--primary" disabled={pending}>
        {pending ? "Saving…" : "Save status"}
      </button>
      <Status state={state} />
    </form>
  );
}
