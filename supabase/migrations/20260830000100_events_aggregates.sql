-- ============================================================
-- Events module — aggregate views and trend RPCs.
--
-- Every list surface needs per-event registration/attendance/sponsor counts and
-- every chart needs a day-bucketed series. Doing that in the client would be an
-- N+1 per card; these views and functions push it into one indexed query.
--
-- security_invoker on the views keeps RLS on the underlying tables in force,
-- so a view can never widen access beyond workspace membership.
-- ============================================================

-- ------------------------------------------------------------
-- Per-event registration + attendance counts
-- ------------------------------------------------------------
create or replace view public.event_registration_stats
with (security_invoker = true) as
select
  r.workspace_id,
  r.event_id,
  count(*)::int                                                   as registrations,
  count(*) filter (where r.status <> 'cancelled')::int            as active_registrations,
  count(*) filter (
    where r.status in ('confirmed','registered','attended','checked_in','no_show')
  )::int                                                          as eligible_registrations,
  count(*) filter (where r.attended)::int                         as attended,
  count(*) filter (where r.status = 'waitlisted')::int            as waitlisted,
  count(*) filter (where r.status = 'cancelled')::int             as cancelled,
  count(*) filter (where r.follow_up_status = 'not_contacted')::int as awaiting_follow_up,
  avg(nullif(r.watch_seconds, 0))::int                            as avg_watch_seconds
from public.event_registrations r
group by r.workspace_id, r.event_id;

-- ------------------------------------------------------------
-- Per-event sponsor counts and contracted value
-- ------------------------------------------------------------
create or replace view public.event_sponsor_stats
with (security_invoker = true) as
select
  s.workspace_id,
  s.event_id,
  count(*)::int                                              as sponsorships,
  count(*) filter (where s.stage in ('contracted','active','completed'))::int as confirmed_sponsors,
  coalesce(sum(s.value) filter (where s.stage in ('contracted','active','completed')), 0)::numeric as confirmed_value,
  coalesce(sum(s.value) filter (where s.stage not in ('lost','completed')), 0)::numeric as pipeline_value
from public.sponsorships s
where s.event_id is not null
group by s.workspace_id, s.event_id;

-- ------------------------------------------------------------
-- Per-sponsorship deliverable completion
-- ------------------------------------------------------------
create or replace view public.sponsorship_deliverable_stats
with (security_invoker = true) as
select
  d.workspace_id,
  d.sponsorship_id,
  count(*)::int                                             as total,
  count(*) filter (where d.status in ('completed','approved'))::int as completed,
  count(*) filter (
    where d.status not in ('completed','approved','cancelled')
      and d.due_at is not null and d.due_at <= now() + interval '30 days'
  )::int                                                    as due_soon
from public.sponsorship_deliverables d
group by d.workspace_id, d.sponsorship_id;

-- ------------------------------------------------------------
-- Registration / attendance trend (Registration Performance chart)
-- ------------------------------------------------------------
create or replace function public.events_registration_trend(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_event uuid default null
)
returns table (day date, registrations int, attendees int)
language sql stable security invoker as $$
  select
    d::date as day,
    coalesce(count(r.id) filter (where r.id is not null), 0)::int as registrations,
    coalesce(count(r.id) filter (where r.attended), 0)::int       as attendees
  from generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') d
  left join public.event_registrations r
    on r.workspace_id = p_workspace
   and (p_event is null or r.event_id = p_event)
   and r.registered_at >= d
   and r.registered_at < d + interval '1 day'
  group by d
  order by d;
$$;

