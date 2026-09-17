import Link from 'next/link'
import { Activity, CalendarDays, Check, CircleCheck, DollarSign, MapPin, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  activityTitle, eventLocationLabel, eventTypeLabel, formatClockTime, formatEventDate, formatEventTime,
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
    <article className="flex flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-[9/5] w-full bg-slate-100">
        {event.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-600 text-slate-300">
            <CalendarDays size={26} aria-hidden />
          </div>
        )}
        <span className="absolute left-2 top-2">
          <StatusBadge status={event.status} dot={event.status === 'live'} solid className="px-1.5 py-[2px] text-[10px]" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-2">
        <div className="flex items-start justify-between gap-1">
          <h3 className="truncate text-[11px] font-semibold leading-snug text-slate-900" title={event.name}>
            <Link href={href} className="hover:text-blue-700 focus:outline-none focus-visible:underline">
              {event.name}
            </Link>
          </h3>
          <Link
            href={`${href}#actions`}
            className="-mr-1 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Actions for ${event.name}`}
          >
            <MoreVertical size={14} />
          </Link>
        </div>

        <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-500">
          <CalendarDays size={11} className="shrink-0 text-slate-400" aria-hidden />
          {formatEventDate(event.start_at, event.timezone || timezone)}
          {event.start_at && event.format !== 'in_person' && (
            <> • {formatEventTime(event.start_at, event.timezone || timezone)}</>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-500">
          <MapPin size={11} className="shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{eventLocationLabel(event)}</span>
        </p>

        <dl className="mt-auto grid grid-cols-[1.25fr_1.15fr_0.6fr] gap-1 pt-3">
          <Stat label="Registered" value={formatNumber(event.registrations)} />
          <Stat label="Attended" value={event.attended ? formatNumber(event.attended) : '—'} />
          {/* An event that has not happened has no attendance rate to show. */}
          <Stat
            label="Rate"
            value={event.attended ? formatRate(event.attendanceRate, 0) : '—'}
            tone={event.attended ? 'positive' : 'muted'}
          />
        </dl>
      </div>
    </article>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'positive' | 'muted' }) {
  return (
    // dt precedes dd for valid description-list markup; flex order puts the
    // value visually on top, as the design shows.
    <div className="flex min-w-0 flex-col last:items-end">
      <dt className="order-last mt-0.5 truncate text-[9.5px] leading-tight text-slate-500" title={label}>{label}</dt>
      <dd className={cn('text-[11px] font-semibold leading-tight', tone === 'muted' ? 'text-slate-400' : tone === 'positive' ? 'text-emerald-600' : 'text-slate-900')}>
        {value}
      </dd>
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
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse text-left">
        <caption className="sr-only">Events in this workspace</caption>
        <thead>
          <tr className="border-b border-slate-100 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
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
                    : <span className="text-[11px] text-slate-400">Not linked</span>}
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
  sessions, title, titleSuffix, viewAllHref, timezone, relativeOffsets = false, subtitle, viewAllLabel = 'View Full Schedule',
}: {
  viewAllLabel?: string
  sessions: EventSessionRecord[]
  title: string
  titleSuffix?: string
  subtitle?: string
  viewAllHref: string
  timezone: string
  relativeOffsets?: boolean
}) {
  return (
    <Panel
      title={title}
      titleSuffix={titleSuffix}
      description={subtitle}
      action={<PanelLink href={viewAllHref}>{viewAllLabel}</PanelLink>}
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
        <ol className="px-4 py-2">
          {sessions.map((session, index) => {
            const state = session.status === 'completed' ? 'completed'
              : session.status === 'live' ? 'live' : 'upcoming'
            const last = index === sessions.length - 1
            return (
              <li key={session.id} className="relative flex min-h-[42px] items-start gap-2.5 py-[5px]">
                {/* Rail joining this dot to the next one. */}
                {!last && (
                  <span
                    className={cn(
                      'absolute left-[3.5px] top-[17px] h-[calc(100%-6px)] w-px',
                      state === 'completed' ? 'bg-emerald-200' : 'bg-slate-200',
                    )}
                    aria-hidden
                  />
                )}
                <TimelineDot state={state} />
                <span className="w-[58px] shrink-0 whitespace-nowrap pt-[3px] text-[10px] tabular-nums text-slate-600">
                  {relativeOffsets
                    ? formatOffsetLabel(session.offset_seconds)
                    : formatClockTime(session.start_at, timezone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold leading-snug text-slate-900" title={session.title}>{session.title}</span>
                  {session.room && <span className="block truncate text-[10px] leading-snug text-slate-500">{session.room}</span>}
                </span>
                <StatusBadge status={session.status} dot={session.status === 'live'} className="mt-0.5 shrink-0 px-1.5 text-[10px]" />
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
        <ul className="py-1.5">
          {activity.map(item => {
            const body = (
              <>
                <ActivityIcon item={item} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold leading-snug text-slate-900">
                    {activityTitle(item.entity_type, item.action)}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">{item.summary}</span>
                </span>
                <span className="shrink-0 pt-px text-[10px] text-slate-500">{formatRelative(item.created_at)}</span>
              </>
            )
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="flex min-h-[49px] items-start gap-3 px-4 py-[7px] hover:bg-slate-50">{body}</Link>
                ) : (
                  <div className="flex min-h-[49px] items-start gap-3 px-4 py-[7px]">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/**
 * People-driven entries (registrations, guests) show the person; system
 * entries show what happened, so the feed scans by type at a glance.
 */
function ActivityIcon({ item }: { item: EventActivityRecord }) {
  const personal = item.entity_type === 'registration' || item.entity_type === 'speaker'
  if (personal) return <Avatar name={item.actor_name ?? 'Attendee'} src={item.actor_avatar_url} size={28} />

  const kind =
    item.entity_type === 'sponsorship' || item.entity_type === 'sponsor' || item.entity_type === 'deliverable'
      ? { Icon: DollarSign, tone: 'bg-blue-50 text-blue-600' }
      : item.entity_type === 'followup_task' || item.entity_type === 'sequence'
        ? { Icon: Check, tone: 'bg-emerald-50 text-emerald-600' }
        : item.entity_type === 'session' || item.entity_type === 'event' || item.entity_type === 'webinar'
          ? { Icon: CircleCheck, tone: 'bg-indigo-50 text-indigo-600' }
          : { Icon: Activity, tone: 'bg-slate-100 text-slate-500' }
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', kind.tone)} aria-hidden>
      <kind.Icon size={14} strokeWidth={2.2} />
    </span>
  )
}

/* -------------------------------------------------------- upcoming events */

export function UpcomingEventsPanel({
  events, hrefFor, timezone, calendarHref, allHref, embedded = false,
}: {
  events: EventWithStats[]
  hrefFor: (event: EventWithStats) => string
  timezone: string
  calendarHref: string
  allHref: string
  /** Render without its own card, inside a parent panel (the overview right column). */
  embedded?: boolean
}) {
  const content = events.length === 0 ? (
    <div className="p-4">
      <EventsEmptyState
        title="Nothing scheduled"
        description="Events with a future start date appear here so the team knows what is next."
      />
    </div>
  ) : (
    <>
      <ul className="divide-y divide-slate-100 px-4">
        {events.map(event => {
          // Podcasts have no attendee sign-up, so they open the record instead.
          const registrable = event.event_type !== 'podcast'
          return (
            <li key={event.id} className="flex min-h-[70px] items-center gap-4 py-3">
              <DateChip iso={event.start_at} timezone={event.timezone || timezone} />
              <span className="min-w-0 flex-1">
                <Link href={hrefFor(event)} className="block truncate text-[11.5px] font-semibold text-slate-900 hover:text-blue-700">
                  {event.name}
                </Link>
                <span className="mt-1 block truncate text-[10px] text-slate-500">
                  {formatEventDate(event.start_at, event.timezone || timezone)}
                  {event.start_at && <> • {formatEventTime(event.start_at, event.timezone || timezone)}</>}
                </span>
              </span>
              <Link
                href={registrable ? `${hrefFor(event)}?tab=registration` : hrefFor(event)}
                className="inline-flex h-[26px] shrink-0 items-center rounded-md bg-indigo-50 px-3 text-[10.5px] font-semibold text-indigo-600 hover:bg-indigo-100"
                aria-label={`${registrable ? 'Registrations for' : 'View'} ${event.name}`}
              >
                {registrable ? 'Register' : 'View'}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="px-4 pb-4 pt-3 text-center">
        <PanelLink href={allHref}>View all upcoming events →</PanelLink>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
          <h2 className="text-[13px] font-semibold text-slate-900">Upcoming Events</h2>
          <PanelLink href={calendarHref}>View Calendar</PanelLink>
        </div>
        {content}
      </div>
    )
  }

  return (
    <Panel
      title="Upcoming Events"
      action={<PanelLink href={calendarHref}>View Calendar</PanelLink>}
      contentClassName="p-0"
    >
      {content}
    </Panel>
  )
}

export function DateChip({ iso, timezone }: { iso: string | null; timezone: string }) {
  if (!iso) return <span className="h-[46px] w-[42px] shrink-0 rounded-lg bg-slate-100" aria-hidden />
  const date = new Date(iso)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: timezone }).format(date).slice(0, 3).toUpperCase()
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: timezone }).format(date)
  return (
    <span className="flex h-[46px] w-[42px] shrink-0 flex-col items-center overflow-hidden rounded-lg border border-slate-200 bg-white" aria-hidden>
      <span className="w-full bg-indigo-50 py-[2px] text-center text-[9px] font-bold tracking-wide text-indigo-600">{month}</span>
      <span className="flex flex-1 items-center text-[17px] font-semibold leading-none text-slate-900">{day}</span>
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
        <ul className="py-1.5">
          {people.map(person => (
            <li key={person.id} className="flex min-h-[35px] items-center gap-2.5 px-4 py-1">
              <Avatar name={person.full_name} src={person.avatar_url} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] font-semibold leading-tight text-slate-900">{person.full_name}</span>
                {person.job_title && <span className="block truncate text-[10px] leading-tight text-slate-500">{person.job_title}</span>}
              </span>
              <StatusBadge status="upcoming" label={person.speaker_role === 'host' ? 'Host' : 'Speaker'} className="px-1.5 py-[1px] text-[10px]" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
