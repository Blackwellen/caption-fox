-- ============================================================
-- Caption Fox — Automations module
--
-- A real, workspace-scoped automation engine implemented natively in
-- Postgres: event-driven automations fire from AFTER INSERT/UPDATE triggers
-- on the tables they watch, and scheduled automations fire from a pg_cron
-- job. Every automation is a single trigger + conditions (jsonb) + an
-- ordered list of actions (jsonb) — a "recipe", not a visual node canvas —
-- which keeps the engine genuinely deployable and auditable without needing
-- external worker infrastructure this codebase does not otherwise have.
--
-- Idempotency: `automation_fired_entities` enforces that an automation fires
-- at most once per (automation_id, entity_id) pair, so a scheduled check
-- that runs every 30 minutes cannot re-fire the same reminder repeatedly.
--
-- Safe to re-run (idempotent DDL). Row-level security matches every other
-- module: workspace-membership scoping on USING and WITH CHECK.
-- ============================================================

-- ============================================================
-- AUTOMATIONS
-- ============================================================
create table if not exists public.automations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_key text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  source_template_key text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  run_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  last_run_at timestamptz,
  last_run_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.automations enable row level security;
drop policy if exists "automations_workspace" on public.automations;
create policy "automations_workspace" on public.automations for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_automations_workspace_status on public.automations(workspace_id, status);
create index if not exists idx_automations_trigger on public.automations(trigger_key) where status = 'active';

drop trigger if exists trg_automations_updated_at on public.automations;
create trigger trg_automations_updated_at before update on public.automations
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTOMATION RUNS
-- ============================================================
create table if not exists public.automation_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  trigger_source text not null check (trigger_source in ('event', 'schedule', 'manual', 'test')),
  status text not null default 'running' check (status in ('running', 'success', 'failed', 'skipped')),
  context jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.automation_runs enable row level security;
drop policy if exists "automation_runs_workspace" on public.automation_runs;
create policy "automation_runs_workspace" on public.automation_runs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_automation_runs_workspace_started on public.automation_runs(workspace_id, started_at desc);
create index if not exists idx_automation_runs_automation on public.automation_runs(automation_id, started_at desc);
create index if not exists idx_automation_runs_status on public.automation_runs(workspace_id, status);

-- ============================================================
-- AUTOMATION ACTION LOGS (one row per action executed within a run)
-- ============================================================
create table if not exists public.automation_action_logs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_key text not null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  message text,
  affected_entity_type text,
  affected_entity_id uuid,
  created_at timestamptz not null default now()
);
alter table public.automation_action_logs enable row level security;
drop policy if exists "automation_action_logs_workspace" on public.automation_action_logs;
create policy "automation_action_logs_workspace" on public.automation_action_logs for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_automation_action_logs_run on public.automation_action_logs(run_id);

