import { KNOWN_KEYS, listVaultEntries, listVaultFormatWarnings, type VaultEntry } from "@/lib/engine/env-vault";
import {
  CREDENTIAL_REGISTRY,
  getCredentialStatuses,
  type CredentialStatus
} from "@/lib/engine/ecosystem-credential-registry";
import { getIntegrationStatuses } from "@/lib/engine/integrations-config";

// The at-a-glance answer to "which keys are still needed and which are already
// provided?" — server-rendered, names only, never values.
//
// Rendered in TWO modes so the same truth appears exactly once per page:
//   - full (on /integrations): the complete checklist — every universal key and
//     every per-app payment slot with its provided / needed / check-value badge.
//   - compact (on the Your-apps page): a one-strip summary — counts plus only
//     the key names that still need action, with the detail living on
//     /integrations. This is the "notice", not a second inventory.
//
// Universal rows come from KNOWN_KEYS (provided = a universal vault entry;
// engine-runtime keys also show whether the engine's own env has it live).
// Payment rows list every Stripe slot an app declares in the credential
// registry, under the EXACT variable name that app reads (Laser reads
// STRIPE_API_KEY, not STRIPE_SECRET_KEY). A stored value that fails its format
// hint (checkValueFormat) is badged "check value" instead of counting as
// cleanly provided.

export type UniversalRow = {
  key: string;
  state: "provided" | "placeholder" | "needed";
  note: string;
};

export type PaymentRow = {
  appName: string;
  slug: string | null;
  envVar: string;
  state: "provided" | "placeholder" | "hosting" | "manual" | "needed";
  note: string;
};

export type KeyStatusData = { universal: UniversalRow[]; payments: PaymentRow[] };

export async function buildKeyStatus(userKey: string | null): Promise<KeyStatusData> {
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

  const universal: UniversalRow[] = KNOWN_KEYS.filter((item) => item.scope === "universal").map((item) => {
    const provided = hasUniversal(item.key);
    const placeholder = provided && warned(item.key, "");
    const engineLive = item.engineRuntime ? Boolean(engineStatuses[item.key] || process.env[item.key]?.trim()) : null;
    if (placeholder) {
      return { key: item.key, state: "placeholder", note: "saved, but the value looks like a placeholder — paste the real one" };
    }
    if (provided) {
      const engineNote =
        engineLive !== null ? (engineLive ? " · live on the engine" : " · reaches the engine on its next redeploy") : "";
      return { key: item.key, state: "provided", note: `saved in your vault${engineNote}` };
    }
    return { key: item.key, state: "needed", note: item.usedFor };
  });

  // Every Stripe slot any registered app declares, under that app's exact
  // variable name. We Succeed's own Stripe pair lives in its Vercel env
  // (INTEGRATION_FIELDS), so its rows read from the engine statuses.
  const payments: PaymentRow[] = [];
  // Selling app builds for credits is PAUSED (owner, 2026-07-09) — these keys
  // only matter if that returns, so an empty slot is informational, never red.
  for (const envVar of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const) {
    payments.push({
      appName: "We Succeed (builds billing — paused)",
      slug: null,
      envVar,
      state: engineStatuses[envVar] ? "hosting" : "manual",
      note: engineStatuses[envVar] ? "set on its hosting" : "not needed unless selling app builds for credits resumes"
    });
  }
  // A universal Stripe entry (not scoped to any app) feeds every GENERATED
  // app's build — surface it, including when it looks like a placeholder.
  // Exception: webhook signing secrets are per endpoint by nature — Stripe
  // issues one per app's webhook — so a universal one is never actually used
  // and shouldn't nag as "re-save the real key".
  for (const envVar of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const) {
    if (!hasUniversal(envVar)) continue;
    const placeholder = warned(envVar, "");
    if (envVar === "STRIPE_WEBHOOK_SECRET") {
      payments.push({
        appName: "Apps built here (universal)",
        slug: null,
        envVar,
        state: "manual",
        note: "webhook secrets are per app endpoint (each app's hosting has its own) — a universal value is never used; safe to remove"
      });
      continue;
    }
    payments.push({
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
      let state: PaymentRow["state"];
      let note: string;
      if (key.whoProvides === "already-set") {
        state = "hosting";
        note = "already live on the app's hosting — nothing to enter";
      } else if (inVault && warned(key.envVar, group.slug)) {
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
      payments.push({ appName: group.name, slug: group.slug, envVar: key.envVar, state, note });
    }
  }

  return { universal, payments };
}

function statusBadge(kind: "set" | "needed" | "manual", label: string) {
  return <span className={`integration-status integration-status--${kind}`}>{label}</span>;
}

function badgeFor(state: UniversalRow["state"] | PaymentRow["state"]) {
  if (state === "provided" || state === "hosting") return statusBadge("set", "provided");
  if (state === "placeholder") return statusBadge("manual", "check value");
  if (state === "manual") return statusBadge("manual", "unverified");
  return statusBadge("needed", "needed");
}

// Compact mode: counts + only what needs action. This is the whole point of the
// strip — it is NOT a second copy of the inventory.
function CompactSummary({ data }: { data: KeyStatusData }) {
  const all: Array<UniversalRow | PaymentRow> = [...data.universal, ...data.payments];
  const nameOf = (row: UniversalRow | PaymentRow) => ("envVar" in row ? row.envVar : row.key);
  const provided = all.filter((row) => row.state === "provided" || row.state === "hosting").length;
  const attention = all.filter((row) => row.state === "placeholder");
  const needed = all.filter((row) => row.state === "needed");
  const neededNames = [...new Set(needed.map(nameOf))];
  const shownNeeded = neededNames.slice(0, 4);

  return (
    <div className="key-summary">
      <p className="key-checklist-row">
        {statusBadge("set", `${provided} provided`)}
        {attention.length > 0 ? statusBadge("manual", `${attention.length} check value`) : null}
        {needed.length > 0 ? statusBadge("needed", `${needed.length} needed`) : null}
        {needed.length === 0 && attention.length === 0 ? (
          <span className="key-checklist-note">everything the apps need is in place</span>
        ) : null}
      </p>
      {attention.length > 0 ? (
        <p className="key-checklist-note">
          Check value: {[...new Set(attention.map(nameOf))].join(", ")}
        </p>
      ) : null}
      {needed.length > 0 ? (
        <p className="key-checklist-note">
          Still needed: {shownNeeded.join(", ")}
          {neededNames.length > shownNeeded.length ? ` +${neededNames.length - shownNeeded.length} more` : ""}
        </p>
      ) : null}
    </div>
  );
}

export async function KeyStatusChecklist({ userKey, compact = false }: { userKey: string | null; compact?: boolean }) {
  const data = await buildKeyStatus(userKey);

  if (compact) {
    return <CompactSummary data={data} />;
  }

  return (
    <div className="integration-grid">
      <div>
        <h3 className="key-checklist-heading">Universal keys — needed once, used everywhere</h3>
        {data.universal.map((row) => (
          <p className="key-checklist-row" key={row.key}>
            {badgeFor(row.state)}
            <code className="cred-var">{row.key}</code>
            <span className="key-checklist-note">{row.note}</span>
          </p>
        ))}
      </div>
      <div>
        <h3 className="key-checklist-heading">Payment keys — one per app taking money</h3>
        {data.payments.map((row) => (
          <p className="key-checklist-row" key={`${row.slug || "we-succeed"}:${row.envVar}:${row.appName}`}>
            {badgeFor(row.state)}
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
