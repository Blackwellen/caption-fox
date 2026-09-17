-- ============================================================
-- Strategy release: fields the approved page designs surface.
--   * Plans are the "initiatives" on the Overview → priority + target copy.
--   * Research carries a collection METHOD (survey, interview …) distinct
--     from its source type — the "Research source mix" chart groups by it.
--   * Comments thread on approvals, frameworks, research and objectives
--     (request-changes / reject reasons and reviewer discussion).
-- Idempotent.
-- ============================================================

alter table public.strategy_plans add column if not exists priority text not null default 'medium';
alter table public.strategy_plans drop constraint if exists strategy_plans_priority_check;
alter table public.strategy_plans add constraint strategy_plans_priority_check
  check (priority in ('low','medium','high','urgent'));
alter table public.strategy_plans add column if not exists target_summary text;

alter table public.strategy_research_items add column if not exists method text not null default 'report';
alter table public.strategy_research_items drop constraint if exists strategy_research_items_method_check;
alter table public.strategy_research_items add constraint strategy_research_items_method_check
  check (method in ('survey','interview','report','market_data','social_listening','other'));
create index if not exists idx_strategy_research_method on public.strategy_research_items(workspace_id, method);

create table if not exists public.strategy_comments (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('approval','framework','research','objective','plan','forecast','audience')),
  entity_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_strategy_comments_entity on public.strategy_comments(workspace_id, entity_type, entity_id, created_at);

alter table public.strategy_comments enable row level security;
drop policy if exists strategy_comments_read on public.strategy_comments;
create policy strategy_comments_read on public.strategy_comments for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists strategy_comments_insert on public.strategy_comments;
create policy strategy_comments_insert on public.strategy_comments for insert to authenticated
  with check (public.strategy_can_write(workspace_id) and author_id = auth.uid());
drop policy if exists strategy_comments_delete on public.strategy_comments;
create policy strategy_comments_delete on public.strategy_comments for delete to authenticated
  using (author_id = auth.uid());

-- Linked records must live in the same workspace as the link row. Enforced in
-- the database so a crafted API call cannot join two tenants' records.
create or replace function public.strategy_entity_workspace(p_type text, p_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case p_type
    when 'objective' then (select workspace_id from strategy_objectives where id = p_id)
    when 'audience'  then (select workspace_id from strategy_audiences where id = p_id)
    when 'research'  then (select workspace_id from strategy_research_items where id = p_id)
    when 'framework' then (select workspace_id from strategy_positioning_frameworks where id = p_id)
    when 'plan'      then (select workspace_id from strategy_plans where id = p_id)
    when 'forecast'  then (select workspace_id from strategy_forecasts where id = p_id)
    when 'campaign'  then (select workspace_id from campaigns where id = p_id)
  end;
$$;
revoke all on function public.strategy_entity_workspace(text, uuid) from public, anon;

create or replace function public.strategy_links_guard()
returns trigger language plpgsql as $$
begin
  if public.strategy_entity_workspace(new.source_type, new.source_id) is distinct from new.workspace_id
     or public.strategy_entity_workspace(new.target_type, new.target_id) is distinct from new.workspace_id then
    raise exception 'Linked records must belong to the same workspace' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_strategy_links_guard on public.strategy_links;
create trigger trg_strategy_links_guard before insert or update on public.strategy_links
  for each row execute function public.strategy_links_guard();

-- Plan dependencies: both plans in the link's workspace, and no cycles.
create or replace function public.strategy_plan_dependencies_guard()
returns trigger language plpgsql as $$
begin
  if public.strategy_entity_workspace('plan', new.plan_id) is distinct from new.workspace_id
     or public.strategy_entity_workspace('plan', new.depends_on_plan_id) is distinct from new.workspace_id then
    raise exception 'Dependent plans must belong to the same workspace' using errcode = '42501';
  end if;
  if exists (
    with recursive chain(plan_id) as (
      select d.depends_on_plan_id from strategy_plan_dependencies d where d.plan_id = new.depends_on_plan_id
      union
      select d.depends_on_plan_id from strategy_plan_dependencies d join chain c on d.plan_id = c.plan_id
    )
    select 1 from chain where plan_id = new.plan_id
  ) then
    raise exception 'This dependency would create a circular chain' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_strategy_plan_dependencies_guard on public.strategy_plan_dependencies;
create trigger trg_strategy_plan_dependencies_guard before insert or update on public.strategy_plan_dependencies
  for each row execute function public.strategy_plan_dependencies_guard();
