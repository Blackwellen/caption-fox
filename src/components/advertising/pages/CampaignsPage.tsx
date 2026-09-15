import Link from 'next/link'
import { BarChart3, Target } from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { pageParam, pageSizeParam, resolveRange, previousRange, kpi, totals } from '@/lib/advertising/queries/shared'
import { loadMetrics } from '@/lib/advertising/queries/shared'
import {
  getCampaignsByStatus, getCampaignsPage, getCampaignInsights, type CampaignFilters, type CampaignListRow,
} from '@/lib/advertising/queries/campaigns'
import { getRecentAlerts } from '@/lib/advertising/queries/overview'
import { formatCurrency, formatNumber, formatPercent, formatRoas } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader, { type HeaderAction } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, ISSUE_SEVERITY, OBJECTIVE_LABELS } from '../StatusPill'
import { ClearFiltersButton, FilterSelect, Pagination, SearchInput, SortSelect, ViewSwitcher } from '../Controls'
import { EmptyState, Panel, PanelHeader } from '../Primitives'
import DataTable, { type Column } from '../DataTable'
import PauseResumeButton from '../client/PauseResumeButton'
import { formatRelativeTime } from '@/lib/advertising/metrics'

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CampaignsPage({
  session, searchParams,
}: { session: AdvertisingSession; searchParams: Record<string, string | string[] | undefined> }) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const compare = previousRange(range)
  const base = session.basePath
  const view = firstParam(searchParams.view) ?? 'table'

  const filters: CampaignFilters = {
    q: firstParam(searchParams.q) ?? null,
    platform: firstParam(searchParams.platform) ?? null,
    objective: firstParam(searchParams.objective) ?? null,
    status: firstParam(searchParams.status) ?? null,
    owner: firstParam(searchParams.owner) ?? null,
    sort: firstParam(searchParams.sort) ?? null,
    page: pageParam(searchParams), pageSize: pageSizeParam(searchParams),
  }

  const [tableData, boardData, insights, alerts, metricRows, previousMetricRows] = await Promise.all([
    view === 'table' || view === 'cards' ? getCampaignsPage(session.supabase, session.workspace.id, range, filters) : Promise.resolve({ rows: [] as CampaignListRow[], total: 0 }),
    view === 'board' ? getCampaignsByStatus(session.supabase, session.workspace.id, range, filters) : Promise.resolve(null),
    getCampaignInsights(session.supabase, session.workspace.id, range),
    getRecentAlerts(session.supabase, session.workspace.id, 5),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'campaign', range }),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'campaign', range: compare }),
  ])

  const totalsRow = totals(metricRows)
  const previousTotalsRow = totals(previousMetricRows)
  const { count: activeCount } = await session.supabase.from('ad_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active')

  const canCreate = session.capabilities['campaigns.create']
  const canBulkEdit = session.capabilities['campaigns.bulk_edit']
  const canPause = session.capabilities['campaigns.pause']

  const activeFilterCount = [filters.q, filters.platform, filters.objective, filters.status, filters.owner].filter(Boolean).length

  const kpis = [
    kpi({ id: 'spend', label: 'Total Spend', format: 'currency', current: totalsRow.spend, previous: previousTotalsRow.spend, spark: [], tooltip: 'Spend across matching campaigns.' }),
    kpi({ id: 'active', label: 'Active Campaigns', format: 'integer', current: activeCount ?? 0, previous: null, spark: [], tooltip: 'Campaigns currently live.' }),
    kpi({ id: 'roas', label: 'ROAS (All)', format: 'roas', current: totalsRow.roas, previous: previousTotalsRow.roas, spark: [], tooltip: 'Blended return on ad spend.' }),
    kpi({ id: 'ctr', label: 'CTR (All)', format: 'percent', current: totalsRow.ctr, previous: previousTotalsRow.ctr, spark: [], tooltip: 'Clicks divided by impressions.' }),
    kpi({ id: 'conversions', label: 'Conversions', format: 'integer', current: totalsRow.conversions, previous: previousTotalsRow.conversions, spark: [], tooltip: 'Attributed conversions.' }),
  ]

  const columns: Column<CampaignListRow>[] = [
    {
      key: 'name', header: 'Campaign Name', render: row => (
        <Link href={`${base}/campaigns/${row.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-blue-700">
          <ProviderLogo provider={row.provider} size={18} decorative />
          <span className="min-w-0 truncate">{row.name}</span>
        </Link>
      ),
    },
    { key: 'objective', header: 'Objective', hideBelow: 'md', render: row => <span className="text-slate-500">{OBJECTIVE_LABELS[row.objective] ?? row.objective}</span> },
    { key: 'spend', header: 'Spend', align: 'right', render: row => formatCurrency(row.spend) },
    { key: 'budget', header: 'Budget', align: 'right', hideBelow: 'lg', render: row => row.budget !== null ? formatCurrency(row.budget) : '—' },
    { key: 'roas', header: 'ROAS', align: 'right', render: row => formatRoas(row.roas) },
    { key: 'ctr', header: 'CTR', align: 'right', hideBelow: 'sm', render: row => formatPercent(row.ctr) },
    { key: 'conversions', header: 'Conversions', align: 'right', hideBelow: 'md', render: row => formatNumber(row.conversions) },
    { key: 'status', header: 'Status', render: row => <StatusPill status={row.status} map={CAMPAIGN_STATUS} /> },
    {
      key: 'actions', header: 'Actions', align: 'right', render: row => (
        <div className="flex items-center justify-end gap-1.5">
          {canPause && (row.status === 'active' || row.status === 'paused') && (
            <PauseResumeButton workspaceId={session.workspace.id} workspaceType={session.workspaceType} campaignId={row.id} status={row.status as 'active' | 'paused'} />
          )}
          <Link href={`${base}/campaigns/${row.id}`} className="rounded border border-slate-200 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50">View</Link>
        </div>
      ),
    },
  ]

  const actions: HeaderAction[] = [
    { key: 'create', label: 'Create Campaign', variant: 'primary', icon: <Target size={14} />, disabledReason: canCreate ? null : 'No connected platform supports creating campaigns, or your role cannot create them.' },
    { key: 'bulk', label: 'Bulk Edit', disabledReason: canBulkEdit ? null : 'Your role cannot bulk edit campaigns.' },
    { key: 'export', label: 'Export' },
  ]

  return (
    <div>
      <PageHeader title="Advertising Campaigns" hint="Search, filter and manage campaigns across every connected platform." subtitle="Manage, optimize, and analyze your advertising campaigns across all platforms." actions={actions} />

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((value, index) => (
          <KpiCard key={value.id} kpi={value} icon={<BarChart3 size={13} />} accent={['#2563EB', '#4F46E5', '#7C3AED', '#0D9488', '#EA580C'][index]} comparisonLabel={compare.label} />
        ))}
      </section>

      <Panel padded={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput placeholder="Search campaigns..." className="w-56" />
          <FilterSelect paramKey="platform" label="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: id }))} compact />
          <FilterSelect paramKey="objective" label="Objective" options={Object.entries(OBJECTIVE_LABELS).map(([value, label]) => ({ value, label }))} compact />
          <FilterSelect paramKey="status" label="Status" options={Object.entries(CAMPAIGN_STATUS).map(([value, entry]) => ({ value, label: entry.label }))} compact />
          <ClearFiltersButton activeCount={activeFilterCount} />
          <div className="ml-auto flex items-center gap-2">
            <SortSelect defaultValue="updated_desc" options={[
              { value: 'updated_desc', label: 'Last updated' }, { value: 'name_asc', label: 'Name A–Z' },
              { value: 'spend_desc', label: 'Spend high–low' }, { value: 'budget_desc', label: 'Budget high–low' },
            ]} className="w-40" />
            <ViewSwitcher defaultView="table" views={[
              { value: 'table', label: 'Table', icon: 'table' },
              { value: 'cards', label: 'Cards', icon: 'cards' },
              { value: 'board', label: 'Board', icon: 'board' },
            ]} />
          </div>
        </div>

        {view === 'board' && boardData ? (
          <BoardView buckets={boardData} base={base} />
        ) : view === 'cards' ? (
          <CardsView rows={tableData.rows} base={base} />
        ) : (
          <>
            <DataTable
              columns={columns} rows={tableData.rows} rowKey={row => row.id}
              caption="Advertising campaigns"
              empty={<EmptyState title="No campaigns match these filters" description="Try clearing filters, or connect an account to sync campaigns." />}
            />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={tableData.total} itemLabel="campaigns" />
          </>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Campaign Insights" hint="Standout campaigns for the selected period." />
          {insights.length === 0 ? (
            <EmptyState compact title="Not enough data yet" description="Insights appear once campaigns have spend in this range." />
          ) : (
            <ul className="mt-3 space-y-2.5">
              {insights.map(insight => (
                <li key={insight.label} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-slate-500">{insight.label}</span>
                  <span className="font-medium text-slate-800">{insight.value} <span className="text-slate-400">· {insight.sub}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Alerts" actionHref={`${base}`} actionLabel="View all" />
          {alerts.length === 0 ? (
            <EmptyState compact title="No open alerts" description="Budget, sync and creative alerts will appear here." />
          ) : (
            <ul className="mt-3 space-y-2.5">
              {alerts.map(alert => (
                <li key={alert.id} className="flex items-start gap-2.5">
                  <StatusPill status={alert.severity} map={ISSUE_SEVERITY} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-800">{alert.title}</p>
                    <p className="text-[10.5px] text-slate-400">{formatRelativeTime(alert.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function CardsView({ rows, base }: { rows: CampaignListRow[]; base: string }) {
  if (rows.length === 0) return <div className="p-6"><EmptyState title="No campaigns match these filters" description="Try clearing filters." /></div>
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => (
        <Link key={row.id} href={`${base}/campaigns/${row.id}`} className="rounded-lg border border-slate-200 p-3 hover:border-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><ProviderLogo provider={row.provider} size={16} decorative /><span className="truncate text-[13px] font-medium text-slate-800">{row.name}</span></div>
            <StatusPill status={row.status} map={CAMPAIGN_STATUS} dot={false} />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{OBJECTIVE_LABELS[row.objective] ?? row.objective}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            <div><p className="text-slate-400">Spend</p><p className="font-medium text-slate-800">{formatCurrency(row.spend)}</p></div>
            <div><p className="text-slate-400">ROAS</p><p className="font-medium text-slate-800">{formatRoas(row.roas)}</p></div>
            <div><p className="text-slate-400">CTR</p><p className="font-medium text-slate-800">{formatPercent(row.ctr)}</p></div>
            <div><p className="text-slate-400">Conversions</p><p className="font-medium text-slate-800">{formatNumber(row.conversions)}</p></div>
          </div>
        </Link>
      ))}
    </div>
  )
}

const BOARD_COLUMNS: { status: string; label: string }[] = [
  { status: 'draft', label: 'Draft' }, { status: 'active', label: 'Active' },
  { status: 'learning', label: 'Learning' }, { status: 'paused', label: 'Paused' },
  { status: 'completed', label: 'Completed' },
]

function BoardView({ buckets, base }: { buckets: Record<string, CampaignListRow[]>; base: string }) {
  return (
    <div className="overflow-x-auto p-4">
      <div className="flex min-w-max gap-3">
        {BOARD_COLUMNS.map(column => (
          <div key={column.status} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between rounded-t-lg bg-slate-50 px-3 py-2">
              <span className="text-[12.5px] font-semibold text-slate-700">{column.label}</span>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500">{buckets[column.status]?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(buckets[column.status] ?? []).map(row => (
                <Link key={row.id} href={`${base}/campaigns/${row.id}`} className="block rounded-lg border border-slate-200 bg-white p-2.5 hover:border-slate-300">
                  <div className="flex items-center gap-1.5"><ProviderLogo provider={row.provider} size={14} decorative /><span className="truncate text-[12px] font-medium text-slate-800">{row.name}</span></div>
                  <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(row.spend, undefined, { compact: true })} spend</p>
                  <p className="text-[10.5px] text-slate-400">ROAS {formatRoas(row.roas)}</p>
                </Link>
              ))}
              {(buckets[column.status]?.length ?? 0) === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">No campaigns</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
