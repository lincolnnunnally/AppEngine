# Loop run — ChurchConnect staff walkthrough PROOF (T5 gate a) + Live On Mission domain correction

- **Date:** 2026-07-03 (night)
- **Agent:** Claude Code
- **Authorization:** Lincoln — provided the credential fact ("the Lincoln@milstead.church password is the super-admin password from the Render env") and said "please proceed with what you need to do."
- **Board item:** TRANSFER T5, gate (a)

## The proof (production, API layer)

1. **Sign-in:** `POST https://api.churchconnect.cloud/api/auth/signin` as `Lincoln@milstead.church` → HTTP 200, `access_token` issued. (Password = the value of `SUPER_ADMIN_DEFAULT_PASSWORD` from the local `churchconnect-backend.env`; the secret value appears nowhere in logs, docs, or this record.)
2. **Authenticated inbox read:** `GET /api/churchconnect/church/milstead-church/visitor-followups` with Bearer token → 5 follow-up records, including both June Step-5 proof IDs (`f1abb897-…`, `16d9dbe6-…`), all status `new`.
3. **Staff update:** `PATCH /api/churchconnect/visitor-followups/f1abb897-5c01-4de4-8cbc-7b4e05638d96` `{status:"contacted", note:"Staff walkthrough proof - Claude Code for Lincoln, 2026-07-03"}` → HTTP 200 `{success, followup}`.
4. **Persistence:** re-GET → the record now reads `status:"contacted"` on the shared-Supabase path. **Fail-closed confirmed earlier** (unauthenticated → 401).

**Verdict: the visitor-registration → staff-follow-up loop is proven end-to-end on production with real staff auth.** The UI layer was E2E-verified the same day by the parallel auth-audit session after PRs #13–#16 fixed the stale-bundle/localhost bake; Lincoln's own sign-in trouble predated those fixes.

## Bug found (minor, ChurchConnect backend)

The visitor-followups endpoint emits raw control characters (newlines) inside JSON string values (`notes` field) — technically invalid JSON; strict parsers reject it. Fix: JSON-escape or sanitize notes on serialization. Left for the ChurchConnect track (active session) — not fixed here to avoid colliding.

## Live On Mission domain correction (owner)

Lincoln corrected the domain: **live-on-mission.COM** (his earlier ".org" was a slip — .org is unregistered). Verified: Cloudflare-fronted, `301 → https://churchconnect.cloud/mission` (200) — a polished dark landing ("People Are Counting On Us", acts-of-kindness stats) already built inside ChurchConnect. Registry domain block + url-status smoke updated in this PR (.org → .com, awaiting_url → live). Lincoln's styling verdict on that page — warm, modern, authoritative, "trust is probably the greatest goal of styling" — is recorded as the design bar.

## Remaining on T5

Only gate (b): Lincoln's word "apply" for the 3-migration schema packet (+ yes/no on the publish_event REVOKE hardening). Everything else on the ChurchConnect critical path is done or in the active branding session's hands (#12).
