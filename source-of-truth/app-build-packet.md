# App Build Packet Standard

The App Build Packet is the required handoff object for any new generated app, major app rebuild, or complex app feature set. It prevents one giant Codex task by turning an app idea into a chartered, phased, reviewable build plan.

Every new app must have its own packet before implementation begins.

Natural language requests must pass through the Intake Command Standard and App Selection Standard before an App Build Packet is created. The intake packet should prove that the request is a new app, not an existing-app improvement.

## Foundational Build Packet v1 (standard starting template)

Every generated app starts from ONE standard foundation — never a blank screen — emitted deterministically by the app generator (`src/lib/engine/app-generator.ts` + `src/lib/engine/foundation-modules.ts`). The packet's app-specific work is layered on top of this base; it is not rebuilt each time.

**Always-included foundation (real, working code):**
- Homepage, sign-in + auth (Auth.js), roles (owner/admin/customer), protected routes, sessions
- Customer workspace + account portal + guided onboarding
- Admin console (customers, projects, products, support, email)
- Database foundation (schema + seed + setup script), health check, QA acceptance checks, e2e test, deployment plan
- **Product catalog** — storefront + admin + `/api/products` + `products` table
- **Support ticketing** — customer submit/list + admin queue + `/api/support` + `support_tickets` table
- **Email (transactional)** — Resend-backed `sendEmail` + admin console + `/api/email/send`
- **Payments** — real Stripe checkout + webhook + `/api/billing/checkout` + `payments` table

**Present by default, switch-off-able:** each standard module ships ON and is toggled per app via `src/lib/app-config.ts` feature flags (`FEATURE_PRODUCT_CATALOG`, `FEATURE_SUPPORT`, `FEATURE_EMAIL`, `FEATURE_PAYMENTS`) — set any to `false` to turn it off. Turning a module off does not remove the scaffold; it hides the surface.

**Cost/credential fence:** modules are fully wired and active, but the ones that move money or send mail run on the **app owner's own credentials** (Stripe `STRIPE_SECRET_KEY`, Resend `RESEND_API_KEY` + `SENDER_EMAIL`). No key means the UI is live but real transactions/sends wait until the owner connects their keys — so no generated app can surprise-charge the ecosystem. This satisfies the standard credential contract (`template-credential-contract.md`).

The Prior-Work Check gate must pass before any App Build Packet is created. If the gate returns `extend_existing`, the work is a vNext improvement against the named surfaces, not a new App Build Packet. If the gate returns `blocked_cannot_verify`, stop and make the target repo visible before continuing. Only a verified `build_new` authorizes an App Build Packet. See `source-of-truth/prior-work-check-gate.md`.

## Required Packet Fields

Each packet must define:

- App name and stable slug
- App charter path
- Purpose
- Primary audience
- People or organizations helped
- Barrier removed
- Need addressed
- Movement toward life
- Transformation outcome
- Tool classification: Direct Transformation Tool, Support Tool, or explicitly mixed
- Boundaries and related apps
- Success definition
- MVP stages
- Deployment target
- Data ownership and privacy notes
- Identity/Auth plan
- Super Admin integration requirements
- Super Admin registry entry or planned entry
- Provider/cost review
- Deployment Environment plan
- Design Intent profile
- Design Quality Gate
- UX Review
- Compatibility Test Plan
- Release Gate plan
- Build Completion plan
- Cost Governance plan for model/API credit usage
- Phase plan with follow-up labels
- Guardrails that prevent app-goal bleeding

## Required Phases

Complicated apps must be split into these phases. Agents may add subphases, but they must not skip the required sequence without recording why.

