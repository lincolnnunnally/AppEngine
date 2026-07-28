// ecosystem-telemetry — the single ingest point for every LPL app's product events.
//
// Why one shared function: apps never hold a service-role key, CORS and validation
// live in one reviewable place, and the schema can evolve without redeploying 21 apps.
//
// verify_jwt is intentionally OFF. This is a public first-party analytics beacon that
// fires before a visitor has any session. It is not unauthenticated, though — every
// request must name a registered, active app AND arrive from an origin that app owns.
// Anything else is rejected. No raw IP or user-agent string is ever persisted.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_EVENTS_PER_REQUEST = 20;
const MAX_PROPS_BYTES = 4096;
const EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const REGISTRY_TTL_MS = 5 * 60 * 1000;

type AppRow = { app_slug: string; is_active: boolean; allowed_origins: string[] };

let registryCache: { at: number; rows: Map<string, AppRow> } | null = null;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getRegistry(): Promise<Map<string, AppRow>> {
  if (registryCache && Date.now() - registryCache.at < REGISTRY_TTL_MS) {
    return registryCache.rows;
  }
  const { data, error } = await admin
    .from('lpl_app_registry')
    .select('app_slug, is_active, allowed_origins');
  if (error) throw error;

  const rows = new Map<string, AppRow>();
  for (const r of data ?? []) rows.set(r.app_slug, r as AppRow);
  registryCache = { at: Date.now(), rows };
  return rows;
}

/**
 * An origin is trusted if the app declared it, or if it is a Vercel preview /
 * localhost dev origin. Preview origins are allowed so a change can be verified
 * on a preview deploy before it reaches production.
 */
function originAllowed(origin: string | null, app: AppRow): boolean {
  if (!origin) return false;
  if (app.allowed_origins?.includes(origin)) return true;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return host.endsWith('.vercel.app');
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Coarse form factor only. The full UA string is deliberately discarded. */
function deviceFrom(ua: string | null): string {
  if (!ua) return 'unknown';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function clampJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const encoded = JSON.stringify(value);
  if (encoded.length > MAX_PROPS_BYTES) return { _truncated: true };
  return value as Record<string, unknown>;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value.slice(0, max);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: cors });
  }

  let body: { app?: string; events?: unknown[] };
  try {
    // sendBeacon posts text/plain, so parse the raw text rather than trusting the header.
    body = JSON.parse(await req.text());
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const appSlug = str(body.app, 64);
  if (!appSlug) {
    return new Response(JSON.stringify({ error: 'missing app' }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  let registry: Map<string, AppRow>;
  try {
    registry = await getRegistry();
  } catch {
    return new Response(JSON.stringify({ error: 'registry unavailable' }), {
      status: 503,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const app = registry.get(appSlug);
  if (!app || !app.is_active) {
    return new Response(JSON.stringify({ error: 'unknown app' }), {
      status: 403,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }
  if (!originAllowed(origin, app)) {
    return new Response(JSON.stringify({ error: 'origin not allowed' }), {
      status: 403,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const incoming = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_REQUEST) : [];
  if (incoming.length === 0) return new Response(null, { status: 204, headers: cors });

  // Geo comes from the edge headers. The IP itself is never read or stored.
  const country =
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    null;
  const device = deviceFrom(req.headers.get('user-agent'));

  const rows = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const name = str(e.name, 64);
    if (!name || !EVENT_NAME_RE.test(name)) continue;

    rows.push({
      app_slug: appSlug,
      event_name: name,
      anon_id: str(e.anon_id, 64),
      session_id: str(e.session_id, 64),
      user_id: str(e.user_id, 128),
      path: str(e.path, 512),
      referrer: str(e.referrer, 512),
      utm: clampJson(e.utm),
      props: clampJson(e.props),
      country,
      device,
    });
  }

  if (rows.length === 0) return new Response(null, { status: 204, headers: cors });

  const { error } = await admin.from('lpl_events').insert(rows);
  if (error) {
    console.error('telemetry insert failed', { appSlug, count: rows.length, error: error.message });
    return new Response(JSON.stringify({ error: 'insert failed' }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  return new Response(null, { status: 204, headers: cors });
});
