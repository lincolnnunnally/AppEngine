# Ecosystem Credential Registry

The canonical, per-app answer to "which key goes where, and what variable does
the app read?" — so a missing credential is never described as a vague "we need
a Render key" but as a named key, a specific slot, and an exact variable.

- **Data:** `src/lib/engine/ecosystem-credential-registry.ts` (server-only; names
  and public values only, never secret values).
- **Dashboard:** `/credentials` in the cockpit (operator-only, read-only).
  Vercel-hosted keys show live set/missing status; Render/Supabase keys show
  "check in dashboard" because no Render API key is available to read them.
- **Vocabulary:** mirrors `deployment-environment-standard.md` and
  `template-credential-contract.md` so there is one field vocabulary. Apps key
  off `app-portfolio-registry.ts` slugs. This registry is the *reference* of what
  the owner owes the *ecosystem repos*; the per-user `env-vault.ts` is a separate
  layer (storage for generated customer apps).

## Naming rule for provider keys

One provider **account** has **one** API key that covers every resource in it.
The Render API key that can deploy `churchconnect-backend` is the *same* key that
can create `laser-engrave-api` **if they live in the same Render account**. So:

- Store it **once**, named for the account, not per app
  (e.g. `RENDER_API_KEY` in the shared env / ops tooling).
- Only if ChurchConnect and Laser are in **separate** Render accounts do you have
  two keys — then name them distinctly (`CHURCHCONNECT_RENDER_API_KEY`,
  `LASER_RENDER_API_KEY`) and the registry entries should be split to match.
- A Render **service's own** config (`MONGO_URL`, `JWT_SECRET`, `SUPER_ADMIN_*`,
  `SUPABASE_SERVICE_ROLE_KEY`, SMTP…) is set **on the service** in the Render
  dashboard — that is separate from the account API key.

## Per-app reality (2026-07-03)

| App | Login store | Immediate credential action |
| --- | --- | --- |
| We Succeed | NextAuth + Neon (GitHub live) | None — GitHub works. Optional: `AUTH_GOOGLE_ID/SECRET`, `AUTH_RESEND_KEY`+`EMAIL_FROM` to wake Google + email sign-in. |
| ChurchConnect | Render/Mongo custom JWT | Frontend URL fixed. To log in as admin: merge PR #14, set `SUPER_ADMIN_FORCE_RESET=true` + `SUPER_ADMIN_DEFAULT_PASSWORD` on the `churchconnect-backend` Render service, redeploy. |
| Laser Engrave | Backend JWT over shared LPL Supabase | Create the `laser-engrave-api` Render service (needs the Render account key), set its secrets, then **persist** `VITE_BACKEND_URL` on the laser-engrave-market Vercel project (currently unpersisted). |
| Spark of Hope | Shared LPL Supabase (email+pw) | Keys are fine. Real blockers are non-credential: the Vercel rootDirectory `apps/spark-of-hope` exists on no merged branch (deploys fail), and the shared Supabase has no SMTP (no password-reset email). |

## What "status" means on /credentials

- **set / missing** — read live from the Vercel env-names API for that app's
  project (production target). Values are never fetched.
- **check in dashboard** — Render or Supabase side; can't be read here. Confirm in
  the provider dashboard.
- **known value** — a non-secret value (URL, project id, publishable key) shown
  inline for convenience.

## Keeping it current

When an app's hosting or variable contract changes, update the single
`CREDENTIAL_REGISTRY` array. The `missingCredentialsForApp()` helper is exported
so a future ops/attention queue can list, per app, what the owner still owes —
without duplicating this data anywhere.
