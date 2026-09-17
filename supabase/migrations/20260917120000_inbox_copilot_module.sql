-- ============================================================
-- Inbox + Fox AI Copilot module
--
-- Extends the canonical conversation (inbox_threads / inbox_messages),
-- contact (messaging_contacts) and task (campaign_tasks) tables rather than
-- creating parallel ones, and adds the records the module was missing:
-- teams, SLA policies, queues, routing rules, assignment history, activity,
-- saved-view usage, internal group chats, workspace alerts + preferences,
-- Copilot history, Agent runs and media-generation jobs.
--
-- Every table is workspace-scoped with RLS. Read = workspace member.
-- Write = owner/admin/manager/member (viewers are read-only). Team, SLA,
-- queue and routing configuration = owner/admin/manager.
-- Idempotent.
-- ============================================================

create or replace function public.inbox_can_write(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and role in ('owner','admin','manager','member')
  ) or exists (select 1 from public.workspaces where id = ws and owner_id = auth.uid());
$$;

create or replace function public.inbox_can_manage(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and role in ('owner','admin','manager')
  ) or exists (select 1 from public.workspaces where id = ws and owner_id = auth.uid());
$$;
revoke all on function public.inbox_can_write(uuid) from public, anon;
revoke all on function public.inbox_can_manage(uuid) from public, anon;
grant execute on function public.inbox_can_write(uuid) to authenticated;
grant execute on function public.inbox_can_manage(uuid) to authenticated;

