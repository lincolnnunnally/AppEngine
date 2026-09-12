"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConversationalIntake } from "@/components/intake/conversational-intake";
import { FactoryWelcome } from "@/components/intake/factory-welcome";
import { readComposeDraft } from "@/lib/ui/compose-draft";

const DESK_ORIGIN = "https://dashboard.unitedundergod.org";

export function PublicFactoryHome({
  signedInEmail,
  isOwner
}: {
  signedInEmail: string | null;
  isOwner: boolean;
}) {
  const [journey, setJourney] = useState<"sell" | "talk" | "pack">("sell");

  useEffect(() => {
    if (readComposeDraft()) setJourney("pack");
  }, []);

  const selling = journey === "sell";

  return (
    <div className="soft-launch">
      <header className="factory-bar">
        <span className="factory-bar-mark">App Engine</span>
        <nav className="factory-bar-nav">
          {selling ? (
            <a href="#describe">Describe an app</a>
          ) : (
            <Link href="/">Start over</Link>
          )}
          {signedInEmail ? <Link href="/account">Your apps</Link> : <Link href="/signin">Sign in</Link>}
          {isOwner ? (
            <a href={DESK_ORIGIN} className="factory-bar-desk">
              Desk
            </a>
          ) : null}
        </nav>
      </header>

      {selling ? <FactoryWelcome /> : null}

      <div id="describe">
        <ConversationalIntake embedded={selling} onJourney={setJourney} />
      </div>
    </div>
  );
}
