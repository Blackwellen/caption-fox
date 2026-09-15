-- ============================================================
-- Campaign Manager -> Events module (shared across eligible workspace types)
--   /{type}/events
--   /{type}/events/events
--   /{type}/events/webinars
--   /{type}/events/podcasts
--   /{type}/events/sponsorships
--   /{type}/events/follow-up
--
-- Principles
--   1. Extend, do not duplicate. Events REFERENCE canonical records
--      (campaigns, brands, profiles, workspaces, integrations) rather than
--      copying them.
--   2. Every workspace-owned row carries workspace_id + RLS scoped through
--      workspace_members, matching the established Caption Fox policy shape.
--   3. Gala Dock is a CROSS-PRODUCT link, never a data owner. Only link records
--      and promotion state live here — no external credentials.
-- ============================================================

-- ------------------------------------------------------------
-- 1. EVENTS
-- ------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  name text not null,
  slug text,
  summary text,
  description text,

  event_type text not null default 'in_person'
    check (event_type in (
      'conference','summit','in_person','virtual','hybrid','webinar','podcast',
      'workshop','roundtable','product_launch','networking','live_stream',
      'customer_event','partner_event','internal_event'
    )),
  format text not null default 'in_person'
    check (format in ('in_person','virtual','hybrid')),

  status text not null default 'draft'
    check (status in ('draft','scheduled','upcoming','live','completed','cancelled','archived')),

  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'Europe/London',

  location_name text,
  location_city text,
  location_country text,
  online_platform text,
  online_url text,

  cover_image_url text,
  capacity integer,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  registration_url text,

  campaign_id uuid references public.campaigns(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,

  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,

  tags text[],
  is_demo boolean not null default false,
  metadata jsonb not null default '{}',

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_end_after_start check (end_at is null or start_at is null or end_at >= start_at),
  constraint events_capacity_positive check (capacity is null or capacity >= 0)
);

create unique index if not exists idx_events_workspace_slug
  on public.events(workspace_id, slug) where slug is not null;
create index if not exists idx_events_workspace_start on public.events(workspace_id, start_at desc);
create index if not exists idx_events_workspace_status on public.events(workspace_id, status);
create index if not exists idx_events_workspace_type on public.events(workspace_id, event_type);
create index if not exists idx_events_campaign on public.events(campaign_id);
create index if not exists idx_events_owner on public.events(owner_id);

-- ------------------------------------------------------------
-- 2. SESSIONS / RUN OF SHOW (shared by events, webinars, podcasts)
-- ------------------------------------------------------------
create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,

  title text not null,
  description text,
  session_type text not null default 'session'
    check (session_type in ('registration','keynote','session','demo','panel','break','networking','qa','closing','segment','sponsor_read','interview','intro','outro')),

  start_at timestamptz,
  end_at timestamptz,
  offset_seconds integer,
  position integer not null default 0,

  room text,
  channel text,
  status text not null default 'upcoming'
    check (status in ('draft','planned','upcoming','live','completed','delayed','cancelled')),
  is_public boolean not null default true,
  notes text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_sessions_end_after_start check (end_at is null or start_at is null or end_at >= start_at)
);
create index if not exists idx_event_sessions_event on public.event_sessions(event_id, position, start_at);
create index if not exists idx_event_sessions_workspace on public.event_sessions(workspace_id, start_at);

-- ------------------------------------------------------------
-- 3. SPEAKERS / HOSTS / GUESTS
-- ------------------------------------------------------------
create table if not exists public.event_speakers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  session_id uuid references public.event_sessions(id) on delete set null,

  full_name text not null,
  job_title text,
  company text,
  email text,
  avatar_url text,
  bio text,
  speaker_role text not null default 'speaker'
    check (speaker_role in ('host','speaker','guest','moderator','panellist','presenter')),
  confirmation_status text not null default 'invited'
    check (confirmation_status in ('invited','confirmed','declined','tentative')),
  position integer not null default 0,

  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_event_speakers_event on public.event_speakers(event_id, position);
create index if not exists idx_event_speakers_workspace on public.event_speakers(workspace_id);

