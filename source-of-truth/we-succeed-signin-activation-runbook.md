# We Succeed — dormant sign-in activation runbook

The live site (www.we-succeed.org) offers ONLY "Sign in with GitHub" today.
Google and email magic-link sign-in are fully coded (`src/auth.ts`
`buildProviders`) and turn on with env vars alone — no code change, no deploy
beyond the env-triggered rebuild. Verified 2026-07-03: `/api/auth/providers`
returns only `github`; the Vercel production env has no `AUTH_GOOGLE_*`,
`AUTH_RESEND_KEY`, or `EMAIL_FROM`.

Public-facing note: the landing page says "Sign in to start" to the general
public (APP_ENGINE_PUBLIC_ACCESS=public), so consumer sign-in options matter —
most visitors don't have GitHub accounts.

## Turn on "Continue with Google"

Add two env vars to the Vercel project `app-engine`
(`prj_exEf0usb6mtXlPrRnwHYUHaSA7L6`), target **Production** (and Preview if you
want it on PR previews), then redeploy:

- `AUTH_GOOGLE_ID` — the OAuth client ID
- `AUTH_GOOGLE_SECRET` — the OAuth client secret

To get them (free, uses your Google account): Google Cloud Console → APIs &
Services → Credentials → Create OAuth client ID → Web application. Authorized
redirect URI must be exactly:

```
https://www.we-succeed.org/api/auth/callback/google
```

Once the vars are present, `buildProviders` includes Google automatically and
`src/app/signin/page.tsx` renders "Continue with Google" as the primary button.

## Turn on the email magic-link ("Email me a sign-in link")

The magic-link (Resend provider) needs BOTH an API key AND the database adapter
(it stores the verification token). The adapter is already live in prod (Neon
`DATABASE_URL` is set), so only two vars are missing:

- `AUTH_RESEND_KEY` — a Resend API key (free tier is fine to start)
- `EMAIL_FROM` — a verified sender, e.g. `no-reply@unitedundergod.org`

Get the key at resend.com (free tier), verify the sending domain/address, then
add both vars to Vercel Production and redeploy. `buildProviders` gates the
Resend provider on `databaseUrl && AUTH_RESEND_KEY && EMAIL_FROM` — all three
will then be true.

## What does NOT need doing

- No code change: both providers are already coded and gated on their env vars.
- No `AUTH_SECRET` / `AUTH_URL` / GitHub work: those are already set in prod.
- No database work for Google (JWT-less DB sessions already run on Neon).

## After activation — verify

```
curl -s https://www.we-succeed.org/api/auth/providers
# expect keys: google, resend (email), github
```

Then load https://www.we-succeed.org/signin and confirm the Google button and
email field render above the (now secondary) GitHub button.

## Cost / fence note

Google OAuth is free. Resend has a free tier; if email volume grows it becomes
a paid provider — route that through the provider/cost review
(`provider-cost-standard`) before scaling, per the standing owner-credential
fence. Adding these keys is an owner action (account creation + secrets); this
runbook is the exact recipe, not a self-serve change.
