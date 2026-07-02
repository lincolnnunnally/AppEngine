// Customer build orchestration — the spine of "idea → built app", with billing.
// It runs the EXISTING real pipeline in order (agents → generate real source →
// prepare deployment) and closes the billing loop around it:
//   - before: require the customer can afford to start (when billing is on),
//   - after: charge their REAL measured cost + margin (metering delta), never a
//     flat fee and never mid-build.
//
// What this deliberately does NOT do yet (each is an owner decision / approval):
//   - create the customer-owned, gate-cleared project (needs the prod gate-
//     clearance migration; works today only in local mode),
//   - EXECUTE a real Vercel deploy (the pipeline still only PREPARES deploy
//     commands — real execution is a separate, outward-facing build),
//   - auto-provision a per-app Neon database.
// So this is safe: billing is dormant until enabled, and deploy stays prepare-only.
import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateProjectApp } from "@/lib/engine/app-generator";
import { canAffordBuild, chargeForBuild, isBillingEnabled } from "@/lib/engine/billing";
import type { BuildGateClearance } from "@/lib/engine/build-gate";
import { updateBuildJob } from "@/lib/engine/build-jobs";
import { provisionGeneratedAppDatabaseUrl, setupGeneratedAppDatabase } from "@/lib/engine/database-setup";
import { createLocalPlannedProject } from "@/lib/engine/development-store";
import { prepareProjectDeployment, runProjectAgents } from "@/lib/engine/execution";
import type { Brand } from "@/lib/engine/themes";
import { isLocalMode } from "@/lib/engine/local-mode";
import { getLlmUsageTotals } from "@/lib/engine/llm-usage";
import { createPlannedProject } from "@/lib/engine/persistence";
import { deployGeneratedAppToVercel, projectNameFromSlug, type DeployFile } from "@/lib/engine/vercel-deploy";
import { resolveEnvForApp } from "@/lib/engine/env-vault";

export class BuildAffordabilityError extends Error {
  code = "INSUFFICIENT_CREDITS";
  constructor(message: string) {
    super(message);
    this.name = "BuildAffordabilityError";
  }
}

export class CustomerBuildUnavailableError extends Error {
  code = "CUSTOMER_BUILD_NOT_ENABLED";
  constructor(message: string) {
    super(message);
    this.name = "CustomerBuildUnavailableError";
  }
}

// The clearance a customer build carries through the canonical build gate: they
// came through intake + the conversation (clarification) and we're building new.
function customerGateClearance(userKey: string, at: string): BuildGateClearance {
  return {
    intakeGateId: `customer:${userKey}:${at}`,
    clarified: true,
    priorWork: { passed: true, verdict: "build_new" }
  };
}

// Customer's described idea -> a project they own that's cleared to build -> a
// billed build. Local/dev only until the production customer-projects migration
// is applied (gate-clearance + owner columns); see db/customer-projects-migration.sql.
export async function startCustomerBuild(
  userKey: string,
  idea: string,
  name?: string,
  themeId?: string,
  brand?: Brand
): Promise<BilledBuildResult & { projectId: string }> {
  const at = new Date().toISOString();
  const input = { idea, name, revenueModel: "Not sure yet", appType: "Auto detect" };
  const ownership = { customerEmail: userKey, gateClearance: customerGateClearance(userKey, at) };

  const created = isLocalMode()
    ? await createLocalPlannedProject(input, ownership)
    : await createPlannedProject(input, ownership);

  const projectId = String((created as { project: { id: string } }).project.id);
  const result = await runBilledBuild(projectId, userKey, themeId, brand);
  return { projectId, ...result };
}

// Reads the generated app bundle back from disk (written moments earlier in this
// same request) into deployable {path, content} files, skipping engine manifests.
async function readGeneratedBundle(projectId: string): Promise<DeployFile[]> {
  const root = join(process.cwd(), ".app-engine", "generated-apps");
  const dirs = await readdir(root).catch(() => [] as string[]);
  const dir = dirs.find((entry) => entry.startsWith(projectId));
  if (!dir) return [];
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
  return files;
}

