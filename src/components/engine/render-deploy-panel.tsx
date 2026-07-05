"use client";

// The in-product "stand up this app's backend" control. Replaces the old dead-end
// ("go set this in the Render dashboard") for an app whose backend lives on Render.
// Paste the Render key (or use the one on file), click Deploy — AppEngine creates
// the service, sets its env, and builds it, then this polls the health path until
// the backend actually answers. No terminal, no Render dashboard.
import { useState } from "react";

type DeployResponse = {
  ok?: boolean;
  message?: string;
  keySaved?: string;
  serviceUrl?: string;
  dashboardUrl?: string;
  needsRepoConnect?: boolean;
  missingSecrets?: string[];
};

export function RenderDeployPanel({
  slug,
  serviceName,
  expectedBackendUrl,
  renderKeyStored,
}: {
  slug: string;
  serviceName: string;
  expectedBackendUrl: string;
  renderKeyStored: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeployResponse | null>(null);
  const [health, setHealth] = useState<"idle" | "checking" | "live" | "waiting">("idle");

  async function pollHealth(url: string) {
    setHealth("checking");
    for (let i = 0; i < 24; i += 1) {
      // free-tier services can take a minute to cold-build; poll ~4 min.
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const res = await fetch(`/api/engine/ops/deploy-render?url=${encodeURIComponent(url)}`);
        const data = (await res.json()) as { healthy?: boolean };
        if (data.healthy) {
          setHealth("live");
          return;
        }
      } catch {
        /* keep polling */
      }
      setHealth("waiting");
    }
  }

  async function deploy() {
    setBusy(true);
    setResult(null);
    setHealth("idle");
    try {
      const res = await fetch("/api/engine/ops/deploy-render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, apiKey: apiKey.trim() || undefined }),
      });
      const data = (await res.json()) as DeployResponse;
      setResult(data);
      if (data.ok) {
        setApiKey("");
        void pollHealth(data.serviceUrl || expectedBackendUrl);
      }
    } catch {
      setResult({ ok: false, message: "Couldn't reach the deploy service — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="render-deploy">
      <div className="render-deploy__head">
        <strong>Deploy backend</strong>
        <span className="cred-tag">Render: {serviceName}</span>
      </div>
      <p className="integration-hint">
        Stand up this app&apos;s backend on Render straight from here. {renderKeyStored
          ? "Your Render key is on file — just click Deploy."
          : "Paste your Render API key once; it's saved for next time."}
      </p>

      {!renderKeyStored ? (
        <div className="integration-input-row">
          <input
            className="convo-input integration-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="RENDER_API_KEY (dashboard.render.com → Account → API Keys)"
            autoComplete="off"
          />
        </div>
      ) : null}

      <button className="soft-launch-action" type="button" onClick={deploy} disabled={busy || (!renderKeyStored && !apiKey.trim())}>
        {busy ? "Deploying…" : "Deploy backend"}
      </button>

      {result ? (
        <div className={`integration-notice integration-notice--${result.ok ? "ok" : "error"}`} style={{ marginTop: 12 }}>
          <p>{[result.message, result.keySaved].filter(Boolean).join(" ")}</p>
          {result.serviceUrl || result.dashboardUrl ? (
            <p className="render-deploy__links">
              {result.serviceUrl ? (
                <a href={result.serviceUrl} target="_blank" rel="noreferrer">Open backend ↗</a>
              ) : null}
              {result.dashboardUrl ? (
                <a href={result.dashboardUrl} target="_blank" rel="noreferrer">Render dashboard ↗</a>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {health !== "idle" ? (
        <p className="integration-hint">
          {health === "checking" || health === "waiting"
            ? "Checking if the backend is answering… (free tier can take a minute to cold-start)"
            : health === "live"
              ? "✓ Backend is live and answering /api/health."
              : null}
        </p>
      ) : null}
    </div>
  );
}
