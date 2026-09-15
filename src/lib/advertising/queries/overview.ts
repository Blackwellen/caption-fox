import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadMetrics, previousRange, series, sourceIntegrity, totals, totalsByProvider,
  type DateRange, type MetricRow, type SeriesPoint,
} from './shared'
import { EMPTY_RAW, addRaw, budgetUtilisation, normalise, type RawMetrics } from '../metrics'
import { AD_PROVIDERS, type AdProvider } from '../providers'
import { signThumbnails } from './creatives'

// Data for /{type}/advertising — the paid-media landing page: spend KPIs,
// connected-account health, top campaigns / ad sets, alerts, creative
// performance, spend trend and budget pacing. Every number traces back to
// ad_metrics_daily, ad_accounts, ad_campaigns, ad_sets or ad_issues.

export type OverviewOptions = {
  /** Page-wide platform filter (Filters popover). */
  providers?: string[]
  /** Comparison window; defaults to the immediately preceding period. */
  compare?: DateRange
  /** Campaign Performance panel filters. */
  campaign?: { platform?: string | null; objective?: string | null; status?: string | null; accountId?: string | null }
  /** Campaign Performance panel level. */
  level?: 'campaigns' | 'ad_sets'
  trendMetric?: 'spend' | 'conversions' | 'roas' | 'clicks'
  trendGrain?: 'daily' | 'weekly'
}

export type ConnectedAccountSummary = {
  provider: AdProvider
  accountCount: number
  spend: number
  spendChangePct: number | null
  health: string
  lastSyncedAt: string | null
}

export async function getConnectedAccountSummaries(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, compare: DateRange = previousRange(range), providers: string[] = [],
): Promise<ConnectedAccountSummary[]> {
  let accountQuery = supabase
    .from('ad_accounts')
    .select('id, provider, sync_status, last_synced_at')
    .eq('workspace_id', workspaceId)
  if (providers.length) accountQuery = accountQuery.in('provider', providers)
  const { data: accounts } = await accountQuery

  if (!accounts?.length) return []

  const byProvider = new Map<AdProvider, { count: number; lastSync: string | null; statuses: string[] }>()
  for (const account of accounts) {
    const provider = account.provider as AdProvider
    const entry = byProvider.get(provider) ?? { count: 0, lastSync: null, statuses: [] }
    entry.count += 1
    entry.statuses.push(account.sync_status as string)
    if (account.last_synced_at && (!entry.lastSync || account.last_synced_at > entry.lastSync)) {
      entry.lastSync = account.last_synced_at as string
    }
    byProvider.set(provider, entry)
  }

  const [current, previous] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'account', range, providers }),
    loadMetrics(supabase, { workspaceId, entityType: 'account', range: compare, providers }),
  ])
  const currentByProvider = totalsByProvider(current)
  const previousByProvider = totalsByProvider(previous)

  return [...byProvider.entries()].map(([provider, entry]) => {
    const spend = currentByProvider.get(provider)?.spend ?? 0
    const prevSpend = previousByProvider.get(provider)?.spend ?? 0
    const health = entry.statuses.includes('failed') || entry.statuses.includes('expired') ? 'error'
      : entry.statuses.includes('warning') || entry.statuses.includes('partial') ? 'attention'
        : entry.statuses.every(status => status === 'synced') ? 'connected' : 'syncing'
    return {
      provider, accountCount: entry.count, spend,
      spendChangePct: prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : null,
      health, lastSyncedAt: entry.lastSync,
    }
  }).sort((a, b) => b.spend - a.spend)
}

export type CampaignRow = {
  id: string
  name: string
  provider: string
  status: string
  spend: number
  roas: number | null
  ctr: number | null
  conversions: number
  cpa: number | null
  /** Parent campaign, set when this row is an ad set. */
  parentId?: string | null
}

function groupTotals(rows: MetricRow[]) {
  const grouped = new Map<string, MetricRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.entity_id) ?? []
    list.push(row)
    grouped.set(row.entity_id, list)
  }
  return new Map([...grouped].map(([id, list]) => [id, totals(list)]))
}