-- ============================================================
-- FIRED ENTITIES (idempotency guard for scheduled automations)
-- ============================================================
create table if not exists public.automation_fired_entities (
  automation_id uuid not null references public.automations(id) on delete cascade,
  entity_id uuid not null,
  fired_at timestamptz not null default now(),
  primary key (automation_id, entity_id)
);
alter table public.automation_fired_entities enable row level security;
drop policy if exists "automation_fired_entities_workspace" on public.automation_fired_entities;
create policy "automation_fired_entities_workspace" on public.automation_fired_entities for all using (
  automation_id in (
    select id from public.automations
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
) with check (
  automation_id in (
    select id from public.automations
    where workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  )
);

-- ============================================================
-- NOTIFICATIONS (automation-generated, surfaced in the Automations UI)
-- ============================================================
create table if not exists public.automation_notifications (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  run_id uuid references public.automation_runs(id) on delete set null,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.automation_notifications enable row level security;
drop policy if exists "automation_notifications_workspace" on public.automation_notifications;
create policy "automation_notifications_workspace" on public.automation_notifications for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);
create index if not exists idx_automation_notifications_workspace on public.automation_notifications(workspace_id, read, created_at desc);

-- ============================================================
-- OUTGOING WEBHOOKS (used by the send_webhook action)
-- ============================================================
create table if not exists public.automation_webhooks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  url text not null check (url like 'https://%'),
  secret text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.automation_webhooks enable row level security;
drop policy if exists "automation_webhooks_workspace" on public.automation_webhooks;
create policy "automation_webhooks_workspace" on public.automation_webhooks for all using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

-- ============================================================
-- TEMPLATES (recipe library — global, curated, not workspace data)
-- ============================================================
create table if not exists public.automation_templates (
  key text primary key,
  name text not null,
  description text not null,
  category text not null,
  trigger_key text not null,
  default_trigger_config jsonb not null default '{}'::jsonb,
  default_conditions jsonb not null default '[]'::jsonb,
  default_actions jsonb not null default '[]'::jsonb,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);
-- Templates are read-only reference data: every authenticated workspace
-- member can read them (there is nothing workspace-specific to leak), but
-- only service-role writes them (via this migration).
alter table public.automation_templates enable row level security;
drop policy if exists "automation_templates_read" on public.automation_templates;
create policy "automation_templates_read" on public.automation_templates for select using (true);

-- ============================================================
-- Action catalog (documents every action_key the executor supports —
-- referenced by the UI to render human-readable labels/config forms).
-- ============================================================
create table if not exists public.automation_action_catalog (
  key text primary key,
  label text not null,
  description text not null,
  config_schema jsonb not null default '{}'::jsonb,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high'))
);
alter table public.automation_action_catalog enable row level security;
drop policy if exists "automation_action_catalog_read" on public.automation_action_catalog;
create policy "automation_action_catalog_read" on public.automation_action_catalog for select using (true);

create table if not exists public.automation_trigger_catalog (
  key text primary key,
  label text not null,
  description text not null,
  kind text not null check (kind in ('event', 'schedule')),
  source_table text,
  config_schema jsonb not null default '{}'::jsonb
);
alter table public.automation_trigger_catalog enable row level security;
drop policy if exists "automation_trigger_catalog_read" on public.automation_trigger_catalog;
create policy "automation_trigger_catalog_read" on public.automation_trigger_catalog for select using (true);

-- ============================================================
-- Seed the two read-only catalogs (idempotent upserts).
-- ============================================================
insert into public.automation_trigger_catalog (key, label, description, kind, source_table, config_schema) values
  ('member.joined', 'Member joined', 'Fires when a new member joins any community in this workspace.', 'event', 'community_members', '{}'::jsonb),
  ('member.became_at_risk', 'Member became at-risk', 'Fires when a member''s lifecycle stage changes to at-risk.', 'event', 'community_members', '{}'::jsonb),
  ('member.became_ambassador', 'Member became ambassador', 'Fires when a member is promoted to the ambassador role.', 'event', 'community_members', '{}'::jsonb),
  ('moderation.report_created', 'Moderation report created', 'Fires when any new moderation report is logged.', 'event', 'community_moderation_reports', '{}'::jsonb),
  ('moderation.critical_report', 'Critical report detected', 'Fires when a moderation report is logged with critical severity.', 'event', 'community_moderation_reports', '{}'::jsonb),
  ('event.scheduled', 'Event scheduled', 'Fires when a new community event is created.', 'event', 'community_events', '{}'::jsonb),
  ('reward.pending', 'Reward pending approval', 'Fires when a new advocacy reward is created and needs approval.', 'event', 'community_rewards', '{}'::jsonb),
  ('event.starting_soon', 'Event starting soon', 'Checked every 30 minutes — fires once per event within the configured lead time of its start.', 'schedule', 'community_events', '{"hours_before": {"type": "number", "default": 24}}'::jsonb),
  ('reward.pending_stale', 'Reward pending too long', 'Checked every 30 minutes — fires once per reward still pending after the configured number of days.', 'schedule', 'community_rewards', '{"days": {"type": "number", "default": 3}}'::jsonb),
  ('schedule.daily', 'Daily schedule', 'Fires once a day at the scheduled check — use for digest-style automations.', 'schedule', null, '{}'::jsonb)
on conflict (key) do update set label = excluded.label, description = excluded.description, kind = excluded.kind, source_table = excluded.source_table, config_schema = excluded.config_schema;

insert into public.automation_action_catalog (key, label, description, config_schema, risk_level) values
  ('log_activity', 'Log activity note', 'Writes a note to the community activity feed.', '{"message": {"type": "string"}}'::jsonb, 'low'),
  ('assign_moderator', 'Assign moderator', 'Assigns the moderation report to a specific team member.', '{"assignee_id": {"type": "string"}}'::jsonb, 'low'),
  ('escalate_report', 'Escalate report', 'Marks the moderation report as escalated for senior review.', '{}'::jsonb, 'medium'),
  ('send_notification', 'Send in-app notification', 'Creates a notification visible in the Automations panel.', '{"title": {"type": "string"}, "message": {"type": "string"}}'::jsonb, 'low'),
  ('send_webhook', 'Send outgoing webhook', 'POSTs the event payload to a configured outgoing webhook.', '{"webhook_id": {"type": "string"}}'::jsonb, 'medium'),
  ('flag_member_for_followup', 'Flag member for follow-up', 'Logs an activity note flagging the member for manual re-engagement.', '{}'::jsonb, 'low'),
  ('update_member_lifecycle', 'Update member lifecycle stage', 'Updates the member''s lifecycle stage.', '{"stage": {"type": "string"}}'::jsonb, 'medium')
on conflict (key) do update set label = excluded.label, description = excluded.description, config_schema = excluded.config_schema, risk_level = excluded.risk_level;

-- ============================================================
-- Recipe templates (idempotent upserts) — install-disabled, review-first,
-- matching the "draft on install" rule: using a template creates a `draft`
-- automation, never an already-active one.
-- ============================================================
insert into public.automation_templates (key, name, description, category, trigger_key, default_trigger_config, default_conditions, default_actions, risk_level) values
  ('welcome_new_member', 'New member → welcome note', 'Logs a welcome activity note whenever someone joins a community.', 'members', 'member.joined', '{}', '[]', '[{"action_key": "log_activity", "config": {"message": "Welcomed new member"}}]', 'low'),
  ('at_risk_followup', 'At-risk member → flag for follow-up', 'Flags a member for manual re-engagement as soon as they become at-risk.', 'members', 'member.became_at_risk', '{}', '[]', '[{"action_key": "flag_member_for_followup", "config": {}}, {"action_key": "send_notification", "config": {"title": "At-risk member", "message": "A member needs re-engagement follow-up."}}]', 'low'),
  ('critical_report_escalation', 'Critical report → escalate + notify', 'Immediately escalates and notifies the team when a critical-severity report is filed.', 'moderation', 'moderation.critical_report', '{}', '[]', '[{"action_key": "escalate_report", "config": {}}, {"action_key": "send_notification", "config": {"title": "Critical moderation report", "message": "A critical-severity report needs urgent review."}}]', 'medium'),
  ('new_report_log', 'New report → activity log', 'Logs every new moderation report to the activity feed for visibility.', 'moderation', 'moderation.report_created', '{}', '[]', '[{"action_key": "log_activity", "config": {"message": "New moderation report logged"}}]', 'low'),
  ('event_reminder_24h', 'Event starting soon → notify', 'Sends a reminder notification 24 hours before a scheduled event starts.', 'calendar', 'event.starting_soon', '{"hours_before": 24}', '[]', '[{"action_key": "send_notification", "config": {"title": "Event starting soon", "message": "An event starts within 24 hours."}}]', 'low'),
  ('new_event_log', 'New event scheduled → activity log', 'Logs newly scheduled events to the activity feed.', 'calendar', 'event.scheduled', '{}', '[]', '[{"action_key": "log_activity", "config": {"message": "New event scheduled"}}]', 'low'),
  ('reward_pending_reminder', 'Reward pending 3+ days → remind', 'Reminds the team to review a reward approval that has been pending for 3 or more days.', 'advocacy', 'reward.pending_stale', '{"days": 3}', '[]', '[{"action_key": "send_notification", "config": {"title": "Reward approval overdue", "message": "A reward has been pending for 3+ days."}}]', 'low'),
  ('new_reward_log', 'New reward request → activity log', 'Logs every new reward request as it is created.', 'advocacy', 'reward.pending', '{}', '[]', '[{"action_key": "log_activity", "config": {"message": "New reward request awaiting approval"}}]', 'low'),
  ('ambassador_promotion_log', 'Member promoted to ambassador → log', 'Logs a celebratory activity note when a member becomes an ambassador.', 'advocacy', 'member.became_ambassador', '{}', '[]', '[{"action_key": "log_activity", "config": {"message": "Member promoted to ambassador"}}]', 'low'),
  ('daily_digest_placeholder', 'Daily digest → notification', 'Sends a single daily notification — a starting point for a digest automation.', 'admin', 'schedule.daily', '{}', '[]', '[{"action_key": "send_notification", "config": {"title": "Daily community digest", "message": "Your daily community summary is ready to configure."}}]', 'low')
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category, trigger_key = excluded.trigger_key, default_trigger_config = excluded.default_trigger_config, default_conditions = excluded.default_conditions, default_actions = excluded.default_actions, risk_level = excluded.risk_level;

-- ============================================================
-- Condition evaluation: a condition is {field, operator, value}; `field`
-- reads from the event context jsonb via ->>. Supports the operators the UI
-- exposes. Unknown operators fail closed (condition does not match).
-- ============================================================
create or replace function public.fn_automation_condition_matches(p_condition jsonb, p_context jsonb)
returns boolean as $$
declare
  v_field text := p_condition->>'field';
  v_operator text := p_condition->>'operator';
  v_value text := p_condition->>'value';
  v_actual text;
begin
  if v_field is null or v_operator is null then return true; end if;
  v_actual := p_context->>v_field;
  return case v_operator
    when 'eq' then v_actual = v_value
    when 'neq' then v_actual is distinct from v_value
    when 'gt' then (v_actual)::numeric > (v_value)::numeric
    when 'gte' then (v_actual)::numeric >= (v_value)::numeric
    when 'lt' then (v_actual)::numeric < (v_value)::numeric
    when 'lte' then (v_actual)::numeric <= (v_value)::numeric
    when 'contains' then v_actual ilike ('%' || v_value || '%')
    else false
  end;
exception when others then
  return false;
end;
$$ language plpgsql stable;

create or replace function public.fn_automation_conditions_match(p_conditions jsonb, p_context jsonb)
returns boolean as $$
declare
  v_condition jsonb;
begin
  if p_conditions is null or jsonb_array_length(p_conditions) = 0 then return true; end if;
  for v_condition in select * from jsonb_array_elements(p_conditions) loop
    if not public.fn_automation_condition_matches(v_condition, p_context) then
      return false;
    end if;
  end loop;
  return true;
end;
$$ language plpgsql stable;

-- ============================================================
-- Action executor: dispatches on action_key. Every branch is defensive
-- (missing config -> logged as skipped, not a thrown error) so one bad
-- action config never aborts the rest of the run.
-- ============================================================
create or replace function public.fn_run_automation_action(
  p_workspace_id uuid, p_run_id uuid, p_action jsonb, p_context jsonb
) returns void as $$
declare
  v_key text := p_action->>'action_key';
  v_config jsonb := coalesce(p_action->'config', '{}'::jsonb);
  v_report_id uuid;
  v_member_id uuid;
  v_webhook record;
begin
  if v_key = 'log_activity' then
    insert into public.community_activity (workspace_id, community_id, entity_type, entity_id, action, summary, surface)
    values (
      p_workspace_id,
      nullif(p_context->>'community_id', '')::uuid,
      coalesce(p_context->>'entity_type', 'automation'),
      nullif(p_context->>'entity_id', '')::uuid,
      'automation',
      coalesce(v_config->>'message', 'Automation ran'),
      'automations'
    );
    insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
    values (p_workspace_id, p_run_id, v_key, 'success', 'Activity note logged');

  elsif v_key = 'assign_moderator' then
    v_report_id := nullif(p_context->>'entity_id', '')::uuid;
    if v_report_id is null or v_config->>'assignee_id' is null then
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (p_workspace_id, p_run_id, v_key, 'skipped', 'Missing report id or assignee_id config');
    else
      update public.community_moderation_reports set assignee_id = (v_config->>'assignee_id')::uuid
      where id = v_report_id and workspace_id = p_workspace_id;
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message, affected_entity_type, affected_entity_id)
      values (p_workspace_id, p_run_id, v_key, 'success', 'Report assigned', 'moderation_report', v_report_id);
    end if;

  elsif v_key = 'escalate_report' then
    v_report_id := nullif(p_context->>'entity_id', '')::uuid;
    if v_report_id is null then
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (p_workspace_id, p_run_id, v_key, 'skipped', 'No report id in context');
    else
      update public.community_moderation_reports set status = 'escalated'
      where id = v_report_id and workspace_id = p_workspace_id and status not in ('resolved', 'dismissed', 'archived');
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message, affected_entity_type, affected_entity_id)
      values (p_workspace_id, p_run_id, v_key, 'success', 'Report escalated', 'moderation_report', v_report_id);
    end if;

  elsif v_key = 'send_notification' then
    insert into public.automation_notifications (workspace_id, automation_id, run_id, title, message, link)
    select p_workspace_id, automation_id, p_run_id,
      coalesce(v_config->>'title', 'Automation notification'),
      coalesce(v_config->>'message', 'An automation produced a notification.'),
      '/app/automations'
    from public.automation_runs where id = p_run_id;
    insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
    values (p_workspace_id, p_run_id, v_key, 'success', 'Notification created');

  elsif v_key = 'send_webhook' then
    select * into v_webhook from public.automation_webhooks
    where workspace_id = p_workspace_id and id = nullif(v_config->>'webhook_id', '')::uuid and is_active;
    if v_webhook.id is null then
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (p_workspace_id, p_run_id, v_key, 'skipped', 'No active webhook configured');
    elsif exists (select 1 from pg_extension where extname = 'pg_net') then
      perform net.http_post(
        url := v_webhook.url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'X-CaptionFox-Token', coalesce(v_webhook.secret, '')),
        body := jsonb_build_object('event', p_context, 'automation_run_id', p_run_id)
      );
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (p_workspace_id, p_run_id, v_key, 'success', 'Webhook dispatched via pg_net');
    else
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (p_workspace_id, p_run_id, v_key, 'failed', 'pg_net extension is not enabled on this project — webhook not sent');
    end if;

  elsif v_key = 'flag_member_for_followup' then
    v_member_id := nullif(p_context->>'entity_id', '')::uuid;
    insert into public.community_activity (workspace_id, community_id, entity_type, entity_id, action, summary, surface)
    values (
      p_workspace_id, nullif(p_context->>'community_id', '')::uuid, 'member', v_member_id,
      'automation', 'Member flagged for re-engagement follow-up by automation', 'automations'
    );
    insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message, affected_entity_type, affected_entity_id)
    values (p_workspace_id, p_run_id, v_key, 'success', 'Member flagged', 'member', v_member_id);

  elsif v_key = 'update_member_lifecycle' then
    v_member_id := nullif(p_context->>'entity_id', '')::uuid;
    if v_member_id is null or v_config->>'stage' is null then
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (p_workspace_id, p_run_id, v_key, 'skipped', 'Missing member id or stage config');
    else
      update public.community_members set lifecycle_stage = v_config->>'stage'
      where id = v_member_id and workspace_id = p_workspace_id;
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message, affected_entity_type, affected_entity_id)
      values (p_workspace_id, p_run_id, v_key, 'success', 'Lifecycle stage updated', 'member', v_member_id);
    end if;

  else
    insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
    values (p_workspace_id, p_run_id, v_key, 'skipped', 'Unknown action_key');
  end if;
