-- Caption Fox Marketplace — demo portfolio strips.
--
-- Gives every demo creator and service provider four recent-work thumbnails, as
-- the approved UGC-creator and services designs show under each profile card.
-- Thumbnails come from one curated pool rendered by
-- scripts/render-marketplace-seed-media.py; each supplier is assigned four
-- pool slots deterministically from a hash of its id, so a profile always shows
-- the same work and no two neighbours in a row look identical.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_marketplace_portfolio.sql
-- Idempotent: re-running refreshes the same four rows per supplier.

with target as (
  select s.id,
         ('x' || substr(md5(s.id::text), 1, 8))::bit(32)::bigint as seed
  from public.marketplace_suppliers s
  where s.is_demo
    and s.status = 'active'
    and s.type in ('ugc_creator', 'influencer', 'agency', 'freelancer', 'ads_manager')
),
slots as (
  select t.id as supplier_id,
         gs.position,
         -- four distinct pool slots, spaced so adjacent profiles differ
         ((t.seed / power(7, gs.position)::bigint) + gs.position * 5) % 24 as pool_index
  from target t
  cross join generate_series(0, 3) as gs(position)
)
insert into public.marketplace_portfolio_items
  (supplier_id, position, title, media_url, media_type, is_demo)
select
  slots.supplier_id,
  slots.position,
  'Recent work ' || (slots.position + 1)::text,
  '/demo/marketplace/portfolio/pool-' || lpad(slots.pool_index::text, 2, '0') || '.jpg',
  'image',
  true
from slots
on conflict (supplier_id, position) do update
  set media_url = excluded.media_url,
      title = excluded.title,
      is_demo = true,
      updated_at = now();
