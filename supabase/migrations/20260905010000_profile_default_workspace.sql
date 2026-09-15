-- Lets a user pick a durable default workspace (separate from the transient
-- cf_workspace cookie, which only reflects the current browser session).
alter table public.profiles
  add column if not exists default_workspace_id uuid references public.workspaces(id) on delete set null;

comment on column public.profiles.default_workspace_id is
  'User-chosen workspace to land in when no session cookie preference exists yet.';
