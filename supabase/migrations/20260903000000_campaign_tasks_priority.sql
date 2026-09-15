-- ============================================================
-- Caption Fox — campaign_tasks: add priority
-- The Fox AI Copilot Tasks tab (and any future Tasks board) shows a
-- priority badge per task. Idempotent: safe to re-run.
-- ============================================================
alter table public.campaign_tasks add column if not exists priority text not null default 'medium';

alter table public.campaign_tasks drop constraint if exists campaign_tasks_priority_check;
alter table public.campaign_tasks add constraint campaign_tasks_priority_check
  check (priority in ('low', 'medium', 'high', 'urgent'));

create index if not exists idx_campaign_tasks_priority on public.campaign_tasks(workspace_id, priority);
