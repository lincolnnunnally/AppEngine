import type { PortfolioUrlStatus, PortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { URL_STATUS_LABEL } from "@/lib/engine/portfolio-url-status";

// The URL board: every registry app's web-address situation on one panel —
// live at its domain, deployed but nameless, domain parked with nothing
// serving, or still waiting on a URL decision — each with the concrete next
// step. Facts come from the owner-maintained registry (see
// portfolio-url-status.ts), so this renders from props with no fetch; the
// attention queue stays the place for live health checks.

const STATUS_ORDER: PortfolioUrlStatus[] = [
  "unknown",
  "domain_owned_not_serving",
  "deployed_awaiting_domain",
  "awaiting_url",
  "live"
];

export function UrlStatusBoardPanel({ board }: { board: PortfolioUrlStatusBoard }) {
  if (!board.entries.length) {
    return (
      <div className="portfolio-url-board empty" aria-label="URL status board">
        <p>No apps in the ecosystem portfolio registry yet.</p>
      </div>
    );
  }

  const stepsToTake = board.counts.unknown + board.counts.domain_owned_not_serving + board.counts.deployed_awaiting_domain;

  return (
    <section className="portfolio-url-board" aria-label="URL status board">
      <div className="portfolio-attention-heading">
        <h2>Every app&rsquo;s URL, one board</h2>
        <span>
          {board.counts.live} live · {stepsToTake} with a step to take · {board.counts.awaiting_url} awaiting a URL
          {board.factsAsOf ? ` · facts as of ${board.factsAsOf.slice(0, 10)}` : ""}
        </span>
      </div>

      {STATUS_ORDER.map((status) => {
        const entries = board.entries.filter((entry) => entry.status === status);
        if (!entries.length) return null;
        return (
          <div className="portfolio-url-group" key={status}>
            <h3 className={`portfolio-url-group-title ${status}`}>
              {URL_STATUS_LABEL[status]} <small>({entries.length})</small>
            </h3>
            <ul>
              {entries.map((entry) => (
                <li key={entry.slug} className={status}>
                  <div className="portfolio-url-body">
                    <strong>
                      {entry.appName}
                      {entry.intendedDomain ? <code>{entry.intendedDomain}</code> : <code className="none">no domain yet</code>}
                    </strong>
                    <p>{entry.nextStep}</p>
                    {entry.note ? <small>{entry.note}</small> : null}
                  </div>
                  {entry.status === "live" && entry.servingUrl ? (
                    <a className="portfolio-secondary-action" href={entry.servingUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
