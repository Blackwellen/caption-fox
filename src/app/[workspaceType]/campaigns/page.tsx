import Link from 'next/link'
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, FileText, Wallet } from 'lucide-react'
import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  activeCampaignCount, campaignAggregates, contentCounts, listCampaigns,
  metricSeries, onTrackRate, recentActivity, workspaceMembers,
} from '@/lib/campaigns/data'
import { parseCampaignQuery, type RawParams } from '@/lib/campaigns/query'
import {
  CAMPAIGN_MODULE_META, LIFECYCLE_LABELS, type LifecycleStage,
} from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import { PanelSelect } from '@/components/campaigns/SortSelect'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import CampaignCard from '@/components/campaigns/CampaignCard'
import CampaignTable from '@/components/campaigns/CampaignTable'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import NewCampaignButton from '@/components/campaigns/NewCampaignButton'
import ImportButton from '@/components/campaigns/ImportButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty, LoadError } from '@/components/campaigns/states'
import { Panel, CAMPAIGN_PAGE, formatCompactMoney, formatNumber } from '@/components/campaigns/primitives'
import {
  BudgetScatter, ChartLegend, DonutChart, DonutLegend, TrendChart,
  type DonutSlice, type ScatterPoint, type TrendSeries,
} from '@/components/campaigns/charts'
import type { KpiValue } from '@/lib/campaigns/types'

export const metadata = {
  title: 'Campaigns · Caption Fox',
  description: CAMPAIGN_MODULE_META.overview.description,
}

const TREND_SERIES: TrendSeries[] = [
  { key: 'engagements', label: 'Engagements', colour: '#2563eb' },
  { key: 'reach', label: 'Reach', colour: '#7dd3fc' },
  { key: 'conversions', label: 'Conversions', colour: '#8b5cf6' },
]

const SCATTER_GROUPS = [
  { id: 'campaign', label: 'By campaign' },
  { id: 'type', label: 'By type' },
] as const

