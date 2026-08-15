import { loadOwnerDeck, type DeckApp } from "@/lib/engine/owner-deck";
import { buildKeyStatus } from "@/components/engine/key-status-checklist";
import type { PortfolioUrlStatus } from "@/lib/engine/portfolio-url-status";

// The owner's home: every app at a glance, one attention list, and doors —
// open the app as a user sees it, or step into its admin. Dossier-styled.
// Server component; every value comes from loadOwnerDeck (real or absent).

const BADGE_FOR_STATUS: Record<PortfolioUrlStatus, string> = {
  live: "dx-badge--live",
  deployed_awaiting_domain: "dx-badge--waiting",
  domain_owned_not_serving: "dx-badge--idle",
  awaiting_url: "dx-badge--off",
  unknown: "dx-badge--off"
};

function usageLine(app: DeckApp): string {
  if (app.reporting) {
    const parts = [`${app.users ?? "—"} users`];
    if (app.activeUsers30d !== null) parts.push(`${app.activeUsers30d} active (30d)`);
    if (app.growth === "up") parts.push("growing");
    if (app.growth === "down") parts.push("slowing");
    if (app.inboxOpen > 0) parts.push(`${app.inboxOpen} need help`);
    return parts.join(" · ");
  }
  if (app.status === "live") return "Not reporting usage yet";
  return app.nextStep;
}

