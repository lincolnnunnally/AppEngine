// Smoke: dashboard admin doors for Laser and Operate go through a short-lived
// HS256 handoff. Every other catalog door stays the link it already was.
// Run: npm run smoke:admin-door-handoff
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isPlatformOwnerEmail } from "../src/lib/auth/roles.ts";
import { getAppOpsCatalogEntry, resolveAdminDoor } from "../src/lib/engine/app-ops-catalog.ts";
import { adminDoorOrigin, handleAdminDoor } from "../src/lib/engine/admin-door-handoff.ts";

const repoRoot = process.cwd();
const steps = [];
const NOW = 1_700_000_000;
const OWNER = "lincoln@unitedundergod.org";
const LASER_SECRET = "laser-handoff-test-secret";
const OPERATE_SECRET = "operate-handoff-test-secret";
const REQUEST = "https://dashboard.unitedundergod.org/api/admin/door/laser-engrave-market";

const ownerEnv = {
  APP_ENGINE_OWNER_EMAIL: "other@example.com, Lincoln@UnitedUnderGod.org",
  APP_ENGINE_PLATFORM_ADMIN_EMAIL: "",
  APPENGINE_LASER_HANDOFF_SECRET: LASER_SECRET,
  APPENGINE_OPERATE_HANDOFF_SECRET: OPERATE_SECRET
};

runStep("route is node, session-gated, and does not mint unknown slugs", () => {
  assertFileIncludes("src/app/api/admin/door/[slug]/route.ts", [
    'export const runtime = "nodejs"',
    "isAdminDoorHandoffSlug",
    "auth()",
    "handleAdminDoor",
    "session?.user?.email"
  ]);
  assertFileIncludes("src/lib/engine/admin-door-handoff.ts", [
    'iss: "appengine"',
    "APPENGINE_LASER_HANDOFF_SECRET",
    "APPENGINE_OPERATE_HANDOFF_SECRET",
    "isPlatformOwnerEmail",
    "Cache-Control",
    "no-store",
    "Referrer-Policy",
    "no-referrer"
  ]);
  assertFileIncludes("src/lib/auth/roles.ts", [
    "export function isPlatformOwnerEmail",
    "APP_ENGINE_OWNER_EMAIL",
    "APP_ENGINE_PLATFORM_ADMIN_EMAIL"
  ]);
  assertFileIncludes("src/lib/auth/hosts.ts", [
    "export function pathAfterSignIn",
    'nextPath.startsWith("/api/admin/door/")',
    "DASHBOARD_ORIGIN"
  ]);
  assertFileIncludes("src/app/signin/page.tsx", ["pathAfterSignIn(host, nextPath)"]);
  assertFileIncludes("next.config.mjs", [
    'source: "/api/admin/door/:slug"',
    '{ key: "Referrer-Policy", value: "no-referrer" }',
    '{ key: "Cache-Control", value: "no-store" }'
  ]);
});

runStep("non-owner and signed-out requests go to sign-in with a return path", () => {
  for (const email of [null, "", "visitor@example.com", "admin@example.com"]) {
    const response = handleAdminDoor({
      slug: "laser-engrave-market",
      requestUrl: REQUEST,
      email,
      env: ownerEnv,
      nowSeconds: NOW
    });
    assertEqual(response.status, 302, `status for ${email || "(none)"}`);
    const location = new URL(response.headers.get("location"));
    assertEqual(location.origin, "https://dashboard.unitedundergod.org", "sign-in origin");
    assertEqual(location.pathname, "/signin", "sign-in path");
    assertEqual(location.searchParams.get("next"), "/api/admin/door/laser-engrave-market", "return path");
    assertEqual(location.hash, "", "sign-in redirect has no token");
    assertPrivate(response);
  }
});

