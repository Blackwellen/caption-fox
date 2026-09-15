import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SeoActivityItem, SeoAiEngine, SeoAiPrompt, SeoBacklink, SeoBrief, SeoBriefComment,
  SeoBriefSection, SeoCluster, SeoCompetitor, SeoDateRange, SeoKeyword, SeoLinkOpportunity,
  SeoListingHealth, SeoLocation, SeoOpportunity, SeoOutreachList, SeoReviewSummary,
  SeoSiteDaily, SeoTabId,
} from './types'

/**
 * Every query in this module takes an explicit workspaceId AND siteId.
 * Both are resolved server-side by `getSeoSession` from the authenticated
 * session, never from a client payload, so cross-workspace and cross-site
 * reads are impossible even before RLS.
 */
export interface Scope {
  supabase: SupabaseClient
  workspaceId: string
  siteId: string
}

// ── Daily aggregate ─────────────────────────────────────────────────────────

export async function getSiteDaily(scope: Scope, from: string, to: string): Promise<SeoSiteDaily[]> {
  const { data } = await scope.supabase
    .from('seo_site_daily')
    .select('*')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
  return (data ?? []) as SeoSiteDaily[]
}

/** Current + comparison windows in one round trip, split by date. */
export async function getSiteDailyWithCompare(scope: Scope, range: SeoDateRange) {
  const rows = await getSiteDaily(scope, range.compareFrom, range.to)
  return {
    current: rows.filter(r => r.date >= range.from && r.date <= range.to),
    previous: rows.filter(r => r.date >= range.compareFrom && r.date <= range.compareTo),
  }
}

// ── Keywords ────────────────────────────────────────────────────────────────

export interface KeywordFilters {
  q?: string
  intent?: string
  cluster?: string
  status?: string
  owner?: string
  device?: string
  country?: string
  engine?: string
  landingPage?: string
  position?: string
  volumeMin?: number
  volumeMax?: number
  difficultyMin?: number
  difficultyMax?: number
  favourite?: boolean
  sort?: string
  page?: number
  pageSize?: number
}

const KEYWORD_SORTS: Record<string, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  'keyword.asc': { column: 'keyword', ascending: true },
  'keyword.desc': { column: 'keyword', ascending: false },
  'volume.desc': { column: 'search_volume', ascending: false },
  'volume.asc': { column: 'search_volume', ascending: true },
  'difficulty.desc': { column: 'difficulty', ascending: false },
  'difficulty.asc': { column: 'difficulty', ascending: true },
  'rank.asc': { column: 'current_rank', ascending: true, nullsFirst: false },
  'rank.desc': { column: 'current_rank', ascending: false, nullsFirst: false },
  'rank_change.desc': { column: 'rank_change', ascending: false, nullsFirst: false },
  'rank_change.asc': { column: 'rank_change', ascending: true, nullsFirst: false },
}

const POSITION_BANDS: Record<string, [number, number]> = {
  '1-3': [1, 3], '4-10': [4, 10], '11-20': [11, 20], '21-50': [21, 50], '51-100': [51, 100],
}