function AppCard({ app }: { app: DeckApp }) {
  // The card itself is the dossier door — business facts for this app.
  // Open app / this app's admin stay as explicit buttons so a sale or a
  // hired manager still has the per-app dashboard.
  const body = (
    <>
      <div>
        <span className={`dx-badge ${BADGE_FOR_STATUS[app.status]}`}>{app.statusLabel}</span>
        {app.inboxOpen > 0 ? (
          <span className="dx-badge dx-badge--alert" style={{ marginLeft: 6 }}>
            {app.inboxOpen} need help
          </span>
        ) : app.attentionCount > 0 ? (
          <span className="dx-badge dx-badge--alert" style={{ marginLeft: 6 }}>
            {app.attentionCount} to fix
          </span>
        ) : null}
      </div>
      <h3>{app.name}</h3>
      <p className="dx-domain">{app.domain || app.url || "no address yet"}</p>
      {app.reporting ? (
        <div className="dx-metrics">
          <div className="dx-metric">
            <strong>{app.users ?? "—"}</strong>
            <span>people</span>
          </div>
          <div className="dx-metric">
            <strong>{app.activeUsers30d ?? app.newUsers7d ?? "—"}</strong>
            <span>{app.activeUsers30d !== null ? "active" : "new this week"}</span>
          </div>
          <div className="dx-metric">
            <strong>{app.inboxOpen || app.ticketsOpen || 0}</strong>
            <span>need help</span>
          </div>
        </div>
      ) : (
        <p className="dx-note">{usageLine(app)}</p>
      )}
    </>
  );
  return (
    <article className="dx-app">
      <a className="dx-app-link" href={`/apps/${app.slug}`}>
        {body}
      </a>
      <div className="dx-app-actions">
        <a className="dx-btn" href={`/apps/${app.slug}`}>
          Details
        </a>
        {app.url ? (
          <a className="dx-btn dx-btn--primary" href={app.url} target="_blank" rel="noreferrer">
            Open app ↗
          </a>
        ) : null}
        {app.adminUrl ? (
          <a className="dx-btn" href={app.adminUrl} target={app.adminUrl.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
            {app.family === "toner" ? "Toner admin ↗" : "Admin ↗"}
          </a>
        ) : null}
      </div>
    </article>
  );
}

// Portfolio filter chips — plain links (?apps=), same no-JS pattern as the
// domains sort headers. Buckets can overlap ("live" and "needs attention" are
// both true for a live app with a blocker); each chip answers one owner
// question: what's live / what needs me / what isn't out yet.
const PORTFOLIO_FILTERS: Record<string, { label: string; match: (app: DeckApp) => boolean }> = {
  live: { label: "Live", match: (app) => app.status === "live" },
  attention: { label: "Needs attention", match: (app) => app.attentionCount > 0 || app.inboxOpen > 0 },
  help: { label: "People waiting", match: (app) => app.inboxOpen > 0 },
  idle: { label: "Not live yet", match: (app) => app.status !== "live" }
};

export async function OwnerCommandDeck({
  userKey,
  appsFilter
}: {
  userKey: string | null;
  appsFilter?: string;
}) {
  const deck = await loadOwnerDeck();
  const keys = await buildKeyStatus(userKey).catch(() => null);
  const keyRows = keys ? [...keys.universal, ...keys.payments] : [];
  const keysProvided = keyRows.filter((row) => row.state === "provided" || row.state === "hosting").length;
  const keysNeeded = keyRows.filter((row) => row.state === "needed" || row.state === "placeholder").length;
  const actItems = deck.attention.filter((item) => item.severity === "act");
  const watchItems = deck.attention.filter((item) => item.severity === "watch");
  const familyFilter = deck.families.find((family) => family.id === appsFilter);

  // Attention grouped by app: one heading per app, its items under it — the
  // owner clears an app at a time instead of hopping between apps in a flat
  // list. Capped at 8 items total across groups, same budget as before.
  const actGroups: Array<{ appName: string; items: typeof actItems }> = [];
  for (const item of actItems) {
    const group = actGroups.find((entry) => entry.appName === item.appName);
    if (group) group.items.push(item);
    else actGroups.push({ appName: item.appName, items: [item] });
  }
  actGroups.sort((a, b) => b.items.length - a.items.length);
  let itemBudget = 8;
  const shownGroups = actGroups
    .map((group) => {
      const items = group.items.slice(0, Math.max(0, itemBudget));
      itemBudget -= items.length;
      return { appName: group.appName, items };
    })
    .filter((group) => group.items.length > 0);
  const shownCount = shownGroups.reduce((sum, group) => sum + group.items.length, 0);

  const statusFilter = appsFilter && PORTFOLIO_FILTERS[appsFilter] ? appsFilter : "";
  const activeFilter = statusFilter || (familyFilter ? familyFilter.id : "");
  const shownApps = statusFilter
    ? deck.apps.filter(PORTFOLIO_FILTERS[statusFilter].match)
    : familyFilter
      ? deck.apps.filter((app) => app.family === familyFilter.id)
      : deck.apps;
  const chipCount = (key: string) => deck.apps.filter(PORTFOLIO_FILTERS[key].match).length;
  const challenges = deck.insights.filter((insight) => insight.kind === "challenge").slice(0, 6);
  const opportunities = deck.insights.filter((insight) => insight.kind === "opportunity").slice(0, 6);
  const grouped = new Map<string, DeckApp[]>();
  for (const app of shownApps) {
    const key = app.familyLabel;
    const list = grouped.get(key) ?? [];
    list.push(app);
    grouped.set(key, list);
  }

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">AppEngine — owner command deck</p>
        <h1 className="dx-display">
          Every app. <em>One</em> glance.
        </h1>
        <p className="dx-lede">
          One place to see how every app is doing — trends, people waiting for help, and the next useful step. Click an
          app for its business picture. Each app still has its own admin for staff, or for the day you sell it.
        </p>
        <div className="dx-stat-grid">
          <a className="dx-stat dx-stat--lime" href="/?apps=live#portfolio">
            <strong>{deck.liveCount}</strong>
            <span>apps live</span>
            <p>of {deck.totalApps} in the portfolio ↓</p>
          </a>
          <a className={`dx-stat ${deck.openTickets ? "dx-stat--pink" : "dx-stat--lime"}`} href="/inbox">
            <strong>{deck.openTickets}</strong>
            <span>people waiting</span>
            <p>{deck.openTickets ? "open the inbox →" : "no one is waiting on you"}</p>
          </a>
          <a className={`dx-stat ${actItems.length ? "dx-stat--pink" : "dx-stat--purple"}`} href="#attention">
            <strong>{actItems.length}</strong>
            <span>need your attention</span>
            <p>{actItems.length ? "listed below — each with the exact next step ↓" : "nothing else is waiting"}</p>
          </a>
          <a className="dx-stat dx-stat--cyan" href="/reports">
            <strong>{deck.usersAcrossApps ?? "—"}</strong>
            <span>users (reporting apps)</span>
            <p>{deck.reportingApps} app{deck.reportingApps === 1 ? "" : "s"} reporting usage → reports</p>
          </a>
        </div>
      </section>

      {challenges.length > 0 || opportunities.length > 0 ? (
        <section className="panel" id="insights">
          <p className="dx-label">Trends — from real numbers only</p>
          {challenges.map((insight) => (
            <p className="dx-row" key={`c-${insight.slug}-${insight.text}`}>
              <span className="dx-tag dx-tag--alert">Challenge</span>
              <b>{insight.appName}</b>
              <span className="dx-note">{insight.text}</span>
              <a className="account-link" href={insight.href}>
                See it →
              </a>
            </p>
          ))}
          {opportunities.map((insight) => (
            <p className="dx-row" key={`o-${insight.slug}-${insight.text}`}>
              <span className="dx-tag">Opportunity</span>
              <b>{insight.appName}</b>
              <span className="dx-note">{insight.text}</span>
              <a className="account-link" href={insight.href}>
                See it →
              </a>
            </p>
          ))}
          {keysNeeded > 0 ? (
            <p className="dx-note" style={{ marginTop: 10 }}>
              {keysProvided}/{keysProvided + keysNeeded} keys in place —{" "}
              <a className="account-link" href="/integrations">
                check integrations →
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {actItems.length > 0 ? (
        <section className="panel" id="attention">
          <p className="dx-label">Needs your attention</p>
          <div className="dx-callout dx-callout--alert">
            {shownGroups.map((group) => (
              <div className="dx-attn-group" key={group.appName}>
                <p className="dx-attn-head">
                  <span className="dx-tag dx-tag--alert">{group.appName}</span>
                  {group.items.length > 1 ? (
                    <span className="dx-note">{group.items.length} things to fix</span>
                  ) : null}
                </p>
                {group.items.map((item, index) => (
                  <p className="dx-row" key={`${group.appName}-${index}`}>
                    <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
                    <b>{item.finding}</b>
                    <span className="dx-note">{item.action}</span>
                    {item.link ? (
                      <a className="account-link" href={item.link}>Fix it →</a>
                    ) : null}
                  </p>
                ))}
              </div>
            ))}
            {actItems.length > shownCount ? <p className="dx-note">…and {actItems.length - shownCount} more.</p> : null}
          </div>
          {watchItems.length > 0 ? (
            <p className="dx-note" style={{ color: "var(--muted)" }}>
              Also watching {watchItems.length} lower-priority item{watchItems.length === 1 ? "" : "s"} — nothing to do yet.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="panel" id="attention">
          <p className="dx-label">Needs your attention</p>
          <div className="dx-callout">
            <b>Nothing is waiting on you.</b>{" "}
            <span className="dx-note">
              {deck.opsCheckedAt
                ? `Live checks last ran ${new Date(deck.opsCheckedAt).toLocaleString("en-US")}.`
                : "Live checks couldn't run just now — statuses below are from the recorded facts."}
            </span>
          </div>
        </section>
      )}

      <section className="panel" id="portfolio">
        <p className="dx-label">The portfolio — facts as of {new Date(deck.factsAsOf).toLocaleDateString("en-US")}</p>
        <div className="dx-chips">
          <a className={`dx-chip${activeFilter === "" ? " dx-chip--active" : ""}`} href="/#portfolio">
            All <strong>{deck.apps.length}</strong>
          </a>
          {Object.entries(PORTFOLIO_FILTERS).map(([key, filter]) => {
            const count = chipCount(key);
            if (count === 0) return null;
            return (
              <a
                className={`dx-chip${activeFilter === key ? " dx-chip--active" : ""}`}
                href={`/?apps=${key}#portfolio`}
                key={key}
              >
                {filter.label} <strong>{count}</strong>
              </a>
            );
          })}
        </div>
        <div className="dx-chips" style={{ marginTop: 8 }}>
          {deck.families.map((family) => (
            <a
              className={`dx-chip${activeFilter === family.id ? " dx-chip--active" : ""}`}
              href={`/?apps=${family.id}#portfolio`}
              key={family.id}
            >
              {family.label} <strong>{family.count}</strong>
            </a>
          ))}
        </div>
        {shownApps.length === 0 ? (
          <p className="dx-note">
            No apps match that filter right now. <a className="account-link" href="/#portfolio">Show all {deck.apps.length} →</a>
          </p>
        ) : (
          [...grouped.entries()].map(([label, apps]) => (
            <div className="dx-family" key={label}>
              <p className="dx-family-label">{label}</p>
              <div className="dx-app-grid">
                {apps.map((app) => (
                  <AppCard app={app} key={app.slug} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="panel">
        <p className="dx-label">The method</p>
        <p className="dx-row">
          <span className="dx-index">01</span>
          <span className="dx-tag">Problem</span>
          <b>Every app starts with a real problem and the people it helps.</b>
          <span className="dx-note">
            Nothing gets built for its own sake. <a className="account-link" href="/start">Start something new →</a>
          </span>
        </p>
        <p className="dx-row">
          <span className="dx-index">02</span>
          <span className="dx-tag">Review first</span>
          <b>What exists gets read before anything gets written.</b>
          <span className="dx-note">No rebuilding what's already there.</span>
        </p>
        <p className="dx-row">
          <span className="dx-index">03</span>
          <span className="dx-tag">To completion</span>
          <b>The engine carries the build all the way to live.</b>
          <span className="dx-note">You see outcomes and decisions — never the plumbing.</span>
        </p>
      </section>
    </main>
  );
}
