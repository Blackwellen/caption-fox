-- ============================================================
-- Caption Fox — Campaign Manager: Messaging module
-- Omnichannel lifecycle messaging: Email, SMS, WhatsApp, RCS, Push, Journeys
-- and Templates. Contacts, consent, audiences, channel health, messages,
-- versions, journeys, participants, templates, daily metrics and a shared
-- Messaging activity feed. Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- MESSAGING CONTACTS
-- Phase 1 keeps consent as columns on the contact rather than a fully
-- separate consent-record table — documented in the implementation tracker.
-- ============================================================
create table if not exists public.messaging_contacts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  whatsapp_id text,
  push_token text,
  rcs_id text,
  tags text[] not null default '{}',
  region text,
  source text not null default 'manual' check (source in ('manual','import','api','signup','automation')),
  email_consent boolean not null default false,
  sms_consent boolean not null default false,
  whatsapp_consent boolean not null default false,
  push_consent boolean not null default false,
  rcs_consent boolean not null default false,
  unsubscribed_at timestamptz,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.messaging_contacts enable row level security;
drop policy if exists "messaging_contacts_workspace" on public.messaging_contacts;
create policy "messaging_contacts_workspace" on public.messaging_contacts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_contacts_workspace on public.messaging_contacts(workspace_id);
create index if not exists idx_messaging_contacts_email on public.messaging_contacts(workspace_id, email);

-- ============================================================
-- MESSAGING SUPPRESSIONS
-- Granular suppression reasons, kept separate from consent so a bounce or
-- complaint can suppress a channel without silently rewriting the contact's
-- original opt-in record.
-- ============================================================
create table if not exists public.messaging_suppressions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.messaging_contacts(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  reason text not null check (reason in (
    'unsubscribed','do_not_contact','hard_bounce','complaint','invalid_address',
    'invalid_phone','revoked_consent','invalid_token','legal','workspace'
  )),
  detail text,
  created_at timestamptz not null default now(),
  constraint messaging_suppressions_unique unique (workspace_id, contact_id, channel, reason)
);
alter table public.messaging_suppressions enable row level security;
drop policy if exists "messaging_suppressions_workspace" on public.messaging_suppressions;
create policy "messaging_suppressions_workspace" on public.messaging_suppressions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_suppressions_contact on public.messaging_suppressions(contact_id, channel);

