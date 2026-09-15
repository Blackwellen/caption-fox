-- ============================================================
-- CAPTION FOX — SHARED SOCIAL MODULE
-- Overview · Publishing · Engagement · Listening · Connections · Analytics
--
-- Extends the existing canonical tables (social_channels, content_posts,
-- publishing_queue, inbox_threads/messages, saved_replies, post_analytics,
-- channel_analytics, listening_keywords, brand_mentions, listening_alerts,
-- scheduled_reports) rather than duplicating them. New tables only cover
-- concepts with no existing home: sync runs, webhook events, connection
-- issues, publish attempts, listening topics/sources/alert rules,
-- audience metrics and analytics report presets.
--
-- Idempotent: safe to re-run and reproducible from a fresh database.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONNECTIONS — social_channels extensions
-- ------------------------------------------------------------
alter table public.social_channels add column if not exists handle text;
alter table public.social_channels add column if not exists account_type text;
alter table public.social_channels add column if not exists health text not null default 'healthy';
alter table public.social_channels add column if not exists granted_scopes text[] not null default '{}';
alter table public.social_channels add column if not exists required_scopes text[] not null default '{}';
alter table public.social_channels add column if not exists permission_mode text not null default 'read_write';
alter table public.social_channels add column if not exists team_label text;
alter table public.social_channels add column if not exists last_sync_at timestamptz;
alter table public.social_channels add column if not exists last_sync_status text;
alter table public.social_channels add column if not exists last_successful_sync_at timestamptz;
alter table public.social_channels add column if not exists token_status text not null default 'valid';
alter table public.social_channels add column if not exists disconnected_at timestamptz;
alter table public.social_channels add column if not exists connected_by uuid references public.profiles(id) on delete set null;
alter table public.social_channels add column if not exists is_demo boolean not null default false;
alter table public.social_channels add column if not exists updated_at timestamptz not null default now();

alter table public.social_channels drop constraint if exists social_channels_health_check;
alter table public.social_channels add constraint social_channels_health_check
  check (health in ('healthy','watch','warning','error','disconnected','syncing','expired'));
alter table public.social_channels drop constraint if exists social_channels_permission_mode_check;
alter table public.social_channels add constraint social_channels_permission_mode_check
  check (permission_mode in ('read_write','read_only'));
alter table public.social_channels drop constraint if exists social_channels_token_status_check;
alter table public.social_channels add constraint social_channels_token_status_check
  check (token_status in ('valid','expiring','expired','revoked','missing'));
alter table public.social_channels drop constraint if exists social_channels_account_type_check;
alter table public.social_channels add constraint social_channels_account_type_check
  check (account_type is null or account_type in ('business','creator','page','company_page','channel','profile','group'));

create index if not exists idx_social_channels_workspace_health
  on public.social_channels(workspace_id, health);

-- ------------------------------------------------------------
-- 2. CONNECTIONS — sync runs
-- ------------------------------------------------------------
create table if not exists public.social_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.social_channels(id) on delete cascade,
  kind text not null default 'incremental' check (kind in ('incremental','full','profile','insights','messages','webhook_backfill')),
  status text not null default 'running' check (status in ('running','success','partial','failed','cancelled')),
  trigger_source text not null default 'schedule' check (trigger_source in ('schedule','manual','webhook','reconnect')),
  records_synced integer not null default 0,
  error_type text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false
);
alter table public.social_sync_runs enable row level security;
create index if not exists idx_social_sync_runs_workspace on public.social_sync_runs(workspace_id, started_at desc);
create index if not exists idx_social_sync_runs_channel on public.social_sync_runs(channel_id, started_at desc);

-- ------------------------------------------------------------
-- 3. CONNECTIONS — webhook / activity events
-- ------------------------------------------------------------
create table if not exists public.social_webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.social_channels(id) on delete set null,
  provider text not null,
  event_type text not null,
  external_event_id text,
  summary text,
  status text not null default 'processed' check (status in ('received','processed','duplicate','failed','ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  is_demo boolean not null default false
);
alter table public.social_webhook_events enable row level security;
create unique index if not exists uq_social_webhook_events_external
  on public.social_webhook_events(provider, external_event_id) where external_event_id is not null;
create index if not exists idx_social_webhook_events_workspace
  on public.social_webhook_events(workspace_id, received_at desc);

-- ------------------------------------------------------------
-- 4. CONNECTIONS — issues and alerts
-- ------------------------------------------------------------
create table if not exists public.social_connection_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.social_channels(id) on delete cascade,
  issue_type text not null,
  severity text not null default 'warning' check (severity in ('info','warning','error')),
  message text not null,
  action_kind text,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  is_demo boolean not null default false
);
alter table public.social_connection_issues enable row level security;
create index if not exists idx_social_connection_issues_workspace
  on public.social_connection_issues(workspace_id, status, detected_at desc);

