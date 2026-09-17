-- ============================================================
-- Strategy: workspace-owned CRM connections for audience segment sync.
--
-- The workspace connects HubSpot with ITS OWN private-app access token;
-- Caption Fox never provisions CRM credentials. The token is AES-256-GCM
-- encrypted by the app before it is stored, and the encrypted column is not
-- selectable by signed-in clients at all: only the server (service role, after
-- its own workspace + role checks) can read it.
--
-- Synced audiences carry (external_provider, external_id) so a re-sync updates
-- the same row instead of duplicating it. Only aggregated segment counts are
-- stored — never individual contacts.
-- Idempotent.
-- ============================================================

create table if not exists public.strategy_crm_connections (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('hubspot')),
  access_token_encrypted text not null,
  token_tail text not null,
  account_label text,
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('success','partial','failed')),
  last_sync_error text,
  last_sync_count integer,
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

alter table public.strategy_crm_connections enable row level security;

drop policy if exists strategy_crm_connections_read on public.strategy_crm_connections;
create policy strategy_crm_connections_read on public.strategy_crm_connections for select to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- Connecting and disconnecting are owner/admin only; there is deliberately no
-- insert/update/delete policy for other roles.
drop policy if exists strategy_crm_connections_admin_write on public.strategy_crm_connections;
create policy strategy_crm_connections_admin_write on public.strategy_crm_connections for all to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid() and role in ('owner','admin')))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid() and role in ('owner','admin')));

-- Column-level privilege: the encrypted token is never readable by clients.
revoke all on public.strategy_crm_connections from anon, authenticated;
grant select (id, workspace_id, provider, token_tail, account_label, status, connected_by, connected_at,
  last_synced_at, last_sync_status, last_sync_error, last_sync_count, updated_at)
  on public.strategy_crm_connections to authenticated;
grant delete on public.strategy_crm_connections to authenticated;

alter table public.strategy_audiences add column if not exists external_provider text;
alter table public.strategy_audiences add column if not exists external_id text;
alter table public.strategy_audiences add column if not exists last_synced_at timestamptz;
create unique index if not exists uq_strategy_audiences_external
  on public.strategy_audiences(workspace_id, external_provider, external_id)
  where external_id is not null;
