"use client";

import { useState } from "react";
import type { ProblemIntakeGateRecord, ProblemIntakeRequestType } from "@/lib/engine/problem-intake-gate";

const REQUEST_TYPE_OPTIONS: { value: "" | ProblemIntakeRequestType; label: string }[] = [
  { value: "", label: "Let intake decide" },
  { value: "problem", label: "Problem" },
  { value: "opportunity", label: "Opportunity" },
  { value: "app_idea", label: "App idea" },
  { value: "feature_request", label: "Feature request" },
  { value: "improvement_request", label: "Improvement request" },
  { value: "fix", label: "Fix" }
];

export function ProblemIntakeForm({ initialRecords }: { initialRecords: ProblemIntakeGateRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [rawRequest, setRawRequest] = useState("");
  const [problemBeingSolved, setProblemBeingSolved] = useState("");
  const [intendedPerson, setIntendedPerson] = useState("");
  const [requestType, setRequestType] = useState<"" | ProblemIntakeRequestType>("");
  const [appName, setAppName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packet, setPacket] = useState<ProblemIntakeGateRecord | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string; title?: string } | null>(null);

  async function submitIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/engine/problem-intake-gate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawRequest,
          problemBeingSolved,
          intendedPerson,
          requestType: requestType || undefined,
          appName: appName || undefined
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The intake packet could not be created.");
      }

      setRecords((current) => [result.record, ...current]);
      setPacket(result.record);
      setNotice({
        type: "success",
        title: result.record.id,
        message: `Intake packet created. Next safe phase: ${result.record.nextSafePhase}. No architecture, design, or build was started.`
      });
      setRawRequest("");
      setProblemBeingSolved("");
      setIntendedPerson("");
      setRequestType("");
      setAppName("");
    } catch (caught) {
      setNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The intake packet could not be created."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="loop-intake-layout" data-testid="problem-intake-gate-page">
      <div className="loop-intake-copy">
        <p className="eyebrow">Problem Intake Gate</p>
        <h1>Every new request starts here.</h1>
        <p>
          Enter a problem, opportunity, app idea, feature, or improvement. AppEngine creates an intake packet and names the
          control gates first — it does not begin architecture, design, or implementation from conversation text.
        </p>
        <div className="guardrail-strip" aria-label="Intake guardrails">
          <span>Intake first</span>
          <span>Control gates named</span>
          <span>No build from chat</span>
          <span>Owner review</span>
        </div>
      </div>

      <div className="loop-intake-stack">
        <form className="panel loop-intake-form" onSubmit={submitIntake}>
          <label>
            Raw request
            <textarea
              name="rawRequest"
              onChange={(event) => setRawRequest(event.target.value)}
              placeholder="Churches keep dropping follow-up after a visitor fills out a card."
              required
              value={rawRequest}
            />
          </label>

          <label>
            Problem being solved
            <textarea
              name="problemBeingSolved"
              onChange={(event) => setProblemBeingSolved(event.target.value)}
              placeholder="Visitors are captured but follow-up ownership and status are lost."
              value={problemBeingSolved}
            />
          </label>

          <label>
            Intended person/customer
            <input
              name="intendedPerson"
              onChange={(event) => setIntendedPerson(event.target.value)}
              placeholder="Church staff and follow-up volunteers"
              value={intendedPerson}
            />
          </label>

          <label>
            Request type
            <select name="requestType" onChange={(event) => setRequestType(event.target.value as "" | ProblemIntakeRequestType)} value={requestType}>
              {REQUEST_TYPE_OPTIONS.map((option) => (
                <option key={option.value || "auto"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Existing app (optional)
            <input
              name="appName"
              onChange={(event) => setAppName(event.target.value)}
              placeholder="ChurchConnect (leave blank for a new app)"
              value={appName}
            />
          </label>

          {notice ? (
            <div className={`workflow-feedback${notice.type === "error" ? " error" : ""}`} role="status">
              <strong>{notice.type === "success" ? notice.title || "Intake created" : "Needs attention"}</strong>
              <p>{notice.message}</p>
            </div>
          ) : null}

          <div className="action-row">
            <button className="button primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating intake packet..." : "Create intake packet"}
            </button>
          </div>
        </form>

        {packet ? (
          <section className="panel" aria-label="Intake packet result">
            <div className="queue-header">
              <div>
                <p className="eyebrow">Intake Packet</p>
                <h2>{packet.requestType}</h2>
              </div>
              <span className="status-chip">{packet.status}</span>
            </div>
            <p>
              <strong>Likely app:</strong> {packet.likelyApp.status} — {packet.likelyApp.name}
            </p>
            <p>
              <strong>Next safe phase:</strong> {packet.nextSafePhase} (no architecture, design, or implementation yet)
            </p>
            <p>
              <strong>Control gates before build:</strong> {packet.applicableControlGates.join(", ")}
            </p>
            <p>
              <strong>Blocked now:</strong> {packet.blockedActions.slice(0, 5).join(", ")}…
            </p>
            {packet.missingContext.length ? (
              <p>
                <strong>Missing context:</strong> {packet.missingContext.join(", ")}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="panel loop-run-history" aria-label="Recent intake packets">
          <div className="queue-header">
            <div>
              <p className="eyebrow">Recent Intake</p>
              <h2>Intake packets</h2>
            </div>
            <span className="status-chip">{records.length} saved</span>
          </div>

          {records.length ? (
            <div className="loop-run-list">
              {records.slice(0, 5).map((record) => (
                <article className="loop-run-card" key={record.id}>
                  <div className="loop-run-card-heading">
                    <span>{record.requestType}</span>
                    <strong>{record.likelyApp.name}</strong>
                  </div>
                  <p>{record.rawRequest}</p>
                  <div className="loop-run-meta">
                    <span>{record.status}</span>
                    <span>next: {record.nextSafePhase.replaceAll("_", " ")}</span>
                    <span>{record.applicableControlGates.length} gates</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No intake packets yet</strong>
              <p>Every new problem, idea, feature, or improvement becomes an intake packet before any build work.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
