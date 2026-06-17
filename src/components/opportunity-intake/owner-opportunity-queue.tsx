"use client";

import { useState } from "react";
import type { OpportunityActionPlanRecord, OpportunityActionPlanType } from "@/lib/engine/opportunity-action-plan";
import type {
  OpportunityClarificationRecord,
  OpportunityClarificationRoute,
  OpportunityClarificationStatus
} from "@/lib/engine/opportunity-clarification";
import type { OpportunityIntakeRecord, OpportunityRoute, OpportunityStatus } from "@/lib/engine/opportunity-intake";
import type {
  OpportunitySolutionPathConfidence,
  OpportunitySolutionPathRecord,
  OpportunitySolutionPathRoute
} from "@/lib/engine/opportunity-solution-path";

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

export function OwnerOpportunityQueue({
  initialActionPlans,
  initialClarifications,
  initialRecords,
  initialSolutionPaths
}: {
  initialActionPlans: OpportunityActionPlanRecord[];
  initialClarifications: OpportunityClarificationRecord[];
  initialRecords: OpportunityIntakeRecord[];
  initialSolutionPaths: OpportunitySolutionPathRecord[];
}) {
  const [records] = useState(initialRecords);
  const [actionPlans, setActionPlans] = useState(initialActionPlans);
  const [clarifications, setClarifications] = useState(initialClarifications);
  const [solutionPaths, setSolutionPaths] = useState(initialSolutionPaths);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id || "");
  const [isDraftingPlan, setIsDraftingPlan] = useState(false);
  const [isClarifying, setIsClarifying] = useState(false);
  const [isRoutingPath, setIsRoutingPath] = useState(false);
  const [actionPlanNotice, setActionPlanNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
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
  const needsClarificationCount = records.filter((record) => record.status === "needs_clarification").length;
  const readyCount = records.filter((record) => record.status === "ready_for_appengine_review").length;

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
