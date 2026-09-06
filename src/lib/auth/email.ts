import { getConfiguredDatabaseUrl } from "../engine/local-mode";

// Resend rejects reserved destinations (example.com) with a 422. Auth.js maps
// that throw to `Configuration`, which the sign-in page reads as "isn't
// configured" — leftover walks that submit the placeholder then look broken.
const reservedTestDomains = new Set(["example.com", "example.net", "example.org", "example.edu", "localhost", "invalid", "test"]);

// Resend can only send from this verified subdomain (see notify.ts).
export const VERIFIED_RESEND_FROM_DOMAIN = "emails.unitedundergod.org";

type RuntimeEnv = Record<string, string | undefined>;

export function normalizeSignInEmail(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  const angled = raw.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : raw).trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) {
    return undefined;
  }

  const [local, domain] = candidate.split("@");

  if (!local || !domain) {
    return undefined;
  }

  return `${local.replace(/\s/g, "").replace(/,/g, ".")}@${domain.split(",")[0]}`;
}

export function isReservedTestEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return reservedTestDomains.has(domain);
}

export function resolveAuthEmailFrom(env: RuntimeEnv = process.env): string | undefined {
  const raw = env.EMAIL_FROM?.trim();

  if (!raw) {
    return undefined;
  }

  const parsed = normalizeSignInEmail(raw);

  if (!parsed) {
    return undefined;
  }

  const domain = parsed.split("@")[1];

  if (domain === VERIFIED_RESEND_FROM_DOMAIN) {
    return raw;
  }

  const display = raw.match(/^([^<]+)</)?.[1]?.trim() || "AppEngine";
  const local = parsed.split("@")[0] || "signin";

  return `${display} <${local}@${VERIFIED_RESEND_FROM_DOMAIN}>`;
}

// Email magic-link needs the Resend key, a usable From, AND the database
// adapter (verification tokens). Keep this aligned with buildProviders.
export function hasEmailSignInConfig(env: RuntimeEnv = process.env): boolean {
  return Boolean(getConfiguredDatabaseUrl(env) && env.AUTH_RESEND_KEY?.trim() && resolveAuthEmailFrom(env));
}
