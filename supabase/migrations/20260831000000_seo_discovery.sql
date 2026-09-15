-- ============================================================
-- Campaign Manager -> SEO & Discovery module (shared across eligible workspace types)
--   /app/seo
--   /app/seo/keywords
--   /app/seo/briefs
--   /app/seo/rankings
--   /app/seo/local
--   /app/seo/ai-search
--   /app/seo/backlinks
--
-- Principles
--   1. Extend, do not duplicate. SEO records REFERENCE canonical records
--      (workspaces, profiles, campaigns, brands) rather than copying them.
--   2. Every workspace-owned row carries workspace_id + RLS scoped through
--      workspace_members, matching the established Caption Fox policy shape.
--   3. SEO data is attached to a SITE (search property / domain). Site context
--      is explicit on every child row so cross-site linking is impossible.
--   4. Source transparency is first class: every metric row records which
--      provider produced it and when it was last collected.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SITES (search properties / domains)
-- ------------------------------------------------------------
create table if not exists public.seo_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  name text not null,
  domain text not null,
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active','paused','archived')),

  timezone text not null default 'Europe/London',
  default_country text not null default 'gb',
  default_device text not null default 'desktop' check (default_device in ('desktop','mobile','tablet')),
  default_search_engine text not null default 'google',

  brand_id uuid references public.brands(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,

  is_demo boolean not null default false,
  metadata jsonb not null default '{}',

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_seo_sites_workspace_domain on public.seo_sites(workspace_id, lower(domain));
create index if not exists idx_seo_sites_workspace on public.seo_sites(workspace_id) where archived_at is null;

-- ------------------------------------------------------------
-- 2. SOURCE CONNECTIONS + SYNC RUNS
-- ------------------------------------------------------------
create table if not exists public.seo_source_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  provider text not null check (provider in (
    'google_search_console','google_analytics','google_business_profile',
    'bing_webmaster','semrush','ahrefs','dataforseo','moz','majestic',
    'brightlocal','internal_tracker','manual'
  )),
  property_label text,
  property_ref text,

  status text not null default 'connected'
    check (status in ('connected','needs_reauth','error','disconnected','pending')),
  is_primary boolean not null default false,

  -- What this provider can actually supply. Drives available metrics/filters.
  capabilities jsonb not null default '{}',
  coverage_keywords integer not null default 0,
  coverage_note text,

  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  sync_frequency text not null default 'daily' check (sync_frequency in ('hourly','daily','weekly','manual')),

  connected_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, provider, property_ref)
);
create index if not exists idx_seo_sources_site on public.seo_source_connections(site_id, status);

create table if not exists public.seo_source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null references public.seo_source_connections(id) on delete cascade,

  status text not null default 'queued' check (status in ('queued','running','success','partial','failed','cancelled')),
  kind text not null default 'incremental' check (kind in ('incremental','full','manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_sync_runs_connection on public.seo_source_sync_runs(connection_id, started_at desc);

-- ------------------------------------------------------------
-- 3. DAILY SITE AGGREGATE — powers every KPI + trend chart
-- ------------------------------------------------------------
create table if not exists public.seo_site_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  date date not null,

  -- search performance
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(6,4) not null default 0,
  avg_position numeric(6,2),
  visibility_score numeric(6,2),
  share_of_voice numeric(6,2),
  tracked_keywords integer not null default 0,
  top3_keywords integer not null default 0,
  top10_keywords integer not null default 0,
  winning_keywords integer not null default 0,
  declining_keywords integer not null default 0,
  est_organic_traffic integer not null default 0,

  -- local
  map_pack_visibility numeric(6,2),
  avg_local_rank numeric(6,2),
  profile_views integer not null default 0,
  avg_review_score numeric(3,2),

  -- ai search
  ai_visibility_score numeric(6,2),
  citation_rate numeric(6,2),
  brand_mentions integer not null default 0,
  linked_sources integer not null default 0,
  tracked_prompts integer not null default 0,

  -- backlinks
  authority_score numeric(6,2),
  total_backlinks integer not null default 0,
  referring_domains integer not null default 0,
  new_links integer not null default 0,
  lost_links integer not null default 0,
  toxic_links integer not null default 0,

  source text not null default 'internal_tracker',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (site_id, date)
);
create index if not exists idx_seo_site_daily_range on public.seo_site_daily(site_id, date desc);

-- ------------------------------------------------------------
-- 4. KEYWORDS + CLUSTERS + RANK HISTORY
-- ------------------------------------------------------------
create table if not exists public.seo_keyword_clusters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  name text not null,
  colour text not null default '#2563EB',
  description text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, name)
);

