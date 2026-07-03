# Loop run — churchconnect schema APPLIED to production (T5 gate b)

- **Date:** 2026-07-03 (night)
- **Agent:** Claude Code
- **Authorization:** Lincoln — the single word **"apply"**, approving the staged schema-apply packet (delivered same day in `loop-runs/2026-07-03-churchconnect-readiness.md` / the session's readiness package), including the recommended hardening addendum.
- **Board item:** TRANSFER T5, gate (b)
- **Target:** Supabase project `uqhqulrqcygsmmzdzemx` (Life Produces Life, production)

## Migrations applied (tracked, in order)

1. **`churchconnect_slice_v1_0`** — verbatim `life-produces-life/db/0002_churchconnect_slice__DRAFT.sql`: `churchconnect` schema; tables `event`, `event_publication`, `publication`, `communication_preference`, `communication_send`; 7 indexes; RLS + 10 policies on the `private.is_org_admin/is_org_member/current_person_id` helpers; `publish_event(uuid)` SECURITY DEFINER fan-out (website + bulletin + email + `public.ecosystem_event` activation rows).
2. **`churchconnect_fanout_v1_0`** — verbatim `db/0003_churchconnect_fanout__DRAFT.sql`: `event.external_event_id` + partial unique idempotency index; `publication_artifact` table + RLS + 2 policies.
3. **`churchconnect_harden_publish_event_v1_0`** — REVOKE EXECUTE on `publish_event` from public/anon/authenticated (closes the SECURITY DEFINER default-EXECUTE hole).
4. **`churchconnect_publish_event_service_grant_v1_0`** — explicit GRANT to `service_role`. *Deviation caught in verification:* the REVOKE from PUBLIC also removed service_role's implicit access; the approved packet stated service_role keeps execution, so it was restored explicitly. anon/authenticated remain revoked.

## Verification (all pass)

- `churchconnect` schema: exactly **6 tables**, every one `rls_enabled`, all **0 rows**.
- **12 RLS policies** — note: the packet's verification step said 13; the source SQL defines 12 (10 + 2). The packet's own inventory text also miscounted ("11" while listing 10). 12 is correct against the approved files.
- `event.external_event_id` present; `event_org_external_ux` + `publication_artifact_event_idx` present.
- `publish_event`: `prosecdef=true`; EXECUTE — authenticated **false**, anon **false**, service_role **true**.
- Security advisors: 69 lints, **zero** attributable to `churchconnect.*` (all pre-existing legacy-baseline findings on public.* maker tables).
- Readiness probe identical pre/post: `ready:true, configured:true, expectedTarget/targetShape: life_produces_life`.
- Staff follow-up path re-verified live post-DDL: authenticated GET returns **6** follow-ups (one more than this morning — organic traffic), proof record `f1abb897…` still `contacted`.

## Rollback (unused, on record)

`drop schema churchconnect cascade;` — clean boundary, shared tables untouched. Plus optional `delete from supabase_migrations.schema_migrations where name in (…the four names…)`.

## Follow-ups (small, non-blocking)

1. Relabel `db/0002`/`db/0003` DRAFT headers in the source-of-truth repo (branch `churchconnect-slice-event-fanout`; SoT PR #17 also still open for Lincoln).
2. ChurchConnect backend: followups endpoint emits raw newlines inside JSON strings (strict parsers reject) — flagged to the ChurchConnect track.
3. Render backend needs `CC_PG_DSN` set before the fan-out endpoints go live (activation prerequisite noted in the packet).

## T5 status after this run

**All three gates crossed** (a: walkthrough proven · b: schema applied · c: PR cleanup done). Closing T5 fully = executing the in-repo ChurchConnect transfer ledger feature-by-feature to `transferred_proven` — the ChurchConnect track (active branding session + #12) carries that forward.
