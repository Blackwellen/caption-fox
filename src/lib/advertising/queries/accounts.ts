import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMetrics, previousRange, totalsByProvider, type DateRange } from './shared'
import { totals } from './shared'
import { listProviderApps, type ProviderAppSummary } from '../connections'
import { AD_PROVIDERS, type AdProvider } from '../providers'

// Data for /{type}/advertising/accounts — connection health, provider setup
// state, and the account table with search/filter/sort applied server-side.

export type ConnectionRow = {
  id: string
  provider: AdProvider
  status: string
  scopes: string[]
  connectedAt: string | null
  lastSyncedAt: string | null
  lastSyncAttemptAt: string | null
  lastError: string | null
  accountCount: number
}

export async function getConnections(supabase: SupabaseClient, workspaceId: string): Promise<ConnectionRow[]> {
  const { data: connections } = await supabase
    .from('ad_connections')
    .select('id, provider, status, scopes, connected_at, last_synced_at, last_sync_attempt_at, last_error')
    .eq('workspace_id', workspaceId)
    .neq('status', 'disconnected')
    .order('provider', { ascending: true })

  const { data: accounts } = await supabase
    .from('ad_accounts').select('connection_id').eq('workspace_id', workspaceId)
  const counts = new Map<string, number>()
  for (const account of accounts ?? []) {
    if (!account.connection_id) continue
    counts.set(account.connection_id as string, (counts.get(account.connection_id as string) ?? 0) + 1)
  }

  return (connections ?? []).map(row => ({
    id: row.id as string, provider: row.provider as AdProvider, status: row.status as string,
    scopes: (row.scopes as string[] | null) ?? [],
    connectedAt: row.connected_at as string | null, lastSyncedAt: row.last_synced_at as string | null,
    lastSyncAttemptAt: row.last_sync_attempt_at as string | null, lastError: row.last_error as string | null,
    accountCount: counts.get(row.id as string) ?? 0,
  }))
}

export type AccountRow = {
  id: string
  connectionId: string | null
  provider: AdProvider
  name: string
  externalId: string
  currency: string
  timezone: string
  status: string
  syncStatus: string
  mappingLabel: string | null
  ownerUserId: string | null
  lastSyncedAt: string | null
  spend: number
}

export type AccountFilters = {
  q?: string | null
  provider?: string | null
  syncStatus?: string | null
  tab?: 'all' | 'attention' | 'healthy' | 'disconnected'
  sort?: string | null
  page: number
  pageSize: number
}

export async function getAccountsPage(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: AccountFilters,
): Promise<{ rows: AccountRow[]; total: number }> {
  let query = supabase
    .from('ad_accounts')
    .select('id, connection_id, provider, name, external_id, currency, timezone, status, sync_status, mapping_label, owner_user_id, last_synced_at', { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.provider) query = query.eq('provider', filters.provider)
  if (filters.tab === 'attention') query = query.in('sync_status', ['failed', 'warning', 'partial', 'expired'])
  else if (filters.tab === 'healthy') query = query.eq('sync_status', 'synced')
  else if (filters.tab === 'disconnected') query = query.eq('sync_status', 'disconnected')
  if (filters.syncStatus) query = query.eq('sync_status', filters.syncStatus)

  const [sortColumn, sortDirection] = parseSort(filters.sort)
  query = query.order(sortColumn, { ascending: sortDirection === 'asc' })

  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, count } = await query
  const rows = data ?? []

  const metrics = await loadMetrics(supabase, {
    workspaceId, entityType: 'account', range,
    entityIds: rows.map(row => row.id as string),
  })
  const spendById = new Map<string, number>()
  for (const row of metrics) spendById.set(row.entity_id, (spendById.get(row.entity_id) ?? 0) + Number(row.spend))

  return {
    total: count ?? 0,
    rows: rows.map(row => ({
      id: row.id as string, connectionId: row.connection_id as string | null,
      provider: row.provider as AdProvider, name: row.name as string, externalId: row.external_id as string,
      currency: row.currency as string, timezone: row.timezone as string, status: row.status as string,
      syncStatus: row.sync_status as string, mappingLabel: row.mapping_label as string | null,
      ownerUserId: row.owner_user_id as string | null, lastSyncedAt: row.last_synced_at as string | null,
      spend: spendById.get(row.id as string) ?? 0,
    })),
  }
}

