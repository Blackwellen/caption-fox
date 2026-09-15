-- ============================================================
-- Partnerships — deterministic demo seed.
--
-- Everything written here is flagged is_demo = true so the UI can label it
-- clearly as demo data. Idempotent: safe to re-run. Real customer data is
-- never touched — the function only inserts rows it owns for the given
-- workspace and only when that workspace has no non-demo programme yet.
-- ============================================================

create or replace function public.seed_partnerships_demo(p_workspace_id uuid, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_programme_id uuid;
  v_partner_id uuid;
  v_tier_id uuid;
  v_conversion_id uuid;
  v_day date;
  v_i integer;
  v_seed numeric;

  v_programmes jsonb := '[
    {"type":"affiliate","name":"Creator Affiliate Program","category":"Electronics","rate":15,"partners":[
      {"name":"Tech Gear Hub","handle":"@techgearhub","platforms":["instagram","web"],"tier":"Gold","status":"active","conversions":2145,"revenue":184320},
      {"name":"Deal Hunter Collective","handle":"deal-hunter.com","platforms":["web","email"],"tier":"Silver","status":"active","conversions":2876,"revenue":198450},
      {"name":"Laptop Lab","handle":"laptoplab.io","platforms":["web"],"tier":"Gold","status":"active","conversions":2452,"revenue":215300},
      {"name":"Travel Blogger Pro","handle":"@travelbloggerpro","platforms":["instagram","tiktok"],"tier":"Bronze","status":"at_risk","conversions":2118,"revenue":112780},
      {"name":"Wellness Mama","handle":"wellnessmama.blog","platforms":["web","email"],"tier":"Silver","status":"active","conversions":1842,"revenue":98430},
      {"name":"Gadget Guide","handle":"@gadgetguide","platforms":["youtube"],"tier":"Gold","status":"active","conversions":1726,"revenue":142560}
    ]},
    {"type":"referral","name":"Customer Referral Club","category":"Referral","rate":10,"partners":[
      {"name":"Design Lovers Co.","handle":"design-lovers.com","platforms":["web"],"tier":"Gold","status":"active","conversions":1245,"revenue":124560},
      {"name":"Healthy Living Blog","handle":"healthyliving.blog","platforms":["web","email"],"tier":"Silver","status":"active","conversions":612,"revenue":72120},
      {"name":"Fitness First","handle":"@fitnessfirst","platforms":["instagram"],"tier":"Bronze","status":"at_risk","conversions":486,"revenue":36780},
      {"name":"Creative Pro Studio","handle":"creativepro.studio","platforms":["web"],"tier":"Bronze","status":"active","conversions":389,"revenue":21420}
    ]},
    {"type":"ambassador","name":"Brand Ambassador Circle","category":"Lifestyle","rate":18,"partners":[
      {"name":"@fit.james","handle":"@fit.james","platforms":["instagram","tiktok","youtube"],"tier":"Gold","status":"active","conversions":1842,"revenue":176980},
      {"name":"@glow.with.sophie","handle":"@glow.with.sophie","platforms":["instagram","tiktok"],"tier":"Gold","status":"active","conversions":1632,"revenue":33120},
      {"name":"@noahcreates","handle":"@noahcreates","platforms":["youtube","instagram","x"],"tier":"Silver","status":"active","conversions":1298,"revenue":27350},
      {"name":"@liam.luxury","handle":"@liam.luxury","platforms":["instagram","x"],"tier":"Gold","status":"active","conversions":1156,"revenue":24680},
      {"name":"@wellness.with.ava","handle":"@wellness.with.ava","platforms":["tiktok","instagram"],"tier":"Bronze","status":"at_risk","conversions":986,"revenue":18420},
      {"name":"@design.by.liam","handle":"@design.by.liam","platforms":["instagram"],"tier":"Silver","status":"active","conversions":874,"revenue":15840}
    ]},
    {"type":"loyalty","name":"VIP Loyalty Rewards","category":"Loyalty","rate":5,"partners":[
      {"name":"Travel With Us","handle":"travelwithus.com","platforms":["web"],"tier":"Platinum","status":"active","conversions":28450,"revenue":512340},
      {"name":"Gold Member Club","handle":"goldmemberclub.com","platforms":["web"],"tier":"Gold","status":"active","conversions":34120,"revenue":645280},
      {"name":"Insider Rewards","handle":"insiderrewards.com","platforms":["web"],"tier":"Silver","status":"active","conversions":22310,"revenue":482880},
      {"name":"Points Booster","handle":"pointsbooster.app","platforms":["web"],"tier":"Bronze","status":"at_risk","conversions":15680,"revenue":186420}
    ]},
    {"type":"reseller","name":"Enterprise Reseller Network","category":"Reseller","rate":12,"partners":[
      {"name":"GlobalTech Solutions","handle":"North America","platforms":[],"tier":"Gold","status":"active","conversions":128,"revenue":3920000,"region":"North America"},
      {"name":"Acme Systems Inc.","handle":"North America","platforms":[],"tier":"Gold","status":"active","conversions":97,"revenue":2810000,"region":"North America"},
      {"name":"DataCore Systems","handle":"EMEA","platforms":[],"tier":"Silver","status":"active","conversions":64,"revenue":1680000,"region":"EMEA"},
      {"name":"Nexus Advantage","handle":"EMEA","platforms":[],"tier":"Silver","status":"at_risk","conversions":53,"revenue":1240000,"region":"EMEA"},
      {"name":"CloudWorks","handle":"APAC","platforms":[],"tier":"Silver","status":"active","conversions":48,"revenue":1120000,"region":"APAC"},
      {"name":"TechBridge LLC","handle":"Latin America","platforms":[],"tier":"Bronze","status":"active","conversions":42,"revenue":876000,"region":"Latin America"}
    ]},
    {"type":"co_marketing","name":"Scaling Growth Together","category":"Webinar Series","rate":0,"partners":[
      {"name":"Tech Gear Hub","handle":"Webinar Growth Alliance","platforms":["web"],"tier":"Gold","status":"active","conversions":1482,"revenue":248760},
      {"name":"Design Lovers Co.","handle":"Partner Content Exchange","platforms":["web"],"tier":"Silver","status":"active","conversions":987,"revenue":153620},
      {"name":"Wanderlust Media","handle":"Creator x Brand Collaboration","platforms":["instagram","tiktok"],"tier":"Gold","status":"active","conversions":1134,"revenue":172890},
      {"name":"Travel With Us","handle":"Influencer Boost Q2","platforms":["instagram"],"tier":"Bronze","status":"at_risk","conversions":826,"revenue":128450}
    ]}
  ]';
  v_programme jsonb;
  v_partner jsonb;
