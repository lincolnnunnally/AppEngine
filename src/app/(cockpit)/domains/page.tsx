import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import {
  domainInventoryAvailable,
  KNOWN_DOMAIN_SEEDS,
  listDomainInventory,
  pullCloudflareZones,
  refreshDomainFacts,
  removeDomain,
  upsertDomain
} from "@/lib/engine/domain-inventory";

// Owner-only domain inventory — every domain in one place regardless of which
// registrar holds it (Spaceship, eNom, DreamHost…). Rows live in the DB; the
// seeds the ecosystem already knows about appear as one-click adds; Cloudflare
// zones can be pulled live. Registrars without a usable API stay manual.
export const dynamic = "force-dynamic";

function back(message: string, ok: boolean): never {
  redirect(`/domains?msg=${encodeURIComponent(message)}&ok=${ok ? "1" : "0"}`);
}

async function saveDomainAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineAdmin())) redirect("/");
  // Blank fields are omitted (undefined) so updating one field of an existing
  // domain never wipes the rest — the upsert only overwrites what was typed.
  const field = (name: string): string | undefined => {
    const value = String(formData.get(name) || "").trim();
    return value ? value : undefined;
  };
  const result = await upsertDomain({
    domain: String(formData.get("domain") || ""),
    registrar: field("registrar"),
    dnsHost: field("dnsHost"),
    appSlug: field("appSlug"),
    status: field("status"),
    expiresOn: field("expiresOn"),
    nameServers: field("nameServers"),
    notes: field("notes")
  });
  back(result.message, result.ok);
}

async function refreshFactsAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineAdmin())) redirect("/");
  const result = await refreshDomainFacts(String(formData.get("domain") || ""));
  back(result.message, result.ok);
}

async function addSeedAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineAdmin())) redirect("/");
  const domain = String(formData.get("domain") || "");
  const seed = KNOWN_DOMAIN_SEEDS.find((entry) => entry.domain === domain);
  if (!seed) back("That suggestion isn't on file.", false);
  const result = await upsertDomain(seed);
  back(result.message, result.ok);
}

async function removeDomainAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineAdmin())) redirect("/");
  const domain = String(formData.get("domain") || "");
  await removeDomain(domain);
  back(`${domain} removed.`, true);
}

