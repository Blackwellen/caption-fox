import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMetrics, totalsByEntity, type DateRange } from './shared'
import { budgetUtilisation, pacing } from '../metrics'

// Data for /{type}/advertising/campaigns — search, filter, sort, paginate, and
// the board/cards alternate views, all reading the same underlying rows so the
// three views never disagree with each other.

export type CampaignListRow = {
  id: string
  name: string
  provider: string
  objective: string
  status: string
  owner: string | null
  budget: number | null
  budgetType: string | null
  startsAt: string | null
  endsAt: string | null
  spend: number
  roas: number | null
  ctr: number | null
  conversions: number
  cpa: number | null
  budgetUtilisationPct: number | null
  pacingBand: 'under' | 'on_track' | 'over' | null
}

export type CampaignFilters = {
  q?: string | null
  platform?: string | null
  objective?: string | null
  status?: string | null
  owner?: string | null
  sort?: string | null
  page: number
  pageSize: number
}

const SORT_COLUMNS: Record<string, string> = {
  name: 'name', spend: 'name', budget: 'budget_amount', updated: 'updated_at',
}

export async function getCampaignsPage(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: CampaignFilters,
): Promise<{ rows: CampaignListRow[]; total: number }> {
  let query = supabase
    .from('ad_campaigns')
    .select('id, name, provider, objective, status, owner_user_id, budget_amount, budget_type, starts_at, ends_at, updated_at', { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.platform) query = query.eq('provider', filters.platform)
  if (filters.objective) query = query.eq('objective', filters.objective)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.owner) query = query.eq('owner_user_id', filters.owner)

  const sortKey = (filters.sort ?? 'updated_desc').replace(/_(asc|desc)$/, '')
  const ascending = filters.sort?.endsWith('_asc') ?? false
  query = query.order(SORT_COLUMNS[sortKey] ?? 'updated_at', { ascending })

  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, count } = await query
  const campaigns = data ?? []
  const rows = await hydrateWithMetrics(supabase, workspaceId, range, campaigns)

  if (sortKey === 'spend') rows.sort((a, b) => ascending ? a.spend - b.spend : b.spend - a.spend)

  return { total: count ?? 0, rows }
}

/** Every status bucket for the board view, unpaged. */
export async function getCampaignsByStatus(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: Omit<CampaignFilters, 'page' | 'pageSize' | 'status'>,
): Promise<Record<string, CampaignListRow[]>> {
  let query = supabase
    .from('ad_campaigns')
    .select('id, name, provider, objective, status, owner_user_id, budget_amount, budget_type, starts_at, ends_at, updated_at')
    .eq('workspace_id', workspaceId)
    .limit(300)

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.platform) query = query.eq('provider', filters.platform)
  if (filters.objective) query = query.eq('objective', filters.objective)
  if (filters.owner) query = query.eq('owner_user_id', filters.owner)

  const { data } = await query
  const rows = await hydrateWithMetrics(supabase, workspaceId, range, data ?? [])

  const buckets: Record<string, CampaignListRow[]> = { draft: [], active: [], learning: [], paused: [], completed: [], archived: [] }
  for (const row of rows) (buckets[row.status] ?? (buckets[row.status] = [])).push(row)
  return buckets
}

async function hydrateWithMetrics(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
  campaigns: Record<string, unknown>[],
): Promise<CampaignListRow[]> {
  if (campaigns.length === 0) return []
  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'campaign', range,
    entityIds: campaigns.map(campaign => campaign.id as string),
  })
  const byEntity = totalsByEntity(metrics)

  return campaigns.map(campaign => {
    const metric = byEntity.get(campaign.id as string)
    const budget = campaign.budget_amount as number | null
    const spend = metric?.spend ?? 0
    const util = budgetUtilisation(spend, budget)
    const pace = pacing({
      spend, budget, startsAt: campaign.starts_at as string | null, endsAt: campaign.ends_at as string | null,
    })
    return {
      id: campaign.id as string, name: campaign.name as string, provider: campaign.provider as string,
      objective: campaign.objective as string, status: campaign.status as string,
      owner: campaign.owner_user_id as string | null, budget, budgetType: campaign.budget_type as string | null,
      startsAt: campaign.starts_at as string | null, endsAt: campaign.ends_at as string | null,
      spend, roas: metric?.roas ?? null, ctr: metric?.ctr ?? null,
      conversions: metric?.conversions ?? 0, cpa: metric?.cpa ?? null,
      budgetUtilisationPct: util, pacingBand: pace?.band ?? null,
    }
  })
}

export type CampaignInsight = { label: string; value: string; sub?: string }

export async function getCampaignInsights(supabase: SupabaseClient, workspaceId: string, range: DateRange): Promise<CampaignInsight[]> {
  const { data: campaigns } = await supabase
    .from('ad_campaigns').select('id, name, provider').eq('workspace_id', workspaceId).eq('status', 'active').limit(500)
  if (!campaigns?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'campaign', range, entityIds: campaigns.map(campaign => campaign.id as string),
  })
  const byEntity = totalsByEntity(metrics)
  const named = campaigns.map(campaign => ({ name: campaign.name as string, metric: byEntity.get(campaign.id as string) }))

  const topRoas = [...named].filter(row => row.metric?.roas != null).sort((a, b) => (b.metric!.roas! - a.metric!.roas!))[0]
  const topCtr = [...named].filter(row => row.metric?.ctr != null).sort((a, b) => (b.metric!.ctr! - a.metric!.ctr!))[0]

  const insights: CampaignInsight[] = []
  if (topRoas) insights.push({ label: 'Top Performing Campaign', value: topRoas.name, sub: `${topRoas.metric!.roas!.toFixed(2)}x` })
  if (topCtr) insights.push({ label: 'Best Efficient Platform', value: topCtr.name, sub: `${topCtr.metric!.ctr!.toFixed(2)}%` })
  return insights
}
