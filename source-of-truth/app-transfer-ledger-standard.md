# App Transfer Ledger Standard

AppEngine uses an App Transfer Ledger when the selected work is an existing app
transfer, recovery, migration, consolidation, or broad vNext effort where
features must be preserved rather than recreated.

The ledger keeps AppEngine from rebuilding a smaller duplicate of an existing
product. It answers: what already exists, where it lives, what data it depends
on, what must move, what has been verified, and what remains.

## When This Standard Applies

Use this standard when the accepted candidate is:

- `existing_app_improvement` with migration or recovery scope
- `extend_existing` after prior-work check
- a repo transfer away from an old host, database, framework, or platform
- an ecosystem consolidation into shared identity/data infrastructure
- a feature-parity recovery where screenshots, demos, or a live app show
  functionality that must not be lost
- a broad vNext that could accidentally recreate what already exists

If the task is a narrow bug fix with no feature-parity or migration risk, a
normal `vnext_packet` is enough.

## Ownership Boundary

AppEngine owns the standard, artifact shape, and gate.

The app-specific ledger belongs with the app being transferred. For example,
the ChurchConnect transfer ledger belongs in the ChurchConnect repo, while this
standard belongs in AppEngine.

AppEngine records a link to the app-specific ledger in the relevant run record,
portfolio registry entry, or vNext packet. AppEngine should not absorb every
product's detailed feature inventory into the AppEngine repo.

## Required Source Inputs

Before creating or updating an `app_transfer_ledger`, agents must inspect:

- the target repo and current branch/commit
- the app's public/live surface when available
- existing app docs, runbooks, migration notes, and README
- feature cards, navigation, routes, components, API routes, and scripts
- current database/storage dependencies
- known production URLs, preview URLs, health checks, and deploy hosts
- prior AppEngine run records or vNext packets for the app
- screenshots or owner-provided evidence, when provided

If the target repo cannot be inspected, the ledger status is
`blocked_cannot_verify`. Do not invent feature coverage from memory.

## Required Ledger Sections

Every app-specific transfer ledger must include:

1. **Transfer goal**: what is moving and why.
2. **Audit metadata**: date, repo, branch, commit, live URL if known.
3. **Rules**: preserve existing capability, do not recreate, do not mark
   transferred from UI presence alone, protect secrets and staff/private data.
4. **Status key**: consistent status values.
5. **Current proven transfer**: what is already verified on the destination
   path.
6. **Feature ledger**: feature-by-feature map from current product promise to
   implementation and transfer state.
7. **Additional existing surfaces**: important modules not visible in the
   owner-provided screenshots or first audit pass.
8. **Data/runtime mapping**: current storage, target storage, access model,
   migration notes, and provider boundaries.
9. **Suggested transfer order**: smallest safe sequence that preserves the app.
10. **Verification template**: repeatable proof record per transferred slice.
11. **Open questions**: owner decisions or schema/provider questions that block
    transfer.

## Status Values

Use these statuses unless the app-specific ledger defines a narrower set:

| Status | Meaning |
| --- | --- |
| `transferred_proven` | Live path reads/writes through the destination runtime/data path and has verification evidence. |
| `partially_transferred` | Some path is transferred, but UI, persistence, auth, production freshness, or workflow proof is incomplete. |
| `exists_legacy` | Feature exists in current app code but still uses legacy/app-specific runtime or storage. |
| `ui_mapping_gap` | Feature is promised in public UI/nav but does not cleanly map to real detail, preview, route, or module surfaces. |
| `inventory_needed` | Repo contains related code, but the transfer target or acceptance criteria still needs deeper inspection. |
| `blocked_cannot_verify` | Target repo, live app, credentials, or source evidence could not be checked. |
| `not_started` | No confirmed implementation or transfer path exists yet. |

## Feature Ledger Columns

The feature ledger should include at least:

