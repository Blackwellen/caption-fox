-- Caption Fox Marketplace — backfill discovery metrics for demo creators.
--
-- The original marketplace seed (20260630010000_marketplace.sql era) created a
-- handful of creator rows before the discovery columns existed, so profiles
-- such as Priya K and Mara Lewis rendered with em dashes for audience,
-- engagement and platform reach while every enriched profile beside them was
-- complete.
--
-- Values are derived from each row's own reviews/projects signal rather than
-- random numbers, so the directory stays internally consistent and repeated
-- runs produce the same result. Demo rows only.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_marketplace_creator_metrics.sql
-- Idempotent: only fills columns that are still null/empty.

update public.marketplace_suppliers s set
  audience_size = coalesce(s.audience_size, greatest(40000, (s.reviews_count * 2600)::bigint)),
  engagement_rate = coalesce(s.engagement_rate,
    round((3.4 + ((s.rating - 4.5) * 2.2) + ((s.reviews_count % 7) * 0.12))::numeric, 2)),
  audience_summary = coalesce(nullif(s.audience_summary, ''),
    case
      when s.type = 'influencer' then
        (60 + (s.reviews_count % 35))::text || '% ' ||
        (case (s.reviews_count % 3) when 0 then 'Female' when 1 then 'Male' else 'Mixed' end) ||
        ', 18-' || (30 + (s.reviews_count % 12))::text
      else
        (65 + (s.reviews_count % 30))::text || '% ' ||
        (case (s.reviews_count % 2) when 0 then 'Female' else 'Mixed' end) ||
        ', 18-' || (28 + (s.reviews_count % 14))::text
    end)
where s.is_demo
  and s.type in ('influencer', 'ugc_creator')
  and (s.audience_size is null or s.engagement_rate is null or coalesce(s.audience_summary, '') = '');

-- Platform reach, split across the creator's own declared platforms so the
-- three-up follower row on the influencer card has real numbers behind it.
update public.marketplace_suppliers s set
  follower_counts = jsonb_strip_nulls(jsonb_build_object(
    'tiktok',    case when 'tiktok'    = any(s.platforms) then round(s.audience_size * 0.30) else null end,
    'instagram', case when 'instagram' = any(s.platforms) then round(s.audience_size * 0.44) else null end,
    'youtube',   case when 'youtube'   = any(s.platforms) then round(s.audience_size * 0.18) else null end,
    'linkedin',  case when 'linkedin'  = any(s.platforms) then round(s.audience_size * 0.08) else null end,
    'podcast',   case when 'podcast'   = any(s.platforms) then round(s.audience_size * 0.06) else null end
  ))
where s.is_demo
  and s.type in ('influencer', 'ugc_creator')
  and s.audience_size is not null
  and coalesce(s.follower_counts, '{}'::jsonb) = '{}'::jsonb;

-- A few legacy creator rows declared no platforms at all, which left the reach
-- object above empty. Give them the default creator mix, then fill reach.
update public.marketplace_suppliers s set
  platforms = array['tiktok', 'instagram', 'youtube']
where s.is_demo
  and s.type in ('influencer', 'ugc_creator')
  and coalesce(array_length(s.platforms, 1), 0) = 0;

update public.marketplace_suppliers s set
  follower_counts = jsonb_strip_nulls(jsonb_build_object(
    'tiktok',    case when 'tiktok'    = any(s.platforms) then round(s.audience_size * 0.30) else null end,
    'instagram', case when 'instagram' = any(s.platforms) then round(s.audience_size * 0.44) else null end,
    'youtube',   case when 'youtube'   = any(s.platforms) then round(s.audience_size * 0.18) else null end,
    'linkedin',  case when 'linkedin'  = any(s.platforms) then round(s.audience_size * 0.08) else null end,
    'podcast',   case when 'podcast'   = any(s.platforms) then round(s.audience_size * 0.06) else null end
  ))
where s.is_demo
  and s.type in ('influencer', 'ugc_creator')
  and s.audience_size is not null
  and coalesce(s.follower_counts, '{}'::jsonb) = '{}'::jsonb;
