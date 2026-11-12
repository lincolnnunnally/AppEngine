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
          <p className="uug-eyebrow">The United Under God family</p>
          <h1 className="balanced-title">
            <span>United. Loving. Active.</span>
            <span>Tools that put it into practice.</span>
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
.uug { --bg:#f3eee4;--cream:#ebe4d6;--ink:#1a1814;--muted:#6b645a;--forest:#2e4a3c;--line:#d4cbba;--card:#f3eee4;--accent:#2e4a3c; min-height:100dvh;background:var(--bg);color:var(--ink);font-family:"Figtree","Segoe UI",system-ui,sans-serif;padding:0 22px 60px; }
.uug *{box-sizing:border-box}.uug a{color:inherit}.uug h1,.uug h2,.uug h3,.uug p{margin:0}.uug main,.uug-top,.uug-foot{width:min(1160px,100%);margin:0 auto}
.uug-top{display:flex;align-items:center;gap:13px;padding:24px 0}.uug-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:50%;color:var(--forest);font-size:22px}.uug-wordmark{font-weight:800;letter-spacing:.02em}.uug-toplink{margin-left:auto;text-decoration:none;font-size:.87rem;color:var(--muted)}.uug-toplink:hover{text-decoration:underline}
.uug-hero{position:relative;isolation:isolate;overflow:hidden;margin:0 calc((min(1160px,100vw - 44px) - min(1160px,100vw - 44px))/2);min-height:570px;display:flex;flex-direction:column;justify-content:flex-end;padding:100px clamp(25px,6vw,72px) 42px;color:#f3eee4;background:#1a1814}
.uug-hero::before{content:"";position:absolute;inset:0;z-index:-2;background-image:url("https://www.unitedundergod.org/images/hero.jpg");background-size:cover;background-position:center 44%}
.uug-hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,rgba(26,24,20,.96) 0%,rgba(26,24,20,.74) 55%,rgba(26,24,20,.36) 100%)}
.uug-eyebrow{color:#eee6d8;font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;margin-bottom:17px!important}
.uug-hero h1{display:flex;flex-direction:column;gap:.1em;max-width:890px;font-family:"Fraunces","Iowan Old Style",Palatino,Georgia,serif;font-size:clamp(2.7rem,5.6vw,5.1rem);font-style:italic;font-weight:500;line-height:1.09;letter-spacing:-.03em;text-wrap:balance}
.uug .balanced-title span{display:block}.uug-lead{max-width:680px;margin-top:23px!important;font-size:1.14rem;line-height:1.68;color:#f3eee4}.uug-sub{max-width:730px;margin-top:12px!important;font-size:.96rem;line-height:1.65;color:#e1d8c8}
.uug-jump{display:flex;flex-wrap:wrap;gap:9px;margin-top:27px}.uug-jump a{padding:10px 14px;border:1px solid #f3eee48c;border-radius:6px;text-decoration:none;font-size:.82rem;font-weight:700;background:#1a181433}.uug-jump a:hover,.uug-jump a:focus-visible{background:#f3eee4;color:#1a1814}
.uug-section{padding-top:65px}.uug-section-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:17px;margin-bottom:22px}.uug-section-head h2{font-family:"Fraunces",Palatino,Georgia,serif;font-weight:500;font-size:clamp(1.9rem,3vw,2.6rem)}.uug-count{font-size:.9rem;color:var(--muted)}
.uug-group{margin-top:39px;scroll-margin-top:25px}.uug-group-name{font-size:.76rem;font-weight:750;text-transform:uppercase;letter-spacing:.18em;color:var(--forest);margin-bottom:15px!important}
.uug-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:21px}.uug-card{display:flex;flex-direction:column;gap:10px;min-width:0;padding:24px 5px 24px 0;border-top:1px solid var(--line);background:transparent}.uug-card h3{font-family:"Fraunces",Palatino,Georgia,serif;font-weight:500;font-style:italic;font-size:1.55rem;line-height:1.2;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.uug-card p{font-size:.94rem;line-height:1.65;color:var(--muted)}
.uug-live{transition:border-color .15s ease,transform .15s ease}.uug-live:hover,.uug-live:focus-within{border-top-color:var(--forest);transform:translateY(-2px)}.uug-card-main{display:flex;flex:1;flex-direction:column;gap:12px;text-decoration:none}.uug-card-main:focus-visible,.uug-jump a:focus-visible{outline:3px solid #a7834c;outline-offset:3px}.uug-visit{margin-top:auto;padding-top:13px;display:inline-flex;gap:8px;align-items:center;color:var(--forest);font-size:.85rem;font-weight:750;overflow-wrap:anywhere}
.uug-doors{display:flex;flex-wrap:wrap;gap:12px;border-top:1px solid var(--line);padding-top:11px}.uug-doors a{font-size:.83rem;color:var(--forest);font-weight:700;text-decoration:none}.uug-doors a:hover{text-decoration:underline}
.uug-grid-soon{margin-top:18px}.uug-soon{opacity:.72}.uug-reserved{margin-top:auto;padding-top:7px;color:var(--muted);font-size:.81rem;overflow-wrap:anywhere}.uug-badge{border:1px solid var(--line);padding:4px 8px;font:700 .65rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em}
.uug-foot{margin-top:70px;padding-top:25px;border-top:1px solid var(--line)}.uug-foot p{font-size:.91rem;color:var(--muted);line-height:1.8}.uug-foot a{color:var(--forest);font-weight:700;text-decoration:none}.uug-foot a:hover{text-decoration:underline}
@media(max-width:850px){.uug-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:590px){.uug{padding:0 16px 40px}.uug-top{padding:18px 0}.uug-wordmark{font-size:.9rem}.uug-toplink{font-size:.75rem}.uug-hero{min-height:630px;padding:85px 24px 32px}.uug-hero h1{font-size:clamp(2.3rem,9vw,3.5rem)}.uug-grid{grid-template-columns:1fr}.uug-section{padding-top:46px}.uug-card{padding:21px 0}}
@media(prefers-reduced-motion:reduce){.uug-live{transition:none}.uug-live:hover{transform:none}}
`;
