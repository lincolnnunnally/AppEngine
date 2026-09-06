# AppEngine GitHub OAuth — soft-launch callback URLs

The factory and the private desk share one deploy and one existing GitHub OAuth App
(`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` on Vercel project `app-engine`).
Auth.js is host-aware (`trustHost: true`; `AUTH_URL` is unpinned at runtime in
`src/auth.ts`). Signing in on a host therefore sends GitHub that host's
`redirect_uri`.

Callback path (from `src/app/api/auth/[...nextauth]/route.ts` + the GitHub
provider id):

```text
/api/auth/callback/github
```

## Authorization callback URLs to register

On the **existing** GitHub OAuth App (Developer settings → OAuth Apps — do **not**
create a second app), Authorization callback URL list must include these exact
strings. No trailing slash after the host; path is literal.

```text
https://dashboard.unitedundergod.org/api/auth/callback/github
https://appengine.unitedundergod.org/api/auth/callback/github
https://www.we-succeed.org/api/auth/callback/github
```

`www.we-succeed.org` is the same deploy (legacy factory). Page traffic 307s to
`appengine.unitedundergod.org`, but `/api/*` still answers, so Auth.js can still
emit the www callback. Apex `https://we-succeed.org/api/*` 308s to www at Vercel,
so the apex callback is unused.

Canonical list in code: `PRODUCTION_GITHUB_OAUTH_CALLBACK_URLS` in
`src/lib/auth/github-oauth.ts`.

## What the authorize request actually sends

Verified against live production (same existing client id):

| Sign-in host | `redirect_uri` |
| --- | --- |
| `dashboard.unitedundergod.org` | `https://dashboard.unitedundergod.org/api/auth/callback/github` |
| `appengine.unitedundergod.org` | `https://appengine.unitedundergod.org/api/auth/callback/github` |
| `www.we-succeed.org` | `https://www.we-succeed.org/api/auth/callback/github` |

If GitHub shows `redirect_uri is not associated with the application`, that
host's row is missing from the OAuth App. Adding it is an owner console step —
code cannot write GitHub Developer settings.

## Leftover-preview

Leftover-preview hosts are `app-engine-*.vercel.app`. Auth.js will emit
`https://<that-host>/api/auth/callback/github`. GitHub OAuth Apps do not
support wildcards. Do **not** register each leftover-preview URL. Do **not** pin
`AUTH_URL` to production on Preview (that re-breaks PKCE: cookies stay on the
preview host, callback jumps to the factory).

CoS GitHub walk is on the **production soft-launch hosts** after the owner
console update. Leftover-preview still offers the existing email magic-link
door.

## Local optional

```text
http://localhost:3000/api/auth/callback/github
```

Only if someone signs in with GitHub on local `npm run dev`. Not required for
soft-launch.

## Out of scope

- No second GitHub OAuth App
- No password product
- ChurchConnect PRs 221 / 222 / 287 / 293
