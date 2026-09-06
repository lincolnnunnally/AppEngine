import { DASHBOARD_ORIGIN, FACTORY_ORIGIN } from "./hosts";

// Auth.js catch-all lives at src/app/api/auth/[...nextauth]/route.ts.
// The GitHub provider callback is therefore this exact path — do not invent
// /auth/callback, /api/callback/github, or a second OAuth app.
export const GITHUB_PROVIDER_ID = "github";
export const GITHUB_OAUTH_CALLBACK_PATH = `/api/auth/callback/${GITHUB_PROVIDER_ID}`;

const LEGACY_WWW_FACTORY_ORIGIN = "https://www.we-succeed.org";

// Existing AppEngine GitHub OAuth App (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET).
// Auth.js is host-aware (trustHost, AUTH_URL unpinned). Each production host
// therefore emits its own redirect_uri. Register ALL of these on that one app
// (GitHub Developer settings — owner credential). Do not create a second app.
export const PRODUCTION_GITHUB_OAUTH_CALLBACK_URLS = [
  `${DASHBOARD_ORIGIN}${GITHUB_OAUTH_CALLBACK_PATH}`,
  `${FACTORY_ORIGIN}${GITHUB_OAUTH_CALLBACK_PATH}`,
  `${LEGACY_WWW_FACTORY_ORIGIN}${GITHUB_OAUTH_CALLBACK_PATH}`
] as const;

export function githubOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${GITHUB_OAUTH_CALLBACK_PATH}`;
}
