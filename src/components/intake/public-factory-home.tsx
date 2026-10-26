"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConversationalIntake } from "@/components/intake/conversational-intake";
import { FactoryWelcome } from "@/components/intake/factory-welcome";
import { readComposeDraft } from "@/lib/ui/compose-draft";
import { ARRIVAL_COPY, readArrival, saveArrival, type Arrival } from "@/lib/ui/arrival";

const DESK_ORIGIN = "https://dashboard.unitedundergod.org";

export function PublicFactoryHome({
  signedInEmail,
  isOwner,
  arrival: arrivedWith = null
}: {
  signedInEmail: string | null;
  isOwner: boolean;
  arrival?: Arrival | null;
}) {
  const [journey, setJourney] = useState<"sell" | "talk" | "pack">("sell");
  const [arrival, setArrival] = useState<Arrival | null>(arrivedWith);

  useEffect(() => {
    if (readComposeDraft()) setJourney("pack");
    // Sent here by ChurchConnect or Operate: remember it for this tab (it has to
    // survive sign-in). Coming back after sign-in, the URL no longer carries it.
    if (arrivedWith) saveArrival(arrivedWith);
    else setArrival(readArrival());
  }, [arrivedWith]);

  const copy = arrival ? ARRIVAL_COPY[arrival.from] : null;

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
          {copy ? <a href={copy.home}>Back to {copy.platform}</a> : null}
          {signedInEmail ? <Link href="/account">Your apps</Link> : <Link href="/signin">Sign in</Link>}
          {isOwner ? (
            <a href={DESK_ORIGIN} className="factory-bar-desk">
              Desk
            </a>
          ) : null}
        </nav>
      </header>

      {selling && copy ? (
        <section className="factory-arrival" aria-label={`From ${copy.platform}`}>
          <p className="convo-eyebrow">
            From {copy.platform}
            {arrival?.org ? ` · ${arrival.org}` : ""}
          </p>
          <h2>{copy.headline}</h2>
          <p>Same prices as everyone — you see the price before you pay. People have asked for things like:</p>
          <ul>
            {copy.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {selling ? <FactoryWelcome /> : null}

      <div id="describe">
        <ConversationalIntake embedded={selling} onJourney={setJourney} />
      </div>

      <footer className="factory-foot">
        <span>A real person reads every message.</span>
        <Link href="/help">Get help</Link>
      </footer>
    </div>
  );
}
