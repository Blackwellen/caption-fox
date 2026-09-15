import Link from 'next/link'
import {
  AlertTriangle, CalendarCheck, CalendarDays, CheckCircle2, Clock, Gauge,
  ListChecks, Plus, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccessCalendarCapability } from '@/lib/calendar/entitlements'
import {
  fetchAgendaKpis, fetchCalendarActivity, fetchConflicts, fetchLookups,
  fetchQueueItems, fetchScheduleEntries, groupIntoAgendaDays, nextActions,
  CHANNEL_LABELS, type CalendarSession,
} from '@/lib/calendar/queries'
import {
  formatDateTime, formatDuration, formatRelativeShort, formatShortDate,
  timezoneAbbrev, zonedDateKey,
} from '@/lib/calendar/dates'
import { pickView, readParams, resolveRange, type SearchParamsInput } from '@/lib/calendar/range'
import { CalendarPageChrome } from './chrome'
import { AdvancedFilters, DateRangeControl, FilterBar, FilterSelect, PeriodStepper, ViewSwitcher } from './controls'
import {
  Avatar, ChannelIcon, EmptyState, ErrorState, KindIcon, KpiStrip, Panel,
  SeverityBadge, StatusBadge, T, type KpiDefinition,
} from './primitives'
import { AgendaView, DayView, MiniCalendar, WeekView } from './views'
import { SecondaryHeaderActions } from './dialogs'
import { AgendaPrimaryActions } from './agenda-client'
import { PRIORITY_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from './CalendarPage'

export default async function AgendaPage({
  session, searchParams,
}: {
  session: CalendarSession
  searchParams: SearchParamsInput
}) {
  const { ctx } = session
  const filters = readParams(searchParams)
  const view = pickView(filters.view, ['day', 'week', 'agenda'] as const, 'agenda')
  const range = resolveRange(ctx, filters, view === 'agenda' ? 'range' : view)

  const [kpis, entries, lookups, queue, conflicts, activity] = await Promise.all([
    fetchAgendaKpis(session),
    fetchScheduleEntries(session, range, filters),
    fetchLookups(session),
    fetchQueueItems(session, range, { pageSize: 5, sort: 'scheduled_at' }),
    fetchConflicts(session, range, { pageSize: 3 }),
    fetchCalendarActivity(session, 4),
  ])

  const canConflicts = canAccessCalendarCapability(ctx, 'calendar.conflicts')
  const canQueue = canAccessCalendarCapability(ctx, 'calendar.publishingQueue')
  const canReschedule = canAccessCalendarCapability(ctx, 'calendar.reschedule')

  const days = groupIntoAgendaDays(entries.data, ctx)
  const today = days.find(day => day.isToday)
  // Computed once per request and reused below instead of calling Date.now() inline in JSX.
  // Server Component: renders once per request with no client re-render/memoization, so
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const upcoming = nextActions(entries.data, new Date(nowMs), 5)
  const dueSoon = entries.data
    .filter(entry => ['task', 'approval', 'publishing', 'content'].includes(entry.kind))
    .filter(entry => entry.status !== 'published' && entry.status !== 'completed' && entry.status !== 'cancelled')
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 3)

  const kpiItems: KpiDefinition[] = [
    { id: 'today', label: "Today's items", value: String(kpis.data.todayItems), tone: 'blue', icon: <CalendarCheck size={17} />, footnote: today ? `${today.count} on the agenda` : 'Nothing scheduled today' },
    { id: 'week', label: 'This week', value: String(kpis.data.thisWeek), tone: 'sky', icon: <CalendarDays size={17} />, footnote: 'Across all item types' },
    { id: 'approvals', label: 'Pending approvals', value: String(kpis.data.pendingApprovals), tone: 'amber', icon: <ShieldAlert size={17} />, footnote: kpis.data.highPriorityApprovals ? `${kpis.data.highPriorityApprovals} high priority` : 'None high priority' },
    { id: 'overdue', label: 'Overdue tasks', value: String(kpis.data.overdueTasks), tone: 'red', icon: <Clock size={17} />, delta: kpis.data.overdueTasksDelta !== null ? { value: kpis.data.overdueTasksDelta, suffix: 'vs yesterday', goodWhenUp: false } : null },
    { id: 'conflicts', label: 'Open conflicts', value: String(kpis.data.openConflicts), tone: 'violet', icon: <AlertTriangle size={17} />, footnote: kpis.data.conflictsNeedingAttention ? `${kpis.data.conflictsNeedingAttention} need attention` : 'None urgent' },
    { id: 'load', label: 'Team load', value: kpis.data.teamLoad === null ? '—' : `${kpis.data.teamLoad}%`, tone: 'emerald', icon: <Gauge size={17} />, footnote: kpis.data.teamLoadLabel },
  ]

  const markedDates: Record<string, 'scheduled' | 'conflict' | 'priority'> = {}
  for (const entry of entries.data) {
    const key = zonedDateKey(entry.startAt, ctx.timezone)
    if (entry.conflictIds.length) markedDates[key] = 'conflict'
    else if (entry.priority === 'high' || entry.priority === 'urgent') markedDates[key] = markedDates[key] ?? 'priority'
    else markedDates[key] = markedDates[key] ?? 'scheduled'
  }

  return (
    <div className={cn(T.page, 'py-6')}>
      <CalendarPageChrome
        ctx={ctx}
        active="agenda"
        title="Agenda"
        subtitle="Plan and manage your daily and weekly delivery work across campaigns, content and tasks."
        actions={
          <SecondaryHeaderActions
            ctx={ctx}
            surface="agenda"
            primary={<AgendaPrimaryActions ctx={ctx} lookups={lookups.data} />}
          />
        }
      />

      {kpis.error ? (
        <div className={cn(T.card, 'mb-5')}><ErrorState message={kpis.error} /></div>
      ) : (
        <div className="mb-5"><KpiStrip items={kpiItems} /></div>
      )}

      <FilterBar
        left={
          <>
            <DateRangeControl label={range.label} />
            <FilterSelect name="owner" label="Owner" options={lookups.data.owners} allLabel="All owners" />
            <FilterSelect name="team" label="Team" options={lookups.data.teams} allLabel="All teams" />
            <FilterSelect name="channel" label="Channel" options={lookups.data.channels} allLabel="All channels" />
            <FilterSelect name="status" label="Status" options={STATUS_OPTIONS} allLabel="All statuses" />
            <AdvancedFilters
              extra={[
                { name: 'type', label: 'Item type', options: TYPE_OPTIONS },
                { name: 'campaign', label: 'Campaign', options: lookups.data.campaigns },
                { name: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
                { name: 'conflict', label: 'Conflict state', options: [{ value: 'conflicted', label: 'Has conflicts' }, { value: 'clear', label: 'No conflicts' }] },
              ]}
            />
          </>
        }
        right={
          <>
            <ViewSwitcher
              current={view}
              views={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'agenda', label: 'Agenda' }]}
            />
            <PeriodStepper />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px_268px]">
        <div className="min-w-0">
          {entries.error ? (
            <div className={T.card}><ErrorState message={entries.error} /></div>
          ) : view === 'day' ? (
            <DayView entries={entries.data} anchorIso={range.anchorIso} timezone={ctx.timezone} locale={ctx.locale} weekStartsOn={ctx.weekStartsOn} basePath={ctx.basePath} canReschedule={canReschedule} />
          ) : view === 'week' ? (
            <WeekView entries={entries.data} anchorIso={range.anchorIso} timezone={ctx.timezone} locale={ctx.locale} weekStartsOn={ctx.weekStartsOn} basePath={ctx.basePath} canReschedule={canReschedule} />
          ) : (
            <AgendaView days={days} timezone={ctx.timezone} locale={ctx.locale} basePath={ctx.basePath} canReschedule={canReschedule} />
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <div className={cn(T.card, 'p-4')}>
            <MiniCalendar
              anchorIso={range.anchorIso}
              timezone={ctx.timezone}
              locale={ctx.locale}
              weekStartsOn={ctx.weekStartsOn}
              markedDates={markedDates}
              selectedDate={range.selectedDate}
            />
          </div>

          <Panel title="Today's summary" action={{ label: 'View full day', href: `${ctx.basePath}/calendar/agenda?view=day` }}>
            <dl className="space-y-2.5">
              <SummaryRow icon={<CalendarDays size={14} />} tone="blue" label="Agenda items" value={today?.count ?? 0} />
              <SummaryRow icon={<ListChecks size={14} />} tone="emerald" label="Tasks due" value={(today ? [...today.allDay, ...today.timed] : []).filter(e => e.kind === 'task').length} />
              <SummaryRow icon={<ShieldAlert size={14} />} tone="amber" label="Approvals pending" value={kpis.data.pendingApprovals} />
              <SummaryRow icon={<AlertTriangle size={14} />} tone="violet" label="Conflicts" value={kpis.data.openConflicts} />
            </dl>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Next actions" action={{ label: `View all (${entries.data.length})`, href: `${ctx.basePath}/calendar/agenda?view=agenda` }} bodyClassName="divide-y divide-slate-100">
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing due" body="No upcoming actions in this period." />
            ) : upcoming.map(entry => {
              const due = new Date(entry.startAt).getTime() - nowMs
              return (
                <div key={entry.id} className="flex items-start gap-2.5 px-5 py-2.5 first:pt-4 last:pb-4">
                  <span className="mt-0.5 text-slate-400"><KindIcon kind={entry.kind} size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-slate-900">{entry.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{entry.campaignName ?? CHANNEL_LABELS[entry.channel ?? ''] ?? entry.kind}</p>
                  </div>
                  <span className={cn('shrink-0 text-[11px] font-medium', due < 0 ? 'text-red-600' : 'text-slate-400')}>
                    {due < 0 ? `${formatDuration(due)} late` : `Due in ${formatDuration(due)}`}
                  </span>
                </div>
              )
            })}
          </Panel>

          <Panel title="Due soon" bodyClassName="divide-y divide-slate-100">
            {dueSoon.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={18} />} title="Nothing due soon" body="You are on top of the schedule." />
            ) : dueSoon.map(entry => (
              <div key={entry.id} className="flex items-start gap-2.5 px-5 py-2.5 first:pt-4 last:pb-4">
                <ChannelIcon channel={entry.channel} size={12} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-900">{entry.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{entry.team ?? entry.ownerName ?? 'Unassigned'}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                  {formatDateTime(entry.startAt, ctx.timezone, ctx.locale)}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {canQueue && (
          <Panel title="Publishing queue" action={{ label: 'View full queue', href: `${ctx.basePath}/calendar/publishing-queue` }} bodyClassName="p-0">
            {queue.error ? <ErrorState message={queue.error} /> : queue.data.items.length === 0 ? (
              <EmptyState title="Queue is empty" body="Queued content will show here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-left">
                  <caption className="sr-only">Queue items in the current period</caption>
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-5 py-2">Item</th>
                      <th scope="col" className="px-2 py-2">Campaign</th>
                      <th scope="col" className="px-2 py-2">Scheduled for</th>
                      <th scope="col" className="px-5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.data.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="max-w-[140px] px-5 py-2.5">
                          <span className="flex items-center gap-2">
                            <ChannelIcon channel={item.channel} size={11} />
                            <span className="truncate text-[12.5px] font-medium text-slate-800">{item.title}</span>
                          </span>
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-2.5 text-[12px] text-slate-600">{item.campaignName ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-[12px] text-slate-600">
                          {item.scheduledAt ? formatDateTime(item.scheduledAt, ctx.timezone, ctx.locale) : '—'}
                        </td>
                        <td className="px-5 py-2.5">
                          <StatusBadge status={item.deliveryStatus === 'failed' ? 'failed' : item.approvalStatus === 'awaiting_approval' ? 'pending' : item.deliveryStatus === 'draft' ? 'draft' : 'scheduled'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {canConflicts && (
          <Panel title="Conflicts" count={conflicts.data.total} action={{ label: 'View all conflicts', href: `${ctx.basePath}/calendar/conflicts` }} bodyClassName="divide-y divide-slate-100">
            {conflicts.error ? <ErrorState message={conflicts.error} /> : conflicts.data.conflicts.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={18} />} title="No open conflicts" body="Your agenda has no detected clashes." />
            ) : conflicts.data.conflicts.map(conflict => (
              <div key={conflict.id} className="px-5 py-3 first:pt-4 last:pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-slate-900">{conflict.title}</p>
                  <SeverityBadge severity={conflict.severity} />
                </div>
                <p className="mt-0.5 text-[11.5px] text-slate-500">
                  {conflict.startAt ? formatDateTime(conflict.startAt, ctx.timezone, ctx.locale) : formatShortDate(conflict.detectedAt, ctx.timezone, ctx.locale)}
                </p>
                {conflict.description && <p className="mt-1 line-clamp-2 text-[12px] text-slate-600">{conflict.description}</p>}
                <Link href={`${ctx.basePath}/calendar/conflicts?selected=${conflict.id}`} className={cn('mt-1 inline-block text-[12px] font-medium text-blue-600 hover:underline', T.focus)}>
                  View
                </Link>
              </div>
            ))}
          </Panel>
        )}

        <Panel title="Recent activity" action={{ label: 'View all activity', href: `${ctx.basePath}/settings/data-and-governance` }} bodyClassName="divide-y divide-slate-100">
          {activity.error ? <ErrorState message={activity.error} /> : activity.data.length === 0 ? (
            <EmptyState icon={<Clock size={18} />} title="No activity yet" body="Agenda changes will be logged here." />
          ) : activity.data.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 px-5 py-2.5 first:pt-4 last:pb-4">
              <Avatar name={item.actorName} size={24} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-slate-800">{item.summary}</p>
                <p className="truncate text-[11px] text-slate-400">by {item.actorName ?? 'System'}</p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeShort(item.createdAt)}</span>
            </div>
          ))}
        </Panel>
      </div>

      <p className="mt-5 text-[11.5px] text-slate-400">All times shown in {ctx.timezone} ({timezoneAbbrev(ctx.timezone)}).</p>
    </div>
  )
}

const TONES = {
  blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600',
}

function SummaryRow({ icon, tone, label, value }: { icon: React.ReactNode; tone: keyof typeof TONES; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', TONES[tone])} aria-hidden>{icon}</span>
      <dt className="flex-1 text-[13px] text-slate-600">{label}</dt>
      <dd className="text-[13px] font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

export { Plus }
