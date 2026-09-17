-- ============================================================
-- Events module — demo seed enrichment (v2).
--
-- The v1 seed proved the six routes render; it was too thin to show the
-- module at realistic operating scale (8 events, 28 registrations), so the
-- KPI strip, charts and density read nothing like a working workspace.
--
-- This seeder brings the Brand demo workspace up to a realistic portfolio:
-- 48 events, ~8.2k registrations spread across the last 30 days with real
-- attendance, a sponsor book with pipeline and contracted revenue, a full
-- follow-up board, podcast listen history and event cover art.
--
-- Every row is is_demo = true and workspace-scoped. Idempotent: guarded on a
-- seed_version marker, so re-running (or a fresh database) is a no-op the
-- second time. Sponsor names are fictional — no third-party trademarks.
-- ============================================================

do $$
declare
  v_ws uuid;
  v_owner uuid;
  v_big_events uuid[];
  v_sponsor_id uuid;
  v_sponsorship_id uuid;
  v_show_id uuid;
  v_seq_id uuid;
  v_ev uuid;
  i int;
  n int;
  v_day int;
  v_stage text;
  v_value numeric;
  v_first_names text[] := array['Emily','Michael','Sophia','James','Olivia','Daniel','Grace','Thomas','Hannah','Ryan',
                               'Chloe','Adam','Isla','Nathan','Freya','Owen','Amelia','Lucas','Ruby','Ethan',
                               'Maya','Joseph','Erin','Caleb','Nina','Aaron','Leah','Oscar','Zara','Felix'];
  v_last_names  text[] := array['Carter','Chen','Martinez','Wilson','Brown','Hughes','Patel','Okafor','Novak','Ellis',
                                'Foster','Reid','Murray','Bennett','Shah','Doyle','Barnes','Ward','Fleming','Price'];
  v_companies   text[] := array['Northwind Cloud','Halcyon Data','Beacon CRM','Lumen Analytics','Kestrel Software',
                                'Arbour Health','Tidewater Logistics','Vantage Retail','Marlow Financial','Redwood Labs'];
