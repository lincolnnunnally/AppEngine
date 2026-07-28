#!/usr/bin/env node
// Register an app in lpl_app_registry so the shared ingest accepts its events.
//
// The ingest rejects any app it does not know — that gate is what stops one
// origin writing into another app's funnel — so a newly generated app reports
// nothing until this runs.
//
//   node scripts/register-app-telemetry.mjs <slug> <prod-url> [options]
//     --name "Display Name"
//     --activation pet_profile_created   # the app's "first real action" event
//     --commercial                       # app is expected to earn money
//     --origin https://extra.example.com # repeatable, adds allowed origins
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.

const args = process.argv.slice(2);
const [slug, prodUrl] = args.filter((a) => !a.startsWith('--'));

function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
}
function flagAll(name) {
  const out = [];
  args.forEach((a, i) => { if (a === `--${name}` && args[i + 1]) out.push(args[i + 1]); });
  return out;
}

if (!slug || !prodUrl) {
  console.error('usage: register-app-telemetry.mjs <slug> <prod-url> [--name X] [--activation event] [--commercial]');
  process.exit(1);
}
if (!/^[a-z][a-z0-9]{1,63}$/.test(slug)) {
  console.error(`slug must be lowercase alphanumeric: got "${slug}"`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const url = new URL(prodUrl);
// www and apex are the same site to a visitor but different Origins to a browser.
const origins = new Set([
  url.origin,
  url.hostname.startsWith('www.')
    ? `${url.protocol}//${url.hostname.slice(4)}`
    : `${url.protocol}//www.${url.hostname}`,
  ...flagAll('origin'),
]);

const row = {
  app_slug: slug,
  display_name: flag('name') ?? slug,
  prod_url: url.origin,
  activation_event: flag('activation'),
  is_commercial: args.includes('--commercial'),
  is_active: true,
  allowed_origins: [...origins],
};

const response = await fetch(`${SUPABASE_URL}/rest/v1/lpl_app_registry?on_conflict=app_slug`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'content-type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify(row),
});

if (!response.ok) {
  console.error(`registration failed (${response.status}): ${await response.text()}`);
  process.exit(1);
}

const [saved] = await response.json();
console.log(`registered "${saved.app_slug}" → ${saved.prod_url}`);
console.log(`  origins:    ${saved.allowed_origins.join(', ')}`);
console.log(`  activation: ${saved.activation_event ?? '(not set — the growth loop cannot measure activation yet)'}`);
