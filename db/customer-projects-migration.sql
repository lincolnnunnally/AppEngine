-- Customer-owned, gate-cleared projects (enables CUSTOMER-triggered builds on prod).
--
-- Today, production (Neon-backed) builds fail closed: the build gate has no way to
-- read a project's clearance, and projects carry no customer identity. This adds:
--   * created_by_user_email — the customer who owns the project (for billing + scoping)
--   * gate_clearance        — the canonical-gate clearance the build gate checks
--
-- REVIEW THIS, then it is applied to production with your OK. It is additive and
-- backward-compatible (existing rows get NULLs; existing admin builds unaffected).
-- After it's applied, the app's DB-mode code reads/writes these columns so a
-- signed-in customer's idea can become a buildable, owned project.

ALTER TABLE app_projects ADD COLUMN IF NOT EXISTS created_by_user_email text;
ALTER TABLE app_projects ADD COLUMN IF NOT EXISTS gate_clearance jsonb;

CREATE INDEX IF NOT EXISTS app_projects_owner_idx ON app_projects (created_by_user_email);
