#!/usr/bin/env node
// Retrofit the shared LPL telemetry client into the apps that already exist.
//
// New apps get telemetry from the growth-telemetry factory module. The 21 apps
// built before that module existed need it copied in, which is what this does.
//
//   node scripts/retrofit-telemetry.mjs                 # dry run, prints a plan
//   node scripts/retrofit-telemetry.mjs --apply         # write the files
//   node scripts/retrofit-telemetry.mjs --apply --only furfriend,toner
//
// Idempotent: an app that already has the client is reported as "ok" and skipped,
// so this is safe to re-run after adding a new app to the ecosystem.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = resolve(HERE, '../shared-client/lpl-telemetry');
// Every ecosystem repo is a sibling of app-engine under Project_Code.
const WORKSPACE = resolve(HERE, '../../..');

// Kindred and Aligned Souls are plain-JavaScript CRA apps with no TypeScript
// dependency and no tsconfig — dropping a .ts file into them breaks the build.
// Transpile the canonical source for those rather than keeping a second copy
// by hand, so there is still only one place a bug can live.
const ts = createRequire(import.meta.url)('typescript');

function toJs(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      removeComments: false,
    },
  }).outputText;
}

/**
 * dir      — repo path relative to the workspace root
 * kind     — 'next' (App Router), 'spa' (Vite / CRA)
 * base     — where app code lives: 'src' or '.' (next only)
 * entry    — the file to inject the start call into (spa only)
 */
const APPS = [
  // --- Next.js App Router, code under src/ ---
  { slug: 'furfriend',            dir: 'furfriend',              kind: 'next', base: 'src' },
  { slug: 'childfirst',           dir: 'childfirst-solutions',   kind: 'next', base: 'src' },
  { slug: 'dreamstand',           dir: 'dreamstand',             kind: 'next', base: 'src' },
  { slug: 'liveonmission',        dir: 'live-on-mission',        kind: 'next', base: 'src' },
  { slug: 'ideas',                dir: 'ideas',                  kind: 'next', base: 'src' },
  { slug: 'aiwebsite',            dir: 'ai-website-design',      kind: 'next', base: 'src' },
  { slug: 'sandlot',              dir: 'swaparound',             kind: 'next', base: 'src' },
  { slug: 'immerse',              dir: 'immerse',                kind: 'next', base: 'src' },
  { slug: 'bestlife',             dir: 'best-life',              kind: 'next', base: 'src' },
  { slug: 'communityconnections', dir: 'community-connections',  kind: 'next', base: 'src' },
  { slug: 'appengine',            dir: 'app-engine/production-app', kind: 'next', base: 'src' },

  // --- Next.js App Router, code at repo root ---
  { slug: 'presence',             dir: 'presence-moments',       kind: 'next', base: '.' },
  { slug: 'speaktome',            dir: 'speak-to-me',            kind: 'next', base: '.' },

  // --- Vite SPAs ---
  { slug: 'toner',                dir: 'toner-management-app',   kind: 'spa', base: 'src', entry: 'src/main.tsx' },
  { slug: 'laser',                dir: 'LaserEngraving',         kind: 'spa', base: 'src', entry: 'src/main.tsx' },
  { slug: 'knd',                  dir: 'RebuildingDads',         kind: 'spa', base: 'src', entry: 'src/main.tsx' },
  { slug: 'churchconnect',        dir: 'ChurchConnect/ChurchConnect', kind: 'spa', base: 'src', entry: 'src/main.tsx' },

  // --- Create React App SPAs (plain JavaScript — see toJs above) ---
  { slug: 'kindred',              dir: 'Kindred-Connection/frontend', kind: 'spa', base: 'src', entry: 'src/index.js', lang: 'js' },
  { slug: 'alignedsouls',         dir: 'aligned-souls/frontend',      kind: 'spa', base: 'src', entry: 'src/index.js', lang: 'js' },
];

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const onlyArg = args.find((a) => a.startsWith('--only'));
const ONLY = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const source = {
  core: readFileSync(join(CLIENT_DIR, 'telemetry.ts'), 'utf8'),
  next: readFileSync(join(CLIENT_DIR, 'TelemetryProvider.tsx'), 'utf8'),
  spa: readFileSync(join(CLIENT_DIR, 'telemetry-spa.ts'), 'utf8'),
};

const results = [];
function record(slug, status, detail) {
  results.push({ slug, status, detail });
}

