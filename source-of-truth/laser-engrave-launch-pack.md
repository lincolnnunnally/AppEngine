# Laser Engrave Market — Launch Pack

Clears the two blockers named in the deployment queue ("Launch Pack and proof
artifact contract missing"). Created 2026-07-02 as part of the first Claude Code
pipeline pass; prior-work gate verdict: **extend_existing**
(`loop-runs/run-laser-2026-07-02-prior-work-check.json`).

## App facts

- **Repo:** `lincolnnunnally/LaserEngraving` (private; local clone at
  `Project_Code/LaserEngraving`). Vite + React 18 + TypeScript frontend.
- **Data:** Supabase (50 migrations incl. maker marketplace system, orders,
  product mockups). The FRONTEND does not use supabase-js directly — it calls a
  backend via `VITE_BACKEND_URL` (safe fallback to same-origin when unset).
- **Build proof:** `npm install && npm run build` → passed 2026-07-02
  (chunk-size warnings only, consistent with the 2026-06-27 audit).
- **Preview:** static `dist/` deployed to the `laser-engrave-market` Vercel
  project (preview target, publicly viewable). The UI is fully testable;
  data actions need the backend (below).

## Environment contract

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_BACKEND_URL` | frontend build | Points the UI at the FastAPI backend (Render). Unset = same-origin `/api` (renders, data actions 404). |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | frontend build | Direct supabase-js use in canvas/template/share components (RLS-protected). |
| Supabase URL + service key | backend (Render) | Backend data access after the Mongo→Supabase pivot completes. |
| `JWT_SECRET` etc. | backend (Render) | Per backend/.env contract (see backend/server.py). |

## Decisions (owner + technical, 2026-07-02)

- **Database (owner ruling):** ALL of Lincoln's ecosystem apps live on the
  consolidated shared Supabase ("Life Produces Life",
  `uqhqulrqcygsmmzdzemx`). Only customer-created AppEngine apps get their own
  database (auto-Neon, already implemented). **Collision audit passed:** Laser's
  52 migration tables (maker_*, product_*, design_*, machine_*, …) have ZERO
  name overlaps with the 41 existing shared tables (lpl_*, person, testimony,
  growth_*). Safe to apply as-is.
- **Backend placement (technical call, standing standard):** NEW/generated apps
  are full-stack on Vercel (one project, API routes — already the AppEngine
  pattern). EXISTING FastAPI backends (ChurchConnect, LaserEngraving) deploy to
  Render with the frontend on Vercel — the proven ecosystem pattern; we do not
  rebuild working Python. Render free tier note: services sleep when idle
  (first request after idle is slow) — acceptable for review, revisit for
  production traffic.
- **Discovered architecture reality:** LaserEngraving is MID-PIVOT between two
  data stories. `backend/` is FastAPI + **MongoDB** + JWT (Emergent-era);
  the 52 Supabase migrations + direct supabase-js use in the canvas/template
  components are the NEWER direction. Completion = finish that pivot:
  the backend's auth/data moves to the shared Supabase (destination schema
  already exists as migrations); MongoDB is retired for this app.

## Pivot completed 2026-07-03 (Claude Code run)

**Database (done).** All 50 repo migrations applied to the shared LPL Supabase
(`uqhqulrqcygsmmzdzemx`) via the Management API, each recorded in
`supabase_migrations.schema_migrations`. Two reconstructed baseline migrations
were applied first (`20251129000000_baseline_core_tables`,
`20251129000001_baseline_core_functions`) — products/orders/customers/
customizations + `generate_order_number`/`update_updated_at_column` predate the
snapshot set and no migration created them. Per-file safety modifications on
the shared DB (originals preserved in the repo; ledger notes the shims):

- `20251201151633`: auth.users trigger NOT installed (would fire for every
  ecosystem app's signups; laser roles are granted explicitly instead).
- `20260112001456` (pg_cron email job) + `20260307000012` (dead storage.policies
  API) + `20260307000019/20` (failed historical attempts superseded by `…21`):
  recorded as no-ops.
- `20260307000002/3/4`: hardcoded SMTP password **blanked** before insert
  (set real SMTP creds via the admin email-config UI or backend env).
- `20260307000001`: shimmed to `orders.priority` only — it collided with the
  pre-existing messages table exactly as it did historically; `…0003` recreates
  everything else.

Post-migration repairs (new migrations on the shared DB):
`laser_shared_db_rls_hardening` (dropped 16 permissive `USING (true)` policies —
coupons/design_assets/platform_settings/conversations/payment_transactions/
email_queue were writable by ANY authenticated user of ANY app on the shared
project, payment_transactions even by anon), `laser_fix_runtime_broken_triggers`
+ `laser_drop_remaining_email_notification_triggers` (six email triggers
referenced nonexistent `customer_products.product_name/order_id` or
unreadable `auth.users` — they aborted order inserts, status updates, and
review inserts at runtime; backend owns email delivery),
`laser_rest_contract_additive_columns`, `laser_get_user_id_by_email_fn`.
Zero changes to lpl_*/person/testimony/growth_* (verified before/after).

**Backend (done, deploy pending).** Ported from MongoDB/JWT to the shared
Supabase on branch `laser/supabase-pivot-complete`
(lincolnnunnally/LaserEngraving PR #1): supabase-py service-role data access,
credentials in Supabase Auth + `user_roles`, files on Supabase Storage, official
`stripe` lib, new `/api/mockups` proof surface, `MakerMockupGenerator` ported
off the supabase-js stub, requirements 141→10 deps, `render.yaml` blueprint.
The JWT/cookie REST surface is byte-compatible — zero frontend auth changes.

**E2E verified 2026-07-03** (local backend + real shared Supabase + browser UI):
sign-up, sign-in, products list with the real Hobby Lobby catalog, customize →
checkout → order with proof data (preview image + regenerable customizations
jsonb), file upload/download roundtrip, maker onboarding + mockup
create/set-primary (public storage URL), admin assign → maker ship → customer
review (duplicate blocked, maker aggregates update), admin stats/whitelabel.
Admin `lincoln@unitedundergod.org` seeded (password in run summary, never
committed; seed never resets an existing shared-auth user's password).

## Remaining before production

1. **RENDER_API_KEY (owner):** not present anywhere on this machine (checked
   ChurchConnect setup and `~/Documents/Codex/private-env`). With it, create the
   free `laser-engrave-api` web service from `render.yaml` and set the secret
   env slots. The redeployed Vercel preview already points at
   `https://laser-engrave-api.onrender.com`, so no frontend rebuild is needed
   if that service name is available.
2. **STRIPE_API_KEY (owner):** live checkout; payments endpoints 503 cleanly
   until set.
3. Re-run the E2E flows against the deployed preview once Render is up
   (Lincoln's preview standard), then owner approval promotes it.

Preview (UI live now; data actions activate with the Render service):
https://laser-engrave-market-mlqzie6f9-lincolnnunnallys-projects.vercel.app

## Proof artifact contract (the `proof-approval-artifact` block)

Source of truth: `supabase/migrations/20251228002319_create_product_mockups.sql`
(+ marketplace/orders migrations). Contract:

- A **proof** is a `product_mockups` row: `image_url` (rendered proof) +
  `mockup_data` (jsonb: text, position, font — enough to REGENERATE the exact
  proof) + `is_primary`.
- **Approval** must be recorded immutably before production: order linkage +
  approved-at timestamp + the exact proof image/data approved. Approving a
  changed proof requires a NEW record — never mutate an approved one.
- **Acceptance tests:** (1) customer can view the proof for their order;
  (2) approval writes the immutable record; (3) production state is reachable
  only from an approved proof; (4) RLS: makers manage their own mockups,
  buyers read proofs for their orders only.
- Reuse note (module catalog): this block is the mined `proof-approval-artifact`
  — one home; other apps consume it, never re-implement it.
