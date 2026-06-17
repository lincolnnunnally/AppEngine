"use client";

import { useState } from "react";
import type {
  FirstRealBuildLoopRunRecord,
  FirstRealBuildLoopRunStep
} from "@/lib/engine/first-real-build-loop-run";

export function FirstRealBuildLoopRunPanel({ initialRecords }: { initialRecords: FirstRealBuildLoopRunRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");
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

          <section>
            <p className="eyebrow">What Lincoln does next</p>
            <div className="next-action-band">
              <strong>Copy the builder prompt, run it manually, then paste the builder result back into Builder Result Intake.</strong>
              <p>
                The run is intentionally stopped at builder output. Result intake and verification review will complete
                after the builder/Codex handoff comes back.
              </p>
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
