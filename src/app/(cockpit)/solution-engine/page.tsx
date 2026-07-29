import { redirect } from "next/navigation";
import SolutionEngineConsole from "@/components/solve/operator-console";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { isSolutionEngineConfigured } from "@/lib/solution-engine/db";
import { loadOperatorDashboard } from "@/lib/solution-engine/operator";

// The behind-the-counter view. Everything the person never sees — the triage
// decision, the root class, the acceptance ledger — lives here and only here.
export const dynamic = "force-dynamic";

export default async function SolutionEnginePage() {
  if (!(await canAccessEngineOwner())) {
    redirect("/");
  }

  if (!isSolutionEngineConfigured()) {
    return (
      <section className="panel">
        <h1>Solution Engine</h1>
        <p>
          Storage isn&rsquo;t configured. Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> for this
          environment and reload.
        </p>
      </section>
    );
  }

  const dashboard = await loadOperatorDashboard();

  return <SolutionEngineConsole initial={dashboard} />;
}
