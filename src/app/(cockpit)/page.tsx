import { auth } from "@/auth";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { normalizeUserKey } from "@/lib/engine/billing";
import { ConversationalIntake } from "@/components/intake/conversational-intake";
import { OwnerCommandDeck } from "@/components/engine/owner-command-deck";

// The front door depends on who walks in. The OWNER lands on the command deck —
// every app, one attention list, doors into each app and its admin (redesign
// 2026-07-09: this app's real user is the owner; the machinery serves him, not
// the other way around). Customers still get the conversational intake; their
// experience is unchanged. The intake stays reachable for the owner at /start.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await canAccessEngineOwner()) {
    const session = await auth();
    return <OwnerCommandDeck userKey={normalizeUserKey(session?.user?.email) || null} />;
  }
  return (
    <main className="entry">
      <ConversationalIntake />
    </main>
  );
}
