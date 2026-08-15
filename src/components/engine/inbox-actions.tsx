"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InboxActions({
  id,
  status,
  ownerNote
}: {
  id: string;
  status: string;
  ownerNote: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState(ownerNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(next: { status?: string; ownerNote?: string }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/engine/inbox", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...next })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.message || "That update did not save.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the inbox.");
    }
    setBusy(false);
  }

  return (
    <div className="inbox-actions">
      <div className="dx-app-actions">
        {status !== "in_progress" ? (
          <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "in_progress" })}>
            I am on it
          </button>
        ) : null}
        {status !== "resolved" ? (
          <button className="dx-btn dx-btn--primary" type="button" disabled={busy} onClick={() => act({ status: "resolved" })}>
            Mark resolved
          </button>
        ) : (
          <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ status: "open" })}>
            Reopen
          </button>
        )}
      </div>
      <label className="help-field" style={{ marginTop: 10 }}>
        <span>Your note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="What you did, or what is still needed."
        />
      </label>
      <button className="dx-btn" type="button" disabled={busy} onClick={() => act({ ownerNote: note })}>
        Save note
      </button>
      {error ? <p className="dx-note" style={{ color: "var(--pink)" }}>{error}</p> : null}
    </div>
  );
}
