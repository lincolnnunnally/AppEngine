"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  buildSparkReviewQueueNextPrompt,
  createSparkReviewQueueItem,
  getApprovedSparkPreviewItems,
  isSparkReviewStatus,
  sparkReviewQueueGuardrails,
  sparkReviewQueueStorageKey,
  sparkReviewStatuses,
  updateSparkReviewQueueFollowUp,
  updateSparkReviewQueueStatus,
  type SparkReviewQueueItem,
  type SparkReviewStatus
} from "@/lib/spark-of-hope-intake-lite/review-queue";
import {
  buildSparkReminderNextPrompt,
  createSparkReminderQueueItem,
  isSparkReminderStatus,
  sparkReminderQueueGuardrails,
  sparkReminderQueueStorageKey,
  sparkReminderStatuses,
  updateSparkReminderStatus,
  type SparkReminderQueueItem,
  type SparkReminderStatus
} from "@/lib/spark-of-hope-intake-lite/reminder-queue";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; reference: string; message: string }
  | { status: "error"; message: string };

export default function SparkOfHopeIntakeLitePage() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [storyLength, setStoryLength] = useState(0);
  const [reviewQueueItems, setReviewQueueItems] = useState<SparkReviewQueueItem[]>([]);
  const [reminderQueueItems, setReminderQueueItems] = useState<SparkReminderQueueItem[]>([]);
  const [reviewPromptCopied, setReviewPromptCopied] = useState("Ready to copy");
  const [reminderPromptCopied, setReminderPromptCopied] = useState("Ready to copy");
  const canSubmit = submitState.status !== "submitting";
  const approvedPreviewItems = getApprovedSparkPreviewItems(reviewQueueItems);
  const reviewPrompt = buildSparkReviewQueueNextPrompt(reviewQueueItems);
  const reminderPrompt = buildSparkReminderNextPrompt(reminderQueueItems);

  const statusText =
    submitState.status === "success"
      ? "Preview received"
      : submitState.status === "error"
        ? "Needs attention"
        : submitState.status === "submitting"
          ? "Submitting preview"
        : "Preview mode";

  useEffect(() => {
    try {
      const storedItems = window.localStorage.getItem(sparkReviewQueueStorageKey);
      if (!storedItems) {
        return;
      }

      const parsedItems = JSON.parse(storedItems) as SparkReviewQueueItem[];
      if (Array.isArray(parsedItems)) {
        setReviewQueueItems(
          parsedItems
            .filter((item) => item && isSparkReviewStatus(item.status))
            .map((item) => ({
              ...item,
              followUpNotes: item.followUpNotes || "No follow-up notes yet.",
              recommendedNextStep: item.recommendedNextStep || "Review privately before any encouragement or preview action."
            }))
        );
      }
    } catch {
      setReviewQueueItems([]);
    }

    try {
      const storedReminderItems = window.localStorage.getItem(sparkReminderQueueStorageKey);
      if (!storedReminderItems) {
        return;
      }

      const parsedReminderItems = JSON.parse(storedReminderItems) as SparkReminderQueueItem[];
      if (Array.isArray(parsedReminderItems)) {
        setReminderQueueItems(parsedReminderItems.filter((item) => item && isSparkReminderStatus(item.status)));
      }
    } catch {
      setReminderQueueItems([]);
    }
  }, []);

  function saveReviewQueue(items: SparkReviewQueueItem[]) {
    setReviewQueueItems(items);

    try {
      window.localStorage.setItem(sparkReviewQueueStorageKey, JSON.stringify(items));
    } catch {
      setReviewPromptCopied("Local queue could not be saved in this browser.");
    }
  }

  function updateReviewStatus(id: string, status: SparkReviewStatus) {
    saveReviewQueue(reviewQueueItems.map((item) => (item.id === id ? updateSparkReviewQueueStatus(item, status) : item)));
  }

  function saveReminderQueue(items: SparkReminderQueueItem[]) {
    setReminderQueueItems(items);

    try {
      window.localStorage.setItem(sparkReminderQueueStorageKey, JSON.stringify(items));
    } catch {
      setReminderPromptCopied("Local reminder queue could not be saved in this browser.");
    }
  }

  function updateReminderStatus(id: string, status: SparkReminderStatus) {
    saveReminderQueue(reminderQueueItems.map((item) => (item.id === id ? updateSparkReminderStatus(item, status) : item)));
  }

  function updateReviewFollowUp(
    id: string,
    followUp: {
      followUpNotes?: string;
      recommendedNextStep?: string;
    }
  ) {
    saveReviewQueue(
      reviewQueueItems.map((item) => (item.id === id ? updateSparkReviewQueueFollowUp(item, followUp) : item))
    );
  }

  async function copySparkReviewPrompt() {
    try {
      await navigator.clipboard.writeText(reviewPrompt);
      setReviewPromptCopied("Prompt copied");
    } catch {
      setReviewPromptCopied("Copy unavailable");
    }
  }

  async function copySparkReminderPrompt() {
    try {
      await navigator.clipboard.writeText(reminderPrompt);
      setReminderPromptCopied("Prompt copied");
    } catch {
      setReminderPromptCopied("Copy unavailable");
    }
  }

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
          categoryOrStruggle: formData.get("categoryOrStruggle"),
          hopeOutcome: formData.get("hopeOutcome"),
          storyBody: formData.get("storyBody"),
          mayReview: formData.get("mayReview") === "on",
          mayContact: formData.get("mayContact") === "on",
          mayPrepareEncouragement: formData.get("mayPrepareEncouragement") === "on",
          reminderPreference: formData.get("reminderPreference"),
          reminderNote: formData.get("reminderNote")
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

    const reviewQueueItem = createSparkReviewQueueItem({
      reference: result.reference || "SOH-LITE-PREVIEW",
      preferredName: String(formData.get("preferredName") || ""),
      storyTitle: String(formData.get("storyTitle") || ""),
      categoryOrStruggle: String(formData.get("categoryOrStruggle") || ""),
      hopeOutcome: String(formData.get("hopeOutcome") || "")
    });
    const reminderQueueItem = createSparkReminderQueueItem({
      reference: result.reference || "SOH-LITE-PREVIEW",
      preferredName: String(formData.get("preferredName") || ""),
      storyTitle: String(formData.get("storyTitle") || ""),
      preference: String(formData.get("reminderPreference") || "none"),
      reminderNote: String(formData.get("reminderNote") || "")
    });

    saveReviewQueue([reviewQueueItem, ...reviewQueueItems]);
    if (reminderQueueItem) {
      saveReminderQueue([reminderQueueItem, ...reminderQueueItems]);
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
          <a href="#approved-preview">Approved preview</a>
          <a href="#review-queue">Review queue</a>
          <a href="#reminders">Reminders</a>
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
            Category or struggle
            <select name="categoryOrStruggle" defaultValue="">
              <option value="">Choose a private review category</option>
              <option value="Discouragement">Discouragement</option>
              <option value="Grief or loss">Grief or loss</option>
              <option value="Family or community">Family or community</option>
              <option value="Recovery or rebuilding">Recovery or rebuilding</option>
              <option value="Serving others">Serving others</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label>
            Hope outcome
            <input name="hopeOutcome" type="text" placeholder="What kind of hope or encouragement would help?" />
          </label>

          <label>
            Follow-up testimony reminder
            <select name="reminderPreference" defaultValue="none">
              <option value="none">No reminder for now</option>
              <option value="one_week">Ask me in about one week</option>
              <option value="one_month">Ask me in about one month</option>
              <option value="after_encouragement">Ask after encouragement is prepared</option>
            </select>
          </label>

          <label>
            Reminder note
            <input name="reminderNote" type="text" placeholder="Optional note for the owner review queue" />
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

      <section className="spark-approved-preview-section" id="approved-preview" data-testid="spark-approved-preview">
        <div className="spark-review-header">
          <div>
            <p className="eyebrow">Approved public preview</p>
            <h2>Only approved stories appear here.</h2>
            <p>
              This local preview list shows safe metadata only for items marked approved for preview. New, hidden,
              needs-review, and needs-follow-up items stay out of this public-facing section.
            </p>
          </div>
          <span>{approvedPreviewItems.length} approved item{approvedPreviewItems.length === 1 ? "" : "s"}</span>
        </div>

        {approvedPreviewItems.length ? (
          <div className="spark-approved-preview-list" aria-live="polite">
            {approvedPreviewItems.map((item) => (
              <article className="spark-approved-preview-card" key={item.id}>
                <span>{item.categoryOrStruggle}</span>
                <h3>{item.titleOrName}</h3>
                <p>{item.hopeOutcome}</p>
                <small>{item.safeIdentifier}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="spark-review-empty">
            <strong>No approved preview stories yet.</strong>
            <p>
              Submitted items stay private until the owner changes one to approved for preview. Nothing is publicly
              promoted, shared, or matched automatically.
            </p>
          </div>
        )}
      </section>

      <section className="spark-reminder-section" id="reminders" data-testid="spark-reminder-lite">
        <div className="spark-review-header">
          <div>
            <p className="eyebrow">Contributor Reminder Lite</p>
            <h2>Local reminder review queue</h2>
            <p>
              This owner-visible list helps remember who may want to share a follow-up testimony later. It does not send
              emails, texts, push notifications, or publish anything.
            </p>
          </div>
          <span>{reminderQueueItems.length} reminder item{reminderQueueItems.length === 1 ? "" : "s"}</span>
        </div>

        <div className="spark-review-body">
          <div className="spark-review-list" aria-live="polite">
            {reminderQueueItems.length ? (
              reminderQueueItems.map((item) => (
                <article className="spark-review-card" key={item.id}>
                  <div className="spark-review-card-header">
                    <div>
                      <span>{item.safeIdentifier}</span>
                      <h3>{item.titleOrName}</h3>
                    </div>
                    <label>
                      Reminder status
                      <select
                        value={item.status}
                        onChange={(event) => updateReminderStatus(item.id, event.target.value as SparkReminderStatus)}
                      >
                        {sparkReminderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <dl className="spark-review-details">
                    <div>
                      <dt>Preference</dt>
                      <dd>{item.preferenceLabel}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{new Date(item.submittedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Reminder note</dt>
                      <dd>{item.reminderNote}</dd>
                    </div>
                    <div>
                      <dt>Safety note</dt>
                      <dd>{item.safetyNote}</dd>
                    </div>
                  </dl>

                  <p className="spark-review-owner-note">{item.ownerReviewNote}</p>
                </article>
              ))
            ) : (
              <div className="spark-review-empty">
                <strong>No reminder requests yet.</strong>
                <p>Reminder preferences stay local/mock and never send messages automatically.</p>
              </div>
            )}
          </div>

          <aside className="spark-review-notes" aria-label="Spark reminder guardrails and next prompt">
            <div>
              <p className="eyebrow">Reminder guardrails</p>
              <ul>
                {sparkReminderQueueGuardrails.map((guardrail) => (
                  <li key={guardrail}>{guardrail}</li>
                ))}
              </ul>
            </div>

            <label>
              Copyable reminder prompt
              <textarea readOnly value={reminderPrompt} />
            </label>
            <button className="button secondary" type="button" onClick={copySparkReminderPrompt}>
              Copy reminder prompt
            </button>
            <p className="spark-helper">{reminderPromptCopied}</p>
          </aside>
        </div>
      </section>

      <section className="spark-review-section" id="review-queue" data-testid="spark-review-queue-lite">
        <div className="spark-review-header">
          <div>
            <p className="eyebrow">Spark Review Queue Lite</p>
            <h2>Private queue for preview submissions</h2>
            <p>
              Submitted stories appear here as safe review metadata only. The queue does not publish stories, expose
              contact details, trigger follow-up, or start mentor matching.
            </p>
          </div>
          <span>{reviewQueueItems.length} local item{reviewQueueItems.length === 1 ? "" : "s"}</span>
        </div>

        <div className="spark-review-body">
          <div className="spark-review-list" aria-live="polite">
            {reviewQueueItems.length ? (
              reviewQueueItems.map((item) => (
                <article className="spark-review-card" key={item.id}>
                  <div className="spark-review-card-header">
                    <div>
                      <span>{item.safeIdentifier}</span>
                      <h3>{item.titleOrName}</h3>
                    </div>
                    <label>
                      Status
                      <select
                        value={item.status}
                        onChange={(event) => updateReviewStatus(item.id, event.target.value as SparkReviewStatus)}
                      >
                        {sparkReviewStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <dl className="spark-review-details">
                    <div>
                      <dt>Category/struggle</dt>
                      <dd>{item.categoryOrStruggle}</dd>
                    </div>
                    <div>
                      <dt>Hope outcome</dt>
                      <dd>{item.hopeOutcome}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{new Date(item.submittedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Safety/moderation</dt>
                      <dd>{item.safetyModerationNote}</dd>
                    </div>
                  </dl>

                  <p className="spark-review-owner-note">{item.ownerReviewNotes}</p>

                  <div className="spark-review-follow-up">
                    <label>
                      Follow-up notes
                      <textarea
                        value={item.followUpNotes}
                        onChange={(event) =>
                          updateReviewFollowUp(item.id, {
                            followUpNotes: event.target.value,
                            recommendedNextStep: item.recommendedNextStep
                          })
                        }
                        placeholder="What needs follow-up, clarification, or care before any next step?"
                      />
                    </label>
                    <label>
                      Recommended next step
                      <input
                        value={item.recommendedNextStep}
                        onChange={(event) =>
                          updateReviewFollowUp(item.id, {
                            followUpNotes: item.followUpNotes,
                            recommendedNextStep: event.target.value
                          })
                        }
                        placeholder="Example: Send encouragement, hold for review, or prepare for preview approval."
                      />
                    </label>
                  </div>
                </article>
              ))
            ) : (
              <div className="spark-review-empty">
                <strong>No local preview submissions yet.</strong>
                <p>Submit the form once to create a private review queue item in this browser.</p>
              </div>
            )}
          </div>

          <aside className="spark-review-notes" aria-label="Spark review guardrails and next prompt">
            <div>
              <p className="eyebrow">Guardrails</p>
              <ul>
                {sparkReviewQueueGuardrails.map((guardrail) => (
                  <li key={guardrail}>{guardrail}</li>
                ))}
              </ul>
            </div>

            <label>
              Copyable next prompt
              <textarea readOnly value={reviewPrompt} />
            </label>
            <button className="button secondary" type="button" onClick={copySparkReviewPrompt}>
              Copy next prompt
            </button>
            <p className="spark-helper">{reviewPromptCopied}</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
