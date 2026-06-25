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
      <ProblemIntakeForm />
    </main>
  );
}
