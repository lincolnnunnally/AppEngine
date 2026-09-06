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
- Release version and release-gate status
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

Super Admin status updates should be driven by the Release Gate automation contract whenever an app moves to `preview`, `production`, `paused`, or `retired`.

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
  "release": {
    "version": "v1",
    "gateStatus": "preview_pending",
    "productionApproval": "required"
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

## Lincoln lock — every app door

The Super Admin registry is the central / ecosystem operating map for **every app door**. It does not invent a parallel admin UI inside AppEngine.

- **Continuity home** is the owning product surface (the app that already runs the door).
- **Admin / user-management** links open that product's existing Super Admin — never a guessed AppEngine `/admin` for a door that lives elsewhere.
- The **United Under God apps directory** (`uug-website`) is a separate public listing. Registering a door here does not add, hide, or rewrite that directory.

When a door is a path on another live app (ChurchConnect Association, a tenant, a Toner family brand), say so. Pointing at another app's repo, health, logs, or admin is allowed only with that documented integration reason.

## Registered doors

### Vidalia / Toombs Pastors Circle

ChurchConnect Association door — **not a new app brand**. Continuity home = ChurchConnect Association. UUG apps directory listing is separate (`uug-website`).

- Name: Vidalia / Toombs Pastors Circle
- Slug: `vidalia-toombs-pastors-circle`
- Live URL: [https://churchconnect.unitedundergod.org/association](https://churchconnect.unitedundergod.org/association) (`www.churchconnect.cloud/association` equivalent until a Pastors Circle deep link exists)
- Admin / user-management: ChurchConnect Super Admin — [https://churchconnect.unitedundergod.org/admin](https://churchconnect.unitedundergod.org/admin) (`www.churchconnect.cloud/admin` equivalent)

```json
{
  "kind": "super_admin_registry_entry",
  "schemaVersion": 1,
  "app": {
    "name": "Vidalia / Toombs Pastors Circle",
    "slug": "vidalia-toombs-pastors-circle",
    "status": "production",
    "owner": "APP_ENGINE_OWNER_EMAIL",
    "repo": "lincolnnunnally/ChurchConnect",
    "charterPath": "source-of-truth/super-admin-registry.md",
    "packetPath": "not-a-new-app — ChurchConnect Association door",
    "environment": "production",
    "doorKind": "churchconnect_association_door",
    "continuityHome": "ChurchConnect Association",
    "publicDirectory": "separate — uug-website apps listing is not this registry"
  },
  "release": {
    "version": "association-door",
    "gateStatus": "inherited_from_churchconnect",
    "productionApproval": "inherited — ChurchConnect Association is already live; this entry registers the door, it does not launch a new app"
  },
  "deployment": {
    "provider": "ChurchConnect (Vercel + Render)",
    "previewUrl": "https://churchconnect.unitedundergod.org/association",
    "productionUrl": "https://churchconnect.unitedundergod.org/association",
    "productionApprovalRequired": false,
    "alternateLiveUrl": "https://www.churchconnect.cloud/association",
    "deepLink": "planned — use Association door until a Pastors Circle deep link exists"
  },
  "operations": {
    "healthUrl": "https://churchconnect.unitedundergod.org/api/health",
    "healthStatus": "shared_with_churchconnect",
    "logsProvider": "Vercel / Render (ChurchConnect)",
    "logsUrl": "ChurchConnect provider logs — same as churchconnect",
    "adminUrl": "https://churchconnect.unitedundergod.org/admin",
    "userManagement": "https://churchconnect.unitedundergod.org/admin",
    "billingStatus": "not_applicable — billed/managed as ChurchConnect Association"
  },
  "auth": {
    "provider": "ChurchConnect Super Admin",
    "roles": ["owner", "super_admin", "association_admin"]
  },
  "superAdminActions": [
    "open app",
    "open admin",
    "view health",
    "view logs",
    "manage users"
  ],
  "guardrails": {
    "noSecretsInRegistry": true,
    "requiresIdentityAuthPlan": true,
    "requiresReleaseGateForProduction": true,
    "notANewAppBrand": true,
    "noParallelAppEngineAdminUi": true,
    "documentedIntegrationReason": "ChurchConnect Association door for Vidalia / Toombs Pastors Circle. Health, logs, admin, users, and billing stay on ChurchConnect."
  }
}
```

## Leftover-preview notes

Registering this door updates the owner desk (soft-launch `appengine.unitedundergod.org` and leftover-preview of this AppEngine branch). It does **not** change ChurchConnect leftover-preview walks.

- Owner desk leftover-preview: a Church & ministry card for **Vidalia / Toombs Pastors Circle** appears. Live opens ChurchConnect `/association`. Admin opens ChurchConnect Super Admin (`/admin`) — association management stays there. No new AppEngine admin route.
- Public apps showcase leftover-preview (`apps.unitedundergod.org` / factory showcase): this slug is **hidden**. It is not a standalone product card. Do not treat leftover-preview of the showcase as a new brand launch.
- Auth leftover-preview: AppEngine email/cookie hosts are unchanged. ChurchConnect Super Admin leftover-preview still uses ChurchConnect's own preview origin. Do not invent an AppEngine login for this door.
- ChurchConnect PRs 221 / 222 / 287 / 293 are out of scope. Do not retarget leftover-preview of those branches from this registry lock.
