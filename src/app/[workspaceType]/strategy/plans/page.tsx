import type { Metadata } from 'next'
import { AlertCircle, CheckSquare, CircleCheck, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import {
  listActivity, listCapacity, listHighPriorityItems, listPlanDependencies, listPlanItems, listPlanRisks, listPlans, listStrategyRecords, listUpcomingMilestones,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { compare, loadSnapshots, refreshSnapshot } from '@/lib/strategy/kpis'
import { average, budgetAlignment, pct, resolveRange } from '@/lib/strategy/metrics'
import { formatDate, formatDueIn, formatMoney, formatRelative, shortName } from '@/lib/strategy/format'
import {
  PLAN_ITEM_STATUS_LABELS, PLAN_STATUS_LABELS, PLAN_STATUSES, PRIORITY_LABELS, RISK_LABELS, strategyPath,
  type PlanItemStatus, type PlanStatus, type RiskLevel, type StrategyPriority,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, RangeFilter, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { Avatar, CARD, FooterLink, Panel, TableScroll } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { CapacityChart, Donut } from '@/components/strategy/charts'
import Pagination from '@/components/strategy/Pagination'
import { StatusChip } from '@/components/strategy/badges'
import { Gantt, PlanItemMenu, PlanStatusMenu, PlansHeaderActions, RiskStatusMenu } from '@/components/strategy/plans/PlansClient'

export const metadata: Metadata = {
  title: 'Plans · Strategy · Caption Fox',
  description: 'Execute strategic priorities through clear plans, milestones, and accountable ownership.',
}

const VIEWS = ['gantt', 'cards', 'table', 'calendar'] as const
const RANGE_PRESETS = [
  { value: 'this_quarter', label: 'This quarter' }, { value: 'this_month', label: 'This month' },
  { value: 'last_quarter', label: 'Last quarter' }, { value: 'this_year', label: 'This year' }, { value: 'all', label: 'All time' },
]
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''
const PRIORITY_TONE: Record<string, string> = { urgent: 'bg-red-100/70 font-medium text-red-700', high: 'bg-red-100/70 font-medium text-red-600', medium: 'bg-orange-100/70 font-medium text-orange-600', low: 'bg-slate-100 font-medium text-slate-500' }
const RISK_TONE: Record<string, string> = { high: 'bg-red-100/70 font-medium text-red-600', medium: 'bg-orange-100/70 font-medium text-orange-600', low: 'bg-emerald-100/70 font-medium text-emerald-700' }

/** Dense desktop spacing for the summary rows below the timeline (design 6). */
const ROW_HEADER = 'lg:pt-[7px]! [&_p]:lg:mt-0!'
const ROW_BODY = 'lg:pt-[4px]! lg:pb-[2px]!'
const ROW_FOOTER = 'lg:pb-[6px]!'

export default async function PlansPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<RawParams> }) {
  const [{ workspaceType: kind }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(kind, 'plans')
  const { supabase, capabilities: can } = page
  const workspaceId = page.workspace.id
  const q = parseStrategyQuery(search, { views: [...VIEWS], defaultView: 'gantt', defaultSort: 'due_soonest' })
  const view = q.view as typeof VIEWS[number]
  const range = resolveRange({ range: one(search.range), from: one(search.from), to: one(search.to) }, 'this_quarter')
  q.from = range.from
  q.to = range.to
  if (q.owner && !page.people.some(person => person.id === q.owner)) q.owner = ''
  q.size = view === 'table' ? 12 : view === 'cards' ? 12 : 50
  const now = new Date()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA')
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')

  const [list, allPlans, allItems, strategies, milestones, risks, dependencies, capacity, highPriority, activity, snapshots] = await Promise.all([
    listPlans(supabase, workspaceId, q, { paginate: view !== 'gantt' && view !== 'calendar', limit: 50 }),
    supabase.from('strategy_plans').select('id, name, status, progress, budget, budget_spent').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
    supabase.from('strategy_plan_items').select('item_type, status, due_date').eq('workspace_id', workspaceId),
    listStrategyRecords(supabase, workspaceId),
    listUpcomingMilestones(supabase, workspaceId, 3),
    listPlanRisks(supabase, workspaceId, 3),
    listPlanDependencies(supabase, workspaceId, 20),
    listCapacity(supabase, workspaceId),
    listHighPriorityItems(supabase, workspaceId, 4),
    listActivity(supabase, workspaceId, { limit: 4, surface: 'plans' }),
    loadSnapshots(supabase, workspaceId, now),
  ])
  const rows = list.rows
  const items = view === 'gantt' || view === 'calendar' || view === 'cards' ? await listPlanItems(supabase, workspaceId, rows.map(row => row.id)) : []

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const planRows = (allPlans.data ?? []) as { id: string; name: string; status: string; progress: number; budget: number | null; budget_spent: number }[]
  const itemRows = (allItems.data ?? []) as { item_type: string; status: string; due_date: string | null }[]
  const activePlans = planRows.filter(row => row.status !== 'completed').length
  const milestonesDue = itemRows.filter(row => row.item_type === 'milestone' && row.status !== 'completed' && row.due_date && row.due_date >= monthStartIso && row.due_date <= monthEnd).length
  const blocked = itemRows.filter(row => row.status === 'blocked').length
  const completion = planRows.length ? Math.round(average(planRows.map(row => row.progress))) : 0
  const alignment = budgetAlignment(planRows.map(row => ({ budget: row.budget, spent: Number(row.budget_spent), progress: row.progress })))
  const highDeps = dependencies.filter(row => row.risk_level === 'high').length
  const mediumDeps = dependencies.filter(row => row.risk_level === 'medium').length
  const depRisk = highDeps > 0 ? 'High' : mediumDeps > 1 ? 'Medium' : 'Low'
  const metrics = { plans_active: activePlans, plans_blocked: blocked, plans_completion: completion, plans_budget_alignment: alignment, plans_milestones_due: milestonesDue, plans_dependency_high: highDeps }
  await refreshSnapshot(supabase, workspaceId, snapshots.current, metrics, now)
  const d = (key: keyof typeof metrics, value: number, comparison = 'vs last month', unit = '', good: 'up' | 'down' = 'up') => {
    const change = compare(value, snapshots.lastMonth, key)
    return change ? { value: change.value, unit, comparison, good } : null
  }
  const kpis: KpiItem[] = [
    { id: 'active', label: 'Active plans', value: activePlans, icon: 'sparkles', tone: 'blue', delta: d('plans_active', activePlans) },
    { id: 'milestones', label: 'Milestones due', value: milestonesDue, icon: 'star', tone: 'green', delta: d('plans_milestones_due', milestonesDue, 'this month'), note: 'This month' },
    { id: 'blocked', label: 'Blocked items', value: blocked, icon: 'alert', tone: 'red', delta: d('plans_blocked', blocked, 'vs last month', '', 'down') },
    { id: 'completion', label: 'Completion rate', value: `${completion}%`, icon: 'check', tone: 'green', delta: d('plans_completion', completion, 'vs last month', 'pp') },
    { id: 'budget', label: 'Budget alignment', value: `${alignment}%`, icon: 'user', tone: 'violet', delta: d('plans_budget_alignment', alignment, 'vs last month', 'pp') },
    { id: 'dependency', label: 'Dependency risk', value: depRisk, icon: 'network', tone: 'orange',
      note: highDeps ? `${highDeps} high-risk dependenc${highDeps === 1 ? 'y' : 'ies'}` : `${dependencies.length} tracked`, noteTone: highDeps ? 'red' : 'muted' },
  ]

  const statusCounts = (['on_track', 'at_risk', 'off_track', 'not_started'] as const).map(status => ({
    key: status, label: PLAN_STATUS_LABELS[status], value: planRows.filter(row => row.status === status).length,
    colour: { on_track: '#22c55e', at_risk: '#f59e0b', off_track: '#ef4444', not_started: '#cbd5e1' }[status as 'on_track'] ?? '#cbd5e1',
  }))
  const capacityRows = capacity.slice(-3).map(row => ({ label: new Date(`${row.period_start}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }), allocated: Number(row.allocated), capacity: Number(row.capacity) }))

  const pathname = strategyPath(kind, 'plans')
  const queryState = Object.fromEntries(Object.entries(search).map(([key, value]) => [key, one(value)]))
  const filtered = Boolean(q.status || q.owner || q.strategy || one(search.range) || q.archived)
  const menuCan = { create: can.createPlan, edit: can.editPlan, dependencies: can.manageDependencies, export: can.export }
  const planOptions = planRows.map(row => ({ id: row.id, name: row.name }))
  const empty = <EmptyState filtered={filtered} title={filtered ? 'No plans in this range' : 'No plans yet'} description={filtered ? 'Widen the date range or clear filters.' : 'Create a plan to schedule delivery against your objectives.'} />

  let body: React.ReactNode
  if (!rows.length) body = <div className={cn(CARD, 'mt-3')}>{empty}</div>
  else if (view === 'gantt') {
    body = (
      <section className={cn(CARD, 'mt-3 lg:mt-[12px]')} aria-label="Plan timeline">
        <Gantt plans={rows} items={items} people={page.people} canEdit={can.editPlan} dependencies={dependencies} previewLimit={5} />
      </section>
    )
  } else if (view === 'cards') {
    body = (
      <>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map(plan => {
            const planItems = items.filter(item => item.plan_id === plan.id)
            return (
              <li key={plan.id} className={cn(CARD, 'p-4')}>
                <div className="flex items-start gap-2"><h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-sg-ink">{plan.name}</h3><PlanStatusMenu plan={plan} canEdit={can.editPlan} /></div>
                <p className="mt-1 truncate text-[12px] text-sg-muted">{plan.strategy?.name ?? 'No strategy'} · {plan.target_summary ?? 'No target'}</p>
                <div className="mt-3 flex items-center gap-2"><StatusChip status={plan.status} label={PLAN_STATUS_LABELS[plan.status as PlanStatus]} /><span className="ml-auto text-[12px] tabular-nums text-sg-body">{plan.progress}%</span></div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${plan.progress}%` }} /></span>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div><dt className="text-sg-muted">Budget</dt><dd className="text-sg-ink">{formatMoney(plan.budget, plan.currency)}</dd></div>
                  <div><dt className="text-sg-muted">Spent</dt><dd className="text-sg-ink">{formatMoney(plan.budget_spent, plan.currency)}</dd></div>
                  <div><dt className="text-sg-muted">Due</dt><dd className="text-sg-ink">{formatDate(plan.end_date)}</dd></div>
                  <div><dt className="text-sg-muted">Items</dt><dd className="text-sg-ink">{planItems.length}</dd></div>
                </dl>
                <p className="mt-3 flex items-center gap-2 text-[12px] text-sg-body"><Avatar person={plan.owner} size={20} />{shortName(plan.owner?.full_name)}</p>
              </li>
            )
          })}
        </ul>
        <Pagination pathname={pathname} params={queryState} page={q.page} size={q.size} total={list.total} label="plans" />
      </>
    )
  } else if (view === 'table') {
    body = (
      <Panel className="mt-3" title="All plans" subtitle={`${list.total} plans`}>
        <TableScroll label="Plans">
          <table className="w-full min-w-[1000px] border-collapse text-[12.5px] text-sg-body lg:text-[10px]">
            <caption className="sr-only">Plans</caption>
            <thead><tr className="text-left text-sg-muted">{['Plan', 'Strategy', 'Owner', 'Status', 'Progress', 'Budget', 'Spent', 'Priority', 'Start', 'End'].map(label => <th key={label} scope="col" className="whitespace-nowrap py-2 pr-3 font-normal">{label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map(plan => (
                <tr key={plan.id} className="h-12 border-t border-sg-line-soft lg:h-9">
                  <td className="pr-3 font-medium text-sg-ink">{plan.name}</td>
                  <td className="pr-3">{plan.strategy?.name ?? '—'}</td>
                  <td className="pr-3"><span className="flex items-center gap-1.5 whitespace-nowrap"><Avatar person={plan.owner} size={18} />{shortName(plan.owner?.full_name)}</span></td>
                  <td className="pr-3"><StatusChip status={plan.status} label={PLAN_STATUS_LABELS[plan.status as PlanStatus]} /></td>
                  <td className="pr-3 tabular-nums">{plan.progress}%</td>
                  <td className="whitespace-nowrap pr-3 tabular-nums">{formatMoney(plan.budget, plan.currency)}</td>
                  <td className="whitespace-nowrap pr-3 tabular-nums">{formatMoney(plan.budget_spent, plan.currency)}</td>
                  <td className="pr-3"><span className={cn('rounded px-1.5 text-[11px] lg:text-[9px]', PRIORITY_TONE[plan.priority])}>{PRIORITY_LABELS[plan.priority as StrategyPriority]}</span></td>
                  <td className="whitespace-nowrap pr-3">{formatDate(plan.start_date)}</td>
                  <td className="whitespace-nowrap pr-3">{formatDate(plan.end_date)}</td>
                  <td className="text-right"><PlanStatusMenu plan={plan} canEdit={can.editPlan} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <Pagination pathname={pathname} params={queryState} page={q.page} size={q.size} total={list.total} label="plans" />
      </Panel>
    )
  } else {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, index) => index - lead + 1)
    const byDay = new Map<number, typeof items>()
    for (const item of items) {
      if (!item.due_date) continue
      const date = new Date(`${item.due_date}T00:00:00`)
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) byDay.set(date.getDate(), [...(byDay.get(date.getDate()) ?? []), item])
    }
    body = (
      <Panel className="mt-3" title={now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} subtitle="Milestones and item due dates this month">
        <div className="overflow-x-auto" role="region" aria-label="Plan calendar" tabIndex={0}>
          <div className="grid min-w-[760px] grid-cols-7 border-l border-t border-sg-line">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="border-b border-r border-sg-line bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-sg-muted">{day}</div>)}
            {cells.map((day, index) => (
              <div key={index} className={cn('min-h-[96px] border-b border-r border-sg-line p-1.5', (day < 1 || day > days) && 'bg-slate-50/60')}>
                {day >= 1 && day <= days && (
                  <>
                    <p className={cn('text-[11px]', day === now.getDate() ? 'font-semibold text-sg-blue' : 'text-sg-muted')}>{day}</p>
                    <ul className="mt-1 space-y-1">
                      {(byDay.get(day) ?? []).slice(0, 3).map(item => (
                        <li key={item.id} className={cn('truncate rounded px-1 text-[10.5px]', item.item_type === 'milestone' ? 'bg-sg-blue-soft text-sg-blue' : 'bg-slate-100 text-sg-body')} title={`${item.title} · ${item.plan?.name ?? ''}`}>{item.title}</li>
                      ))}
                      {(byDay.get(day) ?? []).length > 3 && <li className="text-[10px] text-sg-muted">+{(byDay.get(day) ?? []).length - 3} more</li>}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <>
      <StrategyHeader kind={kind} module="plans" modules={page.modules}
        actions={<PlansHeaderActions plans={planOptions} strategies={strategies.rows.map(row => ({ id: row.id, name: row.name }))} people={page.people} can={menuCan} />} />
      {list.error && <div className="mb-3"><PanelError message="Plans could not load. Refresh to try again." /></div>}
      <KpiStrip items={kpis} itemClassName="lg:h-[72px]! lg:py-[7px]!" />

      <div className="mt-4 flex flex-col gap-2 lg:mt-[13px] xl:flex-row xl:items-center xl:gap-[10px]">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-[10px]">
          <SelectFilter param="strategy" labelText="Strategy" allLabel="All plans" icon="layers" className="lg:w-[116px]" options={strategies.rows.map(row => ({ value: row.id, label: row.name }))} />
          <SelectFilter param="owner" labelText="Owner" allLabel="All owners" icon="user" className="lg:w-[124px]" options={page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
          <SelectFilter param="status" labelText="Status" allLabel="All statuses" icon="user" className="lg:w-[126px]" options={PLAN_STATUSES.filter(value => value !== 'archived').map(value => ({ value, label: PLAN_STATUS_LABELS[value] }))} />
          <RangeFilter presets={RANGE_PRESETS} fallbackLabel={range.label} className="lg:w-[214px]" />
          <MoreFilters fields={[{ param: 'archived', label: 'Archive', options: [{ value: '1', label: 'Archived only' }] }]} />
          <ClearFilters keys={['strategy', 'owner', 'status', 'range', 'from', 'to', 'archived']} />
        </div>
        <ViewSwitcher current={view} defaultView="gantt" views={[{ id: 'gantt', label: 'Gantt' }, { id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }, { id: 'calendar', label: 'Calendar' }]} />
      </div>

      {body}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-[12px] xl:grid-cols-5 xl:gap-[13px]">
        <Panel title="Plan progress" headerClassName={ROW_HEADER} bodyClassName={ROW_BODY} footerClassName={ROW_FOOTER} footer={<FooterLink href={`${pathname}?view=table`}>View all plans</FooterLink>}>
          {planRows.length ? (
            <div className="flex items-center gap-4 lg:gap-[14px]">
              <Donut caption="Plans by status" size={80} thickness={10} slices={statusCounts}
                center={<><span className="text-[15px] font-semibold leading-none text-sg-ink">{completion}%</span><span className="mt-0.5 text-[7.5px] leading-tight text-sg-muted">Average<br />completion</span></>} />
              <ul className="flex-1 space-y-2 lg:space-y-[6px]">
                {statusCounts.map(item => (
                  <li key={item.key} className="flex items-center gap-1.5 text-[11.5px] text-sg-body lg:text-[8.5px]">
                    <i aria-hidden className="h-2 w-2 rounded-full" style={{ background: item.colour }} /><span className="flex-1">{item.label}</span><span className="tabular-nums">{item.value} ({pct(item.value, planRows.length)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <EmptyState compact title="No plans yet" />}
        </Panel>
        <Panel title="Capacity overview" subtitle="Team workload vs capacity" headerClassName={ROW_HEADER} bodyClassName={ROW_BODY} footerClassName={ROW_FOOTER} footer={<FooterLink href={`${pathname}?view=calendar`}>View capacity</FooterLink>}>
          {capacityRows.length ? (
            <>
              <CapacityChart caption="Allocated workload versus team capacity by month" data={capacityRows} height={92} />
              <p className="mt-1 flex justify-center gap-3 text-[10.5px] text-sg-body lg:mt-[2px] lg:text-[8px]" aria-hidden>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sg-blue" />Allocated</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#dbe4fe]" />Capacity</span>
                <span className="inline-flex items-center gap-1"><i className="h-0.5 w-3 bg-teal-500" />Utilization</span>
              </p>
            </>
          ) : <EmptyState compact title="No capacity data" />}
        </Panel>
        <Panel title="Upcoming milestones" headerClassName={ROW_HEADER} bodyClassName={ROW_BODY} footerClassName={ROW_FOOTER} footer={<FooterLink href={`${pathname}?view=calendar`}>View all milestones</FooterLink>}>
          {milestones.length ? (
            <ul className="space-y-2.5 lg:space-y-[3px] lg:leading-[12px]">
              {milestones.map((item, index) => (
                <li key={item.id} className="group flex items-start gap-2">
                  <CircleCheck aria-hidden className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 lg:h-3 lg:w-3', ['text-emerald-500', 'text-orange-500', 'text-red-500'][index % 3])} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-sg-ink lg:text-[9px]">{item.title}</p>
                    <p className="truncate text-[11px] text-sg-muted lg:text-[8px]">{item.plan?.name}</p>
                    <p className="text-[11px] text-sg-muted lg:text-[8px]">{formatDate(item.due_date)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-emerald-600 lg:text-[8.5px]">{formatDueIn(item.due_date)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title="No upcoming milestones" />}
        </Panel>
        <Panel title="Risk items" headerClassName={ROW_HEADER} bodyClassName={ROW_BODY} footerClassName={ROW_FOOTER} footer={<FooterLink href={`${pathname}?view=table`}>View all risks</FooterLink>}>
          {risks.length ? (
            <ul className="space-y-2.5 lg:space-y-[8px]">
              {risks.map(risk => (
                <li key={risk.id} className="group flex items-start gap-2">
                  <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500 lg:h-3 lg:w-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-sg-ink lg:text-[9px]" title={risk.detail ?? undefined}>{risk.title}</p>
                    <p className="truncate text-[11px] text-sg-muted lg:text-[8px]">{risk.plan?.name}</p>
                  </div>
                  <span className={cn('shrink-0 rounded px-1.5 text-[11px] lg:text-[8px]', RISK_TONE[risk.severity])}>{RISK_LABELS[risk.severity as RiskLevel].replace(' risk', '')}</span>
                  <span className="inline-flex lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-within:opacity-100"><RiskStatusMenu id={risk.id} title={risk.title} canEdit={can.editPlan} /></span>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title="No open risks" />}
        </Panel>
        <Panel title="Strategic dependencies" headerClassName={ROW_HEADER} bodyClassName={ROW_BODY} footerClassName={ROW_FOOTER} footer={<FooterLink href={`${pathname}?view=table`}>View all dependencies</FooterLink>}>
          {dependencies.length ? (
            <ul className="space-y-2.5 lg:space-y-[8px]">
              {dependencies.slice(0, 3).map(dep => (
                <li key={dep.id} className="flex items-start gap-2">
                  <GitBranch aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 lg:h-3 lg:w-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-sg-ink lg:text-[9px]">{dep.dependsOn?.name} → {dep.plan?.name}</p>
                    <p className="text-[11px] text-sg-muted lg:text-[8px]">Blocks {dep.blocked_items} item{dep.blocked_items === 1 ? '' : 's'}</p>
                  </div>
                  <span className={cn('shrink-0 self-end rounded px-1.5 text-[11px] lg:text-[8px]', RISK_TONE[dep.risk_level])}>{RISK_LABELS[dep.risk_level as RiskLevel].replace(' risk', '')}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title="No dependencies" />}
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] xl:grid-cols-[726fr_502fr] xl:gap-[13px]">
        <Panel title="High priority plan items" headerClassName={ROW_HEADER} bodyClassName="lg:pt-0! lg:pb-[4px]!" footerClassName={ROW_FOOTER} footer={<FooterLink href={`${pathname}?view=table`}>View all high priority items</FooterLink>}>
          {highPriority.length ? (
            <TableScroll label="High priority plan items">
              <table className="w-full min-w-[640px] border-collapse text-[12.5px] text-sg-body lg:text-[8.5px]">
                <caption className="sr-only">High priority plan items</caption>
                <thead><tr className="text-left text-sg-muted">{['Item', 'Plan', 'Type', 'Status', 'Owner', 'Due date', 'Priority'].map(label => <th key={label} scope="col" className="py-1.5 pr-3 font-normal">{label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {highPriority.map(item => (
                    <tr key={item.id} className="group h-11 lg:h-[20.5px]">
                      <td className="pr-3"><span className="flex items-center gap-2 text-sg-ink"><CheckSquare aria-hidden className="h-3.5 w-3.5 text-sg-blue lg:h-2.5 lg:w-2.5" />{item.title}</span></td>
                      <td className="pr-3">{item.plan?.name}</td>
                      <td className="pr-3 capitalize">{item.item_type}</td>
                      <td className="pr-3"><StatusChip status={item.status} label={PLAN_ITEM_STATUS_LABELS[item.status as PlanItemStatus]} /></td>
                      <td className="pr-3"><span className="flex items-center gap-1.5 whitespace-nowrap"><Avatar person={item.owner} size={16} />{shortName(item.owner?.full_name)}</span></td>
                      <td className="whitespace-nowrap pr-3">{formatDate(item.due_date)}</td>
                      <td className="pr-3"><span className={cn('rounded px-1.5 text-[11px] lg:text-[8px]', PRIORITY_TONE[item.priority])}>{PRIORITY_LABELS[item.priority as StrategyPriority]}</span></td>
                      <td className="text-right"><PlanItemMenu item={item} people={page.people} canEdit={can.editPlan} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : <EmptyState compact title="No high-priority items" />}
        </Panel>
        <Panel title="Recent activity" headerClassName={ROW_HEADER} bodyClassName="lg:pt-[4px]! lg:pb-[4px]!" footerClassName={ROW_FOOTER} footer={<FooterLink href={strategyPath(kind)}>View all activity</FooterLink>}>
          {activity.length ? (
            <ul className="space-y-2.5 lg:space-y-[9px]">
              {activity.map(row => (
                <li key={row.id} className="flex items-start gap-2">
                  <Avatar person={row.actor} size={18} />
                  <div className="min-w-0 flex-1 text-[12px] lg:text-[8.5px]">
                    <p className="truncate text-sg-muted"><span className="font-semibold text-sg-ink">{shortName(row.actor?.full_name)}</span> {row.action}</p>
                    <p className="truncate text-sg-body">{row.summary}</p>
                  </div>
                  <time dateTime={row.created_at} className="shrink-0 text-[11px] text-sg-subtle lg:text-[8.5px]">{formatRelative(row.created_at)}</time>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title="No plan activity yet" />}
        </Panel>
      </div>
    </>
  )
}
