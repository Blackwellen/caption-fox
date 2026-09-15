import { FileBarChart2 } from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { resolveRange, previousRange, kpi } from '@/lib/advertising/queries/shared'
import {
  getReportsSummary, getCampaignReportTable, getPlatformPerformance, getSourceTransparency,
  getReportPresets, getScheduledReports, getRecentExports, providerLabel,
} from '@/lib/advertising/queries/reports'
import {
  formatCurrency, formatDateRange, formatNumber, formatPercent, formatRelativeTime, formatRoas,
} from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS, providerColor } from '@/lib/advertising/providers'
import { ATTRIBUTION_WINDOWS } from '@/lib/advertising/metrics'
import PageHeader, { type HeaderAction } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { HEALTH_STATUS } from '../StatusPill'
import { DateRangeSelect, ComparisonLabel, LabelledSelect, ViewSwitcher } from '../Controls'
import { EmptyState, Panel, PanelHeader } from '../Primitives'
import Sparkline from '../Sparkline'

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function ReportsPage({
  session, searchParams,
}: { session: AdvertisingSession; searchParams: Record<string, string | string[] | undefined> }) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const compare = previousRange(range)
  const view = firstParam(searchParams.view) ?? 'dashboard'
  const platformFilter = firstParam(searchParams.platform)
  const providers = platformFilter ? [platformFilter] : []

  const [summary, campaignTable, platformPerformance, sources, presets, scheduled, exports] = await Promise.all([
    getReportsSummary(session.supabase, session.workspace.id, range, providers),
    getCampaignReportTable(session.supabase, session.workspace.id, range, providers),
    getPlatformPerformance(session.supabase, session.workspace.id, range),
    getSourceTransparency(session.supabase, session.workspace.id),
    getReportPresets(session.supabase, session.workspace.id),
    session.capabilities['reports.schedule'] ? getScheduledReports(session.supabase, session.workspace.id) : Promise.resolve([]),
    getRecentExports(session.supabase, session.workspace.id),
  ])

  const canSchedule = session.capabilities['reports.schedule']
  const canExport = session.capabilities['reports.export']
  const canManagePresets = session.capabilities['reports.manage_presets']

  const kpis = [
    kpi({ id: 'spend', label: 'Total Spend', format: 'currency', current: summary.current.spend, previous: summary.previous.spend, spark: summary.spendSeries, tooltip: 'Total spend for the selected filters and range.' }),
    kpi({ id: 'revenue', label: 'Revenue', format: 'currency', current: summary.current.revenue, previous: summary.previous.revenue, spark: [], tooltip: 'Attributed revenue.' }),
    kpi({ id: 'roas', label: 'ROAS', format: 'roas', current: summary.current.roas, previous: summary.previous.roas, spark: summary.roasSeries, tooltip: 'Attributed revenue divided by spend.' }),
    kpi({ id: 'cpa', label: 'CPA', format: 'currency', inverse: true, current: summary.current.cpa, previous: summary.previous.cpa, spark: [], tooltip: 'Spend divided by conversions.' }),
    kpi({ id: 'ctr', label: 'CTR', format: 'percent', current: summary.current.ctr, previous: summary.previous.ctr, spark: [], tooltip: 'Clicks divided by impressions.' }),
    kpi({ id: 'conv_rate', label: 'Conversion Rate', format: 'percent', current: summary.current.conversionRate, previous: summary.previous.conversionRate, spark: [], tooltip: 'Conversions divided by clicks.' }),
  ]

  const actions: HeaderAction[] = [
    { key: 'create', label: 'Create Report', variant: 'primary', disabledReason: canManagePresets ? null : null },
    { key: 'schedule', label: 'Schedule Report', disabledReason: canSchedule ? null : 'Scheduled reports are included from the Agency plan.' },
    { key: 'export', label: 'Export', disabledReason: canExport ? null : 'Your role cannot export reports.' },
  ]

  const totalConversionsForDonut = summary.conversionsByProvider.reduce((sum, row) => sum + row.conversions, 0) || 1
  const totalSpendForDonut = summary.spendByProvider.reduce((sum, row) => sum + row.spend, 0) || 1

  return (
    <div>
      <PageHeader title="Advertising Reports" hint="Measure paid-media performance in depth, with full source transparency." subtitle="Measure paid media performance in depth and export the insights that drive growth." actions={actions}>
        {presets.length > 0 && (
          <LabelledSelect paramKey="preset" label="Saved preset" options={presets.map(preset => ({ value: preset.id, label: preset.name }))} className="w-40" />
        )}
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((value, index) => (
          <KpiCard key={value.id} kpi={value} icon={<FileBarChart2 size={13} />} accent={['#2563EB', '#7C3AED', '#0D9488', '#DC2626', '#4F46E5', '#EA580C'][index]} comparisonLabel={compare.label} />
        ))}
      </section>

      <Panel className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">Date Range</p>
            <DateRangeSelect currentLabel={formatDateRange(new Date(range.since), new Date(range.until))} className="w-44" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">Compare To</p>
            <ComparisonLabel label={formatDateRange(new Date(compare.since), new Date(compare.until))} />
          </div>
          <LabelledSelect paramKey="platform" label="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: id }))} className="w-36" />
          <LabelledSelect paramKey="attribution" label="Attribution Window" options={ATTRIBUTION_WINDOWS.map(w => ({ value: w.id, label: w.label }))} className="w-44" />
          <div className="ml-auto"><ViewSwitcher defaultView="dashboard" views={[
            { value: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
            { value: 'table', label: 'Table', icon: 'table' },
            { value: 'breakdown', label: 'Breakdown', icon: 'breakdown' },
          ]} /></div>
        </div>
      </Panel>

      {view === 'table' ? (
        <ReportTable rows={campaignTable} />
      ) : view === 'breakdown' ? (
        <BreakdownView rows={platformPerformance} />
      ) : (
        <>
          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <Panel>
              <PanelHeader title="Spend Trend" />
              <p className="mt-1 text-[13px] text-slate-500">Total Spend <span className="font-semibold text-slate-800">{formatCurrency(summary.current.spend)}</span></p>
              <div className="mt-2 h-40"><Sparkline points={summary.spendSeries} color="#2563EB" height={160} fill strokeWidth={2} summary="Spend trend" /></div>
            </Panel>
            <Panel>
              <PanelHeader title="ROAS Trend" />
              <p className="mt-1 text-[13px] text-slate-500">Average ROAS <span className="font-semibold text-slate-800">{formatRoas(summary.current.roas)}</span></p>
              <div className="mt-2 h-40"><Sparkline points={summary.roasSeries} color="#0D9488" height={160} fill strokeWidth={2} summary="ROAS trend" /></div>
            </Panel>
          </div>

          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <Panel>
              <PanelHeader title="Conversions by Platform" />
              <DonutList
                rows={summary.conversionsByProvider.map(row => ({ label: providerLabel(row.provider), value: row.conversions, provider: row.provider }))}
                total={totalConversionsForDonut} centerLabel="Total Conversions"
                centerValue={formatNumber(summary.conversionsByProvider.reduce((sum, row) => sum + row.conversions, 0), { compact: true })}
              />
            </Panel>
            <Panel>
              <PanelHeader title="Budget Distribution" />
              <DonutList
                rows={summary.spendByProvider.map(row => ({ label: providerLabel(row.provider), value: row.spend, provider: row.provider }))}
                total={totalSpendForDonut} centerLabel="Total Spend"
                centerValue={formatCurrency(summary.spendByProvider.reduce((sum, row) => sum + row.spend, 0), undefined, { compact: true })}
              />
            </Panel>
          </div>

          <Panel padded={false} className="mb-4">
            <div className="p-4 pb-0"><PanelHeader title="Campaign Performance" /></div>
            <ReportTable rows={campaignTable.slice(0, 8)} compact />
          </Panel>

          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <Panel>
              <PanelHeader title="Platform Performance" actionLabel="View All" />
              {platformPerformance.length === 0 ? <EmptyState compact title="No spend yet" description="Platform performance appears once spend is synced." /> : (
                <table className="mt-3 w-full text-left text-[12.5px]">
                  <thead><tr className="text-[10.5px] uppercase tracking-wide text-slate-400"><th className="pb-1.5 font-medium">Platform</th><th className="pb-1.5 text-right font-medium">Spend</th><th className="pb-1.5 text-right font-medium">Conversions</th><th className="pb-1.5 text-right font-medium">CPA</th><th className="pb-1.5 text-right font-medium">ROAS</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {platformPerformance.map(row => (
                      <tr key={row.provider}>
                        <td className="py-2"><span className="flex items-center gap-1.5"><ProviderLogo provider={row.provider} size={16} />{providerLabel(row.provider)}</span></td>
                        <td className="py-2 text-right tabular-nums">{formatCurrency(row.spend)}</td>
                        <td className="py-2 text-right tabular-nums">{formatNumber(row.conversions)}</td>
                        <td className="py-2 text-right tabular-nums">{formatCurrency(row.cpa)}</td>
                        <td className="py-2 text-right tabular-nums">{formatRoas(row.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="mt-4 border-t border-slate-100 pt-3">
                <PanelHeader title="Source Transparency" hint="Which platforms this data comes from and how fresh it is." />
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  {sources.map(source => (
                    <li key={source.provider} className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5 text-[11px]">
                      <span className="flex items-center gap-1.5"><ProviderLogo provider={source.provider} size={14} />{providerLabel(source.provider)}</span>
                      <StatusPill status={source.connected ? 'connected' : 'disconnected'} map={HEALTH_STATUS} dot={false} label={source.connected ? 'Connected' : 'Not connected'} />
                    </li>
                  ))}
                </ul>
                {sources.length > 0 && (
                  <p className="mt-2 text-[10.5px] text-slate-400">Last synced {formatRelativeTime(sources.find(s => s.lastSyncedAt)?.lastSyncedAt)}</p>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Reports & Exports" />
              <div className="mt-2 flex gap-4 border-b border-slate-100 text-[12.5px]">
                <span className="border-b-2 border-blue-600 px-1 pb-2 font-medium text-blue-700">Recent Exports</span>
                {canSchedule && <span className="px-1 pb-2 text-slate-500">Scheduled Reports {scheduled.length > 0 && `(${scheduled.length})`}</span>}
              </div>
              {exports.length === 0 ? (
                <EmptyState compact title="No exports yet" description="Exports you request appear here." className="mt-3" />
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {exports.map(entry => (
                    <li key={entry.id} className="flex items-center justify-between py-2 text-[12px]">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{entry.name}</p>
                        <p className="text-[10.5px] text-slate-400">{formatRelativeTime(entry.createdAt)}</p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">{entry.format.toUpperCase()}</span>
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

function ReportTable({ rows, compact }: { rows: Awaited<ReturnType<typeof getCampaignReportTable>>; compact?: boolean }) {
  if (rows.length === 0) return <div className={compact ? 'p-4' : ''}><EmptyState title="No campaign data for this range" description="Try widening the date range or clearing the platform filter." /></div>
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0)
  const totalConversions = rows.reduce((sum, row) => sum + row.conversions, 0)
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[12.5px]">
        <thead>
          <tr className="border-y border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2 font-medium">Campaign</th>
            <th className="px-3 py-2 text-right font-medium">Spend</th>
            <th className="px-3 py-2 text-right font-medium">Impressions</th>
            <th className="px-3 py-2 text-right font-medium">Clicks</th>
            <th className="px-3 py-2 text-right font-medium">CTR</th>
            <th className="px-3 py-2 text-right font-medium">Conversions</th>
            <th className="px-3 py-2 text-right font-medium">CPA</th>
            <th className="px-3 py-2 text-right font-medium">Revenue</th>
            <th className="px-3 py-2 text-right font-medium">ROAS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(row => (
            <tr key={row.id} className="hover:bg-slate-50/70">
              <td className="px-4 py-2.5"><span className="flex items-center gap-1.5 font-medium text-slate-800"><ProviderLogo provider={row.provider} size={14} decorative />{row.name}</span></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.spend)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.impressions, { compact: true })}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.clicks)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(row.ctr)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.conversions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.cpa)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.revenue)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRoas(row.roas)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold text-slate-700">
            <td className="px-4 py-2">Total / Average</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalSpend)}</td>
            <td className="px-3 py-2 text-right tabular-nums">—</td>
            <td className="px-3 py-2 text-right tabular-nums">—</td>
            <td className="px-3 py-2 text-right tabular-nums">—</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totalConversions)}</td>
            <td className="px-3 py-2 text-right tabular-nums">—</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalRevenue)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{totalSpend > 0 ? formatRoas(totalRevenue / totalSpend) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function BreakdownView({ rows }: { rows: Awaited<ReturnType<typeof getPlatformPerformance>> }) {
  if (rows.length === 0) return <Panel><EmptyState title="No breakdown data yet" description="Connect an account and sync to see a platform breakdown." /></Panel>
  return (
    <Panel padded={false}>
      <div className="p-4 pb-0"><PanelHeader title="Breakdown by Platform" /></div>
      <table className="mt-3 w-full text-left text-[12.5px]">
        <thead><tr className="border-y border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><th className="px-4 py-2 font-medium">Platform</th><th className="px-3 py-2 text-right font-medium">Spend</th><th className="px-3 py-2 text-right font-medium">Conversions</th><th className="px-3 py-2 text-right font-medium">CPA</th><th className="px-3 py-2 text-right font-medium">ROAS</th></tr></thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(row => (
            <tr key={row.provider}>
              <td className="px-4 py-2.5"><span className="flex items-center gap-1.5 font-medium text-slate-800"><ProviderLogo provider={row.provider} size={16} />{providerLabel(row.provider)}</span></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.spend)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.conversions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(row.cpa)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatRoas(row.roas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function DonutList({
  rows, total, centerLabel, centerValue,
}: { rows: { label: string; value: number; provider: string }[]; total: number; centerLabel: string; centerValue: string }) {
  if (rows.length === 0) return <EmptyState compact title="No data yet" description="This chart fills in once spend or conversions are synced." className="mt-3" />
  return (
    <div className="mt-3 flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: conicGradient(rows, total) }}>
        <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-full bg-white text-center">
          <p className="text-[15px] font-bold text-slate-900">{centerValue}</p>
          <p className="text-[9px] text-slate-400">{centerLabel}</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map(row => (
          <li key={row.provider} className="flex items-center justify-between gap-2 text-[11.5px]">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: providerColor(row.provider) }} aria-hidden />{row.label}</span>
            <span className="shrink-0 font-medium text-slate-800">{((row.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function conicGradient(rows: { value: number; provider: string }[], total: number): string {
  let cursor = 0
  const stops = rows.map(row => {
    const start = (cursor / total) * 360
    cursor += row.value
    const end = (cursor / total) * 360
    return `${providerColor(row.provider)} ${start}deg ${end}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
}
