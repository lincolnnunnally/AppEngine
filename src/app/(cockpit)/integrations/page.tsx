import { redirect } from "next/navigation";
import { canAccessEngineOwner } from "@/lib/auth/access";
import {
  INTEGRATION_FIELDS,
  applyIntegrationChanges,
  getIntegrationStatuses,
  hasVercelConfigApi,
  setAppEnvValue,
  setCustomIntegrationValue,
  setIntegrationValue
} from "@/lib/engine/integrations-config";
import {
  CREDENTIAL_REGISTRY,
  getCredentialStatuses,
  type CredentialStatus
} from "@/lib/engine/ecosystem-credential-registry";
import { hasBackendDeployProfile } from "@/lib/engine/app-backend-deploy";
import { pushableKeyCount } from "@/lib/engine/ops-push-env";
import { RenderDeployPanel } from "@/components/engine/render-deploy-panel";
import { CredentialPushAllButton } from "@/components/engine/credential-push-all-button";

// Owner-only, single home for every secret and variable. We Succeed's own keys
// write straight to its Vercel project; a custom-variable row adds anything; and
// each other app has its own section that writes straight to THAT app's Vercel
// project. This replaces the old split across /integrations + /account "Your keys"
// + /credentials — one page, one write path. Server actions re-check owner access
// on every call; secret values are never sent back to the browser, only status.
export const dynamic = "force-dynamic";

const HOST_LABEL: Record<string, string> = { vercel: "Vercel", render: "Render", supabase: "Supabase", provider: "Provider" };
const CRED_STATUS_LABEL: Record<CredentialStatus, string> = {
  set: "set",
  missing: "not set",
  manual: "set in its dashboard",
  known: "set"
};
function credStatusClass(status: CredentialStatus): string {
  if (status === "set" || status === "known") return "set";
  if (status === "missing") return "unset";
  return "manual";
}

function back(message: string, ok: boolean): never {
  redirect(`/integrations?msg=${encodeURIComponent(message)}&ok=${ok ? "1" : "0"}`);
}

async function saveAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineOwner())) redirect("/");
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "");
  const result = await setIntegrationValue(key, value);
  back(result.message, result.ok);
}

async function saveCustomAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineOwner())) redirect("/");
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "");
  const result = await setCustomIntegrationValue(key, value);
  back(result.message, result.ok);
}

async function saveAppKeyAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineOwner())) redirect("/");
  const slug = String(formData.get("slug") || "");
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "");
  const result = await setAppEnvValue(slug, key, value);
  back(result.message, result.ok);
}

