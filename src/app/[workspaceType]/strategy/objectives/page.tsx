import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckSquare, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import { listActivity, listObjectives, listStrategyRecords, resolveLinks } from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { compare, loadSnapshots, refreshSnapshot, series } from '@/lib/strategy/kpis'
import { average, ganttOffset, ganttWindow, pct, resolveRange } from '@/lib/strategy/metrics'
import { formatDate, formatRelative, shortName } from '@/lib/strategy/format'
import {
  OBJECTIVE_BOARD_STATUSES, OBJECTIVE_STATUS_LABELS, OBJECTIVE_TYPE_LABELS, OBJECTIVE_TYPES, strategyPath,
  type ObjectiveStatus, type ObjectiveType,
} from '@/lib/strategy/constants'
import type { ObjectiveRow } from '@/lib/strategy/types'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, RangeFilter, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { Avatar, AvatarStack, CARD, HeaderLink, Panel, TableScroll } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { Donut, Legend, LineChart } from '@/components/strategy/charts'
import { ActivityList } from '@/components/strategy/ActivityPanel'
import Pagination from '@/components/strategy/Pagination'
import { levelFromScore, LevelChip, STATUS_BAR, StatusChip, TypeChip } from '@/components/strategy/badges'
import { ObjectiveKanban, ObjectiveMenu, ObjectivesHeaderActions } from '@/components/strategy/objectives/ObjectiveClient'

export const metadata: Metadata = {
  title: 'Objectives · Strategy · Caption Fox',
  description: 'Manage and track strategic objectives that drive growth.',
}

const VIEWS = ['cards', 'table', 'timeline', 'kanban'] as const
const RANGE_PRESETS = [
  { value: 'this_quarter', label: 'This quarter' }, { value: 'this_month', label: 'This month' },
  { value: 'last_quarter', label: 'Last quarter' }, { value: 'this_year', label: 'This year' }, { value: 'all', label: 'All time' },
]
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

