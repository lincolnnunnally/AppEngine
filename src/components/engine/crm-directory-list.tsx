import Link from "next/link";
import { buildingStageLabel, directoryHref, directoryStatusLabel, type DirectoryQuery, type ProviderReportRow } from "@/lib/engine/crm-directory-core";
import type { DirectoryPage } from "@/lib/engine/crm-directory";
import { BUILDING_STAGES, BUILDING_STAGE_LABEL, CRM_CHURCH_STATUSES, PROVIDER_TYPES, PROVIDER_TYPE_LABEL, SERVICE_OPPORTUNITY_FILTER_LABEL, SERVICE_OPPORTUNITY_IDS, SERVICE_OPPORTUNITY_STATUSES, SERVICE_OPPORTUNITY_STATUS_LABEL, SERVICE_PROVIDER_IDS, SERVICE_PROVIDER_LABEL } from "@/lib/engine/lpl-crm-core";
import { AVL_TIER_LABEL, AVL_TIER_NOTE, type AvlTier } from "@/lib/engine/tech-director-core";

const TIERS: AvlTier[] = ["top", "second", "other_services", "staff_only"];

function day(value: string): string {
  if (!value) return "—";
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value.slice(0, 16);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

function moreFilterCount(query: DirectoryQuery): number {
  let count = 0;
  if (query.county.trim()) count += 1;
  if (query.stage) count += 1;
  if (query.opportunity) count += 1;
  if (query.provider) count += 1;
  if (query.vendor.trim()) count += 1;
  if (query.servedByOther) count += 1;
  if (query.opening) count += 1;
  if (query.tier) count += 1;
  if (query.fitMin !== null) count += 1;
  if (query.contacted) count += 1;
  if (query.contactedOn) count += 1;
  if (query.staff) count += 1;
  return count;
}

export function CrmDirectoryList({
  query,
  page,
  preview,
  providerReport = [],
  providerReportOk = true
}: {
  query: DirectoryQuery;
  page: DirectoryPage;
  preview: string;
  providerReport?: ProviderReportRow[];
  providerReportOk?: boolean;
}) {
  const back = directoryHref(query, "", preview);
  const hiddenFilters = moreFilterCount(query);
  return (
    <section className="panel" id="crm-directory" aria-labelledby="crm-directory-title">
      <div className="crm-section-head">
        <div>
          <p className="dx-label">Church directory</p>
          <h2 id="crm-directory-title" className="crm-h2">
            Every church <span className="crm-count crm-count--lg">{page.rows.length}</span>
          </h2>
          <p className="crm-dim crm-section-note">One page at a time, from the church directory. A church with no status shows as not contacted.</p>
        </div>
      </div>
      <form action="/crm" method="get" className="crm-dir-filters">
        {preview ? <input type="hidden" name="preview" value={preview} /> : null}
        <div className="crm-dir-primary">
          <label>
            <span>Search</span>
            <input name="q" defaultValue={query.q} placeholder="e.g. Atlanta or 31061" aria-label="Search by name, city, or ZIP" />
          </label>
          <label>
            <span>State</span>
            <input name="state" defaultValue={query.state} placeholder="e.g. GA" maxLength={20} aria-label="State" />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue={query.status} aria-label="CRM status">
              <option value="">Any status</option>
              <option value="not_contacted">Not contacted</option>
              {CRM_CHURCH_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {directoryStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="dx-btn dx-btn--primary">
            Show churches
          </button>
        </div>
        <details className="crm-more-filters">
          <summary>More filters ({hiddenFilters})</summary>
          <div className="crm-dir-more">
            <label>
              <span>County or region</span>
              <input name="county" defaultValue={query.county} placeholder="e.g. Fulton" aria-label="County or region" />
            </label>
            <label>
              <span>Building stage</span>
              <select name="stage" defaultValue={query.stage} aria-label="Building-planning stage">
                <option value="">Any stage</option>
                {BUILDING_STAGES.map((stage) => (
                  <option value={stage} key={stage}>
                    {BUILDING_STAGE_LABEL[stage]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Opportunity</span>
              <select name="opp" defaultValue={query.opportunity} aria-label="Service opportunity">
                <option value="">Any opportunity</option>
                {SERVICE_OPPORTUNITY_IDS.flatMap((service) =>
                  SERVICE_OPPORTUNITY_STATUSES.map((status) => (
                    <option value={`${service}:${status}`} key={`${service}:${status}`}>
                      {SERVICE_OPPORTUNITY_FILTER_LABEL[service]}: {SERVICE_OPPORTUNITY_STATUS_LABEL[status].toLowerCase()}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              <span>Lead tier</span>
              <select name="tier" defaultValue={query.tier} aria-label="Lead tier">
                <option value="">Any tier</option>
                {TIERS.map((tier) => (
                  <option value={tier} key={tier}>
                    {AVL_TIER_LABEL[tier]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>AVL fit at least</span>
              <select name="fit" defaultValue={query.fitMin === null ? "" : String(query.fitMin)} aria-label="AVL fit">
                <option value="">Any</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
            <label>
              <span>Last contact</span>
              <select name="contacted" defaultValue={query.contacted} aria-label="Last contact">
                <option value="">Any</option>
                <option value="never">Never</option>
                <option value="since">Since</option>
                <option value="before">Before</option>
              </select>
            </label>
            <label>
              <span>Contact date</span>
              <input name="on" type="date" defaultValue={query.contactedOn} aria-label="Contact date" />
            </label>
            <label className="crm-dir-check">
              <input type="checkbox" name="staff" value="1" defaultChecked={query.staff} />
              <span>Has a staff contact</span>
            </label>
            <label>
              <span>Provider</span>
              <select name="provider" defaultValue={query.provider} aria-label="Provider type">
                <option value="">Any provider</option>
                {SERVICE_PROVIDER_IDS.flatMap((service) =>
                  PROVIDER_TYPES.map((type) => (
                    <option value={`${service}:${type}`} key={`${service}:${type}`}>
                      {SERVICE_PROVIDER_LABEL[service]}: {PROVIDER_TYPE_LABEL[type].toLowerCase()}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              <span>On vendor</span>
              <input name="vendor" defaultValue={query.vendor} placeholder="e.g. a vendor name" aria-label="Vendor name" />
            </label>
            <label>
              <span>Served by someone else</span>
              <select name="other" defaultValue={query.servedByOther} aria-label="Service served by someone else">
                <option value="">Any service</option>
                {SERVICE_PROVIDER_IDS.map((service) => (
                  <option value={service} key={service}>
                    {SERVICE_PROVIDER_LABEL[service]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Opening in</span>
              <select name="opening" defaultValue={query.opening} aria-label="Opening in a service">
                <option value="">Any opening</option>
                {SERVICE_OPPORTUNITY_IDS.map((service) => (
                  <option value={service} key={service}>
                    {SERVICE_OPPORTUNITY_FILTER_LABEL[service]} possible or interested
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <div className="crm-dir-sort">
          <label>
            <span>Sort</span>
            <select name="sort" defaultValue={query.sort} aria-label="Sort">
              <option value="id">Directory order</option>
              <option value="name">Name</option>
              <option value="tier">Tier</option>
              <option value="fit">AVL fit</option>
              <option value="contact">Last contact</option>
            </select>
          </label>
          <label>
            <span>Direction</span>
            <select name="dir" defaultValue={query.dir} aria-label="Sort direction">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </form>
      {!page.configured ? (
        <p className="dx-callout dx-callout--alert">This deploy cannot read the church directory yet.</p>
      ) : !page.ok ? (
        <p className="dx-callout dx-callout--alert">Churches couldn&apos;t be read just now. Try again in a minute.</p>
      ) : page.rows.length ? (
        <div className="crm-dir-scroll">
          <table className="crm-dir-table">
            <thead>
              <tr>
                <th className="crm-col-church">Church</th>
                <th className="crm-col-place">Place</th>
                <th>Status</th>
                <th>Tier</th>
                <th className="crm-col-fit">Fit</th>
                <th>Building stage</th>
                <th>Last contact</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.id} data-testid="crm-dir-row">
                  <td className="crm-col-church">
                    <Link className="crm-church-link" href={`/crm/church/${row.id}${preview ? "?preview=1" : ""}`}>
                      <span className="crm-church-name">{row.name}</span>
                      {row.hasStaff ? <span className="crm-staff-chip">staff</span> : null}
                    </Link>
                  </td>
                  <td className="crm-col-place">
                    {[row.city, row.state].filter(Boolean).join(", ")}
                    {row.county ? <span className="crm-dim"> · {row.county}</span> : null}
                    {row.zip ? <span className="crm-dim"> · {row.zip}</span> : null}
                  </td>
                  <td>{row.statusLabel}</td>
                  <td>
                    {row.tier && row.tierLabel ? (
                      <span className="crm-tier" title={AVL_TIER_NOTE[row.tier]}>
                        <span className={`crm-tier-dot crm-tier-dot--${row.tier}`} aria-hidden="true" />
                        {row.tierLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="crm-col-fit">{row.jevAvlFit === null ? "—" : row.jevAvlFit}</td>
                  <td>{row.buildingStage ? buildingStageLabel(row.buildingStage) : "—"}</td>
                  <td>{day(row.lastContact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="crm-empty">No churches match. Clear a filter and try again.</p>
      )}
      <p className="crm-dir-pager">
        {query.cursor ? (
          <Link className="dx-btn" href={back}>
            First page
          </Link>
        ) : null}
        {page.nextCursor ? (
          <Link className="dx-btn dx-btn--primary" href={directoryHref(query, page.nextCursor, preview)}>
            Next churches
          </Link>
        ) : null}
      </p>
      <section className="crm-provider-report" aria-label="Provider counts">
        <h3 className="crm-h2">Providers</h3>
        <p className="crm-dim">Counts by service and who serves it. Vendor names stay on this desk.</p>
        {providerReportOk ? (
          providerReport.length ? (
            <div className="crm-dir-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Provider</th>
                    <th>Vendor</th>
                    <th>Churches</th>
                  </tr>
                </thead>
                <tbody>
                  {providerReport.map((item) => (
                    <tr key={`${item.service}:${item.providerType}:${item.vendorName}`}>
                      <td>{SERVICE_PROVIDER_LABEL[item.service as keyof typeof SERVICE_PROVIDER_LABEL] ?? item.service}</td>
                      <td>{item.providerTypeLabel}</td>
                      <td>{item.vendorName || "—"}</td>
                      <td>{item.churches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="crm-dim">No provider is recorded yet.</p>
          )
        ) : (
          <p className="dx-callout dx-callout--alert" role="alert">Couldn&apos;t load provider counts</p>
        )}
      </section>
    </section>
  );
}
