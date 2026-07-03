# Ecosystem Build Ledger

Prepared from:

- `/Users/lincolnnunnally/Downloads/Ecosystem-Inventory-Reorganized.md`
- live GitHub repo inventory for `lincolnnunnally` on 2026-06-27
- AppEngine portfolio/build/vNext packet standards
- the new AIPOS + Launch Pack starter pack in `outputs/aipos-starter-pack`

## Purpose

This ledger turns the ecosystem inventory into a build-prep board.

It should not replace AppEngine's `BUILD-LEDGER.md`. It is a portfolio-level companion: one row per app/module/product family, with the first safe action needed before builders start work.

## Core Rule

Do not restart apps.

For every product:

1. identify the canonical repo or source package
2. install/fill AIPOS + Launch Pack docs
3. document Supabase ecosystem placement
4. choose one `NEXT_TASK.md`
5. build to live deployment
6. record owner review, agent review, and vNext recommendations

## GitHub Reality Summary

Live GitHub currently shows 29 repos under `lincolnnunnally`.

High-signal findings:

- `AppEngine` is active and already has packet/portfolio/registry tooling.
- `ChurchConnect` is currently more active than `ChurchConnectNew`, so treat `ChurchConnect` as the working canonical repo until a specific audit proves otherwise.
- `Kindred-Connection` has real backend/frontend code and many tests; it should be mined first for the Connection engine.
- `life-produces-life` contains `apps/spark-of-hope`, `apps/best-life`, `apps/live-on-mission`, shared `packages/auth`, `packages/database`, and `packages/matching-engine`.
- `Spark of Hope`, `Best Life`, and `Live On Mission` do not currently appear as standalone repos in the GitHub list; they exist as packages/docs inside `life-produces-life`.
- `Snip.Show` exists, but the richer code appears to be in `emergent`; this needs a consolidation audit.
- Toner has multiple repos and several empty/no-default-branch shells. Do not build from empty shells.
- Several repos are better treated as configs/modules, not standalone apps.

## Status Legend

- `CANONICAL_ACTIVE`: keep and build forward.
- `CANONICAL_CANDIDATE`: likely canonical, but must pass restart audit.
- `MERGE_SOURCE`: mine useful code/content into canonical repo.
- `CONFIG_OF_ENGINE`: should become a config/instance of a shared engine.
- `MODULE`: shared Lego block, not a standalone app.
- `SOURCE_TRUTH`: doctrine/docs/control surface.
- `ARCHIVE_REFERENCE`: preserve as reference; do not build from it.
- `MISSING_REPO`: app exists conceptually but needs repo/package decision.

## Portfolio Board

