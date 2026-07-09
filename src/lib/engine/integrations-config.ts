// Owner Integrations config — lets the owner paste provider credentials in-app
// instead of editing Vercel by hand. Credentials are written straight to the
// project's Vercel environment (encrypted there) and applied with a redeploy.
// This is deliberately NOT a database store: the durable DB is off, and the
// sign-in providers (Google, email) are read at app startup, so they only take
// effect as real env vars on a new deployment.
//
// SERVER ONLY. Never import from a client component. Secret values are never
// returned to the client — only "set / not set" status. The setter accepts only
// the fixed allowlist below, never arbitrary keys.

import { CREDENTIAL_REGISTRY } from "@/lib/engine/ecosystem-credential-registry";

export type IntegrationField = {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  placeholder?: string;
  help?: string;
};

export const INTEGRATION_FIELDS: IntegrationField[] = [
  { key: "AUTH_GOOGLE_ID", label: "Google Client ID", group: "Sign-in", secret: false, placeholder: "…apps.googleusercontent.com" },
  { key: "AUTH_GOOGLE_SECRET", label: "Google Client Secret", group: "Sign-in", secret: true },
  { key: "AUTH_RESEND_KEY", label: "Resend API Key (email sign-in)", group: "Sign-in", secret: true, placeholder: "re_…" },
  { key: "EMAIL_FROM", label: "Email From Address", group: "Sign-in", secret: false, placeholder: "AppEngine <signin@we-succeed.org>" },
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", group: "AI builds", secret: true, placeholder: "sk-…" },
  { key: "OPENAI_MODEL", label: "OpenAI Model", group: "AI builds", secret: false, placeholder: "gpt-5.1" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", group: "Payments", secret: true, placeholder: "sk_live_… (use sk_test_… first)" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Signing Secret", group: "Payments", secret: true, placeholder: "whsec_…" },
  { key: "APP_ENGINE_BILLING_ENABLED", label: "Billing enabled (true to charge for builds)", group: "Payments", secret: false, placeholder: "false" },
  { key: "SPACESHIP_API_KEY", label: "Spaceship API Key (custom domains)", group: "Domains", secret: true },
  { key: "SPACESHIP_API_SECRET", label: "Spaceship API Secret", group: "Domains", secret: true },
  { key: "SPACESHIP_CONTACT_ID", label: "Spaceship Contact ID (registrant for purchases)", group: "Domains", secret: false },
  { key: "PORKBUN_API_KEY", label: "Porkbun API Key (alt. registrar)", group: "Domains", secret: true, placeholder: "pk1_…" },
  { key: "PORKBUN_SECRET_KEY", label: "Porkbun Secret Key", group: "Domains", secret: true, placeholder: "sk1_…" }
];

const VERCEL_API = "https://api.vercel.com";

function projectId() {
  return process.env.VERCEL_PROJECT_ID?.trim();
}

// The We Succeed (AppEngine) project id, for the page's own-keys section.
export function appEngineProjectId() {
  return projectId();
}

// A plausible environment-variable NAME (not the value). Lets the owner add a
// custom variable without opening the door to obviously-malformed keys.
export function isValidEnvKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,63}$/i.test(key.trim());
}

function token() {
  return process.env.VERCEL_TOKEN?.trim();
}

export function hasVercelConfigApi() {
  return Boolean(token() && projectId());
}

function isAllowedKey(key: string) {
  return INTEGRATION_FIELDS.some((field) => field.key === key);
}

async function vercelFetch(pathAndQuery: string, init?: RequestInit) {
  return fetch(`${VERCEL_API}${pathAndQuery}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token()}`,
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
}

// Which allowlisted keys are set in the project's PRODUCTION env. Never returns
// values — only presence. Falls back to runtime env presence if the API is down.
export async function getIntegrationStatuses(): Promise<Record<string, boolean>> {
  const statuses: Record<string, boolean> = {};
  const runtimeFallback = () => {
    for (const field of INTEGRATION_FIELDS) {
      statuses[field.key] = Boolean(process.env[field.key]);
    }
    return statuses;
  };

  if (!hasVercelConfigApi()) {
    return runtimeFallback();
  }

  try {
    const response = await vercelFetch(`/v9/projects/${projectId()}/env`);
    if (!response.ok) {
      return runtimeFallback();
    }
    const data = (await response.json()) as { envs?: Array<{ key?: string; target?: string[] }> };
    const setKeys = new Set(
      (data.envs || [])
        .filter((entry) => Array.isArray(entry.target) && entry.target.includes("production"))
        .map((entry) => entry.key)
    );
    for (const field of INTEGRATION_FIELDS) {
      statuses[field.key] = setKeys.has(field.key);
    }
    return statuses;
  } catch {
    return runtimeFallback();
  }
}

export type IntegrationActionResult = { ok: boolean; message: string };

// The one write path: upsert a single variable into a target Vercel project's
// PRODUCTION env, encrypted. Every setter below funnels through this so there is
// ONE mechanism, parameterized by which app's project it targets — instead of a
// separate mechanism per surface. Requires a VERCEL_TOKEN (the account token can
// write any project in the account); the target project id is supplied by the
// caller (the We Succeed project for own-keys, an app's registry project id for
// per-app keys). Never returns the value; owner-only is enforced at the route.
export async function setProjectEnvValue(
  targetProjectId: string,
  key: string,
  rawValue: string,
  opts: { secret: boolean; label?: string }
): Promise<IntegrationActionResult> {
  if (!token()) {
    return { ok: false, message: "Hosting API isn't configured (no VERCEL_TOKEN)." };
  }
  if (!targetProjectId) {
    return { ok: false, message: "No target app project — set this in the provider's dashboard." };
  }
  const value = rawValue.trim();
  if (!value) {
    return { ok: false, message: "Enter a value first." };
  }
  const label = opts.label || key;
  try {
    const response = await vercelFetch(`/v10/projects/${encodeURIComponent(targetProjectId)}/env?upsert=true`, {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type: opts.secret ? "encrypted" : "plain",
        target: ["production", "preview"]
      })
    });
    if (!response.ok) {
      return { ok: false, message: `Couldn't save ${label} (${response.status}). Check the value and try again.` };
    }
    return { ok: true, message: `${label} saved. Redeploy that app to make it live.` };
  } catch {
    return { ok: false, message: "Couldn't reach the hosting API. Try again." };
  }
}

