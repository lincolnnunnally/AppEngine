"use client";

import { useRef, useState } from "react";
import { DomainStep } from "@/components/build/domain-step";
import { ThemePicker } from "@/components/build/theme-picker";

type Phase = "idle" | "building" | "deploying" | "live" | "failed";

const LABEL: Record<Phase, string> = {
  idle: "",
  building: "Building your app…",
  deploying: "Publishing it live…",
  live: "Live — open your app:",
  failed: "Something went wrong."
};

export function BuildExperience({ domainsEnabled = false }: { domainsEnabled?: boolean }) {
  const [idea, setIdea] = useState("");
  const [themeId, setThemeId] = useState("auto");
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function poll(jobId: string) {
    const tick = async () => {
      try {
        const response = await fetch(`/api/build/status?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          status?: Phase;
          url?: string;
          project?: string;
          error?: string;
          message?: string;
        };
        if (!data.ok) {
          setPhase("failed");
          setError(data.message || "Lost track of the build.");
          return;
        }
        if (data.status) setPhase(data.status);
        if (data.url) setUrl(data.url);
        if (data.project) setProject(data.project);
        if (data.status === "live") return;
        if (data.status === "failed") {
          setError(data.error || "Build failed.");
          return;
        }
        timer.current = setTimeout(tick, 4000);
      } catch {
        timer.current = setTimeout(tick, 5000);
      }
    };
    tick();
  }

  async function start() {
    setError(null);
    setUrl(null);
    setProject(null);
    setPhase("building");
    try {
      const response = await fetch("/api/build/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, themeId })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; jobId?: string; message?: string };
      if (!data.ok || !data.jobId) {
        setPhase("failed");
        setError(data.message || "Couldn't start the build.");
        return;
      }
      poll(data.jobId);
    } catch {
      setPhase("failed");
      setError("Network error — try again.");
    }
  }

  const busy = phase === "building" || phase === "deploying";

  return (
    <section className="panel">
      <p className="eyebrow">Build</p>
      <h1>Build your app</h1>
      <p>Describe what you want. We build it and publish it live — you just watch, then open the link.</p>
      <textarea
        className="convo-input"
        rows={3}
        value={idea}
        placeholder="Example: a simple visitor sign-up and follow-up tracker for our church"
        onChange={(event) => setIdea(event.target.value)}
        disabled={busy}
        aria-label="Describe the app you want"
      />
      {!busy && phase === "idle" ? <ThemePicker value={themeId} onChange={setThemeId} /> : null}
      <div style={{ marginTop: 12 }}>
        <button className="soft-launch-action" type="button" onClick={start} disabled={busy || idea.trim().length < 8}>
          {busy ? "Building…" : "Build it"}
        </button>
      </div>

      {phase !== "idle" ? (
        <div className="build-status" style={{ marginTop: 18 }}>
          <p className={phase === "live" ? "build-status-live" : undefined}>{LABEL[phase]}</p>
          {url ? (
            <p>
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </p>
          ) : null}
          {error ? <p className="integration-notice integration-notice--error">{error}</p> : null}
        </div>
      ) : null}

      {phase === "live" ? <DomainStep projectName={project} domainsEnabled={domainsEnabled} /> : null}
    </section>
  );
}
