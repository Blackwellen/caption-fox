-- Strategy read policies used `is_workspace_member(workspace_id)`, a SECURITY
-- DEFINER function Postgres cannot inline, so it ran once per row scanned
-- (~15 µs each). Unindexed sorts and KPI aggregates therefore scaled linearly
-- with workspace size (12k rows ~180 ms, 60k plan items ~930 ms).
--
-- The access rule is unchanged: any member of the workspace can read. The
-- membership lookup now runs once per statement (an InitPlan) instead of once
-- per row.
--
-- Rollback (restores the previous per-row policy on every table):
--   do $$ declare p record; begin
--     for p in select schemaname, tablename, policyname from pg_policies
--       where schemaname = 'public' and tablename like 'strategy\_%' and cmd = 'SELECT'
--         and qual like '%strategy_member_workspaces%' loop
--       execute format('alter policy %I on %I.%I using (public.is_workspace_member(workspace_id))', p.policyname, p.schemaname, p.tablename);
--     end loop; end $$;

create or replace function public.strategy_member_workspaces()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(workspace_id), '{}'::uuid[])
  from public.workspace_members
  where user_id = auth.uid();
$$;

revoke all on function public.strategy_member_workspaces() from public, anon;
grant execute on function public.strategy_member_workspaces() to authenticated;

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename like 'strategy\_%' and cmd = 'SELECT'
      and qual = 'is_workspace_member(workspace_id)'
  loop
    execute format(
      'alter policy %I on %I.%I using (workspace_id = any (((select public.strategy_member_workspaces()))::uuid[]))',
      p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;
