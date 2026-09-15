import Link from 'next/link'
import { Download, Plus, Upload, Wand2 } from 'lucide-react'
import { requireStrategyModule, listWorkspacePeople } from '@/lib/strategy/server'
import {
  listActivity, listObjectives, objectiveAggregates, objectiveStatusCounts, resolveLinks,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import {
  OBJECTIVE_BOARD_STATUSES, OBJECTIVE_STATUS_BADGE, OBJECTIVE_STATUS_LABELS,
  OBJECTIVE_TYPE_LABELS, OBJECTIVE_TYPES, confidenceBand, PRIORITY_LABELS,
  STRATEGY_MODULE_META, STRATEGY_PRIORITIES, type ObjectiveStatus,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import FilterBar, { FilterChips, type FilterField } from '@/components/strategy/FilterBar'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import {
  Panel, PanelFooterLink, STRATEGY_PAGE, ProgressBar, OwnerChip, formatDayMonth, CARD, CARD_SHADOW,
} from '@/components/strategy/primitives'
import { DonutChart, DonutLegend, TrendChart } from '@/components/strategy/charts'
import { cn } from '@/lib/utils'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Objectives · Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.objectives.description,
}

const STATUS_COLOUR: Record<string, string> = {
  on_track: '#10b981', at_risk: '#f59e0b', off_track: '#ef4444',
  not_started: '#cbd5e1', draft: '#cbd5e1', completed: '#3b82f6', archived: '#94a3b8',
}

export default async function ObjectivesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStrategyModule('objectives')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="objectives" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['cards', 'table', 'timeline', 'kanban'], defaultView: 'cards' })

  const [page, people, stats, aggregates, activity] = await Promise.all([
    listObjectives(supabase, ctx.workspaceId, query, { paginate: query.view !== 'kanban', limit: query.view === 'kanban' ? 200 : undefined }),
    listWorkspacePeople(supabase, ctx.workspaceId),
    objectiveStatusCounts(supabase, ctx.workspaceId),
    objectiveAggregates(supabase, ctx.workspaceId),
    listActivity(supabase, ctx.workspaceId, { entityTypes: ['objective'], limit: 5 }),
  ])

  const links = await resolveLinks(supabase, ctx.workspaceId, 'objective', page.rows.map(row => row.id))
  const objectives = page.rows.map(row => ({
    ...row,
    linkedAudiences: links[row.id]?.audiences ?? [],
    linkedPlans: links[row.id]?.plans ?? [],
  }))

  const completedThisQuarter = stats.counts.completed ?? 0
  const onTrackPct = stats.total ? Math.round(((stats.counts.on_track ?? 0) / stats.total) * 100) : 0
  const atRiskPct = stats.total ? Math.round(((stats.counts.at_risk ?? 0) / stats.total) * 100) : 0
  const completedPct = stats.total ? Math.round((completedThisQuarter / stats.total) * 100) : 0

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total objectives', value: String(stats.total), tone: 'blue', icon: 'sparkles' },
    { id: 'on_track', label: 'On track', value: `${stats.counts.on_track ?? 0} (${onTrackPct}%)`, tone: 'green', icon: 'target' },
    { id: 'at_risk', label: 'At risk', value: `${stats.counts.at_risk ?? 0} (${atRiskPct}%)`, tone: 'amber', icon: 'alert' },
    { id: 'completed', label: 'Completed this quarter', value: `${completedThisQuarter} (${completedPct}%)`, tone: 'violet', icon: 'check' },
    { id: 'confidence', label: 'Avg. confidence', value: `${aggregates.avgConfidence}%`, tone: 'blue', icon: 'gauge' },
    { id: 'plans', label: 'Linked plans', value: String(new Set(objectives.flatMap(o => o.linkedPlans?.map(p => p.id) ?? [])).size), tone: 'amber', icon: 'link' },
  ]

  const filterFields: FilterField[] = [
    { key: 'type', label: 'Type', options: OBJECTIVE_TYPES.map(value => ({ value, label: OBJECTIVE_TYPE_LABELS[value] })) },
    { key: 'owner', label: 'Owner', options: people.map(p => ({ value: p.id, label: p.full_name ?? p.email ?? 'Unknown' })) },
    { key: 'status', label: 'Status', options: OBJECTIVE_BOARD_STATUSES.map(value => ({ value, label: OBJECTIVE_STATUS_LABELS[value] })) },
    { key: 'priority', label: 'Priority', options: STRATEGY_PRIORITIES.map(value => ({ value, label: PRIORITY_LABELS[value] })) },
  ]

  const statusSlices = [
    { key: 'on_track', label: 'On track', value: stats.counts.on_track ?? 0, colour: STATUS_COLOUR.on_track },
    { key: 'at_risk', label: 'At risk', value: stats.counts.at_risk ?? 0, colour: STATUS_COLOUR.at_risk },
    { key: 'completed', label: 'Completed', value: stats.counts.completed ?? 0, colour: STATUS_COLOUR.completed },
  ]

  const trend = [
    { label: 'On track', on_track: stats.counts.on_track ?? 0, at_risk: stats.counts.at_risk ?? 0, completed: stats.counts.completed ?? 0 },
  ]

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="objectives" modules={modules}
        actions={(
          <>
            {capabilities.createObjective && (
              <Link href="/app/strategy/objectives?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New objective
              </Link>
            )}
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <Upload size={15} /> Import
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <Wand2 size={15} /> Bulk update
            </button>
            {capabilities.export && (
              <Link href="/app/strategy/objectives?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Download size={15} /> Export
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <FilterBar query={query} fields={filterFields} />
        <ViewSwitcher views={['cards', 'table', 'timeline', 'kanban']} active={query.view} />
      </div>
      <FilterChips query={query} fields={filterFields} />

      <div className="mt-4">
        {objectives.length === 0
          ? (
            <EmptyState
              title="No objectives yet"
              message="Create your first strategic objective to start tracking progress toward growth."
              action={capabilities.createObjective && (
                <Link href="/app/strategy/objectives?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                  <Plus size={15} /> New objective
                </Link>
              )}
            />
          )
          : query.view === 'table'
          ? <ObjectivesTable objectives={objectives} />
          : query.view === 'kanban'
          ? <ObjectivesKanban objectives={objectives} />
          : query.view === 'timeline'
          ? <ObjectivesTimeline objectives={objectives} />
          : <ObjectivesCards objectives={objectives} />}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Objective performance trend" viewAllHref="/app/strategy/objectives?view=table" viewAllLabel="View full report">
          <TrendChart
            data={trend} xKey="label"
            series={[
              { key: 'on_track', label: 'On track', colour: '#10b981' },
              { key: 'at_risk', label: 'At risk', colour: '#f59e0b' },
              { key: 'completed', label: 'Completed', colour: '#6366f1' },
            ]}
            height={170}
          />
        </Panel>

        <Panel title="Objectives by status" viewAllHref="/app/strategy/objectives?view=table" viewAllLabel="View breakdown">
          <div className="flex items-center gap-4">
            <DonutChart slices={statusSlices} total={stats.total} centreValue={String(stats.total)} centreSub="Total" size={130} />
            <DonutLegend slices={statusSlices} total={stats.total} />
          </div>
        </Panel>

        <ActivityPanel rows={activity} viewAllHref="/app/strategy/objectives?view=table" />
      </div>

      <Panel
        title="Priority objectives" viewAllHref="/app/strategy/objectives?sort=priority" viewAllLabel="View all"
        bodyClassName="px-0 pb-0" className="mt-4"
      >
        <PriorityTable objectives={objectives} />
      </Panel>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant = OBJECTIVE_STATUS_BADGE[status as ObjectiveStatus] ?? 'slate'
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', slate: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tones[variant])}>
      {OBJECTIVE_STATUS_LABELS[status as ObjectiveStatus] ?? status}
    </span>
  )
}

type ObjRow = Awaited<ReturnType<typeof listObjectives>>['rows'][number] & {
  linkedAudiences: { id: string; name: string }[]
  linkedPlans: { id: string; name: string }[]
}

function ObjectivesCards({ objectives }: { objectives: ObjRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {objectives.map(objective => (
        <div key={objective.id} className={cn(CARD, CARD_SHADOW, 'flex flex-col p-4')}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold leading-snug text-slate-900">{objective.name}</h3>
            <StatusBadge status={objective.status} />
          </div>
          <span className="mb-2 inline-flex w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {OBJECTIVE_TYPE_LABELS[objective.objective_type as keyof typeof OBJECTIVE_TYPE_LABELS] ?? objective.objective_type}
          </span>

          <OwnerChip person={objective.owner} className="mb-2.5" />

          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{objective.progress}%</span>
          </div>
          <ProgressBar value={objective.progress} status={objective.status} className="mb-2.5" />

          <div className="mb-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Linked audiences</span>
            <span className="font-medium text-slate-700">{objective.linkedAudiences.length}</span>
          </div>
          <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Linked plans</span>
            <span className="font-medium text-slate-700">{objective.linkedPlans.length}</span>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
            <span className="text-slate-400">Due {formatDayMonth(objective.due_date)}</span>
            {objective.next_action && <span className="truncate text-slate-500">{objective.next_action}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function ObjectivesTable({ objectives }: { objectives: ObjRow[] }) {
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Objective</th>
              <th className="px-2 py-2.5 font-medium">Type</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Progress</th>
              <th className="px-2 py-2.5 font-medium">Confidence</th>
              <th className="px-2 py-2.5 font-medium">Due date</th>
              <th className="px-4 py-2.5 font-medium">Last updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {objectives.map(objective => {
              const confidence = confidenceBand(objective.confidence)
              return (
                <tr key={objective.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{objective.name}</td>
                  <td className="px-2 py-2.5 text-slate-500">{OBJECTIVE_TYPE_LABELS[objective.objective_type as keyof typeof OBJECTIVE_TYPE_LABELS] ?? objective.objective_type}</td>
                  <td className="px-2 py-2.5"><OwnerChip person={objective.owner} /></td>
                  <td className="px-2 py-2.5"><StatusBadge status={objective.status} /></td>
                  <td className="w-28 px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={objective.progress} status={objective.status} className="w-14" />
                      <span className="text-[11px] text-slate-500">{objective.progress}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-slate-500">{confidence.label}</td>
                  <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(objective.due_date)}</td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDayMonth(objective.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function ObjectivesTimeline({ objectives }: { objectives: ObjRow[] }) {
  const dated = objectives.filter(o => o.start_date || o.due_date)
  if (dated.length === 0) {
    return <EmptyState title="No dated objectives" message="Objectives need a start or due date to appear on the timeline." />
  }
  const dates = dated.flatMap(o => [o.start_date, o.due_date]).filter(Boolean) as string[]
  const min = new Date(Math.min(...dates.map(d => new Date(d).getTime())))
  const max = new Date(Math.max(...dates.map(d => new Date(d).getTime())))
  const span = Math.max(1, max.getTime() - min.getTime())

  return (
    <Panel bodyClassName="px-4 pb-4">
      <div className="space-y-3">
        {dated.map(objective => {
          const start = objective.start_date ? new Date(objective.start_date) : min
          const end = objective.due_date ? new Date(objective.due_date) : max
          const left = ((start.getTime() - min.getTime()) / span) * 100
          const width = Math.max(2, ((end.getTime() - start.getTime()) / span) * 100)
          return (
            <div key={objective.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-[12px] font-medium text-slate-700">{objective.name}</span>
              <div className="relative h-5 flex-1 rounded bg-slate-50">
                <div
                  className="absolute inset-y-0 rounded"
                  style={{ left: `${left}%`, width: `${width}%`, background: STATUS_COLOUR[objective.status] ?? '#94a3b8' }}
                  title={`${formatDayMonth(objective.start_date)} – ${formatDayMonth(objective.due_date)}`}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[11px] text-slate-400">{formatDayMonth(objective.due_date)}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function ObjectivesKanban({ objectives }: { objectives: ObjRow[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {OBJECTIVE_BOARD_STATUSES.map(status => {
        const columnItems = objectives.filter(o => o.status === status)
        return (
          <div key={status} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-slate-700">{OBJECTIVE_STATUS_LABELS[status]}</span>
              <span className="text-[11px] text-slate-400">{columnItems.length}</span>
            </div>
            <div className="space-y-2">
              {columnItems.map(objective => (
                <div key={objective.id} className={cn(CARD, CARD_SHADOW, 'p-3')}>
                  <p className="mb-2 text-[12px] font-medium leading-snug text-slate-800">{objective.name}</p>
                  <OwnerChip person={objective.owner} className="mb-2" />
                  <ProgressBar value={objective.progress} status={objective.status} />
                </div>
              ))}
              {columnItems.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
                  No objectives
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PriorityTable({ objectives }: { objectives: ObjRow[] }) {
  const priority = [...objectives]
    .filter(o => o.priority === 'high' || o.priority === 'urgent')
    .slice(0, 6)
  if (priority.length === 0) {
    return <EmptyState compact title="No priority objectives" message="High-priority objectives will appear here." className="px-4 pb-4" />
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Objective</th>
              <th className="px-2 py-2.5 font-medium">Type</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Progress</th>
              <th className="px-2 py-2.5 font-medium">Confidence</th>
              <th className="px-2 py-2.5 font-medium">Linked audiences</th>
              <th className="px-2 py-2.5 font-medium">Linked plans</th>
              <th className="px-2 py-2.5 font-medium">Due date</th>
              <th className="px-4 py-2.5 font-medium">Last updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {priority.map(objective => {
              const confidence = confidenceBand(objective.confidence)
              return (
                <tr key={objective.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{objective.name}</td>
                  <td className="px-2 py-2.5 text-slate-500">{OBJECTIVE_TYPE_LABELS[objective.objective_type as keyof typeof OBJECTIVE_TYPE_LABELS] ?? objective.objective_type}</td>
                  <td className="px-2 py-2.5"><OwnerChip person={objective.owner} /></td>
                  <td className="px-2 py-2.5"><StatusBadge status={objective.status} /></td>
                  <td className="px-2 py-2.5 text-slate-500">{objective.progress}%</td>
                  <td className="px-2 py-2.5 text-slate-500">{confidence.label}</td>
                  <td className="px-2 py-2.5 text-slate-500">{objective.linkedAudiences.length}</td>
                  <td className="px-2 py-2.5 text-slate-500">{objective.linkedPlans.length}</td>
                  <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(objective.due_date)}</td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDayMonth(objective.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5">
        <PanelFooterLink href="/app/strategy/objectives?sort=priority">View all priority objectives</PanelFooterLink>
      </div>
    </>
  )
}