async function pullCloudflareAction() {
  "use server";
  if (!(await canAccessEngineAdmin())) redirect("/");
  const result = await pullCloudflareZones();
  back(result.message, result.ok);
}

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function DomainsPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; ok?: string; edit?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/");

  const params = await searchParams;
  const notice = params.msg ? { ok: params.ok === "1", message: params.msg } : null;
  const available = domainInventoryAvailable();
  const rows = await listDomainInventory();
  const inInventory = new Set(rows.map((row) => row.domain));
  const suggestions = KNOWN_DOMAIN_SEEDS.filter((seed) => !inInventory.has(seed.domain));
  const expiring = rows.filter((row) => row.expiresOn && daysUntil(row.expiresOn) <= 60);
  // ?edit=<domain> prefills the form below with that row for in-place editing.
  const editing = params.edit ? rows.find((row) => row.domain === params.edit) ?? null : null;

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">Domains</p>
        <h1 className="dx-display">
          Every domain. <em>One</em> ledger.
        </h1>
        <p className="dx-lede">
          Spaceship, eNom, DreamHost — wherever a domain lives, it's recorded here: registrar, DNS host, which app
          it belongs to, and when it expires. Cloudflare zones can be pulled automatically; eNom and DreamHost have
          no usable API, so those stay quick manual entries.
        </p>
        {notice ? (
          <p className={`integration-notice integration-notice--${notice.ok ? "ok" : "error"}`}>{notice.message}</p>
        ) : null}
        {!available ? <p className="integration-warn">Domain storage needs the database — unavailable in this environment.</p> : null}
        <form action={pullCloudflareAction}>
          <button className="dx-btn dx-btn--primary" type="submit" disabled={!available}>
            Pull zones from Cloudflare
          </button>
        </form>
      </section>

      {expiring.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Renewals coming up</p>
          <div className="dx-callout dx-callout--alert">
            {expiring.map((row) => (
              <p className="dx-row" key={row.domain}>
                <span className="dx-tag dx-tag--alert">{daysUntil(row.expiresOn as string)}d</span>
                <b>{row.domain}</b>
                <span className="dx-note">expires {row.expiresOn} at {row.registrar || "its registrar"}</span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <p className="dx-label">Inventory — {rows.length} domain{rows.length === 1 ? "" : "s"}</p>
        {rows.length === 0 ? (
          <p className="dx-note">Nothing recorded yet — add the suggestions below or enter a domain by hand.</p>
        ) : (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Registrar</th>
                  <th>DNS</th>
                  <th>App</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Name servers</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.domain}>
                    <td className="dx-mono">
                      <a className="account-link" href={`https://${row.domain}`} target="_blank" rel="noreferrer">
                        {row.domain}
                      </a>
                    </td>
                    <td>{row.registrar || "—"}</td>
                    <td>{row.dnsHost || "—"}</td>
                    <td className="dx-mono">{row.appSlug || "—"}</td>
                    <td>{row.status || "—"}</td>
                    <td className="dx-mono">{row.expiresOn || "—"}</td>
                    <td className="dx-mono">{row.nameServers ? row.nameServers.split(",").map((ns) => ns.trim()).join(" · ") : "—"}</td>
                    <td>{row.notes || ""}</td>
                    <td>
                      <a className="account-link" href={`/domains?edit=${encodeURIComponent(row.domain)}#edit-domain`}>Edit</a>
                      {" · "}
                      <form action={refreshFactsAction} style={{ display: "inline" }}>
                        <input type="hidden" name="domain" value={row.domain} />
                        <button className="account-link-button" type="submit" title="Pull registrar, expiry, and name servers from the public registry">Refresh facts</button>
                      </form>
                      {" · "}
                      <form action={removeDomainAction} style={{ display: "inline" }}>
                        <input type="hidden" name="domain" value={row.domain} />
                        <button className="account-link-button" type="submit">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {suggestions.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Already known to the ecosystem — one click to record</p>
          {suggestions.map((seed) => (
            // div, not p: a <form> inside <p> is invalid HTML — the browser
            // closes the paragraph early and orphans the submit button.
            <div className="dx-row" key={seed.domain}>
              <span className="dx-tag">{seed.registrar}</span>
              <b>{seed.domain}</b>
              <span className="dx-note">{seed.status}{seed.expiresOn ? ` · expires ${seed.expiresOn}` : ""}</span>
              <form action={addSeedAction} style={{ marginLeft: "auto" }}>
                <input type="hidden" name="domain" value={seed.domain} />
                <button className="dx-btn" type="submit" disabled={!available}>Add</button>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel" id="edit-domain">
        <p className="dx-label">{editing ? `Editing ${editing.domain}` : "Add or update a domain"}</p>
        <p className="dx-note">Blank fields keep their current value — you only overwrite what you type. "Refresh facts" on any row fills registrar, expiry, and name servers from the public registry automatically.</p>
        <form action={saveDomainAction} className="form-grid">
          <label>
            Domain
            <input className="convo-input" name="domain" type="text" placeholder="example.com" defaultValue={editing?.domain ?? ""} required />
          </label>
          <label>
            Registrar
            <input className="convo-input" name="registrar" type="text" placeholder="Spaceship / eNom / DreamHost" defaultValue={editing?.registrar ?? ""} />
          </label>
          <label>
            DNS host
            <input className="convo-input" name="dnsHost" type="text" placeholder="Cloudflare / DreamHost / Vercel" defaultValue={editing?.dnsHost ?? ""} />
          </label>
          <label>
            App (slug)
            <input className="convo-input" name="appSlug" type="text" placeholder="which app uses it" defaultValue={editing?.appSlug ?? ""} />
          </label>
          <label>
            Status
            <input className="convo-input" name="status" type="text" placeholder="live / parked / not serving" defaultValue={editing?.status ?? ""} />
          </label>
          <label>
            Expires (YYYY-MM-DD)
            <input className="convo-input" name="expiresOn" type="date" defaultValue={editing?.expiresOn ?? ""} />
          </label>
          <label>
            Name servers
            <input className="convo-input" name="nameServers" type="text" placeholder="ns1.example.com, ns2.example.com" defaultValue={editing?.nameServers ?? ""} />
          </label>
          <label>
            Notes
            <input className="convo-input" name="notes" type="text" defaultValue={editing?.notes ?? ""} />
          </label>
          <div className="action-row">
            <button className="dx-btn dx-btn--primary" type="submit" disabled={!available}>Save domain</button>
          </div>
        </form>
      </section>
    </main>
  );
}
