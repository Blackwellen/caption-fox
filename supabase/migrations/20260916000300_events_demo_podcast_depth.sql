-- ============================================================
-- Events module — demo seed, podcast depth.
--
-- The Podcasts route needs three things the earlier seeds did not provide:
--   * podcast_listener_daily rows — the Listener Trends chart reads a daily
--     series, not episode totals, so it cliffed to zero after the last
--     published episode;
--   * run-of-show segments on a podcast event (offset-based, not clock-based);
--   * podcast_read deliverables, which is what "Sponsor Slots" counts.
--
-- Episode titles are also made unique — cycling seven titles across fourteen
-- episodes made "Top Episodes by Listens" list the same show repeatedly.
--
-- Idempotent: guarded on the listener series it writes.
-- ============================================================

do $$
declare
  v_ws uuid;
  v_owner uuid;
  v_show uuid;
  v_ep uuid;
  v_event uuid;
  v_sponsorships uuid[];
  i int;
  v_base int;
begin
  select id, owner_id into v_ws, v_owner from public.workspaces
  where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_ws is null then return; end if;

  -- Guard on the current-day rows this seeder always writes (the v1 seed's
  -- 30 days stop well short of today).
  if exists (
    select 1 from public.podcast_listener_daily
    where workspace_id = v_ws and day >= current_date - 1
  ) then
    return;
  end if;

  -- Clear the stale v1 partial series so the 60-day curve is continuous.
  delete from public.podcast_listener_daily where workspace_id = v_ws;

  select id into v_show from public.podcast_shows where workspace_id = v_ws order by created_at limit 1;
  if v_show is null then return; end if;

  -- 1. Unique episode titles + varied listen counts.
  for i in 0..60 loop
    select id into v_ep from public.podcast_episodes
    where workspace_id = v_ws and is_demo = true
    order by episode_number nulls last, created_at
    offset i limit 1;
    exit when v_ep is null;
    update public.podcast_episodes
    set title = (array[
          'The Future of AI in Marketing','Building High-Performing Teams','SaaS Growth Playbook',
          'Customer Success Stories','Product-Led Growth Tactics','Pricing That Scales',
          'Content Engines That Compound','Brand Voice at Scale','Retention Is the New Growth',
          'From Launch to Lifecycle','The Data-Informed Marketer','Community as a Channel',
          'Positioning for Crowded Markets','Lifecycle Email That Converts','Events That Pay Back'
        ])[1 + (i % 15)] ||
        case when i >= 15 then ' (Part ' || (1 + i / 15) || ')' else '' end,
        listens = 4200 + ((abs(hashtext(v_ep::text)) % 190) * 100),
        unique_listeners = 3100 + ((abs(hashtext(v_ep::text)) % 140) * 100)
    where id = v_ep;
    v_ep := null;
  end loop;

  -- 2. Daily listener series for the last 60 days, gently rising so the
  --    30-day window shows real growth against the previous one.
  for i in 0..59 loop
    v_base := 2600 + (59 - i) * 38 + ((abs(hashtext((i || 'l')::text)) % 420));
    insert into public.podcast_listener_daily (
      workspace_id, show_id, day, listens, unique_listeners, completion_rate, source
    ) values (
      v_ws, v_show, (current_date - i),
      v_base,
      round(v_base * 0.72),
      0.60 + ((abs(hashtext((i || 'c')::text)) % 18)::numeric / 100),
      'provider'
    );
  end loop;

  -- 3. Episode run sheet: offsets, not wall-clock times.
  select id into v_event from public.events
  where workspace_id = v_ws and event_type = 'podcast' order by start_at desc nulls last limit 1;

  if v_event is not null and not exists (
    select 1 from public.event_sessions where event_id = v_event
  ) then
    insert into public.event_sessions (
      workspace_id, event_id, title, session_type, offset_seconds, position, room, status, is_public, created_by
    )
    select v_ws, v_event, t.title, t.stype, t.secs, t.pos, 'Studio A',
           case when t.pos <= 2 then 'completed' when t.pos = 3 then 'live' else 'upcoming' end,
           true, v_owner
    from (values
      ('Intro & Welcome','intro',0,0),
      ('Sponsor Read: Northwind Cloud','sponsor_read',150,1),
      ('Guest Intro','segment',300,2),
      ('Interview: Jane Smith','interview',360,3),
      ('Listener Q&A','qa',2700,4),
      ('Outro & Closing','outro',3300,5)
    ) as t(title, stype, secs, pos);
  end if;

  -- 4. Podcast read deliverables — what the Sponsor Slots KPI counts.
  select array_agg(id) into v_sponsorships from (
    select id from public.sponsorships
    where workspace_id = v_ws and stage in ('contracted','active','completed')
    order by created_at limit 18
  ) s;

  if v_sponsorships is not null then
    for i in 1..array_length(v_sponsorships, 1) loop
      insert into public.sponsorship_deliverables (
        workspace_id, sponsorship_id, title, deliverable_type, status, due_at, completed_at, owner_id
      ) values (
        v_ws, v_sponsorships[i], 'Podcast Read', 'podcast_read',
        case when i % 3 = 0 then 'completed' when i % 3 = 1 then 'in_progress' else 'planned' end,
        now() + ((i * 4) || ' days')::interval,
        case when i % 3 = 0 then now() - ((i) || ' days')::interval else null end,
        v_owner
      );
    end loop;
  end if;
end $$;
