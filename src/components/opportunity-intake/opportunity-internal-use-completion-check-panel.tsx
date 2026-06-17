import type {
  OpportunityInternalUseCompletionCheck,
  OpportunityInternalUseCompletionPathCheck
} from "@/lib/engine/opportunity-internal-use-completion-check";

export function OpportunityInternalUseCompletionCheckPanel({ report }: { report: OpportunityInternalUseCompletionCheck }) {
  return (
    <section
      className="opportunity-controlled-use-readiness opportunity-internal-use-completion panel"
      data-testid="opportunity-internal-use-completion-check"
    >
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">Opportunity Completion Check</p>
          <h1>Internal-use evidence for the Opportunity engine</h1>
          <p>{report.ownerReadableSummary}</p>
        </div>
        <div className="portfolio-summary-card">
          <span>Next operation</span>
          <strong>Run one real ecosystem build request</strong>
          <p>Use the prepared handoff to begin the next AppEngine build action manually.</p>
        </div>
      </div>

      <div className="opportunity-readiness-status-grid" data-testid="opportunity-internal-use-completion-status">
        {report.statuses.map((status) => (
          <article className={`readiness-status-card ${status.status} ${status.evidenceState}`} key={status.status}>
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
        <p className="eyebrow">Full internal-use path</p>
        <div className="opportunity-readiness-check-grid">
          {report.fullPathChecks.map((check) => (
            <CompletionCheckCard check={check} key={check.key} />
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow">Remaining blockers before wider use</p>
        <div className="guardrail-list">
          {report.exactRemainingBlockers.map((blocker) => (
            <span key={blocker}>{blocker}</span>
          ))}
        </div>
      </section>

      <div className="detail-grid">
        <section>
          <span>Real example</span>
          <p>{report.latestEvidence.realOpportunityExampleId || "No real example recorded yet"}</p>
        </section>
        <section>
          <span>Ready review</span>
          <p>{report.latestEvidence.realOpportunityResultReviewId || "No ready review recorded yet"}</p>
        </section>
        <section>
          <span>Prepared handoff</span>
          <p>{report.latestEvidence.preparedHandoffId || "No prepared handoff recorded yet"}</p>
        </section>
        <section>
          <span>Audit events</span>
          <p>{report.latestEvidence.auditEventCount}</p>
        </section>
      </div>

      <section>
        <p className="eyebrow">Next operational instruction</p>
        <textarea className="copyable-prompt-box" readOnly value={report.nextOperationalInstruction} />
      </section>
    </section>
  );
}

function CompletionCheckCard({ check }: { check: OpportunityInternalUseCompletionPathCheck }) {
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
