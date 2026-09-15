-- ============================================================
-- Caption Fox — Partnerships: Stripe Connect payout accounts
-- Mirrors the existing plain-text stripe id column convention
-- (workspaces.stripe_customer_id, marketplace order stripe_payment_intent).
-- Safe to re-run (idempotent).
-- ============================================================

alter table public.partnership_partners add column if not exists stripe_account_id text;
alter table public.partnership_partners add column if not exists stripe_account_status text not null default 'not_connected';
alter table public.partnership_partners add column if not exists stripe_details_submitted boolean not null default false;
alter table public.partnership_partners add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.partnership_partners add column if not exists stripe_connected_at timestamptz;
alter table public.partnership_partners add column if not exists stripe_last_synced_at timestamptz;

do $$ begin
  alter table public.partnership_partners add constraint partnership_partners_stripe_status_check
    check (stripe_account_status in ('not_connected', 'pending', 'verified', 'restricted', 'rejected'));
exception when duplicate_object then null; end $$;

create unique index if not exists idx_partnership_partners_stripe_account
  on public.partnership_partners(stripe_account_id) where stripe_account_id is not null;

-- Payout provider transfer tracking (provider/provider_reference already exist;
-- add a status-detail column for surfacing Stripe transfer failures in the UI).
alter table public.partnership_payouts add column if not exists provider_error text;
