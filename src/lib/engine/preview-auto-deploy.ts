// Deployment gate execution (preview only) — spec: source-of-truth/autonomous-build-activation.md.
// When a prepared deployment comes back deployment_ready AND APP_ENGINE_AUTO_DEPLOY_PREVIEW=true,
// this executes the preview deploy instead of only recording the commands. It reuses the PROVEN
// API-based deploy module (a serverless route cannot run the Vercel CLI). Production is NEVER
// auto-deployed: this module only ever targets preview, and no code path reads
// APP_ENGINE_AUTO_DEPLOY_PRODUCTION. Every blocker computed by prepare still applies — this runs
// only after prepare says deployment_ready. SERVER ONLY.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDatabase } from "@/lib/db/client";
import { createLocalDeployment } from "./development-store";
import { isLocalMode } from "./local-mode";
import { deployGeneratedAppToVercel, projectNameFromSlug, type DeployFile, type DeployResult } from "./vercel-deploy";

export function autoDeployPreviewEnabled() {
  return process.env.APP_ENGINE_AUTO_DEPLOY_PREVIEW === "true";
}

function timeoutSeconds(): number {
  const raw = Number.parseInt(process.env.APP_ENGINE_DEPLOYMENT_TIMEOUT_SECONDS || "3600", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 3600;
}

export type AutoDeployOutcome = {
  attempted: boolean;
  ok: boolean;
  message: string;
  url?: string;
  projectName?: string;
};

// Reads the generated bundle back from disk (same pattern as the customer chain).
// The bundle is only guaranteed present in the runtime that generated it — when it
// is absent, that is reported as a blocker, not an error.
async function readGeneratedBundle(projectId: string): Promise<{ files: DeployFile[]; slug: string }> {
  const root = join(process.cwd(), ".app-engine", "generated-apps");
  const dirs = await readdir(root).catch(() => [] as string[]);
  const dir = dirs.find((entry) => entry.startsWith(projectId));
  if (!dir) return { files: [], slug: "" };
  const base = join(root, dir);
  const files: DeployFile[] = [];

  async function walk(rel: string) {
    const entries = await readdir(join(base, rel), { withFileTypes: true });
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        await walk(childRel);
      } else if (!entry.name.startsWith("app-engine-")) {
        files.push({ path: childRel, content: await readFile(join(base, childRel), "utf8") });
      }
    }
  }

  await walk("");
  return { files, slug: dir.slice(projectId.length + 1) || projectId };
}

// Executes the preview deploy for a project whose prepare came back deployment_ready.
// Records the outcome through the existing deployments persistence so the monitor's
// next cycle (and the owner) can see exactly what ran and why.
export async function executePreviewAutoDeploy(projectId: string): Promise<AutoDeployOutcome> {
  if (!autoDeployPreviewEnabled()) {
    return { attempted: false, ok: false, message: "Auto-deploy for previews is off (APP_ENGINE_AUTO_DEPLOY_PREVIEW)." };
  }

  const { files, slug } = await readGeneratedBundle(projectId);
  if (!files.length) {
    const message = "Generated bundle not present in this runtime — regenerate and deploy in one run.";
    await recordOutcome(projectId, { ok: false, message });
    return { attempted: true, ok: false, message };
  }

  const budgetMs = timeoutSeconds() * 1000;
  const timer = new Promise<DeployResult>((resolve) =>
    setTimeout(() => resolve({ ok: false, message: `Deploy timed out after ${timeoutSeconds()}s.` }), budgetMs)
  );

  const result = await Promise.race([deployGeneratedAppToVercel(slug, files), timer]);
  await recordOutcome(projectId, result);

  return {
    attempted: true,
    ok: result.ok,
    message: result.message || (result.ok ? "Preview deployed." : "Preview deploy failed."),
    url: result.url,
    projectName: result.projectName || projectNameFromSlug(slug)
  };
}

async function recordOutcome(projectId: string, result: { ok: boolean; message?: string; url?: string; projectName?: string; deploymentId?: string }) {
  const payload = {
    provider: "vercel",
    environment: "preview",
    status: result.ok ? "deployed_preview" : "deploy_failed",
    url: result.url,
    details: result.ok
      ? `Preview auto-deploy succeeded${result.url ? ` at ${result.url}` : ""}.`
      : `Preview auto-deploy failed: ${result.message || "unknown error"}.`,
    commands: [],
    verified_at: result.ok ? new Date().toISOString() : undefined,
    metadata: { autoDeploy: true, projectName: result.projectName, deploymentId: result.deploymentId }
  };

  try {
    if (isLocalMode()) {
      await createLocalDeployment(projectId, payload as Parameters<typeof createLocalDeployment>[1]);
      return;
    }
    const sql = getDatabase();
    await sql`
      insert into deployments (project_id, provider, environment, status, url, metadata, verified_at)
      values (${projectId}, 'vercel', 'preview', ${payload.status}, ${result.url || null}, ${JSON.stringify(payload.metadata)}, ${payload.verified_at || null})
    `;
    await sql`
      insert into audit_events (project_id, event_type, event_data)
      values (${projectId}, 'project.preview_auto_deploy', ${JSON.stringify({ ok: result.ok, url: result.url || null, message: result.message || null })})
    `;
  } catch {
    // Recording must never mask the deploy result itself.
  }
}
