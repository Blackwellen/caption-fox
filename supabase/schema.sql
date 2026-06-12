-- Caption Fox — Full Supabase Schema v2
-- Run this in Supabase SQL Editor or via CLI: supabase db push
-- Requires: auth.users table (provided by Supabase Auth)

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  bio text,
  job_title text,
  is_platform_admin boolean not null default false,
  mfa_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  timezone text default 'UTC',
  notification_preferences jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_self" on public.profiles for all using (auth.uid() = id);

-- ============================================================
-- WORKSPACES
-- ============================================================
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  type text not null default 'creator' check (type in ('creator','small_business','brand','agency')),
  plan text not null default 'starter' check (plan in ('starter','creator_pro','team','brand','enterprise')),
  plan_status text not null default 'trialing' check (plan_status in ('trialing','active','past_due','cancelled','paused')),
  trial_ends_at timestamptz,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  logo_url text,
  website_url text,
  industry text,
  content_goals text[],
  settings jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create policy "workspace_member_access" on public.workspaces for select using (
  id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "workspace_owner_write" on public.workspaces for all using (owner_id = auth.uid());

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table public.workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','manager','member','viewer','ugc_creator')),
  permissions jsonb default '{}',
  invited_by uuid references public.profiles(id),
  invited_at timestamptz,
  joined_at timestamptz default now(),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);
alter table public.workspace_members enable row level security;
create policy "members_in_workspace" on public.workspace_members for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "members_admin_write" on public.workspace_members for all using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  )
);

-- ============================================================
-- TEAM INVITATIONS
-- ============================================================
create table public.team_invitations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','admin','manager','member','viewer','ugc_creator')),
  token text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.team_invitations enable row level security;
create policy "invitations_admin_manage" on public.team_invitations for all using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  )
);
-- Allow token lookup for accepting invitations (unauthenticated or new user)
create policy "invitations_token_lookup" on public.team_invitations for select using (true);
create index idx_team_invitations_token on public.team_invitations(token);

-- ============================================================
-- BRANDS
-- ============================================================
create table public.brands (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  logo_url text,
  cover_url text,
  industry text,
  website_url text,
  primary_color text default '#2563EB',
  secondary_color text,
  description text,
  is_default boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, slug)
);
alter table public.brands enable row level security;
create policy "brands_workspace" on public.brands for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- BRAND VOICE PROFILES
-- ============================================================
create table public.brand_voice_profiles (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tones text[] default '{}',
  style_rules text,
  do_not_use text[],
  example_captions text[],
  competitor_avoid text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id)
);
alter table public.brand_voice_profiles enable row level security;
create policy "voice_workspace" on public.brand_voice_profiles for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- BRAND GUIDELINES
-- ============================================================
create table public.brand_guidelines (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  do_use text[],
  dont_use text[],
  fonts text[],
  hex_colors text[],
  image_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id)
);
alter table public.brand_guidelines enable row level security;
create policy "brand_guidelines_workspace" on public.brand_guidelines for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- SOCIAL CHANNELS
-- ============================================================
create table public.social_channels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  platform text not null check (platform in ('instagram','tiktok','linkedin','facebook','x','youtube','pinterest','threads')),
  account_name text not null,
  account_id text,
  profile_url text,
  avatar_url text,
  follower_count integer default 0,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  is_active boolean default true,
  connected_at timestamptz default now(),
  created_at timestamptz not null default now()
);
alter table public.social_channels enable row level security;
create policy "channels_workspace" on public.social_channels for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','live','paused','completed','archived')),
  objective text,
  start_date date,
  end_date date,
  budget numeric(10,2),
  actual_spend numeric(10,2),
  currency text default 'GBP',
  roi numeric(10,4),
  target_reach integer,
  target_engagement_rate numeric(5,4),
  hashtag text,
  mood_board_urls text[],
  tags text[],
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy "campaigns_workspace" on public.campaigns for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- CAMPAIGN TASKS
-- ============================================================
create table public.campaign_tasks (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date timestamptz,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaign_tasks enable row level security;
create policy "tasks_workspace" on public.campaign_tasks for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- CONTENT POSTS
-- ============================================================
create table public.content_posts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  channel_id uuid references public.social_channels(id) on delete set null,
  title text,
  caption text,
  hashtags text[],
  platforms text[] default '{}',
  post_type text default 'post' check (post_type in ('post','reel','story','carousel','short','thread','pin')),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','scheduled','published','failed','archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  media_urls text[],
  thumbnail_url text,
  approval_required boolean default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  boosted boolean default false,
  boost_budget numeric(10,2),
  first_comment text,
  collaboration_handle text,
  location text,
  link_in_bio_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_posts enable row level security;
create policy "posts_workspace" on public.content_posts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_content_posts_workspace on public.content_posts(workspace_id);
create index idx_content_posts_scheduled on public.content_posts(scheduled_at) where status = 'scheduled';

-- ============================================================
-- POST VERSIONS
-- ============================================================
create table public.post_versions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.content_posts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version_number integer not null,
  caption text,
  hashtags text[],
  platforms text[],
  status text,
  changed_by uuid references public.profiles(id) on delete set null,
  change_note text,
  created_at timestamptz not null default now()
);
alter table public.post_versions enable row level security;
create policy "post_versions_workspace" on public.post_versions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_post_versions_post on public.post_versions(post_id, version_number);

