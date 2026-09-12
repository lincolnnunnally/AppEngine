import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { canAccessOwner } from "@/lib/auth/roles";
import { isDashboardRequest } from "@/lib/auth/hosts";
import { normalizeUserKey } from "@/lib/engine/billing";
import { OwnerCommandDeck } from "@/components/engine/owner-command-deck";
import AppShell from "@/components/engine/app-shell";
import { PublicFactoryHome } from "@/components/intake/public-factory-home";

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
    return (
      <AppShell isOperator>
        <OwnerCommandDeck userKey={normalizeUserKey(session?.user?.email) || null} appsFilter={params.apps} />
      </AppShell>
    );
  }

  const session = await auth();
  return (
    <PublicFactoryHome
      signedInEmail={session?.user?.email || null}
      isOwner={canAccessOwner(session?.user?.role)}
    />
  );
}
