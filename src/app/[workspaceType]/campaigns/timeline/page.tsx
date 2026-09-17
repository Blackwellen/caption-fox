import Link from 'next/link'
import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  campaignAggregates, listAllCampaigns, listDependencies, listMilestones,
  listPhases, recentActivity, workspaceMembers,
} from '@/lib/campaigns/data'
import { parseCampaignQuery, type RawParams } from '@/lib/campaigns/query'
import { CAMPAIGN_MODULE_META, LIFECYCLE_LABELS, type LifecycleStage } from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import CampaignTable from '@/components/campaigns/CampaignTable'
import CampaignCard from '@/components/campaigns/CampaignCard'
import CampaignTimeline from '@/components/campaigns/CampaignTimeline'
import MilestoneList from '@/components/campaigns/MilestoneList'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import NewCampaignButton from '@/components/campaigns/NewCampaignButton'
import AddMilestoneButton from '@/components/campaigns/AddMilestoneButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty } from '@/components/campaigns/states'
import { Panel, CAMPAIGN_PAGE, formatNumber } from '@/components/campaigns/primitives'
import { DonutChart, DonutLegend, type DonutSlice } from '@/components/campaigns/charts'
import type { KpiValue } from '@/lib/campaigns/types'

export const metadata = {
  title: 'Campaign Timeline · Caption Fox',
  description: CAMPAIGN_MODULE_META.timeline.description,
}

