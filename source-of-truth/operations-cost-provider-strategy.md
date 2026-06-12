# Operations, Cost, and Provider Strategy Standard

Every generated app must include an operations, cost, and provider review before services are provisioned or release is approved.

The goal is to avoid creating paid or duplicated Vercel, Render, database, storage, email, AI, analytics, or monitoring services for every idea before the app has earned that cost.

## Required Decisions

Each generated app must define:

- Frontend provider strategy
- API/backend provider strategy
- Database provider strategy
- Storage provider strategy when files are used
- Email or notification provider strategy when messages are used
- Payment provider strategy when billing is used
- AI/model provider strategy when model calls are used
- Logs, health, and monitoring strategy
- Preview cost posture
- Production cost posture
- Upgrade trigger
- Reuse/shared-resource options
- Estimated cost tier without secret values or live billing details

## Default Strategy

Default to:

- Reuse existing approved providers when practical.
- Use preview/free/low-cost environments for early validation.
- Avoid creating always-on paid backends until the app needs them.
- Avoid creating a new database project when a safe branch or app-scoped database is enough.
- Avoid adding paid storage, email, AI, analytics, or monitoring providers until the feature requires them.
- Keep production activation behind owner approval.

## Guardrails

Agents must stop or create follow-up work when:

- A task would create a new paid provider resource without an approved cost review.
- A task duplicates an existing provider service without explaining why reuse is unsafe.
- A generated app needs file uploads, payments, email, AI calls, or always-on backend services but no cost owner or upgrade trigger is defined.
- Preview cost and production cost are not separated.
- Provider choices are based on convenience instead of app needs, cost, safety, and maintenance.
- A release gate is marked ready without provider/cost review.
- Any artifact includes secret values, provider tokens, private billing data, or payment credentials.

## Machine Shape

Agents should produce provider/cost artifacts with this shape:

```json
{
  "kind": "provider_cost_review",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug"
  },
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
      "strategy": "reuse existing account/project where practical",
      "newPaidResourceAllowed": false
    }
  ],
  "checks": [
    {
      "id": "reuse_before_create",
      "status": "required"
    }
  ],
  "guardrails": {
    "blocksProvisioning": true,
    "blocksReleaseGateApproval": true,
    "noPaidResourcesWithoutApproval": true,
    "noSecretsInOutput": true
  }
}
```
