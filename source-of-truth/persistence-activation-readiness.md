# Durable Persistence Activation Readiness

## Goal

Determine exactly what is required to switch AppEngine from local/mock state to durable storage.

This is a readiness checklist only. It does not connect to Neon, apply migrations, create resources, add secrets, or change environment variables.

## Provider Path

Primary provider:

```text
Neon Postgres
```

Fallback:

```text
local_mock file storage
```

## Artifact

`persistence_activation_readiness`

Required fields:

- `kind`
- `schemaVersion`
- `generatedAt`
- `status`
- `primaryProvider`
- `fallbackProvider`
- `activeAdapter`
- `targetAdapter`
- `ownerReadableSummary`
- `activationChecklist`
- `localMockStores`
- `requiredEnvVarNames`
- `guardrails`

## Activation Checklist

Before durable persistence can be enabled, AppEngine needs:

- provider selected
- adapter interface available
- reviewed schema design
- reviewed migration SQL
- dry-run migration check
- export/rollback plan
- privacy review for sensitive stores
- owner-managed environment variables
- owner approval to enable the adapter

## Local/Mock Store Mapping

Every current state store must be mapped to:

- current storage
- sensitivity
- durable adapter support
- activation risk
- next step

Browser-local Spark review/reminder state must move through a server-owned adapter seam before durable database activation.

## Guardrails

This readiness work must not:

- open a live database connection
- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
