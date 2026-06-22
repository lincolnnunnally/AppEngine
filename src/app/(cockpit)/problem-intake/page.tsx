import Link from "next/link";
import { redirect } from "next/navigation";
import { ProblemIntakeForm } from "@/components/engine/problem-intake-form";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listProblemIntakeGateRecords } from "@/lib/engine/problem-intake-gate";

export const dynamic = "force-dynamic";

export default async function ProblemIntakePage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  const records = await listProblemIntakeGateRecords();

  return (
    <main className="shell wide-shell">
      <nav className="topnav">
        <strong>AppEngine Intake</strong>
        <div className="navlinks">
          <Link href="/">Home</Link>
          <Link href="/owner-control-center">Owner Control Center</Link>
          <Link href="/builder">Builder</Link>
        </div>
      </nav>

      <ProblemIntakeForm initialRecords={records} />
    </main>
  );
}
