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
  ownerUserId: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
  lastSyncAttemptAt: string | null
  lastError: string | null
  accountCount: number
  attentionCount: number
}

/** Sync statuses that mean an account needs a human. */
export const ATTENTION_STATUSES = ['failed', 'warning', 'partial', 'expired']

export async function getConnections(supabase: SupabaseClient, workspaceId: string): Promise<ConnectionRow[]> {
  const [{ data: connections }, { data: accounts }] = await Promise.all([
    supabase
      .from('ad_connections')
      .select('id, provider, status, scopes, owner_user_id, connected_at, last_synced_at, last_sync_attempt_at, last_error')
      .eq('workspace_id', workspaceId)
      .neq('status', 'disconnected')
      .order('provider', { ascending: true }),
    supabase.from('ad_accounts').select('connection_id, sync_status').eq('workspace_id', workspaceId),
  ])

  const counts = new Map<string, { total: number; attention: number }>()
  for (const account of accounts ?? []) {
    if (!account.connection_id) continue
    const entry = counts.get(account.connection_id as string) ?? { total: 0, attention: 0 }
    entry.total += 1
    if (ATTENTION_STATUSES.includes(account.sync_status as string)) entry.attention += 1
    counts.set(account.connection_id as string, entry)
  }

  return (connections ?? []).map(row => ({
    id: row.id as string, provider: row.provider as AdProvider, status: row.status as string,
    scopes: (row.scopes as string[] | null) ?? [], ownerUserId: row.owner_user_id as string | null,
    connectedAt: row.connected_at as string | null, lastSyncedAt: row.last_synced_at as string | null,
    lastSyncAttemptAt: row.last_sync_attempt_at as string | null, lastError: row.last_error as string | null,
    accountCount: counts.get(row.id as string)?.total ?? 0,
    attentionCount: counts.get(row.id as string)?.attention ?? 0,
  }))
}

/** Display names for a set of profile ids (owners), via the member's RLS client. */
export async function getProfileNames(supabase: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', unique)
  return new Map((data ?? []).map(row => [row.id as string, (row.full_name as string | null) ?? (row.email as string | null)?.split('@')[0] ?? 'Member']))
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
  ownerName: string | null
  lastSyncedAt: string | null
  spend: number
}

export type AccountFilters = {
  q?: string | null
  provider?: string | null
  syncStatus?: string | null
  mapping?: string | null
  owner?: string | null
  currency?: string | null
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

  if (filters.q) query = query.or(`name.ilike.%${filters.q.replace(/[%,()]/g, '')}%,external_id.ilike.%${filters.q.replace(/[%,()]/g, '')}%`)
  if (filters.provider) query = query.eq('provider', filters.provider)
  if (filters.tab === 'attention') query = query.in('sync_status', ATTENTION_STATUSES)
  else if (filters.tab === 'healthy') query = query.eq('sync_status', 'synced')
  else if (filters.tab === 'disconnected') query = query.eq('sync_status', 'disconnected')
  if (filters.syncStatus) query = query.eq('sync_status', filters.syncStatus)
  if (filters.mapping) query = query.eq('mapping_label', filters.mapping)
  if (filters.owner) query = query.eq('owner_user_id', filters.owner)
  if (filters.currency) query = query.eq('currency', filters.currency)

  const [sortColumn, sortDirection] = parseSort(filters.sort)
  query = query.order(sortColumn, { ascending: sortDirection === 'asc' }).order('id', { ascending: true })

  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, count } = await query
  const rows = data ?? []

  const [metrics, owners] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'account', range, entityIds: rows.map(row => row.id as string) }),
    getProfileNames(supabase, rows.map(row => row.owner_user_id as string | null)),
  ])
  const spendById = new Map<string, number>()
  for (const row of metrics) spendById.set(row.entity_id, (spendById.get(row.entity_id) ?? 0) + Number(row.spend))

  return {
    total: count ?? 0,
    rows: rows.map(row => ({
      id: row.id as string, connectionId: row.connection_id as string | null,
      provider: row.provider as AdProvider, name: row.name as string, externalId: row.external_id as string,
      currency: row.currency as string, timezone: row.timezone as string, status: row.status as string,
      syncStatus: row.sync_status as string, mappingLabel: row.mapping_label as string | null,
      ownerUserId: row.owner_user_id as string | null,
      ownerName: owners.get(row.owner_user_id as string) ?? null,
      lastSyncedAt: row.last_synced_at as string | null,
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

/** Counts for the All / Needs Attention / Healthy / Disconnected tabs, plus filter options. */
export async function getAccountFacets(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from('ad_accounts')
    .select('sync_status, provider, mapping_label, owner_user_id, currency, created_at')
    .eq('workspace_id', workspaceId)
  const rows = data ?? []
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const owners = await getProfileNames(supabase, rows.map(row => row.owner_user_id as string | null))
  return {
    all: rows.length,
    attention: rows.filter(row => ATTENTION_STATUSES.includes(row.sync_status as string)).length,
    healthy: rows.filter(row => row.sync_status === 'synced').length,
    disconnected: rows.filter(row => row.sync_status === 'disconnected').length,
    error: rows.filter(row => ['failed', 'expired', 'disconnected'].includes(row.sync_status as string)).length,
    warning: rows.filter(row => ['warning', 'partial', 'pending', 'queued', 'syncing'].includes(row.sync_status as string)).length,
    addedThisMonth: rows.filter(row => (row.created_at as string) >= monthStart).length,
    platforms: new Set(rows.map(row => row.provider as string)).size,
    mappings: [...new Set(rows.map(row => row.mapping_label as string | null).filter((v): v is string => !!v))].sort(),
    currencies: [...new Set(rows.map(row => row.currency as string))].sort(),
    owners: [...owners.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export type ProviderSummaryCard = {
  provider: AdProvider
  configured: boolean
  connectionId: string | null
  connectionStatus: string | null
  spend: number
  spendChangePct: number | null
  accountCount: number
  attentionCount: number
  scopes: string[]
  ownerName: string | null
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
  const owners = await getProfileNames(supabase, connections.map(connection => connection.ownerUserId))

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
        connectionId: connection?.id ?? null,
        connectionStatus: connection?.status ?? null, spend,
        spendChangePct: prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : null,
        accountCount: connection?.accountCount ?? 0, attentionCount: connection?.attentionCount ?? 0,
        scopes: connection?.scopes ?? [],
        ownerName: connection?.ownerUserId ? owners.get(connection.ownerUserId) ?? null : null,
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
  accountId: string | null
}

export async function getOpenIssues(supabase: SupabaseClient, workspaceId: string, limit = 10): Promise<SourceIssueRow[]> {
  const { data } = await supabase
    .from('ad_issues')
    .select('id, severity, provider, title, detail, required_action, created_at, account_id')
    .eq('workspace_id', workspaceId)
    .is('resolved_at', null)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(row => ({
    id: row.id as string, severity: row.severity as string, provider: row.provider as string | null,
    title: row.title as string, detail: row.detail as string | null,
    requiredAction: row.required_action as string | null, createdAt: row.created_at as string,
    accountId: row.account_id as string | null,
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
