import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { getOpsSnapshot, type OpsStatsRecord } from "@/lib/engine/ops-stats";
import { dollars, loadStripeSummary } from "@/lib/engine/stripe-summary";
import { getLlmUsageTotals } from "@/lib/engine/llm-usage";

// Owner reports — money, usage, and AI spend. Shared Stripe read lives in
// stripe-summary.ts so the business desk and this page stay in sync.
export const dynamic = "force-dynamic";

// Usage-table sorting via ?sort=&dir= — same plain-link pattern as the domains
// inventory. Missing numbers sort as -1 so "most first" (the common read)
// always puts silent cells at the bottom.
const USAGE_SORTS: Record<string, { label: string; compare: (a: OpsStatsRecord, b: OpsStatsRecord) => number }> = {
  app: { label: "App", compare: (a, b) => a.name.localeCompare(b.name) },
  users: { label: "Users", compare: (a, b) => (a.stats.users ?? -1) - (b.stats.users ?? -1) || a.name.localeCompare(b.name) },
  active: { label: "Active (30d)", compare: (a, b) => (a.stats.activeUsers30d ?? -1) - (b.stats.activeUsers30d ?? -1) || a.name.localeCompare(b.name) },
  new7: { label: "New (7d)", compare: (a, b) => (a.stats.newUsers7d ?? -1) - (b.stats.newUsers7d ?? -1) || a.name.localeCompare(b.name) },
  orders: { label: "Orders (30d)", compare: (a, b) => (a.stats.ordersRecent ?? -1) - (b.stats.ordersRecent ?? -1) || a.name.localeCompare(b.name) },
  tickets: { label: "Open tickets", compare: (a, b) => (a.stats.ticketsOpen ?? -1) - (b.stats.ticketsOpen ?? -1) || a.name.localeCompare(b.name) }
};

