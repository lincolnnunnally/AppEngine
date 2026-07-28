#!/usr/bin/env node
// The growth loop's issue-filing half: ask the detection engine what is wrong,
// then turn each new finding into a GitHub issue the agent council can pick up.
//
// This is the arrow that was missing. The council (agents/manifest.yaml) could
// already plan, build, review, fix and monitor — but its only input was Lincoln
// typing an issue. Now the input is measurement.
//
// The RULES are not here. They live in the growth-loop edge function, because
// evaluating them needs the service-role key and this repo is public. This side
// holds only GROWTH_LOOP_SECRET, which opens that one endpoint and nothing else.
//
//   node scripts/growth-loop.mjs              # analyse and print, change nothing
//   node scripts/growth-loop.mjs --apply      # persist findings + file issues
//   node scripts/growth-loop.mjs --apply --no-issues
//
// Governor (this runs unattended, so the limits are part of the design):
//   * a finding is filed at most once — enforced by a unique fingerprint
//   * at most MAX_ISSUES_PER_RUN issues per run, so a bad week cannot spam
//   * APPENGINE_COST_GOVERNANCE_PAUSED=true records findings but files nothing
//   * it files ISSUES. It never edits code, merges, or deploys by itself.

import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const NO_ISSUES = process.argv.includes('--no-issues');
const PAUSED = String(process.env.APPENGINE_COST_GOVERNANCE_PAUSED ?? '').toLowerCase() === 'true';

const MAX_ISSUES_PER_RUN = 5;
const OWNER = 'lincolnnunnally';

const ENDPOINT =
  process.env.GROWTH_LOOP_URL ??
  'https://uqhqulrqcygsmmzdzemx.supabase.co/functions/v1/growth-loop';
const SECRET = process.env.GROWTH_LOOP_SECRET;

if (!SECRET) {
  console.error('GROWTH_LOOP_SECRET is required.');
  process.exit(1);
}

async function call(payload) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-growth-secret': SECRET, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`growth-loop ${response.status}: ${text}`);
  return JSON.parse(text);
}

const { summary, findings } = await call({ mode: APPLY && !NO_ISSUES ? 'run' : 'analyze' });

console.log(`\nFleet: ${summary.apps} active apps`);
console.log(`  measured for a full week: ${summary.measured}`);
console.log(`  with traffic this week:   ${summary.with_traffic}`);
console.log(`\n${APPLY ? 'New findings' : 'Findings'}: ${findings.length}\n`);
for (const f of findings) {
  console.log(`  [${f.severity.padEnd(6)}] ${f.kind.padEnd(15)} ${f.title}`);
}

if (summary.measured === 0) {
  console.log(
    '\n  Nothing is judged yet: no app has 7 full days of telemetry. ' +
      'The loop stays quiet until it has a week to compare.\n',
  );
}

if (!APPLY) {
  console.log('\n(dry run — pass --apply to persist findings and file issues)\n');
  process.exit(0);
}
if (NO_ISSUES || findings.length === 0) process.exit(0);
if (PAUSED) {
  console.log('  cost governance paused — findings recorded, no issues filed\n');
  process.exit(0);
}

let filed = 0;
for (const finding of findings.slice(0, MAX_ISSUES_PER_RUN)) {
  if (!finding.repo) {
    console.error(`  skipped "${finding.title}": no repo recorded for ${finding.app_slug}`);
    continue;
  }

  const body =
    `${finding.body}\n\n---\n` +
    `_Filed automatically by the AppEngine growth loop from live telemetry._\n` +
    `_Finding \`${finding.fingerprint}\` · evidence: \`${JSON.stringify(finding.evidence)}\`_`;

  try {
    const url = execFileSync(
      'gh',
      [
        'issue', 'create',
        '--repo', `${OWNER}/${finding.repo}`,
        '--title', finding.title,
        '--body', body,
        ...finding.labels.flatMap((l) => ['--label', l]),
      ],
      { encoding: 'utf8' },
    ).trim();

    await call({ mode: 'mark_filed', id: finding.id, url });
    console.log(`  filed ${url}`);
    filed += 1;
  } catch (error) {
    // A missing label or repo must not stop the rest of the run. The finding
    // stays 'open', so the next run retries it.
    console.error(`  could not file "${finding.title}": ${String(error.message).split('\n')[0]}`);
  }
}

if (findings.length > MAX_ISSUES_PER_RUN) {
  const held = findings.length - MAX_ISSUES_PER_RUN;
  console.log(`  ${held} finding(s) held back by the per-run cap — they stay open and file next run`);
}
console.log(`\n  ${filed} issue(s) filed\n`);
