-- NOT APPLIED. Do not run this file against production from the app.
--
-- Production op_leads_kind_check is
--   CHECK (kind = ANY (ARRAY['shop','field']))
-- so an insert with kind 'church-lead' fails. Drop that constraint and add it
-- back with 'church-lead' included. Drop-then-add is safe to run again.

alter table public.op_leads drop constraint if exists op_leads_kind_check;

alter table public.op_leads
  add constraint op_leads_kind_check
  check (kind = any (array['shop', 'field', 'church-lead']));
