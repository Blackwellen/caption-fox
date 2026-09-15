-- ============================================================
-- Events module — demo seed data.
--
-- Seeds the Brand demo workspace ('jamahl-thomas-campaign-manager-demo')
-- with realistic, is_demo=true records so the six Events routes render real
-- data rather than empty states on first load. Guarded so it is a no-op if
-- the demo workspace has not been provisioned yet (ensureDemoWorkspaces runs
-- on first login) or if it has already been seeded.
-- ============================================================

do $$
declare
  v_workspace_id uuid;
  v_owner_id uuid;

  v_event_summit uuid;
  v_event_webinar uuid;
  v_event_podcast uuid;
  v_event_customer_live uuid;
  v_event_roadmap uuid;
  v_event_roundtable uuid;
  v_event_partner uuid;
  v_event_q2webinar uuid;

  v_show_id uuid;
  v_episode1 uuid;
  v_episode2 uuid;
  v_episode3 uuid;
  v_episode4 uuid;

  v_sponsor_slack uuid;
  v_sponsor_aws uuid;
  v_sponsor_hubspot uuid;
  v_sponsor_snowflake uuid;

  v_sponsorship_slack uuid;
  v_sponsorship_aws uuid;
  v_sponsorship_hubspot uuid;
  v_sponsorship_snowflake uuid;

  v_sequence_id uuid;
  v_reg_id uuid;
  i int;
  d date;
