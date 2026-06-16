"use client";

import { useMemo, useState } from "react";
import type { ProblemIntakeRecord, ProblemIntakeStatus } from "@/lib/engine/problem-intake-lite";

const statusLabels: Record<ProblemIntakeStatus, string> = {
  submitted: "Submitted",
  needs_clarification: "Needs clarification",
  routed_to_portfolio: "Routed to portfolio",
  ready_for_review: "Ready for review",
  packet_drafted: "Packet drafted",
  phase_issues_drafted: "Phase issues drafted"
};

export function OwnerControlCenter({ initialRecords }: { initialRecords: ProblemIntakeRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id || "");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackState, setFeedbackState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const selectedRecord = records.find((record) => record.id === selectedId) || records[0];
  const submittedCount = records.filter((record) => record.status === "submitted").length;
  const feedbackCount = records.reduce((total, record) => total + record.improvementCandidates.length, 0);
  const latestAction = selectedRecord?.nextRecommendedAction || "No submitted problems or visions yet.";

  const statusCounts = useMemo(() => {
    return records.reduce<Record<string, number>>((counts, record) => {
      counts[record.status] = (counts[record.status] || 0) + 1;
      return counts;
    }, {});
  }, [records]);

  async function saveFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRecord) return;

    setIsSavingFeedback(true);
    setFeedbackState(null);

    try {
      const response = await fetch("/api/problem-intake-lite/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          intakeId: selectedRecord.id,
          note: feedbackNote
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The feedback could not be saved.");
      }

      setRecords((current) => current.map((record) => (record.id === result.record.id ? result.record : record)));
      setFeedbackNote("");
      setFeedbackState({
        type: "success",
        message: "Saved as a draft improvement candidate. No issue or build trigger was created."
      });
    } catch (caught) {
      setFeedbackState({
        type: "error",
        message: caught instanceof Error ? caught.message : "The feedback could not be saved."
      });
    } finally {
      setIsSavingFeedback(false);
    }
  }

  return (
    <section className="owner-control-layout" data-testid="owner-control-center-page">
      <div className="owner-control-header panel">
        <div>
          <p className="eyebrow">Owner Control Center</p>
          <h1>Review the work queue without hunting through logs.</h1>
          <p>See submitted problems, likely routing, safety notes, and what AppEngine recommends next. This first slice uses temporary local/mock storage.</p>
        </div>
        <div className="owner-summary-grid">
          <div className="owner-summary-item">
            <span>Total</span>
            <strong>{records.length}</strong>
          </div>
          <div className="owner-summary-item">
            <span>Submitted</span>
            <strong>{submittedCount}</strong>
          </div>
          <div className="owner-summary-item">
            <span>Feedback</span>
            <strong>{feedbackCount}</strong>
          </div>
        </div>
      </div>

      <div className="owner-control-main">
        <aside className="problem-queue panel" aria-label="Submitted problems and visions">
          <div className="queue-header">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Problems and visions</h2>
            </div>
            <span className="status-chip">{Object.keys(statusCounts).length || 0} states</span>
          </div>

          {records.length ? (
            <div className="queue-list">
              {records.map((record) => (
                <button
                  className={`queue-item${selectedRecord?.id === record.id ? " selected" : ""}`}
                  key={record.id}
                  onClick={() => {
                    setSelectedId(record.id);
                    setFeedbackState(null);
                  }}
                  type="button"
                >
                  <span>{statusLabels[record.status]}</span>
                  <strong>{record.title}</strong>
                  <small>{record.mode.replaceAll("_", " ")}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No submissions yet</strong>
              <p>New public intake submissions will appear here for owner review.</p>
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
                  <p>{selectedRecord.problemSummary}</p>
                </div>
                <span className="status-chip">{selectedRecord.likelySolutionShape.replaceAll("_", " ")}</span>
              </div>

              <div className="detail-grid">
                <section>
                  <span>Affected people</span>
                  <p>{selectedRecord.affectedPeople}</p>
                </section>
                <section>
                  <span>Desired change</span>
                  <p>{selectedRecord.desiredChange}</p>
                </section>
                <section>
                  <span>Urgency</span>
                  <p>{selectedRecord.urgency}</p>
                </section>
                <section>
                  <span>Current barriers</span>
                  <p>{selectedRecord.currentBarriers}</p>
                </section>
              </div>

              <section className="next-action-band">
                <span>Next recommended action</span>
                <strong>{latestAction}</strong>
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
                <p className="eyebrow">Draft Artifacts</p>
                <div className="artifact-strip">
                  <span>problem_solution_intake</span>
                  <span>problem_portfolio_routing</span>
                  <span>solution_candidate_review</span>
                  <span>app_portfolio_registry candidate</span>
                </div>
              </section>

              <form className="owner-feedback-form" onSubmit={saveFeedback}>
                <label>
                  What failed or felt confusing?
                  <textarea
                    onChange={(event) => setFeedbackNote(event.target.value)}
                    placeholder="Capture what AppEngine should improve next. This stays as a draft candidate."
                    value={feedbackNote}
                  />
                </label>
                {feedbackState ? (
                  <div className={`workflow-feedback${feedbackState.type === "error" ? " error" : ""}`} role="status">
                    <strong>{feedbackState.type === "success" ? "Feedback saved" : "Needs attention"}</strong>
                    <p>{feedbackState.message}</p>
                  </div>
                ) : null}
                <button className="button accent" disabled={isSavingFeedback} type="submit">
                  {isSavingFeedback ? "Saving..." : "Save feedback draft"}
                </button>
              </form>

              {selectedRecord.improvementCandidates.length ? (
                <section>
                  <p className="eyebrow">Improvement Candidates</p>
                  <div className="feedback-list">
                    {selectedRecord.improvementCandidates.map((candidate) => (
                      <article key={candidate.id}>
                        <strong>{candidate.status}</strong>
                        <p>{candidate.note}</p>
                        <small>{candidate.nextSafeAction.replaceAll("_", " ")}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="empty-state spacious">
              <strong>Nothing to review yet</strong>
              <p>Once someone submits a problem or vision, AppEngine will show the state and next safe action here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
