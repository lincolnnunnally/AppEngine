import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { dollars } from "@/lib/engine/stripe-summary";
import { loadRevenueDetail, stripePaymentUrl } from "@/lib/engine/revenue-detail";

export const dynamic = "force-dynamic";

function when(unix: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function href(params: { stream?: string; account?: string }): string {
  const query = new URLSearchParams();
  if (params.stream) query.set("stream", params.stream);
  if (params.account) query.set("account", params.account);
  const text = query.toString();
  return text ? `/reports/money?${text}` : "/reports/money";
}

export default async function MoneyReportPage({
  searchParams
}: {
  searchParams: Promise<{ stream?: string; account?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/signin");
  const session = await auth();
  const ownerEmail = normalizeUserKey(session?.user?.email) || null;
  const params = await searchParams;
  const detail = await loadRevenueDetail(ownerEmail);

  const streamFilter = params.stream || "";
  const accountFilter = params.account || "";
  const charges = detail.charges.filter((charge) => {
    if (streamFilter && charge.streamId !== streamFilter && charge.streamSlug !== streamFilter) return false;
    if (accountFilter && charge.accountSourceId !== accountFilter) return false;
    return true;
  });
  const services = detail.services.filter((service) => {
    if (streamFilter && service.streamId !== streamFilter && service.streamSlug !== streamFilter) return false;
    if (accountFilter && service.accountSourceId !== accountFilter) return false;
    return true;
  });
  const filteredCents = charges.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <main className="shell wide-shell">
      <section className="panel biz-hero">
        <p className="dx-label">
          <a className="account-link" href="/reports">
            ← Reports
          </a>
        </p>
        <h1 className="dx-display">
          What was <em>bought</em>.
        </h1>
        <p className="dx-lede">
          Last 30 days, from every Stripe account this desk can actually read. The home page stays a glance. This page
          is the books: account, service, and each charge.
        </p>
        <div className="dx-stat-grid">
          <div className="dx-stat dx-stat--lime">
            <strong>
              {dollars(streamFilter || accountFilter ? filteredCents : detail.revenue30d)}
              {detail.truncated ? "+" : ""}
            </strong>
            <span>{streamFilter || accountFilter ? "this filter" : "readable, 30 days"}</span>
            <p>
              {charges.length} payment{charges.length === 1 ? "" : "s"}
              {detail.truncated ? " · over 500 charges on at least one account" : ""}
            </p>
          </div>
          <div className="dx-stat dx-stat--cyan">
            <strong>{detail.accounts.filter((account) => account.state === "ok").length}</strong>
            <span>Stripe accounts we can read</span>
            <p>{detail.accounts.filter((account) => account.state === "no_key").length} known slots with no key here</p>
          </div>
          <div className="dx-stat">
            <strong>{services.length}</strong>
            <span>distinct services</span>
            <p>from the product name on the charge</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="dx-label">Stripe accounts</p>
        <div className="dx-table-wrap">
          <table className="dx-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Where the key lives</th>
                <th>30 days</th>
                <th>Payments</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {detail.accounts.map((account) => (
                <tr key={account.sourceId}>
                  <td>
                    <a className="biz-name" href={href({ stream: streamFilter || undefined, account: account.sourceId })}>
                      {account.accountName || account.label}
                    </a>
                    <div className="dx-domain">
                      {account.accountId || account.label}
                      {account.livemode === false ? " · test" : account.livemode ? " · live" : ""}
                      {account.keyHint ? ` · ${account.keyHint}` : ""}
                    </div>
                  </td>
                  <td className="dx-note">{account.livesAt}</td>
                  <td className="dx-mono">{account.state === "ok" ? dollars(account.revenue30d || 0) : "—"}</td>
                  <td className="dx-mono">{account.state === "ok" ? account.charges30d || "—" : "—"}</td>
                  <td className="dx-note">
                    {account.state === "ok"
                      ? "readable"
                      : account.state === "no_key"
                        ? "no key on this desk"
                        : account.message || account.state}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dx-note" style={{ marginTop: 10 }}>
          Laser often bills from a Render key, Kids Need Dads from Supabase. If those keys are not in this desk&apos;s
          env or vault, the account row says so — it is not $0.
        </p>
      </section>

      <section className="panel">
        <p className="dx-label">Filter</p>
        <div className="dx-chips">
          <a className={`dx-chip${!streamFilter ? " dx-chip--active" : ""}`} href={href({ account: accountFilter || undefined })}>
            All streams
          </a>
          {detail.streams
            .filter((stream) => stream.charges30d > 0 || stream.id === streamFilter)
            .map((stream) => (
              <a
                key={stream.id}
                className={`dx-chip${streamFilter === stream.id ? " dx-chip--active" : ""}`}
                href={href({ stream: stream.id, account: accountFilter || undefined })}
              >
                {stream.label}
                {stream.charges30d ? ` ${stream.charges30d}` : ""}
              </a>
            ))}
        </div>
        {accountFilter || streamFilter ? (
          <p className="dx-note" style={{ marginTop: 10 }}>
            <a className="account-link" href="/reports/money">
              Clear filters
            </a>
          </p>
        ) : null}
      </section>

      <section className="panel">
        <p className="dx-label">Services bought</p>
        {services.length === 0 ? (
          <p className="dx-note">No labeled services in this filter. Either nothing charged, or the charge has no product name.</p>
        ) : (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Stream</th>
                  <th>Stripe account</th>
                  <th>30 days</th>
                  <th>Payments</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={`${service.accountSourceId}-${service.streamId}-${service.service}`}>
                    <td>
                      <b>{service.service}</b>
                    </td>
                    <td>
                      {service.streamSlug ? (
                        <a className="account-link" href={`/apps/${service.streamSlug}`}>
                          {service.streamLabel}
                        </a>
                      ) : (
                        service.streamLabel
                      )}
                    </td>
                    <td className="dx-note">{service.accountLabel}</td>
                    <td className="dx-mono">{dollars(service.revenue30d)}</td>
                    <td className="dx-mono">{service.charges30d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <p className="dx-label">Each payment</p>
        {charges.length === 0 ? (
          <p className="dx-note">No payments in this filter on the accounts we can read.</p>
        ) : (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Service</th>
                  <th>Stream</th>
                  <th>Account</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => {
                  const stripeUrl = stripePaymentUrl(charge);
                  return (
                    <tr key={charge.id}>
                      <td className="dx-mono">{when(charge.created)}</td>
                      <td>
                        <b>{charge.service}</b>
                        <div className="dx-domain">
                          {charge.email || (charge.last4 ? `card ···· ${charge.last4}` : charge.id)}
                        </div>
                      </td>
                      <td>
                        {charge.streamSlug ? (
                          <a className="account-link" href={`/apps/${charge.streamSlug}`}>
                            {charge.streamLabel}
                          </a>
                        ) : (
                          charge.streamLabel
                        )}
                      </td>
                      <td className="dx-note">{charge.accountLabel}</td>
                      <td className="dx-mono">
                        {stripeUrl ? (
                          <a className="account-link" href={stripeUrl} target="_blank" rel="noreferrer">
                            {dollars(charge.amount)} ↗
                          </a>
                        ) : (
                          dollars(charge.amount)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {detail.otherCurrencies.length ? (
          <p className="dx-note" style={{ marginTop: 10 }}>
            Non-USD charges are listed by Stripe but not summed here: {detail.otherCurrencies.join(", ")}.
          </p>
        ) : null}
      </section>
    </main>
  );
}
