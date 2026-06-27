# Ecosystem Deployment Queue

Date: 2026-06-27
Owner: Lincoln

## Purpose

This queue turns the mined repo inventory into deployable work without letting builders skip the launch gates.

It answers:

- Which apps are already live?
- Which apps build locally?
- Which apps need canonical-source decisions?
- Which apps need credentials or Supabase placement before deployment?
- Which apps should not be deployed yet?

## Deployment Rule

Production deployment is not just a build command.

An app is deployment-ready only when its Launch Pack contains:

- deployment provider
- project/site/service name
- frontend URL
- backend URL if applicable
- required environment variables by name
- Supabase project/schema placement
- migration plan
- health check
- rollback path
- owner review URL
- post-launch review checklist

## Queue Status Legend

- `LIVE`: production URL already exists and is the active owner-facing surface.
- `PREVIEW_ELIGIBLE`: code builds and can receive a preview after env/project linking is confirmed.
- `LAUNCH_GATED`: code exists, but Launch Pack/env/Supabase details block deployment.
- `CANONICAL_SOURCE_GATED`: multiple repos/sources exist; choose one before deploying.
- `BOUNDARY_GATED`: app/module boundary is not decided.
- `DO_NOT_DEPLOY`: source is reference/merge material only.

## Deployment Queue

| Priority | App | Status | Build Proof | Deployment Target | Blocker | Next Safe Action |
|---:|---|---|---|---|---|---|
| 0 | AppEngine / We Succeed | LIVE | existing production | `https://www.we-succeed.org` | none for current live surface | Keep vNext packets flowing through portfolio registry |
| 1 | ChurchConnect | LAUNCH_GATED | passed 2026-06-27, bundle warnings | Vercel frontend + backend service | Launch Pack/env/live staff follow-up proof | Fill Launch Pack, verify env, deploy preview, run staff follow-up smoke |
| 2 | ChildFirst Solutions | PREVIEW_ELIGIBLE | passed 2026-06-27 | likely Vercel/Next | Launch Pack and Supabase placement not installed | Install AIPOS + Launch Pack and create review deployment |
| 3 | Toner Management | CANONICAL_SOURCE_GATED | deploy-facing local app passed 2026-06-27 | likely Vercel/Node API | canonical source not chosen across toner repos | Choose canonical repo, then deploy preview from that repo only |
| 4 | Iconium | LAUNCH_GATED | passed 2026-06-27 | likely Vercel/Next | Prisma-vs-Supabase decision | Decide database placement, then deploy preview |
| 5 | Easy Peasy Website | LAUNCH_GATED | frontend passed 2026-06-27 | frontend + FastAPI backend | provider credentials and provisioning safety | Fill provider/env Launch Pack and backend health check |
| 6 | Snip.Show | CANONICAL_SOURCE_GATED | shell and rich source builds passed with warnings | product repo TBD | `Snip.Show` vs `emergent` merge direction | Choose canonical repo and deploy one preview |
| 7 | Kindred Connections | LAUNCH_GATED | mined; build not rerun in this pass | TBD | app-local AIPOS/Launch Pack missing | Install/fill docs and run build + preview |
| 8 | Laser Engrave Market | LAUNCH_GATED | mined from GitHub tree | TBD | Launch Pack and proof artifact contract missing | Fill Launch Pack and proof acceptance tests |
| 9 | Ideas / Idea Capture | BOUNDARY_GATED | mined from GitHub tree | TBD | standalone vs Opportunity/AppEngine intake | Decide boundary, then run build and preview |
| 10 | Kids Need Dads | CANONICAL_SOURCE_GATED | mined from RebuildingDads + KND-google-ai | TBD | canonical source missing | Pick/rename canonical repo, then run restart audit |
| 11 | Spark of Hope | BOUNDARY_GATED | package/source-truth surface | TBD | package home and Launch Pack needed | Create Spark app profile and Launch Pack |
| 12 | Best Life | BOUNDARY_GATED | package stub | TBD | first build packet missing | Create app profile, scope, acceptance tests |
| 13 | Live On Mission | BOUNDARY_GATED | package stub | TBD | service/matching boundary not finalized | Create app profile and shared needs-matching packet |
| 14 | Association | DO_NOT_DEPLOY | mined as source | ChurchConnect config | should not be separate engine | Merge unique association-tier features into ChurchConnect |
| 15 | JeepFix | DO_NOT_DEPLOY | mined as source | Connection/problem config | should not be separate engine yet | Convert to config after shared engines are ready |
| 16 | RacketPro | DO_NOT_DEPLOY | mined as source | Connection/growth config | should not be separate engine yet | Convert to sports config after shared engines are ready |
| 17 | Honestly | DO_NOT_DEPLOY | mined as source | care/benevolence/media module | standalone boundary unclear | Decide whether ChurchConnect module or standalone app |

## Safe Deployment Path

For each `PREVIEW_ELIGIBLE` or `LAUNCH_GATED` app:

1. Install/fill AIPOS docs in the app repo.
2. Fill Launch Pack.
3. Confirm Supabase ecosystem tree placement.
4. Run local build.
5. Run smoke tests.
6. Create preview deployment.
7. Run health check against preview URL.
8. Record owner review and agent review.
9. Promote to production only after approval.

## Do Not Deploy Yet

Do not deploy these until the named issue is resolved:

- `Association`: merge/config source for ChurchConnect.
- `ChurchConnectNew`: older source, not canonical.
- `JeepFix`: useful config/module source, not separate engine yet.
- `RacketPro`: useful config/module source, not separate engine yet.
- `Honest/Honestly`: boundary not decided.
- empty/no-default-branch toner shells: reference only.

## Current Build Evidence

| Source | Result | Notes |
|---|---|---|
| `/Users/lincolnnunnally/Documents/Project_Code/toner-management-app` | pass | deploy-facing toner app builds |
| `/Users/lincolnnunnally/Documents/ChildFirst/app` | pass | Next app builds |
| `/Users/lincolnnunnally/Documents/Iconium` | pass | Next app builds |
| `/Users/lincolnnunnally/Documents/Easy Peazy Websites/repo-inspect/frontend` | pass | frontend builds |
| `/Users/lincolnnunnally/Documents/Project_Code/emergent/frontend` | pass with warnings | React hook dependency warnings |
| `/Users/lincolnnunnally/Documents/Project_Code/ChurchConnect/ChurchConnect` | pass with warnings | large Vite chunk warnings |
| `/Users/lincolnnunnally/Documents/Project_Code/snip.show/frontend` | pass with warnings | React hook dependency warnings |

## Production Gate

No production deployment should happen until the app row has moved to `PREVIEW_ELIGIBLE`, the preview URL has been reviewed, and the owner has approved promotion.

