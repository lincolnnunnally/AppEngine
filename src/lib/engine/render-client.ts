// Render REST API client — the missing half of "paste a key -> the app uses it."
// The vault could always STORE a RENDER_API_KEY; nothing ever consumed it. This is
// the consumer: given the account API key, it creates a web service from a repo
// (the fields we'd otherwise transcribe from render.yaml), sets its env, and
// triggers a deploy — the same shape vercel-deploy.ts already does for Vercel, but
// against api.render.com/v1. That turns "stand up laser-engrave-api" from a manual
// Render-dashboard chore into one owner-initiated action.
//
// Deliberately generic (no Laser specifics live here) so it works for any Render
// backend in the ecosystem (Laser api, ChurchConnect backend, …). SERVER ONLY —
// the API key is a full-account credential; never import from a client component.
//
// One honest limitation: an API-created service builds from a GitHub repo, so the
// Render ACCOUNT must already have that repo connected/authorized once. The API key
// alone can't grant repo access. When it isn't connected, create returns a repo
// error and we surface it plainly so the owner does the one-time connect.

const RENDER_API = "https://api.render.com/v1";

export type RenderEnvVar = { key: string; value?: string; generateValue?: boolean };

export type RenderWebServiceSpec = {
  name: string; // unique service name, e.g. laser-engrave-api
  repo: string; // https://github.com/owner/repo
  branch: string; // e.g. main
  rootDir: string; // e.g. backend
  runtime: string; // native runtime, e.g. "python" | "node"
  plan: string; // "free" | "starter" | …
  region?: string; // "oregon" (default) | "ohio" | "virginia" | …
  healthCheckPath?: string; // e.g. /api/health
  buildCommand: string;
  startCommand: string;
  envVars: RenderEnvVar[];
};

export type RenderDeployResult = {
  ok: boolean;
  message: string;
  created?: boolean; // true if we created the service, false if it already existed
  serviceId?: string;
  deployId?: string;
  serviceUrl?: string; // the live https URL of the service
  dashboardUrl?: string; // the Render dashboard page for the owner
  needsRepoConnect?: boolean; // the one manual step: connect the repo on Render once
};

export function renderTokenFromEnv(): string | undefined {
  return process.env.RENDER_API_KEY?.trim();
}

function headers(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

async function render(apiKey: string, path: string, init?: RequestInit) {
  return fetch(`${RENDER_API}${path}`, { ...init, headers: { ...headers(apiKey), ...(init?.headers || {}) } });
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  return data?.message || data?.error || `${fallback} (${res.status}).`;
}

// Confirms the key works at all (cheap owners lookup) — used to give a clear
// "that key didn't work" instead of a confusing downstream failure.
export async function verifyRenderKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await render(apiKey, "/owners?limit=1");
    if (res.status === 401 || res.status === 403) return { ok: false, message: "That Render API key was rejected — double-check you pasted the whole key." };
    if (!res.ok) return { ok: false, message: await errorMessage(res, "Render didn't accept the key") };
    return { ok: true, message: "Render key works." };
  } catch {
    return { ok: false, message: "Couldn't reach Render just now — try again." };
  }
}

// The workspace/owner that will own the created service. A personal token usually
// has exactly one owner (type "user"); we prefer that, else the first returned.
export async function getRenderOwnerId(apiKey: string): Promise<string | null> {
  try {
    const res = await render(apiKey, "/owners?limit=20");
    if (!res.ok) return null;
    const data = (await res.json().catch(() => [])) as Array<{ owner?: { id?: string; type?: string } }>;
    const owners = data.map((row) => row.owner).filter(Boolean) as Array<{ id?: string; type?: string }>;
    const user = owners.find((o) => o.type === "user");
    return (user?.id || owners[0]?.id) ?? null;
  } catch {
    return null;
  }
}