exception when others then
  insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
  values (p_workspace_id, p_run_id, coalesce(v_key, 'unknown'), 'failed', sqlerrm);
end;
$$ language plpgsql;

-- ============================================================
-- Runs every automation matching a trigger_key for a workspace against the
-- given context. Called by table triggers (event-driven) and by the
-- scheduled sweep function below (schedule-driven).
-- ============================================================
create or replace function public.fn_run_automations_for_event(
  p_workspace_id uuid, p_trigger_key text, p_context jsonb, p_source text default 'event'
) returns void as $$
declare
  v_automation record;
  v_run_id uuid;
  v_action jsonb;
  v_had_failure boolean;
begin
  for v_automation in
    select * from public.automations
    where workspace_id = p_workspace_id and status = 'active' and trigger_key = p_trigger_key
  loop
    if not public.fn_automation_conditions_match(v_automation.conditions, p_context) then
      continue;
    end if;

    insert into public.automation_runs (workspace_id, automation_id, trigger_source, status, context)
    values (p_workspace_id, v_automation.id, p_source, 'running', p_context)
    returning id into v_run_id;

    v_had_failure := false;
    for v_action in select * from jsonb_array_elements(coalesce(v_automation.actions, '[]'::jsonb)) loop
      perform public.fn_run_automation_action(p_workspace_id, v_run_id, v_action, p_context);
    end loop;

    v_had_failure := exists (select 1 from public.automation_action_logs where run_id = v_run_id and status = 'failed');

    update public.automation_runs
    set status = case when v_had_failure then 'failed' else 'success' end, finished_at = now()
    where id = v_run_id;

    update public.automations
    set run_count = run_count + 1,
        success_count = success_count + (case when v_had_failure then 0 else 1 end),
        failure_count = failure_count + (case when v_had_failure then 1 else 0 end),
        last_run_at = now(),
        last_run_status = case when v_had_failure then 'failed' else 'success' end
    where id = v_automation.id;
  end loop;
