# ecosystem-telemetry (shared edge function)

Single ingest point for product events from every LPL app. Deployed once to the
Life Produces Life Supabase project; all 21 apps POST to it.

    POST https://uqhqulrqcygsmmzdzemx.supabase.co/functions/v1/ecosystem-telemetry

```json
{ "app": "furfriend",
  "events": [{ "name": "page_view", "anon_id": "…", "session_id": "…",
               "path": "/sit", "referrer": "", "utm": {}, "props": {} }] }
```

## Why it is safe without a JWT

A page-view beacon fires before any session exists, so `verify_jwt` is off. Access is
gated instead by two checks the function performs itself:

1. `app` must be a row in `lpl_app_registry` with `is_active = true`.
2. `Origin` must be one the app declared in `allowed_origins` — plus `*.vercel.app`
   and localhost, so changes can be verified on a preview deploy first.

Payloads are capped (20 events/request, 4KB props). Raw IP and the full user-agent
string are never persisted — only a country code and a coarse device class.

## Canonical funnel events

`page_view` → `signup_started` → `signup_completed` → `activated` → `payment_completed`

`activated` is per-app; the meaning is stored in `lpl_app_registry.activation_event`.
Any other `[a-z][a-z0-9_]*` event name is accepted as a custom event.

## Redeploy

Source of truth is this folder. Deploy via the Supabase MCP `deploy_edge_function`
(or `supabase functions deploy ecosystem-telemetry --no-verify-jwt`).
