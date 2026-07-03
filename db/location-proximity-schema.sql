-- Location & Proximity module — shared geo layer for every ecosystem app.
-- One table answers "what is near me" for churches (ChurchConnect), serving
-- opportunities (Live On Mission), community happenings/meetups (Milstead.us),
-- makers (LaserEngraving), and distance-based matching (Kindred + dating).
--
-- STAGED DRAFT — do NOT apply directly. Applying this to the shared
-- Life Produces Life Supabase is a db-change requiring Lincoln's approval, and
-- it must land as a timestamped migration in the live supabase_migrations chain
-- (never via the stale db/ draft path — see DB_REALITY_RECONCILIATION.md).
-- Requires the postgis extension (available 3.3.7, not yet enabled).
--
-- Privacy doctrine (see source-of-truth/location-proximity-module.md):
--  * Exact coordinates are radioactive for person rows. Only places/venues/
--    churches/events may be visibility='exact'. Person rows default to
--    'neighborhood' and dating consumers only ever see distance BANDS.
--  * Fuzz at WRITE time, deterministically (seeded by row id). Re-randomizing
--    per read lets an attacker average many reads back to the true point;
--    precise repeated distances enable trilateration (the classic dating-app
--    attack). All cross-user search runs against the fuzzed column.
--  * RLS default-deny: no direct table access for anon/authenticated; access
--    goes through the SECURITY DEFINER RPCs below, which never return the
--    exact location column.

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS geo_places (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug      text NOT NULL,             -- owning app (customerDataStaysIsolated)
  subject_type  text NOT NULL,             -- 'user' | 'church' | 'event' | 'group' | 'venue' | 'maker' | ...
  subject_id    text NOT NULL,             -- id within the owning app
  -- raw address; every field optional — a zip-only row is valid
  address_line  text,
  city          text,
  region        text,
  postal_code   text,
  country       text NOT NULL DEFAULT 'US',
  -- geocode cache (ChurchConnect pattern: never geocode the same string twice)
  geocoded_address text,
  geocode_source   text CHECK (geocode_source IN ('nominatim', 'device', 'manual', 'zip_centroid')),
  -- WGS84 points. `location` is the exact point; `fuzzed_location` is what all
  -- cross-user queries run against (maintained by trigger, never by callers).
  location         geography(Point, 4326),
  fuzzed_location  geography(Point, 4326),
  visibility    text NOT NULL DEFAULT 'city'
                CHECK (visibility IN ('exact', 'neighborhood', 'city', 'hidden')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_slug, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS geo_places_fuzzed_gix ON geo_places USING gist (fuzzed_location);
CREATE INDEX IF NOT EXISTS geo_places_gix        ON geo_places USING gist (location);
CREATE INDEX IF NOT EXISTS geo_places_app_type_idx ON geo_places (app_slug, subject_type);

-- Optional centroid lookup so zip-only signups (most ChurchConnect users) still
-- participate in radius search at city precision. Seeded separately from the
-- Census gazetteer; empty table is safe (fallback simply doesn't fire).
CREATE TABLE IF NOT EXISTS geo_zip_centroids (
  postal_code text NOT NULL,
  country     text NOT NULL DEFAULT 'US',
  location    geography(Point, 4326) NOT NULL,
  city        text,
  region      text,
  PRIMARY KEY (postal_code, country)
);

-- ---------------------------------------------------------------------------
-- Fuzzing + banding
-- ---------------------------------------------------------------------------

-- Deterministic per-row fuzz: the same row always fuzzes to the same offset.
CREATE OR REPLACE FUNCTION geo_fuzz_point(p geography, seed uuid, min_m int, max_m int)
RETURNS geography
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ST_Project(
    p,
    (min_m + mod(abs(hashtextextended(seed::text, 1)), (max_m - min_m)::bigint))::float8,
    radians(mod(abs(hashtextextended(seed::text, 2)), 360)::float8)
  )::geography
$$;

-- Distance bands are the only distance dating-style consumers ever see.
-- Thresholds in meters: 5 mi, 10 mi, 25 mi, 50 mi.
CREATE OR REPLACE FUNCTION geo_distance_band(meters float8)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN meters IS NULL   THEN NULL
    WHEN meters < 8047    THEN '< 5 mi'
    WHEN meters < 16093   THEN '5-10 mi'
    WHEN meters < 40234   THEN '10-25 mi'
    WHEN meters < 80467   THEN '25-50 mi'
    ELSE '50+ mi'
  END
$$;

-- Maintain fuzzed_location + updated_at on every write. Fuzz radius scales with
-- the privacy tier; 'hidden' keeps a fuzzed point but is excluded from search.
CREATE OR REPLACE FUNCTION geo_places_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.location IS NULL THEN
    NEW.fuzzed_location := NULL;
  ELSIF NEW.visibility = 'exact' THEN
    NEW.fuzzed_location := NEW.location;
  ELSIF NEW.visibility = 'neighborhood' THEN
    NEW.fuzzed_location := geo_fuzz_point(NEW.location, NEW.id, 500, 1500);
  ELSE
    NEW.fuzzed_location := geo_fuzz_point(NEW.location, NEW.id, 2000, 5000);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS geo_places_write ON geo_places;
-- Fires on every write (not just location/visibility) so updated_at is never
-- stale; the fuzz recompute is deterministic, so re-running it is idempotent.
CREATE TRIGGER geo_places_write
  BEFORE INSERT OR UPDATE ON geo_places
  FOR EACH ROW EXECUTE FUNCTION geo_places_before_write();

-- ---------------------------------------------------------------------------
-- RPCs (the only supported access path for non-service callers)
-- ---------------------------------------------------------------------------

-- Upsert a subject's place. Coordinates may come from device opt-in (lat/lng),
-- a geocoder, or fall back to the zip centroid. Service-role only: the owning
-- app enforces WHO may write which subject.
CREATE OR REPLACE FUNCTION geo_upsert_place(
  p_app_slug text,
  p_subject_type text,
  p_subject_id text,
  p_lat float8 DEFAULT NULL,
  p_lng float8 DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_country text DEFAULT 'US',
  p_visibility text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_point geography;
  v_source text := p_source;
  v_id uuid;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  ELSIF p_postal_code IS NOT NULL THEN
    SELECT z.location INTO v_point
      FROM geo_zip_centroids z
      WHERE z.postal_code = p_postal_code AND z.country = p_country;
    IF v_point IS NOT NULL THEN
      v_source := 'zip_centroid';
    END IF;
  END IF;

  INSERT INTO geo_places AS gp (
    app_slug, subject_type, subject_id,
    address_line, city, region, postal_code, country,
    location, geocode_source, visibility
  )
  VALUES (
    p_app_slug, p_subject_type, p_subject_id,
    p_address_line, p_city, p_region, p_postal_code, p_country,
    v_point, CASE WHEN v_point IS NULL THEN NULL ELSE v_source END,
    COALESCE(p_visibility, 'city')
  )
  ON CONFLICT (app_slug, subject_type, subject_id) DO UPDATE SET
    address_line   = COALESCE(EXCLUDED.address_line, gp.address_line),
    city           = COALESCE(EXCLUDED.city, gp.city),
    region         = COALESCE(EXCLUDED.region, gp.region),
    postal_code    = COALESCE(EXCLUDED.postal_code, gp.postal_code),
    country        = EXCLUDED.country,
    -- never silently downgrade a device-precise point to a zip centroid
    location       = CASE
                       WHEN EXCLUDED.geocode_source = 'zip_centroid' AND gp.geocode_source = 'device'
                         THEN gp.location
                       ELSE COALESCE(EXCLUDED.location, gp.location)
                     END,
    geocode_source = CASE
                       WHEN EXCLUDED.geocode_source = 'zip_centroid' AND gp.geocode_source = 'device'
                         THEN gp.geocode_source
                       ELSE COALESCE(EXCLUDED.geocode_source, gp.geocode_source)
                     END,
    visibility     = COALESCE(p_visibility, gp.visibility)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

-- Radius search. Runs against fuzzed_location only; returns exact distance for
-- 'exact' rows (churches, venues, events) and bands for everything else.
-- Never returns coordinates.
CREATE OR REPLACE FUNCTION geo_search(
  p_app_slug text,
  p_subject_types text[],
  p_lat float8,
  p_lng float8,
  p_radius_m float8,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  subject_type text,
  subject_id text,
  distance_m float8,
  distance_band text,
  city_label text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctr AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT
    gp.subject_type,
    gp.subject_id,
    CASE WHEN gp.visibility = 'exact'
         THEN ST_Distance(gp.fuzzed_location, ctr.g) END AS distance_m,
    geo_distance_band(ST_Distance(gp.fuzzed_location, ctr.g)) AS distance_band,
    gp.city AS city_label
  FROM geo_places gp, ctr
  WHERE gp.app_slug = p_app_slug
    AND gp.subject_type = ANY (p_subject_types)
    AND gp.visibility <> 'hidden'
    AND gp.fuzzed_location IS NOT NULL
    AND ST_DWithin(gp.fuzzed_location, ctr.g, p_radius_m)
  ORDER BY ST_Distance(gp.fuzzed_location, ctr.g)
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
$$;

-- Same search, centered on a subject's own stored point (their exact point —
-- it's theirs). Service-role only: the app asserts the caller IS that subject.
CREATE OR REPLACE FUNCTION geo_near_me(
  p_app_slug text,
  p_subject_type text,
  p_subject_id text,
  p_target_types text[],
  p_radius_m float8,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  subject_type text,
  subject_id text,
  distance_m float8,
  distance_band text,
  city_label text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_center geography;
BEGIN
  SELECT gp.location INTO v_center
    FROM geo_places gp
    WHERE gp.app_slug = p_app_slug
      AND gp.subject_type = p_subject_type
      AND gp.subject_id = p_subject_id;
  IF v_center IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.subject_type, s.subject_id, s.distance_m, s.distance_band, s.city_label
    FROM geo_search(p_app_slug, p_target_types, ST_Y(v_center::geometry), ST_X(v_center::geometry), p_radius_m, p_limit) s
    WHERE NOT (s.subject_type = p_subject_type AND s.subject_id = p_subject_id);
END
$$;

-- Band-only distance between two subjects (dating match cards). Never a number.
CREATE OR REPLACE FUNCTION geo_distance_between(
  p_app_slug text,
  p_subject_type_a text, p_subject_id_a text,
  p_subject_type_b text, p_subject_id_b text
)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT geo_distance_band(ST_Distance(a.fuzzed_location, b.fuzzed_location))
  FROM geo_places a, geo_places b
  WHERE a.app_slug = p_app_slug AND a.subject_type = p_subject_type_a AND a.subject_id = p_subject_id_a
    AND b.app_slug = p_app_slug AND b.subject_type = p_subject_type_b AND b.subject_id = p_subject_id_b
    AND a.visibility <> 'hidden' AND b.visibility <> 'hidden'
$$;

-- The Kindred "clear my location" contract: genuinely null the coordinates.
CREATE OR REPLACE FUNCTION geo_clear_place(
  p_app_slug text,
  p_subject_type text,
  p_subject_id text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE geo_places SET
    location = NULL,
    fuzzed_location = NULL,
    geocoded_address = NULL,
    geocode_source = NULL
  WHERE app_slug = p_app_slug
    AND subject_type = p_subject_type
    AND subject_id = p_subject_id
$$;

-- ---------------------------------------------------------------------------
-- Grants + RLS: default-deny; RPCs are the door.
-- ---------------------------------------------------------------------------

ALTER TABLE geo_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_zip_centroids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON geo_places FROM anon, authenticated;
REVOKE ALL ON geo_zip_centroids FROM anon, authenticated;

-- v1: the ENTIRE RPC surface is service-role-only. app_slug is caller-supplied,
-- so granting geo_search to `authenticated` would let any signed-in user of any
-- app on the shared database enumerate another app's fuzzed person rows —
-- exactly what customerDataStaysIsolated forbids. Each app's backend calls
-- these with the service key and enforces its own ownership/authorization.
-- (A later version can open client-side geo_search behind a JWT-claim → app_slug
-- policy; do not re-grant without that check.)
REVOKE ALL ON FUNCTION geo_upsert_place(text, text, text, float8, float8, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION geo_near_me(text, text, text, text[], float8, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION geo_distance_between(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION geo_clear_place(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION geo_search(text, text[], float8, float8, float8, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION geo_fuzz_point(geography, uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION geo_places_before_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo_distance_band(float8) TO anon, authenticated;