runStep("platform admin email is the same gate, not a second login", () => {
  assertEqual(
    isPlatformOwnerEmail("Lincoln@UnitedUnderGod.org", {
      APP_ENGINE_OWNER_EMAIL: "",
      APP_ENGINE_PLATFORM_ADMIN_EMAIL: "lincoln@unitedundergod.org"
    }),
    true,
    "platform admin email"
  );
  assertEqual(
    isPlatformOwnerEmail("visitor@example.com", {
      APP_ENGINE_OWNER_EMAIL: OWNER,
      APP_ENGINE_PLATFORM_ADMIN_EMAIL: OWNER
    }),
    false,
    "visitor is not a platform owner"
  );
});

runStep("unknown slugs 404 and never mint", () => {
  for (const slug of ["churchconnect", "porchlight", "laser", "operate-admin", ""]) {
    const response = handleAdminDoor({
      slug,
      requestUrl: REQUEST,
      email: OWNER,
      env: ownerEnv,
      nowSeconds: NOW
    });
    assertEqual(response.status, 404, `404 ${slug || "(empty)"}`);
    assertEqual(response.headers.get("location"), null, `no redirect ${slug || "(empty)"}`);
    assertPrivate(response);
  }
});

runStep("missing secret is 503 and does not redirect", async () => {
  const laser = handleAdminDoor({
    slug: "laser-engrave-market",
    requestUrl: REQUEST,
    email: OWNER,
    env: { ...ownerEnv, APPENGINE_LASER_HANDOFF_SECRET: "  " },
    nowSeconds: NOW
  });
  assertEqual(laser.status, 503, "laser 503");
  assertEqual(laser.headers.get("location"), null, "laser 503 has no location");
  assertPrivate(laser);
  const laserBody = await laser.text();
  if (!laserBody.includes("APPENGINE_LASER_HANDOFF_SECRET")) {
    throw new Error(`laser 503 must name the env var, got ${JSON.stringify(laserBody)}`);
  }
  if (laserBody.includes("eyJ")) {
    throw new Error("laser 503 must not include a token");
  }

  const operate = handleAdminDoor({
    slug: "operate",
    requestUrl: "https://dashboard.unitedundergod.org/api/admin/door/operate",
    email: OWNER,
    env: { ...ownerEnv, APPENGINE_OPERATE_HANDOFF_SECRET: "" },
    nowSeconds: NOW
  });
  assertEqual(operate.status, 503, "operate 503");
  const operateBody = await operate.text();
  if (!operateBody.includes("APPENGINE_OPERATE_HANDOFF_SECRET")) {
    throw new Error(`operate 503 must name the env var, got ${JSON.stringify(operateBody)}`);
  }
});

runStep("operate with no recorded host fails closed", async () => {
  const response = handleAdminDoor({
    slug: "operate",
    requestUrl: "https://dashboard.unitedundergod.org/api/admin/door/operate",
    email: OWNER,
    env: ownerEnv,
    nowSeconds: NOW,
    servingOrigin: null
  });
  assertEqual(response.status, 503, "missing operate host");
  assertEqual(response.headers.get("location"), null, "missing operate host does not redirect");
  const body = await response.text();
  if (body.includes("http")) {
    throw new Error(`missing operate host must not guess a URL, got ${JSON.stringify(body)}`);
  }
});

runStep("laser falls back to the production literal when no serving URL is recorded", async () => {
  const response = handleAdminDoor({
    slug: "laser-engrave-market",
    requestUrl: REQUEST,
    email: "Lincoln@UnitedUnderGod.org",
    env: ownerEnv,
    nowSeconds: NOW,
    servingOrigin: null
  });
  const { location, payload } = await readHandoff(response, LASER_SECRET);
  assertEqual(location.origin + location.pathname, "https://laser.unitedundergod.org/admin", "laser fallback host");
  assertEqual(payload.aud, "laser", "laser aud");
});

