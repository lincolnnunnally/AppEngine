import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { OwnerCommandDeck } from "@/components/engine/owner-command-deck";

// This host is the internal business desk. The public builder lives at /start
// and /solve. Visitors who are not the owner go sign in — they never land on
// "describe it, we build it" here.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ apps?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) {
    redirect("/signin");
  }
  const session = await auth();
  const params = await searchParams;
  return <OwnerCommandDeck userKey={normalizeUserKey(session?.user?.email) || null} appsFilter={params.apps} />;
}
