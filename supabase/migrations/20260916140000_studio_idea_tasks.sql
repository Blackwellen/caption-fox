-- Studio → Ideas: "Next actions" are real, assignable follow-up tasks attached
-- to an idea (research, outline, interviews), with due dates and completion.

create table if not exists public.studio_idea_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idea_id uuid not null references public.content_ideas(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_on date,
  assignee_id uuid references public.profiles(id) on delete set null,
  done_at timestamptz,
  done_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_idea_tasks_open on public.studio_idea_tasks(workspace_id, done_at, due_on);
create index if not exists idx_studio_idea_tasks_idea on public.studio_idea_tasks(idea_id);

alter table public.studio_idea_tasks enable row level security;
drop policy if exists studio_idea_tasks_workspace on public.studio_idea_tasks;
create policy studio_idea_tasks_workspace on public.studio_idea_tasks for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    -- The parent idea must belong to the same workspace.
    and exists (select 1 from public.content_ideas i where i.id = idea_id and i.workspace_id = studio_idea_tasks.workspace_id)
  );

drop trigger if exists trg_studio_idea_tasks_studio_updated on public.studio_idea_tasks;
create trigger trg_studio_idea_tasks_studio_updated before update on public.studio_idea_tasks
  for each row execute function public.studio_touch_updated_at();
