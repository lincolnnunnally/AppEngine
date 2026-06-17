"use client";

import { useState } from "react";
import type {
  FirstRealBuildLoopRunRecord,
  FirstRealBuildLoopRunStep
} from "@/lib/engine/first-real-build-loop-run";

export function FirstRealBuildLoopRunPanel({ initialRecords }: { initialRecords: FirstRealBuildLoopRunRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [isRunning, setIsRunning] = useState(false);
  const [isImportingResult, setIsImportingResult] = useState(false);
  const [message, setMessage] = useState("");
  const [builderResultText, setBuilderResultText] = useState("");
  const latestRecord = records[0] || null;

  async function runBuildLoop() {
    setIsRunning(true);
    setMessage("");

    try {
      const response = await fetch("/api/first-real-build-loop-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The first real build loop run could not be prepared.");
      }

      const record = result.record as FirstRealBuildLoopRunRecord;
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setMessage("First real build loop run prepared. Copy the builder prompt, run it manually, then paste the result back into Builder Result Intake.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The first real build loop run could not be prepared.");
    } finally {
      setIsRunning(false);
    }
  }

  async function importFirstBuildResult() {
    if (!latestRecord) return;

    setIsImportingResult(true);
    setMessage("");

    try {
      const response = await fetch("/api/first-real-build-loop-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "result",
          runId: latestRecord.id,
          resultText: builderResultText
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The first build result could not be imported.");
      }

      const record = result.record as FirstRealBuildLoopRunRecord;
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setBuilderResultText("");
      setMessage(
        record.verificationReview?.lifeCoreSliceReviewReady
          ? "First build result imported. Life Core is review-ready, and merge/deploy decisions remain owner-controlled."
          : "First build result imported. AppEngine found missing or failed verification that needs owner review."
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The first build result could not be imported.");
    } finally {
      setIsImportingResult(false);
    }
  }

  return (
    <section className="first-real-build-loop-run panel" data-testid="first-real-build-loop-run">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">First Real Build Loop Run</p>
          <h1>Use AppEngine’s build loop for Life Produces Life Core</h1>
          <p>
            This prepares the real Life Produces Life Core build loop from source request to packet draft, build request,
            exported handoff, and waiting result intake. Codex is not triggered automatically.
          </p>
        </div>
        <button className="button accent" disabled={isRunning} onClick={runBuildLoop} type="button">
          {isRunning ? "Preparing run..." : "Prepare first build loop run"}
        </button>
      </div>

      {message ? <p className="form-note">{message}</p> : null}

      {latestRecord ? (
        <div className="first-real-build-loop-output" data-testid="first-real-build-loop-run-output">
          <div className="detail-grid">
            <section>
              <span>Target</span>
              <p>{latestRecord.target.appName}</p>
            </section>
            <section>
              <span>Ecosystem</span>
              <p>{latestRecord.target.ecosystem}</p>
            </section>
            <section>
              <span>Packet draft</span>
              <p>{latestRecord.packetDraft.title}</p>
            </section>
            <section>
              <span>Build execution</span>
              <p>{latestRecord.buildExecutionRequest.executionStatus.replaceAll("_", " ")}</p>
            </section>
            <section>
              <span>Builder result intake</span>
              <p>{latestRecord.builderResultIntakePlaceholder.status.replaceAll("_", " ")}</p>
            </section>
            <section>
              <span>Life Core review-ready</span>
              <p>{latestRecord.verificationReview?.lifeCoreSliceReviewReady ? "Yes" : "No"}</p>
            </section>
            <section>
              <span>Next safe action</span>
              <p>{latestRecord.nextSafeAction.replaceAll("_", " ")}</p>
            </section>
          </div>

          <section>
            <p className="eyebrow">Build loop steps</p>
            <div className="first-real-build-loop-step-grid">
              {latestRecord.steps.map((step) => (
                <BuildLoopRunStepCard step={step} key={step.key} />
              ))}
            </div>
          </section>

          <section className="first-real-build-result-intake" data-testid="first-real-build-result-intake">
            <div>
              <p className="eyebrow">Paste First Build Result</p>
              <h2>Import the Life Core builder result</h2>
              <p>
                Paste the actual builder/Codex result here. AppEngine will parse the PR, branch, changed files,
                verification status, blockers, review URL, and next safe action, then update the build loop without
                merging, deploying, or triggering Codex.
              </p>
            </div>
            <textarea
              className="copyable-prompt-box"
              onChange={(event) => setBuilderResultText(event.target.value)}
              placeholder="Paste builder result text, including PR number, branch, files changed, verification run, blockers, review URL, and next safe action."
              value={builderResultText}
            />
            <button
              className="button accent"
              disabled={isImportingResult || builderResultText.trim().length < 20}
              onClick={importFirstBuildResult}
              type="button"
            >
              {isImportingResult ? "Importing result..." : "Import first build result"}
            </button>

            {latestRecord.builderResultIntake ? (
              <div className="first-real-build-result-summary" data-testid="first-real-build-result-summary">
                <div className="detail-grid">
                  <section>
                    <span>PR</span>
                    <p>{latestRecord.builderResultIntake.prNumber ? `#${latestRecord.builderResultIntake.prNumber}` : "Not found"}</p>
                  </section>
                  <section>
                    <span>Branch</span>
                    <p>{latestRecord.builderResultIntake.branch || "Not found"}</p>
                  </section>
                  <section>
                    <span>Verification</span>
                    <p>{latestRecord.builderResultIntake.passFailStatus.replaceAll("_", " ")}</p>
                  </section>
                  <section>
                    <span>Review URL</span>
                    <p>{latestRecord.builderResultIntake.reviewUrl || "Not found"}</p>
                  </section>
                </div>
                <div className="first-real-build-result-notes">
                  <section>
                    <span>Changed files</span>
                    <p>{latestRecord.builderResultIntake.changedFiles.length ? latestRecord.builderResultIntake.changedFiles.join("; ") : "No changed files parsed."}</p>
                  </section>
                  <section>
                    <span>Failed or missing verification</span>
                    <p>
                      {latestRecord.verificationReview?.failedOrMissingVerification.length
                        ? latestRecord.verificationReview.failedOrMissingVerification.join(" ")
                        : "No failed or missing verification recorded."}
                    </p>
                  </section>
                  <section>
                    <span>Next safe action</span>
                    <p>{latestRecord.builderResultIntake.nextSafeAction}</p>
                  </section>
                </div>
              </div>
            ) : null}
          </section>

          <section>
            <p className="eyebrow">What Lincoln does next</p>
            <div className="next-action-band">
              <strong>
                {latestRecord.verificationReview?.lifeCoreSliceReviewReady
                  ? "Review the Life Core slice and decide whether it should move toward merge."
                  : "Copy the builder prompt, run it manually, then paste the builder result here."}
              </strong>
              <p>{latestRecord.verificationReview?.summary || "The run is intentionally stopped at builder output. Result intake and verification review will complete after the builder/Codex handoff comes back."}</p>
            </div>
          </section>

          <section>
            <p className="eyebrow">Exact builder prompt</p>
            <textarea className="copyable-prompt-box" readOnly value={latestRecord.exportedBuilderHandoff.exactBuilderPrompt} />
          </section>

          <section>
            <p className="eyebrow">Guardrails preserved</p>
            <div className="guardrail-list">
              <span>No Codex auto-execution</span>
              <span>No GitHub issue creation</span>
              <span>No label changes</span>
              <span>No production deploy</span>
              <span>No paid resources</span>
              <span>No live migrations</span>
              <span>No secrets/env changes</span>
              <span>No repo visibility changes</span>
            </div>
          </section>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No first real build loop run yet.</strong>
          <p>
            Prepare it when you are ready for AppEngine to create the copyable Life Core builder handoff and stop for
            owner-controlled builder output.
          </p>
        </div>
      )}
    </section>
  );
}

function BuildLoopRunStepCard({ step }: { step: FirstRealBuildLoopRunStep }) {
  return (
    <article className={`first-real-build-loop-step ${step.status}`}>
      <span>{step.status.replaceAll("_", " ")}</span>
      <strong>{step.label}</strong>
      <p>{step.summary}</p>
      {step.evidenceId ? <small>{step.evidenceId}</small> : null}
    </article>
  );
}