export async function getTopCampaigns(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5,
  filters: OverviewOptions['campaign'] = {}, providers: string[] = [],
): Promise<CampaignRow[]> {
  let query = supabase
    .from('ad_campaigns')
    .select('id, name, provider, status')
    .eq('workspace_id', workspaceId)
    .limit(500)
  if (filters?.status) query = query.eq('status', filters.status)
  else query = query.in('status', ['active', 'learning', 'paused'])
  if (filters?.platform) query = query.eq('provider', filters.platform)
  else if (providers.length) query = query.in('provider', providers)
  if (filters?.objective) query = query.eq('objective', filters.objective)
  if (filters?.accountId) query = query.eq('account_id', filters.accountId)

  const { data: campaigns } = await query
  if (!campaigns?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'campaign', range,
    entityIds: campaigns.map(campaign => campaign.id as string),
  })
  const byEntity = groupTotals(metrics)

  return campaigns
    .map(campaign => {
      const metric = byEntity.get(campaign.id as string)
      return {
        id: campaign.id as string, name: campaign.name as string,
        provider: campaign.provider as string, status: campaign.status as string,
        spend: metric?.spend ?? 0, roas: metric?.roas ?? null,
        ctr: metric?.ctr ?? null, conversions: metric?.conversions ?? 0,
        cpa: metric?.cpa ?? null,
      }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
}

export async function getTopAdSets(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5,
  filters: OverviewOptions['campaign'] = {}, providers: string[] = [],
): Promise<CampaignRow[]> {
  let query = supabase
    .from('ad_sets')
    .select('id, name, provider, status, campaign_id')
    .eq('workspace_id', workspaceId)
    .limit(500)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.platform) query = query.eq('provider', filters.platform)
  else if (providers.length) query = query.in('provider', providers)
  if (filters?.accountId) query = query.eq('account_id', filters.accountId)

  const { data: adSets } = await query
  if (!adSets?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'ad_set', range,
    entityIds: adSets.map(adSet => adSet.id as string),
  })
  const byEntity = groupTotals(metrics)

  return adSets
    .map(adSet => {
      const metric = byEntity.get(adSet.id as string)
      return {
        id: adSet.id as string, name: adSet.name as string,
        provider: adSet.provider as string, status: adSet.status as string,
        spend: metric?.spend ?? 0, roas: metric?.roas ?? null,
        ctr: metric?.ctr ?? null, conversions: metric?.conversions ?? 0,
        cpa: metric?.cpa ?? null, parentId: adSet.campaign_id as string,
      }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
}

export type CreativeSummary = {
  id: string
  name: string
  format: string
  provider: string
  status: string
  spend: number
  ctr: number | null
  clicks: number
  hookRate: number | null
  thumbnailPath: string | null
  /** Short-lived signed URL for the private thumbnail, when one exists. */
  thumbnailUrl: string | null
}

export async function getTopCreatives(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 4, providers: string[] = [],
): Promise<CreativeSummary[]> {
  let query = supabase
    .from('ad_creatives')
    .select('id, name, format, provider, status, thumbnail_path')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (providers.length) query = query.in('provider', providers)
  const { data: creatives } = await query
  if (!creatives?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'creative', range,
    entityIds: creatives.map(creative => creative.id as string),
  })
  const byEntity = groupTotals(metrics)

  const top = creatives
    .map(creative => {
      const metric = byEntity.get(creative.id as string)
      return {
        id: creative.id as string, name: creative.name as string,
        format: creative.format as string, provider: creative.provider as string,
        status: creative.status as string, spend: metric?.spend ?? 0,
        ctr: metric?.ctr ?? null, clicks: metric?.clicks ?? 0, hookRate: metric?.hookRate ?? null,
        thumbnailPath: creative.thumbnail_path as string | null, thumbnailUrl: null as string | null,
      }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
  return signThumbnails(supabase, top)
}

export type BudgetPacingRow = {
  id: string
  name: string
  spend: number
  budget: number
  /** Budget utilisation, 0–100+. */
  pct: number
}

export async function getBudgetPacing(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5, providers: string[] = [],
): Promise<BudgetPacingRow[]> {
  let query = supabase
    .from('ad_campaigns')
    .select('id, name, budget_amount')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .not('budget_amount', 'is', null)
    .limit(200)
  if (providers.length) query = query.in('provider', providers)
  const { data: campaigns } = await query
  if (!campaigns?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'campaign', range,
    entityIds: campaigns.map(campaign => campaign.id as string),
  })
  const spendByEntity = new Map<string, number>()
  for (const row of metrics) spendByEntity.set(row.entity_id, (spendByEntity.get(row.entity_id) ?? 0) + Number(row.spend))

  return campaigns
    .map(campaign => {
      const spend = spendByEntity.get(campaign.id as string) ?? 0
      const budget = Number(campaign.budget_amount)
      return { id: campaign.id as string, name: campaign.name as string, spend, budget, pct: budgetUtilisation(spend, budget) ?? 0 }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
}

export type AlertRow = {
  id: string
  severity: string
  issueType: string
  title: string
  detail: string | null
  createdAt: string
  entityType: string | null
  entityId: string | null
}

export async function getRecentAlerts(supabase: SupabaseClient, workspaceId: string, limit = 6): Promise<AlertRow[]> {
  const { data } = await supabase
    .from('ad_issues')
    .select('id, severity, issue_type, title, detail, created_at, campaign_id, creative_id, account_id')
    .eq('workspace_id', workspaceId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => ({
    id: row.id as string, severity: row.severity as string, issueType: row.issue_type as string,
    title: row.title as string, detail: row.detail as string | null, createdAt: row.created_at as string,
    entityType: row.campaign_id ? 'campaign' : row.creative_id ? 'creative' : row.account_id ? 'account' : null,
    entityId: (row.campaign_id ?? row.creative_id ?? row.account_id) as string | null,
  }))
}

export type ActivityRow = {
  id: string
  summary: string
  createdAt: string
  eventType: string
  actorLabel: string | null
  entityType: string | null
  entityId: string | null
}

export async function getRecentActivity(supabase: SupabaseClient, workspaceId: string, limit = 6): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from('ad_activity')
    .select('id, summary, created_at, event_type, actor_label, entity_type, entity_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => ({
    id: row.id as string, summary: row.summary as string, createdAt: row.created_at as string,
    eventType: row.event_type as string, actorLabel: row.actor_label as string | null,
    entityType: row.entity_type as string | null, entityId: row.entity_id as string | null,
  }))
}

