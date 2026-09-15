-- ============================================================
-- Campaign Manager -> Calendar module
--   /{type}/calendar
--   /{type}/calendar/publishing-queue
--   /{type}/calendar/agenda
--   /{type}/calendar/conflicts
--
-- Design principle: the Calendar AGGREGATES existing canonical records
-- (content_posts, campaigns, campaign_tasks, approvals, publishing_queue).
-- It never duplicates their dates. This migration only adds what genuinely
-- does not exist yet:
--   1. calendar_items          - meetings / reminders / milestones / launches
--                                that have no other canonical home
--   2. publishing_queue columns - owner, priority, approval state, campaign,
--                                 provider + failure detail, idempotency
--   3. calendar_conflicts (+ links, + activity) - detection & resolution
-- ============================================================

-- ------------------------------------------------------------
-- 1. CALENDAR ITEMS
-- ------------------------------------------------------------
create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  item_type text not null default 'event'
    check (item_type in ('event','meeting','reminder','milestone','launch','task','review','holiday')),
  title text not null,
  description text,

  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  timezone text not null default 'Europe/London',

  status text not null default 'scheduled'
    check (status in ('draft','scheduled','in_progress','completed','cancelled')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  channel text,

  -- canonical references (never copies)
  campaign_id uuid references public.campaigns(id) on delete set null,
  post_id uuid references public.content_posts(id) on delete set null,
  task_id uuid references public.campaign_tasks(id) on delete set null,
  approval_id uuid references public.approvals(id) on delete set null,

  owner_id uuid references public.profiles(id) on delete set null,
  team text,

  -- RFC 5545 RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO;COUNT=10
  recurrence_rule text,
  recurrence_parent_id uuid references public.calendar_items(id) on delete cascade,
  recurrence_exdates timestamptz[],

  location text,
  meeting_url text,
  external_uid text,
  source text not null default 'manual'
    check (source in ('manual','import','automation','ai','integration')),
  metadata jsonb not null default '{}',

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_items_end_after_start
    check (end_at is null or end_at >= start_at)
);

alter table public.calendar_items enable row level security;

drop policy if exists "calendar_items_workspace" on public.calendar_items;
create policy "calendar_items_workspace" on public.calendar_items for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create index if not exists idx_calendar_items_range
  on public.calendar_items(workspace_id, start_at) where archived_at is null;
create index if not exists idx_calendar_items_owner
  on public.calendar_items(workspace_id, owner_id, start_at);
create index if not exists idx_calendar_items_campaign
  on public.calendar_items(campaign_id) where campaign_id is not null;
create unique index if not exists idx_calendar_items_external_uid
  on public.calendar_items(workspace_id, external_uid) where external_uid is not null;

