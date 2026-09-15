import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireWebModule } from '@/lib/web/server'
import {
  computeExperimentStats, listExperiments, listFunnels, listPages, listTrackingEvents,
  listWebExperiences, metricSeries, recentActivity, webAggregates, workspaceMembers,
} from '@/lib/web/data'
import { parseWebQuery, type RawParams, type WebQuery } from '@/lib/web/query'
import {
  DEVICE_LABELS, EXPERIMENT_STATUS_BADGE, EXPERIMENT_STATUS_LABELS, FORM_STATUSES, FUNNEL_STATUSES,
  PAGE_STATUSES, TRACKING_HEALTH_STATUSES, TRAFFIC_SOURCE_LABELS,
} from '@/lib/web/constants'
import WebHeader from '@/components/web/WebHeader'
import KpiStrip from '@/components/web/KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import ActivityFeed from '@/components/web/ActivityFeed'
import WebExperiencesTable from '@/components/web/WebExperiencesTable'
import WebExperienceCards from '@/components/web/WebExperienceCards'
import { NewFormButton, NewFunnelButton, NewPageButton, ImportButton, ExportButton, HeaderOverflow } from '@/components/web/ActionButtons'
import { AccessBlocked } from '@/components/web/states'
import { Panel, WEB_PAGE, formatCompactNumber, formatPercentValue, formatSignedPercent } from '@/components/web/primitives'
import { Badge } from '@/components/ui/Badge'
import { ChartLegend, DonutChart, DonutLegend, TrendChart, type DonutSlice, type TrendSeries } from '@/components/campaigns/charts'
import type { KpiValue } from '@/lib/web/types'

export const metadata = {
  title: 'Web and Conversion · Caption Fox',
  description: 'Manage conversion experiences, pages, forms, funnels, experiments and tracking across your workspace.',
}

const TREND_SERIES: TrendSeries[] = [
  { key: 'sessions', label: 'Sessions', colour: '#2563eb' },
  { key: 'conversions', label: 'Conversions', colour: '#34d399' },
]

const SOURCE_COLOURS: Record<string, string> = {
  organic_search: '#2563eb', paid_search: '#f59e0b', direct: '#64748b', social: '#8b5cf6', referral: '#0ea5e9', other: '#94a3b8',
}
const DEVICE_COLOURS: Record<string, string> = { desktop: '#2563eb', mobile: '#34d399', tablet: '#f59e0b' }

