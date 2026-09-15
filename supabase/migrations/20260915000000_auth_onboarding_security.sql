-- Auth, registration & onboarding hardening (2026-09-15).
--
-- Closes privilege-escalation holes found in the auth/onboarding audit and adds
-- the persistence model for the five account-type onboarding flows.
--
--  1. profiles_self (FOR ALL) let any user set profiles.is_platform_admin = true
--     on themselves. A trigger now rejects client-originated changes to it.
--  2. workspace_owner_write (FOR ALL) let an owner set plan = 'enterprise'.
--     Billing columns are now server-only (service role / Stripe webhook).
--  3. affiliates_insert_own let anyone self-approve into the affiliate
--     programme; affiliate_applications accepted status = 'approved' from anon.
--     Affiliate rows are now only created by a platform admin approval RPC.
--  4. mkt_suppliers_owner (FOR ALL) let suppliers mark themselves verified.
--  5. invitations_token_lookup (USING true) exposed every invite token/email to
--     anyone. Replaced by token-scoped SECURITY DEFINER RPCs.
--  6. New: profiles.account_type, onboarding_drafts, complete_onboarding() RPC,
--     private onboarding-uploads bucket with owner-folder policies.
--
-- "End-user request" = a PostgREST call carrying an anon/authenticated JWT.
-- Service role (webhooks, admin tooling) and direct SQL are unaffected.
--
-- Rollback notes: see release-gated/user-fixes/auth-onboarding.md.

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function public.is_end_user_request()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') in ('authenticated', 'anon')
$$;

-- Text array from a jsonb array, trimmed, de-duplicated, bounded.
create or replace function public.jsonb_text_array(j jsonb, max_items int default 30, max_len int default 80)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(v order by ord), '{}')
  from (
    select distinct on (lower(btrim(e.value))) left(btrim(e.value), max_len) as v, e.ord
    from jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end)
         with ordinality as e(value, ord)
    where btrim(e.value) <> ''
    order by lower(btrim(e.value)), e.ord
  ) s
  where s.ord <= max_items
$$;

