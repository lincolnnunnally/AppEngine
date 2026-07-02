// Deploys a generated app bundle to a BRAND-NEW Vercel project under the account
// and makes it publicly viewable. Proven end-to-end (file upload by sha -> project
// + build -> disable deployment protection -> live public URL). Two gotchas baked in:
//   * the bundle must pin non-vulnerable dependency versions (Vercel rejects flagged
//     ones — e.g. it errored a deploy on a CVE-flagged Next.js version);
//   * new Vercel projects have Deployment Protection ON, so we turn it off (ssoProtection
//     = null) — otherwise the URL shows a Vercel login instead of the app.
// A real build takes ~30-60s (longer than a serverless function can block), so this
// KICKS OFF the deploy and returns the URL + id; the build finishes async and state
// is polled via getDeploymentState. SERVER ONLY (uses VERCEL_TOKEN).
import crypto from "node:crypto";

const VERCEL_API = "https://api.vercel.com";

export type DeployFile = { path: string; content: string };
export type DeployResult = {
  ok: boolean;
  url?: string;
  projectName?: string;
  deploymentId?: string;
  state?: string;
  message?: string;
};

function token() {
  return process.env.VERCEL_TOKEN?.trim();
}

export function vercelDeployConfigured() {
  return Boolean(token());
}

// Vercel project names: lowercase, alphanumeric + hyphens. Unique per app.
export function projectNameFromSlug(slug: string): string {
  const base =
    (slug || "app")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "app";
  const suffix = crypto.randomBytes(3).toString("hex");
  return `wesucceed-${base}-${suffix}`.slice(0, 90);
}

async function vercel(path: string, init?: RequestInit) {
  return fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token()}`, ...(init?.headers || {}) }
  });
}

export async function deployGeneratedAppToVercel(
  slug: string,
  files: DeployFile[],
  env?: Record<string, string>,
  options: { target?: "production" | "preview" } = {}
): Promise<DeployResult> {
  if (!vercelDeployConfigured()) {
    return { ok: false, message: "Vercel deploy isn't configured (VERCEL_TOKEN)." };
  }
  if (!files.length) {
    return { ok: false, message: "No files to deploy." };
  }

  const projectName = projectNameFromSlug(slug);

  try {
    // 0. Create the project up front + set its env, so the build/runtime have the
    //    app's own DATABASE_URL etc. (env applies to deployments created after it).
    if (env && Object.keys(env).length) {
      await vercel("/v9/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: projectName, framework: "nextjs" })
      }).catch(() => {});
      for (const [key, value] of Object.entries(env)) {
        if (!value) continue;
        await vercel(`/v10/projects/${encodeURIComponent(projectName)}/env?upsert=true`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview"] })
        }).catch(() => {});
      }
    }

    // 1. Upload each file by sha.
    const refs: Array<{ file: string; sha: string; size: number }> = [];
    for (const file of files) {
      const buf = Buffer.from(file.content, "utf8");
      const sha = crypto.createHash("sha1").update(buf).digest("hex");
      const up = await vercel("/v2/files", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "x-vercel-digest": sha },
        body: buf
      });
      if (!up.ok) {
        return { ok: false, projectName, message: `File upload failed (${up.status}).` };
      }
      refs.push({ file: file.path, sha, size: buf.length });
    }

    // 2. Create the deployment (this also creates the project, named by `name`).
    //    A PREVIEW deployment is made by OMITTING `target` (the API only accepts
    //    "production"/"staging" as explicit targets); production points the
    //    project's canonical domain at the deployment.
    const target = options.target ?? "production";
    const dep = await vercel("/v13/deployments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: projectName,
        files: refs,
        projectSettings: { framework: "nextjs" },
        ...(target === "production" ? { target: "production" } : {})
      })
    });
    const depData = (await dep.json().catch(() => ({}))) as {
      id?: string;
      uid?: string;
      url?: string;
      readyState?: string;
      error?: { message?: string };
    };
    if (!dep.ok) {
      return { ok: false, projectName, message: `Deploy didn't start (${dep.status}): ${depData.error?.message || ""}` };
    }

    // 3. Make the URL public — new projects gate it behind a Vercel login otherwise.
    await vercel(`/v9/projects/${encodeURIComponent(projectName)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ssoProtection: null })
    }).catch(() => {});

    return {
      ok: true,
      url: depData.url ? `https://${depData.url}` : undefined,
      projectName,
      deploymentId: depData.id || depData.uid,
      state: depData.readyState || "BUILDING"
    };
  } catch (error) {
    return { ok: false, projectName, message: error instanceof Error ? error.message : "Deploy error." };
  }
}

// The approve step: points the project's production domain at an existing
// (already tested) deployment — no rebuild, no new files needed. This is what a
// customer's "Make it official" button and the owner's engine approval both call.
export async function promoteDeploymentToProduction(
  projectName: string,
  deploymentId: string
): Promise<{ ok: boolean; message: string; productionUrl?: string }> {
  if (!vercelDeployConfigured()) {
    return { ok: false, message: "Hosting isn't configured (VERCEL_TOKEN)." };
  }
  try {
    const response = await vercel(
      `/v10/projects/${encodeURIComponent(projectName)}/promote/${encodeURIComponent(deploymentId)}`,
      { method: "POST" }
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, message: data.error?.message || `Couldn't make it official (${response.status}).` };
    }
    return { ok: true, message: "This version is now official.", productionUrl: `https://${projectName}.vercel.app` };
  } catch {
    return { ok: false, message: "Couldn't reach the hosting API." };
  }
}

// Completion gate (AIPOS pattern): a build is only "live" once the URL actually
// responds — not merely once Vercel reports READY. Best-effort; a transient miss
// just means we report not-yet-verified, never a false failure.
export async function verifyDeployedApp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual" });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

// Async status check for a kicked-off deployment (the build finishes after we return).
export async function getDeploymentState(deploymentId: string): Promise<{ state: string; url?: string }> {
  try {
    const r = await vercel(`/v13/deployments/${encodeURIComponent(deploymentId)}`);
    const d = (await r.json().catch(() => ({}))) as { readyState?: string; status?: string; url?: string };
    return { state: d.readyState || d.status || "UNKNOWN", url: d.url ? `https://${d.url}` : undefined };
  } catch {
    return { state: "UNKNOWN" };
  }
}
