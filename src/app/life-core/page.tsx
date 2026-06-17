import Link from "next/link";
import { getLifeCoreOverview, type LifeCoreJourneyStage } from "@/lib/engine/life-core";

export const dynamic = "force-dynamic";

const stageLabels: Record<LifeCoreJourneyStage, string> = {
  survival: "Survival",
  hope: "Hope",
  action: "Action",
  discovery: "Discovery",
  becoming: "Becoming",
  thriving: "Thriving",
  multiplication: "Multiplication"
};

export default async function LifeCorePage() {
  const overview = await getLifeCoreOverview();
  const unitedUnderGod = overview.experiences.find((experience) => experience.id === "united_under_god");
  const churchConnect = overview.experiences.find((experience) => experience.id === "church_connect");

  return (
    <main className="shell wide-shell life-core-page" data-testid="life-core-page">
      <nav className="topnav">
        <strong>Life Produces Life Core</strong>
        <div className="navlinks">
          <Link href="/">Home</Link>
          <Link href="/owner-control-center">Owner Control</Link>
          <Link href="/problem-intake-lite">Problem Intake</Link>
          <Link href="/builder">Builder</Link>
        </div>
      </nav>

      <section className="life-core-hero">
        <div>
          <p className="eyebrow">Foundation Preview</p>
          <h1>Shared contracts for transformation-focused ecosystem experiences</h1>
          <p>
            Life Produces Life Core gives AppEngine a working modular foundation for profiles, organizations,
            communities, journey stages, testimonies, opportunities, ecosystem experiences, and a unified activity feed.
          </p>
          <div className="guardrail-strip">
            <span>Local/mock preview</span>
            <span>No paid resources</span>
            <span>No migrations</span>
            <span>No production deploy</span>
          </div>
        </div>
        <aside className="life-core-status" aria-label="Foundation status">
          <span>Next safe action</span>
          <strong>Use as a preview foundation</strong>
          <p>Future ecosystem slices can plug into these contracts without sharing another app&apos;s purpose.</p>
        </aside>
      </section>

      <section className="life-core-section">
        <div className="handoff-section-heading">
          <div>
            <p className="eyebrow">Journey</p>
            <h2>Survival to Multiplication</h2>
          </div>
          <span className="handoff-state-pill">Stages in order</span>
        </div>
        <div className="life-core-stage-grid">
          {overview.journeyStages.map((stage, index) => (
            <article className="life-core-stage" key={stage}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{stageLabels[stage]}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="life-core-section">
        <div className="handoff-section-heading">
          <div>
            <p className="eyebrow">Experience Map</p>
            <h2>Shared philosophy, distinct purposes</h2>
          </div>
        </div>
        <div className="life-core-experience-grid">
          {overview.experiences.map((experience) => (
            <article className="life-core-experience-card" key={experience.id}>
              <span>{experience.category.replaceAll("_", " ")}</span>
              <h3>{experience.name}</h3>
              <p>{experience.purpose}</p>
              <div className="artifact-strip">
                {experience.sampleModules.map((module) => (
                  <span key={module}>{module}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="life-core-section life-core-distinction">
        <article>
          <p className="eyebrow">United Under God</p>
          <h2>{unitedUnderGod?.name}</h2>
          <p>{overview.distinctions.unitedUnderGod}</p>
          <ul>
            <li>Mission network</li>
            <li>Body-of-Christ collaboration</li>
            <li>Encouragement and shared burden discovery</li>
            <li>People realizing they are not alone</li>
          </ul>
        </article>
        <article>
          <p className="eyebrow">ChurchConnect</p>
          <h2>{churchConnect?.name}</h2>
          <p>{overview.distinctions.churchConnect}</p>
          <ul>
            <li>Church communications</li>
            <li>Events and directories</li>
            <li>Volunteer coordination</li>
            <li>Church office and admin operations</li>
          </ul>
        </article>
      </section>

      <section className="life-core-section">
        <div className="handoff-section-heading">
          <div>
            <p className="eyebrow">Shared Modules</p>
            <h2>Foundation modules future slices can reuse</h2>
          </div>
        </div>
        <div className="life-core-module-grid">
          {overview.modules.map((module) => (
            <article className="handoff-state-block" key={module.id}>
              <span>{module.id.replaceAll("_", " ")}</span>
              <strong>{module.name}</strong>
              <p>{module.purpose}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="life-core-columns">
        <div className="life-core-section">
          <p className="eyebrow">Sample Testimonies</p>
          <h2>Visible movement</h2>
          <div className="life-core-list">
            {overview.testimonies.map((testimony) => (
              <article className="life-core-list-item" key={testimony.id}>
                <span>
                  {stageLabels[testimony.fromStage]} to {stageLabels[testimony.toStage]}
                </span>
                <strong>{testimony.title}</strong>
                <p>{testimony.summary}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="life-core-section">
          <p className="eyebrow">Sample Opportunities</p>
          <h2>Barrier to next action</h2>
          <div className="life-core-list">
            {overview.opportunities.map((opportunity) => (
              <article className="life-core-list-item" key={opportunity.id}>
                <span>{opportunity.experience.replaceAll("_", " ")}</span>
                <strong>{opportunity.title}</strong>
                <p>{opportunity.barrierRemoved}</p>
                <small>{opportunity.nextAction}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="life-core-columns">
        <div className="life-core-section">
          <p className="eyebrow">Communities And Mission Networks</p>
          <h2>Places where movement can be supported</h2>
          <div className="life-core-list">
            {overview.communities.map((community) => (
              <article className="life-core-list-item" key={community.id}>
                <span>{community.experience.replaceAll("_", " ")}</span>
                <strong>{community.name}</strong>
                <p>{community.summary}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="life-core-section">
          <p className="eyebrow">Unified Activity Feed</p>
          <h2>Cross-experience signal without purpose bleed</h2>
          <div className="life-core-feed">
            {overview.feed.map((item) => (
              <article className="life-core-feed-item" key={item.id}>
                <span>{item.experience.replaceAll("_", " ")}</span>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
