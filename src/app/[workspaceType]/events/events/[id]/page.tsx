import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  CalendarDays, Clock, ExternalLink, MapPin, Users as UsersIcon,
} from 'lucide-react'
import EventsShell, { Avatar } from '@/components/events/EventsShell'
import {
  DetailBreadcrumb, DetailHeaderBar, DetailTabStrip,
} from '@/components/events/DetailHeader'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import RegistrationsTable from '@/components/events/RegistrationsTable'
import { ActivityPanel, PeoplePanel, RunOfShowPanel } from '@/components/events/records'
import { EventsEmptyState, KpiCard, KpiStrip, Panel, StatusBadge } from '@/components/events/primitives'
import { Pagination } from '@/components/events/FilterBar'
import { getEventsPageContext } from '@/lib/events/page-context'
import {
  getEventActivity, getGalaDockState,
} from '@/lib/events/queries'
import {
  getEventDetail, getEventFollowUpTasksFor, getEventRegistrations,
  getEventSessions, getEventSpeakers, getEventSponsorships,
} from '@/lib/events/detail-queries'
import {
  eventLocationLabel, eventTypeLabel, formatEventDate, formatEventDateTime,
  formatEventTime, formatNumber, formatRate, formatRelative, titleCase,
} from '@/lib/events/format'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'registration', label: 'Registration' },
  { id: 'sessions', label: 'Run of Show' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'follow-up', label: 'Follow-up' },
  { id: 'activity', label: 'Activity' },
]

