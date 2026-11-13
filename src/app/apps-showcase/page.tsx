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
        <span className="uug-mark" aria-hidden="true"><svg viewBox="310 75 332 405" aria-hidden="true" focusable="false"><g fill="currentColor"><path d="M382 150L326 150L335 159L335 338C335 392 400 432 476 466C552 432 617 392 617 338L617 159L626 150L570 150L570 325Q570 375 492.5 402L459.5 402Q382 375 382 325Z"/><path d="M476 90L492.5 107L492.5 176L543 176L543 207L492.5 207L492.5 410L459.5 410L459.5 207L409 207L409 176L459.5 176L459.5 107Z"/></g></svg></span>
        <span className="uug-wordmark">United Under God</span>
        <a className="uug-toplink" href="https://www.unitedundergod.org" target="_blank" rel="noopener noreferrer">
          unitedundergod.org
        </a>
      </header>

      <main>
        <section className="uug-hero">
          <div className="uug-seal" aria-hidden="true"><span className="uug-seal-cross"><svg viewBox="310 75 332 405" aria-hidden="true" focusable="false"><g fill="currentColor"><path d="M382 150L326 150L335 159L335 338C335 392 400 432 476 466C552 432 617 392 617 338L617 159L626 150L570 150L570 325Q570 375 492.5 402L459.5 402Q382 375 382 325Z"/><path d="M476 90L492.5 107L492.5 176L543 176L543 207L492.5 207L492.5 410L459.5 410L459.5 207L409 207L409 176L459.5 176L459.5 107Z"/></g></svg></span><span className="uug-seal-name">UNITED UNDER GOD</span></div>
          <p className="uug-eyebrow">GOD’S KINGDOM · OUR PURPOSE</p>
          <h1 className="balanced-title">
            <span>ONE FAMILY OF APPS.</span>
            <span>BUILT TO SERVE REAL LIFE.</span>
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
.uug{--bg:#090909;--card:#131313;--ink:#f5f2eb;--muted:#a5a19b;--line:#34302a;--accent:#C9B08C;--badge-bg:#252017;color-scheme:dark;min-height:100dvh;background:radial-gradient(ellipse at 50% 0%,#201a12 0%,#0c0b0a 38%,#090909 75%);color:var(--ink);font-family:Arial,Helvetica,sans-serif;padding:0 24px 65px}
.uug a{color:inherit}.uug h1,.uug h2,.uug h3,.uug p{margin:0}.uug main,.uug-top,.uug-foot{width:min(1120px,100%);margin:0 auto}
.uug-top{display:flex;align-items:center;gap:12px;padding:22px 0;border-bottom:1px solid #30291d}
.uug-mark{display:block;width:34px;height:34px;color:var(--accent);flex:none}.uug-mark svg{display:block;width:100%;height:100%}
.uug-wordmark{font-size:13px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.uug-toplink{margin-left:auto;color:var(--muted);text-decoration:none;font-size:.82rem}.uug-toplink:hover{color:var(--accent)}
.uug-hero{text-align:center;padding:65px 0 65px;max-width:900px;margin:auto}
.uug-seal{width:min(330px,80vw);height:235px;margin:0 auto 30px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--accent)}
.uug-seal-cross{display:block;width:164px;height:164px;color:var(--accent);filter:drop-shadow(0 0 22px #c9b08c30)}.uug-seal-cross svg{display:block;width:100%;height:100%}
.uug-seal-name{font-family:Georgia,serif;font-weight:900;font-size:21px;letter-spacing:.12em;margin-top:20px;white-space:nowrap}
.uug-eyebrow{color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:.28em;font-size:.72rem;margin-bottom:25px}
.uug-hero h1,.uug .balanced-title{display:flex;flex-direction:column;gap:.05em;font-family:Impact,"Arial Narrow",Arial,sans-serif;font-stretch:condensed;font-weight:900;font-size:clamp(2.35rem,7.5vw,5.4rem);line-height:1.07;letter-spacing:.045em;text-wrap:balance}
.uug .balanced-title span{display:block}
.uug-lead{margin:30px auto 0;max-width:760px;font-size:1.06rem;line-height:1.8;color:#d2cec6}
.uug-sub{margin:17px auto 0;max-width:750px;color:var(--muted);line-height:1.75}
.uug-section{padding-top:52px;border-top:1px solid #322a20;margin-top:12px}
.uug-section-head{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.uug-section-head h2{font-family:Impact,"Arial Narrow",Arial,sans-serif;text-transform:uppercase;font-size:2rem;letter-spacing:.06em}
.uug-count{color:var(--accent);font-size:.82rem;letter-spacing:.04em}
.uug-group{margin-top:28px}.uug-group-name{color:var(--accent);font-size:.73rem;font-weight:800;text-transform:uppercase;letter-spacing:.2em;margin-bottom:14px}
.uug-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:15px}
.uug-card{display:flex;flex-direction:column;gap:10px;background:linear-gradient(155deg,#1c1a17,#111);border:1px solid var(--line);border-radius:3px;padding:23px;min-width:0}
.uug-card h3{font-size:1.12rem;display:flex;align-items:center;gap:9px;flex-wrap:wrap;color:#f4eee3}
.uug-card p{color:var(--muted);font-size:.9rem;line-height:1.65}
.uug-live{transition:border-color .2s ease,transform .2s ease}.uug-live:hover{border-color:var(--accent);transform:translateY(-3px)}
.uug-card-main{display:flex;flex-direction:column;gap:10px;text-decoration:none;color:inherit;flex:1}
.uug-doors{display:flex;flex-wrap:wrap;gap:12px;margin:0;padding-top:12px;border-top:1px solid var(--line)}
.uug-doors a{color:var(--accent);font-weight:700;font-size:.82rem;text-decoration:none}.uug-doors a:hover{text-decoration:underline}
.uug-visit{margin-top:auto;padding-top:14px;display:inline-flex;align-items:center;gap:7px;color:var(--accent);font-weight:700;font-size:.83rem;overflow-wrap:anywhere}
.uug-grid-soon{margin-top:20px}.uug-soon{border-style:dashed}.uug-reserved{margin-top:auto;padding-top:6px;color:var(--muted);font-size:.82rem}
.uug-badge{background:var(--badge-bg);color:var(--accent);border:1px solid #493b26;border-radius:2px;padding:4px 8px;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.uug-foot{margin-top:72px;padding-top:25px;border-top:1px solid var(--line)}.uug-foot p{color:var(--muted);font-size:.9rem;line-height:1.8}.uug-foot a{color:var(--accent);font-weight:700;text-decoration:none}.uug-foot a:hover{text-decoration:underline}
@media(max-width:600px){.uug{padding:0 18px 45px}.uug-top{flex-wrap:wrap}.uug-toplink{font-size:.72rem}.uug-hero{padding:45px 0}.uug-seal{height:190px}.uug-seal-cross{width:140px;height:140px}.uug-seal-name{font-size:16px}.uug-eyebrow{letter-spacing:.16em}.uug-hero h1{font-size:clamp(2rem,8.6vw,3.25rem);letter-spacing:.035em;line-height:1.1}}
`;