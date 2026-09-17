-- Caption Fox Marketplace — backfill lifecycle events into the activity feed.
--
-- The seeded feed only held "order placed" rows, so the Overview timeline read
-- as five identical entries, while the approved design mixes completions,
-- proposals and disputes. Every row inserted here describes something that is
-- already true in the data (a completed order, a received proposal, an open
-- dispute) at that record's own timestamp — nothing is invented.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_marketplace_activity_events.sql
-- Idempotent: an event is only added when that (event, entity) pair is absent.

-- Completed / delivered orders
insert into public.marketplace_activity (workspace_id, event, summary, entity_type, entity_id, href, meta, created_at)
select o.workspace_id, 'order.completed',
       'Order completed: ' || coalesce(o.title, o.reference) || ' (' || o.reference || ')',
       'order', o.id, '/app/marketplace/orders?q=' || o.reference,
       jsonb_build_object('source', 'lifecycle_backfill'),
       coalesce(o.completed_at, o.updated_at)
from public.marketplace_orders o
where o.delivery_status in ('delivered', 'completed')
  and not exists (
    select 1 from public.marketplace_activity a
    where a.entity_id = o.id and a.event = 'order.completed'
  );

-- Open disputes
insert into public.marketplace_activity (workspace_id, event, summary, entity_type, entity_id, href, meta, created_at)
select o.workspace_id, 'dispute.opened',
       'Dispute requires attention on ' || o.reference,
       'order', o.id, '/app/marketplace/orders?status=disputed',
       jsonb_build_object('source', 'lifecycle_backfill'),
       o.updated_at
from public.marketplace_orders o
where o.dispute_state is not null
  and not exists (
    select 1 from public.marketplace_activity a
    where a.entity_id = o.id and a.event = 'dispute.opened'
  );

-- Proposals received on the workspace's own requests
insert into public.marketplace_activity (workspace_id, event, summary, entity_type, entity_id, href, meta, created_at)
select r.workspace_id, 'proposal.received',
       'New proposal from ' || s.display_name || ' for "' || r.title || '"',
       'proposal', p.id, '/app/marketplace/requests?q=' || r.reference,
       jsonb_build_object('source', 'lifecycle_backfill'),
       p.created_at
from public.marketplace_proposals p
join public.marketplace_requests r on r.id = p.request_id
join public.marketplace_suppliers s on s.id = p.supplier_id
where not exists (
    select 1 from public.marketplace_activity a
    where a.entity_id = p.id and a.event = 'proposal.received'
  );
