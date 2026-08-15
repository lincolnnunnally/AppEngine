import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listInboxTickets, getInboxCounts, type InboxStatus } from "@/lib/engine/ecosystem-inbox";
import { InboxActions } from "@/components/engine/inbox-actions";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<{ app?: string; status?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const params = await searchParams;
  const status = (params.status === "open" || params.status === "in_progress" || params.status === "resolved" || params.status === "all"
    ? params.status
    : "open") as InboxStatus | "all";
  const slug = params.app || "";
  const [tickets, counts] = await Promise.all([
    listInboxTickets({ status: status === "open" ? "all" : status, slug, limit: 100 }),
    getInboxCounts()
  ]);
  const shown =
    status === "open"
      ? tickets.filter((ticket) => ticket.status !== "resolved")
      : tickets;

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">Inbox</p>
        <h1 className="dx-display">
          People who need <em>help</em>.
        </h1>
        <p className="dx-lede">
          One queue for every app. When someone on ChurchConnect, Toner, Kindred, Kids Need Dads, or anywhere else asks
          for help, it lands here. The app&apos;s own admin dashboard is still there for staff — this is your across-the-board
          view.
        </p>
        <div className="dx-stat-grid">
          <a className={`dx-stat ${counts.open + counts.inProgress ? "dx-stat--pink" : "dx-stat--lime"}`} href="/inbox">
            <strong>{counts.open + counts.inProgress}</strong>
            <span>waiting</span>
            <p>{counts.open} new · {counts.inProgress} in progress</p>
          </a>
          <div className="dx-stat dx-stat--cyan">
            <strong>{counts.resolved}</strong>
            <span>resolved (recent)</span>
            <p>kept so you can see what already got done</p>
          </div>
        </div>
        <div className="dx-chips" style={{ marginTop: 16 }}>
          <a className={`dx-chip${status === "open" && !slug ? " dx-chip--active" : ""}`} href="/inbox">
            Waiting <strong>{counts.open + counts.inProgress}</strong>
          </a>
          <a className={`dx-chip${status === "resolved" ? " dx-chip--active" : ""}`} href="/inbox?status=resolved">
            Resolved
          </a>
          <a className={`dx-chip${status === "all" ? " dx-chip--active" : ""}`} href="/inbox?status=all">
            All
          </a>
        </div>
      </section>

      {shown.length === 0 ? (
        <section className="panel">
          <div className="dx-callout">
            <b>Inbox is clear.</b>{" "}
            <span className="dx-note">
              People reach this queue from{" "}
              <a className="account-link" href="/help">the public help form</a>
              {slug ? ` — nothing waiting for ${slug} right now.` : "."}
            </span>
          </div>
        </section>
      ) : (
        shown.map((ticket) => (
          <section className="panel" key={ticket.id}>
            <p className="dx-label">
              <a className="account-link" href={`/apps/${ticket.appSlug}`}>
                {ticket.appName}
              </a>
              {" · "}
              {ticket.status.replace("_", " ")}
              {ticket.createdAt ? ` · ${new Date(ticket.createdAt).toLocaleString("en-US")}` : ""}
            </p>
            <h2 style={{ margin: "4px 0 8px", fontSize: "1.15rem" }}>{ticket.subject}</h2>
            <p className="dx-note">
              From {ticket.contactName || "someone"} ·{" "}
              <a className="account-link" href={`mailto:${ticket.contactEmail}`}>
                {ticket.contactEmail}
              </a>
            </p>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{ticket.body}</p>
            {ticket.notifyStatus && ticket.notifyStatus !== "sent" ? (
              <p className="dx-note" style={{ color: "var(--gold)", marginTop: 8 }}>
                Email notice: {ticket.notifyStatus}
              </p>
            ) : null}
            <InboxActions id={ticket.id} status={ticket.status} ownerNote={ticket.ownerNote} />
          </section>
        ))
      )}
    </main>
  );
}
