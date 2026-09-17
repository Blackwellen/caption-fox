-- ============================================================================
-- Caption Fox — Link in Bio: daily analytics rollups
--
-- Raw link_analytics_events are rolled into per-day rows by the Link in Bio
-- job (POST /api/links/jobs/tick). Dashboards read rollups up to the
-- workspace's watermark (latest rolled day) plus raw events after it, so no
-- event is ever counted twice and dashboards never scan months of raw rows.
--
-- grain = 'total'    one row per (day, page | reusable link): views, clicks,
--                    uniques (daily), conversions, revenue
-- grain = 'device' | 'source' | 'referrer' | 'item': click breakdown rows
-- ============================================================================

create table if not exists public.link_analytics_rollups (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  day date not null,
  grain text not null check (grain in ('total','device','source','referrer','item')),
  page_id uuid references public.link_pages(id) on delete cascade,
  reusable_link_id uuid references public.reusable_links(id) on delete cascade,
  item_id uuid references public.link_page_items(id) on delete cascade,
  dimension text,
  views integer not null default 0,
  clicks integer not null default 0,
  product_clicks integer not null default 0,
  form_submits integer not null default 0,
  conversions integer not null default 0,
  revenue_pence bigint not null default 0,
  uniques integer not null default 0
);
create index if not exists idx_link_rollups_ws_day on public.link_analytics_rollups(workspace_id, day, grain);
create index if not exists idx_link_rollups_page on public.link_analytics_rollups(page_id, day) where page_id is not null;
create index if not exists idx_link_rollups_link on public.link_analytics_rollups(reusable_link_id, day) where reusable_link_id is not null;