create table if not exists public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  cluster_id uuid references public.seo_keyword_clusters(id) on delete set null,

  keyword text not null,
  intent text not null default 'informational'
    check (intent in ('informational','transactional','commercial','navigational','other')),
  search_volume integer not null default 0,
  difficulty integer check (difficulty between 0 and 100),
  cpc numeric(10,2),

  -- NULL rank = not ranking / outside tracking limit. Never coerce to 0.
  current_rank integer,
  previous_rank integer,
  best_rank integer,
  rank_change integer,

  landing_page text,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'stable'
    check (status in ('winning','rising','stable','declining','not_ranking')),

  country text not null default 'gb',
  device text not null default 'desktop' check (device in ('desktop','mobile','tablet')),
  search_engine text not null default 'google',
  location_id uuid,

  is_favourite boolean not null default false,
  source text not null default 'internal_tracker',
  tags text[],
  is_demo boolean not null default false,

  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, keyword, country, device, search_engine)
);
create index if not exists idx_seo_keywords_site on public.seo_keywords(site_id) where archived_at is null;
create index if not exists idx_seo_keywords_cluster on public.seo_keywords(cluster_id);
create index if not exists idx_seo_keywords_rank on public.seo_keywords(site_id, current_rank);
create index if not exists idx_seo_keywords_search on public.seo_keywords using gin (to_tsvector('english', keyword));

create table if not exists public.seo_keyword_rankings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  keyword_id uuid not null references public.seo_keywords(id) on delete cascade,

  date date not null,
  position integer,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(6,4) not null default 0,
  url text,
  serp_features text[],
  source text not null default 'internal_tracker',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (keyword_id, date, source)
);
create index if not exists idx_seo_keyword_rankings_range on public.seo_keyword_rankings(keyword_id, date desc);

-- ------------------------------------------------------------
-- 5. CONTENT BRIEFS
-- ------------------------------------------------------------
create table if not exists public.seo_content_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  title text not null,
  target_keyword text not null,
  keyword_id uuid references public.seo_keywords(id) on delete set null,

  content_type text not null default 'guide'
    check (content_type in ('guide','how_to','checklist','listicle','comparison','landing_page','blog','case_study','faq','other')),
  intent text not null default 'informational'
    check (intent in ('informational','transactional','commercial','navigational','other')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),

  status text not null default 'draft'
    check (status in ('draft','in_progress','awaiting_review','changes_requested','approved','published','archived')),
  completion integer not null default 0 check (completion between 0 and 100),

  owner_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  due_date date,
  published_at timestamptz,
  published_url text,

  est_traffic integer not null default 0,
  campaign_id uuid references public.campaigns(id) on delete set null,
  notes text,
  is_demo boolean not null default false,

  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_briefs_site on public.seo_content_briefs(site_id, status) where archived_at is null;
create index if not exists idx_seo_briefs_due on public.seo_content_briefs(site_id, due_date);

create table if not exists public.seo_brief_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_id uuid not null references public.seo_content_briefs(id) on delete cascade,
  level text not null default 'h2' check (level in ('h1','h2','h3')),
  title text not null,
  guidance text,
  position integer not null default 0,
  completed boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_brief_sections_brief on public.seo_brief_sections(brief_id, position);

