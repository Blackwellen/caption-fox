import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadMetrics, series, totals, totalsByEntity, type DateRange, type MetricRow, type SeriesPoint,
} from './shared'
import { budgetUtilisation, pacing } from '../metrics'
import { getProfileNames } from './accounts'
import { AD_PROVIDERS, type AdProvider } from '../providers'

// Data for /{type}/advertising/campaigns — search, filter, sort, paginate, and
// the board/cards alternate views, all reading the same underlying rows so the
// three views never disagree with each other.
//
// Lists are filtered, sorted and paged after metrics are attached, because the
// most useful sorts (spend, ROAS) are on computed values. Paging a DB order and
// then re-sorting one page would duplicate or skip rows across pages.

export type CampaignListRow = {
  id: string
  name: string
  provider: string
  objective: string
  status: string
  owner: string | null
  ownerName: string | null
  budget: number | null
  budgetType: string | null
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  spend: number
  roas: number | null
  ctr: number | null
  conversions: number
  cpa: number | null
  budgetUtilisationPct: number | null
  pacingBand: 'under' | 'on_track' | 'over' | null
}

/** ROAS performance tiers used by the Performance filter. */
export const PERFORMANCE_TIERS = [
  { value: 'high', label: 'High (ROAS ≥ 4x)' },
  { value: 'medium', label: 'Medium (2–4x)' },
  { value: 'low', label: 'Low (< 2x)' },
  { value: 'none', label: 'No data' },
] as const

export function performanceTier(roas: number | null): 'high' | 'medium' | 'low' | 'none' {
  if (roas === null) return 'none'
  if (roas >= 4) return 'high'
  if (roas >= 2) return 'medium'
  return 'low'
}

export type CampaignFilters = {
  q?: string | null
  platform?: string | null
  objective?: string | null
  status?: string | null
  owner?: string | null
  performance?: string | null
  sort?: string | null
  page: number
  pageSize: number
}

const SORTERS: Record<string, (a: CampaignListRow, b: CampaignListRow) => number> = {
  updated: () => 0, // DB order (updated_at desc) is preserved by the stable sort
  name: (a, b) => a.name.localeCompare(b.name),
  spend: (a, b) => a.spend - b.spend,
  budget: (a, b) => (a.budget ?? -1) - (b.budget ?? -1),
  roas: (a, b) => (a.roas ?? -1) - (b.roas ?? -1),
  conversions: (a, b) => a.conversions - b.conversions,
}

async function loadCampaignRows(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
  filters: Omit<CampaignFilters, 'page' | 'pageSize' | 'sort'>,
): Promise<CampaignListRow[]> {
  let query = supabase
    .from('ad_campaigns')
    .select('id, name, provider, objective, status, owner_user_id, budget_amount, budget_type, starts_at, ends_at, updated_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(2000)

  if (filters.q) query = query.ilike('name', `%${filters.q.replace(/[%_]/g, '')}%`)
  if (filters.platform) query = query.eq('provider', filters.platform)
  if (filters.objective) query = query.eq('objective', filters.objective)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_user_id', filters.owner)

  const { data } = await query
  const rows = await hydrateWithMetrics(supabase, workspaceId, range, data ?? [])
  return filters.performance ? rows.filter(row => performanceTier(row.roas) === filters.performance) : rows
}

export async function getCampaignsPage(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: CampaignFilters,
): Promise<{ rows: CampaignListRow[]; total: number }> {
  const rows = await loadCampaignRows(supabase, workspaceId, range, filters)
  const sortKey = (filters.sort ?? 'updated_desc').replace(/_(asc|desc)$/, '')
  const ascending = filters.sort?.endsWith('_asc') ?? false
  const sorter = SORTERS[sortKey] ?? SORTERS.updated
  // Array.prototype.sort is stable, so ties keep the DB order (updated_at, id).
  const sorted = sortKey === 'updated' ? rows : [...rows].sort((a, b) => ascending ? sorter(a, b) : sorter(b, a))
  const from = (filters.page - 1) * filters.pageSize
  return { total: sorted.length, rows: sorted.slice(from, from + filters.pageSize) }
}

/** Every status bucket for the board view, unpaged. */
export async function getCampaignsByStatus(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
  filters: Omit<CampaignFilters, 'page' | 'pageSize' | 'status' | 'sort'>,
): Promise<Record<string, CampaignListRow[]>> {
  const rows = await loadCampaignRows(supabase, workspaceId, range, filters)
  const buckets: Record<string, CampaignListRow[]> = { draft: [], active: [], learning: [], paused: [], completed: [], archived: [] }
  for (const row of rows) (buckets[row.status] ?? (buckets[row.status] = [])).push(row)
  return buckets
}

async function hydrateWithMetrics(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
  campaigns: Record<string, unknown>[],
): Promise<CampaignListRow[]> {
  if (campaigns.length === 0) return []
  const [metrics, owners] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'campaign', range, entityIds: campaigns.map(campaign => campaign.id as string) }),
    getProfileNames(supabase, campaigns.map(campaign => campaign.owner_user_id as string | null)),
  ])
  const byEntity = totalsByEntity(metrics)

  return campaigns.map(campaign => {
    const metric = byEntity.get(campaign.id as string)
    const budget = campaign.budget_amount === null ? null : Number(campaign.budget_amount)
    const spend = metric?.spend ?? 0
    const pace = pacing({ spend, budget, startsAt: campaign.starts_at as string | null, endsAt: campaign.ends_at as string | null })
    return {
      id: campaign.id as string, name: campaign.name as string, provider: campaign.provider as string,
      objective: campaign.objective as string, status: campaign.status as string,
      owner: campaign.owner_user_id as string | null,
      ownerName: owners.get(campaign.owner_user_id as string) ?? null,
      budget, budgetType: campaign.budget_type as string | null,
      startsAt: campaign.starts_at as string | null, endsAt: campaign.ends_at as string | null,
      createdAt: campaign.created_at as string,
      spend, roas: metric?.roas ?? null, ctr: metric?.ctr ?? null,
      conversions: metric?.conversions ?? 0, cpa: metric?.cpa ?? null,
      budgetUtilisationPct: budgetUtilisation(spend, budget), pacingBand: pace?.band ?? null,
    }
  })
}

