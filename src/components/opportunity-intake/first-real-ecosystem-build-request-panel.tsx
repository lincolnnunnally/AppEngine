"use client";

import { useState } from "react";
import type {
  FirstRealEcosystemBuildRequestRecord,
  firstRealEcosystemBuildRequestSeed
} from "@/lib/engine/first-real-ecosystem-build-request";

type FirstRealEcosystemBuildRequestPanelProps = {
  initialRecords: FirstRealEcosystemBuildRequestRecord[];
  seed: typeof firstRealEcosystemBuildRequestSeed;
};

export function FirstRealEcosystemBuildRequestPanel({
  initialRecords,
  seed
}: FirstRealEcosystemBuildRequestPanelProps) {
  const [records, setRecords] = useState(initialRecords);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");
  const latestRecord = records[0] || null;

  async function runBuildRequest() {
    setIsRunning(true);
    setMessage("");

    try {
      const response = await fetch("/api/first-real-ecosystem-build-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The first real ecosystem build request could not run.");
      }

      const record = result.record as FirstRealEcosystemBuildRequestRecord;
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setMessage("Prepared AppEngine handoff created and saved to the Handoff Inbox.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The first real ecosystem build request could not run.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="first-real-ecosystem-build-request panel" data-testid="first-real-ecosystem-build-request">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">First Real Ecosystem Build Request</p>
          <h1>Start Life Produces Life Core through Opportunity</h1>
          <p>
            This guided request uses the completed internal Opportunity flow to prepare the next AppEngine handoff for the
            United Under God ecosystem foundation.
          </p>
        </div>
        <button className="button accent" disabled={isRunning} onClick={runBuildRequest} type="button">
          {isRunning ? "Running request..." : "Run Life Core build request"}
        </button>
      </div>

      <div className="detail-grid">
        <section>
          <span>Seeded app</span>
          <p>{seed.appName}</p>
        </section>
        <section>
          <span>Ecosystem foundation</span>
          <p>{seed.ecosystem}</p>
        </section>
        <section>
          <span>Doctrine</span>
          <p>Transformation is the product</p>
        </section>
        <section>
          <span>Tool posture</span>
          <p>Apps are tools</p>
        </section>
      </div>

      <div className="first-real-build-seed-grid">
        <section>
          <span>Problem or vision</span>
          <p>{seed.problemOrVision}</p>
        </section>
        <section>
          <span>Desired impact</span>
          <p>{seed.desiredImpact}</p>
        </section>
      </div>

      {message ? <p className="form-note">{message}</p> : null}

      {latestRecord ? (
        <div className="first-real-build-output" data-testid="first-real-ecosystem-build-request-output">
          <div className="detail-grid">
            <section>
              <span>Real example</span>
              <p>{latestRecord.realExample.id}</p>
            </section>
            <section>
              <span>Ready review</span>
              <p>{latestRecord.resultReview.status.replaceAll("_", " ")}</p>
            </section>
            <section>
              <span>Prepared handoff</span>
              <p>{latestRecord.preparedHandoff.id}</p>
            </section>
            <section>
              <span>Next safe action</span>
              <p>{latestRecord.nextSafeAction.replaceAll("_", " ")}</p>
            </section>
          </div>

          <section>
            <p className="eyebrow">Prepared AppEngine handoff</p>
            <p>{latestRecord.ownerReadableSummary}</p>
            <textarea className="copyable-prompt-box" readOnly value={latestRecord.preparedHandoff.prompt} />
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
            </div>
          </section>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No Life Core build request has been run yet.</strong>
          <p>Run it when you are ready to create the first prepared AppEngine handoff for the next ecosystem slice.</p>
        </div>
      )}
    </section>
  );
}
