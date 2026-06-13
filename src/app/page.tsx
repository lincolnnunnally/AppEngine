import Link from "next/link";
import { analyzeIdea } from "@/lib/engine/planner";

const starterPlan = analyzeIdea({
  idea: "A multi-agent app-building engine that creates, tests, fixes, and deploys customer-facing apps.",
  targetCustomer: "Founders and builders who need finished apps",
  problem: "Prototype tools stop before auth, QA, database, and deployment are complete",
  revenueModel: "SaaS subscription",
  appType: "AI workflow app"
});

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="topnav">
        <strong>App Engine</strong>
        <div className="navlinks">
          <Link href="/spark-of-hope-intake-lite">Spark Intake</Link>
          <Link href="/builder">Builder</Link>
          <Link href="/account">Customer Account</Link>
          <Link href="/admin">Admin Console</Link>
        </div>
      </nav>

      <section className="panel">
        <p className="eyebrow">Production Foundation</p>
        <h1>Automated app builder with customer and admin auth</h1>
        <p>
          This scaffold is the Next.js target for the current cockpit. It is ready
          to connect Neon persistence, Auth.js sign-in, reusable templates, and
          real worker orchestration.
        </p>
        <div className="action-row">
          <Link className="button primary" href="/builder">
            Open Builder
          </Link>
          <Link className="button" href="/spark-of-hope-intake-lite">
            Preview Spark Intake
          </Link>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="eyebrow">Recommended Stack</p>
          <h3>{starterPlan.recommendedTarget}</h3>
          <p>{starterPlan.stack.join(", ")}</p>
        </article>
        <article className="card">
          <p className="eyebrow">Authentication</p>
          <h3>{starterPlan.auth.provider}</h3>
          <p>{starterPlan.auth.roles.join(", ")} roles with protected account and admin routes.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Templates</p>
          <h3>{starterPlan.templates.length} selected</h3>
          <p>{starterPlan.templates.map((template) => template.name).slice(0, 3).join(", ")}...</p>
        </article>
      </section>
    </main>
  );
}
