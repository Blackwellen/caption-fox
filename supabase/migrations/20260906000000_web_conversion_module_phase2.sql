-- ============================================================
-- Caption Fox — Web & Conversion module (Phase 2)
-- Adds: page blocks + SEO, form fields + real submissions, deterministic
-- experiment visitor assignment, and columns supporting real public
-- tracking ingestion. Safe to re-run (idempotent).
-- ============================================================

-- ── Pages: content blocks + SEO ─────────────────────────────────────────────
alter table public.web_pages add column if not exists content jsonb not null default '[]'::jsonb;
alter table public.web_pages add column if not exists seo_title text;
alter table public.web_pages add column if not exists seo_description text;
alter table public.web_pages add column if not exists version integer not null default 1;

-- ── Forms: field schema + logic ─────────────────────────────────────────────
alter table public.web_forms add column if not exists fields jsonb not null default '[]'::jsonb;
alter table public.web_forms add column if not exists confirmation_message text not null default 'Thanks — we''ve received your submission.';

create table if not exists public.web_form_submissions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  form_id uuid not null references public.web_forms(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  completed boolean not null default true,
  source_url text,
  ip_hash text,
  created_at timestamptz not null default now()
);
alter table public.web_form_submissions enable row level security;
drop policy if exists "web_form_submissions_workspace" on public.web_form_submissions;
create policy "web_form_submissions_workspace" on public.web_form_submissions for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_form_submissions_form on public.web_form_submissions(form_id, created_at desc);

-- Public (anon) submit is handled by a service-role server action, not direct
-- anon RLS access — anon never gets a policy on this table.

-- ── Experiments: deterministic per-visitor assignment ───────────────────────
create table if not exists public.web_experiment_assignments (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  experiment_id uuid not null references public.web_experiments(id) on delete cascade,
  visitor_id text not null,
  variant text not null check (variant in ('control', 'variant')),
  converted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (experiment_id, visitor_id)
);
alter table public.web_experiment_assignments enable row level security;
drop policy if exists "web_experiment_assignments_workspace" on public.web_experiment_assignments;
create policy "web_experiment_assignments_workspace" on public.web_experiment_assignments for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_web_experiment_assignments_experiment on public.web_experiment_assignments(experiment_id);

-- ── Tracking: last event payload sample, for diagnostics ───────────────────
alter table public.web_tracking_events add column if not exists last_payload jsonb;
