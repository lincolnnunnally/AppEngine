#!/usr/bin/env node
// Make sure every app repo carries the ai:* labels the agent council routes on.
//
// The growth loop files issues into each app's own repo, and `gh issue create`
// fails outright if a label does not exist there — so without this the loop
// would detect correctly, record correctly, and then drop every issue at the
// final step.
//
//   node scripts/ensure-ai-labels.mjs            # dry run
//   node scripts/ensure-ai-labels.mjs --apply

import { execFileSync } from 'node:child_process';
import { ECOSYSTEM_APPS } from './lib/ecosystem-apps.mjs';

const APPLY = process.argv.includes('--apply');
const OWNER = 'lincolnnunnally';

// Mirrors agents/manifest.yaml `labels`.
const LABELS = [
  { name: 'ai:plan',    color: '1D76DB', description: 'Run the planner workflow' },
  { name: 'ai:build',   color: '0E8A16', description: 'Run the builder/Codex workflow' },
  { name: 'ai:review',  color: 'FBCA04', description: 'Run the review workflows' },
  { name: 'ai:fix',     color: 'D93F0B', description: 'Run the fixer/repair workflow' },
  { name: 'ai:growth',  color: '5319E7', description: 'Run the discovery/connection/growth workflows' },
  { name: 'ai:monitor', color: 'C5DEF5', description: 'Run the monitor workflow' },
];

// The GitHub repo name differs from the local directory for several apps.
const REPO_OVERRIDES = {
  'toner-management-app': 'TotalTonerManagement',
  swaparound: 'sandlot',
  ideas: 'ideas-app',
  'ChurchConnect/ChurchConnect': 'ChurchConnect',
  'Kindred-Connection/frontend': 'Kindred-Connection',
  'aligned-souls/frontend': 'aligned-souls',
  'app-engine/production-app': 'AppEngine',
};

const repos = [...new Set(
  ECOSYSTEM_APPS.map((a) => REPO_OVERRIDES[a.dir] ?? a.dir.split('/').pop()),
)];

let created = 0;
let existing = 0;
const missing = [];

for (const repo of repos) {
  let have;
  try {
    have = new Set(
      execFileSync('gh', ['label', 'list', '--repo', `${OWNER}/${repo}`, '--limit', '200', '--json', 'name'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .trim()
        .split('\n')
        .filter(Boolean)
        .flatMap((line) => JSON.parse(line))
        .map((l) => l.name),
    );
  } catch {
    missing.push(repo);
    continue;
  }

  const need = LABELS.filter((l) => !have.has(l.name));
  existing += LABELS.length - need.length;

  for (const label of need) {
    if (!APPLY) { created += 1; continue; }
    try {
      execFileSync(
        'gh',
        ['label', 'create', label.name, '--repo', `${OWNER}/${repo}`,
         '--color', label.color, '--description', label.description],
        { stdio: 'ignore' },
      );
      created += 1;
    } catch (error) {
      console.error(`  ${repo}: could not create ${label.name}`);
    }
  }
  console.log(`  ${repo.padEnd(26)} ${need.length === 0 ? 'already complete' : `${APPLY ? 'created' : 'would create'} ${need.length}`}`);
}

if (missing.length > 0) {
  console.log(`\n  unreachable repos (skipped): ${missing.join(', ')}`);
}
console.log(`\n  ${APPLY ? 'created' : 'would create'}: ${created}   already present: ${existing}\n`);
