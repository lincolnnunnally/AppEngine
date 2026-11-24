import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { loadMarketing } from "@/lib/engine/marketing";

// Marketing at a glance (owner, 2026-11-24): what each site published, what is queued, what went to the
// company Facebook Pages, and what the writing cost this month. Read-only; the controls live where the
// work happens (Ideas to stop or edit a piece, ChurchConnect Super Admin to post by hand).
export const dynamic = "force-dynamic";

function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function MarketingPage() {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const report = await loadMarketing();

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">Marketing</p>
        <h1 className="dx-display">
          What went <em>out</em>, and what&apos;s next.
        </h1>
        <p className="dx-lede">
          Every site&apos;s guides and articles come from one library, written from your ideas and from what people search. New pieces wait 12
          hours before they publish, so you can stop any of them in{" "}
          <a className="account-link" href="https://ideas.unitedundergod.org/publishing" target="_blank" rel="noreferrer">
            Ideas
          </a>
          . New pieces are shared to the company Facebook Pages once a day, and you can post by hand from{" "}
          <a className="account-link" href="https://www.churchconnect.cloud/admin" target="_blank" rel="noreferrer">
            Super Admin → Social Media
          </a>
          .
        </p>
      </section>

      {report.state !== "ok" ? (
        <section className="panel">
          <p className="dx-note">Not connected: {report.reason}</p>
        </section>
      ) : (
        <>
          {(["business", "ministry"] as const).map((group) => (
            <section className="panel" key={group}>
              <p className="dx-label">{group === "business" ? "Businesses" : "ChurchConnect & ministries"}</p>
              {report.sites
                .filter((s) => s.group === group)
                .map((s) => (
                  <p className="dx-row" key={s.app}>
                    <a className="account-link" href={s.guides} target="_blank" rel="noreferrer">
                      <b>{s.label}</b>
                    </a>
                    <span className="dx-note">
                      {s.live ? "" : "site not showing guides yet · "}
                      {s.published7d} published this week · {s.queued} queued
                      {s.demandThisMonth ? ` · ${s.demandThisMonth} written from searches this month` : ""}
                      {s.next ? ` · next: “${s.next.title}” ${when(s.next.at)}` : ""}
                    </span>
                    {s.last ? (
                      <a className="dx-tag" href={s.last.url} target="_blank" rel="noreferrer">
                        latest: {s.last.title.slice(0, 60)}
                      </a>
                    ) : null}
                  </p>
                ))}
            </section>
          ))}

          <section className="panel">
            <p className="dx-label">Facebook &amp; Instagram, last 7 days</p>
            {report.pages === null ? (
              <p className="dx-note">The company posts could not be read.</p>
            ) : report.pages.length === 0 ? (
              <p className="dx-note">No company posts in the last 7 days.</p>
            ) : (
              report.pages.map((p) => (
                <p className="dx-row" key={p.page}>
                  <b>{p.page}</b>
                  <span className="dx-note">
                    {p.published} posted · {p.scheduled} waiting · {p.automatic} shared automatically
                    {p.failed ? ` · ${p.failed} failed (${p.lastError})` : ""}
                  </span>
                  {p.latest?.url ? (
                    <a className="dx-tag" href={p.latest.url} target="_blank" rel="noreferrer">
                      latest: {p.latest.text.slice(0, 50)}
                    </a>
                  ) : null}
                </p>
              ))
            )}
          </section>

          <section className="panel">
            <p className="dx-label">Writing cost this month</p>
            {report.usage === null ? (
              <p className="dx-note">The usage log could not be read.</p>
            ) : (
              <p className="dx-row">
                <b>{report.usage.guides} guides written from searches</b>
                <span className="dx-note">
                  {report.usage.inputTokens.toLocaleString()} tokens in · {report.usage.outputTokens.toLocaleString()} tokens out · about $
                  {report.usage.estimatedUsd.toFixed(2)} (estimate; Anthropic&apos;s bill is the real number). Capped at 60 guides a month.
                </span>
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
