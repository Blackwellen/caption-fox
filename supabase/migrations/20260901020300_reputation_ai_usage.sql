-- ============================================================
-- PR & Reputation module — AI usage log (cost control + audit).
-- One row per Azure OpenAI call made from a Reputation AI action.
-- ============================================================

create table if not exists public.reputation_ai_usage (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);
alter table public.reputation_ai_usage enable row level security;
drop policy if exists "reputation_ai_usage_workspace" on public.reputation_ai_usage;
create policy "reputation_ai_usage_workspace" on public.reputation_ai_usage for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_reputation_ai_usage_workspace on public.reputation_ai_usage(workspace_id, created_at desc);
create index if not exists idx_reputation_ai_usage_user on public.reputation_ai_usage(user_id, created_at desc);
