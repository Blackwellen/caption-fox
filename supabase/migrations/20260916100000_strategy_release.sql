-- ============================================================
-- Caption Fox — Campaign Manager: Strategy release hardening.
--
-- 1. Role-aware RLS. The v1 policies let ANY workspace member write, so a
--    `viewer` could mutate strategy records by calling PostgREST directly.
--    Reads stay member-scoped; writes now require owner/admin/manager/member.
-- 2. Columns the approved designs need that v1 lacked (objective reference
--    codes, completion timestamps, demo markers, forecast refresh cadence).
-- 3. Next actions, insights, KPI period snapshots and saved views.
-- 4. A private, workspace-scoped storage bucket for research files.
--
-- Idempotent: safe to re-run and reproducible on a fresh database.
-- ============================================================

-- ------------------------------------------------------------ demo markers
do $$
declare t text;
begin
  foreach t in array array[
    'strategy_records','strategy_objectives','strategy_audiences','strategy_research_items',
    'strategy_positioning_frameworks','strategy_plans','strategy_forecasts'
  ] loop
    execute format('alter table public.%I add column if not exists is_demo boolean not null default false', t);
  end loop;
end $$;

-- ------------------------------------------------------------ objectives
alter table public.strategy_objectives add column if not exists ref_number integer;
alter table public.strategy_objectives add column if not exists completed_at timestamptz;
create unique index if not exists idx_strategy_objectives_ref
  on public.strategy_objectives(workspace_id, ref_number) where ref_number is not null;

-- Assigns OBJ-nn per workspace and stamps completion time on status change.
create or replace function public.strategy_objectives_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.ref_number is null then
    perform pg_advisory_xact_lock(hashtext('strategy_obj_ref:' || new.workspace_id::text));
    select coalesce(max(ref_number), 0) + 1 into new.ref_number
    from public.strategy_objectives where workspace_id = new.workspace_id;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_strategy_objectives_before_write on public.strategy_objectives;
create trigger trg_strategy_objectives_before_write
  before insert or update on public.strategy_objectives
  for each row execute function public.strategy_objectives_before_write();

update public.strategy_objectives o set ref_number = r.n
from (select id, row_number() over (partition by workspace_id order by created_at, id) n
      from public.strategy_objectives) r
where r.id = o.id and o.ref_number is null;

-- ------------------------------------------------------------ forecasts
alter table public.strategy_forecasts add column if not exists refresh_interval_days integer not null default 5
  check (refresh_interval_days between 1 and 90);

-- ------------------------------------------------------------ research
alter table public.strategy_research_items add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;

