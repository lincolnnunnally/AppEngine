"use client";

import { useActionState, useSyncExternalStore } from "react";
import Link from "next/link";
import { setChurchOwnerFieldsAction, setChurchServiceOpportunitiesAction, setChurchStatusAction, type CrmFormState } from "@/app/(cockpit)/crm/actions";
import { ChurchSignals, PeopleTools, Status } from "@/components/engine/crm-church-tools";
import { SuggestNextStep } from "@/components/engine/crm-suggest";
import { buildingStageLabel, directoryStatusLabel, type DirectoryRow } from "@/lib/engine/crm-directory-core";
import { BUILDING_STAGES, BUILDING_STAGE_LABEL, CRM_CHURCH_STATUSES, PROVIDER_TYPES, PROVIDER_TYPE_LABEL, SERVICE_OPPORTUNITY_STATUSES, SERVICE_OPPORTUNITY_STATUS_LABEL, SERVICE_PROVIDER_IDS, SERVICE_PROVIDER_LABEL, churchHoldsAvlWork, type CrmCard, type ServiceProviderId } from "@/lib/engine/lpl-crm-core";

function subscribeWide(onChange: () => void) {
  const media = window.matchMedia("(min-width: 800px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function wideNow() {
  return window.matchMedia("(min-width: 800px)").matches;
}

/** Desktop keeps the note disclosure open so the one input inside it stays on the row. */
function useWideDesk() {
  return useSyncExternalStore(subscribeWide, wideNow, () => false);
}

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
        <div>
          <dt>Building stage</dt>
          <dd>
            {buildingStageLabel(row.buildingStage)}
            {row.buildingStageRecordedAt ? ` · recorded ${when(row.buildingStageRecordedAt)}` : ""}
          </dd>
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
      {canSave ? <OwnerFieldsForm row={row} /> : null}
      {canSave ? <ServiceOpportunitiesForm row={row} /> : <ServiceOpportunitySummary row={row} />}
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

function OwnerFieldsForm({ row }: { row: DirectoryRow }) {
  const [state, action, pending] = useActionState<CrmFormState, FormData>(setChurchOwnerFieldsAction, null);
  return (
    <form action={action} className="crm-form crm-status-form" data-testid="crm-owner-fields">
      <input type="hidden" name="church_id" value={row.id} />
      <p className="crm-dim">Building plans stay separate from contact status and from who serves each service.</p>
      <label className="crm-field">
        <span>Building stage</span>
        <select name="building_stage" defaultValue={row.buildingStage || "none"} aria-label="Building-planning stage">
          {BUILDING_STAGES.map((item) => (
            <option value={item} key={item}>
              {BUILDING_STAGE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="crm-field">
        <span>Stage recorded</span>
        <input name="building_stage_recorded_at" type="date" defaultValue={row.buildingStageRecordedAt} aria-label="Building stage recorded date" />
      </label>
      <button type="submit" className="dx-btn dx-btn--primary" disabled={pending}>
        {pending ? "Saving…" : "Save building stage"}
      </button>
      <Status state={state} />
    </form>
  );
}

function providerSummary(row: DirectoryRow, service: ServiceProviderId): string {
  const item = row.providers[service];
  const type = PROVIDER_TYPE_LABEL[item.providerType];
  if (item.providerType === "vendor") return item.vendorName ? `${type} · ${item.vendorName}` : type;
  if (item.providerType === "other") return item.otherName ? `${type} · ${item.otherName}` : type;
  return type;
}

function ServiceOpportunitySummary({ row }: { row: DirectoryRow }) {
  return (
    <section className="crm-opps" aria-label="Service opportunities">
      <h2 className="crm-h2">Service opportunities</h2>
      <dl className="crm-facts">
        {SERVICE_PROVIDER_IDS.map((service) => {
          const opportunity = service === "av" ? null : row.opportunities[service];
          return (
            <div key={service}>
              <dt>{SERVICE_PROVIDER_LABEL[service]}</dt>
              <dd>
                {opportunity ? SERVICE_OPPORTUNITY_STATUS_LABEL[opportunity.status] : "Provider"}
                {` · ${providerSummary(row, service)}`}
                {opportunity?.note ? ` · ${opportunity.note}` : ""}
                {opportunity?.updatedAt ? ` · updated ${when(opportunity.updatedAt)}` : ""}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function ServiceOpportunitiesForm({ row }: { row: DirectoryRow }) {
  const [state, action, pending] = useActionState<CrmFormState, FormData>(setChurchServiceOpportunitiesAction, null);
  const wide = useWideDesk();
  const avEngaged = churchHoldsAvlWork({
    avlExistingRelationship: row.avlExistingRelationship,
    avlProjectStatus: row.avlProjectStatus,
    serviceProviders: row.providers
  });
  return (
    <form action={action} className="crm-form crm-opps" data-testid="crm-service-opportunities">
      <input type="hidden" name="church_id" value={row.id} />
      <h2 className="crm-h2">Service opportunities</h2>
      <p className="crm-dim">What else this church might need, and who serves it now.</p>
      <div className="crm-opp-scroll">
        <div className="crm-opp-head">
          <span>Service</span>
          <span>Status</span>
          <span>Note</span>
          <span>Provider</span>
          <span>Updated</span>
          <span />
        </div>
        {SERVICE_PROVIDER_IDS.map((service) => {
          const opportunity = service === "av" ? null : row.opportunities[service];
          const provider = row.providers[service];
          const label = SERVICE_PROVIDER_LABEL[service];
          const namedProvider = provider.providerType === "vendor" || provider.providerType === "other";
          const providerName = provider.providerType === "vendor" ? provider.vendorName : provider.providerType === "other" ? provider.otherName : "";
          const typeSelect = (
            <select className="crm-prov-type" name={`prov_${service}_type`} defaultValue={provider.providerType} aria-label={`${label} provider`}>
              {PROVIDER_TYPES.map((type) => (
                <option value={type} key={type}>
                  {PROVIDER_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          );
          return (
            <div className="crm-opp-row" key={service}>
              <span className="crm-opp-name">{label}</span>
              {opportunity ? (
                <select className="crm-opp-status" name={`opp_${service}_status`} defaultValue={opportunity.status} aria-label={`${label} status`}>
                  {SERVICE_OPPORTUNITY_STATUSES.map((status) => (
                    <option value={status} key={status}>
                      {SERVICE_OPPORTUNITY_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="crm-opp-status crm-opp-status-label">{avEngaged ? "AVL engaged" : "—"}</span>
              )}
              {opportunity ? (
                <details className="crm-opp-note" open={wide ? true : undefined}>
                  <summary>Note</summary>
                  <input className="crm-opp-note-input" name={`opp_${service}_note`} defaultValue={opportunity.note} maxLength={500} placeholder="Optional note" aria-label={`${label} note`} />
                </details>
              ) : (
                <span className="crm-opp-note-text">{provider.note || "—"}</span>
              )}
              <div className="crm-opp-provider">
                {namedProvider ? (
                  <span className="crm-prov-summary">
                    {PROVIDER_TYPE_LABEL[provider.providerType]}
                    {providerName ? ` · ${providerName}` : ""}
                  </span>
                ) : (
                  typeSelect
                )}
              </div>
              <span className="crm-opp-updated">{opportunity?.updatedAt ? when(opportunity.updatedAt) : "—"}</span>
              {opportunity ? <input type="hidden" name={`opp_${service}_updated`} value={opportunity.updatedAt} /> : null}
              <details className="crm-opp-details">
                <summary>Details</summary>
                <div className="crm-prov-extra">
                  {namedProvider ? (
                    <label className="crm-prov-field">
                      <span>Provider</span>
                      {typeSelect}
                    </label>
                  ) : null}
                  <label className="crm-prov-field crm-prov-vendor-field">
                    <span>Vendor name</span>
                    <input className="crm-prov-vendor" name={`prov_${service}_vendor`} defaultValue={provider.vendorName} maxLength={200} placeholder="Vendor name" aria-label={`${label} vendor name`} />
                  </label>
                  <label className="crm-prov-field crm-prov-other-field">
                    <span>Who else</span>
                    <input className="crm-prov-other" name={`prov_${service}_other`} defaultValue={provider.otherName} maxLength={200} placeholder="Who else" aria-label={`${label} other provider`} />
                  </label>
                  <label className="crm-prov-field">
                    <span>Weak point</span>
                    <input className="crm-prov-note" name={`prov_${service}_note`} defaultValue={provider.note} maxLength={500} placeholder="Weak point" aria-label="Weak point" />
                  </label>
                  <label className="crm-prov-field">
                    <span>Learned from</span>
                    <input className="crm-prov-learned" name={`prov_${service}_from`} defaultValue={provider.learnedFrom} maxLength={200} placeholder="Learned from" aria-label={`${label} learned from`} />
                  </label>
                  <label className="crm-prov-field">
                    <span>Learned on</span>
                    <input className="crm-prov-learned" name={`prov_${service}_at`} type="date" defaultValue={provider.learnedAt} aria-label={`${label} learned on`} />
                  </label>
                </div>
              </details>
            </div>
          );
        })}
      </div>
      <button type="submit" className="dx-btn dx-btn--primary" disabled={pending}>
        {pending ? "Saving…" : "Save opportunities"}
      </button>
      <Status state={state} />
    </form>
  );
}
