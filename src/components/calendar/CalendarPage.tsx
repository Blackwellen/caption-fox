import Link from 'next/link'
import {
  AlertTriangle, CalendarDays, CheckCircle2, Clock, Download, MoreHorizontal,
  Rocket, Send, TrendingUp, Upload, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccessCalendarCapability, planLabel } from '@/lib/calendar/entitlements'
import {
  fetchCalendarActivity, fetchCalendarKpis, fetchLookups, fetchQueueItems,
  fetchScheduleEntries, groupIntoAgendaDays, nextActions, type CalendarSession,
  CHANNEL_LABELS, MAX_PAGE_SIZE,
} from '@/lib/calendar/queries'
import { fetchConflicts } from '@/lib/calendar/queries'
import {
  addDays, formatCompactWhen, formatDateTime, formatDuration, formatRelativeShort, formatShortDate, formatTime,
  timezoneLabel, todayKey, zonedDateKey,
} from '@/lib/calendar/dates'
import { pickView, readParams, resolveRange, type SearchParamsInput } from '@/lib/calendar/range'
import { CalendarPageChrome, HeaderButton } from './chrome'
import {
  AdvancedFilters, DateRangeControl, FilterBar, FilterSelect, PeriodStepper, ViewSwitcher,
} from './controls'
import {
  ActivityTile, Avatar, ChannelIcon, EmptyState, ErrorState, KindTile, KpiStrip, Panel,
  SeverityBadge, StatusBadge, T, type KpiDefinition,
} from './primitives'
import { AgendaView, DayView, MonthView, WeekView } from './views'
import { CalendarHeaderActions } from './dialogs'

