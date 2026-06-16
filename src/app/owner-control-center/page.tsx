import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { HandoffRelayControlCenter } from "@/components/engine/handoff-relay-control-center";
import { listHandoffRelaySummaries } from "@/lib/engine/handoff-relay";
import { loadProjectMemory } from "@/lib/engine/project-memory";
import { listRealProjectTrials, listTrialProjectCandidates } from "@/lib/engine/real-project-trial";

export const dynamic = "force-dynamic";

export default async function OwnerControlCenterPage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  const [handoffs, projectMemory, trialRuns] = await Promise.all([
    listHandoffRelaySummaries(),
    loadProjectMemory(),
    listRealProjectTrials()
  ]);

  return (
    <main className="shell wide-shell owner-control-page">
      <nav className="topnav">
        <strong>AppEngine Owner Control</strong>
        <div className="navlinks">
          <Link href="/">Home</Link>
          <Link href="/builder">Builder</Link>
          <Link href="/admin">Admin</Link>
        </div>
      </nav>
      <HandoffRelayControlCenter
        initialHandoffs={handoffs}
        initialProjectMemory={projectMemory}
        initialTrialCandidates={listTrialProjectCandidates()}
        initialTrialRuns={trialRuns}
        initialStorage={process.env.VERCEL === "1" ? "mock-memory" : "local"}
      />
    </main>
  );
}
