// Ops attention — the "what needs me" half of running the business. For each
// managed app the collector already polls, these checks answer the questions
// Lincoln shouldn't have to dig for: is the live URL actually answering, which
// required env-var NAMES are missing on Vercel (names only — values are never
// read), is the app still on a temporary *.vercel.app address, and is it
// sharing ops stats yet. Every finding carries a plain directed ACTION sentence
// so the dashboard can say "do this", not just "something's off". Best-effort
// everywhere: an unreachable API is a finding, never an exception. SERVER ONLY.

export type OpsAttentionSeverity = "action_needed" | "watch";

export type OpsAttentionItem = {
  id: string; // stable: `${appKey}:${kind}`
  appKey: string;
  slug: string;
  appName: string;
  severity: OpsAttentionSeverity;
  kind: "unreachable" | "missing_env" | "features_unconfigured" | "needs_domain" | "not_reporting";
  finding: string; // what was observed
  action: string; // the directed next step, in plain language
  link?: string; // where to go act, when there is one
};

const FETCH_TIMEOUT_MS = 6000;

// Core env every generated app must have to function; missing one is action_needed.
const GENERATED_CORE_ENV = ["DATABASE_URL", "AUTH_SECRET", "APP_ENGINE_OWNER_EMAIL", "APP_ENGINE_STATS_TOKEN"] as const;
// Money/mail connections; missing means the feature waits on the owner's keys (watch).
const GENERATED_FEATURE_ENV = ["STRIPE_SECRET_KEY", "RESEND_API_KEY", "SENDER_EMAIL"] as const;

// Test hook + future-proofing only; production uses the real Vercel API.
function vercelApiBase(): string {
  return (process.env.APP_ENGINE_VERCEL_API_BASE || "https://api.vercel.com").replace(/\/+$/, "");
}

export function vercelEnvAuditConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN?.trim());
}

// Does the live URL answer? Follows the verifyDeployedApp convention: any
// 2xx/3xx counts as ok (auth walls and redirects are still "up"). An HTTP
// error status is reported distinctly from a dead connection so the finding
// can say what actually happened.
export type UrlCheck = { ok: boolean; status: number | null };

export async function checkUrlReachable(url: string): Promise<UrlCheck | null> {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    return { ok: response.status >= 200 && response.status < 400, status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

// Lists the env var NAMES set on a Vercel project (never values — the API's
// list endpoint returns encrypted entries and we only read the keys).
export async function listVercelEnvNames(projectName: string): Promise<Set<string> | null> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token || !projectName) return null;
  try {
    const response = await fetch(`${vercelApiBase()}/v9/projects/${encodeURIComponent(projectName)}/env`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store"
    });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => null)) as { envs?: Array<{ key?: string }> } | null;
    if (!data || !Array.isArray(data.envs)) return null;
    return new Set(data.envs.map((entry) => (typeof entry.key === "string" ? entry.key : "")).filter(Boolean));
  } catch {
    return null;
  }
}

export function isTemporaryVercelHost(url: string): boolean {
  try {
    return /^https?:\/\//.test(url) && new URL(url).host.toLowerCase().endsWith(".vercel.app");
  } catch {
    return false;
  }
}

type AttentionSubject = {
  appKey: string;
  slug: string;
  appName: string;
  url: string; // "" when the app has no live URL to check
  vercelProject?: string; // set for engine-deployed apps (enables the env audit)
  generatedApp: boolean; // true = we know its required env contract
  live: boolean;
  reporting: boolean; // from the stats poll
};

function item(
  subject: AttentionSubject,
  kind: OpsAttentionItem["kind"],
  severity: OpsAttentionSeverity,
  finding: string,
  action: string,
  link?: string
): OpsAttentionItem {
  return { id: `${subject.appKey}:${kind}`, appKey: subject.appKey, slug: subject.slug, appName: subject.appName, severity, kind, finding, action, link };
}

// All checks for one app, in parallel where they involve the network.
export async function collectAttentionForApp(subject: AttentionSubject): Promise<OpsAttentionItem[]> {
  const items: OpsAttentionItem[] = [];

  const [reachable, envNames] = await Promise.all([
    subject.url ? checkUrlReachable(subject.url) : Promise.resolve(null),
    subject.vercelProject ? listVercelEnvNames(subject.vercelProject) : Promise.resolve(null)
  ]);

  if (reachable && !reachable.ok) {
    // A successful stats poll proves the app itself is alive — then a failing
    // homepage is a page problem (watch), not an outage (act now). Never cry
    // "down" about an app that just answered us.
    if (subject.reporting) {
      items.push(
        item(
          subject,
          "unreachable",
          "watch",
          `The app answers its stats endpoint, but its homepage ${reachable.status ? `returned ${reachable.status}` : "didn't answer"}.`,
          `Open ${subject.url} and check what visitors see on ${subject.appName}'s front page.`,
          subject.url
        )
      );
    } else {
      items.push(
        item(
          subject,
          "unreachable",
          "action_needed",
          `${subject.url} ${reachable.status ? `returned ${reachable.status}` : "didn't answer"}.`,
          `Open the app's Vercel deployments and redeploy or roll back ${subject.appName}.`,
          subject.vercelProject ? `https://vercel.com/lincolnnunnallys-projects/${subject.vercelProject}` : subject.url
        )
      );
    }
  }

  if (envNames) {
    const missingCore = GENERATED_CORE_ENV.filter((name) => !envNames.has(name));
    if (missingCore.length) {
      items.push(
        item(
          subject,
          "missing_env",
          "action_needed",
          `Missing required env: ${missingCore.join(", ")}.`,
          `Add ${missingCore.join(", ")} to ${subject.vercelProject} on Vercel, then redeploy.`,
          `https://vercel.com/lincolnnunnallys-projects/${subject.vercelProject}/settings/environment-variables`
        )
      );
    }
    const missingFeature = GENERATED_FEATURE_ENV.filter((name) => !envNames.has(name));
    if (missingFeature.length) {
      items.push(
        item(
          subject,
          "features_unconfigured",
          "watch",
          `Payments/email keys not connected yet: ${missingFeature.join(", ")}.`,
          `Connect the owner's keys (${missingFeature.join(", ")}) on ${subject.vercelProject} when ready to take money/send mail.`,
          `https://vercel.com/lincolnnunnallys-projects/${subject.vercelProject}/settings/environment-variables`
        )
      );
    }
  }

  if (subject.url && isTemporaryVercelHost(subject.url)) {
    items.push(
      item(
        subject,
        "needs_domain",
        "watch",
        `Still on a temporary Vercel address (${new URL(subject.url).host}).`,
        `Pick a real domain for ${subject.appName} — the engine's domain step can check availability and attach it.`,
        subject.url
      )
    );
  }

  if (subject.live && !subject.reporting && subject.url) {
    items.push(
      item(
        subject,
        "not_reporting",
        "watch",
        "Live, but not sharing ops stats yet.",
        subject.generatedApp
          ? `Redeploy ${subject.appName} through the engine so it picks up the stats endpoint + token.`
          : `Add the /api/admin/stats endpoint to ${subject.appName} and register its token in APP_ENGINE_OPS_TARGETS.`,
        subject.url
      )
    );
  }

  return items;
}

// Sort: things to act on first, then watch items; stable by app name inside each band.
export function sortAttentionItems(items: OpsAttentionItem[]): OpsAttentionItem[] {
  const rank: Record<OpsAttentionSeverity, number> = { action_needed: 0, watch: 1 };
  return [...items].sort((a, b) => rank[a.severity] - rank[b.severity] || a.appName.localeCompare(b.appName) || a.kind.localeCompare(b.kind));
}