create table if not exists public.seo_brief_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_id uuid not null references public.seo_content_briefs(id) on delete cascade,
  parent_id uuid references public.seo_brief_comments(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  resolved_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_brief_comments_brief on public.seo_brief_comments(brief_id, created_at desc);

-- ------------------------------------------------------------
-- 6. OPPORTUNITIES (shared across overview / keywords / rankings / local / ai / backlinks)
-- ------------------------------------------------------------
create table if not exists public.seo_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  scope text not null default 'organic'
    check (scope in ('organic','ranking','local','ai_search','backlink','content')),
  category text not null default 'ranking_improvement'
    check (category in (
      'ranking_improvement','content_gap','faq_opportunity','underperforming_page',
      'backlink_opportunity','outdated_content','internal_link','technical',
      'profile_completeness','missing_category','reviews','citations','local_schema',
      'photos','opening_hours','landing_page','duplicate_listing','quick_win',
      'ai_citation_gap','ai_visibility'
    )),

  title text not null,
  description text,
  keyword_id uuid references public.seo_keywords(id) on delete set null,
  location_id uuid,
  prompt_id uuid,

  search_volume integer not null default 0,
  potential_traffic integer not null default 0,
  potential_rank integer,
  potential_lift text,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  effort text not null default 'medium' check (effort in ('high','medium','low')),
  impact text not null default 'medium' check (impact in ('high','medium','low')),

  status text not null default 'open' check (status in ('open','in_progress','done','dismissed')),
  score numeric(6,2),
  score_reason text,

  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_opportunities_site on public.seo_opportunities(site_id, scope, status);

-- ------------------------------------------------------------
-- 7. COMPETITORS
-- ------------------------------------------------------------
create table if not exists public.seo_competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  domain text not null,
  label text,
  colour text not null default '#2563EB',
  is_self boolean not null default false,
  visibility numeric(6,2),
  avg_rank numeric(6,2),
  share_of_voice numeric(6,2),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, domain)
);

create table if not exists public.seo_competitor_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  competitor_id uuid not null references public.seo_competitors(id) on delete cascade,
  date date not null,
  visibility numeric(6,2),
  avg_rank numeric(6,2),
  is_demo boolean not null default false,
  unique (competitor_id, date)
);

-- ------------------------------------------------------------
-- 8. LOCAL — locations, rankings, listings, reviews
-- ------------------------------------------------------------
create table if not exists public.seo_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  name text not null,
  location_code text,
  address_line text,
  city text,
  region text,
  postcode text,
  country text not null default 'gb',
  latitude numeric(9,6),
  longitude numeric(9,6),

  phone text,
  website text,
  primary_category text,
  additional_categories text[],
  opening_hours jsonb,
  timezone text not null default 'Europe/London',
  image_url text,

  status text not null default 'open' check (status in ('open','at_risk','temporarily_closed','closed','pending')),
  avg_local_rank numeric(6,2),
  map_pack_visibility numeric(6,2),
  review_score numeric(3,2),
  review_count integer not null default 0,
  profile_completeness integer check (profile_completeness between 0 and 100),
  profile_views integer not null default 0,

  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_locations_latlng check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);
create unique index if not exists idx_seo_locations_unique on public.seo_locations(site_id, lower(name), lower(coalesce(address_line,'')));
create index if not exists idx_seo_locations_site on public.seo_locations(site_id) where archived_at is null;

create table if not exists public.seo_local_rankings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  location_id uuid not null references public.seo_locations(id) on delete cascade,
  date date not null,
  avg_local_rank numeric(6,2),
  map_pack_visibility numeric(6,2),
  profile_views integer not null default 0,
  keyword text,
  source text not null default 'internal_tracker',
  is_demo boolean not null default false
);
create unique index if not exists idx_seo_local_rankings_unique
  on public.seo_local_rankings(location_id, date, coalesce(keyword, ''));
create index if not exists idx_seo_local_rankings_range on public.seo_local_rankings(location_id, date desc);

create table if not exists public.seo_business_listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  location_id uuid references public.seo_locations(id) on delete cascade,

  directory text not null check (directory in ('google_business_profile','bing_places','apple_maps','facebook','yelp','other')),
  completeness integer not null default 0 check (completeness between 0 and 100),
  health text not null default 'healthy' check (health in ('healthy','needs_attention','error','not_connected')),
  issue_count integer not null default 0,
  connected boolean not null default false,
  last_synced_at timestamptz,
  external_ref text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_listings_site on public.seo_business_listings(site_id, directory);