// The async build worker (run after the response): generate the real app, deploy
// it live to its own Vercel project, and advance the job through its states.
export async function runCustomerBuildJob(jobId: string, userKey: string, idea: string, name?: string, themeId?: string, brand?: Brand): Promise<void> {
  try {
    const built = await startCustomerBuild(userKey, idea, name, themeId, brand);
    await updateBuildJob(jobId, { projectId: built.projectId, status: "deploying" });

    const files = await readGeneratedBundle(built.projectId);
    if (!files.length) {
      await updateBuildJob(jobId, { status: "failed", error: "No generated files were produced to deploy." });
      return;
    }

    // Each customer app gets its OWN isolated Neon database (free tier). Provision
    // it, apply the generated schema, and pass it to the deploy as env so the live
    // app is wired to its own DB. If Neon isn't configured, deploy without one.
    let appEnv: Record<string, string> | undefined;
    try {
      const dbUrl = await provisionGeneratedAppDatabaseUrl(built.projectId, name);
      if (dbUrl) {
        await setupGeneratedAppDatabase(built.projectId).catch(() => {});
        appEnv = { DATABASE_URL: dbUrl, AUTH_SECRET: crypto.randomBytes(32).toString("hex") };
      }
    } catch {
      // Provisioning is best-effort; a build still deploys (DB features need it though).
    }

    // Merge the user's key vault (shared values + this app's overrides) into the
    // deployed app's env, so email/payments/AI just work once keys are stored.
    // Engine-provisioned keys (DATABASE_URL, AUTH_SECRET) always win the merge.
    const appSlug = projectNameFromSlug((name || idea).slice(0, 40));
    const vaultEnv = await resolveEnvForApp(userKey, appSlug).catch(() => ({} as Record<string, string>));
    if (Object.keys(vaultEnv).length) {
      appEnv = { ...vaultEnv, ...(appEnv || {}) };
    }

    // Built-in admin (owner standard): the builder is ALWAYS the owner of their
    // app, and the platform admin (when configured) gets owner access on every
    // app — role by signed-in email, no shared passwords anywhere.
    const platformAdmin = (process.env.APP_ENGINE_PLATFORM_ADMIN_EMAIL || "").trim();
    const ownerEmails = [userKey, platformAdmin].filter(Boolean).join(",");
    appEnv = { ...(appEnv || {}), APP_ENGINE_OWNER_EMAIL: ownerEmails };

    // Preview-first (owner decision, 2026-07-02): the app publishes as a testable
    // PREVIEW the customer can open and try; their explicit "make it official"
    // approval promotes that exact deployment to the app's main link. Applies to
    // first builds and improved versions alike.
    const deploy = await deployGeneratedAppToVercel((name || idea).slice(0, 40), files, appEnv, { target: "preview" });
    if (!deploy.ok) {
      await updateBuildJob(jobId, { status: "failed", error: deploy.message || "Deploy didn't start." });
      return;
    }

    // URL exists now; the Vercel build finishes async — status polling flips it to "live".
    // Persist the Vercel project name so the domain step can attach a bought domain to it.
    await updateBuildJob(jobId, {
      status: "deploying",
      deploymentId: deploy.deploymentId ?? null,
      url: deploy.url ?? null,
      vercelProject: deploy.projectName ?? null
    });
  } catch (error) {
    await updateBuildJob(jobId, { status: "failed", error: error instanceof Error ? error.message : "Build failed." });
  }
}

export type BilledBuildResult = {
  run: Awaited<ReturnType<typeof runProjectAgents>>;
  generated: Awaited<ReturnType<typeof generateProjectApp>>;
  deployment: Awaited<ReturnType<typeof prepareProjectDeployment>>;
  charge: { costCents: number; balanceCents: number } | null;
};

// Runs a full build for an existing (already gate-cleared) project and bills the
// customer for it. `customerKey` is the buyer's email; pass it to bill, omit to
// run unbilled (e.g. owner/dev). The cost is the metering delta across the build
// (the build runs in one request, so its own usage records are the delta).
export async function runBilledBuild(projectId: string, customerKey?: string, themeId?: string, brand?: Brand): Promise<BilledBuildResult> {
  const billed = isBillingEnabled() && Boolean(customerKey);

  if (billed && customerKey) {
    const afford = await canAffordBuild(customerKey);
    if (!afford.ok) {
      throw new BuildAffordabilityError(afford.reason || "Add credits to start a build.");
    }
  }

  const costBeforeUsd = billed ? (await getLlmUsageTotals()).totalCostUsd : 0;

  // The existing, real pipeline. Each step re-checks the build gate itself.
  const run = await runProjectAgents(projectId);
  const generated = await generateProjectApp(projectId, { themeId, brand });
  const deployment = await prepareProjectDeployment(projectId);

  let charge: BilledBuildResult["charge"] = null;
  if (billed && customerKey) {
    const costAfterUsd = (await getLlmUsageTotals()).totalCostUsd;
    const costCents = Math.round(Math.max(0, costAfterUsd - costBeforeUsd) * 100);
    const runId = (run as { run?: { id?: string } })?.run?.id ?? projectId;
    const balanceCents = await chargeForBuild(customerKey, `build:${runId}`, costCents);
    charge = { costCents, balanceCents };
  }

  return { run, generated, deployment, charge };
}
