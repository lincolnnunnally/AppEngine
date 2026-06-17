import type { BuildLoopCompletionDashboard } from "@/lib/engine/build-execution-request";

type BuildLoopCompletionDashboardPanelProps = {
  report: BuildLoopCompletionDashboard;
};

export function BuildLoopCompletionDashboardPanel({ report }: BuildLoopCompletionDashboardPanelProps) {
  return (
    <section className="build-loop-completion-dashboard panel" data-testid="build-loop-completion-dashboard">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">Build Loop Completion</p>
          <h1>See the full path from request to verified result</h1>
          <p>
            This view pulls from AppEngine state that already exists: handoffs, packet drafts, build execution requests,
            builder results, verification evidence, portfolio state, project memory, and audit trail events.
          </p>
        </div>
        <div className={`build-loop-status-pill build-loop-status-${report.buildExecutionStatus}`}>
          {report.buildExecutionStatus.replaceAll("_", " ")}
        </div>
      </div>

      <div className="build-loop-summary-grid">
        <section>
          <span>Project / slice</span>
          <p>{report.targetProjectSlice}</p>
        </section>
        <section>
          <span>Source request</span>
          <p>{report.sourceProblemOrOpportunity}</p>
        </section>
        <section>
          <span>Packet draft</span>
          <p>{report.packetDraftTitle || "Not attached yet"}</p>
        </section>
        <section>
          <span>Review URL</span>
          <p>{report.reviewUrl || "Not available yet"}</p>
        </section>
        <section>
          <span>Verification</span>
          <p>{report.verificationStatus.replaceAll("_", " ")}</p>
        </section>
        <section>
          <span>Next safe action</span>
          <p>{report.nextSafeAction}</p>
        </section>
      </div>

      <div className="build-loop-step-grid">
        {report.steps.map((step, index) => (
          <article className={`build-loop-step-card build-loop-status-${step.status}`} key={step.id}>
            <div className="build-loop-step-heading">
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span>{step.status.replaceAll("_", " ")}</span>
            </div>
            <h2>{step.label}</h2>
            <p>{step.summary}</p>
            {step.evidence.length ? (
              <div>
                <p className="eyebrow">Evidence</p>
                <div className="guardrail-list">
                  {step.evidence.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {step.blockers.length || step.missingInformation.length ? (
              <div>
                <p className="eyebrow">Needs attention</p>
                <div className="guardrail-list warning">
                  {[...step.blockers, ...step.missingInformation].map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {report.blockers.length || report.missingInformation.length ? (
        <section className="build-loop-attention">
          <p className="eyebrow">Blockers and missing info</p>
          <div className="guardrail-list warning">
            {[...report.blockers, ...report.missingInformation].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      ) : null}

      {report.copyableNextActionPrompt ? (
        <section className="build-loop-copyable-action" data-testid="build-loop-copyable-next-action">
          <p className="eyebrow">Copyable next action</p>
          <textarea className="copyable-prompt-box" readOnly value={report.copyableNextActionPrompt} />
        </section>
      ) : null}

      <section className="build-loop-guardrails">
        <p className="eyebrow">Safety state</p>
        <div className="guardrail-list">
          <span>Derived from existing state only</span>
          <span>No parallel tracker</span>
          <span>No Codex auto-execution</span>
          <span>No GitHub issue creation</span>
          <span>No label changes</span>
          <span>No production deploy</span>
          <span>No paid resources</span>
          <span>No live migrations</span>
          <span>No secrets/env changes</span>
        </div>
      </section>
    </section>
  );
}
