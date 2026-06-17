import Link from "next/link";
import { redirect } from "next/navigation";
import { HandoffRelayControlCenter } from "@/components/engine/handoff-relay-control-center";
import { OwnerPortfolioDashboard } from "@/components/engine/owner-portfolio-dashboard";
import { FirstEcosystemBuildPacketDraftPanel } from "@/components/opportunity-intake/first-ecosystem-build-packet-draft-panel";
import { FirstRealEcosystemBuildRequestPanel } from "@/components/opportunity-intake/first-real-ecosystem-build-request-panel";
import { OpportunityControlledUseReadinessPanel } from "@/components/opportunity-intake/opportunity-controlled-use-readiness-panel";
import { OpportunityInternalUseCompletionCheckPanel } from "@/components/opportunity-intake/opportunity-internal-use-completion-check-panel";
import { OwnerOpportunityQueue } from "@/components/opportunity-intake/owner-opportunity-queue";
import { OwnerControlCenter as ProblemIntakeOwnerControlCenter } from "@/components/problem-intake-lite/owner-control-center";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadOwnerPortfolioRegistry } from "@/lib/engine/app-portfolio-registry";
import { loadAuditTrailOwnerVisibilityReport } from "@/lib/engine/audit-trail-owner-visibility";
import { listFirstEcosystemBuildPacketDrafts } from "@/lib/engine/first-ecosystem-build-packet-draft";
import {
  firstRealEcosystemBuildRequestSeed,
  listFirstRealEcosystemBuildRequests
} from "@/lib/engine/first-real-ecosystem-build-request";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { loadInternalControlledUseRunbook } from "@/lib/engine/internal-controlled-use-runbook";
import { listOpportunityActionPlans } from "@/lib/engine/opportunity-action-plan";
import { listOpportunityAppEngineCandidates } from "@/lib/engine/opportunity-appengine-candidate";
import { listOpportunityBuildPacketBridges } from "@/lib/engine/opportunity-build-packet-bridge";
import { listOpportunityClarifications } from "@/lib/engine/opportunity-clarification";
import { loadOpportunityControlledUseReadiness } from "@/lib/engine/opportunity-controlled-use-readiness";
import { listOpportunityFullLoopTrials } from "@/lib/engine/opportunity-full-loop-trial";
import { listOpportunityIntakeRecords } from "@/lib/engine/opportunity-intake";
import { loadOpportunityInternalUseCompletionCheck } from "@/lib/engine/opportunity-internal-use-completion-check";
import { listOpportunitySolutionPaths } from "@/lib/engine/opportunity-solution-path";
import { listOrchestratorActionQueue, listOrchestratorRuns } from "@/lib/engine/orchestrator-run";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listProblemIntakeRecords } from "@/lib/engine/problem-intake-lite";
import { listRealOpportunityExamples } from "@/lib/engine/real-opportunity-example-runner";
import { listRealOpportunityResultReviews } from "@/lib/engine/real-opportunity-result-review";
import { listRealProjectTrials, listTrialProjectCandidates, listTrialResultReviews } from "@/lib/engine/real-project-trial";

export const dynamic = "force-dynamic";

export default async function OwnerControlCenterPage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  const [
    handoffs,
    projectMemory,
    trialRuns,
    trialReviews,
    orchestratorRuns,
    orchestratorActionQueue,
    auditTrailReport,
    internalControlledUse,
    opportunityIntakeRecords,
    opportunityClarifications,
    opportunitySolutionPaths,
    opportunityActionPlans,
    opportunityAppEngineCandidates,
    opportunityBuildPacketBridges,
    opportunityFullLoopTrials,
    opportunityControlledUseReadiness,
    opportunityInternalUseCompletionCheck,
    firstRealEcosystemBuildRequests,
    firstEcosystemBuildPacketDrafts,
    realOpportunityExamples,
    realOpportunityResultReviews,
    problemIntakeRecords,
    portfolioRegistry
  ] = await Promise.all([
    listHandoffRelaySummaries(),
    loadProjectMemory(),
    listRealProjectTrials(),
    listTrialResultReviews(),
    listOrchestratorRuns(),
    listOrchestratorActionQueue(),
    loadAuditTrailOwnerVisibilityReport(),
    loadInternalControlledUseRunbook(),
    listOpportunityIntakeRecords(),
    listOpportunityClarifications(),
    listOpportunitySolutionPaths(),
    listOpportunityActionPlans(),
    listOpportunityAppEngineCandidates(),
    listOpportunityBuildPacketBridges(),
    listOpportunityFullLoopTrials(),
    loadOpportunityControlledUseReadiness(),
    loadOpportunityInternalUseCompletionCheck(),
    listFirstRealEcosystemBuildRequests(),
    listFirstEcosystemBuildPacketDrafts(),
    listRealOpportunityExamples(),
    listRealOpportunityResultReviews(),
    listProblemIntakeRecords(),
    loadOwnerPortfolioRegistry()
  ]);

  return (
    <main className="shell wide-shell owner-control-page">
      <nav className="topnav">
        <strong>AppEngine Owner Control</strong>
        <div className="navlinks">
          <Link href="/">Home</Link>
          <Link href="/opportunity-intake">Opportunity</Link>
          <Link href="/problem-intake-lite">Problem Intake</Link>
          <Link href="/builder">Builder</Link>
          <Link href="/admin">Admin</Link>
        </div>
      </nav>
      <OwnerPortfolioDashboard registry={portfolioRegistry} />
      <HandoffRelayControlCenter
        initialHandoffs={handoffs}
        initialProjectMemory={projectMemory}
        initialTrialCandidates={listTrialProjectCandidates()}
        initialTrialRuns={trialRuns}
        initialTrialReviews={trialReviews}
        initialOrchestratorRuns={orchestratorRuns}
        initialOrchestratorActionQueue={orchestratorActionQueue}
        initialAuditTrailReport={auditTrailReport}
        initialInternalControlledUse={internalControlledUse}
        initialStorage={process.env.VERCEL === "1" ? "mock-memory" : "local"}
      />
      <OpportunityControlledUseReadinessPanel report={opportunityControlledUseReadiness} />
      <OpportunityInternalUseCompletionCheckPanel report={opportunityInternalUseCompletionCheck} />
      <FirstRealEcosystemBuildRequestPanel
        initialRecords={firstRealEcosystemBuildRequests}
        seed={firstRealEcosystemBuildRequestSeed}
      />
      <FirstEcosystemBuildPacketDraftPanel
        initialBuildRequests={firstRealEcosystemBuildRequests}
        initialDrafts={firstEcosystemBuildPacketDrafts}
      />
      <OwnerOpportunityQueue
        initialClarifications={opportunityClarifications}
        initialRecords={opportunityIntakeRecords}
        initialActionPlans={opportunityActionPlans}
        initialAppEngineCandidates={opportunityAppEngineCandidates}
        initialBuildPacketBridges={opportunityBuildPacketBridges}
        initialSolutionPaths={opportunitySolutionPaths}
        initialFullLoopTrials={opportunityFullLoopTrials}
        initialRealOpportunityExamples={realOpportunityExamples}
        initialRealOpportunityResultReviews={realOpportunityResultReviews}
      />
      <ProblemIntakeOwnerControlCenter initialRecords={problemIntakeRecords} />
    </main>
  );
}