create or replace function public.slug_with_suffix(p_name text)
returns text
language sql
volatile
as $$
  select coalesce(nullif(left(regexp_replace(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'), 40), ''), 'workspace')
         || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
$$;

-- ── 1. profiles: privilege guard + account_type ─────────────────────────────
alter table public.profiles add column if not exists account_type text;
alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type is null or account_type in ('brand', 'agency', 'business', 'creator', 'supplier'));

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_platform_admin := false;
    return new;
  end if;
  if new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin can only be changed by the platform' using errcode = '42501';
  end if;
  if old.onboarding_completed and new.account_type is distinct from old.account_type then
    raise exception 'account_type is locked after onboarding' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ── 2. workspaces: billing columns are server-only ──────────────────────────
create or replace function public.guard_workspace_billing()
returns trigger
language plpgsql
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plan := 'starter';
    new.plan_status := 'trialing';
    new.trial_ends_at := null;
    if new.owner_id is distinct from auth.uid() then
      raise exception 'workspace owner must be the current user' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.plan_status is distinct from old.plan_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.owner_id is distinct from old.owner_id then
    raise exception 'plan, billing and ownership fields are managed by Caption Fox billing' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_workspace_billing on public.workspaces;
create trigger trg_guard_workspace_billing
  before insert or update on public.workspaces
  for each row execute function public.guard_workspace_billing();

-- ── 3. marketplace_suppliers: onboarding fields + trust guard ───────────────
alter table public.marketplace_suppliers add column if not exists website_url text;
alter table public.marketplace_suppliers add column if not exists regions_served text[] not null default '{}';
alter table public.marketplace_suppliers add column if not exists deliverables text[] not null default '{}';
alter table public.marketplace_suppliers add column if not exists lead_time_days integer;
alter table public.marketplace_suppliers add column if not exists capacity text;
alter table public.marketplace_suppliers add column if not exists contact_preference text;

create or replace function public.guard_supplier_trust_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false;
    new.rating := 0;
    new.reviews_count := 0;
    new.badges := '{}';
    new.is_demo := false;
    new.on_time_delivery_pct := null;
    new.job_success_pct := null;
    new.projects_count := 0;
    new.response_time_minutes := null;
    if new.status = 'suspended' then
      new.status := 'paused';
    end if;
    if new.user_id is distinct from auth.uid() then
      raise exception 'supplier profile must belong to the current user' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.verified is distinct from old.verified
     or new.rating is distinct from old.rating
     or new.reviews_count is distinct from old.reviews_count
     or new.badges is distinct from old.badges
     or new.is_demo is distinct from old.is_demo
     or new.on_time_delivery_pct is distinct from old.on_time_delivery_pct
     or new.job_success_pct is distinct from old.job_success_pct
     or new.projects_count is distinct from old.projects_count
     or new.response_time_minutes is distinct from old.response_time_minutes
     or new.user_id is distinct from old.user_id then
    raise exception 'verification, ratings and performance metrics are set by Caption Fox' using errcode = '42501';
  end if;
  if (old.status = 'suspended' or new.status = 'suspended') and new.status is distinct from old.status then
    raise exception 'suspension is managed by Caption Fox' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_supplier_trust_fields on public.marketplace_suppliers;
create trigger trg_guard_supplier_trust_fields
  before insert or update on public.marketplace_suppliers
  for each row execute function public.guard_supplier_trust_fields();

-- ── 4. affiliate programme: approval is admin-only ──────────────────────────
drop policy if exists "affiliates_insert_own" on public.affiliates;

create or replace function public.guard_affiliate_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if new.code is distinct from old.code
     or new.status is distinct from old.status
     or new.parent_affiliate_id is distinct from old.parent_affiliate_id
     or new.user_id is distinct from old.user_id then
    raise exception 'only the payout email can be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_affiliate_fields on public.affiliates;
create trigger trg_guard_affiliate_fields
  before update on public.affiliates
  for each row execute function public.guard_affiliate_fields();

alter table public.affiliate_applications add column if not exists country text;
alter table public.affiliate_applications add column if not exists primary_channel text;
alter table public.affiliate_applications add column if not exists audience_size text;
alter table public.affiliate_applications add column if not exists platforms text[] not null default '{}';
alter table public.affiliate_applications add column if not exists content_categories text[] not null default '{}';
alter table public.affiliate_applications add column if not exists promotion_method text;
alter table public.affiliate_applications add column if not exists audience_links text[] not null default '{}';
alter table public.affiliate_applications add column if not exists terms_accepted_at timestamptz;
alter table public.affiliate_applications add column if not exists review_note text;
alter table public.affiliate_applications add column if not exists submitted_at timestamptz;
alter table public.affiliate_applications add column if not exists updated_at timestamptz not null default now();

alter table public.affiliate_applications drop constraint if exists affiliate_applications_status_check;
alter table public.affiliate_applications add constraint affiliate_applications_status_check
  check (status in ('draft', 'pending', 'needs_info', 'approved', 'rejected'));

create unique index if not exists affiliate_applications_one_open_per_user
  on public.affiliate_applications (user_id)
  where user_id is not null and status in ('draft', 'pending', 'needs_info');
create index if not exists affiliate_applications_email_lower_idx on public.affiliate_applications (lower(email));

-- Anonymous inserts are removed: new applicants are created server-side after
-- sign-up; signed-in applicants write their own draft/pending row.
drop policy if exists "affiliate_applications_public_insert" on public.affiliate_applications;
drop policy if exists "affiliate_applications_own_insert" on public.affiliate_applications;
create policy "affiliate_applications_own_insert" on public.affiliate_applications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status in ('draft', 'pending')
    and reviewed_by is null and reviewed_at is null and review_note is null
  );

drop policy if exists "affiliate_applications_own_update" on public.affiliate_applications;
create policy "affiliate_applications_own_update" on public.affiliate_applications
  for update to authenticated
  using (user_id = auth.uid() and status in ('draft', 'needs_info'))
  with check (user_id = auth.uid() and status in ('draft', 'pending', 'needs_info'));

create or replace function public.guard_affiliate_application_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin) then
    return new;
  end if;
  if new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.review_note is distinct from old.review_note
     or new.user_id is distinct from old.user_id then
    raise exception 'review fields are set by Caption Fox' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_affiliate_application_fields on public.affiliate_applications;
create trigger trg_guard_affiliate_application_fields
  before update on public.affiliate_applications
  for each row execute function public.guard_affiliate_application_fields();

create or replace function public.review_affiliate_application(p_application uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  app public.affiliate_applications%rowtype;
  v_code text;
  v_affiliate uuid;
begin
  if v_admin is null or not exists (select 1 from public.profiles where id = v_admin and is_platform_admin) then
    raise exception 'platform admin access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'needs_info') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  select * into app from public.affiliate_applications where id = p_application for update;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if app.status not in ('pending', 'needs_info') then
    raise exception 'application is not awaiting review' using errcode = '22023';
  end if;
  if p_decision = 'approved' and app.user_id is null then
    raise exception 'application has no linked account' using errcode = '22023';
  end if;

  update public.affiliate_applications
     set status = p_decision, reviewed_by = v_admin, reviewed_at = now(),
         review_note = nullif(left(btrim(coalesce(p_note, '')), 1000), ''), updated_at = now()
   where id = app.id;

  if p_decision = 'approved' then
    select id into v_affiliate from public.affiliates where user_id = app.user_id;
    if v_affiliate is null then
      loop
        v_code := coalesce(nullif(left(regexp_replace(lower(split_part(app.email, '@', 1)), '[^a-z0-9]', '', 'g'), 8), ''), 'fox')
                  || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
        exit when not exists (select 1 from public.affiliates where code = v_code);
      end loop;
      insert into public.affiliates (user_id, code, payout_email, status)
      values (app.user_id, v_code, app.email, 'active')
      returning id into v_affiliate;
    else
      update public.affiliates set status = 'active' where id = v_affiliate;
    end if;
  end if;

  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (null, v_admin, 'affiliate.application.' || p_decision, 'affiliate_application', app.id,
          jsonb_build_object('applicant_user_id', app.user_id));

  return jsonb_build_object('status', p_decision, 'affiliate_id', v_affiliate);
end;
$$;

revoke all on function public.review_affiliate_application(uuid, text, text) from public, anon;
grant execute on function public.review_affiliate_application(uuid, text, text) to authenticated;

-- ── 5. team invitations: token-scoped access only ───────────────────────────
drop policy if exists "invitations_token_lookup" on public.team_invitations;

create or replace function public.get_invitation(p_token text)
returns table (workspace_name text, role text, email_hint text, status text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv public.team_invitations%rowtype;
  v_ws text;
begin
  if p_token is null or length(p_token) < 16 then
    return;
  end if;
  select * into inv from public.team_invitations where token = p_token;
  if not found then
    return;
  end if;
  select name into v_ws from public.workspaces where id = inv.workspace_id;
  return query select
    v_ws,
    inv.role,
    left(inv.email, 2) || '•••@' || split_part(inv.email, '@', 2),
    case when inv.accepted_at is not null then 'accepted'
         when inv.expires_at < now() then 'expired'
         else 'pending' end;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv public.team_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'sign in to accept this invitation' using errcode = '28000';
  end if;
  select * into inv from public.team_invitations where token = p_token for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if inv.accepted_at is not null then
    if exists (select 1 from public.workspace_members where workspace_id = inv.workspace_id and user_id = v_uid) then
      return inv.workspace_id;
    end if;
    raise exception 'invitation already used' using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitation expired' using errcode = '22023';
  end if;
  if lower(inv.email) <> v_email then
    raise exception 'invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by, invited_at, joined_at)
  values (inv.workspace_id, v_uid, case when inv.role = 'owner' then 'admin' else inv.role end, inv.invited_by, inv.created_at, now())
  on conflict (workspace_id, user_id) do nothing;

  update public.team_invitations set accepted_at = now() where id = inv.id;
  update public.profiles
     set onboarding_completed = true,
         default_workspace_id = coalesce(default_workspace_id, inv.workspace_id)
   where id = v_uid;

  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (inv.workspace_id, v_uid, 'team.invitation.accepted', 'team_invitation', inv.id, jsonb_build_object('role', inv.role));

  return inv.workspace_id;
end;
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- ── 6. onboarding drafts ────────────────────────────────────────────────────
create table if not exists public.onboarding_drafts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_type text not null check (account_type in ('brand', 'agency', 'business', 'creator', 'supplier')),
  current_step smallint not null default 1 check (current_step between 1 and 4),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 65536),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  workspace_id uuid references public.workspaces (id) on delete set null,
  supplier_id uuid references public.marketplace_suppliers (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_drafts enable row level security;

drop policy if exists "onboarding_drafts_own_select" on public.onboarding_drafts;
create policy "onboarding_drafts_own_select" on public.onboarding_drafts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "onboarding_drafts_own_insert" on public.onboarding_drafts;
create policy "onboarding_drafts_own_insert" on public.onboarding_drafts
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'in_progress' and workspace_id is null and supplier_id is null and completed_at is null);

drop policy if exists "onboarding_drafts_own_update" on public.onboarding_drafts;
create policy "onboarding_drafts_own_update" on public.onboarding_drafts
  for update to authenticated
  using (user_id = auth.uid() and status = 'in_progress')
  with check (user_id = auth.uid() and status = 'in_progress' and workspace_id is null and supplier_id is null and completed_at is null);

drop trigger if exists trg_onboarding_drafts_updated_at on public.onboarding_drafts;
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create trigger trg_onboarding_drafts_updated_at
  before update on public.onboarding_drafts
  for each row execute function public.touch_updated_at();

-- Transactional, idempotent completion. Reads the caller's own draft (the
-- server action validates it with the shared schema first); the RPC enforces
-- the invariants that matter for security: owner = caller, starter plan,
-- unverified supplier, allowed enums, bounded lengths.
create or replace function public.complete_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  d public.onboarding_drafts%rowtype;
  v jsonb;
  v_name text;
  v_ws uuid;
  v_sup uuid;
  v_brand uuid;
  v_ws_type text;
  v_tone text;
  v_colors text[];
  inv jsonb;
  v_invites int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into d from public.onboarding_drafts where user_id = v_uid for update;
  if not found then
    raise exception 'no onboarding in progress' using errcode = 'P0002';
  end if;
  if d.status = 'completed' then
    return jsonb_build_object('account_type', d.account_type, 'workspace_id', d.workspace_id, 'supplier_id', d.supplier_id, 'already_completed', true);
  end if;

  v := d.data;

  if d.account_type = 'supplier' then
    v_name := btrim(coalesce(v ->> 'company_name', ''));
    if length(v_name) < 2 or length(v_name) > 120 then
      raise exception 'company name is required' using errcode = '22023';
    end if;
    if coalesce(v ->> 'supplier_type', '') not in ('freelancer', 'ugc_creator', 'ads_manager', 'agency', 'influencer') then
      raise exception 'supplier type is required' using errcode = '22023';
    end if;

    select id into v_sup from public.marketplace_suppliers where user_id = v_uid;
    if v_sup is null then
      insert into public.marketplace_suppliers (user_id, slug, display_name, type)
      values (v_uid, public.slug_with_suffix(v_name), v_name, v ->> 'supplier_type')
      returning id into v_sup;
    end if;

    update public.marketplace_suppliers set
      display_name = v_name,
      type = v ->> 'supplier_type',
      headline = nullif(left(btrim(coalesce(v ->> 'headline', '')), 140), ''),
      bio = nullif(left(btrim(coalesce(v ->> 'description', '')), 1000), ''),
      website_url = nullif(left(btrim(coalesce(v ->> 'website', '')), 300), ''),
      location = nullif(left(btrim(coalesce(v ->> 'location', '')), 120), ''),
      country = nullif(left(btrim(coalesce(v ->> 'country', '')), 80), ''),
      tags = public.jsonb_text_array(v -> 'service_categories', 12, 40),
      regions_served = public.jsonb_text_array(v -> 'regions_served', 12, 40),
      deliverables = public.jsonb_text_array(v -> 'deliverables', 16, 60),
      turnaround_hours = case when (v ->> 'turnaround_hours') ~ '^[0-9]{1,4}$' then (v ->> 'turnaround_hours')::int else null end,
      portfolio_urls = public.jsonb_text_array(v -> 'portfolio_public_urls', 12, 500),
      available_now = coalesce((v ->> 'available_now')::boolean, true),
      lead_time_days = case when (v ->> 'lead_time_days') ~ '^[0-9]{1,3}$' then (v ->> 'lead_time_days')::int else null end,
      capacity = nullif(left(btrim(coalesce(v ->> 'capacity', '')), 40), ''),
      contact_preference = nullif(left(btrim(coalesce(v ->> 'contact_preference', '')), 40), ''),
      status = case when coalesce((v ->> 'publish_profile')::boolean, false) then 'active' else 'paused' end
    where id = v_sup;
  else
    v_ws_type := case d.account_type when 'business' then 'small_business' else d.account_type end;
    v_name := btrim(coalesce(
      case d.account_type
        when 'creator' then v ->> 'display_name'
        when 'business' then v ->> 'business_name'
        when 'brand' then v ->> 'brand_name'
        when 'agency' then v ->> 'agency_name'
      end, ''));
    if length(v_name) < 2 or length(v_name) > 120 then
      raise exception 'workspace name is required' using errcode = '22023';
    end if;

    insert into public.workspaces (name, slug, type, plan, plan_status, owner_id, website_url, industry, content_goals, logo_url, settings)
    values (
      v_name,
      public.slug_with_suffix(v_name),
      v_ws_type,
      'starter',
      'trialing',
      v_uid,
      nullif(left(btrim(coalesce(v ->> 'website', '')), 300), ''),
      nullif(left(btrim(coalesce(v ->> 'industry', '')), 80), ''),
      nullif(public.jsonb_text_array(v -> 'goals', 8, 60), '{}'),
      nullif(left(coalesce(v ->> 'logo_public_url', ''), 500), ''),
      jsonb_build_object(
        'account_type', d.account_type,
        'onboarding', v - 'invites' - 'logo' - 'brand_assets' - 'avatar' - 'portfolio',
        'onboarded_at', now()
      )
    )
    returning id into v_ws;
    -- on_workspace_created adds the owner membership.

    v_colors := array(
      select c from unnest(public.jsonb_text_array(v -> 'brand_colors', 6, 7)) c where c ~ '^#[0-9a-fA-F]{6}$'
    );

    insert into public.brands (workspace_id, name, slug, logo_url, industry, website_url, primary_color, secondary_color, description, is_default)
    values (
      v_ws, v_name, public.slug_with_suffix(v_name),
      nullif(left(coalesce(v ->> 'logo_public_url', ''), 500), ''),
      nullif(left(btrim(coalesce(v ->> 'industry', '')), 80), ''),
      nullif(left(btrim(coalesce(v ->> 'website', '')), 300), ''),
      coalesce(v_colors[1], '#1769FF'),
      v_colors[2],
      nullif(left(btrim(coalesce(v ->> 'description', v ->> 'bio', '')), 1000), ''),
      true
    )
    returning id into v_brand;

    if d.account_type = 'brand' then
      v_tone := nullif(btrim(coalesce(v ->> 'tone', '')), '');
      insert into public.brand_voice_profiles (brand_id, workspace_id, tones, style_rules)
      values (v_brand, v_ws, case when v_tone is null then '{}' else array[v_tone] end,
              nullif(left(btrim(coalesce(v ->> 'key_messaging', '')), 500), ''))
      on conflict (brand_id) do nothing;
      insert into public.brand_guidelines (brand_id, workspace_id, hex_colors)
      values (v_brand, v_ws, v_colors)
      on conflict (brand_id) do nothing;
    end if;

    if d.account_type in ('business', 'agency') and jsonb_typeof(v -> 'invites') = 'array' then
      for inv in select * from jsonb_array_elements(v -> 'invites') limit 10 loop
        if (inv ->> 'email') ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
           and lower(inv ->> 'email') <> v_email
           and coalesce(inv ->> 'role', '') in ('admin', 'manager', 'member', 'viewer') then
          insert into public.team_invitations (workspace_id, email, role, token, invited_by, expires_at)
          values (v_ws, lower(left(inv ->> 'email', 254)), inv ->> 'role',
                  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
                  v_uid, now() + interval '14 days');
          v_invites := v_invites + 1;
        end if;
      end loop;
    end if;
  end if;

  update public.onboarding_drafts
     set status = 'completed', workspace_id = v_ws, supplier_id = v_sup, completed_at = now()
   where user_id = v_uid;

  update public.profiles
     set onboarding_completed = true,
         account_type = d.account_type,
         default_workspace_id = coalesce(v_ws, default_workspace_id),
         avatar_url = coalesce(nullif(left(coalesce(v ->> 'avatar_public_url', ''), 500), ''), avatar_url),
         bio = coalesce(nullif(left(btrim(coalesce(v ->> 'bio', '')), 280), ''), bio)
   where id = v_uid;

  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (v_ws, v_uid, 'onboarding.completed',
          case when v_sup is not null then 'marketplace_supplier' else 'workspace' end,
          coalesce(v_ws, v_sup),
          jsonb_build_object('account_type', d.account_type, 'invites_created', v_invites));

  return jsonb_build_object('account_type', d.account_type, 'workspace_id', v_ws, 'supplier_id', v_sup, 'already_completed', false);
end;
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ── 7. private onboarding uploads (owner folder = auth.uid()) ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('onboarding-uploads', 'onboarding-uploads', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "onboarding_uploads_own_select" on storage.objects;
create policy "onboarding_uploads_own_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'onboarding-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "onboarding_uploads_own_insert" on storage.objects;
create policy "onboarding_uploads_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'onboarding-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "onboarding_uploads_own_update" on storage.objects;
create policy "onboarding_uploads_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'onboarding-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'onboarding-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "onboarding_uploads_own_delete" on storage.objects;
create policy "onboarding_uploads_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'onboarding-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