export default async function ObjectivesPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<RawParams> }) {
  const [{ workspaceType: kind }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(kind, 'objectives')
  const { supabase, capabilities: can } = page
  const workspaceId = page.workspace.id

  const q = parseStrategyQuery(search, { views: [...VIEWS], defaultView: 'cards', defaultSort: 'priority' })
  const range = resolveRange({ range: one(search.range), from: one(search.from), to: one(search.to) }, 'this_quarter')
  q.from = range.from
  q.to = range.to
  const view = q.view as typeof VIEWS[number]
  if (q.owner && !page.people.some(person => person.id === q.owner)) q.owner = ''
  q.size = view === 'cards' ? 8 : view === 'table' ? 12 : 60

  const now = new Date()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toLocaleDateString('en-CA')

  const [list, all, strategies, snapshots, activity, priorityRows] = await Promise.all([
    listObjectives(supabase, workspaceId, q, { paginate: view !== 'kanban' && view !== 'timeline', limit: 60 }),
    supabase.from('strategy_objectives').select('id, status, confidence, completed_at').eq('workspace_id', workspaceId).is('archived_at', null),
    listStrategyRecords(supabase, workspaceId),
    loadSnapshots(supabase, workspaceId, now),
    listActivity(supabase, workspaceId, { limit: 4, surface: 'objectives' }),
    listObjectives(supabase, workspaceId, { ...q, status: '', type: '', owner: '', q: '', from: '', to: '', sort: q.sort === 'due_soonest' || q.sort === 'progress_desc' || q.sort === 'confidence_desc' || q.sort === 'updated' ? q.sort : 'priority', page: 1 },
      { limit: 5, statuses: ['not_started', 'on_track', 'at_risk', 'off_track'] }),
  ])

  const rows = list.rows
  const ids = [...new Set([...rows, ...priorityRows.rows].map(row => row.id))]
  const allRows = (all.data ?? []) as { id: string; status: string; confidence: number; completed_at: string | null }[]
  const [links, linkedPlanRows] = await Promise.all([
    resolveLinks(supabase, workspaceId, 'objective', ids),
    supabase.from('strategy_links').select('target_id').eq('workspace_id', workspaceId).eq('source_type', 'objective').eq('target_type', 'plan'),
  ])

  // ── KPIs (whole workspace, independent of filters) ─────────────────────────
  const total = allRows.length
  const count = (status: string) => allRows.filter(row => row.status === status).length
  const onTrack = count('on_track')
  const atRisk = count('at_risk')
  const completedQuarter = allRows.filter(row => row.completed_at && row.completed_at.slice(0, 10) >= quarterStart).length
  const avgConfidence = total ? Math.round(average(allRows.map(row => row.confidence))) : 0
  const linkedPlans = new Set(((linkedPlanRows.data ?? []) as { target_id: string }[]).map(row => row.target_id)).size

  const live = {
    objectives_total: total, objectives_on_track: onTrack, objectives_at_risk: atRisk,
    objectives_completed: completedQuarter, objectives_avg_confidence: avgConfidence, objectives_linked_plans: linkedPlans,
    objectives_completed_total: count('completed'),
  }
  await refreshSnapshot(supabase, workspaceId, snapshots.current, live, now)
  const prev = snapshots.lastQuarter ?? snapshots.lastMonth
  const cmp = prev === snapshots.lastQuarter ? 'vs last quarter' : 'vs last month'
  const delta = (key: keyof typeof live, value: number, unit = '') => {
    const d = compare(value, prev, key)
    return d ? { value: d.value, unit, comparison: cmp } : null
  }

  const kpis: KpiItem[] = [
    { id: 'total', label: 'Total objectives', value: total, icon: 'target', tone: 'blue', delta: delta('objectives_total', total) },
    { id: 'on', label: 'On track', icon: 'check', tone: 'green', value: <>{onTrack} <span className="font-normal text-slate-500">({pct(onTrack, total)}%)</span></>, delta: delta('objectives_on_track', onTrack) },
    { id: 'risk', label: 'At risk', icon: 'alert', tone: 'orange', value: <>{atRisk} <span className="font-normal text-slate-500">({pct(atRisk, total)}%)</span></>,
      delta: (() => { const d = compare(atRisk, prev, 'objectives_at_risk'); return d ? { value: d.value, comparison: cmp, good: 'down' as const } : null })() },
    { id: 'completed', label: 'Completed this quarter', icon: 'users', tone: 'violet', value: <>{completedQuarter} <span className="font-normal text-slate-500">({pct(completedQuarter, total)}%)</span></>, delta: delta('objectives_completed', completedQuarter) },
    { id: 'confidence', label: 'Avg. confidence', icon: 'line', tone: 'blue', value: `${avgConfidence}%`, delta: delta('objectives_avg_confidence', avgConfidence, 'pp') },
    { id: 'plans', label: 'Linked plans', icon: 'blocks', tone: 'orange', value: linkedPlans, delta: delta('objectives_linked_plans', linkedPlans) },
  ]

  const trend = ['objectives_on_track', 'objectives_at_risk', 'objectives_completed_total'].map(key => series(snapshots.rows, key, live[key as keyof typeof live], 6, now))
  const trendRows = trend[0].map((point, index) => ({
    label: new Date(`${point.date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }),
    on: point.value, risk: trend[1][index].value,
    // Months recorded before this key existed fall back to the completed-in-month figure.
    done: trend[2][index].value ?? (snapshots.rows.find(row => row.period_start === point.date)?.metrics.objectives_completed ?? null),
  }))

  const pathname = strategyPath(kind, 'objectives')
  const queryState = Object.fromEntries(Object.entries(search).map(([key, value]) => [key, one(value)]))
  const filtered = Boolean(q.q || q.status || q.type || q.owner || q.strategy || q.priority || one(search.range) || q.archived)
  const strategyOptions = strategies.rows.map(item => ({ id: item.id, name: item.name }))
  const menuCan = { create: can.createObjective, edit: can.editObjective, delete: can.deleteObjective, export: can.export }

  const withLinks = (row: ObjectiveRow) => ({ ...row, linkedAudiences: links[row.id]?.audiences ?? [], linkedPlans: links[row.id]?.plans ?? [] })
  const donut = [
    { key: 'on_track', label: 'On track', value: onTrack, colour: '#22c55e' },
    { key: 'at_risk', label: 'At risk', value: atRisk, colour: '#fbbf24' },
    { key: 'completed', label: 'Completed', value: count('completed'), colour: '#8b5cf6' },
    ...(['off_track', 'not_started', 'draft'] as const).map(key => ({ key, label: OBJECTIVE_STATUS_LABELS[key], value: count(key), colour: key === 'off_track' ? '#ef4444' : '#cbd5e1' })).filter(item => item.value > 0),
  ]

  const card = (raw: ObjectiveRow, compact = false) => {
    const row = withLinks(raw)
    return (
      <article className={cn(CARD, 'flex h-full flex-col px-3.5 py-3 lg:px-[13px] lg:pb-[6px] lg:pt-[6px]')} aria-labelledby={`obj-${row.id}`}>
        <header className="flex items-start gap-2">
          <h3 id={`obj-${row.id}`} className="min-w-0 truncate text-[14px] font-semibold text-sg-ink lg:text-[11.5px]">
            <Link href={`${pathname}?view=table&q=${encodeURIComponent(row.name)}`} className="block truncate py-2.5 hover:underline lg:py-0">{row.name}</Link>
          </h3>
          <TypeChip type={row.objective_type} label={OBJECTIVE_TYPE_LABELS[row.objective_type as ObjectiveType] ?? row.objective_type} className="mt-px" />
          <span className="ml-auto -mt-0.5"><ObjectiveMenu objective={row} people={page.people} strategies={strategyOptions} can={menuCan} /></span>
        </header>
        <div className="mt-2 flex items-center gap-2 lg:mt-[5px]">
          <Avatar person={row.owner} size={20} />
          <span className="truncate text-[12px] text-sg-body lg:text-[10px]">{shortName(row.owner?.full_name ?? row.owner?.email)}</span>
          <StatusChip status={row.status} label={OBJECTIVE_STATUS_LABELS[row.status as ObjectiveStatus]} className="ml-auto" />
        </div>
        <div className="mt-2 flex items-center gap-3 lg:mt-[8px]">
          <span className="w-8 text-[12px] font-semibold tabular-nums text-sg-ink lg:text-[10px]">{row.progress}%</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 lg:mr-[40px] lg:h-[5px]" role="progressbar" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.name} progress`}>
            <span className={cn('block h-full rounded-full', STATUS_BAR[row.status] === 'bg-orange-400' ? 'bg-emerald-500' : STATUS_BAR[row.status] ?? 'bg-emerald-500')} style={{ width: `${row.progress}%` }} />
          </span>
        </div>
        {!compact && (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] lg:mt-[10px] lg:text-[9px]">
              <div className="flex items-center gap-2 self-start">
                <dt className="text-sg-body">Linked audiences</dt>
                <dd><AvatarStack max={2} size={16} total={row.linkedAudiences.length} label={`${row.linkedAudiences.length} linked audiences`}
                  people={row.linkedAudiences.map(item => ({ id: item.id, name: item.name, avatar_url: item.avatar_url }))} /></dd>
              </div>
              <div>
                <dt className="text-sg-body">Linked plans</dt>
                <dd className="text-sg-ink">{row.linkedPlans.length} plan{row.linkedPlans.length === 1 ? '' : 's'}</dd>
              </div>
            </dl>
            <dl className="mt-auto grid grid-cols-2 gap-2 pt-2 text-[11px] lg:mt-[6px] lg:pt-0 lg:text-[9px]">
              <div>
                <dt className="text-sg-body">Due date</dt>
                <dd className="font-medium text-sg-ink">{formatDate(row.due_date)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-sg-body">Next action</dt>
                <dd className="flex items-center gap-1.5 text-sg-ink">
                  <CalendarDays aria-hidden className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{row.next_action ?? '—'}</span>
                </dd>
              </div>
            </dl>
          </>
        )}
      </article>
    )
  }

  const table = (tableRows: ObjectiveRow[], caption: string) => (
    <TableScroll label={caption}>
      <table className="w-full min-w-[1080px] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-[11px] text-sg-muted lg:text-[9.5px]">
            {['Objective', 'Type', 'Owner', 'Status', 'Progress', 'Confidence', 'Linked audiences', 'Linked plans', 'Due date', 'Last updated'].map(label => (
              <th key={label} scope="col" className="whitespace-nowrap py-2 pr-3 font-normal lg:py-[6px]">{label}</th>
            ))}
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(raw => {
            const row = withLinks(raw)
            return (
              <tr key={row.id} className="h-12 border-t border-sg-line-soft text-[12.5px] text-sg-body lg:h-[29px] lg:text-[10px]">
                <td className="pr-3">
                  <span className="flex items-center gap-2 lg:gap-[12px]">
                    {row.priority === 'urgent'
                      ? <Star aria-label="Urgent priority" className="h-3.5 w-3.5 shrink-0 fill-sg-blue text-sg-blue lg:h-3 lg:w-3" />
                      : <CheckSquare aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400 lg:h-3 lg:w-3" />}
                    <span className="truncate text-sg-ink">{row.name}</span>
                  </span>
                </td>
                <td className="pr-3"><TypeChip type={row.objective_type} label={OBJECTIVE_TYPE_LABELS[row.objective_type as ObjectiveType] ?? row.objective_type} /></td>
                <td className="pr-3"><span className="flex items-center gap-2"><Avatar person={row.owner} size={18} /><span className="whitespace-nowrap">{shortName(row.owner?.full_name ?? row.owner?.email)}</span></span></td>
                <td className="pr-3"><StatusChip status={row.status} label={OBJECTIVE_STATUS_LABELS[row.status as ObjectiveStatus]} /></td>
                <td className="pr-3">
                  <span className="flex items-center gap-2.5">
                    <span className="h-1.5 w-[68px] overflow-hidden rounded-full bg-slate-100 lg:h-[5px]" aria-hidden><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${row.progress}%` }} /></span>
                    <span className="tabular-nums">{row.progress}%</span>
                  </span>
                </td>
                <td className="pr-3"><LevelChip level={levelFromScore(row.confidence)} /></td>
                <td className="pr-3"><AvatarStack max={2} size={18} total={row.linkedAudiences.length} people={row.linkedAudiences.map(item => ({ id: item.id, name: item.name, avatar_url: item.avatar_url }))} /></td>
                <td className="whitespace-nowrap pr-3">{row.linkedPlans.length} plan{row.linkedPlans.length === 1 ? '' : 's'}</td>
                <td className="whitespace-nowrap pr-3">{formatDate(row.due_date)}</td>
                <td className="whitespace-nowrap pr-3">{formatRelative(row.updated_at)}</td>
                <td className="text-right"><ObjectiveMenu objective={row} people={page.people} strategies={strategyOptions} can={menuCan} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableScroll>
  )

  const empty = (
    <EmptyState filtered={filtered} title={filtered ? 'No objectives match these filters' : 'No objectives yet'}
      description={filtered ? 'Clear filters or widen the date range.' : can.createObjective ? 'Use “New objective” to define your first measurable outcome.' : 'Objectives appear here once your team adds them.'} />
  )

  let body: React.ReactNode
  if (rows.length === 0) body = <div className={cn(CARD, 'mt-3 lg:mt-[13px]')}>{empty}</div>
  else if (view === 'cards') {
    body = (
      <>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-[7px] xl:grid-cols-4 xl:gap-x-[13px] xl:gap-y-[12px]">
          {rows.map(row => <li key={row.id}>{card(row)}</li>)}
        </ul>
      </>
    )
  } else if (view === 'table') {
    body = (
      <Panel className="mt-3 lg:mt-[13px]" title="All objectives" subtitle={`${list.total} objectives`}>
        {table(rows, 'All objectives')}
        <Pagination pathname={pathname} params={queryState} page={q.page} size={q.size} total={list.total} label="objectives" />
      </Panel>
    )
  } else if (view === 'timeline') {
    const window = ganttWindow(rows.flatMap(row => [row.start_date, row.due_date]), 'months', now)
    body = (
      <Panel className="mt-3 lg:mt-[13px]" title="Objective timeline" subtitle="Start to due date, grouped by status">
        <TableScroll label="Objective timeline">
          <div className="min-w-[900px]">
            <div className="ml-[220px] flex border-b border-sg-line text-[11px] text-sg-muted lg:text-[9.5px]">
              {window.columns.map(column => (
                <span key={column.toISOString()} className="flex-1 border-l border-sg-line-soft px-1 py-1.5">{column.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
              ))}
            </div>
            <ul className="relative">
              <span aria-hidden className="absolute bottom-0 top-0 z-10 w-px bg-red-400" style={{ left: `calc(220px + (100% - 220px) * ${ganttOffset(now, window.start, window.end)})` }} />
              {rows.map(row => {
                const left = ganttOffset(row.start_date ?? row.due_date ?? now, window.start, window.end)
                const right = ganttOffset(row.due_date ?? row.start_date ?? now, window.start, window.end)
                return (
                  <li key={row.id} className="flex h-11 items-center border-b border-sg-line-soft lg:h-8">
                    <span className="w-[220px] shrink-0 truncate pr-3 text-[12.5px] text-sg-ink lg:text-[10px]">{row.name}</span>
                    <span className="relative h-full flex-1">
                      <span className={cn('absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded px-1.5 text-[10px] text-white lg:h-4 lg:text-[8.5px]', STATUS_BAR[row.status] ?? 'bg-slate-400')}
                        style={{ left: `${left * 100}%`, width: `${Math.max(1.5, (right - left) * 100)}%` }}
                        title={`${formatDate(row.start_date)} – ${formatDate(row.due_date)}`}>
                        <span className="truncate">{row.progress}%</span>
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </TableScroll>
      </Panel>
    )
  } else {
    body = (
      <div className="mt-3 lg:mt-[13px]">
        <ObjectiveKanban can={menuCan} columns={OBJECTIVE_BOARD_STATUSES.map(status => {
          const items = rows.filter(row => row.status === status)
          return { status, label: OBJECTIVE_STATUS_LABELS[status], count: items.length, items: items.map(row => ({ id: row.id, status: row.status, node: card(row, true) })) }
        })} />
      </div>
    )
  }

  return (
    <>
      <StrategyHeader kind={kind} module="objectives" modules={page.modules}
        actions={<ObjectivesHeaderActions people={page.people} strategies={strategyOptions} can={menuCan}
          objectives={rows.map(row => ({ id: row.id, name: row.name }))} />} />

      {list.error && <div className="mb-3"><PanelError message="Objectives could not load. Refresh to try again." /></div>}

      <KpiStrip items={kpis} />

      <div className="mt-4 flex flex-col gap-2 lg:mt-[8px] xl:flex-row xl:items-center xl:gap-[10px]">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-[10px] xl:flex-nowrap">
          <RangeFilter presets={RANGE_PRESETS} fallbackLabel={range.label} className="lg:w-[214px]" />
          <SelectFilter param="type" labelText="Objective type" allLabel="All objective types" icon="target" className="lg:w-[166px]"
            options={OBJECTIVE_TYPES.map(value => ({ value, label: OBJECTIVE_TYPE_LABELS[value] }))} />
          <SelectFilter param="owner" labelText="Owner" allLabel="All owners" icon="user" className="lg:w-[120px]"
            options={page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} />
          <SelectFilter param="status" labelText="Status" allLabel="All status" icon="user" className="lg:w-[112px]"
            options={OBJECTIVE_BOARD_STATUSES.map(value => ({ value, label: OBJECTIVE_STATUS_LABELS[value] }))} />
          <MoreFilters fields={[
            { param: 'priority', label: 'Priority', options: [{ value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
            { param: 'strategy', label: 'Strategy', options: strategyOptions.map(item => ({ value: item.id, label: item.name })) },
            { param: 'archived', label: 'Archive', options: [{ value: '1', label: 'Archived only' }] },
          ]} search={{ label: 'Search objectives', placeholder: 'Name, target or next action' }} />
          <ClearFilters keys={['range', 'from', 'to', 'type', 'owner', 'status', 'priority', 'strategy', 'archived', 'q']} />
        </div>
        <ViewSwitcher current={view} defaultView="cards"
          views={[{ id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }, { id: 'timeline', label: 'Timeline' }, { id: 'kanban', label: 'Kanban' }]} />
      </div>

      {body}

      {view === 'cards' && (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mt-[12px] xl:grid-cols-[440fr_343fr_425fr] xl:gap-[13px]">
            <Panel title="Objective performance trend" headerClassName="lg:pt-[6px]!" bodyClassName="lg:pt-[5px]! lg:pb-[5px]!" info="Objectives on track, at risk and completed at each month end."
              action={<HeaderLink href={`${pathname}?view=table`}>View full report</HeaderLink>}>
              <Legend className="mb-2 lg:mb-[9px]" items={[{ label: 'On track', colour: '#22c55e' }, { label: 'At risk', colour: '#f59e0b' }, { label: 'Completed', colour: '#8b5cf6' }]} />
              <LineChart caption="Objectives by status over time" xKey="label" data={trendRows} height={99}
                series={[{ key: 'on', label: 'On track', colour: '#22c55e' }, { key: 'risk', label: 'At risk', colour: '#f59e0b' }, { key: 'done', label: 'Completed', colour: '#8b5cf6' }]} />
            </Panel>
            <Panel title="Objectives by status" headerClassName="lg:pt-[6px]!" bodyClassName="lg:pt-[15px]! lg:pb-[6px]!">
              {total ? (
                <div className="flex items-start gap-6 lg:gap-[30px] lg:pl-[10px]">
                  <Donut caption="Objectives by status" size={100} thickness={17} slices={donut}
                    center={<><span className="text-[16px] font-semibold leading-none text-sg-ink">{total}</span><span className="mt-0.5 text-[9px] text-sg-muted">Total</span></>} />
                  <div className="min-w-0 flex-1 lg:pt-[12px]">
                  <ul className="space-y-0 lg:space-y-[12px]">
                    {donut.map(item => (
                      <li key={item.key} className="flex items-center gap-2 text-[12px] text-sg-body lg:text-[9.5px]">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: item.colour }} />
                        <Link className="block flex-1 py-3 hover:underline lg:py-0" href={`${pathname}?view=table&status=${item.key}`}>{item.label}</Link>
                        <span className="tabular-nums">{item.value} <span className="text-sg-muted">({pct(item.value, total)}%)</span></span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`${pathname}?view=kanban`} className="mt-3 inline-flex min-h-9 items-center gap-1 text-[12px] font-medium text-sg-blue hover:underline lg:mt-[20px] lg:min-h-0 lg:text-[10px]">View breakdown <ArrowRight aria-hidden className="h-3 w-3" /></Link>
                  </div>
                </div>
              ) : <EmptyState compact title="No objectives yet" />}
            </Panel>
            <Panel title="Recent activity" className="md:col-span-2 xl:col-span-1" headerClassName="lg:pt-[6px]!" bodyClassName="lg:pt-[4px]! lg:pb-[8px]!" action={<HeaderLink href={strategyPath(kind)}>View all activity</HeaderLink>}>
              <ActivityList kind={kind} rows={activity} layout="stacked" avatarSize={22} className="lg:space-y-[8px]! lg:[&_p]:leading-[12px] lg:[&_time]:self-center" emptyText="Objective changes appear here." />
            </Panel>
          </div>

          <Panel className="mt-3 lg:mt-[13px]" title="Priority objectives" headerClassName="lg:items-center lg:pt-[3px]!" bodyClassName="lg:pt-0!"
            action={<SelectFilter param="sort" labelText="Sort by" allLabel="Sort by: Priority" className="w-[150px] lg:w-[118px] [&_button]:lg:h-[24px] [&_button]:lg:text-[9.5px]"
              options={[{ value: 'due_soonest', label: 'Sort by: Due date' }, { value: 'progress_desc', label: 'Sort by: Progress' }, { value: 'confidence_desc', label: 'Sort by: Confidence' }, { value: 'updated', label: 'Sort by: Updated' }]} />}>
            {priorityRows.rows.length ? table(priorityRows.rows, 'Priority objectives') : <EmptyState compact title="No priority objectives" />}
          </Panel>
        </>
      )}
    </>
  )
}
