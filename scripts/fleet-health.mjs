#!/usr/bin/env node
// Fleet health: does every app in the portfolio actually WORK right now?
//
// This exists because of 2026-07-29. Render suspended all 7 free web services
// at the same minute (the account's free instance hours ran out), which killed
// the APIs behind ChurchConnect, Kindred, Aligned Souls, Laser and EasyPeazy.
// Every one of those frontends kept returning HTTP 200. Nothing alarmed. The
// fleet sat half-dead for a day and the portfolio registry still said "live".
//
// So the rule this script is built on:
//
//   A 200 from the app root proves the CDN served a file. It proves nothing
//   about whether the app works.
//
// Two failures are therefore treated as DOWN even though both return 200:
//   * `x-render-routing: suspend` anywhere in the chain
//   * an /api/* path answering with text/html — that is the SPA catch-all
//     swallowing the API route, i.e. the API rewrite is not wired at all
//
// And an app whose API layer we cannot verify is reported as UNVERIFIED, never
// as healthy. False assurance is the thing that cost us the day.
//
//   node scripts/fleet-health.mjs             # probe and print, change nothing
//   node scripts/fleet-health.mjs --apply     # also open/update/close the tracking issue
//   node scripts/fleet-health.mjs --json      # machine-readable, for other tooling
//
// Governor (this runs unattended every 30 minutes, so the limits are the design):
//   * it opens exactly ONE rolling issue, edits it in place, and closes it on
//     recovery — a week-long outage cannot produce 336 issues
//   * it never edits code, merges, deploys, or touches any app
//   * probes are unauthenticated GETs against public URLs, so this needs no
//     secrets and is safe to run from a public repo

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const AS_JSON = process.argv.includes('--json');

// Derived from the environment in CI so this cannot drift: the GitHub repo is
// `lincolnnunnally/AppEngine` while the local checkout directory is `app-engine`,
// and hardcoding the directory name here is exactly the mistake that made the
// first two runs fail with "Could not resolve to a Repository".
const SLUG = process.env.GITHUB_REPOSITORY ?? 'lincolnnunnally/AppEngine';
const ISSUE_TITLE = 'Fleet health: apps are down';
const ISSUE_LABEL = 'fleet-health';

const TIMEOUT_MS = 15_000;
const SLOW_MS = 8_000; // above this an app is degraded, not healthy — cold starts are a real UX failure

const REGISTRY = 'source-of-truth/ecosystem-portfolio-registry.json';

// How to prove each app's DATA layer answers, not just its shell.
//
//   apiPath   — a path that must return non-HTML. Probed in addition to the root.
//   dataless  — true for apps that talk to Supabase directly from the browser and
//               genuinely have no server API of their own. For these the root
//               probe is the whole story, and we say so rather than implying more.
//
// An app missing from this map is reported UNVERIFIED: we check its root and
// state plainly that its data layer was not proven. Add entries as apps land —
// an unverified app is a gap in this monitor, not a passing grade.
// Slugs are the registry's own (source-of-truth/ecosystem-portfolio-registry.json), not guesses.
const API_PROBES = {
  churchconnect: { apiPath: '/api/health' },
  'kindred-connections': { apiPath: '/api/health' },
  'aligned-souls': { apiPath: '/api/health' },
  'laser-engrave-market': { apiPath: '/api/health' },
  'easy-peasy-website': { apiPath: '/api/health' },
  'toner-management': { apiPath: '/api/health' },
  appengine: { apiPath: '/api/health' },
  'live-on-mission': { dataless: true },
  'kids-need-dads': { dataless: true },
  'childfirst-solutions': { dataless: true },
  'spark-of-hope': { dataless: true },
  'united-under-god': { dataless: true },
  'snip-show': { dataless: true },
  dreamstand: { dataless: true },
  sandlot: { dataless: true },
  ideas: { dataless: true },
};

function loadApps() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  return (registry.apps ?? [])
    // `productionUrl` doubles as a status field: unbuilt apps carry a marker such
    // as "approval-gated" rather than a URL. Those are not down, they do not exist
    // yet — probing them would report 12 false outages every 30 minutes.
    .filter((app) => /^https?:\/\/\S+$/.test(app.productionUrl ?? ''))
    .map((app) => ({
      name: app.name,
      slug: app.slug,
      url: app.productionUrl.replace(/\/$/, ''),
    }));
}

