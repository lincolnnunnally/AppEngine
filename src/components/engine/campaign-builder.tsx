"use client";

import { useState, type FormEvent } from "react";
import {
  copyProblems,
  LED_WALL_EXAMPLE,
  type CampaignBrief,
  type CampaignKit,
  type CopyProblem
} from "@/lib/engine/campaign-builder-core";
import type { CampaignStatus, SavedCampaign } from "@/lib/engine/campaigns";

type Tab = "emails" | "landing" | "dashboard" | "checklist" | "check";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "emails", label: "Emails" },
  { key: "landing", label: "Landing page" },
  { key: "dashboard", label: "Dashboard plan" },
  { key: "checklist", label: "Checklist" },
  { key: "check", label: "Copy check" }
];

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  live: "Live",
  paused: "Paused",
  done: "Done"
};

type FormState = {
  company: string;
  product: string;
  audience: string;
  offer: string;
  proof: string;
  region: string;
  landingUrl: string;
  sender: string;
  bidders: string;
  rules: string;
  keepPrivate: string;
};

const EMPTY: FormState = {
  company: "",
  product: "",
  audience: "",
  offer: "",
  proof: "",
  region: "",
  landingUrl: "",
  sender: "",
  bidders: "",
  rules: "",
  keepPrivate: ""
};

function briefToForm(brief: CampaignBrief): FormState {
  return {
    company: brief.company,
    product: brief.product,
    audience: brief.audience,
    offer: brief.offer,
    proof: (brief.proof ?? []).join("\n"),
    region: brief.region ?? "",
    landingUrl: brief.landingUrl ?? "",
    sender: brief.sender ?? "",
    bidders: brief.bidders ? String(brief.bidders) : "",
    rules: (brief.rules ?? []).join(", "),
    keepPrivate: (brief.keepPrivate ?? []).join(", ")
  };
}