function parseSort(sort: string | null | undefined): [string, 'asc' | 'desc'] {
  if (!sort) return ['name', 'asc']
  const desc = sort.endsWith('_desc')
  const column = sort.replace(/_(asc|desc)$/, '')
  const allowed: Record<string, string> = {
    name: 'name', provider: 'provider', status: 'sync_status', last_synced: 'last_synced_at',
  }
  return [allowed[column] ?? 'name', desc ? 'desc' : 'asc']
}

export type ProviderSummaryCard = {
  provider: AdProvider
  configured: boolean
  connectionStatus: string | null
  spend: number
  spendChangePct: number | null
  accountCount: number
  scopes: string[]
  lastSyncedAt: string | null
}

export async function getProviderSummaryCards(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
): Promise<ProviderSummaryCard[]> {
  const [apps, connections, currentRows, previousRows] = await Promise.all([
    listProviderApps(workspaceId),
    getConnections(supabase, workspaceId),
    loadMetrics(supabase, { workspaceId, entityType: 'account', range }),
    loadMetrics(supabase, { workspaceId, entityType: 'account', range: previousRange(range) }),
  ])

  const currentByProvider = totalsByProvider(currentRows)
  const previousByProvider = totalsByProvider(previousRows)
  const connectionByProvider = new Map(connections.map(connection => [connection.provider, connection]))

  return apps
    .map((app: ProviderAppSummary) => {
      const connection = connectionByProvider.get(app.provider)
      const spend = currentByProvider.get(app.provider)?.spend ?? 0
      const prevSpend = previousByProvider.get(app.provider)?.spend ?? 0
      return {
        provider: app.provider, configured: app.configured,
        connectionStatus: connection?.status ?? null, spend,
        spendChangePct: prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : null,
        accountCount: connection?.accountCount ?? 0, scopes: connection?.scopes ?? [],
        lastSyncedAt: connection?.lastSyncedAt ?? null,
      }
    })
    .sort((a, b) => {
      if (!!a.connectionStatus !== !!b.connectionStatus) return a.connectionStatus ? -1 : 1
      return b.spend - a.spend
    })
}

export type SourceIssueRow = {
  id: string
  severity: string
  provider: string | null
  title: string
  detail: string | null
  requiredAction: string | null
  createdAt: string
}

export async function getOpenIssues(supabase: SupabaseClient, workspaceId: string, limit = 10): Promise<SourceIssueRow[]> {
  const { data } = await supabase
    .from('ad_issues')
    .select('id, severity, provider, title, detail, required_action, created_at')
    .eq('workspace_id', workspaceId)
    .is('resolved_at', null)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => ({
    id: row.id as string, severity: row.severity as string, provider: row.provider as string | null,
    title: row.title as string, detail: row.detail as string | null,
    requiredAction: row.required_action as string | null, createdAt: row.created_at as string,
  }))
}

export function accountKpis(rows: AccountRow[], apps: ProviderSummaryCard[], totalsRow: ReturnType<typeof totals>, issues: SourceIssueRow[]) {
  return {
    connectedAccounts: rows.length,
    syncedSources: rows.filter(row => row.syncStatus === 'synced').length,
    spendThisMonth: totalsRow.spend,
    roas: totalsRow.roas,
    syncAlerts: issues.length,
  }
}

export const PROVIDER_LABEL = (provider: string) => AD_PROVIDERS[provider as AdProvider]?.name ?? provider
