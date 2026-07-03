# Auth Unification Decision — DRAFT (needs Lincoln's ratification)

Status: **DRAFT — owner decision required.** Written 2026-07-03 from the
ecosystem auth audit (23-agent adversarially-verified run) after Lincoln
reported login failures across multiple apps. This page proposes; it does not
ratify. Nothing here changes behavior until Lincoln approves.

## Why this page exists

Two ratified documents currently contradict each other:

- `identity-auth-standard.md` defaults every app to **Auth.js + app-scoped
  Postgres** (its own user store per app).
- `ecosystem-database-foundation.md` + `appengine-build-standards.md` §3 say
  ecosystem apps share the **LPL Supabase** ("Lincoln's ecosystem apps live on
  the shared Supabase (Life Produces Life identity/data)").

Because each app picked whichever standard fit its history, the live estate has
**three identity substrates** and Lincoln has **6+ accounts across 3 stores**:

| App | Identity store today | Lincoln's account state (2026-07-03) |
| --- | --- | --- |
| We Succeed (factory) | NextAuth + Neon Postgres (GitHub OAuth only live) | lincoln.nunnally@gmail.com — works, resolves `owner` |
| ChurchConnect | Emergent-era Mongo (custom JWT backend) | lincoln@unitedundergod.org exists, password hash doesn't match (fix branch pending); 4 legacy accounts also sit unused in its old Supabase project |
| Laser Engrave | Shared LPL Supabase Auth + laser `user_roles` | lincoln@unitedundergod.org — seeded + verified 2026-07-03 |
| Spark of Hope | Shared LPL Supabase Auth (email+password) | only a gmail account from 2026-06-20; no reset path; shared project has no SMTP |
| Generated apps | Auth.js + per-app Neon (per identity-auth-standard) | n/a (template) |

The consequences observed live: no password-reset or confirmation email can be
delivered by the shared LPL project (no custom SMTP; `site_url` points at one
app), `lpl_profiles` has 0 rows for 6 auth users (the foundation's auto-profile
contract is unimplemented — no `handle_new_user` trigger), and the module
catalog's `identity-auth` block still points at ChurchConnect's Python
phone-OTP backend as the "one home" although nothing was ever extracted.

## Proposed decision (for ratification, not assumed)

1. **One ecosystem identity**: the shared LPL Supabase Pro project's
   `auth.users` is the canonical account store for Lincoln-owned ecosystem
   apps. Laser Engrave already works this way; Spark is already there.
2. **Canonical owner identity**: Lincoln declares ONE canonical email
   (proposal: `lincoln@unitedundergod.org`, per the "admin on every app"
   standard), with `lincoln.nunnally@gmail.com` linked/aliased where OAuth
   providers force it. Every app's owner/admin seed uses the canonical email.
3. **Shared auth infrastructure minimums** on the LPL project:
   - custom SMTP (e.g. Resend) so confirmation + recovery emails deliver;
   - per-app redirect URLs in `uri_allow_list`;
   - the `handle_new_user` → `lpl_profiles` auto-profile trigger from
     `ecosystem-database-foundation.md` (SQL drafted below, NOT applied).
4. **We Succeed exception, explicitly scoped**: the factory keeps
   NextAuth+Neon for now (it works, and its operator surface is
   fence-critical); migrating it onto shared identity is a separate decision.
5. **Generated customer apps stay app-scoped** (customer data isolation) —
   unchanged from identity-auth-standard.
6. `identity-auth-standard.md` and the module-catalog `identity-auth` entry are
   updated to match whichever way Lincoln rules (catalog edits belong to the
   Codex track).

## Drafted (NOT applied) — auto-profile contract for the shared project

```sql
-- Implements ecosystem-database-foundation.md's auto-profile contract.
-- OWNER APPROVAL REQUIRED before applying: this installs a trigger on
-- auth.users on the SHARED project, firing for every app's signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  insert into public.lpl_profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
-- + backfill: insert into lpl_profiles (...) select ... from auth.users u
--   where not exists (select 1 from lpl_profiles p where p.user_id = u.id);
```

## Open questions only Lincoln can answer

1. Ratify shared-LPL identity as the default for ecosystem apps? (yes/no/variant)
2. Canonical owner email: `lincoln@unitedundergod.org`?
3. Approve Resend (free tier) as the shared project's SMTP, and which FROM
   address? (DreamHost SMTP creds exist as an alternative.)
4. Approve the auto-profile trigger + backfill above on the shared project?
5. ChurchConnect's 8 Mongo users: migrate into shared identity when its data
   pivot lands, or keep separate until then?
