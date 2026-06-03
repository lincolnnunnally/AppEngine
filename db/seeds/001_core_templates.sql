insert into app_templates (slug, name, category, description, config)
values
  (
    'auth',
    'Authentication + Roles',
    'Foundation',
    'Customer sign-in, admin sign-in, protected routes, sessions, roles, and account recovery.',
    '{"includes":["Sign in","Sign up","Admin role","Customer role","Session checks"]}'::jsonb
  ),
  (
    'customer-account',
    'Customer Account Portal',
    'Customer',
    'Customers manage profile, organization, plan, service usage, requests, and notifications.',
    '{"includes":["Profile","Organization","Usage","Requests","Notifications"]}'::jsonb
  ),
  (
    'admin-console',
    'Admin Console',
    'Admin',
    'Administrators manage customers, projects, app runs, billing state, support, and audit logs.',
    '{"includes":["Customers","Projects","Agent runs","Billing","Support","Audit log"]}'::jsonb
  ),
  (
    'onboarding',
    'Guided Onboarding',
    'Growth',
    'First-run setup captures goals, company details, plan fit, and success criteria.',
    '{"includes":["Welcome","Company setup","Goal capture","Checklist"]}'::jsonb
  ),
  (
    'billing',
    'Billing + Plans',
    'Revenue',
    'Pricing tiers, subscription state, invoices, usage limits, and upgrade prompts.',
    '{"includes":["Plans","Subscription","Invoices","Usage limits"]}'::jsonb
  ),
  (
    'dashboard',
    'Operational Dashboard',
    'Product',
    'Work surface for status, tasks, alerts, key metrics, and next best actions.',
    '{"includes":["Metrics","Status","Tasks","Alerts","Activity"]}'::jsonb
  ),
  (
    'notifications',
    'Notifications',
    'Retention',
    'Email and in-app messages for account events, workflow updates, failures, and opportunities.',
    '{"includes":["Email","In-app feed","Preferences","Failure alerts"]}'::jsonb
  ),
  (
    'marketplace',
    'Marketplace Core',
    'Commerce',
    'Supply and demand listings, matches, commissions, vendor profiles, and transaction records.',
    '{"includes":["Listings","Vendors","Matches","Commissions","Transactions"]}'::jsonb
  ),
  (
    'ai-runs',
    'AI Run History',
    'AI',
    'Traceable AI requests, prompts, outputs, cost, artifacts, and retry history.',
    '{"includes":["Prompts","Outputs","Artifacts","Costs","Retries"]}'::jsonb
  )
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  config = excluded.config;
