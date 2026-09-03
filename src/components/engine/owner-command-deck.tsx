import { loadOwnerDeck } from "@/lib/engine/owner-deck";
import { dollars, loadStripeSummary, type StripeSummary } from "@/lib/engine/stripe-summary";
import { BusinessExplorer, type DeckRevenue } from "@/components/engine/business-explorer";

// Internal business desk. Money, people, help, and a table you can search
// and sort. Factory language stays on /start.
//
// Rule for this page: nothing states a number without offering the place that
// number came from. A figure with no destination is a dead end the owner has to
// reconstruct by hand, which is the thing this desk exists to stop.

// The chip filters the explorer already understands. ?apps= is matched against
// these first, then against a family id, and anything else is treated as a
// search term — so every link that lands here arrives pre-filtered.
const VIEW_KEYS = ["all", "live", "money", "growing", "help", "quiet", "doors"] as const;
type ViewKey = (typeof VIEW_KEYS)[number];

function isViewKey(value: string): value is ViewKey {
  return (VIEW_KEYS as readonly string[]).includes(value);
}

function MoneyStrip({ stripe }: { stripe: StripeSummary }) {
  if (stripe.state === "ok") {
    return (
      <div className="dx-stat-grid">
        <a className="dx-stat dx-stat--lime" href="/reports/money">
          <strong>
            {dollars(stripe.revenue30d)}
            {stripe.truncated ? "+" : ""}
          </strong>
          <span>revenue, 30 days</span>
          <p>
            {stripe.charges30d}
            {stripe.truncated ? "+" : ""} payment{stripe.charges30d === 1 ? "" : "s"}
            {stripe.otherCurrencies.length ? ` · non-USD not included` : ""} → the money report
          </p>
        </a>
        <a className="dx-stat dx-stat--cyan" href="/reports/money#accounts">
          <strong>{dollars(stripe.available)}</strong>
          <span>available now</span>
          <p>{stripe.currency} · which account holds it →</p>
        </a>
        <a className="dx-stat" href="/reports/money#accounts">
          <strong>{dollars(stripe.pending)}</strong>
          <span>on the way to the bank</span>
          <p>pending payout →</p>
        </a>
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

export async function OwnerCommandDeck({ userKey, appsFilter }: { userKey: string | null; appsFilter?: string }) {
  const [deck, stripe] = await Promise.all([loadOwnerDeck(), loadStripeSummary(userKey)]);
  const actItems = deck.attention.filter((item) => item.severity === "act");
  const watchItems = deck.attention.filter((item) => item.severity === "watch");
  const ordersAcross = deck.apps.reduce((sum, app) => sum + (app.ordersRecent ?? 0), 0);
  const growing = deck.apps.filter((app) => app.growth === "up").length;
  const doorCount = deck.apps.filter((app) => app.adminUrl).length;

  // Money per app, keyed by revenue stream. Only real, classified charges —
  // an app with no classifier gets no figure rather than a $0.
  const revenueBySlug: Record<string, DeckRevenue> = {};
  if (stripe.state === "ok") {
    for (const stream of stripe.streams) {
      if (stream.slug) {
        revenueBySlug[stream.slug] = { revenue30d: stream.revenue30d, charges30d: stream.charges30d };
      }
    }
  }

  const requested = (appsFilter ?? "").trim();
  const initialView: ViewKey = isViewKey(requested) ? requested : "all";
  const initialFamily = deck.families.some((family) => family.id === requested) ? requested : "";
  const initialQuery = initialView === "all" && !initialFamily ? requested : "";

  const familyRollup = deck.families
    .filter((family) => family.id !== "parked" && family.id !== "factory")
    .map((family) => {
      const members = deck.apps.filter((app) => app.family === family.id);
      const people = members.reduce((sum, app) => sum + (app.users ?? 0), 0);
      const help = members.reduce((sum, app) => sum + app.inboxOpen + (app.ticketsOpen ?? 0), 0);
      const orders = members.reduce((sum, app) => sum + (app.ordersRecent ?? 0), 0);
      const live = members.filter((app) => app.status === "live").length;
      // A rollup adds only the apps that report. Saying how many did keeps the
      // total from reading as "the whole family", which it is not.
      const reporting = members.filter((app) => app.reporting).length;
      return { ...family, people, help, orders, live, reporting, total: members.length };
    });
  const rolledUp = familyRollup.reduce((sum, family) => sum + family.total, 0);
  const outsideRollup = deck.apps.length - rolledUp;

  return (
    <main className="shell wide-shell">
      <section className="panel biz-hero">
        <p className="dx-label">United Under God — the businesses</p>
        <h1 className="dx-display">
          How the work is <em>doing</em>.
        </h1>
        <p className="dx-lede">
          Money, people, and who needs a hand — across every live expression. Search and sort the table, open a row to
          drill in, and step straight into any app&apos;s own admin.
        </p>
        <p className="dx-note">
          {deck.apps.length} businesses on the deck · {deck.liveCount} live · {doorCount} with an admin door
          {deck.factsAsOf ? ` · roster facts as of ${deck.factsAsOf.slice(0, 10)}` : ""}
          {deck.opsCheckedAt
            ? ` · numbers checked ${deck.opsCheckedAt.slice(0, 16).replace("T", " ")}`
            : " · ops snapshot unavailable"}
        </p>
        <MoneyStrip stripe={stripe} />
        {stripe.state === "ok" ? (
          <div className="dx-table-wrap dx-inset">
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
                      {stream.slug ? (
                        <div className="dx-domain">
                          <a className="dx-cell-link" href={`/apps/${stream.slug}`}>
                            open the business →
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td className="dx-mono">{stream.charges30d ? dollars(stream.revenue30d) : "no labeled charges"}</td>
                    <td className="dx-mono">{stream.charges30d || "—"}</td>
                    <td className="dx-note">{stream.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dx-note dx-inset-note">
              Only charges this Stripe key can read. A stream with no labeled charges is not $0 — it means the charge
              did not name that app.{" "}
              <a className="account-link" href="/reports/money">
                Open the money report
              </a>{" "}
              for each service and Stripe account.
            </p>
          </div>
        ) : null}
        <div className="dx-stat-grid dx-inset">
          <a className="dx-stat dx-stat--cyan" href="/reports">
            <strong>{deck.usersAcrossApps ?? "—"}</strong>
            <span>people we can see</span>
            <p>
              {deck.reportingApps} of {deck.apps.length} reporting · {deck.liveCount} live → every app, one line
            </p>
          </a>
          <a className={`dx-stat ${deck.openTickets ? "dx-stat--pink" : ""}`} href="/inbox">
            <strong>{deck.openTickets}</strong>
            <span>people waiting</span>
            <p>{deck.openTickets ? "open the inbox →" : "inbox is clear →"}</p>
          </a>
          <a className="dx-stat" href="/?apps=money#explore">
            <strong>{ordersAcross || "—"}</strong>
            <span>orders, 30 days</span>
            <p>from apps that report orders →</p>
          </a>
          <a className={`dx-stat ${actItems.length ? "dx-stat--pink" : ""}`} href="#attention">
            <strong>{actItems.length}</strong>
            <span>need a next step</span>
            <p>{growing ? `${growing} growing this week →` : "no growth signal yet →"}</p>
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
                {familyRollup.map((family) => {
                  const href = `/?apps=${encodeURIComponent(family.id)}#explore`;
                  return (
                    <tr key={family.id} className="biz-row">
                      <td>
                        <a className="biz-name" href={href}>
                          {family.label}
                        </a>
                      </td>
                      <td className="dx-mono">
                        <a className="dx-cell-link" href={href}>
                          {family.live}/{family.total}
                        </a>
                      </td>
                      <td className="dx-mono">
                        <a
                          className="dx-cell-link"
                          href={href}
                          title={`${family.reporting} of ${family.total} report usage`}
                        >
                          {family.people || "—"}
                        </a>
                      </td>
                      <td className="dx-mono">
                        <a className="dx-cell-link" href={href}>
                          {family.orders || "—"}
                        </a>
                      </td>
                      <td className="dx-mono">
                        <a className="dx-cell-link" href={href}>
                          {family.help || "—"}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="dx-note">
            A family total adds only the apps that report, so it is a floor, not the whole family.
            {outsideRollup > 0 ? (
              <>
                {" "}
                {outsideRollup} {outsideRollup === 1 ? "app sits" : "apps sit"} outside these families (the factory
                itself and parked entries) —{" "}
                <a className="account-link" href="#explore">
                  every one of them is in the table below
                </a>
                .
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      <section className="panel" id="explore">
        <p className="dx-label">Explore the businesses</p>
        <BusinessExplorer
          apps={deck.apps}
          families={deck.families}
          revenueBySlug={revenueBySlug}
          revenueReadable={stripe.state === "ok"}
          initialView={initialView}
          initialFamily={initialFamily}
          initialQuery={initialQuery}
        />
      </section>

      {actItems.length > 0 ? (
        <section className="panel" id="attention">
          <p className="dx-label">Needs a next step — {actItems.length}</p>
          {actItems.map((item, index) => (
            <p className="dx-row" key={`${item.appName}-${index}`}>
              <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
              {item.slug ? (
                <a className="biz-name" href={`/apps/${item.slug}`}>
                  {item.appName}
                </a>
              ) : (
                <b>{item.appName}</b>
              )}
              <span className="dx-note">
                {item.finding} — {item.action}
              </span>
              {item.link ? (
                <a className="account-link" href={item.link}>
                  Fix it →
                </a>
              ) : null}
            </p>
          ))}
        </section>
      ) : null}

      {watchItems.length > 0 ? (
        <section className="panel" id="watch">
          <details className="dx-fold">
            <summary className="dx-label">Worth watching — {watchItems.length}</summary>
            {watchItems.map((item, index) => (
              <p className="dx-row" key={`${item.appName}-watch-${index}`}>
                <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
                {item.slug ? (
                  <a className="biz-name" href={`/apps/${item.slug}`}>
                    {item.appName}
                  </a>
                ) : (
                  <b>{item.appName}</b>
                )}
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
          </details>
        </section>
      ) : null}

      <p className="dx-note">
        {stripe.state === "ok"
          ? "Revenue is the Stripe account we can read, split only as far as the charges name an app. Orders are what each app reports. A dash means we do not have that number yet."
          : "A dash means we do not have that number yet. Nothing here is invented."}
      </p>
    </main>
  );
}
