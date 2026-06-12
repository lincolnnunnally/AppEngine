# Super Admin Registry Standard

Every generated app must be visible to the central AppEngine Super Admin system before it launches.

The registry is the shared operating map for app status, ownership, health, logs, user/admin management, deployment state, billing/status, and support actions. It keeps generated apps from becoming scattered projects that only one chat thread remembers.

## Required Registry Entry

Each app must register or plan a registry entry with:

- App name
- Stable slug
- Current lifecycle status
- Owner or owner email source
- Repository
- Charter path
- App Build Packet path or source issue
- Environment
- Deployment provider
- Preview URL or planned preview URL
- Production URL or approval-gated status
- Health check URL or planned health check URL
- Logs URL or provider link
- Admin URL or admin-status placeholder
- User/admin management link or status
- Billing/status link when billing exists
- Allowed Super Admin actions
- Identity/auth provider and roles
- Last reviewed marker

## Lifecycle Status

Use one of these statuses:

- `idea`
- `planned`
- `building`
- `preview`
- `production`
- `paused`
- `retired`

Agents must not mark an app `production` unless a release gate says production approval happened.

## Required Super Admin Actions

The first registry version may use planned links or placeholders, but the packet must name which actions are needed.

Common actions:

- Open app
- Open admin console
- View health
- View logs
- View deployment
- Manage users
- Review billing/status
- Pause app
- Create incident
- Create follow-up work

Apps do not need every action in MVP, but the missing actions must be visible as planned or blocked.

## Guardrails

Agents must stop or create follow-up work when:

- A generated app has no Super Admin registry entry or planned entry.
- Registry status says preview or production but has no health or logs path.
- Registry status says production without a release-gate approval.
- Admin actions exist without an identity/auth plan.
- Billing exists without a billing/status link or planned status path.
- Registry fields contain secrets or private credentials.
- A registry entry points to another app's repo, data, health, logs, or billing path without a documented integration reason.

## Machine Shape

Agents should produce registry artifacts with this shape:

```json
{
  "kind": "super_admin_registry_entry",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug",
    "status": "planned",
    "owner": "APP_ENGINE_OWNER_EMAIL",
    "repo": "owner/repo",
    "charterPath": "source-of-truth/charters/app-slug.md",
    "packetPath": "source-of-truth/app-build-packet.md",
    "environment": "preview"
  },
  "deployment": {
    "provider": "Vercel",
    "previewUrl": "planned",
    "productionUrl": "approval-gated",
    "productionApprovalRequired": true
  },
  "operations": {
    "healthUrl": "/api/health",
    "healthStatus": "unknown",
    "logsProvider": "Vercel",
    "logsUrl": "planned",
    "adminUrl": "/admin",
    "userManagement": "planned",
    "billingStatus": "not_applicable"
  },
  "auth": {
    "provider": "Auth.js",
    "roles": ["owner", "admin", "customer"]
  },
  "superAdminActions": [
    "open app",
    "open admin",
    "view health",
    "view logs",
    "manage users",
    "create incident"
  ],
  "guardrails": {
    "noSecretsInRegistry": true,
    "requiresIdentityAuthPlan": true,
    "requiresReleaseGateForProduction": true
  }
}
```
