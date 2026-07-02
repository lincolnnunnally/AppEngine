"use client";

import { useState } from "react";

// Per-app "request a change" form. POSTs to the account API, which records the
// request durably for the owner. Collapsed by default to keep each app row tidy.
export function RequestChange({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/request-change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, message })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (data.ok) {
        setDone(data.message || "Your change request is recorded.");
        setMessage("");
        setOpen(false);
        return;
      }
      setError(data.message || "Couldn't send that. Try again.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done && !open) {
    return (
      <p className="account-change-done" role="status">
        {done}{" "}
        <button type="button" className="account-link-button" onClick={() => { setDone(null); setOpen(true); }}>
          Request another change
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="account-change-trigger" onClick={() => setOpen(true)}>
        Request a change
      </button>
    );
  }

  return (
    <div className="account-change-form">
      <textarea
        className="convo-input"
        rows={2}
        value={message}
        placeholder="What would you like changed? e.g. add a dark mode, or rename the sign-up button"
        onChange={(event) => setMessage(event.target.value)}
        disabled={busy}
        aria-label="Describe the change you want"
      />
      <div className="account-change-actions">
        <button type="button" className="soft-launch-action" onClick={submit} disabled={busy || message.trim().length < 4}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="account-link-button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      {error ? <p className="integration-notice integration-notice--error">{error}</p> : null}
    </div>
  );
}