end;
$$ language plpgsql;

-- ============================================================
-- Event-driven dispatch: one small trigger function per watched table,
-- attached AFTER INSERT/UPDATE. Each builds a context jsonb and fans out to
-- every active automation, once per workspace, guarded so a workspace with
-- no active automations for that trigger does nothing.
-- ============================================================
create or replace function public.fn_trg_community_members_automations()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform public.fn_run_automations_for_event(new.workspace_id, 'member.joined', jsonb_build_object(
      'entity_type', 'member', 'entity_id', new.id, 'community_id', new.community_id,
      'role', new.role, 'lifecycle_stage', new.lifecycle_stage, 'display_name', new.display_name
    ));
  elsif tg_op = 'UPDATE' then
    if new.lifecycle_stage = 'at_risk' and old.lifecycle_stage is distinct from 'at_risk' then
      perform public.fn_run_automations_for_event(new.workspace_id, 'member.became_at_risk', jsonb_build_object(
        'entity_type', 'member', 'entity_id', new.id, 'community_id', new.community_id, 'display_name', new.display_name
      ));
    end if;
    if new.role = 'ambassador' and old.role is distinct from 'ambassador' then
      perform public.fn_run_automations_for_event(new.workspace_id, 'member.became_ambassador', jsonb_build_object(
        'entity_type', 'member', 'entity_id', new.id, 'community_id', new.community_id, 'display_name', new.display_name
      ));
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_community_members_automations on public.community_members;
create trigger trg_community_members_automations after insert or update on public.community_members
  for each row execute function public.fn_trg_community_members_automations();

