import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, CheckCircle2, CircleDollarSign, Download, MousePointerClick, Percent, Receipt, RotateCw, Target, TrendingUp,
} from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { comparisonRange, kpi, resolveRange } from '@/lib/advertising/queries/shared'
import {
  getAudienceBreakdown, getRecentExports, getReportDashboard, getReportPresets, getScheduledReports, getSourceDetails, providerLabel,
} from '@/lib/advertising/queries/reports'
import { getTopPerformingCreatives } from '@/lib/advertising/queries/creatives'
import {
  ATTRIBUTION_WINDOWS, formatCurrency, formatDateRange, formatNumber, formatPercent, formatRelativeTime, formatRoas,
} from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS, providerColor } from '@/lib/advertising/providers'
import PageHeader from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import Sparkline from '../Sparkline'
import StatusPill, { AUDIENCE_TYPE_LABELS, FORMAT_LABELS, OBJECTIVE_LABELS } from '../StatusPill'
import { ChipSelect, ScrollRow, SegmentedParam } from '../MiniControls'
import { EmptyState, InfoDot, Panel } from '../Primitives'
import { ViewSwitcher } from '../Controls'
import { RANGE_PRESETS } from '@/lib/advertising/range-presets'
import TrendChart, { TrendLegend } from '../TrendChart'
import Donut from '../Donut'
import ExportSplit from '../ExportSplit'
import { CreateReportButton, PresetControls, ReportFilterBar, ScheduleReportButton } from '../client/ReportControls'

// /{type}/advertising/reports — built to design reference (6).
// Header + preset row, six KPI cards, the staged filter bar, the
// Dashboard / Table / Breakdown views, and Reports & Exports.

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

const BREAKDOWNS = [
  { value: 'platform', label: 'Platform' }, { value: 'objective', label: 'Campaign group' },
  { value: 'account', label: 'Account' }, { value: 'campaign', label: 'Campaign' },
] as const

function Title({ children, hint, action }: { children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold text-slate-900">{children}{hint && <InfoDot label={hint} />}</h2>
      {action}
    </div>
  )
}

