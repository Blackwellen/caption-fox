-- ============================================================
-- Caption Fox — Campaign Manager: Web & Conversion module (Phase 1: Overview)
-- Pages, Forms, Funnels (+ steps), Experiments, Tracking Events (+
-- destinations), daily metrics for trend charts, and a shared Web activity
-- feed. Mirrors the messaging_* module's shape and RLS pattern exactly.
-- Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- WEB PAGES
-- ============================================================
create table if not exists public.web_pages (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  page_type text not null default 'landing_page' check (page_type in ('landing_page','microsite')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  sessions integer not null default 0,
  conversions integer not null default 0,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
alter table public.web_pages enable row level security;
drop policy if exists "web_pages_workspace" on public.web_pages;
create policy "web_pages_workspace" on public.web_pages for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_pages_workspace on public.web_pages(workspace_id);

-- ============================================================
-- WEB FORMS
-- ============================================================
create table if not exists public.web_forms (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  form_type text not null default 'lead_capture' check (form_type in ('lead_capture','subscription','registration','survey','contact')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  destination_label text,
  submissions_count integer not null default 0,
  completed_count integer not null default 0,
  avg_completion_seconds integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.web_forms enable row level security;
drop policy if exists "web_forms_workspace" on public.web_forms;
create policy "web_forms_workspace" on public.web_forms for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_forms_workspace on public.web_forms(workspace_id);

-- ============================================================
-- WEB FUNNELS + STEPS
-- ============================================================
create table if not exists public.web_funnels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  funnel_type text not null default 'standard' check (funnel_type in ('standard','trial','lead_gen','promotion')),
  status text not null default 'active' check (status in ('active','at_risk','paused','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  entries integer not null default 0,
  conversions integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.web_funnels enable row level security;
drop policy if exists "web_funnels_workspace" on public.web_funnels;
create policy "web_funnels_workspace" on public.web_funnels for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_funnels_workspace on public.web_funnels(workspace_id);

create table if not exists public.web_funnel_steps (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  funnel_id uuid not null references public.web_funnels(id) on delete cascade,
  step_order integer not null,
  name text not null,
  users_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (funnel_id, step_order)
);
alter table public.web_funnel_steps enable row level security;
drop policy if exists "web_funnel_steps_workspace" on public.web_funnel_steps;
create policy "web_funnel_steps_workspace" on public.web_funnel_steps for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_funnel_steps_funnel on public.web_funnel_steps(funnel_id, step_order);

-- ============================================================
-- WEB EXPERIMENTS
-- Statistics are computed in the app layer from these raw counts using a
-- documented two-proportion z-test — never stored as a fabricated number.
-- ============================================================
create table if not exists public.web_experiments (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  experiment_type text not null default 'page' check (experiment_type in ('page','form','funnel')),
  surface_ref text,
  status text not null default 'draft' check (status in ('draft','planning','scheduled','running','paused','analyzing','completed','archived')),
  owner_id uuid references public.profiles(id) on delete set null,
  control_visitors integer not null default 0,
  control_conversions integer not null default 0,
  variant_visitors integer not null default 0,
  variant_conversions integer not null default 0,
  traffic_allocation_percent integer not null default 50,
  starts_at timestamptz,
  ends_at timestamptz,
  winner text check (winner in ('control','variant')),
  winner_selected_at timestamptz,
  winner_selected_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.web_experiments enable row level security;
drop policy if exists "web_experiments_workspace" on public.web_experiments;
create policy "web_experiments_workspace" on public.web_experiments for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_experiments_workspace on public.web_experiments(workspace_id);

-- ============================================================
-- TRACKING EVENTS + DESTINATIONS
-- ============================================================
create table if not exists public.web_tracking_destinations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('ga4','meta_pixel','linkedin_insight','google_ads','webhook','crm','segment','warehouse')),
  name text not null,
  status text not null default 'healthy' check (status in ('healthy','warning','error')),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.web_tracking_destinations enable row level security;
drop policy if exists "web_tracking_destinations_workspace" on public.web_tracking_destinations;
create policy "web_tracking_destinations_workspace" on public.web_tracking_destinations for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_tracking_destinations_workspace on public.web_tracking_destinations(workspace_id);

create table if not exists public.web_tracking_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_name text not null,
  event_category text not null default 'engagement' check (event_category in ('conversion','engagement')),
  source text not null default 'website',
  destinations text[] not null default '{}',
  status text not null default 'healthy' check (status in ('healthy','warning','critical')),
  volume integer not null default 0,
  coverage_percent numeric(5,2) not null default 0,
  last_received_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.web_tracking_events enable row level security;
drop policy if exists "web_tracking_events_workspace" on public.web_tracking_events;
create policy "web_tracking_events_workspace" on public.web_tracking_events for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_tracking_events_workspace on public.web_tracking_events(workspace_id);

-- ============================================================
-- DAILY METRICS (traffic + conversions trend, source mix, device mix)
-- ============================================================
create table if not exists public.web_metrics_daily (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric_date date not null,
  sessions integer not null default 0,
  conversions integer not null default 0,
  source text not null default 'direct' check (source in ('organic_search','paid_search','direct','social','referral','other')),
  device text not null default 'desktop' check (device in ('desktop','mobile','tablet')),
  created_at timestamptz not null default now(),
  unique (workspace_id, metric_date, source, device)
);
alter table public.web_metrics_daily enable row level security;
drop policy if exists "web_metrics_daily_workspace" on public.web_metrics_daily;
create policy "web_metrics_daily_workspace" on public.web_metrics_daily for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_metrics_daily_workspace on public.web_metrics_daily(workspace_id, metric_date);

-- ============================================================
-- WEB ACTIVITY
-- ============================================================
create table if not exists public.web_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in ('page','form','funnel','experiment','tracking_event','system')),
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.web_activity enable row level security;
drop policy if exists "web_activity_workspace" on public.web_activity;
create policy "web_activity_workspace" on public.web_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_activity_workspace on public.web_activity(workspace_id, created_at desc);
