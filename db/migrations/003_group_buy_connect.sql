-- Group Buy vendor payouts (Stripe Connect Express under United Under God).
-- Safe to re-run. Columns are optional at the application layer: if they are
-- missing, connect.ts keeps the same facts in a notes marker until this lands.

alter table if exists gb_vendors
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false;

create unique index if not exists gb_vendors_stripe_account_id_uidx
  on gb_vendors (stripe_account_id)
  where stripe_account_id is not null;
