# Ecosystem database foundation (Supabase)

**Goal:** Stand up a NEW Supabase project as the shared home for the AppEngine engine and the *Life Produces Life* ecosystem — with Supabase Auth (shared users) and a clean schema derived from the proven needs-and-gifts matching design already built in ChurchConnect.

**This step only creates the new database and its schema.** It does NOT wire the AppEngine repo to it (that is a separate, later step), and it does NOT touch the existing ChurchConnect database.

---

## Guardrails (non-negotiable)

1. **Create a brand-new Supabase project.** Suggested name: `life-produces-life`. Free tier is fine.
2. **Do NOT touch the existing "ChurchConnect" project** (id `dzxipsskcrvbtvzekbgz`) in any way — no querying, no modifying, no deleting. The reusable design has already been extracted into this spec; you do not need to read the old project.
3. **Enable Row Level Security (RLS) on EVERY table**, each with explicit policies. The old ChurchConnect database had RLS *disabled* on several tables (a real exposure) — do not repeat that. No table ships without RLS.
4. **Use Supabase Auth as the identity provider.** All person records link to `auth.users` through a `profiles` table.
5. **Do NOT change the AppEngine repo or any application code in this step.** Database only.

---

## Schema

Derived and generalized from ChurchConnect's `person_needs`, `person_strengths`, `needs_matching`, `needs_growth_tracking`, `testimonies`, `community_members`, `person_relationships`, and `needs_categories` tables — broadened from a single-church model to the wider ecosystem (no `church_id` scoping; people belong to the ecosystem, optionally to communities).

Use `uuid` primary keys (default `gen_random_uuid()`), `timestamptz` timestamps defaulting to `now()`, and add `updated_at` triggers where noted.

### profiles
Extends Supabase Auth. One row per user; this is the shared identity across the whole ecosystem.
- `id uuid` PK, references `auth.users(id)` on delete cascade
- `full_name text`, `email text`, `phone text`
- `city text`, `state text`, `zip_code text`, `latitude numeric`, `longitude numeric`
- `bio text`, `life_stage text`, `interests text[]`, `looking_for text`
- `is_active boolean default true`, `last_active_at timestamptz`
- `created_at`, `updated_at` (trigger)

### need_categories
Taxonomy of need / problem areas.
- `id uuid` PK, `category text not null`, `subcategory text`, `description text`, `icon text`, `created_at`

### person_needs
What a person is facing (their needs / the problems they carry). Generalized from the church version — a clean category + area + scores model rather than dozens of fixed booleans.
- `id uuid` PK, `person_id uuid` → `profiles(id)`
- `category_id uuid` → `need_categories(id)` (nullable), `title text`, `description text`
- `area text` (one of: physical, social_emotional, economic, educational, spiritual, practical)
- `overall_need_level text`, `need_score int`, `receptiveness_level text`, `privacy_level text default 'private'`
- `is_urgent boolean default false`, `status text default 'active'` (active / matched / resolved)
- `created_at`, `updated_at` (trigger)

### person_strengths
What a person can offer — gifts, skills, character, availability. The "everyone is built different" side.
- `id uuid` PK, `person_id uuid` → `profiles(id)`
- `spiritual_gifts text[]`, `natural_talents text[]`, `professional_skills text[]`, `life_experiences text[]`
- `can_mentor boolean`, `can_offer_hospitality boolean`, `can_offer_practical_help boolean`
- `character_traits text[]`, `availability text`, `notes text`
- `created_at`, `updated_at` (trigger)

### opportunities
A problem or vision someone wants to see solved — the bridge between the engine's intake and the ecosystem.
- `id uuid` PK, `created_by uuid` → `profiles(id)`
- `title text not null`, `problem_statement text`, `intended_change text`, `description text`
- `community_id uuid` → `communities(id)` (nullable)
- `status text default 'open'` (open / in_progress / fulfilled / archived)
- `created_at`, `updated_at` (trigger)

### connections
Connects people working the same need or opportunity from different angles — the heart of the matching vision.
- `id uuid` PK
- `opportunity_id uuid` → `opportunities(id)` (nullable), `need_id uuid` → `person_needs(id)` (nullable)
- `seeker_id uuid` → `profiles(id)` (the person with the need / vision)
- `helper_id uuid` → `profiles(id)` (the contributor)
- `connection_type text`, `match_reason text`, `status text default 'proposed'` (proposed / active / completed / declined)
- `notes text`, `matched_at date`, `completed_at date`
- `created_at`, `updated_at` (trigger)

### growth_tracking
Follows a person or opportunity toward fruition / independence — "life produces life."
- `id uuid` PK, `person_id uuid` → `profiles(id)`, `opportunity_id uuid` → `opportunities(id)` (nullable)
- `tracking_date date default current_date`, `status_at_time text`
- `improvements jsonb`, `independence_score int`, `milestones text[]`, `remaining_barriers text[]`, `next_steps text`, `notes text`
- `tracked_by uuid` → `profiles(id)`, `created_at`

### testimonies
Stories of what happened.
- `id uuid` PK, `person_id uuid` → `profiles(id)`, `member_name text`
- `title text`, `story text`, `category text`, `tags text[]`, `media_url text`
- `is_anonymous boolean default false`, `is_approved boolean default false`, `is_public boolean default false`, `is_featured boolean default false`
- `view_count int default 0`, `like_count int default 0`
- `created_at`, `updated_at` (trigger)

### communities
Groups within the ecosystem.
- `id uuid` PK, `name text not null`, `description text`, `city text`, `state text`, `type text`, `created_at`, `updated_at` (trigger)

### community_members
Membership join table.
- `id uuid` PK, `community_id uuid` → `communities(id)`, `person_id uuid` → `profiles(id)`, `role text default 'member'`, `joined_at timestamptz default now()`
- unique (`community_id`, `person_id`)

### person_relationships
Relationships between people.
- `id uuid` PK, `person_id uuid` → `profiles(id)`, `related_person_id uuid` → `profiles(id)`
- `relationship_type text`, `relationship_name text`, `notes text`, `created_at`, `updated_at` (trigger)

---

## Auth & RLS

- **Supabase Auth** is the identity layer. Create a trigger so a `profiles` row is created automatically when a new `auth.users` row is inserted (standard Supabase `handle_new_user` pattern).
- **RLS on every table**, with these policy intents:
  - `profiles`: a user can read/update their own row; basic public-readable fields (name, city, gifts) can be exposed via a view or a read policy for authenticated users, per your preference — start restrictive.
  - `person_needs`, `person_strengths`, `growth_tracking`, `person_relationships`: a user manages their own rows; a designated helper/admin role can read those they're connected to.
  - `opportunities`: creator manages own; authenticated users can read `open` ones.
  - `connections`: the `seeker` and `helper` can read/update their own connections.
  - `testimonies`: creator manages own; anyone can read where `is_public = true and is_approved = true`.
  - `communities` / `community_members`: members can read their community; admins manage.
  - `need_categories`: read-only to authenticated users; admin-managed.
- If a clean policy isn't obvious for a table, default to **owner-only access** and flag it for review rather than leaving RLS off.

---

## Acceptance criteria

- A new Supabase project exists (suggested `life-produces-life`), separate from ChurchConnect.
- All tables above are created with the relationships shown.
- RLS is **enabled on every table**, each with at least one explicit policy.
- A new sign-up creates a matching `profiles` row automatically.
- The existing ChurchConnect project (`dzxipsskcrvbtvzekbgz`) is completely untouched.
- No changes were made to the AppEngine repository.
- Report back the new project ref and a short summary of what was created.
