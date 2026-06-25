"use client";

import { useState } from "react";

const solutionShapeOptions = [
  { value: "workflow_process", label: "A better workflow or process" },
  { value: "app", label: "A simple app or tool" },
  { value: "website", label: "A website or public page" },
  { value: "automation", label: "An automation" },
  { value: "content_resource", label: "Content, guides, or resources" },
  { value: "community_ministry_model", label: "A community or ministry model" },
  { value: "multi_part_ecosystem_solution", label: "A few connected pieces" }
];

export function ProblemIntakeForm() {
  const [problemSummary, setProblemSummary] = useState("");
  const [affectedPeople, setAffectedPeople] = useState("");
  const [desiredChange, setDesiredChange] = useState("");
  const [urgency, setUrgency] = useState("");
  const [currentBarriers, setCurrentBarriers] = useState("");
  const [possibleSolutionIdeas, setPossibleSolutionIdeas] = useState("");
  const [likelySolutionShape, setLikelySolutionShape] = useState("workflow_process");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string; title?: string } | null>(null);

  async function submitIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/problem-intake-lite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "problem_first",
          problemSummary,
          affectedPeople,
          desiredChange,
          urgency,
          currentBarriers,
          possibleSolutionIdeas,
          likelySolutionShape
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The intake could not be saved.");
      }

      setNotice({
        type: "success",
        title: result.record?.title,
        message: "Saved for owner review. No build, deploy, migration, paid resource, or execution label was triggered."
      });
      setProblemSummary("");
      setAffectedPeople("");
      setDesiredChange("");
      setUrgency("");
      setCurrentBarriers("");
      setPossibleSolutionIdeas("");
    } catch (caught) {
      setNotice({
        type: "error",
        message: caught instanceof Error ? caught.message : "The intake could not be saved."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="problem-intake-layout" data-testid="problem-intake-lite-page">
      <div className="problem-intake-copy">
        <p className="eyebrow">Solve a problem</p>
        <h1>Describe what&apos;s getting in the way.</h1>
        <p>
          Share what you noticed in plain English. We&apos;ll clarify it, then build and deploy a real,
          working starter you can log into and improve.
        </p>
        <div className="guardrail-strip" aria-label="What to expect">
          <span>Describe it</span>
          <span>We clarify</span>
          <span>We build &amp; deploy</span>
          <span>We verify it live</span>
          <span>You log in &amp; improve</span>
        </div>
      </div>

      <form className="panel problem-intake-form" onSubmit={submitIntake}>
        <label>
          What did you notice?
          <textarea
            name="problemSummary"
            onChange={(event) => setProblemSummary(event.target.value)}
            placeholder="Example: Churches lose track of follow-up after someone asks for help."
            required
            value={problemSummary}
          />
        </label>

        <div className="form-grid compact-form-grid">
          <label>
            Who is affected?
            <textarea
              name="affectedPeople"
              onChange={(event) => setAffectedPeople(event.target.value)}
              placeholder="People asking for help, volunteers, staff..."
              required
              value={affectedPeople}
            />
          </label>
          <label>
            What change would help?
            <textarea
              name="desiredChange"
              onChange={(event) => setDesiredChange(event.target.value)}
              placeholder="What would be better if this worked?"
              required
              value={desiredChange}
            />
          </label>
        </div>

        <div className="form-grid compact-form-grid">
          <label>
            How urgent is this?
            <select name="urgency" onChange={(event) => setUrgency(event.target.value)} required value={urgency}>
              <option value="">Choose one</option>
              <option value="low">Helpful, but not urgent</option>
              <option value="medium">Important soon</option>
              <option value="high">Blocking progress now</option>
            </select>
          </label>
          <label>
            What might help?
            <select
              name="likelySolutionShape"
              onChange={(event) => setLikelySolutionShape(event.target.value)}
              value={likelySolutionShape}
            >
              {solutionShapeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          What is getting in the way now?
          <textarea
            name="currentBarriers"
            onChange={(event) => setCurrentBarriers(event.target.value)}
            placeholder="Missing owner, unclear process, cost, trust, privacy, time..."
            required
            value={currentBarriers}
          />
        </label>

        <label>
          Any solution ideas already in your head?
          <textarea
            name="possibleSolutionIdeas"
            onChange={(event) => setPossibleSolutionIdeas(event.target.value)}
            placeholder="Optional. A form, dashboard, checklist, website, automation, service, or something else."
            value={possibleSolutionIdeas}
          />
        </label>

        {notice ? (
          <div className={`workflow-feedback${notice.type === "error" ? " error" : ""}`} role="status">
            <strong>{notice.type === "success" ? notice.title || "Saved" : "Needs attention"}</strong>
            <p>{notice.message}</p>
          </div>
        ) : null}

        <div className="action-row">
          <button className="button primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : "Save for review"}
          </button>
        </div>
      </form>
    </section>
  );
}