-- ------------------------------------------------------------
-- 4. REGISTRATIONS + ATTENDANCE
--    Attendee identity is stored here because Caption Fox has no canonical
--    contacts table yet. `contact_id` is reserved (no FK) so a future CRM
--    contacts table can adopt these rows without a data migration.
-- ------------------------------------------------------------
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,

  contact_id uuid,
  full_name text not null,
  email text not null,
  company text,
  job_title text,
  avatar_url text,

  status text not null default 'registered'
    check (status in ('invited','registered','confirmed','waitlisted','cancelled','attended','no_show','checked_in')),
  ticket_type text,
  source text not null default 'manual'
    check (source in ('manual','import','form','campaign','integration','automation','portal')),

  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  attended boolean not null default false,
  watch_seconds integer,
  consent_marketing boolean not null default false,
  answers jsonb not null default '{}',

  follow_up_status text not null default 'not_contacted'
    check (follow_up_status in ('not_contacted','in_progress','waiting','completed','converted','excluded')),
  owner_id uuid references public.profiles(id) on delete set null,

  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, email)
);
create index if not exists idx_event_registrations_event on public.event_registrations(event_id, registered_at desc);
create index if not exists idx_event_registrations_workspace on public.event_registrations(workspace_id, registered_at desc);
create index if not exists idx_event_registrations_followup on public.event_registrations(workspace_id, follow_up_status);
create index if not exists idx_event_registrations_status on public.event_registrations(workspace_id, status);

