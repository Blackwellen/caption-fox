import Link from 'next/link'
import { CalendarDays, MapPin, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  eventLocationLabel, eventTypeLabel, formatEventDate, formatEventTime,
  formatNumber, formatRate, formatRelative,
} from '@/lib/events/format'
import type { EventActivityRecord, EventSessionRecord, EventWithStats } from '@/lib/events/types'
import { Panel, PanelLink, StatusBadge, TimelineDot, EventsEmptyState } from './primitives'
import { Avatar } from './EventsShell'

/* -------------------------------------------------------------- event card */

export function EventCard({
  event, href, timezone,
}: { event: EventWithStats; href: string; timezone: string }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-[16/9] w-full bg-slate-100">
        {event.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-600 text-slate-300">
            <CalendarDays size={26} aria-hidden />
          </div>
        )}
        <span className="absolute left-2.5 top-2.5">
          <StatusBadge status={event.status} dot={event.status === 'live'} className="shadow-sm" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[14px] font-semibold leading-snug text-slate-900">
            <Link href={href} className="hover:text-blue-700 focus:outline-none focus-visible:underline">
              {event.name}
            </Link>
          </h3>
          <Link
            href={`${href}#actions`}
            className="-mr-1 shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Actions for ${event.name}`}
          >
            <MoreVertical size={15} />
          </Link>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-500">
          <CalendarDays size={13} className="shrink-0 text-slate-400" aria-hidden />
          {formatEventDate(event.start_at, event.timezone || timezone)}
          {event.start_at && event.format !== 'in_person' && (
            <> · {formatEventTime(event.start_at, event.timezone || timezone)}</>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
          <MapPin size={13} className="shrink-0 text-slate-400" aria-hidden />
          {eventLocationLabel(event)}
        </p>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          <Stat label="Registered" value={formatNumber(event.registrations)} />
          <Stat label="Attended" value={event.attended ? formatNumber(event.attended) : '—'} />
          <Stat
            label="Rate"
            value={formatRate(event.attendanceRate, 0)}
            tone={event.attendanceRate !== null ? 'positive' : 'muted'}
          />
        </dl>
      </div>
    </article>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'positive' | 'muted' }) {
  return (
    <div className="min-w-0">
      <dd className={cn(
        'text-[14px] font-bold leading-tight',
        tone === 'positive' ? 'text-emerald-600' : tone === 'muted' ? 'text-slate-400' : 'text-slate-900',
      )}>
        {value}
      </dd>
      <dt className="mt-0.5 truncate text-[10.5px] text-slate-500" title={label}>{label}</dt>
    </div>
  )
}

/* ------------------------------------------------------------- event table */