runStep("each app redirects with a fragment JWT the secret verifies", async () => {
  const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, "source-of-truth/ecosystem-portfolio-registry.json"), "utf8"));
  const apps = registry.apps;
  const laserRecord = apps.find((app) => app.slug === "laser-engrave-market");
  const operateRecord = apps.find((app) => app.slug === "operate");
  assertEqual(laserRecord.productionUrl, "https://laser.unitedundergod.org", "laser production host");
  assertEqual(laserRecord.domain.servingUrl, "https://laser.engrave.market", "laser storefront is a different host");
  assertEqual(adminDoorOrigin("laser-engrave-market"), "https://laser.unitedundergod.org", "laser door uses production host");
  assertEqual(operateRecord.productionUrl, "https://operate.unitedundergod.org", "operate production host");
  assertEqual(operateRecord.domain.servingUrl, "https://operate.unitedundergod.org", "operate serving URL");
  assertEqual(adminDoorOrigin("operate"), "https://operate.unitedundergod.org", "operate door host");

  const laser = await readHandoff(
    handleAdminDoor({
      slug: "laser-engrave-market",
      requestUrl: REQUEST,
      email: "Lincoln@UnitedUnderGod.org",
      env: ownerEnv,
      nowSeconds: NOW
    }),
    LASER_SECRET
  );
  assertEqual(laser.location.origin + laser.location.pathname, "https://laser.unitedundergod.org/admin", "laser location");
  assertToken(laser, "laser", "lincoln@unitedundergod.org");

  const operate = await readHandoff(
    handleAdminDoor({
      slug: "operate",
      requestUrl: "https://dashboard.unitedundergod.org/api/admin/door/operate",
      email: OWNER,
      env: {
        APP_ENGINE_OWNER_EMAIL: "",
        APP_ENGINE_PLATFORM_ADMIN_EMAIL: OWNER,
        APPENGINE_OPERATE_HANDOFF_SECRET: OPERATE_SECRET
      },
      nowSeconds: NOW
    }),
    OPERATE_SECRET
  );
  assertEqual(operate.location.origin + operate.location.pathname, "https://operate.unitedundergod.org/handoff", "operate location");
  assertToken(operate, "operate", OWNER);
  if (laser.payload.jti === operate.payload.jti) {
    throw new Error("jti must be unique per mint");
  }

  const wrong = crypto.createHmac("sha256", "other-secret").update(laser.signingInput).digest("base64url");
  if (wrong === laser.signature) {
    throw new Error("token must not verify under a different secret");
  }
});

runStep("catalog points only laser and operate at the handoff", () => {
  const serving = "https://serving.example";
  const catalog = fs.readFileSync(path.join(repoRoot, "src/lib/engine/app-ops-catalog.ts"), "utf8");
  const slugs = [...catalog.matchAll(/slug: "([^"]+)"/g)].map((match) => match[1]);
  if (!slugs.includes("laser-engrave-market") || !slugs.includes("operate") || !slugs.includes("churchconnect")) {
    throw new Error("catalog slug list did not parse");
  }

  for (const slug of slugs) {
    const entry = getAppOpsCatalogEntry(slug);
    const resolved = resolveAdminDoor(slug, serving);
    if (slug === "laser-engrave-market" || slug === "operate") {
      assertEqual(resolved?.url, `/api/admin/door/${slug}`, `${slug} handoff url`);
      const generic = genericDoor(entry, serving);
      if (resolved?.url === generic?.url) {
        throw new Error(`${slug} must not stay a direct admin link`);
      }
      continue;
    }
    const expected = genericDoor(entry, serving);
    assertEqual(resolved?.url ?? null, expected?.url ?? null, `${slug} url unchanged`);
    assertEqual(resolved?.note ?? null, expected?.note ?? null, `${slug} note unchanged`);
  }

  assertEqual(getAppOpsCatalogEntry("operate")?.adminPath, "/admin", "operate adminPath");
  assertEqual(
    resolveAdminDoor("operate", "https://operate.unitedundergod.org")?.note,
    "Platform owner view across shops (owner-only). Opens signed in via dashboard handoff.",
    "operate note"
  );
  assertEqual(resolveAdminDoor("laser-engrave-market", "https://laser.unitedundergod.org")?.url, "/api/admin/door/laser-engrave-market", "laser door");
  assertEqual(resolveAdminDoor("appengine", serving)?.url, "/admin", "appengine stays local");
  assertEqual(resolveAdminDoor("churchconnect", "https://churchconnect.unitedundergod.org")?.url, "https://churchconnect.unitedundergod.org/admin", "churchconnect");
  assertEqual(resolveAdminDoor("toner-management", serving)?.url, "https://toner.management/admin", "toner");
  assertEqual(resolveAdminDoor("plenty", "https://plenty.unitedundergod.org")?.url, "https://plenty.unitedundergod.org/run/people", "plenty");
  assertEqual(resolveAdminDoor("live-on-mission", "https://lom.example")?.url, "https://lom.example/admin-ops", "live on mission");
  assertEqual(resolveAdminDoor("aligned-souls", "https://aligned.example")?.url, "https://aligned.example/app/admin", "aligned souls");
  assertEqual(resolveAdminDoor("vidalia-toombs-pastors-circle", serving)?.url, "https://churchconnect.unitedundergod.org/admin", "pastors circle");
  assertEqual(resolveAdminDoor("porchlight", "https://porchlight.unitedundergod.org")?.url, "", "porchlight still has no door");
  if (!String(resolveAdminDoor("porchlight", serving)?.note).includes("HOLD invent")) {
    throw new Error("porchlight HOLD note must stay");
  }
  if (catalog.includes("HOLD invent — Operate")) {
    throw new Error("operate HOLD invent note must be gone");
  }
});

