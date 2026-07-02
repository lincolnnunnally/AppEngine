"use client";

import { useRef, useState } from "react";
import { DomainStep } from "@/components/build/domain-step";
import { ThemePicker } from "@/components/build/theme-picker";
import { BrandStep } from "@/components/build/brand-step";
import { ApproveApp } from "@/components/account/approve-app";

type Phase = "idle" | "building" | "deploying" | "live" | "failed";

const LABEL: Record<Phase, string> = {
  idle: "",
  building: "Building your app… (writing the code)",
  deploying: "Publishing it… (putting it on the web)",
  live: "Ready — your app is up:",
  failed: "Something went wrong."
};

export function BuildExperience({ domainsEnabled = false }: { domainsEnabled?: boolean }) {
  const [idea, setIdea] = useState("");
  const [themeId, setThemeId] = useState("auto");
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failStreak = useRef(0);

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
        failStreak.current = 0;
        setConnectionLost(false);
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
        // The build keeps running server-side — this is only OUR connection.
        // After a few misses, stop polling and let the user retry explicitly.
        failStreak.current += 1;
        if (failStreak.current >= 5) {
          setConnectionLost(true);
          return;
        }
        timer.current = setTimeout(tick, 5000);
      }
    };
    tick();
  }

  async function start() {
    setError(null);
    setUrl(null);
    setProject(null);
    setJobId(null);
    setPhase("building");
    try {
      const response = await fetch("/api/build/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idea,
          themeId,
          brand: { accentColor: accentColor || undefined, logoUrl: logoUrl.trim() || undefined }
        })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; jobId?: string; message?: string };
      if (!data.ok || !data.jobId) {
        setPhase("failed");
        setError(data.message || "Couldn't start the build.");
        return;
      }
      setJobId(data.jobId);
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
      {!busy && phase === "idle" ? (
        <>
          <ThemePicker value={themeId} onChange={setThemeId} />
          <BrandStep accentColor={accentColor} logoUrl={logoUrl} onAccent={setAccentColor} onLogo={setLogoUrl} />
        </>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <button className="soft-launch-action" type="button" onClick={start} disabled={busy || idea.trim().length < 8}>
          {busy ? "Building…" : "Build it"}
        </button>
      </div>

      {phase !== "idle" ? (
        <div className="build-status" style={{ marginTop: 18 }}>
          <p className={phase === "live" ? "build-status-live" : undefined}>{LABEL[phase]}</p>
          {phase === "building" || phase === "deploying" ? (
            <p className="note">Usually takes a few minutes — you can keep this page open.</p>
          ) : null}
          {connectionLost ? (
            <div>
              <p className="note">We lost the connection while checking on your build — the build itself is still running.</p>
              <button
                type="button"
                className="soft-launch-action"
                onClick={() => {
                  failStreak.current = 0;
                  setConnectionLost(false);
                  if (jobId) poll(jobId);
                }}
              >
                Check again
              </button>
            </div>
          ) : null}
          {url ? (
            <p>
              {phase === "live" ? <span className="note">Try it here: </span> : null}
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </p>
          ) : null}
          {phase === "live" && jobId ? (
            <>
              <p className="note">Open the link and try your app. Happy with it? Make it official — that exact version becomes your app's main link.</p>
              <ApproveApp jobId={jobId} onApproved={(officialUrl) => setUrl(officialUrl)} />
            </>
          ) : null}
          {error ? <p className="integration-notice integration-notice--error">{error}</p> : null}
        </div>
      ) : null}

      {phase === "live" ? <DomainStep projectName={project} domainsEnabled={domainsEnabled} /> : null}
      {phase === "live" ? (
        <p style={{ marginTop: 16 }}>
          <a href="/account">View all your apps →</a>
        </p>
      ) : null}
    </section>
  );
}
