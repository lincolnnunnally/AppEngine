"use client";

import { useState } from "react";
import type { OperatorDashboard } from "@/lib/solution-engine/operator";

// The operator console. Ordered by the owner definition's north stars — accepted
// connections first, solutions-shipped deliberately last — so the screen itself
// argues for the right work.

type CaseDetail = {
  case: Record<string, unknown> & { id: string; state: string };
  checks: { id: string; step_index: number; description: string; status: string; evidence: string | null }[];
  assumptions: { id: string; question: string; assumed: string; status: string; corrected_to: string | null }[];
  acceptance: { total: number; passing: number; failing: number; pending: number; deliverable: boolean };
};

export default function SolutionEngineConsole({ initial }: { initial: OperatorDashboard }) {
  const [dashboard, setDashboard] = useState(initial);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/solve/admin", { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; dashboard?: OperatorDashboard };

    if (payload.dashboard) {
      setDashboard(payload.dashboard);
    }
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setNote(null);

    try {
      const response = await fetch("/api/solve/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!payload.ok) {
        setNote(payload.message || "That didn't work.");
      } else {
        setNote("Done.");
        await refresh();

        if (detail) {
          await openCase(String((detail.case as { id: string }).id));
        }
      }
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function openCase(caseId: string) {
    const response = await fetch(`/api/solve/admin?caseId=${caseId}`, { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean } & Partial<CaseDetail>;

    if (payload.case) {
      setDetail(payload as CaseDetail);
    }
  }

  const metrics = dashboard.metrics;

  return (
    <section className="panel">
      <h1>Solution Engine</h1>
      <p className="muted">
        The public front door. What matters here is accepted human connections &mdash; not solutions shipped.
      </p>

      {note ? <p><strong>{note}</strong></p> : null}

      {dashboard.needsSafetyAck.length > 0 ? (
        <div className="card" style={{ borderColor: "var(--coral)" }}>
          <h2>Safety escalations needing a human</h2>
          {dashboard.needsSafetyAck.map((escalation) => (
            <div key={escalation.id} style={{ marginBottom: 12 }}>
              <strong>{escalation.category}</strong> &mdash; case {escalation.case_id.slice(0, 8)} &mdash;{" "}
              {new Date(escalation.created_at).toLocaleString()}
              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{escalation.excerpt}</div>
              {escalation.notified_at ? (
                <div className="muted">Alert emailed {new Date(escalation.notified_at).toLocaleString()}.</div>
              ) : (
                <div style={{ color: "var(--coral)", fontWeight: 700 }}>
                  NOBODY WAS EMAILED{escalation.notify_error ? ` — ${escalation.notify_error}` : ""}. Reach this person
                  another way, now, and fix the alert path.
                </div>
              )}
              <button className="button" disabled={busy} onClick={() => act({ action: "ack-safety", escalationId: escalation.id })}>
                A person has this
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card">
        <h2>North stars</h2>
        <ol>
          <li>
            <strong>{metrics.acceptedConnectionsThisMonth}</strong> accepted connections this month ({metrics.acceptedConnectionsAllTime} all
            time)
          </li>
          <li>
            <strong>{metrics.activeStreaks}</strong> active commitment streaks (longest {metrics.longestStreak} weeks)
          </li>
          <li>
            <strong>{metrics.stillInUseAtTwoWeeks}</strong> of {metrics.twoWeekResponses} still in use at two weeks
          </li>
          <li>
            <strong>{metrics.medianIntakeToDeliveryHours ?? "—"}</strong> hours median, intake to delivery
          </li>
          <li>
            <strong>{metrics.testimonies}</strong> testimonies captured
          </li>
        </ol>
        <p className="muted">
          {metrics.solutionsDelivered} solutions delivered, {metrics.openCases} open cases,{" "}
          {metrics.casesAwaitingConnection} waiting on a connection. Solutions shipped is not the score.
        </p>
      </div>

      <div className="card">
        <h2>Attention queue</h2>
        <Queue title="Owed a connection" cases={dashboard.awaitingConnection} onOpen={openCase} />
        <Queue title="Waiting to be built" cases={dashboard.awaitingBuild} onOpen={openCase} />
        <Queue title="Offer on the table" cases={dashboard.awaitingOfferReview} onOpen={openCase} />
      </div>

      {detail ? <CaseDetailPanel detail={detail} busy={busy} act={act} onClose={() => setDetail(null)} /> : null}

      <PoolPanel dashboard={dashboard} busy={busy} act={act} />

      {dashboard.groupCandidates.length > 0 ? (
        <div className="card">
          <h2>Ready for a meetup</h2>
          <p className="muted">Four or more people in one place fighting the same thing.</p>
          <ul>
            {dashboard.groupCandidates.map((candidate) => (
              <li key={`${candidate.region}-${candidate.problemClass}`}>
                {candidate.region} &mdash; {candidate.problemClass} &mdash; {candidate.caseIds.length} people
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <h2>What we&rsquo;re learning</h2>
        {dashboard.rootPatterns.length === 0 ? (
          <p className="muted">Nothing yet. This fills in as cases close.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Root condition</th>
                <th>Cases</th>
                <th>Connected</th>
                <th>Still in use</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.rootPatterns.map((pattern) => (
                <tr key={pattern.rootClass}>
                  <td>{pattern.rootClass}</td>
                  <td>{pattern.cases}</td>
                  <td>{pattern.connected}</td>
                  <td>{pattern.stillInUse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Queue({
  title,
  cases,
  onOpen
}: {
  title: string;
  cases: OperatorDashboard["cases"];
  onOpen: (caseId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3>
        {title} ({cases.length})
      </h3>
      {cases.length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <ul>
          {cases.map((theCase) => (
            <li key={theCase.id}>
              <button className="button" onClick={() => onOpen(theCase.id)}>
                {theCase.contact_name || "Anonymous"} &mdash; {theCase.triage || "untriaged"} &mdash;{" "}
                {(theCase.stated_problem || "").slice(0, 70)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaseDetailPanel({
  detail,
  busy,
  act,
  onClose
}: {
  detail: CaseDetail;
  busy: boolean;
  act: (body: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const theCase = detail.case as Record<string, string | null> & { id: string; state: string };
  const [artifactUrl, setArtifactUrl] = useState("");
  const [walkthroughUrl, setWalkthroughUrl] = useState("");

  return (
    <div className="card">
      <h2>Case {theCase.id.slice(0, 8)}</h2>
      <button className="button" onClick={onClose}>
        Close
      </button>

      <p>
        <strong>State:</strong> {theCase.state} &nbsp; <strong>Triage:</strong> {theCase.triage || "—"} &nbsp;
        <strong>Root:</strong> {theCase.root_class || "—"} &nbsp; <strong>Class:</strong> {theCase.problem_class || "—"}
      </p>
      <p>
        <strong>Said:</strong> {theCase.stated_problem}
      </p>
      <p className="muted">
        <strong>Actually broken:</strong> {theCase.functional_problem || "not yet determined"}
      </p>

      <h3>
        Definition of done &mdash; {detail.acceptance.passing} of {detail.acceptance.total} proven
      </h3>
      <ul>
        {detail.checks.map((check) => (
          <li key={check.id}>
            [{check.status}] {check.description}{" "}
            <button
              className="button"
              disabled={busy}
              onClick={() => act({ action: "check", caseId: theCase.id, stepIndex: check.step_index, status: "passing" })}
            >
              proven
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => act({ action: "check", caseId: theCase.id, stepIndex: check.step_index, status: "failing" })}
            >
              not yet
            </button>
          </li>
        ))}
      </ul>

      <h3>Decided without asking</h3>
      <ul>
        {detail.assumptions.map((assumption) => (
          <li key={assumption.id}>
            <strong>{assumption.question}</strong>
            <div>
              {assumption.corrected_to || assumption.assumed} <em>({assumption.status})</em>
            </div>
          </li>
        ))}
      </ul>

      <h3>Actions</h3>
      <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
        <button className="button" disabled={busy} onClick={() => act({ action: "start-build", caseId: theCase.id })}>
          Start the build
        </button>

        <input value={artifactUrl} onChange={(event) => setArtifactUrl(event.target.value)} placeholder="Link to the thing" />
        <input
          value={walkthroughUrl}
          onChange={(event) => setWalkthroughUrl(event.target.value)}
          placeholder="Link to the ten-minute walkthrough"
        />
        <button
          className="button"
          disabled={busy || !detail.acceptance.deliverable}
          onClick={() => act({ action: "deliver", caseId: theCase.id, artifactUrl, walkthroughUrl })}
        >
          {detail.acceptance.deliverable ? "Deliver" : `Deliver (blocked — ${detail.acceptance.total - detail.acceptance.passing} unproven)`}
        </button>

        <button className="button" disabled={busy} onClick={() => act({ action: "connect", caseId: theCase.id })}>
          Find them someone
        </button>
        <button className="button" disabled={busy} onClick={() => act({ action: "match-response", caseId: theCase.id, accept: true })}>
          The volunteer said yes
        </button>
        <button className="button" disabled={busy} onClick={() => act({ action: "match-response", caseId: theCase.id, accept: false })}>
          The volunteer said no
        </button>
        <button className="button" disabled={busy} onClick={() => act({ action: "close", caseId: theCase.id })}>
          Close the case
        </button>
      </div>
    </div>
  );
}

function PoolPanel({
  dashboard,
  busy,
  act
}: {
  dashboard: OperatorDashboard;
  busy: boolean;
  act: (body: Record<string, unknown>) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [story, setStory] = useState("");
  const [classes, setClasses] = useState("");

  return (
    <div className="card">
      <h2>Connection pool ({dashboard.pool.filter((member) => member.active).length} active)</h2>
      <p className="muted">
        People one step ahead. Nothing closes without one of them, so an empty pool is the single most important
        blocker on this page.
      </p>

      <ul>
        {dashboard.pool.map((member) => (
          <li key={member.id}>
            <strong>{member.display_name}</strong> &mdash; {member.stage} &mdash; {member.region || "anywhere"} &mdash;{" "}
            {member.problem_classes.join(", ") || "no classes"}{" "}
            <button
              className="button"
              disabled={busy}
              onClick={() => act({ action: "toggle-pool-member", memberId: member.id, active: !member.active })}
            >
              {member.active ? "pause" : "activate"}
            </button>
          </li>
        ))}
      </ul>

      <h3>Add someone</h3>
      <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Name" />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Town or city" />
        <input
          value={classes}
          onChange={(event) => setClasses(event.target.value)}
          placeholder="What they've been through (money_income, job_loss, business_start, admin_overwhelm, childcare, isolation)"
        />
        <textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder="One line of their story" />
        <button
          className="button"
          disabled={busy || !displayName.trim()}
          onClick={() =>
            act({
              action: "add-pool-member",
              member: {
                displayName,
                email,
                region,
                story,
                problemClasses: classes
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
              }
            })
          }
        >
          Add to the pool
        </button>
      </div>
    </div>
  );
}
