# We Succeed sign-in notes — not App Engine soft-launch OAuth OWNER STEP

**Lock 2026-09-07:** `we-succeed.org` / `www.we-succeed.org` is reserved for a
different future use. Do not invent that product here. It is **not** an App
Engine soft-launch host. Canonical App Engine soft-launch hosts are only:

- https://appengine.unitedundergod.org
- https://dashboard.unitedundergod.org

Do **not** register `https://www.we-succeed.org/api/auth/callback/github` on
the App Engine GitHub OAuth App. OWNER STEP lives in
`source-of-truth/github-oauth-soft-launch-callbacks.md`.

The notes below are historical dormant-provider activation (Google / email)
from when this domain still answered the factory deploy. They are **not**
App Engine soft-launch OAuth OWNER STEP and do not put an App Engine brand
on we-succeed.

---

The live site (www.we-succeed.org) offered ONLY "Sign in with GitHub" when
these dormant providers were documented. Google and email magic-link sign-in
are fully coded (`src/auth.ts` `buildProviders`) and turn on with env vars
alone — no code change, no deploy beyond the env-triggered rebuild. Verified
2026-07-03: `/api/auth/providers` returns only `github`; the Vercel production
env has no `AUTH_GOOGLE_*`, `AUTH_RESEND_KEY`, or `EMAIL_FROM`.

Public-facing note: the landing page said "Sign in to start" to the general
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

This Google URI is historical dormant-provider copy for the reserved domain.
It is **not** App Engine soft-launch GitHub OAuth OWNER STEP.

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

## GitHub OAuth — App Engine soft-launch OWNER STEP (not we-succeed)

GitHub stays the existing OAuth App (`AUTH_GITHUB_ID`). Do not create a second
app. Auth.js is host-aware, so each soft-launch host sends its own
`redirect_uri`. The GitHub Developer settings for that app must include **only**:

```
https://appengine.unitedundergod.org/api/auth/callback/github
https://dashboard.unitedundergod.org/api/auth/callback/github
```

Do **not** register `https://www.we-succeed.org/api/auth/callback/github`.
we-succeed is reserved / out of scope for App Engine soft-launch.

Full list and leftover-preview notes:
`source-of-truth/github-oauth-soft-launch-callbacks.md`.

## What does NOT need doing

- No code change: Google and email providers are already coded and gated on their env vars.
- No second GitHub OAuth App, password product, or `AUTH_URL` pin.
- No database work for Google (JWT-less DB sessions already run on Neon).
- No App Engine brand or required GitHub callback on we-succeed.org.

## After activation — verify

Soft-launch GitHub walk is on the canonical hosts, not we-succeed:

```
curl -s https://appengine.unitedundergod.org/api/auth/providers
curl -s https://dashboard.unitedundergod.org/api/auth/providers
```

Then load those hosts' `/signin` pages. Do not treat www.we-succeed.org as
App Engine soft-launch proof.

## Cost / fence note

Google OAuth is free. Resend has a free tier; if email volume grows it becomes
a paid provider — route that through the provider/cost review
(`provider-cost-standard`) before scaling, per the standing owner-credential
fence. Adding these keys is an owner action (account creation + secrets); this
runbook is the exact recipe, not a self-serve change.