-- ============================================================
-- MESSAGING AUDIENCES
-- ============================================================
create table if not exists public.messaging_audiences (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  segment_type text not null default 'static' check (segment_type in ('static','dynamic')),
  filter_definition jsonb not null default '{}',
  tags text[] not null default '{}',
  contact_count integer not null default 0,
  owner_id uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.messaging_audiences enable row level security;
drop policy if exists "messaging_audiences_workspace" on public.messaging_audiences;
create policy "messaging_audiences_workspace" on public.messaging_audiences for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_audiences_workspace on public.messaging_audiences(workspace_id, archived_at);

create table if not exists public.messaging_audience_members (
  audience_id uuid not null references public.messaging_audiences(id) on delete cascade,
  contact_id uuid not null references public.messaging_contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (audience_id, contact_id)
);
alter table public.messaging_audience_members enable row level security;
drop policy if exists "messaging_audience_members_workspace" on public.messaging_audience_members;
create policy "messaging_audience_members_workspace" on public.messaging_audience_members for all using (
  audience_id in (
    select id from public.messaging_audiences
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
) with check (
  audience_id in (
    select id from public.messaging_audiences
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
);

-- ============================================================
-- MESSAGING CHANNEL CONFIGS — one row per channel per workspace.
-- Backs the channel/provider health panels. The user connects real provider
-- credentials themselves; this table only tracks the resulting state.
-- ============================================================
create table if not exists public.messaging_channel_configs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  status text not null default 'not_connected' check (status in ('not_connected','connected','degraded','error')),
  provider text,
  config jsonb not null default '{}',
  connected_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_channel_configs_unique unique (workspace_id, channel)
);
alter table public.messaging_channel_configs enable row level security;
drop policy if exists "messaging_channel_configs_workspace" on public.messaging_channel_configs;
create policy "messaging_channel_configs_workspace" on public.messaging_channel_configs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_channel_configs_workspace on public.messaging_channel_configs(workspace_id);

-- ============================================================
-- MESSAGING TEMPLATES
-- ============================================================
create table if not exists public.messaging_templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  category text not null default 'lifecycle',
  status text not null default 'draft' check (status in ('draft','in_review','published','archived')),
  content jsonb not null default '{}',
  variables text[] not null default '{}',
  tags text[] not null default '{}',
  usage_count integer not null default 0,
  unique_recipients integer not null default 0,
  avg_reuse_rate numeric(6,2) not null default 0,
  ctr_uplift numeric(6,2),
  provider_template_id text,
  provider_status text,
  owner_id uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.messaging_templates enable row level security;
drop policy if exists "messaging_templates_workspace" on public.messaging_templates;
create policy "messaging_templates_workspace" on public.messaging_templates for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_templates_workspace on public.messaging_templates(workspace_id, channel, status);
create index if not exists idx_messaging_templates_updated on public.messaging_templates(workspace_id, updated_at desc);

create table if not exists public.messaging_template_versions (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references public.messaging_templates(id) on delete cascade,
  version_number integer not null,
  content jsonb not null default '{}',
  change_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint messaging_template_versions_unique unique (template_id, version_number)
);
alter table public.messaging_template_versions enable row level security;
drop policy if exists "messaging_template_versions_workspace" on public.messaging_template_versions;
create policy "messaging_template_versions_workspace" on public.messaging_template_versions for all using (
  template_id in (
    select id from public.messaging_templates
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
) with check (
  template_id in (
    select id from public.messaging_templates
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
);

-- ============================================================
-- MESSAGING JOURNEYS
-- Canvas graph (nodes/edges) stored as jsonb for Phase 1; node execution
-- reads this definition rather than maintaining a fully normalised node table.
-- ============================================================
create table if not exists public.messaging_journeys (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  journey_type text not null default 'lifecycle' check (journey_type in ('lifecycle','transactional','re_engagement','onboarding','other')),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  trigger jsonb not null default '{}',
  canvas jsonb not null default '{"nodes":[],"edges":[]}',
  audience_id uuid references public.messaging_audiences(id) on delete set null,
  contacts_in_flow integer not null default 0,
  total_entered integer not null default 0,
  on_track_rate numeric(5,2) not null default 0,
  conversion_rate numeric(5,2) not null default 0,
  health text not null default 'good' check (health in ('good','at_risk','critical')),
  version integer not null default 1,
  owner_id uuid references public.profiles(id) on delete set null,
  last_launch_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.messaging_journeys enable row level security;
drop policy if exists "messaging_journeys_workspace" on public.messaging_journeys;
create policy "messaging_journeys_workspace" on public.messaging_journeys for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_journeys_workspace on public.messaging_journeys(workspace_id, status);

create table if not exists public.messaging_journey_participants (
  id uuid primary key default uuid_generate_v4(),
  journey_id uuid not null references public.messaging_journeys(id) on delete cascade,
  contact_id uuid not null references public.messaging_contacts(id) on delete cascade,
  status text not null default 'active' check (status in ('active','waiting','converted','exited','failed','suppressed')),
  current_node_id text,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  metadata jsonb not null default '{}'
);
alter table public.messaging_journey_participants enable row level security;
drop policy if exists "messaging_journey_participants_workspace" on public.messaging_journey_participants;
create policy "messaging_journey_participants_workspace" on public.messaging_journey_participants for all using (
  journey_id in (
    select id from public.messaging_journeys
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
) with check (
  journey_id in (
    select id from public.messaging_journeys
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
);
create index if not exists idx_messaging_journey_participants_journey on public.messaging_journey_participants(journey_id, status);

-- ============================================================
-- MESSAGING MESSAGES
-- ============================================================
create table if not exists public.messaging_messages (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  name text not null,
  message_type text not null default 'broadcast' check (message_type in ('broadcast','journey','transactional','test')),
  status text not null default 'draft' check (status in ('draft','pending_approval','scheduled','sending','sent','paused','failed','cancelled')),
  sender_id text,
  subject text,
  content jsonb not null default '{}',
  audience_id uuid references public.messaging_audiences(id) on delete set null,
  journey_id uuid references public.messaging_journeys(id) on delete set null,
  template_id uuid references public.messaging_templates(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','changes_requested','rejected')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  converted_count integer not null default 0,
  opt_out_count integer not null default 0,
  failed_count integer not null default 0,
  owner_id uuid references public.profiles(id) on delete set null,
  version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.messaging_messages enable row level security;
drop policy if exists "messaging_messages_workspace" on public.messaging_messages;
create policy "messaging_messages_workspace" on public.messaging_messages for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_messages_workspace on public.messaging_messages(workspace_id, channel, status);
create index if not exists idx_messaging_messages_updated on public.messaging_messages(workspace_id, updated_at desc);
create index if not exists idx_messaging_messages_journey on public.messaging_messages(journey_id);

create table if not exists public.messaging_message_versions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.messaging_messages(id) on delete cascade,
  version_number integer not null,
  content jsonb not null default '{}',
  audience_snapshot jsonb not null default '{}',
  change_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint messaging_message_versions_unique unique (message_id, version_number)
);
alter table public.messaging_message_versions enable row level security;
drop policy if exists "messaging_message_versions_workspace" on public.messaging_message_versions;
create policy "messaging_message_versions_workspace" on public.messaging_message_versions for all using (
  message_id in (
    select id from public.messaging_messages
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
) with check (
  message_id in (
    select id from public.messaging_messages
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
);

-- Dispatch/delivery events feed message-level and channel-level analytics.
create table if not exists public.messaging_delivery_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id uuid references public.messaging_messages(id) on delete cascade,
  contact_id uuid references public.messaging_contacts(id) on delete set null,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  event_type text not null check (event_type in (
    'queued','accepted','sent','delivered','opened','read','clicked','replied',
    'converted','deferred','bounced','failed','rejected','complained','opted_out'
  )),
  provider_message_id text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
alter table public.messaging_delivery_events enable row level security;
drop policy if exists "messaging_delivery_events_workspace" on public.messaging_delivery_events;
create policy "messaging_delivery_events_workspace" on public.messaging_delivery_events for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_delivery_events_message on public.messaging_delivery_events(message_id, event_type);
create index if not exists idx_messaging_delivery_events_workspace on public.messaging_delivery_events(workspace_id, occurred_at desc);

-- ============================================================
-- MESSAGING METRICS DAILY (performance trend charts)
-- ============================================================
create table if not exists public.messaging_metrics_daily (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  metric_date date not null,
  sent integer not null default 0,
  delivered integer not null default 0,
  opened integer not null default 0,
  clicked integer not null default 0,
  converted integer not null default 0,
  opt_outs integer not null default 0,
  created_at timestamptz not null default now(),
  constraint messaging_metrics_daily_unique unique (workspace_id, channel, metric_date)
);
alter table public.messaging_metrics_daily enable row level security;
drop policy if exists "messaging_metrics_daily_workspace" on public.messaging_metrics_daily;
create policy "messaging_metrics_daily_workspace" on public.messaging_metrics_daily for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_metrics_daily_lookup on public.messaging_metrics_daily(workspace_id, metric_date desc);

-- ============================================================
-- MESSAGING ACTIVITY (shared feed across all eight surfaces)
-- ============================================================
create table if not exists public.messaging_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in (
    'message','journey','template','audience','contact','channel','system'
  )),
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.messaging_activity enable row level security;
drop policy if exists "messaging_activity_workspace" on public.messaging_activity;
create policy "messaging_activity_workspace" on public.messaging_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_activity_workspace on public.messaging_activity(workspace_id, created_at desc);
create index if not exists idx_messaging_activity_entity on public.messaging_activity(entity_type, entity_id);
