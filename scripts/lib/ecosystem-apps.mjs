// The one list of live ecosystem apps that the growth tooling works from.
//
// Mirrors the `lpl_app_registry` table in the LPL Supabase project — the DB copy
// is what the ingest function and growth loop read at runtime; this copy is what
// the local retrofit/codegen scripts read. Keep them in step: `npm run growth:check`
// fails the build if a slug or production URL drifts apart.
//
//   slug     — matches lpl_app_registry.app_slug
//   dir      — repo path relative to the workspace root (Project_Code/)
//   kind     — 'next' (App Router) | 'spa' (Vite / CRA)
//   base     — where app code lives: 'src' or '.'
//   entry    — file to inject the SPA start call into (spa only)
//   lang     — 'js' for plain-JavaScript repos that cannot accept a .ts file
//   url      — production URL, used as the sitemap/OG base

export const ECOSYSTEM_APPS = [
  // --- Next.js App Router, code under src/ ---
  { slug: 'furfriend',            dir: 'furfriend',                 kind: 'next', base: 'src', url: 'https://furfriend.pet' },
  { slug: 'childfirst',           dir: 'childfirst-solutions',      kind: 'next', base: 'src', url: 'https://childfirst.unitedundergod.org' },
  { slug: 'dreamstand',           dir: 'dreamstand',                kind: 'next', base: 'src', url: 'https://dreamstand.unitedundergod.org' },
  { slug: 'liveonmission',        dir: 'live-on-mission',           kind: 'next', base: 'src', url: 'https://live-on-mission.com' },
  { slug: 'ideas',                dir: 'ideas',                     kind: 'next', base: 'src', url: 'https://ideas.unitedundergod.org' },
  { slug: 'aiwebsite',            dir: 'ai-website-design',         kind: 'next', base: 'src', url: 'https://ai-website.design' },
  { slug: 'sandlot',              dir: 'swaparound',                kind: 'next', base: 'src', url: 'https://sandlot.unitedundergod.org' },
  { slug: 'immerse',              dir: 'immerse',                   kind: 'next', base: 'src', url: 'https://immerse-coral.vercel.app' },
  { slug: 'bestlife',             dir: 'best-life',                 kind: 'next', base: 'src', url: 'https://bestlife.unitedundergod.org' },
  { slug: 'communityconnections', dir: 'community-connections',     kind: 'next', base: 'src', url: 'https://community-connections.vercel.app' },
  { slug: 'appengine',            dir: 'app-engine/production-app', kind: 'next', base: 'src', url: 'https://appengine.unitedundergod.org', internal: true },

  // --- Next.js App Router, code at repo root ---
  { slug: 'presence',             dir: 'presence-moments',          kind: 'next', base: '.',   url: 'https://presence-moments.vercel.app' },
  { slug: 'speaktome',            dir: 'speak-to-me',               kind: 'next', base: '.',   url: 'https://speak-to-me-theta.vercel.app' },

  // --- Vite SPAs ---
  { slug: 'toner',                dir: 'toner-management-app',      kind: 'spa', base: 'src', entry: 'src/main.tsx', url: 'https://toner.management' },
  { slug: 'laser',                dir: 'LaserEngraving',            kind: 'spa', base: 'src', entry: 'src/main.tsx', url: 'https://laser.unitedundergod.org' },
  { slug: 'knd',                  dir: 'RebuildingDads',            kind: 'spa', base: 'src', entry: 'src/main.tsx', url: 'https://kidsneeddad.com' },
  { slug: 'churchconnect',        dir: 'ChurchConnect/ChurchConnect', kind: 'spa', base: 'src', entry: 'src/main.tsx', url: 'https://churchconnect.cloud' },

  // --- Create React App SPAs (plain JavaScript) ---
  { slug: 'kindred',              dir: 'Kindred-Connection/frontend', kind: 'spa', base: 'src', entry: 'src/index.js', lang: 'js', url: 'https://kindred.unitedundergod.org' },
  { slug: 'alignedsouls',         dir: 'aligned-souls/frontend',      kind: 'spa', base: 'src', entry: 'src/index.js', lang: 'js', url: 'https://alignedsouls.unitedundergod.org' },
];

// Route prefixes that must never appear in a sitemap and should be disallowed in
// robots.txt: they are either private, per-user, or not real pages.
export const PRIVATE_ROUTE_PREFIXES = [
  'api', 'admin', 'dashboard', 'account', 'settings', 'profile', 'owner',
  'auth', 'signin', 'sign-in', 'signup', 'sign-up', 'login', 'logout',
  'onboarding', 'checkout', 'billing', 'invite', 'reset-password', 'verify',
];

// Segments that make a page personal wherever they appear, not just at the root:
// /sit/bookings and /orders/messages are as private as /account is.
export const PRIVATE_ROUTE_SEGMENTS = [
  'bookings', 'messages', 'inbox', 'notifications', 'my', 'me', 'edit', 'manage',
];

export function isPrivateRoute(route) {
  const segments = route.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (PRIVATE_ROUTE_PREFIXES.includes(segments[0])) return true;
  return segments.some((s) => PRIVATE_ROUTE_SEGMENTS.includes(s));
}
