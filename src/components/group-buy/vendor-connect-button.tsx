"use client";

import { useState } from "react";

type Props = {
  vendorId: string;
  ready: boolean;
  started: boolean;
};

export function VendorConnectButton({ vendorId, ready, started }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/group-buy/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendorId, action: "onboard" })
      });
      const data = (await response.json()) as { ok?: boolean; url?: string; message?: string };

      if (!data.ok || !data.url) {
        setError(data.message || "Stripe did not return an onboarding link.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not reach Stripe just now.");
    } finally {
      setBusy(false);
    }
  }

  if (ready) {
    return null;
  }

  return (
    <span>
      <button className="dx-tag" type="button" onClick={start} disabled={busy}>
        {busy ? "Opening Stripe…" : started ? "Finish Stripe payouts →" : "Invite vendor to Stripe →"}
      </button>
      {error ? <span className="dx-note"> {error}</span> : null}
    </span>
  );
}
