-- ============================================================
-- PR & Reputation module — demo seed data.
--
-- Seeds the Brand and Agency demo workspaces with realistic,
-- is_demo=true records so the seven PR & Reputation routes render
-- real data rather than empty states on first load. No-op if the
-- demo workspace has not been provisioned yet, or already seeded.
-- ============================================================

do $$
declare
  v_workspace_id uuid;
  v_owner_id uuid;
  v_slug text;

  v_outlet_techcrunch uuid;
  v_outlet_marketingweek uuid;
  v_outlet_socialmediatoday uuid;
  v_outlet_thedrum uuid;

  v_contact_amara uuid;
  v_contact_leo uuid;
  v_contact_priya uuid;
  v_contact_ben uuid;

  v_list_tier1 uuid;
  v_list_marketing uuid;

  v_pitch_launch uuid;
  v_pitch_feature uuid;

  v_pr_launch uuid;
  v_pr_funding uuid;

  v_incident_id uuid;
begin
  foreach v_slug in array array['jamahl-thomas-campaign-manager-demo', 'jamahl-thomas-agency-demo']
  loop
    select id, owner_id into v_workspace_id, v_owner_id
    from public.workspaces
    where slug = v_slug
    limit 1;

    if v_workspace_id is null then
      continue; -- demo workspace not provisioned yet
    end if;

    if exists (select 1 from public.media_contacts where workspace_id = v_workspace_id and is_demo = true) then
      continue; -- already seeded
    end if;

    -- ------------------------------------------------------------ outlets
    insert into public.media_outlets (id, workspace_id, name, domain, outlet_type, region, topics, estimated_audience, authority_score, is_demo)
    values
      (uuid_generate_v4(), v_workspace_id, 'TechCrunch', 'techcrunch.com', 'online', 'Global', array['startups','saas','marketing tech'], 18000000, 92.5, true),
      (uuid_generate_v4(), v_workspace_id, 'Marketing Week', 'marketingweek.com', 'online', 'UK', array['marketing','brand'], 1200000, 81.0, true),
      (uuid_generate_v4(), v_workspace_id, 'Social Media Today', 'socialmediatoday.com', 'online', 'Global', array['social media','platforms'], 950000, 74.0, true),
      (uuid_generate_v4(), v_workspace_id, 'The Drum', 'thedrum.com', 'online', 'UK', array['advertising','media'], 800000, 76.5, true);

    select id into v_outlet_techcrunch from public.media_outlets where workspace_id = v_workspace_id and name = 'TechCrunch';
    select id into v_outlet_marketingweek from public.media_outlets where workspace_id = v_workspace_id and name = 'Marketing Week';
    select id into v_outlet_socialmediatoday from public.media_outlets where workspace_id = v_workspace_id and name = 'Social Media Today';
    select id into v_outlet_thedrum from public.media_outlets where workspace_id = v_workspace_id and name = 'The Drum';

    -- ------------------------------------------------------------ contacts
    insert into public.media_contacts (id, workspace_id, outlet_id, name, email, role_title, beat, region, relationship_stage, influence_score, tags, owner_id, source, verified, last_contacted_at, last_reply_at, is_demo, created_by)
    values
      (uuid_generate_v4(), v_workspace_id, v_outlet_techcrunch, 'Amara Chen', 'amara.chen@techcrunch.example', 'Senior Reporter', 'SaaS & Marketing Tech', 'US', 'warm', 87.0, array['tier-1','saas'], v_owner_id, 'manual', true, now() - interval '9 days', now() - interval '6 days', true, v_owner_id),
      (uuid_generate_v4(), v_workspace_id, v_outlet_marketingweek, 'Leo Whitfield', 'leo.whitfield@marketingweek.example', 'Features Editor', 'Brand & Marketing', 'UK', 'engaged', 74.0, array['brand'], v_owner_id, 'manual', true, now() - interval '20 days', null, true, v_owner_id),
      (uuid_generate_v4(), v_workspace_id, v_outlet_socialmediatoday, 'Priya Nair', 'priya.nair@smtoday.example', 'Staff Writer', 'Social Platforms', 'Global', 'contacted', 61.0, array['social'], v_owner_id, 'manual', false, now() - interval '3 days', null, true, v_owner_id),
      (uuid_generate_v4(), v_workspace_id, v_outlet_thedrum, 'Ben Osei', 'ben.osei@thedrum.example', 'News Editor', 'Advertising & Media', 'UK', 'champion', 90.0, array['tier-1','advertising'], v_owner_id, 'manual', true, now() - interval '45 days', now() - interval '40 days', true, v_owner_id);

    select id into v_contact_amara from public.media_contacts where workspace_id = v_workspace_id and name = 'Amara Chen';
    select id into v_contact_leo from public.media_contacts where workspace_id = v_workspace_id and name = 'Leo Whitfield';
    select id into v_contact_priya from public.media_contacts where workspace_id = v_workspace_id and name = 'Priya Nair';
    select id into v_contact_ben from public.media_contacts where workspace_id = v_workspace_id and name = 'Ben Osei';

    -- ------------------------------------------------------------ lists
    insert into public.media_lists (id, workspace_id, name, description, owner_id, region, beat, status, tags, is_demo, created_by)
    values
      (uuid_generate_v4(), v_workspace_id, 'Tier 1 Tech & Business', 'Top-tier journalists covering SaaS, startups and business.', v_owner_id, 'Global', 'Tech/Business', 'active', array['tier-1'], true, v_owner_id),
      (uuid_generate_v4(), v_workspace_id, 'Marketing & Social Press', 'Marketing trade press and social platform reporters.', v_owner_id, 'UK', 'Marketing', 'active', array['trade'], true, v_owner_id);

    select id into v_list_tier1 from public.media_lists where workspace_id = v_workspace_id and name = 'Tier 1 Tech & Business';
    select id into v_list_marketing from public.media_lists where workspace_id = v_workspace_id and name = 'Marketing & Social Press';

    insert into public.media_list_members (workspace_id, list_id, media_contact_id) values
      (v_workspace_id, v_list_tier1, v_contact_amara),
      (v_workspace_id, v_list_tier1, v_contact_ben),
      (v_workspace_id, v_list_marketing, v_contact_leo),
      (v_workspace_id, v_list_marketing, v_contact_priya)
    on conflict do nothing;

    -- ------------------------------------------------------------ pitches
    insert into public.pitches (id, workspace_id, list_id, name, subject, body, status, owner_id, approved_by, approved_at, sent_at, tags, is_demo, created_by)
    values
      (uuid_generate_v4(), v_workspace_id, v_list_tier1, 'Q3 Product Launch Pitch', 'Caption Fox launches AI-powered campaign workspace for brands', 'Hi {{first_name}}, wanted to flag our latest launch ahead of a wider announcement — happy to share an embargoed briefing.', 'sent', v_owner_id, v_owner_id, now() - interval '12 days', now() - interval '10 days', array['launch'], true, v_owner_id),
      (uuid_generate_v4(), v_workspace_id, v_list_marketing, 'Feature: State of Social 2026', 'Data drop: how brands are actually using social in 2026', 'Hi {{first_name}}, we surveyed 500+ marketers — thought this could be a useful data point for a feature.', 'pending_approval', v_owner_id, null, null, null, array['data','feature'], true, v_owner_id);

    select id into v_pitch_launch from public.pitches where workspace_id = v_workspace_id and name = 'Q3 Product Launch Pitch';
    select id into v_pitch_feature from public.pitches where workspace_id = v_workspace_id and name = 'Feature: State of Social 2026';

    insert into public.pitch_recipients (workspace_id, pitch_id, media_contact_id, delivery_status, sent_at, opened_at, replied_at, placed_at) values
      (v_workspace_id, v_pitch_launch, v_contact_amara, 'placed', now() - interval '10 days', now() - interval '9 days', now() - interval '9 days', now() - interval '7 days'),
      (v_workspace_id, v_pitch_launch, v_contact_ben, 'opened', now() - interval '10 days', now() - interval '8 days', null, null),
      (v_workspace_id, v_pitch_feature, v_contact_leo, 'pending', null, null, null, null),
      (v_workspace_id, v_pitch_feature, v_contact_priya, 'pending', null, null, null, null)
    on conflict do nothing;

    -- ------------------------------------------------------------ press releases + assets
    insert into public.press_releases (id, workspace_id, title, subtitle, body, category, status, author_id, publish_date, downloads, is_demo, created_by)
    values
      (uuid_generate_v4(), v_workspace_id, 'Caption Fox launches AI-powered campaign workspace', 'A single workspace for planning, creating and measuring brand campaigns', 'FOR IMMEDIATE RELEASE — Caption Fox today announced the general availability of its AI-powered campaign workspace...', 'Product', 'published', v_owner_id, current_date - 10, 214, true, v_owner_id),
      (uuid_generate_v4(), v_workspace_id, 'Caption Fox closes Series A funding round', 'Funding will accelerate product development and international expansion', 'FOR IMMEDIATE RELEASE — Caption Fox today announced it has closed a Series A funding round...', 'Company', 'draft', v_owner_id, null, 0, true, v_owner_id);

    select id into v_pr_launch from public.press_releases where workspace_id = v_workspace_id and title = 'Caption Fox launches AI-powered campaign workspace';
    select id into v_pr_funding from public.press_releases where workspace_id = v_workspace_id and title = 'Caption Fox closes Series A funding round';

    insert into public.press_room_assets (workspace_id, name, asset_type, downloads, is_demo, created_by) values
      (v_workspace_id, 'Primary logo (SVG)', 'logo', 58, true, v_owner_id),
      (v_workspace_id, 'Founder headshot', 'headshot', 22, true, v_owner_id),
      (v_workspace_id, 'Product screenshot pack', 'product', 41, true, v_owner_id),
      (v_workspace_id, 'Brand fact sheet (PDF)', 'document', 33, true, v_owner_id);

    -- ------------------------------------------------------------ coverage
    insert into public.coverage_mentions (workspace_id, outlet_id, publication, headline, url, published_at, topic, sentiment, sentiment_confidence, estimated_reach, backlinks, region, source_type, linked_pitch_id, linked_press_release_id, owner_id, status, is_demo, created_by)
    values
      (v_workspace_id, v_outlet_techcrunch, 'TechCrunch', 'Caption Fox raises the bar for AI campaign tooling', 'https://techcrunch.com/example/caption-fox-launch', now() - interval '7 days', 'Product Launch', 'positive', 0.91, 420000, 3, 'US', 'manual', v_pitch_launch, v_pr_launch, v_owner_id, 'verified', true, v_owner_id),
      (v_workspace_id, v_outlet_thedrum, 'The Drum', 'Brands are consolidating marketing stacks — Caption Fox is betting on it', 'https://thedrum.com/example/caption-fox', now() - interval '5 days', 'Product Launch', 'positive', 0.83, 96000, 1, 'UK', 'manual', v_pitch_launch, v_pr_launch, v_owner_id, 'verified', true, v_owner_id),
      (v_workspace_id, v_outlet_marketingweek, 'Marketing Week', 'What marketers actually want from campaign platforms in 2026', 'https://marketingweek.com/example/campaign-platforms', now() - interval '15 days', 'Industry Trend', 'neutral', 0.72, 64000, 0, 'UK', 'manual', null, null, v_owner_id, 'verified', true, v_owner_id),
      (v_workspace_id, v_outlet_socialmediatoday, 'Social Media Today', 'Reader complaints mount over new platform pricing changes', 'https://socialmediatoday.com/example/pricing-backlash', now() - interval '2 days', 'Pricing', 'negative', 0.68, 38000, 0, 'Global', 'manual', null, null, v_owner_id, 'tracked', true, v_owner_id);

    -- ------------------------------------------------------------ reviews
    insert into public.reviews (workspace_id, source, reviewer_name, rating, review_text, sentiment, issue_type, product_area, assignee_id, status, reviewed_at, is_demo) values
      (v_workspace_id, 'trustpilot', 'Chloe H.', 5.0, 'Switched our whole marketing team over — the campaign workspace alone saved us hours every week.', 'positive', null, 'Campaigns', v_owner_id, 'responded', now() - interval '4 days', true),
      (v_workspace_id, 'google', 'Marcus T.', 2.0, 'Good product but support response times have been slow this month.', 'negative', 'support_delay', 'Support', v_owner_id, 'in_progress', now() - interval '2 days', true),
      (v_workspace_id, 'trustpilot', 'Sana R.', 4.0, 'Solid feature set, onboarding could be smoother.', 'neutral', 'onboarding', 'Onboarding', null, 'new', now() - interval '1 days', true),
      (v_workspace_id, 'app_store', 'DevOpsFan22', 1.0, 'App crashed twice during a scheduled post — lost the draft.', 'negative', 'bug', 'Studio', v_owner_id, 'escalated', now() - interval '6 hours', true);

    insert into public.review_responses (workspace_id, review_id, draft_text, tone, status, author_id, published_at, version)
    select v_workspace_id, id, 'Thank you so much for the kind words, Chloe — really glad the workspace is saving your team time!', 'warm', 'published', v_owner_id, now() - interval '3 days', 1
    from public.reviews where workspace_id = v_workspace_id and reviewer_name = 'Chloe H.';

    -- ------------------------------------------------------------ crisis
    insert into public.crisis_incidents (id, workspace_id, title, description, severity, status, source, region, channels, owner_id, detected_at, is_demo, created_by)
    values (uuid_generate_v4(), v_workspace_id, 'Pricing change backlash on social', 'Negative sentiment spike following a pricing tier change announced this week; concentrated on social and one trade outlet.', 'medium', 'active_response', 'social_monitoring', 'Global', array['social','press'], v_owner_id, now() - interval '2 days', true, v_owner_id)
    returning id into v_incident_id;

    insert into public.crisis_timeline_events (workspace_id, incident_id, event_type, summary, actor_id, created_at) values
      (v_workspace_id, v_incident_id, 'detected', 'Negative sentiment spike detected across social monitoring.', null, now() - interval '2 days'),
      (v_workspace_id, v_incident_id, 'severity_changed', 'Severity set to Medium after initial assessment.', v_owner_id, now() - interval '2 days' + interval '2 hours'),
      (v_workspace_id, v_incident_id, 'statement_drafted', 'Holding statement drafted for review.', v_owner_id, now() - interval '1 days'),
      (v_workspace_id, v_incident_id, 'press_inquiry', 'Social Media Today reached out for comment.', null, now() - interval '18 hours');

    insert into public.crisis_statements (workspace_id, incident_id, status, body, version) values
      (v_workspace_id, v_incident_id, 'legal_review', 'We hear the feedback on our recent pricing update and are reviewing it closely. More details to follow shortly.', 1);

  end loop;
end $$;