// ------------------------------------------------------------------ KPIs

export type CampaignKpis = {
  current: ReturnType<typeof totals>
  previous: ReturnType<typeof totals>
  activeCount: number
  previousActiveCount: number
  budgetUtilisation: number | null
  previousBudgetUtilisation: number | null
  series: { spend: SeriesPoint[]; roas: SeriesPoint[]; ctr: SeriesPoint[]; conversions: SeriesPoint[]; active: SeriesPoint[]; utilisation: SeriesPoint[] }
}

function activeByDay(rows: MetricRow[], range: DateRange): SeriesPoint[] {
  const byDay = new Map<string, Set<string>>()
  for (const row of rows) {
    if (Number(row.spend) <= 0) continue
    const set = byDay.get(row.metric_date) ?? new Set<string>()
    set.add(row.entity_id)
    byDay.set(row.metric_date, set)
  }
  return series(rows, range, 'spend').map(point => ({ date: point.date, value: byDay.get(point.date)?.size ?? 0 }))
}

export async function getCampaignKpis(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, compare: DateRange, providers: string[] = [],
): Promise<CampaignKpis> {
  let budgetQuery = supabase.from('ad_campaigns').select('id, budget_amount, status').eq('workspace_id', workspaceId)
  if (providers.length) budgetQuery = budgetQuery.in('provider', providers)
  const [currentRows, previousRows, { data: campaigns }] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'campaign', range, providers }),
    loadMetrics(supabase, { workspaceId, entityType: 'campaign', range: compare, providers }),
    budgetQuery,
  ])

  // Budget utilisation: spend on budgeted campaigns / their total budget.
  const budgeted = new Map((campaigns ?? []).filter(row => row.budget_amount !== null).map(row => [row.id as string, Number(row.budget_amount)]))
  const totalBudget = [...budgeted.values()].reduce((sum, value) => sum + value, 0)
  const budgetedSpend = (rows: MetricRow[]) => rows.filter(row => budgeted.has(row.entity_id)).reduce((sum, row) => sum + Number(row.spend), 0)

  let running = 0
  const utilisation = series(currentRows.filter(row => budgeted.has(row.entity_id)), range, 'spend').map(point => {
    running += point.value
    return { date: point.date, value: totalBudget > 0 ? (running / totalBudget) * 100 : 0 }
  })

  const currentActive = activeByDay(currentRows, range)
  const previousActive = activeByDay(previousRows, compare)
  return {
    current: totals(currentRows),
    previous: totals(previousRows),
    activeCount: (campaigns ?? []).filter(row => row.status === 'active' || row.status === 'learning').length,
    previousActiveCount: Math.max(0, ...previousActive.map(point => point.value)),
    budgetUtilisation: budgetUtilisation(budgetedSpend(currentRows), totalBudget),
    previousBudgetUtilisation: budgetUtilisation(budgetedSpend(previousRows), totalBudget),
    series: {
      spend: series(currentRows, range, 'spend'), roas: series(currentRows, range, 'roas'),
      ctr: series(currentRows, range, 'ctr'), conversions: series(currentRows, range, 'conversions'),
      active: currentActive, utilisation,
    },
  }
}

