-- ============================================================
-- Caption Fox — Campaign Manager: Campaigns module
-- Adds lifecycle/ownership/health fields to campaigns, plus templates,
-- milestones, phases, dependencies and a shared campaign activity feed.
-- Safe to re-run (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- Co-member profile visibility.
-- Owner avatars/names across Campaigns need to resolve profiles for other
-- members of the same workspace. The original policy only allowed self.
-- ------------------------------------------------------------
drop policy if exists "profiles_workspace_peers" on public.profiles;
create policy "profiles_workspace_peers" on public.profiles for select using (
  id = auth.uid()
  or id in (
    select wm.user_id from public.workspace_members wm
    where wm.workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  )
);

-- ============================================================
-- CAMPAIGN TEMPLATES
-- ============================================================
create table if not exists public.campaign_templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'standard',
  template_type text not null default 'multi_channel'
    check (template_type in ('multi_channel','single_channel','social_email','omnichannel','event','other')),
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','in_review','published','archived')),
  usage_count integer not null default 0,
  linked_workflows integer not null default 0,
  cover_url text,
  is_favourite boolean not null default false,
  channels text[] not null default '{}',
  default_budget numeric(12,2),
  default_duration_days integer,
  config jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaign_templates enable row level security;
drop policy if exists "campaign_templates_workspace" on public.campaign_templates;
create policy "campaign_templates_workspace" on public.campaign_templates for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_campaign_templates_workspace on public.campaign_templates(workspace_id, status);
create index if not exists idx_campaign_templates_owner on public.campaign_templates(owner_id);
create index if not exists idx_campaign_templates_updated on public.campaign_templates(workspace_id, updated_at desc);

-- ============================================================
-- CAMPAIGNS — lifecycle / ownership / delivery columns
-- ============================================================
alter table public.campaigns add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.campaigns add column if not exists lifecycle_stage text not null default 'planning';
alter table public.campaigns add column if not exists priority text not null default 'medium';
alter table public.campaigns add column if not exists health text not null default 'on_track';
alter table public.campaigns add column if not exists progress integer not null default 0;
alter table public.campaigns add column if not exists thumbnail_url text;
alter table public.campaigns add column if not exists template_id uuid references public.campaign_templates(id) on delete set null;
alter table public.campaigns add column if not exists approval_status text not null default 'not_required';
alter table public.campaigns add column if not exists archived_at timestamptz;
alter table public.campaigns add column if not exists channels text[] not null default '{}';
alter table public.campaigns add column if not exists engagements integer not null default 0;
alter table public.campaigns add column if not exists reach integer not null default 0;
alter table public.campaigns add column if not exists conversions integer not null default 0;
alter table public.campaigns add column if not exists launch_date date;

do $$ begin
  alter table public.campaigns add constraint campaigns_lifecycle_stage_check
    check (lifecycle_stage in ('planning','in_progress','in_review','scheduled','live','completed','at_risk','blocked','archived'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.campaigns add constraint campaigns_priority_check
    check (priority in ('low','medium','high','urgent'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.campaigns add constraint campaigns_health_check
    check (health in ('on_track','at_risk','overdue','blocked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.campaigns add constraint campaigns_approval_status_check
    check (approval_status in ('not_required','pending','approved','changes_requested','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.campaigns add constraint campaigns_progress_check
    check (progress >= 0 and progress <= 100);
exception when duplicate_object then null; end $$;

create index if not exists idx_campaigns_workspace_stage on public.campaigns(workspace_id, lifecycle_stage);
create index if not exists idx_campaigns_workspace_type on public.campaigns(workspace_id, campaign_type);
create index if not exists idx_campaigns_owner on public.campaigns(owner_id);
create index if not exists idx_campaigns_end_date on public.campaigns(workspace_id, end_date);
create index if not exists idx_campaigns_archived on public.campaigns(workspace_id, archived_at);
create index if not exists idx_campaigns_template on public.campaigns(template_id);

-- Explicit with-check so inserts are workspace-scoped, not just reads.
drop policy if exists "campaigns_workspace" on public.campaigns;
create policy "campaigns_workspace" on public.campaigns for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- CAMPAIGN PHASES (timeline bars)
-- ============================================================
create table if not exists public.campaign_phases (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  accent text not null default 'blue',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_phases_dates_check check (end_date >= start_date)
);
alter table public.campaign_phases enable row level security;
drop policy if exists "campaign_phases_workspace" on public.campaign_phases;
create policy "campaign_phases_workspace" on public.campaign_phases for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_campaign_phases_campaign on public.campaign_phases(campaign_id, sort_order);

-- ============================================================
-- CAMPAIGN MILESTONES
-- ============================================================
create table if not exists public.campaign_milestones (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  due_date date not null,
  milestone_type text not null default 'checkpoint'
    check (milestone_type in ('brief','assets','review','approval','launch','report','checkpoint')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','at_risk','blocked')),
  owner_id uuid references public.profiles(id) on delete set null,
  depends_on_id uuid references public.campaign_milestones(id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaign_milestones enable row level security;
drop policy if exists "campaign_milestones_workspace" on public.campaign_milestones;
create policy "campaign_milestones_workspace" on public.campaign_milestones for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_campaign_milestones_campaign on public.campaign_milestones(campaign_id, due_date);
create index if not exists idx_campaign_milestones_due on public.campaign_milestones(workspace_id, due_date);

-- ============================================================
-- CAMPAIGN DEPENDENCIES
-- ============================================================
create table if not exists public.campaign_dependencies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  depends_on_campaign_id uuid not null references public.campaigns(id) on delete cascade,
  label text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','blocking','resolved')),
  created_at timestamptz not null default now(),
  constraint campaign_dependencies_no_self check (campaign_id <> depends_on_campaign_id),
  constraint campaign_dependencies_unique unique (campaign_id, depends_on_campaign_id)
);
alter table public.campaign_dependencies enable row level security;
drop policy if exists "campaign_dependencies_workspace" on public.campaign_dependencies;
create policy "campaign_dependencies_workspace" on public.campaign_dependencies for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_campaign_dependencies_campaign on public.campaign_dependencies(campaign_id);

-- ============================================================
-- CAMPAIGN ACTIVITY (shared feed / audit trail)
-- ============================================================
create table if not exists public.campaign_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null
    check (entity_type in ('campaign','template','giveaway','competition','milestone','entry','submission','board','timeline','system')),
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.campaign_activity enable row level security;
drop policy if exists "campaign_activity_workspace" on public.campaign_activity;
create policy "campaign_activity_workspace" on public.campaign_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_campaign_activity_workspace on public.campaign_activity(workspace_id, created_at desc);
create index if not exists idx_campaign_activity_entity on public.campaign_activity(entity_type, entity_id);

-- ============================================================
-- CAMPAIGN METRIC SNAPSHOTS (performance trend chart)
-- ============================================================
create table if not exists public.campaign_metrics_daily (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  metric_date date not null,
  engagements integer not null default 0,
  reach integer not null default 0,
  conversions integer not null default 0,
  spend numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint campaign_metrics_daily_unique unique (workspace_id, campaign_id, metric_date)
);
alter table public.campaign_metrics_daily enable row level security;
drop policy if exists "campaign_metrics_daily_workspace" on public.campaign_metrics_daily;
create policy "campaign_metrics_daily_workspace" on public.campaign_metrics_daily for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_campaign_metrics_daily_ws_date on public.campaign_metrics_daily(workspace_id, metric_date);

-- ============================================================
-- GIVEAWAYS — winner review + prize fulfilment
-- ============================================================
alter table public.giveaways add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.giveaways add column if not exists cover_url text;
alter table public.giveaways add column if not exists prize_fulfilment text not null default 'pending';
alter table public.giveaways add column if not exists approval_status text not null default 'not_required';
alter table public.giveaways add column if not exists progress integer not null default 0;
alter table public.giveaways add column if not exists health text not null default 'on_track';
alter table public.giveaways add column if not exists channels text[] not null default '{}';

do $$ begin
  alter table public.giveaways add constraint giveaways_prize_fulfilment_check
    check (prize_fulfilment in ('pending','in_progress','fulfilled','cancelled'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.giveaways add constraint giveaways_health_check
    check (health in ('on_track','at_risk','overdue','blocked'));
exception when duplicate_object then null; end $$;

alter table public.giveaway_entries add column if not exists winner_status text not null default 'none';
alter table public.giveaway_entries add column if not exists source text not null default 'manual';
alter table public.giveaway_entries add column if not exists review_note text;
alter table public.giveaway_entries add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.giveaway_entries add column if not exists reviewed_at timestamptz;

do $$ begin
  alter table public.giveaway_entries add constraint giveaway_entries_winner_status_check
    check (winner_status in ('none','candidate','approved','rejected','contacted','accepted','fulfilled','replaced'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.giveaway_entries add constraint giveaway_entries_source_check
    check (source in ('manual','import','api','form','social'));
exception when duplicate_object then null; end $$;

-- Duplicate-entry protection for imports (per giveaway, per handle).
create unique index if not exists idx_giveaway_entries_unique_handle
  on public.giveaway_entries(giveaway_id, lower(participant_handle))
  where participant_handle is not null;

create index if not exists idx_giveaway_entries_status on public.giveaway_entries(giveaway_id, winner_status);

-- ============================================================
-- COMPETITIONS — judging workflow
-- ============================================================
alter table public.competitions add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.competitions add column if not exists cover_url text;
alter table public.competitions add column if not exists judging_stage text not null default 'pending';
alter table public.competitions add column if not exists approval_status text not null default 'not_required';
alter table public.competitions add column if not exists progress integer not null default 0;
alter table public.competitions add column if not exists health text not null default 'on_track';
alter table public.competitions add column if not exists channels text[] not null default '{}';
alter table public.competitions add column if not exists engagement_rate numeric(6,4) not null default 0;

do $$ begin
  alter table public.competitions add constraint competitions_judging_stage_check
    check (judging_stage in ('pending','in_progress','review','shortlist','final_review','completed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.competitions add constraint competitions_health_check
    check (health in ('on_track','at_risk','overdue','blocked'));
exception when duplicate_object then null; end $$;

alter table public.competition_submissions add column if not exists judging_status text not null default 'pending';
alter table public.competition_submissions add column if not exists assigned_judge_id uuid references public.competition_judges(id) on delete set null;
alter table public.competition_submissions add column if not exists source text not null default 'manual';
alter table public.competition_submissions add column if not exists review_note text;

do $$ begin
  alter table public.competition_submissions add constraint competition_submissions_judging_status_check
    check (judging_status in ('pending','in_progress','review','shortlist','final_review','completed','rejected','disqualified'));
exception when duplicate_object then null; end $$;

create index if not exists idx_competition_submissions_judging
  on public.competition_submissions(competition_id, judging_status);

-- ============================================================
-- TRIGGERS: updated_at for new tables
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'campaign_templates','campaign_phases','campaign_milestones'
  ]) loop
    if not exists (select 1 from pg_trigger where tgname = format('trg_%s_updated_at', t)) then
      execute format('
        create trigger trg_%s_updated_at before update on public.%s
        for each row execute function public.handle_updated_at()', t, t);
    end if;
  end loop;
end $$;
