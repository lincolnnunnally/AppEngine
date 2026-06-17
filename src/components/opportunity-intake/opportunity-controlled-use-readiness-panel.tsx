import type {
  OpportunityControlledUseCheck,
  OpportunityControlledUseReadiness
} from "@/lib/engine/opportunity-controlled-use-readiness";

export function OpportunityControlledUseReadinessPanel({ report }: { report: OpportunityControlledUseReadiness }) {
  return (
    <section
      className="opportunity-controlled-use-readiness panel"
      data-testid="opportunity-controlled-use-readiness"
    >
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">Opportunity Readiness</p>
          <h1>Controlled-use status for the Opportunity engine</h1>
          <p>{report.ownerReadableSummary}</p>
        </div>
        <div className="portfolio-summary-card">
          <span>Next operation</span>
          <strong>Run one real internal example</strong>
          <p>Use the full loop once with a real internal Opportunity before public/customer use.</p>
        </div>
      </div>

      <div className="opportunity-readiness-status-grid">
        {report.statuses.map((status) => (
          <article className={`readiness-status-card ${status.status}`} key={status.status}>
            <span>{formatToken(status.status)}</span>
            <strong>{status.label}</strong>
            <p>{status.summary}</p>
            {status.blockers.length ? (
              <ul>
                {status.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <small>No blocker for internal controlled use.</small>
            )}
          </article>
        ))}
      </div>

      <section>
        <p className="eyebrow">Full loop confirmation</p>
        <div className="opportunity-readiness-check-grid">
          {report.fullLoopStatus.map((check) => (
            <ReadinessCheckCard check={check} key={check.key} />
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow">Exact blockers before public/customer/autonomous use</p>
        <div className="guardrail-list">
          {report.exactBlockers.map((blocker) => (
            <span key={blocker}>{blocker}</span>
          ))}
        </div>
      </section>

      <div className="detail-grid">
        <section>
          <span>Latest full-loop trial</span>
          <p>{report.latestEvidence.latestFullLoopTrialId || "No trial run recorded yet"}</p>
        </section>
        <section>
          <span>Latest packet bridge</span>
          <p>{report.latestEvidence.latestPacketBridgeId || "No packet bridge recorded yet"}</p>
        </section>
        <section>
          <span>Portfolio source</span>
          <p>{formatToken(report.latestEvidence.opportunityPortfolioSource)}</p>
        </section>
        <section>
          <span>Audit events</span>
          <p>{report.latestEvidence.auditEventCount}</p>
        </section>
      </div>

      <section>
        <p className="eyebrow">Copyable next operational action</p>
        <textarea className="copyable-prompt-box" readOnly value={report.copyableNextAction} />
      </section>
    </section>
  );
}

function ReadinessCheckCard({ check }: { check: OpportunityControlledUseCheck }) {
  return (
    <article className={`readiness-check-card ${check.status}`}>
      <span>{formatToken(check.status)}</span>
      <strong>{check.label}</strong>
      <p>{check.summary}</p>
      <small>
        {formatToken(check.evidenceKind)}
        {check.evidenceId ? ` · ${check.evidenceId}` : ""}
      </small>
    </article>
  );
}

function formatToken(value: string) {
  return value.replaceAll("_", " ");
}
