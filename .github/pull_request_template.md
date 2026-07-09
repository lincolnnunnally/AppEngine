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

## Owner surface needed? (authority model, 2026-07-09)
<!-- Merges to `main`, deployments (incl. production), and database changes are AUTONOMOUS —
     engineering replaces approval: backup before destructive DB ops, reversible deploys,
     end-to-end verification, then report. Surface to Lincoln ONLY the three items below. -->
- [ ] Money — new paid service, plan upgrade, or purchase (`paid-resource`)
- [ ] Credential only Lincoln can create (account API key, OAuth app, registrar/DNS login, Stripe/email account)
- [ ] Mission / philosophy / doctrine / product-direction change (ask Lincoln — never invent it)
- [ ] None of the above — merge, deploy, and verify autonomously once QA passes
