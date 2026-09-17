-- ============================================================
-- Strategy: align database write access with the application role model.
--
-- In the app, `member` resolves to the `creator` product role, which has
-- view-only Strategy access; only owner / admin / manager may change strategy
-- records. 20260916100000 allowed `member` writes at the database layer, so a
-- member could bypass the UI through PostgREST. This closes that gap for
-- every Strategy table and the research storage bucket.
-- Idempotent.
-- ============================================================

create or replace function public.strategy_can_write(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and role in ('owner','admin','manager')
  );
$$;
revoke all on function public.strategy_can_write(uuid) from public, anon;
grant execute on function public.strategy_can_write(uuid) to authenticated;

drop policy if exists strategy_research_objects_insert on storage.objects;
create policy strategy_research_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'strategy-research'
    and (storage.foldername(name))[1] in (
      select workspace_id::text from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin','manager')));

drop policy if exists strategy_research_objects_delete on storage.objects;
create policy strategy_research_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'strategy-research'
    and (storage.foldername(name))[1] in (
      select workspace_id::text from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin','manager')));