async function applyAction() {
  "use server";
  if (!(await canAccessEngineOwner())) redirect("/");
  const result = await applyIntegrationChanges();
  back(result.message, result.ok);
}

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<{ msg?: string; ok?: string }>;
}) {
  if (!(await canAccessEngineOwner())) {
    redirect("/");
  }

  const params = await searchParams;
  const notice = params.msg ? { ok: params.ok === "1", message: params.msg } : null;
  const statuses = await getIntegrationStatuses();
  const credStatuses = await getCredentialStatuses().catch(() => ({} as Record<string, CredentialStatus>));
  const apiReady = hasVercelConfigApi();
  const renderKeyStored = Boolean(process.env.RENDER_API_KEY?.trim());
  const groups = [...new Set(INTEGRATION_FIELDS.map((field) => field.group))];
  // Every registered app except We Succeed itself (that's the own-keys section above).
  const otherApps = CREDENTIAL_REGISTRY.filter((app) => app.slug !== "appengine-core");

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Owner</p>
        <h1>Integrations &amp; secrets</h1>
        <p>
          The one place for every secret and variable — for We Succeed and for each app you own. Paste a value,
          it&apos;s saved to that app&apos;s hosting (encrypted), and goes live on the next deploy. Secret values are
          never shown back — a field marked <strong>set</strong> already has one; enter a new value to replace it.
        </p>
        {!apiReady ? (
          <p className="integration-warn">Saving is disabled because the hosting API isn&apos;t configured on this environment.</p>
        ) : null}
        {notice ? (
          <p className={`integration-notice integration-notice--${notice.ok ? "ok" : "error"}`}>{notice.message}</p>
        ) : null}
      </section>

      {/* ── We Succeed's own keys ─────────────────────────────────────────── */}
      {groups.map((group) => (
        <section className="panel" key={group}>
          <h2>We Succeed · {group}</h2>
          <div className="integration-grid">
            {INTEGRATION_FIELDS.filter((field) => field.group === group).map((field) => (
              <form key={field.key} action={saveAction} className="integration-row">
                <input type="hidden" name="key" value={field.key} />
                <div className="integration-label">
                  <span>{field.label}</span>
                  <span className={`integration-status integration-status--${statuses[field.key] ? "set" : "unset"}`}>
                    {statuses[field.key] ? "set" : "not set"}
                  </span>
                </div>
                <div className="integration-input-row">
                  <input
                    className="convo-input integration-input"
                    name="value"
                    type={field.secret ? "password" : "text"}
                    placeholder={field.secret && statuses[field.key] ? "•••••• (set — enter to replace)" : field.placeholder || ""}
                    autoComplete="off"
                  />
                  <button className="soft-launch-action" type="submit" disabled={!apiReady}>Save</button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ))}

      {/* ── Add any variable (the old "Your keys" custom add) ─────────────── */}
      <section className="panel">
        <h2>We Succeed · Add any variable</h2>
        <p className="integration-hint">Need a key that isn&apos;t listed above? Add it by name — it&apos;s saved to We Succeed&apos;s environment, encrypted.</p>
        <form action={saveCustomAction} className="integration-row">
          <div className="integration-input-row">
            <input className="convo-input integration-input" name="key" type="text" placeholder="VARIABLE_NAME" autoComplete="off" />
            <input className="convo-input integration-input" name="value" type="password" placeholder="value" autoComplete="off" />
            <button className="soft-launch-action" type="submit" disabled={!apiReady}>Add</button>
          </div>
        </form>
      </section>

      {/* ── Per-app secrets (the old /credentials page, folded in) ────────── */}
      {otherApps.map((app) => {
        const deployable = hasBackendDeployProfile(app.slug);
        const backendUrl =
          app.keys.find((key) => key.envVar === "VITE_BACKEND_URL")?.publicValue ||
          (app.renderService ? `https://${app.renderService}.onrender.com` : "");
        const pushCount = pushableKeyCount(app.slug);
        return (
        <section className="panel" key={app.slug}>
          <div className="cred-group-head">
            <h2>{app.name}</h2>
            {app.renderService ? <span className="cred-tag">Render: {app.renderService}</span> : null}
            {pushCount > 0 ? <CredentialPushAllButton slug={app.slug} appName={app.name} count={pushCount} /> : null}
          </div>
          <p className="cred-summary">{app.summary}</p>
          {deployable && app.renderService ? (
            <RenderDeployPanel
              slug={app.slug}
              serviceName={app.renderService}
              expectedBackendUrl={backendUrl}
              renderKeyStored={renderKeyStored}
            />
          ) : null}
          <div className="integration-grid">
            {app.keys.map((key) => {
              const status = credStatuses[`${app.slug}:${key.envVar}`] || "manual";
              const pushable = key.host === "vercel" && Boolean(app.vercelProjectId);
              return (
                <form key={key.envVar + key.displayName} action={saveAppKeyAction} className="integration-row">
                  <input type="hidden" name="slug" value={app.slug} />
                  <input type="hidden" name="key" value={key.envVar} />
                  <div className="integration-label">
                    <span>{key.displayName}</span>
                    <span className={`integration-status integration-status--${credStatusClass(status)}`}>
                      {CRED_STATUS_LABEL[status]}
                    </span>
                  </div>
                  <p className="cred-purpose">{key.purpose}</p>
                  {key.publicValue ? <p className="cred-value">value: {key.publicValue}</p> : null}
                  {pushable ? (
                    <div className="integration-input-row">
                      <input
                        className="convo-input integration-input"
                        name="value"
                        type={key.secret ? "password" : "text"}
                        placeholder={key.secret && status === "set" ? "•••••• (set — enter to replace)" : "value"}
                        autoComplete="off"
                      />
                      <button className="soft-launch-action" type="submit" disabled={!apiReady}>Save</button>
                    </div>
                  ) : key.host === "render" && deployable ? (
                    <p className="integration-hint">
                      <code className="cred-var">{key.envVar}</code> · set automatically by <strong>Deploy backend</strong> above — no dashboard step.
                    </p>
                  ) : (
                    <p className="integration-hint">
                      <code className="cred-var">{key.envVar}</code> · {HOST_LABEL[key.host]} — set this in its {HOST_LABEL[key.host]} dashboard ({key.location}).
                    </p>
                  )}
                </form>
              );
            })}
          </div>
        </section>
        );
      })}

      <section className="panel">
        <form action={applyAction}>
          <button className="soft-launch-action" type="submit" disabled={!apiReady}>Apply changes (redeploy We Succeed)</button>
          <p className="integration-hint">Saving stores the values; a redeploy of each app is what makes its values live.</p>
        </form>
      </section>
    </main>
  );
}
