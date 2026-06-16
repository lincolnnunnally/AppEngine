"use client";

import { useMemo, useState } from "react";
import type { HandoffFeedbackChoice, HandoffRelaySummary } from "@/lib/engine/handoff-relay";
import type { ProjectMemory, ProjectMemoryFeedbackChoice } from "@/lib/engine/project-memory";
import type {
  RealProjectTrialSummary,
  TrialProjectCandidate,
  TrialResultReview,
  TrialResultReviewStatus
} from "@/lib/engine/real-project-trial";

type HandoffRelayPayload = {
  handoffs: HandoffRelaySummary[];
  projectMemory: ProjectMemory;
  storage: string;
};

type RealProjectTrialPayload = {
  candidates: TrialProjectCandidate[];
  trials: RealProjectTrialSummary[];
  storage: string;
};

type TrialResultReviewPayload = {
  reviews: TrialResultReview[];
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

const memoryFeedbackOptions: Array<{ id: ProjectMemoryFeedbackChoice; label: string }> = [
  { id: "important_decision", label: "Important decision" },
  { id: "lesson_learned", label: "Lesson learned" },
  { id: "bad_direction", label: "Bad direction" },
  { id: "keep_doing_this", label: "Keep doing this" },
  { id: "future_improvement", label: "Future improvement" }
];

const trialReviewOptions: Array<{ id: TrialResultReviewStatus; label: string }> = [
  { id: "useful", label: "Useful" },
  { id: "needs_clarification", label: "Needs clarification" },
  { id: "wrong_direction", label: "Wrong direction" },
  { id: "missing_requirement", label: "Missing requirement" },
  { id: "design_mismatch", label: "Design mismatch" },
  { id: "ready_for_next_packet", label: "Ready for next packet" }
];

export function HandoffRelayControlCenter({
  initialHandoffs,
  initialProjectMemory,
  initialTrialCandidates,
  initialTrialRuns,
  initialTrialReviews,
  initialStorage
}: {
  initialHandoffs: HandoffRelaySummary[];
  initialProjectMemory: ProjectMemory;
  initialTrialCandidates: TrialProjectCandidate[];
  initialTrialRuns: RealProjectTrialSummary[];
  initialTrialReviews: TrialResultReview[];
  initialStorage: string;
}) {
  const [handoffs, setHandoffs] = useState(initialHandoffs);
  const [projectMemory, setProjectMemory] = useState(initialProjectMemory);
  const [trialCandidates, setTrialCandidates] = useState(initialTrialCandidates);
  const [trialRuns, setTrialRuns] = useState(initialTrialRuns);
  const [trialReviews, setTrialReviews] = useState(initialTrialReviews);
  const [storage, setStorage] = useState(initialStorage);
  const [rawText, setRawText] = useState("");
  const [selectedId, setSelectedId] = useState(initialHandoffs[0]?.id || "");
  const [selectedTrialCandidate, setSelectedTrialCandidate] = useState(initialTrialCandidates[0]?.slug || "");
  const [selectedTrialId, setSelectedTrialId] = useState(initialTrialRuns[0]?.id || "");
  const [selectedTrialReviewId, setSelectedTrialReviewId] = useState(initialTrialReviews[0]?.id || "");
  const [trialReviewStatus, setTrialReviewStatus] = useState<TrialResultReviewStatus>("useful");
  const [trialReviewNote, setTrialReviewNote] = useState("");
  const [manualTrial, setManualTrial] = useState({
    name: "",
    problem: "",
    targetAudience: "",
    desiredTransformation: "",
    designIntent: ""
  });
  const [selectedFeedback, setSelectedFeedback] = useState<HandoffFeedbackChoice[]>([]);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [selectedMemoryFeedback, setSelectedMemoryFeedback] = useState<ProjectMemoryFeedbackChoice[]>([]);
  const [memoryFeedbackNote, setMemoryFeedbackNote] = useState("");
  const [status, setStatus] = useState("Ready to receive a handoff");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const selectedHandoff = useMemo(
    () => handoffs.find((handoff) => handoff.id === selectedId) || handoffs[0] || null,
    [handoffs, selectedId]
  );
  const selectedTrial = useMemo(
    () => trialRuns.find((trial) => trial.id === selectedTrialId) || trialRuns[0] || null,
    [trialRuns, selectedTrialId]
  );
  const selectedTrialReview = useMemo(
    () => trialReviews.find((review) => review.id === selectedTrialReviewId) || trialReviews[0] || null,
    [trialReviews, selectedTrialReviewId]
  );
  const usingManualTrial = selectedTrialCandidate === "manual";
  const memoryItemCount =
    projectMemory.majorDecisions.length +
    projectMemory.acceptedApproaches.length +
    projectMemory.rejectedApproaches.length +
    projectMemory.completedMilestones.length +
    projectMemory.currentBlockers.length +
    projectMemory.openQuestions.length +
    projectMemory.architectureDecisions.length +
    projectMemory.designPreferences.length +
    projectMemory.lessonsLearned.length +
    projectMemory.futureImprovements.length +
    projectMemory.progressHistory.length +
    projectMemory.ownerFeedback.length;

  async function loadInbox() {
    setBusyAction("refresh");
    setError("");

    try {
      const response = await fetch("/api/engine/handoff-relay");
      const payload = await readJsonResponse<HandoffRelayPayload>(response, "Inbox refresh failed");
      setHandoffs(payload.handoffs || []);
      setProjectMemory(payload.projectMemory);
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

  async function loadTrials() {
    setBusyAction("trial-refresh");
    setError("");

    try {
      const response = await fetch("/api/engine/real-project-trial");
      const payload = await readJsonResponse<RealProjectTrialPayload>(response, "Trial refresh failed");
      setTrialCandidates(payload.candidates || []);
      setTrialRuns(payload.trials || []);
      setStorage(payload.storage || "local");
      setSelectedTrialId((current) => current || payload.trials?.[0]?.id || "");
      setStatus("Trial runs refreshed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trial refresh failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function loadTrialReviews() {
    setBusyAction("trial-review-refresh");
    setError("");

    try {
      const response = await fetch("/api/engine/real-project-trial/reviews");
      const payload = await readJsonResponse<TrialResultReviewPayload>(response, "Trial review refresh failed");
      setTrialReviews(payload.reviews || []);
      setStorage(payload.storage || "local");
      setSelectedTrialReviewId((current) => current || payload.reviews?.[0]?.id || "");
      setStatus("Trial reviews refreshed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trial review refresh failed");
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
      const payload = await readJsonResponse<{ handoff: HandoffRelaySummary; projectMemory: ProjectMemory }>(response, "Handoff analysis failed");
      const nextHandoffs = [payload.handoff, ...handoffs.filter((handoff) => handoff.id !== payload.handoff.id)];
      setHandoffs(nextHandoffs);
      setProjectMemory(payload.projectMemory);
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

  async function submitRealProjectTrial() {
    const body = usingManualTrial
      ? {
          manualProject: {
            ...manualTrial,
            recommendedPacketType: "app_build_packet"
          }
        }
      : { selectedCandidateSlug: selectedTrialCandidate };

    setBusyAction("trial");
    setError("");

    try {
      const response = await fetch("/api/engine/real-project-trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse<{ trial: RealProjectTrialSummary; projectMemory: ProjectMemory }>(response, "Trial run failed");
      const nextTrials = [payload.trial, ...trialRuns.filter((trial) => trial.id !== payload.trial.id)];
      setTrialRuns(nextTrials);
      setProjectMemory(payload.projectMemory);
      setSelectedTrialId(payload.trial.id);
      setStatus("Trial summary generated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trial run failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  async function submitTrialReview() {
    if (!selectedTrial) {
      setError("Generate or select a trial before reviewing the result.");
      setStatus("Needs trial result");
      return;
    }

    setBusyAction("trial-review");
    setError("");

    try {
      const response = await fetch("/api/engine/real-project-trial/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trialId: selectedTrial.id,
          status: trialReviewStatus,
          note: trialReviewNote
        })
      });
      const payload = await readJsonResponse<{ review: TrialResultReview; projectMemory: ProjectMemory }>(response, "Trial review failed");
      const nextReviews = [payload.review, ...trialReviews.filter((review) => review.id !== payload.review.id)];
      setTrialReviews(nextReviews);
      setProjectMemory(payload.projectMemory);
      setSelectedTrialReviewId(payload.review.id);
      setStatus("Trial review saved to project memory");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trial review failed");
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

  async function copyTrialPrompt() {
    if (!selectedTrial) return;

    await navigator.clipboard.writeText(selectedTrial.nextPrompt.prompt);
    setStatus("Trial prompt copied for owner review");
  }

  async function copyTrialReviewPrompt() {
    if (!selectedTrialReview) return;

    await navigator.clipboard.writeText(selectedTrialReview.nextPrompt.prompt);
    setStatus("Trial review prompt copied for owner review");
  }

  async function saveProjectMemoryFeedback() {
    if (!selectedMemoryFeedback.length && !memoryFeedbackNote.trim()) {
      setError("Mark a memory category or add a note first.");
      setStatus("Needs memory feedback");
      return;
    }

    setBusyAction("memory");
    setError("");

    try {
      const response = await fetch("/api/engine/project-memory/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          choices: selectedMemoryFeedback,
          note: memoryFeedbackNote,
          sourceHandoffId: selectedHandoff?.id || null
        })
      });
      const payload = await readJsonResponse<{ projectMemory: ProjectMemory }>(response, "Project memory feedback failed");
      setProjectMemory(payload.projectMemory);
      setSelectedMemoryFeedback([]);
      setMemoryFeedbackNote("");
      setStatus("Project memory updated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project memory feedback failed");
      setStatus("Needs attention");
    } finally {
      setBusyAction("");
    }
  }

  function toggleFeedback(choice: HandoffFeedbackChoice) {
    setSelectedFeedback((current) => (current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]));
  }

  function toggleMemoryFeedback(choice: ProjectMemoryFeedbackChoice) {
    setSelectedMemoryFeedback((current) => (current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]));
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
        <span className="status-chip">{memoryItemCount} memory item{memoryItemCount === 1 ? "" : "s"}</span>
        <span className="status-chip">{trialRuns.length} trial run{trialRuns.length === 1 ? "" : "s"}</span>
        <span className="status-chip">{trialReviews.length} trial review{trialReviews.length === 1 ? "" : "s"}</span>
        {error ? <span className="error-chip">{error}</span> : null}
      </section>

      <section className="panel project-memory-panel" data-testid="project-memory-engine">
        <div className="handoff-section-heading">
          <div>
            <p className="eyebrow">Project Memory Engine</p>
            <h2>{projectMemory.latestProjectState.currentState}</h2>
            <p>AppEngine remembers decisions, progress, blockers, lessons, and the current next safe action.</p>
          </div>
          <span className="handoff-state-pill">Updated {new Date(projectMemory.updatedAt).toLocaleDateString()}</span>
        </div>

        <div className="project-memory-summary-grid">
          <StateBlock label="Current State" value={projectMemory.latestProjectState.currentState} />
          <StateBlock label="Recent Progress" value={projectMemory.latestProjectState.latestProgress} />
          <StateBlock label="Recommended Next Action" value={projectMemory.latestProjectState.recommendedNextAction} />
        </div>

        <div className="project-memory-lists">
          <ListBlock
            label="Current Blockers"
            items={projectMemory.currentBlockers.map((item) => item.text)}
            empty="No current blockers recorded."
          />
          <ListBlock label="Open Questions" items={projectMemory.openQuestions.map((item) => item.text)} empty="No open questions recorded." />
          <ListBlock
            label="Recent Progress"
            items={projectMemory.progressHistory.slice(0, 5).map((item) => item.text)}
            empty="No progress history yet."
          />
        </div>

        <div className="project-memory-summaries">
          <StateBlock label="Executive Summary" value={projectMemory.summaries.executive} />
          <StateBlock label="Technical Summary" value={projectMemory.summaries.technical} />
          <StateBlock label="Project Status Summary" value={projectMemory.summaries.projectStatus} />
        </div>

        <div className="project-memory-feedback">
          <div>
            <p className="eyebrow">Memory Feedback</p>
            <h3>Mark what AppEngine should remember</h3>
            <p>These notes become memory items only. They do not trigger Codex or create GitHub work.</p>
          </div>
          <div className="handoff-feedback-options">
            {memoryFeedbackOptions.map((option) => (
              <label className="handoff-feedback-choice" key={option.id}>
                <input
                  type="checkbox"
                  checked={selectedMemoryFeedback.includes(option.id)}
                  onChange={() => toggleMemoryFeedback(option.id)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <label className="handoff-paste-label">
            Memory note
            <textarea
              value={memoryFeedbackNote}
              onChange={(event) => setMemoryFeedbackNote(event.target.value)}
              placeholder="What should AppEngine remember for future handoffs?"
            />
          </label>
          <div className="action-row">
            <button className="button" type="button" onClick={() => void saveProjectMemoryFeedback()} disabled={busyAction === "memory"}>
              {busyAction === "memory" ? "Saving..." : "Save Project Memory"}
            </button>
            <span className="handoff-safe-note">Memory feedback stays local/mock and owner-reviewed.</span>
          </div>
        </div>
      </section>

      <section className="panel trial-runner-panel" data-testid="real-project-trial-runner">
        <div className="handoff-section-heading">
          <div>
            <p className="eyebrow">Real Project Trial Runner</p>
            <h2>Prove AppEngine on real work</h2>
            <p>Select Spark of Hope or capture a manual trial. AppEngine summarizes the work and drafts the next prompt for review only.</p>
          </div>
          <button className="button" type="button" onClick={() => void loadTrials()} disabled={Boolean(busyAction)}>
            {busyAction === "trial-refresh" ? "Refreshing..." : "Refresh Trials"}
          </button>
        </div>

        <div className="trial-runner-grid">
          <section className="trial-entry-card">
            <label className="handoff-paste-label">
              Trial project
              <select value={selectedTrialCandidate} onChange={(event) => setSelectedTrialCandidate(event.target.value)}>
                {trialCandidates.map((candidate) => (
                  <option key={candidate.slug} value={candidate.slug}>
                    {candidate.name}
                  </option>
                ))}
                <option value="manual">Enter trial manually</option>
              </select>
            </label>

            {usingManualTrial ? (
              <div className="trial-manual-grid">
                <label className="handoff-paste-label">
                  Project name
                  <input
                    value={manualTrial.name}
                    onChange={(event) => setManualTrial((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Example: Community Help Desk"
                  />
                </label>
                <label className="handoff-paste-label">
                  Affected people
                  <input
                    value={manualTrial.targetAudience}
                    onChange={(event) => setManualTrial((current) => ({ ...current, targetAudience: event.target.value }))}
                    placeholder="Who is this for?"
                  />
                </label>
                <label className="handoff-paste-label">
                  Problem being solved
                  <textarea
                    value={manualTrial.problem}
                    onChange={(event) => setManualTrial((current) => ({ ...current, problem: event.target.value }))}
                    placeholder="What is broken, confusing, painful, slow, or missing?"
                  />
                </label>
                <label className="handoff-paste-label">
                  Desired change
                  <textarea
                    value={manualTrial.desiredTransformation}
                    onChange={(event) => setManualTrial((current) => ({ ...current, desiredTransformation: event.target.value }))}
                    placeholder="What should be different for the people involved?"
                  />
                </label>
                <label className="handoff-paste-label">
                  Design intent
                  <textarea
                    value={manualTrial.designIntent}
                    onChange={(event) => setManualTrial((current) => ({ ...current, designIntent: event.target.value }))}
                    placeholder="How should this feel? Warm, professional, playful, ministry/community, operational?"
                  />
                </label>
              </div>
            ) : (
              <div className="trial-candidate-preview">
                {trialCandidates
                  .filter((candidate) => candidate.slug === selectedTrialCandidate)
                  .map((candidate) => (
                    <div className="handoff-state-grid" key={candidate.slug}>
                      <StateBlock label="Problem" value={candidate.problem} />
                      <StateBlock label="Audience" value={candidate.targetAudience} />
                      <StateBlock label="Desired transformation" value={candidate.desiredTransformation} />
                      <StateBlock label="Recommended packet" value={formatPacketType(candidate.recommendedPacketType)} />
                    </div>
                  ))}
              </div>
            )}

            <div className="action-row">
              <button className="button primary" type="button" onClick={() => void submitRealProjectTrial()} disabled={Boolean(busyAction)}>
                {busyAction === "trial" ? "Generating..." : "Generate Trial Summary"}
              </button>
              <span className="handoff-safe-note">Trial mode only: no Codex run, issue, label, deploy, migration, paid resource, or auto-merge.</span>
            </div>
          </section>

          <aside className="trial-history-card">
            <p className="eyebrow">Trial History</p>
            <h3>Newest first</h3>
            <div className="handoff-inbox-list">
              {trialRuns.length ? (
                trialRuns.map((trial) => (
                  <button
                    className={`handoff-inbox-item ${trial.id === selectedTrial?.id ? "selected" : ""}`}
                    key={trial.id}
                    type="button"
                    onClick={() => {
                      setSelectedTrialId(trial.id);
                      setStatus("Trial selected");
                      setError("");
                    }}
                  >
                    <span>{new Date(trial.createdAt).toLocaleString()}</span>
                    <strong>{trial.project.name}</strong>
                    <p>{trial.ownerReadableSummary}</p>
                    <small>{trial.nextSafeAction}</small>
                  </button>
                ))
              ) : (
                <p>No trial runs yet.</p>
              )}
            </div>
          </aside>
        </div>

        {selectedTrial ? (
          <div className="trial-summary-layout">
            <section className="trial-summary-card">
              <div className="handoff-section-heading">
                <div>
                  <p className="eyebrow">Trial Run Summary</p>
                  <h2>{selectedTrial.project.name}</h2>
                </div>
                <span className="handoff-state-pill">{formatPacketType(selectedTrial.recommendedPacketType)}</span>
              </div>
              <div className="handoff-analysis-grid">
                <StateBlock label="Problem being solved" value={selectedTrial.problemBeingSolved} />
                <StateBlock label="Target audience" value={selectedTrial.targetAudience} />
                <StateBlock label="Desired transformation" value={selectedTrial.desiredTransformation} />
                <StateBlock label="Design intent" value={selectedTrial.designIntent} />
                <StateBlock label="Current stage" value={selectedTrial.currentStage} />
                <StateBlock label="Next safe action" value={selectedTrial.nextSafeAction} />
                <ListBlock label="Risks and blockers" items={selectedTrial.risksBlockers} empty="No risks recorded." />
                <ListBlock
                  label="Artifacts used"
                  items={Object.values(selectedTrial.artifactInputs).map((artifact) => `${artifact.kind}: ${artifact.status}`)}
                  empty="No artifact inputs recorded."
                />
              </div>
            </section>

            <section className="trial-prompt-card">
              <div className="handoff-section-heading">
                <div>
                  <p className="eyebrow">Next Prompt</p>
                  <h2>Copy only after review</h2>
                </div>
                <button className="button accent" type="button" onClick={() => void copyTrialPrompt()}>
                  Copy Trial Prompt
                </button>
              </div>
              <textarea className="handoff-prompt-box trial-prompt-box" readOnly value={selectedTrial.nextPrompt.prompt} />
              <div className="handoff-prompt-meta">
                <StateBlock label="Reason" value={selectedTrial.nextPrompt.reason} />
                <StateBlock label="Expected outcome" value={selectedTrial.nextPrompt.expectedOutcome} />
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <section className="panel trial-review-panel" data-testid="trial-result-review">
        <div className="handoff-section-heading">
          <div>
            <p className="eyebrow">Trial Result Review</p>
            <h2>Teach AppEngine what happened</h2>
            <p>Review the latest trial result, mark what worked or missed, and turn feedback into a safe improvement candidate.</p>
          </div>
          <button className="button" type="button" onClick={() => void loadTrialReviews()} disabled={Boolean(busyAction)}>
            {busyAction === "trial-review-refresh" ? "Refreshing..." : "Refresh Reviews"}
          </button>
        </div>

        <div className="trial-review-layout">
          <section className="trial-review-card">
            <div className="handoff-section-heading">
              <div>
                <p className="eyebrow">Latest Trial Output</p>
                <h3>{selectedTrial ? selectedTrial.project.name : "No trial selected"}</h3>
              </div>
              <span className="handoff-state-pill">{selectedTrial ? formatPacketType(selectedTrial.recommendedPacketType) : "Waiting"}</span>
            </div>
            {selectedTrial ? (
              <div className="handoff-state-grid">
                <StateBlock label="Problem" value={selectedTrial.problemBeingSolved} />
                <StateBlock label="Desired transformation" value={selectedTrial.desiredTransformation} />
                <StateBlock label="Design intent" value={selectedTrial.designIntent} />
                <StateBlock label="Next safe action" value={selectedTrial.nextSafeAction} />
              </div>
            ) : (
              <p>Generate a real project trial first, then review the result here.</p>
            )}
          </section>

          <section className="trial-review-card">
            <div>
              <p className="eyebrow">Owner Review</p>
              <h3>Choose the closest status</h3>
            </div>
            <div className="trial-review-options">
              {trialReviewOptions.map((option) => (
                <label className="handoff-feedback-choice" key={option.id}>
                  <input
                    type="radio"
                    name="trial-review-status"
                    checked={trialReviewStatus === option.id}
                    onChange={() => setTrialReviewStatus(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <label className="handoff-paste-label">
              What was useful, wrong, missing, or mismatched?
              <textarea
                value={trialReviewNote}
                onChange={(event) => setTrialReviewNote(event.target.value)}
                placeholder="Example: The audience is right, but the next prompt needs to include pastoral review boundaries."
              />
            </label>
            <div className="action-row">
              <button className="button primary" type="button" onClick={() => void submitTrialReview()} disabled={Boolean(busyAction) || !selectedTrial}>
                {busyAction === "trial-review" ? "Saving..." : "Save Trial Review"}
              </button>
              <span className="handoff-safe-note">Review updates memory only. It does not trigger Codex or GitHub work.</span>
            </div>
          </section>
        </div>

        {selectedTrialReview ? (
          <div className="trial-summary-layout">
            <section className="trial-summary-card">
              <div className="handoff-section-heading">
                <div>
                  <p className="eyebrow">Review Result</p>
                  <h2>{selectedTrialReview.project.name}</h2>
                </div>
                <span className="handoff-state-pill">{formatReviewStatus(selectedTrialReview.reviewStatus)}</span>
              </div>
              <div className="handoff-analysis-grid">
                <StateBlock label="Improvement candidate" value={selectedTrialReview.improvementCandidate.title} />
                <StateBlock label="Candidate type" value={selectedTrialReview.improvementCandidate.candidateType.replace(/_/g, " ")} />
                <ListBlock label="Useful signals" items={selectedTrialReview.usefulSignals} empty="No useful signals marked yet." />
                <ListBlock label="Concerns" items={selectedTrialReview.concerns} empty="No concerns marked." />
              </div>
            </section>

            <section className="trial-prompt-card">
              <div className="handoff-section-heading">
                <div>
                  <p className="eyebrow">Review-Based Prompt</p>
                  <h2>Copy only after review</h2>
                </div>
                <button className="button accent" type="button" onClick={() => void copyTrialReviewPrompt()}>
                  Copy Review Prompt
                </button>
              </div>
              <textarea className="handoff-prompt-box trial-prompt-box" readOnly value={selectedTrialReview.nextPrompt.prompt} />
              <div className="handoff-prompt-meta">
                <StateBlock label="Reason" value={selectedTrialReview.nextPrompt.reason} />
                <StateBlock label="Expected outcome" value={selectedTrialReview.nextPrompt.expectedOutcome} />
              </div>
            </section>
          </div>
        ) : null}

        <aside className="trial-history-card">
          <p className="eyebrow">Review History</p>
          <h3>Newest first</h3>
          <div className="handoff-inbox-list">
            {trialReviews.length ? (
              trialReviews.map((review) => (
                <button
                  className={`handoff-inbox-item ${review.id === selectedTrialReview?.id ? "selected" : ""}`}
                  key={review.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrialReviewId(review.id);
                    setTrialReviewStatus(review.reviewStatus);
                    setTrialReviewNote(review.ownerNote);
                    setStatus("Trial review selected");
                    setError("");
                  }}
                >
                  <span>{new Date(review.createdAt).toLocaleString()}</span>
                  <strong>{formatReviewStatus(review.reviewStatus)}</strong>
                  <p>{review.ownerReadableSummary}</p>
                  <small>{review.nextPrompt.expectedOutcome}</small>
                </button>
              ))
            ) : (
              <p>No trial reviews stored yet.</p>
            )}
          </div>
        </aside>
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

function formatPacketType(value: string) {
  const labels: Record<string, string> = {
    app_build_packet: "App Build Packet",
    vnext_packet: "vNext Packet",
    non_app_solution_plan: "Non-App Solution Plan"
  };

  return labels[value] || value;
}

function formatReviewStatus(value: string) {
  const labels: Record<string, string> = {
    useful: "Useful",
    needs_clarification: "Needs clarification",
    wrong_direction: "Wrong direction",
    missing_requirement: "Missing requirement",
    design_mismatch: "Design mismatch",
    ready_for_next_packet: "Ready for next packet"
  };

  return labels[value] || value.replace(/_/g, " ");
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