function toRaw(row: MetricRow): RawMetrics {
  return {
    spend: Number(row.spend) || 0, impressions: Number(row.impressions) || 0, reach: Number(row.reach) || 0,
    clicks: Number(row.clicks) || 0, conversions: Number(row.conversions) || 0, revenue: Number(row.revenue) || 0,
    videoViews: Number(row.video_views) || 0, video3sViews: Number(row.video_3s_views) || 0, engagements: Number(row.engagements) || 0,
  }
}

/**
 * Daily or weekly buckets for one metric. Weekly buckets are consecutive
 * 7-day windows from the range start; ratio metrics (ROAS) are recomputed from
 * the bucket's summed raw values, never averaged from daily ratios.
 */
export function bucketSeries(
  rows: MetricRow[], range: DateRange, metric: NonNullable<OverviewOptions['trendMetric']>, grain: NonNullable<OverviewOptions['trendGrain']>,
): SeriesPoint[] {
  const byDay = new Map<string, RawMetrics>()
  for (const row of rows) byDay.set(row.metric_date, addRaw(byDay.get(row.metric_date) ?? { ...EMPTY_RAW }, toRaw(row)))

  const days: string[] = []
  const cursor = new Date(`${range.since}T00:00:00Z`)
  const end = new Date(`${range.until}T00:00:00Z`)
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const size = grain === 'weekly' ? 7 : 1
  const points: SeriesPoint[] = []
  for (let index = 0; index < days.length; index += size) {
    const bucket = days.slice(index, index + size).reduce<RawMetrics>((acc, day) => addRaw(acc, byDay.get(day) ?? { ...EMPTY_RAW }), { ...EMPTY_RAW })
    const value = metric === 'roas' ? normalise(bucket).roas ?? 0 : bucket[metric]
    points.push({ date: days[index], value })
  }
  return points
}