export default async function CampaignTimelinePage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, base, ctx, capabilities, modules, access } = await requireCampaignModule('timeline')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="timeline" modules={modules} base={base} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCampaignQuery(params, { views: ['timeline', 'cards', 'table'], defaultView: 'timeline' })

  const to = query.to || new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10)
  const from = query.from || new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)

  const [aggregates, list, members, activity] = await Promise.all([
    campaignAggregates(supabase, ctx.workspaceId),
    listAllCampaigns(supabase, ctx.workspaceId, query),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 6, surface: 'timeline' }),
  ])

  // Only campaigns whose dates intersect the visible window are plotted: a
  // finished campaign from six months ago would otherwise render as a
  // full-width bar and push the live work off the screen. Campaigns with no
  // dates at all cannot be placed on a timeline, so they are excluded here and
  // remain available in the Cards and Table views.
  const plotted = list.rows.filter(row => {
    if (!row.start_date && !row.end_date) return false
    const starts = row.start_date ?? row.end_date as string
    const ends = row.end_date ?? row.start_date as string
    return starts <= to && ends >= from
  })

  const campaignIds = plotted.map(row => row.id)
  const today = new Date().toISOString().slice(0, 10)
  const inSevenDays = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

  const [phases, milestones, upcomingMilestones, dependencies, milestonesDue] = await Promise.all([
    listPhases(supabase, ctx.workspaceId, campaignIds),
    listMilestones(supabase, ctx.workspaceId, { campaignIds }),
    listMilestones(supabase, ctx.workspaceId, { limit: 6, from: new Date().toISOString().slice(0, 10) }),
    listDependencies(supabase, ctx.workspaceId),
    supabase.from('campaign_milestones').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).neq('status', 'completed')
      .gte('due_date', today).lte('due_date', inSevenDays),
  ])

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active timelines', value: formatNumber(aggregates.total), hint: `${aggregates.plannedLaunches} with a future launch date`, icon: 'campaigns', tone: 'blue' },
    { id: 'milestones', label: 'Milestones due', value: formatNumber(milestonesDue.count ?? 0), hint: 'Due in next 7 days', icon: 'calendarClock', tone: 'violet' },
    { id: 'risk', label: 'At-risk launches', value: formatNumber(aggregates.byHealth.at_risk ?? 0), hint: `${aggregates.byHealth.blocked ?? 0} blocked as well`, icon: 'alert', tone: 'red' },
    { id: 'ontime', label: 'On-time rate', value: aggregates.total ? `${Math.round(((aggregates.total - aggregates.overdue) / aggregates.total) * 100)}%` : '0%', hint: `${aggregates.overdue} past their end date`, icon: 'check', tone: 'green' },
    { id: 'capacity', label: 'Capacity utilisation', value: aggregates.totalBudget > 0 ? `${Math.round((aggregates.totalSpend / aggregates.totalBudget) * 100)}%` : '0%', hint: 'Of allocated budget', icon: 'pie', tone: 'blue' },
    { id: 'upcoming', label: 'Upcoming launches', value: formatNumber(aggregates.launchingSoon), hint: 'Next 14 days', icon: 'rocket', tone: 'amber' },
  ]

  const overdue = aggregates.overdue
  const atRisk = aggregates.byHealth.at_risk ?? 0
  const completed = aggregates.byStage.completed ?? 0
  const onTrack = Math.max(0, aggregates.total - overdue - atRisk - completed)

  const progressSlices: DonutSlice[] = [
    { key: 'completed', label: 'Completed', value: completed, colour: '#3b82f6' },
    { key: 'ontrack', label: 'On track', value: onTrack, colour: '#34d399' },
    { key: 'atrisk', label: 'At risk', value: atRisk, colour: '#fbbf24' },
    { key: 'delayed', label: 'Delayed', value: overdue, colour: '#f87171' },
  ].filter(slice => slice.value > 0)
  const progressTotal = progressSlices.reduce((sum, slice) => sum + slice.value, 0)

  const launchRisks = list.rows
    .filter(row => (row.health === 'at_risk' || row.health === 'blocked') && row.end_date)
    .slice(0, 5)

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="timeline" modules={modules} base={base}
        actions={
          <>
            {capabilities.create && <NewCampaignButton members={members} label="New campaign" />}
            {capabilities.manageTimeline && (
              <AddMilestoneButton campaigns={list.rows.map(row => ({ id: row.id, name: row.name }))} members={members} />
            )}
            <ExportButton entity="campaigns" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'All campaigns', href: `${base}/all` },
              { label: 'Campaign board', href: `${base}/board` },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3 lg:mb-[18px]" />

      <CampaignFilters
        className="mb-3 lg:mb-[15px]"
        searchPlaceholder="Search campaigns…"
        views={['timeline', 'cards', 'table']}
        filters={[
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'type', label: 'Campaign type', options: CAMPAIGN_TYPES.map(t => ({ value: t, label: CAMPAIGN_TYPE_LABELS[t] })) },
          { key: 'stage', label: 'Stage', options: (Object.keys(LIFECYCLE_LABELS) as LifecycleStage[]).map(s => ({ value: s, label: LIFECYCLE_LABELS[s] })) },
        ]}
      />

      {list.error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{list.error}</p>
      )}

      {list.rows.length === 0 ? (
        <CampaignsEmpty
          className="mb-3" icon="campaign" title="No campaigns to schedule yet"
          message="Create a campaign with a start and end date to see it plotted on the timeline."
          action={capabilities.create ? <NewCampaignButton members={members} /> : undefined}
        />
      ) : query.view === 'table' ? (
        <div className="mb-3">
          <CampaignTable
            campaigns={list.rows} capabilities={capabilities} members={members} selectable
            columns={['campaign', 'type', 'owner', 'stage', 'status', 'progress', 'due', 'health']}
          />
        </div>
      ) : query.view === 'cards' ? (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.rows.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} capabilities={capabilities} />
          ))}
        </div>
      ) : query.view === 'timeline' && plotted.length === 0 ? (
        <CampaignsEmpty
          className="mb-3" icon="search" title="Nothing scheduled in this date range"
          message="No campaign starts, runs or finishes between these dates. Widen the date range to see more."
        />
      ) : (
        <div className="mb-3">
          <CampaignTimeline
            campaigns={plotted} phases={phases} milestones={milestones}
            capabilities={capabilities} rangeStart={from} rangeEnd={to}
          />
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)]">
        <Panel title="Timeline progress">
          <div className="flex items-center gap-3">
            <DonutChart slices={progressSlices} total={progressTotal} totalLabel="Total" emptyMessage="No campaigns yet." />
            <DonutLegend slices={progressSlices} total={progressTotal} />
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[12px] text-slate-500">
            On-time rate <span className="font-semibold text-slate-900">
              {aggregates.total ? `${Math.round(((aggregates.total - overdue) / aggregates.total) * 100)}%` : '0%'}
            </span>
          </p>
        </Panel>

        <Panel title="Upcoming milestones" viewAllHref={`${base}/timeline?view=timeline`}>
          <MilestoneList milestones={upcomingMilestones} canManage={capabilities.manageTimeline} />
        </Panel>

        <Panel title="Launch risks">
          {launchRisks.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">No launches currently at risk.</p>
          ) : (
            <ul className="space-y-2">
              {launchRisks.map(campaign => (
                <li key={campaign.id} className="flex items-start gap-2">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${campaign.health === 'blocked' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <Link href={`${base}/${campaign.id}`} className="block truncate text-[12px] font-medium text-slate-900 hover:text-blue-600">
                      {campaign.name}
                    </Link>
                    <span className="block text-[11px] text-slate-400">
                      {campaign.health === 'blocked' ? 'Blocked' : 'At risk'} · due {campaign.end_date}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Dependencies" viewAllHref={`${base}/all`}>
          {dependencies.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">No campaign dependencies recorded.</p>
          ) : (
            <ul className="space-y-2">
              {dependencies.map(dep => (
                <li key={dep.id}>
                  <span className="block truncate text-[12px] font-medium text-slate-900">{dep.campaign?.name ?? 'Campaign'}</span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {dep.label ?? `Waiting on ${dep.depends_on?.name ?? 'another campaign'}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity" viewAllHref={`${base}`}>
          <ActivityFeed items={activity} emptyMessage="No timeline activity yet." />
        </Panel>
      </div>
    </div>
  )
}
