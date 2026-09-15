-- ============================================================
-- SOCIAL MODULE — activity feed + audit insert policy
--
-- `audit_logs` is deliberately owner/admin-read only, so it cannot back the
-- member-facing activity feeds on Social Overview and Social Publishing.
-- `social_activity` is the human-readable, member-visible feed; `audit_logs`
-- stays the privileged record. Both are written on every Social mutation.
-- ============================================================

create table if not exists public.social_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  /** Null actor = platform/system event (a scheduled publish, a webhook). */
  actor_kind text not null default 'user' check (actor_kind in ('user','system','automation','provider')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  channel_id uuid references public.social_channels(id) on delete set null,
  summary text not null,
  detail text,
  href text,
  severity text not null default 'info' check (severity in ('info','success','warning','error')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);
alter table public.social_activity enable row level security;
create index if not exists idx_social_activity_workspace
  on public.social_activity(workspace_id, created_at desc);
create index if not exists idx_social_activity_entity
  on public.social_activity(workspace_id, entity_type, entity_id);

drop policy if exists social_activity_workspace_read on public.social_activity;
create policy social_activity_workspace_read on public.social_activity for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
drop policy if exists social_activity_workspace_write on public.social_activity;
create policy social_activity_workspace_write on public.social_activity for insert with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- Members may append to the audit trail; only owners/admins may read it
-- (the existing `audit_admin_read` policy). Append-only: no update/delete.
drop policy if exists audit_member_append on public.audit_logs;
create policy audit_member_append on public.audit_logs for insert with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
