# Spark of Hope Publish Pipeline

This document records the reusable App Engine publish path for taking a generated
app from a reviewed prototype to a live product. It is written from the Spark of
Hope Phase A run so later apps can repeat the same checks without relying on chat
memory.

## Current Status

- App: Spark of Hope MVP v0.1
- Repo: `lincolnnunnally/AppEngine`
- App Engine route: `src/app/spark-of-hope`
- Dedicated Vercel root: `apps/spark-of-hope`
- Branch: `codex/task-54-spark-of-hope-mvp`
- PR: `#174`
- Database lane: shared Life Produces Life Supabase
- Supabase ref: `uqhqulrqcygsmmzdzemx`
- Supabase org: `Realize Org`
- Production: promoted on Vercel; custom domain attached in Vercel and awaiting
  DreamHost DNS cutover
- Vercel project: `spark-of-hope`
- Vercel project id: `prj_wlWPHmI2hhKb13VE4fQIBM8KeRTA`
- Production deployment: `https://spark-of-hope.vercel.app`
- Deployment id: `dpl_AuauaYL2UJuJCeyAQUmbgzjxqaKe`
- Custom domain: `spark-of-hope.com`

Production promotion is complete for the public Vercel URL. The custom domain
is assigned to the Spark project in Vercel, but `spark-of-hope.com` still
resolves to DreamHost/WordPress until DNS is updated.

## Phase A Gate

Phase A may start only after the shared Supabase schema PR is merged in the
source-of-truth repo. For this run, that was PR `#9` in
`life-produces-life-source-of-truth`.

Before code changes:

1. Confirm the source-of-truth PR is merged.
2. Confirm the Spark issue/PR is the claimed work packet.
3. Confirm the target database is DEV, not production.
4. Confirm `service_role` credentials are never exposed to browser code.

## Phase A Implementation

1. Wire the Spark route to the shared Life Produces Life DEV Supabase URL and
   anon key through environment variables.
2. Keep the Supabase service role server-side only, and only use it in scripts
   or server-owned verification paths.
3. Remove the user-facing setup wall once env vars are present.
4. Add warm fallback states for signed-out, empty feed, and recoverable errors.
5. Match the approved warm/calm visual direction:
   - Spark of hope header only, with flame icon and tagline.
   - Phone-first layout.
   - Warm light-in-darkness / campfire visual tone.
   - Deep warm-dark page background with glowing amber spark accents.
   - Welcome/intake doorway before the feed: free text plus feeling chips.
   - Curated compassion reflection per feeling; no live AI response generation.
   - Theme-matched testimonies use `needs_categories`, not random story choice.
   - Acute-crisis wording routes to a gentle 988 support panel instead of stories.
   - Testimonies carry the visual hierarchy; login stays secondary.
   - Serif story text and clean sans UI text.
   - "Encourage" language, not "like".
   - Bottom nav: Hope, Share, You.
6. Add the required safety affordance:
   - One gentle bottom support line with 988 and "not monitored" language.
   - Simple report/flag affordances for stories and encouragements.
7. Enforce the review gate in DEV:
   - New testimonies default to private, unapproved, and anonymous.
   - Public feed reads only approved public Spark stories.
   - Encouragement notes are private until approved.
   - Public author labels do not derive from email.
   - Theme matching reads `needs_categories` so feeling filters are real, not random.

## Phase A Verification

Run these checks before asking for review:

1. `npm run source:check`
2. `npm run typecheck`
3. `npm run smoke:spark-of-hope-mvp`
4. `npm run smoke:spark-approved-preview`
5. `npm run smoke:spark-reminder-lite`
6. `npm run smoke:spark-public-trial-readiness`
7. `npm run smoke:spark-review-queue-lite`
8. `npm run build`
9. Verify DEV Supabase has Spark migrations `001` through `005` applied.
10. Verify the Vercel preview route loads the Spark UI, not an App Engine shell
    or setup-needed screen.

For this run, the verified preview route was:

`https://app-engine-q8bxz7b42-lincolnnunnallys-projects.vercel.app/spark-of-hope`

## Production Promotion Gate

Do not promote Spark until all of these are true:

1. Lincoln approves Phase A.
2. Lincoln approves production go-live.
3. The production shared Supabase URL and anon key are provided.
4. The service role key is stored only in server-side Vercel environment
   variables if needed.
5. The custom domain DNS path is ready for `spark-of-hope.com`.

## Production Promotion Steps

When go-live is approved:

