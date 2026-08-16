import { loadOwnerDeck } from "@/lib/engine/owner-deck";
import { dollars, loadStripeSummary, type StripeSummary } from "@/lib/engine/stripe-summary";
import { BusinessExplorer } from "@/components/engine/business-explorer";

// Internal business desk. Money, people, help, and a table you can search
// and sort. Factory language stays on /start.

function MoneyStrip({ stripe }: { stripe: StripeSummary }) {
  if (stripe.state === "ok") {
    return (
      <div className="dx-stat-grid">
        <a className="dx-stat dx-stat--lime" href="/reports">
          <strong>
            {dollars(stripe.revenue30d)}
            {stripe.truncated ? "+" : ""}
          </strong>
          <span>revenue, 30 days</span>
          <p>
            {stripe.charges30d}
            {stripe.truncated ? "+" : ""} payment{stripe.charges30d === 1 ? "" : "s"}
            {stripe.otherCurrencies.length ? ` · non-USD not included` : ""} → money
          </p>
        </a>
        <div className="dx-stat dx-stat--cyan">
          <strong>{dollars(stripe.available)}</strong>
          <span>available now</span>
          <p>{stripe.currency}</p>
        </div>
        <div className="dx-stat">
          <strong>{dollars(stripe.pending)}</strong>
          <span>on the way to the bank</span>
          <p>pending payout</p>
        </div>
      </div>
    );
  }
  if (stripe.state === "no_key") {
    return (
      <p className="dx-note">
        Money is dark until a Stripe key is in{" "}
        <a className="account-link" href="/integrations">
          Keys
        </a>
        . We will not invent a revenue number.
      </p>
    );
  }
  if (stripe.state === "denied") {
    return (
      <p className="dx-note">
        The Stripe key cannot read balance and charges. Give it Read on those two and money lights up. ({stripe.message})
      </p>
    );
  }
  return <p className="dx-note">Stripe could not be read just now: {stripe.message}</p>;
}

export async function OwnerCommandDeck({ userKey }: { userKey: string | null; appsFilter?: string }) {
  const [deck, stripe] = await Promise.all([loadOwnerDeck(), loadStripeSummary(userKey)]);
  const actItems = deck.attention.filter((item) => item.severity === "act");
  const ordersAcross = deck.apps.reduce((sum, app) => sum + (app.ordersRecent ?? 0), 0);
  const growing = deck.apps.filter((app) => app.growth === "up").length;

  const familyRollup = deck.families
    .filter((family) => family.id !== "parked" && family.id !== "factory")
    .map((family) => {
      const members = deck.apps.filter((app) => app.family === family.id);
      const people = members.reduce((sum, app) => sum + (app.users ?? 0), 0);
      const help = members.reduce((sum, app) => sum + app.inboxOpen + (app.ticketsOpen ?? 0), 0);
      const orders = members.reduce((sum, app) => sum + (app.ordersRecent ?? 0), 0);
      const live = members.filter((app) => app.status === "live").length;
      return { ...family, people, help, orders, live, total: members.length };
    });

  return (
    <main className="shell wide-shell">
      <section className="panel biz-hero">
        <p className="dx-label">United Under God — the businesses</p>
        <h1 className="dx-display">
          How the work is <em>doing</em>.
        </h1>
        <p className="dx-lede">
          Money, people, and who needs a hand — across every live expression. Search and sort the table. Open a row to
          drill in. Each app still has its own admin for staff.
        </p>
        <MoneyStrip stripe={stripe} />
        {stripe.state === "ok" ? (
          <div className="dx-table-wrap" style={{ marginTop: 16 }}>
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Revenue stream</th>
                  <th>30 days</th>
                  <th>Payments</th>
                  <th>How we knew</th>
                </tr>
              </thead>
              <tbody>
                {stripe.streams.map((stream) => (
                  <tr key={stream.id}>
                    <td>
                      <a className="biz-name" href={`/reports/money?stream=${stream.id}`}>
                        {stream.label}
                      </a>
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
            <p className="dx-note" style={{ marginTop: 8 }}>
              Only charges this Stripe key can read. A stream with no labeled charges is not $0 — it means the
              charge did not name that app.{" "}
              <a className="account-link" href="/reports/money">
                Open the money report
              </a>{" "}
              for each service and Stripe account.
            </p>
          </div>
        ) : null}
        <div className="dx-stat-grid" style={{ marginTop: 14 }}>
          <a className="dx-stat dx-stat--cyan" href="#explore">
            <strong>{deck.usersAcrossApps ?? "—"}</strong>
            <span>people we can see</span>
            <p>
              {deck.reportingApps} reporting · {deck.liveCount} live
            </p>
          </a>
          <a className={`dx-stat ${deck.openTickets ? "dx-stat--pink" : ""}`} href="/inbox">
            <strong>{deck.openTickets}</strong>
            <span>people waiting</span>
            <p>{deck.openTickets ? "open the inbox →" : "inbox is clear"}</p>
          </a>
          <div className="dx-stat">
            <strong>{ordersAcross || "—"}</strong>
            <span>orders, 30 days</span>
            <p>from apps that report orders</p>
          </div>
          <a className={`dx-stat ${actItems.length ? "dx-stat--pink" : ""}`} href="#attention">
            <strong>{actItems.length}</strong>
            <span>need a next step</span>
            <p>{growing ? `${growing} growing this week` : "no growth signal yet"}</p>
          </a>
        </div>
      </section>

      {familyRollup.length > 0 ? (
        <section className="panel">
          <p className="dx-label">By family</p>
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Live</th>
                  <th>People</th>
                  <th>Orders 30d</th>
                  <th>Help</th>
                </tr>
              </thead>
              <tbody>
                {familyRollup.map((family) => (
                  <tr key={family.id}>
                    <td>
                      <b>{family.label}</b>
                    </td>
                    <td className="dx-mono">
                      {family.live}/{family.total}
                    </td>
                    <td className="dx-mono">{family.people || "—"}</td>
                    <td className="dx-mono">{family.orders || "—"}</td>
                    <td className="dx-mono">{family.help || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel" id="explore">
        <p className="dx-label">Explore the businesses</p>
        <BusinessExplorer apps={deck.apps} families={deck.families} />
      </section>

      {actItems.length > 0 ? (
        <section className="panel" id="attention">
          <p className="dx-label">Needs a next step</p>
          {actItems.slice(0, 10).map((item, index) => (
            <p className="dx-row" key={`${item.appName}-${index}`}>
              <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
              <b>{item.appName}</b>
              <span className="dx-note">
                {item.finding} — {item.action}
              </span>
              {item.link ? (
                <a className="account-link" href={item.link}>
                  Open →
                </a>
              ) : null}
            </p>
          ))}
        </section>
      ) : null}

      <p className="dx-note" style={{ marginTop: 8 }}>
        {stripe.state === "ok"
          ? "Revenue is the Stripe account we can read — not yet split per app. Orders are what each app reports. A dash means we do not have that number yet."
          : "A dash means we do not have that number yet. Nothing here is invented."}
      </p>
    </main>
  );
}
