-- ============================================================
-- Caption Fox — Automations demo seed
--
-- Installs a handful of the curated templates as real, active automations
-- for the demo workspace (is_demo = true), plus a short run history so the
-- Automations pages render populated on first visit. New live automations
-- created from here on will fire for real via the triggers/cron installed
-- in 20260901200000_automations_module.sql — this seed only backfills a
-- little history so the Logs panel isn't empty on day one.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_automations_module.sql
-- Idempotent: guarded by `where not exists` on automation name per workspace.
-- ============================================================

do $$
declare
  v_workspace_id uuid;
  v_automation_welcome uuid;
  v_automation_critical uuid;
  v_automation_event uuid;
  v_run_id uuid;
begin
  select id into v_workspace_id from public.workspaces where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_workspace_id is null then
    raise notice 'Demo workspace not found — skipping Automations seed.';
    return;
  end if;

  insert into public.automations (workspace_id, name, description, status, trigger_key, conditions, actions, source_template_key, is_demo, run_count, success_count, last_run_at, last_run_status)
  select v_workspace_id, t.name, t.description, 'active', t.trigger_key, t.default_conditions, t.default_actions, t.key, true, 12, 12, now() - interval '2 hours', 'success'
  from public.automation_templates t where t.key = 'welcome_new_member'
  and not exists (select 1 from public.automations where workspace_id = v_workspace_id and source_template_key = 'welcome_new_member')
  returning id into v_automation_welcome;

  insert into public.automations (workspace_id, name, description, status, trigger_key, conditions, actions, source_template_key, is_demo, run_count, success_count, last_run_at, last_run_status)
  select v_workspace_id, t.name, t.description, 'active', t.trigger_key, t.default_conditions, t.default_actions, t.key, true, 3, 3, now() - interval '15 minutes', 'success'
  from public.automation_templates t where t.key = 'critical_report_escalation'
  and not exists (select 1 from public.automations where workspace_id = v_workspace_id and source_template_key = 'critical_report_escalation')
  returning id into v_automation_critical;

  insert into public.automations (workspace_id, name, description, status, trigger_key, conditions, actions, source_template_key, is_demo, run_count, success_count, last_run_at, last_run_status)
  select v_workspace_id, t.name, t.description, 'active', t.trigger_key, t.default_conditions, t.default_actions, t.key, true, 6, 6, now() - interval '1 day', 'success'
  from public.automation_templates t where t.key = 'new_event_log'
  and not exists (select 1 from public.automations where workspace_id = v_workspace_id and source_template_key = 'new_event_log')
  returning id into v_automation_event;

  insert into public.automations (workspace_id, name, description, status, trigger_key, conditions, actions, source_template_key, is_demo)
  select v_workspace_id, t.name, t.description, 'draft', t.trigger_key, t.default_conditions, t.default_actions, t.key, true
  from public.automation_templates t where t.key = 'at_risk_followup'
  and not exists (select 1 from public.automations where workspace_id = v_workspace_id and source_template_key = 'at_risk_followup');

  select id into v_automation_welcome from public.automations where workspace_id = v_workspace_id and source_template_key = 'welcome_new_member';
  select id into v_automation_critical from public.automations where workspace_id = v_workspace_id and source_template_key = 'critical_report_escalation';
  select id into v_automation_event from public.automations where workspace_id = v_workspace_id and source_template_key = 'new_event_log';

  -- A short backfilled run history for the "welcome new member" automation.
  if v_automation_welcome is not null and not exists (select 1 from public.automation_runs where automation_id = v_automation_welcome) then
    for i in 1..5 loop
      insert into public.automation_runs (workspace_id, automation_id, trigger_source, status, context, started_at, finished_at)
      values (v_workspace_id, v_automation_welcome, 'event', 'success', '{"entity_type":"member"}'::jsonb, now() - (i || ' hours')::interval, now() - (i || ' hours')::interval + interval '2 seconds')
      returning id into v_run_id;
      insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
      values (v_workspace_id, v_run_id, 'log_activity', 'success', 'Activity note logged');
    end loop;
  end if;

  if v_automation_critical is not null and not exists (select 1 from public.automation_runs where automation_id = v_automation_critical) then
    insert into public.automation_runs (workspace_id, automation_id, trigger_source, status, context, started_at, finished_at)
    values (v_workspace_id, v_automation_critical, 'event', 'success', '{"entity_type":"moderation_report"}'::jsonb, now() - interval '15 minutes', now() - interval '15 minutes' + interval '1 second')
    returning id into v_run_id;
    insert into public.automation_action_logs (workspace_id, run_id, action_key, status, message)
    values (v_workspace_id, v_run_id, 'escalate_report', 'success', 'Report escalated');
    insert into public.automation_notifications (workspace_id, automation_id, run_id, title, message, link)
    values (v_workspace_id, v_automation_critical, v_run_id, 'Critical moderation report', 'A critical-severity report needs urgent review.', '/app/community/moderation');
  end if;

end $$;
