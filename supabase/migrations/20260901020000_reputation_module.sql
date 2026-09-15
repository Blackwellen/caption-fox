-- ============================================================
-- Caption Fox — PR & Reputation module
-- Media Contacts/Outlets/Lists, Pitches + Recipients, Press
-- Releases + Room Assets, Coverage Mentions, Reviews + Responses,
-- Crisis Incidents + Timeline + Statements.
-- Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- MEDIA OUTLETS
-- ============================================================
create table if not exists public.media_outlets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  domain text,
  outlet_type text not null default 'online'
    check (outlet_type in ('online','print','broadcast','podcast','newsletter','blog','trade')),
  region text,
  topics text[] not null default '{}',
  estimated_audience bigint,
  authority_score numeric(5,2),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_outlets enable row level security;
drop policy if exists "media_outlets_workspace" on public.media_outlets;
create policy "media_outlets_workspace" on public.media_outlets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_media_outlets_workspace on public.media_outlets(workspace_id, outlet_type);

-- ============================================================
-- MEDIA CONTACTS
-- ============================================================
create table if not exists public.media_contacts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outlet_id uuid references public.media_outlets(id) on delete set null,
  name text not null,
  email text,
  phone text,
  role_title text,
  beat text,
  region text,
  relationship_stage text not null default 'new'
    check (relationship_stage in ('new','contacted','engaged','warm','champion','cold','do_not_contact')),
  influence_score numeric(5,2) not null default 0,
  tags text[] not null default '{}',
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','import','ai_suggested')),
  verified boolean not null default false,
  last_contacted_at timestamptz,
  last_reply_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_contacts enable row level security;
drop policy if exists "media_contacts_workspace" on public.media_contacts;
create policy "media_contacts_workspace" on public.media_contacts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_media_contacts_workspace on public.media_contacts(workspace_id, relationship_stage);
create index if not exists idx_media_contacts_outlet on public.media_contacts(outlet_id);
create index if not exists idx_media_contacts_owner on public.media_contacts(owner_id);

-- ============================================================
-- MEDIA LISTS + MEMBERS
-- ============================================================
create table if not exists public.media_lists (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  region text,
  beat text,
  status text not null default 'active' check (status in ('active','archived')),
  tags text[] not null default '{}',
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_lists enable row level security;
drop policy if exists "media_lists_workspace" on public.media_lists;
create policy "media_lists_workspace" on public.media_lists for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_media_lists_workspace on public.media_lists(workspace_id, status);

create table if not exists public.media_list_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id uuid not null references public.media_lists(id) on delete cascade,
  media_contact_id uuid not null references public.media_contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  constraint media_list_members_unique unique (list_id, media_contact_id)
);
alter table public.media_list_members enable row level security;
drop policy if exists "media_list_members_workspace" on public.media_list_members;
create policy "media_list_members_workspace" on public.media_list_members for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_media_list_members_list on public.media_list_members(list_id);
create index if not exists idx_media_list_members_contact on public.media_list_members(media_contact_id);