begin
  select id, owner_id into v_workspace_id, v_owner_id
  from public.workspaces
  where slug = 'jamahl-thomas-campaign-manager-demo'
  limit 1;

  if v_workspace_id is null then
    return; -- demo workspace not provisioned yet — nothing to seed
  end if;

  if exists (select 1 from public.events where workspace_id = v_workspace_id and is_demo = true) then
    return; -- already seeded
  end if;

  -- ------------------------------------------------------------ events
  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, location_name, location_city, location_country, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Product Summit 2024', 'conference', 'in_person', 'live', now() - interval '2 hours', now() + interval '6 hours', 'America/Los_Angeles', 'Moscone Center', 'San Francisco, CA', 'USA', 1500, v_owner_id, true)
  returning id into v_event_summit;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, online_platform, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Webinar: AI Marketing Trends', 'webinar', 'virtual', 'upcoming', now() + interval '4 days' + interval '11 hours', now() + interval '4 days' + interval '12 hours', 'America/Los_Angeles', 'Zoom', 500, v_owner_id, true)
  returning id into v_event_webinar;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, online_platform, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Podcast: CX Leaders', 'podcast', 'virtual', 'upcoming', now() + interval '7 days' + interval '10 hours', now() + interval '7 days' + interval '11 hours', 'America/Los_Angeles', 'Online Recording', 200, v_owner_id, true)
  returning id into v_event_podcast;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, location_name, location_city, location_country, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Customer Success Live', 'in_person', 'in_person', 'completed', now() - interval '17 days', now() - interval '17 days' + interval '8 hours', 'America/New_York', 'Javits Center', 'New York, NY', 'USA', 1100, v_owner_id, true)
  returning id into v_event_customer_live;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, online_platform, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Webinar: Product Roadmap', 'webinar', 'virtual', 'upcoming', now() + interval '25 days', now() + interval '25 days' + interval '1 hour', 'America/Los_Angeles', 'Zoom', 400, v_owner_id, true)
  returning id into v_event_roadmap;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, location_name, location_city, location_country, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Executive Roundtable', 'roundtable', 'in_person', 'draft', null, null, 'America/Chicago', null, 'Chicago, IL', 'USA', 40, v_owner_id, true)
  returning id into v_event_roundtable;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, location_name, location_city, location_country, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Partner Enablement Summit', 'partner_event', 'in_person', 'upcoming', now() + interval '38 days', now() + interval '38 days' + interval '7 hours', 'America/Chicago', 'Austin Convention Center', 'Austin, TX', 'USA', 300, v_owner_id, true)
  returning id into v_event_partner;

  insert into public.events (id, workspace_id, name, event_type, format, status, start_at, end_at, timezone, online_platform, capacity, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Q2 Webinar: Product Updates', 'webinar', 'virtual', 'cancelled', now() + interval '45 days', now() + interval '45 days' + interval '1 hour', 'America/Los_Angeles', 'Zoom', 300, v_owner_id, true)
  returning id into v_event_q2webinar;

  -- ------------------------------------------------------------ sessions / run of show (Product Summit — today)
  insert into public.event_sessions (workspace_id, event_id, title, session_type, start_at, end_at, position, room, status)
  values
    (v_workspace_id, v_event_summit, 'Registration & Networking', 'registration', date_trunc('day', now()) + interval '9 hours', date_trunc('day', now()) + interval '10 hours', 0, 'Main Lobby', 'completed'),
    (v_workspace_id, v_event_summit, 'Opening Keynote', 'keynote', date_trunc('day', now()) + interval '10 hours', date_trunc('day', now()) + interval '11 hours', 1, 'Grand Ballroom', 'live'),
    (v_workspace_id, v_event_summit, 'Product Roadmap', 'session', date_trunc('day', now()) + interval '11.5 hours', date_trunc('day', now()) + interval '12.5 hours', 2, 'Grand Ballroom', 'upcoming'),
    (v_workspace_id, v_event_summit, 'Networking Lunch', 'networking', date_trunc('day', now()) + interval '13 hours', date_trunc('day', now()) + interval '14 hours', 3, 'Rooftop Terrace', 'upcoming'),
    (v_workspace_id, v_event_summit, 'Breakout Sessions', 'session', date_trunc('day', now()) + interval '14.5 hours', date_trunc('day', now()) + interval '15.5 hours', 4, 'Rooms A, B, C', 'upcoming'),
    (v_workspace_id, v_event_summit, 'Closing Remarks', 'closing', date_trunc('day', now()) + interval '16.5 hours', date_trunc('day', now()) + interval '17 hours', 5, 'Grand Ballroom', 'upcoming');

  insert into public.event_sessions (workspace_id, event_id, title, session_type, start_at, end_at, position, status)
  values
    (v_workspace_id, v_event_webinar, 'Welcome & Opening Remarks', 'intro', now() + interval '4 days' + interval '11 hours', now() + interval '4 days' + interval '11 hours 10 minutes', 0, 'upcoming'),
    (v_workspace_id, v_event_webinar, 'Market Trends in 2024', 'session', now() + interval '4 days' + interval '11 hours 10 minutes', now() + interval '4 days' + interval '11 hours 40 minutes', 1, 'upcoming'),
    (v_workspace_id, v_event_webinar, 'Product Demo', 'demo', now() + interval '4 days' + interval '11 hours 40 minutes', now() + interval '4 days' + interval '12 hours 10 minutes', 2, 'upcoming'),
    (v_workspace_id, v_event_webinar, 'Customer Success Story', 'session', now() + interval '4 days' + interval '12 hours 10 minutes', now() + interval '4 days' + interval '12 hours 40 minutes', 3, 'upcoming'),
    (v_workspace_id, v_event_webinar, 'Q&A Session', 'qa', now() + interval '4 days' + interval '12 hours 40 minutes', now() + interval '4 days' + interval '13 hours', 4, 'upcoming'),
    (v_workspace_id, v_event_webinar, 'Closing Remarks', 'closing', now() + interval '4 days' + interval '13 hours', now() + interval '4 days' + interval '13 hours 10 minutes', 5, 'upcoming');

  -- ------------------------------------------------------------ speakers
  insert into public.event_speakers (workspace_id, event_id, full_name, job_title, company, speaker_role, confirmation_status, position)
  values
    (v_workspace_id, v_event_webinar, 'Emily Carter', 'Marketing Director', 'Acme Corp', 'host', 'confirmed', 0),
    (v_workspace_id, v_event_webinar, 'Michael Chen', 'Product Manager', 'Acme Corp', 'speaker', 'confirmed', 1),
    (v_workspace_id, v_event_webinar, 'Jessica Hill', 'Customer Success Lead', 'Acme Corp', 'speaker', 'confirmed', 2),
    (v_workspace_id, v_event_summit, 'Sarah Johnson', 'Marketing Director', 'Acme Corp', 'host', 'confirmed', 0);

  -- ------------------------------------------------------------ registrations (realistic volume)
  for i in 1..48 loop
    insert into public.event_registrations (workspace_id, event_id, full_name, email, status, source, registered_at, attended, follow_up_status, is_demo)
    values (
      v_workspace_id, v_event_summit,
      'Summit Attendee ' || i, 'summit.attendee' || i || '@example.com',
      case when i <= 34 then 'attended' when i <= 44 then 'confirmed' else 'no_show' end,
      case when i % 3 = 0 then 'campaign' when i % 3 = 1 then 'form' else 'manual' end,
      now() - (interval '1 day' * (48 - i)),
      i <= 34,
      case when i % 5 = 0 then 'completed' when i % 5 = 1 then 'in_progress' else 'not_contacted' end,
      true
    );
  end loop;

  for i in 1..18 loop
    insert into public.event_registrations (workspace_id, event_id, full_name, email, status, source, registered_at, attended, is_demo)
    values (
      v_workspace_id, v_event_webinar,
      'Webinar Registrant ' || i, 'webinar.registrant' || i || '@example.com',
      'registered', 'form', now() - (interval '1 day' * (18 - i)), false, true
    );
  end loop;

  for i in 1..36 loop
    insert into public.event_registrations (workspace_id, event_id, full_name, email, status, source, registered_at, attended, follow_up_status, is_demo)
    values (
      v_workspace_id, v_event_customer_live,
      'Customer Live Attendee ' || i, 'customer.live' || i || '@example.com',
      case when i <= 29 then 'attended' else 'no_show' end,
      'manual', now() - interval '17 days' - (interval '1 hour' * i), i <= 29,
      case when i % 4 = 0 then 'completed' else 'not_contacted' end,
      true
    );
  end loop;

  -- ------------------------------------------------------------ webinar detail + questions
  insert into public.webinar_details (event_id, workspace_id, provider, provider_status, topic, will_record, recording_state, avg_watch_seconds, questions_count)
  values (v_event_webinar, v_workspace_id, 'zoom', 'connected', 'AI Marketing Trends for 2024', true, 'scheduled', 2532, 3);

  insert into public.webinar_details (event_id, workspace_id, provider, provider_status, will_record, recording_state)
  values (v_event_roadmap, v_workspace_id, 'teams', 'not_connected', true, 'none');

  insert into public.webinar_questions (workspace_id, event_id, asked_by_name, question, status, created_at)
  values
    (v_workspace_id, v_event_webinar, 'David Lee', 'Will the session be recorded and shared?', 'open', now() - interval '2 minutes'),
    (v_workspace_id, v_event_webinar, 'Priya Sharma', 'Attendee joined the webinar', 'answered', now() - interval '5 minutes'),
    (v_workspace_id, v_event_webinar, 'Sarah Johnson', 'Can you share more about the integration?', 'open', now() - interval '8 minutes');

  -- ------------------------------------------------------------ podcast show + episodes
  insert into public.podcast_shows (id, workspace_id, name, category, distribution_provider, provider_status, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'The Growth Dialogues', 'Marketing', 'spotify', 'connected', v_owner_id, true)
  returning id into v_show_id;

  insert into public.podcast_episodes (id, workspace_id, show_id, episode_number, title, status, recording_type, studio_location, scheduled_at, listens, unique_listeners, completion_rate, distribution_state, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_show_id, 56, 'The Growth Dialogues', 'recording', 'in_studio', 'Studio A', now(), 22341, 15200, 0.71, 'not_distributed', v_owner_id, true)
  returning id into v_episode1;

  insert into public.podcast_episodes (id, workspace_id, show_id, episode_number, title, status, recording_type, studio_location, scheduled_at, listens, unique_listeners, distribution_state, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_show_id, 57, 'SaaS Insights', 'scheduled', 'remote', 'Remote', now() + interval '3 days', 0, 0, 'not_distributed', v_owner_id, true)
  returning id into v_episode2;

  insert into public.podcast_episodes (id, workspace_id, show_id, episode_number, title, status, recording_type, studio_location, scheduled_at, listens, distribution_state, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_show_id, 58, 'Founder Stories', 'draft', 'in_studio', 'Studio B', now() + interval '6 days', 0, 'not_distributed', v_owner_id, true)
  returning id into v_episode3;

  insert into public.podcast_episodes (id, workspace_id, show_id, episode_number, title, status, recording_type, scheduled_at, published_at, listens, unique_listeners, completion_rate, distribution_state, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_show_id, 55, 'Marketing Unplugged', 'published', 'in_studio', now() - interval '6 days', now() - interval '6 days', 14892, 10440, 0.68, 'published', v_owner_id, true)
  returning id into v_episode4;

  insert into public.podcast_episode_guests (workspace_id, episode_id, full_name, job_title, company, confirmation_status)
  values
    (v_workspace_id, v_episode1, 'Jane Smith', 'CEO', 'TechFlow', 'confirmed'),
    (v_workspace_id, v_episode2, 'Mark Johnson', 'CTO', 'CloudScale', 'confirmed'),
    (v_workspace_id, v_episode3, 'Lisa Chen', 'Founder', 'NovaLabs', 'tentative'),
    (v_workspace_id, v_episode4, 'Tom Williams', 'CMO', 'BrightWave', 'confirmed');

  insert into public.event_sessions (workspace_id, event_id, title, session_type, offset_seconds, position, status)
  select v_workspace_id, v_event_podcast, s.title, s.session_type, s.offset_seconds, s.position, s.status
  from (values
    ('Intro & Welcome', 'intro', 0, 0, 'completed'),
    ('Sponsor Read: TechFlow', 'sponsor_read', 150, 1, 'completed'),
    ('Guest Intro', 'intro', 300, 2, 'completed'),
    ('Interview: Jane Smith', 'interview', 360, 3, 'live'),
    ('Listener Q&A', 'qa', 2700, 4, 'upcoming'),
    ('Outro & Closing', 'outro', 3300, 5, 'upcoming')
  ) as s(title, session_type, offset_seconds, position, status);

  for i in 0..29 loop
    d := (current_date - i);
    insert into public.podcast_listener_daily (workspace_id, show_id, episode_id, day, listens, unique_listeners, completion_rate, source)
    values (v_workspace_id, v_show_id, null, d, 3000 + (i * 37) % 900, 2100 + (i * 23) % 600, 0.65 + (i % 10) * 0.01, 'provider');
  end loop;

  -- ------------------------------------------------------------ sponsors + sponsorships
  insert into public.sponsors (id, workspace_id, name, company_name, industry, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Slack', 'Slack Technologies', 'Collaboration software', v_owner_id, true) returning id into v_sponsor_slack;
  insert into public.sponsors (id, workspace_id, name, company_name, industry, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Amazon Web Services', 'AWS', 'Cloud infrastructure', v_owner_id, true) returning id into v_sponsor_aws;
  insert into public.sponsors (id, workspace_id, name, company_name, industry, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'HubSpot', 'HubSpot Inc.', 'Marketing software', v_owner_id, true) returning id into v_sponsor_hubspot;
  insert into public.sponsors (id, workspace_id, name, company_name, industry, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, 'Snowflake', 'Snowflake Inc.', 'Data cloud', v_owner_id, true) returning id into v_sponsor_snowflake;

  insert into public.sponsorships (id, workspace_id, sponsor_id, event_id, tier, value, currency, stage, status, contract_signed_at, activation_start_at, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_sponsor_slack, v_event_summit, 'premier', 75000, 'GBP', 'active', 'active', now() - interval '40 days', now() - interval '2 hours', v_owner_id, true)
  returning id into v_sponsorship_slack;

  insert into public.sponsorships (id, workspace_id, sponsor_id, event_id, tier, value, currency, stage, status, contract_signed_at, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_sponsor_aws, v_event_summit, 'premier', 100000, 'GBP', 'active', 'active', now() - interval '35 days', v_owner_id, true)
  returning id into v_sponsorship_aws;

  insert into public.sponsorships (id, workspace_id, sponsor_id, event_id, tier, value, currency, stage, status, contract_signed_at, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_sponsor_hubspot, v_event_partner, 'gold', 50000, 'GBP', 'contracted', 'active', now() - interval '10 days', v_owner_id, true)
  returning id into v_sponsorship_hubspot;

  insert into public.sponsorships (id, workspace_id, sponsor_id, event_id, tier, value, currency, stage, status, owner_id, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_sponsor_snowflake, v_event_customer_live, 'silver', 25000, 'GBP', 'negotiation', 'in_progress', v_owner_id, true)
  returning id into v_sponsorship_snowflake;

  insert into public.sponsorship_deliverables (workspace_id, sponsorship_id, title, deliverable_type, status, due_at, completed_at)
  values
    (v_workspace_id, v_sponsorship_slack, 'Logo Placement', 'logo_placement', 'completed', now() - interval '5 days', now() - interval '5 days'),
    (v_workspace_id, v_sponsorship_slack, 'Speaking Slot', 'speaking_slot', 'completed', now() - interval '3 days', now() - interval '3 days'),
    (v_workspace_id, v_sponsorship_slack, 'Booth', 'booth', 'in_progress', now() + interval '1 day', null),
    (v_workspace_id, v_sponsorship_aws, 'Logo Placement', 'logo_placement', 'completed', now() - interval '6 days', now() - interval '6 days'),
    (v_workspace_id, v_sponsorship_aws, 'Keynote Introduction', 'speaking_slot', 'planned', now() + interval '2 days', null),
    (v_workspace_id, v_sponsorship_hubspot, 'Sponsor Webinar', 'sponsored_session', 'in_progress', now() + interval '9 days', null),
    (v_workspace_id, v_sponsorship_snowflake, 'Networking Lounge Branding', 'content_placement', 'planned', now() + interval '15 days', null);

  -- ------------------------------------------------------------ follow-up sequence, steps, tasks
  insert into public.event_followup_sequences (id, workspace_id, event_id, name, status, conversion_goal, owner_id, created_by, is_demo)
  values (gen_random_uuid(), v_workspace_id, v_event_webinar, 'AI Marketing Trends Webinar', 'active', 'meeting_booked', v_owner_id, v_owner_id, true)
  returning id into v_sequence_id;

  insert into public.event_followup_steps (workspace_id, sequence_id, position, delay_days, step_type, title, body)
  values
    (v_workspace_id, v_sequence_id, 0, 0, 'email', 'Thank You Email', 'Send a personalised thank you and share event resources.'),
    (v_workspace_id, v_sequence_id, 1, 2, 'email', 'Value Follow-up', 'Share relevant content and insights that align with their interests.'),
    (v_workspace_id, v_sequence_id, 2, 5, 'email', 'Engagement Email', 'Invite to connect, share a case study, or offer a helpful resource.'),
    (v_workspace_id, v_sequence_id, 3, 10, 'task', 'Personal Outreach', 'Reach out directly to start a conversation or schedule a call.'),
    (v_workspace_id, v_sequence_id, 4, 20, 'email', 'Re-engagement', 'Check in, share new updates, and invite to upcoming events.');

  insert into public.event_followup_tasks (workspace_id, event_id, sequence_id, title, status, priority, due_at, owner_id, position, is_demo, created_by)
  values
    (v_workspace_id, v_event_summit, v_sequence_id, 'Follow up with Emily Carter', 'not_started', 'high', current_date + 0, v_owner_id, 0, true, v_owner_id),
    (v_workspace_id, v_event_summit, null, 'Reach out to James Wilson', 'not_started', 'medium', current_date + 0, v_owner_id, 1, true, v_owner_id),
    (v_workspace_id, v_event_summit, null, 'Connect with Olivia Brown', 'not_started', 'medium', current_date + 1, v_owner_id, 2, true, v_owner_id),
    (v_workspace_id, v_event_webinar, v_sequence_id, 'Follow up with Michael Chen', 'in_progress', 'high', current_date - 1, v_owner_id, 0, true, v_owner_id),
    (v_workspace_id, v_event_webinar, v_sequence_id, 'Check in with Sophia Martinez', 'in_progress', 'medium', current_date - 1, v_owner_id, 1, true, v_owner_id),
    (v_workspace_id, v_event_podcast, null, 'Send case study to Alex Johnson', 'in_progress', 'medium', current_date + 0, v_owner_id, 2, true, v_owner_id),
    (v_workspace_id, v_event_summit, null, 'Waiting for reply from David Lee', 'waiting', 'low', current_date - 2, v_owner_id, 0, true, v_owner_id),
    (v_workspace_id, v_event_webinar, null, 'Follow up next week', 'waiting', 'low', current_date + 4, v_owner_id, 1, true, v_owner_id),
    (v_workspace_id, v_event_roadmap, null, 'Proposal follow-up', 'waiting', 'medium', current_date + 5, v_owner_id, 2, true, v_owner_id),
    (v_workspace_id, v_event_summit, v_sequence_id, 'Intro call with Sarah Thompson', 'completed', 'high', current_date - 2, v_owner_id, 0, true, v_owner_id),
    (v_workspace_id, v_event_webinar, v_sequence_id, 'Demo completed with TechFlow', 'completed', 'high', current_date - 8, v_owner_id, 1, true, v_owner_id),
    (v_workspace_id, v_event_partner, null, 'Contract sent to Acme Corp', 'completed', 'medium', current_date - 9, v_owner_id, 2, true, v_owner_id);

  -- ------------------------------------------------------------ outreach events (30-day trend + response funnel)
  for i in 0..29 loop
    d := current_date - i;
    for i in 1..(6 + (i % 4)) loop
      insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
      values (v_workspace_id, v_event_webinar, v_sequence_id, 'email_sent', d + interval '9 hours');
    end loop;
  end loop;

  insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
  select v_workspace_id, v_event_webinar, v_sequence_id, 'email_opened', current_date - (n % 25) + interval '10 hours'
  from generate_series(1, 78) as n;

  insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
  select v_workspace_id, v_event_webinar, v_sequence_id, 'email_replied', current_date - (n % 20) + interval '11 hours'
  from generate_series(1, 15) as n;

  insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
  select v_workspace_id, v_event_webinar, v_sequence_id, 'meeting_booked', current_date - (n % 15) + interval '13 hours'
  from generate_series(1, 7) as n;

  insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
  select v_workspace_id, v_event_webinar, v_sequence_id, 'converted', current_date - (n % 18) + interval '14 hours'
  from generate_series(1, 4) as n;

  -- ------------------------------------------------------------ activity feed
  insert into public.event_activity (workspace_id, event_id, entity_type, action, summary, href, actor_name, created_at)
  values
    (v_workspace_id, v_event_summit, 'registration', 'created', 'Emily Carter registered for Product Summit 2024', null, 'System', now() - interval '2 minutes'),
    (v_workspace_id, v_event_summit, 'sponsorship', 'received', 'TechFlow Inc. committed $15,000', null, 'Michael Chen', now() - interval '18 minutes'),
    (v_workspace_id, v_event_webinar, 'followup_task', 'completed', 'Sent post-event survey to 320 attendees', null, 'System', now() - interval '45 minutes'),
    (v_workspace_id, v_event_webinar, 'registration', 'created', 'Michael Chen registered for Webinar: AI Trends', null, 'System', now() - interval '1 hour'),
    (v_workspace_id, v_event_summit, 'session', 'updated', 'Opening Keynote time changed to 10:00 AM', null, 'Sarah Johnson', now() - interval '2 hours');

  -- ------------------------------------------------------------ gala dock link state (not connected by default)
  insert into public.gala_dock_workspace_links (workspace_id, connection_status, sync_status)
  values (v_workspace_id, 'not_connected', 'idle')
  on conflict (workspace_id) do nothing;

end $$;