-- ============================================================
-- POST COMMENTS (internal team comments)
-- ============================================================
create table public.post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.content_posts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  parent_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.post_comments enable row level security;
create policy "post_comments_workspace" on public.post_comments for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_post_comments_post on public.post_comments(post_id, created_at);

-- ============================================================
-- PUBLISHING QUEUE
-- ============================================================
create table public.publishing_queue (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid not null references public.content_posts(id) on delete cascade,
  channel_id uuid not null references public.social_channels(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled')),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.publishing_queue enable row level security;
create policy "publishing_queue_workspace" on public.publishing_queue for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_publishing_queue_scheduled on public.publishing_queue(workspace_id, scheduled_at) where status = 'queued';

-- ============================================================
-- CONTENT TEMPLATES
-- ============================================================
create table public.content_templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  description text,
  caption_template text,
  platforms text[] default '{}',
  post_type text default 'post' check (post_type in ('post','reel','story','carousel','short','thread','pin')),
  hashtags text[],
  is_global boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.content_templates enable row level security;
create policy "content_templates_workspace" on public.content_templates for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_content_templates_workspace on public.content_templates(workspace_id);

-- ============================================================
-- CONTENT IDEAS
-- ============================================================
create table public.content_ideas (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  title text not null,
  description text,
  platforms text[] default '{}',
  status text not null default 'idea' check (status in ('idea','saved','converted')),
  ai_generated boolean not null default false,
  source text,
  converted_to_post_id uuid references public.content_posts(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.content_ideas enable row level security;
create policy "content_ideas_workspace" on public.content_ideas for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_content_ideas_workspace_status on public.content_ideas(workspace_id, status);

-- ============================================================
-- HASHTAG SETS
-- ============================================================
create table public.hashtag_sets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  hashtags text[] not null default '{}',
  platform text,
  avg_reach integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.hashtag_sets enable row level security;
create policy "hashtag_sets_workspace" on public.hashtag_sets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- Hashtag Manager — extended columns (idempotent migration)
alter table public.hashtag_sets
  add column if not exists description text,
  add column if not exists platforms text[] default '{}',
  add column if not exists category text default 'general',
  add column if not exists avg_reach_estimate integer,
  add column if not exists usage_count integer default 0,
  add column if not exists is_favorite boolean default false,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_hashtag_sets_workspace on public.hashtag_sets(workspace_id);
create index if not exists idx_hashtag_sets_category on public.hashtag_sets(workspace_id, category);
create index if not exists idx_hashtag_sets_favorite on public.hashtag_sets(workspace_id, is_favorite) where is_favorite = true;

-- ============================================================
-- MEDIA ASSETS
-- ============================================================
create table public.media_assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  file_type text not null,
  file_size integer,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  tags text[] default '{}',
  alt_text text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.media_assets enable row level security;
create policy "media_workspace" on public.media_assets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- AI GENERATIONS
-- (merged with ai_usage_logs — mode + action columns added here)
-- ============================================================
create table public.ai_generations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  mode text,
  action text,
  platform text,
  tone text,
  topic text,
  output text,
  prompt_tokens integer,
  completion_tokens integer,
  status text default 'draft' check (status in ('draft','used','discarded')),
  created_at timestamptz not null default now()
);
alter table public.ai_generations enable row level security;
create policy "ai_gen_workspace" on public.ai_generations for all using (
  user_id = auth.uid() or
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_ai_generations_workspace on public.ai_generations(workspace_id, created_at desc);

-- ============================================================
-- APPROVALS
-- ============================================================
create table public.approvals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid references public.content_posts(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.approvals enable row level security;
create policy "approvals_workspace" on public.approvals for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- UGC BRIEFS
-- ============================================================
create table public.ugc_briefs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','open','in_production','completed','cancelled')),
  platforms text[] default '{}',
  deliverables text,
  budget numeric(10,2),
  currency text default 'GBP',
  deadline date,
  max_creators integer,
  do_instructions text,
  dont_instructions text,
  example_urls text[],
  hashtag text,
  tag_handle text,
  required_elements text[],
  prohibited_elements text[],
  usage_rights text check (usage_rights in ('licensed','exclusive','perpetual')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ugc_briefs enable row level security;
create policy "ugc_briefs_workspace" on public.ugc_briefs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- UGC CREATORS
-- ============================================================
create table public.ugc_creators (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  email text,
  handle text,
  platform text,
  follower_count integer,
  niche text,
  country text,
  rate_per_video numeric(10,2),
  currency text default 'GBP',
  portfolio_urls text[],
  notes text,
  status text default 'active' check (status in ('active','paused','blocked')),
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.ugc_creators enable row level security;
create policy "creators_workspace" on public.ugc_creators for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- UGC SUBMISSIONS
-- ============================================================
create table public.ugc_submissions (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references public.ugc_briefs(id) on delete cascade,
  creator_id uuid not null references public.ugc_creators(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','in_review','approved','rejected','revision_requested','published')),
  submission_url text,
  media_urls text[],
  notes text,
  feedback text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ugc_submissions enable row level security;
create policy "submissions_workspace" on public.ugc_submissions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- UGC PAYMENTS (V1.5 — table exists, no API yet)
-- ============================================================
create table public.ugc_payments (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.ugc_submissions(id) on delete cascade,
  creator_id uuid not null references public.ugc_creators(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending','processing','paid','failed')),
  payment_method text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.ugc_payments enable row level security;
create policy "ugc_payments_workspace" on public.ugc_payments for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- COMPETITOR TRACKING (V1.5 — table exists, no API yet)
-- ============================================================
create table public.competitor_tracking (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  competitor_name text not null,
  platform text not null,
  handle text,
  url text,
  follower_count_snapshot integer,
  engagement_rate_snapshot numeric(5,4),
  tracked_since date,
  notes text,
  last_checked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.competitor_tracking enable row level security;
create policy "competitor_tracking_workspace" on public.competitor_tracking for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_competitor_tracking_workspace on public.competitor_tracking(workspace_id);

-- ============================================================
-- INTEGRATIONS
-- ============================================================
create table public.integrations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('slack','zapier','notion','hubspot')),
  is_active boolean not null default false,
  config jsonb default '{}',
  connected_at timestamptz,
  connected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(workspace_id, provider)
);
alter table public.integrations enable row level security;
create policy "integrations_admin" on public.integrations for all using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  )
);

-- ============================================================
-- WEBHOOK LOGS
-- ============================================================
create table public.webhook_logs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  source text not null,
  event_type text not null,
  payload jsonb,
  status text not null default 'received' check (status in ('received','processed','failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.webhook_logs enable row level security;
create policy "webhook_logs_admin" on public.webhook_logs for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  )
);
-- Platform (service-role) can insert webhook logs without auth context
create policy "webhook_logs_service_insert" on public.webhook_logs for insert with check (true);
create index idx_webhook_logs_workspace on public.webhook_logs(workspace_id, created_at desc);
create index idx_webhook_logs_status on public.webhook_logs(status, created_at desc);

-- ============================================================
-- INBOX THREADS
-- ============================================================
create table public.inbox_threads (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.social_channels(id) on delete set null,
  external_thread_id text,
  type text not null default 'comment' check (type in ('comment','dm','mention','review','email')),
  platform text,
  sender_name text,
  sender_handle text,
  sender_avatar text,
  content text,
  status text default 'open' check (status in ('open','assigned','resolved','spam','done')),
  sentiment text check (sentiment in ('positive','neutral','negative')),
  assigned_to uuid references public.profiles(id),
  is_read boolean default false,
  requires_reply boolean default true,
  external_post_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inbox_threads enable row level security;
create policy "threads_workspace" on public.inbox_threads for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_inbox_workspace on public.inbox_threads(workspace_id, status, created_at desc);

-- ============================================================
-- INBOX MESSAGES (thread replies / history)
-- ============================================================
create table public.inbox_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null,
  sender_type text default 'internal' check (sender_type in ('external','internal','ai_draft')),
  sent_by uuid references public.profiles(id),
  sent_at timestamptz default now(),
  approved_by uuid references public.profiles(id),
  is_ai_generated boolean default false
);
alter table public.inbox_messages enable row level security;
create policy "messages_workspace" on public.inbox_messages for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- SAVED REPLIES
-- ============================================================
create table public.saved_replies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  content text not null,
  category text,
  platforms text[],
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.saved_replies enable row level security;
create policy "saved_replies_workspace" on public.saved_replies for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- POST ANALYTICS
-- ============================================================
create table public.post_analytics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.content_posts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  recorded_at timestamptz not null default now(),
  impressions integer default 0,
  reach integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  clicks integer default 0,
  video_views integer default 0,
  video_watch_time_seconds integer default 0,
  profile_visits integer default 0,
  engagement_rate numeric(5,4),
  raw_data jsonb
);
alter table public.post_analytics enable row level security;
create policy "analytics_workspace" on public.post_analytics for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- CHANNEL ANALYTICS (daily rollups)
-- ============================================================
create table public.channel_analytics (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references public.social_channels(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  date date not null,
  follower_count integer default 0,
  follower_change integer default 0,
  total_impressions integer default 0,
  total_reach integer default 0,
  total_engagement integer default 0,
  average_engagement_rate numeric(5,4),
  posts_published integer default 0,
  unique(channel_id, date)
);
alter table public.channel_analytics enable row level security;
create policy "channel_analytics_workspace" on public.channel_analytics for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "notifications_self" on public.notifications for all using (user_id = auth.uid());
create index idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "audit_admin_read" on public.audit_logs for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  )
);
create index idx_audit_workspace on public.audit_logs(workspace_id, created_at desc);
create index idx_audit_actor on public.audit_logs(actor_id, created_at desc);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan text not null,
  status text not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions_owner" on public.subscriptions for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  )
);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
create table public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  subject text not null,
  category text,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
create policy "tickets_platform_admin" on public.support_tickets for all using (
  auth.uid() in (select id from public.profiles where is_platform_admin = true)
);
-- Anyone can insert a ticket (contact form)
create policy "tickets_insert_public" on public.support_tickets for insert with check (true);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','workspaces','workspace_members','brands','brand_voice_profiles',
    'brand_guidelines','campaigns','campaign_tasks','content_posts','approvals',
    'ugc_briefs','ugc_submissions','inbox_threads','subscriptions','support_tickets'
  ]) loop
    execute format('
      create trigger trg_%s_updated_at before update on public.%s
      for each row execute function public.handle_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- TRIGGER: create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SOCIAL LISTENING
-- ============================================================

create table if not exists public.listening_keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  keyword text not null,
  match_type text default 'contains' check (match_type in ('exact','contains','hashtag','mention')),
  platforms text[] default '{}',
  is_active boolean default true,
  alert_enabled boolean default true,
  alert_threshold integer default 10,
  color text default '#3B82F6',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.brand_mentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  keyword_id uuid references public.listening_keywords(id) on delete set null,
  platform text not null,
  author_name text,
  author_handle text,
  author_followers integer,
  content text not null,
  url text,
  media_url text,
  sentiment text default 'neutral' check (sentiment in ('positive','neutral','negative')),
  sentiment_score numeric,
  is_read boolean default false,
  is_starred boolean default false,
  is_actioned boolean default false,
  assigned_to uuid references public.profiles(id),
  reach_estimate integer,
  engagement_count integer default 0,
  mentioned_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.listening_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  keyword_id uuid references public.listening_keywords(id) on delete cascade,
  alert_type text default 'volume_spike' check (alert_type in ('volume_spike','negative_sentiment','viral','competitor_mention','new_mention')),
  title text not null,
  message text,
  is_read boolean default false,
  triggered_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS
alter table public.listening_keywords enable row level security;
alter table public.brand_mentions enable row level security;
alter table public.listening_alerts enable row level security;

create policy "listening_keywords_workspace" on public.listening_keywords using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "brand_mentions_workspace" on public.brand_mentions using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "listening_alerts_workspace" on public.listening_alerts using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create index if not exists idx_brand_mentions_workspace_sentiment on public.brand_mentions(workspace_id, sentiment);
create index if not exists idx_brand_mentions_workspace_date on public.brand_mentions(workspace_id, mentioned_at desc);
create index if not exists idx_brand_mentions_keyword on public.brand_mentions(keyword_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 104857600, array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('brand-assets', 'brand-assets', true, 20971520, array['image/jpeg','image/png','image/svg+xml','image/webp'])
on conflict (id) do nothing;

-- Storage RLS: only workspace members can upload to media bucket
create policy "media_workspace_upload" on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid() is not null);

create policy "media_public_read" on storage.objects for select
  using (bucket_id in ('media','avatars','brand-assets'));

create policy "avatars_self_upload" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

-- ============================================================
-- INITIAL PLATFORM ADMIN (update with your user ID after signup)
-- ============================================================
-- UPDATE public.profiles SET is_platform_admin = true WHERE email = 'jamahlthomas1996@gmail.com';

-- ============================================================
-- CAMPAIGNS: add campaign_type column
-- ============================================================
alter table public.campaigns add column if not exists campaign_type text default 'standard'
  check (campaign_type in (
    'standard','product_launch','brand_awareness','giveaway','competition',
    'ugc','influencer','seasonal','event','lead_gen','retargeting','partnership'
  ));

-- ============================================================
-- GIVEAWAYS
-- ============================================================
create table public.giveaways (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','active','ended','cancelled','archived')),
  start_date timestamptz,
  end_date timestamptz,
  platform text check (platform in ('instagram','tiktok','x','facebook','youtube','multi')),
  prize_title text not null,
  prize_description text,
  prize_value numeric,
  prize_currency text not null default 'GBP',
  prize_quantity integer not null default 1,
  entry_methods text[] not null default '{}'
    check (entry_methods <@ array[
      'follow','like','comment','share','tag_friend','repost','story_share',
      'email_signup','website_visit','purchase','hashtag_post','form_fill'
    ]::text[]),
  entry_hashtag text,
  entry_post_url text,
  max_entries_per_person integer not null default 1,
  min_followers_required integer not null default 0,
  eligible_countries text[] not null default '{}',
  terms_url text,
  rules text,
  winner_count integer not null default 1,
  winner_selection text not null default 'random'
    check (winner_selection in ('random','manual')),
  winners_announced_at timestamptz,
  announcement_post_url text,
  total_entries integer not null default 0,
  total_unique_participants integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.giveaways enable row level security;
create policy "giveaways_workspace" on public.giveaways for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_giveaways_workspace on public.giveaways(workspace_id, status);
create index idx_giveaways_campaign on public.giveaways(campaign_id);

-- ============================================================
-- GIVEAWAY ENTRIES
-- ============================================================
create table public.giveaway_entries (
  id uuid primary key default uuid_generate_v4(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  participant_handle text,
  participant_platform_id text,
  participant_email text,
  entry_method text,
  entry_data jsonb,
  is_valid boolean not null default true,
  is_winner boolean not null default false,
  disqualified_reason text,
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.giveaway_entries enable row level security;
create policy "giveaway_entries_workspace" on public.giveaway_entries for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_giveaway_entries_winner on public.giveaway_entries(giveaway_id, is_winner);
create index idx_giveaway_entries_entered on public.giveaway_entries(giveaway_id, entered_at desc);

-- ============================================================
-- COMPETITIONS
-- ============================================================
create table public.competitions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  title text not null,
  description text,
  competition_type text not null default 'photo'
    check (competition_type in ('photo','video','caption','design','essay','recipe','art','vote','quiz')),
  status text not null default 'draft'
    check (status in ('draft','open','judging','completed','cancelled','archived')),
  start_date timestamptz,
  end_date timestamptz,
  submission_deadline timestamptz,
  platform text,
  entry_hashtag text,
  prize_title text,
  prize_description text,
  prize_value numeric,
  prize_currency text not null default 'GBP',
  prizes jsonb not null default '[]',
  rules text,
  terms_url text,
  judging_criteria jsonb not null default '[]',
  judging_type text not null default 'panel'
    check (judging_type in ('panel','public_vote','hybrid')),
  max_submissions_per_person integer not null default 1,
  min_age integer,
  eligible_countries text[],
  require_follow boolean not null default false,
  require_hashtag boolean not null default false,
  submission_count integer not null default 0,
  vote_count integer not null default 0,
  winner_announced_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.competitions enable row level security;
create policy "competitions_workspace" on public.competitions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_competitions_workspace on public.competitions(workspace_id, status);
create index idx_competitions_campaign on public.competitions(campaign_id);

-- ============================================================
-- COMPETITION SUBMISSIONS
-- ============================================================
create table public.competition_submissions (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  participant_handle text,
  participant_platform_id text,
  participant_email text,
  submission_url text,
  submission_text text,
  media_urls text[] not null default '{}',
  vote_count integer not null default 0,
  judge_scores jsonb not null default '{}',
  average_score numeric,
  rank integer,
  status text not null default 'pending'
    check (status in ('pending','approved','disqualified','winner','runner_up')),
  disqualified_reason text,
  is_winner boolean not null default false,
  winner_place integer,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.competition_submissions enable row level security;
create policy "competition_submissions_workspace" on public.competition_submissions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_competition_submissions_votes on public.competition_submissions(competition_id, vote_count desc);
create index idx_competition_submissions_winner on public.competition_submissions(competition_id, is_winner);

-- ============================================================
-- COMPETITION JUDGES
-- ============================================================
create table public.competition_judges (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  role text not null default 'judge'
    check (role in ('lead_judge','judge','guest')),
  assigned_submissions integer not null default 0,
  completed_reviews integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.competition_judges enable row level security;
create policy "competition_judges_workspace" on public.competition_judges for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index idx_competition_judges_competition on public.competition_judges(competition_id);

-- ============================================================
-- TRIGGERS: updated_at — giveaways, competitions, competition_submissions
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'giveaways','competitions','competition_submissions'
  ]) loop
    execute format('
      create trigger trg_%s_updated_at before update on public.%s
      for each row execute function public.handle_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- COMPETITOR TRACKING
-- ============================================================
create table if not exists public.competitor_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete set null,
  competitor_name text not null,
  website_url text,
  platforms jsonb default '{}',
  notes text,
  is_active boolean default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references public.competitor_profiles(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) not null,
  platform text not null,
  follower_count integer,
  following_count integer,
  post_count integer,
  avg_likes integer,
  avg_comments integer,
  avg_shares integer,
  engagement_rate numeric,
  posting_frequency_per_week numeric,
  top_content_type text,
  estimated_reach integer,
  snapshotted_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- SCHEDULED REPORTS
-- ============================================================
create table if not exists public.scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  report_type text default 'analytics' check (report_type in ('analytics','campaigns','ugc','inbox','competitor','full')),
  frequency text default 'weekly' check (frequency in ('daily','weekly','monthly')),
  day_of_week integer,
  day_of_month integer,
  send_time time default '09:00',
  recipients text[] default '{}',
  include_sections text[] default '{}',
  date_range_days integer default 7,
  is_active boolean default true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.report_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.scheduled_reports(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) not null,
  sent_at timestamptz default now(),
  recipients text[],
  status text default 'sent' check (status in ('sent','failed','pending')),
  error_message text,
  created_at timestamptz default now()
);

-- RLS
alter table public.competitor_profiles enable row level security;
alter table public.competitor_snapshots enable row level security;
alter table public.scheduled_reports enable row level security;
alter table public.report_history enable row level security;

create policy "competitor_profiles_workspace" on public.competitor_profiles using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "competitor_snapshots_workspace" on public.competitor_snapshots using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "scheduled_reports_workspace" on public.scheduled_reports using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "report_history_workspace" on public.report_history using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- LINK IN BIO / LANDING PAGES
-- ============================================================
create table if not exists public.link_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete set null,
  slug text not null unique,
  title text not null,
  description text,
  avatar_url text,
  background_type text default 'color' check (background_type in ('color','gradient','image')),
  background_value text default '#0C1A2E',
  primary_color text default '#2563EB',
  button_style text default 'rounded' check (button_style in ('square','rounded','pill')),
  button_color text default '#2563EB',
  button_text_color text default '#FFFFFF',
  font_family text default 'inter',
  show_caption_fox_branding boolean default true,
  total_views integer default 0,
  total_clicks integer default 0,
  is_active boolean default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.link_page_items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.link_pages(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) not null,
  item_type text default 'link' check (item_type in ('link','header','divider','social','video','image','text')),
  title text,
  url text,
  thumbnail_url text,
  icon text,
  sort_order integer default 0,
  is_active boolean default true,
  click_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.link_pages enable row level security;
alter table public.link_page_items enable row level security;

create policy "link_pages_workspace" on public.link_pages using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create policy "link_page_items_workspace" on public.link_page_items using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create index if not exists idx_link_pages_workspace on public.link_pages(workspace_id);
create index if not exists idx_link_page_items_page on public.link_page_items(page_id, sort_order);

-- Caption Fox Schema v2 — complete
