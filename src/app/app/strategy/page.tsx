import Link from 'next/link'
import { Download, Plus } from 'lucide-react'
import { requireStrategyModule } from '@/lib/strategy/server'
import {
  forecastAggregates, forecastPeriodSeries, listActivity, listHealthSnapshots,
  listObjectives, listResearch, objectiveAggregates, objectiveStatusCounts,
  planAggregates, positioningAggregates, audienceAggregates,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { OBJECTIVE_STATUS_LABELS, STRATEGY_MODULE_META } from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import {
  Panel, PanelFooterLink, STRATEGY_PAGE, formatDayMonth, ProgressBar, OwnerChip,
} from '@/components/strategy/primitives'
import { DonutChart, DonutLegend, GroupedBarChart, TrendChart } from '@/components/strategy/charts'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.overview.description,
}

const STATUS_COLOUR: Record<string, string> = {
  on_track: '#10b981', at_risk: '#f59e0b', off_track: '#ef4444',
  not_started: '#cbd5e1', draft: '#cbd5e1', completed: '#3b82f6',
}

export default async function StrategyOverviewPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, modules, access, workspace } = await requireStrategyModule('overview')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="overview" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['dashboard', 'table'], defaultView: 'dashboard' })

  const [
    objectiveStats, objectiveAgg, audienceAgg, positioningAgg, planAgg, forecastAgg,
    forecastSeries, health, researchHighlights, activity, priorityObjectives,
  ] = await Promise.all([
    objectiveStatusCounts(supabase, ctx.workspaceId),
    objectiveAggregates(supabase, ctx.workspaceId),
    audienceAggregates(supabase, ctx.workspaceId),
    positioningAggregates(supabase, ctx.workspaceId),
    planAggregates(supabase, ctx.workspaceId),
    forecastAggregates(supabase, ctx.workspaceId),
    forecastPeriodSeries(supabase, ctx.workspaceId, 6),
    listHealthSnapshots(supabase, ctx.workspaceId, 6),
    listResearch(supabase, ctx.workspaceId, { ...query, status: '' }, { limit: 3 }),
    listActivity(supabase, ctx.workspaceId, { limit: 5 }),
    listObjectives(supabase, ctx.workspaceId, { ...query, status: '', sort: 'priority' }, { limit: 5 }),
  ])

  const onTrack = objectiveStats.counts.on_track ?? 0
  const objTotal = objectiveStats.total || 1
  const currentHealth = health.at(-1)?.health_score ?? Math.round(objectiveAgg.avgProgress)
  const benchmark = health.at(-1)?.benchmark_score ?? 62

  const kpis: KpiValue[] = [
    {
      id: 'strategies', label: 'Active Strategies', value: String(planAgg.activePlans || 0),
      hint: `${planAgg.total} total`, trend: 'flat', tone: 'blue', icon: 'sparkles',
    },
    {
      id: 'objectives', label: 'Objectives on Track', value: `${onTrack} / ${objectiveStats.total}`,
      tone: 'green', icon: 'target',
      bar: { pct: (onTrack / objTotal) * 100, label: `${Math.round((onTrack / objTotal) * 100)}% on track` },
    },
    {
      id: 'audience', label: 'Audience Coverage', value: `${audienceAgg.avgFit}%`,
      hint: `${audienceAgg.total} segments`, trend: 'up', tone: 'violet', icon: 'users2',
    },
    {
      id: 'research', label: 'Research Health', value: `${positioningAgg.pendingApprovals === 0 ? 100 : Math.max(0, 100 - positioningAgg.pendingApprovals * 5)}%`,
      trend: 'up', tone: 'blue', icon: 'flask',
    },
    {
      id: 'positioning', label: 'Positioning Health', value: `${positioningAgg.consistency}%`,
      hint: `${positioningAgg.activeFrameworks} frameworks`, trend: 'up', tone: 'amber', icon: 'star',
    },
    {
      id: 'forecast', label: 'Forecast Confidence', value: capitalise(forecastAgg.confidence),
      trend: forecastAgg.variancePct >= 0 ? 'up' : 'down', tone: 'green', icon: 'trend',
    },
  ]

  const trendData = health.map(row => ({
    label: formatDayMonth(row.snapshot_date), health: row.health_score, benchmark: row.benchmark_score,
  }))
  if (trendData.length === 0) {
    trendData.push({ label: 'Now', health: currentHealth, benchmark })
  }

  const statusSlices = [
    { key: 'on_track', label: 'On track', value: objectiveStats.counts.on_track ?? 0, colour: STATUS_COLOUR.on_track },
    { key: 'at_risk', label: 'At risk', value: objectiveStats.counts.at_risk ?? 0, colour: STATUS_COLOUR.at_risk },
    { key: 'off_track', label: 'Off track', value: objectiveStats.counts.off_track ?? 0, colour: STATUS_COLOUR.off_track },
  ]

  const forecastChart = forecastSeries.map(period => ({
    label: formatDayMonth(period.date), forecast: period.forecast, target: period.target,
  }))

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="overview" modules={modules}
        actions={(
          <>
            <Link href="/app/strategy/objectives?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
              <Plus size={15} /> New objective
            </Link>
            <Link href="/app/strategy/research?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <Plus size={15} /> Add research
            </Link>
            <Link href="/app/strategy?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <Download size={15} /> Export
            </Link>
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">Workspace timezone: {workspace.timezone}</p>
        <ViewSwitcher views={['dashboard', 'table']} active={query.view} />
      </div>

      {query.view === 'table'
        ? <ObjectivesTablePreview objectives={priorityObjectives.rows} />
        : (
          <>
            <div className="mb-4 grid gap-4 xl:grid-cols-3">
              <Panel
                title="Strategy performance trend" info="Strategy Health Score combines objectives, research, positioning, and plan progress."
                viewAllHref="/app/strategy/objectives" viewAllLabel="View full report"
                className="xl:col-span-1"
              >
                <TrendChart
                  data={trendData}
                  series={[
                    { key: 'health', label: 'Strategy Health Score', colour: '#3b82f6' },
                    { key: 'benchmark', label: 'Industry Benchmark', colour: '#94a3b8', dashed: true },
                  ]}
                  height={180}
                />
              </Panel>

              <Panel title="Objectives by status" viewAllHref="/app/strategy/objectives" viewAllLabel="View all objectives">
                <div className="flex items-center gap-4">
                  <DonutChart
                    slices={statusSlices} total={objectiveStats.total}
                    centreValue={String(objectiveStats.total)} centreSub="Total" size={130}
                  />
                  <DonutLegend slices={statusSlices} total={objectiveStats.total} />
                </div>
              </Panel>

              <Panel title="Forecast vs target (Revenue)" viewAllHref="/app/strategy/forecasts" viewAllLabel="View forecasts">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-[13px] font-semibold ${forecastAgg.variancePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {forecastAgg.variancePct >= 0 ? '+' : ''}{forecastAgg.variancePct}% <span className="font-normal text-slate-400">Variance</span>
                  </span>
                </div>
                <GroupedBarChart
                  data={forecastChart}
                  series={[
                    { key: 'forecast', label: 'Forecast', colour: '#3b82f6' },
                    { key: 'target', label: 'Target', colour: '#bfdbfe' },
                  ]}
                  currency={forecastAgg.currency}
                  height={160}
                />
              </Panel>
            </div>

            <div className="mb-4 grid gap-4 xl:grid-cols-3">
              <Panel title="Next actions" viewAllHref="/app/strategy/objectives" viewAllLabel="View all actions">
                {priorityObjectives.rows.length === 0
                  ? <EmptyState compact title="No open actions" message="Next actions from your objectives will appear here." />
                  : (
                    <ul className="space-y-3">
                      {priorityObjectives.rows.filter(row => row.next_action).slice(0, 4).map(row => (
                        <li key={row.id} className="flex items-start gap-2.5">
                          <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-slate-300" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-slate-700">{row.next_action}</p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{capitalise(row.objective_type)}</span>
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">{capitalise(row.priority)}</span>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] text-slate-400">{formatDayMonth(row.due_date)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </Panel>

              <Panel title="Research library highlights" viewAllHref="/app/strategy/research" viewAllLabel="Go to research library">
                {researchHighlights.rows.length === 0
                  ? <EmptyState compact title="No research yet" message="Add research to see highlights here." />
                  : (
                    <ul className="space-y-3">
                      {researchHighlights.rows.map(row => (
                        <li key={row.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-slate-800">{row.title}</p>
                            <p className="truncate text-[11px] text-slate-500">
                              {sourceLabel(row.source_type)} · Updated {formatDayMonth(row.updated_at)}
                            </p>
                          </div>
                          {row.impact === 'high' && (
                            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">High impact</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
              </Panel>

              <ActivityPanel rows={activity} viewAllHref="/app/strategy?view=table" />
            </div>

            <Panel
              title="Priority initiatives" viewAllHref="/app/strategy/objectives" viewAllLabel="View all"
              bodyClassName="px-0 pb-0"
            >
              {priorityObjectives.rows.length === 0
                ? <EmptyState compact title="No priority initiatives" message="High-priority objectives across your strategy will appear here." className="px-4 pb-4" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-t border-slate-100 text-[11px] text-slate-400">
                          <th className="px-4 py-2.5 font-medium">Initiative</th>
                          <th className="px-2 py-2.5 font-medium">Owner</th>
                          <th className="px-2 py-2.5 font-medium">Status</th>
                          <th className="px-2 py-2.5 font-medium">Progress</th>
                          <th className="px-2 py-2.5 font-medium">Due date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {priorityObjectives.rows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <Link href="/app/strategy/objectives" className="font-medium text-slate-800 hover:text-blue-600">{row.name}</Link>
                            </td>
                            <td className="px-2 py-2.5"><OwnerChip person={row.owner} /></td>
                            <td className="px-2 py-2.5">
                              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${STATUS_COLOUR[row.status] ?? '#cbd5e1'}1a`, color: STATUS_COLOUR[row.status] ?? '#64748b' }}>
                                {OBJECTIVE_STATUS_LABELS[row.status as keyof typeof OBJECTIVE_STATUS_LABELS] ?? row.status}
                              </span>
                            </td>
                            <td className="w-32 px-2 py-2.5">
                              <div className="flex items-center gap-2">
                                <ProgressBar value={row.progress} status={row.status} className="w-16" />
                                <span className="text-[11px] text-slate-500">{row.progress}%</span>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(row.due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </Panel>
          </>
        )}
    </div>
  )
}

function ObjectivesTablePreview({ objectives }: { objectives: Awaited<ReturnType<typeof listObjectives>>['rows'] }) {
  if (objectives.length === 0) {
    return <EmptyState title="No strategy records yet" message="Objectives, plans and forecasts will summarise here as your strategy takes shape." />
  }
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Objective</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Progress</th>
              <th className="px-2 py-2.5 font-medium">Due date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {objectives.map(row => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{row.name}</td>
                <td className="px-2 py-2.5"><OwnerChip person={row.owner} /></td>
                <td className="px-2 py-2.5 text-slate-500">{OBJECTIVE_STATUS_LABELS[row.status as keyof typeof OBJECTIVE_STATUS_LABELS] ?? row.status}</td>
                <td className="px-2 py-2.5 text-slate-500">{row.progress}%</td>
                <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(row.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5">
        <PanelFooterLink href="/app/strategy/objectives">Open Objectives</PanelFooterLink>
      </div>
    </Panel>
  )
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ')
}

function sourceLabel(value: string): string {
  return value.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