| Item | Type | Current GitHub Evidence | Disposition | First Safe Action |
|---|---|---|---|---|
| AppEngine | factory / builder | `AppEngine`, active 2026-06-27, TypeScript, packet and registry scripts | CANONICAL_ACTIVE | Add AIPOS + Launch Pack compatibility docs or pointers; create portfolio import from this ledger |
| Life Produces Life source truth | doctrine / source truth | `life-produces-life-source-of-truth`, active 2026-06-27 | SOURCE_TRUTH | Keep as root source; make projects inherit from it instead of copying everything |
| Life Produces Life monorepo | ecosystem package | `life-produces-life`, contains Spark, Best Life, Live On Mission packages and shared modules | CANONICAL_CANDIDATE | Audit whether this becomes the app/module monorepo or remains source package/reference |
| ChurchConnect | organizational app | `ChurchConnect`, active 2026-06-27, backend/frontend/render/vercel/docker/Supabase signals | CANONICAL_ACTIVE | Finish AIPOS restart audit; complete staff follow-up live proof and shared Supabase placement |
| ChurchConnectNew | older church rebuild | `ChurchConnectNew`, last pushed 2025-10-24 | MERGE_SOURCE | Compare only for unique reusable code, then archive/mark non-canonical |
| Association | ChurchConnect config | `Association`, Supabase app, older | CONFIG_OF_ENGINE | Treat as ChurchConnect association-tier configuration, not separate core app |
| honestly | benevolence/stewardship module | `honestly`, backend/frontend tests | MODULE / MERGE_SOURCE | Decide whether it becomes ChurchConnect benevolence module; do not launch separately yet |
| Kindred Connections | belonging + matching engine | `Kindred-Connection`, backend/frontend, many tests | CANONICAL_ACTIVE | Run restart audit; extract module inventory for connection/matching/assessment |
| RacketPro | connection-engine config | `RacketPro`, Supabase app | CONFIG_OF_ENGINE | Mine domain screens; rebuild as Kindred/Connection config after engine is canonical |
| JeepFix | problem/community config | `JeepFix`, Supabase app and migrations | CONFIG_OF_ENGINE | Mine Jeep-specific problem/solution workflow; rebuild as Connection + Needs Matching config |
| Kids Need Dads | audience app | no exact repo; `RebuildingDads` + `KND-google-ai` exist | CANONICAL_CANDIDATE | Decide canonical source; likely merge RebuildingDads and KND-google-ai into one Kids Need Dads app |
| RebuildingDads | KND source | `RebuildingDads`, Supabase app with rich components | MERGE_SOURCE | Mine for KND features, safety, brotherhood, support workflows |
| KND-google-ai | KND source | `KND-google-ai`, Vite app, Firebase signal | MERGE_SOURCE | Mine UI/AI concepts, but route final app to shared Supabase |
| ChildFirst Solutions | co-parenting app | `childfirst-solutions`, active 2026-06-09, Next/Supabase | CANONICAL_ACTIVE | Install AIPOS + Launch Pack; define launch review path and Supabase tree mapping |
| Spark of Hope | core journey app | no standalone repo; package in `life-produces-life/apps/spark-of-hope` | CANONICAL_CANDIDATE | Decide repo/package home; complete Launch Pack for Spark front door |
| Opportunity | problem-to-opportunity app | no standalone repo; surfaces inside AppEngine / We Succeed | MISSING_REPO / IN_APPENGINE | Decide whether Opportunity remains AppEngine/We Succeed front door or gets own repo/app package |
| Best Life | growth app | no standalone repo; README/package area in `life-produces-life/apps/best-life` | MISSING_REPO / PACKAGE_STUB | Create AIPOS app profile and first build packet before coding |
| Live On Mission | service app | no standalone repo; README/package area in `life-produces-life/apps/live-on-mission` | MISSING_REPO / PACKAGE_STUB | Create AIPOS app profile and first build packet before coding |
| Easy Peasy Website | website builder | `Website-friends`, Supabase app | CANONICAL_CANDIDATE | Rename/alias decision; install Launch Pack; mine Website Builder module |
| Snip.Show | clip/creator tool | `Snip.Show` small shell; `emergent` rich Snip.show code | CANONICAL_CANDIDATE | Decide canonical repo and merge direction; likely preserve `Snip.Show` name and mine `emergent` |
| emergent | Snip.Show rich source | `emergent`, backend/frontend/services/tests | MERGE_SOURCE | Mine into Snip.Show; archive as source after consolidation |
| Iconium | icon/logo/image tool | `Iconium`, Next/Prisma app | CANONICAL_ACTIVE | Install Launch Pack; decide whether Prisma stays or moves to Supabase ecosystem tree |
| Laser Engrave Market | commercial marketplace | `LaserEngraving`, Supabase + backend/frontend | CANONICAL_ACTIVE | Install AIPOS + Launch Pack; preserve proof/approval workflow requirements |
| Toner Management | commercial platform | `TotalTonerManagement`, Supabase app, recent push | CANONICAL_CANDIDATE | Choose canonical among local/GitHub toner variants; likely platform repo plus monitoring module |
| TotalToner | toner source | `TotalToner`, README-only | ARCHIVE_REFERENCE | Use as naming/reference only unless audit finds missing docs |
| TM-UserDash | toner customer dashboard | `TM-UserDash`, Supabase app | MERGE_SOURCE | Merge as customer dashboard view/module in canonical toner platform |
| TM-Admin-portal | toner admin | `TM-Admin-portal`, Supabase app | MERGE_SOURCE | Merge as admin view/module in canonical toner platform |
| TM-Admin | toner admin shell | no default branch | ARCHIVE_REFERENCE | Do not build from this shell |
| PrinterProtectorMonitoringTool | monitoring module shell | no default branch | ARCHIVE_REFERENCE / MODULE_IDEA | Use concept only unless local source exists elsewhere |
| PrinterProtectorCustomer | customer variant shell | no default branch | ARCHIVE_REFERENCE | Do not build from this shell |
| TonerTracker | toner shell | no default branch | ARCHIVE_REFERENCE | Do not build from this shell |
| ideas | idea/content capture | `ideas`, backend/frontend/mobile, tests | CANONICAL_CANDIDATE | Decide relation to Opportunity/AppEngine intake; install AIPOS and Launch Pack |
| Million Mistakes | principle/content | `Million-Mistakes`, README only | SOURCE_TRUTH / CONTENT | Treat as content/principle feeding Best Life/Opportunity, not standalone app yet |
| AllReposBackup | backup | no default branch | ARCHIVE_REFERENCE | Do not build from this |

