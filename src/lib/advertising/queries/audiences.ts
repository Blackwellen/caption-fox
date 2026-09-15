import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMetrics, totalsByEntity, type DateRange } from './shared'

// Data for /{type}/advertising/audiences — cards/table/overlap views, growth
// trend, composition and platform distribution.

export type AudienceRow = {
  id: string
  name: string
  provider: string
  audienceType: string
  sizeEstimate: number | null
  matchedUsers: number | null
  matchRate: number | null
  recencyDays: number | null
  refreshSchedule: string | null
  refreshStatus: string
  status: string
  lastRefreshedAt: string | null
  linkedCampaignCount: number
  spend: number
  roas: number | null
  cpa: number | null
  ctr: number | null
}

export type AudienceFilters = {
  q?: string | null
  platform?: string | null
  audienceType?: string | null
  refreshStatus?: string | null
  status?: string | null
  sort?: string | null
  page: number
  pageSize: number
}

const SORT_COLUMNS: Record<string, string> = { name: 'name', size: 'size_estimate', updated: 'updated_at' }

export async function getAudiencesPage(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: AudienceFilters,
): Promise<{ rows: AudienceRow[]; total: number }> {
  let query = supabase
    .from('ad_audiences')
    .select('id, name, provider, audience_type, size_estimate, matched_users, match_rate, recency_days, refresh_schedule, refresh_status, status, last_refreshed_at', { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.platform) query = query.eq('provider', filters.platform)
  if (filters.audienceType) query = query.eq('audience_type', filters.audienceType)
  if (filters.refreshStatus) query = query.eq('refresh_status', filters.refreshStatus)
  if (filters.status) query = query.eq('status', filters.status)

  const sortKey = (filters.sort ?? 'updated_desc').replace(/_(asc|desc)$/, '')
  const ascending = filters.sort?.endsWith('_asc') ?? false
  query = query.order(SORT_COLUMNS[sortKey] ?? 'updated_at', { ascending })

  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, count } = await query
  const audiences = data ?? []
  const rows = await hydrate(supabase, workspaceId, range, audiences)
  return { total: count ?? 0, rows }
}

async function hydrate(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, audiences: Record<string, unknown>[],
): Promise<AudienceRow[]> {
  if (audiences.length === 0) return []
  const ids = audiences.map(audience => audience.id as string)

  const [metrics, links] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'audience', range, entityIds: ids }),
    supabase.from('ad_audience_campaigns').select('audience_id').in('audience_id', ids),
  ])
  const byEntity = totalsByEntity(metrics)
  const linkCounts = new Map<string, number>()
  for (const link of links.data ?? []) {
    linkCounts.set(link.audience_id as string, (linkCounts.get(link.audience_id as string) ?? 0) + 1)
  }

  return audiences.map(audience => {
    const metric = byEntity.get(audience.id as string)
    return {
      id: audience.id as string, name: audience.name as string, provider: audience.provider as string,
      audienceType: audience.audience_type as string, sizeEstimate: audience.size_estimate as number | null,
      matchedUsers: audience.matched_users as number | null, matchRate: audience.match_rate as number | null,
      recencyDays: audience.recency_days as number | null, refreshSchedule: audience.refresh_schedule as string | null,
      refreshStatus: audience.refresh_status as string, status: audience.status as string,
      lastRefreshedAt: audience.last_refreshed_at as string | null,
      linkedCampaignCount: linkCounts.get(audience.id as string) ?? 0,
      spend: metric?.spend ?? 0, roas: metric?.roas ?? null, cpa: metric?.cpa ?? null, ctr: metric?.ctr ?? null,
    }
  })
}

export type OverlapPair = { audienceAId: string; audienceAName: string; audienceBId: string; audienceBName: string; overlapPct: number | null; overlapUsers: number }

export async function getOverlapPairs(supabase: SupabaseClient, workspaceId: string, limit = 20): Promise<OverlapPair[]> {
  const { data } = await supabase
    .from('ad_audience_overlaps')
    .select('audience_a_id, audience_b_id, overlap_pct, overlap_users, ad_audiences_a:ad_audiences!ad_audience_overlaps_audience_a_id_fkey(name), ad_audiences_b:ad_audiences!ad_audience_overlaps_audience_b_id_fkey(name)')
    .eq('workspace_id', workspaceId)
    .order('overlap_pct', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => {
    const a = row.ad_audiences_a as unknown as { name?: string } | { name?: string }[] | null
    const b = row.ad_audiences_b as unknown as { name?: string } | { name?: string }[] | null
    return {
      audienceAId: row.audience_a_id as string, audienceAName: (Array.isArray(a) ? a[0]?.name : a?.name) ?? 'Audience',
      audienceBId: row.audience_b_id as string, audienceBName: (Array.isArray(b) ? b[0]?.name : b?.name) ?? 'Audience',
      overlapPct: row.overlap_pct as number | null, overlapUsers: row.overlap_users as number,
    }
  })
}

export type AudienceGrowthPoint = { date: string; value: number }

/** Sums size_estimate across audiences on each metric day found, as a growth proxy. */
export async function getAudienceGrowth(supabase: SupabaseClient, workspaceId: string, range: DateRange): Promise<AudienceGrowthPoint[]> {
  const rows = await loadMetrics(supabase, { workspaceId, entityType: 'audience', range })
  const byDay = new Map<string, number>()
  for (const row of rows) byDay.set(row.metric_date, (byDay.get(row.metric_date) ?? 0) + Number(row.reach || row.impressions))
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
}

export type CompositionSlice = { type: string; label: string; value: number }

export async function getAudienceComposition(supabase: SupabaseClient, workspaceId: string): Promise<CompositionSlice[]> {
  const { data } = await supabase.from('ad_audiences').select('audience_type, size_estimate').eq('workspace_id', workspaceId)
  const byType = new Map<string, number>()
  for (const row of data ?? []) {
    const type = row.audience_type as string
    byType.set(type, (byType.get(type) ?? 0) + Number(row.size_estimate ?? 0))
  }
  return [...byType.entries()].map(([type, value]) => ({ type, label: type, value })).sort((a, b) => b.value - a.value)
}

export type PlatformDistributionRow = { provider: string; reach: number }

export async function getPlatformDistribution(supabase: SupabaseClient, workspaceId: string, range: DateRange): Promise<PlatformDistributionRow[]> {
  const rows = await loadMetrics(supabase, { workspaceId, entityType: 'audience', range })
  const byProvider = new Map<string, number>()
  for (const row of rows) byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + Number(row.reach))
  return [...byProvider.entries()].map(([provider, reach]) => ({ provider, reach })).sort((a, b) => b.reach - a.reach)
}
