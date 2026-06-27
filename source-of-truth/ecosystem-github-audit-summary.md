# Ecosystem GitHub Audit Summary

Read-only GitHub audit run on 2026-06-27 for owner `lincolnnunnally`.

The audit listed 29 repos and inspected default-branch trees for code/config signals.

## Repo Signals

| Repo | Branch | Language | Last Push | Files | Packages | Signals | Initial Classification |
|---|---|---|---|---:|---:|---|---|
| AppEngine | main | TypeScript | 2026-06-27 | 622 | 1 | src, Next app, readme, launch docs | active factory |
| ChurchConnect | main | TypeScript | 2026-06-27 | 1849 | 2 | Supabase, backend, frontend, Next, Render, Vercel, Docker, deploy docs | active canonical church app |
| life-produces-life-source-of-truth | main | PLpgSQL | 2026-06-27 | 29 | 0 | readme, db files | source truth |
| life-produces-life | main | TypeScript | 2026-06-11 | 112 | 8 | Supabase, app packages, shared packages | source package / possible monorepo |
| Kindred-Connection | main | Python | 2026-06-10 | 260 | 1 | backend, frontend, tests | active connection engine |
| emergent | main | JavaScript | 2026-06-10 | 223 | 1 | backend, frontend, tests | Snip.Show merge source |
| childfirst-solutions | main | TypeScript | 2026-06-09 | 136 | 1 | Supabase, Next app | active co-parenting app |
| Website-friends | main | TypeScript | 2026-06-09 | 90 | 1 | Supabase, src | Easy Peasy candidate |
| TotalTonerManagement | main | TypeScript | 2026-06-09 | 87 | 1 | Supabase, src | toner canonical candidate |
| Snip.Show | main | JavaScript | 2026-06-08 | 14 | 1 | small shell | canonical-name candidate |
| KND-google-ai | main | TypeScript | 2026-06-06 | 40 | 1 | src, env example | KND merge source |
| Million-Mistakes | main | none | 2026-06-02 | 1 | 0 | readme only | content/principle |
| ideas | main | JavaScript | 2026-06-02 | 308 | 2 | backend, frontend, mobile | idea/content capture candidate |
| honestly | main | JavaScript | 2026-06-02 | 120 | 1 | backend, frontend, tests | ChurchConnect module candidate |
| LaserEngraving | main | TypeScript | 2026-06-02 | 198 | 2 | Supabase, backend, frontend | active commercial app |
| Iconium | main | TypeScript | 2026-05-22 | 20 | 1 | Next app | active logo/image app |
| RebuildingDads | main | TypeScript | 2026-03-08 | 204 | 1 | Supabase, src | KND merge source |
| JeepFix | main | TypeScript | 2026-02-25 | 59 | 1 | Supabase, migrations | connection/problem config |
| TM-UserDash | main | TypeScript | 2026-02-07 | 151 | 1 | Supabase, launch docs | toner merge source |
| TM-Admin-portal | main | TypeScript | 2026-02-06 | 133 | 1 | Supabase, launch docs | toner merge source |
| Association | main | TypeScript | 2025-11-14 | 427 | 2 | Supabase, launch docs | ChurchConnect config |
| ChurchConnectNew | main | TypeScript | 2025-10-24 | 322 | 1 | Supabase, launch docs | older church source |
| RacketPro | main | TypeScript | 2025-10-18 | 169 | 1 | Supabase, src | connection config |
| AllReposBackup | none | none | 2025-09-29 | 0 | 0 | none | archive |
| TonerTracker | none | none | 2025-09-29 | 0 | 0 | none | archive/reference |
| TotalToner | main | none | 2025-09-22 | 1 | 0 | readme only | toner reference |
| PrinterProtectorMonitoringTool | none | none | 2025-09-22 | 0 | 0 | none | archive/reference |
| PrinterProtectorCustomer | none | none | 2025-09-22 | 0 | 0 | none | archive/reference |
| TM-Admin | none | none | 2025-09-12 | 0 | 0 | none | archive/reference |

## Important Corrections To Inventory

1. `ChurchConnect` appears to be the active current repo, not `ChurchConnectNew`.
2. `Spark of Hope`, `Best Life`, and `Live On Mission` do exist as app/package surfaces inside `life-produces-life`, even though they do not appear as standalone repos.
3. Several toner repos are empty shells; they should not drive build work.
4. `Snip.Show` is the canonical product name, but `emergent` appears to contain richer source code.
5. `Kindred-Connection` is not just a concept; it has backend/frontend/tests and should be audited before any new matching/connection work.

## Recommended Next Artifact

Create an AppEngine-managed `app_portfolio_registry` from `source-of-truth/ecosystem-build-ledger.md`, then use the AIPOS + Launch Pack starter to install project-specific docs into the first pilot repo.

Recommended pilot order:

1. ChurchConnect
2. Kindred-Connection
3. Snip.Show / emergent consolidation
4. Toner canonicalization
5. Spark of Hope package-to-launch

