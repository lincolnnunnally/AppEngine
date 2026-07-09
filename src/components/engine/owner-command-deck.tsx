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

function AppCard({ app }: { app: DeckApp }) {
  return (
    <article className="dx-app">
      <div>
        <span className={`dx-badge ${BADGE_FOR_STATUS[app.status]}`}>{app.statusLabel}</span>
        {app.attentionCount > 0 ? (
          <span className="dx-badge dx-badge--alert" style={{ marginLeft: 6 }}>
            {app.attentionCount} to fix
          </span>
        ) : null}
      </div>
      <h3>{app.name}</h3>
      <p className="dx-domain">{app.domain || app.url || "no address yet"}</p>
      {app.reporting ? (
        <p className="dx-note">
          {app.users ?? "—"} users{app.activeUsers30d !== null ? ` · ${app.activeUsers30d} active (30d)` : ""}
        </p>
      ) : app.status === "live" ? (
        <p className="dx-note">Not reporting usage yet</p>
      ) : (
        <p className="dx-note">{app.nextStep}</p>
      )}
      <div className="dx-app-actions">
        {app.url ? (
          <a className="dx-btn dx-btn--primary" href={app.url} target="_blank" rel="noreferrer">
            Open app ↗
          </a>
        ) : null}
        {app.adminUrl ? (
          <a className="dx-btn" href={app.adminUrl} target={app.adminUrl.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
            Admin ↗
          </a>
        ) : null}
      </div>
    </article>
  );
}

export async function OwnerCommandDeck({ userKey }: { userKey: string | null }) {
  const deck = await loadOwnerDeck();
  const keys = await buildKeyStatus(userKey).catch(() => null);
  const keyRows = keys ? [...keys.universal, ...keys.payments] : [];
  const keysProvided = keyRows.filter((row) => row.state === "provided" || row.state === "hosting").length;
  const keysNeeded = keyRows.filter((row) => row.state === "needed" || row.state === "placeholder").length;
  const actItems = deck.attention.filter((item) => item.severity === "act");
  const watchItems = deck.attention.filter((item) => item.severity === "watch");

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">AppEngine — owner command deck</p>
        <h1 className="dx-display">
          Every app. <em>One</em> glance.
        </h1>
        <p className="dx-lede">
          Everything here exists to solve a real problem and help real people. You decide what gets built and why;
          the engine reviews what already exists, then builds it to completion — nothing technical lands on your desk.
        </p>
        <div className="dx-stat-grid">
          <div className="dx-stat dx-stat--lime">
            <strong>{deck.liveCount}</strong>
            <span>apps live</span>
            <p>of {deck.totalApps} in the portfolio</p>
          </div>
          <div className={`dx-stat ${actItems.length ? "dx-stat--pink" : "dx-stat--purple"}`}>
            <strong>{actItems.length}</strong>
            <span>need your attention</span>
            <p>{actItems.length ? "listed below — each with the exact next step" : "nothing is waiting on you"}</p>
          </div>
          <div className="dx-stat dx-stat--cyan">
            <strong>{deck.usersAcrossApps ?? "—"}</strong>
            <span>users (reporting apps)</span>
            <p>{deck.reportingApps} app{deck.reportingApps === 1 ? "" : "s"} reporting usage</p>
          </div>
          <div className={`dx-stat ${keysNeeded ? "dx-stat--purple" : "dx-stat--lime"}`}>
            <strong>{keys ? `${keysProvided}/${keysProvided + keysNeeded}` : "—"}</strong>
            <span>keys in place</span>
            <p>
              <a className="account-link" href="/integrations">enter or check keys →</a>
            </p>
          </div>
        </div>
      </section>

      {actItems.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Needs your attention</p>
          <div className="dx-callout dx-callout--alert">
            {actItems.slice(0, 8).map((item, index) => (
              <p className="dx-row" key={`${item.appName}-${index}`}>
                <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="dx-tag dx-tag--alert">{item.appName}</span>
                <b>{item.finding}</b>
                <span className="dx-note">{item.action}</span>
              </p>
            ))}
            {actItems.length > 8 ? <p className="dx-note">…and {actItems.length - 8} more.</p> : null}
          </div>
          {watchItems.length > 0 ? (
            <p className="dx-note" style={{ color: "var(--muted)" }}>
              Also watching {watchItems.length} lower-priority item{watchItems.length === 1 ? "" : "s"} — nothing to do yet.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="panel">
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

      <section className="panel">
        <p className="dx-label">The portfolio — facts as of {new Date(deck.factsAsOf).toLocaleDateString("en-US")}</p>
        <div className="dx-app-grid">
          {deck.apps.map((app) => (
            <AppCard app={app} key={app.slug} />
          ))}
        </div>
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
