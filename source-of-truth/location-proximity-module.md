# Location & Proximity Module

Owner: Lincoln · Status: BUILT (staged — schema not yet applied) · 2026-07-03

The only fully-missing block found when the module catalog was mapped against
upcoming app needs. One shared geo layer so every app can answer "what is near
me": ChurchConnect (church fit / churches near me), Live On Mission (where to
serve), Milstead.us community connection (what's happening in my community,
where to meet), group meetups (support groups, book clubs, local service),
LaserEngraving (nearest maker), and the dating app (distance-based matching).

Owner directive (2026-07-03): "most of our apps have some sort of location and
distance and connection component … we need to make sure we have all of our
modules completely built so that we can pull our apps together with full
functionality."

## What exists (mined, not invented)

- **ChurchConnect** `backend/utils/geo.py` — the strongest prior implementation:
  geocode-on-save via Nominatim (1 req/sec pacing), cached lat/lng, haversine
  radius filtering. This module ports that behavior onto indexed PostGIS.
- **Kindred Connections** `frontend/src/pages/Settings.js` — the consent UX
  standard: explicit device-geolocation opt-in button and a first-class
  "clear my location" that genuinely nulls coordinates.
- **LaserEngraving** — address strings only, plus a hardcoded 15-mile maker
  radius that becomes a real radius query.

## Pieces

| Piece | Where |
|---|---|
| Schema + RPCs (source of truth) | `db/location-proximity-schema.sql` |
| TS client (fetch-based, no SDK dep) | `src/lib/geo/location-proximity.ts` |
| Catalog entry | `src/lib/engine/module-catalog.ts` → `location-proximity` |
| Structural smoke | `scripts/smoke-location-proximity.js` |

One table (`geo_places`) keyed by `(app_slug, subject_type, subject_id)` with
raw address fields, a geocode cache, an exact point, a **pre-fuzzed point**,
and a visibility tier. RPCs: `geo_upsert_place`, `geo_search`, `geo_near_me`,
`geo_distance_between` (band only), `geo_clear_place`. A `geo_zip_centroids`
lookup lets zip-only signups participate at city precision.

## Privacy doctrine (non-negotiable)

1. **Exact location is radioactive for person rows.** Only churches, venues,
   and public events may be `visibility='exact'`. People default to
   `neighborhood`; dating consumers only ever see distance **bands**
   ("5-10 mi"), never numbers — precise repeated distances enable
   trilateration (the classic dating-app attack).
2. **Fuzz at write time, deterministically.** `fuzzed_location` is computed by
   trigger with a per-row seeded offset (500–1500 m neighborhood, 2–5 km
   city). Re-randomizing per read would let an attacker average reads back to
   the true point. All cross-user search runs against the fuzzed column.
3. **RLS default-deny; service-role-only RPCs (v1).** No direct table access
   for anon/authenticated, and the entire RPC surface is service-role-only:
   `app_slug` is caller-supplied, so granting `geo_search` to signed-in users
   would let any user of any app on the shared database enumerate another
   app's fuzzed person rows. Each app's backend calls the RPCs with the
   service key and enforces its own authorization. (Client-side search can
   open later behind a JWT-claim → app_slug policy; never re-grant without
   that check.) None of the RPCs return coordinates.
4. **Consent + reversibility.** Device coordinates only via explicit opt-in
   (Kindred pattern); `geo_clear_place` genuinely nulls them. Don't demand a
   street address where a zip suffices.

**Residual risk, stated honestly:** because `ST_DWithin` is precise, an
attacker who can issue many searches could binary-search the radius and
recover a target's *fuzzed* point exactly. That is by design: the fuzz offset
(500 m–1.5 km neighborhood, 2–5 km city) is the real privacy floor, and
deterministic write-time fuzzing means more queries never get closer than
that. Also: the module cannot know which `subject_type`s are people, so the
"person rows are never `exact`" rule is enforced by the consuming app and by
migration review — not by the schema.

## Activation checklist (owner-gated)

1. 🔒 Lincoln approves: `CREATE EXTENSION postgis` + this schema applied to the
   shared LPL Supabase as a **timestamped migration in the live
   supabase_migrations chain** (repo `db/` drafts are never applied directly —
   DB_REALITY_RECONCILIATION.md). Collision audit: `geo_*` prefix vs existing
   shared tables.
2. Optional: seed `geo_zip_centroids` from the Census gazetteer (free data).
3. First consumer wiring, in order: ChurchConnect church finder (replaces
   zip-exact match), Kindred `/discover` (replaces the 500-doc Python scan),
   LaserEngraving nearest-maker, then Live On Mission / Milstead.us / meetups
   consume it from day one.

## Usage

TypeScript (any Next.js/Node app):

```ts
import { createGeoClient, milesToMeters } from "@/lib/geo/location-proximity";

const geo = createGeoClient({ supabaseUrl: process.env.SUPABASE_URL!, apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY! });
await geo.upsertPlace({ appSlug: "churchconnect", subjectType: "church", subjectId: church.id, addressLine, city, region, postalCode, visibility: "exact" });
const near = await geo.search({ appSlug: "churchconnect", subjectTypes: ["church"], lat, lng, radiusM: milesToMeters(25) });
```

Python (FastAPI backends — same RPCs over PostgREST):

```python
import httpx

async def geo_rpc(fn: str, args: dict) -> object:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
            json=args,
            headers={"apikey": SERVICE_ROLE_KEY, "authorization": f"Bearer {SERVICE_ROLE_KEY}"},
        )
        r.raise_for_status()
        return r.json()

hits = await geo_rpc("geo_near_me", {
    "p_app_slug": "kindred-connections", "p_subject_type": "user", "p_subject_id": me.id,
    "p_target_types": ["user"], "p_radius_m": 40234, "p_limit": 50,
})  # each hit: distance_band only for person rows — no coordinates, no numbers
```
