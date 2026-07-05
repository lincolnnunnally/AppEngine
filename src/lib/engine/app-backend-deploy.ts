// Turn "an app has a Render backend that doesn't exist yet" into one owner action.
// This is the app-specific layer over the generic render-client: each backend's
// render.yaml is TRANSCRIBED here (the audit's call — don't rely on Render blueprint
// sync), and every env value is sourced in a clear order: the owner's vault first,
// then a process.env fallback, then a value pasted inline for this one deploy.
//
// Where the Render key comes from mirrors the vault's whole promise: paste it once
// (Integrations → RENDER_API_KEY, or inline on the Deploy panel) and every backend
// deploy uses it. No render.yaml editing, no Render dashboard, no terminal.
// SERVER ONLY.
import { resolveEnvForApp } from "@/lib/engine/env-vault";
import {
  createOrUpdateRenderWebService,
  renderTokenFromEnv,
  verifyRenderKey,
  type RenderEnvVar,
  type RenderDeployResult,
} from "@/lib/engine/render-client";

// How a single service env var gets its value.
type EnvSource =
  | { source: "static"; value: string } // a known, non-secret value
  | { source: "generate" } // Render generates it (JWT_SECRET, CRON_TOKEN)
  | { source: "secret"; required: boolean; envFallback?: string }; // owner-supplied

export type BackendDeployProfile = {
  slug: string; // matches the credential registry / portfolio slug
  serviceName: string; // the Render service name
  repo: string; // github repo the service builds from
  branch: string;
  rootDir: string;
  runtime: string; // "python" | "node" | …
  plan: string; // "free"
  region?: string;
  healthCheckPath: string;
  buildCommand: string;
  startCommand: string;
  env: Record<string, EnvSource>; // service env var -> where its value comes from
};

const SHARED_SUPABASE_URL = "https://uqhqulrqcygsmmzdzemx.supabase.co";

// ── Laser Engrave Market backend — transcribed from LaserEngraving/render.yaml ──
const LASER: BackendDeployProfile = {
  slug: "laser-engrave-market",
  serviceName: "laser-engrave-api",
  repo: "https://github.com/lincolnnunnally/LaserEngraving",
  branch: "main",
  rootDir: "backend",
  runtime: "python",
  plan: "free",
  region: "oregon",
  healthCheckPath: "/api/health",
  buildCommand: "pip install -r requirements.txt",
  startCommand: "uvicorn server:app --host 0.0.0.0 --port $PORT",
  env: {
    PYTHON_VERSION: { source: "static", value: "3.12.8" },
    SUPABASE_URL: { source: "static", value: SHARED_SUPABASE_URL },
    SUPABASE_SERVICE_ROLE_KEY: { source: "secret", required: true },
    SUPABASE_ANON_KEY: { source: "secret", required: true },
    JWT_SECRET: { source: "generate" },
    ADMIN_EMAIL: { source: "static", value: "lincoln@unitedundergod.org" },
    ADMIN_PASSWORD: { source: "secret", required: true, envFallback: "LASER_ADMIN_PASSWORD" },
    // Backend CORS/cookie origin = the Laser frontend's Vercel production URL.
    FRONTEND_URL: { source: "static", value: "https://laser-engrave-market.vercel.app" },
    STRIPE_API_KEY: { source: "secret", required: false },
    STRIPE_WEBHOOK_SECRET: { source: "secret", required: false },
    CRON_TOKEN: { source: "generate" },
  },
};

const PROFILES: BackendDeployProfile[] = [LASER];

export function backendDeployProfileFor(slug: string): BackendDeployProfile | undefined {
  return PROFILES.find((p) => p.slug === slug);
}

export function hasBackendDeployProfile(slug: string): boolean {
  return PROFILES.some((p) => p.slug === slug);
}

export type BackendDeployOptions = {
  apiKeyOverride?: string; // pasted inline for this one deploy
  secretOverrides?: Record<string, string>; // rarely used; inline secret values
};

// Resolve a secret in priority order: the owner's vault (shared or app-scoped),
// then a process.env fallback, then the same-named process.env.
function resolveSecret(
  name: string,
  spec: Extract<EnvSource, { source: "secret" }>,
  vaultEnv: Record<string, string>,
  overrides: Record<string, string>
): string | undefined {
  return (
    overrides[name] ||
    vaultEnv[name] ||
    (spec.envFallback ? process.env[spec.envFallback]?.trim() : undefined) ||
    process.env[name]?.trim() ||
    undefined
  );
}

// The whole action: gather the Render key + the service's env from the vault/env,
// then create-or-update the service and start its build. Returns a plain result the
// UI can show — including the two states the owner might have to act on: no key yet,
// or the repo needs a one-time connect on Render.
export async function deployAppBackend(
  ownerEmail: string,
  slug: string,
  options: BackendDeployOptions = {}
): Promise<RenderDeployResult & { missingSecrets?: string[] }> {
  const profile = backendDeployProfileFor(slug);
  if (!profile) {
    return { ok: false, message: "That app doesn't have a backend I know how to deploy yet." };
  }

  const vaultEnv = await resolveEnvForApp(ownerEmail, slug).catch(() => ({} as Record<string, string>));
  const overrides = options.secretOverrides || {};

  const apiKey =
    options.apiKeyOverride?.trim() || vaultEnv.RENDER_API_KEY || renderTokenFromEnv();
  if (!apiKey) {
    return {
      ok: false,
      message:
        "No Render API key yet. Paste it in the Deploy panel (or add RENDER_API_KEY under Integrations), then click Deploy — that's the only thing missing.",
    };
  }

  const keyCheck = await verifyRenderKey(apiKey);
  if (!keyCheck.ok) return { ok: false, message: keyCheck.message };

  const envVars: RenderEnvVar[] = [];
  const missingSecrets: string[] = [];
  for (const [name, spec] of Object.entries(profile.env)) {
    if (spec.source === "static") {
      envVars.push({ key: name, value: spec.value });
    } else if (spec.source === "generate") {
      envVars.push({ key: name, generateValue: true });
    } else {
      const value = resolveSecret(name, spec, vaultEnv, overrides);
      if (value) {
        envVars.push({ key: name, value });
      } else if (spec.required) {
        missingSecrets.push(name);
      }
      // optional + missing => simply omitted (Render app handles absence, e.g. Stripe 503s)
    }
  }

  if (missingSecrets.length) {
    return {
      ok: false,
      missingSecrets,
      message: `Can't deploy yet — these values aren't in your vault: ${missingSecrets.join(", ")}. Add them under Integrations (scoped to ${profile.slug}) and click Deploy.`,
    };
  }

  return createOrUpdateRenderWebService(apiKey, {
    name: profile.serviceName,
    repo: profile.repo,
    branch: profile.branch,
    rootDir: profile.rootDir,
    runtime: profile.runtime,
    plan: profile.plan,
    region: profile.region,
    healthCheckPath: profile.healthCheckPath,
    buildCommand: profile.buildCommand,
    startCommand: profile.startCommand,
    envVars,
  });
}