export async function getKeywords(scope: Scope, filters: KeywordFilters = {}) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 10))

  let query = scope.supabase
    .from('seo_keywords')
    .select('*, cluster:seo_keyword_clusters(id, name, colour)', { count: 'exact' })
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)

  if (filters.q) query = query.ilike('keyword', `%${escapeLike(filters.q)}%`)
  if (filters.intent) query = query.eq('intent', filters.intent)
  if (filters.cluster) query = query.eq('cluster_id', filters.cluster)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.device) query = query.eq('device', filters.device)
  if (filters.country) query = query.eq('country', filters.country)
  if (filters.engine) query = query.eq('search_engine', filters.engine)
  if (filters.landingPage) query = query.ilike('landing_page', `%${escapeLike(filters.landingPage)}%`)
  if (filters.favourite) query = query.eq('is_favourite', true)
  if (filters.volumeMin != null) query = query.gte('search_volume', filters.volumeMin)
  if (filters.volumeMax != null) query = query.lte('search_volume', filters.volumeMax)
  if (filters.difficultyMin != null) query = query.gte('difficulty', filters.difficultyMin)
  if (filters.difficultyMax != null) query = query.lte('difficulty', filters.difficultyMax)
  if (filters.position === 'not-ranking') query = query.is('current_rank', null)
  else if (filters.position && POSITION_BANDS[filters.position]) {
    const [min, max] = POSITION_BANDS[filters.position]
    query = query.gte('current_rank', min).lte('current_rank', max)
  }

  const sort = KEYWORD_SORTS[filters.sort ?? 'volume.desc'] ?? KEYWORD_SORTS['volume.desc']
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? false })
    .order('keyword', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count } = await query
  return {
    rows: (data ?? []) as SeoKeyword[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

export type SeoKeywordFact = Pick<SeoKeyword,
  'id' | 'keyword' | 'search_volume' | 'difficulty' | 'current_rank' | 'previous_rank' |
  'rank_change' | 'intent' | 'status' | 'cluster_id' | 'landing_page' | 'device' | 'country' | 'search_engine'
> & { cluster_name: string | null }

/** Unpaginated projection used for distribution charts, KPI maths and the Rankings breakdown. */
export async function getKeywordFacts(scope: Scope): Promise<SeoKeywordFact[]> {
  const { data } = await scope.supabase
    .from('seo_keywords')
    .select('id, keyword, search_volume, difficulty, current_rank, previous_rank, rank_change, intent, status, cluster_id, landing_page, device, country, search_engine, cluster:seo_keyword_clusters(name)')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)
    .limit(5000)
  return (data ?? []).map(row => {
    const cluster = row.cluster as unknown as { name: string } | { name: string }[] | null
    const clusterName = Array.isArray(cluster) ? cluster[0]?.name ?? null : cluster?.name ?? null
    const { cluster: _cluster, ...rest } = row as typeof row & { cluster: unknown }
    return { ...rest, cluster_name: clusterName }
  }) as SeoKeywordFact[]
}

/** Sparkline positions for a set of keywords, one query for all of them. */
export async function getKeywordSparks(scope: Scope, keywordIds: string[], from: string) {
  if (keywordIds.length === 0) return new Map<string, { date: string; position: number | null }[]>()
  const { data } = await scope.supabase
    .from('seo_keyword_rankings')
    .select('keyword_id, date, position')
    .eq('workspace_id', scope.workspaceId)
    .in('keyword_id', keywordIds)
    .gte('date', from)
    .order('date')
  const map = new Map<string, { date: string; position: number | null }[]>()
  for (const row of data ?? []) {
    const list = map.get(row.keyword_id) ?? []
    list.push({ date: row.date, position: row.position })
    map.set(row.keyword_id, list)
  }
  return map
}

export async function getClusters(scope: Scope): Promise<SeoCluster[]> {
  const { data } = await scope.supabase
    .from('seo_keyword_clusters')
    .select('id, site_id, name, colour, description')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)
    .order('name')
  return (data ?? []) as SeoCluster[]
}

// ── Briefs ──────────────────────────────────────────────────────────────────

export interface BriefFilters {
  q?: string
  status?: string
  owner?: string
  contentType?: string
  intent?: string
  priority?: string
  due?: 'overdue' | 'this_week' | 'no_date'
  sort?: string
  page?: number
  pageSize?: number
}

const BRIEF_SORTS: Record<string, { column: string; ascending: boolean }> = {
  'due.asc': { column: 'due_date', ascending: true },
  'due.desc': { column: 'due_date', ascending: false },
  'title.asc': { column: 'title', ascending: true },
  'completion.desc': { column: 'completion', ascending: false },
  'traffic.desc': { column: 'est_traffic', ascending: false },
  'updated.desc': { column: 'updated_at', ascending: false },
}

