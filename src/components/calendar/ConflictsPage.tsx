import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, Gauge, Layers, Rocket, ShieldAlert, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchConflictActivity, fetchConflictAnalytics, fetchConflictKpis, fetchConflicts,
  fetchLookups, fetchScheduleEntries, CONFLICT_TYPE_LABELS, CHANNEL_LABELS,
  type CalendarSession,
} from '@/lib/calendar/queries'
import { formatRelativeShort, formatShortDate, timezoneLabel } from '@/lib/calendar/dates'
import { parsePage, pickView, readParams, resolveRange, type SearchParamsInput } from '@/lib/calendar/range'
import { CalendarPageChrome } from './chrome'
import { AdvancedFilters, DateRangeControl, FilterBar, FilterSearch, FilterSelect, ViewSwitcher } from './controls'
import {
  Avatar, ChannelIcon, EmptyState, ErrorState, KpiStrip, Panel, SeverityBadge,
  T, type KpiDefinition,
} from './primitives'
import { ConflictCards, ConflictPrimaryActions, ResolutionPanel, STATUS_CHIP, STATUS_LABEL } from './conflicts-client'
import { SecondaryHeaderActions } from './dialogs'
import { ConflictDonut } from './charts'
import { MonthView } from './views'

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'info', label: 'Info' },
]