await Promise.all(steps);
if (!process.exitCode) {
  console.log("admin door handoff smoke ok");
}

function genericDoor(entry, servingUrl) {
  if (!entry) return null;
  if (entry.adminUrl) return { url: entry.adminUrl, note: entry.adminNote ?? "" };
  if (entry.adminPath) {
    if (entry.slug === "appengine") return { url: entry.adminPath, note: entry.adminNote ?? "" };
    if (servingUrl && /^https?:\/\//.test(servingUrl)) {
      return { url: `${servingUrl.replace(/\/+$/, "")}${entry.adminPath}`, note: entry.adminNote ?? "" };
    }
  }
  return entry.adminNote ? { url: "", note: entry.adminNote } : null;
}

async function readHandoff(response, secret) {
  assertEqual(response.status, 302, "handoff status");
  assertPrivate(response);
  const raw = response.headers.get("location");
  if (!raw) throw new Error("missing location");
  const location = new URL(raw);
  const fragment = location.hash.slice(1);
  const eq = fragment.indexOf("=");
  const token = fragment.slice(eq + 1);
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error(`jwt shape ${token}`);
  const [headerPart, payloadPart, signature] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;
  const expected = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    throw new Error("jwt signature did not verify");
  }
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error(`unexpected jwt header ${JSON.stringify(header)}`);
  }
  return { location, payload, signature, signingInput, fragmentKey: fragment.slice(0, eq) };
}

function assertToken(handoff, audience, email) {
  const key = audience === "laser" ? "sso" : "token";
  assertEqual(handoff.fragmentKey, key, `${audience} fragment`);
  assertEqual(handoff.payload.iss, "appengine", `${audience} iss`);
  assertEqual(handoff.payload.aud, audience, `${audience} aud`);
  assertEqual(handoff.payload.email, email, `${audience} email`);
  assertEqual(handoff.payload.iat, NOW, `${audience} iat`);
  assertEqual(handoff.payload.exp, NOW + 120, `${audience} exp`);
  if (typeof handoff.payload.jti !== "string" || handoff.payload.jti.length < 8) {
    throw new Error(`${audience} jti missing`);
  }
}

function assertPrivate(response) {
  assertEqual(response.headers.get("cache-control"), "no-store", "cache-control");
  assertEqual(response.headers.get("referrer-policy"), "no-referrer", "referrer-policy");
}

function assertFileIncludes(rel, needles) {
  const text = fs.readFileSync(path.join(repoRoot, rel), "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${rel} is missing ${JSON.stringify(needle)}`);
    }
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function runStep(name, fn) {
  const result = fn();
  if (result && typeof result.then === "function") {
    steps.push(
      result.then(
        () => console.log(`ok  ${name}`),
        (error) => fail(name, error)
      )
    );
    return;
  }
  console.log(`ok  ${name}`);
}

function fail(name, error) {
  console.error(`fail  ${name}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

