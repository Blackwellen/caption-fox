-- ============================================================
-- SEO & Discovery — additive demo seed: rank history for brief keywords.
--
-- 20260916000200 started tracking each demo brief's target keyword, but those
-- keywords had no rows in seo_keyword_rankings, so the Briefs rail's "Ranking
-- Trend" and the keyword sparklines fell back to their empty states.
--
-- This backfills 120 days of daily positions for any demo keyword that has a
-- current_rank but no ranking history, using the same deterministic curve as
-- the original seed (20260831000100) so the two datasets are consistent.
-- Additive and idempotent: only touches demo keywords with zero history.
-- ============================================================

insert into public.seo_keyword_rankings
  (workspace_id, site_id, keyword_id, date, position, clicks, impressions, ctr, url, serp_features, source, is_demo)
select
  k.workspace_id,
  k.site_id,
  k.id,
  d.day,
  greatest(1, round(
    k.current_rank
    + (coalesce(k.previous_rank, k.current_rank) - k.current_rank) * (d.offset_days / 120.0)
    + 1.6 * sin((d.offset_days + (('x' || substr(md5(k.keyword), 1, 6))::bit(24)::int % 30)) / 5.0)
  )::int),
  greatest(0, round(k.search_volume * 0.004 * (1 + 0.25 * sin(d.offset_days / 9.0)))::int),
  greatest(0, round(k.search_volume * 0.06 * (1 + 0.18 * cos(d.offset_days / 11.0)))::int),
  0.0,
  k.landing_page,
  case when k.current_rank <= 5 then array['featured_snippet', 'people_also_ask'] else array['people_also_ask'] end,
  'google_search_console',
  true
from public.seo_keywords k
join public.seo_sites s on s.id = k.site_id and s.is_demo = true
cross join lateral (
  select current_date - g as day, g as offset_days from generate_series(0, 119) g
) d
where k.is_demo = true
  and k.current_rank is not null
  and not exists (
    select 1 from public.seo_keyword_rankings r where r.keyword_id = k.id
  )
on conflict do nothing;