| Phase | Goal | Typical Label |
| --- | --- | --- |
| discovery | Clarify problem, audience, alternatives, and opportunity. | ai:plan |
| charter | Create or update the app charter, boundaries, and success definition. | ai:plan |
| architecture | Define stack, services, routes, permissions, and integration plan. | ai:plan |
| provider_cost | Review operations, provider reuse, estimated cost tier, paid resources, and upgrade triggers before provisioning. | ai:plan |
| data_model | Define database schema, ownership, privacy, seed data, and migrations. | ai:build |
| identity_auth | Define auth provider, roles, memberships, permissions, and protected routes. | ai:build |
| design_intent | Capture audience, feeling, trust, accessibility, visual style preference, references, and things to avoid before UI design. | ai:plan |
| ui_design | Define user flows, screens, content, accessibility, and design direction. | ai:build |
| design_quality | Review navigation, primary actions, mobile layout, copy, spacing, contrast, trust, and emotional fit. | ai:review |
| ux_review | Review mobile, empty states, error states, onboarding, admin screens, and release-blocking UX confusion. | ai:review |
| compatibility | Test mobile-first responsiveness, Safari, Chrome, Edge, Firefox, touch targets, forms, auth, uploads/payments if used, and admin screens. | ai:review |
| mvp_build | Build the smallest useful version without absorbing later phases. | ai:build |
| testing | Verify workflows, acceptance criteria, permissions, and edge cases. | ai:review |
| review | Review code, security, maintainability, scope, and app-boundary risks. | ai:review |
| deployment_environment | Define frontend, backend if needed, database, env vars, preview/production URLs, custom domain, logs, health, and rollback. | ai:build |
| deployment | Prepare preview deployment gates and deployment notes. Do not deploy production without approval. | ai:review |
| release_gate | Confirm v1 launch rules, preview deploy, production approval, monitoring, and vNext follow-up path. | ai:review |
| monitoring | Define health checks, logs, incidents, alerts, and follow-up monitoring. | ai:monitor |
| super_admin_registration | Register the app with AppEngine Super Admin surfaces. | ai:build |

## Super Admin Requirement

Every generated app must integrate with the central AppEngine Super Admin dashboard. At minimum, the app must expose or register:

- Management entry
- Monitoring status
- Health check
- Logs or log link
- User/admin management link or status
- Billing/status link if the app has billing or paid services
- Admin actions needed for support
- Deployment and environment status
- Identity/auth provider, required roles, and user-management status

This does not mean every app needs a large admin panel in its first MVP. It means the packet must state what the Super Admin needs now, what can be a placeholder, and what must be built before launch.

## Identity/Auth Requirement

Every generated app must include an Identity/Auth plan before implementation. The packet must state the provider, session strategy, identity objects, roles, permissions, protected routes, local setup behavior, and production auth gate.

Use `source-of-truth/identity-auth-standard.md` for the required shape.

## Super Admin Registry Requirement

Every generated app must include a Super Admin registry entry or planned entry. The packet must state how the app will appear in AppEngine Super Admin, including lifecycle status, deployment, health, logs, admin URL, user management, billing/status if needed, allowed admin actions, and identity/auth roles.

Use `source-of-truth/super-admin-registry.md` for the required shape.

## Operations, Cost, and Provider Requirement

Every generated app must include provider/cost review before provisioning provider resources or approving release. The packet must state provider strategy, reuse/shared-resource options, preview cost posture, production cost posture, monthly ceiling or owner-defined cap, upgrade trigger, and whether new paid resources are approved.

Use `source-of-truth/operations-cost-provider-strategy.md` for the required shape.

## Deployment Environment Requirement

Every generated app must include a Deployment Environment plan before preview or production release work. The packet must state frontend provider, backend/API provider if needed, database provider, environment variable names and scopes, preview URL, production URL or approval-gated status, custom domain/subdomain plan, logs, health checks, and rollback notes.

Database placement is decided by identity-sharing, not mission-vs-commercial. Shared-identity ecosystem apps use the shared Supabase ecosystem DB. Standalone/customer-generated apps use isolated Neon projects or branches, and that customer carries the cost.

For this slice, `person` is the canonical shared identity table. `lpl_people` is not canonical unless a later reviewed migration explicitly changes that.

Use `source-of-truth/deployment-environment-standard.md` for the required shape.

## Design Quality Requirement

