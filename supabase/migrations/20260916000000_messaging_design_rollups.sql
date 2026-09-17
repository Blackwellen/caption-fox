-- Messaging: rollups needed by the eight approved Messaging page designs.
--
-- The designs show breakdowns (mailbox provider, carrier, device OS, app vs
-- web, supported devices, conversation window) and per-channel audience
-- eligibility that the phase 1 schema could not hold. These are rollups written
-- by the send pipeline / provider webhooks (and by the dev demo seeder) and read
-- by the pages - they are never computed in the browser.

-- 1. Dimension breakdowns per channel and period.
create table if not exists public.messaging_metrics_breakdown (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','rcs','push')),
  dimension text not null check (dimension in (
    'mailbox_provider','carrier','device_os','platform','rcs_support','conversation_state','message_status','fallback',
    -- daily template usage: sent = uses, clicked = clicks, opened = clicks expected at the channel baseline CTR
    'template_usage'
  )),
  dim_key text not null,
  dim_label text not null,
  period_start date not null,
  period_end date not null,
  sent integer not null default 0,
  delivered integer not null default 0,
  opened integer not null default 0,
  clicked integer not null default 0,
  replied integer not null default 0,
  converted integer not null default 0,
  failed integer not null default 0,
  opt_outs integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel, dimension, dim_key, period_start, period_end)
);

alter table public.messaging_metrics_breakdown enable row level security;
drop policy if exists "messaging_metrics_breakdown_workspace" on public.messaging_metrics_breakdown;
create policy "messaging_metrics_breakdown_workspace" on public.messaging_metrics_breakdown for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_messaging_metrics_breakdown_lookup
  on public.messaging_metrics_breakdown(workspace_id, channel, dimension, period_end desc);

-- 2. Per-channel eligibility rollup for an audience:
--    { "email": { "eligible": n, "risky": n, "ineligible": n, "unknown": n }, ... }
alter table public.messaging_audiences add column if not exists channel_reach jsonb not null default '{}'::jsonb;
alter table public.messaging_audiences add column if not exists exclusions text[] not null default '{}';

-- Recomputes channel_reach from the audience's real members, consent flags and
-- suppressions. Called after membership changes and by the audience refresh job.
create or replace function public.refresh_messaging_audience_reach(p_audience_id uuid)
returns jsonb
language sql
security invoker
as $$
  with members as (
    select c.* from public.messaging_audience_members m
    join public.messaging_contacts c on c.id = m.contact_id
    where m.audience_id = p_audience_id
  ),
  per_channel as (
    select ch.channel,
      count(*) filter (where ch.addr is not null and ch.consent and not mb.do_not_contact and mb.unsubscribed_at is null
        and not exists (select 1 from public.messaging_suppressions s where s.contact_id = mb.id and s.channel = ch.channel)
        and not exists (select 1 from public.messaging_delivery_events e where e.contact_id = mb.id and e.channel = ch.channel
          and e.event_type in ('deferred','bounced') and e.occurred_at > now() - interval '90 days')) as eligible,
      -- Risky: would be sent to, but the address deferred or bounced in the last 90 days.
      count(*) filter (where ch.addr is not null and ch.consent and not mb.do_not_contact and mb.unsubscribed_at is null
        and exists (select 1 from public.messaging_delivery_events e where e.contact_id = mb.id and e.channel = ch.channel
          and e.event_type in ('deferred','bounced') and e.occurred_at > now() - interval '90 days')) as risky,
      count(*) filter (where ch.addr is not null and (not ch.consent or mb.do_not_contact or mb.unsubscribed_at is not null
        or exists (select 1 from public.messaging_suppressions s where s.contact_id = mb.id and s.channel = ch.channel))) as ineligible,
      count(*) filter (where ch.addr is null) as unknown
    from members mb
    cross join lateral (values
      ('email', mb.email, mb.email_consent),
      ('sms', mb.phone, mb.sms_consent),
      ('whatsapp', mb.whatsapp_id, mb.whatsapp_consent),
      ('rcs', mb.rcs_id, mb.rcs_consent),
      ('push', mb.push_token, mb.push_consent)
    ) as ch(channel, addr, consent)
    group by ch.channel
  )
  select coalesce(jsonb_object_agg(channel, jsonb_build_object(
    'eligible', eligible, 'risky', risky, 'ineligible', ineligible, 'unknown', unknown)), '{}'::jsonb)
  from per_channel;
