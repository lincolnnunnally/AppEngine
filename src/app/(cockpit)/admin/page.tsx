import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { getEngineHealth } from "@/lib/engine/execution";
import { isLocalMode } from "@/lib/engine/local-mode";
import { listPlannedProjects } from "@/lib/engine/persistence";
import { defaultTaskGraph } from "@/lib/engine/tasks";

export const dynamic = "force-dynamic";

// The factory's own console. It is one app on the deck like any other, so it
// speaks the same desk vocabulary — and, like the deck, every count here opens
// the place that count came from.
export default async function AdminPage() {
  if (!isLocalMode() && !(await canAccessEngineAdmin())) {
    redirect("/");
  }

  const [health, plannedProjects] = await Promise.all([getEngineHealth(), listPlannedProjects()]);
  const projects = plannedProjects.projects as Array<{
    id: string;
    name: string;
    status: string;
    readiness_score: number;
    app_type?: string;
    recommended_target?: string;
    updated_at: string;
  }>;

  const runs = health.localStore?.runCount ?? health.neonCounts?.runs ?? 0;
  const qaChecks = health.localStore?.qaCheckCount ?? health.neonCounts?.qaChecks ?? 0;
  const deployments = health.localStore?.deploymentCount ?? health.neonCounts?.deployments ?? 0;
  const exports = health.localStore?.exportCount ?? 0;

  return (
    <main className="shell wide-shell">
      <section className="panel biz-hero">
        <p className="dx-label">Administrator</p>
        <h1 className="dx-display">
          The factory&apos;s own <em>console</em>.
        </h1>
        <p className="dx-lede">
          Generated apps, customer and admin access, templates, agent runs, QA reports, deployments, support, and audit
          logs. This is AppEngine looking at itself — the portfolio lives on{" "}
          <a className="account-link" href="/">
            the businesses deck
          </a>
          .
        </p>
        <div className="dx-stat-grid">
          <a className="dx-stat dx-stat--cyan" href="/integrations">
            <strong>{health.storage}</strong>
            <span>storage</span>
            <p>where this desk keeps state → keys</p>
          </a>
          <a className="dx-stat" href="/builder">
            <strong>{projects.length}</strong>
            <span>projects</span>
            <p>open the builder →</p>
          </a>
          <a className="dx-stat" href="/orchestrator">
            <strong>{runs}</strong>
            <span>runs</span>
            <p>agent runs and their queue →</p>
          </a>
          <a className="dx-stat" href="/reports">
            <strong>{qaChecks}</strong>
            <span>QA checks</span>
            <p>reports →</p>
          </a>
          <a className="dx-stat dx-stat--lime" href="/domains">
            <strong>{deployments}</strong>
            <span>deployments</span>
            <p>where each one answers →</p>
          </a>
          <a className="dx-stat" href="/owner-control-center">
            <strong>{exports}</strong>
            <span>exports</span>
            <p>handoffs and packets →</p>
          </a>
        </div>
      </section>

      <section className="panel">
        <p className="dx-label">Production wiring</p>
        <h2 className="dx-subhead">{health.missing.length ? "Setup needed" : "Ready for production runs"}</h2>
        <p className="dx-note">
          {health.missing.length
            ? "These credentials or migrations are still needed before the engine can run real worker and deployment jobs."
            : "Database, auth, model workers, and deployment settings are configured."}
        </p>
        {health.missing.length ? (
          <div className="dx-chips">
            {health.missing.map((item) => (
              // Each gap opens the one page where it is entered.
              <a className="dx-chip" key={item} href="/integrations">
                {item} →
              </a>
            ))}
          </div>
        ) : (
          <p className="dx-note">All configured.</p>
        )}
      </section>

      <section className="panel">
        <p className="dx-label">Generated apps</p>
        <h2 className="dx-subhead">Project queue</h2>
        {projects.length ? (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Target</th>
                  <th>Readiness</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr className="biz-row" key={project.id}>
                    <td>
                      <a className="biz-name" href={`/builder?project=${encodeURIComponent(project.id)}`}>
                        {project.name}
                      </a>
                      <div className="dx-domain">{project.app_type || "Planned app"}</div>
                    </td>
                    <td>{project.status}</td>
                    <td className="dx-note">{project.recommended_target || "Build target pending"}</td>
                    <td className="dx-mono">{project.readiness_score}%</td>
                    <td className="dx-mono">{(project.updated_at || "").slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dx-note">
            No generated app projects have been saved yet.{" "}
            <a className="account-link" href="/start">
              Start one
            </a>
            .
          </p>
        )}
      </section>

      <section className="panel">
        <p className="dx-label">The default task graph</p>
        <p className="dx-note">What every build runs through. The live queue is on the orchestrator.</p>
        {defaultTaskGraph.slice(0, 6).map((task, index) => (
          <p className="dx-row" key={task.agent}>
            <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
            <a className="biz-name" href="/orchestrator">
              {task.title}
            </a>
            <span className="dx-note">
              {task.agent} — {task.description}
            </span>
          </p>
        ))}
      </section>
    </main>
  );
}