-- ------------------------------------------------------------
-- 5. WEBINAR DETAIL (1:1 extension of an event of type 'webinar')
-- ------------------------------------------------------------
create table if not exists public.webinar_details (
  event_id uuid primary key references public.events(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  provider text not null default 'other'
    check (provider in ('zoom','teams','google_meet','webinarjam','demio','livestorm','youtube_live','other')),
  provider_webinar_id text,
  provider_connection_id uuid references public.integrations(id) on delete set null,
  provider_status text not null default 'not_connected'
    check (provider_status in ('not_connected','connected','error','expired')),

  topic text,
  join_url text,
  will_record boolean not null default false,
  recording_state text not null default 'none'
    check (recording_state in ('none','scheduled','recording','processing','available','failed')),
  recording_url text,

  avg_watch_seconds integer,
  questions_count integer not null default 0,
  polls_count integer not null default 0,
  last_synced_at timestamptz,
  sync_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_webinar_details_workspace on public.webinar_details(workspace_id);

create table if not exists public.webinar_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid references public.event_registrations(id) on delete set null,

  asked_by_name text,
  question text not null,
  status text not null default 'open'
    check (status in ('open','answered','dismissed')),
  answered_by uuid references public.profiles(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_webinar_questions_event on public.webinar_questions(event_id, created_at desc);

-- ------------------------------------------------------------
-- 6. PODCASTS
-- ------------------------------------------------------------
create table if not exists public.podcast_shows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  cover_image_url text,
  category text,
  rss_url text,
  distribution_provider text
    check (distribution_provider is null or distribution_provider in ('riverside','spotify','apple','youtube','buzzsprout','libsyn','transistor','captivate','rss','other')),
  provider_connection_id uuid references public.integrations(id) on delete set null,
  provider_status text not null default 'not_connected'
    check (provider_status in ('not_connected','connected','error','expired')),
  owner_id uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_podcast_shows_workspace on public.podcast_shows(workspace_id);

create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid references public.podcast_shows(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,

  episode_number integer,
  title text not null,
  summary text,
  show_notes text,
  cover_image_url text,

  status text not null default 'draft'
    check (status in ('draft','planned','scheduled','recording','recorded','editing','published','archived')),
  recording_type text not null default 'remote'
    check (recording_type in ('in_studio','remote','live','field')),
  studio_location text,
  recording_platform text,

  scheduled_at timestamptz,
  recorded_at timestamptz,
  published_at timestamptz,
  duration_seconds integer,

  distribution_state text not null default 'not_distributed'
    check (distribution_state in ('not_distributed','queued','published','failed')),
  distribution_url text,

  listens integer not null default 0,
  unique_listeners integer not null default 0,
  completion_rate numeric(5,4),

  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_podcast_episodes_workspace on public.podcast_episodes(workspace_id, scheduled_at desc);
create index if not exists idx_podcast_episodes_show on public.podcast_episodes(show_id, episode_number desc);
create index if not exists idx_podcast_episodes_status on public.podcast_episodes(workspace_id, status);

create table if not exists public.podcast_episode_guests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  full_name text not null,
  job_title text,
  company text,
  email text,
  avatar_url text,
  confirmation_status text not null default 'invited'
    check (confirmation_status in ('invited','confirmed','declined','tentative')),
  created_at timestamptz not null default now()
);
create index if not exists idx_podcast_guests_episode on public.podcast_episode_guests(episode_id);

create table if not exists public.podcast_listener_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid references public.podcast_shows(id) on delete cascade,
  episode_id uuid references public.podcast_episodes(id) on delete cascade,
  day date not null,
  listens integer not null default 0,
  unique_listeners integer not null default 0,
  completion_rate numeric(5,4),
  source text not null default 'provider',
  created_at timestamptz not null default now()
);
create unique index if not exists idx_podcast_listener_daily_key
  on public.podcast_listener_daily(workspace_id, day, coalesce(show_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(episode_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_podcast_listener_daily on public.podcast_listener_daily(workspace_id, day);

-- ------------------------------------------------------------
-- 7. SPONSORSHIPS
-- ------------------------------------------------------------
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  company_name text,
  logo_url text,
  website_url text,
  industry text,
  primary_contact_name text,
  primary_contact_email text,
  owner_id uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sponsors_workspace on public.sponsors(workspace_id, name);

create table if not exists public.sponsorship_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  tier text not null default 'bronze'
    check (tier in ('premier','platinum','gold','silver','bronze','community','custom')),
  list_price numeric(12,2),
  currency text not null default 'GBP',
  inventory integer,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sponsorship_packages_workspace on public.sponsorship_packages(workspace_id);

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  package_id uuid references public.sponsorship_packages(id) on delete set null,

  tier text not null default 'bronze'
    check (tier in ('premier','platinum','gold','silver','bronze','community','custom')),
  value numeric(12,2) not null default 0,
  currency text not null default 'GBP',

  stage text not null default 'prospect'
    check (stage in ('prospect','contacted','proposal','negotiation','verbal','contracted','active','completed','renewal','lost')),
  status text not null default 'in_progress'
    check (status in ('in_progress','active','completed','cancelled','lost')),

  proposal_sent_at timestamptz,
  contract_signed_at timestamptz,
  activation_start_at timestamptz,
  activation_end_at timestamptz,
  renewal_due_at timestamptz,
  payment_terms text,
  payment_status text not null default 'not_invoiced'
    check (payment_status in ('not_invoiced','invoiced','part_paid','paid','overdue','refunded')),
  paid_at timestamptz,

  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsorships_value_positive check (value >= 0)
);
create index if not exists idx_sponsorships_workspace on public.sponsorships(workspace_id, created_at desc);
create index if not exists idx_sponsorships_event on public.sponsorships(event_id);
create index if not exists idx_sponsorships_sponsor on public.sponsorships(sponsor_id);
create index if not exists idx_sponsorships_stage on public.sponsorships(workspace_id, stage);

create table if not exists public.sponsorship_deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sponsorship_id uuid not null references public.sponsorships(id) on delete cascade,

  title text not null,
  deliverable_type text not null default 'other'
    check (deliverable_type in ('logo_placement','speaking_slot','email_mention','social_post','booth','sponsored_session','podcast_read','hospitality','content_placement','other')),
  status text not null default 'planned'
    check (status in ('planned','in_progress','submitted','approved','completed','blocked','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sponsorship_deliverables_sponsorship on public.sponsorship_deliverables(sponsorship_id);
create index if not exists idx_sponsorship_deliverables_workspace on public.sponsorship_deliverables(workspace_id, status);

-- ------------------------------------------------------------
-- 8. FOLLOW-UP
-- ------------------------------------------------------------
create table if not exists public.event_followup_sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','active','paused','archived')),
  conversion_goal text,
  entry_rule jsonb not null default '{}',
  exit_rule jsonb not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_followup_sequences_workspace on public.event_followup_sequences(workspace_id, status);

create table if not exists public.event_followup_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null references public.event_followup_sequences(id) on delete cascade,
  position integer not null default 0,
  delay_days integer not null default 0,
  step_type text not null default 'email'
    check (step_type in ('email','task','delay','condition','assignment','notification','meeting_request','webhook')),
  title text not null,
  body text,
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_followup_steps_sequence on public.event_followup_steps(sequence_id, position);

create table if not exists public.event_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  sequence_id uuid references public.event_followup_sequences(id) on delete set null,
  registration_id uuid references public.event_registrations(id) on delete set null,

  title text not null,
  description text,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','waiting','completed','cancelled')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  position integer not null default 0,

  outcome text
    check (outcome is null or outcome in ('no_response','replied','meeting_booked','converted','declined')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_followup_tasks_workspace on public.event_followup_tasks(workspace_id, status, due_at);
create index if not exists idx_followup_tasks_event on public.event_followup_tasks(event_id);
create index if not exists idx_followup_tasks_owner on public.event_followup_tasks(owner_id, status);

create table if not exists public.event_outreach_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  sequence_id uuid references public.event_followup_sequences(id) on delete set null,
  registration_id uuid references public.event_registrations(id) on delete set null,
  task_id uuid references public.event_followup_tasks(id) on delete set null,

  outreach_type text not null
    check (outreach_type in ('email_sent','email_opened','email_replied','meeting_booked','converted','call_made','message_sent')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_outreach_events_workspace on public.event_outreach_events(workspace_id, occurred_at desc);
create index if not exists idx_outreach_events_type on public.event_outreach_events(workspace_id, outreach_type, occurred_at desc);

-- ------------------------------------------------------------
-- 9. ACTIVITY FEED
-- ------------------------------------------------------------
create table if not exists public.event_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,

  entity_type text not null
    check (entity_type in ('event','session','speaker','registration','webinar','question','podcast_show','podcast_episode','sponsor','sponsorship','deliverable','sequence','followup_task','gala_dock')),
  entity_id uuid,
  action text not null,
  summary text not null,
  href text,

  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_avatar_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_event_activity_workspace on public.event_activity(workspace_id, created_at desc);
create index if not exists idx_event_activity_event on public.event_activity(event_id, created_at desc);

-- ------------------------------------------------------------
-- 10. GALA DOCK CROSS-PRODUCT LINKS + PROMOTION STATE
--     No external credentials are ever stored here.
-- ------------------------------------------------------------
create table if not exists public.gala_dock_workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  gala_dock_workspace_id text,
  gala_dock_workspace_url text,
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected','pending','connected','error','revoked')),
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  last_synced_at timestamptz,
  sync_status text not null default 'idle'
    check (sync_status in ('idle','syncing','ok','error')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create table if not exists public.gala_dock_event_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  gala_dock_event_id text,
  gala_dock_event_url text,
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected','pending','connected','error','revoked')),
  sync_status text not null default 'idle'
    check (sync_status in ('idle','syncing','ok','error')),
  synced_fields text[],
  last_synced_at timestamptz,
  sync_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id)
);

create table if not exists public.gala_dock_promotion_dismissals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  placement text not null,
  dismissed_at timestamptz not null default now(),
  unique (workspace_id, user_id, placement)
);
create index if not exists idx_gala_dismissals_lookup
  on public.gala_dock_promotion_dismissals(workspace_id, user_id);

-- ------------------------------------------------------------
-- 11. ROW LEVEL SECURITY — workspace membership on every table
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'events','event_sessions','event_speakers','event_registrations',
    'webinar_details','webinar_questions',
    'podcast_shows','podcast_episodes','podcast_episode_guests','podcast_listener_daily',
    'sponsors','sponsorship_packages','sponsorships','sponsorship_deliverables',
    'event_followup_sequences','event_followup_steps','event_followup_tasks',
    'event_outreach_events','event_activity',
    'gala_dock_workspace_links','gala_dock_event_links'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_workspace', t);
    execute format(
      'create policy %I on public.%I for all using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))',
      t || '_workspace', t);
  end loop;
end $$;

-- Dismissals are per-user AND per-workspace: a member may only read/write their own.
alter table public.gala_dock_promotion_dismissals enable row level security;
drop policy if exists "gala_dock_promotion_dismissals_self" on public.gala_dock_promotion_dismissals;
create policy "gala_dock_promotion_dismissals_self" on public.gala_dock_promotion_dismissals for all
  using (
    user_id = auth.uid()
    and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 12. updated_at triggers
-- ------------------------------------------------------------
create or replace function public.events_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'events','event_sessions','event_speakers','event_registrations',
    'webinar_details','podcast_shows','podcast_episodes',
    'sponsors','sponsorship_packages','sponsorships','sponsorship_deliverables',
    'event_followup_sequences','event_followup_steps','event_followup_tasks',
    'gala_dock_workspace_links','gala_dock_event_links'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.events_touch_updated_at()',
      'trg_' || t || '_updated', t);
  end loop;
end $$;