function SortHeader({ column, active, dir }: { column: string; active: string; dir: "asc" | "desc" }) {
  const isActive = column === active;
  const nextDir = isActive && dir === "asc" ? "desc" : "asc";
  return (
    <th>
      <a className="dx-sort" href={`/reports?sort=${column}&dir=${nextDir}#usage`}>
        {USAGE_SORTS[column].label}
        {isActive ? (dir === "asc" ? " ▲" : " ▼") : ""}
      </a>
    </th>
  );
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const session = await auth();
  const ownerEmail = normalizeUserKey(session?.user?.email) || null;

  const [snapshot, stripe, llm, params] = await Promise.all([
    getOpsSnapshot().catch(() => null),
    loadStripeSummary(ownerEmail),
    getLlmUsageTotals().catch(() => null),
    searchParams
  ]);

  const reportingApps = (snapshot?.apps ?? []).filter((record) => record.reporting);
  const silentApps = (snapshot?.apps ?? []).filter((record) => !record.reporting);

  // Default read: most users first — the question the owner opens this page with.
  const sortKey = params.sort && USAGE_SORTS[params.sort] ? params.sort : "users";
  const dir: "asc" | "desc" = params.dir === "asc" ? "asc" : params.dir === "desc" ? "desc" : sortKey === "app" ? "asc" : "desc";
  reportingApps.sort((a, b) => USAGE_SORTS[sortKey].compare(a, b) * (dir === "desc" ? -1 : 1));

  // The lead: every app, one line — reporting apps first (most users first),
  // then the silent ones with their honest state. Per-app REVENUE is not
  // faked here: money is portfolio-wide (Stripe section) until each app's
  // revenue reporting is wired.
  const leadApps = [
    ...[...reportingApps].sort((a, b) => (b.stats.users ?? -1) - (a.stats.users ?? -1) || a.name.localeCompare(b.name)),
    ...[...silentApps].sort((a, b) => a.name.localeCompare(b.name))
  ];
  const usageLine = (record: OpsStatsRecord): string => {
    const parts: string[] = [];
    if (typeof record.stats.users === "number") parts.push(`${record.stats.users} users`);
    if (typeof record.stats.activeUsers30d === "number") parts.push(`${record.stats.activeUsers30d} active (30d)`);
    if (typeof record.stats.newUsers7d === "number") parts.push(`${record.stats.newUsers7d} new (7d)`);
    if (typeof record.stats.ordersRecent === "number") parts.push(`${record.stats.ordersRecent} orders (30d)`);
    if (typeof record.stats.ticketsOpen === "number" && record.stats.ticketsOpen > 0) parts.push(`${record.stats.ticketsOpen} open tickets`);
    return parts.join(" · ") || "reporting, no numbers yet";
  };

  // Last 14 days of AI spend, oldest first, for the mini bar strip.
  const llmDays = llm
    ? Object.entries(llm.byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
    : [];
  const llmMax = Math.max(0.01, ...llmDays.map(([, usd]) => usd));

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">Reports</p>
        <h1 className="dx-display">
          What the portfolio is <em>doing</em>.
        </h1>
        <p className="dx-lede">
          Money, usage, and cost — real numbers only. Anything that can&apos;t report yet says exactly what would unlock
          it, so reporting grows app by app instead of pretending. To see which service was bought and which Stripe
          account it landed in, open the{" "}
          <a className="account-link" href="/reports/money">
            money report
          </a>
          .
        </p>
      </section>

      {leadApps.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Each app in one line</p>
          {leadApps.map((record) => {
            const actNeeds = record.needs.filter((need) => need.severity === "action_needed").length;
            return (
              <p className="dx-row" key={record.key}>
                {record.slug ? (
                  <a className="account-link" href={`/apps/${record.slug}`}><b>{record.name}</b></a>
                ) : record.url ? (
                  <a className="account-link" href={record.url} target="_blank" rel="noreferrer"><b>{record.name}</b></a>
                ) : (
                  <b>{record.name}</b>
                )}
                <span className="dx-note">{record.reporting ? usageLine(record) : record.note || "not reporting yet"}</span>
                {actNeeds > 0 ? (
                  <a className="dx-tag dx-tag--alert" href="/#attention">{actNeeds} to fix →</a>
                ) : null}
              </p>
            );
          })}
          <p className="dx-note" style={{ marginTop: 10 }}>
            Revenue shows portfolio-wide below — per-app revenue lands as each app's reporting is wired. Apps
            without numbers need their stats endpoint + token wired; the engine handles that as apps are finished.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <p className="dx-label">Money — Stripe</p>
        {stripe.state === "ok" ? (
          <div className="dx-stat-grid">
            <div className="dx-stat dx-stat--lime">
              <strong>{dollars(stripe.revenue30d)}{stripe.truncated ? "+" : ""}</strong>
              <span>revenue, last 30 days</span>
              <p>
                {stripe.charges30d}{stripe.truncated ? "+" : ""} payment{stripe.charges30d === 1 ? "" : "s"}
                {stripe.truncated ? " · over 500 charges — shown as a floor" : ""}
                {stripe.otherCurrencies.length ? ` · non-USD money not included: ${stripe.otherCurrencies.join(", ")}` : ""}
              </p>
            </div>
            <div className="dx-stat dx-stat--cyan">
              <strong>{dollars(stripe.available)}</strong>
              <span>available balance</span>
              <p>{stripe.currency}</p>
            </div>
            <div className="dx-stat dx-stat--purple">
              <strong>{dollars(stripe.pending)}</strong>
              <span>pending payout</span>
              <p>on its way to the bank</p>
            </div>
          </div>
        ) : stripe.state === "no_key" ? (
          <p className="dx-note">
            No Stripe key is reachable yet — add <code className="cred-var">STRIPE_SECRET_KEY</code> in{" "}
            <a className="account-link" href="/integrations">Integrations &amp; secrets</a> and this section lights up.
          </p>
        ) : stripe.state === "denied" ? (
          <p className="dx-note">
            Your Stripe key is a restricted key without read access to balance/charges. In Stripe: create (or extend a)
            restricted key with <b>Read</b> on Balance and Charges, save it in Integrations &amp; secrets, and this
            section lights up. ({stripe.message})
          </p>
        ) : (
          <p className="dx-note">Stripe couldn't be read just now: {stripe.message}</p>
        )}
        {stripe.state === "ok" ? (
          <div className="dx-table-wrap" style={{ marginTop: 16 }}>
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Stream</th>
                  <th>30 days</th>
                  <th>Payments</th>
                  <th>How we knew</th>
                </tr>
              </thead>
              <tbody>
                {stripe.streams.map((stream) => (
                  <tr key={stream.id}>
                    <td>
                      {stream.charges30d ? (
                        <a className="account-link" href={`/reports/money?stream=${stream.id}`}>
                          {stream.label}
                        </a>
                      ) : stream.slug ? (
                        <a className="account-link" href={`/apps/${stream.slug}`}>
                          {stream.label}
                        </a>
                      ) : (
                        <b>{stream.label}</b>
                      )}
                    </td>
                    <td className="dx-mono">
                      {stream.charges30d ? dollars(stream.revenue30d) : "no labeled charges"}
                    </td>
                    <td className="dx-mono">{stream.charges30d || "—"}</td>
                    <td className="dx-note">{stream.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="dx-note" style={{ marginTop: 10 }}>
          This is the Stripe account this key can read. A stream is labeled only when the charge names the app
          (product, description, or metadata). Anything else stays in &quot;not labeled.&quot;{" "}
          <a className="account-link" href="/reports/money">
            Open the money report
          </a>{" "}
          for each service bought and every Stripe account this desk can reach.
        </p>
      </section>

      <section className="panel" id="usage">
        <p className="dx-label">Usage — by app{reportingApps.length > 1 ? " · click a column to sort" : ""}</p>
        {reportingApps.length > 0 ? (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <SortHeader column="app" active={sortKey} dir={dir} />
                  <SortHeader column="users" active={sortKey} dir={dir} />
                  <SortHeader column="active" active={sortKey} dir={dir} />
                  <SortHeader column="new7" active={sortKey} dir={dir} />
                  <SortHeader column="orders" active={sortKey} dir={dir} />
                  <SortHeader column="tickets" active={sortKey} dir={dir} />
                </tr>
              </thead>
              <tbody>
                {reportingApps.map((record) => (
                  <tr key={record.key}>
                    <td>
                      {record.slug ? (
                        <a className="account-link" href={`/apps/${record.slug}`}>{record.name}</a>
                      ) : (
                        record.name
                      )}
                    </td>
                    <td className="dx-mono">{record.stats.users ?? "—"}</td>
                    <td className="dx-mono">{record.stats.activeUsers30d ?? "—"}</td>
                    <td className="dx-mono">
                      {record.stats.newUsers7d ?? "—"}
                      {typeof record.stats.newUsers7d === "number" && typeof record.stats.newUsersPrev7d === "number"
                        ? record.stats.newUsers7d > record.stats.newUsersPrev7d
                          ? " ↑"
                          : record.stats.newUsers7d < record.stats.newUsersPrev7d
                            ? " ↓"
                            : " →"
                        : ""}
                    </td>
                    <td className="dx-mono">{record.stats.ordersRecent ?? "—"}</td>
                    <td className="dx-mono">{record.stats.ticketsOpen ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dx-note">No app is reporting usage yet.</p>
        )}
        {silentApps.length > 0 ? (
          <p className="dx-note" style={{ marginTop: 10 }}>
            {silentApps.length} app{silentApps.length === 1 ? " isn't" : "s aren't"} reporting yet — each one's
            state is in the line-per-app list above.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <p className="dx-label">AI spend — building your apps</p>
        {llm && llm.totalCalls > 0 ? (
          <>
            <div className="dx-stat-grid">
              <div className="dx-stat dx-stat--purple">
                <strong>${llm.totalCostUsd.toFixed(2)}</strong>
                <span>total AI cost</span>
                <p>{llm.totalCalls} calls · {Math.round(llm.totalTokens / 1000)}k tokens{llm.durable ? "" : " · this deployment only"}</p>
              </div>
            </div>
            {llmDays.length > 1 ? (
              <>
                <div className="dx-bars">
                  {llmDays.map(([day, usd]) => (
                    <div
                      className="dx-bar"
                      key={day}
                      style={{ height: `${Math.max(4, Math.round((usd / llmMax) * 56))}px` }}
                      title={`${day}: $${usd.toFixed(2)}`}
                    />
                  ))}
                </div>
                <p className="dx-note">Daily AI spend, last {llmDays.length} days.</p>
              </>
            ) : null}
          </>
        ) : (
          <p className="dx-note">No AI usage recorded yet{llm && !llm.durable ? " (metering is per-deployment until durable storage)" : ""}.</p>
        )}
      </section>

      <section className="panel">
        <p className="dx-label">Later — already anticipated</p>
        <p className="dx-row">
          <span className="dx-index">01</span>
          <b>Usage trends over time</b>
          <span className="dx-note">needs a snapshot-history table — lands with the first month of data worth charting.</span>
        </p>
        <p className="dx-row">
          <span className="dx-index">02</span>
          <b>Managers per app</b>
          <span className="dx-note">each app keeps its own admin for hired staff; the central inbox and per-app dossier are live now at /inbox and /apps/…</span>
        </p>
        <p className="dx-row">
          <span className="dx-index">03</span>
          <b>Buyer packet / transfer of control</b>
          <span className="dx-note">a per-app export of revenue, usage, keys, and domains — for the day you sell one.</span>
        </p>
      </section>
    </main>
  );
}
