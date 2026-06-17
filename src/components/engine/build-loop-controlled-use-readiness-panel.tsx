import type {
  BuildLoopControlledUseCheck,
  BuildLoopControlledUseReadiness
} from "@/lib/engine/build-loop-controlled-use-readiness";

export function BuildLoopControlledUseReadinessPanel({ report }: { report: BuildLoopControlledUseReadiness }) {
  return (
    <section className="build-loop-controlled-use-readiness panel" data-testid="build-loop-controlled-use-readiness">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">Build Loop Readiness</p>
          <h1>Controlled-use status for AppEngine build workflow</h1>
          <p>{report.ownerReadableSummary}</p>
        </div>
        <div className="portfolio-summary-card">
          <span>Next operation</span>
          <strong>Run one real Life Produces Life build request</strong>
          <p>Use the completed build loop once with real internal ecosystem work before wider use.</p>
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
              <small>No blocker for internal controlled build use.</small>
            )}
          </article>
        ))}
      </div>

      <section>
        <p className="eyebrow">Build loop confirmation</p>
        <div className="opportunity-readiness-check-grid">
          {report.buildLoopChecks.map((check) => (
            <BuildLoopCheckCard check={check} key={check.key} />
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow">Exact blockers before autonomous/public use</p>
        <div className="guardrail-list">
          {report.exactBlockers.map((blocker) => (
            <span key={blocker}>{blocker}</span>
          ))}
        </div>
      </section>

      <div className="detail-grid">
        <section>
          <span>Build execution request</span>
          <p>{report.latestEvidence.buildExecutionRequestId || "No build execution request recorded yet"}</p>
        </section>
        <section>
          <span>Build loop dashboard</span>
          <p>{report.latestEvidence.buildLoopDashboardRequestId || "No active build loop dashboard request yet"}</p>
        </section>
        <section>
          <span>Latest builder result</span>
          <p>{report.latestEvidence.latestBuilderResultId || "No builder result imported yet"}</p>
        </section>
        <section>
          <span>Portfolio source</span>
          <p>{formatToken(report.latestEvidence.portfolioSource)}</p>
        </section>
        <section>
          <span>Project memory</span>
          <p>{report.latestEvidence.projectMemoryUpdatedAt}</p>
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

function BuildLoopCheckCard({ check }: { check: BuildLoopControlledUseCheck }) {
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
