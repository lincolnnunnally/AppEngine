"use client";

import { useState } from "react";
import type { OpportunityActionPlanRecord, OpportunityActionPlanType } from "@/lib/engine/opportunity-action-plan";
import type {
  OpportunityAppEngineCandidateRecord,
  OpportunityAppEngineCandidateType
} from "@/lib/engine/opportunity-appengine-candidate";
import type {
  OpportunityBuildPacketBridgeDraftKind,
  OpportunityBuildPacketBridgeRecord
} from "@/lib/engine/opportunity-build-packet-bridge";
import type {
  OpportunityClarificationRecord,
  OpportunityClarificationRoute,
  OpportunityClarificationStatus
} from "@/lib/engine/opportunity-clarification";
import type { OpportunityFullLoopTrialRecord } from "@/lib/engine/opportunity-full-loop-trial";
import type { OpportunityIntakeRecord, OpportunityRoute, OpportunityStatus } from "@/lib/engine/opportunity-intake";
import type {
  OpportunitySolutionPathConfidence,
  OpportunitySolutionPathRecord,
  OpportunitySolutionPathRoute
} from "@/lib/engine/opportunity-solution-path";
import type {
  RealOpportunityExampleContext,
  RealOpportunityExampleRunRecord
} from "@/lib/engine/real-opportunity-example-runner";
import type {
  RealOpportunityResultReviewRecord,
  RealOpportunityResultReviewStatus
} from "@/lib/engine/real-opportunity-result-review";

const statusLabels: Record<OpportunityStatus, string> = {
  submitted: "Submitted",
  needs_clarification: "Needs clarification",
  ready_for_appengine_review: "Ready for AppEngine review"
};

const routeLabels: Record<OpportunityRoute, string> = {
  app_tool_workflow_need: "App/tool/workflow need",
  content_resource_need: "Content/resource need",
  community_ministry_model_need: "Community/ministry model need",
  existing_ecosystem_service_later: "Possible ecosystem service later",
  needs_clarification: "Needs clarification"
};

const clarificationStatusLabels: Record<OpportunityClarificationStatus, string> = {
  clarified: "Clarified",
  needs_more_info: "Needs more info",
  not_actionable_yet: "Not actionable yet",
  safety_sensitive: "Safety sensitive"
};

const clarificationRouteLabels: Record<OpportunityClarificationRoute, string> = {
  app_tool_workflow: "App/tool/workflow",
  content_resource: "Content/resource",
  community_ministry_model: "Community/ministry model",
  existing_ecosystem_service_later: "Existing ecosystem service later",
  appengine_build_candidate: "AppEngine build candidate"
};

const solutionPathLabels: Record<OpportunitySolutionPathRoute, string> = {
  appengine_build_candidate: "AppEngine build candidate",
  app_tool_workflow: "App/tool/workflow",
  content_resource: "Content/resource",
  community_ministry_model: "Community/ministry model",
  existing_ecosystem_service_later: "Existing ecosystem service later",
  needs_more_info: "Needs more info",
  not_safe_or_not_ready: "Not safe or not ready"
};

const confidenceLabels: Record<OpportunitySolutionPathConfidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence"
};

const actionPlanLabels: Record<OpportunityActionPlanType, string> = {
  app_tool_workflow_plan: "App/tool/workflow plan",
  content_resource_plan: "Content/resource plan",
  community_ministry_model_plan: "Community/ministry model plan",
  ecosystem_service_later_plan: "Ecosystem-service-later plan",
  needs_more_info_plan: "Needs-more-info plan"
};

const appEngineCandidateLabels: Record<OpportunityAppEngineCandidateType, string> = {
  app_build_candidate: "App build candidate",
  workflow_candidate: "Workflow candidate",
  content_resource_candidate: "Content/resource candidate",
  community_model_candidate: "Community model candidate",
  ecosystem_service_later_candidate: "Ecosystem service later",
  needs_more_info: "Needs more info"
};

const packetDraftLabels: Record<OpportunityBuildPacketBridgeDraftKind, string> = {
  app_build_packet_draft: "App Build Packet draft",
  workflow_solution_plan_draft: "Workflow solution plan draft",
  content_resource_plan_draft: "Content/resource plan draft",
  community_model_plan_draft: "Community model plan draft"
};

const realOpportunityResultReviewLabels: Record<RealOpportunityResultReviewStatus, string> = {
  useful: "Useful",
  needs_clarification: "Needs clarification",
  wrong_direction: "Wrong direction",
  missing_requirement: "Missing requirement",
  ready_for_next_appengine_action: "Ready for next AppEngine action"
};

