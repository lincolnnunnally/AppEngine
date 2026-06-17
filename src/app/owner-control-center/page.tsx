import Link from "next/link";
import { redirect } from "next/navigation";
import { HandoffRelayControlCenter } from "@/components/engine/handoff-relay-control-center";
import { OwnerOpportunityQueue } from "@/components/opportunity-intake/owner-opportunity-queue";
import { OwnerControlCenter as ProblemIntakeOwnerControlCenter } from "@/components/problem-intake-lite/owner-control-center";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadAuditTrailOwnerVisibilityReport } from "@/lib/engine/audit-trail-owner-visibility";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { loadInternalControlledUseRunbook } from "@/lib/engine/internal-controlled-use-runbook";
import { listOpportunityActionPlans } from "@/lib/engine/opportunity-action-plan";
import { listOpportunityAppEngineCandidates } from "@/lib/engine/opportunity-appengine-candidate";
import { listOpportunityBuildPacketBridges } from "@/lib/engine/opportunity-build-packet-bridge";
import { listOpportunityClarifications } from "@/lib/engine/opportunity-clarification";
import { listOpportunityIntakeRecords } from "@/lib/engine/opportunity-intake";
import { listOpportunitySolutionPaths } from "@/lib/engine/opportunity-solution-path";
import { listOrchestratorActionQueue, listOrchestratorRuns } from "@/lib/engine/orchestrator-run";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listProblemIntakeRecords } from "@/lib/engine/problem-intake-lite";
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
    problemIntakeRecords
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
    listProblemIntakeRecords()
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
      <OwnerOpportunityQueue
        initialClarifications={opportunityClarifications}
        initialRecords={opportunityIntakeRecords}
        initialActionPlans={opportunityActionPlans}
        initialAppEngineCandidates={opportunityAppEngineCandidates}
        initialBuildPacketBridges={opportunityBuildPacketBridges}
        initialSolutionPaths={opportunitySolutionPaths}
      />
      <ProblemIntakeOwnerControlCenter initialRecords={problemIntakeRecords} />
    </main>
  );
}
