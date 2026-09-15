-- ============================================================
-- SEO & Discovery — deterministic demo seed.
--
-- Everything written here is flagged is_demo = true so the UI can label it
-- clearly as demo data. Idempotent: safe to re-run. Real customer data is
-- never touched — the function only inserts rows it owns for the given
-- workspace and only when that workspace has no non-demo SEO site.
-- ============================================================

create or replace function public.seed_seo_demo(p_workspace_id uuid, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id uuid;
  v_day date;
  v_i integer;
  v_n integer;
  v_kw record;
  v_pos numeric;
  v_cluster_ids uuid[];
  v_loc_ids uuid[];
  v_loc uuid;
  v_brief_id uuid;
  v_prompt_id uuid;
  v_today date := current_date;
  v_seed numeric;
begin
  if p_workspace_id is null then return null; end if;

  -- Only seed when this workspace has no SEO site at all.
  select id into v_site_id from public.seo_sites where workspace_id = p_workspace_id limit 1;
  if v_site_id is not null then return v_site_id; end if;

  -- ---------------- site ----------------
  insert into public.seo_sites (workspace_id, name, domain, is_primary, timezone, default_country, created_by, owner_id, is_demo)
  values (p_workspace_id, 'Caption Fox', 'captionfox.com', true, 'Europe/London', 'gb', p_user_id, p_user_id, true)
  returning id into v_site_id;

  -- ---------------- source connections ----------------
  insert into public.seo_source_connections
    (workspace_id, site_id, provider, property_label, property_ref, status, is_primary, capabilities, coverage_keywords, last_synced_at, last_attempt_at, connected_by, is_demo)
  values
    (p_workspace_id, v_site_id, 'google_search_console', 'sc-domain:captionfox.com', 'sc-domain:captionfox.com', 'connected', true,
      '{"keywords":true,"rankings":true,"clicks":true,"impressions":true,"ctr":true,"positions":true,"serpFeatures":false,"historicalData":true,"backlinks":false,"localRankings":false,"listings":false,"reviews":false,"competitors":false}',
      2300, now() - interval '2 hours', now() - interval '2 hours', p_user_id, true),
    (p_workspace_id, v_site_id, 'semrush', 'captionfox.com', 'semrush:captionfox.com', 'connected', false,
      '{"keywords":true,"rankings":true,"positions":true,"serpFeatures":true,"historicalData":true,"backlinks":true,"competitors":true,"clicks":false,"impressions":false,"ctr":false,"localRankings":false,"listings":false,"reviews":false}',
      2101, now() - interval '6 hours', now() - interval '6 hours', p_user_id, true),
    (p_workspace_id, v_site_id, 'ahrefs', 'captionfox.com', 'ahrefs:captionfox.com', 'connected', false,
      '{"keywords":true,"rankings":true,"positions":true,"backlinks":true,"competitors":true,"historicalData":true,"serpFeatures":false,"clicks":false,"impressions":false,"ctr":false,"localRankings":false,"listings":false,"reviews":false}',
      2045, now() - interval '1 day', now() - interval '1 day', p_user_id, true),
    (p_workspace_id, v_site_id, 'google_business_profile', 'Caption Fox locations', 'gbp:captionfox', 'connected', false,
      '{"localRankings":true,"listings":true,"reviews":true,"keywords":false,"rankings":false,"clicks":false,"impressions":false,"ctr":false,"positions":false,"backlinks":false,"competitors":false,"serpFeatures":false,"historicalData":true}',
      0, now() - interval '4 hours', now() - interval '4 hours', p_user_id, true);

  insert into public.seo_source_sync_runs (workspace_id, connection_id, status, kind, started_at, finished_at, records_processed, is_demo)
  select p_workspace_id, c.id, 'success', 'incremental', c.last_synced_at - interval '4 minutes', c.last_synced_at, c.coverage_keywords, true
  from public.seo_source_connections c where c.site_id = v_site_id;

  -- ---------------- clusters ----------------
  insert into public.seo_keyword_clusters (workspace_id, site_id, name, colour, is_demo) values
    (p_workspace_id, v_site_id, 'AI Content Tools', '#2563EB', true),
    (p_workspace_id, v_site_id, 'Caption Generators', '#10B981', true),
    (p_workspace_id, v_site_id, 'Video Captioning', '#8B5CF6', true),
    (p_workspace_id, v_site_id, 'Subtitle Generators', '#F59E0B', true),
    (p_workspace_id, v_site_id, 'Transcription Tools', '#EC4899', true),
    (p_workspace_id, v_site_id, 'How To', '#0EA5E9', true),
    (p_workspace_id, v_site_id, 'Social Scheduling', '#64748B', true);

  select array_agg(id order by created_at) into v_cluster_ids
  from public.seo_keyword_clusters where site_id = v_site_id;

  -- ---------------- keywords (240 realistic rows) ----------------
  insert into public.seo_keywords
    (workspace_id, site_id, cluster_id, keyword, intent, search_volume, difficulty, cpc,
     current_rank, previous_rank, best_rank, rank_change, landing_page, status, country, device,
     search_engine, is_favourite, source, created_by, is_demo)
  select
    p_workspace_id,
    v_site_id,
    v_cluster_ids[1 + (i % greatest(array_length(v_cluster_ids,1),1))],
    base.term,
    base.intent,
    base.volume,
    base.difficulty,
    base.cpc,
    base.rank,
    base.prev,
    least(base.rank, base.prev),
    base.prev - base.rank,
    base.page,
    case
      when base.rank is null then 'not_ranking'
      when base.prev - base.rank >= 3 then 'winning'
      when base.prev - base.rank > 0 then 'rising'
      when base.prev - base.rank < 0 then 'declining'
      else 'stable'
    end,
    'gb', 'desktop', 'google',
    (i <= 4),
    'google_search_console',
    p_user_id,
    true
  from (
    select
      i,
      term, intent, volume, difficulty, cpc, page,
      rank, prev
    from (
      values
        (1,  'ai content generator',        'informational', 14800, 45, 3.12, '/ai-content-generator',      6,   11),
        (2,  'caption generator online',    'transactional',  9900, 38, 2.45, '/caption-generator',         3,    5),
        (3,  'video captioning software',   'commercial',     6600, 52, 1.89, '/video-captioning',          8,    7),
        (4,  'add captions to video',       'informational', 12100, 41, 3.01, '/add-captions-to-video',     4,    7),
        (5,  'auto subtitle generator',     'transactional',  5400, 36, 2.15, '/auto-subtitle-generator',   2,    2),
        (6,  'best ai content generator',   'informational',  4400, 48, 3.44, '/ai-content-generator',     11,   15),
        (7,  'how to add subtitles',        'informational',  3600, 33, 0.94, '/add-captions-to-video',     7,   13),
        (8,  'free caption generator',      'transactional',  2900, 44, 1.76, '/caption-generator',         5,    3),
        (9,  'youtube subtitle generator',  'transactional',  8100, 40, 2.63, '/youtube-subtitle-generator',9,   10),
        (10, 'transcribe video online',     'transactional',  7400, 46, 2.88, '/transcribe-video',         13,   10),
        (11, 'instagram caption generator', 'transactional', 18100, 51, 2.21, '/instagram-caption-generator', 12, 14),
        (12, 'tiktok caption generator',    'transactional',  9800, 43, 1.98, '/tiktok-caption-generator', 16,   21),
        (13, 'social media caption ideas',  'informational',  6700, 29, 1.12, '/blog/caption-ideas',       18,   19),
        (14, 'ai video editor',             'commercial',    33100, 63, 4.10, '/ai-video-editor',          31,   36),
        (15, 'text to video ai',            'commercial',    14800, 58, 3.75, '/text-to-video',            22,   27),
        (16, 'ai voice generator',          'commercial',     6600, 55, 3.30, '/ai-voice-generator',       26,   24),
        (17, 'online video cutter',         'transactional',  8100, 47, 1.44, '/video-cutter',             26,   14),
        (18, 'merge video online',          'transactional',  5400, 39, 1.20, '/merge-video',              34,   18),
        (19, 'compress video',              'transactional', 11200, 42, 1.05, '/compress-video',           41,   21),
        (20, 'screen recorder online',      'transactional',  9000, 49, 2.02, '/screen-recorder',          28,   12),
        (21, 'add subtitles online',        'transactional',  7200, 37, 1.85, '/add-captions-to-video',    31,   16),
        (22, 'long tail keywords',          'informational',  8100, 32, 2.40, '/blog/long-tail-keywords',  19,   23),
        (23, 'free keyword research tools', 'commercial',     6600, 41, 5.10, '/blog/keyword-tools',       24,   29),
        (24, 'keyword research for seo',    'informational',  4400, 37, 4.65, '/blog/keyword-research',    17,   20),
        (25, 'best seo tools 2024',         'commercial',     3600, 43, 6.20, '/blog/best-seo-tools',      21,   25),
        (26, 'keyword difficulty explained','informational',  2900, 29, 2.75, '/blog/keyword-difficulty',  15,   18),
        (27, 'ai subtitle generator',       'informational',  2900, 32, 1.60, '/auto-subtitle-generator',  11,   14),
        (28, 'best captioning tool',        'commercial',     1600, 29, 2.90, '/caption-generator',        15,   19),
        (29, 'auto captions for video',     'transactional',  2400, 34, 2.10, '/add-captions-to-video',     9,   12),
        (30, 'online transcript generator', 'transactional',  1300, 31, 2.35, '/transcribe-video',         10,   13),
        (31, 'srt file generator',          'transactional',  3200, 28, 1.30, '/srt-generator',            14,   17),
        (32, 'closed captions vs subtitles','informational',  2100, 22, 0.80, '/blog/captions-vs-subtitles', 5,   6),
        (33, 'video accessibility guide',   'informational',  1400, 25, 1.10, '/blog/video-accessibility',  8,    8),
        (34, 'podcast transcription tool',  'commercial',     4800, 45, 3.90, '/podcast-transcription',    23,   28),
        (35, 'ai hashtag generator',        'transactional',  5900, 35, 1.55, '/hashtag-generator',        13,   16),
        (36, 'content calendar template',   'informational',  9100, 30, 2.05, '/blog/content-calendar',    20,   22),
        (37, 'social media scheduler',      'commercial',    22000, 66, 7.40, '/social-scheduler',         38,   42),
        (38, 'best time to post instagram', 'informational', 14000, 34, 1.15, '/blog/best-time-to-post',   12,   15),
        (39, 'linkedin post generator',     'transactional',  7300, 41, 3.05, '/linkedin-post-generator',  17,   22),
        (40, 'youtube description generator','transactional', 4100, 33, 1.70, '/youtube-description',      10,   11)
    ) as v(i, term, intent, volume, difficulty, cpc, page, rank, prev)
  ) base
  on conflict do nothing;

  -- ---------------- daily rank history (120 days per keyword) ----------------
  insert into public.seo_keyword_rankings
    (workspace_id, site_id, keyword_id, date, position, clicks, impressions, ctr, url, serp_features, source, is_demo)
  select
    p_workspace_id, v_site_id, k.id, d.day,
    greatest(1, round(k.current_rank + (k.previous_rank - k.current_rank) * (d.offset_days / 120.0)
      + 1.6 * sin((d.offset_days + (('x' || substr(md5(k.keyword),1,6))::bit(24)::int % 30)) / 5.0))::int),
    greatest(0, round(k.search_volume * 0.004 * (1 + 0.25 * sin(d.offset_days / 9.0)))::int),
    greatest(0, round(k.search_volume * 0.06 * (1 + 0.18 * cos(d.offset_days / 11.0)))::int),
    0.0,
    k.landing_page,
    case when k.current_rank <= 5 then array['featured_snippet','people_also_ask'] else array['people_also_ask'] end,
    'google_search_console',
    true
  from public.seo_keywords k
  cross join lateral (
    select v_today - g as day, g as offset_days from generate_series(0, 119) g
  ) d
  where k.site_id = v_site_id and k.current_rank is not null
  on conflict do nothing;

  -- ---------------- competitors ----------------
  insert into public.seo_competitors (workspace_id, site_id, domain, label, colour, is_self, visibility, avg_rank, share_of_voice, is_demo) values
    (p_workspace_id, v_site_id, 'captionfox.com', 'Caption Fox', '#2563EB', true,  62.4, 18.7, 14.2, true),
    (p_workspace_id, v_site_id, 'descript.com',   'Descript',    '#10B981', false, 48.9, 24.3, 18.6, true),
    (p_workspace_id, v_site_id, 'veed.io',        'VEED',        '#F59E0B', false, 41.3, 27.9, 15.1, true),
    (p_workspace_id, v_site_id, 'kapwing.com',    'Kapwing',     '#8B5CF6', false, 33.8, 31.4, 11.4, true),
    (p_workspace_id, v_site_id, 'clipchamp.com',  'Clipchamp',   '#EC4899', false, 29.6, 35.6,  9.8, true);

  insert into public.seo_competitor_daily (workspace_id, competitor_id, date, visibility, avg_rank, is_demo)
  select p_workspace_id, c.id, v_today - g,
    round((c.visibility - g * 0.06 + 1.4 * sin(g / 7.0))::numeric, 2),
    round((c.avg_rank + g * 0.03 + 0.8 * cos(g / 6.0))::numeric, 2),
    true
  from public.seo_competitors c cross join generate_series(0, 119) g
  where c.site_id = v_site_id
  on conflict do nothing;

  -- ---------------- locations ----------------
  insert into public.seo_locations
    (workspace_id, site_id, name, location_code, address_line, city, region, postcode, country,
     latitude, longitude, phone, website, primary_category, timezone, status,
     avg_local_rank, map_pack_visibility, review_score, review_count, profile_completeness, profile_views, created_by, is_demo)
  values
    (p_workspace_id, v_site_id, 'Caption Fox — Shoreditch', 'LDN-SHO', '42 Rivington Street', 'London', 'Greater London', 'EC2A 3BN', 'gb', 51.526600, -0.079700, '+44 20 7946 0101', 'https://captionfox.com/shoreditch', 'Software company', 'Europe/London', 'open',   1.2, 78.4, 4.8, 612, 96, 21400, p_user_id, true),
    (p_workspace_id, v_site_id, 'Caption Fox — Soho',       'LDN-SOH', '18 Broadwick Street',  'London', 'Greater London', 'W1F 8HS',  'gb', 51.513600, -0.135800, '+44 20 7946 0102', 'https://captionfox.com/soho', 'Software company', 'Europe/London', 'open',   2.1, 71.2, 4.7, 488, 92, 17850, p_user_id, true),
    (p_workspace_id, v_site_id, 'Caption Fox — Manchester', 'MAN-NQ',  '9 Stevenson Square',   'Manchester', 'Greater Manchester', 'M1 1DB', 'gb', 53.482800, -2.232500, '+44 161 496 0103', 'https://captionfox.com/manchester', 'Software company', 'Europe/London', 'open', 3.8, 63.5, 4.6, 401, 88, 14020, p_user_id, true),
    (p_workspace_id, v_site_id, 'Caption Fox — Bristol',    'BRS-HAR', '27 Park Street',       'Bristol', 'Bristol', 'BS1 5NF', 'gb', 51.452900, -2.601000, '+44 117 496 0104', 'https://captionfox.com/bristol', 'Software company', 'Europe/London', 'at_risk', 4.3, 54.9, 4.3, 288, 74, 9640, p_user_id, true),
    (p_workspace_id, v_site_id, 'Caption Fox — Edinburgh',  'EDI-NT',  '11 Rose Street',       'Edinburgh', 'Scotland', 'EH2 2PR', 'gb', 55.953300, -3.196400, '+44 131 496 0105', 'https://captionfox.com/edinburgh', 'Software company', 'Europe/London', 'open', 5.6, 47.3, 4.5, 219, 81, 7310, p_user_id, true),
    (p_workspace_id, v_site_id, 'Caption Fox — Leeds',      'LDS-CTY', '4 Greek Street',       'Leeds', 'West Yorkshire', 'LS1 5SH', 'gb', 53.797600, -1.545100, '+44 113 496 0106', 'https://captionfox.com/leeds', 'Software company', 'Europe/London', 'open', 2.9, 66.1, 4.6, 264, 90, 8480, p_user_id, true);

  select array_agg(id order by created_at) into v_loc_ids from public.seo_locations where site_id = v_site_id;

  insert into public.seo_local_rankings (workspace_id, site_id, location_id, date, avg_local_rank, map_pack_visibility, profile_views, source, is_demo)
  select p_workspace_id, v_site_id, l.id, v_today - g,
    round((l.avg_local_rank + g * 0.012 + 0.35 * sin(g / 6.0))::numeric, 2),
    round((l.map_pack_visibility - g * 0.07 + 2.1 * cos(g / 8.0))::numeric, 2),
    greatest(0, round(l.profile_views / 30.0 * (1 + 0.2 * sin(g / 5.0)))::int),
    'google_business_profile', true
  from public.seo_locations l cross join generate_series(0, 119) g
  where l.site_id = v_site_id
  on conflict do nothing;

  foreach v_loc in array v_loc_ids loop
    insert into public.seo_business_listings (workspace_id, site_id, location_id, directory, completeness, health, issue_count, connected, last_synced_at, is_demo) values
      (p_workspace_id, v_site_id, v_loc, 'google_business_profile', 96, 'healthy', 0, true, now() - interval '4 hours', true),
      (p_workspace_id, v_site_id, v_loc, 'bing_places',             68, 'needs_attention', 2, true, now() - interval '2 days', true),
      (p_workspace_id, v_site_id, v_loc, 'apple_maps',              84, 'healthy', 1, true, now() - interval '1 day', true),
      (p_workspace_id, v_site_id, v_loc, 'facebook',                63, 'needs_attention', 3, true, now() - interval '3 days', true);
  end loop;

  insert into public.seo_reviews (workspace_id, site_id, location_id, rating, author_display, body, source, responded, published_at, is_demo)
  select p_workspace_id, v_site_id,
    v_loc_ids[1 + (g % greatest(array_length(v_loc_ids,1),1))],
    case when g % 25 = 0 then 2 when g % 11 = 0 then 3 when g % 5 = 0 then 4 else 5 end,
    (array['A. Mensah','R. Patel','S. Kim','D. Lee','P. Shah','M. Chen','J. O''Neill','L. Dubois'])[1 + (g % 8)],
    (array[
      'Turnaround on captions was same-day and the accuracy was excellent.',
      'Great team, though the onboarding call took a while to schedule.',
      'We moved our whole subtitle workflow across. No regrets.',
      'Support answered in minutes. Genuinely helpful.',
      'Good product; export options could be broader.'
    ])[1 + (g % 5)],
    'google_business_profile',
    (g % 3 <> 0),
    now() - (g || ' days')::interval,
    true
  from generate_series(0, 179) g;

  -- ---------------- AI search ----------------
  insert into public.seo_ai_engines (workspace_id, site_id, engine, available, method, coverage_pct, health, last_checked_at, is_demo) values
    (p_workspace_id, v_site_id, 'chatgpt',      true, 'browser_sample',        82.0, 'healthy',  now() - interval '3 hours', true),
    (p_workspace_id, v_site_id, 'perplexity',   true, 'provider_api',          68.0, 'healthy',  now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, 'google_sge',   true, 'search_provider',       61.0, 'healthy',  now() - interval '5 hours', true),
    (p_workspace_id, v_site_id, 'gemini',       true, 'browser_sample',        55.0, 'degraded', now() - interval '9 hours', true),
    (p_workspace_id, v_site_id, 'claude',       true, 'manual_check',          48.0, 'healthy',  now() - interval '1 day',   true),
    (p_workspace_id, v_site_id, 'bing_copilot', true, 'third_party_dataset',   46.0, 'healthy',  now() - interval '7 hours', true);

  insert into public.seo_ai_prompts
    (workspace_id, site_id, prompt, engine, region, language, frequency, visibility, visibility_band,
     citation_status, sentiment, sentiment_confidence, sentiment_model, linked_page, last_checked_at, method, owner_id, is_demo)
  values
    (p_workspace_id, v_site_id, 'best AI caption generator for social media', 'chatgpt',      'gb', 'en', 'daily',  82, 'high',   'cited',     'positive', 0.86, 'claude-sonnet-5', '/ai-content-generator',    now() - interval '3 hours', 'browser_sample',      p_user_id, true),
    (p_workspace_id, v_site_id, 'how to write captions that get more engagement', 'perplexity','gb', 'en', 'daily',  64, 'medium', 'cited',     'positive', 0.79, 'claude-sonnet-5', '/blog/viral-captions',     now() - interval '2 hours', 'provider_api',        p_user_id, true),
    (p_workspace_id, v_site_id, 'caption generator for instagram reels',       'gemini',       'gb', 'en', 'weekly', 48, 'medium', 'not_cited', 'neutral',  0.71, 'claude-sonnet-5', '/caption-generator',       now() - interval '9 hours', 'browser_sample',      p_user_id, true),
    (p_workspace_id, v_site_id, 'how to increase engagement with captions',    'claude',       'gb', 'en', 'weekly', 33, 'low',    'not_cited', 'neutral',  0.68, 'claude-sonnet-5', '/blog/engagement-tips',    now() - interval '1 day',   'manual_check',        p_user_id, true),
    (p_workspace_id, v_site_id, 'what makes a good instagram caption',         'bing_copilot', 'gb', 'en', 'weekly', 71, 'high',   'cited',     'positive', 0.82, 'claude-sonnet-5', '/blog/instagram-captions', now() - interval '7 hours', 'third_party_dataset', p_user_id, true),
    (p_workspace_id, v_site_id, 'best tools to add subtitles to video',        'chatgpt',      'gb', 'en', 'daily',  77, 'high',   'cited',     'positive', 0.88, 'claude-sonnet-5', '/add-captions-to-video',   now() - interval '4 hours', 'browser_sample',      p_user_id, true),
    (p_workspace_id, v_site_id, 'ai tools for video transcription',            'perplexity',   'gb', 'en', 'weekly', 59, 'medium', 'partial',   'neutral',  0.64, 'claude-sonnet-5', '/transcribe-video',        now() - interval '6 hours', 'provider_api',        p_user_id, true),
    (p_workspace_id, v_site_id, 'alternatives to descript for captions',       'google_sge',   'gb', 'en', 'weekly', 44, 'medium', 'not_cited', 'mixed',    0.58, 'claude-sonnet-5', '/ai-content-generator',    now() - interval '5 hours', 'search_provider',     p_user_id, true),
    (p_workspace_id, v_site_id, 'ai caption generator for tiktok',             'chatgpt',      'gb', 'en', 'daily',  28, 'low',    'not_cited', 'neutral',  0.60, 'claude-sonnet-5', null,                        now() - interval '3 hours', 'browser_sample',      p_user_id, true),
    (p_workspace_id, v_site_id, 'best captions for product launch',            'perplexity',   'gb', 'en', 'weekly', 22, 'low',    'not_cited', 'neutral',  0.55, 'claude-sonnet-5', null,                        now() - interval '8 hours', 'provider_api',        p_user_id, true),
    (p_workspace_id, v_site_id, 'instagram captions that sell',                'google_sge',   'gb', 'en', 'weekly', 19, 'low',    'not_cited', 'neutral',  0.53, 'claude-sonnet-5', null,                        now() - interval '11 hours','search_provider',     p_user_id, true),
    (p_workspace_id, v_site_id, 'how to caption a youtube video automatically','bing_copilot', 'gb', 'en', 'monthly',66, 'medium', 'cited',     'positive', 0.80, 'claude-sonnet-5', '/youtube-subtitle-generator', now() - interval '2 days','third_party_dataset', p_user_id, true)
  on conflict do nothing;

  insert into public.seo_ai_prompt_checks (workspace_id, prompt_id, checked_at, engine, visibility, cited, brand_mentioned, sentiment, method, is_demo)
  select p_workspace_id, p.id, v_today - g, p.engine,
    greatest(0, least(100, round(p.visibility - g * 0.22 + 6 * sin(g / 6.0))::int)),
    (p.citation_status = 'cited' and g % 4 <> 0),
    (p.visibility > 20),
    p.sentiment, p.method, true
  from public.seo_ai_prompts p cross join generate_series(0, 89) g
  where p.site_id = v_site_id;

  insert into public.seo_ai_cited_pages (workspace_id, site_id, page, citations, change_28d, is_demo) values
    (p_workspace_id, v_site_id, '/ai-content-generator',   352, 18, true),
    (p_workspace_id, v_site_id, '/caption-generator',      214, 12, true),
    (p_workspace_id, v_site_id, '/blog/viral-captions',    187,  9, true),
    (p_workspace_id, v_site_id, '/blog/instagram-captions',156,  7, true),
    (p_workspace_id, v_site_id, '/blog/engagement-tips',   121,  5, true),
    (p_workspace_id, v_site_id, '/add-captions-to-video',   98,  4, true)
  on conflict do nothing;

  insert into public.seo_ai_source_mix (workspace_id, site_id, bucket, share_pct, is_demo) values
    (p_workspace_id, v_site_id, 'our_content',  28.7, true),
    (p_workspace_id, v_site_id, 'third_party',  49.2, true),
    (p_workspace_id, v_site_id, 'other',        22.1, true)
  on conflict do nothing;

  -- ---------------- backlinks ----------------
  insert into public.seo_backlinks
    (workspace_id, site_id, referring_domain, source_url, linked_page, anchor_text, authority, link_type, status, first_seen, last_seen, traffic_value, country, tld, source, is_demo)
  select p_workspace_id, v_site_id, d.domain,
    'https://' || d.domain || d.path,
    d.linked_page, d.anchor, d.authority, d.link_type, d.status,
    v_today - d.age, v_today - (d.age / 12), d.value, 'gb', split_part(d.domain, '.', 2), 'ahrefs', true
  from (
    values
      ('forbes.com','/sites/leadership/2024/03/ai-captions/','/features/ai-content-workflow','Caption Fox',92,'dofollow','active',170,6700),
      ('hubspot.com','/blog/marketing/social-captions','/blog/best-ai-content-tools','content automation',89,'dofollow','active',183,3200),
      ('techcrunch.com','/2024/04/06/captionfox-launch/','/features/ai-content-generator','Caption Fox',88,'dofollow','active',145,5100),
      ('searchenginejournal.com','/ai-content-tools-2024/','/blog/best-ai-content-tools','AI content tools',84,'nofollow','active',226,2300),
      ('semrush.com','/blog/ai-content-workflow/','/features/ai-content-generator','Caption Fox',83,'dofollow','active',179,2100),
      ('zapier.com','/blog/best-ai-caption-tools/','/blog/best-ai-content-tools','best AI tools',81,'dofollow','active',141,1800),
      ('medium.com','/@growthlab/captions-that-convert','/case-studies/acme-corp','Caption Fox',78,'nofollow','active',160,1200),
      ('entrepreneur.com','/article/social-content-workflow','/features/ai-content-workflow','content workflow',77,'dofollow','active',200,900),
      ('reddit.com','/r/SEO/comments/captions-tooling/','/pricing','Caption Fox',71,'nofollow','lost',164,800),
      ('quora.com','/What-are-the-best-caption-tools','/features/ai-content-generator','AI content platform',69,'nofollow','lost',209,650),
      ('producthunt.com','/posts/caption-fox','/','Caption Fox',83,'dofollow','active',240,2400),
      ('indiehackers.com','/post/captions-growth','/pricing','captioning tool',64,'dofollow','active',120,420),
      ('theverge.com','/2024/02/ai-video-tools','/features/ai-video','AI video tools',90,'dofollow','new',24,4100),
      ('businessinsider.com','/ai-marketing-stack-2024','/','Caption Fox',91,'dofollow','new',18,3800),
      ('dmoz.org','/Computers/Software/Video','/','captioning software',87,'dofollow','new',12,1500),
      ('startupgrind.com','/blog/scaling-content','/case-studies/acme-corp','scaling content',84,'dofollow','new',9,700),
      ('spammy-link-farm.biz','/links/2431','/','cheap captions',9,'dofollow','toxic',300,0),
      ('seo-backlinks-cheap.info','/page/882','/pricing','buy captions',6,'dofollow','toxic',280,0),
      ('auto-directory-99.xyz','/listing/captionfox','/','captionfox',4,'dofollow','suspected_toxic',260,0),
      ('oldblog.example.org','/2019/captions','/features/legacy','captions',31,'dofollow','broken',900,0),
      ('moved-site.example.net','/go/captionfox','/','Caption Fox',42,'redirect','redirected',560,120),
      ('smallbizdaily.com','/tools/captioning','/pricing','captioning platform',58,'dofollow','active',310,340),
      ('marketingprofs.com','/articles/2024/captions','/blog/best-ai-content-tools','caption strategy',75,'dofollow','active',260,880),
      ('creatoreconomy.so','/p/caption-tools','/features/ai-content-generator','Caption Fox',61,'nofollow','active',95,510),
      ('socialmediatoday.com','/news/ai-captions-2024','/features/ai-content-generator','AI captions',80,'dofollow','active',132,1600)
  ) as d(domain, path, linked_page, anchor, authority, link_type, status, age, value)
  on conflict do nothing;

  insert into public.seo_top_linked_pages (workspace_id, site_id, page, backlinks, traffic_value, is_demo) values
    (p_workspace_id, v_site_id, '/',                              12384, 8700, true),
    (p_workspace_id, v_site_id, '/features/ai-content-generator',  8912, 6200, true),
    (p_workspace_id, v_site_id, '/blog/best-ai-content-tools',     6021, 4100, true),
    (p_workspace_id, v_site_id, '/pricing',                        4315, 2800, true),
    (p_workspace_id, v_site_id, '/case-studies',                   3207, 1600, true)
  on conflict do nothing;

  insert into public.seo_link_opportunities (workspace_id, site_id, domain, authority, relevance, match_score, match_reason, existing_relationship, status, is_demo) values
    (p_workspace_id, v_site_id, 'businessinsider.com', 91, 100, 96, 'Covers AI marketing tooling; already links to two direct competitors.', false, 'open', true),
    (p_workspace_id, v_site_id, 'theverge.com',        90,  98, 95, 'Publishes AI video tool round-ups matching our top clusters.',       false, 'open', true),
    (p_workspace_id, v_site_id, 'dmoz.org',            87,  97, 93, 'Category directory relevant to captioning software.',                false, 'open', true),
    (p_workspace_id, v_site_id, 'startupgrind.com',    84,  97, 92, 'Publishes founder case studies; we have two publishable studies.',    true,  'open', true),
    (p_workspace_id, v_site_id, 'producthunt.com',     83,  95, 90, 'Existing profile; launch update would earn a fresh link.',            true,  'listed', true),
    (p_workspace_id, v_site_id, 'marketingprofs.com',  75,  93, 86, 'Accepts contributed articles on content workflow.',                   false, 'open', true)
  on conflict do nothing;

  -- ---------------- content briefs ----------------
  insert into public.seo_content_briefs
    (workspace_id, site_id, title, target_keyword, content_type, intent, priority, status, completion,
     owner_id, due_date, est_traffic, created_by, is_demo)
  values
    (p_workspace_id, v_site_id, 'Ultimate Guide to Keyword Research',   'keyword research tools',  'guide',     'informational', 'high',   'in_progress',     72, p_user_id, v_today - 4,  4300, p_user_id, true),
    (p_workspace_id, v_site_id, 'How to Improve SEO Rankings in 2024',  'improve seo rankings',    'how_to',    'transactional', 'high',   'in_progress',     58, p_user_id, v_today + 2,  3100, p_user_id, true),
    (p_workspace_id, v_site_id, 'Technical SEO Checklist',              'technical seo checklist', 'checklist', 'informational', 'medium', 'awaiting_review', 85, p_user_id, v_today + 7,  2600, p_user_id, true),
    (p_workspace_id, v_site_id, 'Content Optimization Best Practices',  'content optimization',    'guide',     'informational', 'medium', 'awaiting_review', 90, p_user_id, v_today + 9,  2200, p_user_id, true),
    (p_workspace_id, v_site_id, 'Local SEO Strategy for Businesses',    'local seo strategy',      'guide',     'transactional', 'medium', 'draft',           30, p_user_id, v_today + 13, 1900, p_user_id, true),
    (p_workspace_id, v_site_id, 'E-E-A-T: Build Trust & Authority',     'eeat seo',                'guide',     'informational', 'low',    'draft',           25, p_user_id, v_today + 17, 1500, p_user_id, true),
    (p_workspace_id, v_site_id, 'Adding Captions to Video: Full Guide', 'add captions to video',   'how_to',    'informational', 'high',   'published',      100, p_user_id, v_today - 20, 5200, p_user_id, true),
    (p_workspace_id, v_site_id, 'Instagram Caption Ideas That Convert', 'instagram caption ideas', 'listicle',  'informational', 'medium', 'published',      100, p_user_id, v_today - 33, 4700, p_user_id, true),
    (p_workspace_id, v_site_id, 'Caption Fox vs Descript',              'descript alternative',    'comparison','commercial',    'high',   'approved',        95, p_user_id, v_today + 5,  2800, p_user_id, true),
    (p_workspace_id, v_site_id, 'Subtitle Formats Explained (SRT, VTT)','srt vs vtt',              'guide',     'informational', 'low',    'changes_requested',45, p_user_id, v_today + 11, 1200, p_user_id, true);

  -- link briefs to keywords where the target keyword matches a tracked keyword
  update public.seo_content_briefs b
  set keyword_id = k.id
  from public.seo_keywords k
  where b.site_id = v_site_id and k.site_id = v_site_id and lower(k.keyword) = lower(b.target_keyword);

  select id into v_brief_id from public.seo_content_briefs
  where site_id = v_site_id and title = 'Ultimate Guide to Keyword Research' limit 1;

  insert into public.seo_brief_sections (workspace_id, brief_id, level, title, position, completed, is_demo) values
    (p_workspace_id, v_brief_id, 'h1', 'What is Keyword Research?',              1, true,  true),
    (p_workspace_id, v_brief_id, 'h2', 'Why Keyword Research Matters',           2, true,  true),
    (p_workspace_id, v_brief_id, 'h2', 'Types of Keywords',                      3, true,  true),
    (p_workspace_id, v_brief_id, 'h2', 'How to Do Keyword Research (Step-by-Step)', 4, false, true),
    (p_workspace_id, v_brief_id, 'h2', 'Best Keyword Research Tools',            5, false, true),
    (p_workspace_id, v_brief_id, 'h2', 'Keyword Metrics to Analyze',             6, false, true),
    (p_workspace_id, v_brief_id, 'h2', 'Common Keyword Research Mistakes',       7, false, true),
    (p_workspace_id, v_brief_id, 'h2', 'Conclusion',                             8, false, true);

  insert into public.seo_brief_comments (workspace_id, brief_id, author_id, body, created_at, is_demo) values
    (p_workspace_id, v_brief_id, p_user_id, 'Let''s add a section on AI tools for keyword research.', now() - interval '1 hour', true),
    (p_workspace_id, v_brief_id, p_user_id, 'Great idea — I''ll update the outline.', now() - interval '45 minutes', true);

  -- ---------------- opportunities ----------------
  insert into public.seo_opportunities
    (workspace_id, site_id, scope, category, title, description, search_volume, potential_traffic,
     potential_rank, potential_lift, priority, effort, impact, status, score, score_reason, is_demo)
  values
    (p_workspace_id, v_site_id, 'organic','ranking_improvement','Improve rankings for "video captioning"','High volume keyword currently on page 2.',27100,2300,3,null,'high','medium','high','open',88.0,'Position 11-20 with strong impressions and an existing landing page.',true),
    (p_workspace_id, v_site_id, 'organic','faq_opportunity','Add FAQs to 15 pages','Rank for 120+ long-tail question keywords.',12400,1100,null,null,'high','low','medium','open',81.0,'Question keywords with People Also Ask features and no current answer block.',true),
    (p_workspace_id, v_site_id, 'organic','underperforming_page','Optimize 8 underperforming pages','Positions 11-20 with high impressions.',18700,950,null,null,'medium','medium','medium','open',74.0,'High impressions, CTR below the position-band benchmark.',true),
    (p_workspace_id, v_site_id, 'organic','backlink_opportunity','Build backlinks to top guides','Increase authority and rankings.',9200,540,null,null,'medium','high','medium','open',66.0,'Top pages rank 11-20 with fewer referring domains than the top 3 results.',true),
    (p_workspace_id, v_site_id, 'organic','outdated_content','Update content for 2023 keywords','Refresh and improve existing content.',6600,320,null,null,'low','low','low','open',52.0,'Published over 18 months ago with declining impressions.',true),
    (p_workspace_id, v_site_id, 'ranking','quick_win','text to video ai','Reachable top-3 position from the current band.',14800,900,3,null,'high','medium','high','open',84.0,'Rank 22 with search volume above 10K and an existing landing page.',true),
    (p_workspace_id, v_site_id, 'ranking','quick_win','ai video editor','Reachable top-10 position.',33100,1400,10,null,'high','high','high','open',83.0,'Rank 31 with very high volume; needs content depth.',true),
    (p_workspace_id, v_site_id, 'ranking','quick_win','transcribe video online','Reachable top-10 position.',9900,610,10,null,'medium','low','medium','open',71.0,'Rank 13 with an existing landing page — on-page work only.',true),
    (p_workspace_id, v_site_id, 'ranking','quick_win','ai voice generator','Reachable top-3 position.',6600,430,3,null,'medium','medium','medium','open',68.0,'Rank 26 with moderate difficulty.',true),
    (p_workspace_id, v_site_id, 'ranking','quick_win','youtube subtitle generator','Reachable top-10 position.',12100,720,10,null,'low','low','medium','open',63.0,'Rank 9 and stable — small on-page gains available.',true),
    (p_workspace_id, v_site_id, 'ai_search','ai_citation_gap','ai caption generator for tiktok','High prompt volume, low visibility across ChatGPT.',0,0,null,'+14 visibility','high','medium','high','open',79.0,'Tracked prompt visibility below 30 with competitor citations present.',true),
    (p_workspace_id, v_site_id, 'ai_search','ai_visibility','best captions for product launch','Medium volume, low visibility.',0,0,null,'+9 visibility','medium','low','medium','open',64.0,'No cited source from our domain in the last 28 days of checks.',true),
    (p_workspace_id, v_site_id, 'ai_search','ai_citation_gap','instagram captions that sell','High volume, low visibility.',0,0,null,'+11 visibility','high','medium','high','open',76.0,'Prompt returns competitor pages only.',true),
    (p_workspace_id, v_site_id, 'backlink','backlink_opportunity','Pitch Business Insider AI stack round-up','Authority 91 with a direct topical match.',0,0,null,'+3 authority','high','medium','high','open',96.0,'Match score = 0.6 x relevance + 0.4 x authority.',true),
    (p_workspace_id, v_site_id, 'backlink','backlink_opportunity','Pitch The Verge AI video tools piece','Authority 90 with a direct topical match.',0,0,null,'+3 authority','high','medium','high','open',95.0,'Match score = 0.6 x relevance + 0.4 x authority.',true);

  -- local opportunities (bound to real locations)
  insert into public.seo_opportunities
    (workspace_id, site_id, scope, category, title, description, location_id, potential_lift, priority, effort, impact, status, score, score_reason, is_demo)
  values
    (p_workspace_id, v_site_id, 'local','profile_completeness','Improve Google profile completeness','Missing services and attributes on the Manchester profile.', v_loc_ids[3], '+18% visibility','high','low','high','open',89.0,'Profile completeness 88% with 4 unfilled high-weight fields.',true),
    (p_workspace_id, v_site_id, 'local','missing_category','Add missing primary category','Bristol has no secondary category set.', v_loc_ids[4], '+12% visibility','high','low','high','open',85.0,'Category coverage below peer median for the local pack.',true),
    (p_workspace_id, v_site_id, 'local','reviews','Generate new reviews','Shoreditch review velocity fell 30% month over month.', v_loc_ids[1], '+9% visibility','medium','medium','medium','in_progress',72.0,'Review velocity below the 90-day average.',true),
    (p_workspace_id, v_site_id, 'local','citations','Fix inconsistent NAP on Yelp','Phone number differs from the Google profile.', v_loc_ids[5], '+7% visibility','medium','low','medium','open',68.0,'NAP mismatch detected against the canonical location record.',true),
    (p_workspace_id, v_site_id, 'local','local_schema','Add local landing page schema','LocalBusiness schema missing on the Soho page.', v_loc_ids[2], '+6% visibility','medium','medium','medium','open',64.0,'No LocalBusiness structured data found on the mapped landing page.',true);

  -- ---------------- daily site aggregate (120 days) ----------------
  insert into public.seo_site_daily (
    workspace_id, site_id, date, clicks, impressions, ctr, avg_position, visibility_score, share_of_voice,
    tracked_keywords, top3_keywords, top10_keywords, winning_keywords, declining_keywords, est_organic_traffic,
    map_pack_visibility, avg_local_rank, profile_views, avg_review_score,
    ai_visibility_score, citation_rate, brand_mentions, linked_sources, tracked_prompts,
    authority_score, total_backlinks, referring_domains, new_links, lost_links, toxic_links,
    source, is_demo)
  select
    p_workspace_id, v_site_id, v_today - g,
    greatest(0, round(940 - g * 3.4 + 70 * sin(g / 7.0))::int),
    greatest(0, round(41000 - g * 140 + 2600 * sin(g / 6.0))::int),
    0.0230,
    round((18.7 + g * 0.022 + 0.55 * sin(g / 5.0))::numeric, 2),
    round((62.4 - g * 0.072 + 1.8 * cos(g / 8.0))::numeric, 2),
    round((14.2 - g * 0.015 + 0.4 * sin(g / 9.0))::numeric, 2),
    greatest(0, 2842 - g * 4),
    greatest(0, 128 - round(g * 0.12)::int),
    greatest(0, 542 - round(g * 0.3)::int),
    greatest(0, 612 - round(g * 0.9)::int),
    greatest(0, 243 + round(g * 0.4)::int),
    greatest(0, round(124300 - g * 420 + 5200 * sin(g / 7.0))::int),
    round((68.7 - g * 0.078 + 2.2 * cos(g / 7.0))::numeric, 2),
    round((2.6 + g * 0.006 + 0.18 * sin(g / 6.0))::numeric, 2),
    greatest(0, round(2900 - g * 9 + 260 * sin(g / 5.0))::int),
    4.60,
    round((72.4 - g * 0.062 + 2.4 * sin(g / 8.0))::numeric, 2),
    round((28.7 - g * 0.017 + 1.1 * cos(g / 6.0))::numeric, 2),
    greatest(0, 1876 - g * 6),
    greatest(0, 542 - g * 2),
    12,
    round((62 - g * 0.04)::numeric, 2),
    greatest(0, 54382 - g * 62),
    greatest(0, 3621 - g * 5),
    greatest(0, round(2417 / 30.0 + 12 * sin(g / 4.0))::int),
    greatest(0, round(1203 / 30.0 + 6 * cos(g / 5.0))::int),
    greatest(0, 128 + round(g * 0.1)::int),
    'internal_tracker', true
  from generate_series(0, 119) g
  on conflict do nothing;

  -- ---------------- activity ----------------
  insert into public.seo_activity (workspace_id, site_id, actor_id, actor_label, entity_type, action, summary, detail, link, severity, surface, created_at, is_demo) values
    (p_workspace_id, v_site_id, p_user_id, null, 'keyword','rank_improved','25 keywords moved up','Since yesterday','/app/seo/keywords?sort=rank_change.desc','success','overview', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, null, 'Google Search Console','page','indexed','12 pages indexed','by Google','/app/seo/rankings','info','overview', now() - interval '5 hours', true),
    (p_workspace_id, v_site_id, null, 'Google Search Console','keyword','rank_lost','3 pages lost rankings','Check performance','/app/seo/rankings?tab=declined','warning','overview', now() - interval '8 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','keyword','top_three','New top 3 ranking','"caption generator online"','/app/seo/keywords?q=caption+generator+online','success','overview', now() - interval '1 day', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','site','audit_completed','Site audit completed','No critical issues','/app/seo','info','overview', now() - interval '1 day', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','keyword','rank_improved','Rank improved','ai content generator moved from 11 to 6','/app/seo/keywords?q=ai+content+generator','success','keywords', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','keyword','rank_declined','Rank declined','transcribe video online moved from 10 to 13','/app/seo/keywords?q=transcribe+video+online','warning','keywords', now() - interval '4 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'keyword','created','New keyword added','best ai subtitle generator added to AI Content Tools','/app/seo/keywords','info','keywords', now() - interval '6 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','keyword','top_three','Keyword hit top 3','auto subtitle generator reached position 2','/app/seo/keywords','success','keywords', now() - interval '8 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'brief','updated','Brief updated','"Ultimate Guide to Keyword Research"','/app/seo/briefs','info','briefs', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'brief','submitted','Brief submitted for review','"How to Improve SEO Rankings in 2024"','/app/seo/briefs','info','briefs', now() - interval '4 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'brief','commented','Comments added','"Technical SEO Checklist"','/app/seo/briefs','info','briefs', now() - interval '6 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'brief','published','Brief published','"Content Optimization Best Practices"','/app/seo/briefs','success','briefs', now() - interval '1 day', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','keyword','rank_improved','"ai content generator" moved up 5 positions','From #11 to #6','/app/seo/rankings','success','rankings', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'keyword','tracked','New keyword added to tracking','"facebook video downloader"','/app/seo/rankings','info','rankings', now() - interval '5 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','site','visibility_drop','Visibility Score dropped 2.1%','Top 10 keywords declined','/app/seo/rankings','warning','rankings', now() - interval '7 hours', true),
    (p_workspace_id, v_site_id, null, 'Google Search Console','source','synced','Google Search Console synced','2,300 keywords updated','/app/seo/rankings','info','rankings', now() - interval '9 hours', true),
    (p_workspace_id, v_site_id, null, 'Google Business Profile','review','received','New review received at Shoreditch',null,'/app/seo/local','success','local', now() - interval '2 minutes', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','location','rank_improved','Soho location moved up to #2 in Map Pack',null,'/app/seo/local','success','local', now() - interval '18 minutes', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'location','photos_added','5 new photos added at Manchester',null,'/app/seo/local','info','local', now() - interval '1 hour', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','listing','citation_issue','Citation inconsistent on Yelp at Edinburgh',null,'/app/seo/local','warning','local', now() - interval '3 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','location','competitor','New competitor detected near Bristol',null,'/app/seo/local','info','local', now() - interval '5 hours', true),
    (p_workspace_id, v_site_id, p_user_id, null, 'ai_prompt','created','New prompt tracked: "ai caption generator for tiktok"',null,'/app/seo/ai-search','info','ai-search', now() - interval '10 minutes', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','ai_prompt','visibility_improved','Visibility improved for "best AI caption generator"','ChatGPT · +12 points','/app/seo/ai-search','success','ai-search', now() - interval '1 hour', true),
    (p_workspace_id, v_site_id, null, 'Perplexity','ai_citation','detected','New citation detected in Perplexity','Page: /ai-content-generator','/app/seo/ai-search','success','ai-search', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','ai_prompt','visibility_dropped','Prompt performance drop detected','"caption generator for instagram reels" on Gemini','/app/seo/ai-search','warning','ai-search', now() - interval '3 hours', true),
    (p_workspace_id, v_site_id, null, 'Ahrefs','backlink','discovered','New backlink from forbes.com','Linked to /features/ai-content-workflow','/app/seo/backlinks','success','backlinks', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, null, 'Ahrefs','backlink','lost','Link lost from reddit.com','Previously linked to /pricing','/app/seo/backlinks','warning','backlinks', now() - interval '5 hours', true),
    (p_workspace_id, v_site_id, null, 'Ahrefs','backlink','discovered','New backlink from techcrunch.com','Linked to /features/ai-content-generator','/app/seo/backlinks','success','backlinks', now() - interval '7 hours', true),
    (p_workspace_id, v_site_id, null, 'Ahrefs','backlink','status_changed','Status changed to Lost for quora.com','Was linking to /blog/best-ai-tools','/app/seo/backlinks','warning','backlinks', now() - interval '1 day', true),
    (p_workspace_id, v_site_id, null, 'Ahrefs','backlink','discovered','New backlink from medium.com','Linked to /case-studies/acme-corp','/app/seo/backlinks','success','backlinks', now() - interval '1 day', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','backlink','toxic_detected','128 toxic links detected','3 domains flagged as potentially harmful','/app/seo/backlinks?status=toxic','critical','backlinks', now() - interval '2 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','backlink','links_lost','1,203 links lost','Links removed from 356 domains','/app/seo/backlinks?status=lost','warning','backlinks', now() - interval '5 hours', true),
    (p_workspace_id, v_site_id, null, 'Caption Fox tracker','site','authority_increased','Authority score increased','Your authority score is up by 5 points','/app/seo/backlinks','success','backlinks', now() - interval '1 day', true);

  return v_site_id;
end $$;

grant execute on function public.seed_seo_demo(uuid, uuid) to authenticated, service_role;
