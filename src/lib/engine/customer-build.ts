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
import { prepareProjectDeployment, runProjectAgents } from "@/lib/engine/execution";
import { getLlmUsageTotals } from "@/lib/engine/llm-usage";

export class BuildAffordabilityError extends Error {
  code = "INSUFFICIENT_CREDITS";
  constructor(message: string) {
    super(message);
    this.name = "BuildAffordabilityError";
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
