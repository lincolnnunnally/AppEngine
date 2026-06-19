-- DEV ONLY: Spark of Hope Phase A sample testimonies.
-- Purpose: give the DEV preview a gentle, reviewable feed for final Phase A review.
-- Do not apply this file to production.
--
-- Cleanup:
-- delete from public.testimony
-- where id in (
--   '10000000-0000-4000-8000-000000000501',
--   '10000000-0000-4000-8000-000000000502',
--   '10000000-0000-4000-8000-000000000503'
-- );
-- delete from public.person
-- where id = '10000000-0000-4000-8000-000000000500';

insert into public.person (id, display_name)
values ('10000000-0000-4000-8000-000000000500', 'DEV sample storyteller')
on conflict (id) do update
set display_name = excluded.display_name;

insert into public.testimony (
  id,
  person_id,
  content,
  kind,
  visibility,
  needs_categories,
  is_approved,
  is_anonymous,
  created_at
)
values
  (
    '10000000-0000-4000-8000-000000000501',
    '10000000-0000-4000-8000-000000000500',
    '[DEV sample] I felt less alone today. Someone from my group noticed I had gone quiet and checked on me. It was a simple message, but God used it to remind me I am not carrying this by myself.',
    'spark_of_hope_story',
    'public',
    array['lonely', 'anxious', 'overwhelmed'],
    true,
    false,
    now() - interval '3 minutes'
  ),
  (
    '10000000-0000-4000-8000-000000000502',
    '10000000-0000-4000-8000-000000000500',
    '[DEV sample] A stranger covered my groceries when my card would not go through. It was a small, quiet kindness, but it reminded me people are good and that God can meet me through unexpected care.',
    'spark_of_hope_story',
    'public',
    array['weary', 'hope'],
    true,
    false,
    now() - interval '6 minutes'
  ),
  (
    '10000000-0000-4000-8000-000000000503',
    '10000000-0000-4000-8000-000000000500',
    '[DEV sample] Prayer got me through a hard week. I did not get every answer at once, but God gave me enough peace for the next step and sent encouragement right when I needed it.',
    'spark_of_hope_story',
    'public',
    array['grieving', 'anxious', 'overwhelmed', 'weary', 'hope'],
    true,
    false,
    now() - interval '9 minutes'
  )
on conflict (id) do update
set
  person_id = excluded.person_id,
  content = excluded.content,
  kind = excluded.kind,
  visibility = excluded.visibility,
  needs_categories = excluded.needs_categories,
  is_approved = excluded.is_approved,
  is_anonymous = excluded.is_anonymous,
  created_at = excluded.created_at;
