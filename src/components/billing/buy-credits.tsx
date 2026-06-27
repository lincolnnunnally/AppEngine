"use client";

import { useState } from "react";

// Buy-credit buttons. POSTs to the checkout route and redirects to Stripe.
export function BuyCredits({ packsCents }: { packsCents: number[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packCents: number) {
    setBusy(packCents);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packCents })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.message || "Couldn't start checkout. Try again.");
      setBusy(null);
    } catch {
      setError("Network error. Try again.");
      setBusy(null);
    }
  }

  return (
    <div className="buy-credits">
      <div className="buy-credits-row">
        {packsCents.map((cents) => (
          <button
            key={cents}
            type="button"
            className="soft-launch-action"
            disabled={busy !== null}
            onClick={() => buy(cents)}
          >
            {busy === cents ? "Opening…" : `Add $${(cents / 100).toFixed(0)}`}
          </button>
        ))}
      </div>
      {error ? <p className="integration-notice integration-notice--error">{error}</p> : null}
    </div>
  );
}
