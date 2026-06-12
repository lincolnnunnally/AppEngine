# Identity And Auth Standard

Every generated app, major rebuild, and complex app workflow must define identity and access before implementation begins.

The standard prevents apps from inventing incompatible role models, skipping admin access, or mixing user data across unrelated apps.

## Required Decisions

Each app must declare:

- Auth provider
- Session strategy
- User identity object
- Profile object
- Organization, account, or workspace object
- Membership object
- Role set
- Permission model
- Protected routes and APIs
- Admin and owner boundaries
- Data privacy and retention notes
- Local setup behavior before OAuth is configured

## Default Pattern

Use this default unless the App Build Packet documents a reason to choose another provider:

- Auth provider: Auth.js
- Persistence: app-scoped Postgres tables through the selected app database
- Owner source: `APP_ENGINE_OWNER_EMAIL`
- Required roles: `owner`, `admin`, `customer`
- Required identity objects: user, profile, organization/account, membership, role, permission
- Session checks: server-side page and API guards
- Local mode: setup user may exist for development, but public deployments must require configured auth

Apps may use Supabase Auth, Firebase Auth, Clerk, or another provider when the app charter and packet explicitly choose that stack. The role, membership, permission, and Super Admin requirements still apply.

## Role Boundaries

Required role meanings:

- `owner`: ecosystem-level authority for the app, billing/status decisions, deployments, registry changes, and high-risk admin actions.
- `admin`: app operator who can manage app data, users, workflows, incidents, logs, and support actions inside the app boundary.
- `customer`: app user who can manage only their own account, organization, requests, content, or workflows.

Additional roles are allowed when the app needs them, but the packet must explain:

- What the role can do
- Which routes or API actions it can access
- Whether it is app-local or ecosystem-wide
- Which role can grant or revoke it

## Protected Surface

Each app must define protected routes and APIs before build work begins.

Minimum protected surface:

- Customer or member workspace
- Account/profile area
- Admin console or admin-status placeholder
- Mutating customer APIs
- Mutating admin APIs
- Billing/status APIs when billing exists
- Super Admin registry update path or planned handoff

Public marketing pages may stay public. Private workflows, private data, admin tools, logs, billing, exports, and support actions must be protected.

## Guardrails

Agents must stop or create follow-up work when:

- The app has no identity/auth plan.
- The app has roles but no protected route or API matrix.
- The app uses another app's user table, organization, billing state, or admin role without a documented integration reason.
- Admin access exists only in the UI and not in server-side checks.
- A generated app is headed to preview or production without owner/admin access defined.
- Local setup bypass behavior is not clearly disabled for public deployment.
- Secrets, OAuth credentials, API keys, session secrets, or provider tokens appear in prompts, issues, docs, generated output, or registry entries.

## Machine Shape

Agents should produce identity/auth artifacts with this shape:

```json
{
  "kind": "identity_auth_plan",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug"
  },
  "auth": {
    "provider": "Auth.js",
    "sessionStrategy": "Server-side session checks with app-scoped roles.",
    "localMode": "Setup user allowed only before production auth is configured.",
    "ownerSource": "APP_ENGINE_OWNER_EMAIL"
  },
  "identityObjects": [
    "user",
    "profile",
    "organization/account",
    "membership",
    "role",
    "permission"
  ],
  "roles": [
    {
      "role": "owner",
      "scope": "ecosystem",
      "can": ["manage app registry", "approve production deployment", "manage high-risk admin actions"]
    },
    {
      "role": "admin",
      "scope": "app",
      "can": ["manage app users", "manage app workflows", "review logs and incidents"]
    },
    {
      "role": "customer",
      "scope": "app",
      "can": ["use app workflow", "manage own account"]
    }
  ],
  "protectedRoutes": [
    {
      "path": "/app",
      "access": ["owner", "admin", "customer"]
    },
    {
      "path": "/admin",
      "access": ["owner", "admin"]
    }
  ],
  "dataBoundaries": [
    "Users and memberships are app-scoped unless an approved integration says otherwise."
  ],
  "guardrails": {
    "serverSideChecksRequired": true,
    "noCrossAppUserBleed": true,
    "noSecretsInOutput": true,
    "productionRequiresConfiguredAuth": true
  }
}
```