-- ------------------------------------------------------------
-- 5. PUBLISHING — content_posts extensions
-- ------------------------------------------------------------
alter table public.content_posts add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.content_posts add column if not exists timezone text not null default 'UTC';
alter table public.content_posts add column if not exists failure_summary text;
alter table public.content_posts add column if not exists is_demo boolean not null default false;

alter table public.content_posts drop constraint if exists content_posts_status_check;
alter table public.content_posts add constraint content_posts_status_check
  check (status in ('draft','pending_approval','approved','scheduled','queued','publishing',
                    'published','partially_published','failed','cancelled','archived'));

create index if not exists idx_content_posts_workspace_status
  on public.content_posts(workspace_id, status, scheduled_at);

-- ------------------------------------------------------------
-- 6. PUBLISHING — queue extensions and attempts
-- ------------------------------------------------------------
alter table public.publishing_queue add column if not exists idempotency_key text;
alter table public.publishing_queue add column if not exists failure_type text;
alter table public.publishing_queue add column if not exists provider_post_id text;
alter table public.publishing_queue add column if not exists provider_permalink text;
alter table public.publishing_queue add column if not exists next_attempt_at timestamptz;
alter table public.publishing_queue add column if not exists max_attempts integer not null default 5;
alter table public.publishing_queue add column if not exists cancelled_at timestamptz;
alter table public.publishing_queue add column if not exists is_demo boolean not null default false;

alter table public.publishing_queue drop constraint if exists publishing_queue_status_check;
alter table public.publishing_queue add constraint publishing_queue_status_check
  check (status in ('queued','processing','sent','failed','cancelled','skipped'));
alter table public.publishing_queue drop constraint if exists publishing_queue_failure_type_check;
alter table public.publishing_queue add constraint publishing_queue_failure_type_check
  check (failure_type is null or failure_type in ('authentication','permission','rate_limit','validation',
         'media_processing','provider_rejection','network','timeout','unknown'));

create unique index if not exists uq_publishing_queue_idempotency
  on public.publishing_queue(idempotency_key) where idempotency_key is not null;

create table if not exists public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  queue_id uuid not null references public.publishing_queue(id) on delete cascade,
  attempt_no integer not null default 1,
  status text not null check (status in ('success','failed','skipped')),
  failure_type text,
  error_message text,
  provider_post_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  is_demo boolean not null default false
);
alter table public.social_publish_attempts enable row level security;
create index if not exists idx_social_publish_attempts_queue
  on public.social_publish_attempts(queue_id, attempt_no);

-- ------------------------------------------------------------
-- 7. ENGAGEMENT — inbox_threads / inbox_messages / saved_replies
-- ------------------------------------------------------------
alter table public.inbox_threads add column if not exists priority text not null default 'normal';
alter table public.inbox_threads add column if not exists tags text[] not null default '{}';
alter table public.inbox_threads add column if not exists is_flagged boolean not null default false;
alter table public.inbox_threads add column if not exists flag_reason text;
alter table public.inbox_threads add column if not exists first_response_at timestamptz;
alter table public.inbox_threads add column if not exists resolved_at timestamptz;
alter table public.inbox_threads add column if not exists sla_target_minutes integer not null default 240;
alter table public.inbox_threads add column if not exists sla_state text not null default 'on_track';
alter table public.inbox_threads add column if not exists sentiment_source text not null default 'unset';
alter table public.inbox_threads add column if not exists sentiment_confidence numeric(4,3);
alter table public.inbox_threads add column if not exists sentiment_overridden_by uuid references public.profiles(id) on delete set null;
alter table public.inbox_threads add column if not exists sentiment_overridden_at timestamptz;
alter table public.inbox_threads add column if not exists related_post_id uuid references public.content_posts(id) on delete set null;
alter table public.inbox_threads add column if not exists is_demo boolean not null default false;

alter table public.inbox_threads drop constraint if exists inbox_threads_priority_check;
alter table public.inbox_threads add constraint inbox_threads_priority_check
  check (priority in ('low','normal','high','urgent'));