create or replace function public.fn_trg_moderation_reports_automations()
returns trigger as $$
begin
  perform public.fn_run_automations_for_event(new.workspace_id, 'moderation.report_created', jsonb_build_object(
    'entity_type', 'moderation_report', 'entity_id', new.id, 'community_id', new.community_id,
    'severity', new.severity, 'reason', new.reason
  ));
  if new.severity = 'critical' then
    perform public.fn_run_automations_for_event(new.workspace_id, 'moderation.critical_report', jsonb_build_object(
      'entity_type', 'moderation_report', 'entity_id', new.id, 'community_id', new.community_id,
      'severity', new.severity, 'reason', new.reason
    ));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_moderation_reports_automations on public.community_moderation_reports;
create trigger trg_moderation_reports_automations after insert on public.community_moderation_reports
  for each row execute function public.fn_trg_moderation_reports_automations();

create or replace function public.fn_trg_community_events_automations()
returns trigger as $$
begin
  perform public.fn_run_automations_for_event(new.workspace_id, 'event.scheduled', jsonb_build_object(
    'entity_type', 'event', 'entity_id', new.id, 'community_id', new.community_id,
    'title', new.title, 'type', new.type, 'starts_at', new.starts_at
  ));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_community_events_automations on public.community_events;
create trigger trg_community_events_automations after insert on public.community_events
  for each row execute function public.fn_trg_community_events_automations();