## Shared Module Ledger

These should be built once and reused across apps. They should live in the consolidated Supabase ecosystem tree and/or shared packages, not be copied into each app.

| Module | Primary Source To Mine First | Apps It Powers | First Safe Action |
|---|---|---|---|
| Identity and Auth | `life-produces-life-source-of-truth`, `life-produces-life/packages/auth`, AppEngine auth docs | all apps | Reconcile canonical `person` identity and auth rules into `SUPABASE_ECOSYSTEM_TREE.md` template |
| Connection / Belonging | `Kindred-Connection` | Kindred, KND, ChurchConnect, Opportunity, RacketPro, JeepFix | Extract repo map of matching/assessment/group code before new builds |
| Needs to Helper Matching | `JeepFix`, ChurchConnect, future Live On Mission | Live On Mission, ChurchConnect, Opportunity, community apps | Define shared schema and engine contract after Connection audit |
| Intake | AppEngine, `ideas`, Opportunity surfaces | Opportunity, AppEngine, ChurchConnect, KND | Pick one canonical intake packet and reuse it |
| Testimony Engine | Spark package in `life-produces-life`, AppEngine docs | Spark, Opportunity, Best Life, ChurchConnect | Define schema + review UI before building new testimony screens |
| Navigator / Recommendation | Opportunity/AppEngine surfaces, `ideas` | Opportunity, Best Life, Spark | Build as shared module after intake and identity are stable |
| Events and Scheduling | ChurchConnect | ChurchConnect, Live On Mission, coaching | Mine ChurchConnect event routes and schema first |
| CRM / Follow-up | ChurchConnect | ChurchConnect, business apps, KND | Finish ChurchConnect follow-up proof, then generalize |
| Website Builder | Website-friends | Easy Peasy, ChurchConnect, business apps | Audit Website-friends for reusable builder module |
| Payments / Billing | Toner, Laser, RebuildingDads | commercial apps, donations | Keep payment code app-scoped until shared policy/security review |
| Growth Tracking | RebuildingDads, KND-google-ai, Best Life stub | Best Life, KND, Spark | Define shared growth model before Best Life build |
| Hope / Engagement Analytics | Spark/AppEngine docs | dashboard across journey apps | Park until first three live apps produce data |

## Recommended Build Sequence

### Phase 0 - Portfolio Grounding

Goal: make the inventory operational without touching app code.

1. Create a canonical portfolio registry entry for every row above.
2. For each canonical candidate, fill `PROJECT_RESTART_AUDIT.md`.
3. For each active app, install/fill AIPOS + Launch Pack docs.
4. Record `SUPABASE_ECOSYSTEM_TREE.md` for each app.
5. Mark duplicate/empty repos as `MERGE_SOURCE` or `ARCHIVE_REFERENCE`.

Completion proof:

- one owner-readable portfolio ledger exists
- every app has a canonical source decision or a known blocker
- no builder is dispatched against a duplicate repo

### Phase 1 - Finish The Already-Closest Apps

Goal: get existing work to live/review state.

1. AppEngine: keep public `we-succeed.org` stable; add this portfolio build ledger as an AppEngine-managed registry source.
2. ChurchConnect: finish authenticated staff follow-up walkthrough and frontend freshness proof.
3. Kindred Connections: audit and extract Connection engine surfaces.
4. ChildFirst: install Launch Pack and verify current build/deploy path.
5. Snip.Show: resolve `Snip.Show` vs `emergent` canonical source.
6. Toner: choose canonical repo and merge dashboard/admin variants into modules.

### Phase 2 - Build The Shared Human Spine

Goal: stop rebuilding belonging/support logic per app.

1. Canonical Identity/Auth.
2. Connection engine from Kindred.
3. Testimony engine from Spark.
4. Intake/Navigator module from Opportunity/AppEngine/ideas.
5. Needs-to-helper matching from JeepFix/ChurchConnect/Live On Mission concept.

Completion proof:

- modules have clear source homes
- apps import/use modules instead of copying logic
- Supabase tree has shared schema decisions documented

