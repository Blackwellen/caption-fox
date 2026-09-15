// SEO & Discovery domain types — mirror the SQL contract in
// supabase/migrations/20260831000000_seo_discovery.sql exactly.

export type SeoTabId =
  | 'overview'
  | 'keywords'
  | 'briefs'
  | 'rankings'
  | 'local'
  | 'ai-search'
  | 'backlinks'

export type SeoWorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export type SeoIntent = 'informational' | 'transactional' | 'commercial' | 'navigational' | 'other'
export type SeoDevice = 'desktop' | 'mobile' | 'tablet'
export type SeoKeywordStatus = 'winning' | 'rising' | 'stable' | 'declining' | 'not_ranking'

export type SeoProvider =
  | 'google_search_console' | 'google_analytics' | 'google_business_profile'
  | 'bing_webmaster' | 'semrush' | 'ahrefs' | 'dataforseo' | 'moz' | 'majestic'
  | 'brightlocal' | 'internal_tracker' | 'manual'

export type SeoSourceStatus = 'connected' | 'needs_reauth' | 'error' | 'disconnected' | 'pending'

/** What a provider can actually supply. Drives available metrics and filters. */
export interface SeoSourceCapabilities {
  keywords?: boolean
  rankings?: boolean
  clicks?: boolean
  impressions?: boolean
  ctr?: boolean
  positions?: boolean
  localRankings?: boolean
  listings?: boolean
  reviews?: boolean
  backlinks?: boolean
  competitors?: boolean
  serpFeatures?: boolean
  historicalData?: boolean
}

export interface SeoSite {
  id: string
  workspace_id: string
  name: string
  domain: string
  is_primary: boolean
  status: 'active' | 'paused' | 'archived'
  timezone: string
  default_country: string
  default_device: SeoDevice
  default_search_engine: string
  is_demo: boolean
}

export interface SeoSourceConnection {
  id: string
  site_id: string
  provider: SeoProvider
  property_label: string | null
  property_ref: string | null
  status: SeoSourceStatus
  is_primary: boolean
  capabilities: SeoSourceCapabilities
  coverage_keywords: number
  coverage_note: string | null
  last_synced_at: string | null
  last_attempt_at: string | null
  last_error: string | null
  sync_frequency: 'hourly' | 'daily' | 'weekly' | 'manual'
  is_demo: boolean
}

export interface SeoSiteDaily {
  date: string
  clicks: number
  impressions: number
  ctr: number
  avg_position: number | null
  visibility_score: number | null
  share_of_voice: number | null
  tracked_keywords: number
  top3_keywords: number
  top10_keywords: number
  winning_keywords: number
  declining_keywords: number
  est_organic_traffic: number
  map_pack_visibility: number | null
  avg_local_rank: number | null
  profile_views: number
  avg_review_score: number | null
  ai_visibility_score: number | null
  citation_rate: number | null
  brand_mentions: number
  linked_sources: number
  tracked_prompts: number
  authority_score: number | null
  total_backlinks: number
  referring_domains: number
  new_links: number
  lost_links: number
  toxic_links: number
  source: string
}

export interface SeoCluster {
  id: string
  site_id: string
  name: string
  colour: string
  description: string | null
}

export interface SeoKeyword {
  id: string
  site_id: string
  cluster_id: string | null
  keyword: string
  intent: SeoIntent
  search_volume: number
  difficulty: number | null
  cpc: number | null
  /** NULL = not ranking or outside the tracking limit. Never coerced to 0. */
  current_rank: number | null
  previous_rank: number | null
  best_rank: number | null
  rank_change: number | null
  landing_page: string | null
  owner_id: string | null
  status: SeoKeywordStatus
  country: string
  device: SeoDevice
  search_engine: string
  is_favourite: boolean
  source: string
  is_demo: boolean
  cluster?: { id: string; name: string; colour: string } | null
  spark?: { date: string; position: number | null }[]
}

export type SeoBriefStatus =
  | 'draft' | 'in_progress' | 'awaiting_review' | 'changes_requested'
  | 'approved' | 'published' | 'archived'

export type SeoContentType =
  | 'guide' | 'how_to' | 'checklist' | 'listicle' | 'comparison'
  | 'landing_page' | 'blog' | 'case_study' | 'faq' | 'other'

export interface SeoBrief {
  id: string
  site_id: string
  title: string
  target_keyword: string
  keyword_id: string | null
  content_type: SeoContentType
  intent: SeoIntent
  priority: 'high' | 'medium' | 'low'
  status: SeoBriefStatus
  completion: number
  owner_id: string | null
  due_date: string | null
  published_at: string | null
  published_url: string | null
  est_traffic: number
  notes: string | null
  is_demo: boolean
  owner?: { id: string; full_name: string | null; avatar_url: string | null } | null
  keyword?: Pick<SeoKeyword, 'id' | 'keyword' | 'search_volume' | 'difficulty' | 'cpc' | 'current_rank'> | null
}

export interface SeoBriefSection {
  id: string
  brief_id: string
  level: 'h1' | 'h2' | 'h3'
  title: string
  guidance: string | null
  position: number
  completed: boolean
}

