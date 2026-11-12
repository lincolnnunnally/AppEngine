#!/usr/bin/env node
// Put the shared agent rules at the top of a repo's CLAUDE.md and AGENTS.md.
//
// Why: THE ONE RULE and the anti-drift rules lived in docs (CURRENT_SCOPE, the
// module catalog, the playbook) that an agent only sees if it chooses to open
// them. A cold session never did. The files agents load automatically are
// CLAUDE.md (Claude Code) and AGENTS.md (Codex, Cursor, Copilot, Gemini CLI and
// most others), so the rules go in both, between markers, from one source:
// source-of-truth/shared-agent-rules.md.
//
//   node scripts/sync-agent-rules.mjs [repoDir]          # write/refresh the block
//   node scripts/sync-agent-rules.mjs [repoDir] --check  # exit 1 if missing or stale
//
// repoDir defaults to this repo. AGENTS.md is created if missing; CLAUDE.md too.
// Everything outside the markers is left exactly as it was.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'source-of-truth', 'shared-agent-rules.md');
const START = '<!-- LPL-SHARED-AGENT-RULES:START -->';
const END = '<!-- LPL-SHARED-AGENT-RULES:END -->';
const FILES = ['CLAUDE.md', 'AGENTS.md'];

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const repoDir = resolve(args.find((a) => !a.startsWith('--')) ?? join(here, '..'));

const rules = readFileSync(SOURCE, 'utf8').trim();
const block = `${START}\n${rules}\n${END}`;

function withBlock(text) {
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s !== -1 && e > s) {
    return text.slice(0, s) + block + text.slice(e + END.length);
  }
  // Insert right after the first H1 if the file opens with one, else at the very top.
  const lines = text.split('\n');
  if (lines[0]?.startsWith('# ')) {
    const rest = lines.slice(1).join('\n').replace(/^\n+/, '');
    return `${lines[0]}\n\n${block}\n\n${rest}`;
  }
  return text.trim() ? `${block}\n\n${text}` : `${block}\n`;
}

let stale = [];
for (const name of FILES) {
  const path = join(repoDir, name);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const after = withBlock(before);
  if (after === before) continue;
  if (CHECK) {
    stale.push(name);
  } else {
    writeFileSync(path, after);
    console.log(`${before ? 'updated' : 'created'} ${path}`);
  }
}

if (CHECK) {
  if (stale.length) {
    console.error(`Shared agent rules missing or out of date in: ${stale.join(', ')} (${repoDir})`);
    console.error('Fix: npm run agent-rules:sync');
    process.exit(1);
  }
  console.log(`Shared agent rules present and current in ${repoDir}`);
}
