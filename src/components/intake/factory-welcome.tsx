"use client";

import { useEffect, useState } from "react";
import { noOrphan } from "@/lib/ui/no-orphan";

type Archetype = {
  id: string;
  name: string;
  forWho: string;
  coreJob: string;
  startingPriceCents: number;
};

function dollars(cents: number) {
  return `$${Math.round(cents / 100)}`;
}

export function FactoryWelcome() {
  const [packs, setPacks] = useState<Archetype[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing/estimate?catalog=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { archetypes?: Archetype[] }) => {
        if (!cancelled) setPacks(data.archetypes || []);
      })
      .catch(() => {
        if (!cancelled) setPacks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="factory-home">
      <section className="factory-hero">
        <p className="convo-eyebrow">App Engine — app builder</p>
        <h1 className="balanced-title">
          <span>Describe it.</span>
          <span>Snap it together.</span>
        </h1>
        <p className="factory-lede">
          {noOrphan(
            "This is not vibe building. You snap together pieces we already keep, see the price, then we publish a live starter you can open."
          )}
        </p>
        <a className="soft-launch-action" href="#describe">
          Describe the app
        </a>
      </section>

      <section className="factory-steps" aria-label="How it works">
        <p className="eyebrow">How it works</p>
        <h2 className="balanced-title">
          <span>Three clear steps.</span>
          <span>Price before you build.</span>
        </h2>
        <ol className="factory-step-list">
          <li>
            <strong>Describe it</strong>
            <span>{noOrphan("Tell us the problem and who it is for. A few short questions — no long form.")}</span>
          </li>
          <li>
            <strong>See the pieces</strong>
            <span>{noOrphan("We recommend a starter combination and show the cost. You confirm the pack.")}</span>
          </li>
          <li>
            <strong>Save it and use it</strong>
            <span>{noOrphan("Create an account to save the pack, publish the live starter, and sign into it.")}</span>
          </li>
        </ol>
      </section>

      <section className="factory-difference" aria-label="Why this is different">
        <p className="eyebrow">Why this is different</p>
        <h2 className="balanced-title">
          <span>Not a blank-page guess.</span>
          <span>Pieces you can see.</span>
        </h2>
        <p className="factory-lede">
          {noOrphan(
            "Vibe builders ask an agent to invent an app and hope it holds. Here the blocks are already on the shelf. You see which ones snap together and what they cost before anything is built."
          )}
        </p>
        <p className="factory-how">
          {noOrphan(
            "The first version is a live starter you can open — then we verify it and improve it with you. You do not pay until that starter is actually up."
          )}
        </p>
      </section>

      <section className="factory-packs" aria-label="Starter combinations">
        <p className="eyebrow">Starter combinations</p>
        <h2 className="balanced-title">
          <span>See the price</span>
          <span>before you start</span>
        </h2>
        <p className="note">
          {noOrphan("Core app + live website is $25. Add-ons are $10 each. You confirm the pack before we build.")}
        </p>
        {packs.length === 0 ? (
          <p className="note">Loading starter packs…</p>
        ) : (
          <div className="compose-arch-grid">
            {packs.map((pack) => (
              <a className="compose-arch" key={pack.id} href="#describe">
                <strong>{pack.name}</strong>
                <span>{pack.forWho}</span>
                <em>From {dollars(pack.startingPriceCents)}</em>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
