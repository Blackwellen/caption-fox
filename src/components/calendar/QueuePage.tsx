import Link from 'next/link'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock, Hourglass,
  Inbox, Send, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccessCalendarCapability, planLabel } from '@/lib/calendar/entitlements'
import {
  fetchCalendarActivity, fetchDelayedItems, fetchLookups, fetchQueueAlerts,
  fetchQueueItems, fetchQueueKpis, fetchQueueLaneCounts, fetchThroughput,
  fetchScheduleEntries, CHANNEL_LABELS, MAX_PAGE_SIZE, type CalendarSession,
} from '@/lib/calendar/queries'
import { formatDateTime, formatDuration, formatRelativeShort, timezoneAbbrev, zonedDateKey } from '@/lib/calendar/dates'
import { parsePage, pickView, readParams, resolveRange, type SearchParamsInput } from '@/lib/calendar/range'
import { QUEUE_LANES } from '@/lib/calendar/types'
import { CalendarPageChrome, HeaderButton } from './chrome'
import { AdvancedFilters, DateRangeControl, FilterBar, FilterSearch, FilterSelect, ViewSwitcher } from './controls'
import {
  Avatar, ChannelIcon, EmptyState, ErrorState, KpiStrip, Panel, PriorityTag,
  StatusBadge, T, type KpiDefinition,
} from './primitives'
import { QueueLanes, QueuePrimaryActions, QueueTable } from './queue-client'
import { SecondaryHeaderActions } from './dialogs'
import { ThroughputChart } from './charts'
import { MiniCalendar, MonthView } from './views'
import { APPROVAL_OPTIONS, PRIORITY_OPTIONS } from './CalendarPage'