-- ------------------------------------------------------------ teams
create table if not exists public.inbox_teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  color text not null default 'blue',
  is_default boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.inbox_team_members (
  team_id uuid not null references public.inbox_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  capacity integer not null default 25 check (capacity between 1 and 500),
  role_label text,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists inbox_team_members_ws_idx on public.inbox_team_members (workspace_id, user_id);

-- ------------------------------------------------------------ SLA policies
create table if not exists public.inbox_sla_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  -- minutes per priority: {"urgent":{"first":15,"resolve":240}, ...}
  targets jsonb not null default '{"urgent":{"first":15,"resolve":240},"high":{"first":30,"resolve":480},"normal":{"first":30,"resolve":1440},"low":{"first":480,"resolve":4320}}'::jsonb,
  business_hours jsonb,
  timezone text not null default 'Europe/London',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inbox_sla_policies_default_idx
  on public.inbox_sla_policies (workspace_id) where is_default;

-- ------------------------------------------------------------ conversations
alter table public.inbox_threads
  add column if not exists contact_id uuid references public.messaging_contacts(id) on delete set null,
  add column if not exists team_id uuid references public.inbox_teams(id) on delete set null,
  add column if not exists subject text,
  add column if not exists language text,
  add column if not exists snoozed_until timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists waiting_on_customer boolean not null default false,
  add column if not exists sla_policy_id uuid references public.inbox_sla_policies(id) on delete set null,
  add column if not exists first_response_due_at timestamptz,
  add column if not exists resolution_due_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_preview text,
  add column if not exists unread_count integer not null default 0,
  add column if not exists suggested_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists suggested_owner_score integer;

create index if not exists inbox_threads_ws_last_idx on public.inbox_threads (workspace_id, last_message_at desc);
create index if not exists inbox_threads_ws_status_idx on public.inbox_threads (workspace_id, status);
create index if not exists inbox_threads_ws_assignee_idx on public.inbox_threads (workspace_id, assigned_to);
create index if not exists inbox_threads_ws_team_idx on public.inbox_threads (workspace_id, team_id);
create index if not exists inbox_threads_ws_platform_idx on public.inbox_threads (workspace_id, platform);
create index if not exists inbox_threads_ws_due_idx on public.inbox_threads (workspace_id, first_response_due_at);
create index if not exists inbox_threads_contact_idx on public.inbox_threads (contact_id);

alter table public.inbox_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists read_at timestamptz;
create index if not exists inbox_messages_thread_sent_idx on public.inbox_messages (thread_id, sent_at);

-- Demo conversations record replies without contacting a provider.
alter table public.inbox_messages drop constraint if exists inbox_messages_delivery_status_check;
alter table public.inbox_messages add constraint inbox_messages_delivery_status_check
  check (delivery_status = any (array['pending','sent','failed','simulated']));

-- Backfill SLA due times and last-message fields for existing threads.
update public.inbox_threads
   set first_response_due_at = created_at + make_interval(mins => coalesce(sla_target_minutes, 60))
 where first_response_due_at is null;
update public.inbox_threads
   set resolution_due_at = created_at + interval '24 hours'
 where resolution_due_at is null;
update public.inbox_threads t
   set last_message_at = coalesce(m.sent_at, t.updated_at),
       last_message_preview = coalesce(left(m.content, 200), left(t.content, 200))
  from (select distinct on (thread_id) thread_id, sent_at, content
          from public.inbox_messages where not is_internal_note
         order by thread_id, sent_at desc) m
 where m.thread_id = t.id and t.last_message_at is null;
update public.inbox_threads
   set last_message_at = updated_at, last_message_preview = left(content, 200)
 where last_message_at is null;

-- SLA due times follow the workspace policy and the conversation priority.
create or replace function public.inbox_apply_sla()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pol record;
  first_mins integer;
  resolve_mins integer;
begin
  select * into pol from public.inbox_sla_policies
   where id = new.sla_policy_id
      or (new.sla_policy_id is null and workspace_id = new.workspace_id and is_default)
   order by (id = new.sla_policy_id) desc nulls last
   limit 1;
  if pol.id is null then
    first_mins := coalesce(new.sla_target_minutes, 60);
    resolve_mins := 1440;
  else
    new.sla_policy_id := pol.id;
    first_mins := coalesce((pol.targets -> coalesce(new.priority,'normal') ->> 'first')::int, 60);
    resolve_mins := coalesce((pol.targets -> coalesce(new.priority,'normal') ->> 'resolve')::int, 1440);
  end if;
  if tg_op = 'INSERT' then
    new.first_response_due_at := coalesce(new.first_response_due_at, new.created_at + make_interval(mins => first_mins));
    new.resolution_due_at := coalesce(new.resolution_due_at, new.created_at + make_interval(mins => resolve_mins));
    new.last_message_at := coalesce(new.last_message_at, new.created_at);
    new.last_message_preview := coalesce(new.last_message_preview, left(new.content, 200));
  elsif new.priority is distinct from old.priority or new.sla_policy_id is distinct from old.sla_policy_id then
    new.first_response_due_at := new.created_at + make_interval(mins => first_mins);
    new.resolution_due_at := new.created_at + make_interval(mins => resolve_mins);
  end if;
  new.sla_target_minutes := first_mins;
  return new;
end;
$$;
drop trigger if exists inbox_threads_apply_sla on public.inbox_threads;
create trigger inbox_threads_apply_sla before insert or update of priority, sla_policy_id
  on public.inbox_threads for each row execute function public.inbox_apply_sla();

-- Keeps list previews, unread counts and response state in step with messages.
create or replace function public.inbox_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_internal_note then
    update public.inbox_threads set updated_at = now() where id = new.thread_id;
    return new;
  end if;
  if new.sender_type = 'external' then
    update public.inbox_threads
       set last_message_at = new.sent_at, last_message_preview = left(new.content, 200),
           unread_count = unread_count + 1, requires_reply = true, is_read = false,
           waiting_on_customer = false, snoozed_until = null,
           status = case when status in ('resolved','done') then 'open' else status end,
           updated_at = now()
     where id = new.thread_id;
  elsif new.sender_type = 'internal' and new.delivery_status <> 'failed' then
    update public.inbox_threads
       set last_message_at = new.sent_at, last_message_preview = left(new.content, 200),
           first_response_at = coalesce(first_response_at, new.sent_at),
           requires_reply = false, waiting_on_customer = true, unread_count = 0, is_read = true,
           updated_at = now()
     where id = new.thread_id;
  end if;
  return new;
end;
$$;
drop trigger if exists inbox_messages_after_insert on public.inbox_messages;
create trigger inbox_messages_after_insert after insert on public.inbox_messages
  for each row execute function public.inbox_on_message();

-- ------------------------------------------------------------ contacts
alter table public.messaging_contacts
  add column if not exists avatar_url text,
  add column if not exists handle text,
  add column if not exists segment text,
  add column if not exists location text,
  add column if not exists lifetime_value_band text,
  add column if not exists sentiment_trend text,
  add column if not exists last_channel text,
  add column if not exists last_activity text,
  add column if not exists last_activity_at timestamptz,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists instagram_handle text,
  add column if not exists facebook_id text,
  add column if not exists x_handle text,
  add column if not exists tiktok_handle text,
  add column if not exists is_demo boolean not null default false;
alter table public.messaging_contacts drop constraint if exists messaging_contacts_segment_check;
alter table public.messaging_contacts add constraint messaging_contacts_segment_check
  check (segment is null or segment = any (array['follower','customer','vip','pending','lead','prospect']));
create index if not exists messaging_contacts_ws_name_idx on public.messaging_contacts (workspace_id, full_name);
create index if not exists messaging_contacts_ws_segment_idx on public.messaging_contacts (workspace_id, segment);

-- ------------------------------------------------------------ list view
drop view if exists public.inbox_conversation_list;
create view public.inbox_conversation_list with (security_invoker = true) as
select
  t.*,
  case
    when t.status in ('resolved','done','spam') then 'closed'
    when t.snoozed_until is not null and t.snoozed_until > now() then 'snoozed'
    else 'open'
  end as lane,
  case
    when t.status in ('resolved','done','spam') then 'completed'
    when t.snoozed_until is not null and t.snoozed_until > now() then 'paused'
    when t.first_response_at is null and t.first_response_due_at < now() then 'breached'
    when t.first_response_at is null and t.first_response_due_at < now() + interval '30 minutes' then 'at_risk'
    when t.first_response_at is null then 'on_track'
    when t.resolution_due_at < now() then 'breached'
    when t.resolution_due_at < now() + interval '2 hours' then 'at_risk'
    else 'on_track'
  end as sla_status,
  case when t.first_response_at is null then t.first_response_due_at else t.resolution_due_at end as sla_due_at,
  case t.priority when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end as priority_rank,
  c.full_name as contact_name,
  c.email as contact_email,
  c.phone as contact_phone,
  c.avatar_url as contact_avatar,
  c.segment as contact_segment,
  c.location as contact_location,
  p.full_name as assignee_name,
  p.avatar_url as assignee_avatar,
  tm.name as team_name
from public.inbox_threads t
left join public.messaging_contacts c on c.id = t.contact_id
left join public.profiles p on p.id = t.assigned_to
left join public.inbox_teams tm on tm.id = t.team_id;
grant select on public.inbox_conversation_list to authenticated;

-- ------------------------------------------------------------ queues
create table if not exists public.inbox_queues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'inbox',
  filters jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_system boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inbox_queues_ws_idx on public.inbox_queues (workspace_id, position);

-- ------------------------------------------------------------ routing rules
create table if not exists public.inbox_routing_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  position integer not null default 0,
  match_count integer not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inbox_routing_rules_ws_idx on public.inbox_routing_rules (workspace_id, position);

-- ------------------------------------------------------------ assignment history + activity
create table if not exists public.inbox_assignment_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  from_team_id uuid references public.inbox_teams(id) on delete set null,
  to_team_id uuid references public.inbox_teams(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  rule_id uuid references public.inbox_routing_rules(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists inbox_assignment_history_thread_idx on public.inbox_assignment_history (thread_id, created_at desc);

create table if not exists public.inbox_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid references public.inbox_threads(id) on delete cascade,
  saved_view_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inbox_activity_thread_idx on public.inbox_activity (thread_id, created_at desc);
create index if not exists inbox_activity_ws_idx on public.inbox_activity (workspace_id, created_at desc);
create index if not exists inbox_activity_view_idx on public.inbox_activity (saved_view_id, created_at desc);

-- ------------------------------------------------------------ saved views
alter table public.inbox_saved_views
  add column if not exists visibility text not null default 'workspace',
  add column if not exists folder text,
  add column if not exists shared_team_id uuid references public.inbox_teams(id) on delete set null,
  add column if not exists shared_at timestamptz,
  add column if not exists assignment_defaults jsonb not null default '{}'::jsonb,
  add column if not exists sla_conditions jsonb not null default '[]'::jsonb,
  add column if not exists columns jsonb not null default '[]'::jsonb,
  add column if not exists needs_update boolean not null default false,
  add column if not exists is_demo boolean not null default false;
alter table public.inbox_saved_views drop constraint if exists inbox_saved_views_visibility_check;
alter table public.inbox_saved_views add constraint inbox_saved_views_visibility_check
  check (visibility = any (array['personal','team','workspace']));
update public.inbox_saved_views set visibility = case when is_shared then 'workspace' else 'personal' end
 where visibility = 'workspace' and not is_shared;

create table if not exists public.inbox_saved_view_usage (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.inbox_saved_views(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  used_at timestamptz not null default now()
);
create index if not exists inbox_saved_view_usage_view_idx on public.inbox_saved_view_usage (view_id, used_at desc);

-- ------------------------------------------------------------ group chats (internal)
create table if not exists public.inbox_group_chats (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text,
  context_summary text,
  context jsonb not null default '{}'::jsonb,
  campaign_id uuid references public.campaigns(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  archived_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inbox_group_chats_ws_idx on public.inbox_group_chats (workspace_id, last_message_at desc);

create table if not exists public.inbox_group_chat_members (
  chat_id uuid not null references public.inbox_group_chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists inbox_group_chat_members_user_idx on public.inbox_group_chat_members (user_id, workspace_id);

create table if not exists public.inbox_group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.inbox_group_chats(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  mentions uuid[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  is_ai_assisted boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inbox_group_chat_messages_chat_idx on public.inbox_group_chat_messages (chat_id, created_at);

create table if not exists public.inbox_group_chat_reactions (
  message_id uuid not null references public.inbox_group_chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create or replace function public.inbox_is_chat_member(chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.inbox_group_chat_members where chat_id = chat and user_id = auth.uid());
$$;
revoke all on function public.inbox_is_chat_member(uuid) from public, anon;
grant execute on function public.inbox_is_chat_member(uuid) to authenticated;

create or replace function public.inbox_on_group_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.inbox_group_chats
     set last_message_at = new.created_at, last_message_preview = left(new.body, 160)
   where id = new.chat_id;
  update public.inbox_group_chat_members set last_read_at = new.created_at
   where chat_id = new.chat_id and user_id = new.author_id;
  return new;
end;
$$;
drop trigger if exists inbox_group_chat_messages_after_insert on public.inbox_group_chat_messages;
create trigger inbox_group_chat_messages_after_insert after insert on public.inbox_group_chat_messages
  for each row execute function public.inbox_on_group_message();

-- ------------------------------------------------------------ tasks (canonical: campaign_tasks)
alter table public.campaign_tasks alter column campaign_id drop not null;
alter table public.campaign_tasks
  add column if not exists channel text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists scheduled_for timestamptz,
  add column if not exists snoozed_until timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists thread_id uuid references public.inbox_threads(id) on delete set null,
  add column if not exists contact_id uuid references public.messaging_contacts(id) on delete set null,
  add column if not exists agent_run_id uuid,
  add column if not exists source text not null default 'manual',
  add column if not exists is_demo boolean not null default false;
create index if not exists campaign_tasks_ws_due_idx on public.campaign_tasks (workspace_id, due_date);
create index if not exists campaign_tasks_ws_status_idx on public.campaign_tasks (workspace_id, status);

-- ------------------------------------------------------------ alerts
create table if not exists public.workspace_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category text not null check (category = any (array['publishing','approvals','brand_safety','performance','deliverability','inbox'])),
  severity text not null default 'medium' check (severity = any (array['low','medium','high','critical'])),
  title text not null,
  description text,
  source_type text,
  source_id uuid,
  href text,
  status text not null default 'active' check (status = any (array['active','resolved','dismissed'])),
  dedupe_key text not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists workspace_alerts_dedupe_idx on public.workspace_alerts (workspace_id, dedupe_key) where status = 'active';
create index if not exists workspace_alerts_ws_status_idx on public.workspace_alerts (workspace_id, status, created_at desc);

create table if not exists public.alert_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  categories jsonb not null default '{"publishing":true,"approvals":true,"brand_safety":true,"performance":true,"deliverability":true}'::jsonb,
  channels jsonb not null default '{"email":true,"in_app":true,"slack":false,"teams":false}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ------------------------------------------------------------ copilot history
create table if not exists public.copilot_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  surface text not null default 'copilot',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists copilot_threads_user_idx on public.copilot_threads (workspace_id, user_id, updated_at desc);

create table if not exists public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.copilot_threads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role = any (array['user','assistant'])),
  content text not null,
  command text,
  context_refs jsonb not null default '[]'::jsonb,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  status text not null default 'complete' check (status = any (array['complete','failed','cancelled'])),
  created_at timestamptz not null default now()
);
create index if not exists copilot_messages_thread_idx on public.copilot_messages (thread_id, created_at);

-- ------------------------------------------------------------ agent runs
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  objective text not null check (char_length(objective) between 3 and 1000),
  title text not null,
  status text not null default 'queued' check (status = any (array['queued','running','waiting_approval','paused','completed','partially_completed','failed','cancelled'])),
  brief jsonb not null default '{}'::jsonb,
  summary text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  locked_until timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_runs_ws_idx on public.agent_runs (workspace_id, user_id, created_at desc);
create index if not exists agent_runs_status_idx on public.agent_runs (status, locked_until);

create table if not exists public.agent_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  position integer not null,
  step_key text not null,
  name text not null,
  description text,
  status text not null default 'queued' check (status = any (array['queued','running','waiting_approval','completed','failed','skipped','cancelled'])),
  requires_approval boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  unique (run_id, position)
);

create table if not exists public.agent_run_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind = any (array['content_plan','captions','scheduled_posts','tasks','report'])),
  title text not null,
  subtitle text,
  href text,
  record_type text,
  record_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists agent_run_results_run_idx on public.agent_run_results (run_id);

-- ------------------------------------------------------------ media generation
create table if not exists public.media_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  prompt text not null check (char_length(prompt) between 3 and 2000),
  enhanced_prompt text,
  output_type text not null default 'image' check (output_type = any (array['image','graphic','thumbnail'])),
  aspect_ratio text not null default '1:1',
  style_preset text,
  model_key text not null default 'fox-image-pro',
  quality text not null default 'standard' check (quality = any (array['standard','high','ultra'])),
  seed integer,
  variations integer not null default 1 check (variations between 1 and 4),
  use_brand_kit boolean not null default false,
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  status text not null default 'queued' check (status = any (array['queued','generating','completed','partially_completed','failed','cancelled'])),
  error text,
  output_asset_ids uuid[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists media_generation_jobs_ws_idx on public.media_generation_jobs (workspace_id, created_at desc);

-- ------------------------------------------------------------ AI usage metering (tokens + images)
alter table public.ai_usage_logs
  add column if not exists model text,
  add column if not exists feature text,
  add column if not exists images integer not null default 0;
create index if not exists ai_usage_logs_ws_created_idx on public.ai_usage_logs (workspace_id, created_at desc);

-- ------------------------------------------------------------ RLS
do $$
declare t text;
begin
  foreach t in array array[
    'inbox_teams','inbox_team_members','inbox_sla_policies','inbox_queues','inbox_routing_rules',
    'inbox_assignment_history','inbox_activity','inbox_saved_view_usage','inbox_group_chats',
    'inbox_group_chat_members','inbox_group_chat_messages','inbox_group_chat_reactions',
    'workspace_alerts','alert_preferences','copilot_threads','copilot_messages',
    'agent_runs','agent_run_steps','agent_run_results','media_generation_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- conversations: tighten the legacy "any member can write" policies
drop policy if exists threads_workspace on public.inbox_threads;
drop policy if exists inbox_threads_select on public.inbox_threads;
drop policy if exists inbox_threads_write on public.inbox_threads;
create policy inbox_threads_select on public.inbox_threads for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_threads_write on public.inbox_threads for all to authenticated
  using (public.inbox_can_write(workspace_id)) with check (public.inbox_can_write(workspace_id));

drop policy if exists messages_workspace on public.inbox_messages;
drop policy if exists inbox_messages_select on public.inbox_messages;
drop policy if exists inbox_messages_write on public.inbox_messages;
create policy inbox_messages_select on public.inbox_messages for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_messages_write on public.inbox_messages for insert to authenticated
  with check (public.inbox_can_write(workspace_id) and (sent_by is null or sent_by = auth.uid()));
drop policy if exists inbox_messages_update on public.inbox_messages;
create policy inbox_messages_update on public.inbox_messages for update to authenticated
  using (public.inbox_can_write(workspace_id)) with check (public.inbox_can_write(workspace_id));

drop policy if exists inbox_saved_views_workspace on public.inbox_saved_views;
drop policy if exists inbox_saved_views_select on public.inbox_saved_views;
drop policy if exists inbox_saved_views_insert on public.inbox_saved_views;
drop policy if exists inbox_saved_views_update on public.inbox_saved_views;
drop policy if exists inbox_saved_views_delete on public.inbox_saved_views;
create policy inbox_saved_views_select on public.inbox_saved_views for select to authenticated
  using (public.is_workspace_member(workspace_id) and (visibility <> 'personal' or created_by = auth.uid()));
create policy inbox_saved_views_insert on public.inbox_saved_views for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy inbox_saved_views_update on public.inbox_saved_views for update to authenticated
  using (public.is_workspace_member(workspace_id) and (created_by = auth.uid() or public.inbox_can_manage(workspace_id)));
create policy inbox_saved_views_delete on public.inbox_saved_views for delete to authenticated
  using (public.is_workspace_member(workspace_id) and (created_by = auth.uid() or public.inbox_can_manage(workspace_id)));

drop policy if exists messaging_contacts_workspace on public.messaging_contacts;
drop policy if exists messaging_contacts_select on public.messaging_contacts;
drop policy if exists messaging_contacts_write on public.messaging_contacts;
create policy messaging_contacts_select on public.messaging_contacts for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy messaging_contacts_write on public.messaging_contacts for all to authenticated
  using (public.inbox_can_write(workspace_id)) with check (public.inbox_can_write(workspace_id));

drop policy if exists tasks_workspace on public.campaign_tasks;
drop policy if exists campaign_tasks_select on public.campaign_tasks;
drop policy if exists campaign_tasks_write on public.campaign_tasks;
create policy campaign_tasks_select on public.campaign_tasks for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy campaign_tasks_write on public.campaign_tasks for all to authenticated
  using (public.inbox_can_write(workspace_id)) with check (public.inbox_can_write(workspace_id));

-- configuration tables: read by members, managed by owner/admin/manager
do $$
declare t text;
begin
  foreach t in array array['inbox_teams','inbox_team_members','inbox_sla_policies','inbox_queues','inbox_routing_rules'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_manage', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.inbox_can_manage(workspace_id)) with check (public.inbox_can_manage(workspace_id))', t || '_manage', t);
  end loop;
end $$;

-- append-only logs: members read, writers insert as themselves
drop policy if exists inbox_assignment_history_select on public.inbox_assignment_history;
drop policy if exists inbox_assignment_history_insert on public.inbox_assignment_history;
create policy inbox_assignment_history_select on public.inbox_assignment_history for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_assignment_history_insert on public.inbox_assignment_history for insert to authenticated
  with check (public.inbox_can_write(workspace_id) and actor_id = auth.uid());

drop policy if exists inbox_activity_select on public.inbox_activity;
drop policy if exists inbox_activity_insert on public.inbox_activity;
create policy inbox_activity_select on public.inbox_activity for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_activity_insert on public.inbox_activity for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

drop policy if exists inbox_saved_view_usage_select on public.inbox_saved_view_usage;
drop policy if exists inbox_saved_view_usage_insert on public.inbox_saved_view_usage;
create policy inbox_saved_view_usage_select on public.inbox_saved_view_usage for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_saved_view_usage_insert on public.inbox_saved_view_usage for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

-- group chats: only chat members see or post
drop policy if exists inbox_group_chats_select on public.inbox_group_chats;
drop policy if exists inbox_group_chats_insert on public.inbox_group_chats;
drop policy if exists inbox_group_chats_update on public.inbox_group_chats;
create policy inbox_group_chats_select on public.inbox_group_chats for select to authenticated
  using (public.is_workspace_member(workspace_id) and (public.inbox_is_chat_member(id) or created_by = auth.uid()));
create policy inbox_group_chats_insert on public.inbox_group_chats for insert to authenticated
  with check (public.inbox_can_write(workspace_id) and created_by = auth.uid());
create policy inbox_group_chats_update on public.inbox_group_chats for update to authenticated
  using (public.inbox_is_chat_member(id) and public.inbox_can_write(workspace_id));

drop policy if exists inbox_group_chat_members_select on public.inbox_group_chat_members;
drop policy if exists inbox_group_chat_members_insert on public.inbox_group_chat_members;
drop policy if exists inbox_group_chat_members_update on public.inbox_group_chat_members;
create policy inbox_group_chat_members_select on public.inbox_group_chat_members for select to authenticated
  using (public.inbox_is_chat_member(chat_id));
create policy inbox_group_chat_members_insert on public.inbox_group_chat_members for insert to authenticated
  with check (public.inbox_can_write(workspace_id) and public.is_workspace_member(workspace_id)
    and exists (select 1 from public.inbox_group_chats g where g.id = chat_id and g.workspace_id = inbox_group_chat_members.workspace_id
                and (g.created_by = auth.uid() or public.inbox_is_chat_member(g.id))));
create policy inbox_group_chat_members_update on public.inbox_group_chat_members for update to authenticated
  using (user_id = auth.uid());

drop policy if exists inbox_group_chat_messages_select on public.inbox_group_chat_messages;
drop policy if exists inbox_group_chat_messages_insert on public.inbox_group_chat_messages;
create policy inbox_group_chat_messages_select on public.inbox_group_chat_messages for select to authenticated
  using (public.inbox_is_chat_member(chat_id));
create policy inbox_group_chat_messages_insert on public.inbox_group_chat_messages for insert to authenticated
  with check (public.inbox_is_chat_member(chat_id) and public.inbox_can_write(workspace_id) and author_id = auth.uid());

drop policy if exists inbox_group_chat_reactions_select on public.inbox_group_chat_reactions;
drop policy if exists inbox_group_chat_reactions_write on public.inbox_group_chat_reactions;
create policy inbox_group_chat_reactions_select on public.inbox_group_chat_reactions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_group_chat_reactions_write on public.inbox_group_chat_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- alerts
drop policy if exists workspace_alerts_select on public.workspace_alerts;
drop policy if exists workspace_alerts_write on public.workspace_alerts;
create policy workspace_alerts_select on public.workspace_alerts for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy workspace_alerts_write on public.workspace_alerts for all to authenticated
  using (public.inbox_can_write(workspace_id)) with check (public.inbox_can_write(workspace_id));

drop policy if exists alert_preferences_own on public.alert_preferences;
create policy alert_preferences_own on public.alert_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- per-user AI records
do $$
declare t text;
begin
  foreach t in array array['copilot_threads','copilot_messages','agent_runs','media_generation_jobs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id))', t || '_own', t);
  end loop;
end $$;

drop policy if exists agent_run_steps_own on public.agent_run_steps;
create policy agent_run_steps_own on public.agent_run_steps for all to authenticated
  using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = auth.uid()));
drop policy if exists agent_run_results_own on public.agent_run_results;
create policy agent_run_results_own on public.agent_run_results for all to authenticated
  using (exists (select 1 from public.agent_runs r where r.id = run_id and r.user_id = auth.uid()));

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['inbox_teams','inbox_sla_policies','inbox_queues','inbox_routing_rules','workspace_alerts','copilot_threads','agent_runs'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- realtime (scoped by RLS)
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['inbox_threads','inbox_messages','inbox_group_chat_messages','agent_run_steps','workspace_alerts'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
