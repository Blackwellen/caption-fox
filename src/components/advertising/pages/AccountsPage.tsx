import Link from 'next/link'
import { Plug, RefreshCw } from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { pageParam, pageSizeParam, resolveRange, totals, type DateRange } from '@/lib/advertising/queries/shared'
import {
  getAccountsPage, getOpenIssues, getProviderSummaryCards, PROVIDER_LABEL, type AccountFilters,
} from '@/lib/advertising/queries/accounts'
import { loadMetrics } from '@/lib/advertising/queries/shared'
import { formatCurrency, formatChange, formatRelativeTime, formatRoas } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader, { type HeaderAction } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { HEALTH_STATUS, ISSUE_SEVERITY } from '../StatusPill'
import { ClearFiltersButton, FilterSelect, Pagination, SearchInput, ViewSwitcher } from '../Controls'
import { EmptyState, Panel, PanelHeader } from '../Primitives'
import DataTable, { type Column } from '../DataTable'
import type { AccountRow } from '@/lib/advertising/queries/accounts'
import { kpi } from '@/lib/advertising/queries/shared'
import { previousRange } from '@/lib/advertising/queries/shared'
import ConnectAccountButton from '../client/ConnectAccountButton'
import SyncNowButton from '../client/SyncNowButton'

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AccountsPage({
  session, searchParams,
}: { session: AdvertisingSession; searchParams: Record<string, string | string[] | undefined> }) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const base = session.basePath

  const filters: AccountFilters = {
    q: firstParam(searchParams.q) ?? null,
    provider: firstParam(searchParams.provider) ?? null,
    syncStatus: firstParam(searchParams.syncStatus) ?? null,
    tab: (firstParam(searchParams.tab) as AccountFilters['tab']) ?? 'all',
    sort: firstParam(searchParams.sort) ?? null,
    page: pageParam(searchParams), pageSize: pageSizeParam(searchParams),
  }

  const [{ rows, total }, providerCards, issues, accountMetricRows] = await Promise.all([
    getAccountsPage(session.supabase, session.workspace.id, range, filters),
    getProviderSummaryCards(session.supabase, session.workspace.id, range),
    getOpenIssues(session.supabase, session.workspace.id),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'account', range }),
  ])
  const previousMetricRows = await loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'account', range: previousRange(range) })
  const totalsRow = totals(accountMetricRows)
  const previousTotalsRow = totals(previousMetricRows)

  const canConnect = session.capabilities['accounts.connect']
  const canSync = session.capabilities['accounts.sync']

  const activeFilterCount = [filters.q, filters.provider, filters.syncStatus].filter(Boolean).length

  const columns: Column<AccountRow>[] = [
    {
      key: 'name', header: 'Account', render: row => (
        <Link href={`${base}/accounts/${row.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-blue-700">
          <ProviderLogo provider={row.provider} size={20} tile />
          <span className="min-w-0 truncate">{row.name}</span>
        </Link>
      ),
    },
    { key: 'platform', header: 'Platform', hideBelow: 'sm', render: row => <span className="text-slate-500">{PROVIDER_LABEL(row.provider)}</span> },
    { key: 'mapping', header: 'Workspace Mapping', hideBelow: 'md', render: row => row.mappingLabel ?? <span className="text-slate-300">Unmapped</span> },
    { key: 'currency', header: 'Currency', align: 'center', hideBelow: 'lg', render: row => row.currency },
    { key: 'spend', header: 'Spend', align: 'right', render: row => formatCurrency(row.spend, row.currency) },
    { key: 'status', header: 'Sync Status', render: row => <StatusPill status={row.syncStatus} map={HEALTH_STATUS} /> },
    { key: 'last_synced', header: 'Last Synced', hideBelow: 'md', render: row => <span className="text-slate-500">{formatRelativeTime(row.lastSyncedAt)}</span> },
    {
      key: 'actions', header: 'Actions', align: 'right', render: row => (
        <div className="flex items-center justify-end gap-1.5">
          {canSync && row.connectionId && <SyncNowButton workspaceId={session.workspace.id} workspaceType={session.workspaceType} connectionId={row.connectionId} accountId={row.id} />}
          <Link href={`${base}/accounts/${row.id}`} className="rounded border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50">View</Link>
        </div>
      ),
    },
  ]

  const kpiValues = [
    kpi({ id: 'connected', label: 'Connected Accounts', format: 'integer', current: rows.length, previous: null, spark: [], tooltip: 'Accounts synced into this workspace.' }),
    kpi({ id: 'synced', label: 'Synced Sources', format: 'integer', current: rows.filter(r => r.syncStatus === 'synced').length, previous: null, spark: [], tooltip: 'Accounts with a completed sync.' }),
    kpi({ id: 'spend', label: 'Spend This Period', format: 'currency', current: totalsRow.spend, previous: previousTotalsRow.spend, spark: [], tooltip: 'Total spend across connected accounts in the selected range.' }),
    kpi({ id: 'roas', label: 'ROAS', format: 'roas', current: totalsRow.roas, previous: previousTotalsRow.roas, spark: [], tooltip: 'Blended return on ad spend.' }),
    kpi({ id: 'alerts', label: 'Sync Alerts', format: 'integer', current: issues.length, previous: null, spark: [], tooltip: 'Open issues needing attention.', inverse: true }),
  ]

  const actions: HeaderAction[] = [
    { key: 'sync', label: 'Refresh Sync', icon: <RefreshCw size={14} />, disabledReason: canSync ? null : 'Your role cannot trigger a sync.' },
    { key: 'export', label: 'Export' },
  ]

  return (
    <div>
      <PageHeader title="Advertising Accounts" hint="Every connected paid-media source, its health and its workspace mapping." subtitle="Manage connected advertising sources, account health, scopes, currency, timezone and workspace mappings." actions={actions}>
        {canConnect && <ConnectAccountButton workspaceId={session.workspace.id} workspaceType={session.workspaceType} providers={AD_PROVIDER_IDS} />}
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpiValues.map((value, index) => (
          <KpiCard key={value.id} kpi={value} icon={<Plug size={13} />} accent={['#2563EB', '#0D9488', '#EA580C', '#7C3AED', '#DC2626'][index]} comparisonLabel={previousRange(range).label} />
        ))}
      </section>

      {providerCards.length === 0 ? (
        <Panel className="mb-4">
          <EmptyState
            icon={<Plug size={28} />}
            title="No advertising platforms configured"
            description="Register your own developer app for a platform to start connecting accounts and pulling real spend data."
            action={canConnect ? <ConnectAccountButton workspaceId={session.workspace.id} workspaceType={session.workspaceType} providers={AD_PROVIDER_IDS} primary /> : undefined}
          />
        </Panel>
      ) : (
        <Panel className="mb-4">
          <PanelHeader title="Source Health" hint="Configured platforms and their connection state." />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {providerCards.map(card => (
              <div key={card.provider} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ProviderLogo provider={card.provider} size={24} tile />
                    <span className="text-[13px] font-semibold text-slate-900">{PROVIDER_LABEL(card.provider)}</span>
                  </div>
                  {card.connectionStatus ? (
                    <StatusPill status={card.connectionStatus} map={HEALTH_STATUS} />
                  ) : card.configured ? (
                    <StatusPill status="pending" map={HEALTH_STATUS} label="Not connected" />
                  ) : (
                    <StatusPill status="disconnected" map={HEALTH_STATUS} label="Not set up" />
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between text-[12.5px]">
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{formatCurrency(card.spend)}</p>
                    {card.spendChangePct !== null && <p className="text-[11px] text-slate-500">{formatChange(card.spendChangePct)}</p>}
                  </div>
                  <p className="text-slate-500">{card.accountCount} account{card.accountCount === 1 ? '' : 's'}</p>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                  <span>{card.lastSyncedAt ? `Synced ${formatRelativeTime(card.lastSyncedAt)}` : 'Never synced'}</span>
                  {!card.configured && canConnect && (
                    <ConnectAccountButton workspaceId={session.workspace.id} workspaceType={session.workspaceType} providers={[card.provider]} compact label="Set up" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel padded={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput placeholder="Search account name..." className="w-56" />
          <FilterSelect paramKey="provider" label="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: PROVIDER_LABEL(id) }))} />
          <FilterSelect paramKey="syncStatus" label="Status" options={[
            { value: 'synced', label: 'Healthy' }, { value: 'failed', label: 'Failed' },
            { value: 'expired', label: 'Expired' }, { value: 'syncing', label: 'Syncing' },
          ]} />
          <ClearFiltersButton activeCount={activeFilterCount} />
          <div className="ml-auto flex items-center gap-2">
            <ViewSwitcher
              paramKey="tab" defaultView="all"
              views={[
                { value: 'all', label: 'All Accounts', icon: 'table' },
                { value: 'attention', label: 'Needs Attention', icon: 'table' },
                { value: 'healthy', label: 'Healthy', icon: 'table' },
              ]}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          caption="Connected advertising accounts"
          empty={<EmptyState title="No accounts match these filters" description="Try clearing filters or connecting a new account." />}
        />
        <Pagination page={filters.page} pageSize={filters.pageSize} total={total} itemLabel="accounts" />
      </Panel>

      {issues.length > 0 && (
        <Panel>
          <PanelHeader title="Data Source Issues" hint="Problems detected on connected accounts that need action." />
          <ul className="mt-3 divide-y divide-slate-100">
            {issues.map(issue => (
              <li key={issue.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="flex min-w-0 gap-2.5">
                  <StatusPill status={issue.severity} map={ISSUE_SEVERITY} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-800">{issue.title}</p>
                    {issue.detail && <p className="mt-0.5 text-[11.5px] text-slate-500">{issue.detail}</p>}
                    {issue.requiredAction && <p className="mt-0.5 text-[11px] text-blue-600">{issue.requiredAction}</p>}
                  </div>
                </div>
                <span className="shrink-0 text-[10.5px] text-slate-400">{formatRelativeTime(issue.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
