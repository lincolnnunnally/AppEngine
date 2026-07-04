import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessEngineCustomerArea } from "@/lib/auth/access";
import { getBalanceCents, getBillingConfig, isBillingEnabled, normalizeUserKey } from "@/lib/engine/billing";
import { listBuildJobsForUser, type BuildJob, type BuildJobStatus } from "@/lib/engine/build-jobs";
import { listChangeRequestsForUser } from "@/lib/engine/change-requests";
import { BuyCredits } from "@/components/billing/buy-credits";
import { RequestChange } from "@/components/account/request-change";
import { EnvVault } from "@/components/account/env-vault";
import { ApproveApp } from "@/components/account/approve-app";

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
              const isLive = app.status === "live" && Boolean(app.url);
              const isTestLink = Boolean(app.vercelProject) && app.url !== `https://${app.vercelProject}.vercel.app`;
              const meta = (
                <p className="account-app-meta">
                  {created ? `Started ${created}` : "Recently started"}
                  {changes > 0 ? ` · ${changes} change request${changes === 1 ? "" : "s"} on file` : ""}
                </p>
              );
              const head = (
                <div className="account-app-head">
                  <h3>{appTitle(app.idea)}</h3>
                  <span className={`status-badge status-badge--${app.status}`}>{STATUS_LABEL[app.status]}</span>
                </div>
              );
              return (
                <article className="account-app" key={app.id}>
                  {/* Live cards are clickable end to end — the whole card opens the app.
                      Actions (approve, request a change) stay OUTSIDE the link. */}
                  {isLive ? (
                    <a className="account-app-link" href={app.url as string} target="_blank" rel="noreferrer">
                      {head}
                      <p>
                        {isTestLink ? <span className="account-app-meta">Test link: </span> : null}
                        <span className="account-app-url">{app.url}</span>
                      </p>
                      {meta}
                    </a>
                  ) : (
                    <>
                      {head}
                      {app.status === "failed" && app.error ? <p className="account-app-error">{app.error}</p> : null}
                      {meta}
                    </>
                  )}

                  {isLive && isTestLink && app.deploymentId ? <ApproveApp jobId={app.id} /> : null}
                  <RequestChange jobId={app.id} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Your keys</p>
        <h2>Keys for apps you build here</h2>
        <p>
          Add an API key once and every <em>new</em> app you generate here starts with it — email, payments, AI,
          and more. Managing secrets for an app that already exists (We Succeed, or one of your own apps)? Do that
          on <a className="account-link" href="/integrations">Integrations &amp; secrets</a> — the single home for
          every live app&apos;s variables.
        </p>
        <EnvVault
          apps={apps
            .filter((app) => app.vercelProject)
            .map((app) => ({ label: appTitle(app.idea), slug: String(app.vercelProject) }))}
        />
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
