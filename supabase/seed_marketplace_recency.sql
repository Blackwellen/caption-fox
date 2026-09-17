-- Caption Fox Marketplace — re-base demo timestamps onto "now".
--
-- The module seeder writes its demo activity, requests and orders relative to
-- the moment it runs, so a workspace seeded weeks ago shows stale absolute
-- dates ("29 Aug 2026") and deadlines that have all quietly expired. This
-- re-bases those demo rows onto the current clock so activity reads as minutes
-- and hours, and deadlines sit ahead of today again.
--
-- Demo rows only: it touches workspaces that hold seeded marketplace demo data
-- and never rewrites a real customer record's history.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_marketplace_recency.sql
-- Idempotent: safe to run repeatedly (it always re-bases onto the current now()).

-- Activity: keep the original ordering, compress onto the last few hours so the
-- feed reads like a live workspace.
with ordered as (
  select id, row_number() over (partition by workspace_id order by created_at desc) as rn
  from public.marketplace_activity
)
update public.marketplace_activity a
set created_at = now() - (ordered.rn * 17 || ' minutes')::interval
from ordered
where a.id = ordered.id;

-- Requests: created in the recent past, deadlines spread across the next
-- fortnight, preserving each request's relative order and its status meaning.
with ordered as (
  select id, row_number() over (partition by workspace_id order by created_at) as rn
  from public.marketplace_requests
)
update public.marketplace_requests r
set created_at = now() - ((16 - ordered.rn) || ' days')::interval,
    updated_at = now() - (ordered.rn || ' hours')::interval,
    deadline = case
      when r.status in ('closed_won', 'closed_cancelled') then (now() - interval '4 days')::date
      else (now() + ((ordered.rn * 3) || ' days')::interval)::date
    end
from ordered
where r.id = ordered.id;

-- Orders: due dates ahead for live work, behind for delivered/completed work,
-- so the "overdue" and "due today" states in the tracker stay meaningful.
with ordered as (
  select id, row_number() over (partition by workspace_id order by created_at) as rn
  from public.marketplace_orders
)
update public.marketplace_orders o
set created_at = now() - ((22 - ordered.rn) || ' days')::interval,
    updated_at = now() - (ordered.rn || ' hours')::interval,
    due_date = case
      when o.delivery_status in ('delivered', 'cancelled') then (now() - ((ordered.rn % 5) + 1 || ' days')::interval)::date
      when o.delivery_status = 'overdue' then (now() - interval '2 days')::date
      else (now() + ((ordered.rn % 9) || ' days')::interval)::date
    end
from ordered
where o.id = ordered.id;

-- Saved items and saved searches, so "last interaction" copy stays plausible.
with ordered as (
  select id, row_number() over (partition by workspace_id order by created_at desc) as rn
  from public.marketplace_saved_items
)
update public.marketplace_saved_items s
set last_interaction_at = now() - ((ordered.rn * 9) || ' hours')::interval
from ordered
where s.id = ordered.id;

with ordered as (
  select id, row_number() over (partition by workspace_id order by updated_at desc) as rn
  from public.marketplace_saved_searches
)
update public.marketplace_saved_searches s
set updated_at = now() - ((ordered.rn * 6) || ' hours')::interval
from ordered
where s.id = ordered.id;

-- Proposals: keep each request's responses arriving after the request itself,
-- so "Recent proposals" reads in hours and days rather than last month.
with ordered as (
  select p.id, row_number() over (order by p.created_at desc) as rn
  from public.marketplace_proposals p
)
update public.marketplace_proposals p
set created_at = now() - ((ordered.rn * 4) || ' hours')::interval
from ordered
where p.id = ordered.id;

-- Delivery timestamps. On-time delivery is measured as completed_at <= due_date,
-- so delivered demo orders need a real delivery date: most land inside the
-- deadline, a minority slip past it, giving a believable on-time rate instead
-- of 0% (no timestamps) or a flat 100%.
update public.marketplace_orders o
set completed_at = case
      when (('x' || substr(md5(o.id::text), 1, 4))::bit(16)::int % 100) < 88
        then (o.due_date - ((('x' || substr(md5(o.id::text), 5, 2))::bit(8)::int % 4) || ' days')::interval)
      else (o.due_date + ((('x' || substr(md5(o.id::text), 7, 2))::bit(8)::int % 3) + 1 || ' days')::interval)
    end
where o.due_date is not null
  and (o.delivery_status = 'delivered' or o.status = 'completed');
