import Link from "next/link";
import { OpportunityIntakeForm } from "@/components/opportunity-intake/opportunity-intake-form";

export default function OpportunityIntakePage() {
  return (
    <main className="shell wide-shell">
      <nav className="topnav">
        <strong>Opportunity</strong>
        <div className="navlinks">
          <Link href="/">Overview</Link>
          <Link href="/owner-control-center">Owner Control Center</Link>
          <Link href="/problem-intake-lite">Problem Intake</Link>
        </div>
      </nav>

      <OpportunityIntakeForm />
    </main>
  );
}
