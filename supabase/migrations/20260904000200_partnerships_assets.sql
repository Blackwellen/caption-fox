-- ============================================================
-- Caption Fox — Partnerships: content/asset approvals
-- Covers ambassador content submissions and co-marketing asset approvals —
-- the same review workflow, reused across both programme types rather than
-- two separate tables.
-- Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.partnership_assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  programme_id uuid not null references public.partnership_programmes(id) on delete cascade,
  partner_id uuid not null references public.partnership_partners(id) on delete cascade,
  asset_type text not null default 'content'
    check (asset_type in ('content', 'creative', 'document', 'social_post', 'other')),
  title text not null,
  url text,
  platform text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'rejected', 'published')),
  review_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.partnership_assets enable row level security;
drop policy if exists "partnership_assets_workspace" on public.partnership_assets;
create policy "partnership_assets_workspace" on public.partnership_assets for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_partnership_assets_programme on public.partnership_assets(programme_id, status);
create index if not exists idx_partnership_assets_partner on public.partnership_assets(partner_id, status);