export default async function EventDetailPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, id } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'events')
  const { supabase, workspace } = page

  const event = await getEventDetail(supabase, workspace.id, id)
  if (!event) notFound()

  const activeTab = (Array.isArray(query.tab) ? query.tab[0] : query.tab) || 'overview'
  const tab = TABS.some(t => t.id === activeTab) ? activeTab : 'overview'
  const regPage = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1)
  const regQ = (Array.isArray(query.q) ? query.q[0] : query.q) ?? undefined
  const regStatus = (Array.isArray(query.status) ? query.status[0] : query.status) ?? undefined

  const detailPath = `${page.basePath}/events/${id}`

  const [sessions, speakers, gala, registrationsResult, sponsorships, activity, followUpTasks] = await Promise.all([
    getEventSessions(supabase, workspace.id, id),
    getEventSpeakers(supabase, workspace.id, id),
    getGalaDockState(supabase, workspace.id, page.userId, id),
    tab === 'registration'
      ? getEventRegistrations(supabase, workspace.id, id, { q: regQ, status: regStatus, page: regPage, pageSize: 25 })
      : Promise.resolve(null),
    tab === 'sponsors' || tab === 'overview' ? getEventSponsorships(supabase, workspace.id, id) : Promise.resolve([]),
    tab === 'activity' ? getEventActivity(supabase, workspace.id, 50, undefined) : Promise.resolve([]),
    tab === 'follow-up' || tab === 'overview' ? getEventFollowUpTasksFor(supabase, workspace.id, id) : Promise.resolve([]),
  ])

  const overviewActivity = tab === 'overview' ? await getEventActivity(supabase, workspace.id, 6) : []
  const eventScopedActivity = tab === 'activity' ? activity.filter(a => a.event_id === id) : []

  return (
    <EventsShell
      basePath={page.basePath}
      activeTab="events"
      visibleTabs={page.visibleTabs}
      workspaces={page.workspaces}
      activeWorkspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}
      user={page.user}
      notificationCount={page.notificationCount}
      planUsage={page.planUsage}
    >
      <DetailBreadcrumb parentLabel="Events" parentHref={`${page.basePath}/events`} recordName={event.name} />

      <DetailHeaderBar
        title={event.name}
        status={event.status}
        subtitle={[
          eventTypeLabel(event.event_type),
          formatEventDateTime(event.start_at, event.timezone || workspace.timezone),
          eventLocationLabel(event),
        ].join(' · ')}
        cover={
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 text-slate-300">
            {event.cover_image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" />
              : <CalendarDays size={24} />}
          </span>
        }
        actions={
          <>
            {event.registration_url && (
              <a
                href={event.registration_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Registration page <ExternalLink size={13} aria-hidden />
              </a>
            )}
            <Link
              href={`${page.basePath}/events`}
              className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700"
            >
              Back to events
            </Link>
          </>
        }
      />

      <DetailTabStrip tabs={TABS} active={tab} basePath={detailPath} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <KpiStrip>
            <KpiCard label="Registrations" tone="violet" icon={<UsersIcon size={17} />} value={formatNumber(event.registrations)} comparison="Total" />
            <KpiCard label="Attended" tone="emerald" icon={<UsersIcon size={17} />} value={event.attended ? formatNumber(event.attended) : '—'} comparison="Checked in or attended" />
            <KpiCard label="Attendance Rate" tone="blue" icon={<UsersIcon size={17} />} value={formatRate(event.attendanceRate)} comparison="Of eligible registrations" />
            <KpiCard label="Sponsors" tone="amber" icon={<UsersIcon size={17} />} value={formatNumber(event.sponsorCount)} comparison="Contracted or active" />
            <KpiCard label="Capacity" tone="sky" icon={<UsersIcon size={17} />} value={event.capacity ? formatNumber(event.capacity) : '—'} comparison="Maximum attendees" />
          </KpiStrip>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <Panel title="About this event">
                {event.summary ? (
                  <p className="text-[13.5px] leading-relaxed text-slate-700">{event.summary}</p>
                ) : (
                  <p className="text-[13px] text-slate-400">No summary added yet.</p>
                )}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-[12.5px] sm:grid-cols-3">
                  <DetailField icon={<CalendarDays size={13} />} label="Starts" value={formatEventDate(event.start_at, event.timezone || workspace.timezone)} />
                  <DetailField icon={<Clock size={13} />} label="Format" value={titleCase(event.format)} />
                  <DetailField icon={<MapPin size={13} />} label="Location" value={eventLocationLabel(event)} />
                </dl>
              </Panel>

              <RunOfShowPanel
                sessions={sessions.slice(0, 6)}
                title="Run of Show"
                viewAllHref={`${detailPath}?tab=sessions`}
                timezone={workspace.timezone}
              />
            </div>

            <div className="space-y-4">
              <PeoplePanel
                people={speakers.map(s => ({ id: s.id, full_name: s.full_name, job_title: s.job_title, avatar_url: s.avatar_url, speaker_role: s.speaker_role }))}
                title="Speakers"
                viewAllHref={`${detailPath}?tab=speakers`}
              />
              <ActivityPanel activity={overviewActivity.filter(a => a.event_id === id)} viewAllHref={`${detailPath}?tab=activity`} />
            </div>
          </div>

          {page.can('galaDock.connect') && (
            <GalaDockPromotion
              placement="events-sidebar"
              routeSegment={workspaceType}
              connectionState={gala.connectionState}
              eventUrl={gala.eventUrl}
              workspaceUrl={gala.workspaceUrl}
              syncError={gala.syncError}
              dismissed={false}
              dismissible={false}
              title={gala.connectionState === 'event-linked' ? 'Manage this event in Gala Dock' : 'Run this event’s logistics in Gala Dock'}
              body="Venue, staffing, floor plan and full production run sheet live in Gala Dock — Caption Fox keeps the marketing and registrations."
            />
          )}
        </div>
      )}

      {tab === 'registration' && registrationsResult && (
        <div className="space-y-4">
          <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3" action={detailPath} method="get">
            <input type="hidden" name="tab" value="registration" />
            <label htmlFor="reg-search" className="sr-only">Search registrations</label>
            <input
              id="reg-search" name="q" defaultValue={regQ}
              placeholder="Search name, email or company..."
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 text-[13px] focus:border-blue-500 focus:outline-none"
            />
            <label htmlFor="reg-status" className="sr-only">Filter by status</label>
            <select id="reg-status" name="status" defaultValue={regStatus ?? 'all'} className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px]">
              <option value="all">All statuses</option>
              {['invited', 'registered', 'confirmed', 'waitlisted', 'checked_in', 'attended', 'no_show', 'cancelled'].map(s => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700">
              Apply
            </button>
          </form>

          <RegistrationsTable
            registrations={registrationsResult.registrations}
            routeSegment={workspaceType}
            timezone={workspace.timezone}
            canManage={page.can('registrations.manage')}
          />
          <div className="rounded-xl border border-slate-200 bg-white">
            <Pagination page={registrationsResult.page} pageSize={registrationsResult.pageSize} total={registrationsResult.total} />
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <Panel title="Run of Show" contentClassName="p-0">
          {sessions.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No sessions yet" description="Add agenda items to build the run of show." /></div>
          ) : (
            <ol className="divide-y divide-slate-50">
              {sessions.map(session => (
                <li key={session.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-16 shrink-0 pt-0.5 text-[12px] font-medium tabular-nums text-slate-500">
                    {formatEventTime(session.start_at, workspace.timezone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-slate-900">{session.title}</span>
                    {session.room && <span className="block text-[12px] text-slate-500">{session.room}</span>}
                  </span>
                  <StatusBadge status={session.status} dot={session.status === 'live'} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      {tab === 'speakers' && (
        <Panel title="Speakers" contentClassName="p-0">
          {speakers.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No speakers yet" description="Add hosts, speakers and guests to a session and they appear here." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {speakers.map(person => (
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
      )}

      {tab === 'sponsors' && (
        <Panel title="Sponsors" contentClassName="p-0">
          {sponsorships.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No sponsors on this event" description="Add a sponsorship from the Sponsorships tab to see it here." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {sponsorships.map(s => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <Link href={`${page.basePath}/sponsorships/${s.id}`} className="block truncate text-[13.5px] font-semibold text-slate-900 hover:text-blue-700">
                      {s.sponsor?.name ?? 'Unnamed sponsor'}
                    </Link>
                    <span className="block text-[12px] text-slate-500">{s.packageName ?? titleCase(s.tier)}</span>
                  </span>
                  {page.can('sponsorships.viewFinancials') && (
                    <span className="text-[13px] font-bold text-slate-800">{s.currency} {formatNumber(s.value)}</span>
                  )}
                  <StatusBadge status={s.stage === 'active' ? 'active' : 'in_progress'} label={titleCase(s.stage)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'follow-up' && (
        <Panel title="Follow-up Tasks" contentClassName="p-0">
          {followUpTasks.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No follow-up tasks" description="Create tasks from the Follow-up tab to track outreach for this event." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {followUpTasks.map(task => (
                <li key={task.id as string} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-slate-900">{task.title as string}</span>
                    <span className="block text-[12px] text-slate-500">Due {formatEventDate(task.due_at as string, workspace.timezone)}</span>
                  </span>
                  <StatusBadge status={task.status as string} label={titleCase(task.status as string)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'activity' && (
        <Panel title="Activity" contentClassName="p-0">
          {eventScopedActivity.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No activity yet" description="Actions taken on this event will appear here." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {eventScopedActivity.map(item => {
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
      )}
    </EventsShell>
  )
}

function DetailField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-slate-400">{icon}{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
