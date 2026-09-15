import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadMetrics, previousRange, series, sourceIntegrity, totals, totalsByEntity,
  totalsByProvider, type DateRange,
} from './shared'
import { AD_PROVIDERS, type AdProvider } from '../providers'

// Data for /{type}/advertising/reports — dashboard/table/breakdown views,
// source transparency, saved presets, scheduled reports and recent exports.

export type ReportsSummary = {
  current: ReturnType<typeof totals>
  previous: ReturnType<typeof totals>
  spendSeries: ReturnType<typeof series>
  roasSeries: ReturnType<typeof series>
  conversionsByProvider: { provider: string; conversions: number }[]
  spendByProvider: { provider: string; spend: number }[]
  integrity: ReturnType<typeof sourceIntegrity>
}

export async function getReportsSummary(supabase: SupabaseClient, workspaceId: string, range: DateRange, providers: string[] = []): Promise<ReportsSummary> {
  const [currentRows, previousRows] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'account', range, providers: providers.length ? providers : undefined }),
    loadMetrics(supabase, { workspaceId, entityType: 'account', range: previousRange(range), providers: providers.length ? providers : undefined }),
  ])
  const byProvider = totalsByProvider(currentRows)

  return {
    current: totals(currentRows), previous: totals(previousRows),
    spendSeries: series(currentRows, range, 'spend'), roasSeries: series(currentRows, range, 'roas'),
    conversionsByProvider: [...byProvider.entries()].map(([provider, metric]) => ({ provider, conversions: metric.conversions })),
    spendByProvider: [...byProvider.entries()].map(([provider, metric]) => ({ provider, spend: metric.spend })),
    integrity: sourceIntegrity(currentRows),
  }
}

export type CampaignReportRow = {
  id: string
  name: string
  provider: string
  spend: number
  impressions: number
  clicks: number
  ctr: number | null
  conversions: number
  cpa: number | null
  revenue: number
  roas: number | null
}

export async function getCampaignReportTable(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, providers: string[] = [],
): Promise<CampaignReportRow[]> {
  let query = supabase.from('ad_campaigns').select('id, name, provider').eq('workspace_id', workspaceId).limit(500)
  if (providers.length) query = query.in('provider', providers)
  const { data: campaigns } = await query
  if (!campaigns?.length) return []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'campaign', range, entityIds: campaigns.map(campaign => campaign.id as string),
  })
  const byEntity = totalsByEntity(metrics)

  return campaigns
    .map(campaign => {
      const metric = byEntity.get(campaign.id as string)
      return {
        id: campaign.id as string, name: campaign.name as string, provider: campaign.provider as string,
        spend: metric?.spend ?? 0, impressions: metric?.impressions ?? 0, clicks: metric?.clicks ?? 0,
        ctr: metric?.ctr ?? null, conversions: metric?.conversions ?? 0, cpa: metric?.cpa ?? null,
        revenue: metric?.revenue ?? 0, roas: metric?.roas ?? null,
      }
    })
    .sort((a, b) => b.spend - a.spend)
}

export type PlatformPerformanceRow = { provider: string; spend: number; conversions: number; cpa: number | null; roas: number | null }

export function toPlatformPerformance(byProvider: Map<string, ReturnType<typeof totals>>): PlatformPerformanceRow[] {
  return [...byProvider.entries()]
    .map(([provider, metric]) => ({ provider, spend: metric.spend, conversions: metric.conversions, cpa: metric.cpa, roas: metric.roas }))
    .sort((a, b) => b.spend - a.spend)
}

export async function getPlatformPerformance(supabase: SupabaseClient, workspaceId: string, range: DateRange): Promise<PlatformPerformanceRow[]> {
  const rows = await loadMetrics(supabase, { workspaceId, entityType: 'account', range })
  return toPlatformPerformance(totalsByProvider(rows))
}

export type SourceTransparencyRow = { provider: AdProvider; connected: boolean; lastSyncedAt: string | null; currency: string | null }

export async function getSourceTransparency(supabase: SupabaseClient, workspaceId: string): Promise<SourceTransparencyRow[]> {
  const { data: connections } = await supabase.from('ad_connections').select('provider, status, last_synced_at').eq('workspace_id', workspaceId)
  const { data: accounts } = await supabase.from('ad_accounts').select('provider, currency').eq('workspace_id', workspaceId)

  const currencyByProvider = new Map<string, string>()
  for (const account of accounts ?? []) if (!currencyByProvider.has(account.provider as string)) currencyByProvider.set(account.provider as string, account.currency as string)

  return (connections ?? []).map(row => ({
    provider: row.provider as AdProvider,
    connected: row.status === 'connected',
    lastSyncedAt: row.last_synced_at as string | null,
    currency: currencyByProvider.get(row.provider as string) ?? null,
  }))
}

export type ReportPreset = { id: string; name: string; description: string | null; isShared: boolean; isDefault: boolean; config: Record<string, unknown> }

export async function getReportPresets(supabase: SupabaseClient, workspaceId: string): Promise<ReportPreset[]> {
  const { data } = await supabase.from('ad_report_presets').select('id, name, description, is_shared, is_default, config').eq('workspace_id', workspaceId).order('name')
  return (data ?? []).map(row => ({
    id: row.id as string, name: row.name as string, description: row.description as string | null,
    isShared: !!row.is_shared, isDefault: !!row.is_default, config: (row.config as Record<string, unknown>) ?? {},
  }))
}

export type ScheduledReportRow = {
  id: string; name: string; cadence: string; recipients: string[]; format: string
  enabled: boolean; lastRunAt: string | null; lastRunStatus: string | null; nextRunAt: string | null
}

export async function getScheduledReports(supabase: SupabaseClient, workspaceId: string): Promise<ScheduledReportRow[]> {
  const { data } = await supabase
    .from('ad_scheduled_reports')
    .select('id, name, cadence, recipients, format, enabled, last_run_at, last_run_status, next_run_at')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  return (data ?? []).map(row => ({
    id: row.id as string, name: row.name as string, cadence: row.cadence as string,
    recipients: (row.recipients as string[]) ?? [], format: row.format as string, enabled: !!row.enabled,
    lastRunAt: row.last_run_at as string | null, lastRunStatus: row.last_run_status as string | null,
    nextRunAt: row.next_run_at as string | null,
  }))
}

export type ReportExportRow = { id: string; name: string; format: string; status: string; createdAt: string; storagePath: string | null }

export async function getRecentExports(supabase: SupabaseClient, workspaceId: string, limit = 8): Promise<ReportExportRow[]> {
  const { data } = await supabase
    .from('ad_report_exports')
    .select('id, name, format, status, created_at, storage_path')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []).map(row => ({
    id: row.id as string, name: row.name as string, format: row.format as string, status: row.status as string,
    createdAt: row.created_at as string, storagePath: row.storage_path as string | null,
  }))
}

export function providerLabel(provider: string): string {
  return AD_PROVIDERS[provider as AdProvider]?.name ?? provider
}
