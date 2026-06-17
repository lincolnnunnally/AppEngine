import type { AppPortfolioEntry, AppPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";

export function OwnerPortfolioDashboard({ registry }: { registry: AppPortfolioRegistry }) {
  return (
    <section className="owner-portfolio-dashboard panel" data-testid="owner-portfolio-dashboard">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">App Portfolio</p>
          <h1>Every managed app in one place</h1>
          <p>
            Review AppEngine-created apps, ecosystem slices, review paths, production status, and the next safe action
            without hunting through GitHub, Vercel, workflow logs, or handoff comments.
          </p>
        </div>
        <div className="portfolio-summary-card">
          <span>Registry</span>
          <strong>{registry.kind}</strong>
          <p>{registry.ownerReadableSummary}</p>
        </div>
      </div>

      <div className="portfolio-summary-grid" aria-label="Portfolio summary">
        <SummaryCard label="Tracked entries" value={registry.summary.totalApps} />
        <SummaryCard label="Review ready" value={registry.summary.reviewReadyApps} />
        <SummaryCard label="Production live" value={registry.summary.productionLiveApps} />
        <SummaryCard label="Blocked/guarded" value={registry.summary.blockedApps} />
        <SummaryCard label="Unknown review URLs" value={registry.summary.unknownReviewUrls} />
      </div>

      <div className="portfolio-card-grid">
        {registry.apps.map((app) => (
          <PortfolioEntryCard app={app} key={app.slug} />
        ))}
      </div>

      <div className="portfolio-guardrail-strip" aria-label="Portfolio guardrails">
        <span>No secrets</span>
        <span>No private user data</span>
        <span>Production approval required</span>
        <span>No protected preview bypass links</span>
        <span>App boundaries required</span>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="portfolio-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PortfolioEntryCard({ app }: { app: AppPortfolioEntry }) {
  const latestPr = app.linkedPRs[0] || null;

  return (
    <article className="portfolio-entry-card">
      <div className="portfolio-entry-heading">
        <div>
          <span>{formatToken(app.type)}</span>
          <h2>{app.name}</h2>
          <p>{app.status}</p>
        </div>
        <strong className={`portfolio-state ${app.deploymentState}`}>{formatToken(app.deploymentState)}</strong>
      </div>

      <dl className="portfolio-detail-grid">
        <div>
          <dt>Review URL</dt>
          <dd>{renderUrl(app.reviewUrl)}</dd>
        </div>
        <div>
          <dt>Production</dt>
          <dd>{renderUrl(app.productionUrl)}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{app.currentVersion}</dd>
        </div>
        <div>
          <dt>Build state</dt>
          <dd>{formatToken(app.buildState)}</dd>
        </div>
        <div>
          <dt>Latest PR/branch</dt>
          <dd>
            {latestPr ? (
              <>
                <a href={latestPr.url}>#{latestPr.number}</a>
                {latestPr.branch ? <small>{latestPr.branch}</small> : null}
              </>
            ) : (
              "No PR linked yet"
            )}
          </dd>
        </div>
        <div>
          <dt>Next safe action</dt>
          <dd>{formatToken(app.nextSafeAction)}</dd>
        </div>
      </dl>

      <section className="portfolio-blocker-list">
        <h3>Blockers</h3>
        {app.blockers.length ? (
          <ul>
            {app.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p>No blockers recorded.</p>
        )}
      </section>
    </article>
  );
}

function renderUrl(value: string) {
  if (value.startsWith("/")) {
    return <a href={value}>{value}</a>;
  }

  if (value.startsWith("https://")) {
    return <a href={value}>{value}</a>;
  }

  return value;
}

function formatToken(value: string) {
  return value.replaceAll("_", " ");
}
