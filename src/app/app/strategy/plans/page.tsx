import Link from 'next/link'
import { Download, Plus, UserPlus } from 'lucide-react'
import { requireStrategyModule, listWorkspacePeople } from '@/lib/strategy/server'
import {
  listActivity, listCapacity, listHighPriorityItems, listPlanDependencies, listPlanItems,
  listPlanRisks, listPlans, listUpcomingMilestones, planAggregates,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import {
  PLAN_ITEM_STATUS_LABELS, PLAN_STATUS_BADGE, PLAN_STATUS_COLOUR, PLAN_STATUS_LABELS,
  RISK_BADGE, RISK_LABELS, STRATEGY_MODULE_META,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import FilterBar, { type FilterField } from '@/components/strategy/FilterBar'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import {
  Avatar, CARD, CARD_SHADOW, OwnerChip, Panel, ProgressBar, STRATEGY_PAGE,
  formatCompactMoney, formatDayMonth, formatDueIn,
} from '@/components/strategy/primitives'
import { CapacityChart, DonutChart, DonutLegend } from '@/components/strategy/charts'
import { cn } from '@/lib/utils'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Plans · Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.plans.description,
}

const STATUS_TONE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', slate: 'bg-slate-100 text-slate-500',
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access, workspace } = await requireStrategyModule('plans')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="plans" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['gantt', 'cards', 'table', 'calendar'], defaultView: 'gantt' })

  const [page, people, aggregates, milestones, risks, dependencies, capacity, activity, priorityItems] = await Promise.all([
    listPlans(supabase, ctx.workspaceId, query, { paginate: query.view === 'table', limit: query.view !== 'table' ? 40 : undefined }),
    listWorkspacePeople(supabase, ctx.workspaceId),
    planAggregates(supabase, ctx.workspaceId),
    listUpcomingMilestones(supabase, ctx.workspaceId, 5),
    listPlanRisks(supabase, ctx.workspaceId, 6),
    listPlanDependencies(supabase, ctx.workspaceId, 8),
    listCapacity(supabase, ctx.workspaceId),
    listActivity(supabase, ctx.workspaceId, { entityTypes: ['plan', 'plan_item'], limit: 5 }),
    listHighPriorityItems(supabase, ctx.workspaceId, 6),
  ])

  const items = await listPlanItems(supabase, ctx.workspaceId, page.rows.map(row => row.id))

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active plans', value: String(aggregates.activePlans), tone: 'blue', icon: 'sparkles' },
    { id: 'milestones', label: 'Milestones due', value: String(aggregates.milestonesDue), hint: 'This month', tone: 'green', icon: 'star' },
    { id: 'blocked', label: 'Blocked items', value: String(aggregates.blocked), tone: 'red', icon: 'alert' },
    { id: 'completion', label: 'Completion rate', value: `${aggregates.completion}%`, tone: 'green', icon: 'target' },
    { id: 'budget', label: 'Budget alignment', value: `${aggregates.budgetAlignment}%`, tone: 'violet', icon: 'wallet' },
    { id: 'dependency', label: 'Dependency risk', value: aggregates.dependencyRisk, tone: aggregates.dependencyRisk === 'High' ? 'red' : aggregates.dependencyRisk === 'Medium' ? 'amber' : 'green', icon: 'link' },
  ]

  const filterFields: FilterField[] = [
    { key: 'status', label: 'Status', options: [
      { value: 'not_started', label: 'Not started' }, { value: 'on_track', label: 'On track' },
      { value: 'at_risk', label: 'At risk' }, { value: 'off_track', label: 'Off track' }, { value: 'completed', label: 'Completed' },
    ] },
    { key: 'owner', label: 'Owner', options: people.map(p => ({ value: p.id, label: p.full_name ?? p.email ?? 'Unknown' })) },
  ]

  const statusSlices = [
    { key: 'on_track', label: 'On track', value: aggregates.statusCounts.on_track ?? 0, colour: PLAN_STATUS_COLOUR.on_track },
    { key: 'at_risk', label: 'At risk', value: aggregates.statusCounts.at_risk ?? 0, colour: PLAN_STATUS_COLOUR.at_risk },
    { key: 'off_track', label: 'Off track', value: aggregates.statusCounts.off_track ?? 0, colour: PLAN_STATUS_COLOUR.off_track },
    { key: 'not_started', label: 'Not started', value: aggregates.statusCounts.not_started ?? 0, colour: PLAN_STATUS_COLOUR.not_started },
  ]

  const capacityData = capacity.map(row => ({
    label: formatDayMonth(row.period_start), allocated: row.allocated, capacity: row.capacity,
    utilisation: row.capacity > 0 ? Math.round((row.allocated / row.capacity) * 100) : 0,
  }))

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="plans" modules={modules}
        actions={(
          <>
            {capabilities.createPlan && (
              <Link href="/app/strategy/plans?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New plan
              </Link>
            )}
            {capabilities.editPlan && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Plus size={15} /> Add milestone
              </button>
            )}
            {capabilities.editPlan && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <UserPlus size={15} /> Assign owner
              </button>
            )}
            {capabilities.export && (
              <Link href="/app/strategy/plans?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Download size={15} /> Export
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar query={query} fields={filterFields} />
        <ViewSwitcher views={['gantt', 'cards', 'table', 'calendar']} active={query.view} />
      </div>

      {page.rows.length === 0
        ? (
          <EmptyState
            title="No plans yet"
            message="Create a plan to break strategic priorities into milestones and accountable work."
            action={capabilities.createPlan && (
              <Link href="/app/strategy/plans?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New plan
              </Link>
            )}
          />
        )
        : query.view === 'table'
        ? <PlansTable plans={page.rows} />
        : query.view === 'cards'
        ? <PlansCards plans={page.rows} currency={workspace.currency} />
        : query.view === 'calendar'
        ? <PlansCalendar items={items} />
        : <PlansGantt plans={page.rows} items={items} />}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Plan progress" bodyClassName="flex items-center gap-4">
          <DonutChart
            slices={statusSlices} total={page.total} centreValue={`${aggregates.completion}%`}
            centreSub="Avg completion" size={120}
          />
          <DonutLegend slices={statusSlices} total={page.total} />
        </Panel>

        <Panel title="Capacity overview" info="Team workload vs capacity" viewAllHref="/app/strategy/plans?view=table" viewAllLabel="View capacity">
          <CapacityChart data={capacityData} height={130} />
        </Panel>

        <Panel title="Upcoming milestones" viewAllHref="/app/strategy/plans?view=calendar" viewAllLabel="View milestones">
          {milestones.length === 0
            ? <EmptyState compact title="No upcoming milestones" message="Milestones due soon will appear here." />
            : (
              <ul className="space-y-2.5">
                {milestones.map(item => (
                  <li key={item.id} className="flex items-start justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{item.title}</p>
                      <p className="truncate text-slate-400">{item.plan?.name}</p>
                    </div>
                    <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600">{formatDueIn(item.due_date)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Risk items" viewAllHref="/app/strategy/plans?view=table" viewAllLabel="View all risks">
          {risks.length === 0
            ? <EmptyState compact title="No open risks" message="Risks flagged on plans will appear here." />
            : (
              <ul className="space-y-2.5">
                {risks.map(risk => (
                  <li key={risk.id} className="flex items-start justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{risk.title}</p>
                      <p className="truncate text-slate-400">{risk.plan?.name}</p>
                    </div>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 font-medium', STATUS_TONE[RISK_BADGE[risk.severity as keyof typeof RISK_BADGE] ?? 'slate'])}>
                      {RISK_LABELS[risk.severity as keyof typeof RISK_LABELS] ?? risk.severity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="Strategic dependencies" viewAllHref="/app/strategy/plans?view=table" viewAllLabel="View all dependencies">
          {dependencies.length === 0
            ? <EmptyState compact title="No dependencies" message="Dependencies between plans will appear here." />
            : (
              <ul className="space-y-2.5">
                {dependencies.map(dep => (
                  <li key={dep.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-slate-700">
                      {dep.plan?.name} <span className="text-slate-400">→</span> {dep.dependsOn?.name}
                    </span>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 font-medium', STATUS_TONE[RISK_BADGE[dep.risk_level as keyof typeof RISK_BADGE] ?? 'slate'])}>
                      {RISK_LABELS[dep.risk_level as keyof typeof RISK_LABELS] ?? dep.risk_level}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <ActivityPanel rows={activity} viewAllHref="/app/strategy/plans?view=table" />
      </div>

      <Panel title="High priority plan items" viewAllHref="/app/strategy/plans?view=table" viewAllLabel="View all high priority items" bodyClassName="px-0 pb-0" className="mt-4">
        {priorityItems.length === 0
          ? <EmptyState compact title="No priority items" message="High-priority tasks and milestones will appear here." className="px-4 pb-4" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-t border-slate-100 text-[11px] text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-2 py-2.5 font-medium">Plan</th>
                    <th className="px-2 py-2.5 font-medium">Type</th>
                    <th className="px-2 py-2.5 font-medium">Status</th>
                    <th className="px-2 py-2.5 font-medium">Owner</th>
                    <th className="px-2 py-2.5 font-medium">Due date</th>
                    <th className="px-4 py-2.5 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {priorityItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{item.title}</td>
                      <td className="px-2 py-2.5 text-slate-500">{item.plan?.name}</td>
                      <td className="px-2 py-2.5 text-slate-500 capitalize">{item.item_type}</td>
                      <td className="px-2 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[PLAN_STATUS_BADGE[item.status as keyof typeof PLAN_STATUS_BADGE] ?? 'slate'])}>
                          {PLAN_ITEM_STATUS_LABELS[item.status as keyof typeof PLAN_ITEM_STATUS_LABELS] ?? item.status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5"><OwnerChip person={item.owner} /></td>
                      <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(item.due_date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 capitalize">{item.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
    </div>
  )
}

type PlanRowT = Awaited<ReturnType<typeof listPlans>>['rows'][number]
type PlanItemT = Awaited<ReturnType<typeof listPlanItems>>[number]

function PlansTable({ plans }: { plans: PlanRowT[] }) {
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Progress</th>
              <th className="px-2 py-2.5 font-medium">Start</th>
              <th className="px-4 py-2.5 font-medium">End</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map(plan => (
              <tr key={plan.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{plan.name}</td>
                <td className="px-2 py-2.5"><Avatar person={plan.owner} size={20} /></td>
                <td className="px-2 py-2.5 text-slate-500">{PLAN_STATUS_LABELS[plan.status as keyof typeof PLAN_STATUS_LABELS] ?? plan.status}</td>
                <td className="w-28 px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={plan.progress} status={plan.status} className="w-14" />
                    <span className="text-[11px] text-slate-500">{plan.progress}%</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-slate-500">{formatDayMonth(plan.start_date)}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatDayMonth(plan.end_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function PlansCards({ plans, currency }: { plans: PlanRowT[]; currency: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {plans.map(plan => (
        <div key={plan.id} className={cn(CARD, CARD_SHADOW, 'p-4')}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-slate-900">{plan.name}</h3>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_TONE[PLAN_STATUS_BADGE[plan.status as keyof typeof PLAN_STATUS_BADGE] ?? 'slate'])}>
              {PLAN_STATUS_LABELS[plan.status as keyof typeof PLAN_STATUS_LABELS] ?? plan.status}
            </span>
          </div>
          <OwnerChip person={plan.owner} className="mb-2.5" />
          <ProgressBar value={plan.progress} status={plan.status} className="mb-2" />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatDayMonth(plan.start_date)} – {formatDayMonth(plan.end_date)}</span>
            {plan.budget ? <span>{formatCompactMoney(plan.budget, currency)}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlansCalendar({ items }: { items: PlanItemT[] }) {
  const milestones = items.filter(item => item.item_type === 'milestone' && item.due_date)
  if (milestones.length === 0) {
    return <EmptyState title="No calendar items" message="Milestones with due dates will appear here." />
  }
  const grouped = new Map<string, PlanItemT[]>()
  for (const item of milestones) {
    const month = (item.due_date ?? '').slice(0, 7)
    if (!grouped.has(month)) grouped.set(month, [])
    grouped.get(month)!.push(item)
  }
  return (
    <Panel bodyClassName="space-y-4">
      {[...grouped.entries()].map(([month, monthItems]) => (
        <div key={month}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01`))}
          </p>
          <ul className="space-y-1.5">
            {monthItems.map(item => (
              <li key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[12px]">
                <span className="font-medium text-slate-700">{item.title}</span>
                <span className="text-slate-400">{formatDayMonth(item.due_date)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Panel>
  )
}

function PlansGantt({ plans, items }: { plans: PlanRowT[]; items: PlanItemT[] }) {
  const dated = [...plans.filter(p => p.start_date && p.end_date).map(p => ({ start: p.start_date as string, end: p.end_date as string }))]
  const itemDated = items.filter(item => item.start_date && item.due_date)
  const allDates = [...dated.flatMap(d => [d.start, d.end]), ...itemDated.flatMap(i => [i.start_date as string, i.due_date as string])]

  if (allDates.length === 0) {
    return <EmptyState title="No dated plans" message="Add start and end dates to plans to see them on the timeline." />
  }

  const min = new Date(Math.min(...allDates.map(d => new Date(d).getTime())))
  const max = new Date(Math.max(...allDates.map(d => new Date(d).getTime())))
  const span = Math.max(1, max.getTime() - min.getTime())
  const today = new Date()
  const todayPct = ((today.getTime() - min.getTime()) / span) * 100

  return (
    <Panel bodyClassName="px-4 pb-4">
      <div className="relative">
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-400" style={{ left: `${todayPct}%` }}>
            <span className="absolute -top-1 -translate-x-1/2 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-medium text-white">Today</span>
          </div>
        )}
        <div className="space-y-4">
          {plans.map(plan => {
            const planItems = items.filter(item => item.plan_id === plan.id)
            const start = plan.start_date ? new Date(plan.start_date) : min
            const end = plan.end_date ? new Date(plan.end_date) : max
            const left = ((start.getTime() - min.getTime()) / span) * 100
            const width = Math.max(2, ((end.getTime() - start.getTime()) / span) * 100)
            return (
              <div key={plan.id}>
                <div className="flex items-center gap-3">
                  <div className="flex w-44 shrink-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PLAN_STATUS_COLOUR[plan.status as keyof typeof PLAN_STATUS_COLOUR] ?? '#94a3b8' }} />
                    <span className="truncate text-[12px] font-semibold text-slate-800">{plan.name}</span>
                  </div>
                  <div className="relative h-6 flex-1 rounded bg-slate-50">
                    <div
                      className="absolute inset-y-0.5 flex items-center rounded px-1.5 text-[10px] font-medium text-white"
                      style={{ left: `${left}%`, width: `${width}%`, background: PLAN_STATUS_COLOUR[plan.status as keyof typeof PLAN_STATUS_COLOUR] ?? '#94a3b8' }}
                    >
                      {plan.progress}%
                    </div>
                  </div>
                </div>

                {planItems.slice(0, 3).map(item => {
                  const iStart = item.start_date ? new Date(item.start_date) : start
                  const iEnd = item.due_date ? new Date(item.due_date) : end
                  const iLeft = ((iStart.getTime() - min.getTime()) / span) * 100
                  const iWidth = item.item_type === 'milestone' ? 0 : Math.max(1.5, ((iEnd.getTime() - iStart.getTime()) / span) * 100)
                  return (
                    <div key={item.id} className="mt-1 flex items-center gap-3">
                      <span className="w-44 shrink-0 truncate pl-3.5 text-[11px] text-slate-500">{item.title}</span>
                      <div className="relative h-4 flex-1 rounded bg-slate-50/60">
                        {item.item_type === 'milestone'
                          ? (
                            <span
                              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 bg-amber-400"
                              style={{ left: `${iLeft}%` }} title={item.title}
                            />
                          )
                          : (
                            <div
                              className="absolute inset-y-0.5 rounded opacity-70"
                              style={{ left: `${iLeft}%`, width: `${iWidth}%`, background: PLAN_STATUS_COLOUR[item.status as keyof typeof PLAN_STATUS_COLOUR] ?? '#cbd5e1' }}
                            />
                          )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </Panel>
  )
}