// -------------------------------------------------------------- insights

export type CampaignInsight = { key: string; label: string; value: string; metric: string; sub?: string; href?: string }

export async function getCampaignInsights(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, compare: DateRange,
): Promise<CampaignInsight[]> {
  const { data: campaigns } = await supabase
    .from('ad_campaigns').select('id, name, provider, objective').eq('workspace_id', workspaceId).in('status', ['active', 'learning']).limit(500)
  if (!campaigns?.length) return []
  const ids = campaigns.map(campaign => campaign.id as string)
  const [current, previous] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'campaign', range, entityIds: ids }),
    loadMetrics(supabase, { workspaceId, entityType: 'campaign', range: compare, entityIds: ids }),
  ])
  const byId = new Map(campaigns.map(campaign => [campaign.id as string, campaign]))

  const groupBy = (rows: MetricRow[], key: (campaign: Record<string, unknown>) => string) => {
    const grouped = new Map<string, MetricRow[]>()
    for (const row of rows) {
      const campaign = byId.get(row.entity_id)
      if (!campaign) continue
      const group = key(campaign)
      grouped.set(group, [...(grouped.get(group) ?? []), row])
    }
    return new Map([...grouped].map(([group, list]) => [group, totals(list)]))
  }

  const insights: CampaignInsight[] = []
  const byCampaign = totalsByEntity(current)
  const top = [...byCampaign].filter(([, metric]) => metric.roas !== null).sort((a, b) => b[1].roas! - a[1].roas!)[0]
  if (top) insights.push({ key: 'top', label: 'Top Performing Campaign', value: byId.get(top[0])?.name as string, metric: `${top[1].roas!.toFixed(2)}x`, href: `campaigns/${top[0]}` })

  const byPlatform = [...groupBy(current, campaign => campaign.provider as string)].filter(([, metric]) => metric.roas !== null).sort((a, b) => b[1].roas! - a[1].roas!)[0]
  if (byPlatform) insights.push({ key: 'platform', label: 'Most Efficient Platform', value: AD_PROVIDERS[byPlatform[0] as AdProvider]?.name ?? byPlatform[0], metric: `${byPlatform[1].roas!.toFixed(2)}x` })

  const byObjective = [...groupBy(current, campaign => campaign.objective as string)].filter(([, metric]) => metric.roas !== null).sort((a, b) => b[1].roas! - a[1].roas!)[0]
  if (byObjective) insights.push({ key: 'objective', label: 'Best Performing Objective', value: byObjective[0].replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()), metric: `${byObjective[1].roas!.toFixed(2)}x` })

  // Highest growth: objective with the biggest conversions increase vs the comparison window.
  const previousByObjective = groupBy(previous, campaign => campaign.objective as string)
  const growth = [...groupBy(current, campaign => campaign.objective as string)]
    .map(([objective, metric]) => {
      const before = previousByObjective.get(objective)?.conversions ?? 0
      return { objective, pct: before > 0 ? ((metric.conversions - before) / before) * 100 : null }
    })
    .filter((row): row is { objective: string; pct: number } => row.pct !== null)
    .sort((a, b) => b.pct - a.pct)[0]
  if (growth) insights.push({ key: 'growth', label: 'Highest Growth', value: growth.objective.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()), metric: `${growth.pct >= 0 ? '↑' : '↓'} ${Math.abs(growth.pct).toFixed(1)}%`, sub: 'vs comparison period' })

  return insights
}

export type OptimisationRow = { id: string; summary: string; actor: string | null; createdAt: string; entityId: string | null; eventType: string }

/** Recent changes made to campaigns and their creatives, from the activity log. */
export async function getRecentOptimisations(supabase: SupabaseClient, workspaceId: string, limit = 3): Promise<OptimisationRow[]> {
  const { data } = await supabase
    .from('ad_activity')
    .select('id, summary, actor_label, created_at, entity_id, event_type')
    .eq('workspace_id', workspaceId)
    .or('event_type.like.campaign.%,event_type.like.creative.%')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(row => ({
    id: row.id as string, summary: row.summary as string, actor: row.actor_label as string | null,
    createdAt: row.created_at as string, entityId: row.entity_id as string | null, eventType: row.event_type as string,
  }))
}

/** Owners who own at least one campaign, for the Owner filter. */
export async function getCampaignOwners(supabase: SupabaseClient, workspaceId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase.from('ad_campaigns').select('owner_user_id').eq('workspace_id', workspaceId).not('owner_user_id', 'is', null)
  const names = await getProfileNames(supabase, (data ?? []).map(row => row.owner_user_id as string))
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
