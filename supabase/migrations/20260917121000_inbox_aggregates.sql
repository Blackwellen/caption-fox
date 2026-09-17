-- ============================================================
-- Inbox aggregates: server-side KPI, count and workload RPCs.
--
-- All functions are SECURITY INVOKER, so RLS on inbox_threads and the
-- inbox_conversation_list view still decides what a caller can count.
-- "vs yesterday" deltas for point-in-time counts come from
-- inbox_metric_snapshots, written at most once per workspace per day.
-- Idempotent.
-- ============================================================

create table if not exists public.inbox_metric_snapshots (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  day date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (workspace_id, day)
);
alter table public.inbox_metric_snapshots enable row level security;
drop policy if exists inbox_metric_snapshots_select on public.inbox_metric_snapshots;
drop policy if exists inbox_metric_snapshots_insert on public.inbox_metric_snapshots;
create policy inbox_metric_snapshots_select on public.inbox_metric_snapshots for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy inbox_metric_snapshots_insert on public.inbox_metric_snapshots for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create or replace function public.inbox_overview_counts(ws uuid, tz text default 'Europe/London')
returns jsonb language sql stable security invoker set search_path = public as $$
  with base as (
    select * from public.inbox_conversation_list where workspace_id = ws
  ),
  open_rows as (select * from base where lane = 'open'),
  my_teams as (select team_id from public.inbox_team_members where workspace_id = ws and user_id = auth.uid()),
  today as (select (date_trunc('day', now() at time zone tz)) at time zone tz as start)
  select jsonb_build_object(
    'open', (select count(*) from open_rows),
    'snoozed', (select count(*) from base where lane = 'snoozed'),
    'closed', (select count(*) from base where lane = 'closed'),
    'awaiting', (select count(*) from open_rows where requires_reply),
    'sla_at_risk', (select count(*) from open_rows where sla_status in ('at_risk','breached')),
    'overdue', (select count(*) from open_rows where sla_status = 'breached'),
    'unassigned', (select count(*) from open_rows where assigned_to is null and dismissed_at is null),
    'assigned_to_me', (select count(*) from open_rows where assigned_to = auth.uid()),
    'team_queue', (select count(*) from open_rows where team_id in (select team_id from my_teams)),
    'assignable_today', (select count(*) from open_rows where assigned_to is null and dismissed_at is null
                           and first_response_due_at < (select start from today) + interval '1 day'),
    'median_unowned_secs', (select extract(epoch from percentile_cont(0.5) within group (order by now() - created_at))
                              from open_rows where assigned_to is null and dismissed_at is null),
    'resolved_today', (select count(*) from base where closed_at >= (select start from today)),
    'resolved_yesterday', (select count(*) from base where closed_at >= (select start from today) - interval '1 day'
                             and closed_at < (select start from today)),
    'avg_first_response_secs', (select extract(epoch from avg(first_response_at - created_at)) from base
                                  where first_response_at >= now() - interval '24 hours'),
    'avg_first_response_prev_secs', (select extract(epoch from avg(first_response_at - created_at)) from base
                                       where first_response_at >= now() - interval '48 hours' and first_response_at < now() - interval '24 hours'),
    'avg_resolution_secs', (select extract(epoch from avg(closed_at - created_at)) from base
                              where closed_at >= now() - interval '7 days'),
    'avg_resolution_prev_secs', (select extract(epoch from avg(closed_at - created_at)) from base
                                   where closed_at >= now() - interval '14 days' and closed_at < now() - interval '7 days'),
    'channels', coalesce((select jsonb_object_agg(platform, n) from (select platform, count(*) n from open_rows group by platform) c), '{}'::jsonb),
    'unassigned_channels', coalesce((select jsonb_object_agg(platform, n) from (select platform, count(*) n from open_rows
                                       where assigned_to is null and dismissed_at is null group by platform) c), '{}'::jsonb),
    'unassigned_tags', coalesce((select jsonb_object_agg(tag, n) from (select tag, count(*) n from open_rows, unnest(tags) tag
                                   where assigned_to is null and dismissed_at is null group by tag) t), '{}'::jsonb),
    'unassigned_high', (select count(*) from open_rows where assigned_to is null and dismissed_at is null and priority in ('high','urgent')),
    'unassigned_new', (select count(*) from open_rows where assigned_to is null and dismissed_at is null and first_response_at is null),
    'unassigned_needs_review', (select count(*) from open_rows where assigned_to is null and dismissed_at is null and sentiment = 'negative'),
    'unassigned_mine', (select count(*) from open_rows where assigned_to is null and dismissed_at is null
                          and (team_id is null or team_id in (select team_id from my_teams))),
    'my_open', (select count(*) from open_rows where assigned_to = auth.uid()),
    'mentions', (select count(*) from public.inbox_group_chat_messages m
                  where m.workspace_id = ws and auth.uid() = any (m.mentions) and m.created_at > now() - interval '7 days')
  );
