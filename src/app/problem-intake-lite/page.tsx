import Link from "next/link";
import { ProblemIntakeForm } from "@/components/problem-intake-lite/problem-intake-form";

export default function ProblemIntakeLitePage() {
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