export function EventsTable({
  events, hrefFor, timezone, showGalaDock,
}: {
  events: EventWithStats[]
  hrefFor: (event: EventWithStats) => string
  timezone: string
  showGalaDock?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse text-left">
        <caption className="sr-only">Events in this workspace</caption>
        <thead>
          <tr className="border-b border-slate-100 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3 font-semibold">Event Name</th>
            <th scope="col" className="px-3 py-3 font-semibold">Type</th>
            <th scope="col" className="px-3 py-3 font-semibold">Date</th>
            <th scope="col" className="px-3 py-3 font-semibold">Location</th>
            <th scope="col" className="px-3 py-3 font-semibold">Status</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">Registrations</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">Attendance</th>
            {showGalaDock && <th scope="col" className="px-3 py-3 font-semibold">Gala Dock</th>}
            <th scope="col" className="px-3 py-3 font-semibold">Owner</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {events.map(event => (
            <tr key={event.id} className="text-[13px] text-slate-700 hover:bg-slate-50/70">
              <th scope="row" className="px-4 py-3 text-left font-medium">
                <Link href={hrefFor(event)} className="font-semibold text-slate-900 hover:text-blue-700">
                  {event.name}
                </Link>
              </th>
              <td className="px-3 py-3">{eventTypeLabel(event.event_type)}</td>
              <td className="whitespace-nowrap px-3 py-3">{formatEventDate(event.start_at, event.timezone || timezone)}</td>
              <td className="px-3 py-3">{eventLocationLabel(event)}</td>
              <td className="px-3 py-3"><StatusBadge status={event.status} dot={event.status === 'live'} /></td>
              <td className="px-3 py-3 text-right tabular-nums">{formatNumber(event.registrations)}</td>
              <td className="px-3 py-3 text-right tabular-nums">
                {event.attended
                  ? `${formatNumber(event.attended)} (${formatRate(event.attendanceRate, 0)})`
                  : '—'}
              </td>
              {showGalaDock && (
                <td className="px-3 py-3">
                  {event.galaDockLinked
                    ? <StatusBadge status="active" label="Linked" />
                    : <span className="text-[12px] text-slate-400">Not linked</span>}
                </td>
              )}
              <td className="px-3 py-3">
                <span className="flex items-center gap-2">
                  <Avatar name={event.ownerName ?? 'Unassigned'} src={event.ownerAvatarUrl} size={26} />
                  <span className="sr-only">{event.ownerName ?? 'Unassigned'}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------- run of show */

export function RunOfShowPanel({
  sessions, title, viewAllHref, timezone, relativeOffsets = false, subtitle,
}: {
  sessions: EventSessionRecord[]
  title: string
  subtitle?: string
  viewAllHref: string
  timezone: string
  relativeOffsets?: boolean
}) {
  return (
    <Panel
      title={title}
      description={subtitle}
      action={<PanelLink href={viewAllHref}>View Full Schedule</PanelLink>}
      contentClassName="p-0"
    >
      {sessions.length === 0 ? (
        <div className="p-4">
          <EventsEmptyState
            title="No run of show yet"
            description="Add agenda items to an event and they will appear here in running order."
          />
        </div>
      ) : (
        <ol className="divide-y divide-slate-50">
          {sessions.map(session => {
            const state = session.status === 'completed' ? 'completed'
              : session.status === 'live' ? 'live' : 'upcoming'
            return (
              <li key={session.id} className="flex items-start gap-3 px-4 py-2.5">
                <TimelineDot state={state} />
                <span className="w-[62px] shrink-0 pt-px text-[11.5px] font-medium tabular-nums text-slate-500">
                  {relativeOffsets
                    ? formatOffsetLabel(session.offset_seconds)
                    : formatEventTime(session.start_at, timezone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-900">{session.title}</span>
                  {session.room && <span className="block truncate text-[11.5px] text-slate-500">{session.room}</span>}
                </span>
                <StatusBadge status={session.status} dot={session.status === 'live'} />
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function formatOffsetLabel(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* ---------------------------------------------------------------- activity */

export function ActivityPanel({
  activity, title = 'Recent Activity', viewAllHref,
}: { activity: EventActivityRecord[]; title?: string; viewAllHref: string }) {
  return (
    <Panel title={title} action={<PanelLink href={viewAllHref}>View All</PanelLink>} contentClassName="p-0">
      {activity.length === 0 ? (
        <div className="p-4">
          <EventsEmptyState
            title="No activity yet"
            description="Registrations, sponsorships and follow-up updates will appear here as they happen."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {activity.map(item => {
            const body = (
              <>
                <Avatar name={item.actor_name ?? 'System'} src={item.actor_avatar_url} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold capitalize text-slate-900">
                    {item.action.replaceAll('_', ' ')}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">{item.summary}</span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatRelative(item.created_at)}</span>
              </>
            )
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50">{body}</Link>
                ) : (
                  <div className="flex items-start gap-2.5 px-4 py-2.5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------- upcoming events */

export function UpcomingEventsPanel({
  events, hrefFor, timezone, calendarHref, allHref,
}: {
  events: EventWithStats[]
  hrefFor: (event: EventWithStats) => string
  timezone: string
  calendarHref: string
  allHref: string
}) {
  return (
    <Panel
      title="Upcoming Events"
      action={<PanelLink href={calendarHref}>View Calendar</PanelLink>}
      contentClassName="p-0"
    >
      {events.length === 0 ? (
        <div className="p-4">
          <EventsEmptyState
            title="Nothing scheduled"
            description="Events with a future start date appear here so the team knows what is next."
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-50">
            {events.map(event => (
              <li key={event.id} className="flex items-center gap-3 px-4 py-3">
                <DateChip iso={event.start_at} timezone={event.timezone || timezone} />
                <span className="min-w-0 flex-1">
                  <Link href={hrefFor(event)} className="block truncate text-[13px] font-semibold text-slate-900 hover:text-blue-700">
                    {event.name}
                  </Link>
                  <span className="mt-0.5 block text-[11.5px] text-slate-500">
                    {formatEventDate(event.start_at, event.timezone || timezone)}
                    {event.start_at && <> · {formatEventTime(event.start_at, event.timezone || timezone)}</>}
                  </span>
                </span>
                <Link
                  href={hrefFor(event)}
                  className="shrink-0 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {event.status === 'completed' ? 'View' : 'Manage'}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-4 py-2.5 text-center">
            <PanelLink href={allHref}>View all upcoming events →</PanelLink>
          </div>
        </>
      )}
    </Panel>
  )
}

export function DateChip({ iso, timezone }: { iso: string | null; timezone: string }) {
  if (!iso) return <span className="h-[46px] w-[46px] shrink-0 rounded-lg bg-slate-100" aria-hidden />
  const date = new Date(iso)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: timezone }).format(date).toUpperCase()
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: timezone }).format(date)
  return (
    <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50" aria-hidden>
      <span className="text-[9.5px] font-bold tracking-wide text-blue-600">{month}</span>
      <span className="text-[16px] font-bold leading-none text-slate-900">{day}</span>
    </span>
  )
}

/* ------------------------------------------------------------ people lists */

export function PeoplePanel({
  people, title, viewAllHref,
}: {
  people: { id: string; full_name: string; job_title: string | null; avatar_url: string | null; speaker_role: string }[]
  title: string
  viewAllHref: string
}) {
  return (
    <Panel title={title} action={<PanelLink href={viewAllHref}>View All</PanelLink>} contentClassName="p-0">
      {people.length === 0 ? (
        <div className="p-4">
          <EventsEmptyState title="No speakers yet" description="Add hosts, speakers and guests to a session and they appear here." />
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {people.map(person => (
            <li key={person.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <Avatar name={person.full_name} src={person.avatar_url} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-slate-900">{person.full_name}</span>
                {person.job_title && <span className="block truncate text-[11.5px] text-slate-500">{person.job_title}</span>}
              </span>
              <StatusBadge status={person.speaker_role === 'host' ? 'upcoming' : 'draft'} label={person.speaker_role === 'host' ? 'Host' : 'Speaker'} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
