"use client";

import Link from "next/link";
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

export function FactoryWelcome({
  kicker,
  titleLines,
  body,
  cta
}: {
  kicker: string;
  titleLines: string[];
  body: string;
  cta: string;
}) {
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
        <p className="convo-eyebrow">{kicker}</p>
        <h1 className="balanced-title">
          {titleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className="factory-lede">{noOrphan(body)}</p>
        <p className="factory-how">
          {noOrphan("Tell us the problem and the goal. We snap starter modules together like Legos, show the price first, then publish a live website you can open.")}
        </p>
        <Link className="soft-launch-action" href="/signin">
          {cta}
        </Link>
      </section>

      <section className="factory-packs" aria-label="Starter combinations">
        <p className="eyebrow">Starter combinations</p>
        <h2 className="balanced-title">
          <span>See the price</span>
          <span>before you start</span>
        </h2>
        <p className="note">{noOrphan("Core app + live website is $25. Add-ons are $10 each. You confirm the pack before we build.")}</p>
        {packs.length === 0 ? (
          <p className="note">Loading starter packs…</p>
        ) : (
          <div className="compose-arch-grid">
            {packs.map((pack) => (
              <article className="compose-arch" key={pack.id}>
                <strong>{pack.name}</strong>
                <span>{pack.forWho}</span>
                <em>From {dollars(pack.startingPriceCents)}</em>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
