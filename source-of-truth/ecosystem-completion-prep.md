# Ecosystem Completion Prep

> This is a completion packet for every one of the 24 apps in your portfolio registry — what each one is today, what "complete" means for it, and the first action(s) to get there. It was built read-only (nothing was changed) and then run through an adversarial verifier on 2026-07-04, so stale claims from parallel 2026-07-03/04 sessions are already corrected. Read the **Owner Decisions** table first — that is the short list only you can answer, and most apps unblock the moment one of those is settled. Then skim the **Completion Board**: apps are bucketed **Now / Next / Later / Park** by priority, one compact card each. **THE ONE RULE: build forward, never recreate — nothing marked DONE here may be rebuilt.** This is a docs-only deliverable: no code was written and no commands were run.

---

## Owner Decisions — the short list only Lincoln can make

Answer any of these inline; each is phrased so a one-line reply unblocks the tagged app(s). The first block is the recurring, portfolio-wide set; the second is app-specific one-offs. (Two decisions the packets listed are already made and have been removed: the **Aligned Souls** name pick and the **ECO-010 PostGIS** DB change — both done 2026-07-04.)

### Recurring / portfolio-wide

| # | Decision (one-line answer) | Unblocks |
|---|---|---|
| 1 | **D1 — monorepo fate:** Is `life-produces-life` the permanent build home for journey apps + shared modules, or does each get its own repo? | Best Life, Spark of Hope, Live On Mission, UUG, Community Connections, Milstead, ChurchConnect Bridge |
| 2 | **D2 / ECO-007 — intake boundary:** Does Opportunity (and Ideas) stay the We Succeed front door, or split into its own app? ("front door" / "own app") | Opportunity, Ideas |
| 3 | **D4 / ECO-005 — Toner + Printer Protector canonical:** Confirm `toner-management-app` (published as `TotalTonerManagement/clean-toner-management-app`) as canonical Toner source; and is Printer Protector a standalone SaaS or the Toner monitoring module? | Toner Management, Printer Protector |
| 4 | **D5 — Kids Need Dads canonical:** Adapt/rename **RebuildingDads** (full history) as the canonical repo, with KND-google-ai as merge source? (dads-recovery is only the protective backup + `.env` — not canonical.) | Kids Need Dads |
| 5 | **D6 — Spark of Hope home:** `life-produces-life/apps/spark-of-hope` (monorepo) or a new standalone repo? | Spark of Hope |
| 6 | **D7 — commercial-app schema policy:** Do ecosystem-owned paid apps put schemas on the shared LPL Supabase (Laser precedent), or isolated DBs (Neon)? | ChildFirst, Iconium, Snip.Show, Toner, Printer Protector, Easy Peazy, Laser |
| 7 | **D8 — paid domains/renewals:** Approve buying/pointing domains as apps ship — e.g. `alignedsouls.app` ($9.99), `childfirstsolutions.com` (available), an Iconium domain; note `kidsneeddads.com` (plural, third-party) expires 2026-08-11 — renew or drop? | Aligned Souls, ChildFirst, Iconium, Best Life, Spark |
| 8 | **D9 — host logins:** Will you grant (or click yourself) access to the origin hosts — **Netlify** (kidsneeddad.com), **Cloudflare** (live-on-mission.com, easypeazy.site), **DreamHost/WordPress** (best-life.us, milstead.church, UUG), **Spaceship/LiteSpeed** (milstead.us, snip.show)? | KND, Live On Mission, Easy Peazy, Milstead, Milstead Church, UUG, Snip.Show, Best Life |
| 9 | **Neon durable persistence (AppEngine):** Flip it ON? It is the stated key unlock for cost totals, daily caps, credentials store, and the orchestrator. | AppEngine / We Succeed |
| 10 | **Vercel Hobby commercial-use posture:** Several apps are now paid products on Hobby (ToS restricts commercial use) — stay Hobby, upgrade to Pro, or defer monetization? | We Succeed, Laser, Iconium, Aligned Souls |

### App-specific one-offs

