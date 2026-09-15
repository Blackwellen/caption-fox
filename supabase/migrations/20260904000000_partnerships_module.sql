-- ============================================================
-- Caption Fox — Partnerships module
-- Programmes, Partners, Applications, Tracking Links, Conversions,
-- Commissions, Payouts, Rewards, Tiers, Territories, Co-marketing
-- contributions/leads, and a shared Partnerships activity feed.
-- Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- PROGRAMMES
-- ============================================================
create table if not exists public.partnership_programmes (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  programme_type text not null
    check (programme_type in ('affiliate','referral','ambassador','loyalty','reseller','co_marketing')),
  category text,
  description text,
  status text not null default 'draft'
    check (status in ('draft','in_review','active','paused','scheduled','closed','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  commission_type text not null default 'percentage'
    check (commission_type in ('fixed','percentage','tiered_percentage','revenue_share','custom')),
  commission_rate numeric(6,3) not null default 0,
  currency text not null default 'GBP',
  tracking_window_days integer not null default 30,
  start_date date,
  end_date date,
  cover_url text,
  channels text[] not null default '{}',
  terms_url text,
  config jsonb not null default '{}',
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partnership_programmes enable row level security;
drop policy if exists "partnership_programmes_workspace" on public.partnership_programmes;
create policy "partnership_programmes_workspace" on public.partnership_programmes for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_programmes_workspace on public.partnership_programmes(workspace_id, programme_type, status);
create index if not exists idx_partnership_programmes_owner on public.partnership_programmes(owner_id);

-- ============================================================
-- TIERS
-- ============================================================
create table if not exists public.partnership_tiers (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  name text not null,
  rank integer not null default 0,
  threshold numeric(14,2) not null default 0,
  commission_rate numeric(6,3),
  benefits jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint partnership_tiers_unique unique (programme_id, name)
);
alter table public.partnership_tiers enable row level security;
drop policy if exists "partnership_tiers_workspace" on public.partnership_tiers;
create policy "partnership_tiers_workspace" on public.partnership_tiers for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_tiers_programme on public.partnership_tiers(programme_id, rank);

-- ============================================================
-- PARTNERS
-- ============================================================
create table if not exists public.partnership_partners (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_type text not null
    check (partner_type in ('affiliate','referral_advocate','ambassador','loyalty_member','reseller','co_marketing_partner')),
  name text not null,
  handle text,
  email text,
  avatar_url text,
  owner_id uuid references public.profiles(id) on delete set null,
  tier_id uuid references public.partnership_tiers(id) on delete set null,
  status text not null default 'applicant'
    check (status in ('applicant','pending_review','approved','active','paused','at_risk','suspended','rejected','offboarded','archived')),
  platforms text[] not null default '{}',
  region text,
  health text not null default 'healthy' check (health in ('healthy','at_risk','critical')),
  health_reason text,
  joined_at timestamptz,
  approved_at timestamptz,
  last_activity_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partnership_partners enable row level security;
drop policy if exists "partnership_partners_workspace" on public.partnership_partners;
create policy "partnership_partners_workspace" on public.partnership_partners for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_partners_programme on public.partnership_partners(programme_id, status);
create index if not exists idx_partnership_partners_workspace on public.partnership_partners(workspace_id, partner_type, status);
create index if not exists idx_partnership_partners_owner on public.partnership_partners(owner_id);

-- ============================================================
-- APPLICATIONS
-- ============================================================
create table if not exists public.partnership_applications (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid references public.partnership_partners(id) on delete set null,
  applicant_name text not null,
  applicant_email text,
  status text not null default 'pending'
    check (status in ('pending','in_review','approved','changes_requested','rejected','withdrawn')),
  fields jsonb not null default '{}',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.partnership_applications enable row level security;
drop policy if exists "partnership_applications_workspace" on public.partnership_applications;
create policy "partnership_applications_workspace" on public.partnership_applications for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_applications_programme on public.partnership_applications(programme_id, status);

-- ============================================================
-- TRACKING LINKS
-- ============================================================
create table if not exists public.partnership_tracking_links (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  slug text not null,
  destination_url text not null,
  status text not null default 'active' check (status in ('active','paused','expired')),
  clicks integer not null default 0,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partnership_tracking_links_slug_unique unique (slug)
);
alter table public.partnership_tracking_links enable row level security;
drop policy if exists "partnership_tracking_links_workspace" on public.partnership_tracking_links;
create policy "partnership_tracking_links_workspace" on public.partnership_tracking_links for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_tracking_links_partner on public.partnership_tracking_links(partner_id);

-- ============================================================
-- TRACKING CLICKS (attribution log)
-- ============================================================
create table if not exists public.partnership_tracking_clicks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tracking_link_id uuid not null references public.partnership_tracking_links(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  referer text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.partnership_tracking_clicks enable row level security;
drop policy if exists "partnership_tracking_clicks_workspace" on public.partnership_tracking_clicks;
create policy "partnership_tracking_clicks_workspace" on public.partnership_tracking_clicks for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_tracking_clicks_link on public.partnership_tracking_clicks(tracking_link_id, created_at desc);

-- Public view of the redirect target only — the anonymous /p/[slug] redirect
-- route needs to resolve a slug without an authenticated session. No other
-- columns or tables are exposed through this view.
create or replace view public.partnership_tracking_links_public as
select id, workspace_id, programme_id, partner_id, slug, destination_url
from public.partnership_tracking_links
where status = 'active' and (expires_at is null or expires_at > now());

grant select on public.partnership_tracking_links_public to anon, authenticated;

-- Atomically resolves a slug, increments its click counter and logs the
-- click for attribution — all as one security-definer call so an anonymous
-- visitor never needs direct write access to the tracking-link tables.
create or replace function public.record_partnership_click(
  p_slug text, p_referer text default null, p_user_agent text default null
)
returns table (destination_url text, tracking_link_id uuid, programme_id uuid, partner_id uuid, workspace_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
begin
  select l.id, l.workspace_id, l.programme_id, l.partner_id, l.destination_url
    into v_link
  from public.partnership_tracking_links l
  where l.slug = p_slug and l.status = 'active' and (l.expires_at is null or l.expires_at > now())
  limit 1;

  if v_link.id is null then
    return;
  end if;

  update public.partnership_tracking_links set clicks = clicks + 1 where id = v_link.id;

  insert into public.partnership_tracking_clicks (workspace_id, tracking_link_id, programme_id, partner_id, referer, user_agent)
  values (v_link.workspace_id, v_link.id, v_link.programme_id, v_link.partner_id, p_referer, p_user_agent);

  return query select v_link.destination_url, v_link.id, v_link.programme_id, v_link.partner_id, v_link.workspace_id;
end;
$$;

grant execute on function public.record_partnership_click(text, text, text) to anon, authenticated;

-- ============================================================
-- CONVERSIONS
-- ============================================================
create table if not exists public.partnership_conversions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  tracking_link_id uuid references public.partnership_tracking_links(id) on delete set null,
  conversion_type text not null default 'sale'
    check (conversion_type in ('sale','lead','qualified_lead','signup','referral','subscription','deal','reward_action','other')),
  value numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending','valid','reversed','duplicate')),
  converted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.partnership_conversions enable row level security;
drop policy if exists "partnership_conversions_workspace" on public.partnership_conversions;
create policy "partnership_conversions_workspace" on public.partnership_conversions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_conversions_partner on public.partnership_conversions(partner_id, converted_at desc);
create index if not exists idx_partnership_conversions_programme on public.partnership_conversions(programme_id, converted_at desc);

-- ============================================================
-- COMMISSIONS
-- ============================================================
create table if not exists public.partnership_commissions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  conversion_id uuid references public.partnership_conversions(id) on delete set null,
  calculation_basis text not null default 'conversion_value',
  rate numeric(6,3) not null default 0,
  amount numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  status text not null default 'pending'
    check (status in ('pending','validated','approved','on_hold','reversed','payable','paid','rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.partnership_commissions enable row level security;
drop policy if exists "partnership_commissions_workspace" on public.partnership_commissions;
create policy "partnership_commissions_workspace" on public.partnership_commissions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_commissions_partner on public.partnership_commissions(partner_id, status);
create index if not exists idx_partnership_commissions_programme on public.partnership_commissions(programme_id, status);

-- ============================================================
-- PAYOUTS
-- ============================================================
create table if not exists public.partnership_payouts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  currency text not null default 'GBP',
  gross_amount numeric(14,2) not null default 0,
  adjustments numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft','pending_review','approved','processing','paid','partially_paid','failed','on_hold','cancelled')),
  provider text,
  provider_reference text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partnership_payouts enable row level security;
drop policy if exists "partnership_payouts_workspace" on public.partnership_payouts;
create policy "partnership_payouts_workspace" on public.partnership_payouts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_payouts_partner on public.partnership_payouts(partner_id, status);
create index if not exists idx_partnership_payouts_programme on public.partnership_payouts(programme_id, status);

-- ============================================================
-- REWARDS (referral / loyalty)
-- ============================================================
create table if not exists public.partnership_rewards (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  reward_type text not null default 'cash'
    check (reward_type in ('cash','gift_card','store_credit','free_product','discount','points','custom')),
  value numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending','issued','redeemed','expired')),
  trigger_source text,
  issued_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.partnership_rewards enable row level security;
drop policy if exists "partnership_rewards_workspace" on public.partnership_rewards;
create policy "partnership_rewards_workspace" on public.partnership_rewards for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_rewards_partner on public.partnership_rewards(partner_id, status);

-- ============================================================
-- TERRITORIES (reseller)
-- ============================================================
create table if not exists public.partnership_territories (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid references public.partnership_partners(id) on delete set null,
  region text not null,
  exclusive boolean not null default false,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.partnership_territories enable row level security;
drop policy if exists "partnership_territories_workspace" on public.partnership_territories;
create policy "partnership_territories_workspace" on public.partnership_territories for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_territories_programme on public.partnership_territories(programme_id);

-- Prevent silently overlapping exclusive territories in the same programme.
create unique index if not exists idx_partnership_territories_exclusive_region
  on public.partnership_territories(programme_id, lower(region)) where exclusive;

-- ============================================================
-- CO-MARKETING CONTRIBUTIONS & LEADS
-- ============================================================
create table if not exists public.co_marketing_contributions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  category text not null default 'content',
  our_contribution numeric(14,2) not null default 0,
  partner_contribution numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending','approved','settled')),
  created_at timestamptz not null default now()
);
alter table public.co_marketing_contributions enable row level security;
drop policy if exists "co_marketing_contributions_workspace" on public.co_marketing_contributions;
create policy "co_marketing_contributions_workspace" on public.co_marketing_contributions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_co_marketing_contributions_programme on public.co_marketing_contributions(programme_id);

create table if not exists public.co_marketing_leads (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  lead_name text not null,
  lead_email text,
  source text,
  qualified boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.co_marketing_leads enable row level security;
drop policy if exists "co_marketing_leads_workspace" on public.co_marketing_leads;
create policy "co_marketing_leads_workspace" on public.co_marketing_leads for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_co_marketing_leads_programme on public.co_marketing_leads(programme_id);

-- ============================================================
-- ACTIVITY (shared feed / audit trail)
-- ============================================================
create table if not exists public.partnership_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null
    check (entity_type in ('programme','partner','application','tracking_link','conversion','commission','payout','reward','territory','co_marketing','system')),
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.partnership_activity enable row level security;
drop policy if exists "partnership_activity_workspace" on public.partnership_activity;
create policy "partnership_activity_workspace" on public.partnership_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_activity_workspace on public.partnership_activity(workspace_id, created_at desc);

-- ============================================================
-- METRIC SNAPSHOTS (performance trend charts)
-- primary_count / secondary_count are reinterpreted per programme type by
-- the UI (e.g. clicks/conversions for affiliate, referrals/conversions for
-- referral, reach/conversions for ambassador, members/redemptions for
-- loyalty, opportunities/deals for reseller, leads/conversions for co-marketing).
-- ============================================================
create table if not exists public.partnership_metrics_daily (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid references public.partnership_programmes(id) on delete cascade,
  programme_type text not null
    check (programme_type in ('affiliate','referral','ambassador','loyalty','reseller','co_marketing')),
  metric_date date not null,
  primary_count integer not null default 0,
  secondary_count integer not null default 0,
  revenue numeric(14,2) not null default 0,
  spend numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint partnership_metrics_daily_unique unique (workspace_id, programme_id, metric_date)
);
alter table public.partnership_metrics_daily enable row level security;
drop policy if exists "partnership_metrics_daily_workspace" on public.partnership_metrics_daily;
create policy "partnership_metrics_daily_workspace" on public.partnership_metrics_daily for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_metrics_daily_ws_type on public.partnership_metrics_daily(workspace_id, programme_type, metric_date);

-- ============================================================
-- TRIGGERS: updated_at for mutable tables
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'partnership_programmes','partnership_partners','partnership_payouts'
  ]) loop
    if not exists (select 1 from pg_trigger where tgname = format('trg_%s_updated_at', t)) then
      execute format('
        create trigger trg_%s_updated_at before update on public.%s
        for each row execute function public.handle_updated_at()', t, t);
    end if;
  end loop;
end $$;
