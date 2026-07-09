import { KNOWN_KEYS, listVaultEntries, listVaultFormatWarnings, type VaultEntry } from "@/lib/engine/env-vault";
import {
  CREDENTIAL_REGISTRY,
  getCredentialStatuses,
  type CredentialStatus
} from "@/lib/engine/ecosystem-credential-registry";
import { getIntegrationStatuses } from "@/lib/engine/integrations-config";

// The at-a-glance answer to "which keys are still needed and which are already
// provided?" — rendered wherever key names appear (the Your-keys section on
// /integrations and the owner's Your-apps panel), server-side, names only.
//
// One component, two sections:
//   1. Universal keys from KNOWN_KEYS: provided = a universal vault entry exists
//      (engine-runtime keys also show whether the engine's own env has it live).
//   2. Per-app payment keys: every Stripe slot an app declares in the credential
//      registry, under the EXACT variable name that app reads (Laser reads
//      STRIPE_API_KEY, not STRIPE_SECRET_KEY) — provided = a vault entry scoped
//      to that app, or the app's hosting already has it.
// A stored value that fails its format hint (checkValueFormat) is badged as
// "check value" instead of counting as cleanly provided.

type ChecklistProps = {
  userKey: string | null;
};

function statusBadge(kind: "set" | "needed" | "manual", label: string) {
  return <span className={`integration-status integration-status--${kind}`}>{label}</span>;
}

export async function KeyStatusChecklist({ userKey }: ChecklistProps) {
  let entries: VaultEntry[] = [];
  let warnings: Array<{ key: string; appScope: string }> = [];
  if (userKey) {
    entries = await listVaultEntries(userKey).catch(() => []);
    warnings = await listVaultFormatWarnings(userKey).catch(() => []);
  }
  const credStatuses = await getCredentialStatuses().catch(() => ({} as Record<string, CredentialStatus>));
  const engineStatuses = await getIntegrationStatuses().catch(() => ({} as Record<string, boolean>));

  const hasUniversal = (key: string) => entries.some((entry) => entry.key === key && !entry.appScope);
  const hasScoped = (key: string, slug: string) => entries.some((entry) => entry.key === key && entry.appScope === slug);
  const warned = (key: string, scope: string) => warnings.some((warning) => warning.key === key && warning.appScope === scope);

  const universalKeys = KNOWN_KEYS.filter((item) => item.scope === "universal");

  // Every Stripe slot any registered app declares, under that app's exact
  // variable name. We Succeed's own Stripe pair lives in its Vercel env
  // (INTEGRATION_FIELDS), so its row reads from the engine statuses.
  const paymentRows: Array<{ appName: string; slug: string | null; envVar: string; state: "provided" | "placeholder" | "hosting" | "manual" | "needed"; note: string }> = [];
  paymentRows.push(
    {
      appName: "We Succeed (builds billing)",
      slug: null,
      envVar: "STRIPE_SECRET_KEY",
      state: engineStatuses.STRIPE_SECRET_KEY ? "hosting" : "needed",
      note: engineStatuses.STRIPE_SECRET_KEY ? "set on its hosting" : "enter in the We Succeed · Payments section"
    },
    {
      appName: "We Succeed (builds billing)",
      slug: null,
      envVar: "STRIPE_WEBHOOK_SECRET",
      state: engineStatuses.STRIPE_WEBHOOK_SECRET ? "hosting" : "needed",
      note: engineStatuses.STRIPE_WEBHOOK_SECRET ? "set on its hosting" : "enter in the We Succeed · Payments section"
    }
  );
  // A universal Stripe entry (not scoped to any app) feeds every GENERATED app's
  // build — surface it too, including when its value looks like a placeholder.
  // Ecosystem apps below still want their own scoped keys under their exact names.
  for (const envVar of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
    if (!hasUniversal(envVar)) continue;
    const placeholder = warned(envVar, "");
    paymentRows.push({
      appName: "Apps built here (universal)",
      slug: null,
      envVar,
      state: placeholder ? "placeholder" : "provided",
      note: placeholder
        ? "saved universally but the value looks like a placeholder — re-save the real key"
        : "saved universally — every app you generate here starts with it"
    });
  }
  for (const group of CREDENTIAL_REGISTRY) {
    for (const key of group.keys) {
      if (!/STRIPE/i.test(key.envVar)) continue;
      const inVault = hasScoped(key.envVar, group.slug);
      const hosting = credStatuses[`${group.slug}:${key.envVar}`];
      let state: (typeof paymentRows)[number]["state"];
      let note: string;
      if (inVault && warned(key.envVar, group.slug)) {
        state = "placeholder";
        note = "in your vault but the value doesn't look real — re-save it";
      } else if (inVault) {
        state = "provided";
        note = "in your vault (scoped to this app)";
      } else if (hosting === "set" || hosting === "known") {
        state = "hosting";
        note = "set on the app's hosting";
      } else if (key.statusMode === "manual") {
        state = "manual";
        note = `save it here scoped to ${group.name}, or confirm in its dashboard`;
      } else {
        state = "needed";
        note = `save it here scoped to ${group.name}`;
      }
      paymentRows.push({ appName: group.name, slug: group.slug, envVar: key.envVar, state, note });
    }
  }

  return (
    <div className="integration-grid">
      <div>
        <h3 className="key-checklist-heading">Universal keys — needed once, used everywhere</h3>
        {universalKeys.map((item) => {
          const provided = hasUniversal(item.key);
          const placeholder = provided && warned(item.key, "");
          const engineLive = item.engineRuntime ? Boolean(engineStatuses[item.key] || process.env[item.key]?.trim()) : null;
          return (
            <p className="key-checklist-row" key={item.key}>
              {placeholder
                ? statusBadge("manual", "check value")
                : provided
                  ? statusBadge("set", "provided")
                  : statusBadge("needed", "needed")}
              <code className="cred-var">{item.key}</code>
              <span className="key-checklist-note">
                {placeholder
                  ? "saved, but the value looks like a placeholder — paste the real one"
                  : provided
                    ? "saved in your vault"
                    : item.usedFor}
                {engineLive !== null && provided && !placeholder
                  ? engineLive
                    ? " · live on the engine"
                    : " · reaches the engine on its next redeploy"
                  : null}
              </span>
            </p>
          );
        })}
      </div>
      <div>
        <h3 className="key-checklist-heading">Payment keys — one per app taking money</h3>
        {paymentRows.map((row) => (
          <p className="key-checklist-row" key={`${row.slug || "we-succeed"}:${row.envVar}:${row.appName}`}>
            {row.state === "provided" || row.state === "hosting"
              ? statusBadge("set", "provided")
              : row.state === "placeholder"
                ? statusBadge("manual", "check value")
                : row.state === "manual"
                  ? statusBadge("manual", "unverified")
                  : statusBadge("needed", "needed")}
            <strong className="key-checklist-app">{row.appName}</strong>
            <code className="cred-var">{row.envVar}</code>
            <span className="key-checklist-note">{row.note}</span>
          </p>
        ))}
        <p className="integration-hint">
          Each app taking payments uses its own Stripe keys under its own variable name — that keeps every
          app&apos;s revenue separate. Scope the key to the app when you save it.
        </p>
      </div>
    </div>
  );
}