create or replace function public.fn_trg_community_rewards_automations()
returns trigger as $$
begin
  perform public.fn_run_automations_for_event(new.workspace_id, 'reward.pending', jsonb_build_object(
    'entity_type', 'reward', 'entity_id', new.id, 'reward_description', new.reward_description
  ));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_community_rewards_automations on public.community_rewards;
create trigger trg_community_rewards_automations after insert on public.community_rewards
  for each row execute function public.fn_trg_community_rewards_automations();

-- ============================================================
-- Scheduled sweep: evaluated by pg_cron every 30 minutes. Handles
-- `event.starting_soon`, `reward.pending_stale` and `schedule.daily` —
-- idempotent via automation_fired_entities so re-running the sweep never
-- double-fires the same reminder.
-- ============================================================
create or replace function public.fn_run_scheduled_automations()
returns void as $$
declare
  v_automation record;
  v_event record;
  v_reward record;
begin
  -- event.starting_soon
  for v_automation in select * from public.automations where status = 'active' and trigger_key = 'event.starting_soon' loop
    for v_event in
      select e.* from public.community_events e
      where e.workspace_id = v_automation.workspace_id
        and e.status <> 'cancelled'
        and e.starts_at between now() and now() + make_interval(hours => coalesce((v_automation.trigger_config->>'hours_before')::numeric, 24))
        and not exists (select 1 from public.automation_fired_entities f where f.automation_id = v_automation.id and f.entity_id = e.id)
    loop
      insert into public.automation_fired_entities (automation_id, entity_id) values (v_automation.id, v_event.id)
        on conflict do nothing;
      perform public.fn_run_automations_for_event(v_automation.workspace_id, 'event.starting_soon', jsonb_build_object(
        'entity_type', 'event', 'entity_id', v_event.id, 'community_id', v_event.community_id,
        'title', v_event.title, 'starts_at', v_event.starts_at
      ), 'schedule');
    end loop;
  end loop;

  -- reward.pending_stale
  for v_automation in select * from public.automations where status = 'active' and trigger_key = 'reward.pending_stale' loop
    for v_reward in
      select r.* from public.community_rewards r
      where r.workspace_id = v_automation.workspace_id
        and r.status = 'pending'
        and r.created_at <= now() - make_interval(days => coalesce((v_automation.trigger_config->>'days')::numeric, 3))
        and not exists (select 1 from public.automation_fired_entities f where f.automation_id = v_automation.id and f.entity_id = r.id)
    loop
      insert into public.automation_fired_entities (automation_id, entity_id) values (v_automation.id, v_reward.id)
        on conflict do nothing;
      perform public.fn_run_automations_for_event(v_automation.workspace_id, 'reward.pending_stale', jsonb_build_object(
        'entity_type', 'reward', 'entity_id', v_reward.id, 'reward_description', v_reward.reward_description
      ), 'schedule');
    end loop;
  end loop;

  -- schedule.daily — fires at most once per automation per calendar day,
  -- using the automation's own id as a synthetic "entity" for that day.
  for v_automation in select * from public.automations where status = 'active' and trigger_key = 'schedule.daily' loop
    if not exists (
      select 1 from public.automation_runs
      where automation_id = v_automation.id and trigger_source = 'schedule' and started_at::date = current_date
    ) then
      perform public.fn_run_automations_for_event(v_automation.workspace_id, 'schedule.daily', jsonb_build_object(
        'entity_type', 'schedule', 'entity_id', v_automation.id
      ), 'schedule');
    end if;
  end loop;