// Idempotency: find an existing service by exact name so a re-run updates instead
// of failing on a duplicate.
export async function findRenderServiceByName(
  apiKey: string,
  name: string
): Promise<{ id: string; serviceUrl?: string; dashboardUrl?: string } | null> {
  try {
    const res = await render(apiKey, `/services?name=${encodeURIComponent(name)}&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json().catch(() => [])) as Array<{
      service?: { id?: string; dashboardUrl?: string; serviceDetails?: { url?: string } };
    }>;
    const svc = data[0]?.service;
    if (!svc?.id) return null;
    return { id: svc.id, serviceUrl: svc.serviceDetails?.url, dashboardUrl: svc.dashboardUrl };
  } catch {
    return null;
  }
}

// Replace the full env-var set on an existing service (used on a re-run before we
// re-deploy). Render's PUT replaces the list, so pass the complete set.
export async function replaceServiceEnvVars(apiKey: string, serviceId: string, envVars: RenderEnvVar[]): Promise<boolean> {
  try {
    const res = await render(apiKey, `/services/${encodeURIComponent(serviceId)}/env-vars`, {
      method: "PUT",
      body: JSON.stringify(envVars.map((e) => (e.generateValue ? { key: e.key, generateValue: true } : { key: e.key, value: e.value ?? "" }))),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Trigger a fresh deploy of an existing service (latest commit on its branch).
export async function triggerRenderDeploy(apiKey: string, serviceId: string): Promise<{ ok: boolean; deployId?: string; message: string }> {
  try {
    const res = await render(apiKey, `/services/${encodeURIComponent(serviceId)}/deploys`, {
      method: "POST",
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    });
    if (!res.ok) return { ok: false, message: await errorMessage(res, "Render didn't start the deploy") };
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, deployId: data.id, message: "Deploy started." };
  } catch {
    return { ok: false, message: "Couldn't reach Render just now — try again." };
  }
}

const REPO_ERROR_HINT = /repo|repository|github|permission|access|not found|connect/i;

// Create a web service from a repo + set its env. autoDeploy "yes" makes Render
// kick off the first build immediately, so the 201 already carries a deployId.
export async function createRenderWebService(apiKey: string, spec: RenderWebServiceSpec): Promise<RenderDeployResult> {
  const ownerId = await getRenderOwnerId(apiKey);
  if (!ownerId) {
    return { ok: false, message: "Couldn't read your Render workspace — is the API key valid and does the account have a workspace?" };
  }

  const body = {
    type: "web_service",
    name: spec.name,
    ownerId,
    repo: spec.repo,
    branch: spec.branch,
    rootDir: spec.rootDir,
    autoDeploy: "yes",
    envVars: spec.envVars.map((e) => (e.generateValue ? { key: e.key, generateValue: true } : { key: e.key, value: e.value ?? "" })),
    serviceDetails: {
      runtime: spec.runtime,
      env: spec.runtime, // some API versions read `env`, others `runtime`; send both
      plan: spec.plan,
      region: spec.region || "oregon",
      ...(spec.healthCheckPath ? { healthCheckPath: spec.healthCheckPath } : {}),
      envSpecificDetails: { buildCommand: spec.buildCommand, startCommand: spec.startCommand },
    },
  };

  try {
    const res = await render(apiKey, "/services", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      const message = await errorMessage(res, "Render rejected the service");
      const needsRepoConnect = res.status === 400 && REPO_ERROR_HINT.test(message);
      return {
        ok: false,
        needsRepoConnect,
        message: needsRepoConnect
          ? `Render can't reach the repo yet: "${message}". Connect ${spec.repo} to your Render account once (Render → New → and authorize the GitHub repo), then click Deploy again — after that it's fully automatic.`
          : message,
      };
    }
    const data = (await res.json().catch(() => ({}))) as {
      service?: { id?: string; dashboardUrl?: string; serviceDetails?: { url?: string } };
      deployId?: string;
    };
    return {
      ok: true,
      created: true,
      serviceId: data.service?.id,
      deployId: data.deployId,
      serviceUrl: data.service?.serviceDetails?.url,
      dashboardUrl: data.service?.dashboardUrl,
      message: "Service created — Render is building it now.",
    };
  } catch {
    return { ok: false, message: "Couldn't reach Render just now — try again." };
  }
}

// The whole action: create the service if it's new, or update env + redeploy if it
// already exists. One call the deploy route can lean on.
export async function createOrUpdateRenderWebService(apiKey: string, spec: RenderWebServiceSpec): Promise<RenderDeployResult> {
  const existing = await findRenderServiceByName(apiKey, spec.name);
  if (!existing) {
    return createRenderWebService(apiKey, spec);
  }
  // Update the env (keep generated values untouched by omitting them) then redeploy.
  const settable = spec.envVars.filter((e) => !e.generateValue);
  await replaceServiceEnvVars(apiKey, existing.id, settable);
  const deploy = await triggerRenderDeploy(apiKey, existing.id);
  return {
    ok: deploy.ok,
    created: false,
    serviceId: existing.id,
    deployId: deploy.deployId,
    serviceUrl: existing.serviceUrl,
    dashboardUrl: existing.dashboardUrl,
    message: deploy.ok ? `${spec.name} already existed — updated its env and started a fresh deploy.` : deploy.message,
  };
}

export type RenderDeployStatus =
  | "created" | "queued" | "build_in_progress" | "update_in_progress" | "pre_deploy_in_progress"
  | "live" | "build_failed" | "update_failed" | "pre_deploy_failed" | "canceled" | "deactivated" | "unknown";

const TERMINAL_OK: RenderDeployStatus[] = ["live"];
const TERMINAL_FAIL: RenderDeployStatus[] = ["build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"];

export function isTerminalDeploy(status: RenderDeployStatus): "ok" | "fail" | "pending" {
  if (TERMINAL_OK.includes(status)) return "ok";
  if (TERMINAL_FAIL.includes(status)) return "fail";
  return "pending";
}

// Poll one deploy's status (the build finishes long after the create call returns,
// exactly like the Vercel path — the caller polls rather than blocking).
export async function getRenderDeployStatus(apiKey: string, serviceId: string, deployId: string): Promise<RenderDeployStatus> {
  try {
    const res = await render(apiKey, `/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployId)}`);
    if (!res.ok) return "unknown";
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    return (data.status as RenderDeployStatus) || "unknown";
  } catch {
    return "unknown";
  }
}

// Completion gate (same idea as verifyDeployedApp for Vercel): a backend is only
// really live once its health path actually answers.
export async function verifyRenderHealth(serviceUrl: string, healthPath = "/api/health"): Promise<boolean> {
  try {
    const base = serviceUrl.replace(/\/$/, "");
    const res = await fetch(`${base}${healthPath}`, { method: "GET" });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}
