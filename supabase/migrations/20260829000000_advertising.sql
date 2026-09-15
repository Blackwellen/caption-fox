-- Caption Fox — Advertising module
-- Shared Campaign Manager > Advertising: connections, accounts, campaigns,
-- ad sets, creatives, audiences, normalised metrics, reports and activity.
--
-- Every table carries workspace_id and is RLS-scoped to workspace membership.
-- Provider credentials live in ad_connection_secrets, which has NO permissive
-- policy at all: only the service role (which bypasses RLS) can read them.

-- ============================================================
-- PROVIDER APPS  (bring-your-own OAuth client, one per workspace+provider)
--
-- Caption Fox ships no shared ad-platform app. Each workspace registers its own
-- developer app so quota and rate limits are isolated per customer. Client
-- secrets are encrypted at rest and never leave the server: the table is
-- service-role only, exactly like ad_connection_secrets.
-- ============================================================
create table public.ad_provider_apps (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('meta','google','tiktok','linkedin','pinterest','reddit','snapchat','x','microsoft','yahoo','amazon')),
  client_id text not null,
  client_secret_encrypted text not null,
  -- Extra provider-specific credentials (Google developer token, Microsoft
  -- developer token, Amazon profile scope, LinkedIn API version, ...).
  extra_encrypted jsonb,
  redirect_uri text not null,
  configured_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);
alter table public.ad_provider_apps enable row level security;
-- No policy on purpose: service-role only.
revoke all on public.ad_provider_apps from anon, authenticated;

-- Non-secret view of the same rows so the Accounts page can show which
-- providers a workspace has configured without ever exposing a secret.
create view public.ad_provider_app_status
with (security_invoker = true) as
  select id, workspace_id, provider, redirect_uri, configured_by, verified_at,
         last_error, created_at, updated_at,
         (client_id is not null and length(client_id) > 0) as has_client_id
  from public.ad_provider_apps;

-- OAuth state, so a callback can be tied back to the request that started it.
create table public.ad_oauth_states (
  state text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_verifier text,
  redirect_after text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ad_oauth_states enable row level security;
revoke all on public.ad_oauth_states from anon, authenticated;
create index idx_ad_oauth_states_expiry on public.ad_oauth_states(expires_at);

-- ============================================================
-- CONNECTIONS  (one row per workspace + provider authorisation)
-- ============================================================
create table public.ad_connections (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('meta','google','tiktok','linkedin','pinterest','reddit','snapchat','x','microsoft','yahoo','amazon')),
  status text not null default 'pending' check (status in ('pending','connected','attention','expired','error','disconnected')),
  external_business_id text,
  display_name text,
  scopes text[] not null default '{}',
  owner_user_id uuid references public.profiles(id) on delete set null,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  last_synced_at timestamptz,
  last_sync_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_business_id)
);
alter table public.ad_connections enable row level security;
create policy "ad_connections_workspace" on public.ad_connections for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_connections_workspace on public.ad_connections(workspace_id, provider);

-- Credentials. Deliberately unreadable through the anon/authenticated roles.
create table public.ad_connection_secrets (
  connection_id uuid primary key references public.ad_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ad_connection_secrets enable row level security;
-- No policy on purpose: service-role only. Client reads return zero rows.
revoke all on public.ad_connection_secrets from anon, authenticated;

-- ============================================================
-- AD ACCOUNTS
-- ============================================================
create table public.ad_accounts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid references public.ad_connections(id) on delete set null,
  provider text not null,
  external_id text not null,
  name text not null,
  currency text not null default 'GBP',
  timezone text not null default 'Europe/London',
  status text not null default 'active' check (status in ('active','paused','closed','unsettled')),
  sync_status text not null default 'pending' check (sync_status in ('pending','queued','syncing','synced','partial','warning','failed','expired','disconnected')),
  mapped_brand_id uuid references public.brands(id) on delete set null,
  mapping_label text,
  owner_user_id uuid references public.profiles(id) on delete set null,
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  last_sync_attempt_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_id)
);
alter table public.ad_accounts enable row level security;
create policy "ad_accounts_workspace" on public.ad_accounts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_accounts_workspace on public.ad_accounts(workspace_id, provider, sync_status);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table public.ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  provider text not null,
  external_id text,
  name text not null,
  objective text not null default 'conversions' check (objective in ('awareness','traffic','engagement','leads','app_installs','video_views','sales','conversions')),
  status text not null default 'draft' check (status in ('draft','active','learning','paused','completed','archived')),
  buying_type text,
  budget_amount numeric(14,2),
  budget_type text check (budget_type in ('daily','lifetime')),
  currency text not null default 'GBP',
  starts_at timestamptz,
  ends_at timestamptz,
  owner_user_id uuid references public.profiles(id) on delete set null,
  labels text[] not null default '{}',
  attribution_window text not null default '7d_click',
  provider_synced_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, external_id)
);
alter table public.ad_campaigns enable row level security;
create policy "ad_campaigns_workspace" on public.ad_campaigns for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_campaigns_workspace on public.ad_campaigns(workspace_id, status, provider);
create index idx_ad_campaigns_account on public.ad_campaigns(account_id);
create index idx_ad_campaigns_name_trgm on public.ad_campaigns using gin (name gin_trgm_ops);