export async function getBriefs(scope: Scope, filters: BriefFilters = {}) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 10))

  let query = scope.supabase
    .from('seo_content_briefs')
    .select('*, owner:profiles!seo_content_briefs_owner_id_fkey(id, full_name, avatar_url), keyword:seo_keywords(id, keyword, search_volume, difficulty, cpc, current_rank)', { count: 'exact' })
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)

  if (filters.q) query = query.or(`title.ilike.%${escapeLike(filters.q)}%,target_keyword.ilike.%${escapeLike(filters.q)}%`)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_id', filters.owner)
  if (filters.contentType) query = query.eq('content_type', filters.contentType)
  if (filters.intent) query = query.eq('intent', filters.intent)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.due === 'overdue') query = query.lt('due_date', today()).not('status', 'in', '("published","archived")')
  if (filters.due === 'no_date') query = query.is('due_date', null)
  if (filters.due === 'this_week') query = query.gte('due_date', today()).lte('due_date', addDays(today(), 7))

  const sort = BRIEF_SORTS[filters.sort ?? 'due.asc'] ?? BRIEF_SORTS['due.asc']
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count } = await query
  return {
    rows: (data ?? []) as SeoBrief[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

export async function getBriefCounts(scope: Scope) {
  const { data } = await scope.supabase
    .from('seo_content_briefs')
    .select('status, est_traffic')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)
  const rows = data ?? []
  const by = (status: string) => rows.filter(r => r.status === status).length
  return {
    total: rows.length,
    inProgress: by('in_progress'),
    awaitingReview: by('awaiting_review') + by('changes_requested'),
    published: by('published'),
    approved: by('approved'),
    draft: by('draft'),
    estTraffic: rows.reduce((sum, r) => sum + (r.est_traffic ?? 0), 0),
  }
}

export async function getBriefSections(scope: Scope, briefId: string): Promise<SeoBriefSection[]> {
  const { data } = await scope.supabase
    .from('seo_brief_sections')
    .select('id, brief_id, level, title, guidance, position, completed')
    .eq('workspace_id', scope.workspaceId)
    .eq('brief_id', briefId)
    .order('position')
  return (data ?? []) as SeoBriefSection[]
}

export async function getBriefComments(scope: Scope, briefId: string): Promise<SeoBriefComment[]> {
  const { data } = await scope.supabase
    .from('seo_brief_comments')
    .select('id, brief_id, parent_id, author_id, body, resolved_at, created_at, author:profiles(id, full_name, avatar_url)')
    .eq('workspace_id', scope.workspaceId)
    .eq('brief_id', briefId)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data ?? []) as unknown as SeoBriefComment[]
}

// ── Opportunities ───────────────────────────────────────────────────────────

export async function getOpportunities(
  scope: Scope,
  opts: { scope?: string; status?: string; limit?: number } = {},
): Promise<SeoOpportunity[]> {
  let query = scope.supabase
    .from('seo_opportunities')
    .select('*, location:seo_locations(id, name)')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 20)
  if (opts.scope) query = query.eq('scope', opts.scope)
  query = query.eq('status', opts.status ?? 'open')
  const { data } = await query
  return (data ?? []) as SeoOpportunity[]
}

