-- Two-tier affiliate programme.
--   • A user becomes an affiliate (gets a unique referral code).
--   • Tier 1: affiliates refer CUSTOMERS and earn on their sales.
--   • Tier 2: affiliates can also recruit OTHER affiliates (parent_affiliate_id),
--     and earn an override on those sub-affiliates' sales.
--
-- Apply with: supabase db push  (or run in the Supabase SQL editor).

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  parent_affiliate_id uuid references public.affiliates (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  payout_email text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists affiliates_parent_idx on public.affiliates (parent_affiliate_id);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  kind text not null check (kind in ('customer', 'affiliate')),
  referred_user_id uuid references public.profiles (id) on delete set null,
  referred_email text,
  status text not null default 'pending' check (status in ('pending', 'converted', 'cancelled')),
  commission_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_referrals_affiliate_idx on public.affiliate_referrals (affiliate_id, created_at desc);

alter table public.affiliates enable row level security;
alter table public.affiliate_referrals enable row level security;

-- Affiliates: read your own row + the sub-affiliates you recruited.
drop policy if exists "affiliates_select" on public.affiliates;
create policy "affiliates_select" on public.affiliates for select using (
  user_id = auth.uid()
  or parent_affiliate_id in (select id from public.affiliates where user_id = auth.uid())
);

-- You can create your own affiliate row.
drop policy if exists "affiliates_insert_own" on public.affiliates;
create policy "affiliates_insert_own" on public.affiliates for insert with check (user_id = auth.uid());

drop policy if exists "affiliates_update_own" on public.affiliates;
create policy "affiliates_update_own" on public.affiliates for update using (user_id = auth.uid());

-- Referrals: read referrals for your own affiliate account, plus referrals
-- belonging to your sub-affiliates (for override earnings).
drop policy if exists "affiliate_referrals_select" on public.affiliate_referrals;
create policy "affiliate_referrals_select" on public.affiliate_referrals for select using (
  affiliate_id in (
    select id from public.affiliates
    where user_id = auth.uid()
       or parent_affiliate_id in (select id from public.affiliates where user_id = auth.uid())
  )
);
