-- Daily snapshot that fills the Studio history tables for every workspace.
--  * Keyword groups: today's stored average volume and relevance.
--  * Published posts: today's engagement increment = current lifetime totals
--    minus the days already recorded (never negative, so a platform correcting
--    its counts downward cannot produce negative history).
-- Idempotent: re-running on the same day overwrites today's rows.

create or replace function public.studio_daily_metrics_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_keywords integer := 0;
  v_posts integer := 0;
begin
  insert into public.studio_keyword_metrics_daily (workspace_id, set_id, day, avg_volume, relevance)
  select s.workspace_id, s.id, v_today, greatest(0, s.avg_volume), s.relevance_score
    from public.hashtag_sets s
   where s.archived_at is null and s.avg_volume is not null
  on conflict (set_id, day) do update
    set avg_volume = excluded.avg_volume, relevance = excluded.relevance;
  get diagnostics v_keywords = row_count;

  with totals as (
    select p.id, p.workspace_id,
           coalesce((p.engagement->>'views')::numeric, 0)::bigint    as views,
           coalesce((p.engagement->>'likes')::numeric, 0)::bigint    as likes,
           coalesce((p.engagement->>'comments')::numeric, 0)::bigint as comments,
           coalesce((p.engagement->>'shares')::numeric, 0)::bigint   as shares
      from public.content_posts p
     where p.status = 'published' and p.archived_at is null
       and p.engagement is not null and jsonb_typeof(p.engagement) = 'object'
  ), recorded as (
    select d.post_id, sum(d.views) views, sum(d.likes) likes, sum(d.comments) comments, sum(d.shares) shares
      from public.content_engagement_daily d
     where d.day < v_today
     group by d.post_id
  )
  insert into public.content_engagement_daily (workspace_id, post_id, day, views, likes, comments, shares)
  select t.workspace_id, t.id, v_today,
         least(greatest(0, t.views    - coalesce(r.views, 0)),    2147483647)::int,
         least(greatest(0, t.likes    - coalesce(r.likes, 0)),    2147483647)::int,
         least(greatest(0, t.comments - coalesce(r.comments, 0)), 2147483647)::int,
         least(greatest(0, t.shares   - coalesce(r.shares, 0)),   2147483647)::int
    from totals t left join recorded r on r.post_id = t.id
   where t.views + t.likes + t.comments + t.shares > 0
  on conflict (post_id, day) do update
    set views = excluded.views, likes = excluded.likes, comments = excluded.comments, shares = excluded.shares;
  get diagnostics v_posts = row_count;

  return jsonb_build_object('keyword_rows', v_keywords, 'engagement_rows', v_posts, 'ran_on', v_today);
end
$fn$;

revoke all on function public.studio_daily_metrics_snapshot() from public, anon, authenticated;

-- 23:50 UTC daily, after the day's engagement syncs; re-running replaces the job.
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'studio-daily-metrics';
    perform cron.schedule('studio-daily-metrics', '50 23 * * *', 'select public.studio_daily_metrics_snapshot()');
  else
    raise notice 'pg_cron not installed; schedule public.studio_daily_metrics_snapshot() manually';
  end if;
end
$cron$;
