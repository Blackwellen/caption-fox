-- ============================================================
-- Caption Fox — Campaign Manager: Strategy module
-- Objectives, audiences, research, positioning, plans and forecasts.
-- Every table is workspace-scoped with an explicit using + with check RLS
-- policy so inserts are guarded, not only reads. Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- STRATEGY RECORDS — the umbrella strategy an objective/plan belongs to
-- ============================================================
create table if not exists public.strategy_records (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('draft','active','paused','completed','archived')),
  health_score integer not null default 0 check (health_score between 0 and 100),
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_records enable row level security;
drop policy if exists "strategy_records_workspace" on public.strategy_records;
create policy "strategy_records_workspace" on public.strategy_records for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_records_workspace on public.strategy_records(workspace_id, status);
create index if not exists idx_strategy_records_owner on public.strategy_records(owner_id);
create index if not exists idx_strategy_records_archived on public.strategy_records(workspace_id, archived_at);

-- ============================================================
-- OBJECTIVES
-- ============================================================
create table if not exists public.strategy_objectives (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  strategy_id uuid references public.strategy_records(id) on delete set null,
  name text not null,
  description text,
  objective_type text not null default 'growth'
    check (objective_type in ('awareness','growth','engagement','revenue','retention','efficiency','other')),
  status text not null default 'not_started'
    check (status in ('draft','not_started','on_track','at_risk','off_track','completed','archived')),
  progress integer not null default 0 check (progress between 0 and 100),
  confidence integer not null default 50 check (confidence between 0 and 100),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  target_summary text,
  next_action text,
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_objectives enable row level security;
drop policy if exists "strategy_objectives_workspace" on public.strategy_objectives;
create policy "strategy_objectives_workspace" on public.strategy_objectives for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_objectives_workspace on public.strategy_objectives(workspace_id, status);
create index if not exists idx_strategy_objectives_owner on public.strategy_objectives(owner_id);
create index if not exists idx_strategy_objectives_due on public.strategy_objectives(workspace_id, due_date);
create index if not exists idx_strategy_objectives_strategy on public.strategy_objectives(strategy_id);
create index if not exists idx_strategy_objectives_archived on public.strategy_objectives(workspace_id, archived_at);

-- ============================================================
-- AUDIENCES
-- ============================================================
create table if not exists public.strategy_audiences (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('draft','active','paused','archived')),
  lifecycle_stage text not null default 'awareness'
    check (lifecycle_stage in ('awareness','consideration','decision','retention','advocacy')),
  audience_size bigint not null default 0,
  growth_rate numeric(6,2) not null default 0,
  fit_score integer not null default 0 check (fit_score between 0 and 100),
  data_completeness integer not null default 0 check (data_completeness between 0 and 100),
  channels text[] not null default '{}',
  tags text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual','import','crm','api')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_audiences enable row level security;
drop policy if exists "strategy_audiences_workspace" on public.strategy_audiences;
create policy "strategy_audiences_workspace" on public.strategy_audiences for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_audiences_workspace on public.strategy_audiences(workspace_id, status);
create index if not exists idx_strategy_audiences_owner on public.strategy_audiences(owner_id);
create index if not exists idx_strategy_audiences_archived on public.strategy_audiences(workspace_id, archived_at);

create table if not exists public.strategy_audience_personas (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audience_id uuid not null references public.strategy_audiences(id) on delete cascade,
  name text not null,
  summary text,
  share_pct numeric(5,2) not null default 0 check (share_pct >= 0 and share_pct <= 100),
  avatar_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_audience_personas enable row level security;
drop policy if exists "strategy_audience_personas_workspace" on public.strategy_audience_personas;
create policy "strategy_audience_personas_workspace" on public.strategy_audience_personas for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_personas_audience on public.strategy_audience_personas(audience_id, sort_order);

-- Aggregated geography only — never an individual customer location.
create table if not exists public.strategy_audience_regions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audience_id uuid not null references public.strategy_audiences(id) on delete cascade,
  country_code text not null,
  country_name text not null,
  share_pct numeric(5,2) not null default 0 check (share_pct >= 0 and share_pct <= 100),
  audience_size bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint strategy_audience_regions_unique unique (audience_id, country_code)
);
alter table public.strategy_audience_regions enable row level security;
drop policy if exists "strategy_audience_regions_workspace" on public.strategy_audience_regions;
create policy "strategy_audience_regions_workspace" on public.strategy_audience_regions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_regions_audience on public.strategy_audience_regions(audience_id, share_pct desc);
create index if not exists idx_strategy_regions_workspace on public.strategy_audience_regions(workspace_id, country_code);

-- Channel affinity + demographic mix, one row per audience metric.
create table if not exists public.strategy_audience_metrics (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audience_id uuid not null references public.strategy_audiences(id) on delete cascade,
  metric_group text not null check (metric_group in ('channel','gender','age','engagement','growth')),
  metric_key text not null,
  metric_label text not null,
  metric_value numeric(12,2) not null default 0,
  metric_date date,
  created_at timestamptz not null default now(),
  constraint strategy_audience_metrics_unique unique (audience_id, metric_group, metric_key, metric_date)
);
alter table public.strategy_audience_metrics enable row level security;
drop policy if exists "strategy_audience_metrics_workspace" on public.strategy_audience_metrics;
create policy "strategy_audience_metrics_workspace" on public.strategy_audience_metrics for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_audience_metrics on public.strategy_audience_metrics(audience_id, metric_group);
create index if not exists idx_strategy_audience_metrics_ws on public.strategy_audience_metrics(workspace_id, metric_group, metric_date);

-- ============================================================
-- RESEARCH
-- ============================================================
create table if not exists public.strategy_research_collections (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_research_collections_unique unique (workspace_id, name)
);
alter table public.strategy_research_collections enable row level security;
drop policy if exists "strategy_research_collections_workspace" on public.strategy_research_collections;
create policy "strategy_research_collections_workspace" on public.strategy_research_collections for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_collections_workspace on public.strategy_research_collections(workspace_id, name);

create table if not exists public.strategy_research_items (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  collection_id uuid references public.strategy_research_collections(id) on delete set null,
  title text not null,
  summary text,
  source_type text not null default 'market_research'
    check (source_type in ('market_research','consumer_research','brand_research','competitive_intel','customer_insights','qualitative','social_listening','other')),
  impact text not null default 'medium' check (impact in ('low','medium','high')),
  confidence integer not null default 50 check (confidence between 0 and 100),
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','needs_revision','archived')),
  theme text,
  is_favourite boolean not null default false,
  tags text[] not null default '{}',
  -- Storage-backed only. A pasted external URL is never accepted as the asset.
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_research_items enable row level security;
drop policy if exists "strategy_research_items_workspace" on public.strategy_research_items;
create policy "strategy_research_items_workspace" on public.strategy_research_items for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_research_workspace on public.strategy_research_items(workspace_id, status);
create index if not exists idx_strategy_research_collection on public.strategy_research_items(collection_id);
create index if not exists idx_strategy_research_owner on public.strategy_research_items(owner_id);
create index if not exists idx_strategy_research_updated on public.strategy_research_items(workspace_id, updated_at desc);
create index if not exists idx_strategy_research_archived on public.strategy_research_items(workspace_id, archived_at);

create table if not exists public.strategy_research_findings (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_id uuid not null references public.strategy_research_items(id) on delete cascade,
  headline text not null,
  detail text,
  impact text not null default 'medium' check (impact in ('low','medium','high')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_research_findings enable row level security;
drop policy if exists "strategy_research_findings_workspace" on public.strategy_research_findings;
create policy "strategy_research_findings_workspace" on public.strategy_research_findings for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_findings_research on public.strategy_research_findings(research_id);
create index if not exists idx_strategy_findings_workspace on public.strategy_research_findings(workspace_id, created_at desc);

-- ============================================================
-- POSITIONING
-- ============================================================
create table if not exists public.strategy_positioning_frameworks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category_promise text,
  foundation text,
  positioning_statement text,
  target_audience_id uuid references public.strategy_audiences(id) on delete set null,
  is_primary boolean not null default false,
  version integer not null default 1,
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','changes_requested','archived')),
  consistency_score integer not null default 0 check (consistency_score between 0 and 100),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_positioning_frameworks enable row level security;
drop policy if exists "strategy_frameworks_workspace" on public.strategy_positioning_frameworks;
create policy "strategy_frameworks_workspace" on public.strategy_positioning_frameworks for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_frameworks_workspace on public.strategy_positioning_frameworks(workspace_id, status);
create index if not exists idx_strategy_frameworks_archived on public.strategy_positioning_frameworks(workspace_id, archived_at);
-- At most one primary framework per workspace.
create unique index if not exists idx_strategy_frameworks_primary
  on public.strategy_positioning_frameworks(workspace_id) where is_primary and archived_at is null;

create table if not exists public.strategy_positioning_pillars (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid not null references public.strategy_positioning_frameworks(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_positioning_pillars enable row level security;
drop policy if exists "strategy_pillars_workspace" on public.strategy_positioning_pillars;
create policy "strategy_pillars_workspace" on public.strategy_positioning_pillars for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_pillars_framework on public.strategy_positioning_pillars(framework_id, sort_order);

create table if not exists public.strategy_proof_points (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid references public.strategy_positioning_frameworks(id) on delete cascade,
  label text not null,
  category text not null default 'trust'
    check (category in ('trust','efficiency','reliability','ecosystem','results','other')),
  impact text not null default 'medium' check (impact in ('low','medium','high')),
  verification text not null default 'unverified'
    check (verification in ('unverified','in_review','verified')),
  evidence_research_id uuid references public.strategy_research_items(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_proof_points enable row level security;
drop policy if exists "strategy_proof_points_workspace" on public.strategy_proof_points;
create policy "strategy_proof_points_workspace" on public.strategy_proof_points for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_proof_points_framework on public.strategy_proof_points(framework_id, sort_order);

create table if not exists public.strategy_claims (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid references public.strategy_positioning_frameworks(id) on delete cascade,
  claim text not null,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  rationale text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_claims enable row level security;
drop policy if exists "strategy_claims_workspace" on public.strategy_claims;
create policy "strategy_claims_workspace" on public.strategy_claims for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_claims_framework on public.strategy_claims(framework_id, sort_order);

create table if not exists public.strategy_competitors (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid references public.strategy_positioning_frameworks(id) on delete cascade,
  name text not null,
  is_self boolean not null default false,
  website text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_competitors enable row level security;
drop policy if exists "strategy_competitors_workspace" on public.strategy_competitors;
create policy "strategy_competitors_workspace" on public.strategy_competitors for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_competitors_framework on public.strategy_competitors(framework_id, sort_order);

create table if not exists public.strategy_competitor_attributes (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid not null references public.strategy_positioning_frameworks(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.strategy_competitor_attributes enable row level security;
drop policy if exists "strategy_competitor_attributes_workspace" on public.strategy_competitor_attributes;
create policy "strategy_competitor_attributes_workspace" on public.strategy_competitor_attributes for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_attributes_framework on public.strategy_competitor_attributes(framework_id, sort_order);

create table if not exists public.strategy_competitor_scores (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  competitor_id uuid not null references public.strategy_competitors(id) on delete cascade,
  attribute_id uuid not null references public.strategy_competitor_attributes(id) on delete cascade,
  score text not null default 'na' check (score in ('strong','moderate','weak','na')),
  note text,
  updated_at timestamptz not null default now(),
  constraint strategy_competitor_scores_unique unique (competitor_id, attribute_id)
);
alter table public.strategy_competitor_scores enable row level security;
drop policy if exists "strategy_competitor_scores_workspace" on public.strategy_competitor_scores;
create policy "strategy_competitor_scores_workspace" on public.strategy_competitor_scores for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_scores_competitor on public.strategy_competitor_scores(competitor_id);

create table if not exists public.strategy_messaging_assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  framework_id uuid references public.strategy_positioning_frameworks(id) on delete cascade,
  name text not null,
  asset_type text not null default 'document'
    check (asset_type in ('document','presentation','one_pager','sheet','other')),
  audience_id uuid references public.strategy_audiences(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','changes_requested','archived')),
  file_path text,
  file_name text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_messaging_assets enable row level security;
drop policy if exists "strategy_messaging_assets_workspace" on public.strategy_messaging_assets;
create policy "strategy_messaging_assets_workspace" on public.strategy_messaging_assets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_messaging_framework on public.strategy_messaging_assets(framework_id);

-- ============================================================
-- PLANS
-- ============================================================
create table if not exists public.strategy_plans (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  strategy_id uuid references public.strategy_records(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'not_started'
    check (status in ('not_started','on_track','at_risk','off_track','completed','archived')),
  progress integer not null default 0 check (progress between 0 and 100),
  budget numeric(14,2),
  budget_spent numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_plans_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);
alter table public.strategy_plans enable row level security;
drop policy if exists "strategy_plans_workspace" on public.strategy_plans;
create policy "strategy_plans_workspace" on public.strategy_plans for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_plans_workspace on public.strategy_plans(workspace_id, status);
create index if not exists idx_strategy_plans_owner on public.strategy_plans(owner_id);
create index if not exists idx_strategy_plans_dates on public.strategy_plans(workspace_id, start_date, end_date);
create index if not exists idx_strategy_plans_archived on public.strategy_plans(workspace_id, archived_at);

-- Phases, tasks and milestones share one table so the Gantt renders one tree.
create table if not exists public.strategy_plan_items (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  parent_id uuid references public.strategy_plan_items(id) on delete cascade,
  title text not null,
  item_type text not null default 'task' check (item_type in ('phase','task','milestone')),
  status text not null default 'not_started'
    check (status in ('not_started','on_track','at_risk','off_track','completed','blocked')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  progress integer not null default 0 check (progress between 0 and 100),
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_plan_items_dates_check check (due_date is null or start_date is null or due_date >= start_date)
);
alter table public.strategy_plan_items enable row level security;
drop policy if exists "strategy_plan_items_workspace" on public.strategy_plan_items;
create policy "strategy_plan_items_workspace" on public.strategy_plan_items for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_plan_items_plan on public.strategy_plan_items(plan_id, sort_order);
create index if not exists idx_strategy_plan_items_due on public.strategy_plan_items(workspace_id, due_date);
create index if not exists idx_strategy_plan_items_type on public.strategy_plan_items(workspace_id, item_type, status);

create table if not exists public.strategy_plan_dependencies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  depends_on_plan_id uuid not null references public.strategy_plans(id) on delete cascade,
  label text,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  blocked_items integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint strategy_plan_dependencies_no_self check (plan_id <> depends_on_plan_id),
  constraint strategy_plan_dependencies_unique unique (plan_id, depends_on_plan_id)
);
alter table public.strategy_plan_dependencies enable row level security;
drop policy if exists "strategy_plan_dependencies_workspace" on public.strategy_plan_dependencies;
create policy "strategy_plan_dependencies_workspace" on public.strategy_plan_dependencies for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_plan_deps_plan on public.strategy_plan_dependencies(plan_id);

create table if not exists public.strategy_plan_risks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid references public.strategy_plans(id) on delete cascade,
  title text not null,
  detail text,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','mitigating','resolved')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_plan_risks enable row level security;
drop policy if exists "strategy_plan_risks_workspace" on public.strategy_plan_risks;
create policy "strategy_plan_risks_workspace" on public.strategy_plan_risks for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_plan_risks_plan on public.strategy_plan_risks(plan_id);
create index if not exists idx_strategy_plan_risks_ws on public.strategy_plan_risks(workspace_id, status, severity);

create table if not exists public.strategy_plan_capacity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  allocated numeric(10,2) not null default 0,
  capacity numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint strategy_plan_capacity_unique unique (workspace_id, period_start)
);
alter table public.strategy_plan_capacity enable row level security;
drop policy if exists "strategy_plan_capacity_workspace" on public.strategy_plan_capacity;
create policy "strategy_plan_capacity_workspace" on public.strategy_plan_capacity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_capacity_ws on public.strategy_plan_capacity(workspace_id, period_start);

-- ============================================================
-- FORECASTS
-- ============================================================
create table if not exists public.strategy_forecasts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  strategy_id uuid references public.strategy_records(id) on delete set null,
  name text not null,
  description text,
  metric text not null default 'revenue'
    check (metric in ('revenue','pipeline','leads','conversions','reach','other')),
  currency text not null default 'GBP',
  period_start date not null,
  period_end date not null,
  target_value numeric(16,2) not null default 0,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  status text not null default 'active' check (status in ('draft','active','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  last_recalculated_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_forecasts_period_check check (period_end >= period_start)
);
alter table public.strategy_forecasts enable row level security;
drop policy if exists "strategy_forecasts_workspace" on public.strategy_forecasts;
create policy "strategy_forecasts_workspace" on public.strategy_forecasts for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_forecasts_workspace on public.strategy_forecasts(workspace_id, status);
create index if not exists idx_strategy_forecasts_period on public.strategy_forecasts(workspace_id, period_start, period_end);
create index if not exists idx_strategy_forecasts_archived on public.strategy_forecasts(workspace_id, archived_at);

create table if not exists public.strategy_forecast_scenarios (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  forecast_id uuid not null references public.strategy_forecasts(id) on delete cascade,
  name text not null,
  scenario_type text not null default 'expected'
    check (scenario_type in ('best','expected','downside','custom')),
  is_expected boolean not null default false,
  probability integer not null default 0 check (probability between 0 and 100),
  forecast_value numeric(16,2) not null default 0,
  range_low numeric(16,2),
  range_high numeric(16,2),
  drivers text[] not null default '{}',
  risks text[] not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  last_recalculated_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_forecast_scenarios_range check (range_high is null or range_low is null or range_high >= range_low)
);
alter table public.strategy_forecast_scenarios enable row level security;
drop policy if exists "strategy_forecast_scenarios_workspace" on public.strategy_forecast_scenarios;
create policy "strategy_forecast_scenarios_workspace" on public.strategy_forecast_scenarios for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_scenarios_forecast on public.strategy_forecast_scenarios(forecast_id, sort_order);
-- Exactly one expected scenario per forecast.
create unique index if not exists idx_strategy_scenarios_expected
  on public.strategy_forecast_scenarios(forecast_id) where is_expected;

create table if not exists public.strategy_forecast_periods (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  forecast_id uuid not null references public.strategy_forecasts(id) on delete cascade,
  scenario_id uuid references public.strategy_forecast_scenarios(id) on delete cascade,
  period_label text not null,
  period_date date not null,
  target_value numeric(16,2) not null default 0,
  forecast_value numeric(16,2) not null default 0,
  actual_value numeric(16,2),
  created_at timestamptz not null default now(),
  constraint strategy_forecast_periods_unique unique (forecast_id, scenario_id, period_date)
);
alter table public.strategy_forecast_periods enable row level security;
drop policy if exists "strategy_forecast_periods_workspace" on public.strategy_forecast_periods;
create policy "strategy_forecast_periods_workspace" on public.strategy_forecast_periods for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_periods_forecast on public.strategy_forecast_periods(forecast_id, period_date);
create index if not exists idx_strategy_periods_scenario on public.strategy_forecast_periods(scenario_id, period_date);

create table if not exists public.strategy_forecast_assumptions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  forecast_id uuid not null references public.strategy_forecasts(id) on delete cascade,
  label text not null,
  value_text text not null,
  numeric_value numeric(16,4),
  unit text,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  sort_order integer not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategy_forecast_assumptions enable row level security;
drop policy if exists "strategy_forecast_assumptions_workspace" on public.strategy_forecast_assumptions;
create policy "strategy_forecast_assumptions_workspace" on public.strategy_forecast_assumptions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_assumptions_forecast on public.strategy_forecast_assumptions(forecast_id, sort_order);

-- ============================================================
-- LINKS between strategy records
-- ============================================================
create table if not exists public.strategy_links (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null check (source_type in ('objective','audience','research','framework','plan','forecast')),
  source_id uuid not null,
  target_type text not null check (target_type in ('objective','audience','research','framework','plan','forecast','campaign')),
  target_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint strategy_links_unique unique (source_type, source_id, target_type, target_id),
  constraint strategy_links_no_self check (not (source_type = target_type and source_id = target_id))
);
alter table public.strategy_links enable row level security;
drop policy if exists "strategy_links_workspace" on public.strategy_links;
create policy "strategy_links_workspace" on public.strategy_links for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_links_source on public.strategy_links(workspace_id, source_type, source_id);
create index if not exists idx_strategy_links_target on public.strategy_links(workspace_id, target_type, target_id);

-- ============================================================
-- APPROVALS
-- ============================================================
create table if not exists public.strategy_approvals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('framework','research','objective','plan','forecast','asset')),
  entity_id uuid not null,
  stage text not null default 'review'
    check (stage in ('draft','review','legal_review','leadership','approved')),
  status text not null default 'pending'
    check (status in ('pending','approved','changes_requested','rejected')),
  requested_by uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  comment text,
  due_date date,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  sort_order integer not null default 0
);
alter table public.strategy_approvals enable row level security;
drop policy if exists "strategy_approvals_workspace" on public.strategy_approvals;
create policy "strategy_approvals_workspace" on public.strategy_approvals for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_approvals_entity on public.strategy_approvals(entity_type, entity_id, sort_order);
create index if not exists idx_strategy_approvals_workspace on public.strategy_approvals(workspace_id, status);

-- ============================================================
-- ACTIVITY / AUDIT
-- ============================================================
create table if not exists public.strategy_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null
    check (entity_type in ('strategy','objective','audience','research','framework','proof_point','claim','competitor','plan','plan_item','forecast','scenario','assumption','approval','system')),
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.strategy_activity enable row level security;
drop policy if exists "strategy_activity_workspace" on public.strategy_activity;
create policy "strategy_activity_workspace" on public.strategy_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_activity_workspace on public.strategy_activity(workspace_id, created_at desc);
create index if not exists idx_strategy_activity_entity on public.strategy_activity(entity_type, entity_id);

-- ============================================================
-- HEALTH SNAPSHOTS — the Overview "Strategy performance trend" series
-- ============================================================
create table if not exists public.strategy_health_snapshots (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_date date not null,
  health_score integer not null default 0 check (health_score between 0 and 100),
  benchmark_score integer not null default 0 check (benchmark_score between 0 and 100),
  objectives_on_track integer not null default 0,
  objectives_total integer not null default 0,
  created_at timestamptz not null default now(),
  constraint strategy_health_snapshots_unique unique (workspace_id, snapshot_date)
);
alter table public.strategy_health_snapshots enable row level security;
drop policy if exists "strategy_health_snapshots_workspace" on public.strategy_health_snapshots;
create policy "strategy_health_snapshots_workspace" on public.strategy_health_snapshots for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_strategy_health_ws on public.strategy_health_snapshots(workspace_id, snapshot_date);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'strategy_records','strategy_objectives','strategy_audiences','strategy_audience_personas',
    'strategy_research_collections','strategy_research_items','strategy_research_findings',
    'strategy_positioning_frameworks','strategy_positioning_pillars','strategy_proof_points',
    'strategy_claims','strategy_competitors','strategy_messaging_assets',
    'strategy_plans','strategy_plan_items','strategy_plan_risks',
    'strategy_forecasts','strategy_forecast_scenarios','strategy_forecast_assumptions'
  ]) loop
    if not exists (select 1 from pg_trigger where tgname = format('trg_%s_updated_at', t)) then
      execute format('
        create trigger trg_%s_updated_at before update on public.%s
        for each row execute function public.handle_updated_at()', t, t);
    end if;
  end loop;
end $$;