| # | Decision (one-line answer) | Unblocks |
|---|---|---|
| 11 | **Doctrine amendment (SoT repo PR #19):** Approve/edit/merge the "Soul Dating" amendment to `01_ECOSYSTEM_MAP`'s "false fix of premature romance" section — the hard gate on any dating build. | Aligned Souls |
| 12 | **ChurchConnect Atlas salvage scope:** Which Emergent/Atlas collections may be salvage-imported (members? events? comms?), and may the export run now? (Creds already in-repo; only scope is gated.) | ChurchConnect |
| 13 | **ChurchConnect PR #12 (AIPOS launch pack / branding):** Merge as the branding session leaves it, or hold for your review? | ChurchConnect, Milstead Church |
| 14 | **Kindred exodus (3 in one):** Merge Kindred-Connection PR #1 (docs-only); pick Kindred's real domain (best-life.us was unlinked); approve Render+Vercel free projects + Anthropic/Resend keys + kindred_* schema on shared Supabase? | Kindred Connections |
| 15 | **ChildFirst PR #2 + data direction:** May Claude Code merge codex PR #2 after local build/typecheck? And kill the mid-flight Neon migration to stay Supabase-only? ("Supabase" / "Neon") | ChildFirst |
| 16 | **Laser launch keys + cutover:** Provide RENDER_API_KEY + STRIPE_API_KEY (or click Render yourself); and cut over the live 2024 WordPress storefront at laser.engrave.market — replace / preserve-then-replace / keep-WP? | Laser Engrave |
| 17 | **Snip.Show ECO-004 canonical + host access:** Canonical repo = Snip.Show with emergent `complete` branch merged in? And do you have Emergent.sh + Mongo access for the live legacy deploy (real user data to export)? | Snip.Show |
| 18 | **Easy Peazy canonical + name:** Which codebase is canonical — the live Emergent CRA build or the Website-friends repo — and the final name (EasyPeazy / EasyWebsite / Easy Business Website Service)? Approve Spaceship API creds + spend guard? | Easy Peazy |
| 19 | **Live On Mission boundary:** Standalone app, or keep running as the ChurchConnect `/mission` surface? Confirm the Community Connections pairing and one shared needs-to-helper matching module. | Live On Mission, Community Connections |
| 20 | **Milstead Church disposition:** When the ChurchConnect tenant is ready, do we (a) replace WP at milstead.church, (b) subdomain `app.milstead.church`, or (c) bridge via the churchconnect-wordpress plugin? Approve seeding the real org row (DB change)? | Milstead Church |
| 21 | **UUG platform:** Keep unitedundergod.org on WordPress/PMP as canonical, or replatform into the ecosystem? Embed the public family-of-apps view (reading the existing ops collector — never a second dashboard) now or after the ruling? | United Under God |
| 22 | **Honestly boundary:** ChurchConnect benevolence/care module (Phase-4 default), standalone app, or template-only source to mine and archive? If module: may counselor notes + participant video live in the churchconnect schema with role-restricted access? | Honestly, ChurchConnect Bridge |
| 23 | **Million Mistakes identity:** Standalone app (your roster #20, needs a URL) or a content/principle source feeding Best Life & Opportunity? The registry contradicts your same-day statement. | Million Mistakes |
| 24 | **"Is this WordPress site yours?"** Confirm the live legacy WP sites are yours and replaceable at launch: best-life.us, milstead.us ("Milstead Village"), milstead.church, laser.engrave.market. | Best Life, Milstead, Milstead Church, Laser |

---

## Verified DONE 2026-07-03/04 — do not rebuild

- **ChurchConnect T5 — all three gates crossed (2026-07-03):** staff walkthrough proven at the API layer, UI sign-in fixed (localhost:8000 baked-base gone; PRs #13–#16 merged), churchconnect schema applied to the shared LPL Supabase (readiness `ready=true`). *(The ConnectionInbox **frontend** row still needs a signed-in UI walkthrough — see its card.)*
- **Laser Engrave pivot — Mongo→Supabase complete (2026-07-03):** LaserEngraving PR #1 merged; FastAPI ported to supabase-py on the shared LPL Supabase; Vercel preview live. Blocked only on RENDER_API_KEY + STRIPE_API_KEY.
- **AppEngine ops/URL/dashboard waves merged on main (now `b3dc8a8`, 2026-07-04):** attention queue (#251), account-wide deploy sweep (#278), URL status board (#275), ops stats layer (#245), session-token-leak fix (#273), and the **task-first owner-control dashboard (#285, board-marked DONE via #287)**. We Succeed is LIVE + PUBLIC at www.we-succeed.org since 2026-06-27.
- **ECO-010 geo module — LIVE (2026-07-04, owner-approved):** PostGIS 3.3.7 enabled on the shared LPL Supabase + 2 migrations applied (`eco010_location_proximity_module`, `eco010_geo_rpc_grants_hardening`), E2E-verified. Do not re-apply.
- **Aligned Souls name — DECIDED (2026-07-04):** the dating app is **Aligned Souls** (slug `soul-dating`). Rename is now an executable docs task, not an open decision.
- **Protective backups pushed (2026-07-03):** dads-recovery (byte-identical RebuildingDads snapshot + `.env`), TonerTracker, toner-platform. Spark of Hope Vercel project disconnected from AppEngine (#258 merged).

---

## Completion Board

Effort: **S** = small · **M** = medium · **L** = large.

### Now — unblocked, high value

**AppEngine / We Succeed** (`appengine`) · **M** · past its own finish line; close the tail
- **State:** LIVE + PUBLIC at www.we-succeed.org since 2026-06-27; main advanced to `b3dc8a8` (2026-07-04) with #285 task-first dashboard + ops waves merged.
- **Complete means:** open PR queue landed/closed, "Send to Claude Code" board item built, your signed-in non-owner walkthrough done, registry/board reconciled.
- **First actions:** (build) **rebase** PR #255 (auth) *preserving merged #273's session-token fix* — do not blind-merge; (build) **rebase** PR #284 (card-detail) *preserving #285's dashboard*; (protective) diff the local dirty tree vs origin/main and **discard** — it is already-merged #273 work, not to be rescued.
- **Gated by:** Neon flip [#9] and Vercel Hobby posture [#10] for the hardening tail; your non-owner walkthrough.

**ChurchConnect** (`churchconnect`) · **L** · production-live; execute the transfer ledger
- **State:** Live at www.churchconnect.cloud; all three T5 gates crossed 2026-07-03; schema applied. ~23 legacy feature rows remain on the in-repo transfer ledger; only PR #12 (branding) open.
- **Complete means:** every ledger row transferred_proven / deferred / owner-removed with evidence; Atlas salvage done; PR #12 resolved; real milstead-church org row replaces the fallback.
- **First actions:** (docs) fill the ledger with the 2026-07-03 API proof and flip the staff-follow-up + visitor-follow-up rows to transferred_proven — **but hold the ConnectionInbox frontend row at partially_transferred until a signed-in staff UI walkthrough** (API proof ≠ UI proof); (docs) refresh the registry entry **and update the BUILD-LEDGER T5 marker (still shows ⛔)**; (build) execute ledger slices from Member Management using visitor-registration as the proven pattern.
- **Gated by:** Atlas salvage scope [#12], PR #12 branding merge [#13], the "must-have vs deferred" ledger call.

**Toner Management** (`toner-management`) · **M** · live in production; source protected
- **State:** LIVE at toner.management (Vercel, Neon-backed `/api/health` ok) from `toner-management-app`, published as `TotalTonerManagement/clean-toner-management-app`. **Source PROTECTED (verified 2026-07-04):** `toner-management-app` → `TotalTonerManagement` and `toner-platform` → `toner-platform` are both clean working trees, fully pushed; `TonerTrackerPro` → `TonerTracker` is pushed too (only stray screenshots + a `.local/` dir uncommitted — not source). No uncommitted toner source remains on disk. The six loose non-git folders (`Toner_Management*`, `total*toner*`, `toner_monitoring_project`) are pre-July superseded dupes, not current code. Registry still says "nothing serving" — correct it.
- **Complete means:** D4 canonical recorded, variant repos merged via a transfer ledger, registry corrected, data-home (per the 2026-07-04 ruling: shared Supabase) applied.
- **First actions:** (docs) correct the registry to live-at-domain with evidence; (docs) start the transfer-ledger inventory of TM-UserDash / TM-Admin-portal; note D4 is now settled by the owner-rulings doc (Toner = a product family folded into the ops dashboard, not one repo).
- **Gated by:** D4 canonical [#3] — answered in `ecosystem-owner-rulings.md`; D7 answered (shared Supabase); Vercel account confirmation [#8].

**Printer Protector (monitoring)** (`printer-protector-monitoring`) · **M** · live SaaS, source protected
- **State:** **Source PROTECTED (verified 2026-07-04):** the standalone `Printer-Protector` folder is a git repo → `PrinterProtectorMonitoringTool`, clean tree, fully pushed; the newer June-2026 SNMP agent + integrated printer dashboard are pushed inside `toner-platform` → `toner-platform`. (The `Printer-Protector9-22-25Backup` non-git folder is a Sept-2025 backup, superseded.) A working React/Vite dashboard + Python SNMP agent + 2 Supabase migrations + built .dmg installers — no longer at code-loss risk.
- **Complete means:** Toner-relationship + D7 decided (both now answered); transfer ledger reconciling the standalone vs the toner-platform copy; monitoring loop proven E2E.
- **First actions:** (docs) create the planning issue; (docs) transfer-ledger inventory reconciling the two protected copies to avoid double-building; fold the admin role into the ops dashboard per the Toner ruling.
- **Gated by:** standalone-vs-module [#3] — the ruling routes the admin hub into the ops dashboard; D7 answered (shared Supabase).

### Next — after a small unblock

**Kids Need Dads** (`kids-need-dads`) · **M** · right domain, wrong face
- **State:** kidsneeddad.com (singular, healthy) is LIVE on Netlify serving a **RebuildingDad** app. Only **two** distinct codebases exist: **RebuildingDads** (full history) ≡ dads-recovery (byte-identical backup + `.env`), and KND-google-ai (a raw AI Studio scaffold).
- **Complete means:** kidsneeddad.com serves a Kids Need Dads-branded app built forward from the canonical source with all RebuildingDad features preserved; schema on shared Supabase; transfer ledger.
- **First actions:** (docs) planning issue with a canonical-source packet recommending **RebuildingDads** as base (KND-google-ai = merge source; dads-recovery = backup only); (owner_decision) D5; (credential) obtain Netlify access.
- **Gated by:** D5 [#4], Netlify login [#8], Stripe for Brotherhood Fund.

**ChildFirst Solutions** (`childfirst-solutions`) · **M** · fully built, never deployed
- **State:** A substantial Next.js 15 + supabase-js co-parenting app; all post-May work sits on codex PR #2 (origin/main stale at 2026-05-22). Carries a mid-flight Neon-migration ambiguity. No domain, no deploy.
- **Complete means:** PR #2 merged; schema on shared Supabase (RLS); Launch Pack + env profile; Vercel preview + your walkthrough; domain live.
- **First actions:** (docs) planning issue + seed the transfer ledger; (verify) local build+typecheck then **merge PR #2** so main stops being 3 weeks stale — never rebuild the routed workflows, they exist on the branch; (build) strip the Neon direction once Supabase is confirmed.
- **Gated by:** PR #2 merge authority + Neon-vs-Supabase [#15], D7 [#6], D8 domain [#7].

**Snip.Show** (`snip-show`) · **L** · live on legacy hosting, unconsolidated
- **State:** snip.show is LIVE (HTTP 200) serving the emergent build behind Cloudflare — likely legacy Emergent.sh hosting you may not durably control. Full source is on Snip.Show PR #1 (+32k lines); emergent `complete` branch (2026-06-09) is the newest work.
- **Complete means:** one consolidated canonical build (Snip.Show repo + emergent `complete` merged) deployed on infra you control; transfer ledger; core creator workflows proven.
- **First actions:** (docs) correct the registry (it says "nothing serving"); (owner_decision) ECO-004 canonical; (protective) confirm Emergent/Mongo access + export any real user data before the legacy host lapses.
- **Gated by:** ECO-004 + Emergent access [#17], D7 [#6], Render/keys.

**Laser Engrave Market** (`laser-engrave-market`) · **M** · pivot done, launch on two keys
- **State:** Mongo→Supabase pivot complete (PR #1 merged); Vercel preview live. Render backend not yet created; laser.engrave.market serves a live 2024 WordPress storefront (cutover, not a blank attach).
- **Complete means:** Render service live, checkout working, 4 proof-approval smoke tests wired, your preview review passes, domain cutover done.
- **First actions:** (docs) correct the domain block (serving legacy WP) + create the in-repo transfer ledger; (credential) RENDER_API_KEY + STRIPE_API_KEY; (owner_decision) WordPress cutover call.
- **Gated by:** RENDER + STRIPE keys + cutover [#16], D7 [#6], Vercel Hobby [#10].

**Iconium** (`iconium`) · **M** · MVP protected on a branch; merge to main + apply DB ruling
- **State:** **Source PROTECTED (verified 2026-07-04):** the build-passing AI logo/brand studio MVP (39 source files — 3 API routes `projects`/`generate`/`export`, `lib/openai`, editor, exports) is committed and PUSHED on the `Iconium` repo branch `feat/logo-studio-mvp` (clean tree, `~/Documents/Iconium`). Only `main` still holds the old 12-file skeleton — a merge-to-main step, NOT a loss risk. Targets Neon today (the 2026-07-04 ruling makes mission apps shared-Supabase).
- **Complete means:** `feat/logo-studio-mvp` merged to main; DB moved to shared Supabase per the ruling; preview deployed and full workflow proven; domain live.
- **First actions:** (verify) local build/typecheck the `feat/logo-studio-mvp` branch then merge to main so the repo's default reflects the real MVP; (build) shift Prisma/Neon → shared Supabase per the ruling; (docs) planning issue + transfer ledger.
- **Gated by:** D7 answered (shared Supabase); domain [#7]; OPENAI_API_KEY.

**Kindred Connections** (`kindred-connections`) · **L** · off-Emergent exodus, owner-gated
- **State:** Live only at the leftover aligned-souls.emergent.host. Full AIPOS exodus doc pack sits unmerged on PR #1. Owner-confirmed friendship-first (dating is the separate Aligned Souls app).
- **Complete means:** off Emergent and live at your domain (Vercel + Render + shared Supabase kindred_* with RLS); all three Emergent deps decoupled preserving contracts; transfer ledger.
- **First actions:** (docs) author the transfer ledger + create the implementation issue; (build) add the missing `GET /api/health` route; (owner_decision) the 3-in-one exodus approval.
- **Gated by:** Kindred exodus bundle [#14].

**Opportunity** (`opportunity`) · **S** · a surface inside We Succeed, one decision from done
- **State:** Not standalone — live cockpit + ~11 opportunity-* routes inside We Succeed. CURRENT_SCOPE v12 already describes the front door without the name "Opportunity."
- **Complete means:** boundary decided (D2), then either docs-only registry closure (Path A, default) or extraction via a transfer ledger + domain (Path B).
- **First actions:** (docs) draft the ECO-007 boundary packet on issue #262 recommending Path A; (owner_decision) D2; (docs/verify) execute the chosen path.
- **Gated by:** D2 [#2].

**Ideas / Idea Capture** (`ideas`) · **M** · built, never deployed; same boundary as Opportunity
- **State:** A complete Emergent-generated FastAPI+Mongo notes/AI app, untouched since 2026-06-02. No clone, no domain, no deploy. Gated on the same D2/ECO-007 boundary (AppEngine already shipped conversational intake, #205).
- **Complete means:** boundary answered, then either standalone (Mongo→Supabase pivot + deploy + transfer ledger) or folded into the shared Intake module.
- **First actions:** (verify) clone read-only + produce the transfer-ledger inventory; (owner_decision) D2; (docs) reconcile registry + close #272.
- **Gated by:** D2 [#2], D7/domain if standalone.

**United Under God** (`united-under-god`) · **M** · site live; a platform decision, not a launch
- **State:** unitedundergod.org is live+healthy on WordPress + Paid Memberships Pro. In-ecosystem code is a Sprint-1 README stub. Its future role: the site reads the SAME ops collector for a public family-of-apps view — never a second dashboard.
- **Complete means:** keep-WP-vs-replatform ruled; if keep, WP stays canonical with a protective export + the family-of-apps view added; registry updated.
- **First actions:** (docs) planning issue inventorying the live WP surface + framing keep-vs-replatform; (owner_decision) platform ruling + D1; (credential) WP/hosting logins.
- **Gated by:** UUG platform + family-of-apps timing [#21], D9 [#8], D1 [#1].

**Milstead Baptist Church** (`milstead-church`) · **M** · ChurchConnect tenant, resolving via fallback
- **State:** The launch-proof tenant inside ChurchConnect; T5 gates crossed. Live at the API layer but still resolves through `configured_fallback` (0 org rows). milstead.church serves a live WordPress + WooCommerce church site (cutover, not idle domain).
- **Complete means:** real Milstead org row replaces the fallback; staff+visitor flow re-proven under Milstead branding; domain question executed without losing the live WP/store.
- **First actions:** (docs) planning issue + correct the domain block; (owner_decision) replace/subdomain/bridge + approve the org-row DB write; (build) seed the org row and re-run readiness.
- **Gated by:** Milstead Church disposition + DB write [#20], PR #12 branding [#13], D9 [#8].

### Later — needs sequencing

**Spark of Hope** (`spark-of-hope`) · **L** · four divergent expressions; code-loss risk live
- **State:** Split across a monorepo Sprint-1/2 app, a live intake-lite pilot inside we-succeed.org, and a **Codex-built MVP LIVE at spark-of-hope.vercel.app whose source commit exists in no git repo** (only copy lives inside the Vercel deploy). Vercel project disconnected from AppEngine (#258 merged). spark-of-hope.com owned, no DNS.
- **Complete means:** one canonical app (per D6) consolidating all four with nothing lost, deployed from git-tracked source, live at spark-of-hope.com.
- **First actions:** (protective) **download the READY deployment source and push it as a protective branch** to life-produces-life — pre-approved, do not redeploy; (docs) transfer ledger + Launch Pack across all four expressions; (owner_decision) D6.
- **Gated by:** D6 [#5], D9 registrar for spark-of-hope.com [#8].

**Best Life** (`best-life`) · **L** · placeholder; build forward from the stub
- **State:** Only a 241-byte README stub in the monorepo. best-life.us serves a live DreamHost WordPress placeholder ("Your Best Life") — not "nothing serving."
- **Complete means:** app profile + Launch Pack + first packet; built forward on the shared Growth model + shared Supabase; live at best-life.us; normal owner+agent review.
- **First actions:** (docs) correct the registry domain status; (docs) create the planning issue / app profile from the stub — do NOT add the ai:plan label; (owner_decision) D1 + confirm the WP placeholder is yours.
- **Gated by:** D1 [#1], "is this WP yours" [#24]; sequenced after Spark's D6 + the shared Growth model.

**Live On Mission** (`live-on-mission`) · **L** · domain-live via ChurchConnect, code-stub
- **State:** live-on-mission.com is LIVE (301 → churchconnect.cloud/mission). Only a Sprint-1 README stub. Everything forward gates on the standalone-vs-surface boundary.
- **Complete means:** either a standalone app built forward from the /mission landing on the shared spine, or the decision recorded to remain a ChurchConnect surface.
- **First actions:** (docs) planning packet with the boundary fork + Community Connections pairing; (owner_decision) boundary + matching-module + pairing; (build) the shared needs-to-helper matching packet.
- **Gated by:** LOM boundary + pairing [#19], D1 [#1], D9 Cloudflare [#8].

**Easy Peazy Website** (`easy-peasy-website`) · **M** · live, but source→production unproven
- **State:** easypeazy.site is LIVE (200) serving an Emergent-era CRA build (loads assets.emergent.sh), NOT the Website-friends repo. The repo has a stale main + two unmerged June-2026 launch branches + a third different Vite build on its Vercel homepage. No local clone.
- **Complete means:** one owner-ruled canonical codebase/name; June branches reconciled; transfer ledger; Emergent script stripped; proven repo→production path; one customer workflow verified.
- **First actions:** (docs) transfer-ledger audit across main/emergent/2 launch branches vs the live bundle; (protective) trace the real deploy host + capture deployed source if Emergent-only; (owner_decision) canonical codebase + name + Spaceship creds.
- **Gated by:** canonical + name + Spaceship [#18], D9 Cloudflare [#8], D7 [#6].

**Aligned Souls** (`kindred-dating`) · **L** · name decided, geo live; doctrine is the gate
- **State:** Planned dating app (own repo, TBD), **name DECIDED = Aligned Souls** (slug `soul-dating`). The **ECO-010 geo module is already applied + live** on the shared Supabase. Gated on the doctrine amendment (**SoT PR #19**, open); spec on AppEngine PR #283; ECO-008 connection engine still unclaimed.
- **Complete means:** doctrine-sanctioned app composed (not recreated) from ECO-008 + ECO-010 + Kindred's Knowing/Posture/Identity/Forgiveness surfaces per merged PR #283; core match workflow proven; Kindred stays friendship-first.
- **First actions:** (build) claim ECO-008 + produce the connection-module extraction packet from Kindred; (owner_decision) amend doctrine via **SoT PR #19**; (docs) after the amendment, merge PR #283 and rename artifacts to Aligned Souls. *(Do NOT re-apply ECO-010 — it is DONE.)*
- **Gated by:** Doctrine amendment PR #19 [#11], domain [#7 / #8], Vercel Hobby if paid [#10].

**Community Connections** (`community-connections`) · **L** · concept-only; assembly of shared engines
- **State:** Registry-only concept (no repo/code/domain), the less-faith-forward sibling of Live On Mission; Milstead named as first community. Doctrine treats it as configs of one shared Needs-to-Helper Matching module + the Kindred engine.
- **Complete means:** deployable community platform assembled from shared engines (ECO-008 + matching + ChurchConnect events) on shared Supabase, first live for Milstead at milstead.us.
- **First actions:** (docs) planning issue capturing the SoT definition + Milstead-first scope + module-reuse constraint; (verify) correct the milstead urlStatus (serves WP); (owner_decision) D1 + Milstead-first order + ECO-008 claim.
- **Gated by:** D1 [#1], LOM pairing [#19], ECO-008 sequencing.

**Milstead Community Platform** (`milstead`) · **L** · concept-stage; first config of Community Connections
- **State:** No repo/code. milstead.us (Spaceship, expires 2027-01-09) serves a live WordPress "Milstead Village" stub on LiteSpeed — registry wrongly says "nothing serving." Distinct from milstead.church.
- **Complete means:** live at milstead.us as the first configured Community Connections instance (absorbing the WP stub without content loss), proven community workflows.
- **First actions:** (verify) read-only inventory of the WP stub; (docs) correct the registry domain block + note the 2027-01-09 expiry; (docs) planning issue tying Milstead to Community Connections.
- **Gated by:** Community Connections sequencing, D1 [#1], D9 host logins [#8].

**Honestly** (`honestly`) · **L** · mined source, not a running product
- **State:** A private Emergent-handoff repo (care-case / counselor-notes / video-recorder surfaces), no clone, no deploy, no domain. Board disposition = MODULE / MERGE_SOURCE; ChurchConnect has no care-case surfaces today (additive, not a rebuild).
- **Complete means:** boundary ruled (default: ChurchConnect care module), transfer ledger, care surfaces ported to the churchconnect Supabase schema with an explicit pastoral-data isolation + video-storage model.
- **First actions:** (docs) planning issue capturing the boundary + full surface inventory (incl. AdminDashboard/QuickRecord the audit missed); (build) draft the transfer-ledger skeleton read-only; (owner_decision) boundary + pastoral-data ruling.
- **Gated by:** Honestly boundary + data model [#22], D1 [#1] (indirect).

**Million Mistakes** (`million-mistakes`) · **S** · principle/brand; one decision from a definition of done
- **State:** README-only repo ("mistakes = growth"), no code/domain/deploy. Registry says "not a standalone app"; your same-day statement says it IS app #20 awaiting a URL — an unresolved contradiction.
- **Complete means:** if content-source, principle captured in a durable doc wired into Best Life/Opportunity (no build); if standalone, domain + AIPOS profile + normal build.
- **First actions:** (docs) planning issue posing standalone-vs-content-source with both statements — do NOT add ai:plan; (owner_decision) the identity question; (docs) correct the internally-inconsistent registry state.
- **Gated by:** Million Mistakes identity [#23], D8 domain if standalone [#7].

### Park — reference / config / not a standalone build

**ChurchConnect Bridge** (`churchconnect-bridge`) · **M** · monorepo planning module, stale mapping
- **State:** A Sprint-1 ~80-line TypeScript mapping placeholder in the monorepo (no runtime/UI/deploy). Its lpl_* targets are stale — the T5-proven live path writes to person/organization/ecosystem_event + churchconnect schema. Never needs a domain.
- **Complete means:** owner rules repurpose (legacy Mongo backfill tool, re-targeted to the canonical schema) vs archive-as-superseded; registry moves off "planned."
- **First actions:** (docs) planning issue recording the T5 reality + stale-target finding + repurpose-vs-archive question; (owner_decision) bridge fate + canonical identity model.
- **Gated by:** D1 [#1], identity-model + bridge-fate [#22-adjacent], D7 for the paid-account slice [#6].

---

*Generated 2026-07-04 from the portfolio registry (24 apps), verified read-only + adversarial pass; docs only.*