Every generated app must include a Design Intent profile before UI generation, visual direction, design polish, or design review. The packet must state target audience, user sophistication, desired emotional experience, brand personality, trust needs, accessibility needs, visual style preference, examples/references if provided, things to avoid, and output guidance for colors, typography, spacing, cards, forms, dashboards, navigation, buttons, empty states, and mobile layout.

Use `source-of-truth/design-intent-engine.md` for the required shape.

Every generated app must include a Design Quality Gate and UX Review before Release Gate approval. The packet must state Designer review, Customer Perspective review, simple navigation, clear primary action, mobile-first layout, readable copy, accessible spacing and contrast, trust-building elements, audience-specific emotional fit, empty states, error states, onboarding, and admin screens.

Use `source-of-truth/design-quality-gate.md` and `source-of-truth/ux-review-standard.md` for the required shape.

## Compatibility Requirement

Every generated app must include a Compatibility Test Plan before Release Gate approval. The packet must state required browser/platform coverage, mobile-first responsive checks, common viewport checks, touch-target checks, forms, auth flows, file uploads if used, payments if used, admin screens, and Super Admin status surfaces.

Use `source-of-truth/compatibility-standard.md` for the required shape.

## Release Gate Requirement

Every generated app must include a Release Gate before it leaves build mode. The packet must state the v1 launch path, vNext/follow-up rules, preview deploy contract, production approval requirement, post-launch monitoring, and Super Admin status update contract.

Use `source-of-truth/release-gate-standard.md` for the required shape.

## Build Completion Requirement

Every generated app must include or create a Build Completion plan before moving from planning into implementation, preview, review gates, release gates, or vNext work. The plan must state the current phase, current state, next safe action, blockers, related PR, preview URL, required/passed/failed gates, follow-up tasks, and evidence links.

Preview success must be backed by a `preview_verification` artifact that checks the expected route, marker text or test id, commit SHA, Vercel READY state, and mock/API JSON when applicable. Root URL availability alone is not preview success.

Use `source-of-truth/build-completion-orchestrator.md` for the required shape.

## Cost Governance Requirement

Every generated app workflow must include or inherit cost governance before autonomous model-heavy work continues. The `cost_governance` artifact tracks model/API budget, spend, task class, routing strategy, thresholds, and whether the next action should continue, use a cheaper model, pause, or request owner approval.

Use `source-of-truth/cost-governance-model-routing.md` for the required shape.

## Guardrails

Packets must enforce:

- Transformation is the product; the app is a tool that removes barriers and helps people move toward life.
- People are the purpose; do not optimize for engagement, data capture, or technology over actual human flourishing.
- Apps share philosophy but do not share purpose.
- Do not build a whole app as one giant Codex task.
- Do not let one app import another app's audience, features, data, or purpose without a documented integration reason.
- Do not skip the app charter.
- Do not skip the Context Gate.
- Do not skip the Prior-Work Check; do not create a new app packet when the target repo already has a surface for the capability (extend it instead), and do not assume "nothing exists" when the repo cannot be read.
- Do not deploy directly to production from an agent workflow.
- Do not expose secrets, private data, API keys, tokens, or credentials.
- Do not create new paid provider resources without provider/cost review and owner approval.
- Do not merge phases just because a model can generate more code.
- Do not keep building indefinitely when a release gate can move the app to preview, v1 launch, monitoring, or vNext follow-up work.
- Do not continue from planning to implementation, preview, review, release, or vNext work without a build completion plan naming the next safe action.
- Do not continue model-heavy agent work beyond cost governance warning, pause, or owner approval thresholds.
- Do not claim preview success without route-specific preview verification.
- Do not approve release for technically working but ugly, confusing, inaccessible, or emotionally mismatched apps.
- Do not approve release with unresolved Safari, mobile, common browser, touch-target, form, auth, upload, payment, or admin compatibility issues.

## Ecosystem Design Gates

Every packet must answer:

1. What barrier does this remove?
2. What need does this address?
3. How does this help someone move toward life?
4. How does this help someone become a source of life for others?

