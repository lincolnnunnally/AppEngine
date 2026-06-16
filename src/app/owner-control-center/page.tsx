import Link from "next/link";
import { redirect } from "next/navigation";
import { HandoffRelayControlCenter } from "@/components/engine/handoff-relay-control-center";
import { OwnerControlCenter as ProblemIntakeOwnerControlCenter } from "@/components/problem-intake-lite/owner-control-center";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { listOrchestratorRuns } from "@/lib/engine/orchestrator-run";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listProblemIntakeRecords } from "@/lib/engine/problem-intake-lite";
import { listRealProjectTrials, listTrialProjectCandidates, listTrialResultReviews } from "@/lib/engine/real-project-trial";

export const dynamic = "force-dynamic";

export default async function OwnerControlCenterPage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  const [handoffs, projectMemory, trialRuns, trialReviews, orchestratorRuns, problemIntakeRecords] = await Promise.all([
    listHandoffRelaySummaries(),
    loadProjectMemory(),
    listRealProjectTrials(),
    listTrialResultReviews(),
    listOrchestratorRuns(),
    listProblemIntakeRecords()
  ]);

  return (
    <main className="shell wide-shell owner-control-page">
      <nav className="topnav">
        <strong>AppEngine Owner Control</strong>
        <div className="navlinks">
          <Link href="/">Home</Link>
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
        initialStorage={process.env.VERCEL === "1" ? "mock-memory" : "local"}
      />
      <ProblemIntakeOwnerControlCenter initialRecords={problemIntakeRecords} />
    </main>
  );
}
