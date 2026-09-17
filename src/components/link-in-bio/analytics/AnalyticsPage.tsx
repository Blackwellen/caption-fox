import Link from 'next/link'
import { ArrowDown, ArrowUp, BarChart3, CalendarClock, CircleDollarSign, FilePlus2, Library, Link2, Sparkles, Target, TrendingUp, TriangleAlert, Users, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DomainLogo } from '@/components/brand/BrandLogo'
import { compact, dateTime, integer, percent, pounds } from '@/lib/link-in-bio/format'
import { linkDenialMessage } from '@/lib/link-in-bio/entitlements'
import { loadAnalytics, RANGE_OPTIONS, type Params } from '@/lib/link-in-bio/server/collections'
import { loadSavedViews } from '@/lib/link-in-bio/server/views'
import type { LinksSession } from '@/lib/link-in-bio/server/context'
import { CopyText, ExportButton, LinksTabs, Menu } from '../client'
import { FilterSelect, PaginationBar, SavedViewsSelect } from '../controls'
import { DualLineChart, Donut, HorizontalBars } from '../charts'
import PageThumb from '../PageThumb'
import { EmptyState, ErrorNote, formatKpi, KpiCell, KpiStrip, PageHeading, Panel, PanelTitle, StatusBadge, TextLink, buttonClass } from '../ui'

