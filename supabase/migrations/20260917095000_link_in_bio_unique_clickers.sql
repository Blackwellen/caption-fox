-- ============================================================================
-- Caption Fox — Link in Bio: "Unique visitors" counts unique clickers
--
-- Dashboards plot unique visitors against clicks, so the unique count is the
-- number of distinct (daily-salted) visitors who clicked, not distinct page
-- viewers. Rollup 'total' rows written from now on use that definition.
-- ============================================================================

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
    select p_workspace_id, d, 'total', page_id, reusable_link_id, null, coalesce(source, 'direct'),
      count(*) filter (where event_type = 'page_view'),
      count(*) filter (where event_type in ('link_click','product_click')),
      count(*) filter (where event_type = 'product_click'),
      count(*) filter (where event_type = 'form_submit'),
      count(*) filter (where event_type in ('conversion','form_submit')),
      coalesce(sum(value_pence) filter (where event_type = 'conversion'), 0),
      count(distinct visitor_hash) filter (where visitor_hash is not null and event_type in ('link_click','product_click'))
    from ev group by d, page_id, reusable_link_id, coalesce(source, 'direct')
    union all
    select p_workspace_id, d, 'device', page_id, reusable_link_id, null, coalesce(device_type, 'other'), 0, count(*), 0, 0, 0, 0, 0
    from ev where event_type in ('link_click','product_click') group by d, page_id, reusable_link_id, device_type
    union all
    select p_workspace_id, d, 'referrer', page_id, reusable_link_id, null, referrer, 0, count(*), 0, 0, 0, 0, 0
    from ev where event_type in ('link_click','product_click') and referrer is not null group by d, page_id, reusable_link_id, referrer
    union all
    select p_workspace_id, d, 'item', page_id, null, item_id, null, 0, count(*), 0, 0, 0, 0, 0
    from ev where item_id is not null and event_type in ('link_click','product_click') group by d, page_id, item_id
    returning 1
  )
  select count(*) into rows_written from ins;
  return rows_written;
end;
$$;
revoke all on function public.link_analytics_rollup(uuid) from public, anon, authenticated;

-- The summary RPC's raw-event branch uses the same definition.
do $$
declare def text;
begin
  select pg_get_functiondef('public.link_analytics_summary(uuid, timestamptz, timestamptz, uuid[], uuid, text)'::regprocedure) into def;
  def := replace(def,
    'count(distinct visitor_hash) filter (where visitor_hash is not null) as uniques',
    'count(distinct visitor_hash) filter (where visitor_hash is not null and event_type in (''link_click'',''product_click'')) as uniques');
  execute def;
end $$;
