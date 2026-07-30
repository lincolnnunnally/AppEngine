#!/usr/bin/env node
// Durable QA accounts: one stable, reusable sign-in per app.
//
// Why this exists (fleet audit, 2026-07-30): almost no signed-in flow anywhere
// in the ecosystem has ever been verified in production. Every audit stops at
// the login wall — Presence, Speak To Me, Immerse, Ideas, Best Life, ChildFirst,
// Toner, Kindred, Aligned Souls — so the actual PRODUCT of each app is unproven.
// That is the single biggest thing blocking automated verification.
//
// The old habit made it worse rather than better. Sessions minted throwaway
// accounts named claude-qa-<date>-<purpose>@example.com and abandoned them:
// 36 of the 92 accounts in the shared pool were QA junk from ONE day. That is
// why the portal's "57 users / 23 churches" means nothing, and why a later
// session had to purge 268 fake rows by hand.
//
// So: durable, not disposable. One account per app, stable credentials, one
// unforgeable exclusion predicate.
//
//   node scripts/qa-accounts.mjs                # show what exists, change nothing
//   node scripts/qa-accounts.mjs --apply        # create/repair the missing ones
//   node scripts/qa-accounts.mjs --verify       # prove each one can actually sign in
//   node scripts/qa-accounts.mjs --list-stale   # find abandoned throwaway accounts
//
// ── THE EXCLUSION PREDICATE ───────────────────────────────────────────────────
// Every QA account's email ends in `@appengine.test`. Any analytics, count or
// dashboard MUST exclude them with:
//
//     WHERE email NOT LIKE '%@appengine.test'
//
// App tables key on a user id rather than an email, so there the predicate is:
//
//     WHERE owner NOT IN (SELECT id FROM auth.users WHERE email LIKE '%@appengine.test')
//
// (substituting the table's own owner/user column).
//
// The email domain is the authority, deliberately NOT user_metadata: a signed-in
// user can rewrite their own metadata, so a real user could hide themselves from
// analytics by setting a flag. Changing an email requires confirmation. The
// metadata flag is still written, but only as a convenience for reading — never
// trust it for exclusion, and never for privilege (see the shared-GoTrue rule:
// admin rights come from a per-app {prefix}_admin_users table, never metadata).
//
// `.test` is an IANA-reserved TLD, so these addresses can never route mail or
// collide with a real domain someone later buys.
//
// SECRETS: this repo is PUBLIC. The shared password lives only in
// ~/Documents/Codex/private-env/appengine.shared.env as APPENGINE_QA_PASSWORD,
// is generated on first --apply if absent, and is never printed in full or
// committed. Do not run this in CI.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');
const LIST_STALE = process.argv.includes('--list-stale');

const ENV_FILE = join(homedir(), 'Documents/Codex/private-env/appengine.shared.env');
const REGISTRY = 'source-of-truth/ecosystem-portfolio-registry.json';

const QA_DOMAIN = 'appengine.test';
const PW_KEY = 'APPENGINE_QA_PASSWORD';

// ChurchConnect is excluded on purpose: it does not use the shared GoTrue pool
// (its auth is a custom Mongo-era JWT), so an account minted here would not log
// into it. Its own session owns that work.
const SKIP = new Set(['churchconnect', 'churchconnect-bridge']);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(`Missing Supabase env. Run:\n  set -a; source ${ENV_FILE}; set +a`);
  process.exit(1);
}

function readEnvFile() {
  return existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
}

// The shared password: generated once, then reused forever so any future session
// can sign in to any app by sourcing the env file. Regenerating it would orphan
// every existing account, so this only ever writes when the key is absent.
function ensurePassword() {
  const fromEnv = process.env[PW_KEY];
  if (fromEnv) return { password: fromEnv, created: false };

  const contents = readEnvFile();
  const match = contents.match(new RegExp(`^${PW_KEY}=(.*)$`, 'm'));
  if (match?.[1]) return { password: match[1], created: false };

  if (!APPLY) return { password: null, created: false };

  const password = `qa-${Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString('base64url')}`;
  const line = `\n# Shared password for durable QA accounts (scripts/qa-accounts.mjs).\n# One password, N accounts, all reproducible. Rotating it orphans every account.\n${PW_KEY}=${password}\n`;
  writeFileSync(ENV_FILE, contents + line);
  return { password, created: true };
}

