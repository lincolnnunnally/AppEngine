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
    'kindred-connection-core',
    'Purpose Connection App',
    'Connection',
    'Rebrandable Kindred-derived template for matching, belonging, pods, connection requests, and purpose-based discovery.',
    '{"source":"Kindred Connections","includes":["Purpose matching","Relational posture","Pods","Connection requests","Messaging"],"rebrandFields":["match vocabulary","profile fields","compatibility dimensions","pod naming"],"credentialFields":["auth","database","ai provider","api url"]}'::jsonb
  ),
  (
    'growth-dashboard',
    'Guided Growth Dashboard',
    'Growth',
    'Rebrandable Kindred-derived dashboard for journals, goals, check-ins, readiness, rituals, and progress scoring.',
    '{"source":"Kindred Connections","includes":["Becoming dashboard","Journal","Goals","Readiness","Ritual steps","Alignment score"],"rebrandFields":["growth language","score label","ritual steps","reflection prompts"],"credentialFields":["auth","database","ai provider optional"]}'::jsonb
  ),
  (
    'public-invite-loop',
    'Peer Invite Loop',
    'Growth',
    'Rebrandable invite flow with user-owned share messages, public invite landing page, and signup attribution.',
    '{"source":"Kindred Connections","includes":["Invite codes","Share messages","Public invite page","Signup attribution"],"rebrandFields":["invite variants","public invite copy","share preview"],"credentialFields":["public app url","auth","database"]}'::jsonb
  ),
  (
    'public-profile-sharing',
    'Public Profile + Share Card',
    'Web',
    'Rebrandable public profile and rich-preview share-card template for people, organizations, products, testimonies, or creators.',
    '{"source":"Kindred Connections","includes":["Public profile","OG HTML","Generated share image","Share link"],"rebrandFields":["profile fields","share card copy","cta","image rules"],"credentialFields":["public app url","backend api url","storage optional"]}'::jsonb
  ),
  (
    'community-events-service',
    'Community Events + Service',
    'Operations',
    'Rebrandable event, RSVP, service recommendation, imported-event, and attendance-verification template.',
    '{"source":"Kindred Connections","includes":["Events","RSVP","Attendance","Event curation","Webhook import","Service prescription"],"rebrandFields":["event taxonomy","source taxonomy","rsvp copy","verifier roles"],"credentialFields":["auth","database","webhook secret","ai provider optional"]}'::jsonb
  ),
  (
    'ai-coaching-covenants',
    'AI Coaching + Covenants',
    'AI',
    'Rebrandable coaching loop that turns reflection into commitments, follow-up history, overdue signals, and pattern detection.',
    '{"source":"Kindred Connections","includes":["Coaching chat","Covenants","History","Patterns","Overdue follow-up"],"rebrandFields":["coach voice","covenant language","themes","follow-up rhythm"],"credentialFields":["auth","database","ai provider"]}'::jsonb
  ),
  (
    'forgiveness-mediation',
    'Forgiveness / Mediation',
    'Care',
    'Rebrandable relationship repair, reflection, letter drafting, and two-person mediation flow.',
    '{"source":"Kindred Connections","includes":["Forgiveness journey","Letter drafting","Mediation invite","Partner reflection","Connection reflection"],"rebrandFields":["safety disclaimer","conflict categories","mediation prompts","completion states"],"credentialFields":["auth","database","ai provider optional","email optional"]}'::jsonb
  ),
  (
    'admin-ops-moderation',
    'Admin Ops + Moderation Console',
    'Admin',
    'Rebrandable owner console for users, reports, pods/events, operations, settings, AI usage, and audit logs.',
    '{"source":"Kindred Connections","includes":["Dashboard","Users","Reports","Operations","Settings","AI usage","Audit log"],"rebrandFields":["admin nouns","report categories","ops actions","kpi labels"],"credentialFields":["admin auth","database","ai provider optional","email optional"]}'::jsonb
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