### Phase 3 - Launch The Core Journey Apps

Goal: produce the core transformation apps that are missing or only stubs.

1. Spark of Hope: move from package/stub to live app with testimony and hope flow.
2. Opportunity: decide own app vs We Succeed/AppEngine front door, then ship the chosen surface.
3. Best Life: first growth pathway using shared growth tracking.
4. Live On Mission: first service pathway using events + needs matching.

### Phase 4 - Turn Config Repos Into Engine Configs

Goal: stop treating every niche community as a separate app build.

1. Kids Need Dads from RebuildingDads + KND-google-ai + Connection engine.
2. RacketPro as a sports/community config.
3. JeepFix as problem-solving/community config.
4. Association as ChurchConnect association-tier config.
5. Honestly as ChurchConnect benevolence/stewardship module.

### Phase 5 - Commercial Product Completion

Goal: finish revenue/service apps without absorbing the mission apps.

1. Easy Peasy Website / Website-friends.
2. Toner Management platform.
3. Laser Engrave Market.
4. Iconium.
5. Snip.Show.

## First Board Items To Create

These are the first safe tasks. They are intentionally documentation/audit tasks, not coding tasks.

| ID | Status | Task | Target | Why First |
|---|---|---|---|---|
| ECO-001 | AVAILABLE | Create canonical portfolio registry from this ledger | AppEngine | Lets owner see every app and next safe action |
| ECO-002 | AVAILABLE | Run AIPOS restart audit for ChurchConnect | ChurchConnect | Active app, currently closest to real shared-Supabase proof |
| ECO-003 | COMPLETED | Run AIPOS restart audit for Kindred-Connection | Kindred | Highest-leverage shared module source; mining audit and template catalog now exist in source-of-truth |
| ECO-004 | AVAILABLE | Decide Snip.Show canonical repo and merge direction | Snip.Show / emergent | Prevents two clip tools from drifting |
| ECO-005 | AVAILABLE | Decide Toner canonical repo and module split | Toner repos | Prevents eight toner repos from becoming eight builds |
| ECO-006 | AVAILABLE | Create Spark Launch Pack from `life-produces-life/apps/spark-of-hope` | Spark | First missing core journey app with existing package |
| ECO-007 | AVAILABLE | Create Opportunity app boundary decision | Opportunity/AppEngine/ideas | Prevents intake/front-door confusion |
| ECO-008 | AVAILABLE | Create shared Connection module extraction packet | Kindred + configs | Stops rebuilding the same matching engine |
| ECO-009 | COMPLETED | Create rebrandable template catalog from existing app patterns | AppEngine + Kindred | Lets new apps start by rebranding and plugging credentials instead of starting blank |
| ECO-010 | IN REVIEW | Build shared Location & Proximity module (PostGIS geo_places + RPCs + clients; owner directive 2026-07-03) | All apps (ChurchConnect finder, Kindred discover, Laser makers, Live On Mission, Milstead.us, dating) | Only fully-missing catalog block; every location feature currently reinvents geo. Schema staged in db/location-proximity-schema.sql; applying it is an owner-gated db-change |

## Decision Points For Lincoln

These need owner decisions before code work:

1. Does `life-produces-life` become the monorepo home for core journey apps and shared packages, or remain a reference/source package?
2. Should `Opportunity` live as its own app, or remain the public intake/front door inside AppEngine/We Succeed?
3. For `Snip.Show`, should the canonical repo be `Snip.Show` with `emergent` merged into it?
4. For Toner, should `TotalTonerManagement` be canonical, or is the local `toner-management-app` ahead of GitHub and should be published first?
5. Should `Kids Need Dads` get a clean canonical repo, or should `RebuildingDads` be renamed/adapted?
6. Should commercial apps use the shared Supabase ecosystem tree by default, or only shared identity with app-scoped schemas?

## What Not To Do

- Do not start building Spark, Best Life, Live On Mission, or Opportunity from scratch until their current package/repo state is audited.
- Do not use `ChurchConnectNew` just because the inventory called it likely canonical; live GitHub now shows `ChurchConnect` as the active repo.
- Do not build from empty/no-default-branch toner shells.
- Do not create separate databases for Lincoln-owned apps unless the Launch Pack records an approved exception.
- Do not turn configs like RacketPro/JeepFix into separate engines.
- Do not mark any app done at local build; done means live deploy, live verification, owner review, agent review, and vNext recommendations.