$$;

-- 3. Programme category shown in the designs (Lifecycle / Transactional / Promotional / Re-engagement)
--    and the previous send window's rates, used for the "up 1.9pp" deltas.
alter table public.messaging_messages add column if not exists category text not null default 'promotional';
alter table public.messaging_messages drop constraint if exists messaging_messages_category_check;
alter table public.messaging_messages add constraint messaging_messages_category_check
  check (category in ('lifecycle','transactional','promotional','re_engagement','retention','engagement','behavioral','trigger_based'));
-- Contacts moved to a fallback channel (RCS -> SMS/Email) for this message.
alter table public.messaging_messages add column if not exists fallback_count integer not null default 0;
alter table public.messaging_messages add column if not exists prior_rates jsonb not null default '{}'::jsonb;
alter table public.messaging_messages add column if not exists channel_mix text[] not null default '{}';

-- 4. Journey node statistics and next launch.
alter table public.messaging_journeys add column if not exists next_launch_at timestamptz;
alter table public.messaging_journeys add column if not exists prior_conversion_rate numeric;

-- 5. Template usage by journey and approval priority.
alter table public.messaging_templates add column if not exists preview_image_url text;
alter table public.messaging_templates add column if not exists approval_priority text
  check (approval_priority in ('high','medium','low'));
alter table public.messaging_templates add column if not exists approval_expires_at timestamptz;
alter table public.messaging_templates add column if not exists last_used_at timestamptz;
alter table public.messaging_templates add column if not exists journey_ids uuid[] not null default '{}';
alter table public.messaging_templates add column if not exists published_at timestamptz;
alter table public.messaging_templates add column if not exists prior_rates jsonb not null default '{}'::jsonb;
alter table public.messaging_templates add column if not exists preview jsonb not null default '{}'::jsonb;

-- Existing databases: widen the dimension check to match the table definition above.
alter table public.messaging_metrics_breakdown drop constraint if exists messaging_metrics_breakdown_dimension_check;
alter table public.messaging_metrics_breakdown add constraint messaging_metrics_breakdown_dimension_check check (dimension in (
  'mailbox_provider','carrier','device_os','platform','rcs_support','conversation_state','message_status','fallback','template_usage'));

-- 6. Journey approval and execution rollups (funnel, per-node delay) written by the journey engine.
alter table public.messaging_journeys add column if not exists approval_status text not null default 'not_required';
alter table public.messaging_journeys drop constraint if exists messaging_journeys_approval_status_check;
alter table public.messaging_journeys add constraint messaging_journeys_approval_status_check
  check (approval_status in ('not_required','pending','approved','changes_requested','rejected'));
alter table public.messaging_journeys add column if not exists stats jsonb not null default '{}'::jsonb;

-- 6. Saved views for the Messaging list pages (per user, optionally shared with the workspace).
create table if not exists public.messaging_saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  surface text not null check (surface in ('overview','email','sms','whatsapp','rcs','push','journeys','templates')),
  name text not null check (char_length(name) between 1 and 60),
  params jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messaging_saved_views_surface on public.messaging_saved_views(workspace_id, surface);
alter table public.messaging_saved_views enable row level security;
drop policy if exists "messaging_saved_views_read" on public.messaging_saved_views;
create policy "messaging_saved_views_read" on public.messaging_saved_views for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  and (user_id = auth.uid() or shared)
);
drop policy if exists "messaging_saved_views_write" on public.messaging_saved_views;
create policy "messaging_saved_views_write" on public.messaging_saved_views for all using (
  user_id = auth.uid() and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  user_id = auth.uid() and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- 7. Cross-channel programmes (Overview) are messages orchestrated across 2+ channels.
alter table public.messaging_messages add column if not exists channel_count integer generated always as (cardinality(channel_mix)) stored;
create index if not exists idx_messaging_messages_updated on public.messaging_messages(workspace_id, channel, updated_at desc);
