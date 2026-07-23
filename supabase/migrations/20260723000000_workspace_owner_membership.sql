-- Auto-create an owner membership row whenever a workspace is created.
--
-- Why: every child table (brands, posts, campaigns, …) gates access via
--   workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
-- but the workspace-creation flow only sets workspaces.owner_id. Without a
-- matching workspace_members row the creator owns the workspace yet cannot read
-- or write anything inside it. RLS on workspace_members (members_admin_write)
-- requires the caller to already be an owner/admin member, so the client cannot
-- insert that first row itself — this trigger does it with definer rights.

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, joined_at)
  values (new.id, new.owner_id, 'owner', now())
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Backfill: give every existing workspace owner their owner membership.
insert into public.workspace_members (workspace_id, user_id, role, joined_at)
select w.id, w.owner_id, 'owner', now()
from public.workspaces w
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_id
)
on conflict (workspace_id, user_id) do nothing;
