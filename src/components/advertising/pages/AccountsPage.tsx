import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BarChart3, CheckCircle2, CircleDollarSign, Eye, Info, KeyRound,
  LayoutGrid, Pencil, Plus, Settings2, TrendingUp, Users, UsersRound, XCircle,
} from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import {
  comparisonRange, kpi, loadMetrics, pageParam, pageSizeParam, resolveRange, totals,
} from '@/lib/advertising/queries/shared'
import {
  getAccountFacets, getAccountsPage, getOpenIssues, getProviderSummaryCards,
  PROVIDER_LABEL, type AccountFilters,
} from '@/lib/advertising/queries/accounts'
import { getRecentActivity } from '@/lib/advertising/queries/overview'
import { formatCurrency, formatDateRange, formatRelativeTime, formatRoas } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader from '../PageHeader'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { HEALTH_STATUS } from '../StatusPill'
import { Pagination, SearchInput } from '../Controls'
import { ChipSelect, FiltersPopover, KebabMenu, PageSizeSelect, ScrollRow, SegmentedParam } from '../MiniControls'
import { EmptyState, InfoDot, Panel } from '../Primitives'
import Donut from '../Donut'
import ExportSplit from '../ExportSplit'
import ConnectAccountButton from '../client/ConnectAccountButton'
import SyncNowButton from '../client/SyncNowButton'
import { RefreshSyncButton, ResolveIssueButton } from '../client/AccountActions'

// /{type}/advertising/accounts — built to design reference (2).
// Header, five stat cards, the provider card strip, then the accounts table
// (tabs, search, filter chips, pagination) beside a right rail with Source
// Health, Recent Activity and Data Source Issues.

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

const SYNC_LABEL: Record<string, { label: string; dot: string; text: string }> = {
  synced: { label: 'Synced', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  warning: { label: 'Warning', dot: 'bg-amber-500', text: 'text-amber-700' },
  partial: { label: 'Partial', dot: 'bg-amber-500', text: 'text-amber-700' },
  failed: { label: 'Not Synced', dot: 'bg-red-500', text: 'text-red-600' },
  expired: { label: 'Expired', dot: 'bg-red-500', text: 'text-red-600' },
  disconnected: { label: 'Disconnected', dot: 'bg-slate-400', text: 'text-slate-500' },
  pending: { label: 'Pending', dot: 'bg-slate-400', text: 'text-slate-500' },
  queued: { label: 'Queued', dot: 'bg-blue-500', text: 'text-blue-600' },
  syncing: { label: 'Syncing', dot: 'bg-blue-500', text: 'text-blue-600' },
}

/** Small glyphs for granted scopes; the scope's real name is the tooltip. */
const SCOPE_ICONS = [Eye, LayoutGrid, BarChart3, Users, Settings2, KeyRound]

function initials(name: string | null): string {
  if (!name) return '—'
  return name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name }: { name: string | null }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9.5px] font-semibold text-slate-600" aria-hidden>
      {initials(name)}
    </span>
  )
}

