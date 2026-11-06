"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Buttons on one to-do card. Same shape as InboxActions so the two queues feel
// the same: one click to change state, an optional note, refresh on save.
// Two extras (owner request 2026-11-06):
// - "This is wrong" — an ask that would have done harm leaves the list at once,
//   with the reason, and only comes back after an agent fixes and re-checks it.
// - Decisions get an answer box: type the call, send it, an agent acts on it.
export function OwnerTaskActions({
  id,
  status,
  ownerNote,
  kind
}: {
  id: string;
  status: string;
  ownerNote: string;
  kind?: string;
}) {
  const router = useRouter();
  const isDecision = kind === "decision";
  const [note, setNote] = useState(ownerNote);
  const [showNote, setShowNote] = useState(Boolean(ownerNote) || isDecision);
  const [reportingWrong, setReportingWrong] = useState(false);
  const [wrongWhy, setWrongWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(next: { status?: string; ownerNote?: string }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/engine/owner-tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...next })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.message || "That did not save.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the to-do list.");
    }
    setBusy(false);
  }

  const active = status === "open" || status === "waiting";

  if (reportingWrong) {
    return (
      <div className="inbox-actions owner-task-wrong">
        <label className="help-field">
          <span>What&apos;s wrong with it? (the agent that fixes it reads this)</span>
          <textarea
            value={wrongWhy}
            onChange={(event) => setWrongWhy(event.target.value)}
            rows={2}
            autoFocus
            placeholder="e.g. That key can't be shown in Vercel / doing step 3 would break the live site / this is already done"
          />
        </label>
        <div className="dx-app-actions">
          <button
            className="dx-btn dx-btn--danger"
            type="button"
            disabled={busy || wrongWhy.trim().length < 3}
            onClick={() => act({ status: "wrong", ownerNote: `Wrong: ${wrongWhy.trim()}` })}
          >
            Take it off my list
          </button>
          <button className="dx-btn" type="button" disabled={busy} onClick={() => setReportingWrong(false)}>
            Cancel
          </button>
        </div>
        {error ? <p className="dx-note" style={{ color: "var(--pink)" }}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="inbox-actions">
      {showNote ? (
        <label className="help-field" style={{ marginBottom: 10 }}>
          <span>{isDecision ? "Your answer (an agent acts on it)" : "Your note (agents read this)"}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder={
              isDecision ? "Type your decision in plain words. An agent records it and does the rest." : "What you did, or what is still needed."
            }
          />
        </label>
      ) : null}
      <div className="dx-app-actions">
        {active ? (
          <>
            {isDecision ? (
              <button
                className="dx-btn dx-btn--primary"
                type="button"
                disabled={busy || note.trim().length < 2}
                onClick={() => act({ status: "waiting", ownerNote: note })}
              >
                Send my answer
              </button>
            ) : (
              <button className="dx-btn dx-btn--primary" type="button" disabled={busy} onClick={() => act({ status: "done", ownerNote: note !== ownerNote ? note : undefined })}>
                Done
              </button>
            )}
            {!isDecision && status !== "waiting" ? (
              <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "waiting" })}>
                Started, waiting on someone
              </button>
            ) : null}
            {status === "waiting" && !isDecision ? (
              <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "open" })}>
                Back to to-do
              </button>
            ) : null}
            {showNote && !isDecision ? (
              <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ ownerNote: note })}>
                Save note
              </button>
            ) : null}
            {!showNote ? (
              <button className="dx-btn" type="button" disabled={busy} onClick={() => setShowNote(true)}>
                Add a note
              </button>
            ) : null}
            <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "dismissed" })}>
              Not doing this
            </button>
            <button className="dx-btn dx-btn--danger" type="button" disabled={busy} onClick={() => setReportingWrong(true)}>
              This is wrong
            </button>
          </>
        ) : (
          <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "open" })}>
            Reopen
          </button>
        )}
      </div>
      {error ? <p className="dx-note" style={{ color: "var(--pink)" }}>{error}</p> : null}
    </div>
  );
}

// A quick capture box so the owner can park his own reminders on the same list.
export function OwnerTaskAddForm({ apps }: { apps: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [app, setApp] = useState("ecosystem");
  const [why, setWhy] = useState("");
  const [link, setLink] = useState("");
  const [priority, setPriority] = useState("recommended");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/engine/owner-tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, app, why, link, priority, kind: "other", requestedBy: "Lincoln" })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; results?: Array<{ error?: string }> } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.results?.[0]?.error || "That did not save.");
        setBusy(false);
        return;
      }
      setTitle("");
      setWhy("");
      setLink("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the to-do list.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button className="dx-btn" type="button" onClick={() => setOpen(true)}>
        + Add your own
      </button>
    );
  }

  return (
    <div className="inbox-actions">
      <label className="help-field">
        <span>What needs doing</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Renew the domain for…" />
      </label>
      <label className="help-field">
        <span>Which app</span>
        <select value={app} onChange={(event) => setApp(event.target.value)}>
          <option value="ecosystem">Across all apps</option>
          {apps.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label className="help-field">
        <span>How important</span>
        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="blocker">Blocking something</option>
          <option value="recommended">Should do</option>
          <option value="optional">When I can</option>
        </select>
      </label>
      <label className="help-field">
        <span>Why (optional)</span>
        <input value={why} onChange={(event) => setWhy(event.target.value)} />
      </label>
      <label className="help-field">
        <span>Link (optional)</span>
        <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" />
      </label>
      <div className="dx-app-actions">
        <button className="dx-btn dx-btn--primary" type="button" disabled={busy || title.trim().length < 4} onClick={save}>
          Add to the list
        </button>
        <button className="dx-btn" type="button" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className="dx-note" style={{ color: "var(--pink)" }}>{error}</p> : null}
    </div>
  );
}