$$;

-- Counts for each configured queue in one pass.
create or replace function public.inbox_queue_counts(ws uuid)
returns table (queue_id uuid, conversations bigint) language sql stable security invoker set search_path = public as $$
  select q.id,
    (select count(*) from public.inbox_conversation_list t
      where t.workspace_id = ws and t.lane = 'open'
        and (not (q.filters ? 'assignee') or (q.filters->>'assignee' = 'me' and t.assigned_to = auth.uid()))
        and (not (q.filters ? 'priority') or t.priority in (select jsonb_array_elements_text(q.filters->'priority')))
        and (not (q.filters ? 'sla') or t.sla_status in (select jsonb_array_elements_text(q.filters->'sla')))
        and (not (q.filters ? 'waiting') or t.waiting_on_customer)
        and (not (q.filters ? 'escalated') or t.escalated_at is not null)
        and (not (q.filters ? 'segment') or t.contact_segment in (select jsonb_array_elements_text(q.filters->'segment')))
        and (not (q.filters ? 'tags') or t.tags && array(select jsonb_array_elements_text(q.filters->'tags')))
        and (not (q.filters ? 'teamName') or t.team_name = q.filters->>'teamName'))
  from public.inbox_queues q
  where q.workspace_id = ws;
$$;

-- Active assignment load per member (open conversations only).
create or replace function public.inbox_workload(ws uuid)
returns table (user_id uuid, full_name text, avatar_url text, active bigint, capacity integer)
language sql stable security invoker set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, count(t.id) as active,
         coalesce(max(tm.capacity), 30) as capacity
  from public.inbox_conversation_list t
  join public.profiles p on p.id = t.assigned_to
  left join public.inbox_team_members tm on tm.user_id = p.id and tm.workspace_id = ws
  where t.workspace_id = ws and t.lane = 'open'
  group by p.id, p.full_name, p.avatar_url
  order by active desc;
$$;

-- Writes today's point-in-time counts once per day (first page load wins).
create or replace function public.inbox_record_snapshot(ws uuid, tz text default 'Europe/London')
returns void language plpgsql security invoker set search_path = public as $$
declare d date := (now() at time zone tz)::date;
begin
  if not public.is_workspace_member(ws) then return; end if;
  insert into public.inbox_metric_snapshots (workspace_id, day, metrics)
  values (ws, d, public.inbox_overview_counts(ws, tz) - 'channels' - 'unassigned_channels' - 'unassigned_tags')
  on conflict (workspace_id, day) do nothing;
end;
$$;

grant execute on function public.inbox_overview_counts(uuid, text) to authenticated;
grant execute on function public.inbox_queue_counts(uuid) to authenticated;
grant execute on function public.inbox_workload(uuid) to authenticated;
grant execute on function public.inbox_record_snapshot(uuid, text) to authenticated;
