# Shared Environment Source Standard

Every app should be able to pull common provider values from one private ecosystem env source instead of asking Lincoln to paste the same values into every `.env` file.

## Rule

- Keep real secret values in one private shared env file outside git.
- Keep app-specific env profiles in source control with placeholders and non-secret defaults.
- Generate each app's `.env` from `shared env + app profile`.
- Never commit generated `.env` files or real secret values.

## Default Private Source

Recommended local private file:

```text
~/Documents/Codex/private-env/appengine.shared.env
```

Create it from:

```text
env/shared-ecosystem.env.example
```

This file carries reusable values such as Supabase, Stripe, OpenAI, Vercel, Render, email, SMS, auth, and domain provider keys.

## App Profiles

Each app gets an app profile under:

```text
env/app-profiles/<app-slug>.env.example
```

The profile declares:

- `APPENGINE_SHARED_ENV_KEYS`: shared keys this app is allowed to pull.
- `APPENGINE_REQUIRED_ENV_KEYS`: values that must be present before writing the final env file.
- App-specific public URLs, slugs, CORS origins, proof users, and local defaults.

## Compose Command

Run from AppEngine:

```bash
npm run env:compose -- --shared ~/Documents/Codex/private-env/appengine.shared.env --profile env/app-profiles/churchconnect.env.example --out /path/to/ChurchConnect/.env
```

Dry-check without writing:

```bash
npm run env:compose -- --shared ~/Documents/Codex/private-env/appengine.shared.env --profile env/app-profiles/churchconnect.env.example --check true
```

## Hosting Providers

The generated env file is a local artifact. Provider setup still needs the same keys placed into the correct target:

- Vercel preview/production env for frontend and serverless values.
- Render service env for backend values.
- Supabase secrets only where server-side access is required.

Future automation should push these values through provider APIs/connectors, but this shared source comes first so the values are not rediscovered or retyped for every app.

## Security Boundaries

- Browser-public values use framework prefixes such as `VITE_` or `NEXT_PUBLIC_`.
- `SUPABASE_SERVICE_ROLE_KEY`, provider tokens, database URLs, webhook secrets, and private API keys are server-only.
- A generated `.env` is never proof that production is configured; the deploy gate still verifies provider envs, health checks, logs, and preview URLs.