const DEVICE_COLORS: Record<string, string> = { mobile: '#1a5cff', desktop: '#8b5cf6', tablet: '#2dd4bf', other: '#334155' }
const SOURCE_COLORS: Record<string, string> = { social: '#1a5cff', direct: '#8b5cf6', search: '#22c55e', email: '#f59e0b', referral: '#fb923c' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AnalyticsPage({ session, searchParams }: { session: LinksSession; searchParams: Params }) {
  const base = session.basePath
  if (!session.capabilities['analytics.view']) {
    return <EmptyState title="Analytics are not available for your role" description="Ask a workspace admin for Link in Bio analytics access." />
  }
  const [data, views] = await Promise.all([loadAnalytics(session, searchParams), loadSavedViews(session, 'analytics')])
  const totalDeviceClicks = data.devices.reduce((s, d) => s + d.clicks, 0)
  const totalSourceClicks = data.sources.reduce((s, d) => s + d.clicks, 0)
  const referrerTotal = data.funnel.clicks || 1
  const f = data.funnel
  const funnelRows = [
    { label: 'Page views', value: integer(f.views), rate: null as string | null, width: 100 },
    { label: 'Clicks', value: integer(f.clicks), rate: f.views ? percent((f.clicks / f.views) * 100, 2) : null, width: 82 },
    { label: 'Conversions', value: integer(f.conversions), rate: f.clicks ? percent((f.conversions / f.clicks) * 100, 1) : null, width: 64 },
    ...(data.revenueAllowed ? [{ label: 'Revenue influenced', value: pounds(f.revenuePence), rate: null, width: 50 }] : []),
  ]

  return (
    <div>
      <PageHeading
        crumbs={[{ label: session.workspace.name, href: `/${session.workspaceType}` }, { label: 'Link in Bio', href: base }, { label: 'Analytics' }]}
        title="Link Analytics"
        subtitle="Track click performance, conversion outcomes, traffic sources, and page effectiveness."
        actions={
          <>
            <ExportButton workspaceType={session.workspaceType} kind="analytics" label="Export report" disabledReason={linkDenialMessage(session.context, 'export')} />
            <CopyText value={`${base}/analytics`} label="Copy a link to this dashboard" className={buttonClass.secondary}><Users size={14} aria-hidden /> Share dashboard</CopyText>
            <Menu label="More analytics actions" items={[
              { label: 'Open Link Library', href: `${base}/library` },
              { label: 'Reusable link analytics', href: `${base}/library?type=reusable_link&sort=clicks` },
            ]} />
          </>
        }
      >
        <div className="mt-3.5"><LinksTabs basePath={base} /></div>
      </PageHeading>

      <KpiStrip>
        <KpiCell label="Total clicks" value={formatKpi(data.kpis.clicks, 'compact')} kpi={data.kpis.clicks} icon={<BarChart3 />} tone="blue" />
        <KpiCell label="Unique visitors" value={formatKpi(data.kpis.uniques, 'compact')} kpi={data.kpis.uniques} icon={<Users />} tone="purple" />
        <KpiCell label="Avg CTR" value={formatKpi(data.kpis.ctr, 'percent')} kpi={data.kpis.ctr} icon={<TrendingUp />} tone="green" />
        <KpiCell label="Conversions" value={formatKpi(data.kpis.conversions, 'integer')} kpi={data.kpis.conversions} icon={<Target />} tone="indigo" />
        <KpiCell label="Revenue influenced" value={data.revenueAllowed ? formatKpi(data.kpis.revenue, 'pounds') : 'Team plan'} kpi={data.revenueAllowed ? data.kpis.revenue : { ...data.kpis.revenue, caption: 'Upgrade to see attributed revenue' }} icon={<CircleDollarSign />} tone="orange" href={data.revenueAllowed ? undefined : `/${session.workspaceType}/settings/billing`} />
        <KpiCell label="Links with drop-off" value={formatKpi(data.kpis.dropoff, 'integer')} kpi={data.kpis.dropoff} icon={<TriangleAlert />} tone="red" inverse />
      </KpiStrip>

      {data.error && <div className="mt-3"><ErrorNote /></div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_252px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end gap-2.5">
            <FilterSelect paramKey="range" label="Date range" allLabel={searchParams.range ? 'Last 28 days' : data.rangeLabel} icon="calendar" className="w-full sm:w-[152px]" options={RANGE_OPTIONS.filter(r => r.value !== 'last_28').map(r => ({ value: r.value, label: r.label }))} />
            <FilterSelect paramKey="owner" label="Owner" allLabel="Owner  All" className="w-[calc(50%-5px)] sm:w-[98px]" options={data.owners.map(o => ({ value: o.id, label: o.name }))} />
            <FilterSelect paramKey="kind" label="Page type" allLabel="Page type  All" className="w-[calc(50%-5px)] sm:w-[114px]" options={[{ value: 'link_page', label: 'Link page' }, { value: 'conversion_page', label: 'Conversion page' }]} />
            <FilterSelect paramKey="theme" label="Theme" allLabel="Theme  All" className="w-[calc(50%-5px)] sm:w-[94px]" options={data.themes.map(t => ({ value: t.id, label: t.name }))} />
            <FilterSelect paramKey="source" label="Traffic source" className="w-[calc(50%-5px)] sm:w-[118px]" options={['social', 'direct', 'search', 'email', 'referral'].map(s => ({ value: s, label: cap(s) }))} />
            <SavedViewsSelect scope="analytics" views={views} workspaceType={session.workspaceType} className="w-[112px]" />
            <div className="ml-auto flex h-10 min-w-[146px] flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]" title="Metrics are compared with the equivalent period immediately before the selected range">
              <span className="text-[9.5px] text-slate-500">Compare period</span>
              <span className="text-[11.5px] text-slate-800">{data.compareLabel}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <Panel className="p-4" aria-label="Clicks and unique visitors over time">
              <div id="clicks-chart" className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-slate-900">Clicks &amp; unique visitors over time</h2>
                <span className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-[11px] text-slate-600">Daily</span>
              </div>
              <div className="mt-2 flex gap-4 text-[10.5px] text-slate-600">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#1a5cff]" />Clicks</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />Unique visitors</span>
              </div>
              <div className="mt-2">
                {data.daily.some(d => d.clicks || d.uniques)
                  ? <DualLineChart points={data.daily.map(d => ({ day: d.day, a: d.clicks, b: d.uniques }))} labelA="Clicks" labelB="Unique visitors" summary={`Daily clicks and unique visitors from ${data.rangeLabel}. Total clicks ${integer(f.clicks)}.`} />
                  : <EmptyState title="No traffic in this period" description="Clicks will appear here once visitors use your pages." className="py-8" />}
              </div>
            </Panel>
            <Panel className="p-4">
              <PanelTitle title="Top performing pages" action={<span className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-[11px] text-slate-600">By clicks</span>} />
              <div className="mt-5">
                {data.topPages.length
                  ? <HorizontalBars rows={data.topPages.map(p => ({ label: p.title, value: p.clicks, href: `${base}/pages/${p.id}/analytics` }))} summary={`Top pages by clicks: ${data.topPages.map(p => `${p.title} ${p.clicks}`).join(', ')}`} />
                  : <p className="text-[12px] text-slate-500">No page clicks in this period.</p>}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Panel className="p-4">
              <PanelTitle title="Clicks by device" />
              <div className="mt-3">
                <Donut centerValue={compact(totalDeviceClicks)} centerLabel="Total clicks" summary={`Clicks by device: ${data.devices.map(d => `${d.device} ${d.clicks}`).join(', ')}`}
                  segments={['mobile', 'desktop', 'tablet', 'other'].map(key => ({ label: cap(key), value: data.devices.find(d => d.device === key)?.clicks ?? 0, color: DEVICE_COLORS[key] }))} />
              </div>
            </Panel>
            <Panel className="p-4">
              <PanelTitle title="Traffic source mix" />
              <div className="mt-3">
                <Donut centerValue={compact(totalSourceClicks)} centerLabel="Total clicks" summary={`Clicks by traffic source: ${data.sources.map(s => `${s.source} ${s.clicks}`).join(', ')}`}
                  segments={['social', 'direct', 'search', 'email', 'referral'].map(key => ({ label: cap(key), value: data.sources.find(s => s.source === key)?.clicks ?? 0, color: SOURCE_COLORS[key] }))} />
              </div>
            </Panel>
            <Panel className="p-4 md:col-span-2 lg:col-span-1">
              <PanelTitle title="Conversion funnel" />
              <ol className="mt-3 space-y-1.5" aria-label="Conversion funnel">
                {funnelRows.map((row, i) => (
                  <li key={row.label}>
                    {row.rate && i > 0 && <p className="mb-0.5 pl-[54%] text-[9.5px] text-slate-500">{row.rate}</p>}
                    <div className="grid grid-cols-[52%_1fr] items-center gap-2 text-[10.5px]">
                      <span className="flex h-6 items-center whitespace-nowrap rounded-sm bg-blue-100/70 px-2 text-slate-700" style={{ width: `${Math.max(row.width, 78)}%`, clipPath: 'polygon(0 0, 100% 0, 94% 100%, 0 100%)' }}>{row.label}</span>
                      <span className="font-medium text-slate-900 tabular-nums">{row.value}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <Panel>
            <div className="flex items-center justify-between px-4 pt-3.5">
              <h2 className="text-[13px] font-semibold text-slate-900">Top links &amp; pages</h2>
              <TextLink href={`${base}/library?view=table&sort=clicks`}>View all in library</TextLink>
            </div>
            {data.rows.length === 0 ? <div className="p-4"><EmptyState title="No page activity" description="Pages appear here once they receive clicks in the selected period." /></div> : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-[11px]">
                  <thead className="border-y border-slate-100 bg-slate-50/50 text-[10px] text-slate-500">
                    <tr>
                      {['Rank', 'Link / Page', 'Type', 'Theme', 'Clicks', 'CTR', 'Conversions', 'Conversion rate', ...(data.revenueAllowed ? ['Revenue'] : []), 'Status', ''].map(h => (
                        <th key={h} scope="col" className={cn('px-3 py-2 font-medium', ['Clicks', 'CTR', 'Conversions', 'Conversion rate', 'Revenue'].includes(h) && 'text-right')}>{h || <span className="sr-only">Actions</span>}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-slate-600">{row.rank}</td>
                        <td className="px-3 py-2">
                          <Link href={row.href} className="flex items-center gap-2.5">
                            <PageThumb thumb={row.thumb} size="row" className="h-7 w-7 shrink-0" />
                            <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{row.title}</span><span className="block truncate text-[10px] text-slate-500">{row.url}</span></span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{row.kind === 'conversion_page' ? 'Conversion Page' : 'Link Page'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.themeName ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{integer(row.clicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{percent(row.ctr, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{integer(row.conversions)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{percent(row.convRate, 2)}</td>
                        {data.revenueAllowed && <td className="px-3 py-2 text-right tabular-nums">{pounds(row.revenuePence)}</td>}
                        <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                        <td className="px-3 py-2"><Menu label={`Actions for ${row.title}`} items={[{ label: 'Page analytics', href: row.href }, { label: 'Open page editor', href: row.href.replace('/analytics', '/design') }, { label: 'Open live page', href: row.url, external: true }]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.total > 0 && <PaginationBar className="px-4 py-3" page={data.page} pageSize={data.pageSize} total={data.total} sizes={[5, 10, 25]} />}
          </Panel>
        </div>

        <aside className="space-y-3.5" aria-label="Analytics insights">
          <Panel className="p-4">
            <PanelTitle title={<span className="flex items-center gap-1.5"><Sparkles size={13} className="text-[#1a5cff]" aria-hidden />Insights <span className="rounded bg-violet-50 px-1.5 text-[9px] font-semibold text-violet-600">AUTO</span></span>} />
            <p className="mt-1 text-[9.5px] text-slate-500">Calculated from your analytics for this period.</p>
            {data.insights.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">Not enough data for insights yet.</p> : (
              <ul className="mt-3 space-y-3.5">
                {data.insights.map(insight => (
                  <li key={insight.id} className="flex gap-2.5">
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', insight.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : insight.tone === 'purple' ? 'bg-violet-50 text-violet-600' : 'bg-orange-50 text-orange-500')} aria-hidden>
                      {insight.tone === 'success' ? <TrendingUp size={14} /> : insight.tone === 'purple' ? <Zap size={14} /> : <TriangleAlert size={14} />}
                    </span>
                    <div className="min-w-0 text-[10.5px] leading-snug">
                      <p className="font-semibold text-slate-900">{insight.title}</p>
                      <p className="mt-0.5 text-slate-500">{insight.detail}</p>
                      <Link href={insight.href} className="mt-1 inline-block font-medium text-[#1a5cff] hover:underline">{insight.hrefLabel} →</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <PanelTitle title="Top referrers" />
            {data.referrers.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">No referrer data yet.</p> : (
              <ul className="mt-3 space-y-2.5">
                {data.referrers.map(ref => (
                  <li key={ref.host} className="flex items-center justify-between gap-2 text-[10.5px]">
                    <span className="flex min-w-0 items-center gap-2 text-slate-700"><DomainLogo domain={ref.host} size={14} /><span className="truncate">{ref.host}</span></span>
                    <span className="shrink-0 text-slate-600 tabular-nums">{compact(ref.clicks)} ({((ref.clicks / referrerTotal) * 100).toFixed(1)}%)</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <PanelTitle title="Recent anomalies" />
            {data.anomalies.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">No anomalies detected in this period.</p> : (
              <ul className="mt-3 space-y-3">
                {data.anomalies.map(a => (
                  <li key={a.id} className="flex gap-2.5 text-[10.5px] leading-snug">
                    <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', a.tone === 'danger' ? 'text-red-500' : a.tone === 'warning' ? 'text-orange-500' : 'text-emerald-600')} aria-hidden>
                      {a.tone === 'success' ? <ArrowUp size={14} /> : a.tone === 'danger' ? <ArrowDown size={14} /> : <TriangleAlert size={13} />}
                    </span>
                    <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{a.title}</p><p className="text-slate-500">{a.detail}</p></div>
                    <time className="shrink-0 text-[9.5px] text-slate-500" dateTime={a.at}>{dateTime(a.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <PanelTitle title="Quick actions" />
            <ul className="mt-3 space-y-1">
              {[
                { label: 'Create new link page', href: `${base}/new`, icon: <FilePlus2 size={15} /> },
                { label: 'View link library', href: `${base}/library`, icon: <Library size={15} /> },
                { label: 'Compare last 7 days', href: `${base}/analytics?range=last_7`, icon: <CalendarClock size={15} /> },
                { label: 'Manage UTM links', href: `${base}/library?type=reusable_link`, icon: <Link2 size={15} /> },
              ].map(item => (
                <li key={item.label}><Link href={item.href} className="flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[10.5px] text-slate-700 hover:bg-slate-50 hover:text-[#1a5cff]"><span className="text-[#1a5cff]" aria-hidden>{item.icon}</span>{item.label}</Link></li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