create table if not exists public.seo_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  location_id uuid references public.seo_locations(id) on delete cascade,

  rating integer not null check (rating between 1 and 5),
  author_display text,
  body text,
  source text not null default 'google_business_profile',
  responded boolean not null default false,
  responded_at timestamptz,
  published_at timestamptz not null default now(),
  external_ref text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_reviews_site on public.seo_reviews(site_id, published_at desc);

-- ------------------------------------------------------------
-- 9. AI SEARCH — prompts, checks, engines, cited pages
-- ------------------------------------------------------------
create table if not exists public.seo_ai_engines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  engine text not null check (engine in ('chatgpt','perplexity','google_sge','gemini','claude','bing_copilot')),
  available boolean not null default true,
  -- How results are obtained. Never claim direct API access we do not have.
  method text not null default 'manual_check'
    check (method in ('provider_api','search_provider','browser_sample','third_party_dataset','manual_check','estimated')),
  coverage_pct numeric(5,2) not null default 0,
  health text not null default 'healthy' check (health in ('healthy','degraded','error','unavailable')),
  last_checked_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, engine)
);

create table if not exists public.seo_ai_prompts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  prompt text not null,
  engine text not null check (engine in ('chatgpt','perplexity','google_sge','gemini','claude','bing_copilot')),
  region text not null default 'gb',
  language text not null default 'en',
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly','manual')),

  visibility integer check (visibility between 0 and 100),
  visibility_band text check (visibility_band in ('high','medium','low','none')),
  citation_status text not null default 'unknown' check (citation_status in ('cited','not_cited','partial','unknown')),
  -- Sentiment is model-estimated, never presented as objective fact.
  sentiment text check (sentiment in ('positive','neutral','negative','mixed')),
  sentiment_confidence numeric(4,3),
  sentiment_model text,

  linked_page text,
  last_checked_at timestamptz,
  method text not null default 'manual_check'
    check (method in ('provider_api','search_provider','browser_sample','third_party_dataset','manual_check','estimated')),

  owner_id uuid references public.profiles(id) on delete set null,
  tags text[],
  status text not null default 'active' check (status in ('active','paused','archived')),
  is_demo boolean not null default false,

  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, prompt, engine, region)
);
create index if not exists idx_seo_ai_prompts_site on public.seo_ai_prompts(site_id, engine) where archived_at is null;

create table if not exists public.seo_ai_prompt_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prompt_id uuid not null references public.seo_ai_prompts(id) on delete cascade,
  checked_at timestamptz not null default now(),
  engine text not null,
  visibility integer,
  cited boolean not null default false,
  brand_mentioned boolean not null default false,
  sentiment text,
  answer_excerpt text,
  method text not null default 'manual_check',
  is_demo boolean not null default false
);
create index if not exists idx_seo_ai_checks_prompt on public.seo_ai_prompt_checks(prompt_id, checked_at desc);

create table if not exists public.seo_ai_cited_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  page text not null,
  citations integer not null default 0,
  change_28d integer not null default 0,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (site_id, page)
);

-- Where AI answers pull their sources from — powers Source Transparency.
create table if not exists public.seo_ai_source_mix (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  bucket text not null check (bucket in ('our_content','third_party','other','unknown')),
  share_pct numeric(5,2) not null default 0,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (site_id, bucket)
);

-- ------------------------------------------------------------
-- 10. BACKLINKS
-- ------------------------------------------------------------
create table if not exists public.seo_backlinks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  referring_domain text not null,
  source_url text not null,
  linked_page text not null,
  anchor_text text,
  authority integer check (authority between 0 and 100),
  authority_metric text not null default 'internal_authority_score',

  link_type text not null default 'dofollow' check (link_type in ('dofollow','nofollow','ugc','sponsored','redirect')),
  status text not null default 'active'
    check (status in ('active','new','lost','redirected','broken','toxic','suspected_toxic','unknown')),

  first_seen date,
  last_seen date,
  traffic_value integer not null default 0,
  country text,
  tld text,
  source text not null default 'internal_tracker',
  is_demo boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, source_url, linked_page)
);
create index if not exists idx_seo_backlinks_site on public.seo_backlinks(site_id, status);
create index if not exists idx_seo_backlinks_domain on public.seo_backlinks(site_id, referring_domain);
create index if not exists idx_seo_backlinks_authority on public.seo_backlinks(site_id, authority desc);

