"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; reference: string; message: string }
  | { status: "error"; message: string };

export default function SparkOfHopeIntakeLitePage() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [storyLength, setStoryLength] = useState(0);
  const canSubmit = submitState.status !== "submitting";

  const statusText =
    submitState.status === "success"
      ? "Preview received"
      : submitState.status === "error"
        ? "Needs attention"
        : submitState.status === "submitting"
          ? "Submitting preview"
          : "Preview mode";

  async function submitStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitState({ status: "submitting" });

    let response: Response;

    try {
      response = await fetch("/api/spark-of-hope-intake-lite/stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          preferredName: formData.get("preferredName"),
          email: formData.get("email"),
          storyTitle: formData.get("storyTitle"),
          storyBody: formData.get("storyBody"),
          mayReview: formData.get("mayReview") === "on",
          mayContact: formData.get("mayContact") === "on",
          mayPrepareEncouragement: formData.get("mayPrepareEncouragement") === "on"
        })
      });
    } catch {
      setSubmitState({
        status: "error",
        message: "The preview route could not be reached. Please try again."
      });
      return;
    }

    const result = (await response.json()) as { ok?: boolean; reference?: string; message?: string };

    if (!response.ok || !result.ok) {
      setSubmitState({
        status: "error",
        message: result.message || "The story was not submitted. Please check the form and try again."
      });
      return;
    }

    form.reset();
    setStoryLength(0);
    setSubmitState({
      status: "success",
      reference: result.reference || "SOH-LITE-PREVIEW",
      message: result.message || "Preview submission received."
    });
  }

  return (
    <main className="spark-page" data-app-marker="spark-of-hope-intake-lite">
      <nav className="spark-nav" aria-label="Spark of Hope Intake Lite">
        <Link href="/" className="spark-brand">
          Spark of Hope Intake Lite
        </Link>
        <div>
          <a href="#privacy">Privacy</a>
          <a href="#share">Share a story</a>
        </div>
      </nav>

      <section className="spark-hero">
        <div className="spark-hero-copy">
          <p className="eyebrow">Private preview</p>
          <h1>Share one hopeful story with care.</h1>
          <p>
            This preview lets someone share a hopeful moment so an approved team can review it privately and prepare
            encouragement without exposing the story publicly.
          </p>
          <div className="spark-pill-row" aria-label="Preview guardrails">
            <span>Private by default</span>
            <span>Review-gated storage</span>
            <span>No paid resources</span>
          </div>
        </div>

        <aside className="spark-trust-rail" aria-label="What happens next">
          <span>{statusText}</span>
          <strong>What happens next</strong>
          <ol>
            <li>The story is checked for the preview only.</li>
            <li>An approved person could review it in a later phase.</li>
            <li>Encouragement can be prepared without public posting.</li>
          </ol>
        </aside>
      </section>

      <section className="spark-layout" id="share">
        <form className="spark-form-panel" onSubmit={submitStory}>
          <div>
            <p className="eyebrow">Story intake</p>
            <h2>Tell the story</h2>
            <p>
              Keep it simple. Share enough context for a trusted team to understand the hopeful moment and respond with
              care.
            </p>
          </div>

          <label>
            Preferred name
            <input name="preferredName" type="text" autoComplete="name" placeholder="What should the team call you?" />
          </label>

          <label>
            Email for follow-up
            <input name="email" type="email" autoComplete="email" placeholder="name@example.com" />
          </label>

          <label>
            Short title
            <input name="storyTitle" type="text" placeholder="A small moment of hope" />
          </label>

          <label>
            Hopeful story
            <textarea
              name="storyBody"
              minLength={40}
              maxLength={5000}
              required
              onChange={(event) => setStoryLength(event.target.value.length)}
              placeholder="What happened? What gave you hope? What would help the team understand this moment?"
            />
          </label>
          <p className="spark-helper">{storyLength}/5000 characters</p>

          <fieldset className="spark-consents">
            <legend>Consent</legend>
            <label className="spark-checkbox">
              <input name="mayReview" type="checkbox" required />
              <span>I understand this story may be reviewed privately by an approved team for this pilot.</span>
            </label>
            <label className="spark-checkbox">
              <input name="mayPrepareEncouragement" type="checkbox" required />
              <span>I understand the team may prepare encouragement from this story.</span>
            </label>
            <label className="spark-checkbox">
              <input name="mayContact" type="checkbox" />
              <span>It is okay to contact me about this story.</span>
            </label>
          </fieldset>

          {submitState.status === "success" ? (
            <div className="spark-status success" role="status">
              <strong>Story preview received</strong>
              <p>{submitState.message}</p>
              <span className="spark-reference">{submitState.reference}</span>
            </div>
          ) : null}

          {submitState.status === "error" ? (
            <div className="spark-status error" role="alert">
              <strong>The story was not submitted</strong>
              <p>{submitState.message}</p>
            </div>
          ) : null}

          <button className="button primary spark-submit" type="submit" disabled={!canSubmit}>
            {submitState.status === "submitting" ? "Submitting..." : "Submit story"}
          </button>
        </form>

        <aside className="spark-side-panel" id="privacy">
          <p className="eyebrow">Privacy note</p>
          <h2>Your story is not a public post.</h2>
          <p>
            This preview defaults to a mock submission route. Controlled preview storage can be enabled only behind
            review-gated server settings, while production writes stay blocked.
          </p>

          <div className="spark-note-grid">
            <div>
              <span>Collected</span>
              <p>Only the story, optional contact details, and consent choices needed for review.</p>
            </div>
            <div>
              <span>Protected</span>
              <p>Story content stays separate from contact details in the planned data model.</p>
            </div>
            <div>
              <span>Blocked</span>
              <p>Production deployment, real storage, and provider provisioning remain blocked.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
