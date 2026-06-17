"use client";

import { useState } from "react";
import type {
  OpportunityClarificationRecord,
  OpportunityClarificationRoute,
  OpportunityClarificationStatus
} from "@/lib/engine/opportunity-clarification";
import type { OpportunityIntakeRecord, OpportunityRoute, OpportunityStatus } from "@/lib/engine/opportunity-intake";

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

export function OwnerOpportunityQueue({
  initialClarifications,
  initialRecords
}: {
  initialClarifications: OpportunityClarificationRecord[];
  initialRecords: OpportunityIntakeRecord[];
}) {
  const [records] = useState(initialRecords);
  const [clarifications, setClarifications] = useState(initialClarifications);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id || "");
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationNotice, setClarificationNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const selectedRecord = records.find((record) => record.id === selectedId) || records[0];
  const selectedClarification = selectedRecord
    ? clarifications.find((clarification) => clarification.intakeId === selectedRecord.id)
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
