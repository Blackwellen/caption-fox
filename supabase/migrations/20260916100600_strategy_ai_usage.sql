-- ============================================================
-- Strategy assistant usage tracking.
--
-- Extends ai_usage_logs so AI spend can be searched and capped by model,
-- surface (route) and outcome, and counted per workspace per month without a
-- sequential scan. Rows never contain prompt or answer text.
-- Idempotent.
-- ============================================================

alter table public.ai_usage_logs add column if not exists model text;
alter table public.ai_usage_logs add column if not exists surface text;
alter table public.ai_usage_logs add column if not exists status text not null default 'success';

do $$ begin
  alter table public.ai_usage_logs add constraint ai_usage_logs_status_check
    check (status in ('success','failed','blocked'));
exception when duplicate_object then null; end $$;

create index if not exists ai_usage_logs_workspace_action_created_idx
  on public.ai_usage_logs (workspace_id, action, created_at desc);
