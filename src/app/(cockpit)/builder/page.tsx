import { redirect } from "next/navigation";
import { AppEngineCockpit } from "@/components/engine/app-engine-cockpit";
import { canAccessEngineAdmin } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// Operator surface. The (cockpit) layout now also admits customers (staged
// go-public), so this page re-gates itself owner/admin-only — defense in depth.
export default async function BuilderPage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  return (
    <main className="shell wide-shell">
      <AppEngineCockpit />
    </main>
  );
}
