"use client";

import { useState } from "react";
import type {
  EcosystemBuildStartRecord,
  EcosystemBuildStartTarget
} from "@/lib/engine/appengine-usage-guide-ecosystem-start";

type EcosystemBuildStartPanelProps = {
  initialRecords: EcosystemBuildStartRecord[];
};

const targetOptions: { value: EcosystemBuildStartTarget; label: string; helper: string }[] = [
  {
    value: "life_produces_life_core",
    label: "Life Produces Life Core",
    helper: "Shared foundation for the United Under God ecosystem."
  },
  {
    value: "spark_of_hope",
    label: "Spark of Hope",
    helper: "Hope, story intake, testimony, and safe encouragement."
  },
  {
    value: "live_on_mission",
    label: "Live On Mission",
    helper: "Action, service, and mission activation."
  },
  {
    value: "best_life",
    label: "Best Life",
    helper: "Flourishing, growth, stewardship, and purpose."
  },
  {
    value: "churchconnect",
    label: "ChurchConnect",
    helper: "Church coordination, care, and service workflow."
  },
  {
    value: "custom_ecosystem_slice",
    label: "Custom ecosystem slice",
    helper: "Owner-defined problem, ministry, workflow, app, or service."
  }
];

export function AppEngineUsageGuideEcosystemStartPanel({ initialRecords }: EcosystemBuildStartPanelProps) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedTarget, setSelectedTarget] = useState<EcosystemBuildStartTarget>("life_produces_life_core");
  const [customName, setCustomName] = useState("");
  const [customProblemOrVision, setCustomProblemOrVision] = useState("");
  const [customAffectedPeople, setCustomAffectedPeople] = useState("");
  const [customBetterFuture, setCustomBetterFuture] = useState("");
  const [customBarriers, setCustomBarriers] = useState("");
  const [customDesiredImpact, setCustomDesiredImpact] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [message, setMessage] = useState("");
  const latestRecord = records[0] || null;

  async function startBuild() {
    setIsStarting(true);
    setMessage("");

    try {
      const response = await fetch("/api/ecosystem-build-start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target: selectedTarget,
          customName,
          customProblemOrVision,
          customAffectedPeople,
          customBetterFuture,
          customBarriers,
          customDesiredImpact
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The ecosystem build could not be started.");
      }

      setRecords(result.records as EcosystemBuildStartRecord[]);
      setMessage("Ecosystem build start prepared. Review the exported handoff, then copy it to Codex manually only if it is right.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The ecosystem build could not be started.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <section className="appengine-usage-guide panel" data-testid="appengine-usage-guide-ecosystem-start">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">How to Use AppEngine Today</p>
          <h1>Start ecosystem work without losing the thread</h1>
          <p>
            AppEngine prepares, tracks, reviews, and packages work. Codex still performs build execution manually until
            owner-approved auto-execution is enabled.
          </p>
        </div>
        <button className="button accent" disabled={isStarting} onClick={startBuild} type="button">
          {isStarting ? "Starting..." : "Start Ecosystem Build"}
        </button>
      </div>

      <div className="usage-guide-grid">
        <article>
          <span>What AppEngine does now</span>
          <p>
            It turns the selected ecosystem slice into Opportunity input, a packet draft bridge, a build execution
            request, an exported builder handoff, portfolio state, memory, and audit evidence.
          </p>
        </article>
        <article>
          <span>What Lincoln still does</span>
          <p>
            Review the exported builder prompt, copy it to Codex manually when ready, then paste the builder result back
            into AppEngine for verification and state updates.
          </p>
        </article>
        <article>
          <span>What stays blocked</span>
          <p>No Codex auto-run, GitHub issues, labels, production deploys, paid resources, migrations, or env changes.</p>
        </article>
      </div>

      <div className="ecosystem-build-start-layout">
        <section>
          <p className="eyebrow">Start Ecosystem Build</p>
          <label>
            Ecosystem slice
            <select
              value={selectedTarget}
              onChange={(event) => setSelectedTarget(event.target.value as EcosystemBuildStartTarget)}
            >
              {targetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="form-note">{targetOptions.find((option) => option.value === selectedTarget)?.helper}</p>

          {selectedTarget === "custom_ecosystem_slice" ? (
            <div className="custom-ecosystem-fields">
              <label>
                Slice name
                <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Example: Kindred Connection" />
              </label>
              <label>
                Problem or vision
                <textarea value={customProblemOrVision} onChange={(event) => setCustomProblemOrVision(event.target.value)} />
              </label>
              <label>
                Who is affected
                <textarea value={customAffectedPeople} onChange={(event) => setCustomAffectedPeople(event.target.value)} />
              </label>
              <label>
                Better future
                <textarea value={customBetterFuture} onChange={(event) => setCustomBetterFuture(event.target.value)} />
              </label>
              <label>
                Barriers
                <textarea value={customBarriers} onChange={(event) => setCustomBarriers(event.target.value)} />
              </label>
              <label>
                Desired impact
                <textarea value={customDesiredImpact} onChange={(event) => setCustomDesiredImpact(event.target.value)} />
              </label>
            </div>
          ) : null}

          {message ? <p className="form-note">{message}</p> : null}
        </section>

        <section>
          <p className="eyebrow">Latest start result</p>
          {latestRecord ? (
            <article className="ecosystem-build-start-output" data-testid="ecosystem-build-start-output">
              <div className="detail-grid">
                <section>
                  <span>Slice</span>
                  <p>{latestRecord.target.name}</p>
                </section>
                <section>
                  <span>Packet draft</span>
                  <p>{latestRecord.buildPacketDraft.packetType.replaceAll("_", " ")}</p>
                </section>
                <section>
                  <span>Build request</span>
                  <p>{latestRecord.buildExecutionRequest.reviewStatus.replaceAll("_", " ")}</p>
                </section>
                <section>
                  <span>Portfolio</span>
                  <p>{latestRecord.portfolioUpdate.nextSafeAction.replaceAll("_", " ")}</p>
                </section>
              </div>

              <section>
                <p className="eyebrow">Opportunity input</p>
                <p>{latestRecord.opportunityInput.problemOrVision}</p>
              </section>

              <section>
                <p className="eyebrow">Exact next step</p>
                <div className="next-action-band">
                  <strong>{latestRecord.nextStepForLincoln}</strong>
                  <p>{latestRecord.ownerReadableSummary}</p>
                </div>
              </section>

              <section>
                <p className="eyebrow">Export-ready builder handoff</p>
                <textarea className="copyable-prompt-box" readOnly value={latestRecord.exportedBuilderHandoff.exactBuilderPrompt} />
              </section>
            </article>
          ) : (
            <div className="empty-state">
              <strong>No ecosystem build start yet.</strong>
              <p>Choose a slice and start when you want AppEngine to prepare the next manual Codex handoff.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
