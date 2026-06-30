import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineCustomerArea } from "@/lib/auth/access";
import { getBalanceCents, getBillingConfig, isBillingEnabled, normalizeUserKey } from "@/lib/engine/billing";
import { listBuildJobsForUser, type BuildJob, type BuildJobStatus } from "@/lib/engine/build-jobs";
import { listChangeRequestsForUser } from "@/lib/engine/change-requests";
import { BuyCredits } from "@/components/billing/buy-credits";
import { RequestChange } from "@/components/account/request-change";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<BuildJobStatus, string> = {
  building: "Building",
  deploying: "Publishing",
  live: "Live",
  failed: "Needs attention"
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function appTitle(idea: string): string {
  const trimmed = idea.trim();
  if (!trimmed) return "Untitled app";
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

export default async function AccountPage() {
  if (!(await canAccessEngineCustomerArea())) {
    redirect("/");
  }

  const session = await auth();
  const userKey = normalizeUserKey(session?.user?.email);

  // The customer's apps + the change requests they've filed. Persistence may be
  // off (no DB yet) — fall back to empty so the page never errors.
  let apps: BuildJob[] = [];
  let changeCountByJob = new Map<string, number>();
  if (userKey) {
    try {
      apps = await listBuildJobsForUser(userKey);
    } catch {
      apps = [];
    }
    try {
      const requests = await listChangeRequestsForUser(userKey);
      for (const request of requests) {
        changeCountByJob.set(request.jobId, (changeCountByJob.get(request.jobId) ?? 0) + 1);
      }
    } catch {
      changeCountByJob = new Map();
    }
  }

  // Credits section appears only when billing is turned on + configured.
  const billingOn = isBillingEnabled();
  let balanceLabel: string | null = null;
  if (billingOn && userKey) {
    try {
      balanceLabel = `$${(await getBalanceCents(userKey) / 100).toFixed(2)}`;
    } catch {
      balanceLabel = null;
    }
  }
  const config = getBillingConfig();

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Your apps</p>
        <h1>Your apps</h1>
        <p>Everything you've built lives here. Open a live app, check its status, or ask for a change.</p>
      </section>

      <section className="panel">
        {apps.length === 0 ? (
          <div className="account-empty">
            <p className="eyebrow">No apps yet</p>
            <h2>Build your first app</h2>
            <p>Describe what you want and we'll build it and publish it live.</p>
            <a className="soft-launch-action" href="/build">Start a build</a>
          </div>
        ) : (
          <div className="account-apps">
            {apps.map((app) => {
              const created = formatDate(app.createdAt);
              const changes = changeCountByJob.get(app.id) ?? 0;
              return (
                <article className="account-app" key={app.id}>
                  <div className="account-app-head">
                    <h3>{appTitle(app.idea)}</h3>
                    <span className={`status-badge status-badge--${app.status}`}>{STATUS_LABEL[app.status]}</span>
                  </div>

                  {app.status === "live" && app.url ? (
                    <p>
                      <a href={app.url} target="_blank" rel="noreferrer">{app.url}</a>
                    </p>
                  ) : null}

                  {app.status === "failed" && app.error ? (
                    <p className="account-app-error">{app.error}</p>
                  ) : null}

                  <p className="account-app-meta">
                    {created ? `Started ${created}` : "Recently started"}
                    {changes > 0 ? ` · ${changes} change request${changes === 1 ? "" : "s"} on file` : ""}
                  </p>

                  <RequestChange jobId={app.id} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {billingOn ? (
        <section className="panel">
          <p className="eyebrow">Credits</p>
          <h2>{balanceLabel ?? "$0.00"} available</h2>
          <p>Each app build uses credits. Add more any time — you only pay for what you build.</p>
          <BuyCredits packsCents={config.packsCents} />
        </section>
      ) : null}
    </main>
  );
}