export default async function WebOverviewPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireWebModule('overview')

  if (!access.allowed) {
    return (
      <div className={WEB_PAGE}>
        <WebHeader module="overview" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseWebQuery(params)
  const to = query.to || new Date().toISOString().slice(0, 10)
  const from = query.from || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)
  const emptyQuery: WebQuery = { q: '', status: '', owner: '', type: '', channel: '', from: '', to: '', archived: false, view: 'cards', page: 1 }

  const [
    aggregates, series, experiences, activity, members,
    topPages, topFunnels, topExperiments, trackingEvents,
  ] = await Promise.all([
    webAggregates(supabase, ctx.workspaceId),
    metricSeries(supabase, ctx.workspaceId, from, to),
    listWebExperiences(supabase, ctx.workspaceId, query),
    recentActivity(supabase, ctx.workspaceId, { limit: 6 }),
    workspaceMembers(supabase, ctx.workspaceId),
    listPages(supabase, ctx.workspaceId, { ...emptyQuery, status: 'published' }, { limit: 5 }),
    listFunnels(supabase, ctx.workspaceId, emptyQuery, { limit: 3, withSteps: true }),
    listExperiments(supabase, ctx.workspaceId, emptyQuery, { limit: 4 }),
    listTrackingEvents(supabase, ctx.workspaceId, emptyQuery, { limit: 6 }),
  ])

  const kpis: KpiValue[] = [
    {
      id: 'pages', label: 'Active pages', value: formatCompactNumber(aggregates.activePages),
      hint: `${aggregates.totalPages} total`, icon: 'pages', tone: 'blue',
    },
    {
      id: 'forms', label: 'Active forms', value: formatCompactNumber(aggregates.activeForms),
      hint: `${aggregates.totalForms} total`, icon: 'forms', tone: 'violet',
    },
    {
      id: 'funnel', label: 'Funnel conversion rate', value: formatPercentValue(aggregates.funnelConversionRate),
      hint: `${formatCompactNumber(aggregates.funnelConversions)} of ${formatCompactNumber(aggregates.funnelEntries)} entries`,
      icon: 'funnel', tone: 'green',
    },
    {
      id: 'uplift', label: 'Experiment uplift', value: formatSignedPercent(aggregates.experimentUpliftPercent),
      hint: 'Avg. across live experiments', icon: 'experiment', tone: 'amber',
      trend: aggregates.experimentUpliftPercent > 0 ? 'up' : aggregates.experimentUpliftPercent < 0 ? 'down' : 'flat',
    },
    {
      id: 'leads', label: 'Qualified leads', value: formatCompactNumber(aggregates.qualifiedLeads),
      hint: 'Lead capture + registration forms', icon: 'leads', tone: 'blue',
    },
    {
      id: 'health', label: 'Tracking health', value: formatPercentValue(aggregates.trackingHealthPercent, 0),
      hint: aggregates.trackingHealthPercent >= 90 ? 'Healthy' : aggregates.trackingHealthPercent >= 70 ? 'Needs attention' : 'Critical',
      icon: 'health', tone: aggregates.trackingHealthPercent >= 90 ? 'green' : aggregates.trackingHealthPercent >= 70 ? 'amber' : 'red',
    },
  ]

  const trendData = series.points.map(p => ({ date: p.date, sessions: p.sessions, conversions: p.conversions }))

  const sourceSlices: DonutSlice[] = series.bySource.map(s => ({
    key: s.source, label: TRAFFIC_SOURCE_LABELS[s.source as keyof typeof TRAFFIC_SOURCE_LABELS] ?? s.source,
    value: s.sessions, colour: SOURCE_COLOURS[s.source] ?? '#94a3b8',
  }))
  const totalSourceSessions = sourceSlices.reduce((sum, s) => sum + s.value, 0)

  const deviceSlices: DonutSlice[] = series.byDevice.map(d => ({
    key: d.device, label: DEVICE_LABELS[d.device as keyof typeof DEVICE_LABELS] ?? d.device,
    value: d.sessions, colour: DEVICE_COLOURS[d.device] ?? '#94a3b8',
  }))
  const totalDeviceSessions = deviceSlices.reduce((sum, s) => sum + s.value, 0)

  const trackingHealthSlices: DonutSlice[] = [
    { key: 'healthy', label: 'Healthy', value: trackingEvents.rows.filter(e => e.status === 'healthy').length, colour: '#34d399' },
    { key: 'warning', label: 'Warning', value: trackingEvents.rows.filter(e => e.status === 'warning').length, colour: '#f59e0b' },
    { key: 'critical', label: 'Critical', value: trackingEvents.rows.filter(e => e.status === 'critical').length, colour: '#f87171' },
  ]
  const totalTrackingEvents = trackingHealthSlices.reduce((sum, s) => sum + s.value, 0)

  const rankedPages = [...topPages.rows].sort((a, b) => b.sessions - a.sessions)
  const mainFunnel = topFunnels.rows[0]

  const nextActions = [
    {
      id: 'pages_attention', label: 'Pages needing attention', sub: 'Published but converting below 2%',
      count: aggregates.pagesNeedingAttention, href: '/app/web/pages', tone: 'bg-red-50 text-red-600',
    },
    {
      id: 'tracking_issues', label: 'Tracking issues detected', sub: 'Events in warning or critical state',
      count: trackingEvents.rows.filter(e => e.status !== 'healthy').length, href: '/app/web/tracking', tone: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'experiments_ready', label: 'Experiments ready for review', sub: 'Completed and awaiting a decision',
      count: topExperiments.rows.filter(e => e.status === 'completed').length, href: '/app/web/experiments', tone: 'bg-blue-50 text-blue-600',
    },
  ].filter(a => a.count > 0)

  return (
    <div className={WEB_PAGE}>
      <WebHeader
        module="overview" modules={modules}
        actions={
          <>
            <NewPageButton allowed={capabilities.create} />
            <NewFormButton allowed={capabilities.create} />
            <NewFunnelButton allowed={capabilities.create} />
            <ImportButton allowed={capabilities.import} />
            <ExportButton entity="pages" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'Pages', href: '/app/web/pages' },
              { label: 'Forms', href: '/app/web/forms' },
              { label: 'Funnels', href: '/app/web/funnels' },
              { label: 'Experiments', href: '/app/web/experiments' },
              { label: 'Tracking', href: '/app/web/tracking' },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <CampaignFilters
        className="mb-3"
        filters={[
          { key: 'status', label: 'Status', options: [
            ...PAGE_STATUSES, ...FUNNEL_STATUSES, ...FORM_STATUSES, ...TRACKING_HEALTH_STATUSES,
          ].filter((v, i, a) => a.indexOf(v) === i).map(s => ({ value: s, label: s.replace('_', ' ') })), advanced: true },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
        ]}
        searchPlaceholder="Search pages, forms, funnels, experiments…"
        views={['cards', 'table']}
      />

      <div className="mb-3 grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]">
        <Panel title="Top landing pages" info="Published pages ranked by sessions" viewAllHref="/app/web/pages">
          {rankedPages.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-400">No published pages yet.</p>
          ) : (
            <ul className="space-y-2">
              {rankedPages.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{p.name}</p>
                    <p className="truncate text-[11px] text-slate-400">/{p.slug}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-900">{formatCompactNumber(p.sessions)}</p>
                    <p className="text-[11px] text-emerald-600">{formatPercentValue(p.sessions > 0 ? (p.conversions / p.sessions) * 100 : 0)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Form performance" info="Completion rate for published forms" viewAllHref="/app/web/forms">
          <div className="flex flex-col items-center gap-1 py-2">
            <p className="text-[26px] font-bold text-slate-900">{formatCompactNumber(aggregates.qualifiedLeads)}</p>
            <p className="text-[11px] text-slate-400">Qualified leads captured</p>
          </div>
        </Panel>

        <Panel title="Funnel performance" info="Steps for the funnel with the most entries" viewAllHref="/app/web/funnels">
          {!mainFunnel || !mainFunnel.steps?.length ? (
            <p className="py-6 text-center text-[12px] text-slate-400">No active funnels yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {mainFunnel.steps.map(step => (
                <li key={step.id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate text-slate-600">{step.step_order}. {step.name}</span>
                  <span className="shrink-0 font-medium text-slate-900">{formatCompactNumber(step.users_count)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Experiment performance" info="Most recently updated experiment" viewAllHref="/app/web/experiments">
          {topExperiments.rows.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-400">No experiments yet.</p>
          ) : (() => {
            const e = topExperiments.rows[0]
            const stats = computeExperimentStats(e.control_visitors, e.control_conversions, e.variant_visitors, e.variant_conversions)
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="truncate text-[12px] font-medium text-slate-900">{e.name}</p>
                  <Badge variant={EXPERIMENT_STATUS_BADGE[e.status]}>{EXPERIMENT_STATUS_LABELS[e.status]}</Badge>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[20px] font-bold text-slate-900">{formatSignedPercent(stats.upliftPercent)}</span>
                  <span className="text-[11px] text-slate-400">
                    {stats.hasEnoughData ? `${formatPercentValue(stats.confidencePercent, 0)} confidence` : 'Collecting data'}
                  </span>
                </div>
              </div>
            )
          })()}
        </Panel>

        <Panel title="Next actions" viewAllHref="/app/web/tracking" viewAllLabel="View all tasks">
          {nextActions.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">Nothing needs your attention right now.</p>
          ) : (
            <ul className="space-y-1">
              {nextActions.map(action => (
                <li key={action.id}>
                  <Link href={action.href} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-50">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${action.tone}`}>
                      {action.count}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-slate-900">{action.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{action.sub}</span>
                    </span>
                    <ChevronRight size={13} className="shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1.3fr]">
        <Panel title="Tracking health" info="Healthy = 1, warning = 0.5, critical = 0 weighted average" viewAllHref="/app/web/tracking">
          <div className="flex items-center gap-3">
            <DonutChart slices={trackingHealthSlices} total={totalTrackingEvents} centreValue={formatPercentValue(aggregates.trackingHealthPercent, 0)} totalLabel="Healthy" size={110} />
            <DonutLegend slices={trackingHealthSlices} total={totalTrackingEvents} />
          </div>
        </Panel>

        <Panel title="Top traffic sources" info="Sessions by acquisition channel">
          <DonutLegend slices={sourceSlices} total={totalSourceSessions} />
        </Panel>

        <Panel title="Device breakdown" info="Sessions by device type">
          <div className="flex items-center gap-3">
            <DonutChart slices={deviceSlices} total={totalDeviceSessions} totalLabel="Sessions" size={110} />
            <DonutLegend slices={deviceSlices} total={totalDeviceSessions} />
          </div>
        </Panel>

        <Panel
          title="Conversions over time" info="Daily sessions and conversions across the selected period"
          action={<span className="text-[11px] text-slate-400">{from} → {to}</span>}
        >
          <ChartLegend series={TREND_SERIES} className="mb-1" />
          <TrendChart data={trendData} series={TREND_SERIES} />
        </Panel>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1.1fr)]">
        <Panel
          title="Web experiences" info={`${experiences.total} items — pages, forms, funnels, experiments and tracking events`}
          bodyClassName={query.view === 'cards' ? undefined : 'px-0 pb-0'}
        >
          {query.view === 'cards'
            ? <WebExperienceCards rows={experiences.rows} />
            : <WebExperiencesTable rows={experiences.rows} />}
        </Panel>

        <Panel title="Recent activity" viewAllHref="/app/web/pages">
          <ActivityFeed items={activity} />
        </Panel>
      </div>
    </div>
  )
}
