"use client";

import { useState } from "react";

export type HelpAppOption = { slug: string; name: string };

export function HelpForm({
  apps,
  initialApp
}: {
  apps: HelpAppOption[];
  initialApp: string;
}) {
  const [app, setApp] = useState(initialApp || "other");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const selected = apps.find((entry) => entry.slug === app);
      const response = await fetch("/api/engine/inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          app,
          appName: selected?.name || "",
          name,
          email,
          subject,
          body,
          company,
          source: "help_form"
        })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.message || "That didn't go through. Please try again.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("We couldn't reach the inbox just then. Please try again.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="dx-callout">
        <b>We have it.</b>
        <p className="dx-note" style={{ marginTop: 8 }}>
          Someone will read this and get back to you at {email || "the address you gave"}. Thank you for saying something
          — that is how things get better.
        </p>
      </div>
    );
  }

  return (
    <form className="help-form" onSubmit={submit}>
      <label className="help-field">
        <span>Which app?</span>
        <select value={app} onChange={(event) => setApp(event.target.value)} required>
          {apps.map((entry) => (
            <option value={entry.slug} key={entry.slug}>
              {entry.name}
            </option>
          ))}
          <option value="other">Something else / I am not sure</option>
        </select>
      </label>
      <label className="help-field">
        <span>Your name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
      </label>
      <label className="help-field">
        <span>Email we can reply to</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="help-field">
        <span>What is this about?</span>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={4} />
      </label>
      <label className="help-field">
        <span>What happened? What do you need?</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={8} rows={6} />
      </label>
      <label className="help-honeypot" aria-hidden="true">
        Company
        <input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" />
      </label>
      {error ? <p className="dx-note" style={{ color: "var(--pink)" }}>{error}</p> : null}
      <button className="dx-btn dx-btn--primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send to Lincoln"}
      </button>
      <p className="dx-note">This goes to a real person. It is not a bot and it is not a ticket mill.</p>
    </form>
  );
}
