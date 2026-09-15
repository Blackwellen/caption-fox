-- ============================================================
-- SOCIAL MODULE - OAuth state and credential vault
--
-- social_channels is readable by every workspace member, so provider tokens
-- must not live there. Both tables below have RLS enabled and deliberately no
-- policy: they are reachable only through the service-role client, and only
-- after workspace membership has been proved on the request-scoped client.
-- ============================================================

create table if not exists public.social_oauth_states (
  state text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  code_verifier text,
  redirect_uri text not null,
  requested_scopes text[] not null default '{}',
  -- Set when the flow re-authorises an existing channel rather than adding one.
  channel_id uuid references public.social_channels(id) on delete cascade,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz
);
alter table public.social_oauth_states enable row level security;
create index if not exists idx_social_oauth_states_expiry on public.social_oauth_states(expires_at);

create table if not exists public.social_channel_secrets (
  channel_id uuid primary key references public.social_channels(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  rotated_at timestamptz not null default now()
);
alter table public.social_channel_secrets enable row level security;

-- Tokens previously written onto social_channels are cleared; the columns stay
-- for backwards compatibility but are no longer read or written.
update public.social_channels
   set access_token_encrypted = null, refresh_token_encrypted = null
 where access_token_encrypted is not null or refresh_token_encrypted is not null;

comment on column public.social_channels.access_token_encrypted is
  'Deprecated - tokens live in social_channel_secrets (service-role only).';
comment on column public.social_channels.refresh_token_encrypted is
  'Deprecated - tokens live in social_channel_secrets (service-role only).';