-- ------------------------------------------------------------
-- 2. PUBLISHING QUEUE - operational columns
-- ------------------------------------------------------------
alter table public.publishing_queue
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists priority text not null default 'medium',
  add column if not exists provider text,
  add column if not exists provider_account_id uuid references public.social_channels(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists next_retry_at timestamptz,
  add column if not exists sla_due_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists updated_at timestamptz not null default now();

-- channel_id is required by the original table but a queue item can legitimately
-- target a channel that has not been connected yet (draft / awaiting approval).
alter table public.publishing_queue alter column channel_id drop not null;

do $$ begin
  alter table public.publishing_queue
    add constraint publishing_queue_approval_status_check
    check (approval_status in ('not_required','awaiting_approval','approved','changes_requested','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.publishing_queue
    add constraint publishing_queue_priority_check
    check (priority in ('low','medium','high','urgent'));
exception when duplicate_object then null; end $$;

-- Widen delivery states: the original check only allowed the worker states.
do $$ begin
  alter table public.publishing_queue drop constraint publishing_queue_status_check;
exception when undefined_object then null; end $$;

alter table public.publishing_queue
  add constraint publishing_queue_status_check
  check (status in ('draft','queued','ready','scheduled','processing','sent','published','failed','cancelled'));

create unique index if not exists idx_publishing_queue_idempotency
  on public.publishing_queue(workspace_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_publishing_queue_workspace_status
  on public.publishing_queue(workspace_id, status, scheduled_at);
create index if not exists idx_publishing_queue_owner
  on public.publishing_queue(workspace_id, owner_id);
create index if not exists idx_publishing_queue_sla
  on public.publishing_queue(workspace_id, sla_due_at) where status not in ('published','sent','cancelled');

-- ------------------------------------------------------------
-- 3. CONFLICTS
-- ------------------------------------------------------------
create table if not exists public.calendar_conflicts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  reference text not null,
  conflict_type text not null
    check (conflict_type in (
      'overlap_collision','capacity_clash','approval_delay','duplicate_slot',
      'blocked_dependency','launch_collision','channel_saturation','resource_unavailable',
      'date_invalid'
    )),
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low','info')),
  impact text not null default 'medium'
    check (impact in ('high','medium','low')),

  title text not null,
  description text,

  status text not null default 'open'
    check (status in ('open','in_progress','resolved','dismissed','reopened')),

  channels text[] not null default '{}',
  campaign_id uuid references public.campaigns(id) on delete set null,

  detected_at timestamptz not null default now(),
  start_at timestamptz,
  end_at timestamptz,
  due_at timestamptz,

  owner_id uuid references public.profiles(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,

  recommendations jsonb not null default '[]',
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,

  -- stable hash of the detected condition so re-running detection updates
  -- rather than duplicating an existing open conflict
  signature text not null,
  detector_version integer not null default 1,
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_conflicts enable row level security;

drop policy if exists "calendar_conflicts_workspace" on public.calendar_conflicts;
create policy "calendar_conflicts_workspace" on public.calendar_conflicts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create unique index if not exists idx_calendar_conflicts_signature
  on public.calendar_conflicts(workspace_id, signature);
create unique index if not exists idx_calendar_conflicts_reference
  on public.calendar_conflicts(workspace_id, reference);
create index if not exists idx_calendar_conflicts_open
  on public.calendar_conflicts(workspace_id, status, severity, detected_at desc);
create index if not exists idx_calendar_conflicts_assignee
  on public.calendar_conflicts(workspace_id, assignee_id) where status in ('open','in_progress','reopened');

-- Linked records (a conflict points at the canonical records that clash)
create table if not exists public.calendar_conflict_records (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.calendar_conflicts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_kind text not null
    check (record_kind in ('campaign','content_post','calendar_item','publishing_job','task','approval','profile')),
  record_id uuid not null,
  label text,
  created_at timestamptz not null default now(),
  unique (conflict_id, record_kind, record_id)
);

alter table public.calendar_conflict_records enable row level security;

drop policy if exists "calendar_conflict_records_workspace" on public.calendar_conflict_records;
create policy "calendar_conflict_records_workspace" on public.calendar_conflict_records for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create index if not exists idx_conflict_records_conflict
  on public.calendar_conflict_records(conflict_id);

-- Resolution activity trail
create table if not exists public.calendar_conflict_activity (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.calendar_conflicts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  summary text not null,
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);

alter table public.calendar_conflict_activity enable row level security;

drop policy if exists "calendar_conflict_activity_workspace" on public.calendar_conflict_activity;
create policy "calendar_conflict_activity_workspace" on public.calendar_conflict_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

create index if not exists idx_conflict_activity_conflict
  on public.calendar_conflict_activity(conflict_id, created_at desc);
create index if not exists idx_conflict_activity_workspace
  on public.calendar_conflict_activity(workspace_id, created_at desc);

-- ------------------------------------------------------------
-- 4. updated_at triggers
-- ------------------------------------------------------------
create or replace function public.calendar_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_calendar_items_updated on public.calendar_items;
create trigger trg_calendar_items_updated before update on public.calendar_items
  for each row execute function public.calendar_touch_updated_at();

drop trigger if exists trg_calendar_conflicts_updated on public.calendar_conflicts;
create trigger trg_calendar_conflicts_updated before update on public.calendar_conflicts
  for each row execute function public.calendar_touch_updated_at();

drop trigger if exists trg_publishing_queue_updated on public.publishing_queue;
create trigger trg_publishing_queue_updated before update on public.publishing_queue
  for each row execute function public.calendar_touch_updated_at();

-- ------------------------------------------------------------
-- 5. Conflict reference sequence (CONF-0001 style, per workspace)
-- ------------------------------------------------------------
create or replace function public.next_conflict_reference(p_workspace uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  select coalesce(max(nullif(regexp_replace(reference, '\D', '', 'g'), '')::int), 0) + 1
    into n
  from public.calendar_conflicts
  where workspace_id = p_workspace;
  return 'CONF-' || lpad(n::text, 3, '0');
end $$;
