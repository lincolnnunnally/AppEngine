-- Billing schema for prepaid app-build credits.
-- The app also creates these lazily (CREATE TABLE IF NOT EXISTS) when billing is
-- first enabled, but this file is the reviewable source of truth — apply it once
-- against the production database before turning billing on if you prefer.
--
-- Money is stored in integer cents to avoid floating-point drift. The ledger's
-- UNIQUE(reference) makes every credit/charge idempotent: a retried Stripe
-- webhook (reference = stripe_evt:<event_id>) or a retried build charge
-- (reference = build:<id>) can never double-apply.

CREATE TABLE IF NOT EXISTS app_credit_accounts (
  user_key     text PRIMARY KEY,
  balance_cents bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_credit_ledger (
  id          bigserial PRIMARY KEY,
  user_key    text NOT NULL,
  delta_cents bigint NOT NULL,
  kind        text NOT NULL,            -- credit | build | free_starter
  reference   text UNIQUE,              -- idempotency key
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_credit_ledger_user_idx ON app_credit_ledger (user_key, created_at DESC);