export function OwnerOpportunityQueue({
  initialActionPlans,
  initialAppEngineCandidates,
  initialBuildPacketBridges,
  initialClarifications,
  initialFullLoopTrials,
  initialRealOpportunityExamples,
  initialRealOpportunityResultReviews,
  initialRecords,
  initialSolutionPaths
}: {
  initialActionPlans: OpportunityActionPlanRecord[];
  initialAppEngineCandidates: OpportunityAppEngineCandidateRecord[];
  initialBuildPacketBridges: OpportunityBuildPacketBridgeRecord[];
  initialClarifications: OpportunityClarificationRecord[];
  initialFullLoopTrials: OpportunityFullLoopTrialRecord[];
  initialRealOpportunityExamples: RealOpportunityExampleRunRecord[];
  initialRealOpportunityResultReviews: RealOpportunityResultReviewRecord[];
  initialRecords: OpportunityIntakeRecord[];
  initialSolutionPaths: OpportunitySolutionPathRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [actionPlans, setActionPlans] = useState(initialActionPlans);
  const [appEngineCandidates, setAppEngineCandidates] = useState(initialAppEngineCandidates);
  const [buildPacketBridges, setBuildPacketBridges] = useState(initialBuildPacketBridges);
  const [clarifications, setClarifications] = useState(initialClarifications);
  const [fullLoopTrials, setFullLoopTrials] = useState(initialFullLoopTrials);
  const [realOpportunityExamples, setRealOpportunityExamples] = useState(initialRealOpportunityExamples);
  const [realOpportunityResultReviews, setRealOpportunityResultReviews] = useState(
    initialRealOpportunityResultReviews
  );
  const [solutionPaths, setSolutionPaths] = useState(initialSolutionPaths);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id || "");
  const [isPreparingPacketDraft, setIsPreparingPacketDraft] = useState(false);
  const [isCreatingCandidate, setIsCreatingCandidate] = useState(false);
  const [isDraftingPlan, setIsDraftingPlan] = useState(false);
  const [isRunningFullLoopTrial, setIsRunningFullLoopTrial] = useState(false);
  const [isRunningRealExample, setIsRunningRealExample] = useState(false);
  const [isSavingRealExampleReview, setIsSavingRealExampleReview] = useState(false);
  const [isClarifying, setIsClarifying] = useState(false);
  const [isRoutingPath, setIsRoutingPath] = useState(false);
  const [actionPlanNotice, setActionPlanNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [appEngineCandidateNotice, setAppEngineCandidateNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [packetDraftNotice, setPacketDraftNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [fullLoopNotice, setFullLoopNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [realExampleNotice, setRealExampleNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [realExampleReviewNotice, setRealExampleReviewNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [clarificationNotice, setClarificationNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [solutionPathNotice, setSolutionPathNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const selectedRecord = records.find((record) => record.id === selectedId) || records[0];
  const selectedClarification = selectedRecord
    ? clarifications.find((clarification) => clarification.intakeId === selectedRecord.id)
    : null;
  const selectedSolutionPath = selectedClarification
    ? solutionPaths.find((path) => path.clarificationId === selectedClarification.id)
    : null;
  const selectedActionPlan = selectedSolutionPath
    ? actionPlans.find((plan) => plan.solutionPathId === selectedSolutionPath.id)
    : null;
  const selectedAppEngineCandidate = selectedActionPlan
    ? appEngineCandidates.find((candidate) => candidate.actionPlanId === selectedActionPlan.id)
    : null;
  const selectedBuildPacketBridge = selectedAppEngineCandidate
    ? buildPacketBridges.find((bridge) => bridge.candidateId === selectedAppEngineCandidate.id)
    : null;
  const needsClarificationCount = records.filter((record) => record.status === "needs_clarification").length;
  const readyCount = records.filter((record) => record.status === "ready_for_appengine_review").length;
  const latestFullLoopTrial = fullLoopTrials[0] || null;
  const latestRealExample = realOpportunityExamples[0] || null;
  const latestRealExampleReview = latestRealExample
    ? realOpportunityResultReviews.find((review) => review.exampleId === latestRealExample.id) || null
    : realOpportunityResultReviews[0] || null;
  const [realExampleForm, setRealExampleForm] = useState<{
    problemOrVision: string;
    affectedPeople: string;
    betterFuture: string;
    barriers: string;
    desiredImpact: string;
    exampleContext: RealOpportunityExampleContext;
  }>({
    problemOrVision: "",
    affectedPeople: "",
    betterFuture: "",
    barriers: "",
    desiredImpact: "",
    exampleContext: "lincoln_ecosystem"
  });
  const [realExampleReviewForm, setRealExampleReviewForm] = useState<{
    status: RealOpportunityResultReviewStatus;
    ownerNotes: string;
  }>({
    status: "useful",
    ownerNotes: ""
  });

  async function refreshOpportunityArtifacts(intakeId?: string | null) {
    const [
      intakeResponse,
      clarificationResponse,
      solutionPathResponse,
      actionPlanResponse,
      candidateResponse,
      bridgeResponse,
      fullLoopResponse,
      realExampleResponse,
      realExampleReviewResponse
    ] = await Promise.all([
      fetch("/api/opportunity-intake", { cache: "no-store" }),
      fetch("/api/opportunity-clarification", { cache: "no-store" }),
      fetch("/api/opportunity-solution-path", { cache: "no-store" }),
      fetch("/api/opportunity-action-plan", { cache: "no-store" }),
      fetch("/api/opportunity-appengine-candidate", { cache: "no-store" }),
      fetch("/api/opportunity-build-packet-bridge", { cache: "no-store" }),
      fetch("/api/opportunity-full-loop-trial", { cache: "no-store" }),
      fetch("/api/real-opportunity-example-runner", { cache: "no-store" }),
      fetch("/api/real-opportunity-result-review", { cache: "no-store" })
    ]);

    const [
      intakeResult,
      clarificationResult,
      solutionPathResult,
      actionPlanResult,
      candidateResult,
      bridgeResult,
      fullLoopResult,
      realExampleResult,
      realExampleReviewResult
    ] = await Promise.all([
      intakeResponse.json(),
      clarificationResponse.json(),
      solutionPathResponse.json(),
      actionPlanResponse.json(),
      candidateResponse.json(),
      bridgeResponse.json(),
      fullLoopResponse.json(),
      realExampleResponse.json(),
      realExampleReviewResponse.json()
    ]);

    if (intakeResult.ok) {
      setRecords(intakeResult.records);
      if (intakeId) setSelectedId(intakeId);
    }

    if (clarificationResult.ok) setClarifications(clarificationResult.records);
    if (solutionPathResult.ok) setSolutionPaths(solutionPathResult.records);
    if (actionPlanResult.ok) setActionPlans(actionPlanResult.records);
    if (candidateResult.ok) setAppEngineCandidates(candidateResult.records);
    if (bridgeResult.ok) setBuildPacketBridges(bridgeResult.records);
    if (fullLoopResult.ok) setFullLoopTrials(fullLoopResult.records);
    if (realExampleResult.ok) setRealOpportunityExamples(realExampleResult.records);
    if (realExampleReviewResult.ok) setRealOpportunityResultReviews(realExampleReviewResult.records);
  }

  function updateRealExampleField(field: keyof typeof realExampleForm, value: string) {
    setRealExampleForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateRealExampleReviewStatus(value: string) {
    if (value in realOpportunityResultReviewLabels) {
      setRealExampleReviewForm((current) => ({
        ...current,
        status: value as RealOpportunityResultReviewStatus
      }));
    }
  }

  function realExampleArtifactSummary(kind: string) {
    return latestRealExample?.fullLoopTrial.sourceArtifacts.find((artifact) => artifact.kind === kind)?.summary || "Not available yet.";
  }

  async function runFullLoopTrial() {
    setIsRunningFullLoopTrial(true);
    setFullLoopNotice(null);

    try {
      const response = await fetch("/api/opportunity-full-loop-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The Opportunity full-loop trial could not run.");
      }

      const record = result.record as OpportunityFullLoopTrialRecord;

      setFullLoopTrials((current) => [record, ...current.filter((item) => item.id !== record.id)]);

      if (record.artifacts.intakeId || record.artifacts.clarificationId || record.artifacts.solutionPathId) {
        await refreshOpportunityArtifacts(record.artifacts.intakeId || selectedId);
      }

      setFullLoopNotice({
        type: record.status === "completed" ? "success" : "error",
        message:
          record.status === "completed"
            ? "Opportunity full loop reached packet draft readiness without Codex, issues, labels, deploys, migrations, paid resources, or env changes."
            : record.nextSafeAction
      });
    } catch (caught) {
      setFullLoopNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The Opportunity full-loop trial could not run."
      });
    } finally {
      setIsRunningFullLoopTrial(false);
    }
  }

  async function runRealOpportunityExample() {
    setIsRunningRealExample(true);
    setRealExampleNotice(null);

    try {
      const response = await fetch("/api/real-opportunity-example-runner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(realExampleForm)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The real Opportunity example could not run.");
      }

      const record = result.record as RealOpportunityExampleRunRecord;
      setRealOpportunityExamples((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setFullLoopTrials((current) => [
        record.fullLoopTrial,
        ...current.filter((item) => item.id !== record.fullLoopTrial.id)
      ]);
      await refreshOpportunityArtifacts(record.artifacts.intakeId);
      setRealExampleNotice({
        type: record.status === "completed" ? "success" : "error",
        message:
          record.status === "completed"
            ? "Real Opportunity example reached packet draft readiness. Codex, issues, labels, deploys, migrations, paid resources, and env changes stayed blocked."
            : record.nextSafeAction
      });
    } catch (caught) {
      setRealExampleNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The real Opportunity example could not run."
      });
    } finally {
      setIsRunningRealExample(false);
    }
  }

  async function saveRealOpportunityResultReview() {
    if (!latestRealExample) return;

    setIsSavingRealExampleReview(true);
    setRealExampleReviewNotice(null);

    try {
      const response = await fetch("/api/real-opportunity-result-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          exampleId: latestRealExample.id,
          status: realExampleReviewForm.status,
          ownerNotes: realExampleReviewForm.ownerNotes
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The real Opportunity result review could not be saved.");
      }

      const record = result.record as RealOpportunityResultReviewRecord;
      setRealOpportunityResultReviews((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      await refreshOpportunityArtifacts(latestRealExample.artifacts.intakeId);
      setRealExampleReviewNotice({
        type: record.reviewStatus === "ready_for_next_appengine_action" ? "success" : "error",
        message:
          record.reviewStatus === "ready_for_next_appengine_action"
            ? "Result review saved and portfolio state can show readiness for the next AppEngine action. Codex, issues, labels, final packets, deploys, migrations, paid resources, and env changes stayed blocked."
            : record.portfolioStateUpdate.blocker || record.nextAppEngineAction.expectedOutcome
      });
    } catch (caught) {
      setRealExampleReviewNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The real Opportunity result review could not be saved."
      });
    } finally {
      setIsSavingRealExampleReview(false);
    }
  }

  async function clarifySelectedOpportunity() {
    if (!selectedRecord) return;

    setIsClarifying(true);
    setClarificationNotice(null);

    try {
      const response = await fetch("/api/opportunity-clarification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          intakeId: selectedRecord.id
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The clarification could not be created.");
      }

      setClarifications((current) => [result.record, ...current.filter((item) => item.intakeId !== selectedRecord.id)]);
      setClarificationNotice({
        type: "success",
        message: "Clarification saved. No Codex run, issue, label, deploy, migration, paid resource, or env change was triggered."
      });
    } catch (caught) {
      setClarificationNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The clarification could not be created."
      });
    } finally {
      setIsClarifying(false);
    }
  }

  async function routeSelectedOpportunityPath() {
    if (!selectedClarification) return;

    setIsRoutingPath(true);
    setSolutionPathNotice(null);

    try {
      const response = await fetch("/api/opportunity-solution-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clarificationId: selectedClarification.id
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The solution path could not be created.");
      }

      setSolutionPaths((current) => [
        result.record,
        ...current.filter((item) => item.clarificationId !== selectedClarification.id)
      ]);
      setSolutionPathNotice({
        type: "success",
        message: "Solution path saved. No packet, Codex run, issue, label, deploy, migration, paid resource, or env change was triggered."
      });
    } catch (caught) {
      setSolutionPathNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The solution path could not be created."
      });
    } finally {
      setIsRoutingPath(false);
    }
  }

  async function draftSelectedActionPlan() {
    if (!selectedSolutionPath) return;

    setIsDraftingPlan(true);
    setActionPlanNotice(null);

    try {
      const response = await fetch("/api/opportunity-action-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          solutionPathId: selectedSolutionPath.id
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The action plan could not be created.");
      }

      setActionPlans((current) => [
        result.record,
        ...current.filter((item) => item.solutionPathId !== selectedSolutionPath.id)
      ]);
      setActionPlanNotice({
        type: "success",
        message: "Action plan saved. No packet, Codex run, issue, label, deploy, migration, paid resource, or env change was triggered."
      });
    } catch (caught) {
      setActionPlanNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The action plan could not be created."
      });
    } finally {
      setIsDraftingPlan(false);
    }
  }

  async function createSelectedAppEngineCandidate() {
    if (!selectedActionPlan) return;

    setIsCreatingCandidate(true);
    setAppEngineCandidateNotice(null);

    try {
      const response = await fetch("/api/opportunity-appengine-candidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          actionPlanId: selectedActionPlan.id
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The AppEngine candidate could not be created.");
      }

      setAppEngineCandidates((current) => [
        result.record,
        ...current.filter((item) => item.actionPlanId !== selectedActionPlan.id)
      ]);
      setAppEngineCandidateNotice({
        type: "success",
        message: "AppEngine candidate saved. No packet, Codex run, issue, label, deploy, migration, paid resource, or env change was triggered."
      });
    } catch (caught) {
      setAppEngineCandidateNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The AppEngine candidate could not be created."
      });
    } finally {
      setIsCreatingCandidate(false);
    }
  }

  async function prepareSelectedPacketDraft() {
    if (!selectedAppEngineCandidate) return;

    setIsPreparingPacketDraft(true);
    setPacketDraftNotice(null);

    try {
      const response = await fetch("/api/opportunity-build-packet-bridge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          candidateId: selectedAppEngineCandidate.id,
          ownerApproved: true
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The packet draft could not be prepared.");
      }

      setBuildPacketBridges((current) => [
        result.record,
        ...current.filter((item) => item.candidateId !== selectedAppEngineCandidate.id)
      ]);
      setPacketDraftNotice({
        type: "success",
        message:
          "Packet draft prepared for owner review. No final packet, Codex run, GitHub issue, label, deploy, migration, paid resource, secret, or env change was triggered."
      });
    } catch (caught) {
      setPacketDraftNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The packet draft could not be prepared."
      });
    } finally {
      setIsPreparingPacketDraft(false);
    }
  }

  return (
    <section className="owner-control-layout opportunity-owner-queue" data-testid="opportunity-owner-queue">
      <div className="owner-control-header panel">
        <div>
          <p className="eyebrow">Opportunity Queue</p>
          <h1>Review customer-facing opportunities before they become AppEngine work.</h1>
          <p>
            Opportunity captures the first signal. Owner review decides whether it becomes a problem intake, portfolio
            candidate, non-app plan, or clarification request.
          </p>
        </div>
        <div className="owner-summary-grid">
          <div className="owner-summary-item">
            <span>Total</span>
            <strong>{records.length}</strong>
          </div>
          <div className="owner-summary-item">
            <span>Ready</span>
            <strong>{readyCount}</strong>
          </div>
          <div className="owner-summary-item">
            <span>Clarify</span>
            <strong>{needsClarificationCount}</strong>
          </div>
        </div>
      </div>

      <section className="opportunity-full-loop-panel panel" data-testid="opportunity-full-loop-trial">
        <div className="queue-header">
          <div>
            <p className="eyebrow">Full Loop Trial</p>
            <h2>Run Opportunity from intake to packet draft readiness.</h2>
            <p>
              This rehearses the complete safe path using existing artifacts: intake, clarification, route, action plan,
              candidate, owner approval, packet draft, memory, audit trail, and next action.
            </p>
          </div>
          <button className="button accent" disabled={isRunningFullLoopTrial} onClick={runFullLoopTrial} type="button">
            {isRunningFullLoopTrial ? "Running..." : "Run Opportunity Full Loop Trial"}
          </button>
        </div>

        {fullLoopNotice ? (
          <div className={`workflow-feedback${fullLoopNotice.type === "error" ? " error" : ""}`} role="status">
            <strong>{fullLoopNotice.type === "success" ? "Full loop completed" : "Trial needs attention"}</strong>
            <p>{fullLoopNotice.message}</p>
          </div>
        ) : null}

        {latestFullLoopTrial ? (
          <div className="opportunity-full-loop-output" data-testid="opportunity-full-loop-output">
            <div className="artifact-strip">
              <span>{latestFullLoopTrial.status.replaceAll("_", " ")}</span>
              <span>
                {latestFullLoopTrial.packetDraftReadiness.ready ? "Packet draft ready" : "Packet draft not ready"}
              </span>
              <span>{latestFullLoopTrial.packetDraftReadiness.packetType.replaceAll("_", " ")}</span>
            </div>

            <section className="next-action-band">
              <span>Owner-readable result</span>
              <strong>{latestFullLoopTrial.ownerReadableSummary}</strong>
            </section>

            <div className="detail-grid">
              <section>
                <span>Portfolio Dashboard visibility</span>
                <p>
                  {latestFullLoopTrial.packetDraftReadiness.portfolioEntryVisible
                    ? `Visible through ${latestFullLoopTrial.packetDraftReadiness.portfolioSourceState.replaceAll("_", " ")} state.`
                    : "Not visible yet."}
                </p>
              </section>
              <section>
                <span>Next safe action</span>
                <p>{latestFullLoopTrial.nextSafeAction}</p>
              </section>
            </div>

            <section>
              <p className="eyebrow">Completed / blocked steps</p>
              <div className="trial-step-list">
                {latestFullLoopTrial.steps.map((step) => (
                  <article className={`trial-step ${step.status}`} key={step.id}>
                    <span>{step.status.replaceAll("_", " ")}</span>
                    <strong>{step.label}</strong>
                    <p>{step.blocker || step.summary}</p>
                    {step.artifactKind ? <small>{step.artifactKind.replaceAll("_", " ")} · {step.artifactId}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section>
              <p className="eyebrow">Missing information</p>
              <div className="guardrail-list">
                {latestFullLoopTrial.missingInformation.length ? (
                  latestFullLoopTrial.missingInformation.map((item) => <span key={item}>{item}</span>)
                ) : (
                  <span>None</span>
                )}
              </div>
            </section>

            <section>
              <p className="eyebrow">Copyable Next Action</p>
              <textarea className="copyable-prompt-box" readOnly value={latestFullLoopTrial.copyableNextAction} />
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <strong>No full-loop trial has run yet</strong>
            <p>Run the trial to prove Opportunity can move from submitted problem to packet draft readiness safely.</p>
          </div>
        )}
      </section>

      <section className="real-opportunity-example-panel panel" data-testid="real-opportunity-example-runner">
        <div className="queue-header">
          <div>
            <p className="eyebrow">Real Internal Example</p>
            <h2>Run one real problem or vision through Opportunity.</h2>
            <p>
              Enter one real internal example. AppEngine will create the intake, clarification, solution path, action
              plan, AppEngine candidate, packet draft bridge, memory update, audit trail, and next safe action.
            </p>
          </div>
          <button className="button accent" disabled={isRunningRealExample} onClick={runRealOpportunityExample} type="button">
            {isRunningRealExample ? "Running..." : "Run Real Opportunity Example"}
          </button>
        </div>

        <div className="real-opportunity-form-grid">
          <label>
            <span>Problem or vision</span>
            <textarea
              value={realExampleForm.problemOrVision}
              onChange={(event) => updateRealExampleField("problemOrVision", event.target.value)}
              placeholder="What problem do you see, or what vision do you want to test?"
            />
          </label>
          <label>
            <span>Who is affected</span>
            <textarea
              value={realExampleForm.affectedPeople}
              onChange={(event) => updateRealExampleField("affectedPeople", event.target.value)}
              placeholder="Who feels this problem or would benefit from the better future?"
            />
          </label>
          <label>
            <span>Desired better future</span>
            <textarea
              value={realExampleForm.betterFuture}
              onChange={(event) => updateRealExampleField("betterFuture", event.target.value)}
              placeholder="What would be meaningfully better if this worked?"
            />
          </label>
          <label>
            <span>Current barriers</span>
            <textarea
              value={realExampleForm.barriers}
              onChange={(event) => updateRealExampleField("barriers", event.target.value)}
              placeholder="What is blocking progress right now?"
            />
          </label>
          <label>
            <span>Desired impact</span>
            <textarea
              value={realExampleForm.desiredImpact}
              onChange={(event) => updateRealExampleField("desiredImpact", event.target.value)}
              placeholder="What kind of change should this help create?"
            />
          </label>
          <label>
            <span>Who is this for?</span>
            <select
              value={realExampleForm.exampleContext}
              onChange={(event) => updateRealExampleField("exampleContext", event.target.value)}
            >
              <option value="lincoln_ecosystem">Lincoln&apos;s ecosystem</option>
              <option value="outside_customer_community_leader">Outside customer/community leader</option>
            </select>
          </label>
        </div>

        {realExampleNotice ? (
          <div className={`workflow-feedback${realExampleNotice.type === "error" ? " error" : ""}`} role="status">
            <strong>{realExampleNotice.type === "success" ? "Real example completed" : "Real example needs attention"}</strong>
            <p>{realExampleNotice.message}</p>
          </div>
        ) : null}

        {latestRealExample ? (
          <div className="real-opportunity-example-output" data-testid="real-opportunity-example-output">
            <div className="artifact-strip">
              <span>{latestRealExample.status.replaceAll("_", " ")}</span>
              <span>{latestRealExample.exampleContext.replaceAll("_", " ")}</span>
              <span>{latestRealExample.fullLoopTrial.packetDraftReadiness.packetType.replaceAll("_", " ")}</span>
            </div>

            <section className="next-action-band">
              <span>Result</span>
              <strong>{latestRealExample.ownerReadableSummary}</strong>
            </section>

            <div className="detail-grid">
              <section>
                <span>Problem or vision</span>
                <p>{latestRealExample.sourceInput.problemOrVision}</p>
              </section>
              <section>
                <span>Who is affected</span>
                <p>{latestRealExample.sourceInput.affectedPeople}</p>
              </section>
              <section>
                <span>Desired better future</span>
                <p>{latestRealExample.sourceInput.betterFuture}</p>
              </section>
              <section>
                <span>Next safe action</span>
                <p>{latestRealExample.nextSafeAction}</p>
              </section>
            </div>

            <section>
              <p className="eyebrow">Step results</p>
              <div className="trial-step-list">
                {latestRealExample.steps.map((step) => (
                  <article className={`trial-step ${step.status}`} key={`${latestRealExample.id}-${step.id}`}>
                    <span>{step.status.replaceAll("_", " ")}</span>
                    <strong>{step.label}</strong>
                    <p>{step.blocker || step.summary}</p>
                    {step.artifactKind ? <small>{step.artifactKind.replaceAll("_", " ")} · {step.artifactId}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section>
              <p className="eyebrow">Blockers / missing information</p>
              <div className="guardrail-list">
                {latestRealExample.missingInformation.length ? (
                  latestRealExample.missingInformation.map((item) => <span key={item}>{item}</span>)
                ) : (
                  <span>None</span>
                )}
              </div>
            </section>

            <section>
              <p className="eyebrow">Copyable Next Safe Action</p>
              <textarea className="copyable-prompt-box" readOnly value={latestRealExample.copyableNextAction} />
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <strong>No real example has run yet</strong>
            <p>Enter one real internal problem or vision to prove the controlled-use flow with actual owner context.</p>
          </div>
        )}

        {latestRealExample ? (
          <section className="real-opportunity-result-review" data-testid="real-opportunity-result-review">
            <div className="queue-header compact">
              <div>
                <p className="eyebrow">Result Review</p>
                <h3>Decide whether this result is ready to move forward.</h3>
                <p>
                  Review the real example output before AppEngine prepares any next action. This stores your decision,
                  updates memory, writes audit evidence, and keeps execution blocked.
                </p>
              </div>
              <button
                className="button"
                disabled={isSavingRealExampleReview}
                onClick={saveRealOpportunityResultReview}
                type="button"
              >
                {isSavingRealExampleReview ? "Saving..." : "Save Result Review"}
              </button>
            </div>

            <div className="real-opportunity-review-grid">
              <section>
                <span>Original problem/vision</span>
                <p>{latestRealExample.sourceInput.problemOrVision}</p>
              </section>
              <section>
                <span>Clarification</span>
                <p>{realExampleArtifactSummary("opportunity_clarification")}</p>
              </section>
              <section>
                <span>Solution path</span>
                <p>{realExampleArtifactSummary("opportunity_solution_path")}</p>
              </section>
              <section>
                <span>Action plan</span>
                <p>{realExampleArtifactSummary("opportunity_action_plan")}</p>
              </section>
              <section>
                <span>AppEngine candidate</span>
                <p>{realExampleArtifactSummary("opportunity_appengine_candidate")}</p>
              </section>
              <section>
                <span>Packet draft bridge state</span>
                <p>
                  {realExampleArtifactSummary("opportunity_build_packet_bridge")} ·{" "}
                  {latestRealExample.fullLoopTrial.packetDraftReadiness.status.replaceAll("_", " ")}
                </p>
              </section>
            </div>

            <div className="real-opportunity-review-form">
              <label>
                <span>Review status</span>
                <select
                  value={realExampleReviewForm.status}
                  onChange={(event) => updateRealExampleReviewStatus(event.target.value)}
                >
                  {Object.entries(realOpportunityResultReviewLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Owner notes</span>
                <textarea
                  value={realExampleReviewForm.ownerNotes}
                  onChange={(event) =>
                    setRealExampleReviewForm((current) => ({
                      ...current,
                      ownerNotes: event.target.value
                    }))
                  }
                  placeholder="What was useful, wrong, incomplete, or ready to move forward?"
                />
              </label>
            </div>

            {realExampleReviewNotice ? (
              <div className={`workflow-feedback${realExampleReviewNotice.type === "error" ? " error" : ""}`} role="status">
                <strong>
                  {realExampleReviewNotice.type === "success"
                    ? "Result review saved"
                    : "Result review needs attention"}
                </strong>
                <p>{realExampleReviewNotice.message}</p>
              </div>
            ) : null}

            {latestRealExampleReview ? (
              <div className="real-opportunity-review-output" data-testid="real-opportunity-result-review-output">
                <div className="artifact-strip">
                  <span>{realOpportunityResultReviewLabels[latestRealExampleReview.reviewStatus]}</span>
                  <span>
                    {latestRealExampleReview.portfolioStateUpdate.shouldUpdate
                      ? "Portfolio ready state"
                      : "Portfolio held"}
                  </span>
                  <span>{latestRealExampleReview.nextAppEngineAction.expectedOutcome}</span>
                </div>
                <section className="next-action-band">
                  <span>Saved review</span>
                  <strong>{latestRealExampleReview.ownerReadableSummary}</strong>
                </section>
                <div className="detail-grid">
                  <section>
                    <span>Owner notes</span>
                    <p>{latestRealExampleReview.ownerNotes || "None"}</p>
                  </section>
                  <section>
                    <span>Next safe action</span>
                    <p>{latestRealExampleReview.portfolioStateUpdate.status}</p>
                  </section>
                </div>
                <section>
                  <p className="eyebrow">Copyable Next AppEngine Prompt</p>
                  <textarea className="copyable-prompt-box" readOnly value={latestRealExampleReview.nextAppEngineAction.prompt} />
                </section>
              </div>
            ) : (
              <div className="empty-state">
                <strong>No result review saved yet</strong>
                <p>Save a review to decide whether this real example is useful, incomplete, wrong, or ready to move forward.</p>
              </div>
            )}
          </section>
        ) : null}
      </section>

      <div className="owner-control-main">
        <aside className="problem-queue panel" aria-label="Submitted opportunities">
          <div className="queue-header">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Opportunity intakes</h2>
            </div>
            <span className="status-chip">{records.length} saved</span>
          </div>

          {records.length ? (
            <div className="queue-list">
              {records.map((record) => (
                <button
                  className={`queue-item${selectedRecord?.id === record.id ? " selected" : ""}`}
                  key={record.id}
                  onClick={() => setSelectedId(record.id)}
                  type="button"
                >
                  <span>{statusLabels[record.status]}</span>
                  <strong>{record.title}</strong>
                  <small>{routeLabels[record.route]}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No opportunities yet</strong>
              <p>Public opportunity submissions will appear here for owner review.</p>
            </div>
          )}
        </aside>

        <div className="owner-detail-panel panel">
          {selectedRecord ? (
            <>
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">{statusLabels[selectedRecord.status]}</p>
                  <h2>{selectedRecord.title}</h2>
                  <p>{selectedRecord.problemPain}</p>
                </div>
                <span className="status-chip">{routeLabels[selectedRecord.route]}</span>
              </div>

              <div className="detail-grid">
                <section>
                  <span>Who is affected</span>
                  <p>{selectedRecord.affectedPeople}</p>
                </section>
                <section>
                  <span>Better outcome</span>
                  <p>{selectedRecord.betterOutcome}</p>
                </section>
                <section>
                  <span>Current barriers</span>
                  <p>{selectedRecord.currentBarriers}</p>
                </section>
                <section>
                  <span>Desired impact</span>
                  <p>{selectedRecord.desiredImpact}</p>
                </section>
              </div>

              {selectedRecord.existingIdeaVision ? (
                <section className="next-action-band">
                  <span>Existing idea or vision</span>
                  <strong>{selectedRecord.existingIdeaVision}</strong>
                </section>
              ) : null}

              <section className="next-action-band">
                <span>Next recommended action</span>
                <strong>{selectedRecord.nextRecommendedAction}</strong>
              </section>

              <section className="opportunity-clarification-panel">
                <div className="queue-header">
                  <div>
                    <p className="eyebrow">Clarification Output</p>
                    <h3>Opportunity profile</h3>
                  </div>
                  <button className="button accent" disabled={isClarifying} onClick={clarifySelectedOpportunity} type="button">
                    {isClarifying ? "Clarifying..." : selectedClarification ? "Refresh clarification" : "Clarify opportunity"}
                  </button>
                </div>

                {clarificationNotice ? (
                  <div className={`workflow-feedback${clarificationNotice.type === "error" ? " error" : ""}`} role="status">
                    <strong>{clarificationNotice.type === "success" ? "Clarification saved" : "Needs attention"}</strong>
                    <p>{clarificationNotice.message}</p>
                  </div>
                ) : null}

                {selectedClarification ? (
                  <div className="opportunity-clarification-output" data-testid="opportunity-clarification-output">
                    <div className="artifact-strip">
                      <span>{clarificationStatusLabels[selectedClarification.status]}</span>
                      <span>{clarificationRouteLabels[selectedClarification.route]}</span>
                    </div>

                    <div className="detail-grid">
                      <section>
                        <span>Core problem</span>
                        <p>{selectedClarification.coreProblem}</p>
                      </section>
                      <section>
                        <span>Affected people</span>
                        <p>{selectedClarification.affectedPeople}</p>
                      </section>
                      <section>
                        <span>Desired better future</span>
                        <p>{selectedClarification.desiredBetterFuture}</p>
                      </section>
                      <section>
                        <span>Possible first useful step</span>
                        <p>{selectedClarification.possibleFirstUsefulStep}</p>
                      </section>
                    </div>

                    <section className="next-action-band">
                      <span>Opportunity statement</span>
                      <strong>{selectedClarification.opportunityStatement}</strong>
                    </section>

                    <section>
                      <p className="eyebrow">Root barriers</p>
                      <div className="guardrail-list">
                        {selectedClarification.rootBarriers.length ? (
                          selectedClarification.rootBarriers.map((barrier) => <span key={barrier}>{barrier}</span>)
                        ) : (
                          <span>Not clear yet</span>
                        )}
                      </div>
                    </section>

                    <section>
                      <p className="eyebrow">Missing information</p>
                      <div className="guardrail-list">
                        {selectedClarification.missingInformation.length ? (
                          selectedClarification.missingInformation.map((item) => <span key={item}>{item}</span>)
                        ) : (
                          <span>None</span>
                        )}
                      </div>
                    </section>

                    <section>
                      <p className="eyebrow">Copyable Clarification Review Prompt</p>
                      <textarea className="copyable-prompt-box" readOnly value={selectedClarification.copyableNextPrompt} />
                    </section>

                    <section className="opportunity-solution-path-panel">
                      <div className="queue-header">
                        <div>
                          <p className="eyebrow">Solution Path</p>
                          <h3>Route decision</h3>
                        </div>
                        <button
                          className="button accent"
                          disabled={isRoutingPath}
                          onClick={routeSelectedOpportunityPath}
                          type="button"
                        >
                          {isRoutingPath
                            ? "Routing..."
                            : selectedSolutionPath
                              ? "Refresh solution path"
                              : "Route solution path"}
                        </button>
                      </div>

                      {solutionPathNotice ? (
                        <div className={`workflow-feedback${solutionPathNotice.type === "error" ? " error" : ""}`} role="status">
                          <strong>{solutionPathNotice.type === "success" ? "Solution path saved" : "Needs attention"}</strong>
                          <p>{solutionPathNotice.message}</p>
                        </div>
                      ) : null}

                      {selectedSolutionPath ? (
                        <div className="opportunity-solution-path-output" data-testid="opportunity-solution-path-output">
                          <div className="artifact-strip">
                            <span>{solutionPathLabels[selectedSolutionPath.recommendedPath]}</span>
                            <span>{confidenceLabels[selectedSolutionPath.confidenceLevel]}</span>
                          </div>

                          <div className="detail-grid">
                            <section>
                              <span>Reason</span>
                              <p>{selectedSolutionPath.reasonForRouting}</p>
                            </section>
                            <section>
                              <span>First practical step</span>
                              <p>{selectedSolutionPath.firstPracticalStep}</p>
                            </section>
                          </div>

                          <section>
                            <p className="eyebrow">Needed resources</p>
                            <div className="guardrail-list">
                              {selectedSolutionPath.neededResources.map((resource) => (
                                <span key={resource}>{resource}</span>
                              ))}
                            </div>
                          </section>

                          <section>
                            <p className="eyebrow">Blockers</p>
                            <div className="guardrail-list">
                              {selectedSolutionPath.blockers.length ? (
                                selectedSolutionPath.blockers.map((blocker) => <span key={blocker}>{blocker}</span>)
                              ) : (
                                <span>None</span>
                              )}
                            </div>
                          </section>

                          <section>
                            <p className="eyebrow">Next AppEngine Action Prompt</p>
                            <textarea className="copyable-prompt-box" readOnly value={selectedSolutionPath.nextAppEngineActionPrompt} />
                          </section>

                          <section className="opportunity-action-plan-panel">
                            <div className="queue-header">
                              <div>
                                <p className="eyebrow">Action Plan Draft</p>
                                <h3>First practical plan</h3>
                              </div>
                              <button
                                className="button accent"
                                disabled={isDraftingPlan}
                                onClick={draftSelectedActionPlan}
                                type="button"
                              >
                                {isDraftingPlan
                                  ? "Drafting..."
                                  : selectedActionPlan
                                    ? "Refresh action plan"
                                    : "Draft action plan"}
                              </button>
                            </div>

                            {actionPlanNotice ? (
                              <div className={`workflow-feedback${actionPlanNotice.type === "error" ? " error" : ""}`} role="status">
                                <strong>{actionPlanNotice.type === "success" ? "Action plan saved" : "Needs attention"}</strong>
                                <p>{actionPlanNotice.message}</p>
                              </div>
                            ) : null}

                            {selectedActionPlan ? (
                              <div className="opportunity-action-plan-output" data-testid="opportunity-action-plan-output">
                                <div className="artifact-strip">
                                  <span>{actionPlanLabels[selectedActionPlan.planType]}</span>
                                  <span>{solutionPathLabels[selectedActionPlan.recommendedSolutionPath]}</span>
                                </div>

                                <section className="next-action-band">
                                  <span>Opportunity summary</span>
                                  <strong>{selectedActionPlan.opportunitySummary}</strong>
                                </section>

                                <section>
                                  <p className="eyebrow">First 3 practical steps</p>
                                  <ol className="action-plan-list">
                                    {selectedActionPlan.firstPracticalSteps.map((step) => (
                                      <li key={step}>{step}</li>
                                    ))}
                                  </ol>
                                </section>

                                <div className="detail-grid">
                                  <section>
                                    <span>What AppEngine can help with</span>
                                    <ul className="compact-list">
                                      {selectedActionPlan.appEngineCanHelpWith.map((item) => (
                                        <li key={item}>{item}</li>
                                      ))}
                                    </ul>
                                  </section>
                                  <section>
                                    <span>What must be clarified</span>
                                    <ul className="compact-list">
                                      {selectedActionPlan.ownerMustClarify.map((item) => (
                                        <li key={item}>{item}</li>
                                      ))}
                                    </ul>
                                  </section>
                                </div>

                                <section>
                                  <p className="eyebrow">Needed resources</p>
                                  <div className="guardrail-list">
                                    {selectedActionPlan.neededResources.map((resource) => (
                                      <span key={resource}>{resource}</span>
                                    ))}
                                  </div>
                                </section>

                                <section>
                                  <p className="eyebrow">Risks / blockers</p>
                                  <div className="guardrail-list">
                                    {selectedActionPlan.risksBlockers.map((risk) => (
                                      <span key={risk}>{risk}</span>
                                    ))}
                                  </div>
                                </section>

                                <section className="next-action-band">
                                  <span>Suggested timeline</span>
                                  <strong>{selectedActionPlan.suggestedTimeline}</strong>
                                </section>

                                <section>
                                  <p className="eyebrow">Next Review Prompt</p>
                                  <textarea className="copyable-prompt-box" readOnly value={selectedActionPlan.nextReviewPrompt} />
                                </section>

                                <section className="opportunity-appengine-candidate-panel">
                                  <div className="queue-header">
                                    <div>
                                      <p className="eyebrow">AppEngine Candidate</p>
                                      <h3>Owner-review bridge</h3>
                                    </div>
                                    <button
                                      className="button accent"
                                      disabled={isCreatingCandidate}
                                      onClick={createSelectedAppEngineCandidate}
                                      type="button"
                                    >
                                      {isCreatingCandidate
                                        ? "Creating..."
                                        : selectedAppEngineCandidate
                                          ? "Refresh candidate"
                                          : "Create AppEngine candidate"}
                                    </button>
                                  </div>

                                  {appEngineCandidateNotice ? (
                                    <div
                                      className={`workflow-feedback${appEngineCandidateNotice.type === "error" ? " error" : ""}`}
                                      role="status"
                                    >
                                      <strong>
                                        {appEngineCandidateNotice.type === "success" ? "Candidate saved" : "Needs attention"}
                                      </strong>
                                      <p>{appEngineCandidateNotice.message}</p>
                                    </div>
                                  ) : null}

                                  {selectedAppEngineCandidate ? (
                                    <div
                                      className="opportunity-appengine-candidate-output"
                                      data-testid="opportunity-appengine-candidate-output"
                                    >
                                      <div className="artifact-strip">
                                        <span>{appEngineCandidateLabels[selectedAppEngineCandidate.candidateType]}</span>
                                        <span>{confidenceLabels[selectedAppEngineCandidate.confidenceLevel]}</span>
                                      </div>

                                      <div className="detail-grid">
                                        <section>
                                          <span>Source opportunity intake</span>
                                          <p>{selectedAppEngineCandidate.sourceOpportunityIntake.title}</p>
                                        </section>
                                        <section>
                                          <span>Clarified problem</span>
                                          <p>{selectedAppEngineCandidate.clarifiedProblem.coreProblem}</p>
                                        </section>
                                        <section>
                                          <span>Solution path</span>
                                          <p>{solutionPathLabels[selectedAppEngineCandidate.solutionPath.recommendedPath]}</p>
                                        </section>
                                        <section>
                                          <span>Proposed AppEngine work type</span>
                                          <p>{selectedAppEngineCandidate.proposedAppEngineWorkType}</p>
                                        </section>
                                      </div>

                                      <section className="next-action-band">
                                        <span>Action plan summary</span>
                                        <strong>{selectedAppEngineCandidate.actionPlanSummary}</strong>
                                      </section>

                                      <section className="next-action-band">
                                        <span>Recommended artifact to create next</span>
                                        <strong>{selectedAppEngineCandidate.recommendedArtifactToCreateNext}</strong>
                                      </section>

                                      <section>
                                        <p className="eyebrow">Missing owner decisions</p>
                                        <div className="guardrail-list">
                                          {selectedAppEngineCandidate.missingOwnerDecisions.map((decision) => (
                                            <span key={decision}>{decision}</span>
                                          ))}
                                        </div>
                                      </section>

                                      <section>
                                        <p className="eyebrow">Risks / blockers</p>
                                        <div className="guardrail-list">
                                          {selectedAppEngineCandidate.risksBlockers.map((risk) => (
                                            <span key={risk}>{risk}</span>
                                          ))}
                                        </div>
                                      </section>

                                      <section>
                                        <p className="eyebrow">Copyable Next AppEngine Prompt</p>
                                        <textarea
                                          className="copyable-prompt-box"
                                          readOnly
                                          value={selectedAppEngineCandidate.copyableNextAppEnginePrompt}
                                        />
                                      </section>

                                      <section className="opportunity-packet-draft-panel">
                                        <div className="queue-header">
                                          <div>
                                            <p className="eyebrow">Packet Draft Bridge</p>
                                            <h3>Owner-approved packet draft</h3>
                                          </div>
                                          <button
                                            className="button accent"
                                            disabled={isPreparingPacketDraft}
                                            onClick={prepareSelectedPacketDraft}
                                            type="button"
                                          >
                                            {isPreparingPacketDraft
                                              ? "Preparing..."
                                              : selectedBuildPacketBridge
                                                ? "Refresh packet draft"
                                                : "Prepare Packet Draft"}
                                          </button>
                                        </div>

                                        {packetDraftNotice ? (
                                          <div
                                            className={`workflow-feedback${packetDraftNotice.type === "error" ? " error" : ""}`}
                                            role="status"
                                          >
                                            <strong>{packetDraftNotice.type === "success" ? "Packet draft ready" : "Needs attention"}</strong>
                                            <p>{packetDraftNotice.message}</p>
                                          </div>
                                        ) : null}

                                        {selectedBuildPacketBridge ? (
                                          <div
                                            className="opportunity-packet-draft-output"
                                            data-testid="opportunity-packet-draft-output"
                                          >
                                            <div className="artifact-strip">
                                              <span>{selectedBuildPacketBridge.packetDraftStatus.replaceAll("_", " ")}</span>
                                              <span>{packetDraftLabels[selectedBuildPacketBridge.packetType]}</span>
                                              <span>{selectedBuildPacketBridge.ownerApprovalStatus.replaceAll("_", " ")}</span>
                                            </div>

                                            <div className="detail-grid">
                                              <section>
                                                <span>Packet draft status</span>
                                                <p>{selectedBuildPacketBridge.packetDraftStatus.replaceAll("_", " ")}</p>
                                              </section>
                                              <section>
                                                <span>Packet type</span>
                                                <p>{packetDraftLabels[selectedBuildPacketBridge.packetType]}</p>
                                              </section>
                                              <section>
                                                <span>Source candidate</span>
                                                <p>{selectedBuildPacketBridge.sourceCandidate.title}</p>
                                              </section>
                                              <section>
                                                <span>Next safe action</span>
                                                <p>{selectedBuildPacketBridge.nextSafeAction.replaceAll("_", " ")}</p>
                                              </section>
                                            </div>

                                            <section>
                                              <p className="eyebrow">Missing information</p>
                                              <div className="guardrail-list">
                                                {selectedBuildPacketBridge.missingInformation.length ? (
                                                  selectedBuildPacketBridge.missingInformation.map((item) => (
                                                    <span key={item}>{item}</span>
                                                  ))
                                                ) : (
                                                  <span>None recorded</span>
                                                )}
                                              </div>
                                            </section>

                                            <section>
                                              <p className="eyebrow">Source artifact evidence</p>
                                              <div className="guardrail-list">
                                                {selectedBuildPacketBridge.sourceArtifactEvidence.map((artifact) => (
                                                  <span key={`${artifact.kind}-${artifact.id || artifact.summary}`}>
                                                    {artifact.kind.replaceAll("_", " ")}
                                                    {artifact.id ? ` · ${artifact.id}` : ""}: {artifact.summary}
                                                  </span>
                                                ))}
                                              </div>
                                            </section>

                                            <section>
                                              <p className="eyebrow">Copyable Packet Draft Review Prompt</p>
                                              <textarea
                                                className="copyable-prompt-box"
                                                readOnly
                                                value={selectedBuildPacketBridge.copyableNextAppEnginePrompt}
                                              />
                                            </section>
                                          </div>
                                        ) : (
                                          <div className="empty-state">
                                            <strong>Candidate exists, packet bridge not prepared yet</strong>
                                            <p>
                                              Owner approval is required before preparing a packet draft. This will not create
                                              final packets, Codex runs, GitHub issues, labels, deployments, migrations, paid
                                              resources, secrets, or env changes.
                                            </p>
                                          </div>
                                        )}
                                      </section>
                                    </div>
                                  ) : (
                                    <div className="empty-state">
                                      <strong>No AppEngine candidate yet</strong>
                                      <p>Create a reviewable candidate before any packet, issue, label, or Codex handoff exists.</p>
                                    </div>
                                  )}
                                </section>
                              </div>
                            ) : (
                              <div className="empty-state">
                                <strong>No action plan yet</strong>
                                <p>Draft a practical owner-review plan before creating packets, issues, labels, or Codex handoffs.</p>
                              </div>
                            )}
                          </section>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <strong>No solution path yet</strong>
                          <p>Route the clarified opportunity before creating packets or handoffs.</p>
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="empty-state">
                    <strong>No clarification created yet</strong>
                    <p>Create a clarified opportunity profile before routing this toward a solution path.</p>
                  </div>
                )}
              </section>

              <section>
                <p className="eyebrow">Routing reason</p>
                <p>{selectedRecord.routingReason}</p>
              </section>

              <section>
                <p className="eyebrow">Safety Notes</p>
                <div className="guardrail-list">
                  {selectedRecord.safetyNotes.map((note) => (
                    <span key={note}>{note}</span>
                  ))}
                </div>
              </section>

              <section>
                <p className="eyebrow">Copyable AppEngine Review Prompt</p>
                <textarea className="copyable-prompt-box" readOnly value={selectedRecord.copyableNextPrompt} />
              </section>
            </>
          ) : (
            <div className="empty-state spacious">
              <strong>No opportunity selected</strong>
              <p>Once someone shares a problem or vision, the owner review prompt will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
