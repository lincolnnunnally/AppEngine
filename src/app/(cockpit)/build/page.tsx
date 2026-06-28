import { redirect } from "next/navigation";
import { BuildExperience } from "@/components/build/build-experience";
import { canAccessEngineConsumerSurface } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function BuildPage() {
  if (!(await canAccessEngineConsumerSurface())) {
    redirect("/soft-launch");
  }

  return (
    <main className="shell">
      <BuildExperience />
    </main>
  );
}
