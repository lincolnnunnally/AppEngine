"use client";

import { useState } from "react";

// "Make it official" — promotes the tested preview to the app's main link. The
// exact version the user just tried is what goes live; nothing is rebuilt.
export function ApproveApp({ jobId, onApproved }: { jobId: string; onApproved?: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/approve-app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; url?: string };
      if (data.ok) {
        setDone(data.url || "done");
        if (data.url && onApproved) onApproved(data.url);
        return;
      }
      setError(data.message || "Couldn't approve it. Try again.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="note">
        This version is official{done !== "done" ? <> — <a href={done} target="_blank" rel="noreferrer">{done}</a></> : null}.
      </p>
    );
  }

  return (
    <div className="approve-app">
      <button type="button" className="soft-launch-action" onClick={approve} disabled={busy}>
        {busy ? "Making it official…" : "Approve — make it official"}
      </button>
      {error ? <p className="note">{error}</p> : null}
    </div>
  );
}
