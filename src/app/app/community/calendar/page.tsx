import Link from 'next/link'
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, Trophy } from 'lucide-react'
import { requireCommunityModule } from '@/lib/community/server'
import {
  eventAggregates, listEvents, todaysAgenda, upcomingEvents, workspaceMembers,
} from '@/lib/community/data'
import { buildHref, parseCalendarQuery, type RawParams } from '@/lib/community/query'
import {
  EVENT_STATUS_BADGE, EVENT_STATUS_DOT, EVENT_STATUS_LABELS,
  EVENT_TYPE_BADGE, EVENT_TYPE_COLOUR, EVENT_TYPE_LABELS, EVENT_TYPES, EVENT_SORTS,
} from '@/lib/community/constants'
import CommunityHeader from '@/components/community/CommunityHeader'
import KpiStrip from '@/components/community/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/community/FilterBar'
import Pagination from '@/components/community/Pagination'
import { TrendChart } from '@/components/community/charts'
import { AccessBlocked, CommunityEmpty, LoadError } from '@/components/community/states'
import {
  CARD, CARD_SHADOW, COMMUNITY_PAGE, Panel, formatDayMonth, formatNumber, formatPercent, formatShortDate, formatTime,
} from '@/components/community/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/community/types'

export const metadata = { title: 'Community Calendar · Caption Fox' }

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' })
    .format(new Date(`${month}-01T12:00:00Z`))
}

function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}

/** Sun-first 6-row month grid, always full weeks so the layout never jumps. */
function buildMonthCells(month: string): { date: string; inMonth: boolean }[] {
  const first = new Date(`${month}-01T00:00:00Z`)
  const startOffset = first.getUTCDay()
  const gridStart = new Date(first)
  gridStart.setUTCDate(gridStart.getUTCDate() - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart)
    date.setUTCDate(date.getUTCDate() + i)
    return { date: date.toISOString().slice(0, 10), inMonth: date.getUTCMonth() === first.getUTCMonth() }
  })
}

