import Link from "next/link";
import { redirect } from "next/navigation";
import { ProblemIntakeForm } from "@/components/problem-intake-lite/problem-intake-form";
import { canAccessEngineOwner } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function ProblemIntakeLitePage() {
  if (!(await canAccessEngineOwner())) {
    redirect("/soft-launch");
  }

  return (
    <main className="shell wide-shell">
      <nav className="topnav">
        <strong>App Engine</strong>
        <div className="navlinks">
          <Link href="/">Overview</Link>
          <Link href="/owner-control-center">Owner Control Center</Link>
          <Link href="/builder">Builder</Link>
        </div>
      </nav>

      <ProblemIntakeForm />
    </main>
  );
}