-- ------------------------------------------------------------ next actions
create table if not exists public.strategy_actions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  module text not null default 'objectives'
    check (module in ('objectives','audiences','research','positioning','plans','forecasts')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','done')),
  entity_type text check (entity_type in ('objective','audience','research','framework','plan','forecast')),
  entity_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_strategy_actions_ws on public.strategy_actions(workspace_id, status, due_date);

-- ------------------------------------------------------------ insights
create table if not exists public.strategy_insights (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  module text not null default 'audiences'
    check (module in ('overview','objectives','audiences','research','positioning','plans','forecasts')),
  kind text not null default 'opportunity' check (kind in ('opportunity','gap','expansion','risk')),
  title text not null,
  detail text,
  impact text not null default 'medium' check (impact in ('low','medium','high','opportunity')),
  research_id uuid references public.strategy_research_items(id) on delete set null,
  dismissed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_strategy_insights_ws on public.strategy_insights(workspace_id, module, created_at desc);

-- ------------------------------------------------------------ KPI snapshots
-- One row per workspace per calendar month. The current month is refreshed
-- from live data; earlier months freeze, so "vs last month" deltas are real.
create table if not exists public.strategy_kpi_snapshots (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  metrics jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint strategy_kpi_snapshots_unique unique (workspace_id, period_start)
);
create index if not exists idx_strategy_kpi_snapshots_ws on public.strategy_kpi_snapshots(workspace_id, period_start desc);

-- ------------------------------------------------------------ saved views
create table if not exists public.strategy_saved_views (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('overview','objectives','audiences','research','positioning','plans','forecasts')),
  name text not null check (char_length(name) between 1 and 60),
  query text not null default '' check (char_length(query) <= 2000),
  created_at timestamptz not null default now(),
  constraint strategy_saved_views_unique unique (workspace_id, user_id, module, name)
);
create index if not exists idx_strategy_saved_views_user on public.strategy_saved_views(workspace_id, user_id, module);

-- ------------------------------------------------------------ updated_at
do $$
declare t text;
begin
  foreach t in array array['strategy_actions'] loop
    if not exists (select 1 from pg_trigger where tgname = format('trg_%s_updated_at', t)) then
      execute format('create trigger trg_%s_updated_at before update on public.%s
        for each row execute function public.handle_updated_at()', t, t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------ RLS
-- Read: any member. Write: every role except viewer (and never anonymous).
create or replace function public.strategy_can_write(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
      and role in ('owner','admin','manager','member')
  );
$$;
revoke all on function public.strategy_can_write(uuid) from public, anon;
grant execute on function public.strategy_can_write(uuid) to authenticated;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'strategy_records','strategy_objectives','strategy_audiences','strategy_audience_personas',
    'strategy_audience_regions','strategy_audience_metrics','strategy_research_collections',
    'strategy_research_items','strategy_research_findings','strategy_positioning_frameworks',
    'strategy_positioning_pillars','strategy_proof_points','strategy_claims','strategy_competitors',
    'strategy_competitor_attributes','strategy_competitor_scores','strategy_messaging_assets',
    'strategy_plans','strategy_plan_items','strategy_plan_dependencies','strategy_plan_risks',
    'strategy_plan_capacity','strategy_forecasts','strategy_forecast_scenarios',
    'strategy_forecast_periods','strategy_forecast_assumptions','strategy_links',
    'strategy_approvals','strategy_activity','strategy_health_snapshots',
    'strategy_actions','strategy_insights','strategy_kpi_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format($f$create policy %I on public.%I for select to authenticated
      using (public.is_workspace_member(workspace_id))$f$, t || '_read', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check (public.strategy_can_write(workspace_id))$f$, t || '_insert', t);
    execute format($f$create policy %I on public.%I for update to authenticated
      using (public.strategy_can_write(workspace_id)) with check (public.strategy_can_write(workspace_id))$f$, t || '_update', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
      using (public.strategy_can_write(workspace_id))$f$, t || '_delete', t);
  end loop;
end $$;

-- Activity is an append-only audit trail: nobody edits or deletes it via the API.
drop policy if exists strategy_activity_update on public.strategy_activity;
drop policy if exists strategy_activity_delete on public.strategy_activity;

-- Saved views are private to their owner (viewers may save views too).
alter table public.strategy_saved_views enable row level security;
drop policy if exists strategy_saved_views_owner on public.strategy_saved_views;
create policy strategy_saved_views_owner on public.strategy_saved_views for all to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- ------------------------------------------------------------ storage
-- Private bucket. Object keys are `{workspace_id}/research/{uuid}-{safe-name}`;
-- files are only ever served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('strategy-research', 'strategy-research', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel','text/csv','text/plain','image/png','image/jpeg'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists strategy_research_objects_read on storage.objects;
create policy strategy_research_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'strategy-research'
    and (storage.foldername(name))[1] in (
      select workspace_id::text from public.workspace_members where user_id = auth.uid()));

drop policy if exists strategy_research_objects_insert on storage.objects;
create policy strategy_research_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'strategy-research'
    and (storage.foldername(name))[1] in (
      select workspace_id::text from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin','manager','member')));

drop policy if exists strategy_research_objects_delete on storage.objects;
create policy strategy_research_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'strategy-research'
    and (storage.foldername(name))[1] in (
      select workspace_id::text from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin','manager','member')));
