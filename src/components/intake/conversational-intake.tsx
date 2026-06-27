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

const FRAME_LABEL: Record<IntakeFrame, string> = {
  problem: "Solve a problem with an app",
  build: "Build an app I have in mind"
};

export function ConversationalIntake() {
  const [frame, setFrame] = useState<IntakeFrame | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<ConversationAnswers>({});
  const [draft, setDraft] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const steps = conversationSteps;
  const step: ConversationStep | undefined = steps[stepIndex];
  const chips = frame && step?.chips ? step.chips[frame] : undefined;
  const canContinue = step ? isAnswerComplete(step, draft) : false;

  const transcript = useMemo(() => {
    if (!frame) return [] as Array<{ q: string; a: string }>;
    return steps.slice(0, stepIndex).map((s) => ({
      q: s.prompt[frame],
      a: (answers[s.slot] || "").trim() || "(skipped)"
    }));
  }, [frame, stepIndex, answers, steps]);

  function chooseFrame(next: IntakeFrame) {
    setFrame(next);
    setStepIndex(0);
    setAnswers({});
    setDraft("");
    setReviewing(false);
    setNotice(null);
  }

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
      setFrame(null);
      return;
    }
    const prev = stepIndex - 1;
    setStepIndex(prev);
    setDraft((answers[steps[prev].slot] || "").trim());
  }

  async function submit() {
    if (!frame) return;
    setSubmitting(true);
    setNotice(null);
    const { endpoint, payload } = buildIntakeSubmission(frame, answers);
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

  // Frame choice — the opening turn replaces the old two-door wall.
  if (!frame) {
    return (
      <section className="convo" aria-label="Start building an app">
        <header className="convo-head">
          <p className="convo-eyebrow">We build the app for you</p>
          <h1 className="convo-title">What app should we build for you?</h1>
          <p className="convo-sub">
            Describe a problem you want an app to solve, or a tool you already have in mind — I&apos;ll ask a few quick
            questions, then we build you a real, working app for it. No long form.
          </p>
        </header>
        <div className="convo-frames" role="group" aria-label="Choose how to begin">
          <button type="button" className="convo-frame convo-frame--problem" onClick={() => chooseFrame("problem")}>
            <span className="convo-frame-accent" aria-hidden="true" />
            <span className="convo-frame-title">{FRAME_LABEL.problem}</span>
            <span className="convo-frame-text">Describe what&apos;s not working in your world or work, and we&apos;ll build a tool that fixes it.</span>
          </button>
          <button type="button" className="convo-frame convo-frame--build" onClick={() => chooseFrame("build")}>
            <span className="convo-frame-accent" aria-hidden="true" />
            <span className="convo-frame-title">{FRAME_LABEL.build}</span>
            <span className="convo-frame-text">You already know the app or tool you want — describe it and we&apos;ll build it.</span>
          </button>
        </div>
      </section>
    );
  }

  const success = notice?.type === "success";

  return (
    <section className="convo" aria-label="Discovery conversation">
      <header className="convo-head">
        <p className="convo-eyebrow">{FRAME_LABEL[frame]}</p>
        <h1 className="convo-title">A few quick questions, then we build it.</h1>
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
            <p className="convo-reflect">{reflectBack(frame, answers)}</p>
          </div>
        ) : null}

        {!success && !reviewing && step ? (
          <div className="convo-current">
            <p className="convo-q convo-q--active">
              {step.prompt[frame]}
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
                placeholder={step.placeholder?.[frame] || ""}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={step.prompt[frame]}
              />
            )}
          </div>
        ) : null}
      </div>

      {!success ? (
        <div className="convo-actions">
          <button type="button" className="convo-back" onClick={back} disabled={submitting}>
            Back
          </button>

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
        <Link href={frame === "problem" ? "/problem-intake-lite" : "/opportunity-intake"}>Use the form</Link>.
      </p>
    </section>
  );
}
