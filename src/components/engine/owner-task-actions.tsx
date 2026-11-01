"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Buttons on one to-do card. Same shape as InboxActions so the two queues feel
// the same: one click to change state, an optional note, refresh on save.
export function OwnerTaskActions({ id, status, ownerNote }: { id: string; status: string; ownerNote: string }) {
  const router = useRouter();
  const [note, setNote] = useState(ownerNote);
  const [showNote, setShowNote] = useState(Boolean(ownerNote));
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

  return (
    <div className="inbox-actions">
      <div className="dx-app-actions">
        {active ? (
          <>
            <button className="dx-btn dx-btn--primary" type="button" disabled={busy} onClick={() => act({ status: "done" })}>
              Done
            </button>
            {status !== "waiting" ? (
              <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "waiting" })}>
                Started, waiting on someone
              </button>
            ) : (
              <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "open" })}>
                Back to to-do
              </button>
            )}
            <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "dismissed" })}>
              Not doing this
            </button>
          </>
        ) : (
          <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "open" })}>
            Reopen
          </button>
        )}
        {!showNote ? (
          <button className="dx-btn" type="button" disabled={busy} onClick={() => setShowNote(true)}>
            Add a note
          </button>
        ) : null}
      </div>
      {showNote ? (
        <>
          <label className="help-field" style={{ marginTop: 10 }}>
            <span>Your note (agents read this)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="What you did, the answer to the question, or what is still needed."
            />
          </label>
          <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ ownerNote: note })}>
            Save note
          </button>
        </>
      ) : null}
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