function StatCard({ icon, tone, label, value, fraction, delta, deltaTone, caption }: {
  icon: ReactNode; tone: string; label: string; value: string; fraction?: string | null
  delta?: string | null; deltaTone?: 'up' | 'down' | 'muted'; caption: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${tone}`} aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium text-slate-700 lg:text-[11.5px]">{label}</p>
        <p className="mt-1.5 flex items-baseline gap-x-1 whitespace-nowrap">
          <span className="text-[22px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
            {value}{fraction && <span className="text-[16px] font-semibold text-slate-500">{fraction}</span>}
          </span>
          {delta && (
            <span className={`text-[11.5px] font-semibold ${deltaTone === 'down' ? 'text-red-500' : deltaTone === 'muted' ? 'text-slate-500' : 'text-emerald-600'}`}>{delta}</span>
          )}
        </p>
        <p className="mt-1.5 truncate text-[11.5px] text-slate-500 lg:text-[11px]">{caption}</p>
      </div>
    </div>
  )
}

function splitCurrency(value: number): { main: string; fraction: string | null } {
  const full = formatCurrency(value)
  const index = full.lastIndexOf('.')
  return index === -1 ? { main: full, fraction: null } : { main: full.slice(0, index), fraction: full.slice(index) }
}

const ACTIVITY_ICON: Record<string, { icon: ReactNode; tone: string }> = {
  'sync.completed': { icon: <CheckCircle2 size={17} />, tone: 'text-emerald-500' },
  'connection.created': { icon: <CheckCircle2 size={17} />, tone: 'text-emerald-500' },
  'account.updated': { icon: <Info size={17} />, tone: 'text-blue-500' },
  'sync.failed': { icon: <XCircle size={17} />, tone: 'text-red-500' },
  'connection.disconnected': { icon: <XCircle size={17} />, tone: 'text-red-500' },
}

export default async function AccountsPage({
  session, searchParams, nav,
}: { session: AdvertisingSession; searchParams: SearchParams; nav?: React.ReactNode }) {
  const range = resolveRange({ preset: first(searchParams.range) ?? 'this_month' })
  const compare = comparisonRange(range, first(searchParams.compare))
  const base = session.basePath
  const workspaceId = session.workspace.id

  const tabParam = first(searchParams.tab)
  const filters: AccountFilters = {
    q: first(searchParams.q),
    provider: first(searchParams.provider),
    syncStatus: first(searchParams.syncStatus),
    mapping: first(searchParams.mapping),
    owner: first(searchParams.owner),
    currency: first(searchParams.currency),
    tab: (['attention', 'healthy', 'disconnected'].includes(tabParam ?? '') ? tabParam : 'all') as AccountFilters['tab'],
    sort: first(searchParams.sort),
    page: pageParam(searchParams), pageSize: pageSizeParam(searchParams),
  }

  const [{ rows, total }, providerCards, issues, facets, activity, currentRows, previousRows] = await Promise.all([
    getAccountsPage(session.supabase, workspaceId, range, filters),
    getProviderSummaryCards(session.supabase, workspaceId, range),
    getOpenIssues(session.supabase, workspaceId),
    getAccountFacets(session.supabase, workspaceId),
    getRecentActivity(session.supabase, workspaceId, 5),
    loadMetrics(session.supabase, { workspaceId, entityType: 'account', range }),
    loadMetrics(session.supabase, { workspaceId, entityType: 'account', range: compare }),
  ])
  const now = totals(currentRows)
  const before = totals(previousRows)
  const spendKpi = kpi({ id: 'spend', label: 'Spend', format: 'currency', current: now.spend, previous: before.spend, spark: [], tooltip: '' })
  const roasKpi = kpi({ id: 'roas', label: 'ROAS', format: 'roas', current: now.roas, previous: before.roas, spark: [], tooltip: '' })
  const compareLabel = formatDateRange(new Date(`${compare.since}T00:00:00Z`), new Date(`${compare.until}T00:00:00Z`))
  const spendParts = splitCurrency(now.spend)

  const canConnect = session.capabilities['accounts.connect']
  const canSync = session.capabilities['accounts.sync']
  const canEdit = session.capabilities['accounts.edit']
  const liveConnectionIds = providerCards.filter(card => card.connectionId && card.connectionStatus !== 'disconnected').map(card => card.connectionId as string)
  const visibleCards = providerCards.filter(card => card.connectionStatus || card.configured)
  const syncedPct = facets.all > 0 ? Math.round((facets.healthy / facets.all) * 100) : 0
  const criticalIssues = issues.filter(issue => issue.severity === 'critical')
  const activeFilterCount = [filters.provider, filters.syncStatus, filters.mapping, filters.owner, filters.currency].filter(Boolean).length
  const exportHref = `/api/advertising/export?workspaceType=${session.workspaceType}&range=${first(searchParams.range) ?? 'this_month'}${filters.provider ? `&platform=${filters.provider}` : ''}`
  const delta = (value: number | null, unit = '%') => value === null ? null : `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}${unit}`

  return (
    <div>
      <PageHeader
        title="Advertising Accounts" hint="Every connected paid-media source, its health, scopes and workspace mapping."
        subtitle="Manage connected ad platforms, account health, permissions, and workspace mappings."
        nav={nav}
      >
        {canConnect && (
          <ConnectAccountButton
            workspaceId={workspaceId} workspaceType={session.workspaceType} providers={AD_PROVIDER_IDS}
            primary autoOpenFromUrl label="Connect Source" icon={<Plus size={15} aria-hidden />}
          />
        )}
        <RefreshSyncButton workspaceId={workspaceId} workspaceType={session.workspaceType} connectionIds={liveConnectionIds} disabledReason={canSync ? null : 'Your role cannot trigger a sync.'} />
        <ExportSplit href={exportHref} primary="accounts" />
      </PageHeader>

      <section className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Account summary">
        <StatCard icon={<UsersRound size={19} />} tone="bg-blue-50 text-blue-600" label="Connected Accounts" value={String(facets.all)}
          delta={facets.addedThisMonth > 0 ? `↑ ${facets.addedThisMonth} this month` : null} caption={`Across ${facets.platforms} platform${facets.platforms === 1 ? '' : 's'}`} />
        <StatCard icon={<CheckCircle2 size={19} />} tone="bg-emerald-50 text-emerald-600" label="Synced Sources" value={String(facets.healthy)}
          delta={`${syncedPct}%`} deltaTone="muted" caption={facets.healthy === facets.all ? 'All sources up to date' : `${facets.all - facets.healthy} not up to date`} />
        <StatCard icon={<CircleDollarSign size={19} />} tone="bg-violet-50 text-violet-600" label={`Spend ${range.label === 'This month' ? 'This Month' : `(${range.label})`}`}
          value={spendParts.main} fraction={spendParts.fraction} delta={delta(spendKpi.delta)} deltaTone={(spendKpi.delta ?? 0) < 0 ? 'down' : 'up'} caption={`vs ${compareLabel}`} />
        <StatCard icon={<TrendingUp size={19} />} tone="bg-orange-50 text-orange-500" label="ROAS (All Accounts)" value={formatRoas(now.roas)}
          delta={delta(roasKpi.delta)} deltaTone={(roasKpi.delta ?? 0) < 0 ? 'down' : 'up'} caption={`vs ${compareLabel}`} />
        <StatCard icon={<AlertTriangle size={19} />} tone="bg-red-50 text-red-500" label="Sync Alerts" value={String(issues.length)}
          caption={issues.length > 0 ? 'Requires attention' : 'Nothing needs attention'} />
      </section>

      {visibleCards.length === 0 ? (
        <Panel className="mb-2">
          <EmptyState
            title="No advertising platforms connected"
            description="Connect a platform with your own developer app to start pulling real spend and performance data."
            action={canConnect ? <ConnectAccountButton workspaceId={workspaceId} workspaceType={session.workspaceType} providers={AD_PROVIDER_IDS} primary label="Connect Source" /> : undefined}
          />
        </Panel>
      ) : (
        <div className="mb-2">
          <ScrollRow label="advertising platforms">
            {visibleCards.map(card => {
              const connected = !!card.connectionStatus
              const extraScopes = Math.max(0, card.scopes.length - 5)
              return (
                <article key={card.provider} className="flex w-[236px] shrink-0 snap-start flex-col rounded-xl border border-slate-200/80 bg-white px-3.5 pb-2.5 pt-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <ProviderLogo provider={card.provider} size={22} decorative />
                      <h3 className="truncate text-[13px] font-semibold text-slate-900" title={PROVIDER_LABEL(card.provider)}>{PROVIDER_LABEL(card.provider)}</h3>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <StatusPill status={card.connectionStatus ?? 'pending'} map={HEALTH_STATUS} dot={false} label={connected ? undefined : 'Not connected'} className="rounded-md px-2 text-[10.5px]" />
                      <KebabMenu label={`${PROVIDER_LABEL(card.provider)} actions`}>
                        <Link href={`${base}/accounts?provider=${card.provider}`}>View accounts</Link>
                        <Link href={`${base}/campaigns?platform=${card.provider}`}>View campaigns</Link>
                        <Link href={`${base}/reports?platform=${card.provider}`}>Open report</Link>
                      </KebabMenu>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-start justify-between">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[17px] font-semibold tabular-nums text-slate-900">{formatCurrency(card.spend)}</span>
                      {card.spendChangePct !== null && (
                        <span className={`text-[11.5px] font-semibold ${card.spendChangePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {card.spendChangePct >= 0 ? '↑' : '↓'} {Math.abs(card.spendChangePct).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <div className="text-right">
                      <p className="text-[10.5px] text-slate-500">Accounts</p>
                      <p className="text-[14px] font-semibold text-slate-900">{card.accountCount}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10.5px] text-slate-500">Scopes</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {card.scopes.length === 0 ? <span className="text-[11px] text-slate-400">None granted</span> : card.scopes.slice(0, 5).map((scope, index) => {
                      const Icon = SCOPE_ICONS[index % SCOPE_ICONS.length]
                      return <span key={scope} title={scope} className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon size={11} aria-hidden /><span className="sr-only">{scope}</span></span>
                    })}
                    {extraScopes > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-100 px-1 text-[9.5px] font-medium text-slate-500" title={card.scopes.slice(5).join(', ')}>+{extraScopes}</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px] text-slate-500">
                    <span>Owner</span><span>Last synced</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-[11.5px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700"><Avatar name={card.ownerName} /><span className="truncate">{card.ownerName ?? '—'}</span></span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      {card.lastSyncedAt && <span className={`h-1.5 w-1.5 rounded-full ${card.connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />}
                      {card.lastSyncedAt ? formatRelativeTime(card.lastSyncedAt) : '—'}
                    </span>
                  </div>
                  {card.attentionCount > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600">
                      <AlertTriangle size={12} aria-hidden /> {card.attentionCount} account{card.attentionCount === 1 ? '' : 's'} need{card.attentionCount === 1 ? 's' : ''} attention
                    </p>
                  )}
                  <div className="min-h-2.5 flex-1" aria-hidden />
                  <div className="-mx-3.5 flex justify-center border-t border-slate-100 pt-2">
                    {connected ? (
                      <Link href={`${base}/accounts?provider=${card.provider}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:underline">
                        View Accounts <ArrowRight size={13} aria-hidden />
                      </Link>
                    ) : canConnect ? (
                      <ConnectAccountButton workspaceId={workspaceId} workspaceType={session.workspaceType} providers={[card.provider]} linkStyle label="Set Up Now →" />
                    ) : null}
                  </div>
                </article>
              )
            })}
          </ScrollRow>
        </div>
      )}

      {/* The shell sidebar is wider than the design's, so the rail gives up width to keep the table un-scrolled. */}
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_344px]">
        <Panel padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
            <SegmentedParam
              paramKey="tab" defaultValue="all" ariaLabel="Account health"
              options={[
                { value: 'all', label: 'All Accounts' },
                { value: 'attention', label: 'Needs Attention', badge: facets.attention },
                { value: 'healthy', label: 'Healthy' },
                { value: 'disconnected', label: 'Disconnected' },
              ]}
            />
            <div className="flex items-center gap-2">
              <SearchInput placeholder="Search accounts..." className="w-44" ariaLabel="Search accounts by name or ID" />
              <FiltersPopover activeCount={filters.currency ? 1 : 0}>
                <label className="block text-[11.5px] font-medium text-slate-500">Currency</label>
                <ChipSelect paramKey="currency" label="Currency" allLabel="All currencies" options={facets.currencies.map(value => ({ value, label: value }))} className="w-full [&>span]:w-full [&>span]:justify-between" />
              </FiltersPopover>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-3">
            <ChipSelect paramKey="provider" label="Platform" allLabel="All Platforms" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: PROVIDER_LABEL(id) }))} />
            <ChipSelect paramKey="mapping" label="Workspace mapping" allLabel="All Workspaces" options={facets.mappings.map(value => ({ value, label: value }))} />
            <ChipSelect paramKey="syncStatus" label="Sync status" allLabel="All Statuses" options={[
              { value: 'synced', label: 'Synced' }, { value: 'warning', label: 'Warning' },
              { value: 'failed', label: 'Not synced' }, { value: 'expired', label: 'Expired' }, { value: 'disconnected', label: 'Disconnected' },
            ]} />
            <ChipSelect paramKey="owner" label="Owner" allLabel="All Owners" options={facets.owners.map(owner => ({ value: owner.id, label: owner.name }))} />
            <details className="relative">
              <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <Plus size={13} aria-hidden /> Add filter
              </summary>
              <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg">
                <p className="mb-1.5 text-[11.5px] font-medium text-slate-500">Sort by</p>
                <ChipSelect paramKey="sort" label="Sort" allLabel="Name A–Z" options={[
                  { value: 'name_desc', label: 'Name Z–A' }, { value: 'last_synced_desc', label: 'Recently synced' },
                  { value: 'status_asc', label: 'Sync status' }, { value: 'provider_asc', label: 'Platform' },
                ]} className="w-full [&>span]:w-full [&>span]:justify-between" />
              </div>
            </details>
            <span className="ml-auto text-[12px] text-slate-500">{total} account{total === 1 ? '' : 's'}{activeFilterCount > 0 ? ' match' : ''}</span>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 pb-4"><EmptyState title="No accounts match these filters" description="Clear a filter or switch tabs to see more accounts." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-[11.5px] lg:text-[10.5px]">
                <caption className="sr-only">Advertising accounts</caption>
                <thead>
                  <tr className="border-y border-slate-100 text-[11.5px] text-slate-700 lg:text-[10.5px]">
                    {['Account', 'Platform', 'Workspace Mapping', 'Currency', 'Time Zone', 'Sync Status', 'Last Synced', 'Actions'].map(header => (
                      <th key={header} className="whitespace-nowrap px-[7px] py-2 font-semibold first:pl-4">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => {
                    const sync = SYNC_LABEL[row.syncStatus] ?? SYNC_LABEL.pending
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-[7px] py-1 first:pl-4">
                          <Link href={`${base}/accounts/${row.id}`} className="flex items-center gap-2.5">
                            <ProviderLogo provider={row.provider} size={22} tile decorative />
                            <span className="min-w-0">
                              <span className="block truncate font-medium leading-4 text-slate-800 hover:text-blue-700">{row.name}</span>
                              <span className="block truncate text-[10.5px] leading-4 text-slate-400">{row.externalId}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-[7px] py-1 first:pl-4"><span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-600"><ProviderLogo provider={row.provider} size={12} decorative />{PROVIDER_LABEL(row.provider)}</span></td>
                        <td className="px-[7px] py-1 first:pl-4">
                          <span className="block whitespace-nowrap text-slate-700">{row.mappingLabel ?? <span className="text-slate-300">Unmapped</span>}</span>
                          {row.mappingLabel && <span className="block whitespace-nowrap text-[11px] text-slate-400">Workspace</span>}
                        </td>
                        <td className="px-[7px] py-1 first:pl-4 text-slate-600">{row.currency}</td>
                        <td className="px-[7px] py-1 first:pl-4 whitespace-nowrap text-slate-600">{row.timezone}</td>
                        <td className="px-[7px] py-1 first:pl-4"><span className={`flex items-center gap-1.5 whitespace-nowrap font-medium ${sync.text}`}><span className={`h-1.5 w-1.5 rounded-full ${sync.dot}`} aria-hidden />{sync.label}</span></td>
                        <td className="px-[7px] py-1 first:pl-4 whitespace-nowrap text-slate-600">{row.lastSyncedAt ? formatRelativeTime(row.lastSyncedAt) : '—'}</td>
                        <td className="px-[7px] py-1 first:pl-4">
                          <div className="flex items-center gap-0.5">
                            {canSync && row.connectionId && (
                              <SyncNowButton iconOnly workspaceId={workspaceId} workspaceType={session.workspaceType} connectionId={row.connectionId} accountId={row.id} />
                            )}
                            {canEdit && (
                              <Link href={`${base}/accounts/${row.id}`} aria-label={`Edit ${row.name}`} title="Edit account" className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                                <Pencil size={13} aria-hidden />
                              </Link>
                            )}
                            <KebabMenu size="sm" label={`${row.name} actions`}>
                              <Link href={`${base}/accounts/${row.id}`}>View account</Link>
                              <Link href={`${base}/campaigns?platform=${row.provider}`}>View campaigns</Link>
                              <Link href={`${base}/reports?platform=${row.provider}`}>Open report</Link>
                            </KebabMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pr-4">
            <div className="min-w-0 flex-1"><Pagination page={filters.page} pageSize={filters.pageSize} total={total} itemLabel="accounts" /></div>
            <PageSizeSelect value={filters.pageSize} />
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-2">
          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900">Source Health <InfoDot label="Accounts by current sync state." /></h2>
              <Link href={`${base}/accounts?tab=attention`} className="text-[12px] font-medium text-blue-600 hover:underline">View all</Link>
            </div>
            <Donut
              className="mt-3"
              size={112} thickness={13}
              centerValue={String(facets.all)} centerLabel="Total"
              summary={`${facets.healthy} healthy, ${facets.warning} attention, ${facets.error} error`}
              slices={[
                { key: 'healthy', label: 'Healthy', value: facets.healthy, color: '#22C55E', detail: `${facets.healthy} (${facets.all ? Math.round((facets.healthy / facets.all) * 100) : 0}%)` },
                { key: 'attention', label: 'Attention', value: facets.warning, color: '#F59E0B', detail: `${facets.warning} (${facets.all ? Math.round((facets.warning / facets.all) * 100) : 0}%)` },
                { key: 'error', label: 'Error', value: facets.error, color: '#EF4444', detail: `${facets.error} (${facets.all ? Math.round((facets.error / facets.all) * 100) : 0}%)` },
              ]}
            />
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Recent Activity</h2>
              <Link href={base} className="text-[12px] font-medium text-blue-600 hover:underline">View all</Link>
            </div>
            {activity.length === 0 ? (
              <EmptyState compact title="No activity yet" description="Connections, syncs and mapping changes appear here." className="mt-3" />
            ) : (
              <ul className="mt-2.5 space-y-2">
                {activity.map(entry => {
                  const style = ACTIVITY_ICON[entry.eventType] ?? { icon: <Info size={17} />, tone: 'text-blue-500' }
                  const href = entry.entityType === 'account' && entry.entityId ? `${base}/accounts/${entry.entityId}` : null
                  const body = (
                    <>
                      <span className={`mt-0.5 shrink-0 ${style.tone}`} aria-hidden>{style.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] leading-4 text-slate-800" title={entry.summary}>{entry.summary}</span>
                        {entry.actorLabel && <span className="block text-[10.5px] leading-4 text-slate-400">by {entry.actorLabel}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(entry.createdAt)}</span>
                    </>
                  )
                  return <li key={entry.id}>{href ? <Link href={href} className="-mx-1.5 flex gap-2.5 rounded-md px-1.5 py-0.5 hover:bg-slate-50">{body}</Link> : <div className="flex gap-2.5">{body}</div>}</li>
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Data Source Issues</h2>
              <Link href={`${base}/accounts?tab=attention`} className="text-[12px] font-medium text-blue-600 hover:underline">View all</Link>
            </div>
            {issues.length === 0 ? (
              <EmptyState compact title="No open issues" description="Authentication, scope and sync problems appear here with the fix." className="mt-3" />
            ) : (
              <>
                {criticalIssues.length > 0 && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/70 px-3.5 py-3" role="alert">
                    <AlertTriangle size={22} className="shrink-0 text-red-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-red-800">{criticalIssues.length} account{criticalIssues.length === 1 ? '' : 's'} with critical issues</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-red-700/90">{criticalIssues[0].detail ?? criticalIssues[0].title}</p>
                    </div>
                    <ResolveIssueButton workspaceId={workspaceId} workspaceType={session.workspaceType} issueId={criticalIssues[0].id} />
                  </div>
                )}
                <ul className="mt-2 divide-y divide-slate-100">
                  {/* With a critical banner showing, the design lists nothing else; the rest sit behind "View all issues". */}
                  {issues.filter(issue => issue.severity !== 'critical').slice(0, criticalIssues.length > 0 ? 0 : 3).map(issue => (
                    <li key={issue.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-slate-800">{issue.title}</p>
                        {issue.requiredAction && <p className="mt-0.5 text-[11.5px] text-blue-600">{issue.requiredAction}</p>}
                      </div>
                      <ResolveIssueButton workspaceId={workspaceId} workspaceType={session.workspaceType} issueId={issue.id} />
                    </li>
                  ))}
                </ul>
                <Link href={`${base}/accounts?tab=attention`} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline">
                  View all issues <ArrowRight size={13} aria-hidden />
                </Link>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
