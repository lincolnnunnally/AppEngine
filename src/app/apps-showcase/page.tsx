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
    "A human directory of live United Under God apps. Visit each app’s own site to see what it does and sign up.",
  robots: { index: false, follow: true },
};

function LiveCard({ app }: { app: ShowcaseApp }) {
  return (
    <article className="uug-card uug-live">
      <a className="uug-card-main" href={app.liveUrl} target="_blank" rel="noopener noreferrer">
        <h3>{app.name}</h3>
        {app.tagline ? <p>{app.tagline}</p> : null}
        <span className="uug-visit">
          {app.liveHost}
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
      {app.doorLinks.length > 0 ? (
        <p className="uug-doors">
          {app.doorLinks.map((door) => (
            <a key={door.href} href={door.href} target="_blank" rel="noopener noreferrer">
              {door.label}
            </a>
          ))}
        </p>
      ) : null}
    </article>
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
      {app.reservedHost ? <span className="uug-reserved">{app.reservedHost}</span> : null}
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
        <span className="uug-mark" aria-hidden="true">✦</span>
        <span className="uug-wordmark">United Under God</span>
        <a className="uug-toplink" href="https://www.unitedundergod.org" target="_blank" rel="noopener noreferrer">
          unitedundergod.org
        </a>
      </header>

      <main>
        <section className="uug-hero">
          <p className="uug-eyebrow">The United Under God ecosystem</p>
          <h1 className="balanced-title">
            <span>Tools for a fuller life.</span>
            <span>Built to help us thrive together.</span>
          </h1>
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
            <span className="uug-count">{live.length} app destinations to explore</span>
          </div>
          {liveGroups.map(({ group, apps }) => (
            <div key={group} id={`group-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="uug-group">
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
          Built with <a href="https://appengine.unitedundergod.org" target="_blank" rel="noopener noreferrer">App Engine</a> — the app builder behind this family.
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
  --bg: #f7f6f0; --card: #ffffff; --ink: #172f29; --muted: #536960;
  --line: #e0e7df; --accent: #196c5c; --accent-ink: #ffffff; --badge-bg: #eef2ec;
  min-height: 100dvh; background: var(--bg); color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 0 22px 58px;
}
.uug * { box-sizing: border-box; }
.uug a { color: inherit; }
.uug h1, .uug h2, .uug h3, .uug p { margin: 0; }
.uug main, .uug-top, .uug-foot { width: min(1160px, 100%); margin: 0 auto; }
.uug-top { display: flex; align-items: center; gap: 13px; padding: 24px 0; }
.uug-mark { display: grid; place-items: center; width: 39px; height: 39px; border-radius: 12px; color: #f3d99a; background: #173e35; font-size: 24px; }
.uug-wordmark { font-weight: 800; letter-spacing: -0.025em; font-size: 1.1rem; }
.uug-toplink { margin-left: auto; color: var(--muted); text-decoration: none; font-size: .9rem; }
.uug-toplink:hover { text-decoration: underline; }
.uug-hero { position: relative; overflow: hidden; max-width: none; border-radius: 24px; margin-top: 10px; padding: clamp(45px, 7vw, 88px) clamp(25px, 6vw, 76px) 44px; color: #fff; background: radial-gradient(ellipse at 90% 0%, #386c5e 0%, #214d41 42%, #12362f 100%); }
.uug-hero::after { content: ""; position: absolute; right: -90px; top: -115px; width: 410px; height: 410px; border: 1px solid #ffffff35; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 55px #ffffff08, 0 0 0 120px #ffffff05; }
.uug-eyebrow { color: #ead09a; font-weight: 800; text-transform: uppercase; letter-spacing: .17em; font-size: .77rem; margin-bottom: 19px !important; }
.uug-hero h1 { position: relative; z-index: 1; display: flex; flex-direction: column; gap: .09em; max-width: 900px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2.5rem, 5.4vw, 4.65rem); font-weight: 700; line-height: 1.08; letter-spacing: -.04em; text-wrap: balance; }
.uug .balanced-title span { display: block; }
.uug-lead { position: relative; z-index: 1; max-width: 730px; margin-top: 25px !important; font-size: clamp(1.04rem, 1.7vw, 1.25rem); line-height: 1.7; color: #f0f6f1; }
.uug-sub { max-width: 750px; margin-top: 12px !important; color: #d3e3d9; line-height: 1.65; font-size: .98rem; }
.uug-jump { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 9px; margin-top: 30px; }
.uug-jump a { display: inline-block; padding: 10px 14px; border: 1px solid #ffffff60; background: #ffffff12; border-radius: 999px; text-decoration: none; font-size: .83rem; font-weight: 700; }
.uug-jump a:hover, .uug-jump a:focus-visible { background: #f0d9a7; color: #15372e; }
.uug-section { padding-top: 65px; }
.uug-section-head { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.uug-section-head h2 { font-family: Georgia, serif; font-size: clamp(1.75rem, 3vw, 2.3rem); letter-spacing: -.025em; }
.uug-count { color: var(--muted); font-size: .91rem; }
.uug-group { margin-top: 36px; scroll-margin-top: 30px; }
.uug-group-name { color: #295a4b; font-size: .78rem; font-weight: 850; text-transform: uppercase; letter-spacing: .13em; margin-bottom: 14px !important; }
.uug-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.uug-card { display: flex; flex-direction: column; gap: 11px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 25px; min-width: 0; box-shadow: 0 8px 28px #183e3508; }
.uug-card h3 { font-family: Georgia, serif; font-size: 1.38rem; letter-spacing: -.025em; line-height: 1.2; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.uug-card p { color: var(--muted); font-size: .94rem; line-height: 1.65; }
.uug-live { transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease; }
.uug-live:hover, .uug-live:focus-within { border-color: #9bbeb0; transform: translateY(-3px); box-shadow: 0 15px 35px #173e3515; }
.uug-card-main { display: flex; flex-direction: column; gap: 12px; text-decoration: none; color: inherit; flex: 1; }
.uug-card-main:focus-visible, .uug-jump a:focus-visible { outline: 3px solid #d3a85c; outline-offset: 3px; }
.uug-doors { display: flex; flex-wrap: wrap; gap: 12px; margin: 0; padding-top: 12px; border-top: 1px solid var(--line); }
.uug-doors a { color: var(--accent); font-weight: 750; font-size: .84rem; text-decoration: none; }
.uug-doors a:hover { text-decoration: underline; }
.uug-visit { margin-top: auto; padding-top: 16px; display: inline-flex; align-items: center; gap: 8px; color: var(--accent); font-weight: 800; font-size: .86rem; overflow-wrap: anywhere; }
.uug-grid-soon { margin-top: 18px; }
.uug-soon { border-style: dashed; box-shadow: none; }
.uug-reserved { margin-top: auto; padding-top: 8px; color: var(--muted); font-size: .82rem; overflow-wrap: anywhere; }
.uug-badge { background: var(--badge-bg); color: var(--muted); border-radius: 999px; padding: 4px 9px; font: 800 .65rem system-ui,sans-serif; text-transform: uppercase; letter-spacing: .06em; }
.uug-foot { margin-top: 70px; padding-top: 26px; border-top: 1px solid var(--line); }
.uug-foot p { color: var(--muted); font-size: .9rem; line-height: 1.75; }
.uug-foot a { color: var(--accent); font-weight: 700; text-decoration: none; }
.uug-foot a:hover { text-decoration: underline; }
@media (max-width: 850px) { .uug-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 580px) { .uug { padding: 0 16px 42px; } .uug-top { padding: 17px 0; } .uug-toplink { font-size: .75rem; } .uug-wordmark { font-size: .95rem; } .uug-hero { border-radius: 17px; padding: 46px 23px 34px; } .uug-hero::after { right: -220px; } .uug-hero h1 { font-size: clamp(2.2rem, 9vw, 3.2rem); } .uug-grid { grid-template-columns: 1fr; } .uug-section { padding-top: 47px; } .uug-card { padding: 22px; } }
@media (prefers-reduced-motion: reduce) { .uug-live { transition: none; } .uug-live:hover { transform: none; } }
`;
