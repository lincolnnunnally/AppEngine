# Lane 1 — Internal loop-to-live proof (with the cost stop)

Date: 2026-06-23
Branch: `lane1/internal-loop-to-live-proof` (PR for Lincoln — do **not** merge without approval)

## Purpose
Prove the two links AppEngine has never crossed — (1) a deploy to a real public URL, and
(2) the owner cost/approval stop — using one trivial internal artifact, run through the
**canonical** loop (not a side path). **Nothing was provisioned, deployed, or spent.**

## The trivial artifact
`src/app/api/health/route.ts` — a public, read-only endpoint that returns `{"status":"ok"}`.
Verified in-loop: `GET /api/health → 200 {"status":"ok"}`.

## Canonical loop trace (through the gate, not a side path)
| Stage | Result |
|---|---|
| `problem_intake_gate` | `intake-2026-06-23-build-a-tiny-internal-health-endpoint-e1b86782` (requestType `app_idea`, next phase `prior_work_check`) |
| `clarification` | `clarified`, tied to the gate packet |
| `prior_work_check` | `needs_human_review` (2 *partial* matches: best-life, internal-status-page) → the gate correctly demanded an explicit decision. **Owner/operator decision: `build_new`** (a health endpoint is distinct from a discipleship app and a status-page dashboard) |
| `routing` | `new_app_candidate` |
| `solution_candidate_review` | `ready_for_app_build_packet` |
| `candidate_packet_bridge` | `app_build_packet_draft` |
| `loop_run_records` | **`exec-2026-06-23-build-a-tiny-internal-health-endpoint-1b83d363`** |
| execution + verification | endpoint built; preview returned `{"status":"ok"}` |
| registry | completed-loop evidence written (`build-a-tiny-internal-health-endpoint`, completedLoops: 1) |

### Loop run record
```json
{
  "id": "exec-2026-06-23-build-a-tiny-internal-health-endpoint-1b83d363",
  "gatePacketId": "intake-2026-06-23-build-a-tiny-internal-health-endpoint-e1b86782",
  "candidatePacketId": "app_build_packet_draft:build-a-tiny-internal-health-endpoint",
  "priorWorkVerdict": "build_new",
  "packetKind": "app_build_packet",
  "solutionClass": "software",
  "status": "deployed",            // loop-internal "verified/ready" marker — NOT a real production deploy
  "result": "verified",
  "acceptanceCriteria": [
    "GET /api/health returns HTTP 200",
    "Response body is {\"status\":\"ok\"}",
    "Endpoint is public (no auth required)"
  ],
  "statusHistory": ["ready_to_build", "deployed"]
}
```

## The cost stop (deploy halted for owner approval)
The production deploy is a **separate** gate; the loop's `deployed` status does not make it live.
`deployment-lifecycle` for this app returned:

```
deploymentState : production_blocked
approvalRequired: true
productionUrl   : approval-gated      <- no real URL; nothing was provisioned
```

Evidence nothing spent / was provisioned:
- `productionUrl` is `approval-gated` (no Vercel URL exists).
- No Vercel CLI / MCP / API call was made in this run.
- Per `source-of-truth/controlled-production-release-gate.md`: "even when the gate is approved,
  production deployment is not automatic; a separate owner-approved deployment is required."

This is the fence's **"nothing spends without Lincoln"** criterion, proven.

## The single owner action to go live
To cross the last link (deploy to a real public URL), Lincoln runs the first production deploy
himself (this is the step that incurs Vercel usage — what the gate stopped for):

```bash
cd production-app
vercel --prod        # owner's Vercel account; first run links/creates the project, then deploys
```

After it completes, the endpoint is live at `https://<deployment>.vercel.app/api/health` returning
`{"status":"ok"}`. (Equivalent: connect the repo in the Vercel dashboard and Deploy to Production.)

No other action is required to make this artifact live.
