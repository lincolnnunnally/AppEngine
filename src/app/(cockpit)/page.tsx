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
      <header className="home-intro">
        <p className="eyebrow">App Engine</p>
        <h1>Where do you want to start?</h1>
        <p>Two front doors into the build journey. Choose the one that fits where you are today.</p>
      </header>

      <section className="door-grid" aria-label="Choose a starting point">
        <Link className="door-card" href="/opportunity-intake">
          <span className="door-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 2l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8L12 2z" />
            </svg>
          </span>
          <h2>I have a vision to build</h2>
          <p>Clarify the idea, shape the solution, and orchestrate it into a real app.</p>
        </Link>

        <Link className="door-card" href="/problem-intake-lite">
          <span className="door-card-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21" />
            </svg>
          </span>
          <h2>I see a problem and need help</h2>
          <p>Describe a problem and get guided to a safe first step — no tech experience needed.</p>
        </Link>
      </section>

      <section className="grid home-secondary">
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