export interface SeoBriefComment {
  id: string
  brief_id: string
  parent_id: string | null
  author_id: string | null
  body: string
  resolved_at: string | null
  created_at: string
  author?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export type SeoOpportunityScope = 'organic' | 'ranking' | 'local' | 'ai_search' | 'backlink' | 'content'

export interface SeoOpportunity {
  id: string
  site_id: string
  scope: SeoOpportunityScope
  category: string
  title: string
  description: string | null
  keyword_id: string | null
  location_id: string | null
  prompt_id: string | null
  search_volume: number
  potential_traffic: number
  potential_rank: number | null
  potential_lift: string | null
  priority: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'done' | 'dismissed'
  score: number | null
  score_reason: string | null
  location?: { id: string; name: string } | null
}

export interface SeoCompetitor {
  id: string
  site_id: string
  domain: string
  label: string | null
  colour: string
  is_self: boolean
  visibility: number | null
  avg_rank: number | null
  share_of_voice: number | null
  spark?: { date: string; visibility: number | null }[]
}

export type SeoLocationStatus = 'open' | 'at_risk' | 'temporarily_closed' | 'closed' | 'pending'

export interface SeoLocation {
  id: string
  site_id: string
  name: string
  location_code: string | null
  address_line: string | null
  city: string | null
  region: string | null
  postcode: string | null
  country: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  website: string | null
  primary_category: string | null
  timezone: string
  image_url: string | null
  status: SeoLocationStatus
  avg_local_rank: number | null
  map_pack_visibility: number | null
  review_score: number | null
  review_count: number
  profile_completeness: number | null
  profile_views: number
  is_demo: boolean
}

export type SeoDirectory = 'google_business_profile' | 'bing_places' | 'apple_maps' | 'facebook' | 'yelp' | 'other'

export interface SeoListingHealth {
  directory: SeoDirectory
  completeness: number
  health: 'healthy' | 'needs_attention' | 'error' | 'not_connected'
  connectedLocations: number
  totalLocations: number
  issueCount: number
  lastSyncedAt: string | null
}

export interface SeoReviewSummary {
  average: number
  total: number
  newReviews: number
  responseRate: number
  unanswered: number
  distribution: { stars: number; count: number; pct: number }[]
  changeVsPrevious: number
}

export type SeoEngine = 'chatgpt' | 'perplexity' | 'google_sge' | 'gemini' | 'claude' | 'bing_copilot'

/** How a result was actually obtained. Never claim access we do not have. */
export type SeoCollectionMethod =
  | 'provider_api' | 'search_provider' | 'browser_sample'
  | 'third_party_dataset' | 'manual_check' | 'estimated'

export interface SeoAiEngine {
  id: string
  engine: SeoEngine
  available: boolean
  method: SeoCollectionMethod
  coverage_pct: number
  health: 'healthy' | 'degraded' | 'error' | 'unavailable'
  last_checked_at: string | null
}

export interface SeoAiPrompt {
  id: string
  site_id: string
  prompt: string
  engine: SeoEngine
  region: string
  language: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual'
  visibility: number | null
  visibility_band: 'high' | 'medium' | 'low' | 'none' | null
  citation_status: 'cited' | 'not_cited' | 'partial' | 'unknown'
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null
  sentiment_confidence: number | null
  sentiment_model: string | null
  linked_page: string | null
  last_checked_at: string | null
  method: SeoCollectionMethod
  status: 'active' | 'paused' | 'archived'
  is_demo: boolean
}

export type SeoBacklinkStatus =
  | 'active' | 'new' | 'lost' | 'redirected' | 'broken' | 'toxic' | 'suspected_toxic' | 'unknown'

export type SeoLinkType = 'dofollow' | 'nofollow' | 'ugc' | 'sponsored' | 'redirect'

export interface SeoBacklink {
  id: string
  site_id: string
  referring_domain: string
  source_url: string
  linked_page: string
  anchor_text: string | null
  authority: number | null
  authority_metric: string
  link_type: SeoLinkType
  status: SeoBacklinkStatus
  first_seen: string | null
  last_seen: string | null
  traffic_value: number
  country: string | null
  tld: string | null
  source: string
  is_demo: boolean
}

export interface SeoLinkOpportunity {
  id: string
  site_id: string
  domain: string
  authority: number | null
  relevance: number | null
  match_score: number | null
  match_reason: string | null
  existing_relationship: boolean
  status: 'open' | 'listed' | 'contacted' | 'won' | 'lost' | 'dismissed'
  notes: string | null
}

export interface SeoOutreachList {
  id: string
  site_id: string
  name: string
  description: string | null
  owner_id: string | null
  status: 'active' | 'paused' | 'completed' | 'archived'
  itemCount?: number
}

export interface SeoActivityItem {
  id: string
  site_id: string | null
  actor_id: string | null
  actor_label: string | null
  entity_type: string
  entity_id: string | null
  action: string
  summary: string
  detail: string | null
  link: string | null
  severity: 'info' | 'success' | 'warning' | 'critical'
  surface: SeoTabId
  created_at: string
  actor?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

/** Resolved date window plus its comparison period. */
export interface SeoDateRange {
  from: string
  to: string
  compareFrom: string
  compareTo: string
  days: number
  label: string
  compareLabel: string
}

export interface SeoKpi {
  id: string
  label: string
  value: number | null
  previous: number | null
  format: 'number' | 'compact' | 'percent' | 'decimal' | 'rank' | 'currency' | 'score'
  /** Lower is better (average rank, declining keywords, lost links, toxic links). */
  invert?: boolean
  spark: { date: string; value: number | null }[]
  source: string
  tooltip: string
}

export interface SeoDataFreshness {
  lastSuccessfulSync: string | null
  lastAttemptedSync: string | null
  status: 'up_to_date' | 'stale' | 'partial' | 'failed' | 'never'
  coverageNote: string
  timezone: string
  country: string
  device: SeoDevice
  searchEngine: string
  providers: { provider: SeoProvider; label: string; lastSyncedAt: string | null; status: SeoSourceStatus }[]
}