1. Create a dedicated Vercel project for Spark of Hope.
2. Set the Vercel root directory to the Spark app folder or configured export
   target used for this generated app.
3. Add production environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - server-only service credentials only if required by the deployed app
4. Deploy the dedicated project.
5. Attach `spark-of-hope.com`.
6. Verify DNS and TLS.
7. Health-check the live route.
8. Confirm the public URL loads Spark of Hope, not App Engine and not setup
   needed.
9. Record the launch in `generated_app`:
   - repo/folder
   - Vercel project id
   - domain
   - database = shared
   - deployment URL
   - status = live

## 2026-06-19 Promotion Attempt

Completed:

1. Created `apps/spark-of-hope` as the dedicated deployable Spark root.
2. Created the Vercel project `spark-of-hope`
   (`prj_wlWPHmI2hhKb13VE4fQIBM8KeRTA`).
3. Confirmed the free-text doorway includes acute-crisis triage before stories.
4. Confirmed local standalone checks pass:
   - `npm run typecheck`
   - `npm run build`
5. Confirmed repo checks pass:
   - `npm run source:check`
   - `npm run typecheck`
   - `npm run build`
   - Spark smoke checks

Stopped before production env/deploy because the production Supabase target
needs final confirmation. Earlier work used `uqhqulrqcygsmmzdzemx` as the Life
Produces Life DEV project, while the go-live instruction says production should
use the Life Produces Life Pro spine. Do not set production env vars, deploy,
attach `spark-of-hope.com`, or mark `generated_app.status = live` until the
production project URL and public key are confirmed.

## 2026-06-19 Phase B Go-Live

Completed:

1. Verified `uqhqulrqcygsmmzdzemx` is the `Life Produces Life` Supabase project,
   active/healthy, and now under `Realize Org` by CLI. The CLI confirmed the org
   move; plan details were not exposed through this session's CLI output.
2. Set Vercel production env vars on `spark-of-hope`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   No service-role key was added to Vercel because the Spark app does not need a
   server-side route for v0.1.
3. Fixed the Vercel project framework preset from `Other` to `Next.js` after the
   first production build completed but failed on the generic `public` output
   directory setting.
4. Deployed production:
   - deployment id: `dpl_AuauaYL2UJuJCeyAQUmbgzjxqaKe`
   - Vercel URL: `https://spark-of-hope-nie2sj2tx-lincolnnunnallys-projects.vercel.app`
   - public alias: `https://spark-of-hope.vercel.app`
5. Disabled SSO deployment protection on the Spark Vercel project so the public
   product URL is reachable without Vercel authentication.
6. Removed stale `spark-of-hope.com` and `www.spark-of-hope.com` project-domain
   assignments from the `app-engine` Vercel project, then added both domains to
   the `spark-of-hope` project.
7. Verified browser-visible production behavior at `https://spark-of-hope.vercel.app`:
   - landing/header loads as Spark of hope, not App Engine
   - setup-needed state is gone
   - feeling doorway renders
   - choosing `Lonely` shows the matched reflection and filtered testimony state
   - free-text acute crisis input shows the gentle 988 support branch and hides stories
   - safety support line is visible
8. Verified server-side data paths with temporary rows, then cleaned them up:
   - private in-review testimony submission shape
   - encouragement insert shape
   - report insert shape
9. Removed the three `[DEV sample]` public testimonies from the production/shared
   project. The public feed now shows the warm empty state until real approved
   stories are added.
10. Upserted `generated_app` record:
   - `provisioning_slug = spark-of-hope`
   - `deployment_url = https://spark-of-hope.vercel.app`
   - `status = live`
   - launch details and DNS caveat recorded in `problem_summary`

Remaining DNS action:

`spark-of-hope.com` and `www.spark-of-hope.com` are attached to the Spark Vercel
project, but public DNS still resolves to DreamHost/WordPress. Update DreamHost
DNS to point to Vercel:

- Apex: `A spark-of-hope.com 76.76.21.21`
- `www`: use Vercel's recommended record in the domain dashboard, or switch the
  domain nameservers to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.

Until that DNS change propagates, the live public Spark URL is:

`https://spark-of-hope.vercel.app`

## Non-Negotiables

- No production database changes without Lincoln approval.
- No paid-resource changes without Lincoln approval.
- No destructive database action from this pipeline.
- No service-role key in browser code, client bundles, PR comments, or docs.
- No production cutover from a stale Vercel preview alias.
