"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppPortfolioEntry, AppPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import type { OpsStatsRecord, OpsStatsSnapshot } from "@/lib/engine/ops-stats";
import type { OpsAttentionItem } from "@/lib/engine/ops-attention";
import type { PortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { UrlStatusBoardPanel } from "@/components/engine/portfolio-url-status-board";

// The one dashboard for every app the owner manages. Functional, not just
// informational: the summary tiles FILTER the grid, every card expands to its
// full detail, each app shows a pipeline stage meter and a plain-language next
// step, and "Add an app" registers an existing app (built anywhere) on the spot.
// Each card also carries an Ops strip — live business numbers (users, open
// tickets, recent orders) for apps that report them, "Not reporting yet" for
// the rest — loaded after mount from /api/engine/ops/stats.

type Bucket = "all" | "live" | "review" | "build" | "decision" | "planned";

const BUCKET_LABEL: Record<Bucket, string> = {
  all: "All apps",
  live: "Live",
  review: "In review",
  build: "Ready to build",
  decision: "Needs a decision",
  planned: "Planned"
};

const STAGES = ["Planned", "Building", "Preview", "Review", "Live"] as const;

function bucketFor(app: AppPortfolioEntry): Bucket {
  if (app.deploymentState === "production_live") return "live";
  if (app.deploymentState === "review_ready") return "review";
  if (app.buildState === "ready_for_build" || app.buildState === "draft_pr_open") return "build";
  if (app.blockers.length > 0) return "decision";
  return "planned";
}

function stageIndexFor(app: AppPortfolioEntry): number {
  if (app.deploymentState === "production_live") return 4;
  if (app.deploymentState === "review_ready" || app.buildState === "owner_approval_required") return 3;
  if (app.buildState === "preview_verified" || app.buildState === "preview_pending" || app.deploymentState === "build_preview") return 2;
  if (app.buildState === "ready_for_build" || app.buildState === "draft_pr_open" || app.buildState === "ready_for_vnext") return 1;
  return 0;
}

const NEXT_STEP_LABEL: Record<string, string> = {
  create_planning_issue: "Plan it — open a planning issue",
  create_implementation_issue: "Start the build",
  create_draft_pr: "Open the draft PR",
  wait_for_preview: "Preview is building — wait",
  verify_preview: "Verify the preview",
  verify_review_url: "Verify the review link",
  run_review_gates: "Run the review gates",
  create_fix_issue: "File the fix",
  await_owner_review: "Your review is the next step",
  stop_for_owner_approval: "Waiting on your approval",
  pause_for_budget: "Paused for budget — your call",
  request_budget_approval: "Budget approval needed",
  prepare_release_gate: "Prepare the release gate",
  create_vnext_packet: "Plan the next version",
  continue_internal_trial: "Keep the internal trial going",
  review_exported_builder_handoff: "Review the exported handoff",
  unknown: "Next step not recorded yet"
};

export function OwnerPortfolioDashboard({
  registry,
  urlBoard
}: {
  registry: AppPortfolioRegistry;
  urlBoard?: PortfolioUrlStatusBoard;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Bucket>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [ops, setOps] = useState<OpsStatsSnapshot | null>(null);
  const [opsLoaded, setOpsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/engine/ops/stats")
      .then((response) => response.json())
      .then((data: { ok?: boolean; snapshot?: OpsStatsSnapshot }) => {
        if (!cancelled && data?.ok && data.snapshot) setOps(data.snapshot);
      })
      .catch(() => {
        // ops stays null — the attention panel reports "couldn't check",
        // never a false "all clear".
      })
      .finally(() => {
        if (!cancelled) setOpsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const tally: Record<Bucket, number> = { all: registry.apps.length, live: 0, review: 0, build: 0, decision: 0, planned: 0 };
    for (const app of registry.apps) tally[bucketFor(app)] += 1;
    return tally;
  }, [registry.apps]);

  const visibleApps = filter === "all" ? registry.apps : registry.apps.filter((app) => bucketFor(app) === filter);

  const toggleExpanded = (slug: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <section className="owner-portfolio-dashboard panel" data-testid="owner-portfolio-dashboard">
      <div className="handoff-section-heading">
        <div>
          <p className="eyebrow">App Portfolio</p>
          <h1>Every managed app in one place</h1>
          <p>
            Every app you manage — built here or brought in from anywhere. Click a count to filter, click a card for
            its full story, and use “Add an app” to bring in one we don’t know about yet.
          </p>
        </div>
        <div className="portfolio-heading-actions">
          <button type="button" className="soft-launch-action" onClick={() => setAddOpen((value) => !value)}>
            {addOpen ? "Close" : "+ Add an app"}
          </button>
          <p className="portfolio-registry-note">{registry.ownerReadableSummary}</p>
        </div>
      </div>

      {addOpen ? <AddAppForm onDone={() => { setAddOpen(false); router.refresh(); }} /> : null}

      <OpsAttentionPanel snapshot={ops} loaded={opsLoaded} />

      {urlBoard ? <UrlStatusBoardPanel board={urlBoard} /> : null}

      <div className="portfolio-summary-grid" aria-label="Portfolio summary — click to filter">
        {(Object.keys(BUCKET_LABEL) as Bucket[]).map((bucket) => (
          <button
            type="button"
            key={bucket}
            className={`portfolio-summary-item portfolio-filter${filter === bucket ? " portfolio-filter--active" : ""}`}
            onClick={() => setFilter(bucket)}
            aria-pressed={filter === bucket}
          >
            <span>{BUCKET_LABEL[bucket]}</span>
            <strong>{counts[bucket]}</strong>
          </button>
        ))}
      </div>

      <div className="portfolio-card-grid">
        {visibleApps.map((app) =>
          app.slug === "future-ecosystem-apps-services" ? (
            <StartSomethingCard app={app} key={app.slug} />
          ) : (
            <PortfolioEntryCard
              app={app}
              key={app.slug}
              expanded={expanded.has(app.slug)}
              onToggle={() => toggleExpanded(app.slug)}
              opsRecord={opsForApp(ops, app)}
              opsLoaded={opsLoaded}
            />
          )
        )}
        {visibleApps.length === 0 ? <p className="portfolio-empty-note">Nothing in this bucket right now.</p> : null}
      </div>

      <div className="portfolio-guardrail-strip" aria-label="Portfolio guardrails">
        <span>No secrets</span>
        <span>No private user data</span>
        <span>Production approval required</span>
        <span>No protected preview bypass links</span>
        <span>App boundaries required</span>
      </div>
    </section>
  );
}

// The weak "Future Ecosystem Apps and Services" entry, reframed as the action it
// really is: the door to starting something new.
function StartSomethingCard({ app }: { app: AppPortfolioEntry }) {
  return (
    <article className="portfolio-entry-card portfolio-start-card">
      <div className="portfolio-entry-heading">
        <div>
          <span>next</span>
          <h2>Start something new</h2>
          <p>{app.status}</p>
        </div>
      </div>
      <div className="portfolio-action-row">
        <a className="soft-launch-action" href="/opportunity-intake">Start an intake</a>
        <a className="portfolio-secondary-action" href="/build">Build an app now</a>
      </div>
    </article>
  );
}

function StageMeter({ app }: { app: AppPortfolioEntry }) {
  const activeIndex = stageIndexFor(app);
  return (
    <div className="portfolio-stage-meter" aria-label={`Progress: ${STAGES[activeIndex]}`}>
      {STAGES.map((stage, index) => (
        <span
          key={stage}
          className={`portfolio-stage${index < activeIndex ? " done" : ""}${index === activeIndex ? " current" : ""}`}
          title={stage}
        >
          {stage}
        </span>
      ))}
    </div>
  );
}

function PortfolioEntryCard({
  app,
  expanded,
  onToggle,
  opsRecord,
  opsLoaded
}: {
  app: AppPortfolioEntry;
  expanded: boolean;
  onToggle: () => void;
  opsRecord: OpsStatsRecord | null;
  opsLoaded: boolean;
}) {
  const latestPr = app.linkedPRs[0] || null;
  const liveUrl = app.productionUrl.startsWith("https://") ? app.productionUrl : null;
  const reviewUrl = app.reviewUrl.startsWith("/") || app.reviewUrl.startsWith("https://") ? app.reviewUrl : null;
  const nextStep = NEXT_STEP_LABEL[app.nextSafeAction] || formatToken(app.nextSafeAction);

  return (
    <article className={`portfolio-entry-card${expanded ? " expanded" : ""}`}>
      <div className="portfolio-entry-heading">
        <div>
          <span>{formatToken(app.type)}</span>
          <h2>{app.name}</h2>
          <p>{app.status}</p>
        </div>
        <div className="portfolio-state-stack">
          <strong className={`portfolio-state ${app.deploymentState}`}>{formatToken(app.deploymentState)}</strong>
          <small className={`portfolio-source ${app.stateSource}`}>{formatToken(app.stateSource)}</small>
          {opsRecord?.needs.some((need) => need.severity === "action_needed") ? (
            <small className="portfolio-needs-flag">needs attention</small>
          ) : null}
        </div>
      </div>

      <StageMeter app={app} />
      <p className="portfolio-next-step">→ {nextStep}</p>
      <OpsStrip app={app} record={opsRecord} loaded={opsLoaded} />

      <div className="portfolio-action-row">
        {liveUrl ? (
          <a className="soft-launch-action" href={liveUrl} target="_blank" rel="noreferrer">Open live site</a>
        ) : null}
        {!liveUrl && reviewUrl ? (
          <a className="soft-launch-action" href={reviewUrl}>Open review</a>
        ) : null}
        <button type="button" className="portfolio-secondary-action" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>

      {expanded ? (
        <>
          <dl className="portfolio-detail-grid">
            <div>
              <dt>Review URL</dt>
              <dd>{renderUrl(app.reviewUrl)}</dd>
            </div>
            <div>
              <dt>Production</dt>
              <dd>{renderUrl(app.productionUrl)}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{app.currentVersion}</dd>
            </div>
            <div>
              <dt>Build state</dt>
              <dd>{formatToken(app.buildState)}</dd>
            </div>
            <div>
              <dt>Latest PR/branch</dt>
              <dd>
                {latestPr ? (
                  <>
                    <a href={latestPr.url}>#{latestPr.number}</a>
                    {latestPr.branch ? <small>{latestPr.branch}</small> : null}
                  </>
                ) : (
                  "No PR linked yet"
                )}
              </dd>
            </div>
            <div>
              <dt>Next safe action</dt>
              <dd>{formatToken(app.nextSafeAction)}</dd>
            </div>
            <div>
              <dt>Source artifact</dt>
              <dd>
                {formatToken(app.sourceArtifact.kind)}
                <small>{app.sourceArtifact.summary}</small>
              </dd>
            </div>
          </dl>

          {app.evidenceLinks.length ? (
            <div className="portfolio-action-row">
              {app.evidenceLinks.map((link) => (
                <a className="portfolio-secondary-action" key={`${link.label}::${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}

          {app.buildPacketBridgeVisibility ? <BuildPacketBridgePanel app={app} /> : null}

          {opsRecord?.needs.length ? (
            <section className="portfolio-blocker-list portfolio-needs-list">
              <h3>Needs</h3>
              <ul>
                {opsRecord.needs.map((need: OpsAttentionItem) => (
                  <li key={need.id}>{need.action}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="portfolio-blocker-list">
            <h3>Blockers</h3>
            {app.blockers.length ? (
              <ul>
                {app.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p>No blockers recorded.</p>
            )}
          </section>
        </>
      ) : null}
    </article>
  );
}

function AddAppForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [builtWith, setBuiltWith] = useState("");
  const [notes, setNotes] = useState("");
  const [appStatus, setAppStatus] = useState("in_progress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/engine/portfolio/register-app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, liveUrl, repoUrl, builtWith, notes, appStatus })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (data.ok) {
        onDone();
        return;
      }
      setError(data.message || "Couldn't add the app.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portfolio-add-form">
      <p className="eyebrow">Add an existing app</p>
      <p>
        Built with Emergent, another builder, or plain GitHub? Register it here and it's managed with everything else.
      </p>
      <div className="portfolio-add-row">
        <input className="convo-input" value={name} placeholder="App name (required)" onChange={(e) => setName(e.target.value)} disabled={busy} aria-label="App name" />
        <select className="convo-input" value={appStatus} onChange={(e) => setAppStatus(e.target.value)} disabled={busy} aria-label="Where is it today?">
          <option value="live">It's live</option>
          <option value="in_progress">In progress</option>
          <option value="idea">Just an idea</option>
        </select>
      </div>
      <div className="portfolio-add-row">
        <input className="convo-input" value={liveUrl} placeholder="Live URL (https://…, optional)" onChange={(e) => setLiveUrl(e.target.value)} disabled={busy} aria-label="Live URL" />
        <input className="convo-input" value={repoUrl} placeholder="Repository URL (optional)" onChange={(e) => setRepoUrl(e.target.value)} disabled={busy} aria-label="Repository URL" />
      </div>
      <div className="portfolio-add-row">
        <input className="convo-input" value={builtWith} placeholder="Built with (Emergent, Lovable… optional)" onChange={(e) => setBuiltWith(e.target.value)} disabled={busy} aria-label="Built with" />
        <input className="convo-input" value={notes} placeholder="Notes (optional)" onChange={(e) => setNotes(e.target.value)} disabled={busy} aria-label="Notes" />
      </div>
      <button type="button" className="soft-launch-action" onClick={submit} disabled={busy || name.trim().length < 2}>
        {busy ? "Adding…" : "Add to dashboard"}
      </button>
      {error ? <p className="note">{error}</p> : null}
    </div>
  );
}

function BuildPacketBridgePanel({ app }: { app: AppPortfolioEntry }) {
  const bridge = app.buildPacketBridgeVisibility;

  if (!bridge) return null;

  return (
    <section className="portfolio-bridge-panel" aria-label={`${app.name} build packet bridge visibility`}>
      <div className="portfolio-bridge-heading">
        <div>
          <h3>Build-packet bridge</h3>
          <p>{bridge.buildPacketBridgeState}</p>
        </div>
        <strong>{bridge.ownerApprovalStatus}</strong>
      </div>

      <dl className="portfolio-bridge-grid">
        <div>
          <dt>Candidate state</dt>
          <dd>{bridge.candidateState}</dd>
        </div>
        <div>
          <dt>Recommended draft</dt>
          <dd>{bridge.recommendedPacketDraftType}</dd>
        </div>
        <div>
          <dt>Next AppEngine action</dt>
          <dd>{bridge.nextSafeAppEngineAction}</dd>
        </div>
        <div>
          <dt>Source artifact evidence</dt>
          <dd>
            {bridge.sourceArtifactEvidence.map((artifact) => (
              <small key={`${artifact.kind}-${artifact.id || artifact.summary}`}>
                {formatToken(artifact.kind)}
                {artifact.id ? ` · ${artifact.id}` : ""}: {artifact.summary}
              </small>
            ))}
          </dd>
        </div>
      </dl>

      <div className="portfolio-bridge-missing">
        <h4>Missing information</h4>
        {bridge.missingInformation.length ? (
          <ul>
            {bridge.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No missing information recorded.</p>
        )}
      </div>
    </section>
  );
}

// The one queue that ends "digging for what needs me": every app's needs,
// sorted act-on-this first, each with a directed action — or "All clear".
function OpsAttentionPanel({ snapshot, loaded }: { snapshot: OpsStatsSnapshot | null; loaded: boolean }) {
  if (!loaded) {
    return (
      <div className="portfolio-attention-panel checking" aria-label="Needs your attention">
        <p>Checking app health, env, and domains…</p>
      </div>
    );
  }

  // No snapshot ≠ nothing found: the checks never ran (fetch failed, session
  // expired, server error). Saying "all clear" here would be a false positive.
  if (!snapshot) {
    return (
      <div className="portfolio-attention-panel checking" aria-label="Needs your attention">
        <p>Couldn't load the app checks just now — reload the page to try again.</p>
      </div>
    );
  }

  const items = snapshot.attention || [];
  if (!items.length) {
    return (
      <div className="portfolio-attention-panel all-clear" aria-label="Needs your attention">
        <strong>All clear</strong>
        <p>Nothing needs your attention right now — every check passed.</p>
      </div>
    );
  }

  const actionCount = items.filter((item) => item.severity === "action_needed").length;
  return (
    <section className="portfolio-attention-panel" aria-label="Needs your attention">
      <div className="portfolio-attention-heading">
        <h2>Needs your attention</h2>
        <span>
          {actionCount} to act on · {items.length - actionCount} to watch
        </span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.severity}>
            <span className="portfolio-attention-badge">{item.severity === "action_needed" ? "Act" : "Watch"}</span>
            <div className="portfolio-attention-body">
              <strong>{item.appName}</strong>
              <p>{item.action}</p>
              <small>{item.finding}</small>
            </div>
            {item.link ? (
              <a className="portfolio-secondary-action" href={item.link} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The Ops strip: how each app is DOING, not just how its build is going. Real
// counts when the app reports them; an honest state line when it doesn't.
function OpsStrip({ app, record, loaded }: { app: AppPortfolioEntry; record: OpsStatsRecord | null; loaded: boolean }) {
  const live = app.deploymentState === "production_live";

  if (record?.reporting) {
    return (
      <div className="portfolio-ops-strip reporting" aria-label={`${app.name} ops`}>
        <span className="portfolio-ops-label">Ops</span>
        <strong>{formatCount(record.stats.users)} users</strong>
        <strong>{formatCount(record.stats.ticketsOpen)} open tickets</strong>
        <strong>{formatCount(record.stats.ordersRecent)} orders (30d)</strong>
        {record.checkedAt ? <small title={record.note || undefined}>as of {shortTime(record.checkedAt)}</small> : null}
      </div>
    );
  }

  return (
    <div className="portfolio-ops-strip muted" aria-label={`${app.name} ops`}>
      <span className="portfolio-ops-label">Ops</span>
      <small>
        {!loaded
          ? "Checking live stats…"
          : live
            ? record?.note || "Not reporting yet"
            : "Not live yet — nothing to report"}
      </small>
    </div>
  );
}

function formatCount(value: number | null) {
  return value === null ? "—" : String(value);
}

function shortTime(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function hostOf(value: string): string {
  try {
    return /^https?:\/\//.test(value) ? new URL(value).host.toLowerCase() : "";
  } catch {
    return "";
  }
}

// Match an ops record to a card: by portfolio slug first, by live-URL host as
// the fallback (engine-built apps the owner hasn't registered by name yet).
function opsForApp(snapshot: OpsStatsSnapshot | null, app: AppPortfolioEntry): OpsStatsRecord | null {
  if (!snapshot) return null;
  const bySlug = snapshot.apps.find((record) => record.slug && record.slug === app.slug);
  if (bySlug) return bySlug;
  const host = hostOf(app.productionUrl);
  if (!host) return null;
  return snapshot.apps.find((record) => hostOf(record.url) === host) || null;
}

function renderUrl(value: string) {
  if (value.startsWith("/")) {
    return <a href={value}>{value}</a>;
  }

  if (value.startsWith("https://")) {
    return <a href={value}>{value}</a>;
  }

  return value;
}

function formatToken(value: string) {
  return value.replaceAll("_", " ");
}
