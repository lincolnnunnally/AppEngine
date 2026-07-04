// Location & Proximity module — TypeScript client for the shared geo layer.
//
// The source of truth is db/location-proximity-schema.sql (geo_places on the
// shared Life Produces Life Supabase, PostGIS). This client calls the module's
// SECURITY DEFINER RPCs over PostgREST with plain fetch — no SDK dependency —
// so any Next.js/Node app in the ecosystem can use it. Python backends
// (ChurchConnect, Kindred, LaserEngraving) call the same RPCs; see
// source-of-truth/location-proximity-module.md for the FastAPI example.
//
// Privacy contract (mirrors the SQL): searches run against pre-fuzzed points,
// numeric distance comes back only for visibility='exact' rows, and
// person-to-person distance is only ever a band. This client cannot retrieve
// coordinates because the RPCs never return them.

export type GeoVisibility = "exact" | "neighborhood" | "city" | "hidden";

export type GeoSubjectRef = {
  appSlug: string;
  subjectType: string; // 'user' | 'church' | 'event' | 'group' | 'venue' | 'maker' | ...
  subjectId: string;
};

export type GeoUpsertInput = GeoSubjectRef & {
  lat?: number;
  lng?: number;
  addressLine?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  visibility?: GeoVisibility;
  source?: "nominatim" | "device" | "manual" | "zip_centroid";
};

export type GeoSearchHit = {
  subject_type: string;
  subject_id: string;
  // Numeric meters only when the target row is visibility='exact'.
  distance_m: number | null;
  distance_band: string | null;
  city_label: string | null;
};

// Band thresholds in meters — MUST stay in sync with geo_distance_band() in
// db/location-proximity-schema.sql (5 / 10 / 25 / 50 miles).
export const GEO_BAND_THRESHOLDS_M = [
  { maxM: 8047, band: "< 5 mi" },
  { maxM: 16093, band: "5-10 mi" },
  { maxM: 40234, band: "10-25 mi" },
  { maxM: 80467, band: "25-50 mi" }
] as const;

export const GEO_BAND_BEYOND = "50+ mi";

export function bandForMeters(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return null;
  for (const { maxM, band } of GEO_BAND_THRESHOLDS_M) {
    if (meters < maxM) return band;
  }
  return GEO_BAND_BEYOND;
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

export type GeoClientOptions = {
  supabaseUrl: string;
  // Service-role key. The whole RPC surface is service-role-only in v1 (the
  // SQL grants nothing to anon/authenticated), so this client is BACKEND-ONLY:
  // never ship this key or this client to a browser bundle.
  apiKey: string;
  fetchImpl?: typeof fetch;
};

async function rpc<T>(opts: GeoClientOptions, fn: string, args: Record<string, unknown>): Promise<T> {
  const doFetch = opts.fetchImpl ?? fetch;
  const response = await doFetch(`${opts.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: opts.apiKey,
      authorization: `Bearer ${opts.apiKey}`
    },
    body: JSON.stringify(args)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`geo rpc ${fn} failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export function createGeoClient(opts: GeoClientOptions) {
  return {
    // Store/refresh a subject's place (device opt-in coords, address fields,
    // or zip-only — the RPC falls back to the zip centroid).
    async upsertPlace(input: GeoUpsertInput): Promise<string> {
      return rpc<string>(opts, "geo_upsert_place", {
        p_app_slug: input.appSlug,
        p_subject_type: input.subjectType,
        p_subject_id: input.subjectId,
        p_lat: input.lat ?? null,
        p_lng: input.lng ?? null,
        p_address_line: input.addressLine ?? null,
        p_city: input.city ?? null,
        p_region: input.region ?? null,
        p_postal_code: input.postalCode ?? null,
        p_country: input.country ?? "US",
        p_visibility: input.visibility ?? null,
        p_source: input.source ?? "manual"
      });
    },

    async search(params: {
      appSlug: string;
      subjectTypes: string[];
      lat: number;
      lng: number;
      radiusM: number;
      limit?: number;
    }): Promise<GeoSearchHit[]> {
      return rpc<GeoSearchHit[]>(opts, "geo_search", {
        p_app_slug: params.appSlug,
        p_subject_types: params.subjectTypes,
        p_lat: params.lat,
        p_lng: params.lng,
        p_radius_m: params.radiusM,
        p_limit: params.limit ?? 50
      });
    },

    // Centered on the caller's own stored point. Backend-only: the app must
    // assert the authenticated caller IS this subject before calling.
    async nearMe(params: GeoSubjectRef & { targetTypes: string[]; radiusM: number; limit?: number }): Promise<GeoSearchHit[]> {
      return rpc<GeoSearchHit[]>(opts, "geo_near_me", {
        p_app_slug: params.appSlug,
        p_subject_type: params.subjectType,
        p_subject_id: params.subjectId,
        p_target_types: params.targetTypes,
        p_radius_m: params.radiusM,
        p_limit: params.limit ?? 50
      });
    },

    // Band only, by design — never a number between two people.
    async distanceBetween(appSlug: string, a: { subjectType: string; subjectId: string }, b: { subjectType: string; subjectId: string }): Promise<string | null> {
      return rpc<string | null>(opts, "geo_distance_between", {
        p_app_slug: appSlug,
        p_subject_type_a: a.subjectType,
        p_subject_id_a: a.subjectId,
        p_subject_type_b: b.subjectType,
        p_subject_id_b: b.subjectId
      });
    },

    // The "clear my location" contract: coordinates are genuinely nulled.
    async clearPlace(ref: GeoSubjectRef): Promise<void> {
      await rpc<null>(opts, "geo_clear_place", {
        p_app_slug: ref.appSlug,
        p_subject_type: ref.subjectType,
        p_subject_id: ref.subjectId
      });
    }
  };
}
