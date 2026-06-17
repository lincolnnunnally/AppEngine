"use client";

import { useState } from "react";
import type { FirstEcosystemBuildPacketDraftRecord } from "@/lib/engine/first-ecosystem-build-packet-draft";
import type { FirstRealEcosystemBuildRequestRecord } from "@/lib/engine/first-real-ecosystem-build-request";

type FirstEcosystemBuildPacketDraftPanelProps = {
  initialBuildRequests: FirstRealEcosystemBuildRequestRecord[];
  initialDrafts: FirstEcosystemBuildPacketDraftRecord[];
};

export function FirstEcosystemBuildPacketDraftPanel({
  initialBuildRequests,
  initialDrafts
}: FirstEcosystemBuildPacketDraftPanelProps) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [isPreparing, setIsPreparing] = useState(false);
  const [message, setMessage] = useState("");
  const latestBuildRequest = initialBuildRequests[0] || null;
  const latestDraft = drafts[0] || null;

  async function prepareDraft() {
    setIsPreparing(true);
    setMessage("");

    try {
      const response = await fetch("/api/first-ecosystem-build-packet-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceBuildRequestId: latestBuildRequest?.id })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The first ecosystem build packet draft could not be prepared.");
      }

      const record = result.record as FirstEcosystemBuildPacketDraftRecord;
      setDrafts((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setMessage("Build packet draft prepared for owner review.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The first ecosystem build packet draft could not be prepared.");
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <section className="first-ecosystem-build-packet-draft panel" data-testid="first-ecosystem-build-packet-draft">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">First Ecosystem Build Packet</p>
          <h1>Life Produces Life Core packet draft</h1>
          <p>
            Convert the prepared Life Core handoff into a reviewable packet draft for the first actual ecosystem build
            slice.
          </p>
        </div>
        <button className="button accent" disabled={isPreparing || !latestBuildRequest} onClick={prepareDraft} type="button">
          {isPreparing ? "Preparing draft..." : "Prepare packet draft"}
        </button>
      </div>

      {!latestBuildRequest ? (
        <div className="empty-state">
          <strong>No prepared Life Core build request yet.</strong>
          <p>Run the First Real Ecosystem Build Request before preparing this packet draft.</p>
        </div>
      ) : null}

      {message ? <p className="form-note">{message}</p> : null}

      {latestDraft ? (
        <div className="first-packet-draft-output" data-testid="first-ecosystem-build-packet-draft-output">
          <div className="first-packet-hero">
            <div>
              <span>{latestDraft.status.replaceAll("_", " ")}</span>
              <h2>{latestDraft.title}</h2>
              <p>{latestDraft.ownerReadableSummary}</p>
            </div>
            <div className="portfolio-summary-card">
              <span>Next safe action</span>
              <strong>{latestDraft.nextSafeAction.replaceAll("_", " ")}</strong>
              <p>Owner review is required before any final packet or implementation work.</p>
            </div>
          </div>

          <div className="first-packet-section-grid">
            <PacketSection title="Purpose" value={latestDraft.purpose} />
            <PacketSection title="User benefit" value={latestDraft.userBenefit} />
          </div>

          <div className="first-packet-section-grid three">
            <PacketList title="Core features" items={latestDraft.coreFeatures} />
            <PacketList title="Data model needs" items={latestDraft.dataModelNeeds} />
            <PacketList title="Acceptance criteria" items={latestDraft.acceptanceCriteria} />
          </div>

          <section>
            <p className="eyebrow">Required screens/routes</p>
            <div className="first-packet-route-grid">
              {latestDraft.requiredScreensRoutes.map((route) => (
                <article key={route.route}>
                  <span>{route.route}</span>
                  <strong>{route.label}</strong>
                  <p>{route.purpose}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow">Design intent</p>
            <div className="guardrail-list">
              {latestDraft.designIntent.emotionalExperience.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <ul className="compact-list">
              {latestDraft.designIntent.styleNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <p className="eyebrow">Guardrails</p>
            <div className="guardrail-list">
              {latestDraft.guardrailNotes.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow">Copyable next AppEngine prompt</p>
            <textarea className="copyable-prompt-box" readOnly value={latestDraft.copyableNextAppEnginePrompt} />
          </section>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No packet draft prepared yet.</strong>
          <p>The draft will appear here after it converts the prepared Life Core handoff into owner-reviewable packet work.</p>
        </div>
      )}
    </section>
  );
}

function PacketSection({ title, value }: { title: string; value: string }) {
  return (
    <section>
      <span>{title}</span>
      <p>{value}</p>
    </section>
  );
}

function PacketList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <span>{title}</span>
      <ul className="compact-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