const DELIVERY_OPTIONS = [
  { value: 'draft', label: 'Draft' }, { value: 'queued', label: 'Queued' },
  { value: 'ready', label: 'Ready' }, { value: 'scheduled', label: 'Scheduled' },
  { value: 'processing', label: 'Publishing' }, { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' },
]

const QUEUE_APPROVAL_OPTIONS = [
  { value: 'not_required', label: 'Not required' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'rejected', label: 'Rejected' },
]

export default async function QueuePage({
  session, searchParams,
}: {
  session: CalendarSession
  searchParams: SearchParamsInput
}) {
  const { ctx } = session
  const filters = readParams(searchParams)
  const view = pickView(filters.view, ['queue', 'table', 'calendar'] as const, 'queue')
  const { page, pageSize } = parsePage(filters)
  const sort = /^[a-z_]+(:(asc|desc))?$/.test(filters.sort ?? '') ? filters.sort! : 'scheduled_at:asc'

  const range = resolveRange(ctx, filters, 'range', { agendaDays: 31 })

  const [kpis, lookups, lanes, items, alerts, throughput, delayed, activity, schedule] = await Promise.all([
    fetchQueueKpis(session),
    fetchLookups(session),
    fetchQueueLaneCounts(session, range),
    fetchQueueItems(session, range, { ...filters, page, pageSize, sort }),
    fetchQueueAlerts(session),
    fetchThroughput(session, 7),
    fetchDelayedItems(session, 4),
    fetchCalendarActivity(session, 5),
    fetchScheduleEntries(session, range, { ...filters, type: 'content' }),
  ])

  // Bulk publish only offers records that are genuinely publishable right now.
  const publishable = await fetchQueueItems(session, range, { ...filters, pageSize: MAX_PAGE_SIZE, page: 1 })
  const publishableIds = publishable.data.items
    .filter(item => item.approvalStatus !== 'awaiting_approval' && item.approvalStatus !== 'changes_requested')
    .filter(item => !['published', 'sent', 'cancelled'].includes(item.deliveryStatus))
    .filter(item => item.providerConnected)
    .map(item => item.id)

  // Computed once per request and reused below instead of calling Date.now() inline in JSX.
  // Server Component: renders once per request with no client re-render/memoization, so
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()

  const kpiItems: KpiDefinition[] = [
    { id: 'queued', label: 'Queued items', value: String(kpis.data.queued), tone: 'blue', icon: <Inbox size={17} />, delta: delta(kpis.data.queuedDelta) },
    { id: 'awaiting', label: 'Awaiting approval', value: String(kpis.data.awaitingApproval), tone: 'amber', icon: <Hourglass size={17} />, delta: delta(kpis.data.awaitingApprovalDelta) },
    { id: 'ready', label: 'Ready to publish', value: String(kpis.data.readyToPublish), tone: 'emerald', icon: <CheckCircle2 size={17} />, delta: delta(kpis.data.readyToPublishDelta) },
    { id: 'failed', label: 'Failed publishes', value: String(kpis.data.failed), tone: 'red', icon: <XCircle size={17} />, delta: delta(kpis.data.failedDelta, false) },
    { id: 'today', label: 'Scheduled today', value: String(kpis.data.scheduledToday), tone: 'violet', icon: <CalendarDays size={17} />, delta: delta(kpis.data.scheduledTodayDelta) },
    { id: 'sla', label: 'SLA risk', value: String(kpis.data.slaRisk), tone: 'orange', icon: <AlertTriangle size={17} />, footnote: 'Due within 4 hours or overdue' },
  ]

  const laneCards = QUEUE_LANES.map(lane => ({
    id: lane.id, label: lane.label,
    count: lanes.data[lane.id].count,
    preview: lanes.data[lane.id].preview,
  }))

  const markedDates: Record<string, 'scheduled' | 'conflict' | 'priority'> = {}
  for (const item of publishable.data.items) {
    if (!item.scheduledAt) continue
    const key = zonedDateKey(item.scheduledAt, ctx.timezone)
    markedDates[key] = item.priority === 'high' || item.priority === 'urgent' ? 'priority' : markedDates[key] ?? 'scheduled'
  }
  for (const entry of schedule.data) {
    if (entry.conflictIds.length) markedDates[zonedDateKey(entry.startAt, ctx.timezone)] = 'conflict'
  }

  return (
    <div className={cn(T.page, 'py-6')}>
      <CalendarPageChrome
        ctx={ctx}
        active="publishing-queue"
        title="Publishing Queue"
        subtitle="Manage queued content, track approvals, and ensure on-time delivery across all channels."
        actions={
          <SecondaryHeaderActions
            ctx={ctx}
            surface="queue"
            primary={<QueuePrimaryActions ctx={ctx} publishableIds={publishableIds} />}
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
            <FilterSearch placeholder="Search queue items…" className="w-56" />
            <DateRangeControl label={range.label} />
            <FilterSelect name="channel" label="Channel" options={lookups.data.channels} />
            <FilterSelect name="owner" label="Owner" options={lookups.data.owners} />
            <FilterSelect name="approval" label="Approval" options={QUEUE_APPROVAL_OPTIONS} />
            <FilterSelect name="priority" label="Priority" options={PRIORITY_OPTIONS} />
            <AdvancedFilters
              extra={[
                { name: 'delivery', label: 'Delivery status', options: DELIVERY_OPTIONS },
                { name: 'campaign', label: 'Campaign', options: lookups.data.campaigns },
                { name: 'lane', label: 'Queue lane', options: QUEUE_LANES.map(l => ({ value: l.id, label: l.label })) },
              ]}
            />
          </>
        }
        right={
          <ViewSwitcher
            current={view}
            views={[
              { id: 'queue', label: 'Queue' },
              { id: 'table', label: 'Table' },
              { id: 'calendar', label: 'Calendar' },
            ]}
          />
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="min-w-0">
          {items.error ? (
            <div className={T.card}><ErrorState message={items.error} /></div>
          ) : view === 'calendar' ? (
            schedule.data.length === 0 ? (
              <div className={T.card}>
                <EmptyState icon={<Send size={18} />} title="Nothing scheduled in this period" body="Queue content for publishing and it will appear on this calendar." />
              </div>
            ) : (
              <MonthView
                entries={schedule.data}
                anchorIso={range.anchorIso}
                timezone={ctx.timezone}
                locale={ctx.locale}
                weekStartsOn={ctx.weekStartsOn}
                basePath={ctx.basePath}
                canReschedule={canAccessCalendarCapability(ctx, 'queue.edit')}
              />
            )
          ) : (
            <>
              {view === 'queue' && !lanes.error && <QueueLanes ctx={ctx} lanes={laneCards} />}
              <QueueTable ctx={ctx} items={items.data.items} total={items.data.total} page={page} pageSize={pageSize} sort={sort} nowMs={nowMs} />
            </>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Queue alerts" count={alerts.data.length} bodyClassName="divide-y divide-slate-100">
            {alerts.error ? <ErrorState message={alerts.error} /> : alerts.data.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={18} />} title="No alerts" body="Nothing in the queue needs attention right now." />
            ) : alerts.data.map(alert => (
              <Link key={alert.kind} href={`${ctx.basePath}/calendar/publishing-queue?${alert.filterQuery}`}
                className={cn('flex items-center gap-2.5 px-5 py-3 first:pt-4 last:pb-4 hover:bg-slate-50', T.focus)}>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  alert.severity === 'high' ? 'bg-red-50 text-red-600' : alert.severity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600')} aria-hidden>
                  <AlertTriangle size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900">{alert.title}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">{alert.detail}</span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-slate-300" aria-hidden />
              </Link>
            ))}
          </Panel>

          <Panel title="Upcoming schedule" action={{ label: 'View calendar', href: `${ctx.basePath}/calendar` }}>
            <MiniCalendar
              anchorIso={range.anchorIso}
              timezone={ctx.timezone}
              locale={ctx.locale}
              weekStartsOn={ctx.weekStartsOn}
              markedDates={markedDates}
              selectedDate={range.selectedDate}
              legend={[
                { label: `${kpis.data.queued} scheduled`, className: 'bg-blue-500' },
                { label: 'High priority', className: 'bg-amber-500' },
                { label: 'Conflicts', className: 'bg-red-500' },
              ]}
            />
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Publishing throughput" hint="Items published, still scheduled, and failed per day over the last 7 days.">
          {throughput.error ? <ErrorState message={throughput.error} /> : (
            <ThroughputChart data={throughput.data} locale={ctx.locale} timezone={ctx.timezone} />
          )}
        </Panel>

        <Panel title="Delayed items" action={{ label: 'View all', href: `${ctx.basePath}/calendar/publishing-queue?delivery=failed` }} bodyClassName="divide-y divide-slate-100">
          {delayed.error ? <ErrorState message={delayed.error} /> : delayed.data.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={18} />} title="Nothing is late" body="Every queued item is still within its scheduled window." />
          ) : delayed.data.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3 first:pt-4 last:pb-4">
              <ChannelIcon channel={item.channel} size={14} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-900">{item.title}</p>
                <p className="truncate text-[11.5px] text-slate-500">{CHANNEL_LABELS[item.channel ?? ''] ?? 'Unassigned channel'}</p>
              </div>
              <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                {item.scheduledAt ? `${formatDuration(nowMs - new Date(item.scheduledAt).getTime())} overdue` : 'Overdue'}
              </span>
              <Avatar name={item.ownerName} />
              <PriorityTag priority={item.priority} />
            </div>
          ))}
        </Panel>

        <Panel title="Recent publishing activity" bodyClassName="divide-y divide-slate-100">
          {activity.error ? <ErrorState message={activity.error} /> : activity.data.length === 0 ? (
            <EmptyState icon={<Clock size={18} />} title="No activity yet" body="Approvals, publishes and retries will be logged here." />
          ) : activity.data.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 px-5 py-2.5 first:pt-4 last:pb-4">
              <span className="w-12 shrink-0 text-[11px] font-medium text-slate-400">
                {formatDateTime(item.createdAt, ctx.timezone, ctx.locale).split(', ')[1] ?? formatRelativeShort(item.createdAt)}
              </span>
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                item.tone === 'success' ? 'bg-emerald-500' : item.tone === 'danger' ? 'bg-red-500' : item.tone === 'warning' ? 'bg-amber-500' : 'bg-blue-500')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-slate-800">{item.summary}</p>
                <p className="truncate text-[11px] text-slate-400">by {item.actorName ?? 'System'}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <p className="mt-5 text-[11.5px] text-slate-400">
        All times shown in {ctx.timezone} ({timezoneAbbrev(ctx.timezone)}). Publishing runs through the delivery worker — items are never sent from your browser.
      </p>
    </div>
  )
}

function delta(value: number | null, goodWhenUp = true) {
  return value === null ? null : { value, suffix: 'vs yesterday', goodWhenUp }
}

export { StatusBadge, HeaderButton, planLabel, APPROVAL_OPTIONS }
