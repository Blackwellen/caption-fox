-- Resolves the schema/code mismatch flagged in the audit (§4 / §20):
-- src/app/api/ai/chat/route.ts writes to `ai_usage_logs`, which did not exist.
-- Also backs durable AI rate limiting (src/lib/ai/rate-limit.ts).
--
-- Apply with: supabase db push   (or run in the Supabase SQL editor).

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  mode text,
  action text,
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_created_idx
  on public.ai_usage_logs (user_id, created_at desc);
create index if not exists ai_usage_logs_workspace_idx
  on public.ai_usage_logs (workspace_id);

alter table public.ai_usage_logs enable row level security;

-- Users can read their own usage.
drop policy if exists "ai_usage_logs_select_own" on public.ai_usage_logs;
create policy "ai_usage_logs_select_own" on public.ai_usage_logs
  for select using (auth.uid() = user_id);

-- Users can insert their own usage rows (the route runs as the authenticated user).
drop policy if exists "ai_usage_logs_insert_own" on public.ai_usage_logs;
create policy "ai_usage_logs_insert_own" on public.ai_usage_logs
  for insert with check (auth.uid() = user_id);