async function probe(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'appengine-fleet-health' },
    });
    const body = await response.text();
    return {
      status: response.status,
      ms: Date.now() - started,
      contentType: response.headers.get('content-type') ?? '',
      renderRouting: response.headers.get('x-render-routing') ?? '',
      // Where we actually ended up. A request for /api/health that redirects to /
      // returns a perfectly healthy 200 HTML homepage; without comparing the final
      // URL the probe would call that a pass.
      finalUrl: response.url,
      body: body.slice(0, 200),
    };
  } catch (error) {
    return {
      status: 0,
      ms: Date.now() - started,
      contentType: '',
      renderRouting: '',
      error: error.name === 'AbortError' ? `no response in ${TIMEOUT_MS}ms` : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Apps marked `dataless` have no server of their own — the browser calls the shared
// LPL Supabase directly. Their data layer is therefore one shared dependency, and one
// probe settles it for all of them. An unauthenticated GET returns 401, which is not a
// failure: it proves PostgREST is answering. Only a non-answer means the data layer is
// down. The URL is public by construction (it ships in every frontend bundle), so this
// needs no secret and is safe from a public repo.
const SUPABASE_REST = 'https://uqhqulrqcygsmmzdzemx.supabase.co/rest/v1/';

async function probeSharedData() {
  const result = await probe(SUPABASE_REST);
  return { up: result.status > 0 && result.status < 500, result };
}

function judge(root, api, shared, apiPath) {
  const problems = [];

  // Render suspension — the 2026-07-29 signature. Fast 503 with this header, NOT a slow cold start.
  for (const [layer, result] of [['app', root], ['API', api]]) {
    if (result?.renderRouting === 'suspend') {
      problems.push(`${layer} is served by a SUSPENDED Render service (x-render-routing: suspend). Free-plan services cannot be resumed — this needs the Vercel Python migration.`);
    }
  }

  if (root.status === 0) problems.push(`app did not respond: ${root.error}`);
  else if (root.status >= 500) problems.push(`app root returned ${root.status}`);
  else if (root.status >= 400) problems.push(`app root returned ${root.status}`);

  if (api) {
    const landedElsewhere = api.finalUrl && !api.finalUrl.includes(apiPath);
    if (api.status === 0) {
      problems.push(`API did not respond: ${api.error}`);
    } else if (api.renderRouting === 'suspend') {
      // Already reported above as a suspension; the HTML body is Render's own
      // "Service Suspended" page, so do not also blame the SPA catch-all for it.
    } else if (landedElsewhere) {
      problems.push(`API path redirected to ${api.finalUrl} — the request never reached an API route, it silently became a page`);
    } else if (api.contentType.includes('text/html')) {
      // The trap: 200 OK, but it is the SPA shell. The /api rewrite is not wired
      // and the catch-all is eating API routes. Looks alive, is not.
      problems.push(`API path returned HTML (${api.status}), not data — the /api rewrite is not wired and the SPA catch-all is swallowing it`);
    } else if (api.status >= 400) {
      problems.push(`API returned ${api.status}`);
    }
  }

  // Shared-Supabase apps: their data layer is that one dependency.
  if (shared && !shared.up) {
    problems.push(`the shared LPL Supabase is not answering (${shared.result.status || shared.result.error}) — every browser-direct app is down with it`);
  }

  const slow = [root, api].filter(Boolean).some((r) => r.ms > SLOW_MS && r.status > 0);

  if (problems.length) return { state: 'down', problems, slow };
  if (!api && !shared) return { state: 'unverified', problems: [], slow };
  if (slow) return { state: 'degraded', problems: [`slowest layer took ${Math.max(root.ms, api?.ms ?? 0)}ms — the first visitor each morning waits this long`], slow };
  return { state: 'healthy', problems: [], slow: false };
}

const apps = loadApps();
const shared = await probeSharedData();
const results = [];

for (const app of apps) {
  const config = API_PROBES[app.slug];
  const root = await probe(app.url);
  const api = config && !config.dataless ? await probe(app.url + config.apiPath) : null;
  const verdict = judge(root, api, config?.dataless ? shared : null, config?.apiPath);
  results.push({
    ...app,
    dataless: Boolean(config?.dataless),
    root,
    api,
    ...verdict,
  });
}

const down = results.filter((r) => r.state === 'down');
const degraded = results.filter((r) => r.state === 'degraded');
const unverified = results.filter((r) => r.state === 'unverified');
const healthy = results.filter((r) => r.state === 'healthy');

if (AS_JSON) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
} else {
  console.log(`\nFleet health — ${results.length} apps\n`);
  for (const r of results) {
    const mark = { down: 'DOWN', degraded: 'SLOW', unverified: '  ? ', healthy: ' ok ' }[r.state];
    const layer = r.dataless ? 'root only (browser talks to Supabase directly)'
      : r.api ? `root ${r.root.status} / api ${r.api.status}`
      : 'root only — DATA LAYER NOT VERIFIED';
    console.log(`  [${mark}] ${r.name.padEnd(28)} ${layer}`);
    for (const p of r.problems) console.log(`         ${p}`);
  }
  console.log(`\n  ${healthy.length} healthy · ${degraded.length} degraded · ${down.length} down · ${unverified.length} unverified`);
  if (unverified.length) {
    console.log(`\n  Unverified means this monitor could not prove the data layer answers.`);
    console.log(`  That is a gap in scripts/fleet-health.mjs (API_PROBES), not a pass:`);
    for (const r of unverified) console.log(`    - ${r.name} (${r.slug})`);
  }
}

function body() {
  const lines = [
    `Automated by \`scripts/fleet-health.mjs\`. Last checked **${new Date().toISOString()}**.`,
    '',
    `**${down.length} down** · ${degraded.length} degraded · ${healthy.length} healthy · ${unverified.length} unverified`,
    '',
  ];
  for (const r of [...down, ...degraded]) {
    lines.push(`### ${r.name}`);
    lines.push(`${r.url} — root \`${r.root.status}\`${r.api ? `, API \`${r.api.status}\` (${r.api.contentType.split(';')[0] || 'no content-type'})` : ''}`);
    for (const p of r.problems) lines.push(`- ${p}`);
    lines.push('');
  }
  if (unverified.length) {
    lines.push('---');
    lines.push(`Not proven either way (no API probe configured — add to \`API_PROBES\`): ${unverified.map((r) => r.name).join(', ')}.`);
  }
  lines.push('');
  lines.push('This issue is opened, edited and closed automatically. It does not need triage comments — fix the apps and it closes itself on the next run.');
  return lines.join('\n');
}

function gh(args, input, stderr = 'inherit') {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', stderr],
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN },
  }).trim();
}