end;
$$ language plpgsql;

-- ============================================================
-- pg_cron schedule. If pg_cron is not enabled on this Supabase project the
-- extension/schedule call fails and is caught, leaving event-driven
-- automations fully working — only the three schedule-based triggers above
-- depend on this job.
-- ============================================================
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron could not be enabled (%). Scheduled automations will not run until it is available.', sqlerrm;
end $$;

do $$
begin
  perform cron.unschedule('community-automations-sweep') where exists (
    select 1 from cron.job where jobname = 'community-automations-sweep'
  );
exception when others then null; end $$;

do $$
begin
  perform cron.schedule('community-automations-sweep', '*/30 * * * *', $cron$select public.fn_run_scheduled_automations();$cron$);
exception when others then
  raise notice 'pg_cron scheduling failed (%). Run public.fn_run_scheduled_automations() manually or via an external scheduler instead.', sqlerrm;
end $$;

-- ============================================================
-- Expose the manual-run entry point to PostgREST/RPC so the "Run now" UI
-- action (src/app/app/automations/actions.ts::runAutomationManually) can
-- call it as an authenticated user. Every write it performs is still
-- checked against RLS using that caller's own privileges.
-- ============================================================
grant execute on function public.fn_run_automations_for_event(uuid, text, jsonb, text) to authenticated;
grant execute on function public.fn_run_automations_for_event(uuid, text, jsonb, text) to service_role;
