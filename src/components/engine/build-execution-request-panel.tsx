"use client";

import { useState } from "react";
import type {
  BuildExecutionHandoffSource,
  BuildExecutionRequestRecord
} from "@/lib/engine/build-execution-request";

type BuildExecutionRequestPanelProps = {
  initialSources: BuildExecutionHandoffSource[];
  initialRequests: BuildExecutionRequestRecord[];
};

export function BuildExecutionRequestPanel({ initialSources, initialRequests }: BuildExecutionRequestPanelProps) {
  const [sources, setSources] = useState(initialSources);
  const [requests, setRequests] = useState(initialRequests);
  const [selectedSourceId, setSelectedSourceId] = useState(initialSources[0]?.id || "");
  const [isCreating, setIsCreating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isImportingResult, setIsImportingResult] = useState(false);
  const [builderResultText, setBuilderResultText] = useState("");
  const [message, setMessage] = useState("");
  const selectedSource = sources.find((source) => source.id === selectedSourceId) || sources[0] || null;
  const latestRequest = requests[0] || null;

  async function createRequest() {
    setIsCreating(true);
    setMessage("");

    try {
      const response = await fetch("/api/engine/build-execution-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceId: selectedSource?.id })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The build execution request could not be created.");
      }

      setRequests(result.records as BuildExecutionRequestRecord[]);
      setSources(result.sources as BuildExecutionHandoffSource[]);
      setMessage("Build execution request created as a draft. Codex was not triggered.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The build execution request could not be created.");
    } finally {
      setIsCreating(false);
    }
  }

  async function reviewRequest(reviewStatus: "owner_approved" | "blocked" | "needs_review") {
    if (!latestRequest) return;

    setIsReviewing(true);
    setMessage("");

    try {
      const response = await fetch("/api/engine/build-execution-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "review",
          requestId: latestRequest.id,
          reviewStatus
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The build execution request could not be reviewed.");
      }

      setRequests(result.records as BuildExecutionRequestRecord[]);
      setSources(result.sources as BuildExecutionHandoffSource[]);
      setMessage(
        reviewStatus === "owner_approved"
          ? "Builder handoff exported to the Handoff Inbox. Codex was not triggered."
          : "Build execution request review updated. Codex was not triggered."
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The build execution request could not be reviewed.");
    } finally {
      setIsReviewing(false);
    }
  }

  async function importBuilderResult() {
    if (!latestRequest) return;

    setIsImportingResult(true);
    setMessage("");

    try {
      const response = await fetch("/api/engine/build-execution-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "result",
          requestId: latestRequest.id,
          resultText: builderResultText
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The builder result could not be imported.");
      }

      setRequests(result.records as BuildExecutionRequestRecord[]);
      setSources(result.sources as BuildExecutionHandoffSource[]);
      setBuilderResultText("");
      setMessage("Builder result imported and verification state updated. Nothing was merged or deployed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The builder result could not be imported.");
    } finally {
      setIsImportingResult(false);
    }
  }

  return (
    <section className="build-execution-request-panel panel" data-testid="build-execution-request-panel">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">Build Execution Connector</p>
          <h1>Turn a prepared handoff into a build request</h1>
          <p>
            This makes the current manual Codex step visible inside AppEngine. It creates a draft request only and keeps
            execution blocked until a later owner-approved workflow exists.
          </p>
        </div>
        <button className="button accent" disabled={isCreating || !selectedSource} onClick={createRequest} type="button">
          {isCreating ? "Creating request..." : "Create Build Execution Request"}
        </button>
      </div>

      <div className="build-execution-layout">
        <section>
          <p className="eyebrow">Prepared handoff source</p>
          {sources.length ? (
            <>
              <label>
                Source handoff
                <select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)}>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.title} · {source.targetProjectSlice}
                    </option>
                  ))}
                </select>
              </label>
              {selectedSource ? (
                <article className="build-execution-source-card" data-testid="build-execution-source-card">
                  <span>{selectedSource.sourceKind.replaceAll("_", " ")}</span>
                  <strong>{selectedSource.targetProjectSlice}</strong>
                  <p>{selectedSource.ownerReadableSummary}</p>
                  {selectedSource.sourcePacketDraft ? (
                    <p>
                      Packet draft: {selectedSource.sourcePacketDraft.title} ·{" "}
                      {selectedSource.sourcePacketDraft.status.replaceAll("_", " ")}
                    </p>
                  ) : (
                    <p>Packet draft: not attached yet.</p>
                  )}
                  <small>{selectedSource.sourceHandoffId}</small>
                </article>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <strong>No prepared handoffs yet.</strong>
              <p>Create a Handoff Inbox item or Opportunity prepared handoff before drafting build execution.</p>
            </div>
          )}
        </section>

        <section>
          <p className="eyebrow">Latest build execution request</p>
          {latestRequest ? (
            <article className="build-execution-request-card" data-testid="build-execution-request-output">
              <div className="detail-grid">
                <section>
                  <span>Target</span>
                  <p>{latestRequest.targetProjectSlice}</p>
                </section>
                <section>
                  <span>Execution status</span>
                  <p>{latestRequest.executionStatus.replaceAll("_", " ")}</p>
                </section>
                <section>
                  <span>Owner approval</span>
                  <p>{latestRequest.ownerApprovalStatus.replaceAll("_", " ")}</p>
                </section>
                <section>
                  <span>Review status</span>
                  <p>{latestRequest.reviewStatus.replaceAll("_", " ")}</p>
                </section>
                <section>
                  <span>Source packet draft</span>
                  <p>{latestRequest.sourcePacketDraft?.title || "Not attached yet"}</p>
                </section>
                <section>
                  <span>Exported handoff</span>
                  <p>{latestRequest.exportedBuilderHandoffId || "Not exported yet"}</p>
                </section>
                <section>
                  <span>Next safe action</span>
                  <p>{latestRequest.nextSafeAction.replaceAll("_", " ")}</p>
                </section>
              </div>

              <p>{latestRequest.ownerReadableSummary}</p>

              <section className="build-execution-review-actions" data-testid="build-execution-review-section">
                <p className="eyebrow">Owner review</p>
                <div className="button-row">
                  <button
                    className="button accent"
                    disabled={isReviewing || latestRequest.reviewStatus === "exported_for_builder"}
                    onClick={() => reviewRequest("owner_approved")}
                    type="button"
                  >
                    {isReviewing ? "Exporting..." : "Approve + Export Builder Handoff"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={isReviewing || latestRequest.reviewStatus === "blocked"}
                    onClick={() => reviewRequest("blocked")}
                    type="button"
                  >
                    Mark Blocked
                  </button>
                </div>
                <p className="form-note">
                  Approval exports a copyable builder prompt to the Handoff Inbox. It does not trigger Codex, create
                  issues, apply labels, or deploy.
                </p>
              </section>

              <section>
                <p className="eyebrow">Requested work</p>
                <textarea className="copyable-prompt-box" readOnly value={latestRequest.requestedWork} />
              </section>

              {latestRequest.exportedBuilderHandoff ? (
                <section>
                  <p className="eyebrow">Exported builder prompt</p>
                  <textarea className="copyable-prompt-box" readOnly value={latestRequest.exportedBuilderHandoff.exactBuilderPrompt} />
                </section>
              ) : null}

              <section className="builder-result-intake" data-testid="builder-result-intake-section">
                <div>
                  <p className="eyebrow">Builder Result Intake</p>
                  <h2>Import the builder result</h2>
                  <p>
                    Paste the Codex/builder result here after it comes back. AppEngine will parse the branch or PR,
                    changed files, verification, blockers, review URL, and next safe action.
                  </p>
                </div>
                <textarea
                  className="copyable-prompt-box"
                  onChange={(event) => setBuilderResultText(event.target.value)}
                  placeholder="Paste builder result, PR summary, verification output, blockers, and review URL..."
                  value={builderResultText}
                />
                <button
                  className="button accent"
                  disabled={isImportingResult || !builderResultText.trim()}
                  onClick={importBuilderResult}
                  type="button"
                >
                  {isImportingResult ? "Importing..." : "Import Builder Result"}
                </button>

                {latestRequest.latestBuilderResult ? (
                  <article className="build-execution-result-card" data-testid="builder-result-intake-output">
                    <div className="detail-grid">
                      <section>
                        <span>Result status</span>
                        <p>{latestRequest.latestBuilderResult.passFailStatus.replaceAll("_", " ")}</p>
                      </section>
                      <section>
                        <span>PR / branch</span>
                        <p>
                          {latestRequest.latestBuilderResult.prNumber
                            ? `PR #${latestRequest.latestBuilderResult.prNumber}`
                            : latestRequest.latestBuilderResult.branch || "Not found"}
                        </p>
                      </section>
                      <section>
                        <span>Review URL</span>
                        <p>{latestRequest.latestBuilderResult.reviewUrl || "Not found"}</p>
                      </section>
                      <section>
                        <span>Next safe action</span>
                        <p>{latestRequest.latestBuilderResult.nextSafeAction}</p>
                      </section>
                    </div>
                    <p>{latestRequest.latestBuilderResult.ownerReadableSummary}</p>
                    {latestRequest.latestBuilderResult.changedFiles.length ? (
                      <section>
                        <p className="eyebrow">Changed files</p>
                        <div className="guardrail-list">
                          {latestRequest.latestBuilderResult.changedFiles.map((file) => (
                            <span key={file}>{file}</span>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {latestRequest.latestBuilderResult.blockers.length ? (
                      <section>
                        <p className="eyebrow">Blockers</p>
                        <div className="guardrail-list">
                          {latestRequest.latestBuilderResult.blockers.map((blocker) => (
                            <span key={blocker}>{blocker}</span>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {latestRequest.latestBuilderResult.followUpPrompt ? (
                      <section>
                        <p className="eyebrow">Follow-up prompt if needed</p>
                        <textarea className="copyable-prompt-box" readOnly value={latestRequest.latestBuilderResult.followUpPrompt} />
                      </section>
                    ) : null}
                  </article>
                ) : null}
              </section>

              <section>
                <p className="eyebrow">Verification</p>
                <div className="guardrail-list">
                  {latestRequest.verificationCommands.map((command) => (
                    <span key={command}>{command}</span>
                  ))}
                </div>
              </section>

              <section>
                <p className="eyebrow">Guardrails</p>
                <div className="guardrail-list">
                  {latestRequest.guardrails.map((guardrail) => (
                    <span key={guardrail}>{guardrail}</span>
                  ))}
                </div>
              </section>
            </article>
          ) : (
            <div className="empty-state">
              <strong>No build execution request yet.</strong>
              <p>Create one from a prepared handoff when the owner is ready to track the next builder step.</p>
            </div>
          )}
        </section>
      </div>

      {message ? <p className="form-note">{message}</p> : null}
    </section>
  );
}
