import Link from "next/link";
import { redirect } from "next/navigation";
import { BuildLoopCompletionDashboardPanel } from "@/components/engine/build-loop-completion-dashboard-panel";
import { BuildLoopControlledUseReadinessPanel } from "@/components/engine/build-loop-controlled-use-readiness-panel";
import { BuildExecutionRequestPanel } from "@/components/engine/build-execution-request-panel";
import { FirstRealBuildLoopRunPanel } from "@/components/engine/first-real-build-loop-run-panel";
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
import { loadBuildLoopControlledUseReadiness } from "@/lib/engine/build-loop-controlled-use-readiness";
import {
  listBuildExecutionHandoffSources,
  listBuildExecutionRequests,
  loadBuildLoopCompletionDashboard
} from "@/lib/engine/build-execution-request";
import { listFirstEcosystemBuildPacketDrafts } from "@/lib/engine/first-ecosystem-build-packet-draft";
import {
  firstRealEcosystemBuildRequestSeed,
  listFirstRealEcosystemBuildRequests
} from "@/lib/engine/first-real-ecosystem-build-request";
import { listFirstRealBuildLoopRuns } from "@/lib/engine/first-real-build-loop-run";
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
    buildExecutionSources,
    buildExecutionRequests,
    buildLoopCompletionDashboard,
    buildLoopControlledUseReadiness,
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
    firstRealBuildLoopRuns,
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
    listBuildExecutionHandoffSources(),
    listBuildExecutionRequests(),
    loadBuildLoopCompletionDashboard(),
    loadBuildLoopControlledUseReadiness(),
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
    listFirstRealBuildLoopRuns(),
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
      <BuildExecutionRequestPanel initialSources={buildExecutionSources} initialRequests={buildExecutionRequests} />
      <BuildLoopCompletionDashboardPanel report={buildLoopCompletionDashboard} />
      <BuildLoopControlledUseReadinessPanel report={buildLoopControlledUseReadiness} />
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
      <FirstRealBuildLoopRunPanel initialRecords={firstRealBuildLoopRuns} />
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
