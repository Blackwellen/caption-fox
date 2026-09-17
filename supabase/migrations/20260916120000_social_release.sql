-- ============================================================
-- CAPTION FOX — SOCIAL MODULE RELEASE FIXES (2026-09-16)
--
-- 1. publishing_queue status: the Calendar migration replaced the Social
--    status check without 'skipped', so the publish worker could not mark a
--    delivery for a disconnected channel as skipped and the row stayed
--    'processing'. The check is now the union of both modules' states.
-- 2. Indexes for the Social list pages' hot filters.
--
-- Idempotent: safe to re-run and reproducible from a fresh database.
-- ============================================================

alter table public.publishing_queue drop constraint if exists publishing_queue_status_check;
alter table public.publishing_queue add constraint publishing_queue_status_check
  check (status in ('draft','queued','ready','scheduled','processing','sent','published',
                    'failed','cancelled','skipped'));

create index if not exists idx_publishing_queue_workspace_status
  on public.publishing_queue(workspace_id, status, scheduled_at);
create index if not exists idx_inbox_threads_workspace_created
  on public.inbox_threads(workspace_id, created_at desc);
create index if not exists idx_inbox_threads_workspace_type
  on public.inbox_threads(workspace_id, type, created_at desc);
create index if not exists idx_brand_mentions_workspace_time
  on public.brand_mentions(workspace_id, mentioned_at desc);
create index if not exists idx_social_sync_runs_workspace_status
  on public.social_sync_runs(workspace_id, status, started_at desc);
create index if not exists idx_post_analytics_post
  on public.post_analytics(post_id);