If these answers are missing or weak, agents should clarify, reduce, postpone, or reject implementation work.

## Machine Shape

Agents should produce packet artifacts with this shape:

```json
{
  "kind": "app_build_packet",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug",
    "charterPath": "source-of-truth/charters/app-slug.md",
    "purpose": "Why this app exists.",
    "audience": ["Primary user group"],
    "helped": ["People or organizations helped"],
    "barrierRemoved": "The barrier this app removes.",
    "needAddressed": "The human, ministry, business, or workflow need this app addresses.",
    "movementTowardLife": "How this app helps someone move toward life.",
    "transformationOutcome": "The transformation this app exists to support.",
    "toolClassification": "direct_transformation | support_tool | mixed",
    "boundaries": ["What this app must not become"],
    "successDefinition": "How we know this app works.",
    "deploymentTarget": "Vercel preview, Vercel production after approval, Render, or other target",
    "mvpStages": [
      {
        "id": "stage-1",
        "name": "Stage name",
        "goal": "Stage goal"
      }
    ],
    "superAdminIntegration": {
      "required": true,
      "dashboard": "AppEngine Super Admin",
      "requirements": ["management", "monitoring", "health", "logs", "users", "billing/status if needed", "admin actions"]
    },
    "identityAuth": {
      "kind": "identity_auth_plan",
      "schemaVersion": 1,
      "required": true,
      "auth": {
        "provider": "Auth.js",
        "sessionStrategy": "Server-side session checks with app-scoped roles and memberships.",
        "ownerSource": "APP_ENGINE_OWNER_EMAIL"
      },
      "identityObjects": ["user", "profile", "organization/account", "membership", "role", "permission"],
      "roles": [
        {
          "role": "owner",
          "scope": "ecosystem",
          "can": ["manage app registry", "approve production deployment"]
        }
      ],
      "protectedRoutes": [
        {
          "path": "/admin",
          "access": ["owner", "admin"]
        }
      ]
    },
    "superAdminRegistry": {
      "kind": "super_admin_registry_entry",
      "schemaVersion": 1,
      "required": true,
      "app": {
        "status": "planned",
        "owner": "APP_ENGINE_OWNER_EMAIL",
        "repo": "owner/repo",
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
        "reviewUrl": "planned",
        "productionUrl": "approval-gated"
      },
      "operations": {
        "healthUrl": "/api/health",
        "logsUrl": "planned",
        "adminUrl": "/admin",
        "billingStatus": "not_applicable"
      }
    },
    "providerCostReview": {
      "kind": "provider_cost_review",
      "schemaVersion": 1,
      "costPosture": {
        "preview": "free_or_low_cost",
        "production": "approval_required",
        "monthlyCeiling": "owner-defined",
        "upgradeTrigger": "usage, reliability, or revenue justifies paid resources"
      },
      "providers": [
        {
          "area": "frontend",
          "preferred": "Vercel",
          "newPaidResourceAllowed": false
        }
      ]
    },
    "deploymentEnvironment": {
      "kind": "deployment_environment_plan",
      "schemaVersion": 1,
      "app": {
        "version": "v1"
      },
      "frontend": {
        "provider": "Vercel",
        "previewUrl": "planned",
        "reviewUrl": "planned",
        "productionUrl": "approval-gated",
        "customDomain": "planned",
        "logsUrl": "planned",
        "healthPath": "/api/health"
      },
      "apiBackend": {
        "required": false,
        "provider": "Vercel Functions or Render"
      },
      "database": {
        "provider": "Supabase or Neon by placement",
        "strategy": "Shared-identity ecosystem apps use Supabase; standalone/customer-generated apps use isolated Neon",
        "placementRule": {
          "decisionAxis": "identity-sharing",
          "canonicalSharedIdentity": "person",
          "sharedIdentityEcosystem": "Supabase",
          "standaloneCustomerGenerated": "Neon"
        }
      }
    },
    "designReview": {
      "kind": "design_review",
      "schemaVersion": 1,
      "reviewers": {
        "designerRequired": true,
        "customerPerspectiveRequired": true,
        "designerStatus": "required",
        "customerPerspectiveStatus": "required"
      },
      "qualityChecks": [
        {
          "id": "clear_primary_action",
          "status": "required"
        }
      ],
      "stateChecks": ["mobile", "empty states", "error states", "onboarding", "admin screens"]
    },
    "compatibilityTestPlan": {
      "kind": "compatibility_test_plan",
      "schemaVersion": 1,
      "browserSupport": [
        {
          "id": "iphone_safari",
          "browser": "Safari",
          "platform": "iPhone",
          "required": true
        }
      ],
      "viewports": ["390x844", "768x1024", "1440x900"],
      "checks": [
        {
          "id": "touch_targets",
          "status": "required"
        }
      ]
    },
    "releaseGate": {
      "kind": "release_gate_plan",
      "schemaVersion": 1,
      "app": {
        "version": "v1",
        "targetStatus": "preview"
      },
      "versioning": {
        "launchVersion": "v1",
        "futureWork": "vNext packets or follow-up issues after v1 launch"
      }
    }
  },
  "guardrails": {
    "noGiantCodexTask": true,
    "preventGoalBleed": true,
    "requireContextGate": true,
    "requirePhaseFollowUps": true,
    "noProductionDeployWithoutApproval": true
  },
  "phases": [
    {
      "id": "discovery",
      "label": "ai:plan",
      "agent": "discovery",
      "goal": "Clarify problem and audience.",
      "deliverables": ["Audience map", "problem notes"],
      "acceptanceCriteria": ["Problem and primary audience are named."]
    }
  ],
  "followUpTasks": [
    {
      "title": "[app-slug] Phase: Discovery",
      "body": "Issue-ready phase task body.",
      "recommendedLabel": "ai:plan"
    }
  ]
}
```

