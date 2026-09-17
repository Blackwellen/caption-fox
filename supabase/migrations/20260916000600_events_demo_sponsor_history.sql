-- Events demo: contracted sponsorship history.
--
-- The v2 seed only signed contracts in the last ~60 days, so the Sponsorship
-- Revenue chart (monthly, this year vs last year) was a single spike. This adds
-- completed sponsorships across earlier months of this year and the whole of
-- last year so the trend reads like a real book of business.
--
-- Every row is signed more than 60 days ago and has stage 'completed', so the
-- 30-day KPI windows (revenue now / previous), Active Sponsors, Pipeline,
-- Deliverables Due and Renewals are all unchanged.
--
-- Idempotent: guarded on its own marker; no-op for an unprovisioned workspace.

do $$
declare
  v_ws uuid;
  v_owner uuid;
  v_sponsors uuid[];
  v_count int;
  m int;
  k int;
  v_signed timestamptz;
  v_value numeric;
  v_tiers text[] := array['silver','gold','gold','platinum','premier'];
begin
  select id into v_ws from public.workspaces where slug = 'jamahl-thomas-campaign-manager-demo';
  if v_ws is null then return; end if;

  if exists (
    select 1 from public.sponsorships
    where workspace_id = v_ws and notes = 'demo:sponsor-history'
  ) then return; end if;

  select array_agg(id order by name) into v_sponsors from public.sponsors where workspace_id = v_ws;
  if v_sponsors is null or array_length(v_sponsors, 1) = 0 then return; end if;
  v_count := array_length(v_sponsors, 1);

  select owner_id into v_owner from public.sponsorships where workspace_id = v_ws and owner_id is not null limit 1;

  -- Months back from the start of the current month: 3..20 (never inside the
  -- 60-day KPI windows). Value grows towards the present, so this year sits
  -- above last year the way a growing programme would.
  for m in 3..20 loop
    for k in 1..(2 + (m % 2)) loop
      v_signed := date_trunc('month', now()) - make_interval(months => m)
                  + make_interval(days => 3 + (k * 7) % 24, hours => 10);
      v_value := round(((150000 - m * 5200) + (abs(hashtext(m::text || ':' || k)) % 45000)) / 1000.0) * 1000;

      insert into public.sponsorships (
        workspace_id, sponsor_id, tier, value, currency, stage, status,
        proposal_sent_at, contract_signed_at, activation_start_at, activation_end_at,
        payment_status, paid_at, owner_id, notes, is_demo, created_at, updated_at
      ) values (
        v_ws,
        v_sponsors[1 + ((m * 3 + k) % v_count)],
        v_tiers[1 + ((m + k) % 5)],
        greatest(v_value, 12000),
        'GBP',
        'completed',
        'completed',
        v_signed - interval '21 days',
        v_signed,
        v_signed + interval '14 days',
        v_signed + interval '45 days',
        'paid',
        v_signed + interval '30 days',
        v_owner,
        'demo:sponsor-history',
        true,
        v_signed - interval '30 days',
        v_signed + interval '45 days'
      );
    end loop;
  end loop;
end $$;
