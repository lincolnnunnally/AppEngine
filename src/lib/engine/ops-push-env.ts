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
    return { ok: false, message: `Add ${envVar} to your key vault first (in Your keys), then push it here.` };
  }

  return upsertVercelEnv(group.vercelProjectId, envVar, value);
}
