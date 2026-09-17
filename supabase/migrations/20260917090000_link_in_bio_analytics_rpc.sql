-- ============================================================================
-- Caption Fox — Link in Bio: server-side analytics aggregation
--
-- One call returns every aggregate a Link in Bio dashboard needs for a window,
-- optionally scoped to a page or reusable link. SECURITY INVOKER, so RLS on
-- link_analytics_events still applies, plus an explicit membership check.
--
-- Event semantics (no double counting):
--   views       = page_view
--   clicks      = link_click + product_click (a /r redirect records link_click
--                 against the reusable link only, never the page as well)
--   conversions = conversion + form_submit
--   uniques     = distinct daily-salted visitor_hash on page_view / link_click
-- ============================================================================

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
begin
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = auth.uid()) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  with ev as (
    select * from public.link_analytics_events e
    where e.workspace_id = p_workspace_id
      and e.created_at >= p_from and e.created_at < p_to
      and (p_page_id is null or e.page_id = p_page_id)
      and (p_link_id is null or e.reusable_link_id = p_link_id)
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
      'views', count(*) filter (where event_type = 'page_view'),
      'clicks', count(*) filter (where event_type in ('link_click','product_click')),
      'product_clicks', count(*) filter (where event_type = 'product_click'),
      'form_submits', count(*) filter (where event_type = 'form_submit'),
      'conversions', count(*) filter (where event_type in ('conversion','form_submit')),
      'revenue_pence', coalesce(sum(value_pence) filter (where event_type = 'conversion'), 0),
      'uniques', count(distinct visitor_hash) filter (where event_type in ('page_view','link_click') and visitor_hash is not null),
      'qr_visits', count(*) filter (where event_type = 'qr_visit')
    ) from ev),
    'daily', coalesce((select jsonb_agg(d order by d.day) from (
      select to_char(date_trunc('day', created_at at time zone 'Europe/London'), 'YYYY-MM-DD') as day,
        count(*) filter (where event_type = 'page_view') as views,
        count(*) filter (where event_type in ('link_click','product_click')) as clicks,
        count(distinct visitor_hash) filter (where event_type in ('page_view','link_click') and visitor_hash is not null) as uniques,
        count(*) filter (where event_type in ('conversion','form_submit')) as conversions
      from ev group by 1
    ) d), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select coalesce(device_type, 'other') as device, count(*) as clicks
      from ev where event_type in ('link_click','product_click') group by 1
    ) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select coalesce(source, 'direct') as source, count(*) as clicks
      from ev where event_type in ('link_click','product_click') group by 1
    ) x), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select referrer as host, count(*) as clicks
      from ev where event_type in ('link_click','product_click') and referrer is not null
      group by 1 order by 2 desc limit 8
    ) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select page_id,
        count(*) filter (where event_type = 'page_view') as views,
        count(*) filter (where event_type in ('link_click','product_click')) as clicks,
        count(*) filter (where event_type in ('conversion','form_submit')) as conversions,
        coalesce(sum(value_pence) filter (where event_type = 'conversion'), 0) as revenue_pence
      from ev where page_id is not null group by 1
    ) x), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select reusable_link_id as link_id, count(*) filter (where event_type = 'link_click') as clicks,
        count(distinct visitor_hash) filter (where visitor_hash is not null) as uniques
      from ev where reusable_link_id is not null group by 1
    ) x), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select item_id, count(*) as clicks
      from ev where item_id is not null and event_type in ('link_click','product_click') group by 1
    ) x), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.link_analytics_summary(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;
