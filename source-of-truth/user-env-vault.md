# User Environment Vault

One place where each signed-in user (Lincoln included) stores the API keys their
apps need, instead of pasting the same values into every app. Owner-requested
(2026-07-02); implemented the same day.

## How it works

- **Store once, apply everywhere.** A shared key (e.g. `RESEND_API_KEY`) is applied
  to EVERY app that user builds. A key scoped to one app (by its project slug)
  overrides the shared value for that app only.
- **Where users manage it:** the "Your keys" section of `/account`. The key catalog
  tells them what each standard key does and exactly where to find it (Resend,
  Stripe, OpenAI, Anthropic dashboards). Custom keys are allowed
  (`CAPITALS_AND_UNDERSCORES`).
- **Where apps get it:** at deploy time, `resolveEnvForApp(user, appSlug)` merges
  shared + app-scoped values into the generated app's Vercel env
  (`customer-build.ts`), so the app just reads `process.env`. Engine-provisioned
  keys (`DATABASE_URL`, `AUTH_SECRET`) always win and cannot be stored in the vault.
- **Security:** values are AES-256-GCM encrypted at rest (key from
  `APP_ENGINE_VAULT_KEY`, falling back to `AUTH_SECRET`) and are WRITE-ONLY — no
  API ever returns a stored value; users replace or remove, never view.
- Table: `app_user_env_vars` (self-creating, unique per user+key+scope).
  API: `/api/account/env` (GET names/scopes only, POST, DELETE), sign-in gated.

## Relationship to the Shared Environment Source Standard

`shared-environment-source-standard.md` (Codex's track) composes `.env` files for
ECOSYSTEM REPOS from a local private file — a developer-workflow tool. This vault is
the same shape (shared source + per-app overrides) one layer up: an in-product
feature for every user's GENERATED apps. They do not overlap in code; keep it that
way — repo env work extends Codex's standard, customer-app env work extends this
vault.

## When a generated app needs a new key

The app's foundation modules already state which keys unlock which features (email,
payments, AI). The ask-of-the-user pattern is: name the key, say what it unlocks,
point to the exact dashboard page ("Where to find it"), and receive it in
`/account → Your keys` — never over chat, never in a file.
