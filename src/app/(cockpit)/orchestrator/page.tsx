import { redirect } from "next/navigation";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { createOrchestratorAutonomyRoadmap } from "@/lib/engine/orchestrator-autonomy-roadmap";
import { createExecutionDispatcherDryRun } from "@/lib/engine/execution-dispatcher-dry-run";

export const dynamic = "force-dynamic";

export default async function OrchestratorPage() {
  if (!(await canAccessEngineOwner())) {
    redirect("/soft-launch");
  }

  const roadmap = createOrchestratorAutonomyRoadmap();
  // Dry run with no handoff/approval yet — shows the honest current state
  // (blocked on durable persistence, the roadmap's #1 prerequisite).
  const dispatch = createExecutionDispatcherDryRun();

  return (
    <main className="shell wide-shell" data-testid="orchestrator-page">
      <section className="card">
        <p className="eyebrow">Factory Conductor</p>
        <h1>Orchestrator</h1>
        <p>
          The conductor that moves a build from intake to deployment through the agents — gated, owner-approved, and
          visible. Nothing runs automatically: every step that touches a repo, a deploy, or money waits for you.
        </p>
        <div className="guardrail-strip" aria-label="Orchestrator guardrails">
          <span>Owner approval required</span>
          <span>No auto Codex execution</span>
          <span>No surprise deploy or spend</span>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">The loop</p>
        <div className="detail-grid">
          {roadmap.workflow.map((step) => (
            <article key={step.stage} data-testid={`stage-${step.stage}`}>
              <p className="eyebrow">{step.stage.replaceAll("_", " ")}</p>
              <p>{step.currentState}</p>
              <p className="empty-state">
                <strong>Next:</strong> {step.nextAutomationStep}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="card" data-testid="dispatcher-dry-run">
        <p className="eyebrow">Execution dispatcher (dry run)</p>
        <h2>Hand a build to the builder — without copy/paste</h2>
        <p>
          Status: <code>{dispatch.status}</code>. This replaces copying a prompt into Codex with a controlled,
          owner-approved workflow dispatch. It is a <strong>dry run</strong> — it never dispatches; it shows the draft
          and what must be true first.
        </p>
        <div className="detail-grid">
          {dispatch.checks.map((item) => (
            <div key={item.id}>
              <p className="eyebrow" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{item.label}</span>
                <code>{item.status}</code>
              </p>
              <p className="empty-state">{item.evidence}</p>
            </div>
          ))}
        </div>
        <p className="empty-state" style={{ marginTop: 12 }}>
          <strong>Draft dispatch:</strong> <code>{dispatch.dispatchDraft.targetWorkflow}</code> @{" "}
          <code>{dispatch.dispatchDraft.ref}</code> · mode <code>{dispatch.dispatchDraft.inputs.mode}</code>
        </p>
        <p>
          <strong>Next safe action:</strong> {dispatch.nextSafeAction}
        </p>
      </section>

      <section className="card">
        <p className="eyebrow">Biggest autonomy gains next (ranked)</p>
        <ol>
          {roadmap.rankedAutomationValue.map((point) => (
            <li key={point.id}>
              <strong>{point.recommendedAutomation}</strong> — value {point.automationValue}, risk {point.risk}
              {point.ownerApprovalStillRequired ? " (owner approval still required)" : ""}.
            </li>
          ))}
        </ol>
        <p className="empty-state">{roadmap.ownerReadableSummary}</p>
      </section>
    </main>
  );
}
