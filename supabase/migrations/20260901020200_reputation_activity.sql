-- ============================================================
-- PR & Reputation module — activity/audit feed.
-- Mirrors messaging_activity / campaign_activity.
-- ============================================================

create table if not exists public.reputation_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in (
    'media_contact','media_list','pitch','press_release','press_room_asset',
    'coverage_mention','review','review_response','crisis_incident','crisis_statement'
  )),
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.reputation_activity enable row level security;
drop policy if exists "reputation_activity_workspace" on public.reputation_activity;
create policy "reputation_activity_workspace" on public.reputation_activity for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_reputation_activity_workspace on public.reputation_activity(workspace_id, created_at desc);
