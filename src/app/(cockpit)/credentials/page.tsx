import { redirect } from "next/navigation";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { CredentialPushButton } from "@/components/engine/credential-push-button";
import {
  CREDENTIAL_REGISTRY,
  getCredentialStatuses,
  hasVercelReadApi,
  type CredentialStatus
} from "@/lib/engine/ecosystem-credential-registry";
import { isPushableCredential } from "@/lib/engine/ops-push-env";

// Owner-only, read-only reference: for each ecosystem app, the uniquely-named
// keys it needs, WHERE each goes (Vercel project / Render service), the exact
// variable the app reads, and set/missing status. No secret values ever cross
// to the browser — only status. This is a map, not an editor: keys on other
// apps' Vercel projects and all Render services are set in those dashboards.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<CredentialStatus, string> = {
  set: "set",
  missing: "missing",
  manual: "check in dashboard",
  known: "known value"
};

function statusClass(status: CredentialStatus): string {
  // reuse the integration-status chip styles (set/unset), plus manual/known
  if (status === "set" || status === "known") return "set";
  if (status === "missing") return "unset";
  return "manual";
}

const HOST_LABEL: Record<string, string> = {
  vercel: "Vercel",
  render: "Render",
  supabase: "Supabase",
  provider: "Provider"
};

export default async function CredentialsPage() {
  if (!(await canAccessEngineOwner())) {
    redirect("/");
  }

  const statuses = await getCredentialStatuses();
  const apiReady = hasVercelReadApi();

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Owner</p>
        <h1>App credentials</h1>
        <p>
          Every ecosystem app and the exact keys it needs — each uniquely named, the slot it goes in
          (which Vercel project or Render service), and the variable the app reads. Vercel status is
          live; Render/Supabase values can&apos;t be read from here, so those show{" "}
          <strong>check in dashboard</strong>. No secret values are shown or stored on this page.
        </p>
        {!apiReady ? (
          <p className="integration-warn">Live Vercel status is off (no VERCEL_TOKEN on this environment); everything shows as manual.</p>
        ) : null}
      </section>

      {CREDENTIAL_REGISTRY.map((group) => {
        const loginCritical = group.keys.filter((k) => k.loginCritical);
        const other = group.keys.filter((k) => !k.loginCritical);
        const orderedKeys = [...loginCritical, ...other];
        return (
          <section className="panel" key={group.slug}>
            <div className="cred-group-head">
              <h2>{group.name}</h2>
              {group.renderService ? <span className="cred-tag">Render: {group.renderService}</span> : null}
            </div>
            <p className="cred-summary">{group.summary}</p>
            <div className="cred-table">
              {orderedKeys.map((key) => {
                const status = statuses[`${group.slug}:${key.envVar}`] || "manual";
                return (
                  <div className="cred-row" key={key.envVar + key.displayName}>
                    <div className="cred-main">
                      <div className="cred-name-line">
                        <span className="cred-name">{key.displayName}</span>
                        {key.loginCritical ? <span className="cred-badge cred-badge--login">login</span> : null}
                        <span className={`integration-status integration-status--${statusClass(status)}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <p className="cred-purpose">{key.purpose}</p>
                      {key.publicValue ? <p className="cred-value">value: {key.publicValue}</p> : null}
                    </div>
                    <div className="cred-meta">
                      <code className="cred-var">{key.envVar}</code>
                      <span className="cred-loc">{HOST_LABEL[key.host]} · {key.location}</span>
                      <span className="cred-who">
                        {key.whoProvides === "lincoln" ? "you provide" : key.whoProvides === "auto" ? "auto-generated" : "already set"}
                        {key.secret ? " · secret" : ""}
                      </span>
                      {key.whoProvides === "lincoln" && isPushableCredential(group.slug, key.envVar) ? (
                        <CredentialPushButton slug={group.slug} envVar={key.envVar} appName={group.name} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
