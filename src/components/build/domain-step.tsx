"use client";

import { useState } from "react";

// The "review step" after a build goes live: an optional custom domain. Reuses the
// existing domain APIs — /api/domains/check explores availability (free, always on),
// /api/domains/buy quotes + buys (paid, two-step confirm, only when enabled). When
// buying is off we still let the customer search and we set expectations plainly.
type Check = { available: boolean; domain: string; priceUsd?: number; mock?: boolean };
type Quote = { available: boolean; domain: string; priceUsd?: number };

export function DomainStep({ projectName, domainsEnabled }: { projectName: string | null; domainsEnabled: boolean }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCheck(null);
    setQuote(null);
    setDone(null);
    setError(null);
  }

  async function search() {
    setBusy(true);
    reset();
    try {
      const response = await fetch("/api/domains/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain })
      });
      const data = (await response.json().catch(() => ({}))) as Check & { ok?: boolean; message?: string };
      if (!data.ok) {
        setError(data.message || "Couldn't check that domain.");
        return;
      }
      setCheck({ available: Boolean(data.available), domain: data.domain, priceUsd: data.priceUsd, mock: data.mock });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Step 1 of buying: ask the buy API for the real charge (cost + margin) to confirm.
  async function getQuote() {
    setBusy(true);
    setError(null);
    setQuote(null);
    try {
      const response = await fetch("/api/domains/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: check?.domain || domain })
      });
      const data = (await response.json().catch(() => ({}))) as Quote & { ok?: boolean; message?: string };
      if (!data.ok) {
        setError(data.message || "Couldn't price that domain.");
        return;
      }
      if (!data.available) {
        setError("That domain isn't available to buy.");
        return;
      }
      setQuote({ available: true, domain: data.domain, priceUsd: data.priceUsd });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Step 2 of buying: confirmed — charge credits, register, attach.
  async function confirmBuy() {
    if (!quote || !projectName) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/domains/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: quote.domain, projectName, confirm: true })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (data.ok) {
        setDone(data.message || `${quote.domain} is yours and attached to your app.`);
        setQuote(null);
        setCheck(null);
        return;
      }
      setError(data.message || "The purchase didn't go through.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="domain-step">
      <p className="eyebrow">Optional</p>
      <h2>Want a custom domain?</h2>
      <p>Your app is already live at the address above. You can also give it your own name.</p>

      <div className="domain-search">
        <input
          className="convo-input"
          value={domain}
          placeholder="yourname.com"
          onChange={(event) => setDomain(event.target.value)}
          disabled={busy}
          aria-label="Domain you'd like"
        />
        <button
          type="button"
          className="soft-launch-action"
          onClick={search}
          disabled={busy || domain.trim().length < 3}
        >
          {busy && !quote ? "Checking…" : "Check"}
        </button>
      </div>

      {done ? <p className="build-status-live">{done}</p> : null}

      {check && !done ? (
        check.available ? (
          <div className="domain-result">
            <p>
              <strong>{check.domain}</strong> is available
              {check.priceUsd ? <> — about ${check.priceUsd.toFixed(2)}/yr</> : null}.
            </p>
            {domainsEnabled ? (
              !quote ? (
                <button type="button" className="soft-launch-action" onClick={getQuote} disabled={busy}>
                  Get this domain
                </button>
              ) : (
                <div className="domain-confirm">
                  <p>
                    Buy <strong>{quote.domain}</strong>
                    {quote.priceUsd ? <> for ${quote.priceUsd.toFixed(2)}</> : null} from your credits?
                  </p>
                  <div className="domain-confirm-actions">
                    <button type="button" className="soft-launch-action" onClick={confirmBuy} disabled={busy || !projectName}>
                      {busy ? "Buying…" : "Confirm purchase"}
                    </button>
                    <button type="button" className="account-link-button" onClick={() => setQuote(null)} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                  {!projectName ? (
                    <p className="account-app-meta">We couldn't find the app to attach it to — try again from your apps page.</p>
                  ) : null}
                </div>
              )
            ) : (
              <p className="account-app-meta">
                Buying a custom domain turns on soon. For now, your app stays live at the address above.
              </p>
            )}
          </div>
        ) : (
          <p className="domain-result">
            <strong>{check.domain}</strong> is taken — try another name.
          </p>
        )
      ) : null}

      {error ? <p className="integration-notice integration-notice--error">{error}</p> : null}
    </div>
  );
}
