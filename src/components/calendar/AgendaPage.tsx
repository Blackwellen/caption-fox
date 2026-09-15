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
  CHANNEL_LABELS, MAX_PAGE_SIZE, type CalendarSession,
} from '@/lib/calendar/queries'
import {
  addDays, endOfDayUtc, formatCompactWhen, formatDateTime, formatDuration, formatRelativeShort, formatShortDate,
  startOfDayUtc, timezoneLabel, zonedDateKey,
} from '@/lib/calendar/dates'
import { pickView, readParams, resolveRange, type SearchParamsInput } from '@/lib/calendar/range'
import { CalendarPageChrome } from './chrome'
import { AdvancedFilters, DateRangeControl, FilterBar, FilterSelect, ViewSwitcher } from './controls'
import {
  Avatar, ChannelIcon, EmptyState, ErrorState, KindTile, KpiStrip, Panel,
  StatusBadge, T, type KpiDefinition,
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
  const range = resolveRange(ctx, filters, view)

  // Computed once per request and reused below instead of calling Date.now() inline in JSX.
  // Server Component: renders once per request with no client re-render/memoization, so
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  const [kpis, entries, todayEntries, lookups, queue, conflicts, activity] = await Promise.all([
    fetchAgendaKpis(session),
    fetchScheduleEntries(session, range, filters),
    // "Today" panels always describe today, whichever week the agenda is showing.
    fetchScheduleEntries(session, {
      startIso: startOfDayUtc(new Date(nowMs), ctx.timezone).toISOString(),
      endIso: endOfDayUtc(new Date(nowMs), ctx.timezone).toISOString(),
    }),
    fetchLookups(session),
    // Previews look forward from now, independent of the agenda window.
    fetchQueueItems(session, { startIso: nowIso, endIso: addDays(nowIso, 30).toISOString() }, { pageSize: MAX_PAGE_SIZE, sort: 'scheduled_at' }),
    fetchConflicts(session, range, { pageSize: 6 }),
    fetchCalendarActivity(session, 5),
  ])
  const upcomingQueue = queue.data.items
    .filter(item => !['published', 'sent', 'cancelled'].includes(item.deliveryStatus))
    .slice(0, 5)

  const canConflicts = canAccessCalendarCapability(ctx, 'calendar.conflicts')
  const canQueue = canAccessCalendarCapability(ctx, 'calendar.publishingQueue')
  const canReschedule = canAccessCalendarCapability(ctx, 'calendar.reschedule')

  const days = groupIntoAgendaDays(entries.data, ctx)
  const todayCount = todayEntries.data.length
  const todayTasks = todayEntries.data.filter(e => e.kind === 'task').length
  const upcoming = nextActions(entries.data, new Date(nowMs), 5)
  const dueSoon = entries.data
    .filter(entry => ['task', 'approval', 'publishing', 'content'].includes(entry.kind))
    .filter(entry => entry.status !== 'published' && entry.status !== 'completed' && entry.status !== 'cancelled')
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 3)

  const kpiItems: KpiDefinition[] = [
    { id: 'today', label: "Today's items", value: String(kpis.data.todayItems), tone: 'blue', icon: <CalendarCheck size={17} />, footnote: todayCount ? `${todayCount} on today's agenda` : 'Nothing scheduled today' },
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
    <div className={cn(T.page, 'pb-8')}>
      <CalendarPageChrome
        ctx={ctx}
        active="agenda"
        title="Agenda"
        subtitle="Plan and manage your daily and weekly delivery work across campaigns, content and tasks."
        actions={
          <SecondaryHeaderActions
            ctx={ctx}
            surface="agenda"
            primary={<AgendaPrimaryActions key="agenda-primary" ctx={ctx} lookups={lookups.data} />}
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
            {/* Period navigation lives on the mini calendar, matching the approved layout. */}
            <ViewSwitcher
              current={view}
              views={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'agenda', label: 'Agenda' }]}
            />
          </>
        }
      />

      {/* Reference columns: day list · mini calendar + summary (225) · rail (230), 11px gaps. */}
      <div className="grid gap-[11px] xl:grid-cols-[minmax(0,1fr)_225px_230px]">
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

        {/* Reference: mini calendar and today's summary share one card. */}
        <div className={cn(T.card, 'min-w-0 self-start overflow-hidden')}>
          <div className="p-3.5">
            <MiniCalendar
              // Follows the selected day, not the week start (which can fall in the previous month).
              anchorIso={range.selectedDate ? `${range.selectedDate}T12:00:00.000Z` : range.anchorIso}
              timezone={ctx.timezone}
              locale={ctx.locale}
              weekStartsOn={ctx.weekStartsOn}
              markedDates={markedDates}
              selectedDate={range.selectedDate}
            />
          </div>

          <div className="border-t border-[#eef0f4] px-3.5 pb-3 pt-3">
            <h2 className="text-[12.5px] lg:text-[11px] font-semibold text-slate-900">Today&apos;s summary</h2>
            <dl className="mt-3 space-y-2.5">
              <SummaryRow icon={<CalendarDays size={14} />} tone="blue" label="Agenda items" value={todayCount} />
              <SummaryRow icon={<ListChecks size={14} />} tone="emerald" label="Tasks due" value={todayTasks} />
              <SummaryRow icon={<ShieldAlert size={14} />} tone="amber" label="Approvals pending" value={kpis.data.pendingApprovals} />
              <SummaryRow icon={<AlertTriangle size={14} />} tone="violet" label="Conflicts" value={kpis.data.openConflicts} />
            </dl>
          </div>
          <div className="border-t border-[#eef0f4] py-2.5 text-center">
            <Link href={`${ctx.basePath}/calendar/agenda?view=day`} className={cn('text-[11.5px] lg:text-[10px] font-medium text-blue-600 hover:text-blue-700', T.focus)}>View full day</Link>
          </div>
        </div>

        <div className="min-w-0 space-y-[11px]">
          <Panel title="Next actions" footer={{ label: `View all (${entries.data.length})`, href: `${ctx.basePath}/calendar/agenda?view=agenda` }} bodyClassName="pb-1.5">
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing due" body="No upcoming actions in this period." />
            ) : upcoming.map(entry => {
              const due = new Date(entry.startAt).getTime() - nowMs
              return (
                <div key={entry.id} className="flex items-start gap-2.5 px-3.5 py-1">
                  <KindTile kind={entry.kind} soft />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] lg:text-[9.5px] font-semibold leading-[14px] text-slate-900">{entry.title}</p>
                    <p className="truncate text-[11px] lg:text-[9.5px] leading-[14px] text-slate-500">{entry.campaignName ?? CHANNEL_LABELS[entry.channel ?? ''] ?? entry.kind}</p>
                  </div>
                  <span className={cn('shrink-0 text-[11px] lg:text-[9.5px] font-medium', due < 0 ? 'text-red-600' : 'text-slate-400')}>
                    {due < 0 ? `${formatDuration(due)} late` : `Due in ${formatDuration(due)}`}
                  </span>
                </div>
              )
            })}
          </Panel>

          <Panel title="Due soon" footer={{ label: 'View all', href: `${ctx.basePath}/calendar/agenda?view=agenda&type=task` }} bodyClassName="pb-1.5">
            {dueSoon.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={18} />} title="Nothing due soon" body="You are on top of the schedule." />
            ) : dueSoon.map(entry => (
              <div key={entry.id} className="flex items-start gap-2.5 px-3.5 py-1">
                <ChannelIcon channel={entry.channel} size={13} className="!h-[26px] !w-[26px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] lg:text-[9.5px] font-semibold leading-[14px] text-slate-900">{entry.title}</p>
                  <p className="truncate text-[11px] lg:text-[9.5px] leading-[14px] text-slate-500">{entry.team ?? entry.ownerName ?? 'Unassigned'}</p>
                </div>
                {/* Reference uses compact relative times here ("Today, 5:00 PM"). */}
                <span className="shrink-0 whitespace-nowrap text-[10.5px] lg:text-[9px] text-slate-500">
                  {formatCompactWhen(entry.startAt, ctx.timezone, ctx.locale, new Date(nowMs))}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      {/* Unequal columns as in the approved layout: the queue table needs the most room. */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.8fr_1fr]">
        {canQueue && (
          <Panel title="Publishing queue" footer={{ label: 'View full queue →', href: `${ctx.basePath}/calendar/publishing-queue` }} bodyClassName="p-0">
            {queue.error ? <ErrorState message={queue.error} /> : upcomingQueue.length === 0 ? (
              <EmptyState title="Queue is empty" body="Queued content will show here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-left">
                  <caption className="sr-only">Next items due to publish</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] lg:text-[9.5px] font-medium text-slate-500">
                      <th scope="col" className="px-4 py-2">Item</th>
                      <th scope="col" className="px-2 py-2">Campaign</th>
                      <th scope="col" className="px-2 py-2">Channel</th>
                      <th scope="col" className="px-2 py-2">Scheduled for</th>
                      <th scope="col" className="px-2 py-2">Owner</th>
                      <th scope="col" className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingQueue.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="max-w-[124px] px-4 py-[7px]">
                          <Link href={`${ctx.basePath}/calendar/publishing-queue?selected=${item.id}`} className={cn('flex items-center gap-2 hover:text-blue-600', T.focus)}>
                            <ChannelIcon channel={item.channel} size={11} />
                            <span className="truncate text-[11.5px] lg:text-[10px] font-medium text-slate-800">{item.title}</span>
                          </Link>
                        </td>
                        <td className="max-w-[110px] truncate px-2 py-[7px] text-[11.5px] lg:text-[10px] text-slate-600">{item.campaignName ?? '—'}</td>
                        <td className="px-2 py-[7px]"><ChannelIcon channel={item.channel} size={12} /></td>
                        <td className="whitespace-nowrap px-2 py-[7px] text-[11.5px] lg:text-[10px] text-slate-600">
                          {item.scheduledAt ? formatCompactWhen(item.scheduledAt, ctx.timezone, ctx.locale, new Date(nowMs)) : '—'}
                        </td>
                        <td className="max-w-[92px] truncate px-2 py-[7px] text-[11.5px] lg:text-[10px] text-slate-600">{item.ownerName ?? 'Unassigned'}</td>
                        <td className="px-4 py-[7px]">
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
          <Panel title="Conflicts" count={conflicts.data.total} footer={{ label: 'View all conflicts →', href: `${ctx.basePath}/calendar/conflicts` }} bodyClassName="divide-y divide-[#eef0f4]">
            {conflicts.error ? <ErrorState message={conflicts.error} /> : conflicts.data.conflicts.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={18} />} title="No open conflicts" body="Your agenda has no detected clashes." />
            ) : conflicts.data.conflicts.slice(0, 3).map(conflict => (
              // Reference row: severity dot · title · time · one-line cause · "View" bottom-right.
              <div key={conflict.id} className="relative py-2 pl-7 pr-12">
                <span className={cn('absolute left-3.5 top-[13px] h-[7px] w-[7px] rounded-full',
                  conflict.severity === 'critical' || conflict.severity === 'high' ? 'bg-red-500' : conflict.severity === 'medium' ? 'bg-orange-500' : 'bg-amber-400')} aria-hidden />
                <p className="truncate text-[11.5px] lg:text-[10px] font-semibold leading-[14px] text-slate-900">
                  {conflict.title}<span className="sr-only">, {conflict.severity} severity</span>
                </p>
                <p className="text-[11px] lg:text-[9.5px] leading-[14px] text-slate-600">
                  {conflict.startAt ? formatDateTime(conflict.startAt, ctx.timezone, ctx.locale) : formatShortDate(conflict.detectedAt, ctx.timezone, ctx.locale)}
                </p>
                {conflict.description && <p className="truncate text-[11px] lg:text-[9.5px] leading-[14px] text-slate-500">{conflict.description}</p>}
                <Link href={`${ctx.basePath}/calendar/conflicts?selected=${conflict.id}`} className={cn('absolute bottom-2 right-3.5 text-[11.5px] lg:text-[10px] font-medium text-blue-600 hover:underline', T.focus)}>
                  View
                </Link>
              </div>
            ))}
          </Panel>
        )}

        <Panel title="Recent activity" footer={{ label: 'View all activity →', href: `${ctx.basePath}/settings/data-and-governance` }} bodyClassName="pb-1.5">
          {activity.error ? <ErrorState message={activity.error} /> : activity.data.length === 0 ? (
            <EmptyState icon={<Clock size={18} />} title="No activity yet" body="Agenda changes will be logged here." />
          ) : activity.data.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 px-3.5 py-1">
              <Avatar name={item.actorName} size={24} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] lg:text-[10px] font-medium text-slate-800">{item.summary}</p>
                <p className="truncate text-[11px] lg:text-[9.5px] text-slate-400">by {item.actorName ?? 'System'}</p>
              </div>
              <span className="shrink-0 text-[11px] lg:text-[9.5px] text-slate-400">{formatRelativeShort(item.createdAt)}</span>
            </div>
          ))}
        </Panel>
      </div>

      <p className="mt-5 text-[11.5px] lg:text-[10px] text-slate-400">All times shown in {timezoneLabel(ctx.timezone)}.</p>
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
      <dt className="flex-1 text-[12px] lg:text-[10.5px] text-slate-600">{label}</dt>
      <dd className="text-[12px] lg:text-[10.5px] font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

export { Plus }
