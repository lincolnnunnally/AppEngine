"use client";

import { useState } from "react";

// "Push my saved value" — copies the value the owner stored in their key vault
// into this app's Vercel project, so they don't paste it by hand. Only rendered
// for Vercel-hosted keys; the server validates everything and pulls the value
// from the vault (nothing secret passes through the browser). One confirm before
// it writes a live production secret.
export function CredentialPushButton({ slug, envVar, appName }: { slug: string; envVar: string; appName: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function push() {
    if (!window.confirm(`Push your saved ${envVar} into ${appName}'s Vercel project? This writes a live production value.`)) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/engine/ops/push-env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, envVar })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setResult({ ok: Boolean(data.ok), message: data.message || (data.ok ? "Pushed." : "Couldn't push it.") });
    } catch {
      setResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="cred-push">
      <button type="button" className="account-link-button" onClick={push} disabled={busy}>
        {busy ? "Pushing…" : "Push my saved value"}
      </button>
      {result ? <small className={`cred-push-note ${result.ok ? "ok" : "err"}`}>{result.message}</small> : null}
    </span>
  );
}
