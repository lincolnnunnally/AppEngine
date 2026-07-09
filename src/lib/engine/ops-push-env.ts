// Push-to-Vercel — the one action that turns the key vault from "stored" into
// "the app actually has it." For a Vercel-hosted ecosystem app, it copies ONE
// value the owner has already saved in their vault into that app's Vercel project
// env, so they don't paste it by hand. Deliberately narrow and safe:
//   - owner only (the route gates on canAccessEngineOwner);
//   - only keys that are a DEFINED Vercel slot for that app in the credential
//     registry (no arbitrary key injection);
//   - only the app's OWN registry project id (never a caller-supplied project);
//   - only a value already in the owner's vault (nothing is invented);
//   - the value is written encrypted and never logged or returned.
// Render/Supabase-hosted keys are NOT pushable here (no Render API) — those stay
// manual, exactly as the credentials page says. SERVER ONLY.
import { CREDENTIAL_REGISTRY } from "@/lib/engine/ecosystem-credential-registry";
import { resolveEnvForApp } from "@/lib/engine/env-vault";

const VERCEL_API = "https://api.vercel.com";

export type PushEnvResult = { ok: boolean; message: string };

function vercelToken(): string | undefined {
  return process.env.VERCEL_TOKEN?.trim();
}

// True only for keys we can actually push: a Vercel-hosted slot on an app whose
// registry entry carries a real project id.
export function isPushableCredential(slug: string, envVar: string): boolean {
  const group = CREDENTIAL_REGISTRY.find((entry) => entry.slug === slug);
  if (!group || !group.vercelProjectId) return false;
  return group.keys.some((key) => key.envVar === envVar && key.host === "vercel");
}

// Writes one env var into a Vercel project (upsert), encrypted, prod + preview —
// the same call the deploy path uses. Best-effort with a clear message.
async function upsertVercelEnv(projectId: string, key: string, value: string): Promise<PushEnvResult> {
  const token = vercelToken();
  if (!token) return { ok: false, message: "Hosting isn't configured here (no VERCEL_TOKEN)." };
  try {
    const response = await fetch(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview"] })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, message: data.error?.message || `Vercel rejected the write (${response.status}).` };
    }
    return { ok: true, message: "Pushed to Vercel. Redeploy the app to pick it up." };
  } catch {
    return { ok: false, message: "Couldn't reach Vercel just now — try again." };
  }
}

// The whole action: validate the target, read the value from the owner's vault,
// write it to the app's Vercel project. `ownerEmail` is the signed-in owner (the
// vault is per-user); `slug`/`envVar` name the app and the exact variable.
export async function pushVaultValueToVercel(ownerEmail: string, slug: string, envVar: string): Promise<PushEnvResult> {
  const group = CREDENTIAL_REGISTRY.find((entry) => entry.slug === slug);
  if (!group || !group.vercelProjectId) {
    return { ok: false, message: "That app isn't a Vercel project I can push to. Set it in the provider's dashboard." };
  }
  const known = group.keys.find((key) => key.envVar === envVar && key.host === "vercel");
  if (!known) {
    return { ok: false, message: "That key isn't a known Vercel slot for this app." };
  }

  const vaultEnv = await resolveEnvForApp(ownerEmail, slug).catch(() => ({} as Record<string, string>));
  const value = vaultEnv[envVar];
  if (!value) {
    return { ok: false, message: `Add ${envVar} to your key vault first (Your keys, top of Integrations & secrets), then push it here.` };
  }

  return upsertVercelEnv(group.vercelProjectId, envVar, value);
}

export type PushAllResult = PushEnvResult & { pushed: number; skipped: number; total: number };

// How many of an app's keys this tool can actually push (Vercel-hosted slots on a
// registered project). Used to decide whether to offer the "push everything" action.
export function pushableKeyCount(slug: string): number {
  const group = CREDENTIAL_REGISTRY.find((entry) => entry.slug === slug);
  if (!group || !group.vercelProjectId) return 0;
  return group.keys.filter((key) => key.host === "vercel").length;
}

// The one-click "each app pulls what it needs" action: for every Vercel-hosted
// slot on this app, push the value the owner has saved in their vault. Skips slots
// with no vault value (nothing invented) and reports how many landed. This is what
// makes the single vault behave as the single source for an existing app — no more
// one-key-at-a-time.
export async function pushAllVaultValuesToVercel(ownerEmail: string, slug: string): Promise<PushAllResult> {
  const group = CREDENTIAL_REGISTRY.find((entry) => entry.slug === slug);
  if (!group || !group.vercelProjectId) {
    return { ok: false, message: "That app isn't a Vercel project I can push to. Set it in the provider's dashboard.", pushed: 0, skipped: 0, total: 0 };
  }
  const vercelKeys = group.keys.filter((key) => key.host === "vercel");
  const vaultEnv = await resolveEnvForApp(ownerEmail, slug).catch(() => ({} as Record<string, string>));

  let pushed = 0;
  let failed = 0;
  let missing = 0;
  for (const key of vercelKeys) {
    const value = vaultEnv[key.envVar];
    if (!value) { missing += 1; continue; }
    const result = await upsertVercelEnv(group.vercelProjectId, key.envVar, value);
    if (result.ok) pushed += 1; else failed += 1;
  }

  const skipped = missing + failed;
  if (pushed === 0) {
    return {
      ok: false,
      pushed,
      skipped,
      total: vercelKeys.length,
      message: missing === vercelKeys.length
        ? `None of ${group.name}'s keys are in your key vault yet — add them in Your keys (top of Integrations & secrets), then push.`
        : `Couldn't push any of ${group.name}'s keys just now — try again.`,
    };
  }
  const tail = skipped > 0
    ? ` (${missing} not in your vault${failed ? `, ${failed} failed` : ""})`
    : "";
  return {
    ok: true,
    pushed,
    skipped,
    total: vercelKeys.length,
    message: `Pushed ${pushed} key${pushed === 1 ? "" : "s"} into ${group.name}'s Vercel project${tail}. Redeploy the app to pick them up.`,
  };
}