-- ============================================================
-- PITCHES + RECIPIENTS
-- ============================================================
create table if not exists public.pitches (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id uuid references public.media_lists(id) on delete set null,
  name text not null,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','scheduled','sending','sent','paused','completed','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  scheduled_at timestamptz,
  sent_at timestamptz,
  tags text[] not null default '{}',
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pitches enable row level security;
drop policy if exists "pitches_workspace" on public.pitches;
create policy "pitches_workspace" on public.pitches for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_pitches_workspace on public.pitches(workspace_id, status);
create index if not exists idx_pitches_owner on public.pitches(owner_id);

create table if not exists public.pitch_recipients (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pitch_id uuid not null references public.pitches(id) on delete cascade,
  media_contact_id uuid not null references public.media_contacts(id) on delete cascade,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','sent','delivered','opened','replied','bounced','placed')),
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  placed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pitch_recipients_unique unique (pitch_id, media_contact_id)
);
alter table public.pitch_recipients enable row level security;
drop policy if exists "pitch_recipients_workspace" on public.pitch_recipients;
create policy "pitch_recipients_workspace" on public.pitch_recipients for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_pitch_recipients_pitch on public.pitch_recipients(pitch_id, delivery_status);
create index if not exists idx_pitch_recipients_contact on public.pitch_recipients(media_contact_id);

-- ============================================================
-- PRESS RELEASES + ROOM ASSETS
-- ============================================================
create table if not exists public.press_releases (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  subtitle text,
  body text not null default '',
  category text,
  tags text[] not null default '{}',
  language text not null default 'en-GB',
  status text not null default 'draft' check (status in ('draft','in_review','approved','published','archived')),
  author_id uuid references public.profiles(id) on delete set null,
  publish_date date,
  downloads integer not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.press_releases enable row level security;
drop policy if exists "press_releases_workspace" on public.press_releases;
create policy "press_releases_workspace" on public.press_releases for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_press_releases_workspace on public.press_releases(workspace_id, status);

create table if not exists public.press_room_assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  asset_type text not null default 'other'
    check (asset_type in ('logo','headshot','product','document','other')),
  storage_path text,
  file_url text,
  mime_type text,
  size_bytes bigint,
  downloads integer not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.press_room_assets enable row level security;
drop policy if exists "press_room_assets_workspace" on public.press_room_assets;
create policy "press_room_assets_workspace" on public.press_room_assets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_press_room_assets_workspace on public.press_room_assets(workspace_id, asset_type);

-- ============================================================
-- COVERAGE MENTIONS
-- ============================================================
create table if not exists public.coverage_mentions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outlet_id uuid references public.media_outlets(id) on delete set null,
  publication text not null,
  headline text not null,
  url text,
  published_at timestamptz not null default now(),
  topic text,
  sentiment text not null default 'neutral' check (sentiment in ('positive','neutral','negative','mixed')),
  sentiment_confidence numeric(4,3),
  sentiment_override boolean not null default false,
  estimated_reach bigint,
  backlinks integer not null default 0,
  region text,
  source_type text not null default 'manual' check (source_type in ('manual','import','monitoring')),
  linked_pitch_id uuid references public.pitches(id) on delete set null,
  linked_press_release_id uuid references public.press_releases(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'tracked' check (status in ('tracked','verified','disputed','archived')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.coverage_mentions enable row level security;
drop policy if exists "coverage_mentions_workspace" on public.coverage_mentions;
create policy "coverage_mentions_workspace" on public.coverage_mentions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_coverage_mentions_workspace on public.coverage_mentions(workspace_id, published_at desc);
create index if not exists idx_coverage_mentions_sentiment on public.coverage_mentions(workspace_id, sentiment);

-- ============================================================
-- REVIEWS + RESPONSES
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null default 'manual'
    check (source in ('google','trustpilot','app_store','play_store','facebook','manual','other')),
  external_review_id text,
  reviewer_name text,
  rating numeric(3,1) not null default 0,
  review_text text,
  sentiment text not null default 'neutral' check (sentiment in ('positive','neutral','negative','mixed')),
  issue_type text,
  product_area text,
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'new' check (status in ('new','in_progress','responded','escalated','resolved','ignored')),
  source_url text,
  reviewed_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "reviews_workspace" on public.reviews;
create policy "reviews_workspace" on public.reviews for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_reviews_workspace on public.reviews(workspace_id, status);
create index if not exists idx_reviews_source on public.reviews(workspace_id, source);

create table if not exists public.review_responses (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  draft_text text not null default '',
  tone text not null default 'professional',
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','published')),
  author_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.review_responses enable row level security;
drop policy if exists "review_responses_workspace" on public.review_responses;
create policy "review_responses_workspace" on public.review_responses for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_review_responses_review on public.review_responses(review_id);

-- ============================================================
-- CRISIS INCIDENTS + TIMELINE + STATEMENTS
-- ============================================================
create table if not exists public.crisis_incidents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low','info')),
  status text not null default 'detected'
    check (status in ('detected','assessing','active_response','monitoring','recovering','resolved','archived')),
  source text,
  region text,
  channels text[] not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crisis_incidents enable row level security;
drop policy if exists "crisis_incidents_workspace" on public.crisis_incidents;
create policy "crisis_incidents_workspace" on public.crisis_incidents for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_crisis_incidents_workspace on public.crisis_incidents(workspace_id, status, severity);

create table if not exists public.crisis_timeline_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  incident_id uuid not null references public.crisis_incidents(id) on delete cascade,
  event_type text not null,
  summary text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.crisis_timeline_events enable row level security;
drop policy if exists "crisis_timeline_events_workspace" on public.crisis_timeline_events;
create policy "crisis_timeline_events_workspace" on public.crisis_timeline_events for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_crisis_timeline_incident on public.crisis_timeline_events(incident_id, created_at);

create table if not exists public.crisis_statements (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  incident_id uuid not null references public.crisis_incidents(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','legal_review','approved','published')),
  body text not null default '',
  version integer not null default 1,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crisis_statements enable row level security;
drop policy if exists "crisis_statements_workspace" on public.crisis_statements;
create policy "crisis_statements_workspace" on public.crisis_statements for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_crisis_statements_incident on public.crisis_statements(incident_id);
