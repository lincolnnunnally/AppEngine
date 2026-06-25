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
      <ProblemIntakeForm initialRecords={records} />
    </main>
  );
}