function write(path, content) {
  if (!APPLY) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

/** Insert an import after the last existing import line, keeping the file valid. */
function addImport(text, importLine) {
  if (text.includes(importLine)) return text;
  const lines = text.split('\n');
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i]) || /^\s*const\s+.*=\s*require\(/.test(lines[i])) last = i;
  }
  if (last === -1) return `${importLine}\n${text}`;
  lines.splice(last + 1, 0, importLine);
  return lines.join('\n');
}

/**
 * Put the element on its own line just inside </body>, matching the surrounding
 * indentation. Layouts in this ecosystem come in both shapes — a one-line
 * `<body>{children}</body>` and a multi-line body — so handle each separately
 * rather than producing a mangled hybrid.
 */
function insertBeforeBodyClose(text, element) {
  const oneLine = text.match(/^(\s*)<body([^>]*)>(.*)<\/body>\s*$/m);
  if (oneLine) {
    const [full, indent, attrs, inner] = oneLine;
    return text.replace(
      full,
      `${indent}<body${attrs}>\n${indent}  ${inner.trim()}\n${indent}  ${element}\n${indent}</body>`,
    );
  }

  const closing = text.match(/^(\s*)<\/body>/m);
  const indent = closing ? closing[1] : '      ';
  return text.replace(/^(\s*)<\/body>/m, `${indent}  ${element}\n${indent}</body>`);
}

function retrofitNext(app, root) {
  const libDir = app.base === '.' ? join(root, 'lib') : join(root, app.base, 'lib');
  const layoutPath = app.base === '.'
    ? join(root, 'app/layout.tsx')
    : join(root, app.base, 'app/layout.tsx');

  if (!existsSync(layoutPath)) {
    record(app.slug, 'skip', `no root layout at ${layoutPath.replace(WORKSPACE + '/', '')}`);
    return;
  }

  write(join(libDir, 'telemetry.ts'), source.core);
  write(join(libDir, 'TelemetryProvider.tsx'), source.next);

  const layout = readFileSync(layoutPath, 'utf8');
  if (layout.includes('<Telemetry')) {
    record(app.slug, 'ok', 'already wired');
    return;
  }
  if (!layout.includes('</body>')) {
    record(app.slug, 'manual', 'layout has no </body> — wire <Telemetry /> by hand');
    return;
  }

  let next = addImport(layout, `import { Telemetry } from '../lib/TelemetryProvider';`);
  next = insertBeforeBodyClose(next, `<Telemetry app="${app.slug}" />`);
  write(layoutPath, next);
  record(app.slug, 'wired', `${app.base === '.' ? 'app' : app.base + '/app'}/layout.tsx + lib/`);
}

function retrofitSpa(app, root) {
  const libDir = join(root, app.base, 'lib');
  const entryPath = join(root, app.entry);

  if (!existsSync(entryPath)) {
    record(app.slug, 'skip', `no entry at ${app.entry}`);
    return;
  }

  const ext = app.lang === 'js' ? 'js' : 'ts';
  const emit = app.lang === 'js' ? toJs : (text) => text;
  write(join(libDir, `telemetry.${ext}`), emit(source.core));
  write(join(libDir, `telemetry-spa.${ext}`), emit(source.spa));

  const entry = readFileSync(entryPath, 'utf8');
  if (entry.includes('startTelemetry')) {
    record(app.slug, 'ok', 'already wired');
    return;
  }

  let next = addImport(entry, `import { startTelemetry } from './lib/telemetry-spa';`);
  next = `${next.trimEnd()}\n\nstartTelemetry('${app.slug}');\n`;
  write(entryPath, next);
  record(app.slug, 'wired', app.entry);
}

for (const app of APPS) {
  if (ONLY && !ONLY.includes(app.slug)) continue;
  const root = join(WORKSPACE, app.dir);
  if (!existsSync(root)) {
    record(app.slug, 'skip', `repo not checked out at ${app.dir}`);
    continue;
  }
  try {
    if (app.kind === 'next') retrofitNext(app, root);
    else retrofitSpa(app, root);
  } catch (error) {
    record(app.slug, 'error', error.message);
  }
}

const ICON = { wired: '+', ok: '=', skip: '-', manual: '!', error: 'x' };
console.log(APPLY ? '\nRetrofit applied:\n' : '\nDry run (pass --apply to write):\n');
for (const r of results) {
  console.log(`  ${ICON[r.status] ?? '?'} ${r.slug.padEnd(22)} ${r.status.padEnd(7)} ${r.detail}`);
}

const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
console.log(`\n  ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('   ')}\n`);

if (counts.error) process.exitCode = 1;