-- ============================================================
-- AD SETS
-- ============================================================
create table public.ad_sets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  provider text not null,
  external_id text,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','learning','paused','completed','archived')),
  budget_amount numeric(14,2),
  budget_type text check (budget_type in ('daily','lifetime')),
  optimisation_goal text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, external_id)
);
alter table public.ad_sets enable row level security;
create policy "ad_sets_workspace" on public.ad_sets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_sets_campaign on public.ad_sets(campaign_id, status);

-- ============================================================
-- CREATIVES
-- ============================================================
create table public.ad_creatives (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  campaign_id uuid references public.ad_campaigns(id) on delete set null,
  ad_set_id uuid references public.ad_sets(id) on delete set null,
  parent_creative_id uuid references public.ad_creatives(id) on delete set null,
  provider text not null,
  external_id text,
  name text not null,
  format text not null default 'image' check (format in ('image','video','carousel','story','reel','display','text')),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  review_status text not null default 'not_submitted' check (review_status in ('not_submitted','under_review','approved','changes_requested','disapproved')),
  review_source text not null default 'internal' check (review_source in ('internal','provider')),
  provider_feedback text,
  internal_feedback text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  asset_path text,
  thumbnail_path text,
  aspect_ratio text,
  duration_seconds numeric(8,2),
  file_size_bytes bigint,
  mime_type text,
  headline text,
  body_text text,
  destination_url text,
  is_winning_variant boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ad_creatives enable row level security;
create policy "ad_creatives_workspace" on public.ad_creatives for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_creatives_workspace on public.ad_creatives(workspace_id, review_status, format);
create index idx_ad_creatives_campaign on public.ad_creatives(campaign_id);

-- ============================================================
-- AUDIENCES
-- ============================================================
create table public.ad_audiences (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid references public.ad_accounts(id) on delete cascade,
  provider text not null,
  external_id text,
  name text not null,
  audience_type text not null default 'custom' check (audience_type in ('custom','lookalike','website_visitors','engagers','crm_list','interest','video_viewers','customer_list','app_users')),
  description text,
  size_estimate bigint,
  matched_users bigint,
  match_rate numeric(5,2),
  recency_days integer,
  refresh_schedule text check (refresh_schedule in ('manual','daily','weekly','monthly')),
  refresh_status text not null default 'pending' check (refresh_status in ('pending','ready','refreshing','review','stale','failed')),
  status text not null default 'ready' check (status in ('ready','review','paused','archived')),
  source_file_path text,
  excluded_audience_id uuid references public.ad_audiences(id) on delete set null,
  last_refreshed_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ad_audiences enable row level security;
create policy "ad_audiences_workspace" on public.ad_audiences for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_audiences_workspace on public.ad_audiences(workspace_id, audience_type, status);

-- Many-to-many: which campaigns use which audience.
create table public.ad_audience_campaigns (
  audience_id uuid not null references public.ad_audiences(id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary key (audience_id, campaign_id)
);
alter table public.ad_audience_campaigns enable row level security;
create policy "ad_audience_campaigns_workspace" on public.ad_audience_campaigns for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- Measured overlap between two audiences. Percentages are computed, never invented.
create table public.ad_audience_overlaps (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audience_a_id uuid not null references public.ad_audiences(id) on delete cascade,
  audience_b_id uuid not null references public.ad_audiences(id) on delete cascade,
  overlap_users bigint not null default 0,
  overlap_pct numeric(5,2),
  measured_at timestamptz not null default now(),
  is_estimate boolean not null default true,
  check (audience_a_id <> audience_b_id),
  unique (audience_a_id, audience_b_id)
);
alter table public.ad_audience_overlaps enable row level security;
create policy "ad_audience_overlaps_workspace" on public.ad_audience_overlaps for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- NORMALISED DAILY METRICS
-- One row per entity per day. entity_type keeps the table generic so the
-- report layer can group by account / campaign / ad set / creative / audience.
-- ============================================================
create table public.ad_metrics_daily (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  entity_type text not null check (entity_type in ('account','campaign','ad_set','creative','audience')),
  entity_id uuid not null,
  provider text not null,
  metric_date date not null,
  currency text not null default 'GBP',
  attribution_window text not null default '7d_click',
  spend numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric(14,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  video_views bigint not null default 0,
  video_3s_views bigint not null default 0,
  engagements bigint not null default 0,
  is_estimated boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, metric_date, attribution_window)
);
alter table public.ad_metrics_daily enable row level security;
create policy "ad_metrics_daily_workspace" on public.ad_metrics_daily for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_metrics_lookup on public.ad_metrics_daily(workspace_id, entity_type, metric_date);
create index idx_ad_metrics_entity on public.ad_metrics_daily(entity_id, metric_date);

-- ============================================================
-- SYNC RUNS + ISSUES
-- ============================================================
create table public.ad_sync_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid references public.ad_connections(id) on delete cascade,
  account_id uuid references public.ad_accounts(id) on delete cascade,
  provider text not null,
  scope text not null default 'full' check (scope in ('full','incremental','metrics','entities','audiences','creatives')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  triggered_by uuid references public.profiles(id) on delete set null,
  trigger_source text not null default 'manual' check (trigger_source in ('manual','schedule','webhook','connect')),
  idempotency_key text unique,
  records_written integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.ad_sync_runs enable row level security;
create policy "ad_sync_runs_workspace" on public.ad_sync_runs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_sync_runs_workspace on public.ad_sync_runs(workspace_id, created_at desc);

create table public.ad_issues (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid references public.ad_connections(id) on delete cascade,
  account_id uuid references public.ad_accounts(id) on delete cascade,
  campaign_id uuid references public.ad_campaigns(id) on delete cascade,
  creative_id uuid references public.ad_creatives(id) on delete cascade,
  provider text,
  severity text not null default 'warning' check (severity in ('critical','warning','info')),
  issue_type text not null check (issue_type in ('auth_expired','scope_missing','sync_failed','rate_limited','budget_threshold','creative_disapproved','audience_refresh_failed','currency_mismatch','performance_change','account_disconnected','campaign_approved')),
  title text not null,
  detail text,
  required_action text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.ad_issues enable row level security;
create policy "ad_issues_workspace" on public.ad_issues for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_issues_open on public.ad_issues(workspace_id, resolved_at, severity);

-- ============================================================
-- ACTIVITY / AUDIT
-- ============================================================
create table public.ad_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  entity_label text,
  provider text,
  summary text not null,
  before_value jsonb,
  after_value jsonb,
  source_route text,
  created_at timestamptz not null default now()
);
alter table public.ad_activity enable row level security;
create policy "ad_activity_workspace_read" on public.ad_activity for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "ad_activity_workspace_insert" on public.ad_activity for insert with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_activity_workspace on public.ad_activity(workspace_id, created_at desc);

-- ============================================================
-- REPORTS
-- ============================================================
create table public.ad_report_presets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  config jsonb not null default '{}',
  is_shared boolean not null default false,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
alter table public.ad_report_presets enable row level security;
create policy "ad_report_presets_workspace" on public.ad_report_presets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  and (is_shared or created_by = auth.uid())
);
create index idx_ad_report_presets_workspace on public.ad_report_presets(workspace_id);

create table public.ad_scheduled_reports (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  preset_id uuid references public.ad_report_presets(id) on delete set null,
  name text not null,
  cadence text not null default 'weekly' check (cadence in ('daily','weekly','monthly','quarterly')),
  send_at_hour integer not null default 8 check (send_at_hour between 0 and 23),
  timezone text not null default 'Europe/London',
  recipients text[] not null default '{}',
  format text not null default 'pdf' check (format in ('pdf','csv','xlsx')),
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('succeeded','failed','skipped')),
  last_run_error text,
  next_run_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ad_scheduled_reports enable row level security;
create policy "ad_scheduled_reports_workspace" on public.ad_scheduled_reports for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create table public.ad_report_exports (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  preset_id uuid references public.ad_report_presets(id) on delete set null,
  scheduled_report_id uuid references public.ad_scheduled_reports(id) on delete set null,
  name text not null,
  format text not null default 'csv' check (format in ('pdf','csv','xlsx')),
  status text not null default 'pending' check (status in ('pending','running','ready','failed','expired')),
  storage_path text,
  row_count integer,
  filters jsonb not null default '{}',
  error_message text,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz
);
alter table public.ad_report_exports enable row level security;
create policy "ad_report_exports_workspace" on public.ad_report_exports for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ad_report_exports_workspace on public.ad_report_exports(workspace_id, created_at desc);
