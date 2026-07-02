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
| `VITE_BACKEND_URL` | frontend build | Points the UI at the backend API. Unset = same-origin `/api` (renders, data actions 404). |
| Supabase URL + service key | backend service | The backend owns all Supabase access (RLS per migrations). |

## Remaining before production

1. **Backend placement decision (owner):** stand up/point the backend API the
   frontend expects, then rebuild with `VITE_BACKEND_URL` set.
2. **Database placement decision (owner):** which Supabase project hosts the
   50-migration schema (per ecosystem DB placement rules).
3. Proof acceptance tests (contract below) wired as smoke checks.
4. Owner approval promotes the tested preview (standard approve step).

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