begin
  select id, owner_id into v_ws, v_owner
  from public.workspaces where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_ws is null then return; end if;

  if exists (select 1 from public.events
             where workspace_id = v_ws and metadata->>'seed_version' = 'v2') then
    return; -- already enriched
  end if;

  -- ---------------------------------------------------------------- covers
  update public.events set cover_image_url = '/demo/events/product-summit.jpg'       where workspace_id = v_ws and name ilike 'Product Summit%';
  update public.events set cover_image_url = '/demo/events/ai-marketing-trends.jpg'  where workspace_id = v_ws and name ilike '%AI Marketing Trends%';
  update public.events set cover_image_url = '/demo/events/customer-success.jpg'     where workspace_id = v_ws and name ilike '%Customer Success%';
  update public.events set cover_image_url = '/demo/events/product-roadmap.jpg'      where workspace_id = v_ws and name ilike '%Product Roadmap%';
  update public.events set cover_image_url = '/demo/events/executive-roundtable.jpg' where workspace_id = v_ws and name ilike '%Roundtable%';
  update public.events set cover_image_url = '/demo/events/partner-summit.jpg'       where workspace_id = v_ws and name ilike '%Partner%';
  update public.events set cover_image_url = '/demo/events/q2-webinar.jpg'           where workspace_id = v_ws and name ilike '%Q2%';
  update public.events set cover_image_url = '/demo/events/growth-workshop.jpg'      where workspace_id = v_ws and cover_image_url is null;

  -- ------------------------------------------------------- more events (48)
  for i in 1..40 loop
    insert into public.events (
      workspace_id, name, event_type, format, status, start_at, end_at, timezone,
      location_name, location_city, location_country, online_platform, capacity,
      cover_image_url, owner_id, created_by, is_demo, metadata, created_at
    ) values (
      v_ws,
      (array['Growth Clinic','Customer Advisory Board','Product Deep Dive','Marketing Leaders Breakfast',
             'Analytics Masterclass','Partner Office Hours','Founder AMA','Retention Workshop',
             'Demand Gen Live','Brand Studio Session'])[1 + (i % 10)] || ' ' ||
      to_char(now() - ((i * 9) || ' days')::interval, 'Mon YYYY'),
      (array['workshop','roundtable','webinar','networking','product_launch','conference'])[1 + (i % 6)],
      (array['in_person','virtual','hybrid'])[1 + (i % 3)],
      case when i % 7 = 0 then 'draft'
           when i % 11 = 0 then 'cancelled'
           when i <= 9 then 'upcoming'
           else 'completed' end,
      now() + ((case when i <= 9 then i * 4 else -(i * 9) end) || ' days')::interval,
      now() + ((case when i <= 9 then i * 4 else -(i * 9) end) || ' days')::interval + interval '3 hours',
      'Europe/London',
      (array['The Brewery','Convene Sancroft','Kings Place','Etc.venues','Online'])[1 + (i % 5)],
      (array['London','Manchester','Bristol','Edinburgh','Leeds'])[1 + (i % 5)],
      'United Kingdom',
      case when i % 3 = 1 then (array['Zoom','Microsoft Teams','Google Meet'])[1 + (i % 3)] else null end,
      60 + (i % 8) * 45,
      '/demo/events/' || (array['growth-workshop','executive-roundtable','q2-webinar','partner-summit',
                                'product-roadmap','customer-success'])[1 + (i % 6)] || '.jpg',
      v_owner, v_owner, true,
      jsonb_build_object('seed_version','v2'),
      now() - ((i * 9) || ' days')::interval
    );
  end loop;

  -- mark the v1 events too so the guard trips on re-run
  update public.events set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('seed_version','v2')
  where workspace_id = v_ws and is_demo = true;

  -- the registration-heavy events: the original eight plus two
  select array_agg(id) into v_big_events from (
    select id from public.events
    where workspace_id = v_ws and is_demo = true and status <> 'cancelled'
    order by created_at limit 10
  ) t;

  -- -------------------------------------------------- registrations (~8,246)
  -- Spread across the last 30 days on a gently rising curve, with real
  -- attendance so the attendance rate and trend chart are computed, never
  -- hard-coded. 61.2% attended of 98% eligible => ~62.4% attendance rate.
  for i in 1..8246 loop
    v_day := floor(29 * power(i::numeric / 8246, 0.78))::int;
    v_ev := v_big_events[1 + (i % array_length(v_big_events, 1))];
    insert into public.event_registrations (
      workspace_id, event_id, full_name, email, company, job_title,
      status, source, registered_at, attended, checked_in_at, watch_seconds,
      consent_marketing, follow_up_status, is_demo, created_at
    ) values (
      v_ws, v_ev,
      v_first_names[1 + (i % 30)] || ' ' || v_last_names[1 + ((i / 7) % 20)],
      'demo.reg' || i || '@example.com',
      v_companies[1 + (i % 10)],
      (array['Marketing Manager','Head of Growth','Founder','CMO','Content Lead','Demand Gen Manager'])[1 + (i % 6)],
      case when (i % 1000) < 612 then 'attended'
           when (i % 1000) >= 980 then 'cancelled'
           when (i % 1000) >= 940 then 'no_show'
           when (i % 1000) >= 800 then 'confirmed'
           else 'registered' end,
      (array['form','campaign','manual','import','portal'])[1 + (i % 5)],
      now() - ((29 - v_day) || ' days')::interval + ((i % 600) || ' minutes')::interval,
      (i % 1000) < 612,
      case when (i % 1000) < 612 then now() - ((29 - v_day) || ' days')::interval else null end,
      case when (i % 1000) < 612 then 900 + (i % 2400) else null end,
      (i % 3) <> 0,
      case when (i % 17) = 0 then 'in_progress' when (i % 23) = 0 then 'completed' else 'not_contacted' end,
      true,
      now() - ((29 - v_day) || ' days')::interval
    ) on conflict (event_id, email) do nothing;
  end loop;

  -- ------------------------------------------------ upcoming sessions (11)
  for i in 1..11 loop
    insert into public.event_sessions (
      workspace_id, event_id, title, session_type, start_at, end_at,
      position, room, status, is_public, created_by
    ) values (
      v_ws, v_big_events[1 + (i % array_length(v_big_events, 1))],
      (array['Registration & Networking','Opening Keynote','Product Roadmap','Networking Lunch',
             'Breakout Sessions','Closing Remarks','Customer Panel','Live Demo'])[1 + (i % 8)],
      (array['registration','keynote','session','break','panel','closing','demo','networking'])[1 + (i % 8)],
      now() + ((i * 2) || ' days')::interval + interval '9 hours',
      now() + ((i * 2) || ' days')::interval + interval '10 hours',
      i, (array['Main Lobby','Grand Ballroom','Rooftop Terrace','Rooms A, B, C'])[1 + (i % 4)],
      'upcoming', true, v_owner
    );
  end loop;

  -- ----------------------------------------------------- sponsors & revenue
  -- Fictional companies only. Contracted/active value signed inside the last
  -- 30 days carries the revenue; open stages carry the pipeline.
  for i in 1..44 loop
    insert into public.sponsors (workspace_id, name, company_name, industry,
                                 primary_contact_name, primary_contact_email, owner_id, is_demo)
    values (
      v_ws,
      v_companies[1 + (i % 10)] || ' ' || (array['Group','Labs','Partners','Digital'])[1 + (i % 4)],
      v_companies[1 + (i % 10)],
      (array['Software','Data','Financial Services','Retail','Healthcare'])[1 + (i % 5)],
      v_first_names[1 + (i % 30)] || ' ' || v_last_names[1 + (i % 20)],
      'sponsor.demo' || i || '@example.com', v_owner, true
    ) returning id into v_sponsor_id;

    v_stage := case when i <= 18 then (array['contracted','active','completed'])[1 + (i % 3)]
                    when i <= 36 then (array['prospect','contacted','proposal','negotiation','verbal'])[1 + (i % 5)]
                    else 'renewal' end;
    v_value := case when i <= 18 then (array[12000,18500,25000,9450,35000,15000])[1 + (i % 6)]
                    else (array[45000,60000,80000,35000,120000])[1 + (i % 5)] end;

    insert into public.sponsorships (
      workspace_id, sponsor_id, event_id, tier, value, currency, stage, status,
      proposal_sent_at, contract_signed_at, activation_start_at, renewal_due_at,
      payment_status, owner_id, is_demo, created_at
    ) values (
      v_ws, v_sponsor_id, v_big_events[1 + (i % array_length(v_big_events, 1))],
      (array['premier','platinum','gold','silver','bronze'])[1 + (i % 5)],
      v_value, 'GBP', v_stage,
      case when v_stage in ('active','contracted') then 'active'
           when v_stage = 'completed' then 'completed' else 'in_progress' end,
      now() - ((30 + i) || ' days')::interval,
      case when i <= 18 then now() - (i || ' days')::interval else null end,
      case when i <= 18 then now() - ((i - 5) || ' days')::interval else null end,
      now() + ((60 + i * 3) || ' days')::interval,
      case when i <= 18 then 'paid' else 'not_invoiced' end,
      v_owner, true, now() - ((i + 10) || ' days')::interval
    ) returning id into v_sponsorship_id;

    for n in 1..4 loop
      insert into public.sponsorship_deliverables (
        workspace_id, sponsorship_id, title, deliverable_type, status, due_at, completed_at, owner_id
      ) values (
        v_ws, v_sponsorship_id,
        (array['Logo Placement','Speaking Opportunity','Email Mention','Social Media Post'])[n],
        (array['logo_placement','speaking_slot','email_mention','social_post'])[n],
        case when (i + n) % 5 < 3 then 'completed' when (i + n) % 5 = 3 then 'in_progress' else 'planned' end,
        now() + (((n * 6) - (i % 20)) || ' days')::interval,
        case when (i + n) % 5 < 3 then now() - ((i % 12) || ' days')::interval else null end,
        v_owner
      );
    end loop;
  end loop;

  -- replace the v1 real-trademark sponsor names with fictional equivalents
  update public.sponsors set name = 'Northwind Cloud',  company_name = 'Northwind Cloud'  where workspace_id = v_ws and name ilike 'slack%';
  update public.sponsors set name = 'Halcyon Data',     company_name = 'Halcyon Data'     where workspace_id = v_ws and (name ilike 'amazon%' or name ilike 'aws%');
  update public.sponsors set name = 'Beacon CRM',       company_name = 'Beacon CRM'       where workspace_id = v_ws and name ilike 'hubspot%';
  update public.sponsors set name = 'Lumen Analytics',  company_name = 'Lumen Analytics'  where workspace_id = v_ws and name ilike 'snowflake%';

  -- ------------------------------------------------- follow-up board (124)
  select id into v_seq_id from public.event_followup_sequences
  where workspace_id = v_ws order by created_at limit 1;

  for i in 1..124 loop
    insert into public.event_followup_tasks (
      workspace_id, event_id, sequence_id, title, status, priority, due_at,
      completed_at, owner_id, position, outcome, is_demo, created_by, created_at
    ) values (
      v_ws, v_big_events[1 + (i % array_length(v_big_events, 1))], v_seq_id,
      (array['Follow up with','Reach out to','Check in with','Send case study to','Book a call with'])[1 + (i % 5)]
        || ' ' || v_first_names[1 + (i % 30)] || ' ' || v_last_names[1 + ((i / 5) % 20)],
      case when i <= 32 then 'not_started'
           when i <= 60 then 'in_progress'
           when i <= 78 then 'waiting'
           else 'completed' end,
      (array['low','medium','high','urgent'])[1 + (i % 4)],
      now() + (((i % 21) - 7) || ' days')::interval,
      case when i > 78 then now() - ((i % 14) || ' days')::interval else null end,
      v_owner, i,
      case when i > 78 then (array['replied','meeting_booked','converted','no_response'])[1 + (i % 4)] else null end,
      true, v_owner, now() - ((i % 28) || ' days')::interval
    );
  end loop;

  -- --------------------------------------------------------- podcast depth
  select id into v_show_id from public.podcast_shows where workspace_id = v_ws order by created_at limit 1;

  update public.podcast_episodes set cover_image_url = '/demo/events/growth-dialogues.jpg'    where workspace_id = v_ws and title ilike '%Growth Dialogues%';
  update public.podcast_episodes set cover_image_url = '/demo/events/saas-insights.jpg'       where workspace_id = v_ws and title ilike '%SaaS Insights%';
  update public.podcast_episodes set cover_image_url = '/demo/events/founder-stories.jpg'     where workspace_id = v_ws and title ilike '%Founder Stories%';
  update public.podcast_episodes set cover_image_url = '/demo/events/marketing-unplugged.jpg' where workspace_id = v_ws and title ilike '%Marketing Unplugged%';

  if v_show_id is not null then
    for i in 1..14 loop
      insert into public.podcast_episodes (
        workspace_id, show_id, episode_number, title, summary, status, recording_type,
        studio_location, scheduled_at, recorded_at, published_at, duration_seconds,
        distribution_state, listens, unique_listeners, completion_rate,
        cover_image_url, owner_id, created_by, is_demo, created_at
      ) values (
        v_ws, v_show_id, 40 + i,
        (array['The Future of AI in Marketing','Building High-Performing Teams','SaaS Growth Playbook',
               'Customer Success Stories','Product-Led Growth Tactics','Pricing That Scales',
               'Content Engines That Compound'])[1 + (i % 7)],
        'Demo episode seeded for the Events module.',
        'published', (array['in_studio','remote','live'])[1 + (i % 3)],
        (array['Studio A','Studio B','Remote — Riverside'])[1 + (i % 3)],
        now() - ((i * 7 + 3) || ' days')::interval,
        now() - ((i * 7 + 2) || ' days')::interval,
        now() - ((i * 7) || ' days')::interval,
        1800 + (i % 6) * 420, 'published',
        (array[22341,18972,15403,12880,9764,8420,7310])[1 + (i % 7)],
        (array[16200,13900,11400,9100,7200,6100,5300])[1 + (i % 7)],
        0.55 + ((i % 20)::numeric / 100),
        '/demo/events/' || (array['growth-dialogues','saas-insights','founder-stories','marketing-unplugged'])[1 + (i % 4)] || '.jpg',
        v_owner, v_owner, true, now() - ((i * 7) || ' days')::interval
      );
    end loop;
  end if;

  -- ------------------------------------------------------------- activity
  insert into public.event_activity (workspace_id, event_id, entity_type, action, summary, actor_name, created_at)
  select v_ws, v_big_events[1 + (g % array_length(v_big_events, 1))],
    (array['registration','sponsorship','followup_task','session','registration'])[1 + (g % 5)],
    (array['created','received','completed','updated','created'])[1 + (g % 5)],
    (array['Emily Carter registered for Product Summit 2024',
           'Northwind Cloud committed £15,000',
           'Sent post-event survey to 320 attendees',
           'Opening Keynote time changed to 10:00',
           'Michael Chen registered for AI Marketing Trends'])[1 + (g % 5)],
    (array['System','Michael Chen','System','Sarah Johnson','System'])[1 + (g % 5)],
    now() - ((g * 37) || ' minutes')::interval
  from generate_series(1, 12) g;

end $$;