const TYPE_FILTER_OPTIONS = Object.entries(CONFLICT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active (open, in progress)' },
  { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' },
  { value: 'reopened', label: 'Reopened' }, { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

export default async function ConflictsPage({
  session, searchParams,
}: {
  session: CalendarSession
  searchParams: SearchParamsInput
}) {
  const { ctx } = session
  const filters = readParams(searchParams)
  const view = pickView(filters.view, ['cards', 'table', 'calendar'] as const, 'cards')
  const { page } = parsePage(filters)
  const pageSize = view === 'table' ? 25 : 6
  const range = resolveRange(ctx, filters, 'range', { agendaDays: 31 })

  const [kpis, list, lookups, analytics, activity, schedule] = await Promise.all([
    fetchConflictKpis(session),
    fetchConflicts(session, range, { ...filters, page, pageSize }),
    fetchLookups(session),
    fetchConflictAnalytics(session, range),
    fetchConflictActivity(session, 5),
    view === 'calendar' ? fetchScheduleEntries(session, range, { conflict: 'conflicted' }) : Promise.resolve({ data: [], error: null }),
  ])

  const selectedId = filters.selected ?? null
  const selected = selectedId ? list.data.conflicts.find(c => c.id === selectedId) ?? null : list.data.conflicts[0] ?? null

  const kpiItems: KpiDefinition[] = [
    { id: 'open', label: 'Open conflicts', value: String(kpis.data.open), tone: 'red', icon: <AlertTriangle size={17} />, delta: delta(kpis.data.openDelta, false) },
    { id: 'high', label: 'High severity', value: String(kpis.data.highSeverity), tone: 'orange', icon: <ShieldAlert size={17} />, delta: delta(kpis.data.highSeverityDelta, false) },
    { id: 'capacity', label: 'Capacity clashes', value: String(kpis.data.capacityClashes), tone: 'violet', icon: <Gauge size={17} />, delta: delta(kpis.data.capacityClashesDelta, false) },
    { id: 'approval', label: 'Approval blockers', value: String(kpis.data.approvalBlockers), tone: 'amber', icon: <Layers size={17} />, delta: delta(kpis.data.approvalBlockersDelta, false) },
    { id: 'launch', label: 'Overlapping launches', value: String(kpis.data.overlappingLaunches), tone: 'blue', icon: <Rocket size={17} />, delta: delta(kpis.data.overlappingLaunchesDelta, false) },
    { id: 'resolved', label: 'Resolved this week', value: String(kpis.data.resolvedThisWeek), tone: 'emerald', icon: <CheckCircle2 size={17} />, delta: delta(kpis.data.resolvedThisWeekDelta) },
  ]

  return (
    <div className={cn(T.page, 'pb-8')}>
      <CalendarPageChrome
        ctx={ctx}
        active="conflicts"
        title="Conflicts"
        subtitle="Detect and resolve scheduling clashes, capacity issues, approval blockers, and potential schedule risk."
        actions={
          <SecondaryHeaderActions
            ctx={ctx}
            surface="conflicts"
            primary={<ConflictPrimaryActions key="conflicts-primary" ctx={ctx} conflicts={list.data.conflicts} lookups={lookups.data} />}
          />
        }
      />

      {kpis.error ? (
        <div className={cn(T.card, 'mb-[13px]')}><ErrorState message={kpis.error} /></div>
      ) : (
        <div className="mb-[13px]"><KpiStrip items={kpiItems} /></div>
      )}

      <FilterBar
        left={
          <>
            <FilterSearch placeholder="Search conflicts…" className="w-[190px]" />
            <FilterSelect name="severity" label="Severity" options={SEVERITY_OPTIONS} hideAllValue />
            <FilterSelect name="owner" label="Owner" options={lookups.data.owners} hideAllValue />
            <FilterSelect name="channel" label="Channel" options={lookups.data.channels} hideAllValue />
            <FilterSelect name="type" label="Conflict type" options={TYPE_FILTER_OPTIONS} hideAllValue />
            <DateRangeControl label={range.label} />
            <AdvancedFilters
              extra={[
                { name: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS },
                { name: 'assignee', label: 'Assignee', options: lookups.data.owners },
                { name: 'campaign', label: 'Campaign', options: lookups.data.campaigns },
                { name: 'impact', label: 'Impact', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
                { name: 'team', label: 'Team', options: lookups.data.teams },
              ]}
            />
          </>
        }
        right={
          <ViewSwitcher
            current={view}
            views={[{ id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }, { id: 'calendar', label: 'Calendar' }]}
          />
        }
      />

      {/* Reference: cards · 335px resolution panel, 10px apart. */}
      <div className="grid gap-[10px] xl:grid-cols-[minmax(0,1fr)_335px]">
        <div className="min-w-0">
          {list.error ? (
            <div className={T.card}><ErrorState message={list.error} /></div>
          ) : view === 'calendar' ? (
            schedule.data.length === 0 ? (
              <div className={T.card}>
                <EmptyState icon={<ShieldCheck size={18} />} title="No conflicted items in this period" body="Nothing on the calendar currently clashes." />
              </div>
            ) : (
              <MonthView
                entries={schedule.data} anchorIso={range.anchorIso} timezone={ctx.timezone}
                locale={ctx.locale} weekStartsOn={ctx.weekStartsOn} basePath={ctx.basePath} canReschedule={false}
              />
            )
          ) : view === 'table' ? (
            <ConflictTable ctx={ctx} conflicts={list.data.conflicts} total={list.data.total} />
          ) : (
            <ConflictCards ctx={ctx} conflicts={list.data.conflicts} total={list.data.total} page={page} pageSize={pageSize} selectedId={selected?.id ?? null} />
          )}
        </div>

        <div className="min-w-0">
          <ResolutionPanel ctx={ctx} conflict={selected} lookups={lookups.data} />
        </div>
      </div>

      {/* Reference bottom row: 388 / 345 / 442 with 11px gutters. */}
      <div className="mt-[13px] grid gap-[11px] xl:grid-cols-[388fr_345fr_442fr]">
        <Panel title="Conflict timeline heatmap" hint="Open conflicts by channel across the selected period.">
          {analytics.error ? <ErrorState message={analytics.error} /> : analytics.data.channels.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={18} />} title="No conflicts to plot" body="The heatmap fills in once conflicts are detected in this period." />
          ) : (
            <Heatmap data={analytics.data} />
          )}
        </Panel>

        <Panel title="Conflicts by type" hint="Share of open conflicts by detection category.">
          {analytics.error ? <ErrorState message={analytics.error} /> : <ConflictDonut data={analytics.data.breakdown} />}
        </Panel>

        <Panel title="Recent resolution activity" action={{ label: 'View all', href: `${ctx.basePath}/calendar/conflicts?status=resolved` }} bodyClassName="pb-2">
          {activity.error ? <ErrorState message={activity.error} /> : activity.data.length === 0 ? (
            <EmptyState title="No resolutions yet" body="Assignments and resolutions will be recorded here." />
          ) : activity.data.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 px-3.5 py-[5px]">
              <span className={cn('mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                item.tone === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500')} aria-hidden>
                <CheckCircle2 size={10} />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={item.href ?? '#'} className={cn('block truncate text-[12.5px] lg:text-[11px] font-medium text-slate-800 hover:text-blue-600', T.focus)}>
                  {item.summary}
                </Link>
                <p className="truncate text-[11px] lg:text-[9.5px] text-slate-400">by {item.actorName ?? 'System'}</p>
              </div>
              <span className="shrink-0 text-[11px] lg:text-[9.5px] text-slate-400">{formatRelativeShort(item.createdAt)}</span>
            </div>
          ))}
        </Panel>
      </div>

      {view !== 'table' && (
        <div className="mt-[13px]">
          <Panel
            title="All conflicts (table view)"
            hint="The same records as above, in a sortable table."
            action={{ label: 'View full table', href: `${ctx.basePath}/calendar/conflicts?view=table` }}
            bodyClassName="p-0"
          >
            <ConflictTableBody ctx={ctx} conflicts={list.data.conflicts.slice(0, 6)} />
          </Panel>
        </div>
      )}

      <p className="mt-5 text-[11.5px] lg:text-[10px] text-slate-400">
        All times shown in {timezoneLabel(ctx.timezone)}. Recommended actions are generated from the detection rules for each conflict type and should be reviewed before applying.
      </p>
    </div>
  )
}

