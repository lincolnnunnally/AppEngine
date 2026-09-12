"use client";

import { useEffect, useRef, useState } from "react";
import { ApproveApp } from "@/components/account/approve-app";
import { BrandStep } from "@/components/build/brand-step";
import { DomainStep } from "@/components/build/domain-step";
import { ThemePicker } from "@/components/build/theme-picker";
import { noOrphan } from "@/lib/ui/no-orphan";
import { clearComposeDraft, saveComposeDraft } from "@/lib/ui/compose-draft";

type FeatureRow = {
  id: string;
  label: string;
  description: string;
  priceCents: number;
  selected?: boolean;
};

type Archetype = {
  id: string;
  name: string;
  forWho: string;
  coreJob: string;
  defaultFeatureIds: string[];
  startingPriceCents: number;
};

type Estimate = {
  ok: boolean;
  priceLabel: string;
  priceCents: number;
  moduleSlugs: string[];
  features: FeatureRow[];
  recommendedAddOns: FeatureRow[];
  suggestedArchetype: { id: string; name: string; forWho: string; coreJob: string } | null;
  customerSummary: { total: string; base: string; features: { label: string; price: string }[]; note: string };
};

type Catalog = {
  features: FeatureRow[];
  archetypes: Archetype[];
};

type Phase = "idle" | "building" | "deploying" | "live" | "failed";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  building: "Building your app… (writing the code)",
  deploying: "Publishing it… (putting it on the web)",
  live: "Ready — your app is up:",
  failed: "Something went wrong."
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function ComposeAndBuild({
  idea,
  summary,
  domainsEnabled = false
}: {
  idea: string;
  summary: string;
  domainsEnabled?: boolean;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [featureIds, setFeatureIds] = useState<string[] | null>(null);
  const [pickedArch, setPickedArch] = useState<string | null>(null);
  const [themeId, setThemeId] = useState("auto");
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failStreak = useRef(0);

  useEffect(() => {
    fetch("/api/auth/whoami", { cache: "no-store" })
      .then((res) => setSignedIn(res.ok))
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalogRes, estimateRes] = await Promise.all([
          fetch("/api/pricing/estimate?catalog=1", { cache: "no-store" }),
          fetch("/api/pricing/estimate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ needText: idea })
          })
        ]);
        const catalogJson = (await catalogRes.json()) as Catalog & { ok?: boolean };
        const estimateJson = (await estimateRes.json()) as Estimate;
        if (cancelled) return;
        if (!estimateJson?.ok) {
          setLoadError("Couldn't price this yet. Please try again.");
          return;
        }
        setCatalog({ features: catalogJson.features || [], archetypes: catalogJson.archetypes || [] });
        setEstimate(estimateJson);
        const selected = estimateJson.features.filter((f) => f.selected).map((f) => f.id);
        const draft = typeof window !== "undefined" ? sessionStorage.getItem("ae-compose-draft") : null;
        let restoredIds: string[] | null = null;
        try {
          const parsed = draft ? (JSON.parse(draft) as { featureIds?: string[]; themeId?: string; accentColor?: string; logoUrl?: string }) : null;
          if (parsed?.featureIds?.length) restoredIds = parsed.featureIds;
          if (parsed?.themeId) setThemeId(parsed.themeId);
          if (parsed?.accentColor) setAccentColor(parsed.accentColor);
          if (parsed?.logoUrl) setLogoUrl(parsed.logoUrl);
        } catch {
          restoredIds = null;
        }
        setFeatureIds(restoredIds || selected);
      } catch {
        if (!cancelled) setLoadError("Couldn't reach pricing. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idea]);

  async function refreshEstimate(nextIds: string[]) {
    setFeatureIds(nextIds);
    try {
      const response = await fetch("/api/pricing/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ needText: idea, featureIds: nextIds })
      });
      const data = (await response.json()) as Estimate;
      if (data?.ok) setEstimate(data);
    } catch {
      // Keep the last good estimate visible; toggling still updates the checklist.
    }
  }

  function toggleFeature(id: string) {
    const current = featureIds || [];
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    void refreshEstimate(next);
  }

  function pickArchetype(arch: Archetype) {
    setPickedArch(arch.id);
    void refreshEstimate(arch.defaultFeatureIds);
  }

  function poll(id: string) {
    const tick = async () => {
      try {
        const response = await fetch(`/api/build/status?jobId=${encodeURIComponent(id)}`, { cache: "no-store" });
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

  function persistDraft() {
    saveComposeDraft({
      idea,
      summary,
      featureIds: featureIds || undefined,
      themeId,
      accentColor,
      logoUrl
    });
  }

  async function startBuild() {
    if (signedIn === false) {
      persistDraft();
      window.location.href = "/signin?next=/";
      return;
    }
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
          featureIds: featureIds || [],
          moduleSlugs: estimate?.moduleSlugs || [],
          brand: { accentColor: accentColor || undefined, logoUrl: logoUrl.trim() || undefined }
        })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; jobId?: string; message?: string };
      if (response.status === 401) {
        persistDraft();
        window.location.href = "/signin?next=/";
        return;
      }
      if (!data.ok || !data.jobId) {
        setPhase("failed");
        setError(data.message || "Couldn't start the build.");
        return;
      }
      clearComposeDraft();
      setJobId(data.jobId);
      poll(data.jobId);
    } catch {
      setPhase("failed");
      setError("Network error — try again.");
    }
  }

  const busy = phase === "building" || phase === "deploying";
  const selected = new Set(featureIds || []);
  const addOns = (estimate?.recommendedAddOns || []).filter((item) => !selected.has(item.id));

  return (
    <section className="compose" aria-label="Starter pack and price">
      <header className="convo-head">
        <p className="convo-eyebrow">Starter pack</p>
        <h2 className="convo-title balanced-title">
          <span>Here&apos;s the pack</span>
          <span>we&apos;ll snap together</span>
        </h2>
        <p className="convo-sub">{noOrphan(summary)}</p>
      </header>

      {loadError ? <p className="convo-notice convo-notice--error" role="alert">{loadError}</p> : null}
      {!estimate && !loadError ? <p className="note">Matching a starter combination and price…</p> : null}

      {estimate ? (
        <>
          <div className="compose-price" aria-live="polite">
            <p className="compose-price-label">What it costs</p>
            <p className="compose-price-total">{estimate.priceLabel}</p>
            <ul className="compose-price-lines">
              <li>Core app + live website — {estimate.customerSummary.base}</li>
              {estimate.customerSummary.features.map((line) => (
                <li key={line.label}>
                  {line.label} — {line.price}
                </li>
              ))}
            </ul>
            <p className="note">{estimate.customerSummary.note}</p>
          </div>

          {estimate.suggestedArchetype ? (
            <p className="compose-starter">
              Recommended starter: <strong>{estimate.suggestedArchetype.name}</strong> — {estimate.suggestedArchetype.coreJob}
            </p>
          ) : null}

          {catalog?.archetypes?.length ? (
            <div className="compose-archetypes">
              <p className="eyebrow">Or pick a different starter combination</p>
              <div className="compose-arch-grid">
                {catalog.archetypes.map((arch) => (
                  <button
                    type="button"
                    key={arch.id}
                    className={`compose-arch${(pickedArch || estimate.suggestedArchetype?.id) === arch.id ? " compose-arch--selected" : ""}`}
                    onClick={() => pickArchetype(arch)}
                    disabled={busy}
                  >
                    <strong>{arch.name}</strong>
                    <span>{arch.forWho}</span>
                    <em>From {dollars(arch.startingPriceCents)}</em>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="compose-features">
            <p className="eyebrow">Included in this pack</p>
            <ul className="compose-feature-list">
              {(estimate.features.filter((f) => selected.has(f.id)).length
                ? estimate.features.filter((f) => selected.has(f.id))
                : []
              ).map((feature) => (
                <li key={feature.id}>
                  <label className="compose-check">
                    <input type="checkbox" checked onChange={() => toggleFeature(feature.id)} disabled={busy} />
                    <span>
                      <strong>{feature.label}</strong> ({dollars(feature.priceCents)})
                      <small>{feature.description}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {addOns.length ? (
            <div className="compose-addons">
              <p className="eyebrow">Recommended add-ons for what you described</p>
              <ul className="compose-feature-list">
                {addOns.map((feature) => (
                  <li key={feature.id}>
                    <label className="compose-check">
                      <input type="checkbox" checked={false} onChange={() => toggleFeature(feature.id)} disabled={busy} />
                      <span>
                        <strong>{feature.label}</strong> (+{dollars(feature.priceCents)})
                        <small>{feature.description}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="compose-more">
            <summary>See every add-on</summary>
            <ul className="compose-feature-list">
              {(catalog?.features || estimate.features)
                .filter((feature) => !selected.has(feature.id) && !addOns.some((item) => item.id === feature.id))
                .map((feature) => (
                  <li key={feature.id}>
                    <label className="compose-check">
                      <input type="checkbox" checked={false} onChange={() => toggleFeature(feature.id)} disabled={busy} />
                      <span>
                        <strong>{feature.label}</strong> (+{dollars(feature.priceCents)})
                        <small>{feature.description}</small>
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </details>

          {!busy && phase === "idle" ? (
            <>
              <ThemePicker value={themeId} onChange={setThemeId} />
              <BrandStep accentColor={accentColor} logoUrl={logoUrl} onAccent={setAccentColor} onLogo={setLogoUrl} />
            </>
          ) : null}

          <div className="convo-actions">
            <button
              className="convo-go"
              type="button"
              onClick={startBuild}
              disabled={busy || idea.trim().length < 8 || signedIn === null}
            >
              {busy
                ? "Building…"
                : signedIn
                  ? `Build this app — ${estimate.priceLabel}`
                  : `Create an account to save this — ${estimate.priceLabel}`}
            </button>
          </div>
          <p className="note">
            {noOrphan(
              signedIn
                ? "The first version is a live starter you can open — not the finished product. After it's up, we verify it, then improve it with you. You don't pay until that starter is actually up."
                : "Create an account to save this pack, publish the live starter, and use it. You don't pay until that starter is actually up."
            )}
          </p>
        </>
      ) : null}

      {phase !== "idle" ? (
        <div className="build-status" style={{ marginTop: 18 }}>
          <p className={phase === "live" ? "build-status-live" : undefined}>{PHASE_LABEL[phase]}</p>
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
              {phase === "live" ? <span className="note">Open it here: </span> : null}
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            </p>
          ) : null}
          {phase === "live" && jobId ? (
            <>
              <p className="note">
                Try the live site. Happy with it? Make it official — that exact version becomes your app&apos;s main link.
              </p>
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
