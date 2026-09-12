"use client";

import { useState } from "react";
import { ComposeAndBuild } from "@/components/intake/compose-and-build";

export function BuildExperience({ domainsEnabled = false }: { domainsEnabled?: boolean }) {
  const [idea, setIdea] = useState("");
  const [ready, setReady] = useState(false);

  if (ready) {
    return <ComposeAndBuild idea={idea} summary={idea} domainsEnabled={domainsEnabled} />;
  }

  return (
    <section className="panel">
      <p className="eyebrow">Build</p>
      <h1>Build your app</h1>
      <p>Describe what you want. We&apos;ll show a starter combination and the price, then publish a live website you can open.</p>
      <textarea
        className="convo-input"
        rows={3}
        value={idea}
        placeholder="Example: a simple visitor sign-up and follow-up tracker for our church"
        onChange={(event) => setIdea(event.target.value)}
        aria-label="Describe the app you want"
      />
      <div style={{ marginTop: 12 }}>
        <button
          className="soft-launch-action"
          type="button"
          onClick={() => setReady(true)}
          disabled={idea.trim().length < 8}
        >
          Show starter pack and price
        </button>
      </div>
    </section>
  );
}
