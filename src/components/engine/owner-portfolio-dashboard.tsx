"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { AppPortfolioEntry, AppPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import type { OpsActivityDay, OpsStatsRecord, OpsStatsSnapshot } from "@/lib/engine/ops-stats";
import type { OpsAttentionItem } from "@/lib/engine/ops-attention";
import type { PortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { UrlStatusBoardPanel } from "@/components/engine/portfolio-url-status-board";

// The one dashboard for every app the owner manages. Built around what Lincoln
// DOES, not what we can display (his 2026-07-03 feedback: "informative but not
// functional"): every card is a door — press it and the app opens in a new tab
// (or the details unfold when there's nothing to open); states carry color
// (teal live / gold review / coral needs-decision / blue ready-to-build) so the
// grid scans instead of blurring; the next step is a button whenever it has a
// real destination; reference detail stays behind "Details". Each card also
// carries an Ops strip — live business numbers for apps that report them —
// loaded after mount from /api/engine/ops/stats.

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

// Where the next step can actually be TAKEN, the card offers it as a button —
// review-type steps go to the review URL, PR steps to the PR. Steps with no
// destination stay as a plain line instead of a dead control.
function nextStepTarget(app: AppPortfolioEntry): string | null {
  const review = app.reviewUrl.startsWith("/") || app.reviewUrl.startsWith("https://") ? app.reviewUrl : null;
  switch (app.nextSafeAction) {
    case "await_owner_review":
    case "verify_review_url":
    case "verify_preview":
    case "run_review_gates":
      return review;
    case "create_draft_pr":
      return app.linkedPRs[0]?.url || null;
    default:
      return null;
  }
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

      <OpsRollupPanel snapshot={ops} loaded={opsLoaded} />

      {urlBoard ? <UrlStatusBoardPanel board={urlBoard} /> : null}

      <div className="portfolio-summary-grid" aria-label="Portfolio summary — click to filter">
        {(Object.keys(BUCKET_LABEL) as Bucket[]).map((bucket) => (
          <button
            type="button"
            key={bucket}
            className={`portfolio-summary-item portfolio-filter bucket-${bucket}${filter === bucket ? " portfolio-filter--active" : ""}`}
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
  // Same door rule as every other card: pressing the plain card area goes to
  // its primary action, so the pointer cursor never promises a dead click.
  function onCardClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a, button")) return;
    window.location.href = "/opportunity-intake";
  }

  return (
    <article className="portfolio-entry-card portfolio-start-card" onClick={onCardClick}>
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
  // The door this card opens: the live site first, an externally-hosted review
  // second. Internal review paths stay on the buttons (same-tab is right there).
  const openUrl = liveUrl || (reviewUrl && reviewUrl.startsWith("https://") ? reviewUrl : null);
  const bucket = bucketFor(app);
  const nextStep = NEXT_STEP_LABEL[app.nextSafeAction] || formatToken(app.nextSafeAction);
  const nextTarget = nextStepTarget(app);
  const needsAct = Boolean(opsRecord?.needs.some((need) => need.severity === "action_needed"));

  // Press anywhere plain on the COLLAPSED card and the app opens in a new tab —
  // or the details unfold when there's nothing to open yet. Links and buttons
  // keep their own behavior; an EXPANDED card is reading mode, never a door
  // (close it with "Hide details"). Copying text must never count as a press:
  // a click that dismisses a selection is ignored (selection snapshot at
  // mousedown), and the door is deferred a beat so a double-click-to-select
  // cancels it instead of opening a surprise tab.
  const doorTimer = useRef<number | null>(null);
  const hadSelectionAtMouseDown = useRef(false);
  useEffect(() => {
    return () => {
      if (doorTimer.current) window.clearTimeout(doorTimer.current);
    };
  }, []);

  function onCardMouseDown() {
    hadSelectionAtMouseDown.current = Boolean(window.getSelection()?.toString());
  }

  function onCardClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a, button")) return;
    if (expanded) return;
    if (event.detail > 1 || hadSelectionAtMouseDown.current || window.getSelection()?.toString()) {
      if (doorTimer.current) {
        window.clearTimeout(doorTimer.current);
        doorTimer.current = null;
      }
      return;
    }
    if (doorTimer.current) window.clearTimeout(doorTimer.current);
    doorTimer.current = window.setTimeout(() => {
      doorTimer.current = null;
      if (openUrl) window.open(openUrl, "_blank", "noopener");
      else onToggle();
    }, 250);
  }

  return (
    <article
      className={`portfolio-entry-card bucket-${bucket}${expanded ? " expanded" : ""}`}
      onClick={onCardClick}
      onMouseDown={onCardMouseDown}
    >
      <div className="portfolio-entry-heading">
        <div>
          <span>{formatToken(app.type)}</span>
          <h2>
            {openUrl ? (
              <a href={openUrl} target="_blank" rel="noreferrer" title={`Open ${app.name} in a new tab`}>
                {app.name} <span className="portfolio-open-glyph" aria-hidden>↗</span>
              </a>
            ) : (
              app.name
            )}
          </h2>
          <p>{app.status}</p>
        </div>
        <div className="portfolio-state-stack">
          <strong className={`portfolio-state-chip bucket-${bucket}`}>{BUCKET_LABEL[bucket]}</strong>
          {needsAct ? <small className="portfolio-needs-flag">needs attention</small> : null}
        </div>
      </div>

      <StageMeter app={app} />
      <OpsStrip app={app} record={opsRecord} loaded={opsLoaded} />

      <div className="portfolio-action-row">
        {openUrl ? (
          <a className="soft-launch-action" href={openUrl} target="_blank" rel="noreferrer">
            Open app <span className="portfolio-open-glyph" aria-hidden>↗</span>
          </a>
        ) : null}
        {!openUrl && reviewUrl ? (
          <a className="soft-launch-action" href={reviewUrl}>Open review</a>
        ) : null}
        {nextTarget && nextTarget !== openUrl && nextTarget !== reviewUrl ? (
          <a
            className="portfolio-next-action"
            href={nextTarget}
            {...(nextTarget.startsWith("https://") ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {nextStep}
          </a>
        ) : null}
        <button type="button" className="portfolio-secondary-action" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>
      {!nextTarget || nextTarget === openUrl || nextTarget === reviewUrl ? (
        <p className="portfolio-next-step">→ {nextStep}</p>
      ) : null}

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
              <dt>Deployment</dt>
              <dd>{formatToken(app.deploymentState)}</dd>
            </div>
            <div>
              <dt>State source</dt>
              <dd className={`portfolio-source ${app.stateSource}`}>{formatToken(app.stateSource)}</dd>
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

          <OpsDeepDive app={app} record={opsRecord} loaded={opsLoaded} />

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
        <p>Checking app health, deploys, env, and domains…</p>
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

// One line for the whole business: totals across every app that reports, with
// coverage stated honestly per metric — "users from 2 of 3" is a fact; a total
// silently missing an app, or a "0" for a metric no app measured, would be a
// lie. Every metric that no reporting app contributes shows "not reported",
// never 0.
function OpsRollupPanel({ snapshot, loaded }: { snapshot: OpsStatsSnapshot | null; loaded: boolean }) {
  if (!loaded || !snapshot) return null; // the attention panel already narrates loading/failure

  const reporting = snapshot.apps.filter((record) => record.reporting);
  if (!reporting.length) return null; // nothing reporting yet — the per-card strips say so

  const usersReported = reporting.filter((record) => record.stats.users !== null);
  const totalUsers = usersReported.reduce((sum, record) => sum + (record.stats.users || 0), 0);

  // Revenue never crosses currencies: one total per currency, each labeled.
  const revenueReported = reporting.filter((record) => record.stats.revenueCentsRecent !== null && record.stats.revenueCurrency);
  const revenueByCurrency = new Map<string, number>();
  for (const record of revenueReported) {
    const currency = record.stats.revenueCurrency as string;
    revenueByCurrency.set(currency, (revenueByCurrency.get(currency) || 0) + (record.stats.revenueCentsRecent || 0));
  }

  // A reported series (even []) counts as coverage; only the trailing 14 days
  // count toward the total, so the "(14d)" label can't overstate the window.
  const cutoff = fourteenDayCutoff();
  const activityReported = reporting.filter((record) => Array.isArray(record.stats.activity));
  const totalEvents14d = activityReported.reduce(
    (sum, record) =>
      sum + (record.stats.activity || []).reduce((daySum, day) => (day.date >= cutoff ? daySum + day.count : daySum), 0),
    0
  );

  // "from N of M" is only honest if every counted metric came from all N; when
  // a metric has narrower coverage, name its own count.
  const coverageNote = (label: string, n: number) => (n === reporting.length ? "" : ` · ${label} from ${n}`);

  return (
    <section className="portfolio-ops-rollup" aria-label="Business snapshot across reporting apps">
      <span className="portfolio-ops-label">Across your apps</span>
      {usersReported.length ? <strong>{totalUsers} users</strong> : <strong>users not reported</strong>}
      {revenueByCurrency.size ? (
        [...revenueByCurrency.entries()].map(([currency, cents]) => (
          <strong key={currency}>{formatMoney(cents, currency)} revenue (30d)</strong>
        ))
      ) : (
        <strong>revenue not reported</strong>
      )}
      {activityReported.length ? <strong>{totalEvents14d} events (14d)</strong> : <strong>activity not reported</strong>}
      <small>
        from {reporting.length} of {snapshot.totalApps} apps reporting
        {coverageNote("users", usersReported.length)}
        {coverageNote("revenue", revenueReported.length)}
        {coverageNote("activity", activityReported.length)}
      </small>
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
        {record.stats.revenueCentsRecent !== null && record.stats.revenueCurrency ? (
          <strong>{formatMoney(record.stats.revenueCentsRecent, record.stats.revenueCurrency)} revenue (30d)</strong>
        ) : null}
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

// The deep-dive inside an expanded card: the business numbers behind the strip
// — users, revenue as money, and a day-by-day activity trend. Every metric an
// app doesn't report says "Not reported" — absence is information, zero is a claim.
function OpsDeepDive({ app, record, loaded }: { app: AppPortfolioEntry; record: OpsStatsRecord | null; loaded: boolean }) {
  if (!loaded) return null; // the strip already says "Checking live stats…"
  if (!record?.reporting) return null; // the strip already narrates why there are no numbers

  const revenue =
    record.stats.revenueCentsRecent !== null && record.stats.revenueCurrency
      ? formatMoney(record.stats.revenueCentsRecent, record.stats.revenueCurrency)
      : null;

  return (
    <section className="portfolio-deep-dive" aria-label={`${app.name} business detail`}>
      <h3>How it&apos;s doing</h3>
      <dl className="portfolio-deep-dive-grid">
        <div>
          <dt>Users</dt>
          <dd>{record.stats.users === null ? "Not reported" : record.stats.users}</dd>
        </div>
        <div>
          <dt>Revenue (30d)</dt>
          <dd>{revenue === null ? "Not reported" : revenue}</dd>
        </div>
        <div>
          <dt>Open tickets</dt>
          <dd>{record.stats.ticketsOpen === null ? "Not reported" : record.stats.ticketsOpen}</dd>
        </div>
        <div>
          <dt>Orders (30d)</dt>
          <dd>{record.stats.ordersRecent === null ? "Not reported" : record.stats.ordersRecent}</dd>
        </div>
      </dl>
      <ActivityTrend days={record.stats.activity} />
      {record.checkedAt ? <small className="portfolio-deep-dive-asof">as of {shortTime(record.checkedAt)}</small> : null}
    </section>
  );
}

// A dependency-free trend: one bar per CALENDAR day across the reported span,
// scaled to the busiest day. The producers group by day and omit quiet days,
// so the series is densified here — every gap becomes a real zero-count day
// (floor sliver), and the label is the actual calendar span, not the count of
// non-empty days. Three states, kept distinct:
//   • days === null  → "not reported" (the app never sent the field)
//   • days === []    → "measured: no activity" (the app reported zero events)
//   • days with data → the gap-filled trend
function ActivityTrend({ days }: { days: OpsActivityDay[] | null }) {
  if (days === null) {
    return <p className="portfolio-activity-empty">Activity trend not reported yet.</p>;
  }
  if (days.length === 0) {
    return <p className="portfolio-activity-empty">No activity in the last 14 days.</p>;
  }
  const series = densifyActivity(days);
  const max = Math.max(...series.map((day) => day.count), 1);
  const total = series.reduce((sum, day) => sum + day.count, 0);
  return (
    <div className="portfolio-activity">
      <div className="portfolio-activity-heading">
        <span>Activity — {series.length} day{series.length === 1 ? "" : "s"} ({series[0].date} to {series[series.length - 1].date})</span>
        <span>{total} event{total === 1 ? "" : "s"}</span>
      </div>
      <div className="portfolio-activity-bars" role="img" aria-label={`${total} events across ${series.length} days`}>
        {series.map((day) => (
          <span
            key={day.date}
            className="portfolio-activity-bar"
            style={{ height: `${Math.max(6, Math.round((day.count / max) * 100))}%` }}
            title={`${day.date}: ${day.count} event${day.count === 1 ? "" : "s"}`}
          />
        ))}
      </div>
    </div>
  );
}

// Fills the calendar gaps between the first and last reported day with real
// zero-count days, bounded to the most recent ACTIVITY_MAX_SPAN days so a
// pathological far-apart pair (e.g. dates years apart) can't render thousands
// of bars. Input is sorted oldest-first.
const ACTIVITY_MAX_SPAN = 45;
function densifyActivity(days: OpsActivityDay[]): OpsActivityDay[] {
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const last = new Date(`${days[days.length - 1].date}T00:00:00Z`);
  const firstReported = new Date(`${days[0].date}T00:00:00Z`);
  const earliestAllowed = new Date(last);
  earliestAllowed.setUTCDate(earliestAllowed.getUTCDate() - (ACTIVITY_MAX_SPAN - 1));
  const start = firstReported > earliestAllowed ? firstReported : earliestAllowed;
  const out: OpsActivityDay[] = [];
  for (const cursor = new Date(start); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = cursor.toISOString().slice(0, 10);
    out.push({ date: iso, count: byDate.get(iso) || 0 });
  }
  return out;
}

// The trailing-14-calendar-day cutoff (YYYY-MM-DD), inclusive of today, used to
// bound the rollup's "(14d)" event total to the window it claims.
function fourteenDayCutoff(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 13);
  return d.toISOString().slice(0, 10);
}

function formatCount(value: number | null) {
  return value === null ? "—" : String(value);
}

// Money renders as money, always with its currency: "$41.29" for USD, the
// code spelled out ("41.29 EUR") for everything else. Cents in, never summed
// across currencies by callers.
function formatMoney(cents: number, currency: string) {
  const amount = (cents / 100).toFixed(2);
  return currency.toLowerCase() === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
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