alter table public.inbox_threads drop constraint if exists inbox_threads_sla_state_check;
alter table public.inbox_threads add constraint inbox_threads_sla_state_check
  check (sla_state in ('on_track','warning','breached','met','paused'));
alter table public.inbox_threads drop constraint if exists inbox_threads_sentiment_source_check;
alter table public.inbox_threads add constraint inbox_threads_sentiment_source_check
  check (sentiment_source in ('unset','model','manual','provider'));

create index if not exists idx_inbox_threads_assigned on public.inbox_threads(workspace_id, assigned_to, status);
create index if not exists idx_inbox_threads_flagged on public.inbox_threads(workspace_id, is_flagged);

alter table public.inbox_messages add column if not exists is_internal_note boolean not null default false;
alter table public.inbox_messages add column if not exists provider_message_id text;
alter table public.inbox_messages add column if not exists delivery_status text not null default 'sent';
alter table public.inbox_messages add column if not exists failure_reason text;
alter table public.inbox_messages add column if not exists is_demo boolean not null default false;

alter table public.inbox_messages drop constraint if exists inbox_messages_delivery_status_check;
alter table public.inbox_messages add constraint inbox_messages_delivery_status_check
  check (delivery_status in ('pending','sent','failed'));
create index if not exists idx_inbox_messages_thread on public.inbox_messages(thread_id, sent_at);

alter table public.saved_replies add column if not exists is_shared boolean not null default true;
alter table public.saved_replies add column if not exists usage_count integer not null default 0;
alter table public.saved_replies add column if not exists archived_at timestamptz;
alter table public.saved_replies add column if not exists is_demo boolean not null default false;

-- ------------------------------------------------------------
-- 8. LISTENING — keyword and mention extensions
-- ------------------------------------------------------------
alter table public.listening_keywords add column if not exists topic text;
alter table public.listening_keywords add column if not exists is_demo boolean not null default false;

alter table public.brand_mentions add column if not exists source_type text not null default 'first_party';
alter table public.brand_mentions add column if not exists source_key text;
alter table public.brand_mentions add column if not exists country_code text;
alter table public.brand_mentions add column if not exists region text;
alter table public.brand_mentions add column if not exists topic text;
alter table public.brand_mentions add column if not exists priority text not null default 'low';
alter table public.brand_mentions add column if not exists engagement_rate numeric(6,4);
alter table public.brand_mentions add column if not exists author_avatar_url text;
alter table public.brand_mentions add column if not exists author_verified boolean not null default false;
alter table public.brand_mentions add column if not exists is_influencer boolean not null default false;
alter table public.brand_mentions add column if not exists is_demo boolean not null default false;

alter table public.brand_mentions drop constraint if exists brand_mentions_source_type_check;
alter table public.brand_mentions add constraint brand_mentions_source_type_check
  check (source_type in ('first_party','public_api','third_party','search_index','manual_import','estimated'));
alter table public.brand_mentions drop constraint if exists brand_mentions_priority_check;
alter table public.brand_mentions add constraint brand_mentions_priority_check
  check (priority in ('low','medium','high'));

create index if not exists idx_brand_mentions_priority on public.brand_mentions(workspace_id, priority, mentioned_at desc);
create index if not exists idx_brand_mentions_country on public.brand_mentions(workspace_id, country_code);

-- ------------------------------------------------------------
-- 9. LISTENING — topics, sources, alert rules
-- ------------------------------------------------------------
create table if not exists public.listening_topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null,
  summary text,
  mention_count integer not null default 0,
  growth_pct numeric(6,2),
  baseline_count integer not null default 0,
  window_start timestamptz not null default now(),
  window_end timestamptz not null default now(),
  computed_at timestamptz not null default now(),
  is_demo boolean not null default false
);
alter table public.listening_topics enable row level security;
create index if not exists idx_listening_topics_workspace on public.listening_topics(workspace_id, mention_count desc);

create table if not exists public.listening_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_key text not null,
  label text not null,
  source_type text not null default 'public_api',
  coverage_note text,
  mention_count integer not null default 0,
  share_pct numeric(6,2),
  is_enabled boolean not null default true,
  last_seen_at timestamptz,
  is_demo boolean not null default false,
  unique(workspace_id, source_key)
);
alter table public.listening_sources enable row level security;

