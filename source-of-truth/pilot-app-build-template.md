# First Real App Pilot Template

Use this template for the first bounded AppEngine pilot that proves the machine can run from conversation to follow-up issues.

## Pilot App

Name:

```text
Spark of Hope Intake Lite
```

Slug:

```text
spark-of-hope-intake-lite
```

Purpose:

```text
Help a person or church collect one hopeful story, preserve the story safely, and prepare a small encouragement response workflow.
```

## Scope

The first pilot is not the full Spark of Hope product. It is a bounded app build packet that can be split into follow-up issues.

Included:

- Simple public story intake concept
- Clear audience and boundaries
- App charter path
- App Build Packet
- Identity/Auth planning
- Super Admin registry planning
- Provider/cost planning
- Deployment environment planning
- Design quality and compatibility planning
- Release gate planning
- Dry-run follow-up issues

Not included:

- Production deployment
- Paid provider creation
- Real user data ingestion
- Full admin dashboard implementation
- Generated app code merge without PR review
- Billing or payments

## Handoff Request

```text
Start AppEngine build for Spark of Hope Intake Lite.
```

## Conversation Summary

```text
Lincoln wants a small, mission-aligned first real AppEngine pilot that proves the ChatGPT-to-GitHub-to-Codex loop can create a handoff issue, route through intake, produce an App Build Packet, and generate follow-up issues without manual copy and paste.
```

## Expected Route

```text
ChatGPT conversation
-> chatgpt_handoff_packet
-> GitHub issue with ai:plan
-> intake_packet
-> app_build_packet
-> dry-run follow-up issues
-> reviewed agent loop
```

## Success Definition

The pilot succeeds when a dry-run command produces:

- Issue-ready ChatGPT handoff body
- Intake packet
- App Build Packet
- Dry-run follow-up issues
- `pilot_app_build` artifact
- Guardrails proving no production deploy, no paid resource creation, and no generated app code merge without review

## Next Action After Dry Run

Review the dry-run output. If the issue body and follow-up issues look right, create the real GitHub issue with `ai:plan`.
