import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadCanonicalFlowStatus, type CompletedLoopRow } from "@/lib/engine/canonical-flow-status";

export const dynamic = "force-dynamic";

const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  yes: { bg: "#0f5132", fg: "#d1e7dd", label: "SAFE TO USE" },
  no: { bg: "#842029", fg: "#f8d7da", label: "NEEDS ATTENTION" },
  unknown: { bg: "#664d03", fg: "#fff3cd", label: "UNKNOWN" }
};

export default async function CanonicalStatusPage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  const status = await loadCanonicalFlowStatus();
  const tone = TONE[status.safeToUse];

  return (
    <main className="shell wide-shell">
      <nav className="topnav">
        <strong>AppEngine Canonical Status</strong>
        <div className="navlinks">
          <Link href="/">Home</Link>
          <Link href="/owner-control-center">Owner Control Center</Link>
          <Link href="/problem-intake">Intake</Link>
        </div>
      </nav>

      <section className="card" style={{ borderLeft: `6px solid ${tone.bg}` }}>
        <p className="eyebrow">Is AppEngine safe to use right now?</p>
        <p style={{ display: "inline-block", background: tone.bg, color: tone.fg, padding: "4px 12px", borderRadius: 6, fontWeight: 700, letterSpacing: 0.5 }}>
          {tone.label}
        </p>
        <p style={{ marginTop: 12 }}>{status.headline}</p>
      </section>

      <section className="card">
        <p className="eyebrow">Latest regression</p>
        {status.regression.available ? (
          <ul>
            <li>
              Result: <strong style={{ color: status.regression.passed ? "#0f5132" : "#842029" }}>{status.regression.passed ? "PASS" : "FAIL"}</strong>
            </li>
            <li>Checks: {status.regression.totalChecks ?? "?"} ({status.regression.failedChecks ?? 0} failed)</li>
            <li>When: {formatWhen(status.regression.generatedAt)}</li>
            <li>Duplicate-build refusal verified: {boolText(status.regression.duplicateBuildBlocked)}</li>
          </ul>
        ) : (
          <p className="empty-state">No regression result found. Run <code>npm run smoke:canonical-flow-regression</code>.</p>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Canonical system (one of each)</p>
        <div className="detail-grid">
          <Pillar label="One front door" value={status.canonical.frontDoor} />
          <Pillar label="One registry" value={status.canonical.registry} note={`${status.canonical.registryEntryCount} app/project entries`} />
          <Pillar label="One prior-work check" value={status.canonical.priorWorkCheck} />
          <Pillar label="One execution record" value={status.canonical.executionRecord} note={`${status.canonical.executionRecordCount} execution records`} />
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Latest completed loops — what AppEngine finished last</p>
        <LoopTable rows={status.latestCompletedLoops} emptyText="No completed loops recorded yet." />
      </section>

      <section className="card">
        <p className="eyebrow">Latest non-build (process / workflow) loops</p>
        <LoopTable rows={status.latestNonBuildLoops} emptyText="No non-build workflow loops recorded yet." />
      </section>

      <section className="card">
        <p className="eyebrow">Duplicate-build protection</p>
        <p>
          {status.duplicateBuildProtection.verified ? "✅ Enforced" : "⚠️ Not verified"} — {status.duplicateBuildProtection.source}.
        </p>
        <p className="empty-state" style={{ marginTop: 8 }}>
          Note: refusals are enforced at the packet layer (a duplicate build throws and exits non-zero); individual attempts are not logged to a store, so this reflects the latest regression rather than a per-attempt history.
        </p>
      </section>

      <section className="card">
        <p className="eyebrow">Canonical-flow pull request</p>
        <p>
          <a href={status.pr.url} target="_blank" rel="noreferrer">PR #{status.pr.number}</a> — {status.pr.title}
        </p>
        <p className="empty-state">Branch: <code>{status.pr.branch}</code> (tracked locally; not live-polled).</p>
      </section>
    </main>
  );
}

function Pillar({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p><code>{value}</code></p>
      {note ? <p className="empty-state">{note}</p> : null}
    </div>
  );
}

function LoopTable({ rows, emptyText }: { rows: CompletedLoopRow[]; emptyText: string }) {
  if (!rows.length) {
    return <p className="empty-state">{emptyText}</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid currentColor", opacity: 0.7 }}>
          <th style={{ padding: "4px 8px" }}>App / project</th>
          <th style={{ padding: "4px 8px" }}>Goal</th>
          <th style={{ padding: "4px 8px" }}>Class</th>
          <th style={{ padding: "4px 8px" }}>Status</th>
          <th style={{ padding: "4px 8px" }}>Completed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.runId} style={{ borderBottom: "1px solid rgba(127,127,127,0.2)" }}>
            <td style={{ padding: "4px 8px" }}>{row.appName}</td>
            <td style={{ padding: "4px 8px" }}>{row.goal}</td>
            <td style={{ padding: "4px 8px" }}>{row.solutionClass === "non_build" ? "process" : "software"}</td>
            <td style={{ padding: "4px 8px" }}>{row.status}</td>
            <td style={{ padding: "4px 8px" }}>{formatWhen(row.completedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function boolText(value: boolean | undefined) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

function formatWhen(iso?: string) {
  if (!iso) return "unknown";
  return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC");
}
