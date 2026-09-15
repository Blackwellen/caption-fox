-- ============================================================
-- Caption Fox — Community module demo seed
--
-- Populates realistic, clearly-flagged demo data (`is_demo = true` on every
-- row) for the "Jamahl Thomas Campaign Manager" demo workspace only — see
-- src/lib/demo-workspaces.ts for the workspace list. Real workspaces are
-- never touched by this script and render genuine empty states until they
-- create their own communities, members, events and programmes.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_community_module.sql
-- Idempotent: every insert is guarded by a `where not exists` on a natural
-- key, so running this file twice does not create duplicates.
-- ============================================================

do $$
declare
  v_workspace_id uuid;
  v_owner_id uuid;

  v_creator_circle uuid;
  v_brand_champions uuid;
  v_product_insiders uuid;
  v_social_growth_hub uuid;

  v_member_jessica uuid;
  v_member_daniel uuid;
  v_member_aisha uuid;
  v_member_mike uuid;
  v_member_taylor uuid;
  v_member_growth_hacker uuid;
  v_member_sarah uuid;

  v_report_1 uuid;
  v_report_2 uuid;

  v_program_ambassador uuid;
  v_program_referral uuid;
  v_program_ugc uuid;

  v_enrollment_1 uuid;
begin
  select id, owner_id into v_workspace_id, v_owner_id
  from public.workspaces where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;

  if v_workspace_id is null then
    raise notice 'Demo workspace jamahl-thomas-campaign-manager-demo not found — skipping Community seed.';
    return;
  end if;

  -- ============================================================
  -- Communities
  -- ============================================================
  insert into public.communities (workspace_id, name, slug, description, type, privacy, status, owner_id, region, tags, member_count, activity_level, engagement_rate, health_state, is_demo)
  select v_workspace_id, 'Creator Circle', 'creator-circle', 'Our most active creator community — collaboration, feedback and early access.', 'creator', 'public', 'active', v_owner_id, 'UK', '{"creators","featured"}', 4812, 'very_high', 8.9, 'excellent', true
  where not exists (select 1 from public.communities where workspace_id = v_workspace_id and slug = 'creator-circle')
  returning id into v_creator_circle;

  insert into public.communities (workspace_id, name, slug, description, type, privacy, status, owner_id, region, tags, member_count, activity_level, engagement_rate, health_state, is_demo)
  select v_workspace_id, 'Brand Champions', 'brand-champions', 'Invite-only community for our top brand advocates and ambassadors.', 'brand', 'private', 'active', v_owner_id, 'UK', '{"advocacy"}', 3456, 'high', 7.4, 'good', true
  where not exists (select 1 from public.communities where workspace_id = v_workspace_id and slug = 'brand-champions')
  returning id into v_brand_champions;

  insert into public.communities (workspace_id, name, slug, description, type, privacy, status, owner_id, region, tags, member_count, activity_level, engagement_rate, health_state, is_demo)
  select v_workspace_id, 'Product Insiders', 'product-insiders', 'Beta testers and product feedback community.', 'beta', 'private', 'active', v_owner_id, 'US', '{"beta"}', 2934, 'moderate', 6.1, 'average', true
  where not exists (select 1 from public.communities where workspace_id = v_workspace_id and slug = 'product-insiders')
  returning id into v_product_insiders;

  insert into public.communities (workspace_id, name, slug, description, type, privacy, status, owner_id, region, tags, member_count, activity_level, engagement_rate, health_state, is_demo)
  select v_workspace_id, 'Social Growth Hub', 'social-growth-hub', 'Public community for members growing their social presence together.', 'interest', 'public', 'active', v_owner_id, 'Global', '{"growth"}', 2128, 'moderate', 7.2, 'good', true
  where not exists (select 1 from public.communities where workspace_id = v_workspace_id and slug = 'social-growth-hub')
  returning id into v_social_growth_hub;

  -- Re-select ids in case any of the inserts above were skipped (already seeded).
  select id into v_creator_circle from public.communities where workspace_id = v_workspace_id and slug = 'creator-circle';
  select id into v_brand_champions from public.communities where workspace_id = v_workspace_id and slug = 'brand-champions';
  select id into v_product_insiders from public.communities where workspace_id = v_workspace_id and slug = 'product-insiders';
  select id into v_social_growth_hub from public.communities where workspace_id = v_workspace_id and slug = 'social-growth-hub';

  -- ============================================================
  -- Members
  -- ============================================================
  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_creator_circle, 'Jessica Miller', 'jessica.miller@example.com', 'top_contributor', 'advocate', 'active', 98, 94, 42, 128, true, now() - interval '11 months', now() - interval '2 hours'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Jessica Miller' and community_id = v_creator_circle)
  returning id into v_member_jessica;

  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_brand_champions, 'Daniel Kim', 'daniel.kim@example.com', 'top_contributor', 'advocate', 'active', 94, 88, 38, 94, true, now() - interval '10 months', now() - interval '8 hours'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Daniel Kim' and community_id = v_brand_champions)
  returning id into v_member_daniel;

  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_creator_circle, 'Aisha Khan', 'aisha.khan@example.com', 'engaged_member', 'engaged', 'active', 88, 72, 26, 67, true, now() - interval '9 months', now() - interval '1 day'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Aisha Khan' and community_id = v_creator_circle)
  returning id into v_member_aisha;

  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_product_insiders, 'Mike Johnson', 'mike.johnson@example.com', 'top_contributor', 'engaged', 'active', 87, 86, 31, 82, true, now() - interval '8 months', now() - interval '3 hours'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Mike Johnson' and community_id = v_product_insiders)
  returning id into v_member_mike;

  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_social_growth_hub, 'Taylor Morgan', 'taylor.morgan@example.com', 'engaged_member', 'engaged', 'active', 82, 69, 28, 56, true, now() - interval '7 months', now() - interval '5 hours'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Taylor Morgan' and community_id = v_social_growth_hub)
  returning id into v_member_taylor;

  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_social_growth_hub, 'Growth Hacker', 'growth.hacker@example.com', 'member', 'at_risk', 'at_risk', 22, 8, 3, 5, true, now() - interval '3 months', now() - interval '35 days'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Growth Hacker' and community_id = v_social_growth_hub)
  returning id into v_member_growth_hacker;

  insert into public.community_members (workspace_id, community_id, display_name, email, role, lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count, is_demo, joined_at, last_active_at)
  select v_workspace_id, v_brand_champions, 'Sarah Bostock', 'sarah.bostock@example.com', 'member', 'new', 'active', 41, 15, 2, 4, true, now() - interval '18 days', now() - interval '2 days'
  where not exists (select 1 from public.community_members where workspace_id = v_workspace_id and display_name = 'Sarah Bostock' and community_id = v_brand_champions)
  returning id into v_member_sarah;

  select id into v_member_jessica from public.community_members where workspace_id = v_workspace_id and display_name = 'Jessica Miller' and community_id = v_creator_circle;
  select id into v_member_daniel from public.community_members where workspace_id = v_workspace_id and display_name = 'Daniel Kim' and community_id = v_brand_champions;
  select id into v_member_aisha from public.community_members where workspace_id = v_workspace_id and display_name = 'Aisha Khan' and community_id = v_creator_circle;
  select id into v_member_mike from public.community_members where workspace_id = v_workspace_id and display_name = 'Mike Johnson' and community_id = v_product_insiders;
  select id into v_member_taylor from public.community_members where workspace_id = v_workspace_id and display_name = 'Taylor Morgan' and community_id = v_social_growth_hub;
  select id into v_member_growth_hacker from public.community_members where workspace_id = v_workspace_id and display_name = 'Growth Hacker' and community_id = v_social_growth_hub;
  select id into v_member_sarah from public.community_members where workspace_id = v_workspace_id and display_name = 'Sarah Bostock' and community_id = v_brand_champions;

  -- ============================================================
  -- Membership requests
  -- ============================================================
  insert into public.community_membership_requests (workspace_id, community_id, applicant_name, applicant_email, message, status, is_demo, requested_at)
  select v_workspace_id, v_creator_circle, 'Olivia Thompson', 'olivia.thompson@example.com', 'Would love to join and share my content workflow.', 'pending', true, now() - interval '2 hours'
  where not exists (select 1 from public.community_membership_requests where workspace_id = v_workspace_id and applicant_name = 'Olivia Thompson');

  insert into public.community_membership_requests (workspace_id, community_id, applicant_name, applicant_email, message, status, is_demo, requested_at)
  select v_workspace_id, v_brand_champions, 'James Wilson', 'james.wilson@example.com', 'Long-time customer, keen to help other members.', 'pending', true, now() - interval '5 hours'
  where not exists (select 1 from public.community_membership_requests where workspace_id = v_workspace_id and applicant_name = 'James Wilson');

  -- ============================================================
  -- Events
  -- ============================================================
  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo)
  select v_workspace_id, v_product_insiders, 'AMA with Product Team', 'ama', 'Live Q&A with the product team on the upcoming roadmap.', v_owner_id, date_trunc('month', now()) + interval '7 days' + interval '14 hours', date_trunc('month', now()) + interval '7 days' + interval '15 hours', 'Europe/London', 'https://meet.example.com/ama-product', 400, 'confirmed', 312, 0, true
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'AMA with Product Team')
  ;

  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo)
  select v_workspace_id, v_creator_circle, 'Creator Growth Webinar', 'webinar', 'Tactics to grow reach and engagement across platforms.', v_owner_id, date_trunc('month', now()) + interval '14 days' + interval '13 hours', date_trunc('month', now()) + interval '14 days' + interval '14 hours', 'Europe/London', 'https://meet.example.com/creator-growth', 250, 'confirmed', 186, 0, true
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'Creator Growth Webinar');

  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo)
  select v_workspace_id, v_brand_champions, 'Ambassador Kickoff', 'live_session', 'Kickoff session for the Spring ambassador cohort.', v_owner_id, date_trunc('month', now()) + interval '12 days' + interval '16 hours', date_trunc('month', now()) + interval '12 days' + interval '17 hours', 'Europe/London', 'https://meet.example.com/ambassador-kickoff', 100, 'confirmed', 78, 0, true
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'Ambassador Kickoff');

  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo)
  select v_workspace_id, v_social_growth_hub, 'Community Challenge: May', 'challenge', 'A month-long content challenge for the Social Growth Hub.', v_owner_id, date_trunc('month', now()) + interval '3 days', date_trunc('month', now()) + interval '10 days', 'Europe/London', null, null, 'confirmed', 642, 0, true
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'Community Challenge: May');

  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo)
  select v_workspace_id, v_product_insiders, 'Product Roadmap Q&A', 'qa', 'Open Q&A on the next two quarters of the roadmap.', v_owner_id, date_trunc('month', now()) + interval '28 days' + interval '15 hours', date_trunc('month', now()) + interval '28 days' + interval '16 hours', 'Europe/London', 'https://meet.example.com/roadmap-qa', 200, 'needs_approval', 67, 0, true
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'Product Roadmap Q&A');

  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo)
  select v_workspace_id, v_creator_circle, 'Weekly Office Hours', 'live_session', 'Recurring weekly drop-in for creator questions.', v_owner_id, now() + interval '3 days' + interval '11 hours', now() + interval '3 days' + interval '12 hours', 'Europe/London', 'https://meet.example.com/office-hours', 150, 'confirmed', 124, 0, true
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'Weekly Office Hours');

  -- A handful of already-completed events so attendance/registration analytics have history.
  insert into public.community_events (workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at, timezone, location_or_url, capacity, status, rsvp_count, attendance_count, is_demo, created_at)
  select v_workspace_id, v_creator_circle, 'Moderator Training', 'training', 'Onboarding session for new community moderators.', v_owner_id, now() - interval '9 days', now() - interval '9 days' + interval '1 hour', 'Europe/London', 'https://meet.example.com/mod-training', 40, 'confirmed', 34, 29, true, now() - interval '20 days'
  where not exists (select 1 from public.community_events where workspace_id = v_workspace_id and title = 'Moderator Training');

  -- ============================================================
  -- Moderation
  -- ============================================================
  insert into public.community_moderation_reports (workspace_id, community_id, reported_member_id, content_excerpt, content_type, reason, severity, status, report_count, ai_risk_score, is_demo, created_at)
  select v_workspace_id, v_creator_circle, v_member_jessica, 'This brand is trash. Worst product ever!!!', 'post', 'spam', 'medium', 'new', 3, 62, true, now() - interval '12 minutes'
  where not exists (select 1 from public.community_moderation_reports where workspace_id = v_workspace_id and content_excerpt = 'This brand is trash. Worst product ever!!!')
  returning id into v_report_1;

  insert into public.community_moderation_reports (workspace_id, community_id, reported_member_id, content_excerpt, content_type, reason, severity, status, report_count, ai_risk_score, is_demo, created_at)
  select v_workspace_id, v_product_insiders, v_member_mike, 'You people are idiots for buying this junk.', 'comment', 'hate_speech', 'high', 'new', 7, 81, true, now() - interval '15 minutes'
  where not exists (select 1 from public.community_moderation_reports where workspace_id = v_workspace_id and content_excerpt = 'You people are idiots for buying this junk.')
  returning id into v_report_2;

  insert into public.community_moderation_reports (workspace_id, community_id, reported_member_id, content_excerpt, content_type, reason, severity, status, report_count, ai_risk_score, is_demo, created_at)
  select v_workspace_id, v_social_growth_hub, v_member_growth_hacker, 'Check this out bit.ly/xyz123', 'post', 'spam', 'medium', 'in_review', 2, 74, true, now() - interval '25 minutes'
  where not exists (select 1 from public.community_moderation_reports where workspace_id = v_workspace_id and content_excerpt = 'Check this out bit.ly/xyz123');

  insert into public.community_moderation_reports (workspace_id, community_id, reported_member_id, content_excerpt, content_type, reason, severity, status, report_count, ai_risk_score, is_demo, created_at, resolved_at)
  select v_workspace_id, v_brand_champions, v_member_sarah, 'This post is not relevant here.', 'comment', 'off_topic', 'low', 'resolved', 1, 18, true, now() - interval '31 minutes', now() - interval '10 minutes'
  where not exists (select 1 from public.community_moderation_reports where workspace_id = v_workspace_id and content_excerpt = 'This post is not relevant here.');

  select id into v_report_1 from public.community_moderation_reports where workspace_id = v_workspace_id and content_excerpt = 'This brand is trash. Worst product ever!!!';
  select id into v_report_2 from public.community_moderation_reports where workspace_id = v_workspace_id and content_excerpt = 'You people are idiots for buying this junk.';

  insert into public.community_moderation_decisions (workspace_id, report_id, moderator_id, decision, notes)
  select v_workspace_id, id, v_owner_id, 'warn_user', 'First offence — sent a policy reminder.'
  from public.community_moderation_reports
  where workspace_id = v_workspace_id and content_excerpt = 'This post is not relevant here.'
    and not exists (
      select 1 from public.community_moderation_decisions d
      where d.report_id = community_moderation_reports.id
    );

  -- ============================================================
  -- Policy coverage
  -- ============================================================
  insert into public.community_policies (workspace_id, category, description, enforced, coverage_pct)
  select v_workspace_id, 'Spam & Promotions', 'Unsolicited links, referral spam and repeated promotional posts.', true, 98
  where not exists (select 1 from public.community_policies where workspace_id = v_workspace_id and category = 'Spam & Promotions');

  insert into public.community_policies (workspace_id, category, description, enforced, coverage_pct)
  select v_workspace_id, 'Harassment & Abuse', 'Targeted harassment, bullying or abusive language toward members.', true, 92
  where not exists (select 1 from public.community_policies where workspace_id = v_workspace_id and category = 'Harassment & Abuse');

  insert into public.community_policies (workspace_id, category, description, enforced, coverage_pct)
  select v_workspace_id, 'Hate Speech', 'Content attacking people based on protected characteristics.', true, 88
  where not exists (select 1 from public.community_policies where workspace_id = v_workspace_id and category = 'Hate Speech');

  insert into public.community_policies (workspace_id, category, description, enforced, coverage_pct)
  select v_workspace_id, 'Impersonation', 'Accounts or content impersonating staff, brands or other members.', true, 85
  where not exists (select 1 from public.community_policies where workspace_id = v_workspace_id and category = 'Impersonation');

  insert into public.community_policies (workspace_id, category, description, enforced, coverage_pct)
  select v_workspace_id, 'Violence & Threats', 'Threats of violence or content that incites harm.', true, 70
  where not exists (select 1 from public.community_policies where workspace_id = v_workspace_id and category = 'Violence & Threats');

  -- ============================================================
  -- Advocacy programmes
  -- ============================================================
  insert into public.community_advocacy_programs (workspace_id, community_id, name, type, status, goal_metric, goal_target, goal_progress, is_demo, starts_at, ends_at)
  select v_workspace_id, v_creator_circle, 'Ambassador Challenge', 'ambassador', 'active', 'Points issued', 1600, 1248, true, now() - interval '45 days', now() + interval '15 days'
  where not exists (select 1 from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'Ambassador Challenge')
  returning id into v_program_ambassador;

  insert into public.community_advocacy_programs (workspace_id, community_id, name, type, status, goal_metric, goal_target, goal_progress, is_demo, starts_at, ends_at)
  select v_workspace_id, v_brand_champions, 'Referral Sprint', 'referral', 'active', 'Referral conversions', 900, 582, true, now() - interval '30 days', now() + interval '31 days'
  where not exists (select 1 from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'Referral Sprint')
  returning id into v_program_referral;

  insert into public.community_advocacy_programs (workspace_id, community_id, name, type, status, goal_metric, goal_target, goal_progress, is_demo, starts_at, ends_at)
  select v_workspace_id, v_product_insiders, 'UGC Creator Circle', 'ugc', 'active', 'UGC submissions', 230, 146, true, now() - interval '20 days', now() + interval '40 days'
  where not exists (select 1 from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'UGC Creator Circle')
  returning id into v_program_ugc;

  insert into public.community_advocacy_programs (workspace_id, community_id, name, type, status, goal_metric, goal_target, goal_progress, is_demo, starts_at)
  select v_workspace_id, null, 'Beta Insider Rewards', 'beta_insider', 'upcoming', 'Rewards issued', 100, 0, true, now() + interval '10 days'
  where not exists (select 1 from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'Beta Insider Rewards');

  select id into v_program_ambassador from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'Ambassador Challenge';
  select id into v_program_referral from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'Referral Sprint';
  select id into v_program_ugc from public.community_advocacy_programs where workspace_id = v_workspace_id and name = 'UGC Creator Circle';

  -- ============================================================
  -- Advocacy enrollments (leaderboard)
  -- ============================================================
  insert into public.community_advocacy_enrollments (workspace_id, program_id, member_id, tier, referrals_count, ugc_posts_count, points, rewards_earned_cents, advocacy_score, status)
  select v_workspace_id, v_program_ambassador, v_member_jessica, 'ambassador', 48, 23, 2450, 12000, 94, 'active'
  where not exists (select 1 from public.community_advocacy_enrollments where workspace_id = v_workspace_id and program_id = v_program_ambassador and member_id = v_member_jessica)
  returning id into v_enrollment_1;

  insert into public.community_advocacy_enrollments (workspace_id, program_id, member_id, tier, referrals_count, ugc_posts_count, points, rewards_earned_cents, advocacy_score, status)
  select v_workspace_id, v_program_referral, v_member_daniel, 'advocate', 36, 15, 2150, 9000, 88, 'active'
  where not exists (select 1 from public.community_advocacy_enrollments where workspace_id = v_workspace_id and program_id = v_program_referral and member_id = v_member_daniel);

  insert into public.community_advocacy_enrollments (workspace_id, program_id, member_id, tier, referrals_count, ugc_posts_count, points, rewards_earned_cents, advocacy_score, status)
  select v_workspace_id, v_program_ugc, v_member_aisha, 'ambassador', 31, 27, 1980, 11000, 86, 'active'
  where not exists (select 1 from public.community_advocacy_enrollments where workspace_id = v_workspace_id and program_id = v_program_ugc and member_id = v_member_aisha);

  insert into public.community_advocacy_enrollments (workspace_id, program_id, member_id, tier, referrals_count, ugc_posts_count, points, rewards_earned_cents, advocacy_score, status)
  select v_workspace_id, v_program_ambassador, v_member_mike, 'ambassador', 28, 18, 1760, 8000, 82, 'active'
  where not exists (select 1 from public.community_advocacy_enrollments where workspace_id = v_workspace_id and program_id = v_program_ambassador and member_id = v_member_mike);

  insert into public.community_advocacy_enrollments (workspace_id, program_id, member_id, tier, referrals_count, ugc_posts_count, points, rewards_earned_cents, advocacy_score, status)
  select v_workspace_id, v_program_referral, v_member_taylor, 'member', 24, 12, 1420, 6000, 78, 'active'
  where not exists (select 1 from public.community_advocacy_enrollments where workspace_id = v_workspace_id and program_id = v_program_referral and member_id = v_member_taylor);

  select id into v_enrollment_1 from public.community_advocacy_enrollments where workspace_id = v_workspace_id and program_id = v_program_ambassador and member_id = v_member_jessica;

  -- ============================================================
  -- Reward approvals
  -- ============================================================
  insert into public.community_rewards (workspace_id, enrollment_id, member_id, reward_description, status)
  select v_workspace_id, v_enrollment_1, v_member_jessica, '$50 Amazon Gift Card', 'pending'
  where not exists (select 1 from public.community_rewards where workspace_id = v_workspace_id and member_id = v_member_jessica and reward_description = '$50 Amazon Gift Card');

  insert into public.community_rewards (workspace_id, enrollment_id, member_id, reward_description, status)
  select v_workspace_id, id, v_member_daniel, '$25 Starbucks Card', 'pending'
  from public.community_advocacy_enrollments
  where workspace_id = v_workspace_id and program_id = v_program_referral and member_id = v_member_daniel
  and not exists (select 1 from public.community_rewards where workspace_id = v_workspace_id and member_id = v_member_daniel and reward_description = '$25 Starbucks Card');

  insert into public.community_rewards (workspace_id, enrollment_id, member_id, reward_description, status)
  select v_workspace_id, id, v_member_aisha, '$50 Amazon Gift Card', 'pending'
  from public.community_advocacy_enrollments
  where workspace_id = v_workspace_id and program_id = v_program_ugc and member_id = v_member_aisha
  and not exists (select 1 from public.community_rewards where workspace_id = v_workspace_id and member_id = v_member_aisha and reward_description = '$50 Amazon Gift Card');

  -- ============================================================
  -- Activity
  -- ============================================================
  insert into public.community_activity (workspace_id, community_id, actor_id, entity_type, action, summary, link, surface, created_at)
  select v_workspace_id, v_creator_circle, v_owner_id, 'community', 'created', 'Created new community: Creator Circle', '/app/community/communities', 'communities', now() - interval '2 minutes'
  where not exists (select 1 from public.community_activity where workspace_id = v_workspace_id and summary = 'Created new community: Creator Circle');

  insert into public.community_activity (workspace_id, community_id, actor_id, entity_type, action, summary, link, surface, created_at)
  select v_workspace_id, v_brand_champions, v_owner_id, 'community', 'updated', 'Updated community: Brand Champions', '/app/community/communities', 'communities', now() - interval '8 minutes'
  where not exists (select 1 from public.community_activity where workspace_id = v_workspace_id and summary = 'Updated community: Brand Champions');

  insert into public.community_activity (workspace_id, community_id, actor_id, entity_type, action, summary, link, surface, created_at)
  select v_workspace_id, v_social_growth_hub, v_owner_id, 'moderation', 'remove_content', 'Removed post by @growth_hacker', '/app/community/moderation', 'moderation', now() - interval '15 minutes'
  where not exists (select 1 from public.community_activity where workspace_id = v_workspace_id and summary = 'Removed post by @growth_hacker');

end $$;
