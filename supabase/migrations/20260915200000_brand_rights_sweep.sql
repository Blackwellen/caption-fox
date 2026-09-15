-- ============================================================================
-- Brand & Assets — daily rights sweep (scheduled with pg_cron)
--
-- Licence status must follow the calendar, not whoever last edited the row.
-- This job runs outside any browser request (the spec forbids expensive scans
-- in page loads) and is idempotent: running it twice changes nothing.
--
--   * active / renewal_pending past expiry            -> expired
--   * active within 30 days of expiry                 -> expiring_soon
--   * linked assets follow: expired / expiring_soon, unless another live
--     licence still covers the asset
--   * newly expired licence with an asset             -> open expired_licence conflict
--   * licence within 90 days of expiry, no open task  -> pending renewal task
--   * one unresolved "rights expiring" alert per workspace, kept current
--
-- Only the scheduler (postgres role) may execute it.
-- ============================================================================

create or replace function public.brand_rights_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_today   date := (now() at time zone 'Europe/London')::date;
  v_expired int := 0;
  v_soon    int := 0;
  v_renew   int := 0;
begin
  -- 1. Expire licences whose end date has passed.
  with moved as (
    update public.rights_licenses
       set status = 'expired', risk_level = 'high', updated_at = now()
     where archived_at is null
       and expires_on is not null and expires_on < v_today
       and status in ('active', 'expiring_soon', 'renewal_pending')
    returning id, workspace_id, asset_id, name
  ), conflicts as (
    insert into public.rights_conflicts (workspace_id, asset_id, license_id, conflict_type, severity, detail)
    select m.workspace_id, m.asset_id, m.id, 'expired_licence', 'high',
           'Licence expired on ' || to_char(v_today - 1, 'DD Mon YYYY') || '; renew it or stop using the asset.'
      from moved m
     where m.asset_id is not null
       and not exists (select 1 from public.rights_conflicts c
                        where c.license_id = m.id and c.conflict_type = 'expired_licence' and c.resolved_at is null)
    returning 1
  ), acts as (
    insert into public.brand_activity (workspace_id, entity_type, entity_id, action, summary, metadata)
    select m.workspace_id, 'license', m.id, 'expired', 'Licence expired: ' || m.name, jsonb_build_object('detail', 'Marked expired by the daily rights sweep')
      from moved m
    returning 1
  )
  select count(*) into v_expired from moved;

  -- 2. Flag licences entering their final 30 days.
  update public.rights_licenses
     set status = 'expiring_soon', risk_level = case when risk_level = 'low' then 'medium' else risk_level end, updated_at = now()
   where archived_at is null
     and status = 'active'
     and expires_on between v_today and v_today + 30;
  get diagnostics v_soon = row_count;

  -- 3. Assets follow their best live licence.
  update public.media_assets m
     set rights_state = 'expired', updated_at = now()
   where m.archived_at is null
     and m.rights_state not in ('expired', 'restricted')
     and exists (select 1 from public.rights_licenses l where l.asset_id = m.id and l.status = 'expired')
     and not exists (select 1 from public.rights_licenses l where l.asset_id = m.id and l.status in ('active', 'expiring_soon'));

  update public.media_assets m
     set rights_state = 'expiring_soon', updated_at = now()
   where m.archived_at is null
     and m.rights_state in ('licensed', 'all_media', 'public_use')
     and exists (select 1 from public.rights_licenses l where l.asset_id = m.id and l.status = 'expiring_soon')
     and not exists (select 1 from public.rights_licenses l where l.asset_id = m.id and l.status = 'active');

  -- 4. Renewal tasks for anything within 90 days that has none open.
  insert into public.rights_renewals (workspace_id, license_id, due_on, status, assigned_to)
  select l.workspace_id, l.id, greatest(v_today, l.expires_on - 30), 'pending', l.owner_id
    from public.rights_licenses l
   where l.archived_at is null
     and l.status in ('active', 'expiring_soon')
     and l.expires_on between v_today and v_today + 90
     and not exists (select 1 from public.rights_renewals r where r.license_id = l.id and r.status in ('pending', 'in_progress'));
  get diagnostics v_renew = row_count;

  -- 5. One current "rights expiring" alert per workspace.
  update public.brand_alerts a
     set title = s.n || ' licence' || case when s.n = 1 then '' else 's' end || ' expiring soon',
         body = 'Review and renew to avoid disruption.', severity = 'critical'
    from (select workspace_id, count(*) n from public.rights_licenses
           where archived_at is null and status = 'expiring_soon' group by workspace_id) s
   where a.workspace_id = s.workspace_id and a.alert_type = 'rights_expiring' and a.resolved_at is null;

  insert into public.brand_alerts (workspace_id, alert_type, severity, title, body)
  select s.workspace_id, 'rights_expiring', 'critical',
         s.n || ' licence' || case when s.n = 1 then '' else 's' end || ' expiring soon', 'Review and renew to avoid disruption.'
    from (select workspace_id, count(*) n from public.rights_licenses
           where archived_at is null and status = 'expiring_soon' group by workspace_id) s
   where not exists (select 1 from public.brand_alerts a where a.workspace_id = s.workspace_id and a.alert_type = 'rights_expiring' and a.resolved_at is null);

  -- Resolve the alert where nothing is expiring any more.
  update public.brand_alerts a
     set resolved_at = now()
   where a.alert_type = 'rights_expiring' and a.resolved_at is null
     and not exists (select 1 from public.rights_licenses l
                      where l.workspace_id = a.workspace_id and l.archived_at is null and l.status = 'expiring_soon');

  return jsonb_build_object('expired', v_expired, 'expiring_soon', v_soon, 'renewals_created', v_renew, 'ran_on', v_today);
end
$fn$;

revoke all on function public.brand_rights_sweep() from public, anon, authenticated;

-- Schedule daily at 02:15 UTC; re-running this migration replaces the job.
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'brand-rights-sweep';
    perform cron.schedule('brand-rights-sweep', '15 2 * * *', 'select public.brand_rights_sweep()');
  else
    raise notice 'pg_cron not installed; schedule public.brand_rights_sweep() manually';
  end if;
end
$cron$;
