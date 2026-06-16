"use client";

import { useMemo, useState } from "react";
import type { HandoffFeedbackChoice, HandoffRelaySummary } from "@/lib/engine/handoff-relay";

type HandoffRelayPayload = {
  handoffs: HandoffRelaySummary[];
  storage: string;
};

const feedbackOptions: Array<{ id: HandoffFeedbackChoice; label: string }> = [
  { id: "good_direction", label: "Good direction" },
  { id: "wrong_direction", label: "Wrong direction" },
  { id: "incomplete", label: "Incomplete" },
  { id: "needs_redesign", label: "Needs redesign" },
  { id: "duplicate_work", label: "Duplicate work" },
  { id: "unnecessary_complexity", label: "Unnecessary complexity" }
];

export function HandoffRelayControlCenter({ initialHandoffs, initialStorage }: { initialHandoffs: HandoffRelaySummary[]; initialStorage: string }) {
  const [handoffs, setHandoffs] = useState(initialHandoffs);
  const [storage, setStorage] = useState(initialStorage);
  const [rawText, setRawText] = useState("");
  const [selectedId, setSelectedId] = useState(initialHandoffs[0]?.id || "");
  const [selectedFeedback, setSelectedFeedback] = useState<HandoffFeedbackChoice[]>([]);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [status, setStatus] = useState("Ready to receive a handoff");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const selectedHandoff = useMemo(
    () => handoffs.find((handoff) => handoff.id === selectedId) || handoffs[0] || null,
    [handoffs, selectedId]
  );

  async function loadInbox() {
    setBusyAction("refresh");
    setError("");

    try {
      const response = await fetch("/api/engine/handoff-relay");
      const payload = await readJsonResponse<HandoffRelayPayload>(response, "Inbox refresh failed");
      setHandoffs(payload.handoffs || []);
      setStorage(payload.storage || "local");
      setSelectedId((current) => current || payload.handoffs?.[0]?.id || "");
      setStatus("Inbox refreshed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inbox refresh failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function submitHandoff() {
    if (rawText.trim().length < 12) {
      setError("Paste a Codex handoff first.");
      setStatus("Needs handoff text");
      return;
    }

    setBusyAction("analyze");
    setError("");

    try {
      const response = await fetch("/api/engine/handoff-relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawText })
      });
      const payload = await readJsonResponse<{ handoff: HandoffRelaySummary }>(response, "Handoff analysis failed");
      const nextHandoffs = [payload.handoff, ...handoffs.filter((handoff) => handoff.id !== payload.handoff.id)];
      setHandoffs(nextHandoffs);
      setSelectedId(payload.handoff.id);
      setRawText("");
      setSelectedFeedback([]);
      setFeedbackNote("");
      setStatus("Handoff summarized");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Handoff analysis failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function saveFeedback() {
    if (!selectedHandoff) {
      setError("Select a handoff first.");
      return;
    }

    setBusyAction("feedback");
    setError("");

    try {
      const response = await fetch(`/api/engine/handoff-relay/${selectedHandoff.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choices: selectedFeedback, note: feedbackNote })
      });
      const payload = await readJsonResponse<{ handoff: HandoffRelaySummary }>(response, "Feedback save failed");
      setHandoffs((current) => current.map((handoff) => (handoff.id === payload.handoff.id ? payload.handoff : handoff)));
      setStatus("Feedback saved as draft improvement candidate");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feedback save failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function copyPrompt() {
    if (!selectedHandoff) return;

    await navigator.clipboard.writeText(selectedHandoff.nextPrompt.prompt);
    setStatus("Prompt copied for owner review");
  }

  function toggleFeedback(choice: HandoffFeedbackChoice) {
    setSelectedFeedback((current) => (current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]));
  }

  function selectHandoff(handoff: HandoffRelaySummary) {
    setSelectedId(handoff.id);
    setSelectedFeedback(handoff.feedback.choices);
    setFeedbackNote(handoff.feedback.note);
    setStatus("Handoff selected");
    setError("");
  }

  return (
    <div className="handoff-center" data-testid="handoff-relay-reducer">
      <section className="handoff-hero">
        <div>
          <p className="eyebrow">Owner Control Center</p>
          <h1>Handoff Relay Reducer</h1>
          <p>
            Paste the latest Codex handoff here. AppEngine summarizes the state, keeps the guardrails visible, and drafts the next prompt
            for your approval without sending it anywhere.
          </p>
        </div>
        <div className="handoff-hero-status">
          <span>Current mode</span>
          <strong>Owner review only</strong>
          <p>{storage === "mock-memory" ? "Preview storage is temporary mock memory." : "Local mock storage is active."}</p>
        </div>
      </section>

      <section className="handoff-status-row" aria-live="polite">
        <span className="status-chip">{status}</span>
        <span className="status-chip">{handoffs.length} handoff{handoffs.length === 1 ? "" : "s"}</span>
        {error ? <span className="error-chip">{error}</span> : null}
      </section>

      <section className="handoff-layout">
        <div className="handoff-main">
          <section className="panel handoff-inbox-panel">
            <div className="handoff-section-heading">
              <div>
                <p className="eyebrow">Handoff Inbox</p>
                <h2>Paste the next relay here</h2>
              </div>
              <button className="button" type="button" onClick={() => void loadInbox()} disabled={Boolean(busyAction)}>
                {busyAction === "refresh" ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <label className="handoff-paste-label">
              Codex handoff
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="Paste Codex's final summary, ChatGPT's review, or the next handoff here."
              />
            </label>
            <div className="action-row">
              <button className="button primary" type="button" onClick={() => void submitHandoff()} disabled={Boolean(busyAction)}>
                {busyAction === "analyze" ? "Summarizing..." : "Summarize Handoff"}
              </button>
              <span className="handoff-safe-note">No issue, label, deploy, migration, paid resource, or Codex run will be triggered.</span>
            </div>
          </section>

          {selectedHandoff ? (
            <>
              <section className="panel handoff-project-state">
                <div className="handoff-section-heading">
                  <div>
                    <p className="eyebrow">Project State Summary</p>
                    <h2>{selectedHandoff.projectState.currentStatus}</h2>
                  </div>
                  <span className="handoff-state-pill">{selectedHandoff.extracted.mergeStatus}</span>
                </div>
                <div className="handoff-state-grid">
                  <StateBlock label="Latest milestone" value={selectedHandoff.projectState.latestCompletedMilestone} />
                  <StateBlock label="Recommended next action" value={selectedHandoff.projectState.recommendedNextAction} />
                  <StateBlock
                    label="Open PRs"
                    value={selectedHandoff.projectState.openPrs.length ? selectedHandoff.projectState.openPrs.join(" | ") : "None detected"}
                  />
                  <StateBlock label="Remaining milestones" value={selectedHandoff.projectState.remainingMajorMilestones.join(" | ")} />
                </div>
              </section>

              <section className="panel handoff-analysis-panel">
                <div className="handoff-section-heading">
                  <div>
                    <p className="eyebrow">Handoff Analysis</p>
                    <h2>{selectedHandoff.extracted.prTitle}</h2>
                  </div>
                  <span className="handoff-state-pill">{selectedHandoff.extracted.prNumber ? `PR #${selectedHandoff.extracted.prNumber}` : "No PR detected"}</span>
                </div>
                <div className="handoff-analysis-grid">
                  <StateBlock label="Branch" value={selectedHandoff.extracted.branch} />
                  <ListBlock label="Verification" items={selectedHandoff.extracted.verificationResults} empty="No verification lines detected." />
                  <ListBlock label="Completed work" items={selectedHandoff.extracted.completedWork} empty="No completed-work lines detected." />
                  <ListBlock label="Guardrails preserved" items={selectedHandoff.extracted.guardrailsPreserved} empty="No guardrail lines detected." />
                  <ListBlock label="Risks" items={selectedHandoff.extracted.risks} empty="No risks detected." />
                  <ListBlock label="Blockers" items={selectedHandoff.extracted.blockers} empty="No blockers detected." />
                  <ListBlock label="Dependencies" items={selectedHandoff.extracted.dependencies} empty="No dependencies detected." />
                </div>
              </section>

              <section className="panel handoff-prompt-panel">
                <div className="handoff-section-heading">
                  <div>
                    <p className="eyebrow">Next Prompt Generator</p>
                    <h2>Review before sending</h2>
                  </div>
                  <button className="button accent" type="button" onClick={() => void copyPrompt()}>
                    Copy Prompt
                  </button>
                </div>
                <textarea className="handoff-prompt-box" readOnly value={selectedHandoff.nextPrompt.prompt} />
                <div className="handoff-prompt-meta">
                  <StateBlock label="Reason" value={selectedHandoff.nextPrompt.reason} />
                  <StateBlock label="Expected outcome" value={selectedHandoff.nextPrompt.expectedOutcome} />
                  <StateBlock label="Dependencies" value={selectedHandoff.nextPrompt.dependencies.join(" | ")} />
                </div>
              </section>

              <section className="panel handoff-feedback-panel">
                <div>
                  <p className="eyebrow">Feedback Loop</p>
                  <h2>Teach the relay what was useful</h2>
                  <p>Feedback becomes a draft improvement candidate only. It does not trigger Codex or create GitHub work.</p>
                </div>
                <div className="handoff-feedback-options">
                  {feedbackOptions.map((option) => (
                    <label className="handoff-feedback-choice" key={option.id}>
                      <input
                        type="checkbox"
                        checked={selectedFeedback.includes(option.id)}
                        onChange={() => toggleFeedback(option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <label className="handoff-paste-label">
                  What failed or felt confusing?
                  <textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="Optional owner note" />
                </label>
                <div className="action-row">
                  <button className="button" type="button" onClick={() => void saveFeedback()} disabled={busyAction === "feedback"}>
                    {busyAction === "feedback" ? "Saving..." : "Save Feedback"}
                  </button>
                  {selectedHandoff.feedback.improvementCandidate ? (
                    <span className="handoff-safe-note">Draft candidate saved.</span>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="panel handoff-empty-state">
              <p className="eyebrow">Waiting</p>
              <h2>No handoff selected yet</h2>
              <p>Paste a Codex handoff to create the first relay summary.</p>
            </section>
          )}
        </div>

        <aside className="handoff-sidebar">
          <section className="panel">
            <p className="eyebrow">Newest First</p>
            <h2>Inbox</h2>
            <div className="handoff-inbox-list">
              {handoffs.length ? (
                handoffs.map((handoff) => (
                  <button
                    className={`handoff-inbox-item ${handoff.id === selectedHandoff?.id ? "selected" : ""}`}
                    key={handoff.id}
                    type="button"
                    onClick={() => selectHandoff(handoff)}
                  >
                    <span>{new Date(handoff.receivedAt).toLocaleString()}</span>
                    <strong>{handoff.extracted.prNumber ? `PR #${handoff.extracted.prNumber}` : "Handoff"}</strong>
                    <p>{handoff.extracted.prTitle}</p>
                    <small>{handoff.projectState.recommendedNextAction}</small>
                  </button>
                ))
              ) : (
                <p>No handoffs stored yet.</p>
              )}
            </div>
          </section>

          <section className="panel handoff-guardrail-panel">
            <p className="eyebrow">Safety Boundary</p>
            <h2>Review only</h2>
            <div className="handoff-guardrail-list">
              <span>No Codex trigger</span>
              <span>No GitHub issue</span>
              <span>No labels</span>
              <span>No production deploy</span>
              <span>No paid resources</span>
              <span>No migrations</span>
              <span>No secrets/env changes</span>
              <span>No auto-merge</span>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function StateBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="handoff-state-block">
      <span>{label}</span>
      <strong>{value || "Not detected"}</strong>
    </div>
  );
}

function ListBlock({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <div className="handoff-state-block">
      <span>{label}</span>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <strong>{empty}</strong>
      )}
    </div>
  );
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 180) };
    }
  }

  if (!response.ok) {
    const error = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error) : "";
    const hint = typeof payload === "object" && payload && "hint" in payload ? String((payload as { hint?: unknown }).hint) : "";
    throw new Error([error || `${fallbackMessage} (${response.status})`, hint].filter(Boolean).join(" "));
  }

  return payload as T;
}