export type OverviewData = {
  currentTotals: ReturnType<typeof totals>
  previousTotals: ReturnType<typeof totals>
  activeCampaignCount: number
  previousActiveCampaignCount: number
  spendSeries: SeriesPoint[]
  roasSeries: SeriesPoint[]
  ctrSeries: SeriesPoint[]
  conversionsSeries: SeriesPoint[]
  cpaSeries: SeriesPoint[]
  activeSeries: SeriesPoint[]
  trend: SeriesPoint[]
  trendComparison: SeriesPoint[]
  accounts: ConnectedAccountSummary[]
  accountOptions: { id: string; name: string }[]
  performanceRows: CampaignRow[]
  topCreatives: CreativeSummary[]
  budgetPacing: BudgetPacingRow[]
  alerts: AlertRow[]
  activity: ActivityRow[]
  integrity: ReturnType<typeof sourceIntegrity>
  hasAnyAccount: boolean
}

export async function getOverviewData(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, options: OverviewOptions = {},
): Promise<OverviewData> {
  const compare = options.compare ?? previousRange(range)
  const providers = options.providers ?? []
  const level = options.level ?? 'campaigns'

  const [currentRows, previousRows, accounts, performanceRows, topCreatives, budgetPacing, alerts, activity, accountList, campaignMetricRows] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'account', range, providers }),
    loadMetrics(supabase, { workspaceId, entityType: 'account', range: compare, providers }),
    getConnectedAccountSummaries(supabase, workspaceId, range, compare, providers),
    level === 'ad_sets'
      ? getTopAdSets(supabase, workspaceId, range, 5, options.campaign, providers)
      : getTopCampaigns(supabase, workspaceId, range, 5, options.campaign, providers),
    getTopCreatives(supabase, workspaceId, range, 6, providers),
    getBudgetPacing(supabase, workspaceId, range, 5, providers),
    getRecentAlerts(supabase, workspaceId, 5),
    getRecentActivity(supabase, workspaceId, 5),
    supabase.from('ad_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
    loadMetrics(supabase, { workspaceId, entityType: 'campaign', range, providers }),
  ])

  const [activeCount, previousActiveCount] = await Promise.all([
    countActiveCampaigns(supabase, workspaceId, range, providers),
    countActiveCampaigns(supabase, workspaceId, compare, providers),
  ])

  const metric = options.trendMetric ?? 'spend'
  const grain = options.trendGrain ?? 'daily'

  // Campaigns with spend on each day — the Active Campaigns sparkline.
  const activeByDay = new Map<string, Set<string>>()
  for (const row of campaignMetricRows) {
    if (Number(row.spend) <= 0) continue
    const set = activeByDay.get(row.metric_date) ?? new Set<string>()
    set.add(row.entity_id)
    activeByDay.set(row.metric_date, set)
  }
  const activeSeries = series(currentRows, range, 'spend').map(point => ({ date: point.date, value: activeByDay.get(point.date)?.size ?? 0 }))

  return {
    currentTotals: totals(currentRows),
    previousTotals: totals(previousRows),
    activeCampaignCount: activeCount,
    previousActiveCampaignCount: previousActiveCount,
    spendSeries: series(currentRows, range, 'spend'),
    roasSeries: series(currentRows, range, 'roas'),
    ctrSeries: series(currentRows, range, 'ctr'),
    conversionsSeries: series(currentRows, range, 'conversions'),
    cpaSeries: series(currentRows, range, 'cpa'),
    activeSeries,
    trend: bucketSeries(currentRows, range, metric, grain),
    trendComparison: bucketSeries(previousRows, compare, metric, grain),
    accounts,
    accountOptions: (accountList.data ?? []).map(row => ({ id: row.id as string, name: row.name as string })),
    performanceRows, topCreatives, budgetPacing, alerts, activity,
    integrity: sourceIntegrity(currentRows),
    hasAnyAccount: (accountList.data?.length ?? 0) > 0,
  }
}

/**
 * Campaigns in an active state whose run overlaps the window. Uses the
 * campaign's live status today; historical status is not stored.
 */
async function countActiveCampaigns(supabase: SupabaseClient, workspaceId: string, range: DateRange, providers: string[]): Promise<number> {
  let query = supabase
    .from('ad_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'learning'])
    .lte('starts_at', `${range.until}T23:59:59Z`)
  if (providers.length) query = query.in('provider', providers)
  const { count } = await query
  return count ?? 0
}

export function providerLabel(provider: string): string {
  return AD_PROVIDERS[provider as AdProvider]?.name ?? provider
}
