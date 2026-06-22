"use client";

import { useState } from "react";
import type {
  OpportunityControlGateView,
  OpportunityIntakeMode,
  OpportunitySolutionType
} from "@/lib/engine/opportunity-intake";

const modeOptions: Array<{ value: OpportunityIntakeMode; label: string; description: string }> = [
  {
    value: "problem",
    label: "I see a problem",
    description: "Start with the pain, gap, friction, or repeated struggle."
  },
  {
    value: "vision",
    label: "I have an idea/vision",
    description: "Start with the change you can already imagine."
  },
  {
    value: "tools",
    label: "I need tools to solve this",
    description: "Start with the app, workflow, automation, or resource you think is missing."
  },
  {
    value: "help_start",
    label: "I want to help but do not know where to start",
    description: "Start with who you care about and what you hope becomes possible."
  }
];

const solutionTypeOptions: Array<{ value: OpportunitySolutionType; label: string }> = [
  { value: "not_sure", label: "I am not sure yet" },
  { value: "app_tool_workflow", label: "App, tool, workflow, or automation" },
  { value: "content_resource", label: "Content, guide, resource, or curriculum" },
  { value: "community_ministry_model", label: "Community, ministry, or service model" },
  { value: "existing_ecosystem_service_later", label: "Could connect to an ecosystem service later" },
  { value: "multi_part_solution", label: "A few connected pieces" }
];

export function OpportunityIntakeForm() {
  const [mode, setMode] = useState<OpportunityIntakeMode>("problem");
  const [problemPain, setProblemPain] = useState("");
  const [affectedPeople, setAffectedPeople] = useState("");
  const [betterOutcome, setBetterOutcome] = useState("");
  const [currentBarriers, setCurrentBarriers] = useState("");
  const [existingIdeaVision, setExistingIdeaVision] = useState("");
  const [desiredImpact, setDesiredImpact] = useState("");
  const [possibleSolutionType, setPossibleSolutionType] = useState<OpportunitySolutionType>("not_sure");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [gate, setGate] = useState<OpportunityControlGateView | null>(null);

  async function submitOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/opportunity-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          problemPain,
          affectedPeople,
          betterOutcome,
          currentBarriers,
          existingIdeaVision,
          desiredImpact,
          possibleSolutionType
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "The opportunity could not be saved.");
      }

      const gateResult: OpportunityControlGateView | null = result.record?.gate || null;
      setGate(gateResult);
      setNotice({
        type: "success",
        title: result.record?.title || "Opportunity saved",
        message: gateResult
          ? `Saved for AppEngine review. Next safe phase: ${gateResult.nextSafePhase}. ${gateResult.applicableControlGates.length} control gates must pass before any architecture, design, or build.`
          : `Saved for AppEngine review. Suggested route: ${result.record?.route?.replaceAll("_", " ") || "owner review"}.`
      });
      setProblemPain("");
      setAffectedPeople("");
      setBetterOutcome("");
      setCurrentBarriers("");
      setExistingIdeaVision("");
      setDesiredImpact("");
      setPossibleSolutionType("not_sure");
    } catch (caught) {
      setNotice({
        type: "error",
        title: "Needs attention",
        message: caught instanceof Error ? caught.message : "The opportunity could not be saved."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="opportunity-intake-layout" data-testid="opportunity-intake-page">
      <div className="opportunity-intake-copy">
        <p className="eyebrow">Opportunity Intake</p>
        <h1>Start with the problem. Find the right next path.</h1>
        <p>
          Share what hurts, who it affects, and what better could look like. AppEngine keeps this as a reviewable
          opportunity before anything is built.
        </p>
        <div className="guardrail-strip" aria-label="Opportunity safety guardrails">
          <span>Review first</span>
          <span>No automatic build</span>
          <span>No paid resources</span>
          <span>No production deploy</span>
          <span>No assumed destination</span>
        </div>
      </div>

      <form className="panel opportunity-intake-form" onSubmit={submitOpportunity}>
        <div>
          <p className="eyebrow">What best describes where you are?</p>
          <div className="opportunity-choice-grid" role="group" aria-label="Choose opportunity intake mode">
            {modeOptions.map((option) => (
              <button
                aria-pressed={mode === option.value}
                className={`choice-button${mode === option.value ? " selected" : ""}`}
                key={option.value}
                onClick={() => setMode(option.value)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <label>
          What problem, pain, or opportunity do you see?
          <textarea
            name="problemPain"
            onChange={(event) => setProblemPain(event.target.value)}
            placeholder="Example: People ask for help, but the next step gets unclear or forgotten."
            required
            value={problemPain}
          />
        </label>

        <div className="form-grid compact-form-grid">
          <label>
            Who is affected?
            <textarea
              name="affectedPeople"
              onChange={(event) => setAffectedPeople(event.target.value)}
              placeholder="People, leaders, teams, families, churches, customers..."
              required
              value={affectedPeople}
            />
          </label>
          <label>
            What would a better outcome look like?
            <textarea
              name="betterOutcome"
              onChange={(event) => setBetterOutcome(event.target.value)}
              placeholder="What would change if the right support existed?"
              required
              value={betterOutcome}
            />
          </label>
        </div>

        <label>
          What is getting in the way right now?
          <textarea
            name="currentBarriers"
            onChange={(event) => setCurrentBarriers(event.target.value)}
            placeholder="Time, trust, knowledge, coordination, cost, privacy, unclear ownership..."
            required
            value={currentBarriers}
          />
        </label>

        <div className="form-grid compact-form-grid">
          <label>
            Do you already have an idea or vision?
            <textarea
              name="existingIdeaVision"
              onChange={(event) => setExistingIdeaVision(event.target.value)}
              placeholder="Optional. A tool, service, website, workflow, ministry model, or something else."
              value={existingIdeaVision}
            />
          </label>
          <label>
            What impact do you hope this creates?
            <textarea
              name="desiredImpact"
              onChange={(event) => setDesiredImpact(event.target.value)}
              placeholder="How should this help people move toward clarity, hope, capability, or useful action?"
              required
              value={desiredImpact}
            />
          </label>
        </div>

        <label>
          What kind of solution might this need?
          <select
            name="possibleSolutionType"
            onChange={(event) => setPossibleSolutionType(event.target.value as OpportunitySolutionType)}
            value={possibleSolutionType}
          >
            {solutionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {notice ? (
          <div className={`workflow-feedback${notice.type === "error" ? " error" : ""}`} role="status">
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
        ) : null}

        <div className="action-row">
          <button className="button primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : "Save opportunity"}
          </button>
        </div>
      </form>

      {gate ? (
        <section className="panel" aria-label="Control gates before any build" data-testid="opportunity-control-gates">
          <p className="eyebrow">Control Gates Before Any Build</p>
          <p>
            <strong>Next safe phase:</strong> {gate.nextSafePhase.replaceAll("_", " ")} — no architecture, design, or
            implementation until the gates pass.
          </p>
          <p>
            <strong>Gates that must pass:</strong> {gate.applicableControlGates.join(", ")}
          </p>
          {gate.missingContext.length ? (
            <p>
              <strong>Clarify first:</strong> {gate.missingContext.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
