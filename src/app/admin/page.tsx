import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/auth/roles";
import { getEngineHealth } from "@/lib/engine/execution";
import { isLocalMode } from "@/lib/engine/local-mode";
import { listPlannedProjects } from "@/lib/engine/persistence";
import { defaultTaskGraph } from "@/lib/engine/tasks";

export default async function AdminPage() {
  const session = await auth();

  if (!isLocalMode() && !canAccessAdmin(session?.user?.role)) {
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

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Administrator</p>
        <h1>Admin Console</h1>
        <p>
          Manage generated apps, customer/admin access, templates, agent runs, QA reports, deployments, support, and audit logs.
        </p>
      </section>

      <section className="metric-grid" style={{ marginTop: 16 }}>
        <article className="metric-card">
          <span>Storage</span>
          <strong>{health.storage}</strong>
        </article>
        <article className="metric-card">
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </article>
        <article className="metric-card">
          <span>Runs</span>
          <strong>{health.localStore?.runCount ?? health.neonCounts?.runs ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>QA checks</span>
          <strong>{health.localStore?.qaCheckCount ?? health.neonCounts?.qaChecks ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Deployments</span>
          <strong>{health.localStore?.deploymentCount ?? health.neonCounts?.deployments ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Exports</span>
          <strong>{health.localStore?.exportCount ?? 0}</strong>
        </article>
      </section>

      <section className="panel health-panel" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Production Wiring</p>
          <h2>{health.missing.length ? "Setup needed" : "Ready for production runs"}</h2>
          <p>
            {health.missing.length
              ? "These credentials or migrations are still needed before the engine can run real worker and deployment jobs."
              : "Database, auth, model workers, and deployment settings are configured."}
          </p>
        </div>
        <div className="missing-list">
          {health.missing.length ? health.missing.map((item) => <span key={item}>{item}</span>) : <span>All configured</span>}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <p className="eyebrow">Generated Apps</p>
        <h2>Project Queue</h2>
        {projects.length ? (
          <div className="saved-project-list">
            {projects.slice(0, 9).map((project) => (
              <article className="saved-project" key={project.id}>
                <span>{project.status}</span>
                <strong>{project.name}</strong>
                <p>
                  {project.app_type || "Planned app"} - {project.recommended_target || "Build target pending"}
                </p>
                <small>{project.readiness_score}% readiness</small>
              </article>
            ))}
          </div>
        ) : (
          <p>No generated app projects have been saved yet.</p>
        )}
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        {defaultTaskGraph.slice(0, 6).map((task) => (
          <article className="card" key={task.agent}>
            <p className="eyebrow">{task.agent}</p>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