// We Succeed's own allowlisted fields (direct write to the We Succeed project).
export async function setIntegrationValue(key: string, rawValue: string): Promise<IntegrationActionResult> {
  const field = INTEGRATION_FIELDS.find((entry) => entry.key === key);
  if (!field || !isAllowedKey(key)) {
    return { ok: false, message: "That setting isn't editable here." };
  }
  const target = appEngineProjectId();
  if (!target) {
    return { ok: false, message: "Hosting API isn't configured (VERCEL_TOKEN + VERCEL_PROJECT_ID)." };
  }
  const result = await setProjectEnvValue(target, key, rawValue, { secret: field.secret, label: field.label });
  return result.ok
    ? { ok: true, message: `${field.label} saved. Click “Apply changes” to make it live.` }
    : result;
}

// Add ANY variable to We Succeed (the custom-variable row) — the thing that used
// to only exist on the separate "Your keys" vault. Validates the NAME format;
// treats it as a secret (encrypted at rest in Vercel).
export async function setCustomIntegrationValue(key: string, rawValue: string): Promise<IntegrationActionResult> {
  const name = key.trim().toUpperCase();
  if (!isValidEnvKey(name)) {
    return { ok: false, message: "Use a valid variable name (letters, numbers, underscores; e.g. MY_API_KEY)." };
  }
  const target = appEngineProjectId();
  if (!target) {
    return { ok: false, message: "Hosting API isn't configured (VERCEL_TOKEN + VERCEL_PROJECT_ID)." };
  }
  return setProjectEnvValue(target, name, rawValue, { secret: true, label: name });
}

// Per-app: save a variable straight into a registered app's OWN Vercel project.
// The app + its pushable Vercel keys come from the credential registry (the same
// data the old /credentials page used) — so managing an app's secrets lives here
// on Integrations, not on a separate page. Only a Vercel-hosted key defined for
// that app is accepted; Render/Supabase keys stay in their dashboards.
export async function setAppEnvValue(slug: string, key: string, rawValue: string): Promise<IntegrationActionResult> {
  const group = CREDENTIAL_REGISTRY.find((entry) => entry.slug === slug);
  if (!group || !group.vercelProjectId) {
    return { ok: false, message: "That app isn't a Vercel project I can write to. Set it in the provider's dashboard." };
  }
  const field = group.keys.find((entry) => entry.envVar === key && entry.host === "vercel");
  if (!field) {
    return { ok: false, message: "That variable isn't a Vercel slot for this app." };
  }
  return setProjectEnvValue(group.vercelProjectId, key, rawValue, { secret: field.secret, label: `${group.name} · ${field.envVar}` });
}

// Triggers a fresh production deployment so saved credentials take effect.
export async function applyIntegrationChanges(): Promise<IntegrationActionResult> {
  if (!hasVercelConfigApi()) {
    return { ok: false, message: "Hosting API isn't configured." };
  }
  try {
    const projectResponse = await vercelFetch(`/v9/projects/${projectId()}`);
    if (!projectResponse.ok) {
      return { ok: false, message: "Couldn't read the project to redeploy." };
    }
    const project = (await projectResponse.json()) as { link?: { repoId?: number | string; productionBranch?: string } };
    const repoId = project.link?.repoId;
    const ref = project.link?.productionBranch || "main";
    if (!repoId) {
      return { ok: false, message: "No connected Git repo found to redeploy from." };
    }

    const deployResponse = await vercelFetch(`/v13/deployments`, {
      method: "POST",
      body: JSON.stringify({
        name: "app-engine",
        target: "production",
        gitSource: { type: "github", repoId, ref }
      })
    });
    if (!deployResponse.ok) {
      return { ok: false, message: `Redeploy didn't start (${deployResponse.status}). It may be rate-limited; try later.` };
    }
    return { ok: true, message: "Redeploy started — changes go live in a few minutes." };
  } catch {
    return { ok: false, message: "Couldn't start a redeploy. Try again." };
  }
}