function loadApps() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  return (registry.apps ?? [])
    .filter((a) => /^https?:\/\/\S+$/.test(a.productionUrl ?? ''))
    .filter((a) => !SKIP.has(a.slug))
    .map((a) => ({ name: a.name, slug: a.slug, url: a.productionUrl.replace(/\/$/, '') }));
}

const emailFor = (slug) => `qa.${slug}@${QA_DOMAIN}`;

async function admin(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: response.ok, status: response.status, body };
}

async function listUsers() {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { body } = await admin(`admin/users?per_page=200&page=${page}`);
    const batch = body.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: Boolean(body.access_token), status: response.status, error: body.error_description ?? body.msg };
}

const apps = loadApps();
const existing = await listUsers();
const byEmail = new Map(existing.map((u) => [(u.email ?? '').toLowerCase(), u]));

if (LIST_STALE) {
  // Throwaway accounts from the old per-session habit. Reported, never deleted
  // here — deletion is destructive, may cascade into app tables, and is a
  // deliberate decision rather than a side effect of running a report.
  const stale = existing.filter((u) => {
    const email = (u.email ?? '').toLowerCase();
    return /^(claude-qa|claude-verify)-/.test(email) || email.endsWith('@example.com');
  });
  console.log(`\n${stale.length} abandoned throwaway account(s) of ${existing.length} total:\n`);
  for (const u of stale) console.log(`  ${u.email.padEnd(52)} created ${u.created_at?.slice(0, 10)}`);
  console.log(`\nThese inflate every user count in the ecosystem. Deleting them is a separate,`);
  console.log(`deliberate step — check for dependent app rows first.`);
  process.exit(0);
}

const { password, created: passwordCreated } = ensurePassword();
if (passwordCreated) console.log(`Generated ${PW_KEY} and stored it in ${ENV_FILE}`);
if (!password) {
  console.log(`\nNo ${PW_KEY} yet. Re-run with --apply to generate one and provision accounts.`);
  process.exit(0);
}

console.log(`\nDurable QA accounts — ${apps.length} apps\n`);
const results = [];

for (const app of apps) {
  const email = emailFor(app.slug);
  const found = byEmail.get(email);
  let state = found ? 'exists' : 'missing';

  if (!found && APPLY) {
    const { ok, body } = await admin('admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { appengine_qa: true, app: app.slug },
      }),
    });
    state = ok ? 'created' : `failed (${body.msg ?? body.error_description ?? 'unknown'})`;
  } else if (found && APPLY) {
    // Repair drift: an account created with a different password, or left
    // unconfirmed, cannot sign in — which silently defeats the whole point.
    const { ok } = await admin(`admin/users/${found.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    state = ok ? 'repaired' : 'exists (repair failed)';
  }

  let signin = '';
  if (VERIFY) {
    const result = await signIn(email, password);
    signin = result.ok ? '  signin OK' : `  SIGNIN FAILED ${result.status} ${result.error ?? ''}`;
  }

  results.push({ app: app.name, email, state, signin });
  console.log(`  [${state.padEnd(8)}] ${email.padEnd(40)} ${app.name}${signin}`);
}

const failed = results.filter((r) => r.state.startsWith('failed') || r.signin.includes('FAILED'));
console.log(`\n  ${results.length} apps · ${results.filter((r) => r.signin.includes('OK')).length} verified sign-in · ${failed.length} failed`);

if (!APPLY && !VERIFY) console.log(`\n  Nothing changed. Re-run with --apply to provision, --verify to prove sign-in.`);
console.log(`\n  Exclude from ALL analytics with:  email NOT LIKE '%@${QA_DOMAIN}'`);
console.log(`  Password lives in ${ENV_FILE} as ${PW_KEY}.\n`);

process.exit(failed.length ? 1 : 0);