-- ------------------------------------------------------------
-- Outreach trend (Follow-up: Outreach Performance chart)
-- ------------------------------------------------------------
create or replace function public.events_outreach_trend(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (day date, sent int, opened int, replied int, meetings int)
language sql stable security invoker as $$
  select
    d::date as day,
    coalesce(count(o.id) filter (where o.outreach_type = 'email_sent'), 0)::int    as sent,
    coalesce(count(o.id) filter (where o.outreach_type = 'email_opened'), 0)::int  as opened,
    coalesce(count(o.id) filter (where o.outreach_type = 'email_replied'), 0)::int as replied,
    coalesce(count(o.id) filter (where o.outreach_type = 'meeting_booked'), 0)::int as meetings
  from generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') d
  left join public.event_outreach_events o
    on o.workspace_id = p_workspace
   and o.occurred_at >= d
   and o.occurred_at < d + interval '1 day'
  group by d
  order by d;
$$;

-- ------------------------------------------------------------
-- Podcast listener trend
-- ------------------------------------------------------------
create or replace function public.podcast_listener_trend(
  p_workspace uuid,
  p_from date,
  p_to date,
  p_show uuid default null
)
returns table (day date, listens int, unique_listeners int)
language sql stable security invoker as $$
  select
    d::date as day,
    coalesce(sum(l.listens), 0)::int           as listens,
    coalesce(sum(l.unique_listeners), 0)::int  as unique_listeners
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.podcast_listener_daily l
    on l.workspace_id = p_workspace
   and (p_show is null or l.show_id = p_show)
   and l.day = d::date
  group by d
  order by d;
$$;

-- ------------------------------------------------------------
-- Sponsorship revenue by month (this year vs last year)
-- ------------------------------------------------------------
create or replace function public.sponsorship_revenue_trend(
  p_workspace uuid,
  p_year int
)
returns table (month date, this_year numeric, last_year numeric)
language sql stable security invoker as $$
  select
    m::date as month,
    coalesce((
      select sum(s.value) from public.sponsorships s
      where s.workspace_id = p_workspace
        and s.stage in ('contracted','active','completed')
        and coalesce(s.contract_signed_at, s.created_at) >= m
        and coalesce(s.contract_signed_at, s.created_at) < m + interval '1 month'
    ), 0)::numeric as this_year,
    coalesce((
      select sum(s.value) from public.sponsorships s
      where s.workspace_id = p_workspace
        and s.stage in ('contracted','active','completed')
        and coalesce(s.contract_signed_at, s.created_at) >= m - interval '1 year'
        and coalesce(s.contract_signed_at, s.created_at) < m - interval '1 year' + interval '1 month'
    ), 0)::numeric as last_year
  from generate_series(
    make_date(p_year, 1, 1),
    make_date(p_year, 12, 1),
    interval '1 month'
  ) m
  order by m;
$$;

-- ------------------------------------------------------------
-- Webinar attendance-rate trend
-- ------------------------------------------------------------
create or replace function public.webinar_attendance_trend(
  p_workspace uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (day date, attendance_rate numeric)
language sql stable security invoker as $$
  select
    d::date as day,
    case
      when count(r.id) filter (
        where r.status in ('confirmed','registered','attended','checked_in','no_show')
      ) = 0 then null
      else round(
        count(r.id) filter (where r.attended)::numeric
        / count(r.id) filter (
            where r.status in ('confirmed','registered','attended','checked_in','no_show')
          )::numeric, 4)
    end as attendance_rate
  from generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') d
  left join public.events e
    on e.workspace_id = p_workspace
   and e.event_type = 'webinar'
   and e.start_at >= d and e.start_at < d + interval '1 day'
  left join public.event_registrations r on r.event_id = e.id
  group by d
  order by d;
$$;

-- ------------------------------------------------------------
-- Follow-up owner leaderboard (Top Owners panel)
-- ------------------------------------------------------------
create or replace function public.events_followup_owner_stats(p_workspace uuid)
returns table (owner_id uuid, total int, completed int)
language sql stable security invoker as $$
  select
    t.owner_id,
    count(*)::int                                          as total,
    count(*) filter (where t.status = 'completed')::int     as completed
  from public.event_followup_tasks t
  where t.workspace_id = p_workspace and t.owner_id is not null
  group by t.owner_id
  order by count(*) desc;
$$;
