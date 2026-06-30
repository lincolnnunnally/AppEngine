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
  { key: "EMAIL_FROM", label: "Email From Address", group: "Sign-in", secret: false, placeholder: "We Succeed <signin@we-succeed.org>" },
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", group: "AI builds", secret: true, placeholder: "sk-…" },
  { key: "OPENAI_MODEL", label: "OpenAI Model", group: "AI builds", secret: false, placeholder: "gpt-5.1" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", group: "Payments", secret: true, placeholder: "sk_live_… (use sk_test_… first)" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Signing Secret", group: "Payments", secret: true, placeholder: "whsec_…" },
  { key: "APP_ENGINE_BILLING_ENABLED", label: "Billing enabled (true to charge for builds)", group: "Payments", secret: false, placeholder: "false" },
  { key: "SPACESHIP_API_KEY", label: "Spaceship API Key (custom domains)", group: "Domains", secret: true },
  { key: "SPACESHIP_API_SECRET", label: "Spaceship API Secret", group: "Domains", secret: true },
  { key: "PORKBUN_API_KEY", label: "Porkbun API Key (alt. registrar)", group: "Domains", secret: true, placeholder: "pk1_…" },
  { key: "PORKBUN_SECRET_KEY", label: "Porkbun Secret Key", group: "Domains", secret: true, placeholder: "sk1_…" }
];

const VERCEL_API = "https://api.vercel.com";

function projectId() {
  return process.env.VERCEL_PROJECT_ID?.trim();
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

// Upserts a single allowlisted credential into the project's PRODUCTION env.
export async function setIntegrationValue(key: string, rawValue: string): Promise<IntegrationActionResult> {
  const field = INTEGRATION_FIELDS.find((entry) => entry.key === key);
  if (!field || !isAllowedKey(key)) {
    return { ok: false, message: "That setting isn't editable here." };
  }
  if (!hasVercelConfigApi()) {
    return { ok: false, message: "Hosting API isn't configured (VERCEL_TOKEN + VERCEL_PROJECT_ID)." };
  }
  const value = rawValue.trim();
  if (!value) {
    return { ok: false, message: "Enter a value first." };
  }

  try {
    const response = await vercelFetch(`/v10/projects/${projectId()}/env?upsert=true`, {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type: field.secret ? "encrypted" : "plain",
        target: ["production"]
      })
    });
    if (!response.ok) {
      return { ok: false, message: `Couldn't save (${response.status}). Check the value and try again.` };
    }
    return { ok: true, message: `${field.label} saved. Click “Apply changes” to make it live.` };
  } catch {
    return { ok: false, message: "Couldn't reach the hosting API. Try again." };
  }
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