alter table public.link_analytics_rollups enable row level security;
drop policy if exists "link_analytics_rollups_read" on public.link_analytics_rollups;
create policy "link_analytics_rollups_read" on public.link_analytics_rollups for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- Rolls every complete day (before today, Europe/London) that is not yet
-- rolled for a workspace. Service-role only; called by the job route.
create or replace function public.link_analytics_rollup(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  watermark date;
  today date := (now() at time zone 'Europe/London')::date;
  rows_written integer := 0;
begin
  select max(day) into watermark from public.link_analytics_rollups where workspace_id = p_workspace_id;

  with ev as (
    select e.*, (e.created_at at time zone 'Europe/London')::date as d
    from public.link_analytics_events e
    where e.workspace_id = p_workspace_id
      and (e.created_at at time zone 'Europe/London')::date < today
      and (watermark is null or (e.created_at at time zone 'Europe/London')::date > watermark)
  ), ins as (
    insert into public.link_analytics_rollups (workspace_id, day, grain, page_id, reusable_link_id, item_id, dimension,
      views, clicks, product_clicks, form_submits, conversions, revenue_pence, uniques)
    select p_workspace_id, d, 'total', page_id, reusable_link_id, null, null,
      count(*) filter (where event_type = 'page_view'),
      count(*) filter (where event_type in ('link_click','product_click')),
      count(*) filter (where event_type = 'product_click'),
      count(*) filter (where event_type = 'form_submit'),
      count(*) filter (where event_type in ('conversion','form_submit')),
      coalesce(sum(value_pence) filter (where event_type = 'conversion'), 0),
      count(distinct visitor_hash) filter (where visitor_hash is not null)
    from ev group by d, page_id, reusable_link_id
    union all
    select p_workspace_id, d, 'device', page_id, reusable_link_id, null, coalesce(device_type, 'other'),
      0, count(*), 0, 0, 0, 0, 0
    from ev where event_type in ('link_click','product_click') group by d, page_id, reusable_link_id, device_type
    union all
    select p_workspace_id, d, 'source', page_id, reusable_link_id, null, coalesce(source, 'direct'),
      0, count(*), 0, 0, 0, 0, 0
    from ev where event_type in ('link_click','product_click') group by d, page_id, reusable_link_id, source
    union all
    select p_workspace_id, d, 'referrer', page_id, reusable_link_id, null, referrer,
      0, count(*), 0, 0, 0, 0, 0
    from ev where event_type in ('link_click','product_click') and referrer is not null group by d, page_id, reusable_link_id, referrer
    union all
    select p_workspace_id, d, 'item', page_id, null, item_id, null,
      0, count(*), 0, 0, 0, 0, 0
    from ev where item_id is not null and event_type in ('link_click','product_click') group by d, page_id, item_id
    returning 1
  )
  select count(*) into rows_written from ins;
  return rows_written;
end;
$$;
revoke all on function public.link_analytics_rollup(uuid) from public, anon, authenticated;

create or replace function public.link_analytics_summary(
  p_workspace_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_page_id uuid default null,
  p_link_id uuid default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
  watermark date;
begin
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  select max(day) into watermark from public.link_analytics_rollups where workspace_id = p_workspace_id;

  with r as (
    select * from public.link_analytics_rollups x
    where x.workspace_id = p_workspace_id
      and x.day >= (p_from at time zone 'Europe/London')::date
      and x.day < (p_to at time zone 'Europe/London')::date + (case when (p_to at time zone 'Europe/London')::time > '00:00' then 1 else 0 end)
      and (p_page_id is null or x.page_id = p_page_id)
      and (p_link_id is null or x.reusable_link_id = p_link_id)
  ), ev as (
    select e.*, (e.created_at at time zone 'Europe/London')::date as d from public.link_analytics_events e
    where e.workspace_id = p_workspace_id
      and e.created_at >= p_from and e.created_at < p_to
      and (watermark is null or (e.created_at at time zone 'Europe/London')::date > watermark)
      and (p_page_id is null or e.page_id = p_page_id)
      and (p_link_id is null or e.reusable_link_id = p_link_id)
  ), totals as (
    select d as day, page_id, reusable_link_id,
      count(*) filter (where event_type = 'page_view') as views,
      count(*) filter (where event_type in ('link_click','product_click')) as clicks,
      count(*) filter (where event_type = 'product_click') as product_clicks,
      count(*) filter (where event_type = 'form_submit') as form_submits,
      count(*) filter (where event_type in ('conversion','form_submit')) as conversions,
      coalesce(sum(value_pence) filter (where event_type = 'conversion'), 0) as revenue_pence,
      count(distinct visitor_hash) filter (where visitor_hash is not null) as uniques
    from ev group by 1, 2, 3
    union all
    select day, page_id, reusable_link_id, views, clicks, product_clicks, form_submits, conversions, revenue_pence, uniques
    from r where grain = 'total'
  ), breakdown as (
    select 'device' as grain, coalesce(device_type, 'other') as dimension, page_id, reusable_link_id, item_id, 1 as clicks
    from ev where event_type in ('link_click','product_click')
    union all
    select 'source', coalesce(source, 'direct'), page_id, reusable_link_id, item_id, 1 from ev where event_type in ('link_click','product_click')
    union all
    select 'referrer', referrer, page_id, reusable_link_id, item_id, 1 from ev where event_type in ('link_click','product_click') and referrer is not null
    union all
    select 'item', null, page_id, reusable_link_id, item_id, 1 from ev where item_id is not null and event_type in ('link_click','product_click')
    union all
    select grain, dimension, page_id, reusable_link_id, item_id, clicks from r where grain <> 'total'
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
      'views', coalesce(sum(views), 0), 'clicks', coalesce(sum(clicks), 0),
      'product_clicks', coalesce(sum(product_clicks), 0), 'form_submits', coalesce(sum(form_submits), 0),
      'conversions', coalesce(sum(conversions), 0), 'revenue_pence', coalesce(sum(revenue_pence), 0),
      'uniques', coalesce(sum(uniques), 0)
    ) from totals),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
      select to_char(day, 'YYYY-MM-DD') as day, sum(views) as views, sum(clicks) as clicks,
        sum(uniques) as uniques, sum(conversions) as conversions
      from totals group by day
    ) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select dimension as device, sum(clicks) as clicks from breakdown where grain = 'device' group by 1
    ) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select dimension as source, sum(clicks) as clicks from breakdown where grain = 'source' group by 1
    ) x), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select dimension as host, sum(clicks) as clicks from breakdown where grain = 'referrer' group by 1 order by 2 desc limit 8
    ) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select page_id, sum(views) as views, sum(clicks) as clicks, sum(conversions) as conversions,
        sum(revenue_pence) as revenue_pence, sum(uniques) as uniques
      from totals where page_id is not null group by 1
    ) x), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select reusable_link_id as link_id, sum(clicks) as clicks, sum(uniques) as uniques
      from totals where reusable_link_id is not null group by 1
    ) x), '[]'::jsonb),
    'link_sources', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select dimension as source, sum(clicks) as clicks from breakdown where grain = 'source' and reusable_link_id is not null group by 1
    ) x), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select item_id, sum(clicks) as clicks from breakdown where grain = 'item' group by 1
    ) x), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.link_analytics_summary(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;