## Template

Use this outline when creating a new app packet:

```text
# App Build Packet: <App Name>

## App Charter
- Charter path:
- Purpose:
- Primary audience:
- People or organizations helped:
- Success definition:

## Boundaries
- This app should:
- This app should not become:
- Related apps:
- Allowed integrations:

## MVP Stages
1. Stage:
2. Stage:
3. Stage:

## Deployment Target
- Preview:
- Production:
- Production approval required:
- Custom domain/subdomain:
- Rollback notes:

## Deployment Environment
- Frontend provider:
- API/backend provider if needed:
- Database provider:
- Environment variables needed:
- Preview URL:
- Production URL:
- Custom domain/subdomain:
- Logs:
- Health checks:
- Rollback notes:

## Release Gate
- Launch version:
- Designer review:
- Customer Perspective review:
- Compatibility plan:
- Preview deploy contract:
- Production approval:
- Post-launch monitoring:
- Super Admin status update:
- vNext/follow-up rules:

## Compatibility
- iPhone Safari:
- iPad Safari:
- Desktop Safari:
- Chrome mobile:
- Chrome desktop:
- Edge desktop:
- Firefox desktop:
- Required viewports:
- Touch targets:
- Forms and validation:
- Auth flows:
- File uploads if used:
- Payments if used:
- Admin screens:

## Super Admin Integration
- Management:
- Monitoring:
- Health:
- Logs:
- Users/admin:
- Billing/status if needed:
- Admin actions:
- Registry status:
- Registry health/logs/admin links:

## Identity/Auth
- Provider:
- Session strategy:
- Owner source:
- Roles:
- Membership model:
- Protected routes/APIs:
- Local setup behavior:
- Production auth gate:

## Phases
- discovery:
- charter:
- architecture:
- provider_cost:
- data_model:
- identity_auth:
- ui_design:
- design_quality:
- ux_review:
- compatibility:
- mvp_build:
- testing:
- review:
- deployment_environment:
- deployment:
- release_gate:
- monitoring:
- super_admin_registration:

## Guardrails
- No giant Codex task:
- No app-goal bleeding:
- No paid provider resources without provider/cost approval:
- Context Gate required:
- Follow-up issues required:
```
