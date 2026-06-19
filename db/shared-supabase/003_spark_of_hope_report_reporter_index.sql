-- Spark of Hope MVP v0.1 report reporter lookup index.
-- Apply to shared Life Produces Life Supabase DEV after 002_spark_of_hope_reports.sql.
-- This file is intentionally not wired into npm run db:setup, which targets the App Engine database.

create index if not exists testimony_report_reporter_created_idx
  on public.testimony_report (reporter_person_id, created_at desc);

-- Verification:
-- select indexname from pg_indexes where schemaname = 'public' and tablename = 'testimony_report';
