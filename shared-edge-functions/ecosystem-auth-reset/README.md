# Ecosystem Auth — Password Reset (standing module)

**One shared service that gives every ecosystem app self-serve password reset**, without
depending on the shared GoTrue SMTP (which is rate-limited fleet-wide and silently drops
reset emails). Deployed once on the shared LPL Supabase project; every app plugs in with a
single "Forgot password?" button.

## Why this exists

Client `supabase.auth.resetPasswordForEmail()` (and GoTrue's built-in mailer) hit
`429 over_email_send_rate_limit` on the shared project, so reset emails never arrive. This
service mints its own single-use token, emails a branded link via **Resend**
(`emails.unitedundergod.org`, verified), **hosts the reset page itself**, and completes the
change with the service role. Nothing depends on GoTrue email.

## Architecture

- **Edge function:** `ecosystem-auth-reset` (deployed with `--no-verify-jwt` — the reset
  link is opened from an email with no JWT; the single-use hashed token is the credential).
- **Table:** `public.ecosystem_password_resets` (RLS on, no policies → service-role only).
- **Helper:** `public.ecosystem_get_user_by_email(email)` (security definer).
- **Secret:** `RESEND_API_KEY` (set via `supabase secrets set`).
- **Endpoints (all on `…/functions/v1/ecosystem-auth-reset`):**
  - `POST` JSON `{app, email}` → sends the email, always returns `{ok:true}` (non-enumerating).
  - `GET ?token=&app=` → serves the branded reset form (from the email link).
  - `POST` form `{token, app, password, password2}` → changes the password, single-use.

Tokens: 32 random bytes, SHA-256 hashed at rest, 1-hour expiry, single-use, throttled to
3 outstanding per email/app/hour.

## Plug a new app in (TWO steps)

1. Add one line to `APP_CONFIG` in `index.ts` and redeploy the function:
   ```ts
   'my-app': { name: 'My App', loginUrl: 'https://my-app.example.com' },
   ```
   Redeploy: `supabase functions deploy ecosystem-auth-reset --project-ref uqhqulrqcygsmmzdzemx --no-verify-jwt --use-api`
2. In the app's sign-in UI add a **Forgot password?** control that calls:
   ```js
   await fetch('https://uqhqulrqcygsmmzdzemx.supabase.co/functions/v1/ecosystem-auth-reset', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ app: 'my-app', email }),
   });
   // then show: "If an account exists for that email, we've sent a reset link."
   ```
That's it — the reset page + email + password change are all handled by the service.
Works from any frontend (Next, Vite, CRA) or backend proxy; no supabase-js needed.

## Wired apps (2026-07-24)

`kids-need-dads`, `best-life`, `aligned-souls`, `kindred`, `laser`.

## Related standing pattern — confirmed signup

Same root cause (shared GoTrue 429). The fleet fix is **admin-create with
`email_confirm:true`** via the service role instead of client `auth.signUp()`:
- Vite / no-server apps → an edge function (see `knd-signup`).
- Next.js apps → an `/api/auth/signup` route (see best-life / childfirst).
Every healthy app already uses this; new apps should start from it.
