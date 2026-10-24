-- NOT APPLIED. Do not run this file.
--
-- Confirmed before writing this file: nothing in the browser selects
-- cc_churches. The CRM desk, customer counts, and the tech-director import
-- read it on the server with the service role:
--   src/lib/engine/lpl-crm.ts
--   src/lib/engine/lpl-crm-write.ts
--   src/lib/engine/customer-counts.ts
--   scripts/import-tech-directors.ts
-- No component and no browser client queries this table. service_role is
-- not revoked and keeps its grant. public is included so a PUBLIC grant
-- cannot leave the table readable by anon.
--
-- Apply only after a fresh check that no client path needs SELECT.

revoke select on table public.cc_churches from public, anon, authenticated;
