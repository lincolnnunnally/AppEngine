import { redirect } from "next/navigation";
import { canAccessEngineOwner } from "@/lib/auth/access";
import {
  INTEGRATION_FIELDS,
  applyIntegrationChanges,
  getIntegrationStatuses,
  hasVercelConfigApi,
  setIntegrationValue
} from "@/lib/engine/integrations-config";

// Owner-only credential entry. Server actions re-check owner access on every call
// (they're independently invocable endpoints), and secret values are never sent
// back to the browser — only set/not-set status.
export const dynamic = "force-dynamic";

function back(message: string, ok: boolean): never {
  redirect(`/integrations?msg=${encodeURIComponent(message)}&ok=${ok ? "1" : "0"}`);
}

async function saveAction(formData: FormData) {
  "use server";
  if (!(await canAccessEngineOwner())) {
    redirect("/");
  }
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "");
  const result = await setIntegrationValue(key, value);
  back(result.message, result.ok);
}

async function applyAction() {
  "use server";
  if (!(await canAccessEngineOwner())) {
    redirect("/");
  }
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
  const apiReady = hasVercelConfigApi();
  const groups = [...new Set(INTEGRATION_FIELDS.map((field) => field.group))];

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Owner</p>
        <h1>Integrations</h1>
        <p>
          Paste your provider credentials here. They&apos;re saved to hosting (encrypted) and go live after you click
          “Apply changes.” Secret values are never shown back — a field marked <strong>set</strong> already has a value;
          enter a new one to replace it.
        </p>
        {!apiReady ? (
          <p className="integration-warn">Saving is disabled because the hosting API isn&apos;t configured on this environment.</p>
        ) : null}
        {notice ? (
          <p className={`integration-notice integration-notice--${notice.ok ? "ok" : "error"}`}>{notice.message}</p>
        ) : null}
      </section>

      {groups.map((group) => (
        <section className="panel" key={group}>
          <h2>{group}</h2>
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
                  <button className="soft-launch-action" type="submit" disabled={!apiReady}>
                    Save
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ))}

      <section className="panel">
        <form action={applyAction}>
          <button className="soft-launch-action" type="submit" disabled={!apiReady}>
            Apply changes (redeploy)
          </button>
          <p className="integration-hint">Saving stores the values; a redeploy is what makes them live.</p>
        </form>
      </section>
    </main>
  );
}
