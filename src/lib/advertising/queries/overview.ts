import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadMetrics, previousRange, series, sourceIntegrity, totals, totalsByProvider,
  type DateRange,
} from './shared'
import { budgetUtilisation, pacing } from '../metrics'
import { AD_PROVIDERS, type AdProvider } from '../providers'

// Data for /{type}/advertising — the paid-media landing page: spend KPIs,
// connected-account health, top campaigns, alerts, creative performance,
// spend trend and budget pacing. Every number here traces back to
// ad_metrics_daily, ad_accounts, ad_campaigns or ad_issues; nothing is invented.

export type ConnectedAccountSummary = {
  provider: AdProvider
  accountCount: number
  spend: number
  spendChangePct: number | null
  health: string
  lastSyncedAt: string | null
}

export async function getConnectedAccountSummaries(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
): Promise<ConnectedAccountSummary[]> {
  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('id, provider, sync_status, last_synced_at')
    .eq('workspace_id', workspaceId)

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

  const current = await loadMetrics(supabase, { workspaceId, entityType: 'account', range })
  const previous = await loadMetrics(supabase, { workspaceId, entityType: 'account', range: previousRange(range) })
  const currentByProvider = totalsByProvider(current)
  const previousByProvider = totalsByProvider(previous)

  return [...byProvider.entries()].map(([provider, entry]) => {
    const spend = currentByProvider.get(provider)?.spend ?? 0
    const prevSpend = previousByProvider.get(provider)?.spend ?? 0
    const health = entry.statuses.includes('failed') || entry.statuses.includes('expired') ? 'attention'
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
}

export async function getTopCampaigns(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5,
): Promise<CampaignRow[]> {
  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('id, name, provider, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'learning', 'paused'])
    .limit(500)
  if (!campaigns?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'campaign', range,
    entityIds: campaigns.map(campaign => campaign.id as string),
  })

  const byEntity = new Map<string, ReturnType<typeof totals>>()
  const grouped = new Map<string, typeof metrics>()
  for (const row of metrics) {
    const list = grouped.get(row.entity_id) ?? []
    list.push(row)
    grouped.set(row.entity_id, list)
  }
  for (const [id, rows] of grouped) byEntity.set(id, totals(rows))

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
}

export async function getTopCreatives(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 4,
): Promise<CreativeSummary[]> {
  const { data: creatives } = await supabase
    .from('ad_creatives')
    .select('id, name, format, provider, status')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (!creatives?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'creative', range,
    entityIds: creatives.map(creative => creative.id as string),
  })
  const grouped = new Map<string, typeof metrics>()
  for (const row of metrics) {
    const list = grouped.get(row.entity_id) ?? []
    list.push(row)
    grouped.set(row.entity_id, list)
  }

  return creatives
    .map(creative => {
      const metric = totals(grouped.get(creative.id as string) ?? [])
      return {
        id: creative.id as string, name: creative.name as string,
        format: creative.format as string, provider: creative.provider as string,
        status: creative.status as string, spend: metric.spend,
        ctr: metric.ctr, clicks: metric.clicks, hookRate: metric.hookRate,
      }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
}

export type BudgetPacingRow = {
  id: string
  name: string
  spend: number
  budget: number
  pct: number
  band: 'under' | 'on_track' | 'over'
}

export async function getBudgetPacing(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5,
): Promise<BudgetPacingRow[]> {
  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('id, name, budget_amount, starts_at, ends_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .not('budget_amount', 'is', null)
    .limit(200)
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
      const util = budgetUtilisation(spend, budget)
      const pace = pacing({ spend, budget, startsAt: campaign.starts_at as string | null, endsAt: campaign.ends_at as string | null })
      return {
        id: campaign.id as string, name: campaign.name as string,
        spend, budget, pct: util ?? 0, band: pace?.band ?? 'on_track',
      }
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
}

export type AlertRow = {
  id: string
  severity: string
  title: string
  detail: string | null
  createdAt: string
  entityType: string | null
  entityId: string | null
}

export async function getRecentAlerts(supabase: SupabaseClient, workspaceId: string, limit = 6): Promise<AlertRow[]> {
  const { data } = await supabase
    .from('ad_issues')
    .select('id, severity, title, detail, created_at, campaign_id, creative_id, account_id')
    .eq('workspace_id', workspaceId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => ({
    id: row.id as string, severity: row.severity as string, title: row.title as string,
    detail: row.detail as string | null, createdAt: row.created_at as string,
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
}

export async function getRecentActivity(supabase: SupabaseClient, workspaceId: string, limit = 6): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from('ad_activity')
    .select('id, summary, created_at, event_type, actor_label')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => ({
    id: row.id as string, summary: row.summary as string, createdAt: row.created_at as string,
    eventType: row.event_type as string, actorLabel: row.actor_label as string | null,
  }))
}

export type OverviewData = {
  currentTotals: ReturnType<typeof totals>
  previousTotals: ReturnType<typeof totals>
  activeCampaignCount: number
  previousActiveCampaignCount: number
  spendSeries: ReturnType<typeof series>
  accounts: ConnectedAccountSummary[]
  topCampaigns: CampaignRow[]
  topCreatives: CreativeSummary[]
  budgetPacing: BudgetPacingRow[]
  alerts: AlertRow[]
  activity: ActivityRow[]
  integrity: ReturnType<typeof sourceIntegrity>
  hasAnyAccount: boolean
}

export async function getOverviewData(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
): Promise<OverviewData> {
  const previous = previousRange(range)

  const [currentRows, previousRows, accounts, topCampaigns, topCreatives, budgetPacing, alerts, activity, accountCountResult] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'account', range }),
    loadMetrics(supabase, { workspaceId, entityType: 'account', range: previous }),
    getConnectedAccountSummaries(supabase, workspaceId, range),
    getTopCampaigns(supabase, workspaceId, range),
    getTopCreatives(supabase, workspaceId, range),
    getBudgetPacing(supabase, workspaceId, range),
    getRecentAlerts(supabase, workspaceId),
    getRecentActivity(supabase, workspaceId),
    supabase.from('ad_accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
  ])

  const [activeCount, previousActiveCount] = await Promise.all([
    countActiveCampaigns(supabase, workspaceId, range),
    countActiveCampaigns(supabase, workspaceId, previous),
  ])

  return {
    currentTotals: totals(currentRows),
    previousTotals: totals(previousRows),
    activeCampaignCount: activeCount,
    previousActiveCampaignCount: previousActiveCount,
    spendSeries: series(currentRows, range, 'spend'),
    accounts, topCampaigns, topCreatives, budgetPacing, alerts, activity,
    integrity: sourceIntegrity(currentRows),
    hasAnyAccount: (accountCountResult.count ?? 0) > 0,
  }
}

async function countActiveCampaigns(supabase: SupabaseClient, workspaceId: string, range: DateRange): Promise<number> {
  const { count } = await supabase
    .from('ad_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .lte('starts_at', `${range.until}T23:59:59Z`)
  return count ?? 0
}

export function providerLabel(provider: string): string {
  return AD_PROVIDERS[provider as AdProvider]?.name ?? provider
}
