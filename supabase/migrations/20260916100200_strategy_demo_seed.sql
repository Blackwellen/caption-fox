-- ============================================================
-- Strategy — realistic demo workspace data.
--
-- Seeds the Business, Brand and Agency demo workspaces with a working
-- strategy portfolio: 8 strategies, 18 objectives, 42 audiences, 142 research
-- items, 5 positioning frameworks, 12 plans, 3 forecasts, approvals, next
-- actions, insights, KPI history and an activity trail.
--
-- * Every top-level row is is_demo = true and workspace-scoped.
-- * Dates are relative to the day the seed runs, so the workspace reads as
--   current rather than frozen in the past.
-- * Owners are the workspace's real teammates; brand/competitor names are
--   fictional. No production workspace is touched (demo slugs only).
-- * Idempotent: a workspace that already has demo objectives is skipped.
-- ============================================================

create or replace function public.strategy_seed_demo(p_ws uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_admin uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid;
  people uuid[];
  q0 date := date_trunc('quarter', current_date)::date;
  q_end date := (date_trunc('quarter', current_date) + interval '3 months - 1 day')::date;
  m0 date := date_trunc('month', current_date)::date;
  fy0 date := date_trunc('year', current_date)::date;
  s uuid[] := '{}'; ob uuid[] := '{}'; au uuid[] := '{}'; pl uuid[] := '{}';
  rs uuid[] := '{}'; col uuid[] := '{}'; fw uuid[] := '{}';
  comp uuid[] := '{}'; attr uuid[] := '{}'; sc uuid[] := '{}';
  v_id uuid; v_fc uuid; v_parent uuid; v_appr uuid;
  i int; j int; n int;
  v_status text; v_val numeric; v_tgt numeric;
  avatars text[];
begin
  select owner_id into v_owner from workspaces where id = p_ws;
  if v_owner is null then return; end if;
  if exists (select 1 from strategy_objectives where workspace_id = p_ws and is_demo) then return; end if;

  select m.user_id into o1 from workspace_members m join profiles p on p.id = m.user_id where m.workspace_id = p_ws and p.full_name = 'Emma Davis' limit 1;
  select m.user_id into o2 from workspace_members m join profiles p on p.id = m.user_id where m.workspace_id = p_ws and p.full_name = 'Liam Chen' limit 1;
  select m.user_id into o3 from workspace_members m join profiles p on p.id = m.user_id where m.workspace_id = p_ws and p.full_name = 'Sophia Patel' limit 1;
  select m.user_id into o4 from workspace_members m join profiles p on p.id = m.user_id where m.workspace_id = p_ws and p.full_name = 'Noah Williams' limit 1;
  select m.user_id into v_admin from workspace_members m join profiles p on p.id = m.user_id where m.workspace_id = p_ws and p.full_name = 'Jason Ranti' limit 1;
  o1 := coalesce(o1, v_owner); o2 := coalesce(o2, v_owner); o3 := coalesce(o3, v_owner); o4 := coalesce(o4, v_owner);
  v_admin := coalesce(v_admin, v_owner);
  people := array[o1, o2, o3, o4];
  select array_agg(p.avatar_url order by p.full_name) into avatars
  from workspace_members m join profiles p on p.id = m.user_id
  where m.workspace_id = p_ws and p.avatar_url like 'https://%';
  avatars := coalesce(avatars, array[]::text[]);

  -- ============================================================ strategies
  for i in 1..10 loop
    insert into strategy_records (workspace_id, name, description, status, health_score, owner_id, start_date, end_date, created_by, is_demo, created_at)
    values (p_ws,
      (array['Growth Accelerator','Brand Differentiation','Revenue Growth','Audience Expansion','Customer Retention Engine',
             'Market Leadership','Content Excellence','Efficiency Programme','Brand Launch Refresh','Seasonal Retail Push'])[i],
      (array['Scale high-intent acquisition across priority segments.','Own a distinctive, defensible brand position.',
             'Grow recurring revenue from new and existing customers.','Reach and activate new audience segments.',
             'Increase lifetime value and reduce churn.','Lead the category conversation.',
             'Raise the quality bar for every content surface.','Do more with the same marketing budget.',
             'Relaunch the brand identity across channels.','Maximise the seasonal retail window.'])[i],
      case when i <= 8 then 'active' when i = 9 then 'completed' else 'paused' end,
      (array[82,76,71,68,64,79,73,70,90,55])[i], people[1 + (i % 4)],
      q0 - (i * 20), q_end + (i * 30), v_owner, true, now() - ((120 - i) || ' days')::interval)
    returning id into v_id;
    s := s || v_id;
  end loop;

  -- ============================================================ objectives
  -- name, type, owner idx, status, progress, confidence, priority, due offset (days from q_end), next action, target, strategy idx
  for i in 1..19 loop
    insert into strategy_objectives (workspace_id, strategy_id, name, description, objective_type, status, progress, confidence,
      priority, target_summary, next_action, owner_id, start_date, due_date, tags, created_by, is_demo, archived_at, created_at, updated_at)
    values (p_ws, s[(array[4,1,7,3,5,4,2,8,2,1,3,7,8,4,3,5,2,7,6])[i]],
      (array['Increase Brand Awareness','Grow Market Share in Key Segments','Improve Customer Engagement','Drive Revenue Growth',
             'Increase Customer Lifetime Value','Expand into New Markets','Enhance Brand Consideration','Optimize Marketing Efficiency',
             'Lead on Sustainable Packaging','Expand into Gen Z Market','Grow International Revenue','Strengthen Community Advocacy',
             'Reduce Customer Acquisition Cost','Grow Email Subscriber Base','Improve Creator Partnership ROI',
             'Refresh Brand Guidelines','Launch Loyalty Programme Pilot','Hit Social Share of Voice Target','Wind Down Legacy Print Campaigns'])[i],
      'Seeded demo objective — replace with your own strategic objective.',
      (array['awareness','growth','engagement','revenue','retention','growth','awareness','efficiency','growth','growth',
             'revenue','engagement','efficiency','growth','revenue','awareness','retention','awareness','efficiency'])[i],
      (array['on_track','at_risk','on_track','on_track','at_risk','on_track','at_risk','on_track','at_risk','on_track',
             'on_track','on_track','on_track','on_track','at_risk','completed','completed','completed','not_started'])[i],
      (array[68,52,75,82,45,60,40,70,52,68,75,64,58,71,38,100,100,100,10])[i],
      (array[82,61,80,86,58,76,55,78,50,79,81,72,70,77,48,95,92,94,40])[i],
      (array['urgent','high','high','urgent','high','medium','medium','medium','high','urgent','high','medium','medium','low','medium','low','medium','low','low'])[i],
      (array['Brand awareness from 60% to 70%','+8pp share in priority segments','Engagement rate to 6.5%','+£4.8M new revenue',
             'CLV up 15%','Launch in 3 new markets','Consideration to 45%','CPA down 12%','90% sustainable materials',
             '+20% Gen Z reach','£5M incremental revenue','2,000 active advocates','CAC below £38','+40k subscribers',
             'Creator ROI 3.5x','Guidelines v3 published','Pilot live in 2 regions','SOV at 24%','Print spend to zero'])[i],
      (array['Expand into Gen Z Market','Review Gen Z audience insights','Finalize Q3 media plan milestones',
             'Validate revenue forecast assumptions','Improve retention messaging','Conduct market opportunity research',
             'Update brand positioning','Implement media mix optimisation','Confirm packaging supplier',
             'Approve Gen Z creative concept','Localise launch content','Recruit advocate leads','Rebalance paid search bids',
             'Launch lead magnet','Renegotiate creator rates',null,null,null,'Cancel remaining print insertions'])[i],
      people[(array[1,2,3,4,1,3,2,4,3,1,2,4,2,3,1,4,3,2,4])[i]],
      q0 - 60,
      q_end + (array[0,15,46,62,77,91,107,123,-10,-5,40,70,30,55,25,-60,-40,-20,90])[i],
      array[(array['Brand Tracking','Market Research','Engagement','Revenue','Retention',
             'Expansion','Brand Tracking','Efficiency','Sustainability','Gen Z',
             'Expansion','Community','Efficiency','Email','Creators',
             'Brand','Loyalty','Social','Print'])[i]],
      v_owner, true,
      case when i = 19 then now() - interval '12 days' end,
      now() - ((100 - i * 3) || ' days')::interval,
      now() - ((array[2,5,26,2,72,3,8,4,6,1,30,48,20,36,10,50,40,20,12])[i] || ' hours')::interval)
    returning id into v_id;
    ob := ob || v_id;
  end loop;
  update strategy_objectives set status = 'archived' where id = ob[19];
  update strategy_objectives set completed_at = greatest(q0 + 12, current_date - 30)::timestamptz where id = ob[16];
  update strategy_objectives set completed_at = greatest(q0 + 20, current_date - 18)::timestamptz where id = ob[17];
  update strategy_objectives set completed_at = (current_date - 6)::timestamptz where id = ob[18];

  -- ============================================================ audiences
  for i in 1..42 loop
    insert into strategy_audiences (workspace_id, name, description, status, lifecycle_stage, audience_size, growth_rate,
      fit_score, data_completeness, channels, tags, source, owner_id, created_by, is_demo, created_at, updated_at)
    values (p_ws,
      case when i <= 6 then (array['Growth Consumers','Enterprise Decision Makers','Sustainable Shoppers','New Parents','Tech Enthusiasts','Budget Conscious'])[i]
           else (array['Urban Professionals','Fitness Seekers','Home Improvers','Frequent Travellers','Pet Owners','Students',
                       'Small Business Owners','Luxury Buyers','Gamers','Foodies','Remote Workers','Early Adopters',
                       'Retirees','First-time Buyers','Outdoor Enthusiasts','Creators & Influencers','Wellness Seekers','Fashion Forward'])[1 + ((i - 7) % 18)]
                || case when i > 24 then ' — ' || (array['UK','EU','North America','APAC','Lapsed','High Value'])[1 + (i % 6)] else '' end
      end,
      case when i <= 6 then (array['High-intent, value seekers','B2B leaders & strategists','Eco-conscious & brand loyal',
                                   'Family-focused & research-driven','Early adopters of connected tech','Price-led, promotion responsive'])[i]
           else 'Seeded demo segment built from first-party and CRM signals.' end,
      case when i <= 28 then 'active' when i <= 36 then 'draft' when i <= 41 then 'paused' else 'archived' end,
      case when i <= 6 then (array['consideration','decision','advocacy','awareness','consideration','retention'])[i]
           else (array['awareness','consideration','decision','retention','advocacy'])[1 + (i % 5)] end,
      case when i <= 6 then (array[2400000,1100000,3600000,1800000,950000,1300000])[i] else 80000 + ((i * 7919) % 900) * 1000 end,
      case when i <= 6 then (array[18,12,22,15,9,4])[i] else ((i * 37) % 250) / 10.0 - 3 end,
      case when i <= 6 then (array[92,88,84,76,72,61])[i] else 52 + ((i * 13) % 40) end,
      case when i <= 6 then (array[96,94,92,90,88,84])[i] when i % 9 = 0 then 55 else 78 + (i % 18) end,
      case i when 1 then array['facebook','instagram','google','email'] when 2 then array['linkedin','email','display','podcast']
             when 3 then array['instagram','facebook','search','email'] when 4 then array['facebook','instagram','pinterest','email']
             when 5 then array['youtube','x','search','podcast'] when 6 then array['facebook','email','search','display']
             else case i % 4 when 0 then array['instagram','tiktok'] when 1 then array['facebook','email']
                             when 2 then array['linkedin','search'] else array['youtube','instagram','email'] end end,
      array[(array['Consumer','B2B','Sustainability','Family','Tech','Value'])[1 + (i % 6)]],
      (array['manual','crm','import','manual'])[1 + (i % 4)], people[1 + (i % 4)], v_owner, true,
      now() - ((200 - i * 4) || ' days')::interval,
      now() - ((array[2,5,26,48,72,50])[1 + (i % 6)] || ' hours')::interval)
    returning id into v_id;
    au := au || v_id;
    update strategy_audiences set archived_at = now() - interval '9 days' where id = v_id and status = 'archived';

    -- personas (3–5 per audience; first 6 use teammate portraits)
    n := 3 + (i % 3);
    for j in 1..n loop
      insert into strategy_audience_personas (workspace_id, audience_id, name, summary, share_pct, avatar_url, sort_order)
      values (p_ws, v_id,
        (array['Value Maximiser','Busy Planner','Conscious Chooser','Research Lead','Deal Hunter','Trend Setter'])[1 + ((i + j) % 6)],
        'Seeded demo persona.', round((40.0 / j)::numeric, 2),
        case when coalesce(array_length(avatars, 1), 0) > 0 then avatars[1 + ((i + j) % array_length(avatars, 1))] end, j);
    end loop;

    -- regions (aggregated only)
    for j in 1..(case when i <= 6 then 6 else 2 + (i % 3) end) loop
      insert into strategy_audience_regions (workspace_id, audience_id, country_code, country_name, share_pct, audience_size)
      values (p_ws, v_id,
        (array['US','CA','GB','AU','DE','IN','FR','NL','IE','NZ','SE','ES','IT','BR','MX','JP','SG','ZA','AE','PL'])[1 + ((i + j * 3) % 20)],
        (array['United States','Canada','United Kingdom','Australia','Germany','India','France','Netherlands','Ireland','New Zealand',
               'Sweden','Spain','Italy','Brazil','Mexico','Japan','Singapore','South Africa','United Arab Emirates','Poland'])[1 + ((i + j * 3) % 20)],
        round((34.0 / j)::numeric, 2), 20000 * (8 - least(j, 7)))
      on conflict (audience_id, country_code) do nothing;
    end loop;

    -- channel affinity, demographics and engagement
    insert into strategy_audience_metrics (workspace_id, audience_id, metric_group, metric_key, metric_label, metric_value)
    select p_ws, v_id, 'channel', k, l, greatest(8, v - ((i * 7) % 12))
    from (values ('social','Social Media',78),('search','Search',60),('email','Email',48),('video','Video',44),('display','Display',30),('podcast','Podcast',20)) t(k,l,v);
    insert into strategy_audience_metrics (workspace_id, audience_id, metric_group, metric_key, metric_label, metric_value)
    values (p_ws, v_id, 'gender', 'female', 'Female', 52 + (i % 3) - 1),
           (p_ws, v_id, 'gender', 'male', 'Male', 44 - (i % 3) + 1),
           (p_ws, v_id, 'gender', 'other', 'Other', 4),
           (p_ws, v_id, 'age', '18-24', '18–24', 32), (p_ws, v_id, 'age', '25-34', '25–34', 22),
           (p_ws, v_id, 'age', '35-44', '35–44', 19), (p_ws, v_id, 'age', '45-54', '45–54', 15),
           (p_ws, v_id, 'age', '55+', '55+', 12),
           (p_ws, v_id, 'engagement', 'score', 'Engagement potential',
             case when i <= 6 then (array[92,88,84,76,72,61])[i] else 50 + ((i * 11) % 40) end);
  end loop;

  -- audience growth history (total vs active, 6 months, workspace-level rows on the top audience)
  for j in 0..5 loop
    insert into strategy_audience_metrics (workspace_id, audience_id, metric_group, metric_key, metric_label, metric_value, metric_date)
    values (p_ws, au[1], 'growth', 'total', 'Total audience', (array[1.9,2.25,2.6,3.2,3.75,4.3])[j + 1] * 1000000, (m0 - ((5 - j) || ' months')::interval)::date),
           (p_ws, au[1], 'growth', 'active', 'Active segments', (array[1.5,1.62,1.95,2.3,2.7,3.1])[j + 1] * 1000000, (m0 - ((5 - j) || ' months')::interval)::date);
  end loop;

  -- ============================================================ research
  for i in 1..6 loop
    insert into strategy_research_collections (workspace_id, name, description, created_by)
    values (p_ws, (array[to_char(current_date, '"Q"Q YYYY') || ' Customer Insights','Gen Z Deep Dive','Brand Health Tracking',
                          'Competitive Landscape','Industry Benchmarking','Product & Innovation'])[i],
            'Seeded demo collection.', v_owner)
    on conflict (workspace_id, name) do update set description = excluded.description
    returning id into v_id;
    col := col || v_id;
  end loop;

  for i in 1..142 loop
    v_status := case when i <= 115 - 18 then 'approved' when i <= 115 then 'in_review' else 'archived' end;
    insert into strategy_research_items (workspace_id, collection_id, title, summary, source_type, method, impact, confidence,
      status, theme, is_favourite, tags, owner_id, created_by, uploaded_by, archived_at, is_demo, created_at, updated_at)
    values (p_ws,
      case when i <= 92 then col[case when i <= 18 then 1 when i <= 32 then 2 when i <= 54 then 3 when i <= 70 then 4 when i <= 82 then 5 else 6 end] end,
      case when i <= 8 then (array['Gen Z Summer Trends','Sustainable Packaging Study','Brand Perception Survey','Competitive Messaging Audit',
                                   'Customer Value Drivers Report','Product Experience Interviews','Pricing Sensitivity Panel','Channel Preference Study'])[i]
                            || case when i in (1,3) then ' ' || to_char(current_date, 'YYYY') else '' end
           else (array['Retention Driver Analysis','Creator Economy Benchmark','Share of Voice Tracker','Checkout Friction Interviews',
                       'Holiday Intent Survey','Category Growth Report','Loyalty Programme Test','Ad Recall Study','Social Sentiment Pulse',
                       'Market Sizing Model','Onboarding Journey Review','Message Testing Round'])[1 + (i % 12)] || ' #' || i end,
      'Seeded demo research asset with methodology, sample and key findings.',
      (array['market_research','consumer_research','brand_research','competitive_intel','customer_insights','qualitative'])[1 + ((i - 1) % 6)],
      case when i <= 46 then 'survey' when i <= 77 then 'interview' when i <= 103 then 'report' when i <= 123 then 'market_data' when i <= 134 then 'social_listening' else 'other' end,
      case when i <= 8 then (array['high','high','high','medium','medium','high','medium','high'])[i] else (array['high','medium','low','medium'])[1 + (i % 4)] end,
      case when i <= 8 then (array[92,88,85,76,74,81,69,83])[i] else 60 + ((i * 17) % 36) end,
      v_status,
      (array['Brand Perception','Product Experience','Sustainability','Pricing & Value','Marketing Messages','Market Trends'])[1 + (i % 6)],
      i in (2, 9, 14, 21, 30, 37, 44, 58, 63, 77, 88, 101),
      array[(array['Consumer Insights','Market Research','Brand Tracking','Industry Trends','Competitive','Product Insights'])[1 + (i % 6)]],
      people[(array[1,2,4,3,1,2])[1 + ((i - 1) % 6)]], v_owner,
      case when i <= 34 then v_owner else people[1 + (i % 4)] end,
      case when v_status = 'archived' then now() - ((i % 40) || ' days')::interval end,
      true,
      now() - ((260 - i) || ' days')::interval,
      now() - (case when i <= 8 then (array[2,5,7,7,14,14,20,21])[i] * 24 else 30 + (i % 200) end || ' hours')::interval)
    returning id into v_id;
    rs := rs || v_id;
  end loop;

  -- findings (latest three reference headline copy)
  for i in 1..60 loop
    insert into strategy_research_findings (workspace_id, research_id, headline, detail, impact, created_by, created_at)
    values (p_ws, rs[1 + ((i - 1) % 90)],
      case i when 1 then '71% of Gen Z prefer brands that are transparent about sustainability efforts.'
             when 2 then 'Eco-friendly packaging increases purchase intent by 34% among Millennials.'
             when 3 then 'Trust in brand messaging improved 12pp quarter on quarter.'
             else (array['Short-form video drives 2.1x recall vs static.','Price is the #1 churn reason in the value segment.',
                         'Creators outperform brand posts on saves by 48%.','Search demand for refills is up 27% YoY.',
                         'Email re-engagement lifts CLV by 9%.','Loyalty members spend 1.6x more per order.'])[1 + (i % 6)] end,
      'Seeded demo finding.', case when i <= 36 then 'high' else 'medium' end, people[1 + (i % 4)],
      now() - (case i when 1 then 2 when 2 then 5 when 3 then 7 else 8 + i end || ' days')::interval);
  end loop;

  -- ============================================================ positioning
  for i in 1..5 loop
    insert into strategy_positioning_frameworks (workspace_id, name, category_promise, foundation, positioning_statement,
      target_audience_id, is_primary, version, status, consistency_score, owner_id, created_by, is_demo, created_at, updated_at)
    values (p_ws,
      (array['Primary','Enterprise Motion','SMB Self-serve','Creator Economy','International Launch'])[i],
      (array['The AI-native content platform that drives measurable growth at scale.',
             'The governed content engine for enterprise marketing teams.',
             'Everything a small team needs to publish like a big one.',
             'Where creators and brands build campaigns together.',
             'Global-ready content operations from day one.'])[i],
      'Built for marketing teams who demand impact, speed, and trust.',
      (array['Caption Fox is the AI-native content platform that helps enterprise marketing teams create, optimize, and scale content that drives measurable growth—faster.',
             'For enterprise marketing leaders who need governance without slowing down, Caption Fox delivers approvals, audit and brand safety built in.',
             'For small teams without a content department, Caption Fox turns one idea into a week of on-brand posts.',
             'For brands running creator programmes, Caption Fox is the shared workspace from brief to payout.',
             'For teams entering new markets, Caption Fox localises and schedules campaigns across regions.'])[i],
      au[2], i = 1, (array[4,2,3,1,1])[i],
      (array['in_review','approved','approved','draft','in_review'])[i],
      (array[86,82,79,64,71])[i], people[(array[3,1,2,4,2])[i]], v_owner, true,
      now() - ((90 - i * 10) || ' days')::interval, now() - ((array[2,20,30,40,50])[i] || ' days')::interval)
    returning id into v_id;
    fw := fw || v_id;
  end loop;

  insert into strategy_positioning_pillars (workspace_id, framework_id, name, description, icon, sort_order)
  values (p_ws, fw[1], 'AI-Powered Content Intelligence', 'Models trained on what performs for your brand.', 'brain', 1),
         (p_ws, fw[1], 'Enterprise Scale & Security', 'Governance, SSO and audit trails built in.', 'shield', 2),
         (p_ws, fw[1], 'Workflow Automation at Speed', 'From brief to published in hours, not weeks.', 'workflow', 3),
         (p_ws, fw[1], 'Performance You Can Measure', 'Attribution tied to revenue outcomes.', 'chart', 4);

  insert into strategy_proof_points (workspace_id, framework_id, label, category, impact, verification, evidence_research_id, sort_order, created_by)
  values (p_ws, fw[1], 'SOC 2 Type II Certification', 'trust', 'high', 'verified', null, 1, v_owner),
         (p_ws, fw[1], '10x Faster Time-to-Market', 'efficiency', 'high', 'verified', rs[5], 2, v_owner),
         (p_ws, fw[1], '99.9% Platform Uptime', 'reliability', 'medium', 'verified', null, 3, v_owner),
         (p_ws, fw[1], '200+ Native Integrations', 'ecosystem', 'medium', 'verified', null, 4, v_owner),
         (p_ws, fw[1], 'Customer ROI: 3.4x Average', 'results', 'high', 'in_review', rs[5], 5, v_owner);

  insert into strategy_claims (workspace_id, framework_id, claim, risk_level, rationale, sort_order, created_by)
  values (p_ws, fw[1], 'AI-native platform', 'low', 'Architecture documented publicly.', 1, v_owner),
         (p_ws, fw[1], '10x faster time-to-market', 'medium', 'Based on customer case studies; needs a sample-size footnote.', 2, v_owner),
         (p_ws, fw[1], 'Best-in-class security', 'low', 'Backed by SOC 2 Type II.', 3, v_owner),
         (p_ws, fw[1], 'Enterprise-grade scalability', 'low', 'Load-tested to 10x current peak.', 4, v_owner),
         (p_ws, fw[1], 'Highest ROI in category', 'high', 'Comparative claim without independent verification.', 5, v_owner);

  for i in 1..5 loop
    insert into strategy_competitors (workspace_id, framework_id, name, is_self, sort_order)
    values (p_ws, fw[1], (array['Caption Fox','OptiWrite','ContentCraft','Marketly','WriteWise'])[i], i = 1, i)
    returning id into v_id;
    comp := comp || v_id;
  end loop;
  for i in 1..8 loop
    insert into strategy_competitor_attributes (workspace_id, framework_id, name, sort_order)
    values (p_ws, fw[1], (array['AI Content Quality','Speed to Publish','Enterprise Security','Workflow Automation',
                                 'Analytics & Insights','Ease of Use','Integrations','Pricing Value'])[i], i)
    returning id into v_id;
    attr := attr || v_id;
  end loop;
  for i in 1..5 loop
    for j in 1..8 loop
      insert into strategy_competitor_scores (workspace_id, competitor_id, attribute_id, score)
      values (p_ws, comp[i], attr[j],
        (array[
          array['strong','strong','moderate','strong','strong','strong','strong','strong'],
          array['moderate','moderate','moderate','moderate','moderate','strong','moderate','strong'],
          array['weak','moderate','na','strong','moderate','moderate','moderate','moderate'],
          array['weak','weak','moderate','weak','moderate','moderate','weak','weak'],
          array['moderate','weak','weak','moderate','weak','moderate','strong','moderate']
        ])[i][j]);
    end loop;
  end loop;

  for i in 1..32 loop
    insert into strategy_messaging_assets (workspace_id, framework_id, name, asset_type, audience_id, status, owner_id, created_at, updated_at)
    values (p_ws, fw[1 + ((i - 1) / 12)],
      case when i <= 4 then (array['Enterprise Value Brief','Platform One-Pager','Solution Overview Deck','Security & Compliance Sheet'])[i]
           else (array['Launch Email Copy','Sales Battlecard','Web Hero Messaging','Analyst Briefing Notes','Case Study Template','Partner Pitch'])[1 + (i % 6)] || ' v' || (1 + i % 3) end,
      case when i = 3 then 'presentation' when i in (2, 4) then 'one_pager' else (array['document','presentation','sheet','one_pager'])[1 + (i % 4)] end,
      au[1 + (i % 4)],
      case when i = 3 then 'in_review' when i in (7, 13, 19, 25) then 'in_review' else 'approved' end,
      people[1 + (i % 4)],
      now() - ((40 + i) || ' days')::interval,
      now() - ((array[2,3,4,7])[least(i, 4)] + greatest(0, i - 4) || ' days')::interval);
  end loop;

  -- approval workflow for the primary framework: draft ✓ review ✓ legal (in progress) leadership approved
  insert into strategy_approvals (workspace_id, entity_type, entity_id, stage, status, requested_by, approver_id, comment, due_date, requested_at, decided_at, sort_order)
  values (p_ws, 'framework', fw[1], 'draft', 'approved', o2, o2, null, current_date - 25, now() - interval '30 days', now() - interval '25 days', 1),
         (p_ws, 'framework', fw[1], 'review', 'approved', o2, o1, 'Pillars read well; tightened proof points.', current_date - 18, now() - interval '24 days', now() - interval '18 days', 2),
         (p_ws, 'framework', fw[1], 'legal_review', 'pending', o4, o3, null, current_date + 5, now() - interval '2 days', null, 3),
         (p_ws, 'framework', fw[1], 'leadership', 'pending', o4, v_admin, null, current_date + 12, now() - interval '2 days', null, 4),
         (p_ws, 'framework', fw[1], 'approved', 'pending', o4, v_admin, null, current_date + 14, now() - interval '2 days', null, 5);
  select id into v_appr from strategy_approvals where workspace_id = p_ws and entity_id = fw[1] and stage = 'legal_review';
  insert into strategy_comments (workspace_id, entity_type, entity_id, body, author_id, created_at)
  values (p_ws, 'approval', v_appr, 'Please add the sample size behind the 10x claim before sign-off.', o3, now() - interval '30 hours'),
         (p_ws, 'approval', v_appr, 'Added the footnote and linked the Customer Value Drivers Report.', o4, now() - interval '20 hours');
  insert into strategy_approvals (workspace_id, entity_type, entity_id, stage, status, requested_by, approver_id, due_date, requested_at, sort_order)
  select p_ws, 'framework', fw[5], 'review', 'pending', o2, o3, current_date + 7, now() - interval '4 days', 1
  union all select p_ws, 'research', rs[2], 'review', 'pending', o2, o1, current_date + 3, now() - interval '3 days', 1
  union all select p_ws, 'research', rs[6], 'review', 'pending', o1, o3, current_date + 6, now() - interval '5 days', 1;
  insert into strategy_approvals (workspace_id, entity_type, entity_id, stage, status, requested_by, approver_id, due_date, requested_at, sort_order)
  select p_ws, 'asset', id, 'review', 'pending', o4, o3, current_date + 4, now() - interval '1 day', 1
  from strategy_messaging_assets where workspace_id = p_ws and status = 'in_review' and name <> 'Solution Overview Deck' limit 1;

  -- ============================================================ plans
  for i in 1..12 loop
    insert into strategy_plans (workspace_id, strategy_id, name, description, status, progress, budget, budget_spent, currency,
      owner_id, start_date, end_date, priority, target_summary, created_by, is_demo, created_at, updated_at)
    values (p_ws, s[(array[1,2,3,6,3,2,7,4,5,8,5,8])[i]],
      (array['Gen Z Market Expansion','Sustainable Packaging Leadership','International Market Expansion','Product Differentiation Initiative',
             'Revenue Growth Program','Brand Experience Transformation','Creator Partnership Programme','Community Advocacy Launch',
             'Retention Messaging Refresh','Search & Discovery Uplift','Loyalty Programme Rollout','Media Mix Optimisation'])[i],
      'Seeded demo strategic plan.',
      (array['on_track','at_risk','on_track','on_track','off_track','not_started','on_track','on_track','at_risk','at_risk','off_track','at_risk'])[i],
      (array[68,52,75,75,32,0,81,66,48,55,30,44])[i],
      (array[420000,310000,650000,280000,500000,240000,180000,90000,120000,150000,210000,160000])[i],
      (array[298000,262000,471000,214000,380000,12000,139000,61000,94000,121000,176000,142000])[i],
      'GBP', people[(array[1,3,2,2,4,1,3,4,1,2,4,3])[i]],
      current_date - (array[48,44,60,40,52,6,70,30,38,34,45,28])[i],
      current_date + (array[18,30,55,4,8,90,20,35,26,40,15,22])[i],
      (array['urgent','urgent','high','high','high','medium','medium','medium','medium','low','medium','low'])[i],
      (array['+20% market share','90% sustainable materials','£5M incremental revenue','3 differentiated features','+£4.8M revenue',
             'NPS +12','Creator ROI 3.5x','2,000 advocates','Churn -2pp','Organic sessions +30%','Members 40k','CPA -12%'])[i],
      v_owner, true, now() - ((80 - i) || ' days')::interval, now() - ((array[1,3,5,8,24,40,12,30,50,60,70,80])[i] || ' hours')::interval)
    returning id into v_id;
    pl := pl || v_id;
  end loop;
  update strategy_plans set status = 'not_started' where id = pl[6];

  -- plan items: phases/tasks/milestones for every plan
  for i in 1..12 loop
    for j in 1..3 loop
      insert into strategy_plan_items (workspace_id, plan_id, title, item_type, status, priority, progress, owner_id, start_date, due_date, sort_order, created_by)
      values (p_ws, pl[i],
        case i
          when 1 then (array['Market Research & Insights','Launch Targeting Framework','Pilot Campaign Launch'])[j]
          when 2 then (array['Material Innovation','Supply Chain Alignment','Go to Market Campaign'])[j]
          when 4 then (array['Competitor Feature Review','Differentiation Roadmap','Beta Programme'])[j]
          when 5 then (array['Pricing Experiments','Sales Enablement','Upsell Journeys'])[j]
          else (array['Discovery','Build & Launch','Measure & Optimise'])[j] || ' — ' || (array['Wave 1','Wave 2','Wave 3'])[1 + (i % 3)]
        end,
        case when j = 2 and i in (1, 2) then 'milestone' else 'task' end,
        case
          when i = 1 then (array['completed','on_track','not_started'])[j]
          when i = 2 then (array['on_track','at_risk','not_started'])[j]
          when i = 6 then 'not_started'
          when i in (5, 11) and j = 2 then 'blocked'
          when i in (9, 12) and j = 3 then 'blocked'
          when i = 10 and j = 2 then 'blocked'
          when j = 1 then 'completed' else 'on_track' end,
        case when i <= 5 and j <= 2 then 'high' when j = 1 then 'medium' else 'low' end,
        case
          when i = 1 then (array[100,70,60])[j]
          when i = 2 then (array[80,40,0])[j]
          when i = 6 then 0
          when j = 1 then 100 else 40 end,
        people[1 + ((i + j) % 4)],
        current_date - (array[48,44,60,40,52,6,70,30,38,34,45,28])[i] + (j - 1) * 14 + 4,
        least(current_date + (array[18,30,55,4,8,90,20,35,26,40,15,22])[i],
              current_date - (array[48,44,60,40,52,6,70,30,38,34,45,28])[i] + (j - 1) * 14 + 4 + (array[34,30,26])[j]),
        j, v_owner)
      returning id into v_parent;
    end loop;
  end loop;
  -- milestones due this month across plans (24)
  for i in 1..24 loop
    insert into strategy_plan_items (workspace_id, plan_id, title, item_type, status, priority, progress, owner_id, start_date, due_date, sort_order, created_by)
    values (p_ws, pl[1 + ((i - 1) % 12)],
      case i when 1 then 'Launch Targeting Framework sign-off' when 2 then 'Supply Chain Alignment' when 3 then 'Q3 Brand Perception Survey'
             else (array['Creative approval','Budget checkpoint','Channel go-live','Stakeholder review','Results readout','Vendor contract'])[1 + (i % 6)] || ' ' || i end,
      'milestone',
      case when i % 7 = 0 then 'at_risk' when greatest(m0, current_date - 12) + (i % 20) < current_date then 'completed' else 'on_track' end,
      case when i <= 4 then 'high' when i % 3 = 0 then 'medium' else 'low' end,
      0, people[1 + (i % 4)],
      null, least((m0 + interval '1 month - 1 day')::date, current_date + (array[5,10,17])[1 + (i % 3)] + (i % 4) - 2),
      10 + i, v_owner);
  end loop;
  insert into strategy_plan_items (workspace_id, plan_id, title, item_type, status, priority, progress, owner_id, start_date, due_date, sort_order, created_by)
  values (p_ws, pl[1], 'Finalize Gen Z creative concept', 'task', 'at_risk', 'high', 55, o1, current_date - 10, current_date + 2, 40, v_owner),
         (p_ws, pl[2], 'Confirm packaging supplier', 'task', 'at_risk', 'high', 30, o3, current_date - 8, current_date + 4, 41, v_owner),
         (p_ws, pl[5], 'Q3 media plan approval', 'task', 'off_track', 'high', 20, o4, current_date - 12, current_date + 6, 42, v_owner),
         (p_ws, pl[4], 'Competitor benchmarking', 'task', 'on_track', 'medium', 65, o2, current_date - 6, current_date + 8, 43, v_owner);

  insert into strategy_plan_dependencies (workspace_id, plan_id, depends_on_plan_id, label, risk_level, blocked_items, created_by)
  values (p_ws, pl[4], pl[1], 'Differentiation roadmap needs Gen Z research', 'medium', 1, v_owner),
         (p_ws, pl[6], pl[2], 'Experience refresh waits on packaging decision', 'medium', 2, v_owner),
         (p_ws, pl[1], pl[5], 'Gen Z launch budget released by revenue programme', 'low', 1, v_owner);

  insert into strategy_plan_risks (workspace_id, plan_id, title, detail, severity, status, owner_id)
  values (p_ws, pl[2], 'Low supplier readiness', 'Two of three packaging suppliers not yet certified.', 'high', 'open', o3),
         (p_ws, pl[5], 'Budget overrun risk', 'Paid media spend 12% ahead of plan.', 'medium', 'open', o4),
         (p_ws, pl[4], 'Resource dependency delay', 'Design team shared with Brand Experience.', 'medium', 'mitigating', o2),
         (p_ws, pl[11], 'Loyalty platform integration slip', 'Vendor API access delayed.', 'high', 'open', o4),
         (p_ws, pl[3], 'Currency exposure', 'EUR revenue sensitive to FX.', 'low', 'resolved', o2);

  for j in 0..2 loop
    insert into strategy_plan_capacity (workspace_id, period_start, allocated, capacity)
    values (p_ws, (m0 - ((2 - j) || ' months')::interval)::date, (array[112,96,124])[j + 1], 100)
    on conflict (workspace_id, period_start) do nothing;
  end loop;

  -- ============================================================ forecasts
  for i in 1..3 loop
    insert into strategy_forecasts (workspace_id, strategy_id, name, description, metric, currency, period_start, period_end,
      target_value, confidence, risk_level, status, owner_id, created_by, last_recalculated_at, refresh_interval_days, is_demo, created_at)
    values (p_ws, s[3],
      (array['FY' || to_char(current_date, 'YYYY') || ' Revenue Forecast', 'FY' || to_char(current_date, 'YYYY') || ' Pipeline Forecast', 'H2 Lead Generation Forecast'])[i],
      'Seeded demo forecast model.',
      (array['revenue','pipeline','leads'])[i], 'GBP', fy0, (fy0 + interval '1 year - 1 day')::date,
      (array[22000000, 64000000, 180000])[i], (array['high','medium','medium'])[i], (array['medium','medium','low'])[i],
      'active', (array[o4, o2, o1])[i], v_owner, now() - (array[2, 6, 1])[i] * interval '1 day', 5, true,
      now() - interval '150 days')
    returning id into v_fc;

    sc := '{}';
    for j in 1..3 loop
      insert into strategy_forecast_scenarios (workspace_id, forecast_id, name, scenario_type, is_expected, probability, forecast_value,
        range_low, range_high, drivers, risks, owner_id, last_recalculated_at, sort_order)
      values (p_ws, v_fc, (array['Best case','Expected case','Downside case'])[j], (array['best','expected','downside'])[j], j = 2,
        (array[25, 50, 25])[j],
        (array[array[28400000, 23800000, 17200000], array[78000000, 66500000, 51000000], array[226000, 191000, 150000]])[i][j],
        (array[array[26000000, 21600000, 14800000], array[72000000, 61000000, 46000000], array[210000, 176000, 132000]])[i][j],
        (array[array[31200000, 25800000, 19600000], array[84000000, 71000000, 56000000], array[240000, 205000, 166000]])[i][j],
        case j when 1 then array['High demand','Market expansion','Strong execution']
               when 2 then array['Steady demand','Planned investments','Normal execution']
               else array['Market contraction','Delay in execution','Higher costs'] end,
        case j when 1 then array['Capacity constraints'] when 2 then array['Competitive pricing']
               else array['Budget freeze','Churn spike'] end,
        (array[o4, o2, o1])[i], now() - (array[2, 6, 1])[i] * interval '1 day', j)
      returning id into v_id;
      sc := sc || v_id;
    end loop;

    -- 12 monthly periods per scenario (monthly, non-cumulative)
    for j in 0..11 loop
      v_tgt := (array[22000000, 64000000, 180000])[i] * (array[0.055,0.06,0.07,0.075,0.08,0.083,0.085,0.09,0.093,0.097,0.105,0.107])[j + 1];
      for n in 1..3 loop
        v_val := v_tgt * (array[
          array[0.80,0.86,0.95,1.10,1.18,1.22,1.25,1.27,1.30,1.32,1.34,1.36],
          array[0.62,0.70,0.82,0.96,1.06,1.10,1.14,1.16,1.17,1.18,1.12,1.10],
          array[0.55,0.60,0.68,0.75,0.78,0.80,0.80,0.79,0.78,0.77,0.76,0.75]])[n][j + 1];
        -- rescale so each scenario totals its annual value
        insert into strategy_forecast_periods (workspace_id, forecast_id, scenario_id, period_label, period_date, target_value, forecast_value, actual_value)
        values (p_ws, v_fc, sc[n], to_char((fy0 + (j || ' months')::interval), 'Mon'), (fy0 + (j || ' months')::interval)::date,
          round(v_tgt, 2), round(v_val, 2),
          case when n = 2 and (fy0 + (j || ' months')::interval)::date < m0 then round(v_val * (0.97 + (j % 3) * 0.02), 2) end);
      end loop;
    end loop;
    -- normalise each scenario's periods to its headline forecast value
    update strategy_forecast_periods fp
    set forecast_value = round(fp.forecast_value * s2.forecast_value / nullif(t.total, 0), 2)
    from strategy_forecast_scenarios s2,
         (select scenario_id, sum(forecast_value) total from strategy_forecast_periods where forecast_id = v_fc group by scenario_id) t
    where fp.forecast_id = v_fc and s2.id = fp.scenario_id and t.scenario_id = fp.scenario_id;

    insert into strategy_forecast_assumptions (workspace_id, forecast_id, label, value_text, numeric_value, unit, confidence, sort_order, updated_by)
    values (p_ws, v_fc, 'Market growth rate', '4.2%', 4.2, '%', 'high', 1, o1),
           (p_ws, v_fc, 'Average deal size growth', '3.8%', 3.8, '%', 'medium', 2, o2),
           (p_ws, v_fc, 'Win rate', '26.0%', 26.0, '%', 'high', 3, o3),
           (p_ws, v_fc, 'Sales cycle (days)', '68', 68, 'days', 'medium', 4, o4),
           (p_ws, v_fc, 'Customer acquisition cost', '£1,240', 1240, 'GBP', 'low', 5, o2),
           (p_ws, v_fc, 'Churn rate', '6.5%', 6.5, '%', 'medium', 6, o1);
  end loop;

  -- ============================================================ links
  for i in 1..15 loop
    for j in 1..(2 + (i % 4)) loop
      insert into strategy_links (workspace_id, source_type, source_id, target_type, target_id, created_by)
      values (p_ws, 'objective', ob[i], 'audience', au[1 + ((i + j * 5) % 28)], v_owner) on conflict do nothing;
    end loop;
    for j in 1..(1 + (i % 3)) loop
      insert into strategy_links (workspace_id, source_type, source_id, target_type, target_id, created_by)
      values (p_ws, 'objective', ob[i], 'plan', pl[1 + ((i + j * 3) % 12)], v_owner) on conflict do nothing;
    end loop;
  end loop;
  for i in 1..64 loop
    insert into strategy_links (workspace_id, source_type, source_id, target_type, target_id, created_by)
    values (p_ws, 'research', rs[i], 'plan', pl[1 + (i % 12)], v_owner) on conflict do nothing;
    insert into strategy_links (workspace_id, source_type, source_id, target_type, target_id, created_by)
    values (p_ws, 'research', rs[i], 'objective', ob[1 + (i % 18)], v_owner) on conflict do nothing;
    insert into strategy_links (workspace_id, source_type, source_id, target_type, target_id, created_by)
    values (p_ws, 'research', rs[i], 'objective', ob[1 + ((i * 7) % 18)], v_owner) on conflict do nothing;
  end loop;
  for i in 1..22 loop
    insert into strategy_links (workspace_id, source_type, source_id, target_type, target_id, created_by)
    values (p_ws, 'framework', fw[1 + (i % 5)], 'audience', au[i], v_owner) on conflict do nothing;
  end loop;

  -- ============================================================ next actions
  insert into strategy_actions (workspace_id, title, module, priority, status, entity_type, entity_id, owner_id, due_date, is_demo, created_by)
  values (p_ws, 'Approve positioning for "Summer Collection Launch"', 'positioning', 'high', 'open', 'framework', fw[1], o3, current_date + 4, true, v_owner),
         (p_ws, 'Review Gen Z audience segment insights', 'research', 'medium', 'open', 'research', rs[1], o2, current_date + 6, true, v_owner),
         (p_ws, 'Finalize Q3 media plan milestones', 'plans', 'high', 'open', 'plan', pl[5], o4, current_date + 8, true, v_owner),
         (p_ws, 'Validate revenue forecast assumptions', 'forecasts', 'medium', 'open', 'forecast', null, o4, current_date + 11, true, v_owner),
         (p_ws, 'Link audiences to International Market Expansion', 'objectives', 'low', 'open', 'objective', ob[11], o1, current_date + 15, true, v_owner),
         (p_ws, 'Archive superseded brand tracking waves', 'research', 'low', 'done', null, null, o1, current_date - 3, true, v_owner);
  update strategy_actions set entity_id = (select id from strategy_forecasts where workspace_id = p_ws and metric = 'revenue' limit 1)
  where workspace_id = p_ws and module = 'forecasts' and entity_id is null;
  update strategy_actions set completed_at = now() - interval '3 days', completed_by = o1 where workspace_id = p_ws and status = 'done';

  -- ============================================================ insights
  insert into strategy_insights (workspace_id, module, kind, title, detail, impact, research_id, is_demo, created_at)
  values (p_ws, 'audiences', 'opportunity', 'Emerging opportunity: Eco-conscious segment',
          'Sustainable Shoppers are growing 22% MoM and show high engagement on Instagram and Search.', 'high', rs[2], true, now() - interval '1 day'),
         (p_ws, 'audiences', 'gap', 'Persona gap detected',
          'We''re under-indexed with Millennial Parents in the Midwest region.', 'medium', rs[5], true, now() - interval '2 days'),
         (p_ws, 'audiences', 'expansion', 'Geographic expansion',
          'Strong audience growth in Australia and Germany. Consider localized content.', 'opportunity', rs[3], true, now() - interval '3 days');

  -- ============================================================ KPI history
  for j in 1..6 loop
    insert into strategy_kpi_snapshots (workspace_id, period_start, metrics, updated_at)
    values (p_ws, (m0 - (j || ' months')::interval)::date, jsonb_build_object(
      'active_strategies', greatest(4, 8 - (j + 1) / 2 * 1 - 1),
      'objectives_total', 18 - j,
      'objectives_on_track', greatest(4, 8 - j),
      'objectives_at_risk', (array[4,4,5,5,6,6])[j],
      'objectives_completed', (array[0,1,2,1,0,1])[j],
      'objectives_avg_confidence', 71 - j,
      'objectives_linked_plans', 8 - least(j, 4),
      'audience_coverage', 54 - j * 2,
      'audiences_total', 30 - j,
      'audiences_active', 20 - j,
      'persona_coverage', 69 - j,
      'geographic_reach', 63 - j,
      'missing_data', 10 + j,
      'campaign_match', 73 - j,
      'research_health', 82 - j,
      'research_total', 124 - j * 6,
      'research_high_impact', 21 - j,
      'research_pending', 14 + j,
      'research_archived', 21 - j,
      'research_confidence', 72 - j,
      'research_linked_plans', 53 - j * 2,
      'positioning_health', 70 - j,
      'frameworks_active', 4,
      'proof_coverage', 72 - j,
      'plans_active', 10 - least(j, 3),
      'plans_blocked', 3 + (j % 2),
      'plans_completion', 50 - j * 2,
      'plans_budget_alignment', 82 - j,
      'plans_milestones_due', 18 + j,
      'forecast_confidence_score', 70 - j,
      'forecast_projected', 21900000 - j * 250000,
      'health_score', (array[76,68,66,60,58,55])[j],
      'benchmark_score', (array[57,54,52,45,45,44])[j]
    ), now() - (j || ' months')::interval)
    on conflict (workspace_id, period_start) do nothing;

    insert into strategy_health_snapshots (workspace_id, snapshot_date, health_score, benchmark_score, objectives_on_track, objectives_total)
    values (p_ws, (m0 - (j || ' months')::interval)::date, (array[76,68,66,60,58,55])[j], (array[57,54,52,45,45,44])[j], greatest(4, 8 - j), 18 - j)
    on conflict (workspace_id, snapshot_date) do nothing;
  end loop;

  -- ============================================================ activity
  insert into strategy_activity (workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at)
  values
    (p_ws, o1, 'objective', ob[1], 'updated objective', '"Increase Brand Awareness" progress from 60% to 68%', null, 'objectives', now() - interval '2 hours'),
    (p_ws, o2, 'research', rs[1], 'added research', '"Gen Z Summer Trends"', null, 'research', now() - interval '5 hours'),
    (p_ws, o3, 'framework', fw[2], 'approved positioning', '"Eco-Friendly Innovator" positioning', null, 'positioning', now() - interval '26 hours'),
    (p_ws, o4, 'forecast', null, 'updated forecast', '"Q3 revenue forecast increased by 8.6%"', null, 'forecasts', now() - interval '2 days'),
    (p_ws, o2, 'objective', ob[6], 'updated objective', '"Expand into New Markets" status to At risk', null, 'objectives', now() - interval '5 hours 20 minutes'),
    (p_ws, o3, 'plan', pl[3], 'added plan', '"Q3 Market Expansion Plan" to "Expand into New Markets"', null, 'objectives', now() - interval '27 hours'),
    (p_ws, o4, 'objective', ob[4], 'completed action', '"Validate revenue forecast assumptions"', null, 'objectives', now() - interval '2 days 1 hour'),
    (p_ws, o1, 'audience', au[1], 'updated audience', 'Growth Consumers — Audience size increased by 18%', null, 'audiences', now() - interval '2 hours 10 minutes'),
    (p_ws, o3, 'audience', au[5], 'created segment', 'Tech Enthusiasts — Imported from CRM', null, 'audiences', now() - interval '5 hours 10 minutes'),
    (p_ws, o2, 'audience', au[2], 'updated audience', 'Enterprise Decision Makers — Added LinkedIn engagement filter', null, 'audiences', now() - interval '1 day 1 hour'),
    (p_ws, o4, 'audience', au[3], 'synced segment', 'Sustainable Shoppers — Synced 5,432 records from CRM', null, 'audiences', now() - interval '2 days 2 hours'),
    (p_ws, o1, 'audience', au[4], 'updated audience', 'New Parents — Adjusted age range to 25–40', null, 'audiences', now() - interval '2 days 3 hours'),
    (p_ws, o1, 'research', rs[1], 'uploaded', 'Gen Z Summer Trends', null, 'research', now() - interval '2 days 4 hours'),
    (p_ws, o3, 'research', rs[2], 'updated', 'Sustainable Packaging Study', null, 'research', now() - interval '5 days'),
    (p_ws, o4, 'research', rs[3], 'tagged you in a finding from', 'Brand Perception Survey', null, 'research', now() - interval '7 days'),
    (p_ws, o2, 'research', null, 'archived', '3 research items', null, 'research', now() - interval '14 days'),
    (p_ws, o1, 'approval', fw[2], 'approved', '"Enterprise Value Brief"', null, 'positioning', now() - interval '2 hours 30 minutes'),
    (p_ws, o3, 'proof_point', fw[1], 'added proof point', '"Customer ROI: 3.4x Average"', null, 'positioning', now() - interval '5 hours 30 minutes'),
    (p_ws, o2, 'framework', fw[1], 'updated positioning statement', 'Primary framework', null, 'positioning', now() - interval '1 day 2 hours'),
    (p_ws, o4, 'framework', fw[1], 'submitted framework', '"Primary" for legal review', null, 'positioning', now() - interval '2 days 5 hours'),
    (p_ws, o3, 'plan_item', pl[2], 'updated milestone', 'Supply Chain Alignment', null, 'plans', now() - interval '1 hour'),
    (p_ws, o1, 'plan_item', pl[1], 'completed task', 'Market Research & Insights', null, 'plans', now() - interval '3 hours'),
    (p_ws, o2, 'plan', pl[4], 'added dependency', 'Product Differentiation → Revenue Growth Program', null, 'plans', now() - interval '5 hours 40 minutes'),
    (p_ws, o4, 'plan', pl[5], 'updated plan status', 'Revenue Growth Program', null, 'plans', now() - interval '1 day 3 hours'),
    (p_ws, o1, 'assumption', null, 'updated revenue assumptions', 'Increased market growth rate to 4.2%', null, 'forecasts', now() - interval '2 hours 40 minutes'),
    (p_ws, o2, 'scenario', null, 'ran scenario analysis', 'Compared new downside scenario', null, 'forecasts', now() - interval '5 hours 50 minutes'),
    (p_ws, o3, 'forecast', null, 'updated target', 'FY revenue target increased to £22.0M', null, 'forecasts', now() - interval '1 day 4 hours'),
    (p_ws, o4, 'forecast', null, 'refreshed model', 'Model recalibrated with latest data', null, 'forecasts', now() - interval '2 days 6 hours');
end $$;

revoke all on function public.strategy_seed_demo(uuid) from public, anon, authenticated;

select public.strategy_seed_demo(id) from public.workspaces
where slug in ('jamahl-thomas-business-demo', 'jamahl-thomas-campaign-manager-demo', 'jamahl-thomas-agency-demo');
