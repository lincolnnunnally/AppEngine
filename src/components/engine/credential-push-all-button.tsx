"use client";

import { useState } from "react";

// "Push all my saved keys" — the one-click version of the per-key push. For every
// Vercel-hosted slot this app has, it copies the value the owner stored in their
// key vault into the app's Vercel project, so a single vault genuinely feeds the
// app instead of pasting keys one at a time. Server validates everything, pulls
// values from the vault, and skips any slot with no saved value (nothing invented).
// One confirm before it writes live production values.
export function CredentialPushAllButton({ slug, appName, count }: { slug: string; appName: string; count: number }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function pushAll() {
    if (!window.confirm(`Push all your saved keys for ${appName} into its Vercel project? This writes live production values (skips any key you haven't saved).`)) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/engine/ops/push-env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, all: true })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setResult({ ok: Boolean(data.ok), message: data.message || (data.ok ? "Pushed." : "Couldn't push.") });
    } catch {
      setResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="cred-push cred-push--all">
      <button type="button" className="account-link-button" onClick={pushAll} disabled={busy}>
        {busy ? "Pushing…" : `Push all my saved keys${count ? ` (${count})` : ""}`}
      </button>
      {result ? <small className={`cred-push-note ${result.ok ? "ok" : "err"}`}>{result.message}</small> : null}
    </span>
  );
}
