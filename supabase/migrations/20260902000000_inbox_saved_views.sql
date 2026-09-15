-- ============================================================
-- CAPTION FOX — INBOX SAVED VIEWS
-- Reusable, shareable Inbox filter/sort/column presets used by the
-- Saved Views page and offered as quick-apply views on the other three
-- Inbox pages (Unified, Assignments, Unassigned).
-- Idempotent: safe to re-run and reproducible from a fresh database.
-- ============================================================

create table if not exists public.inbox_saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  filters jsonb not null default '{}',
  sort text not null default 'newest',
  is_pinned boolean not null default false,
  is_shared boolean not null default true,
  is_default boolean not null default false,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inbox_saved_views_workspace on public.inbox_saved_views(workspace_id, is_pinned desc, updated_at desc);

alter table public.inbox_saved_views enable row level security;
drop policy if exists inbox_saved_views_workspace on public.inbox_saved_views;
create policy inbox_saved_views_workspace on public.inbox_saved_views for all
  using (
    is_shared and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    or created_by = auth.uid()
  )
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create or replace function public.touch_inbox_saved_view()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inbox_saved_views_touch on public.inbox_saved_views;
create trigger trg_inbox_saved_views_touch
  before update on public.inbox_saved_views
  for each row execute function public.touch_inbox_saved_view();
