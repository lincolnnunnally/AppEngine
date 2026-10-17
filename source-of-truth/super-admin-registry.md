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

ChurchConnect Association door — **not a new app brand**. Continuity home = ChurchConnect Association. EXIST deep link is `/association/pastors-circle`. `apps.unitedundergod.org` lists this door (HOLD lifted — Operate + Porchlight are LIVE). Admin stays on ChurchConnect Super Admin — do not invent a parallel AppEngine admin.

- Name: Vidalia / Toombs Pastors Circle
- Slug: `vidalia-toombs-pastors-circle`
- Live URL: [https://churchconnect.unitedundergod.org/association/pastors-circle](https://churchconnect.unitedundergod.org/association/pastors-circle) (`www.churchconnect.cloud/association/pastors-circle` equivalent)
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
    "publicDirectory": "apps.unitedundergod.org lists this Continuity door (listing/href only — not a new app)"
  },
  "release": {
    "version": "association-door",
    "gateStatus": "inherited_from_churchconnect",
    "productionApproval": "inherited — ChurchConnect Association is already live; this entry registers the door, it does not launch a new app"
  },
  "deployment": {
    "provider": "ChurchConnect (Vercel + Render)",
    "previewUrl": "https://churchconnect.unitedundergod.org/association/pastors-circle",
    "productionUrl": "https://churchconnect.unitedundergod.org/association/pastors-circle",
    "productionApprovalRequired": false,
    "alternateLiveUrl": "https://www.churchconnect.cloud/association/pastors-circle",
    "deepLink": "EXIST — https://churchconnect.unitedundergod.org/association/pastors-circle"
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

### Plenty

Vidalia food pantry — **not a new app brand and not a second Operate**. Continuity home = Plenty (`lincolnnunnally/plenty`). The public door is already live. User-management is the existing pantry desk at `/run/people` (roster; super admin can grant or remove pantry admin). Staff desk root is `/run`. There is no `/admin` on Plenty. Do not invent a parallel AppEngine admin.

- Name: Plenty
- Slug: `plenty`
- Live URL: [https://plenty.unitedundergod.org](https://plenty.unitedundergod.org)
- Admin / user-management: Plenty pantry desk — [https://plenty.unitedundergod.org/run/people](https://plenty.unitedundergod.org/run/people) (sign-in gated; staff desk root `/run`)

```json
{
  "kind": "super_admin_registry_entry",
  "schemaVersion": 1,
  "app": {
    "name": "Plenty",
    "slug": "plenty",
    "status": "production",
    "owner": "APP_ENGINE_OWNER_EMAIL",
    "repo": "lincolnnunnally/plenty",
    "charterPath": "source-of-truth/super-admin-registry.md",
    "packetPath": "not-a-new-app — Plenty pantry desk already live",
    "environment": "production",
    "doorKind": "plenty_pantry_desk",
    "continuityHome": "Plenty",
    "publicDirectory": "www.unitedundergod.org/apps lists Plenty under Church and community (listing/href only — not a new app)"
  },
  "release": {
    "version": "production",
    "gateStatus": "already_live",
    "productionApproval": "inherited — Plenty is already live; this entry registers the pantry-desk user-management door, it does not launch a new app"
  },
  "deployment": {
    "provider": "Vercel",
    "previewUrl": "https://plenty.unitedundergod.org",
    "productionUrl": "https://plenty.unitedundergod.org",
    "productionApprovalRequired": false,
    "staffDeskRoot": "https://plenty.unitedundergod.org/run"
  },
  "operations": {
    "healthUrl": "https://plenty.unitedundergod.org/api/health",
    "healthStatus": "live",
    "logsProvider": "Vercel",
    "logsUrl": "planned",
    "adminUrl": "https://plenty.unitedundergod.org/run/people",
    "userManagement": "https://plenty.unitedundergod.org/run/people",
    "billingStatus": "not_applicable"
  },
  "auth": {
    "provider": "Plenty Auth.js",
    "roles": ["owner", "steward", "member"]
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
    "documentedIntegrationReason": "Plenty's own pantry desk. User-management is /run/people on lincolnnunnally/plenty. Steward is pantry admin, granted or removed there by the super admin. Do not invent an AppEngine admin. Logs URL is planned — no public logs link was verified."
  }
}
```

### People & places (CRM v1 — desk view, not a new app)

Owner-only, read-only view on the private desk at `/crm` (`dashboard.unitedundergod.org/crm`). Approved by Lincoln 2026-10-17. **Not a new CRM system and not a parallel admin UI**: it reads the records ChurchConnect, Laser, and Presence already keep in the shared database and every action button opens that app's own admin. No new tables, no writes, nothing sent.

- Name: People & places
- Route: `/crm` (rail: Command → People & places; deck tile "follow-ups today")
- Reader: `src/lib/engine/lpl-crm.ts` (server only, same pattern as `lpl-ops-stats.ts`); rules: `src/lib/engine/lpl-crm-core.ts`
- Sources read (read-only): ChurchConnect `cc_churches` (pipeline rows only), `cc_site_invites`, `cc_church_crm_activities`, `cc_invites`, `cc_email_log`, website-preview visits in `lpl_events`; Laser `drop_places`, `drop_samples`, `orders`, `customers`; Presence `presence_places`, `presence_coin_batches`, `presence_coins`, `presence_coin_scans`, `presence_moments`; shared `outreach_suppressions`
- Matching: explicit ids → email → website → phone. Name + town is only a "possible match", never a merge.
- Don't repeat: any app reached out in the last 14 days → card says rest. Hard stops: do-not-contact list, already a customer for that app, said no.
- Daily follow-ups: due today, warm with no follow-up, waiting 3–14 days, not paid, upcoming events (14 days), tokens to print.
- Printed tokens: Presence has no separate "printed" field. A token counts as printed at `engraved` (or later: `released`, `found`); `drafted` / `approved` = not printed.
- Privacy: people show as first name + last initial; emails and phones are used only to match and never rendered or logged.
- CRM v2 slice 1 (draft, approved 2026-10-17): on a ChurchConnect church card the **owner** can log a visit or drop-off (day, who was met — pick or add, what was left, how it went, next step + when) and add/edit church contacts. Saves go through ChurchConnect's own CRM routes (`POST /api/church-crm/leads/{id}/activities`, `PUT /api/church-crm/leads/{id}/contacts/{contactId}`) with a pass that lives ≤2 minutes and is bound to that one method + path (`src/lib/engine/lpl-crm-write.ts`, server actions in `src/app/(cockpit)/crm/actions.ts`, all owner-gated on the server). Contacts live in the church's `staff_contacts`. One save per form (one-time key). Rest: a visit 14 days, a drop-off (and a Laser sample) 7. "Asked not to be contacted" marks the church lost in ChurchConnect and adds its emails, website, and phones to `outreach_suppressions` (reason `do_not_contact`). Admins still view; they see contact names and titles only, never emails or phones, and get no save controls. Nothing is sent to anyone.
- Do-not-contact list rule (shared `outreach_suppressions`, applied 2026-10-17 as `crm_v2_outreach_suppression_claims`): one row per email / website domain / phone (unique indexes). **Every writer adds through `outreach_suppress(p_email, p_domain, p_phone, p_reason, p_source)`** (security definer, execute for service_role only) — never a raw insert, update or delete. A real reason (opt-out, bounce, complaint, or any source not `crm_visit:%`) takes over a desk row and is never replaced by a desk claim. Owner-desk stops are claims (`crm_visit:<church id>` or `crm_visit:op_lead:<lead id>`) kept in the row's `claims` array; an undo calls `outreach_release(<claim>)`, which removes only that claim and deletes the row only when no claims remain and its source is still `crm_visit:%`. After an undo, the desk re-checks the list by email, phone and website domain (any source) and says "Still on the do-not-contact list…" instead of reopening. Domain rows come from the website only, never from an email address. **Every writer sends values already normalized:** email lower-cased and trimmed; domain bare lower-case host (no scheme, no `www.`, no path); **phone as exactly 10 digits** (strip everything but digits, drop a leading US `1`; anything that isn't 10 digits is not sent). The unique indexes compare these values as stored, so `(404) 555-0143` and `4045550143` would otherwise be two rows. AppEngine does this before every `outreach_suppress()` call (`normEmail` / `normDomain` / `normPhone` in `src/lib/engine/lpl-crm-core.ts`, applied in `suppressionRowsFor`). The SQL for all three migrations is in `db/migrations/004`–`006`. ChurchConnect keeps its own church flag the same way (`backend/utils/church_dnc.py`: `email_unsubscribe` source, the desk's `do_not_contact_desk_claim` beside any other reason).
- CRM v2 slice 4 — Suggested next step (draft): an owner-only "Suggest a next step" button on each /crm card (`src/components/engine/crm-suggest.tsx`, server action `suggestNextStepAction`, rules in `src/lib/engine/crm-suggest-core.ts`, server call in `src/lib/engine/crm-suggest.ts` through the shared provider helper `src/lib/xai.ts`, ported from AI Website Design). Suggestions only: nothing is saved or sent; "Use this" fills the card's existing Log a visit form (next step + when) and the owner saves it there. Screens say "Suggested next step" and never name the provider. **Church rule:** the model is offered only the church list (`church-offer-rule.ts`) and its answer is filtered again: an off-list app, a never-for-churches product named in the text (Operate, toner, AI Website Design…), or the word "marketing" drops the whole suggestion. Unclear = church. Businesses get only live business apps (Marketing campaign hidden while `MARKETING_CAMPAIGN_LIVE` is false). **Stops:** do-not-contact / said no → nothing; resting → "Resting until <date>" only; do-not-contact list unreadable → nothing. The card is re-read on the server for every ask. **Data sent to the model (exactly):** org type (church/business), town, apps on record and apps picked, a status phrase (due / warm / unpaid / replied / customer / not reached yet), up to 6 recent activities as type + date + by-us + they-responded, the next step on file (emails, phones, the org name and saved people's names removed) and its due date, the allowed app list, and today's date. Never the org name, contact names, emails, phones, visit notes or "what was said". **Cost:** asked only on tap (never on page load); one answer per org per Eastern day (same inputs; in-memory per server instance); a per-instance daily cap (`CRM_SUGGEST_DAILY_CAP`, default 60); max 300 tokens; 12-second timeout. Model: `XAI_CRM_MODEL`, else `XAI_MODEL`, else the helper default. **Fails closed:** no `XAI_API_KEY`, a timeout, an error or an answer that fails the rules → "Suggestions aren't available right now." / "No suggestion for this one right now." Nothing is written to any database.
- Church rule (one list, `src/lib/engine/church-offer-rule.ts`, mirrored in ChurchConnect `backend/utils/church_offer_rule.py`): churches may only be offered ChurchConnect, the Easy Peazy church website, Laser church gifts, and Outreach (Live On Mission). Never Operate or any business tool; never the word "marketing" for a church.

```json
{
  "kind": "super_admin_registry_entry",
  "schemaVersion": 1,
  "app": {
    "name": "People & places (CRM v1)",
    "slug": "crm-desk-view",
    "status": "production",
    "owner": "APP_ENGINE_OWNER_EMAIL",
    "repo": "lincolnnunnally/AppEngine",
    "charterPath": "source-of-truth/super-admin-registry.md",
    "packetPath": "not-a-new-app — read-only desk view over ChurchConnect, Laser, and Presence records",
    "environment": "production",
    "doorKind": "desk_view",
    "continuityHome": "AppEngine private desk"
  },
  "release": {
    "version": "crm-v1 (PR #409)",
    "gateStatus": "owner_approved",
    "productionApproval": "Lincoln approved CRM v1 on 2026-10-17 6:45 AM ET (Presence 6:46 AM ET); VAD and Experience Auditor passes on PR #409 before merge"
  },
  "deployment": {
    "provider": "Vercel",
    "previewUrl": "per-PR Vercel preview of lincolnnunnally/AppEngine",
    "productionUrl": "https://dashboard.unitedundergod.org/crm",
    "productionApprovalRequired": true
  },
  "operations": {
    "adminUrl": "https://dashboard.unitedundergod.org/crm",
    "healthUrl": "https://appengine.unitedundergod.org/api/health",
    "healthStatus": "inherited — the CRM view has no health route of its own; it runs inside the AppEngine desk",
    "logsProvider": "Vercel",
    "logsUrl": "planned",
    "billingStatus": "not_applicable",
    "writes": "none",
    "sends": "none",
    "newTables": "none"
  },
  "superAdminActions": [
    "open admin",
    "view health",
    "view logs (planned)",
    "view deployment",
    "manage users (not applicable — owner/admin desk roles)"
  ],
  "auth": {
    "provider": "AppEngine Auth.js",
    "roles": ["owner", "admin"]
  },
  "guardrails": {
    "noSecretsInRegistry": true,
    "readOnly": true,
    "noParallelAppEngineAdminUi": true,
    "noPersonalDataInLogs": true,
    "documentedIntegrationReason": "Lincoln approved CRM v1 on 2026-10-17: one card per org or person across ChurchConnect, Laser, and Presence, with a 14-day don't-repeat rule. Actions open each app's own admin."
  }
}
```

### Testimony doors (EXIST paths — not new apps)

Quiet directory/SSO Continuity. Apps share philosophy, not purpose. Do not invent a mega-hub, SingTrue, or a ChurchConnect TestimonyHub door. Do not deploy from `spark-of-hope-vercel-recovery`. Full map: `source-of-truth/testimony-continuity.md`.

- Spark of Hope Continuity home = Spark. Being-heard write: [https://spark.unitedundergod.org/](https://spark.unitedundergod.org/). Find door (Hope Stories): [https://spark.unitedundergod.org/hope-stories](https://spark.unitedundergod.org/hope-stories). Equivalent host `spark-of-hope.com`. Spark `/admin` is not a live door.
- Live On Mission Continuity home = Live On Mission. Reviewed testimony share/read: [https://liveonmission.unitedundergod.org/testimonies](https://liveonmission.unitedundergod.org/testimonies). Review is `/testimonies/review` (sign-in). Equivalent host `live-on-mission.com`.
- AppEngine intake-lite is a private preview only: [https://appengine.unitedundergod.org/spark-of-hope-intake-lite](https://appengine.unitedundergod.org/spark-of-hope-intake-lite). It does not publish to Spark or Live On Mission.
- ChurchConnect public `/testimonies` and `/testimony-hub` are the generic homepage — **not** a live TestimonyHub door. Testimony lineage stays in `lincolnnunnally/ChurchConnect` until a public path is verified.

## Leftover-preview notes

Registering this door updates the owner desk (soft-launch `appengine.unitedundergod.org` and leftover-preview of this AppEngine branch). It does **not** change ChurchConnect leftover-preview walks.

- Owner desk leftover-preview: a Church & ministry card for **Vidalia / Toombs Pastors Circle** appears. Live opens the EXIST ChurchConnect Pastors Circle deep link (`/association/pastors-circle`). Admin opens ChurchConnect Super Admin (`/admin`) — association management stays there. No new AppEngine admin route.
- Owner desk leftover-preview: **Plenty** stays in Church & ministry (the public directory lists it under Church and community). Live opens `https://plenty.unitedundergod.org`. Admin opens the existing pantry desk at `/run/people`. No new AppEngine admin route. The desk itself still requires owner sign-in.
- Public apps showcase leftover-preview (`apps.unitedundergod.org` / factory showcase): one **LIVE** Pastors Circle card. It opens the same deep link. Listing/href only — not a new app brand.
- Auth leftover-preview: AppEngine email/cookie hosts are unchanged. ChurchConnect Super Admin leftover-preview still uses ChurchConnect's own preview origin. Do not invent an AppEngine login for this door.
- ChurchConnect PRs 221 / 222 / 287 / 293 are out of scope. Do not retarget leftover-preview of those branches from this registry lock.