function delta(value: number | null, goodWhenUp = true) {
  return value === null ? null : { value, suffix: 'vs last 7 days', goodWhenUp }
}

function ConflictTable({
  ctx, conflicts, total,
}: {
  ctx: { basePath: string; timezone: string; locale: string }
  conflicts: Parameters<typeof ConflictTableBody>[0]['conflicts']
  total: number
}) {
  return (
    <div className={cn(T.card, 'overflow-hidden')}>
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-[14px] font-semibold text-slate-900">All conflicts</h2>
        <span className="text-[12px] lg:text-[10.5px] text-slate-500">{total} total</span>
      </header>
      <ConflictTableBody ctx={ctx} conflicts={conflicts} />
    </div>
  )
}

function ConflictTableBody({
  ctx, conflicts,
}: {
  ctx: { basePath: string; timezone: string; locale: string }
  conflicts: {
    id: string; reference: string; title: string; type: keyof typeof CONFLICT_TYPE_LABELS
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    channels: string[]; campaignName: string | null; ownerName: string | null
    dueAt: string | null; status: string; impact: 'high' | 'medium' | 'low'
  }[]
}) {
  if (conflicts.length === 0) {
    return <EmptyState icon={<ShieldCheck size={18} />} title="No conflicts" body="Nothing matches the current filters." />
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <caption className="sr-only">Conflicts table</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] lg:text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-5 py-2.5">ID</th>
            <th scope="col" className="px-3 py-2.5">Conflict title</th>
            <th scope="col" className="px-3 py-2.5">Type</th>
            <th scope="col" className="px-3 py-2.5">Severity</th>
            <th scope="col" className="px-3 py-2.5">Channel(s)</th>
            <th scope="col" className="px-3 py-2.5">Campaign / content</th>
            <th scope="col" className="px-3 py-2.5">Owner</th>
            <th scope="col" className="px-3 py-2.5">Due date</th>
            <th scope="col" className="px-3 py-2.5">Status</th>
            <th scope="col" className="px-5 py-2.5">Impact</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {conflicts.map(conflict => (
            <tr key={conflict.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-5 py-2.5 text-[12px] lg:text-[10.5px] font-medium text-slate-500">{conflict.reference}</td>
              <td className="max-w-[220px] px-3 py-2.5">
                <Link href={`${ctx.basePath}/calendar/conflicts?selected=${conflict.id}`} className={cn('block truncate text-[12.5px] lg:text-[11px] font-medium text-slate-900 hover:text-blue-600', T.focus)}>
                  {conflict.title}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[12px] lg:text-[10.5px] text-slate-600">{CONFLICT_TYPE_LABELS[conflict.type]}</td>
              <td className="px-3 py-2.5"><SeverityBadge severity={conflict.severity} /></td>
              <td className="px-3 py-2.5">
                <span className="flex gap-1">
                  {conflict.channels.length === 0 ? <span className="text-[12px] lg:text-[10.5px] text-slate-400">—</span>
                    : conflict.channels.slice(0, 3).map(channel => (
                      <span key={channel} className="flex items-center gap-1 text-[12px] lg:text-[10.5px] text-slate-600">
                        <ChannelIcon channel={channel} size={11} />
                        <span className="hidden 2xl:inline">{CHANNEL_LABELS[channel] ?? channel}</span>
                      </span>
                    ))}
                </span>
              </td>
              <td className="max-w-[160px] truncate px-3 py-2.5 text-[12px] lg:text-[10.5px] text-slate-600">{conflict.campaignName ?? '—'}</td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  <Avatar name={conflict.ownerName} size={20} />
                  <span className="hidden max-w-[100px] truncate text-[12px] lg:text-[10.5px] text-slate-700 2xl:block">{conflict.ownerName ?? 'Unassigned'}</span>
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[12px] lg:text-[10.5px] text-slate-600">
                {conflict.dueAt ? formatShortDate(conflict.dueAt, ctx.timezone, ctx.locale) : '—'}
              </td>
              <td className="px-3 py-2.5">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] lg:text-[9.5px] font-medium', STATUS_CHIP[conflict.status])}>
                  {STATUS_LABEL[conflict.status]}
                </span>
              </td>
              <td className={cn('px-5 py-2.5 text-[12px] lg:text-[10.5px] font-semibold capitalize',
                conflict.impact === 'high' ? 'text-red-600' : conflict.impact === 'medium' ? 'text-amber-600' : 'text-emerald-600')}>
                {conflict.impact}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const HEAT_CLASS = {
  none: 'bg-slate-50',
  low: 'bg-amber-100',
  medium: 'bg-orange-300',
  high: 'bg-red-500',
} as const

function Heatmap({
  data,
}: {
  data: { channels: string[]; buckets: string[]; heatmap: { channel: string; bucket: string; count: number; weight: keyof typeof HEAT_CLASS }[] }
}) {
  const byKey = new Map(data.heatmap.map(cell => [`${cell.channel}|${cell.bucket}`, cell]))
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-separate border-spacing-[2px]">
          <caption className="sr-only">Open conflicts by channel and period</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20" />
              {data.buckets.map(bucket => (
                <th key={bucket} scope="col" className="pb-1 text-center text-[10px] lg:text-[9px] font-medium text-slate-400">{bucket}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.channels.map(channel => (
              <tr key={channel}>
                <th scope="row" className="pr-2 text-right text-[11px] lg:text-[9.5px] font-medium capitalize text-slate-600">
                  {CHANNEL_LABELS[channel] ?? channel}
                </th>
                {data.buckets.map(bucket => {
                  const cell = byKey.get(`${channel}|${bucket}`)
                  const count = cell?.count ?? 0
                  return (
                    <td key={bucket} className="p-0">
                      <span
                        title={`${CHANNEL_LABELS[channel] ?? channel}, ${bucket}: ${count} conflict${count === 1 ? '' : 's'}`}
                        className={cn('block h-6 rounded-[3px]', HEAT_CLASS[cell?.weight ?? 'none'])}
                      >
                        <span className="sr-only">{CHANNEL_LABELS[channel] ?? channel}, {bucket}: {count} conflicts</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex items-center justify-center gap-4 border-t border-slate-100 pt-2.5">
        {(['low', 'medium', 'high'] as const).map(level => (
          <li key={level} className="flex items-center gap-1.5 text-[11px] lg:text-[9.5px] capitalize text-slate-500">
            <span className={cn('h-2.5 w-4 rounded-[2px]', HEAT_CLASS[level])} aria-hidden />{level}
          </li>
        ))}
      </ul>
    </div>
  )
}