function landingText(kit: CampaignKit): string {
  const l = kit.landing;
  return [
    `Title: ${l.title}`,
    `Description: ${l.metaDescription}`,
    "",
    `# ${l.h1}`,
    "",
    l.lead,
    "",
    ...l.benefits.map((b) => `- ${b.title}: ${b.body}`),
    "",
    "How it works",
    ...l.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Questions",
    ...l.faq.flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`, ""]),
    "Form",
    ...l.formFields.map((f) => `- ${f.label}${f.required ? " (required)" : ""}${f.options ? `: ${f.options.join(" / ")}` : ""}`),
    "",
    `Button: ${l.cta}`
  ].join("\n");
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="dx-btn"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function CampaignBuilder({ initial, aiReady }: { initial: SavedCampaign[]; aiReady: boolean }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [polish, setPolish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>(initial);
  const [current, setCurrent] = useState<SavedCampaign | null>(initial[0] ?? null);
  const [tab, setTab] = useState<Tab>("emails");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const kit = current?.kit ?? null;
  const problems: CopyProblem[] = kit ? copyProblems(kit) : [];

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (event: { target: { value: string } }) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
    };
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote("");
    const brief = {
      company: form.company,
      product: form.product,
      audience: form.audience,
      offer: form.offer,
      proof: form.proof,
      region: form.region,
      landingUrl: form.landingUrl,
      sender: form.sender,
      bidders: form.bidders,
      rules: form.rules,
      keepPrivate: form.keepPrivate
    };
    try {
      const response = await fetch("/api/engine/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, polish })
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; campaign?: SavedCampaign; polishNote?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        setError(payload?.message || "The campaign was not built. Try again.");
      } else {
        const saved = payload.campaign;
        setCampaigns((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
        setCurrent(saved);
        setTab("emails");
        setTicked({});
        setNote(payload.polishNote || "");
      }
    } catch {
      setError("Could not reach the Campaign Builder.");
    }
    setBusy(false);
  }

  async function setStatus(id: string, status: CampaignStatus) {
    setError(null);
    try {
      const response = await fetch(`/api/engine/campaigns/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; campaign?: SavedCampaign } | null;
      if (!response.ok || !payload?.ok || !payload.campaign) {
        setError(payload?.message || "That status did not save.");
        return;
      }
      const updated = payload.campaign;
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setCurrent((prev) => (prev && prev.id === updated.id ? updated : prev));
    } catch {
      setError("Could not reach the Campaign Builder.");
    }
  }

  return (
    <>
      <section className="panel">
        <p className="dx-label">I have an idea</p>
        <h2 style={{ margin: "4px 0 12px", fontSize: "1.2rem" }}>Tell us the company, the product and who it is for.</h2>
        <div className="dx-app-actions" style={{ marginBottom: 14 }}>
          <button className="dx-btn" type="button" onClick={() => setForm(briefToForm(LED_WALL_EXAMPLE))}>
            Use the LED wall example
          </button>
          <button className="dx-btn" type="button" onClick={() => setForm(EMPTY)}>
            Clear
          </button>
        </div>
        <form className="help-form" onSubmit={generate}>
          <div className="cb-grid">
            <label className="help-field">
              <span>Company</span>
              <input {...field("company")} placeholder="United Under God" required />
            </label>
            <label className="help-field">
              <span>Product or idea</span>
              <input {...field("product")} placeholder="What you want to promote" required />
            </label>
            <label className="help-field">
              <span>Who it is for</span>
              <input {...field("audience")} placeholder="Churches in South Georgia" required />
            </label>
            <label className="help-field">
              <span>Region (optional)</span>
              <input {...field("region")} placeholder="Where the work happens" />
            </label>
          </div>
          <label className="help-field">
            <span>What you offer them</span>
            <textarea {...field("offer")} rows={3} placeholder="In your own words — what they get and how it works." required />
          </label>
          <label className="help-field">
            <span>True facts about you (optional, one per line)</span>
            <textarea {...field("proof")} rows={3} placeholder="Only things that are true today. Nothing is made up for you." />
          </label>
          <div className="cb-grid">
            <label className="help-field">
              <span>Landing page address</span>
              <input {...field("landingUrl")} placeholder="https://…" inputMode="url" />
            </label>
            <label className="help-field">
              <span>Who signs the emails (optional)</span>
              <input {...field("sender")} placeholder="The United Under God team" />
            </label>
            <label className="help-field">
              <span>Companies ready to bid (optional)</span>
              <input {...field("bidders")} placeholder="3" inputMode="numeric" />
            </label>
            <label className="help-field">
              <span>Never say (comma separated)</span>
              <input {...field("rules")} placeholder="free, AI, no prices" />
            </label>
            <label className="help-field">
              <span>Names to keep private (optional)</span>
              <input {...field("keepPrivate")} placeholder="Names that must never appear" />
            </label>
          </div>
          {aiReady ? (
            <label className="cb-check">
              <input type="checkbox" checked={polish} onChange={(event) => setPolish(event.target.checked)} />
              <span>Polish the wording with AI (the template is kept if anything breaks a rule)</span>
            </label>
          ) : null}
          <div className="dx-app-actions">
            <button className="dx-btn dx-btn--primary" type="submit" disabled={busy}>
              {busy ? "Building…" : "Build the campaign"}
            </button>
          </div>
          {error ? <p className="dx-note" style={{ color: "var(--pink)" }}>{error}</p> : null}
          {note ? <p className="dx-note" style={{ color: "var(--gold)" }}>{note}</p> : null}
        </form>
      </section>

      {current && kit ? (
        <section className="panel">
          <p className="dx-label">
            {current.company} · {STATUS_LABEL[current.status]} · {kit.generatedBy === "ai" ? "AI-polished wording" : "template wording"}
          </p>
          <h2 style={{ margin: "4px 0 8px", fontSize: "1.2rem" }}>{kit.positioning.oneLiner}</h2>
          <p className="dx-note">{kit.positioning.problem}</p>
          <p style={{ marginTop: 8 }}>
            <strong style={{ color: "var(--gold)" }}>Promise:</strong> {kit.positioning.promise}
          </p>

          <div className="dx-chips" style={{ marginTop: 16 }} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`dx-chip${tab === t.key ? " dx-chip--active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === "check" ? <strong>{problems.length ? problems.length : "✓"}</strong> : null}
              </button>
            ))}
          </div>

          {tab === "emails" ? (
            <div className="cb-stack">
              {kit.emails.map((email) => (
                <article className="cb-card" key={email.step}>
                  <p className="dx-label">
                    Email {email.step} · {email.name} · {email.sendDay === 0 ? "day 1" : `${email.sendDay} days later`}
                  </p>
                  <div className="cb-ab">
                    <div>
                      <span className="cb-ab-tag">A</span> {email.subjectA}
                    </div>
                    <div>
                      <span className="cb-ab-tag cb-ab-tag--b">B</span> {email.subjectB}
                    </div>
                  </div>
                  <p className="dx-note">Preview: {email.preview}</p>
                  <pre className="cb-body">{email.body}</pre>
                  <p className="dx-note">
                    Button: <strong>{email.ctaLabel}</strong>
                    {email.ctaUrl ? (
                      <>
                        {" → "}
                        <a className="account-link" href={email.ctaUrl} target="_blank" rel="noreferrer">
                          {email.ctaUrl}
                        </a>
                      </>
                    ) : (
                      " → add the landing page address to the brief"
                    )}
                  </p>
                  <div className="dx-app-actions">
                    <CopyButton text={`Subject: ${email.subjectA}\n\n${email.body}`} label="Copy with subject A" />
                    <CopyButton text={`Subject: ${email.subjectB}\n\n${email.body}`} label="Copy with subject B" />
                    <CopyButton text={email.body} label="Copy body" />
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {tab === "landing" ? (
            <div className="cb-stack">
              <article className="cb-card">
                <p className="dx-label">
                  /{kit.landing.slug}
                  {kit.landing.url ? ` · ${kit.landing.url}` : ""}
                </p>
                <p className="dx-note">
                  Title ({kit.landing.title.length}/60): {kit.landing.title}
                </p>
                <p className="dx-note">
                  Description ({kit.landing.metaDescription.length}, 120–165): {kit.landing.metaDescription}
                </p>
                <h3 className="cb-h1">{kit.landing.h1}</h3>
                <p>{kit.landing.lead}</p>
                <div className="cb-benefits">
                  {kit.landing.benefits.map((b) => (
                    <div key={b.title} className="cb-benefit">
                      <strong>{b.title}</strong>
                      <p className="dx-note">{b.body}</p>
                    </div>
                  ))}
                </div>
                <p className="dx-label" style={{ marginTop: 14 }}>How it works</p>
                <ol className="cb-list">
                  {kit.landing.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className="dx-label" style={{ marginTop: 14 }}>Questions</p>
                {kit.landing.faq.map((f) => (
                  <div key={f.q} style={{ marginBottom: 8 }}>
                    <strong>{f.q}</strong>
                    <p className="dx-note">{f.a}</p>
                  </div>
                ))}
                <p className="dx-label" style={{ marginTop: 14 }}>Form</p>
                <ul className="cb-list">
                  {kit.landing.formFields.map((f) => (
                    <li key={f.name}>
                      {f.label}
                      {f.required ? "" : " — optional"}
                      {f.options ? ` (${f.options.join(" / ")})` : ""}
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: 10 }}>
                  Button: <strong style={{ color: "var(--teal)" }}>{kit.landing.cta}</strong>
                </p>
                <div className="dx-app-actions">
                  <CopyButton text={landingText(kit)} label="Copy the whole page" />
                </div>
              </article>
            </div>
          ) : null}

          {tab === "dashboard" ? (
            <div className="cb-stack">
              <div className="cb-funnel">
                {kit.dashboard.stages.map((stage) => (
                  <div className="cb-stage" key={stage.key}>
                    <strong>{stage.label}</strong>
                    <span className="dx-note">{stage.meaning}</span>
                  </div>
                ))}
              </div>
              <article className="cb-card">
                <p className="dx-label">What to watch</p>
                <ul className="cb-list">
                  {kit.dashboard.metrics.map((m) => (
                    <li key={m.label}>
                      <strong>{m.label}</strong> — {m.how}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="cb-card">
                <p className="dx-label">Daily sending · start small, scale winners</p>
                <p>{kit.dashboard.sendPlan.rule}</p>
                <p className="dx-note" style={{ marginTop: 8 }}>
                  Steps: {kit.dashboard.sendPlan.ladder.join(" → ")} a day · at least {kit.dashboard.sendPlan.minSendsPerSubject} sends per
                  subject before calling a winner · win by {kit.dashboard.sendPlan.winMarginPoints} points
                </p>
                <p className="dx-note" style={{ color: "var(--gold)", marginTop: 8 }}>{kit.dashboard.sendPlan.pauseRule}</p>
              </article>
            </div>
          ) : null}

          {tab === "checklist" ? (
            <ul className="cb-checklist">
              {kit.checklist.map((item) => (
                <li key={item}>
                  <label className="cb-check">
                    <input
                      type="checkbox"
                      checked={Boolean(ticked[item])}
                      onChange={(event) => setTicked((prev) => ({ ...prev, [item]: event.target.checked }))}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "check" ? (
            problems.length === 0 ? (
              <div className="dx-callout">
                <b>All clear.</b>{" "}
                <span className="dx-note">
                  No guarantees, no ranking promises, no prices unless the brief gave one
                  {kit.guard.rules.length ? `, and none of: ${kit.guard.rules.join(", ")}` : ""}.
                </span>
              </div>
            ) : (
              <div className="dx-callout dx-callout--alert">
                <b>{problems.length} thing{problems.length === 1 ? "" : "s"} to fix before sending.</b>
                <ul className="cb-list">
                  {problems.map((p, i) => (
                    <li key={`${p.where}-${i}`}>
                      {p.where}: “{p.found}” — {p.rule}
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <p className="dx-label">Saved campaigns</p>
        {campaigns.length === 0 ? (
          <p className="dx-note">Nothing yet. Build one above — every campaign is saved as a draft.</p>
        ) : (
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Made</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.company}</td>
                    <td>{c.product}</td>
                    <td>
                      <select
                        className="cb-select"
                        value={c.status}
                        onChange={(event) => setStatus(c.id, event.target.value as CampaignStatus)}
                        aria-label={`Status for ${c.company}`}
                      >
                        {(Object.keys(STATUS_LABEL) as CampaignStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US") : ""}</td>
                    <td>
                      <button
                        className="dx-btn"
                        type="button"
                        onClick={() => {
                          setCurrent(c);
                          setTab("emails");
                          setTicked({});
                          setForm(briefToForm(c.brief));
                        }}
                      >
                        {current?.id === c.id ? "Showing" : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