export async function countOpenOpportunities(scope: Scope, scopeName?: string): Promise<number> {
  let query = scope.supabase
    .from('seo_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .eq('status', 'open')
  if (scopeName) query = query.eq('scope', scopeName)
  const { count } = await query
  return count ?? 0
}

// ── Competitors ─────────────────────────────────────────────────────────────

export async function getCompetitors(scope: Scope, from: string): Promise<SeoCompetitor[]> {
  const { data } = await scope.supabase
    .from('seo_competitors')
    .select('id, site_id, domain, label, colour, is_self, visibility, avg_rank, share_of_voice')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .order('visibility', { ascending: false, nullsFirst: false })

  const competitors = (data ?? []) as SeoCompetitor[]
  if (competitors.length === 0) return competitors

  const { data: daily } = await scope.supabase
    .from('seo_competitor_daily')
    .select('competitor_id, date, visibility')
    .eq('workspace_id', scope.workspaceId)
    .in('competitor_id', competitors.map(c => c.id))
    .gte('date', from)
    .order('date')

  for (const competitor of competitors) {
    competitor.spark = (daily ?? [])
      .filter(row => row.competitor_id === competitor.id)
      .map(row => ({ date: row.date, visibility: row.visibility }))
  }
  return competitors
}

// ── Rankings ────────────────────────────────────────────────────────────────

export interface RankingChangeRow {
  id: string
  keyword: string
  device: string
  country: string
  current_rank: number | null
  previous_rank: number | null
  rank_change: number | null
  landing_page: string | null
  search_volume: number
  serp_features: string[]
  source: string
}

export async function getRankingChanges(
  scope: Scope,
  opts: { direction?: 'all' | 'improved' | 'declined'; page?: number; pageSize?: number; sort?: string } = {},
) {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, opts.pageSize ?? 5))

  let query = scope.supabase
    .from('seo_keywords')
    .select('id, keyword, device, country, current_rank, previous_rank, rank_change, landing_page, search_volume, source', { count: 'exact' })
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)
    .not('rank_change', 'is', null)

  if (opts.direction === 'improved') query = query.gt('rank_change', 0)
  if (opts.direction === 'declined') query = query.lt('rank_change', 0)

  const ascending = opts.sort === 'change.asc'
  query = query
    .order('rank_change', { ascending, nullsFirst: false })
    .order('search_volume', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count } = await query

  // SERP features come from the latest ranking row per keyword.
  const ids = (data ?? []).map(row => row.id)
  const features = new Map<string, string[]>()
  if (ids.length) {
    const { data: rows } = await scope.supabase
      .from('seo_keyword_rankings')
      .select('keyword_id, serp_features, date')
      .eq('workspace_id', scope.workspaceId)
      .in('keyword_id', ids)
      .order('date', { ascending: false })
      .limit(ids.length * 3)
    for (const row of rows ?? []) {
      if (!features.has(row.keyword_id)) features.set(row.keyword_id, row.serp_features ?? [])
    }
  }

  return {
    rows: (data ?? []).map(row => ({ ...row, serp_features: features.get(row.id) ?? [] })) as RankingChangeRow[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

// ── Local ───────────────────────────────────────────────────────────────────

export async function getLocations(scope: Scope, opts: { q?: string; status?: string } = {}): Promise<SeoLocation[]> {
  let query = scope.supabase
    .from('seo_locations')
    .select('*')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)
    .order('avg_local_rank', { ascending: true, nullsFirst: false })
  if (opts.q) query = query.ilike('name', `%${escapeLike(opts.q)}%`)
  if (opts.status) query = query.eq('status', opts.status)
  const { data } = await query
  return (data ?? []) as SeoLocation[]
}

export async function getLocalTrend(scope: Scope, from: string, to: string, locationId?: string) {
  let query = scope.supabase
    .from('seo_local_rankings')
    .select('date, avg_local_rank, map_pack_visibility, profile_views')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
  if (locationId) query = query.eq('location_id', locationId)
  const { data } = await query

  // Average across locations for each date so the chart is location-agnostic.
  const byDate = new Map<string, { rank: number[]; visibility: number[] }>()
  for (const row of data ?? []) {
    const bucket = byDate.get(row.date) ?? { rank: [], visibility: [] }
    if (row.avg_local_rank != null) bucket.rank.push(Number(row.avg_local_rank))
    if (row.map_pack_visibility != null) bucket.visibility.push(Number(row.map_pack_visibility))
    byDate.set(row.date, bucket)
  }
  return [...byDate.entries()].map(([date, bucket]) => ({
    date,
    avgLocalRank: bucket.rank.length ? mean(bucket.rank) : null,
    mapPackVisibility: bucket.visibility.length ? mean(bucket.visibility) : null,
  }))
}

export async function getListingsHealth(scope: Scope): Promise<SeoListingHealth[]> {
  const [{ data: listings }, { count: locationCount }] = await Promise.all([
    scope.supabase
      .from('seo_business_listings')
      .select('directory, completeness, health, issue_count, connected, last_synced_at')
      .eq('workspace_id', scope.workspaceId)
      .eq('site_id', scope.siteId),
    scope.supabase
      .from('seo_locations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', scope.workspaceId)
      .eq('site_id', scope.siteId)
      .is('archived_at', null),
  ])

  const total = locationCount ?? 0
  const directories: SeoListingHealth['directory'][] = ['google_business_profile', 'bing_places', 'apple_maps', 'facebook']
  return directories.map(directory => {
    const rows = (listings ?? []).filter(row => row.directory === directory)
    if (rows.length === 0) {
      return { directory, completeness: 0, health: 'not_connected', connectedLocations: 0, totalLocations: total, issueCount: 0, lastSyncedAt: null }
    }
    const connected = rows.filter(row => row.connected).length
    const completeness = Math.round(mean(rows.map(row => row.completeness ?? 0)))
    const worst = rows.some(row => row.health === 'error')
      ? 'error'
      : rows.some(row => row.health === 'needs_attention') ? 'needs_attention' : 'healthy'
    return {
      directory,
      completeness,
      health: worst as SeoListingHealth['health'],
      connectedLocations: connected,
      totalLocations: total,
      issueCount: rows.reduce((sum, row) => sum + (row.issue_count ?? 0), 0),
      lastSyncedAt: rows.map(row => row.last_synced_at).filter(Boolean).sort().at(-1) ?? null,
    }
  })
}

export async function getReviewSummary(scope: Scope, range: SeoDateRange): Promise<SeoReviewSummary> {
  const { data } = await scope.supabase
    .from('seo_reviews')
    .select('rating, responded, published_at')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .gte('published_at', `${range.compareFrom}T00:00:00Z`)

  const rows = data ?? []
  const current = rows.filter(row => row.published_at >= `${range.from}T00:00:00Z`)
  const previous = rows.filter(row => row.published_at < `${range.from}T00:00:00Z`)
  const total = rows.length
  const average = total ? Math.round(mean(rows.map(row => row.rating)) * 100) / 100 : 0
  const previousAverage = previous.length ? mean(previous.map(row => row.rating)) : average

  return {
    average,
    total,
    newReviews: current.length,
    responseRate: total ? Math.round((rows.filter(row => row.responded).length / total) * 1000) / 10 : 0,
    unanswered: rows.filter(row => !row.responded).length,
    distribution: [5, 4, 3, 2, 1].map(stars => {
      const count = rows.filter(row => row.rating === stars).length
      return { stars, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 }
    }),
    changeVsPrevious: Math.round((average - previousAverage) * 100) / 100,
  }
}

// ── AI Search ───────────────────────────────────────────────────────────────

export async function getAiEngines(scope: Scope): Promise<SeoAiEngine[]> {
  const { data } = await scope.supabase
    .from('seo_ai_engines')
    .select('id, engine, available, method, coverage_pct, health, last_checked_at')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .eq('available', true)
    .order('coverage_pct', { ascending: false })
  return (data ?? []) as SeoAiEngine[]
}

export interface PromptFilters {
  q?: string
  engine?: string
  citation?: string
  sentiment?: string
  status?: string
  page?: number
  pageSize?: number
  sort?: string
}

export async function getAiPrompts(scope: Scope, filters: PromptFilters = {}) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 5))

  let query = scope.supabase
    .from('seo_ai_prompts')
    .select('*', { count: 'exact' })
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)

  if (filters.q) query = query.ilike('prompt', `%${escapeLike(filters.q)}%`)
  if (filters.engine) query = query.eq('engine', filters.engine)
  if (filters.citation) query = query.eq('citation_status', filters.citation)
  if (filters.sentiment) query = query.eq('sentiment', filters.sentiment)
  if (filters.status) query = query.eq('status', filters.status)

  const ascending = filters.sort === 'visibility.asc'
  query = query.order('visibility', { ascending, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count } = await query
  return {
    rows: (data ?? []) as SeoAiPrompt[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

export async function getCitedPages(scope: Scope) {
  const { data } = await scope.supabase
    .from('seo_ai_cited_pages')
    .select('page, citations, change_28d')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .order('citations', { ascending: false })
    .limit(5)
  return data ?? []
}

export async function getAiSourceMix(scope: Scope) {
  const { data } = await scope.supabase
    .from('seo_ai_source_mix')
    .select('bucket, share_pct')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
  return data ?? []
}

// ── Backlinks ───────────────────────────────────────────────────────────────

export interface BacklinkFilters {
  q?: string
  status?: string
  linkType?: string
  linkedPage?: string
  anchor?: string
  authorityMin?: number
  authorityMax?: number
  tld?: string
  country?: string
  sort?: string
  page?: number
  pageSize?: number
}

const BACKLINK_SORTS: Record<string, { column: string; ascending: boolean }> = {
  'authority.desc': { column: 'authority', ascending: false },
  'authority.asc': { column: 'authority', ascending: true },
  'first_seen.desc': { column: 'first_seen', ascending: false },
  'first_seen.asc': { column: 'first_seen', ascending: true },
  'traffic.desc': { column: 'traffic_value', ascending: false },
  'domain.asc': { column: 'referring_domain', ascending: true },
}

export async function getBacklinks(scope: Scope, filters: BacklinkFilters = {}) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 10))

  let query = scope.supabase
    .from('seo_backlinks')
    .select('*', { count: 'exact' })
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)

  if (filters.q) query = query.or(`referring_domain.ilike.%${escapeLike(filters.q)}%,anchor_text.ilike.%${escapeLike(filters.q)}%,linked_page.ilike.%${escapeLike(filters.q)}%`)
  if (filters.status === 'toxic') query = query.in('status', ['toxic', 'suspected_toxic'])
  else if (filters.status) query = query.eq('status', filters.status)
  if (filters.linkType) query = query.eq('link_type', filters.linkType)
  if (filters.linkedPage) query = query.ilike('linked_page', `%${escapeLike(filters.linkedPage)}%`)
  if (filters.anchor) query = query.ilike('anchor_text', `%${escapeLike(filters.anchor)}%`)
  if (filters.authorityMin != null) query = query.gte('authority', filters.authorityMin)
  if (filters.authorityMax != null) query = query.lte('authority', filters.authorityMax)
  if (filters.tld) query = query.eq('tld', filters.tld)
  if (filters.country) query = query.eq('country', filters.country)

  const sort = BACKLINK_SORTS[filters.sort ?? 'authority.desc'] ?? BACKLINK_SORTS['authority.desc']
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count } = await query
  return {
    rows: (data ?? []) as SeoBacklink[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

export async function getLinkOpportunities(scope: Scope, limit = 5): Promise<SeoLinkOpportunity[]> {
  const { data } = await scope.supabase
    .from('seo_link_opportunities')
    .select('id, site_id, domain, authority, relevance, match_score, match_reason, existing_relationship, status, notes')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .not('status', 'in', '("won","lost","dismissed")')
    .order('match_score', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as SeoLinkOpportunity[]
}

export async function getTopLinkedPages(scope: Scope) {
  const { data } = await scope.supabase
    .from('seo_top_linked_pages')
    .select('page, backlinks, traffic_value')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .order('backlinks', { ascending: false })
    .limit(5)
  return data ?? []
}

export async function getOutreachLists(scope: Scope): Promise<SeoOutreachList[]> {
  const { data } = await scope.supabase
    .from('seo_outreach_lists')
    .select('id, site_id, name, description, owner_id, status, seo_outreach_list_items(count)')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map(row => {
    const { seo_outreach_list_items, ...rest } = row as SeoOutreachList & {
      seo_outreach_list_items?: { count: number }[]
    }
    return { ...rest, itemCount: seo_outreach_list_items?.[0]?.count ?? 0 }
  })
}

// ── Activity ────────────────────────────────────────────────────────────────

export async function getActivity(scope: Scope, surface: SeoTabId, limit = 6): Promise<SeoActivityItem[]> {
  const { data } = await scope.supabase
    .from('seo_activity')
    .select('*, actor:profiles(id, full_name, avatar_url)')
    .eq('workspace_id', scope.workspaceId)
    .eq('site_id', scope.siteId)
    .eq('surface', surface)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as SeoActivityItem[]
}

// ── helpers ─────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** Neutralise PostgREST pattern metacharacters in user-supplied search text. */
function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, ' ').trim().slice(0, 120)
}
