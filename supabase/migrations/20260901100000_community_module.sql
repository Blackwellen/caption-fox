-- ============================================================
-- Caption Fox — Community module
--
-- Workspace-scoped schema for the six Community surfaces (Overview,
-- Communities, Calendar, Moderation, Members, Advocacy). Every table is
-- scoped by workspace_id and RLS-protected the same way as every other
-- Campaign Manager module (workspace_members membership check on both
-- USING and WITH CHECK). Foreign keys rely on Postgres' default
-- `<table>_<column>_fkey` naming so the embedded-resource selects in
-- src/lib/community/data.ts (e.g. `profiles!communities_owner_id_fkey`)
-- resolve without any explicit constraint naming. Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- COMMUNITIES
-- ============================================================
create table if not exists public.communities (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  type text not null default 'brand'
    check (type in ('brand','product','support','creator','customer','beta','regional','interest')),
  privacy text not null default 'public' check (privacy in ('public','private','restricted')),
  status text not null default 'active' check (status in ('draft','active','paused','restricted','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  region text,
  tags text[] not null default '{}',
  cover_image_url text,
  member_count integer not null default 0,
  activity_level text not null default 'moderate' check (activity_level in ('low','moderate','high','very_high')),
  engagement_rate numeric(6,3) not null default 0,
  health_state text not null default 'good' check (health_state in ('excellent','good','average','needs_attention','critical')),
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
alter table public.communities enable row level security;
drop policy if exists "communities_workspace" on public.communities;
create policy "communities_workspace" on public.communities for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_communities_workspace_status on public.communities(workspace_id, status);
create index if not exists idx_communities_workspace_updated on public.communities(workspace_id, updated_at desc);
create index if not exists idx_communities_owner on public.communities(owner_id);
create index if not exists idx_communities_archived on public.communities(workspace_id, archived_at);

-- ============================================================
-- COMMUNITY MEMBERS
-- ============================================================
create table if not exists public.community_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  contact_id uuid,
  display_name text not null,
  avatar_url text,
  email text,
  role text not null default 'member'
    check (role in ('member','engaged_member','top_contributor','ambassador','moderator','admin')),
  lifecycle_stage text not null default 'new'
    check (lifecycle_stage in ('new','active','engaged','advocate','at_risk','inactive')),
  status text not null default 'active'
    check (status in ('active','at_risk','inactive','suspended','banned','archived')),
  engagement_score integer not null default 0 check (engagement_score between 0 and 100),
  advocacy_score integer not null default 0 check (advocacy_score between 0 and 100),
  posts_count integer not null default 0,
  comments_count integer not null default 0,
  is_demo boolean not null default false,
  joined_at timestamptz not null default now(),
  last_active_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_members enable row level security;
drop policy if exists "community_members_workspace" on public.community_members;
create policy "community_members_workspace" on public.community_members for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_community_members_workspace on public.community_members(workspace_id, status);
create index if not exists idx_community_members_community on public.community_members(community_id);
create index if not exists idx_community_members_engagement on public.community_members(workspace_id, engagement_score desc);
create index if not exists idx_community_members_advocacy on public.community_members(workspace_id, advocacy_score desc);
create index if not exists idx_community_members_archived on public.community_members(workspace_id, archived_at);

-- ============================================================
-- COMMUNITY MEMBERSHIP REQUESTS
-- ============================================================
create table if not exists public.community_membership_requests (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  applicant_name text not null,
  applicant_email text,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_demo boolean not null default false,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.community_membership_requests enable row level security;
drop policy if exists "community_membership_requests_workspace" on public.community_membership_requests;
create policy "community_membership_requests_workspace" on public.community_membership_requests for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_community_membership_requests_status on public.community_membership_requests(workspace_id, status);
create index if not exists idx_community_membership_requests_community on public.community_membership_requests(community_id);

-- ============================================================
-- COMMUNITY EVENTS (Calendar)
-- ============================================================
create table if not exists public.community_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  title text not null,
  type text not null default 'community_event'
    check (type in ('live_session','ama','qa','webinar','challenge','training','community_event')),
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Europe/London',
  location_or_url text,
  capacity integer,
  status text not null default 'confirmed' check (status in ('confirmed','pending','needs_approval','cancelled')),
  rsvp_count integer not null default 0,
  attendance_count integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_events enable row level security;
drop policy if exists "community_events_workspace" on public.community_events;
create policy "community_events_workspace" on public.community_events for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_community_events_workspace_starts on public.community_events(workspace_id, starts_at);
create index if not exists idx_community_events_community on public.community_events(community_id);
create index if not exists idx_community_events_status on public.community_events(workspace_id, status);

-- ============================================================
-- COMMUNITY EVENT REGISTRATIONS
-- ============================================================
create table if not exists public.community_event_registrations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.community_events(id) on delete cascade,
  member_id uuid references public.community_members(id) on delete set null,
  status text not null default 'registered' check (status in ('registered','waitlisted','cancelled')),
  attended boolean not null default false,
  registered_at timestamptz not null default now(),
  unique (event_id, member_id)
);
alter table public.community_event_registrations enable row level security;
drop policy if exists "community_event_registrations_workspace" on public.community_event_registrations;
create policy "community_event_registrations_workspace" on public.community_event_registrations for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_community_event_registrations_event on public.community_event_registrations(event_id);
create index if not exists idx_community_event_registrations_member on public.community_event_registrations(member_id);

-- ============================================================
-- COMMUNITY MODERATION REPORTS
-- ============================================================
create table if not exists public.community_moderation_reports (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  reported_member_id uuid references public.community_members(id) on delete set null,
  reporter_member_id uuid references public.community_members(id) on delete set null,
  content_excerpt text,
  content_type text not null default 'post'
    check (content_type in ('post','comment','message','profile','media','event')),
  reason text not null default 'other'
    check (reason in ('spam','hate_speech','harassment','off_topic','profanity','impersonation','violence_threats','misleading','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'new' check (status in ('new','in_review','escalated','resolved','dismissed','archived')),
  assignee_id uuid references public.profiles(id) on delete set null,
  ai_risk_score numeric(5,2),
  report_count integer not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.community_moderation_reports enable row level security;
drop policy if exists "community_moderation_reports_workspace" on public.community_moderation_reports;
create policy "community_moderation_reports_workspace" on public.community_moderation_reports for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_moderation_reports_workspace_status on public.community_moderation_reports(workspace_id, status);
create index if not exists idx_moderation_reports_community on public.community_moderation_reports(community_id);
create index if not exists idx_moderation_reports_assignee on public.community_moderation_reports(assignee_id);
create index if not exists idx_moderation_reports_reported_member on public.community_moderation_reports(reported_member_id);
create index if not exists idx_moderation_reports_created on public.community_moderation_reports(workspace_id, created_at desc);

-- ============================================================
-- COMMUNITY MODERATION DECISIONS
-- ============================================================
create table if not exists public.community_moderation_decisions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  report_id uuid not null references public.community_moderation_reports(id) on delete cascade,
  moderator_id uuid references public.profiles(id) on delete set null,
  decision text not null
    check (decision in ('approve','remove_content','warn_user','suspend_user','ban_user','escalate')),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.community_moderation_decisions enable row level security;
drop policy if exists "community_moderation_decisions_workspace" on public.community_moderation_decisions;
create policy "community_moderation_decisions_workspace" on public.community_moderation_decisions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_moderation_decisions_report on public.community_moderation_decisions(report_id);

-- ============================================================
-- COMMUNITY POLICIES (policy coverage panel)
-- ============================================================
create table if not exists public.community_policies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category text not null,
  description text not null default '',
  enforced boolean not null default true,
  coverage_pct numeric(5,2) not null default 0 check (coverage_pct between 0 and 100),
  created_at timestamptz not null default now(),
  unique (workspace_id, category)
);
alter table public.community_policies enable row level security;
drop policy if exists "community_policies_workspace" on public.community_policies;
create policy "community_policies_workspace" on public.community_policies for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- COMMUNITY ADVOCACY PROGRAMS
-- ============================================================
create table if not exists public.community_advocacy_programs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  name text not null,
  type text not null default 'ambassador'
    check (type in ('ambassador','referral','ugc','beta_insider','events','challenge')),
  status text not null default 'draft' check (status in ('draft','active','upcoming','completed','archived')),
  goal_metric text,
  goal_target numeric(12,2) not null default 0,
  goal_progress numeric(12,2) not null default 0,
  cover_image_url text,
  is_demo boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_advocacy_programs enable row level security;
drop policy if exists "community_advocacy_programs_workspace" on public.community_advocacy_programs;
create policy "community_advocacy_programs_workspace" on public.community_advocacy_programs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_advocacy_programs_workspace_status on public.community_advocacy_programs(workspace_id, status);
create index if not exists idx_advocacy_programs_community on public.community_advocacy_programs(community_id);

-- ============================================================
-- COMMUNITY ADVOCACY ENROLLMENTS (leaderboard rows)
-- ============================================================
create table if not exists public.community_advocacy_enrollments (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  program_id uuid not null references public.community_advocacy_programs(id) on delete cascade,
  member_id uuid not null references public.community_members(id) on delete cascade,
  tier text not null default 'member' check (tier in ('member','advocate','ambassador','super_advocate')),
  referrals_count integer not null default 0,
  ugc_posts_count integer not null default 0,
  points integer not null default 0,
  rewards_earned_cents integer not null default 0,
  advocacy_score integer not null default 0 check (advocacy_score between 0 and 100),
  status text not null default 'active' check (status in ('active','paused','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, member_id)
);
alter table public.community_advocacy_enrollments enable row level security;
drop policy if exists "community_advocacy_enrollments_workspace" on public.community_advocacy_enrollments;
create policy "community_advocacy_enrollments_workspace" on public.community_advocacy_enrollments for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_advocacy_enrollments_program on public.community_advocacy_enrollments(program_id);
create index if not exists idx_advocacy_enrollments_member on public.community_advocacy_enrollments(member_id);
create index if not exists idx_advocacy_enrollments_points on public.community_advocacy_enrollments(workspace_id, points desc);

-- ============================================================
-- COMMUNITY REWARDS
-- ============================================================
create table if not exists public.community_rewards (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enrollment_id uuid references public.community_advocacy_enrollments(id) on delete cascade,
  member_id uuid references public.community_members(id) on delete set null,
  reward_description text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','issued','redeemed')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.community_rewards enable row level security;
drop policy if exists "community_rewards_workspace" on public.community_rewards;
create policy "community_rewards_workspace" on public.community_rewards for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_rewards_workspace_status on public.community_rewards(workspace_id, status);
create index if not exists idx_rewards_enrollment on public.community_rewards(enrollment_id);

-- ============================================================
-- COMMUNITY ACTIVITY
-- ============================================================
create table if not exists public.community_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null default 'community',
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text,
  created_at timestamptz not null default now()
);
alter table public.community_activity enable row level security;
drop policy if exists "community_activity_workspace" on public.community_activity;
create policy "community_activity_workspace" on public.community_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_community_activity_workspace_created on public.community_activity(workspace_id, created_at desc);
create index if not exists idx_community_activity_community on public.community_activity(community_id);
create index if not exists idx_community_activity_entity on public.community_activity(entity_type);

-- ============================================================
-- updated_at maintenance — reuse the shared trigger function if one already
-- exists in this database (every other module defines it once); otherwise
-- define it here so this migration still applies cleanly on a fresh database.
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_communities_updated_at on public.communities;
create trigger trg_communities_updated_at before update on public.communities
  for each row execute function public.set_updated_at();

drop trigger if exists trg_community_members_updated_at on public.community_members;
create trigger trg_community_members_updated_at before update on public.community_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_community_events_updated_at on public.community_events;
create trigger trg_community_events_updated_at before update on public.community_events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_advocacy_programs_updated_at on public.community_advocacy_programs;
create trigger trg_advocacy_programs_updated_at before update on public.community_advocacy_programs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_advocacy_enrollments_updated_at on public.community_advocacy_enrollments;
create trigger trg_advocacy_enrollments_updated_at before update on public.community_advocacy_enrollments
  for each row execute function public.set_updated_at();
