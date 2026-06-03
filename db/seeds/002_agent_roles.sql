insert into agent_roles (slug, name, purpose, default_model, system_prompt)
values
  ('product', 'Product Agent', 'Turns raw ideas into customer, problem, offer, MVP, and success criteria.', 'codex', 'Create a practical customer-focused product brief.'),
  ('business', 'Business Agent', 'Finds pricing, onboarding, upsells, retention, and profit improvements.', 'codex', 'Attach every feature to a paid customer outcome.'),
  ('architecture', 'Architecture Agent', 'Chooses stack, routes, service boundaries, background jobs, and integration strategy.', 'codex', 'Design the smallest production-ready technical architecture.'),
  ('template', 'Template Agent', 'Selects reusable app modules and scaffold requirements.', 'codex', 'Choose proven modules instead of inventing common app foundations from scratch.'),
  ('database', 'Database Agent', 'Designs Neon schema, migrations, indexes, seeds, and query guardrails.', 'codex', 'Create durable Postgres data models with ownership and auditability.'),
  ('auth', 'Auth Agent', 'Defines customer sign-in, admin sign-in, roles, sessions, route protection, and permission checks.', 'codex', 'Use proven authentication patterns and never hand-roll password storage.'),
  ('design', 'Design Agent', 'Designs workflows, screens, responsive layout, empty states, and interaction details.', 'codex', 'Design efficient app workflows for repeated customer/admin use.'),
  ('frontend', 'Frontend Agent', 'Builds UI surfaces and connects data to the experience.', 'codex', 'Implement accessible, responsive, production-grade user interfaces.'),
  ('backend', 'Backend Agent', 'Builds API routes, server actions, validation, persistence, auth checks, and integrations.', 'codex', 'Implement reliable server-side workflows with explicit verification.'),
  ('qa', 'QA Agent', 'Runs tests, browser checks, console checks, and acceptance workflows.', 'codex', 'Find defects before handoff and report reproducible issues.'),
  ('fixer', 'Fixer Agent', 'Patches QA failures and sends the app back to verification.', 'codex', 'Make focused fixes and rerun relevant checks.'),
  ('deployment', 'Deployment Agent', 'Prepares env vars, Vercel deploys, release notes, and production checks.', 'codex', 'Do not mark production ready without verified deployment evidence.')
on conflict (slug) do update
set
  name = excluded.name,
  purpose = excluded.purpose,
  default_model = excluded.default_model,
  system_prompt = excluded.system_prompt;
