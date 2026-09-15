import Link from 'next/link'
import { Image as ImageIcon, Upload } from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { pageParam, pageSizeParam, resolveRange, previousRange, kpi, totals } from '@/lib/advertising/queries/shared'
import { loadMetrics } from '@/lib/advertising/queries/shared'
import {
  getCreativesPage, getReviewQueue, getTopPerformingCreatives, type CreativeFilters, type CreativeListRow,
} from '@/lib/advertising/queries/creatives'
import { formatCurrency, formatNumber, formatPercent, formatRelativeTime } from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader, { type HeaderAction } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, FORMAT_LABELS, REVIEW_STATUS } from '../StatusPill'
import { ClearFiltersButton, FilterSelect, Pagination, SearchInput, SortSelect, ViewSwitcher } from '../Controls'
import { EmptyState, Panel, PanelHeader } from '../Primitives'
import DataTable, { type Column } from '../DataTable'
import ReviewCreativeButtons from '../client/ReviewCreativeButtons'

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CreativesPage({
  session, searchParams,
}: { session: AdvertisingSession; searchParams: Record<string, string | string[] | undefined> }) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const compare = previousRange(range)
  const base = session.basePath
  const view = firstParam(searchParams.view) ?? 'grid'

  const filters: CreativeFilters = {
    q: firstParam(searchParams.q) ?? null,
    platform: firstParam(searchParams.platform) ?? null,
    format: firstParam(searchParams.format) ?? null,
    status: firstParam(searchParams.status) ?? null,
    reviewStatus: firstParam(searchParams.reviewStatus) ?? null,
    sort: firstParam(searchParams.sort) ?? null,
    page: pageParam(searchParams), pageSize: pageSizeParam(searchParams),
  }

  const [{ rows, total }, reviewQueue, topPerformers, metricRows, previousMetricRows] = await Promise.all([
    getCreativesPage(session.supabase, session.workspace.id, range, filters),
    getReviewQueue(session.supabase, session.workspace.id),
    getTopPerformingCreatives(session.supabase, session.workspace.id, range),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'creative', range }),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType: 'creative', range: compare }),
  ])

  const totalsRow = totals(metricRows)
  const previousTotalsRow = totals(previousMetricRows)
  const [{ count: activeCount }, { count: disapprovedCount }, { count: winningCount }] = await Promise.all([
    session.supabase.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active'),
    session.supabase.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('review_status', 'disapproved'),
    session.supabase.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('is_winning_variant', true),
  ])

  const canUpload = session.capabilities['creatives.upload']
  const canReview = session.capabilities['creatives.review']
  const activeFilterCount = [filters.q, filters.platform, filters.format, filters.status, filters.reviewStatus].filter(Boolean).length

  const kpis = [
    kpi({ id: 'spend', label: 'Creative Spend', format: 'currency', current: totalsRow.spend, previous: previousTotalsRow.spend, spark: [], tooltip: 'Spend attributed to matching creatives.' }),
    kpi({ id: 'ctr', label: 'Top CTR', format: 'percent', current: totalsRow.ctr, previous: previousTotalsRow.ctr, spark: [], tooltip: 'Blended click-through rate.' }),
    kpi({ id: 'hook', label: 'Average Hook Rate', format: 'percent', current: totalsRow.hookRate, previous: previousTotalsRow.hookRate, spark: [], tooltip: '3-second video views over impressions.' }),
    kpi({ id: 'active', label: 'Active Creatives', format: 'integer', current: activeCount ?? 0, previous: null, spark: [], tooltip: 'Creatives currently live.' }),
    kpi({ id: 'disapproved', label: 'Disapproved Creatives', format: 'integer', current: disapprovedCount ?? 0, previous: null, spark: [], tooltip: 'Creatives rejected by a platform.', inverse: true }),
    kpi({ id: 'winning', label: 'Winning Variants', format: 'integer', current: winningCount ?? 0, previous: null, spark: [], tooltip: 'Creatives marked as the winner of a test.' }),
  ]

  const columns: Column<CreativeListRow>[] = [
    {
      key: 'name', header: 'Creative', render: row => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-300"><ImageIcon size={14} /></span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{row.name}</p>
            <p className="truncate text-[11px] text-slate-400">{row.campaignName ?? 'No campaign'}</p>
          </div>
        </div>
      ),
    },
    { key: 'format', header: 'Format', hideBelow: 'sm', render: row => <span className="text-slate-500">{FORMAT_LABELS[row.format] ?? row.format}</span> },
    { key: 'platform', header: 'Platform', hideBelow: 'md', render: row => <ProviderLogo provider={row.provider} size={18} /> },
    { key: 'spend', header: 'Spend', align: 'right', render: row => formatCurrency(row.spend) },
    { key: 'ctr', header: 'CTR', align: 'right', render: row => formatPercent(row.ctr) },
    { key: 'clicks', header: 'Clicks', align: 'right', hideBelow: 'lg', render: row => formatNumber(row.clicks) },
    { key: 'review', header: 'Review Status', render: row => <StatusPill status={row.reviewStatus} map={REVIEW_STATUS} /> },
    { key: 'updated', header: 'Updated', hideBelow: 'md', render: row => <span className="text-slate-500">{formatRelativeTime(row.updatedAt)}</span> },
  ]

  const actions: HeaderAction[] = [
    { key: 'upload', label: 'Upload Creative', icon: <Upload size={14} />, disabledReason: canUpload ? null : 'Your role or connected platforms do not support creative uploads.' },
    { key: 'create', label: 'Create Ad', variant: 'primary', disabledReason: canUpload ? null : 'Your role or connected platforms do not support creating ads.' },
    { key: 'export', label: 'Export' },
  ]

  return (
    <div>
      <PageHeader title="Advertising Creatives" hint="Ad assets, performance and provider review states across every channel." subtitle="Manage ad assets, track performance, and review creative states across all channels." actions={actions} />

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((value, index) => (
          <KpiCard key={value.id} kpi={value} icon={<ImageIcon size={13} />} accent={['#2563EB', '#0D9488', '#7C3AED', '#4F46E5', '#DC2626', '#EA580C'][index]} comparisonLabel={compare.label} />
        ))}
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-[2.1fr_1fr]">
        <Panel padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <SearchInput placeholder="Search creatives by name, campaign, or ID..." className="w-60" />
            <FilterSelect paramKey="platform" label="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: id }))} compact />
            <FilterSelect paramKey="format" label="Format" options={Object.entries(FORMAT_LABELS).map(([value, label]) => ({ value, label }))} compact />
            <FilterSelect paramKey="reviewStatus" label="Status" options={Object.entries(REVIEW_STATUS).map(([value, entry]) => ({ value, label: entry.label }))} compact />
            <ClearFiltersButton activeCount={activeFilterCount} />
            <div className="ml-auto flex items-center gap-2">
              <SortSelect defaultValue="updated_desc" options={[{ value: 'updated_desc', label: 'Last updated' }, { value: 'name_asc', label: 'Name A–Z' }]} className="w-36" />
              <ViewSwitcher defaultView="grid" views={[
                { value: 'grid', label: 'Grid', icon: 'grid' },
                { value: 'table', label: 'Table', icon: 'table' },
                { value: 'review', label: 'Review', icon: 'review' },
              ]} />
            </div>
          </div>

          {view === 'review' ? (
            <ReviewView rows={reviewQueue} canReview={canReview} workspaceId={session.workspace.id} workspaceType={session.workspaceType} />
          ) : view === 'table' ? (
            <>
              <DataTable columns={columns} rows={rows} rowKey={row => row.id} caption="Advertising creatives" empty={<EmptyState title="No creatives match these filters" description="Upload a creative or connect an account to sync creatives." />} />
              <Pagination page={filters.page} pageSize={filters.pageSize} total={total} itemLabel="creatives" />
            </>
          ) : (
            <>
              <GridView rows={rows} base={base} />
              <Pagination page={filters.page} pageSize={filters.pageSize} total={total} itemLabel="creatives" />
            </>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={`Review Queue`} hint="Creatives awaiting internal or provider review." />
          {reviewQueue.length === 0 ? (
            <EmptyState compact title="Nothing to review" description="Creatives under review or disapproved appear here." />
          ) : (
            <ul className="mt-3 space-y-2.5">
              {reviewQueue.slice(0, 4).map(row => (
                <li key={row.id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[12.5px] font-medium text-slate-800">{row.name}</p>
                    <StatusPill status={row.reviewStatus} map={REVIEW_STATUS} dot={false} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.campaignName ?? 'No campaign'}</p>
                  {row.providerFeedback && <p className="mt-1 text-[10.5px] text-red-600">{row.providerFeedback}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Top Performing Creatives" hint="Ranked by click-through rate for the selected period." />
        {topPerformers.length === 0 ? (
          <EmptyState compact title="No performance data yet" description="Top performers appear once creatives have spend and clicks." />
        ) : (
          <ol className="mt-3 space-y-2">
            {topPerformers.map((row, index) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10.5px] font-semibold text-slate-500">{index + 1}</span>
                  <span className="truncate font-medium text-slate-800">{row.name}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{FORMAT_LABELS[row.format] ?? row.format} · {row.provider}</span>
                </div>
                <span className="shrink-0 font-medium text-slate-700">{formatPercent(row.ctr)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}

function GridView({ rows, base }: { rows: CreativeListRow[]; base: string }) {
  if (rows.length === 0) return <div className="p-6"><EmptyState title="No creatives match these filters" description="Upload a creative or connect an account to sync creatives." /></div>
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-4">
      {rows.map(row => (
        <Link key={row.id} href={`${base}/creatives?q=${encodeURIComponent(row.name)}`} className="group rounded-lg border border-slate-200 p-2 hover:border-slate-300">
          <div className="flex items-center justify-between gap-1 text-[10.5px]">
            <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600"><ImageIcon size={10} />{FORMAT_LABELS[row.format] ?? row.format}</span>
            <ProviderLogo provider={row.provider} size={14} decorative />
          </div>
          <div className="mt-1.5 flex aspect-square items-center justify-center rounded-md bg-slate-100 text-slate-300"><ImageIcon size={26} /></div>
          <p className="mt-1.5 truncate text-[12px] font-medium text-slate-800">{row.name}</p>
          <p className="truncate text-[10.5px] text-slate-400">{row.campaignName ?? 'No campaign'}</p>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500">
            <span>{formatCurrency(row.spend, undefined, { compact: true })}</span>
            <span>{formatPercent(row.ctr)}</span>
          </div>
          <div className="mt-1"><StatusPill status={row.status} map={CAMPAIGN_STATUS} dot={false} /></div>
        </Link>
      ))}
    </div>
  )
}

function ReviewView({
  rows, canReview, workspaceId, workspaceType,
}: { rows: CreativeListRow[]; canReview: boolean; workspaceId: string; workspaceType: string }) {
  if (rows.length === 0) return <div className="p-6"><EmptyState title="Nothing waiting for review" description="Creatives under review or disapproved will appear here." /></div>
  return (
    <ul className="divide-y divide-slate-100 p-2">
      {rows.map(row => (
        <li key={row.id} className="flex items-start justify-between gap-4 p-2.5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-300"><ImageIcon size={16} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><ProviderLogo provider={row.provider} size={16} decorative /><p className="truncate text-[13px] font-medium text-slate-800">{row.name}</p></div>
              <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{row.campaignName ?? 'No campaign'}</p>
              {row.providerFeedback && <p className="mt-1 text-[11px] text-red-600">Platform feedback: {row.providerFeedback}</p>}
              <StatusPill status={row.reviewStatus} map={REVIEW_STATUS} className="mt-1.5" />
            </div>
          </div>
          {canReview ? (
            <ReviewCreativeButtons workspaceId={workspaceId} workspaceType={workspaceType} creativeId={row.id} />
          ) : (
            <span className="shrink-0 text-[11px] text-slate-400">View only</span>
          )}
        </li>
      ))}
    </ul>
  )
}
