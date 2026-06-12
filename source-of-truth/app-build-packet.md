# App Build Packet Standard

The App Build Packet is the required handoff object for any new generated app, major app rebuild, or complex app feature set. It prevents one giant Codex task by turning an app idea into a chartered, phased, reviewable build plan.

Every new app must have its own packet before implementation begins.

## Required Packet Fields

Each packet must define:

- App name and stable slug
- App charter path
- Purpose
- Primary audience
- People or organizations helped
- Boundaries and related apps
- Success definition
- MVP stages
- Deployment target
- Data ownership and privacy notes
- Super Admin integration requirements
- Phase plan with follow-up labels
- Guardrails that prevent app-goal bleeding

## Required Phases

Complicated apps must be split into these phases. Agents may add subphases, but they must not skip the required sequence without recording why.

| Phase | Goal | Typical Label |
| --- | --- | --- |
| discovery | Clarify problem, audience, alternatives, and opportunity. | ai:plan |
| charter | Create or update the app charter, boundaries, and success definition. | ai:plan |
| architecture | Define stack, services, routes, permissions, and integration plan. | ai:plan |
| data_model | Define database schema, ownership, privacy, seed data, and migrations. | ai:build |
| ui_design | Define user flows, screens, content, accessibility, and design direction. | ai:build |
| mvp_build | Build the smallest useful version without absorbing later phases. | ai:build |
| testing | Verify workflows, acceptance criteria, permissions, and edge cases. | ai:review |
| review | Review code, security, maintainability, scope, and app-boundary risks. | ai:review |
| deployment | Prepare preview deployment gates and deployment notes. Do not deploy production without approval. | ai:review |
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

This does not mean every app needs a large admin panel in its first MVP. It means the packet must state what the Super Admin needs now, what can be a placeholder, and what must be built before launch.

## Guardrails

Packets must enforce:

- Do not build a whole app as one giant Codex task.
- Do not let one app import another app's audience, features, data, or purpose without a documented integration reason.
- Do not skip the app charter.
- Do not skip the Context Gate.
- Do not deploy directly to production from an agent workflow.
- Do not expose secrets, private data, API keys, tokens, or credentials.
- Do not merge phases just because a model can generate more code.

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

## Super Admin Integration
- Management:
- Monitoring:
- Health:
- Logs:
- Users/admin:
- Billing/status if needed:
- Admin actions:

## Phases
- discovery:
- charter:
- architecture:
- data_model:
- ui_design:
- mvp_build:
- testing:
- review:
- deployment:
- monitoring:
- super_admin_registration:

## Guardrails
- No giant Codex task:
- No app-goal bleeding:
- Context Gate required:
- Follow-up issues required:
```