create table if not exists public.seo_link_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,

  domain text not null,
  authority integer check (authority between 0 and 100),
  relevance integer check (relevance between 0 and 100),
  -- Documented formula: round(0.6 * relevance + 0.4 * authority).
  match_score integer check (match_score between 0 and 100),
  match_reason text,
  existing_relationship boolean not null default false,
  contact_page text,
  status text not null default 'open' check (status in ('open','listed','contacted','won','lost','dismissed')),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, domain)
);

create table if not exists public.seo_outreach_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, name)
);

create table if not exists public.seo_outreach_list_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id uuid not null references public.seo_outreach_lists(id) on delete cascade,
  opportunity_id uuid references public.seo_link_opportunities(id) on delete cascade,
  domain text not null,
  status text not null default 'queued' check (status in ('queued','contacted','replied','won','lost','skipped')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, domain)
);

create table if not exists public.seo_top_linked_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  page text not null,
  backlinks integer not null default 0,
  traffic_value integer not null default 0,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (site_id, page)
);

-- ------------------------------------------------------------
-- 11. ACTIVITY + ALERTS
-- ------------------------------------------------------------
create table if not exists public.seo_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid references public.seo_sites(id) on delete cascade,

  actor_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  detail text,
  link text,
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  surface text not null default 'overview'
    check (surface in ('overview','keywords','briefs','rankings','local','ai-search','backlinks')),
  before_value jsonb,
  after_value jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_activity_site on public.seo_activity(site_id, created_at desc);
create index if not exists idx_seo_activity_surface on public.seo_activity(site_id, surface, created_at desc);

-- ------------------------------------------------------------
-- 12. Deferred cross-table FKs (locations/prompts referenced above)
-- ------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'seo_keywords_location_fk') then
    alter table public.seo_keywords
      add constraint seo_keywords_location_fk foreign key (location_id)
      references public.seo_locations(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seo_opportunities_location_fk') then
    alter table public.seo_opportunities
      add constraint seo_opportunities_location_fk foreign key (location_id)
      references public.seo_locations(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seo_opportunities_prompt_fk') then
    alter table public.seo_opportunities
      add constraint seo_opportunities_prompt_fk foreign key (prompt_id)
      references public.seo_ai_prompts(id) on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 13. ROW LEVEL SECURITY — workspace membership on every table
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'seo_sites','seo_source_connections','seo_source_sync_runs','seo_site_daily',
    'seo_keyword_clusters','seo_keywords','seo_keyword_rankings',
    'seo_content_briefs','seo_brief_sections','seo_brief_comments',
    'seo_opportunities','seo_competitors','seo_competitor_daily',
    'seo_locations','seo_local_rankings','seo_business_listings','seo_reviews',
    'seo_ai_engines','seo_ai_prompts','seo_ai_prompt_checks','seo_ai_cited_pages','seo_ai_source_mix',
    'seo_backlinks','seo_link_opportunities','seo_outreach_lists','seo_outreach_list_items',
    'seo_top_linked_pages','seo_activity'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_workspace', t);
    execute format(
      'create policy %I on public.%I for all using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))',
      t || '_workspace', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 14. updated_at triggers
-- ------------------------------------------------------------
create or replace function public.seo_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'seo_sites','seo_source_connections','seo_keyword_clusters','seo_keywords',
    'seo_content_briefs','seo_brief_sections','seo_brief_comments','seo_opportunities',
    'seo_competitors','seo_locations','seo_business_listings','seo_ai_engines',
    'seo_ai_prompts','seo_backlinks','seo_link_opportunities','seo_outreach_lists',
    'seo_outreach_list_items'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.seo_touch_updated_at()',
      t || '_touch', t);
  end loop;
end $$;
