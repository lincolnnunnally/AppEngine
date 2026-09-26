// Dashboard → app admin handoff. Lincoln is signed in on the desk, but Laser
// (and Operate) keep their own cookie. A 120-second HS256 JWT in the URL
// fragment is the existing #sso / /handoff contract — the token is not a query
// param, so it is not sent to the app server as a request log line.
//
// Only the slugs in DOORS are minted. Every other slug 404s.
import crypto from "node:crypto";
import registryJson from "../../../source-of-truth/ecosystem-portfolio-registry.json" with { type: "json" };
import { isPlatformOwnerEmail } from "@/lib/auth/roles";

const TOKEN_TTL_SECONDS = 120;
const LASER_FALLBACK_ORIGIN = "https://laser.unitedundergod.org";

type DoorSlug = "laser-engrave-market" | "operate";

type DoorSpec = {
  audience: "laser" | "operate";
  secretEnv: "APPENGINE_LASER_HANDOFF_SECRET" | "APPENGINE_OPERATE_HANDOFF_SECRET";
  path: "/admin" | "/handoff";
  fragment: "sso" | "token";
  // Used only when the registry has no https serving URL. Operate has none:
  // a missing host fails closed instead of guessing.
  fallbackOrigin: string | null;
};

const DOORS: Record<DoorSlug, DoorSpec> = {
  "laser-engrave-market": {
    audience: "laser",
    secretEnv: "APPENGINE_LASER_HANDOFF_SECRET",
    path: "/admin",
    fragment: "sso",
    fallbackOrigin: LASER_FALLBACK_ORIGIN
  },
  operate: {
    audience: "operate",
    secretEnv: "APPENGINE_OPERATE_HANDOFF_SECRET",
    path: "/handoff",
    fragment: "token",
    fallbackOrigin: null
  }
};

type RegistryApp = {
  slug?: string;
  productionUrl?: string;
  reviewUrl?: string;
  domain?: {
    urlStatus?: string;
    intendedDomain?: string;
  };
};

export type AdminDoorHandoffInput = {
  slug: string;
  requestUrl: string;
  email?: string | null;
  env?: Record<string, string | undefined>;
  nowSeconds?: number;
  // Test seam. undefined reads the registry. null means "not recorded".
  servingOrigin?: string | null;
};

export const OPERATE_DOOR_COMING_SOON =
  "Operate owner sign-in is coming shortly. It turns on once Operate's handoff is live.";

// Live only for the exact strings "1" and "true". Empty, "TRUE", "yes", and
// anything else stay dark so the door cannot dead-end before /handoff exists.
export function operateDoorLive(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.APPENGINE_OPERATE_DOOR_LIVE;
  return value === "1" || value === "true";
}

export function isAdminDoorHandoffSlug(slug: string): slug is DoorSlug {
  return Object.prototype.hasOwnProperty.call(DOORS, slug);
}

// Laser is always offered. Operate is offered only while the flag is on.
export function adminDoorShown(slug: string, env: Record<string, string | undefined> = process.env): boolean {
  if (slug === "laser-engrave-market") return true;
  if (slug === "operate") return operateDoorLive(env);
  return false;
}

export function adminDoorPath(slug: string): string {
  return `/api/admin/door/${slug}`;
}

// Serving host the dashboard already uses (portfolio-url-status order):
// production URL, then review URL, then https://intended domain when live.
// Laser's production host is https://laser.unitedundergod.org. The registry's
// domain.servingUrl (laser.engrave.market) is the customer storefront, not
// this admin door.
export function adminDoorOrigin(slug: string): string | null {
  if (!isAdminDoorHandoffSlug(slug)) return null;
  return recordedServingOrigin(slug) ?? DOORS[slug].fallbackOrigin;
}

export function handleAdminDoor(input: AdminDoorHandoffInput): Response {
  if (!isAdminDoorHandoffSlug(input.slug)) {
    return textResponse(404, "Not found.");
  }

  const door = DOORS[input.slug];
  const env = input.env ?? process.env;

  if (input.slug === "operate" && !operateDoorLive(env)) {
    return textResponse(503, OPERATE_DOOR_COMING_SOON);
  }

  const email = input.email?.trim().toLowerCase() ?? "";

  if (!isPlatformOwnerEmail(email, env)) {
    return redirectResponse(signInLocation(input.requestUrl, input.slug));
  }

  const secret = (env[door.secretEnv] || "").trim();
  if (!secret) {
    return textResponse(503, `${door.secretEnv} is not set.`);
  }

  const origin = resolveOrigin(input.slug, input.servingOrigin);
  if (!origin) {
    return textResponse(503, "Operate serving URL is not recorded.");
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const token = mintHandoffJwt(
    {
      iss: "appengine",
      aud: door.audience,
      email,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      jti: crypto.randomUUID()
    },
    secret
  );

  return redirectResponse(`${origin}${door.path}#${door.fragment}=${token}`);
}

function resolveOrigin(slug: DoorSlug, override: string | null | undefined): string | null {
  const recorded = override !== undefined ? (override ? httpsOrigin(override) : null) : recordedServingOrigin(slug);
  return recorded ?? DOORS[slug].fallbackOrigin;
}

function recordedServingOrigin(slug: string): string | null {
  const apps = (registryJson as { apps?: RegistryApp[] }).apps ?? [];
  const app = apps.find((entry) => entry.slug === slug);
  if (!app) return null;

  const fromUrls = httpsOrigin(app.productionUrl) || httpsOrigin(app.reviewUrl);
  if (fromUrls) return fromUrls;

  const domain = app.domain?.intendedDomain?.trim() ?? "";
  if (app.domain?.urlStatus === "live" && domain && !domain.includes("/") && !domain.includes(" ")) {
    return httpsOrigin(`https://${domain}`);
  }

  return null;
}

function httpsOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function signInLocation(requestUrl: string, slug: DoorSlug): string {
  const nextPath = adminDoorPath(slug);
  try {
    const signIn = new URL("/signin", requestUrl);
    signIn.searchParams.set("next", nextPath);
    return signIn.toString();
  } catch {
    return `/signin?next=${encodeURIComponent(nextPath)}`;
  }
}

type HandoffClaims = {
  iss: "appengine";
  aud: "laser" | "operate";
  email: string;
  iat: number;
  exp: number;
  jti: string;
};

function mintHandoffJwt(claims: HandoffClaims, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function privateHeaders(extra?: Record<string, string>): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
}

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: privateHeaders({ "Content-Type": "text/plain; charset=utf-8" })
  });
}

// Location is set by hand. The Fetch spec's Response.redirect throws when the
// URL has a fragment, and the handoff token has to ride in the fragment.
function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: privateHeaders({ Location: location })
  });
}
