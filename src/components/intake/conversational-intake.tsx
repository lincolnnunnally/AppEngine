"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildIntakeSubmission,
  conversationSteps,
  isAnswerComplete,
  reflectBack,
  type ConversationAnswers,
  type ConversationStep,
  type IntakeFrame
} from "@/lib/engine/conversational-intake";

type Notice = { type: "success" | "error"; title: string; message: string };

// One unified entrance. The two intents — "a problem to solve" and "an app to
// build" — share the same question set, so there is NO up-front choice: the
// conversation starts directly at the first question. FRAME is internal only; it
// selects the wording and the existing endpoint the answers map to, and is never
// shown to the user as a fork.
const FRAME: IntakeFrame = "problem";

export function ConversationalIntake() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<ConversationAnswers>({});
  const [draft, setDraft] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const steps = conversationSteps;
  const step: ConversationStep | undefined = steps[stepIndex];
  const chips = step?.chips ? step.chips[FRAME] : undefined;
  const canContinue = step ? isAnswerComplete(step, draft) : false;
  const atStart = stepIndex === 0 && !reviewing;

  const transcript = useMemo(
    () =>
      steps.slice(0, stepIndex).map((s) => ({
        q: s.prompt[FRAME],
        a: (answers[s.slot] || "").trim() || "(skipped)"
      })),
    [stepIndex, answers, steps]
  );

  function commit(value: string) {
    if (!step) return;
    const nextAnswers = { ...answers, [step.slot]: value };
    setAnswers(nextAnswers);
    setDraft("");
    if (stepIndex + 1 >= steps.length) {
      setReviewing(true);
    } else {
      setStepIndex(stepIndex + 1);
    }
  }

  function back() {
    setNotice(null);
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (stepIndex === 0) {
      return;
    }
    const prev = stepIndex - 1;
    setStepIndex(prev);
    setDraft((answers[steps[prev].slot] || "").trim());
  }

  async function submit() {
    setSubmitting(true);
    setNotice(null);
    const { endpoint, payload } = buildIntakeSubmission(FRAME, answers);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        setNotice({
          type: "error",
          title: "That didn't go through",
          message: result?.message || "Something went wrong saving this. Please try again."
        });
      } else {
        setNotice({
          type: "success",
          title: "Got it — this is in.",
          message:
            "We'll clarify the next step, check what already exists, then move it toward the right build. The first version will be a real, live starter you can try and improve — not the finished product yet."
        });
      }
    } catch {
      setNotice({ type: "error", title: "That didn't go through", message: "Network hiccup. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const success = notice?.type === "success";

  return (
    <section className="convo" aria-label="Start building an app">
      <header className="convo-head">
        <p className="convo-eyebrow">We build the app for you</p>
        <h1 className="convo-title">What app should we build for you?</h1>
        {atStart ? (
          <p className="convo-sub">
            Describe a problem you want solved or a tool you already have in mind — I&apos;ll ask a few quick questions,
            then we build you a real, working app for it. No long form.
          </p>
        ) : null}
      </header>

      <div className="convo-thread">
        {transcript.map((turn, i) => (
          <div className="convo-turn" key={i}>
            <p className="convo-q">{turn.q}</p>
            <p className="convo-a">{turn.a}</p>
          </div>
        ))}

        {notice ? (
          <div className={`convo-notice convo-notice--${notice.type}`} role={success ? "status" : "alert"}>
            <strong>{notice.title}</strong>
            <span>{notice.message}</span>
          </div>
        ) : null}

        {!success && reviewing ? (
          <div className="convo-turn convo-review">
            <p className="convo-q">Here&apos;s what I heard — want me to take it in?</p>
            <p className="convo-reflect">{reflectBack(FRAME, answers)}</p>
          </div>
        ) : null}

        {!success && !reviewing && step ? (
          <div className="convo-current">
            <p className="convo-q convo-q--active">
              {step.prompt[FRAME]}
              {step.optional ? <span className="convo-optional"> (optional)</span> : null}
            </p>

            {chips ? (
              <div className="convo-chips" role="group">
                {chips.map((chip) => (
                  <button type="button" key={chip} className="convo-chip" onClick={() => commit(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className="convo-input"
                rows={3}
                value={draft}
                placeholder={step.placeholder?.[FRAME] || ""}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={step.prompt[FRAME]}
              />
            )}
          </div>
        ) : null}
      </div>

      {!success ? (
        <div className="convo-actions">
          {!atStart ? (
            <button type="button" className="convo-back" onClick={back} disabled={submitting}>
              Back
            </button>
          ) : null}

          {reviewing ? (
            <button type="button" className="convo-go" onClick={submit} disabled={submitting}>
              {submitting ? "Sending..." : "Yes — take it in"}
            </button>
          ) : !chips ? (
            <div className="convo-advance">
              {step?.optional ? (
                <button type="button" className="convo-skip" onClick={() => commit("")} disabled={submitting}>
                  Skip
                </button>
              ) : null}
              <button type="button" className="convo-go" onClick={() => commit(draft)} disabled={!canContinue || submitting}>
                Continue
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="convo-fallback">
        Prefer to fill out a form instead?{" "}
        <Link href="/problem-intake-lite">Use the form</Link>.
      </p>
    </section>
  );
}
