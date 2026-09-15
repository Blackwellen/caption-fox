-- ============================================================================
-- Fix: infinite recursion in workspace_members RLS
--
-- Problem
-- -------
-- `members_in_workspace` gated SELECT on workspace_members with a subquery
-- against workspace_members itself:
--
--   workspace_id in (select workspace_id from workspace_members
--                    where user_id = auth.uid())
--
-- Evaluating that subquery re-applies the same policy, so Postgres raises
--   "infinite recursion detected in policy for relation workspace_members".
--
-- Blast radius: 207 policies across 206 tables use the identical inline
-- subquery to scope their own rows. Because that subquery reads
-- workspace_members, every one of them failed for authenticated users — the
-- whole workspace-scoped data layer was unreadable through the anon key.
-- (Service-role and PAT access bypass RLS, which is why this went unnoticed.)
--
-- Fix
-- ---
-- Resolve membership through SECURITY DEFINER helpers, which run with the
-- function owner's rights and therefore do not re-enter RLS. Semantics are
-- unchanged — the visible row set is identical, nothing is widened:
--
--   SELECT : your own membership rows, plus rows for workspaces you belong to.
--   WRITE  : only for workspaces where you are owner or admin.
--
-- Fixing this one table unblocks all 206 dependent tables, because their
-- subqueries then read workspace_members under a non-recursive policy.
-- ============================================================================

-- Helpers are created by 20260829000000_brand_assets.sql; re-declare defensively
-- so this migration is safe to apply against a database that lacks them.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$fn$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$fn$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.workspace_role(uuid) to authenticated, service_role;

-- Non-recursive replacements ------------------------------------------------

drop policy if exists "members_in_workspace" on public.workspace_members;
create policy "members_in_workspace" on public.workspace_members
  for select
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists "members_admin_write" on public.workspace_members;
create policy "members_admin_write" on public.workspace_members
  for all
  using (public.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

-- workspaces.workspace_member_access reads workspace_members; route it through
-- the same helper so it never depends on that table's policy being evaluable.
drop policy if exists "workspace_member_access" on public.workspaces;
create policy "workspace_member_access" on public.workspaces
  for select
  using (owner_id = auth.uid() or public.is_workspace_member(id));