const SCATTER_PERIODS = [
  { id: 'month', label: 'This month' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
] as const

function firstParam(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

const STAGE_COLOURS: Record<string, string> = {
  planning: '#cbd5e1', in_progress: '#3b82f6', in_review: '#a78bfa',
  scheduled: '#93c5fd', live: '#34d399', completed: '#10b981',
  at_risk: '#fbbf24', blocked: '#f87171', archived: '#e2e8f0',
}

export default async function CampaignsOverviewPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, base, ctx, capabilities, modules, access } = await requireCampaignModule('overview')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="overview" modules={modules} base={base} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCampaignQuery(params, { views: ['cards', 'table'], defaultView: 'cards' })
  const to = query.to || new Date().toISOString().slice(0, 10)
  const from = query.from || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)

  const [aggregates, series, featured, members, activity, pendingContent] = await Promise.all([
    campaignAggregates(supabase, ctx.workspaceId),
    metricSeries(supabase, ctx.workspaceId, from, to),
    listCampaigns(supabase, ctx.workspaceId, query, { limit: 12 }),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 5 }),
    supabase.from('content_posts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).eq('status', 'pending_approval'),
  ])

  const counts = await contentCounts(supabase, ctx.workspaceId, featured.rows.slice(0, 4).map(row => row.id))

  const budgetUtilisation = aggregates.totalBudget > 0
    ? Math.round((aggregates.totalSpend / aggregates.totalBudget) * 100)
    : 0

  const kpis: KpiValue[] = [
    {
      id: 'active', label: 'Active campaigns', value: formatNumber(activeCampaignCount(aggregates)),
      hint: `${aggregates.total} in total`, icon: 'campaigns', tone: 'blue',
    },
    {
      id: 'planned', label: 'Planned launches', value: formatNumber(aggregates.plannedLaunches),
      hint: `${aggregates.launchingSoon} in the next 14 days`, icon: 'calendar', tone: 'violet',
    },
    {
      id: 'ontrack', label: 'On-track rate', value: `${onTrackRate(aggregates)}%`,
      hint: `${aggregates.byHealth.on_track ?? 0} of ${aggregates.total} campaigns`, icon: 'check', tone: 'green',
    },
    {
      id: 'budget', label: 'Budget utilisation', value: `${budgetUtilisation}%`,
      hint: `${formatCompactMoney(aggregates.totalSpend)} of ${formatCompactMoney(aggregates.totalBudget)}`,
      icon: 'pie', tone: 'blue',
    },
    {
      id: 'uplift', label: 'Engagement uplift', value: `${series.upliftPercent >= 0 ? '+' : ''}${series.upliftPercent}%`,
      hint: 'vs previous period', trend: series.upliftPercent > 0 ? 'up' : series.upliftPercent < 0 ? 'down' : 'flat',
      icon: 'trend', tone: series.upliftPercent < 0 ? 'red' : 'green',
    },
    {
      id: 'deadlines', label: 'Upcoming deadlines', value: formatNumber(aggregates.upcomingDeadlines),
      hint: 'Due in next 7 days', icon: 'clock', tone: 'amber',
    },
  ]

  const stageSlices: DonutSlice[] = (Object.keys(LIFECYCLE_LABELS) as LifecycleStage[])
    .filter(stage => stage !== 'archived')
    .map(stage => ({
      key: stage, label: LIFECYCLE_LABELS[stage],
      value: aggregates.byStage[stage] ?? 0, colour: STAGE_COLOURS[stage],
    }))
    .filter(slice => slice.value > 0)

  const scatterGroup = SCATTER_GROUPS.some(g => g.id === firstParam(params, 'sgroup'))
    ? firstParam(params, 'sgroup') : 'campaign'
  const scatterPeriod = SCATTER_PERIODS.some(g => g.id === firstParam(params, 'speriod'))
    ? firstParam(params, 'speriod') : 'month'

  const now = new Date()
  const windowStart = scatterPeriod === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getTime() - (scatterPeriod === '90d' ? 89 : 29) * 86_400_000)

  const inWindow = featured.rows.filter(row => {
    const end = row.end_date ? new Date(row.end_date) : null
    const start = row.start_date ? new Date(row.start_date) : null
    return (!end || end >= windowStart) && (!start || start <= now)
  })

  const scatterSource = inWindow.filter(row => Number(row.actual_spend ?? 0) > 0 || row.engagements > 0)

  const scatter: ScatterPoint[] = scatterGroup === 'type'
    ? Object.values(scatterSource.reduce<Record<string, { id: string; name: string; spend: number; engagements: number; budget: number }>>((acc, row) => {
        const key = row.campaign_type
        const bucket = acc[key] ?? {
          id: key, name: CAMPAIGN_TYPE_LABELS[key] ?? key, spend: 0, engagements: 0, budget: 0,
        }
        bucket.spend += Number(row.actual_spend ?? 0)
        bucket.engagements += row.engagements
        bucket.budget += Number(row.budget ?? 0)
        acc[key] = bucket
        return acc
      }, {})).map(bucket => ({
        id: bucket.id, name: bucket.name, spend: bucket.spend, engagements: bucket.engagements,
        group: bucket.budget > 0 && bucket.spend > bucket.budget ? 'over_budget'
          : bucket.engagements > 0 ? 'on_track' : 'underperforming',
      }))
    : scatterSource.map(row => {
        const budget = Number(row.budget ?? 0)
        const spend = Number(row.actual_spend ?? 0)
        return {
          id: row.id, name: row.name, spend, engagements: row.engagements,
          group: budget > 0 && spend > budget ? 'over_budget'
            : row.health === 'on_track' ? 'on_track' : 'underperforming',
        }
      })

  const nextActions = [
    {
      id: 'review', label: 'Review campaigns', sub: 'Awaiting your review', Icon: FileText,
      count: aggregates.pendingApprovals, href: `${base}/all?approval=pending`, tone: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'content', label: 'Approve content', sub: 'Content pending approval', Icon: CheckCircle2,
      count: pendingContent.count ?? 0, href: '/app/studio?tab=approvals', tone: 'bg-violet-50 text-violet-600',
    },
    {
      id: 'budget', label: 'Budget reallocation', sub: 'Campaigns near or over budget', Icon: Wallet,
      count: aggregates.budgetAtRisk, href: `${base}/all?health=at_risk`, tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'launch', label: 'Upcoming launches', sub: 'Launching in the next 14 days', Icon: CalendarClock,
      count: aggregates.launchingSoon, href: `${base}/timeline`, tone: 'bg-sky-50 text-sky-600',
    },
    {
      id: 'alerts', label: 'Performance alerts', sub: 'Campaigns needing attention', Icon: AlertTriangle,
      count: (aggregates.byHealth.at_risk ?? 0) + (aggregates.byHealth.blocked ?? 0) + aggregates.overdue,
      href: `${base}/all?health=at_risk`, tone: 'bg-amber-50 text-amber-600',
    },
  ].filter(action => action.count > 0)

  const trendData = series.points.map(point => ({
    date: point.metric_date, engagements: point.engagements,
    reach: point.reach, conversions: point.conversions,
  }))

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="overview" modules={modules} base={base}
        actions={
          <>
            {capabilities.create && <NewCampaignButton members={members} />}
            {capabilities.import && <ImportButton entity="campaigns" />}
            <ExportButton entity="campaigns" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'All campaigns', href: `${base}/all`, description: 'Full searchable record list' },
              { label: 'Campaign board', href: `${base}/board` },
              { label: 'Campaign timeline', href: `${base}/timeline` },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3 lg:mb-[18px]" />

      <CampaignFilters
        className="mb-3 lg:mb-[15px]"
        views={['cards', 'table']}
        filters={[
          { key: 'type', label: 'Campaign type', options: CAMPAIGN_TYPES.map(t => ({ value: t, label: CAMPAIGN_TYPE_LABELS[t] })) },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'stage', label: 'Status', options: (Object.keys(LIFECYCLE_LABELS) as LifecycleStage[]).map(s => ({ value: s, label: LIFECYCLE_LABELS[s] })) },
          { key: 'health', label: 'Health', options: [
            { value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' },
            { value: 'overdue', label: 'Overdue' }, { value: 'blocked', label: 'Blocked' },
          ], advanced: true },
          { key: 'priority', label: 'Priority', options: [
            { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
          ], advanced: true },
        ]}
      />

      {featured.error && <LoadError message={featured.error} className="mb-3" />}

      {query.view === 'table' ? (
        <CampaignTable campaigns={featured.rows} capabilities={capabilities} members={members} />
      ) : (
        <>
          <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,4.14fr)_minmax(0,2.75fr)_minmax(0,2.58fr)_minmax(0,2.54fr)]">
            <Panel
              title="Campaign performance trend" info="Daily engagements, reach and conversions across the selected period"
              action={<span className="text-[11px] text-slate-400">{from} → {to}</span>}
            >
              <ChartLegend series={TREND_SERIES} className="mb-1" />
              <TrendChart data={trendData} series={TREND_SERIES} />
            </Panel>

            <Panel title="Lifecycle status" info="Live campaigns grouped by their current stage">
              <div className="flex items-center gap-3">
                <DonutChart
                  slices={stageSlices} total={aggregates.total} totalLabel="Total"
                  emptyMessage="No campaigns yet."
                />
                <DonutLegend slices={stageSlices} total={aggregates.total} />
              </div>
            </Panel>

            <Panel
              title="Budget vs performance" info="Spend plotted against engagements for the selected period"
              action={
                <span className="flex items-center gap-1.5">
                  <PanelSelect options={SCATTER_GROUPS} paramKey="sgroup" ariaLabel="Group budget chart by" />
                  <PanelSelect options={SCATTER_PERIODS} paramKey="speriod" ariaLabel="Budget chart period" />
                </span>
              }
            >
              <ChartLegend
                className="mb-1"
                series={[
                  { key: 'on_track', label: 'On track', colour: '#34d399' },
                  { key: 'under', label: 'Underperforming', colour: '#fbbf24' },
                  { key: 'over', label: 'Over budget', colour: '#f87171' },
                ]}
              />
              <BudgetScatter points={scatter} />
            </Panel>

            <Panel title="Next actions" viewAllHref={`${base}/all`} viewAllLabel="View all tasks">
              {nextActions.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-slate-400">
                  Nothing needs your attention right now.
                </p>
              ) : (
                <ul className="space-y-1">
                  {nextActions.map(action => (
                    <li key={action.id}>
                      <Link
                        href={action.href}
                        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-50"
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${action.tone}`} aria-hidden>
                          <action.Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-900 lg:text-[10px]">{action.label}</span>
                          <span className="block truncate text-[11px] text-slate-400 lg:text-[9px]">{action.sub}</span>
                        </span>
                        <span className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-[11px] font-semibold lg:text-[9px] ${action.tone}`}>
                          {action.count}
                          <span className="sr-only"> items</span>
                        </span>
                        <ChevronRight size={12} className="shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,7.64fr)_minmax(0,4.43fr)]">
            <Panel title="Featured campaigns" viewAllHref={`${base}/all`} viewAllLabel="View all campaigns">
              {featured.rows.length === 0 ? (
                <CampaignsEmpty
                  bare
                  icon="campaign"
                  title="No campaigns yet"
                  message="Create your first campaign to start tracking delivery, budget and performance in one place."
                  action={capabilities.create ? <NewCampaignButton members={members} /> : undefined}
                />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {featured.rows.slice(0, 4).map((campaign, index) => (
                    <CampaignCard
                      key={campaign.id} campaign={campaign} capabilities={capabilities}
                      featured={index === 0} contentCount={counts[campaign.id] ?? 0}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent activity" viewAllHref={`${base}/all`}>
              <ActivityFeed items={activity} />
            </Panel>
          </div>

          <Panel
            title="Campaigns health" info="Delivery and budget health for the campaigns matching your filters"
            viewAllHref={`${base}/all`} viewAllLabel="View full table"
            bodyClassName="px-0 pb-0"
          >
            <CampaignTable
              campaigns={featured.rows.slice(0, 6)} capabilities={capabilities}
              compact bare emptyMessage="No campaigns match the current filters."
            />
          </Panel>
        </>
      )}
    </div>
  )
}