export default async function CalendarPage({
  session, searchParams,
}: {
  session: CalendarSession
  searchParams: SearchParamsInput
}) {
  const { ctx } = session
  const filters = readParams(searchParams)

  const canWeek = canAccessCalendarCapability(ctx, 'calendar.weekView')
  const canDay = canAccessCalendarCapability(ctx, 'calendar.dayView')
  const requestedView = pickView(filters.view, ['month', 'week', 'day', 'agenda'] as const, 'month')
  // A view the workspace is not entitled to silently falls back rather than
  // rendering a blank surface.
  const view = (requestedView === 'week' && !canWeek) || (requestedView === 'day' && !canDay) ? 'month' : requestedView

  const range = resolveRange(ctx, filters, view)

  // Computed once per request and reused below instead of calling Date.now() inline in JSX.
  // Server Component: renders once per request with no client re-render/memoization, so
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  const [kpis, entries, lookups, conflicts, queue, activity] = await Promise.all([
    fetchCalendarKpis(session),
    fetchScheduleEntries(session, range, filters),
    fetchLookups(session),
    fetchConflicts(session, { startIso: range.startIso, endIso: range.endIso }, { pageSize: 6 }),
    // The preview is "what publishes next", independent of the month being viewed.
    fetchQueueItems(session, { startIso: nowIso, endIso: addDays(nowIso, 30).toISOString() }, {
      pageSize: MAX_PAGE_SIZE, sort: 'scheduled_at',
    }),
    fetchCalendarActivity(session, 5),
  ])
  const upcomingQueue = queue.data.items.filter(item => !['published', 'sent', 'cancelled'].includes(item.deliveryStatus))

  const canReschedule = canAccessCalendarCapability(ctx, 'calendar.reschedule')
  const canCreate = canAccessCalendarCapability(ctx, 'calendar.create')
  const canConflicts = canAccessCalendarCapability(ctx, 'calendar.conflicts')
  const canQueue = canAccessCalendarCapability(ctx, 'calendar.publishingQueue')
  const canAgenda = canAccessCalendarCapability(ctx, 'calendar.agenda')

  const kpiItems: KpiDefinition[] = [
    { id: 'scheduled', label: 'Scheduled this week', value: String(kpis.data.scheduledThisWeek), tone: 'blue', icon: <CalendarDays size={17} />, delta: kpis.data.scheduledThisWeekDelta !== null ? { value: kpis.data.scheduledThisWeekDelta, suffix: 'vs last week' } : null },
    { id: 'due', label: 'Publishing due today', value: String(kpis.data.publishingDueToday), tone: 'orange', icon: <Send size={17} />, delta: kpis.data.publishingDueTodayDelta !== null ? { value: kpis.data.publishingDueTodayDelta, suffix: 'vs yesterday' } : null },
    { id: 'conflicts', label: 'Conflict alerts', value: String(kpis.data.conflictAlerts), tone: 'red', icon: <AlertTriangle size={17} />, delta: kpis.data.conflictAlertsDelta !== null ? { value: kpis.data.conflictAlertsDelta, suffix: 'vs last week', goodWhenUp: false } : null },
    { id: 'ontime', label: 'On-time rate', value: kpis.data.onTimeRate === null ? '—' : `${kpis.data.onTimeRate}%`, tone: 'emerald', icon: <CheckCircle2 size={17} />, delta: kpis.data.onTimeRateDelta !== null ? { value: kpis.data.onTimeRateDelta, suffix: 'vs last 30 days' } : null, footnote: kpis.data.onTimeRate === null ? 'No completed publishes yet' : null },
    { id: 'capacity', label: 'Capacity utilisation', value: kpis.data.capacityUtilisation === null ? '—' : `${kpis.data.capacityUtilisation}%`, tone: 'sky', icon: <TrendingUp size={17} />, footnote: 'Of team capacity' },
    { id: 'launches', label: 'Upcoming launches', value: String(kpis.data.upcomingLaunches), tone: 'violet', icon: <Rocket size={17} />, footnote: kpis.data.nextLaunchLabel ? `Next: ${kpis.data.nextLaunchLabel}` : 'No launches scheduled' },
  ]

  const conflictWatch = conflicts.data.conflicts.slice(0, 3)
  const upcoming = nextActions(entries.data, new Date(nowMs), 5)
  // The preview looks forward from today, like the full Agenda, rather than from the grid's first cell.
  const today = todayKey(ctx.timezone)
  const agendaDays = groupIntoAgendaDays(entries.data, ctx).filter(day => day.date >= today).slice(0, 4)

  return (
    <div className={cn(T.page, 'pb-8')}>
      <CalendarPageChrome
        ctx={ctx}
        active="calendar"
        title="Calendar"
        subtitle="Manage your marketing schedule, delivery queue, and upcoming campaigns."
        actions={<CalendarHeaderActions ctx={ctx} lookups={lookups.data} />}
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
            <FilterSelect name="owner" label="Owner" options={lookups.data.owners} />
            <FilterSelect name="channel" label="Channel" options={lookups.data.channels} />
            <FilterSelect name="status" label="Status" options={STATUS_OPTIONS} />
            <AdvancedFilters
              extra={[
                { name: 'type', label: 'Item type', options: TYPE_OPTIONS },
                { name: 'campaign', label: 'Campaign', options: lookups.data.campaigns },
                { name: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
                { name: 'approval', label: 'Approval state', options: APPROVAL_OPTIONS },
                { name: 'conflict', label: 'Conflict state', options: CONFLICT_OPTIONS },
                { name: 'team', label: 'Team', options: lookups.data.teams },
              ]}
            />
          </>
        }
        right={
          <>
            <ViewSwitcher
              variant="soft"
              current={view}
              views={[
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week', disabledReason: canWeek ? null : `Week view is included from ${planLabel('creator_pro')}` },
                { id: 'day', label: 'Day', disabledReason: canDay ? null : `Day view is included from ${planLabel('creator_pro')}` },
                { id: 'agenda', label: 'Agenda' },
              ]}
            />
            <PeriodStepper />
          </>
        }
      />

      <div className="grid gap-[10px] xl:grid-cols-[minmax(0,1fr)_268px]">
        <div className="min-w-0">
          {entries.error ? (
            <div className={T.card}><ErrorState message={entries.error} /></div>
          ) : entries.data.length === 0 ? (
            <div className={T.card}>
              <EmptyState
                title="Nothing scheduled in this period"
                body={
                  Object.keys(filters).some(key => ['owner', 'channel', 'status', 'campaign', 'search', 'type', 'priority'].includes(key))
                    ? 'No items match the current filters. Clear them to see the full schedule.'
                    : 'Add a schedule item, or queue content for publishing, and it will appear here.'
                }
                action={canCreate ? <HeaderButton variant="primary" href={`${ctx.basePath}/calendar?new=1`}>New schedule item</HeaderButton> : undefined}
              />
            </div>
          ) : view === 'month' ? (
            <MonthView entries={entries.data} anchorIso={range.anchorIso} timezone={ctx.timezone} locale={ctx.locale} weekStartsOn={ctx.weekStartsOn} basePath={ctx.basePath} canReschedule={canReschedule} />
          ) : view === 'week' ? (
            <WeekView entries={entries.data} anchorIso={range.anchorIso} timezone={ctx.timezone} locale={ctx.locale} weekStartsOn={ctx.weekStartsOn} basePath={ctx.basePath} canReschedule={canReschedule} />
          ) : view === 'day' ? (
            <DayView entries={entries.data} anchorIso={range.anchorIso} timezone={ctx.timezone} locale={ctx.locale} weekStartsOn={ctx.weekStartsOn} basePath={ctx.basePath} canReschedule={canReschedule} />
          ) : (
            <AgendaView days={groupIntoAgendaDays(entries.data, ctx)} timezone={ctx.timezone} locale={ctx.locale} basePath={ctx.basePath} canReschedule={canReschedule} dense />
          )}
        </div>

        <div className="min-w-0 space-y-[11px]">
          <Panel
            title="Next actions"
            action={canAgenda ? { label: 'View all', href: `${ctx.basePath}/calendar/agenda` } : null}
            bodyClassName="pb-2"
          >
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing due" body="You have no upcoming items in this period." />
            ) : upcoming.map(entry => {
              const due = new Date(entry.startAt).getTime() - nowMs
              return (
                <div key={entry.id} className="flex items-center gap-2.5 px-3.5 py-[3px]">
                  {/* Reference: channel items show the platform mark; everything else a kind tile. */}
                  {entry.channel ? <ChannelIcon channel={entry.channel} size={16} className="!h-[26px] !w-[26px]" /> : <KindTile kind={entry.kind} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] lg:text-[9.5px] font-semibold leading-[14px] text-slate-900">{entry.title}</p>
                    <p className="truncate text-[10px] lg:text-[9px] leading-[13px] text-slate-500">{entry.campaignName ?? CHANNEL_LABELS[entry.channel ?? ''] ?? entry.subtitle ?? 'Schedule item'}</p>
                  </div>
                  <span className={cn('shrink-0 text-[10.5px] lg:text-[9px] font-medium', due < 0 ? 'text-red-600' : due < 4 * 3600_000 ? 'text-amber-600' : 'text-slate-400')}>
                    {due < 0 ? `${formatDuration(due)} late` : due < 24 * 3600_000 ? `Due in ${formatDuration(due)}` : formatShortDate(entry.startAt, ctx.timezone, ctx.locale)}
                  </span>
                </div>
              )
            })}
          </Panel>

          {canConflicts && (
            <Panel
              title="Conflict watch"
              count={conflicts.data.total}
              action={{ label: 'View all', href: `${ctx.basePath}/calendar/conflicts` }}
              bodyClassName="pb-2"
            >
              {conflicts.error ? <ErrorState message={conflicts.error} /> : conflictWatch.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={18} />} title="No open conflicts" body="Your schedule is clear of clashes for this period." />
              ) : conflictWatch.map(conflict => (
                <Link key={conflict.id} href={`${ctx.basePath}/calendar/conflicts?selected=${conflict.id}`}
                  className={cn('flex items-start gap-2.5 px-3.5 py-[5px] hover:bg-slate-50', T.focus)}>
                  <ChannelIcon channel={conflict.channels[0]} size={13} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] lg:text-[9.5px] font-semibold leading-[14px] text-slate-900">{conflict.title}</p>
                    <p className="truncate text-[10px] lg:text-[9px] leading-[13px] text-slate-500">
                      {conflict.startAt ? formatDateTime(conflict.startAt, ctx.timezone, ctx.locale) : formatShortDate(conflict.detectedAt, ctx.timezone, ctx.locale)}
                    </p>
                  </div>
                  <SeverityBadge severity={conflict.severity} />
                </Link>
              ))}
            </Panel>
          )}
        </div>
      </div>

      {/* Reference bottom row is unequal: 302 / 508 / 370. */}
      <div className="mt-[13px] grid gap-[11px] xl:grid-cols-[302fr_508fr_370fr]">
        <Panel
          title="Agenda preview"
          action={canAgenda ? { label: 'View full agenda', href: `${ctx.basePath}/calendar/agenda` } : null}
          bodyClassName="pb-2"
        >
          {agendaDays.length === 0 ? (
            <EmptyState title="Nothing coming up" body="Items scheduled in this period will be listed here." />
          ) : agendaDays.flatMap(day => [...day.allDay, ...day.timed].slice(0, 1).map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-3.5 py-[5px] lg:py-[3px]">
              {/* Reference date badge: weekday tag (solid for today), day number, month. */}
              <span className="flex w-[34px] shrink-0 flex-col items-center overflow-hidden rounded-md border border-[#eef0f4] bg-white text-center">
                <span className={cn('w-full py-px text-[8px] font-bold uppercase leading-[11px] tracking-wide', day.isToday ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600')}>
                  {day.isToday ? 'Today' : new Intl.DateTimeFormat(ctx.locale, { weekday: 'short', timeZone: ctx.timezone }).format(new Date(entry.startAt))}
                </span>
                <span className="pt-0.5 text-[15px] font-bold leading-[17px] text-slate-900">{new Intl.DateTimeFormat(ctx.locale, { day: 'numeric', timeZone: ctx.timezone }).format(new Date(entry.startAt))}</span>
                <span className="pb-0.5 text-[7.5px] font-semibold uppercase leading-[10px] text-slate-500">{new Intl.DateTimeFormat(ctx.locale, { month: 'short', timeZone: ctx.timezone }).format(new Date(entry.startAt))}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] lg:text-[9.5px] font-semibold leading-[14px] text-slate-900">{entry.title}</p>
                <p className="truncate text-[10px] lg:text-[9px] leading-[13px] text-slate-500">
                  {CHANNEL_LABELS[entry.channel ?? ''] ?? entry.kind} · {entry.allDay ? 'All day' : formatTime(entry.startAt, ctx.timezone, ctx.locale)}
                </p>
              </div>
              <StatusBadge status={entry.status} variant="dot" />
            </div>
          )))}
        </Panel>

        {canQueue ? (
          <Panel
            title="Publishing queue"
            count={upcomingQueue.length}
            action={{ label: 'View full queue', href: `${ctx.basePath}/calendar/publishing-queue` }}
            bodyClassName="flex flex-col p-0"
          >
            {queue.error ? <ErrorState message={queue.error} /> : upcomingQueue.length === 0 ? (
              <EmptyState icon={<Send size={18} />} title="Queue is empty" body="Queued content waiting to publish appears here." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  {/* Fixed proportional columns, as in the reference, so the table never scrolls sideways. */}
                  <table className="w-full table-fixed text-left">
                    <caption className="sr-only">Next items due to publish</caption>
                    <colgroup>
                      <col className="w-[26%]" /><col className="w-[15%]" /><col className="w-[25%]" /><col className="w-[14%]" /><col className="w-[20%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-y border-[#eef0f4] bg-[#f8f9fb] text-[10.5px] lg:text-[9px] font-medium text-slate-500">
                        <th scope="col" className="px-4 py-[6px]">Item</th>
                        <th scope="col" className="px-2 py-[6px]">Channel</th>
                        <th scope="col" className="px-2 py-[6px]">Scheduled</th>
                        <th scope="col" className="px-2 py-[6px]">Status</th>
                        <th scope="col" className="px-4 py-[6px]">Owner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {upcomingQueue.slice(0, 5).map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="max-w-[112px] px-4 py-[5px]">
                            <Link href={`${ctx.basePath}/calendar/publishing-queue?selected=${item.id}`} className={cn('flex items-center gap-2 hover:text-blue-600', T.focus)}>
                              <ChannelIcon channel={item.channel} size={11} />
                              <span className="truncate text-[11px] lg:text-[9.5px] font-medium text-slate-800">{item.title}</span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-2 py-[5px] text-[11px] lg:text-[9.5px] text-slate-600">{CHANNEL_LABELS[item.channel ?? ''] ?? '—'}</td>
                          <td className="whitespace-nowrap px-2 py-[5px] text-[11px] lg:text-[9.5px] text-slate-600">
                            {item.scheduledAt ? formatCompactWhen(item.scheduledAt, ctx.timezone, ctx.locale, new Date(nowMs)) : '—'}
                          </td>
                          <td className="px-2 py-[5px]"><StatusBadge status={deliveryToStatus(item.deliveryStatus, item.approvalStatus)} /></td>
                          <td className="px-4 py-[5px]">
                            <span className="flex items-center gap-1.5" title={item.ownerName ?? 'Unassigned'}>
                              <Avatar name={item.ownerName} size={20} />
                              <span className="truncate text-[11px] lg:text-[9.5px] text-slate-700" aria-hidden>{item.ownerName?.split(' ')[0] ?? '—'}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-[#eef0f4] px-4 py-2.5 text-[11.5px] lg:text-[10px]">
                  <span className="text-slate-500">{upcomingQueue.length} item{upcomingQueue.length === 1 ? '' : 's'} in queue</span>
                  <Link href={`${ctx.basePath}/calendar/publishing-queue`} className={cn('font-medium text-blue-600 hover:text-blue-700', T.focus)}>Show all</Link>
                </div>
              </>
            )}
          </Panel>
        ) : (
          <Panel title="Publishing queue">
            <EmptyState
              icon={<Zap size={18} />}
              title={`Included from ${planLabel('creator_pro')}`}
              body="Upgrade to manage queued content, approvals and delivery status in one place."
              action={<HeaderButton variant="primary" href={`${ctx.basePath}/settings/billing`}>See plans</HeaderButton>}
            />
          </Panel>
        )}

        <Panel
          title="Recent activity"
          action={{ label: 'View all activity', href: `${ctx.basePath}/settings/data-and-governance` }}
          bodyClassName="pb-2"
        >
          {activity.error ? <ErrorState message={activity.error} /> : activity.data.length === 0 ? (
            <EmptyState icon={<Clock size={18} />} title="No activity yet" body="Schedule changes, approvals and publishes will be logged here." />
          ) : activity.data.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 px-3.5 py-[5px] lg:py-2">
              <ActivityTile tone={item.tone} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] lg:text-[9.5px] font-medium leading-[14px] text-slate-900">{item.summary}</p>
                <p className="truncate text-[10px] lg:text-[9px] leading-[13px] text-slate-500">by {item.actorName ?? 'System'}</p>
              </div>
              <span className="shrink-0 text-[10.5px] lg:text-[9px] text-slate-400">{formatRelativeShort(item.createdAt)}</span>
            </div>
          ))}
        </Panel>
      </div>

      <p className="mt-5 text-[11.5px] lg:text-[10px] text-slate-400">
        All times shown in {timezoneLabel(ctx.timezone)}.
      </p>
    </div>
  )
}

function deliveryToStatus(delivery: string, approval: string) {
  if (delivery === 'failed') return 'failed' as const
  if (delivery === 'published' || delivery === 'sent') return 'published' as const
  if (delivery === 'cancelled') return 'cancelled' as const
  if (approval === 'awaiting_approval') return 'pending' as const
  if (approval === 'changes_requested') return 'in_review' as const
  if (delivery === 'ready' || delivery === 'queued') return 'approved' as const
  if (delivery === 'draft') return 'draft' as const
  return 'scheduled' as const
}

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'published', label: 'Published' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const TYPE_OPTIONS = [
  { value: 'content', label: 'Content' },
  { value: 'campaign', label: 'Campaign milestone' },
  { value: 'task', label: 'Task' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'approval', label: 'Approval' },
  { value: 'event', label: 'Event' },
]

export const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export const APPROVAL_OPTIONS = [
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
]

export const CONFLICT_OPTIONS = [
  { value: 'conflicted', label: 'Has conflicts' },
  { value: 'clear', label: 'No conflicts' },
]

export { Download, Upload, MoreHorizontal, zonedDateKey, MAX_PAGE_SIZE }
