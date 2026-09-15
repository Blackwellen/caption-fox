import { Users2 } from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { pageParam, pageSizeParam, resolveRange, previousRange, kpi, totals } from '@/lib/advertising/queries/shared'
import { loadMetrics } from '@/lib/advertising/queries/shared'
import {
  getAudiencesPage, getOverlapPairs, getAudienceGrowth, getAudienceComposition,
  getPlatformDistribution, type AudienceFilters, type AudienceRow,
} from '@/lib/advertising/queries/audiences'
import { formatCurrency, formatNumber, formatPercent, formatRelativeTime, formatRoas } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS, providerColor } from '@/lib/advertising/providers'
import PageHeader, { type HeaderAction } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { AUDIENCE_STATUS, AUDIENCE_TYPE_LABELS } from '../StatusPill'
import { ClearFiltersButton, FilterSelect, Pagination, SearchInput, SortSelect, ViewSwitcher } from '../Controls'
import { EmptyState, Panel, PanelHeader } from '../Primitives'
import DataTable, { type Column } from '../DataTable'
import Sparkline from '../Sparkline'
import RefreshAudienceButton from '../client/RefreshAudienceButton'

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AudiencesPage({
  session, searchParams,
}: { session: AdvertisingSession; searchParams: Record<string, string | string[] | undefined> }) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const compare = previousRange(range)
  const view = firstParam(searchParams.view) ?? 'cards'

  const filters: AudienceFilters = {
    q: firstParam(searchParams.q) ?? null,
    platform: firstParam(searchParams.platform) ?? null,
    audienceType: firstParam(searchParams.audienceType) ?? null,
    refreshStatus: firstParam(searchParams.refreshStatus) ?? null,
    sort: firstParam(searchParams.sort) ?? null,
    page: pageParam(searchParams), pageSize: pageSizeParam(searchParams),
  }

  const [{ rows, total }, overlapPairs, growth, composition, distribution, metricRows, previousMetricRows] = await Promise.all([
    getAudiencesPage(session.supabase, session.workspace.id, range, filters),
    view === 'overlap' ? getOverlapPairs(session.supabase, session.workspace.id) : Promise.resolve([]),
    getAudienceGrowth(session.supabase, session.workspace.id, range),
    getAudienceComposition(session.supabase, session.workspace.id),
    getPlatformDistribution(session.supabase, session.workspace.id, range),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'audience', range }),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'audience', range: compare }),
  ])

  const totalsRow = totals(metricRows)
  const previousTotalsRow = totals(previousMetricRows)
  const reach = metricRows.reduce((sum, row) => sum + Number(row.reach), 0)
  const previousReach = previousMetricRows.reduce((sum, row) => sum + Number(row.reach), 0)
  const matched = rows.reduce((sum, row) => sum + (row.matchedUsers ?? 0), 0)
  const [{ count: activeAudienceCount }] = await Promise.all([
    session.supabase.from('ad_audiences').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'ready'),
  ])
  const topRoasAudience = [...rows].sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0]

  const canCreate = session.capabilities['audiences.create']
  const canSync = session.capabilities['audiences.sync']
  const activeFilterCount = [filters.q, filters.platform, filters.audienceType, filters.refreshStatus].filter(Boolean).length

  const totalComposition = composition.reduce((sum, slice) => sum + slice.value, 0) || 1
  const totalReachForDistribution = distribution.reduce((sum, row) => sum + row.reach, 0) || 1

  const kpis = [
    kpi({ id: 'reach', label: 'Reach', format: 'number', current: reach, previous: previousReach, spark: [], tooltip: 'Deduplicated reach across matching audiences.' }),
    kpi({ id: 'matched', label: 'Matched Users', format: 'number', current: matched, previous: null, spark: [], tooltip: 'Users matched by the platform for these audiences.' }),
    kpi({ id: 'active', label: 'Active Audiences', format: 'integer', current: activeAudienceCount ?? 0, previous: null, spark: [], tooltip: 'Audiences currently ready to use.' }),
    kpi({ id: 'frequency', label: 'Avg Frequency', format: 'number', current: totalsRow.frequency, previous: previousTotalsRow.frequency, spark: [], tooltip: 'Impressions divided by reach.' }),
    kpi({ id: 'overlap', label: 'Overlap Alerts', format: 'integer', current: overlapPairs.filter(pair => (pair.overlapPct ?? 0) > 30).length, previous: null, spark: [], tooltip: 'Audience pairs with meaningful overlap.', inverse: true }),
  ]

  const columns: Column<AudienceRow>[] = [
    { key: 'name', header: 'Audience Name', render: row => <p className="truncate font-medium text-slate-800">{row.name}</p> },
    { key: 'type', header: 'Type', hideBelow: 'sm', render: row => <span className="text-slate-500">{AUDIENCE_TYPE_LABELS[row.audienceType] ?? row.audienceType}</span> },
    { key: 'platform', header: 'Platform', hideBelow: 'md', render: row => <ProviderLogo provider={row.provider} size={18} /> },
    { key: 'size', header: 'Size', align: 'right', render: row => formatNumber(row.sizeEstimate, { compact: true }) },
    { key: 'match', header: 'Match Rate', align: 'right', hideBelow: 'lg', render: row => formatPercent(row.matchRate) },
    { key: 'roas', header: 'ROAS', align: 'right', render: row => formatRoas(row.roas) },
    { key: 'cpa', header: 'CPA', align: 'right', hideBelow: 'lg', render: row => formatCurrency(row.cpa) },
    { key: 'status', header: 'Status', render: row => <StatusPill status={row.refreshStatus} map={AUDIENCE_STATUS} /> },
    { key: 'actions', header: 'Actions', align: 'right', render: row => canSync ? <RefreshAudienceButton workspaceId={session.workspace.id} workspaceType={session.workspaceType} audienceId={row.id} /> : null },
  ]

  const actions: HeaderAction[] = [
    { key: 'sync', label: 'Sync Segments', disabledReason: canSync ? null : 'Your role or connected platforms cannot sync audiences.' },
    { key: 'create', label: 'Create Audience', variant: 'primary', disabledReason: canCreate ? null : 'Your role or connected platforms cannot create audiences.' },
    { key: 'export', label: 'Export' },
  ]

  return (
    <div>
      <PageHeader title="Advertising Audiences" hint="Custom audiences, lookalikes and retargeting pools across every platform." subtitle="Manage audience segments, lookalikes, retargeting pools, and assess readiness across platforms." actions={actions} />

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((value, index) => (
          <KpiCard key={value.id} kpi={value} icon={<Users2 size={13} />} accent={['#2563EB', '#4F46E5', '#0D9488', '#7C3AED', '#DC2626'][index]} comparisonLabel={compare.label} />
        ))}
      </section>

      <Panel padded={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput placeholder="Search audiences by name, type, or description..." className="w-64" />
          <FilterSelect paramKey="platform" label="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: id }))} compact />
          <FilterSelect paramKey="audienceType" label="Type" options={Object.entries(AUDIENCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))} compact />
          <ClearFiltersButton activeCount={activeFilterCount} />
          <div className="ml-auto flex items-center gap-2">
            <SortSelect defaultValue="updated_desc" options={[{ value: 'updated_desc', label: 'Last updated' }, { value: 'name_asc', label: 'Name A–Z' }, { value: 'size_desc', label: 'Size high–low' }]} className="w-40" />
            <ViewSwitcher defaultView="cards" views={[
              { value: 'cards', label: 'Cards', icon: 'cards' },
              { value: 'table', label: 'Table', icon: 'table' },
              { value: 'overlap', label: 'Overlap', icon: 'overlap' },
            ]} />
          </div>
        </div>

        {view === 'overlap' ? (
          <OverlapView pairs={overlapPairs} />
        ) : view === 'table' ? (
          <>
            <DataTable columns={columns} rows={rows} rowKey={row => row.id} caption="Advertising audiences" empty={<EmptyState title="No audiences match these filters" description="Create an audience or connect an account to sync audiences." />} />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={total} itemLabel="audiences" />
          </>
        ) : (
          <>
            <CardsView rows={rows} canSync={canSync} workspaceId={session.workspace.id} workspaceType={session.workspaceType} />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={total} itemLabel="audiences" />
          </>
        )}
      </Panel>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Audience Growth" hint="Reach over the selected period" />
          <p className="mt-1 text-[22px] font-bold text-slate-900">{formatNumber(reach, { compact: true })}</p>
          <div className="mt-2 h-28"><Sparkline points={growth} color="#4F46E5" height={112} fill strokeWidth={2} summary="Audience reach trend" /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Audience Composition" hint="Estimated size by audience type" />
          {composition.length === 0 ? <EmptyState compact title="No audiences yet" description="Composition appears once audiences are synced." /> : (
            <ul className="mt-3 space-y-2">
              {composition.map(slice => (
                <li key={slice.type} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-slate-600">{AUDIENCE_TYPE_LABELS[slice.type] ?? slice.type}</span>
                  <span className="shrink-0 font-medium text-slate-800">{((slice.value / totalComposition) * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Platform Distribution" hint="Reach by connected platform" />
          {distribution.length === 0 ? <EmptyState compact title="No reach yet" description="Platform distribution appears once audiences have delivery." /> : (
            <ul className="mt-3 space-y-2.5">
              {distribution.map(row => (
                <li key={row.provider}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-slate-600"><ProviderLogo provider={row.provider} size={14} />{row.provider}</span>
                    <span className="tabular-nums font-medium text-slate-800">{formatNumber(row.reach, { compact: true })} ({((row.reach / totalReachForDistribution) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(row.reach / totalReachForDistribution) * 100}%`, backgroundColor: providerColor(row.provider) }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel padded={false}>
        <div className="flex items-center justify-between p-4 pb-0">
          <PanelHeader title="Audience Performance & Overlap" hint="Every audience with its overlap against all others, and where it is excluded." />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-y border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Audience Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Size</th>
                <th className="px-3 py-2 text-right font-medium">Match Rate</th>
                <th className="px-3 py-2 text-right font-medium">ROAS</th>
                <th className="px-3 py-2 text-right font-medium">CPA</th>
                <th className="px-3 py-2 text-right font-medium">CTR</th>
                <th className="px-3 py-2 text-right font-medium">Spend</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No audience performance yet.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{AUDIENCE_TYPE_LABELS[row.audienceType] ?? row.audienceType}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.sizeEstimate, { compact: true })}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(row.matchRate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatRoas(row.roas)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.cpa)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(row.ctr)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.spend)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={row.status} map={AUDIENCE_STATUS} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function CardsView({
  rows, canSync, workspaceId, workspaceType,
}: { rows: AudienceRow[]; canSync: boolean; workspaceId: string; workspaceType: string }) {
  if (rows.length === 0) return <div className="p-6"><EmptyState title="No audiences match these filters" description="Create an audience or connect an account to sync audiences." /></div>
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => (
        <div key={row.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
            <StatusPill status={row.refreshStatus} map={AUDIENCE_STATUS} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">{AUDIENCE_TYPE_LABELS[row.audienceType] ?? row.audienceType}</p>
          <div className="mt-2 flex items-center gap-1.5"><ProviderLogo provider={row.provider} size={16} /></div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]">
            <div><p className="text-slate-400">Size</p><p className="font-medium text-slate-800">{formatNumber(row.sizeEstimate, { compact: true })}</p></div>
            <div><p className="text-slate-400">Match Rate</p><p className="font-medium text-slate-800">{formatPercent(row.matchRate)}</p></div>
            <div><p className="text-slate-400">Refresh</p><p className="font-medium text-slate-800">{row.refreshSchedule ?? '—'}</p></div>
            <div><p className="text-slate-400">Campaigns</p><p className="font-medium text-slate-800">{row.linkedCampaignCount}</p></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10.5px] text-slate-400">
            <span>{row.lastRefreshedAt ? `Refreshed ${formatRelativeTime(row.lastRefreshedAt)}` : 'Not refreshed yet'}</span>
            {canSync && <RefreshAudienceButton workspaceId={workspaceId} workspaceType={workspaceType} audienceId={row.id} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function OverlapView({ pairs }: { pairs: Awaited<ReturnType<typeof getOverlapPairs>> }) {
  if (pairs.length === 0) {
    return <div className="p-6"><EmptyState title="No overlap data yet" description="Overlap is calculated once at least two audiences on the same platform have measured overlap." /></div>
  }
  return (
    <div className="space-y-2 p-4">
      {pairs.map(pair => (
        <div key={`${pair.audienceAId}-${pair.audienceBId}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div className="min-w-0 text-[12.5px]">
            <span className="font-medium text-slate-800">{pair.audienceAName}</span>
            <span className="mx-1.5 text-slate-400">×</span>
            <span className="font-medium text-slate-800">{pair.audienceBName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[11px] text-slate-400">{formatNumber(pair.overlapUsers, { compact: true })} users</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${(pair.overlapPct ?? 0) > 30 ? 'bg-red-50 text-red-700' : (pair.overlapPct ?? 0) > 10 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {pair.overlapPct !== null ? `${pair.overlapPct.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