export default async function CommunityCalendarPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCommunityModule('calendar')

  if (!access.allowed) {
    return (
      <div className={COMMUNITY_PAGE}>
        <CommunityHeader module="calendar" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCalendarQuery(params)
  const workspaceId = ctx.workspaceId

  const [aggregates, monthEvents, page, agenda, upcoming, members] = await Promise.all([
    eventAggregates(supabase, workspaceId),
    listEvents(supabase, workspaceId, query, { all: true, limit: 500, monthOnly: true }),
    listEvents(supabase, workspaceId, query),
    todaysAgenda(supabase, workspaceId),
    upcomingEvents(supabase, workspaceId, 5),
    workspaceMembers(supabase, workspaceId),
  ])

  const filters: FilterSpec[] = [
    { key: 'type', label: 'Type', allLabel: 'All types', options: EVENT_TYPES.map(t => ({ value: t, label: EVENT_TYPE_LABELS[t] })) },
    { key: 'owner', label: 'Owner', allLabel: 'All owners', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })) },
    { key: 'status', label: 'Status', allLabel: 'All status', options: Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    { key: 'community', label: 'Community', allLabel: 'All communities', options: [], advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Soonest', options: EVENT_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ].filter(f => f.key !== 'community' || f.options.length > 0)

  const cells = buildMonthCells(query.month)
  const byDate = new Map<string, typeof monthEvents.rows>()
  for (const event of monthEvents.rows) {
    const key = event.starts_at.slice(0, 10)
    byDate.set(key, [...(byDate.get(key) ?? []), event])
  }
  const todayKey = new Date().toISOString().slice(0, 10)

  const attendanceDelta = aggregates.attendanceRate - aggregates.previousAttendanceRate
  const rsvpDelta = aggregates.rsvpCount - aggregates.previousRsvpCount

  const kpis: KpiValue[] = [
    { id: 'scheduled', label: 'Scheduled events', value: formatNumber(aggregates.scheduled), hint: 'Confirmed, upcoming', icon: 'calendar', tone: 'blue' },
    { id: 'live', label: 'Live sessions', value: formatNumber(aggregates.live), hint: 'This calendar', icon: 'target', tone: 'violet' },
    { id: 'challenges', label: 'Challenges running', value: formatNumber(aggregates.challenges), hint: 'Across all communities', icon: 'trend', tone: 'amber' },
    { id: 'rsvp', label: 'RSVP count', value: formatNumber(aggregates.rsvpCount), hint: `${rsvpDelta >= 0 ? '+' : ''}${formatNumber(rsvpDelta)} vs last 30 days`, trend: rsvpDelta >= 0 ? 'up' : 'down', icon: 'users', tone: 'green' },
    { id: 'pending', label: 'Pending approvals', value: formatNumber(aggregates.pendingApprovals), hint: aggregates.pendingApprovals > 0 ? 'Needs review' : 'All clear', icon: 'clock', tone: aggregates.pendingApprovals > 0 ? 'amber' : 'slate' },
    { id: 'attendance', label: 'Attendance rate', value: formatPercent(aggregates.attendanceRate), hint: `${attendanceDelta >= 0 ? '+' : ''}${attendanceDelta.toFixed(1)}pp vs last 30 days`, trend: attendanceDelta >= 0 ? 'up' : 'down', icon: 'checks', tone: 'blue' },
  ]

  return (
    <div className={COMMUNITY_PAGE}>
      <CommunityHeader
        module="calendar" modules={modules}
        actions={(
          <>
            {capabilities.createEvent && (
              <Link href="/app/community/calendar?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                <CalendarPlus size={15} />New event
              </Link>
            )}
            {capabilities.createEvent && (
              <Link href="/app/community/calendar?new=challenge" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Trophy size={15} />Create challenge
              </Link>
            )}
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Link href={buildHref('/app/community/calendar', query, { month: shiftMonth(query.month, -1) })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={15} /></Link>
                <span className="min-w-[140px] text-center text-[14px] font-semibold text-slate-800">{monthLabel(query.month)}</span>
                <Link href={buildHref('/app/community/calendar', query, { month: shiftMonth(query.month, 1) })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Next month"><ChevronRight size={15} /></Link>
              </div>
            </div>

            <FilterBar
              searchPlaceholder="Search events…"
              filters={filters}
              views={['calendar', 'table']}
              activeView={query.view}
              values={query}
            />

            {query.view === 'calendar' ? (
              <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
                <div className="grid grid-cols-7 border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="px-2 py-2 text-center">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map(cell => {
                    const events = byDate.get(cell.date) ?? []
                    const isToday = cell.date === todayKey
                    return (
                      <div key={cell.date} className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 ${cell.inMonth ? '' : 'bg-slate-50/50'}`}>
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? 'bg-blue-600 font-semibold text-white' : cell.inMonth ? 'text-slate-600' : 'text-slate-300'}`}>
                          {Number(cell.date.slice(8, 10))}
                        </span>
                        <div className="mt-1 space-y-1">
                          {events.slice(0, 3).map(event => (
                            <Link
                              key={event.id} href={`/app/community/calendar?selected=${event.id}`}
                              className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10.5px] font-medium text-white"
                              style={{ backgroundColor: EVENT_TYPE_COLOUR[event.type as keyof typeof EVENT_TYPE_COLOUR] ?? '#64748b' }}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${EVENT_STATUS_DOT[event.status as keyof typeof EVENT_STATUS_DOT] ?? 'bg-white'}`} aria-hidden />
                              <span className="truncate">{event.title}</span>
                            </Link>
                          ))}
                          {events.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{events.length - 3} more</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-[11px] text-slate-500">
                  {EVENT_TYPES.map(type => (
                    <span key={type} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLOUR[type] }} aria-hidden />
                      {EVENT_TYPE_LABELS[type]}
                    </span>
                  ))}
                </div>
              </div>
            ) : page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CommunityEmpty title="No events found" message="Try widening your filters, or schedule a new event." />
            ) : (
              <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Event</th>
                        <th className="px-3 py-2.5 font-medium">Community</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 font-medium">Owner</th>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Registrations</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {page.rows.map(event => (
                        <tr key={event.id}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{event.title}</td>
                          <td className="px-3 py-2.5 text-slate-500">{event.community?.name ?? 'All communities'}</td>
                          <td className="px-3 py-2.5"><Badge variant={EVENT_TYPE_BADGE[event.type as keyof typeof EVENT_TYPE_BADGE] ?? 'slate'}>{EVENT_TYPE_LABELS[event.type as keyof typeof EVENT_TYPE_LABELS] ?? event.type}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-500">{event.owner?.full_name ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{formatShortDate(event.starts_at)} · {formatTime(event.starts_at)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{formatNumber(event.rsvp_count)}</td>
                          <td className="px-3 py-2.5"><Badge variant={EVENT_STATUS_BADGE[event.status as keyof typeof EVENT_STATUS_BADGE] ?? 'slate'}>{EVENT_STATUS_LABELS[event.status as keyof typeof EVENT_STATUS_LABELS] ?? event.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={query.page} size={query.size} total={page.total} label="events" />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Panel title="Event performance summary" className="md:col-span-1">
                <dl className="space-y-3 text-[13px]">
                  <div className="flex items-center justify-between"><dt className="text-slate-500">Total events</dt><dd className="font-semibold text-slate-900">{formatNumber(aggregates.scheduled)}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-slate-500">Avg attendance rate</dt><dd className="font-semibold text-slate-900">{formatPercent(aggregates.attendanceRate)}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-slate-500">Total attendees</dt><dd className="font-semibold text-slate-900">{formatNumber(page.rows.reduce((sum, e) => sum + e.attendance_count, 0))}</dd></div>
                </dl>
              </Panel>
              <Panel title="Registrations trend" className="md:col-span-2">
                <TrendChart data={aggregates.registrationsSeries} series={[{ key: 'registrations', label: 'Registrations', colour: '#3b82f6' }]} height={150} />
              </Panel>
            </div>
          </div>

          <aside className="space-y-4">
            <Panel title="Today's agenda" viewAllHref="/app/community/calendar?view=table">
              {agenda.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">Nothing scheduled today.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {agenda.map(event => (
                    <li key={event.id} className="flex items-center gap-2.5 py-2.5">
                      <span className="w-14 shrink-0 text-[11.5px] font-medium text-slate-500">{formatTime(event.starts_at)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-slate-800">{event.title}</p>
                        <p className="truncate text-[11px] text-slate-400">{event.community?.name ?? 'All communities'}</p>
                      </div>
                      {event.location_or_url && (
                        <a href={event.location_or_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
                          Join<ExternalLink size={11} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Upcoming events" viewAllHref="/app/community/calendar?view=table">
              {upcoming.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No upcoming events.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map(event => (
                    <li key={event.id} className="flex items-center gap-2.5 py-2">
                      <span className="w-11 shrink-0 text-center text-[11px] font-semibold text-slate-500">{formatDayMonth(event.starts_at)}</span>
                      <p className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700">{event.title}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Event alerts">
              <ul className="space-y-2 text-[12.5px]">
                {aggregates.pendingApprovals > 0 && <li className="text-amber-600">{aggregates.pendingApprovals} events need approval</li>}
                {monthEvents.rows.filter(e => e.status === 'cancelled').length > 0 && (
                  <li className="text-red-500">{monthEvents.rows.filter(e => e.status === 'cancelled').length} cancelled this month</li>
                )}
                {aggregates.pendingApprovals === 0 && monthEvents.rows.filter(e => e.status === 'cancelled').length === 0 && (
                  <li className="text-slate-400">No active alerts.</li>
                )}
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
