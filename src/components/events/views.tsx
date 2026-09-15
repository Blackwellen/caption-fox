import Link from 'next/link'
import { cn } from '@/lib/utils'
import { eventLocationLabel, formatEventDate, formatEventTime, formatNumber } from '@/lib/events/format'
import type { EventWithStats } from '@/lib/events/types'
import { EventsEmptyState, StatusBadge } from './primitives'

/**
 * Alternate views for the events directory.
 *
 * Each one is a genuinely different operational read of the same records —
 * a month grid, and a chronological planning band — not a restyled list.
 */

/* ------------------------------------------------------------- calendar */

export function EventsCalendarView({
  events, hrefFor, timezone, month,
}: {
  events: EventWithStats[]
  hrefFor: (event: EventWithStats) => string
  timezone: string
  /** First day of the month to render. Defaults to the current month. */
  month?: Date
}) {
  const anchor = month ?? firstOfMonth(new Date())
  const start = startOfWeek(anchor)
  const days: Date[] = []
  for (let index = 0; index < 42; index += 1) {
    days.push(new Date(start.getTime() + index * 86_400_000))
  }

  const byDay = new Map<string, EventWithStats[]>()
  for (const event of events) {
    if (!event.start_at) continue
    const key = event.start_at.slice(0, 10)
    byDay.set(key, [...(byDay.get(key) ?? []), event])
  }

  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(anchor)

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <h3 className="text-[14px] font-semibold text-slate-900">{monthLabel}</h3>
        <p className="text-[11.5px] text-slate-500">
          {formatNumber(events.filter(event => event.start_at).length)} scheduled in view
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7 border-t border-slate-100">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => (
            <div key={label} className="border-b border-slate-100 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </div>
          ))}
          {days.map(day => {
            const key = toKey(day)
            const dayEvents = byDay.get(key) ?? []
            const inMonth = day.getMonth() === anchor.getMonth()
            const isToday = key === toKey(new Date())
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[92px] border-b border-r border-slate-100 p-1.5',
                  !inMonth && 'bg-slate-50/60',
                )}
              >
                <p className={cn(
                  'mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11.5px] font-semibold',
                  isToday ? 'bg-blue-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400',
                )}>
                  {day.getDate()}
                </p>
                <ul className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <li key={event.id}>
                      <Link
                        href={hrefFor(event)}
                        className="block truncate rounded-md bg-blue-50 px-1.5 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100"
                        title={`${event.name} · ${formatEventTime(event.start_at, timezone)}`}
                      >
                        {event.name}
                      </Link>
                    </li>
                  ))}
                  {dayEvents.length > 3 && (
                    <li className="px-1.5 text-[10.5px] text-slate-500">+{dayEvents.length - 3} more</li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Accessible, non-grid fallback listing of the same records. */}
      <details className="border-t border-slate-100 px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-blue-600">
          List view of these dates
        </summary>
        <ul className="mt-2 space-y-1.5">
          {events.filter(event => event.start_at).map(event => (
            <li key={event.id} className="text-[12.5px] text-slate-600">
              <Link href={hrefFor(event)} className="font-semibold text-slate-900 hover:text-blue-700">{event.name}</Link>
              {' — '}{formatEventDate(event.start_at, timezone)} · {eventLocationLabel(event)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function firstOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1) }
function startOfWeek(date: Date) {
  const copy = new Date(date)
  const weekday = (copy.getDay() + 6) % 7 // Monday-first
  copy.setDate(copy.getDate() - weekday)
  copy.setHours(0, 0, 0, 0)
  return copy
}
function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/* ------------------------------------------------------------- timeline */

export function EventsTimelineView({
  events, hrefFor, timezone,
}: { events: EventWithStats[]; hrefFor: (event: EventWithStats) => string; timezone: string }) {
  const dated = events.filter(event => event.start_at).sort((a, b) => (a.start_at! < b.start_at! ? -1 : 1))
  if (dated.length === 0) {
    return (
      <div className="p-4">
        <EventsEmptyState
          title="Nothing to plot"
          description="The timeline plots events with a start date, so add dates to see the promotion and delivery window."
        />
      </div>
    )
  }

  const first = new Date(dated[0].start_at!).getTime()
  const last = new Date(dated[dated.length - 1].start_at!).getTime()
  const span = Math.max(1, last - first)

  return (
    <div className="p-4">
      <ol className="relative space-y-3 border-l border-slate-200 pl-5">
        {dated.map(event => {
          const offset = (new Date(event.start_at!).getTime() - first) / span
          return (
            <li key={event.id} className="relative">
              <span
                className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600"
                aria-hidden
              />
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={hrefFor(event)} className="text-[13.5px] font-semibold text-slate-900 hover:text-blue-700">
                    {event.name}
                  </Link>
                  <StatusBadge status={event.status} dot={event.status === 'live'} />
                </div>
                <p className="mt-1 text-[12px] text-slate-500">
                  {formatEventDate(event.start_at, timezone)}
                  {event.end_at && <> → {formatEventDate(event.end_at, timezone)}</>}
                  {' · '}{eventLocationLabel(event)}
                </p>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div
                    className="h-full rounded-full bg-blue-500/70"
                    style={{ marginLeft: `${offset * 78}%`, width: '22%' }}
                  />
                </div>
                <p className="mt-1.5 flex flex-wrap gap-3 text-[11.5px] text-slate-500">
                  <span>{formatNumber(event.registrations)} registrations</span>
                  <span>{event.sponsorCount} sponsors</span>
                  {event.ownerName && <span>Owner: {event.ownerName}</span>}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
