import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  activeCampaignCount, campaignAggregates, listAllCampaigns, recentActivity, workspaceMembers,
} from '@/lib/campaigns/data'
import { parseCampaignQuery, type RawParams } from '@/lib/campaigns/query'
import {
  BOARD_COLUMN_FOR, BOARD_STAGES, CAMPAIGN_MODULE_META, LIFECYCLE_LABELS, PRIORITIES, PRIORITY_LABELS,
  type LifecycleStage,
} from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import CampaignTable from '@/components/campaigns/CampaignTable'
import CampaignBoard from '@/components/campaigns/CampaignBoard'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import NewCampaignButton from '@/components/campaigns/NewCampaignButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty } from '@/components/campaigns/states'
import { Panel, CAMPAIGN_PAGE, formatNumber } from '@/components/campaigns/primitives'
import { DonutChart, DonutLegend, type DonutSlice } from '@/components/campaigns/charts'
import CampaignCard from '@/components/campaigns/CampaignCard'
import type { KpiValue } from '@/lib/campaigns/types'

export const metadata = {
  title: 'Campaign Board · Caption Fox',
  description: CAMPAIGN_MODULE_META.board.description,
}

const STAGE_COLOURS: Record<string, string> = {
  planning: '#cbd5e1', in_review: '#a78bfa', scheduled: '#93c5fd',
  live: '#34d399', completed: '#10b981', at_risk: '#fbbf24',
}

export default async function CampaignBoardPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, base, ctx, capabilities, modules, access } = await requireCampaignModule('board')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="board" modules={modules} base={base} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCampaignQuery(params, { views: ['board', 'cards', 'table'], defaultView: 'board' })

  const [aggregates, list, members, activity] = await Promise.all([
    campaignAggregates(supabase, ctx.workspaceId),
    listAllCampaigns(supabase, ctx.workspaceId, query),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 6, surface: 'board' }),
  ])

  // The KPI row counts the same buckets the columns use, so a header count and
  // its column can never disagree on screen.
  const columnCount = (column: LifecycleStage) =>
    (Object.entries(aggregates.byStage) as [string, number][])
      .filter(([stage]) => stage === column || BOARD_COLUMN_FOR[stage] === column)
      .reduce((sum, [, count]) => sum + count, 0)

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active campaigns', value: formatNumber(aggregates.total), hint: `${activeCampaignCount(aggregates)} in flight`, icon: 'campaigns', tone: 'blue' },
    { id: 'planning', label: 'In planning', value: formatNumber(columnCount('planning')), hint: 'On the board', icon: 'layers', tone: 'violet' },
    { id: 'review', label: 'In review', value: formatNumber(columnCount('in_review')), hint: 'Awaiting a decision', icon: 'file', tone: 'amber' },
    { id: 'live', label: 'Live', value: formatNumber(columnCount('live')), hint: 'Currently running', icon: 'check', tone: 'green' },
    { id: 'blocked', label: 'Blocked', value: formatNumber(aggregates.byStage.blocked ?? 0), hint: 'Needs attention', icon: 'alert', tone: 'red' },
    { id: 'soon', label: 'Launching soon', value: formatNumber(aggregates.launchingSoon), hint: 'Due in next 7 days', icon: 'rocket', tone: 'blue' },
  ]

  const stageSlices: DonutSlice[] = BOARD_STAGES.map(stage => ({
    key: stage, label: LIFECYCLE_LABELS[stage],
    value: columnCount(stage), colour: STAGE_COLOURS[stage],
  })).filter(slice => slice.value > 0)

  const overdue = aggregates.overdue
  const atRisk = aggregates.byHealth.at_risk ?? 0
  const onTrack = aggregates.total - atRisk - overdue

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="board" modules={modules} base={base}
        actions={
          <>
            {capabilities.create && <NewCampaignButton members={members} label="New campaign" />}
            <ExportButton entity="campaigns" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'All campaigns', href: `${base}/all` },
              { label: 'Campaign timeline', href: `${base}/timeline` },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3 lg:mb-[18px]" />

      <CampaignFilters
        className="mb-3 lg:mb-[15px]"
        searchPlaceholder="Search campaigns…"
        views={['board', 'cards', 'table']}
        filters={[
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'type', label: 'Campaign type', options: CAMPAIGN_TYPES.map(t => ({ value: t, label: CAMPAIGN_TYPE_LABELS[t] })) },
          { key: 'priority', label: 'Priority', options: PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABELS[p] })) },
        ]}
      />

      {list.error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{list.error}</p>
      )}

      {list.rows.length === 0 ? (
        <CampaignsEmpty
          className="mb-3" icon="campaign" title="No campaigns to plan yet"
          message="Create a campaign to start tracking it through planning, review, scheduling and delivery."
          action={capabilities.create ? <NewCampaignButton members={members} /> : undefined}
        />
      ) : query.view === 'table' ? (
        <div className="mb-3">
          <CampaignTable
            campaigns={list.rows} capabilities={capabilities} members={members} selectable
            columns={['campaign', 'type', 'owner', 'stage', 'status', 'priority', 'progress', 'budget', 'due', 'health']}
          />
        </div>
      ) : query.view === 'cards' ? (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.rows.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} capabilities={capabilities} />
          ))}
        </div>
      ) : (
        <div className="mb-3">
          <CampaignBoard campaigns={list.rows} capabilities={capabilities} />
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <Panel title="Board summary" info="Live rollup of every campaign currently on the board">
          <ul className="space-y-2">
            <li className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Total campaigns</span>
              <span className="font-semibold text-slate-900">{aggregates.total}</span>
            </li>
            <li className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">On track</span>
              <span className="font-semibold text-emerald-600">{Math.max(0, onTrack)}</span>
            </li>
            <li className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">At risk</span>
              <span className="font-semibold text-amber-600">{atRisk}</span>
            </li>
            <li className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Overdue</span>
              <span className="font-semibold text-red-600">{overdue}</span>
            </li>
          </ul>
        </Panel>

        <Panel title="Campaigns by stage">
          <div className="flex items-center gap-3">
            <DonutChart slices={stageSlices} total={aggregates.total} totalLabel="Total" emptyMessage="No campaigns yet." />
            <DonutLegend slices={stageSlices} total={aggregates.total} />
          </div>
        </Panel>

        <Panel title="Recent board activity" viewAllHref={`${base}`}>
          <ActivityFeed items={activity} emptyMessage="No board activity yet." />
        </Panel>
      </div>
    </div>
  )
}
