import { notFound, redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadAppDossier } from "@/lib/engine/app-dossier";
import { InboxActions } from "@/components/engine/inbox-actions";

export const dynamic = "force-dynamic";

export default async function AppDossierPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const { slug } = await params;
  const dossier = await loadAppDossier(slug);
  if (!dossier) notFound();
  const { app } = dossier;
  const openTickets = dossier.tickets.filter((ticket) => ticket.status !== "resolved");

  return (
    <main className="shell wide-shell">
      <section className="panel biz-hero" id="status">
        <div className="dx-dossier-hero">
          <div>
            <p className="dx-label">
              <a className="account-link" href="/">
                ← All apps
              </a>
              {" · "}
              {dossier.familyLabel}
            </p>
            <h1 className="dx-display">{app.name}</h1>
            <p className="dx-lede">{dossier.purpose}</p>
            <p className="dx-domain">{app.domain || app.url || "no address yet"}</p>
          </div>
        </div>
        <div className="dx-app-actions dx-inset">
          {app.url ? (
            <a className="dx-btn dx-btn--primary" href={app.url} target="_blank" rel="noreferrer">
              Open app ↗
            </a>
          ) : null}
          {app.adminUrl ? (
            <a className="dx-btn" href={app.adminUrl} target={app.adminUrl.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
              {dossier.family === "toner" ? "Toner Central admin ↗" : "This app's admin ↗"}
            </a>
          ) : null}
          <a className="dx-btn" href={`/inbox?app=${encodeURIComponent(app.slug)}`}>
            Inbox{openTickets.length ? ` (${openTickets.length})` : ""}
          </a>
          {dossier.revenueStreamSlug ? (
            <a className="dx-btn" href={`/reports/money?stream=${encodeURIComponent(dossier.revenueStreamSlug)}`}>
              Money
            </a>
          ) : null}
          <a className="dx-btn" href={dossier.helpUrl} target="_blank" rel="noreferrer">
            Public help form ↗
          </a>
        </div>
        {dossier.adminNote ? <p className="dx-note">{dossier.adminNote}</p> : null}
        {!app.adminUrl && dossier.adminReason ? <p className="dx-note">{dossier.adminReason}</p> : null}
        {!dossier.revenueStreamSlug ? (
          <p className="dx-note">
            Revenue is not wired for this app: no classifier tells its charges apart, so we show nothing rather than a
            misleading $0. Charges from it, if any, sit in &ldquo;this Stripe account — not labeled&rdquo; on the{" "}
            <a className="account-link" href="/reports/money">
              money report
            </a>
            .
          </p>
        ) : null}
      </section>

      <section className="panel" id="doing">
        <p className="dx-label">How it is doing</p>
        <div className="dx-stat-grid">
          <div className="dx-stat dx-stat--cyan">
            <strong>{app.reporting ? app.users ?? "—" : "—"}</strong>
            <span>users</span>
            <p>{app.reporting ? "from the app's own count" : "not reporting yet"}</p>
          </div>
          <div className="dx-stat">
            <strong>{app.activeUsers30d ?? "—"}</strong>
            <span>active (30d)</span>
            <p>
              {app.growth === "up" ? "growing this week" : app.growth === "down" ? "slowing this week" : "trend needs two weeks of numbers"}
            </p>
          </div>
          <a className={`dx-stat ${openTickets.length ? "dx-stat--pink" : ""}`} href={`/inbox?app=${encodeURIComponent(app.slug)}`}>
            <strong>{openTickets.length}</strong>
            <span>open help requests</span>
            <p>
              central inbox →
              {typeof app.ticketsOpen === "number" ? ` · the app's own queue reports ${app.ticketsOpen}` : ""}
            </p>
          </a>
          <div className="dx-stat dx-stat--lime">
            <strong>{app.ordersRecent ?? "—"}</strong>
            <span>orders (30d)</span>
            <p>
              {typeof app.ordersRecent === "number"
                ? "reported by the app"
                : app.reporting
                  ? "this app reports usage but not orders yet"
                  : "not reporting yet — not a zero"}
            </p>
          </div>
        </div>
        {!app.reporting && app.status === "live" ? (
          <p className="dx-note" style={{ marginTop: 12 }}>
            This app is live and not sharing usage yet. The engine wires that as apps are finished — we will never invent a
            number to fill the gap.
          </p>
        ) : null}
      </section>

      {dossier.insights.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Opportunities and challenges</p>
          {dossier.insights.map((insight) => (
            <p className="dx-row" key={`${insight.kind}-${insight.text}`}>
              <span className={`dx-tag ${insight.kind === "challenge" ? "dx-tag--alert" : ""}`}>
                {insight.kind === "challenge" ? "Challenge" : "Opportunity"}
              </span>
              <b>{insight.text}</b>
              {insight.href ? (
                <a className="account-link" href={insight.href}>
                  Look →
                </a>
              ) : null}
            </p>
          ))}
        </section>
      ) : (
        <section className="panel">
          <p className="dx-label">Opportunities and challenges</p>
          <p className="dx-note">
            Nothing to flag from the numbers we have. Trends appear once an app reports two weeks of sign-ups.
          </p>
        </section>
      )}

      {dossier.attention.length > 0 ? (
        <section className="panel" id="needs">
          <p className="dx-label">Needs you</p>
          {dossier.attention.map((item, index) => (
            <p className="dx-row" key={`${item.finding}-${index}`}>
              <span className="dx-index">{String(index + 1).padStart(2, "0")}</span>
              <b>{item.finding}</b>
              <span className="dx-note">{item.action}</span>
              {item.link ? (
                <a className="account-link" href={item.link}>
                  Fix it →
                </a>
              ) : null}
            </p>
          ))}
        </section>
      ) : null}

      <section className="panel">
        <p className="dx-label">Help requests for this app</p>
        {openTickets.length === 0 ? (
          <p className="dx-note">
            No one is waiting.{" "}
            <a className="account-link" href={dossier.helpUrl} target="_blank" rel="noreferrer">
              The public help form
            </a>{" "}
            is where someone would reach you.
          </p>
        ) : (
          openTickets.map((ticket) => (
            <article className="inbox-card" key={ticket.id}>
              <p className="dx-label">{ticket.status.replace("_", " ")}</p>
              <h3>{ticket.subject}</h3>
              <p className="dx-note">
                {ticket.contactName || "someone"} ·{" "}
                <a className="account-link" href={`mailto:${ticket.contactEmail}`}>
                  {ticket.contactEmail}
                </a>
              </p>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{ticket.body}</p>
              <InboxActions id={ticket.id} status={ticket.status} ownerNote={ticket.ownerNote} />
            </article>
          ))
        )}
      </section>

      {dossier.siblings.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Same family — {dossier.familyLabel}</p>
          <p className="dx-note" style={{ marginBottom: 10 }}>
            {dossier.familyBlurb}
          </p>
          <div className="dx-chips">
            {dossier.siblings.map((sibling) => (
              <a className="dx-chip" key={sibling.slug} href={`/apps/${sibling.slug}`}>
                {sibling.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
