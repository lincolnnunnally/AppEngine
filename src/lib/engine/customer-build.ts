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
import { generateProjectApp } from "@/lib/engine/app-generator";
import { canAffordBuild, chargeForBuild, isBillingEnabled } from "@/lib/engine/billing";
import type { BuildGateClearance } from "@/lib/engine/build-gate";
import { createLocalPlannedProject } from "@/lib/engine/development-store";
import { prepareProjectDeployment, runProjectAgents } from "@/lib/engine/execution";
import { isLocalMode } from "@/lib/engine/local-mode";
import { getLlmUsageTotals } from "@/lib/engine/llm-usage";

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
  name?: string
): Promise<BilledBuildResult & { projectId: string }> {
  if (!isLocalMode()) {
    throw new CustomerBuildUnavailableError("Customer builds aren't enabled on production yet.");
  }

  const at = new Date().toISOString();
  const created = await createLocalPlannedProject(
    { idea, name, revenueModel: "Not sure yet", appType: "Auto detect" },
    { customerEmail: userKey, gateClearance: customerGateClearance(userKey, at) }
  );
  const projectId = created.project.id;
  const result = await runBilledBuild(projectId, userKey);
  return { projectId, ...result };
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
export async function runBilledBuild(projectId: string, customerKey?: string): Promise<BilledBuildResult> {
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
  const generated = await generateProjectApp(projectId);
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
