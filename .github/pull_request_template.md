<!-- Every finished task becomes a PR. No loose pasted work. One board item → one branch → one PR. -->

## What this does
Closes #<!-- issue number -->

<!-- One or two sentences on the change. -->

## Source of truth read
<!-- App Engine is the FACTORY. It consumes the philosophy and never invents it.
     The canonical docs live in the separate `life-produces-life` repo. -->
- [ ] I read `life-produces-life/_SOURCE_OF_TRUTH/00_LIFE_PRODUCES_LIFE__MASTER.md` (the mission) and this work aligns with it
- [ ] I read `life-produces-life/_SOURCE_OF_TRUTH/03_APP_ENGINE__SOURCE_OF_TRUTH.md` (scope, agents, boundaries) and `04_ORCHESTRATION.md` (checkout rules)
- [ ] I claimed the linked issue, and this is **one branch → one PR** (didn't edit outside my item)
- [ ] **I verified I'm not duplicating or overwriting existing work — checked naming variations** (e.g. `AppEngine` vs `app-engine`, route groups vs flat routes)
- [ ] I did **not** invent or change mission/philosophy (if it needed changing, I asked Lincoln)
- [ ] This builds **connected, not siloed** where relevant (shared Supabase identity for ecosystem apps; isolated Neon for customer apps — see `03_APP_ENGINE` §7–8)

## Files touched
<!-- List them, so reviewers can spot collisions. -->

## Verification run
<!-- Paste the command(s) and result — e.g. `npm run typecheck`, `npm run build`, and the browser/console check. -->

## QA gate (definition of done)
- [ ] Primary workflow works; app builds without errors (`npm run build`) and `npm run typecheck` passes
- [ ] Browser/console checks clean for affected surfaces
- [ ] Empty / loading / error states exist for core workflows
- [ ] Migrations repeatable; required env vars listed (if applicable)
- [ ] Auth / role / protected-route rules specified where relevant

## Lincoln approval needed before merge?
<!-- Lincoln approves merges to `main`, deployments, database changes, and any paid/external resources. -->
- [ ] Merge to `main`
- [ ] Deployment (`deploy`)
- [ ] Database change (`db-change`)
- [ ] Paid / external resource (`paid-resource`)
- [ ] None of the above — safe to merge once QA passes
