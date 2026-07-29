"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// One text box. No signup, no account, no "choose a category" — the entire ask is
// a sentence about their life, and anything else on this screen is a reason to leave.
export default function LandingForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (busy || text.trim().length < 8) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/solve/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ statedProblem: text, anonId: readAnonId() })
      });

      const payload = (await response.json()) as { ok?: boolean; token?: string; message?: string };

      if (!payload.ok || !payload.token) {
        setError(payload.message || "Something went wrong. Try that again.");
        setBusy(false);
        return;
      }

      // Keep the token on this device so closing the tab doesn't lose the thread.
      rememberToken(payload.token);
      router.push(`/solve/c/${payload.token}`);
    } catch {
      setError("Couldn't reach us just then. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="se-stack">
      <textarea
        className="se-field"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Just say it plainly. A sentence is enough."
        aria-label="What's eating your time or keeping you up at night?"
        maxLength={4000}
        autoFocus
      />
      {error ? <p className="se-error">{error}</p> : null}
      <div className="se-row">
        <button className="se-button" type="submit" disabled={busy || text.trim().length < 8}>
          {busy ? "One moment…" : "Start"}
        </button>
        <span className="se-quiet">No account. No email needed yet.</span>
      </div>
    </form>
  );
}

function readAnonId(): string | null {
  try {
    return window.localStorage.getItem("lpl_anon");
  } catch {
    return null;
  }
}

function rememberToken(token: string) {
  try {
    window.localStorage.setItem("se_token", token);
  } catch {
    // A private-mode browser just means they use the link instead.
  }
}
