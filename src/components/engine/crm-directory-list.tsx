import Link from "next/link";
import { directoryHref, directoryStatusLabel, type DirectoryQuery } from "@/lib/engine/crm-directory-core";
import type { DirectoryPage } from "@/lib/engine/crm-directory";
import { CRM_CHURCH_STATUSES } from "@/lib/engine/lpl-crm-core";
import { AVL_TIER_LABEL, type AvlTier } from "@/lib/engine/tech-director-core";

const TIERS: AvlTier[] = ["top", "second", "other_services", "staff_only"];

function day(value: string): string {
  if (!value) return "—";
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value.slice(0, 16);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

export function CrmDirectoryList({
  query,
  page,
  preview
}: {
  query: DirectoryQuery;
  page: DirectoryPage;
  preview: string;
}) {
  const back = directoryHref(query, "", preview);
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
        <label>
          <span>Name, city, or ZIP</span>
          <input name="q" defaultValue={query.q} placeholder="Atlanta or 31061" aria-label="Search by name, city, or ZIP" />
        </label>
        <label>
          <span>State</span>
          <input name="state" defaultValue={query.state} placeholder="GA" maxLength={20} aria-label="State" />
        </label>
        <label>
          <span>County or region</span>
          <input name="county" defaultValue={query.county} placeholder="Fulton" aria-label="County or region" />
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
          <input type="checkbox" name="staff" value="1" defaultChecked={query.staff} /> Has a staff contact
        </label>
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
        <button type="submit" className="dx-btn dx-btn--primary">
          Show churches
        </button>
      </form>
      <p className="crm-dim crm-pad">Other services means ChurchConnect, the church website, and Laser church gifts.</p>
      {!page.configured ? (
        <p className="dx-callout dx-callout--alert">This deploy cannot read the church directory yet.</p>
      ) : !page.ok ? (
        <p className="dx-callout dx-callout--alert">Churches couldn&apos;t be read just now. Try again in a minute.</p>
      ) : page.rows.length ? (
        <div className="crm-dir-scroll">
          <table className="crm-dir-table">
            <thead>
              <tr>
                <th>Church</th>
                <th>Place</th>
                <th>Status</th>
                <th>Tier</th>
                <th>Fit</th>
                <th>Last contact</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.id} data-testid="crm-dir-row">
                  <td>
                    <Link href={`/crm/church/${row.id}${preview ? "?preview=1" : ""}`}>{row.name}</Link>
                    {row.hasStaff ? <span className="crm-dim"> · staff</span> : null}
                  </td>
                  <td>
                    {[row.city, row.state].filter(Boolean).join(", ")}
                    {row.county ? <span className="crm-dim"> · {row.county}</span> : null}
                    {row.zip ? <span className="crm-dim"> · {row.zip}</span> : null}
                  </td>
                  <td>{row.statusLabel}</td>
                  <td>{row.tierLabel || "—"}</td>
                  <td>{row.jevAvlFit === null ? "—" : row.jevAvlFit}</td>
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
    </section>
  );
}
