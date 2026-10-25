"use client";

import { useEffect, useRef, useState } from "react";
import { ApproveApp } from "@/components/account/approve-app";
import { clearComposeDraft } from "@/lib/ui/compose-draft";

type Step = "checking" | "awaiting_payment" | "building" | "deploying" | "live" | "failed" | "cancelled";

const STEP_LABEL: Record<Step, string> = {
  checking: "Checking your order…",
  awaiting_payment: "Waiting for Stripe to confirm your payment…",
  building: "Payment received. Building your app… (writing the code)",
  deploying: "Publishing it… (putting it on the web)",
  live: "Ready — your app is up:",
  failed: "Something went wrong.",
  cancelled: "Checkout was cancelled — you weren't charged."
};

// Follows a paid flat-rate order: order (until the webhook confirms payment and
// starts the build) → build job (until it's live). Same states the compose
// screen shows for a direct build.
export function OrderProgress({ orderId, cancelled }: { orderId: string; cancelled: boolean }) {
  const [step, setStep] = useState<Step>(cancelled ? "cancelled" : "checking");
  const [url, setUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cancelled) return;
    let stopped = false;
    let waits = 0;

    const pollJob = async (id: string) => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/build/status?jobId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; status?: string; url?: string; error?: string; message?: string };
        if (!data.ok) {
          setStep("failed");
          setError(data.message || "Lost track of the build.");
          return;
        }
        if (data.url) setUrl(data.url);
        if (data.status === "live") return setStep("live");
        if (data.status === "failed") {
          setStep("failed");
          setError(data.error || "The build failed.");
          return;
        }
        setStep(data.status === "deploying" ? "deploying" : "building");
      } catch {
        // keep polling; the build runs on the server either way
      }
      timer.current = setTimeout(() => pollJob(id), 4000);
    };

    const pollOrder = async () => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/build/order?id=${encodeURIComponent(orderId)}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; status?: string; jobId?: string | null; message?: string };
        if (!data.ok) {
          setStep("failed");
          setError(data.message || "We couldn't find this order.");
          return;
        }
        if (data.jobId) {
          clearComposeDraft();
          setJobId(data.jobId);
          setStep("building");
          return pollJob(data.jobId);
        }
        setStep("awaiting_payment");
        waits += 1;
      } catch {
        waits += 1;
      }
      // Stripe usually confirms within seconds; after ~3 minutes, say so plainly.
      if (waits > 45) {
        setStep("failed");
        setError("We haven't received Stripe's payment confirmation yet. If you were charged, your build will start automatically — check your apps in a few minutes.");
        return;
      }
      timer.current = setTimeout(pollOrder, 4000);
    };

    void pollOrder();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [orderId, cancelled]);

  return (
    <section className="compose" aria-label="Your app order">
      <header className="convo-head">
        <p className="convo-eyebrow">Your order</p>
        <h2 className="convo-title">{step === "live" ? "Your app is live" : step === "cancelled" ? "No charge made" : "Building your app"}</h2>
      </header>
      <div className="build-status" aria-live="polite">
        <p className={step === "live" ? "build-status-live" : undefined}>{STEP_LABEL[step]}</p>
        {step === "building" || step === "deploying" ? <p className="note">Usually takes a few minutes — you can keep this page open.</p> : null}
        {url ? (
          <p>
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </p>
        ) : null}
        {step === "live" && jobId ? (
          <>
            <p className="note">Try the live site. Happy with it? Make it official — that exact version becomes your app&apos;s main link.</p>
            <ApproveApp jobId={jobId} onApproved={(officialUrl) => setUrl(officialUrl)} />
          </>
        ) : null}
        {error ? <p className="integration-notice integration-notice--error">{error}</p> : null}
      </div>
      <p style={{ marginTop: 16 }}>
        {step === "cancelled" ? <a href="/">← Back to your pack</a> : <a href="/account">View all your apps →</a>}
      </p>
    </section>
  );
}