if (APPLY) {
  // `gh issue create --label` fails outright if the label does not exist, which
  // would make the very first run on a fresh repo a no-op failure.
  try {
    gh(['label', 'create', ISSUE_LABEL, '--repo', SLUG,
        '--color', 'B60205', '--description', 'Opened automatically by scripts/fleet-health.mjs'],
       undefined, 'ignore');
  } catch {
    // Already exists — the only expected failure. gh writes that notice to
    // stderr, which would otherwise print on all 48 runs a day, so it is
    // suppressed at the call rather than caught after the fact.
  }

  const existing = JSON.parse(
    gh(['issue', 'list', '--repo', SLUG, '--state', 'open',
        '--label', ISSUE_LABEL, '--limit', '1', '--json', 'number']) || '[]',
  );
  const openIssue = existing[0]?.number;

  if (down.length || degraded.length) {
    if (openIssue) {
      gh(['issue', 'edit', String(openIssue), '--repo', SLUG, '--body-file', '-'], body());
      console.log(`\nUpdated issue #${openIssue}`);
    } else {
      const url = gh(['issue', 'create', '--repo', SLUG,
                      '--title', `${ISSUE_TITLE} (${down.length})`,
                      '--label', ISSUE_LABEL, '--body-file', '-'], body());
      console.log(`\nOpened ${url}`);
    }
  } else if (openIssue) {
    gh(['issue', 'close', String(openIssue), '--repo', SLUG,
        '--comment', `Recovered — all ${healthy.length} probed apps are answering as of ${new Date().toISOString()}.`]);
    console.log(`\nClosed issue #${openIssue} — fleet recovered`);
  } else {
    console.log('\nNothing down, nothing open. No action.');
  }
}

// Exit 0 whenever the PROBE itself succeeded, even with apps down.
//
// The tempting alternative — exit 1 while anything is down — turns 48 scheduled
// runs a day red and emails a workflow failure every 30 minutes for as long as
// the outage lasts. That is how a monitor teaches you to ignore it. The rolling
// issue is the signal; the run status answers a different question, "did the
// monitor work", and a genuinely broken monitor throws and exits non-zero on its
// own without any help from here.
//
// Local runs can still branch on fleet state with --json.
process.exit(0);