begin
  if p_workspace_id is null then return; end if;

  select id into v_existing from public.partnership_programmes where workspace_id = p_workspace_id limit 1;
  if v_existing is not null then return; end if;

  for v_programme in select * from jsonb_array_elements(v_programmes) loop
    insert into public.partnership_programmes (
      workspace_id, name, programme_type, category, description, status, owner_id,
      commission_type, commission_rate, currency, tracking_window_days, start_date, channels, created_by, is_demo
    ) values (
      p_workspace_id, v_programme->>'name', v_programme->>'type', v_programme->>'category',
      'Demo programme seeded for release evaluation.', 'active', p_user_id,
      case when v_programme->>'type' = 'reseller' then 'revenue_share' else 'percentage' end,
      (v_programme->>'rate')::numeric, 'GBP', 30, current_date - interval '120 days', '{}', p_user_id, true
    ) returning id into v_programme_id;

    insert into public.partnership_tiers (workspace_id, programme_id, name, rank, threshold, commission_rate)
    values
      (p_workspace_id, v_programme_id, 'Bronze', 1, 0, (v_programme->>'rate')::numeric),
      (p_workspace_id, v_programme_id, 'Silver', 2, 50000, (v_programme->>'rate')::numeric + 2),
      (p_workspace_id, v_programme_id, 'Gold', 3, 150000, (v_programme->>'rate')::numeric + 5),
      (p_workspace_id, v_programme_id, 'Platinum', 4, 400000, (v_programme->>'rate')::numeric + 8);

    for v_partner in select * from jsonb_array_elements(v_programme->'partners') loop
      select id into v_tier_id from public.partnership_tiers where programme_id = v_programme_id and name = coalesce(v_partner->>'tier', 'Bronze');

      insert into public.partnership_partners (
        workspace_id, programme_id, partner_type, name, handle, owner_id, tier_id, status,
        platforms, region, health, joined_at, approved_at, last_activity_at, created_by, is_demo
      ) values (
        p_workspace_id, v_programme_id,
        case v_programme->>'type'
          when 'referral' then 'referral_advocate' when 'loyalty' then 'loyalty_member'
          when 'co_marketing' then 'co_marketing_partner' else v_programme->>'type' end,
        v_partner->>'name', v_partner->>'handle', p_user_id, v_tier_id,
        coalesce(v_partner->>'status', 'active'),
        (select coalesce(array_agg(value::text), '{}') from jsonb_array_elements_text(coalesce(v_partner->'platforms', '[]'::jsonb))),
        v_partner->>'region',
        case when v_partner->>'status' = 'at_risk' then 'at_risk' else 'healthy' end,
        now() - interval '90 days', now() - interval '90 days',
        now() - (floor(random() * 6)::text || ' hours')::interval,
        p_user_id, true
      ) returning id into v_partner_id;

      -- Spread each partner's seeded conversions/revenue across the last 30 days.
      for v_i in 1..6 loop
        insert into public.partnership_conversions (workspace_id, programme_id, partner_id, conversion_type, value, currency, status, converted_at)
        values (
          p_workspace_id, v_programme_id, v_partner_id,
          case v_programme->>'type' when 'reseller' then 'deal' when 'loyalty' then 'reward_action' when 'co_marketing' then 'lead' else 'sale' end,
          round((coalesce((v_partner->>'revenue')::numeric, 0) / 6 * (0.7 + random() * 0.6))::numeric, 2),
          'GBP', 'valid', now() - (v_i * 5 || ' days')::interval
        ) returning id into v_conversion_id;

        insert into public.partnership_commissions (workspace_id, programme_id, partner_id, conversion_id, calculation_basis, rate, amount, currency, status, created_at)
        select p_workspace_id, v_programme_id, v_partner_id, v_conversion_id, 'percentage',
          (v_programme->>'rate')::numeric,
          round(c.value * ((v_programme->>'rate')::numeric / 100), 2), 'GBP',
          case when v_i <= 3 then 'paid' when v_i <= 5 then 'approved' else 'pending' end,
          c.converted_at
        from public.partnership_conversions c where c.id = v_conversion_id;
      end loop;

      -- One payout per partner covering the previous period.
      insert into public.partnership_payouts (workspace_id, programme_id, partner_id, period_start, period_end, currency, gross_amount, net_amount, status, paid_at, created_at)
      select p_workspace_id, v_programme_id, v_partner_id,
        (current_date - interval '60 days')::date, (current_date - interval '30 days')::date,
        'GBP', s.total, s.total,
        case when v_partner->>'status' = 'at_risk' then 'pending_review' else 'paid' end,
        case when v_partner->>'status' = 'at_risk' then null else now() - interval '20 days' end,
        now() - interval '25 days'
      from (select coalesce(sum(amount), 0) as total from public.partnership_commissions where partner_id = v_partner_id) s;

      -- Rewards for referral / loyalty partners.
      if v_programme->>'type' in ('referral', 'loyalty') then
        insert into public.partnership_rewards (workspace_id, programme_id, partner_id, reward_type, value, currency, status, issued_at, redeemed_at)
        values (p_workspace_id, v_programme_id, v_partner_id, 'cash',
          round(coalesce((v_partner->>'revenue')::numeric, 0) * 0.05, 2), 'GBP', 'redeemed',
          now() - interval '15 days', now() - interval '10 days');
      end if;

      -- Territory for resellers.
      if v_programme->>'type' = 'reseller' and v_partner->>'region' is not null then
        insert into public.partnership_territories (workspace_id, programme_id, partner_id, region, assigned_at)
        values (p_workspace_id, v_programme_id, v_partner_id, v_partner->>'region', now() - interval '90 days')
        on conflict do nothing;
      end if;

      -- Co-marketing contributions and leads.
      if v_programme->>'type' = 'co_marketing' then
        insert into public.co_marketing_contributions (workspace_id, programme_id, partner_id, category, our_contribution, partner_contribution, currency, status)
        values (p_workspace_id, v_programme_id, v_partner_id, 'content',
          round(coalesce((v_partner->>'revenue')::numeric, 0) * 0.08, 2),
          round(coalesce((v_partner->>'revenue')::numeric, 0) * 0.06, 2), 'GBP', 'approved');

        insert into public.co_marketing_leads (workspace_id, programme_id, partner_id, lead_name, lead_email, source, qualified)
        select p_workspace_id, v_programme_id, v_partner_id,
          'Lead ' || g, 'lead' || g || '@example.com', 'co_marketing', (g % 3 <> 0)
        from generate_series(1, 5) g;
      end if;
    end loop;

    -- A couple of pending applications per programme so the review queue has content.
    insert into public.partnership_applications (workspace_id, programme_id, applicant_name, applicant_email, status, submitted_at)
    values
      (p_workspace_id, v_programme_id, 'New Applicant — ' || (v_programme->>'name'), 'applicant@example.com', 'pending', now() - interval '2 days'),
      (p_workspace_id, v_programme_id, 'Second Applicant — ' || (v_programme->>'name'), 'applicant2@example.com', 'in_review', now() - interval '5 days');

    -- 30 days of daily metrics for the trend chart, biased toward this
    -- programme type's primary/secondary metric shape.
    for v_i in 0..29 loop
      v_day := current_date - v_i;
      v_seed := (hashtext(v_programme_id::text || v_day::text) % 1000)::numeric / 1000;
      insert into public.partnership_metrics_daily (workspace_id, programme_id, programme_type, metric_date, primary_count, secondary_count, revenue, spend)
      values (
        p_workspace_id, v_programme_id, v_programme->>'type', v_day,
        round(200 + v_seed * 800)::int,
        round(20 + v_seed * 120)::int,
        round((500 + v_seed * 4000)::numeric, 2),
        round((v_seed * 800)::numeric, 2)
      )
      on conflict (workspace_id, programme_id, metric_date) do nothing;
    end loop;

    -- Activity feed entries.
    insert into public.partnership_activity (workspace_id, actor_id, entity_type, entity_id, action, summary, surface, created_at)
    values
      (p_workspace_id, p_user_id, 'programme', v_programme_id, 'created', (v_programme->>'name') || ' programme created', 'partnerships', now() - interval '90 days'),
      (p_workspace_id, p_user_id, 'commission', v_programme_id, 'paid', 'Commission payout processed for ' || (v_programme->>'name'), 'partnerships', now() - interval '20 days');
  end loop;
end;
$$;