create table if not exists public.listening_alert_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  keywords text[] not null default '{}',
  topics text[] not null default '{}',
  channels text[] not null default '{}',
  sources text[] not null default '{}',
  sentiments text[] not null default '{}',
  volume_threshold integer,
  reach_threshold integer,
  influencer_threshold integer,
  geography text[] not null default '{}',
  frequency text not null default 'realtime' check (frequency in ('realtime','hourly','daily','weekly')),
  recipients text[] not null default '{}',
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  is_active boolean not null default true,
  active_from timestamptz,
  active_to timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);
alter table public.listening_alert_rules enable row level security;
create index if not exists idx_listening_alert_rules_workspace on public.listening_alert_rules(workspace_id, is_active);

alter table public.listening_alerts add column if not exists rule_id uuid references public.listening_alert_rules(id) on delete set null;
alter table public.listening_alerts add column if not exists severity text not null default 'medium';
alter table public.listening_alerts add column if not exists status text not null default 'active';
alter table public.listening_alerts add column if not exists resolved_at timestamptz;
alter table public.listening_alerts add column if not exists is_demo boolean not null default false;

alter table public.listening_alerts drop constraint if exists listening_alerts_severity_check;
alter table public.listening_alerts add constraint listening_alerts_severity_check
  check (severity in ('low','medium','high'));
alter table public.listening_alerts drop constraint if exists listening_alerts_status_check;
alter table public.listening_alerts add constraint listening_alerts_status_check
  check (status in ('active','acknowledged','resolved'));
alter table public.listening_alerts drop constraint if exists listening_alerts_alert_type_check;
alter table public.listening_alerts add constraint listening_alerts_alert_type_check
  check (alert_type in ('volume_spike','negative_sentiment','viral','competitor_mention','new_mention',
                        'keyword_trend','influencer_mention','product_issue','crisis_risk','feature_feedback'));
create index if not exists idx_listening_alerts_workspace on public.listening_alerts(workspace_id, status, triggered_at desc);

-- ------------------------------------------------------------
-- 10. ANALYTICS — audience metrics and report presets
-- ------------------------------------------------------------
create table if not exists public.social_audience_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.social_channels(id) on delete cascade,
  date date not null,
  dimension text not null check (dimension in ('country','age','gender','city','language')),
  bucket text not null,
  value integer not null default 0,
  source text not null default 'provider_api',
  is_demo boolean not null default false,
  unique(workspace_id, channel_id, date, dimension, bucket)
);
alter table public.social_audience_metrics enable row level security;
create index if not exists idx_social_audience_metrics_lookup
  on public.social_audience_metrics(workspace_id, dimension, date desc);

create table if not exists public.social_report_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  config jsonb not null default '{}',
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);
alter table public.social_report_presets enable row level security;
create index if not exists idx_social_report_presets_workspace on public.social_report_presets(workspace_id);

alter table public.scheduled_reports add column if not exists preset_id uuid references public.social_report_presets(id) on delete set null;
alter table public.scheduled_reports add column if not exists format text not null default 'pdf';
alter table public.scheduled_reports add column if not exists timezone text not null default 'UTC';
alter table public.scheduled_reports add column if not exists is_demo boolean not null default false;

alter table public.scheduled_reports drop constraint if exists scheduled_reports_format_check;
alter table public.scheduled_reports add constraint scheduled_reports_format_check
  check (format in ('pdf','csv','xlsx'));
alter table public.scheduled_reports drop constraint if exists scheduled_reports_report_type_check;
alter table public.scheduled_reports add constraint scheduled_reports_report_type_check
  check (report_type in ('analytics','campaigns','ugc','inbox','competitor','full','social'));

alter table public.post_analytics add column if not exists is_demo boolean not null default false;
alter table public.channel_analytics add column if not exists is_demo boolean not null default false;
create index if not exists idx_post_analytics_workspace_date on public.post_analytics(workspace_id, recorded_at desc);
create index if not exists idx_channel_analytics_workspace_date on public.channel_analytics(workspace_id, date desc);

-- ------------------------------------------------------------
-- 11. RLS — workspace isolation for every new table
-- ------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'social_sync_runs','social_webhook_events','social_connection_issues',
    'social_publish_attempts','listening_topics','listening_sources',
    'listening_alert_rules','social_audience_metrics','social_report_presets'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_workspace', t);
    execute format(
      'create policy %I on public.%I for all using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))',
      t || '_workspace', t);
  end loop;
end $rls$;