| Column | Purpose |
| --- | --- |
| Feature or promise | Owner/user-visible feature, screenshot card, nav item, route, or workflow. |
| Source surface | Current components, pages, backend routes, scripts, docs, or live URLs. |
| Current data/runtime | Current storage/provider/runtime dependency. Use variable/table names only, never secret values. |
| Destination target | Target repo, data shape, table/event/module, or service boundary. |
| Transfer status | One of the status values above. |
| Verification needed | The smallest proof required before marking transferred. |
| Next action | One bounded action that moves the slice forward. |

## Data And Security Rules

- Never place service-role keys, database URLs, access tokens, OAuth secrets, or
  private user data in a ledger.
- Public UI screenshots are evidence of product promise, not proof of data
  transfer.
- Staff-only, child/family, financial, pastoral care, and private contact data
  need explicit access-model notes before migration.
- Shared ecosystem data may reuse identity and capability, but customer or
  church-specific private data must have isolation and authorization rules.
- Provider details may be recorded for operators, but customer-facing surfaces
  must not expose infrastructure jargon.

## AppEngine Gate Behavior

Before AppEngine creates phase issues or executable handoffs for a transfer:

1. The prior-work check must identify `extend_existing` or equivalent.
2. An `app_transfer_ledger` must exist or be created as the first planning
   action.
3. The next work item must name the ledger row or slice it advances.
4. The build/fix loop must update evidence after each verified slice.
5. A slice is not done until its verification template has been filled.
6. A whole transfer is not done until every required feature is
   `transferred_proven`, intentionally deferred, or explicitly removed by owner
   decision.

## Machine Shape

Agents should produce `app_transfer_ledger` artifacts with this shape:

```json
{
  "kind": "app_transfer_ledger",
  "schemaVersion": 1,
  "app": {
    "name": "Existing app name",
    "slug": "existing-app-slug",
    "repo": "owner/repo",
    "branch": "main",
    "commit": "full-or-short-sha",
    "liveUrl": "https://example.com"
  },
  "transfer": {
    "goal": "Carry forward the existing app into the target ecosystem/runtime.",
    "sourceRuntime": "current runtime label",
    "targetRuntime": "target runtime label",
    "targetDataShape": "target table/event/module family",
    "status": "inventory | partially_transferred | ready_for_slice | blocked | transferred"
  },
  "sourceEvidence": {
    "screenshotsReviewed": [],
    "docsReviewed": [],
    "componentsReviewed": [],
    "backendRoutesReviewed": [],
    "liveChecks": []
  },
  "featureRows": [
    {
      "feature": "Feature name",
      "sourceSurface": [],
      "currentDataRuntime": [],
      "destinationTarget": [],
      "status": "exists_legacy",
      "verificationNeeded": "Smallest proof before done",
      "nextAction": "Next bounded action"
    }
  ],
  "additionalSurfaces": [],
  "suggestedTransferOrder": [],
  "verificationTemplate": {
    "required": true
  },
  "guardrails": {
    "doNotRecreateExistingFeatures": true,
    "doNotExposeSecrets": true,
    "staffPrivateDataProtected": true,
    "ledgerRowsRequiredForBuildWork": true
  }
}
```

## Verification Template Per Slice

Append a dated evidence note to the app-specific ledger or run record:

```text
Date:
Feature:
Ledger row:
Before/current source:
Destination target:
Frontend path verified:
Backend endpoint verified:
Auth/access model verified:
Data created/updated/read:
Production or preview URL:
Remaining gaps:
Decision:
```

## ChurchConnect Reference

ChurchConnect is the first active proof of this pattern. Its app-specific
ledger should remain in the ChurchConnect repo and be linked from AppEngine
Step 5 run records. Future ChurchConnect transfer work should name the ledger
row it advances before changing code.

## Non-Goals

- This standard does not migrate data by itself.
- This standard does not authorize production deploys, paid resources, live
  migrations, secrets/env changes, or destructive actions.
- This standard does not replace `BUILD-LEDGER.md`; the build ledger tracks
  AppEngine work, while an app transfer ledger tracks feature parity and
  migration state for one target app.
- This standard does not turn AppEngine into a monorepo for every ecosystem
  app. App-specific ledgers belong with their apps.
