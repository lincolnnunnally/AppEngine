import { DASHBOARD_ORIGIN, FACTORY_ORIGIN } from "./hosts";

// Auth.js catch-all lives at src/app/api/auth/[...nextauth]/route.ts.
// The GitHub provider callback is therefore this exact path — do not invent
// /auth/callback, /api/callback/github, or a second OAuth app.
export const GITHUB_PROVIDER_ID = "github";
export const GITHUB_OAUTH_CALLBACK_PATH = `/api/auth/callback/${GITHUB_PROVIDER_ID}`;

// Existing AppEngine GitHub OAuth App (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET).
// Auth.js is host-aware (trustHost, AUTH_URL unpinned). Soft-launch hosts
// therefore emit their own redirect_uri. OWNER STEP: ADD these two URLs on
// that one app (do not replace localhost; do not create a second app).
// we-succeed.org is reserved for a different future use — not App Engine
// soft-launch — do not register its callback.
export const PRODUCTION_GITHUB_OAUTH_CALLBACK_URLS = [
  `${FACTORY_ORIGIN}${GITHUB_OAUTH_CALLBACK_PATH}`,
  `${DASHBOARD_ORIGIN}${GITHUB_OAUTH_CALLBACK_PATH}`
] as const;

export function githubOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${GITHUB_OAUTH_CALLBACK_PATH}`;
}
