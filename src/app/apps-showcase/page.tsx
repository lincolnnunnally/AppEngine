import type { Metadata } from "next";
import { GROUP_ORDER, getAppsShowcase, type ShowcaseApp } from "@/lib/showcase/apps-showcase";

// Public showcase — served at apps.unitedundergod.org (middleware rewrites that
// host's "/" here and collapses every other path on that host back to "/").
// This route lives OUTSIDE the (cockpit) group on purpose: it is always public,
// regardless of the APP_ENGINE_PUBLIC_ACCESS gate, and it never requires or
// offers sign-in on this host. Mission copy quotes the owner's master
// source-of-truth (life-produces-life/_SOURCE_OF_TRUTH/00_LIFE_PRODUCES_LIFE__
// MASTER.md) — condensed faithfully, nothing invented. The roster comes from
// the portfolio registries via getAppsShowcase(); no hand-written app list.

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Our Apps — United Under God",
  description:
    "Every app in the United Under God family — what each one does, what's live today, and what's coming next."
};

function LiveCard({ app }: { app: ShowcaseApp }) {
  return (
    <a className="uug-card uug-live" href={app.liveUrl} target="_blank" rel="noopener noreferrer">
      <h3>{app.name}</h3>
      {app.tagline ? <p>{app.tagline}</p> : null}
      <span className="uug-visit">
        {app.liveHost}
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </a>
  );
}

function SoonCard({ app }: { app: ShowcaseApp }) {
  return (
    <div className="uug-card uug-soon">
      <h3>
        {app.name}
        <span className="uug-badge">Coming soon</span>
      </h3>
      {app.tagline ? <p>{app.tagline}</p> : null}
    </div>
  );
}

export default function AppsShowcasePage() {
  const { live, comingSoon } = getAppsShowcase();
  const liveGroups = GROUP_ORDER.map((group) => ({
    group,
    apps: live.filter((app) => app.group === group)
  })).filter(({ apps }) => apps.length > 0);

  return (
    <div className="uug">
      {/* Scoped styles for the one public page — light/dark aware, no client JS. */}
      <style>{CSS}</style>

      <header className="uug-top">
        <span className="uug-mark" aria-hidden="true" />
        <span className="uug-wordmark">United Under God</span>
        <a className="uug-toplink" href="https://www.unitedundergod.org" target="_blank" rel="noopener noreferrer">
          unitedundergod.org
        </a>
      </header>

      <main>
        <section className="uug-hero">
          <p className="uug-eyebrow">Our apps</p>
          <h1>One family of apps, built to serve real life.</h1>
          <p className="uug-lead">
            Everything here exists for one reason: helping people experience the personal truth about God in
            practical, everyday ways — moving from being consumed by problems to seeing those problems as
            opportunities. God is bigger than any problem.
          </p>
          <p className="uug-sub">
            United Under God is the kingdom vision; Life Produces Life is the process that moves people toward it.
            Each app below is one practical expression of that — some faith-forward, some simply useful. Start
            anywhere.
          </p>
        </section>

        <section className="uug-section" aria-labelledby="live-heading">
          <div className="uug-section-head">
            <h2 id="live-heading">Live today</h2>
            <span className="uug-count">{live.length} apps you can use right now</span>
          </div>
          {liveGroups.map(({ group, apps }) => (
            <div key={group} className="uug-group">
              <h3 className="uug-group-name">{group}</h3>
              <div className="uug-grid">
                {apps.map((app) => (
                  <LiveCard key={app.slug} app={app} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="uug-section" aria-labelledby="soon-heading">
          <div className="uug-section-head">
            <h2 id="soon-heading">Coming soon</h2>
            <span className="uug-count">{comingSoon.length} more in the works</span>
          </div>
          <div className="uug-grid uug-grid-soon">
            {comingSoon.map((app) => (
              <SoonCard key={app.slug} app={app} />
            ))}
          </div>
        </section>
      </main>

      <footer className="uug-foot">
        <p>
          Built with <a href="https://www.we-succeed.org" target="_blank" rel="noopener noreferrer">We Succeed</a> — the app builder behind this family.
        </p>
        <p className="uug-foot-sub">
          Part of the <a href="https://www.unitedundergod.org" target="_blank" rel="noopener noreferrer">United Under God</a> ecosystem.
        </p>
      </footer>
    </div>
  );
}

const CSS = `
.uug {
  --bg: #f6f8f7;
  --card: #ffffff;
  --ink: #16211b;
  --muted: #58685f;
  --line: #dce4df;
  --accent: #0c7d6f;
  --accent-ink: #ffffff;
  --badge-bg: #eef2ef;
  color-scheme: light dark;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 0 20px 56px;
}
@media (prefers-color-scheme: dark) {
  .uug {
    --bg: #0e1512;
    --card: #18211c;
    --ink: #eef2ee;
    --muted: #9aa79f;
    --line: #28332c;
    --accent: #34c0ad;
    --accent-ink: #08211c;
    --badge-bg: #1f2a24;
  }
}
.uug a { color: inherit; }
.uug h1, .uug h2, .uug h3, .uug p { margin: 0; }
.uug main, .uug-top, .uug-foot { width: min(1060px, 100%); margin: 0 auto; }

.uug-top { display: flex; align-items: center; gap: 10px; padding: 22px 0; }
.uug-mark {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
}
.uug-wordmark { font-weight: 800; letter-spacing: 0.01em; }
.uug-toplink { margin-left: auto; color: var(--muted); text-decoration: none; font-size: 0.9rem; }
.uug-toplink:hover { color: var(--ink); text-decoration: underline; }

.uug-hero { padding: 44px 0 12px; max-width: 720px; }
.uug-eyebrow {
  color: var(--accent); font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.14em; font-size: 0.78rem; margin-bottom: 14px;
}
.uug-hero h1 { font-size: clamp(2rem, 5vw, 3.1rem); line-height: 1.06; letter-spacing: -0.02em; }
.uug-lead { margin-top: 18px; font-size: 1.08rem; line-height: 1.65; }
.uug-sub { margin-top: 12px; color: var(--muted); line-height: 1.6; }

.uug-section { padding-top: 44px; }
.uug-section-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
.uug-section-head h2 { font-size: 1.45rem; letter-spacing: -0.01em; }
.uug-count { color: var(--muted); font-size: 0.9rem; }

.uug-group { margin-top: 20px; }
.uug-group-name {
  color: var(--muted); font-size: 0.78rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px;
}
.uug-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }

.uug-card {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--card); border: 1px solid var(--line); border-radius: 12px;
  padding: 18px;
}
.uug-card h3 { font-size: 1.05rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.uug-card p { color: var(--muted); font-size: 0.92rem; line-height: 1.55; }
.uug-live { text-decoration: none; transition: border-color 120ms ease, transform 120ms ease; }
.uug-live:hover { border-color: var(--accent); transform: translateY(-2px); }
.uug-visit {
  margin-top: auto; padding-top: 6px;
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--accent); font-weight: 700; font-size: 0.88rem;
}
.uug-grid-soon { margin-top: 18px; }
.uug-soon { border-style: dashed; }
.uug-badge {
  background: var(--badge-bg); color: var(--muted);
  border-radius: 999px; padding: 3px 10px;
  font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
}

.uug-foot { margin-top: 64px; padding-top: 22px; border-top: 1px solid var(--line); }
.uug-foot p { color: var(--muted); font-size: 0.92rem; line-height: 1.7; }
.uug-foot a { color: var(--accent); font-weight: 700; text-decoration: none; }
.uug-foot a:hover { text-decoration: underline; }
`;
