import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isDashboardRequest } from "@/lib/auth/hosts";
import { normalizeUserKey } from "@/lib/engine/billing";
import { ConversationalIntake } from "@/components/intake/conversational-intake";
import { OwnerCommandDeck } from "@/components/engine/owner-command-deck";

// Two hosts, one deploy. appengine.unitedundergod.org is the customer builder.
// dashboard.unitedundergod.org is the private internal desk (owner only).
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ apps?: string }>;
}) {
  if (await isDashboardRequest()) {
    if (!(await canAccessEngineAdmin())) {
      redirect("/signin");
    }
    const session = await auth();
    const params = await searchParams;
    return <OwnerCommandDeck userKey={normalizeUserKey(session?.user?.email) || null} appsFilter={params.apps} />;
  }

  return (
    <main className="entry">
      <ConversationalIntake />
    </main>
  );
}