export default async function ReportsPage({
  session, searchParams, nav,
}: { session: AdvertisingSession; searchParams: SearchParams; nav?: ReactNode }) {
  const range = resolveRange({ preset: first(searchParams.range) })
  const compare = comparisonRange(range, first(searchParams.compare))
  const base = session.basePath
  const workspaceId = session.workspace.id
  const view = ['table', 'breakdown'].includes(first(searchParams.view) ?? '') ? first(searchParams.view)! : 'dashboard'
  const platform = first(searchParams.platform)
  const attribution = first(searchParams.attribution)
  const group = first(searchParams.group)
  const grain = first(searchParams.grain) === 'weekly' ? 'weekly' : 'daily'
  const groupBy = (BREAKDOWNS.find(entry => entry.value === first(searchParams.groupBy))?.value ?? 'platform')
  const exportsTab = first(searchParams.exports) === 'scheduled' ? 'scheduled' : 'recent'

  const [dash, sources, presets, scheduled, exportsList, creatives, audienceBreakdown] = await Promise.all([
    getReportDashboard(session.supabase, workspaceId, { range, compare, providers: platform ? [platform] : [], objective: group, attributionWindow: attribution, grain }),
    getSourceDetails(session.supabase, workspaceId),
    getReportPresets(session.supabase, workspaceId),
    getScheduledReports(session.supabase, workspaceId),
    getRecentExports(session.supabase, workspaceId, 6),
    getTopPerformingCreatives(session.supabase, workspaceId, range, 6),
    getAudienceBreakdown(session.supabase, workspaceId, range),
  ])

  const canSchedule = session.capabilities['reports.schedule']
  const canExport = session.capabilities['reports.export']
  const canManage = session.capabilities['reports.manage_presets']
  const rangeLabel = formatDateRange(new Date(`${range.since}T00:00:00Z`), new Date(`${range.until}T00:00:00Z`))
  const compareLabel = formatDateRange(new Date(`${compare.since}T00:00:00Z`), new Date(`${compare.until}T00:00:00Z`))
  const exportHref = `/api/advertising/export?workspaceType=${session.workspaceType}&range=${first(searchParams.range) ?? 'last_30'}${platform ? `&platform=${platform}` : ''}`
  const { current: now, previous: before } = dash
  const convRateSpark = dash.spark.spend.map((point, index) => ({ date: point.date, value: dash.spark.ctr[index]?.value ?? 0 }))
  const staleSources = sources.filter(source => source.stale || source.status !== 'connected')
  const freshest = sources.map(source => source.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null

  const cards = [
    { value: kpi({ id: 'spend', label: 'Total Spend', format: 'currency', current: now.spend, previous: before.spend, spark: dash.spark.spend, tooltip: 'Spend for the selected filters.' }), icon: <CircleDollarSign />, accent: '#2563EB' },
    { value: kpi({ id: 'revenue', label: 'Revenue', format: 'currency', current: now.revenue, previous: before.revenue, spark: dash.spark.revenue, tooltip: 'Attributed revenue in the selected attribution window.' }), icon: <Receipt />, accent: '#7C3AED' },
    { value: kpi({ id: 'roas', label: 'ROAS (All)', format: 'roas', current: now.roas, previous: before.roas, spark: dash.spark.roas, tooltip: 'Revenue divided by spend.' }), icon: <TrendingUp />, accent: '#0D9488' },
    { value: kpi({ id: 'cpa', label: 'CPA (All)', format: 'currency', inverse: true, current: now.cpa, previous: before.cpa, spark: dash.spark.cpa, tooltip: 'Spend divided by conversions.' }), icon: <Target />, accent: '#EA580C' },
    { value: kpi({ id: 'ctr', label: 'CTR (All)', format: 'percent', current: now.ctr, previous: before.ctr, spark: dash.spark.ctr, tooltip: 'Clicks divided by impressions.' }), icon: <MousePointerClick />, accent: '#7C3AED' },
    { value: kpi({ id: 'conv', label: 'Conversion Rate', format: 'percent', current: now.conversionRate, previous: before.conversionRate, spark: convRateSpark, tooltip: 'Conversions divided by clicks.' }), icon: <Percent />, accent: '#0D9488' },
  ]

  const totalConversions = dash.byProvider.reduce((sum, row) => sum + row.conversions, 0)
  const totalSpend = dash.byProvider.reduce((sum, row) => sum + row.spend, 0)

  // Breakdown rows, grouped from the same campaign rows every other panel uses.
  const groups = new Map<string, { label: string; provider?: string; spend: number; conversions: number; revenue: number; clicks: number; impressions: number }>()
  for (const row of dash.campaignRows) {
    const key = groupBy === 'platform' ? row.provider : groupBy === 'objective' ? row.objective : groupBy === 'account' ? (row.accountName ?? 'Unknown') : row.id
    const label = groupBy === 'platform' ? providerLabel(row.provider) : groupBy === 'objective' ? (OBJECTIVE_LABELS[row.objective] ?? row.objective) : groupBy === 'account' ? (row.accountName ?? 'Unknown') : row.name
    const entry = groups.get(key) ?? { label, provider: groupBy === 'platform' || groupBy === 'campaign' ? row.provider : undefined, spend: 0, conversions: 0, revenue: 0, clicks: 0, impressions: 0 }
    entry.spend += row.spend; entry.conversions += row.conversions; entry.revenue += row.revenue; entry.clicks += row.clicks; entry.impressions += row.impressions
    groups.set(key, entry)
  }
  const breakdown = [...groups.values()].sort((a, b) => b.spend - a.spend)

  const campaignTable = (limit?: number) => {
    const rows = limit ? dash.campaignRows.slice(0, limit) : dash.campaignRows
    const sum = dash.campaignRows.reduce((acc, row) => ({ spend: acc.spend + row.spend, impressions: acc.impressions + row.impressions, clicks: acc.clicks + row.clicks, conversions: acc.conversions + row.conversions, revenue: acc.revenue + row.revenue }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })
    return rows.length === 0 ? <EmptyState compact title="No campaign data for these filters" description="Widen the date range, clear the platform or campaign group, or pick another attribution window." className="mt-3" /> : (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-[11px]">
          <caption className="sr-only">Campaign performance</caption>
          <thead>
            <tr className="border-b border-slate-100 text-[11.5px] text-slate-700">
              {['Campaign', 'Spend', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'CPA', 'Revenue', 'ROAS', 'Trend'].map(header => <th key={header} className="whitespace-nowrap px-1.5 py-2 font-semibold first:pl-0">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-slate-50/70">
                <td className="py-[5px] pr-2.5"><Link href={`${base}/campaigns/${row.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-blue-700"><ProviderLogo provider={row.provider} size={15} decorative /><span className="max-w-[130px] truncate" title={row.name}>{row.name}</span></Link></td>
                <td className="px-1.5 py-1 tabular-nums">{formatCurrency(row.spend)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatNumber(row.impressions)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatNumber(row.clicks)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatPercent(row.ctr)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatNumber(row.conversions)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatCurrency(row.cpa)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatCurrency(row.revenue)}</td>
                <td className="px-1.5 py-1 tabular-nums">{formatRoas(row.roas)}</td>
                <td className="w-12 px-1.5 py-[3px]"><Sparkline points={row.trend} color="#0D9488" height={18} width={44} summary={`${row.name} weekly spend trend`} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-800">
              <td className="py-[5px] pr-2.5">Total / Average</td>
              <td className="px-1.5 py-1 tabular-nums">{formatCurrency(sum.spend)}</td>
              <td className="px-1.5 py-1 tabular-nums">{formatNumber(sum.impressions)}</td>
              <td className="px-1.5 py-1 tabular-nums">{formatNumber(sum.clicks)}</td>
              {/* Averages are weighted (ratios of totals), never a mean of row ratios. */}
              <td className="px-1.5 py-1 tabular-nums">{formatPercent(sum.impressions ? (sum.clicks / sum.impressions) * 100 : null)}</td>
              <td className="px-1.5 py-1 tabular-nums">{formatNumber(sum.conversions)}</td>
              <td className="px-1.5 py-1 tabular-nums">{formatCurrency(sum.conversions ? sum.spend / sum.conversions : null)}</td>
              <td className="px-1.5 py-1 tabular-nums">{formatCurrency(sum.revenue)}</td>
              <td className="px-1.5 py-1 tabular-nums">{formatRoas(sum.spend ? sum.revenue / sum.spend : null)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Advertising Reports" hint="Measure paid-media performance in depth, with full source transparency."
        subtitle="Measure paid media performance in depth and export the insights that drive growth."
        className="mb-3"
      >
        <CreateReportButton exportHref={exportHref} disabledReason={canExport ? null : 'Your role cannot create or export reports.'} />
        <ScheduleReportButton workspaceId={workspaceId} workspaceType={session.workspaceType} presets={presets.map(preset => ({ id: preset.id, name: preset.name }))}
          disabledReason={canSchedule ? null : 'Scheduled reports are included from the Agency plan.'} />
        {canExport && <ExportSplit href={exportHref} primary="campaigns" />}
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">{nav}</div>
        <PresetControls workspaceId={workspaceId} workspaceType={session.workspaceType} canManage={canManage}
          presets={presets.map(preset => ({ id: preset.id, name: preset.name, isDefault: preset.isDefault, config: preset.config }))} />
      </div>

      <section className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Report metrics">
        {cards.map(card => <KpiCard key={card.value.id} kpi={card.value} icon={card.icon} accent={card.accent} comparisonLabel={compareLabel} />)}
      </section>

      <Panel className="mb-2 py-3">
        <ReportFilterBar fields={[
          { key: 'range', label: 'Date Range', allLabel: 'Last 30 days', options: RANGE_PRESETS.filter(preset => preset.value !== 'last_30') },
          { key: 'compare', label: 'Compare To', allLabel: `Previous period (${compareLabel})`, options: [{ value: 'year', label: 'Same period last year' }] },
          { key: 'platform', label: 'Platform', allLabel: 'All Platforms', options: AD_PROVIDER_IDS.map(id => ({ value: id, label: providerLabel(id) })) },
          { key: 'attribution', label: 'Attribution Window', allLabel: 'All windows', options: ATTRIBUTION_WINDOWS.map(entry => ({ value: entry.id, label: entry.label })) },
          { key: 'group', label: 'Campaign Group', allLabel: 'All Campaigns', options: Object.entries(OBJECTIVE_LABELS).map(([value, label]) => ({ value, label })) },
        ]} />
      </Panel>

      {(dash.integrity.mixedCurrency || dash.integrity.mixedWindow || staleSources.length > 0) && (
        <div role="note" className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
          <span>
            {dash.integrity.mixedCurrency && `Figures mix ${dash.integrity.currencies.join(', ')} without conversion. `}
            {dash.integrity.mixedWindow && 'Rows use different attribution windows; pick one window to compare like for like. '}
            {staleSources.length > 0 && `${staleSources.map(source => providerLabel(source.provider)).join(', ')} ${staleSources.length === 1 ? 'is' : 'are'} not current — their numbers may be incomplete.`}
          </span>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ViewSwitcher solid icons={false} defaultView="dashboard" views={[
          { value: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { value: 'table', label: 'Table', icon: 'table' }, { value: 'breakdown', label: 'Breakdown', icon: 'breakdown' },
        ]} />
        <div className="flex items-center gap-3 text-[12px] text-slate-500">
          <span className="flex items-center gap-1.5">Group By <ChipSelect paramKey="groupBy" label="Group by" allLabel="Platform" options={BREAKDOWNS.filter(entry => entry.value !== 'platform').map(entry => ({ value: entry.value, label: entry.label }))} /></span>
          <span className="flex items-center gap-1.5">View <ChipSelect paramKey="grain" label="Granularity" allLabel="Daily" options={[{ value: 'weekly', label: 'Weekly' }]} /></span>
        </div>
      </div>

      {view === 'table' ? (
        <Panel className="mb-2"><Title hint="Every campaign with spend in the selected filters.">Campaign Performance</Title>{campaignTable()}</Panel>
      ) : view === 'breakdown' ? (
        <Panel className="mb-2">
          <Title hint="Totals grouped by the Group By dimension. Ratios are recalculated from group totals.">Breakdown by {BREAKDOWNS.find(entry => entry.value === groupBy)?.label}</Title>
          {breakdown.length === 0 ? <EmptyState compact title="No data for these filters" description="Widen the filters to see a breakdown." className="mt-3" /> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead><tr className="border-b border-slate-100 text-[12px] text-slate-700">{['Name', 'Spend', 'Share', 'Conversions', 'CPA', 'Revenue', 'ROAS'].map(header => <th key={header} className="px-3 py-2 font-semibold first:pl-0">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {breakdown.map(row => (
                    <tr key={row.label}>
                      <td className="py-2 pr-3"><span className="flex items-center gap-2 font-medium text-slate-800">{row.provider && <ProviderLogo provider={row.provider} size={15} decorative />}{row.label}</span></td>
                      <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                      <td className="px-3 py-2"><span className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${totalSpend ? (row.spend / totalSpend) * 100 : 0}%` }} /></span><span className="tabular-nums text-slate-600">{totalSpend ? ((row.spend / totalSpend) * 100).toFixed(1) : '0.0'}%</span></span></td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.conversions)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatCurrency(row.conversions ? row.spend / row.conversions : null)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatCurrency(row.revenue)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatRoas(row.spend ? row.revenue / row.spend : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <>
          <div className="mb-2 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.95fr_0.95fr]">
            <Panel>
              <Title hint="Spend per day or week against the comparison period." action={<div className="min-w-0 [&>*]:mt-0 [&>*]:flex-nowrap [&>*]:gap-x-3 [&>*]:whitespace-nowrap [&>*]:text-[11px]"><TrendLegend current="Spend" comparison="Compare" /></div>}>Spend Trend</Title>
              <TrendChart className="mt-3" points={dash.spendTrend} comparison={dash.spendTrendCompare} format="currency" height={84} summary={`Spend ${grain} for ${rangeLabel} vs ${compareLabel}`} />
              <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[12px]"><span className="font-medium text-slate-700">Total Spend</span><span className="font-semibold tabular-nums">{formatCurrency(now.spend)}</span></p>
            </Panel>
            <Panel>
              <Title hint="ROAS per day or week, recalculated from totals in each bucket." action={<div className="min-w-0 [&>*]:mt-0 [&>*]:flex-nowrap [&>*]:gap-x-3 [&>*]:whitespace-nowrap [&>*]:text-[11px]"><TrendLegend current="ROAS" comparison="Compare" color="#0D9488" /></div>}>ROAS Trend</Title>
              <TrendChart className="mt-3" points={dash.roasTrend} comparison={dash.roasTrendCompare} format="roas" height={84} color="#0D9488" summary={`ROAS ${grain} for ${rangeLabel} vs ${compareLabel}`} />
              <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[12px]"><span className="font-medium text-slate-700">Average ROAS</span><span className="font-semibold tabular-nums">{formatRoas(now.roas)}</span></p>
            </Panel>
            <Panel>
              <Title>Conversions by Platform</Title>
              {totalConversions === 0 ? <EmptyState compact title="No conversions" description="Conversions appear once reported." className="mt-3" /> : (
                <Donut className="mt-4" stacked size={104} thickness={18} centerValue={formatNumber(totalConversions)} centerLabel="Conversions" summary="Conversions by platform"
                  slices={dash.byProvider.map(row => ({ key: row.provider, label: providerLabel(row.provider), value: row.conversions, color: providerColor(row.provider), detail: `${formatNumber(row.conversions)} (${((row.conversions / totalConversions) * 100).toFixed(1)}%)` }))} />
              )}
            </Panel>
            <Panel>
              <Title>Budget Distribution</Title>
              {totalSpend === 0 ? <EmptyState compact title="No spend" description="Spend distribution appears once spend syncs." className="mt-3" /> : (
                <Donut className="mt-4" stacked size={104} thickness={18} centerValue={formatCurrency(totalSpend, undefined, { compact: true })} centerLabel="Total Spend" summary="Spend by platform"
                  slices={dash.byProvider.map(row => ({ key: row.provider, label: providerLabel(row.provider), value: row.spend, color: providerColor(row.provider), detail: `${formatCurrency(row.spend, undefined, { compact: true })} (${((row.spend / totalSpend) * 100).toFixed(1)}%)` }))} />
              )}
            </Panel>
          </div>

          <div className="mb-2 grid gap-2 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <Panel><Title action={<Link href="?view=table" className="text-[12px] font-medium text-blue-600 hover:underline">View all</Link>}>Campaign Performance</Title>{campaignTable(5)}</Panel>
            <div className="flex min-w-0 flex-col gap-2">
              <Panel>
                <Title action={<Link href="?view=breakdown" className="text-[12px] font-medium text-blue-600 hover:underline">View all</Link>}>Platform Performance</Title>
                <table className="mt-3 w-full text-left text-[12px]">
                  <thead><tr className="text-[11.5px] text-slate-700">{['Platform', 'Spend', 'Conversions', 'CPA', 'ROAS'].map(header => <th key={header} className="pb-1.5 font-semibold">{header}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {dash.byProvider.map(row => (
                      <tr key={row.provider}>
                        <td className="py-1.5"><Link href={`?platform=${row.provider}`} className="flex items-center gap-1.5 hover:text-blue-700"><ProviderLogo provider={row.provider} size={15} decorative />{providerLabel(row.provider)}</Link></td>
                        <td className="py-1.5 tabular-nums">{formatCurrency(row.spend)}</td>
                        <td className="py-1.5 tabular-nums">{formatNumber(row.conversions)}</td>
                        <td className="py-1.5 tabular-nums">{formatCurrency(row.cpa)}</td>
                        <td className="py-1.5 tabular-nums">{formatRoas(row.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <Panel>
                <Title hint="Where these numbers come from, how fresh they are and in which currency and attribution window." action={freshest && <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />Last synced {formatRelativeTime(freshest)}</span>}>Source Transparency</Title>
                {sources.length === 0 ? <EmptyState compact title="No sources" description="Connect an account to report on it." className="mt-3" /> : (
                  <ul className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-5">
                    {sources.map(source => (
                      <li key={source.provider} className="min-w-0 rounded-lg border border-slate-200/80 px-1.5 py-1.5" title={`${source.currencies.join(', ') || '—'} · ${source.timezones.join(', ') || '—'} · ${attribution ? ATTRIBUTION_WINDOWS.find(entry => entry.id === attribution)?.label : 'All windows'}`}>
                        <p className="flex min-w-0 items-center gap-1 text-[11.5px] font-medium text-slate-800"><ProviderLogo provider={source.provider} size={13} decorative /><span className="truncate">{providerLabel(source.provider).replace(' Ads', '')}</span></p>
                        <p className={`mt-1 flex items-center gap-1 text-[10.5px] ${source.status === 'connected' && !source.stale ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {source.status === 'connected' && !source.stale ? <CheckCircle2 size={11} aria-hidden /> : <AlertTriangle size={11} aria-hidden />}
                          {source.status !== 'connected' ? (source.status === 'error' ? 'Error' : 'Attention') : source.stale ? 'Stale' : 'Connected'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
            <Panel>
              <Title action={<Link href={`${base}/creatives?sort=ctr_desc`} className="text-[12px] font-medium text-blue-600 hover:underline">View All</Link>}>Creative Performance</Title>
              {creatives.length === 0 ? <EmptyState compact title="No creative data" description="Creatives appear once they have clicks." className="mt-3" /> : (
                <ScrollRow label="top creatives" className="mt-3 gap-2.5">
                  {creatives.map(creative => (
                    <Link key={creative.id} href={`${base}/creatives/${creative.id}`} className="w-[96px] shrink-0 snap-start">
                      <div className="h-[76px] overflow-hidden rounded-lg bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {creative.thumbnailUrl && <img src={creative.thumbnailUrl} alt={`${creative.name} preview`} loading="lazy" className="h-full w-full object-cover" />}
                      </div>
                      <p className="mt-1.5 flex items-center gap-1 truncate text-[10.5px] text-slate-600"><ProviderLogo provider={creative.provider} size={11} decorative />{FORMAT_LABELS[creative.format] ?? creative.format}</p>
                      <p className="mt-0.5 grid grid-cols-2 text-[10px] text-slate-400"><span>Spend</span><span>CTR</span></p>
                      <p className="grid grid-cols-2 text-[11px] font-semibold tabular-nums text-slate-800"><span>{formatCurrency(creative.spend, undefined, { compact: true })}</span><span>{formatPercent(creative.ctr)}</span></p>
                    </Link>
                  ))}
                </ScrollRow>
              )}
            </Panel>
            <Panel>
              <Title action={<Link href={`${base}/audiences`} className="text-[12px] font-medium text-blue-600 hover:underline">View All</Link>}>Audience Breakdown</Title>
              {audienceBreakdown.length === 0 ? <EmptyState compact title="No audience data" description="Conversions by audience type appear once audiences deliver." className="mt-3" /> : (() => {
                const total = audienceBreakdown.reduce((sum, row) => sum + row.conversions, 0)
                const palette = ['#2563EB', '#22D3EE', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899']
                return (
                  <Donut className="mt-3" stacked size={104} thickness={18} centerValue={formatNumber(total)} centerLabel="Conversions" summary="Conversions by audience type"
                    slices={audienceBreakdown.slice(0, 5).map((row, index) => ({ key: row.type, label: AUDIENCE_TYPE_LABELS[row.type] ?? row.type, value: row.conversions, color: palette[index], detail: `${formatNumber(row.conversions)} (${total ? ((row.conversions / total) * 100).toFixed(1) : 0}%)` }))} />
                )
              })()}
            </Panel>
            <Panel>
              <Title>Reports &amp; Exports</Title>
              <SegmentedParam className="mt-3" paramKey="exports" defaultValue="recent" ariaLabel="Reports and exports" options={[{ value: 'recent', label: 'Recent Exports' }, { value: 'scheduled', label: `Scheduled Reports (${scheduled.length})` }]} />
              {exportsTab === 'recent' ? (
                exportsList.length === 0 ? <EmptyState compact title="No exports yet" description="Use Create Report or Export and it appears here." className="mt-3" /> : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {exportsList.map(entry => (
                      <li key={entry.id} className="flex items-center gap-2 py-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{entry.name}</span>
                        <span className={`shrink-0 text-[10.5px] font-semibold ${entry.format === 'pdf' ? 'text-red-600' : 'text-emerald-600'}`}>{entry.format.toUpperCase()}</span>
                        <span className="shrink-0 text-[10.5px] text-slate-400">{formatRelativeTime(entry.createdAt)}</span>
                        {entry.format === 'csv' && canExport ? (
                          <a href={`${exportHref}&dataset=campaigns&name=${encodeURIComponent(entry.name)}`} aria-label={`Download ${entry.name} again`} title="Regenerate and download" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Download size={14} /></a>
                        ) : <span className="rounded p-1 text-slate-300" title="Delivered by email when generated"><RotateCw size={14} aria-hidden /></span>}
                      </li>
                    ))}
                  </ul>
                )
              ) : scheduled.length === 0 ? <EmptyState compact title="No scheduled reports" description={canSchedule ? 'Use Schedule Report to email a report on a cadence.' : 'Scheduled reports are included from the Agency plan.'} className="mt-3" /> : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {scheduled.map(report => (
                    <li key={report.id} className="py-2 text-[12px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-800">{report.name}</span>
                        <StatusPill status={report.lastRunStatus === 'failed' ? 'failed' : report.enabled ? 'ready' : 'paused'} dot={false}
                          map={{ ready: { label: 'Active', tone: 'green' }, paused: { label: 'Paused', tone: 'slate' }, failed: { label: 'Failed', tone: 'red' } }} className="rounded-md px-1.5 text-[10.5px]" />
                      </div>
                      <p className="mt-0.5 text-[10.5px] capitalize text-slate-500">{report.cadence} · {report.format.toUpperCase()} · {report.recipients.length} recipient{report.recipients.length === 1 ? '' : 's'}{report.nextRunAt ? ` · next ${new Date(report.nextRunAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
