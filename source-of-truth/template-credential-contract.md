# Template Credential Contract

Date: 2026-06-27
Owner: Lincoln

## Purpose

This contract lets a builder turn an existing template into a new branded app without guessing which secrets, URLs, provider settings, or app-specific labels are needed.

## Rule

Templates may include variable names and setup instructions.

Templates must never include live secrets.

## Required Template Sections

Every reusable template must include:

- `template_name`
- `source_repo`
- `source_files`
- `rebrand_fields`
- `credential_fields`
- `database_mapping`
- `launch_target`
- `acceptance_tests`
- `known_exceptions`
- `stop_conditions`

## Credential Field Shape

Each credential field should use this structure:

```json
{
  "name": "SUPABASE_URL",
  "required": true,
  "scope": "server_and_browser_safe_when_public",
  "where_to_set": ["local .env", "Vercel project env"],
  "owner": "Lincoln or app owner",
  "notes": "Use the approved project URL for the target app."
}
```

## Standard Fields

### App Identity

- `APP_NAME`
- `APP_SLUG`
- `APP_PUBLIC_URL`
- `APP_SUPPORT_EMAIL`
- `APP_OWNER_EMAIL`

### Frontend

- `NEXT_PUBLIC_APP_URL` or `REACT_APP_PUBLIC_URL`
- `NEXT_PUBLIC_API_URL` or `REACT_APP_BACKEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Server

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` when direct SQL is approved
- `JWT_SECRET` only for apps not using managed Supabase/Auth.js sessions
- `WEBHOOK_SECRET` per inbound integration

### AI

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `EMERGENT_LLM_KEY`
- `AI_MODEL_DEFAULT`
- `AI_BUDGET_MONTHLY_CENTS`

### Email

- `RESEND_API_KEY`
- `SENDER_EMAIL`

### Payments

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Storage

- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `STORAGE_PUBLIC_URL`

## Rebrand Field Shape

```json
{
  "name": "primaryAudience",
  "required": true,
  "example": "parents rebuilding safe co-parenting communication",
  "used_in": ["SOURCE_OF_TRUTH.md", "PROJECT_OVERVIEW.md", "landing page", "onboarding"]
}
```

## Database Mapping

For Lincoln-owned ecosystem apps:

- Default database home is the consolidated Life Produces Life Supabase ecosystem tree.
- Identity should map to the canonical `person` convention unless a newer reviewed source-of-truth document changes it.
- App-specific data should use app-scoped schemas or clearly-prefixed tables.
- Legacy Mongo, Prisma, Firebase, Neon, or local-only storage should be treated as source-reference until the Launch Pack approves an exception or migration.

For customer-generated apps:

- Use isolated customer database resources unless the owner explicitly approves shared placement.
- Record who pays for the resource before provisioning.

## Acceptance Tests

Every template launch must prove:

- App boots locally or preview deploys successfully.
- Branding text no longer references the source app unless intentional.
- `.env.example` lists every required key and no real values.
- Auth/session path works or is explicitly mocked for preview.
- Database health check points to the target database.
- Owner review URL is a normal public URL, not a protected bypass link.
- Production remains approval-gated until owner approval.

## Stop Conditions

Stop and record a blocker when:

- Required credentials are unavailable.
- A live secret appears in a file.
- Target database placement is unresolved.
- A template would copy source-app private data.
- The build cannot explain which source files it is extending.
