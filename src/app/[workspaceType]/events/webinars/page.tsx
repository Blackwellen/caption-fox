import Link from 'next/link'
import { CalendarDays, Clock, HelpCircle, MessageSquare, TrendingUp, UserPlus, Users, Video } from 'lucide-react'
import EventsShell from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import { EventsFilterBar, Pagination, RangePicker, ViewSwitcher } from '@/components/events/FilterBar'
import { CreateButton, ExportButton, MoreActionsButton } from '@/components/events/HeaderActions'
import { AttendanceRateChart, ChartLegend, RegistrationTrendChart } from '@/components/events/charts'
import { EventsTable, PeoplePanel, RunOfShowPanel } from '@/components/events/records'
import { EventsCalendarView, EventsTimelineView } from '@/components/events/views'
import {
  EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, PanelLink, StatusBadge,
} from '@/components/events/primitives'
import { Avatar } from '@/components/events/EventsShell'
import { getEventsPageContext, parseEventsFilters } from '@/lib/events/page-context'
import {
  getGalaDockState, getRegistrationTrend, getRunOfShow, getSpeakers,
  getWebinarAttendanceTrend, getWebinarKpis, getWebinarQuestions, listWebinars,
} from '@/lib/events/queries'
import {
  formatDuration, formatEventDate, formatEventTime, formatNumber, formatRate, formatRelative, titleCase,
} from '@/lib/events/format'
import type { EventViewMode, WebinarWithStats } from '@/lib/events/types'

export const dynamic = 'force-dynamic'

const VIEWS: EventViewMode[] = ['cards', 'table', 'calendar', 'timeline']

export const metadata = {
  title: 'Webinars · Caption Fox',
  description: 'Manage your webinars, engage audiences, and drive results.',
}

export default async function WebinarsPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'webinars')

  const allowedViews = VIEWS.filter(view =>
    view === 'calendar' ? page.can('views.calendar')
      : view === 'timeline' ? page.can('views.timeline') : true)
  const filters = parseEventsFilters(query, allowedViews, 'cards')

  const { supabase, workspace } = page
  const [list, kpis, regTrend, attendanceTrend, runOfShow, speakers, questions, gala] = await Promise.all([
    listWebinars(supabase, workspace.id, { ...filters, pageSize: filters.pageSize ?? 10 }),
    getWebinarKpis(supabase, workspace.id, filters.range),
    getRegistrationTrend(supabase, workspace.id, filters.range),
    getWebinarAttendanceTrend(supabase, workspace.id, filters.range),
    getRunOfShow(supabase, workspace.id, undefined, 6, ['webinar']),
    getSpeakers(supabase, workspace.id, undefined, 4),
    getWebinarQuestions(supabase, workspace.id, 4),
    getGalaDockState(supabase, workspace.id, page.userId),
  ])

  const webinarHref = (webinar: { id: string }) => `${page.basePath}/webinars/${webinar.id}`
  const totalRegs = regTrend.reduce((sum, point) => sum + Number(point.registrations ?? 0), 0)
  const avgDaily = regTrend.length ? Math.round(totalRegs / regTrend.length) : 0

  return (
    <EventsShell
      basePath={page.basePath}
      activeTab="webinars"
      visibleTabs={page.visibleTabs}
      workspaces={page.workspaces}
      activeWorkspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}
      user={page.user}
      notificationCount={page.notificationCount}
      planUsage={page.planUsage}
      searchPlaceholder="Search webinars, speakers, topics, or contacts..."
    >
      <EventsPageHeader
        title="Webinars"
        subtitle="Manage your webinars, engage audiences, and drive results."
        actions={
          <>
            <ExportButton
              routeSegment={workspaceType}
              resource="webinars"
              disabledReason={page.can('events.export') ? null : 'Your role cannot export webinar data'}
            />
            <CreateButton
              label="Create Webinar"
              routeSegment={workspaceType}
              defaultEventType="webinar"
              disabledReason={page.can('webinars.manage') ? null : 'Your role cannot create webinars'}
              options={[
                { id: 'webinar', label: 'Webinar', description: 'Live online session with registrations', eventType: 'webinar' },
                { id: 'live_stream', label: 'Live stream', description: 'Broadcast without registration gating', eventType: 'live_stream' },
              ]}
            />
            <MoreActionsButton
              items={[
                { label: 'Webinar calendar', href: `${page.basePath}/webinars?view=calendar` },
                { label: 'Connect a provider', href: `${page.workspaceRoot}/integrations` },
                { label: 'Follow-up leads', href: `${page.basePath}/follow-up` },
              ]}
            />
          </>
        }
      />

      <KpiStrip>
        <KpiCard label="Upcoming Webinars" tone="blue" icon={<CalendarDays size={17} />}
          value={formatNumber(kpis.upcoming.value)} comparison="Scheduled ahead" />
        <KpiCard label="Registrations" tone="violet" icon={<Users size={17} />}
          value={formatNumber(kpis.registrations.value)} kpi={kpis.registrations}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Attendance Rate" tone="emerald" icon={<TrendingUp size={17} />}
          value={formatRate(kpis.attendanceRate.value)}
          comparison="Across all webinars" />
        <KpiCard label="Average Watch Time" tone="sky" icon={<Clock size={17} />}
          value={formatDuration(kpis.avgWatchSeconds.value)}
          comparison={kpis.avgWatchSeconds.value === null ? 'Needs a connected provider' : 'Reported by provider'} />
        <KpiCard label="Questions Submitted" tone="rose" icon={<HelpCircle size={17} />}
          value={formatNumber(kpis.questions.value)} comparison="All webinars" />
        <KpiCard label="Follow-up Leads" tone="indigo" icon={<UserPlus size={17} />}
          value={formatNumber(kpis.followUpLeads.value)}
          href={page.visibleTabs.includes('follow-up') ? `${page.basePath}/follow-up` : undefined}
          comparison="Awaiting outreach" />
      </KpiStrip>

      <GalaDockPromotion
        placement="webinars-banner"
        routeSegment={workspaceType}
        connectionState={gala.connectionState}
        workspaceUrl={gala.workspaceUrl}
        syncError={gala.syncError}
        dismissed={gala.dismissedPlacements.includes('webinars-banner')}
        title="Power your webinars and events with Gala Dock"
        body="All-in-one platform to manage venues, sessions, sponsors and logistics — so you can focus on creating unforgettable experiences."
        className="mb-5"
      />

      <div className="grid gap-4 xl:grid-cols-[1.62fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ViewSwitcher views={allowedViews} active={filters.view} />
          </div>

          <EventsFilterBar
            searchPlaceholder="Search webinars..."
            dateRangeLabel="Date Range"
            filters={[
              {
                key: 'status', label: 'Status', allLabel: 'All Statuses',
                options: [
                  { value: 'draft', label: 'Draft' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'live', label: 'Live' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ],
              },
              {
                key: 'platform', label: 'Platform',
                options: [...new Set(list.webinars.map(item => item.online_platform).filter(Boolean))]
                  .map(platform => ({ value: platform as string, label: platform as string })),
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Registrations Over Time" action={<RangePicker value={filters.range} />}>
              <dl className="mb-2 grid grid-cols-2 gap-3">
                <div>
                  <dd className="text-[19px] font-bold text-slate-900">{formatNumber(totalRegs)}</dd>
                  <dt className="text-[11.5px] text-slate-500">Total Registrations</dt>
                </div>
                <div>
                  <dd className="text-[19px] font-bold text-slate-900">{formatNumber(avgDaily)}</dd>
                  <dt className="text-[11.5px] text-slate-500">Avg. Daily Registrations</dt>
                </div>
              </dl>
              <ChartLegend items={[
                { label: 'Registrations', colour: '#2563eb' },
                { label: 'Attendees', colour: '#7c3aed' },
              ]} />
              <div className="mt-2"><RegistrationTrendChart data={regTrend} height={170} /></div>
            </Panel>

            <Panel title="Attendance Rate Over Time" action={<RangePicker value={filters.range} />}>
              <dl className="mb-2">
                <dd className="text-[19px] font-bold text-slate-900">{formatRate(kpis.attendanceRate.value)}</dd>
                <dt className="text-[11.5px] text-slate-500">Average Attendance Rate</dt>
              </dl>
              <ChartLegend items={[{ label: 'Attendance rate (%)', colour: '#10b981' }]} />
              <div className="mt-2"><AttendanceRateChart data={attendanceTrend} height={170} /></div>
            </Panel>
          </div>

          <Panel
            title="Your Webinars"
            action={<PanelLink href={`${page.basePath}/webinars?view=table`}>View all webinars →</PanelLink>}
            contentClassName={filters.view === 'cards' ? 'p-4' : 'p-0'}
          >
            {list.total === 0 ? (
              <EventsEmptyState
                title={filters.q ? `No webinars match “${filters.q}”` : 'No webinars yet'}
                description={
                  filters.q
                    ? 'Try a different search term or clear the filters.'
                    : 'Create a webinar to start collecting registrations, attendance and questions.'
                }
                icon={<Video size={26} />}
              />
            ) : filters.view === 'cards' ? (
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                {list.webinars.slice(0, 4).map(webinar => (
                  <WebinarCard
                    key={webinar.id}
                    webinar={webinar}
                    href={webinarHref(webinar)}
                    timezone={workspace.timezone}
                  />
                ))}
              </div>
            ) : filters.view === 'calendar' ? (
              <EventsCalendarView events={list.webinars} hrefFor={webinarHref} timezone={workspace.timezone} />
            ) : filters.view === 'timeline' ? (
              <EventsTimelineView events={list.webinars} hrefFor={webinarHref} timezone={workspace.timezone} />
            ) : (
              <>
                <EventsTable events={list.webinars} hrefFor={webinarHref} timezone={workspace.timezone} />
                <Pagination page={list.page} pageSize={list.pageSize} total={list.total} />
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <RunOfShowPanel
            sessions={runOfShow.sessions}
            title="Run of Show / Agenda"
            subtitle={runOfShow.event?.name}
            viewAllHref={runOfShow.event ? `${page.basePath}/webinars/${runOfShow.event.id}` : `${page.basePath}/webinars`}
            timezone={workspace.timezone}
          />

          <PeoplePanel
            people={speakers.map(speaker => ({
              id: speaker.id,
              full_name: speaker.full_name,
              job_title: speaker.job_title,
              avatar_url: speaker.avatar_url,
              speaker_role: speaker.speaker_role,
            }))}
            title="Speakers & Hosts"
            viewAllHref={`${page.basePath}/webinars`}
          />

          <Panel
            title="Recent Activity & Questions"
            action={<PanelLink href={`${page.basePath}/webinars`}>View All</PanelLink>}
            contentClassName="p-0"
          >
            {questions.length === 0 ? (
              <div className="p-4">
                <EventsEmptyState
                  title="No questions yet"
                  description="Audience questions captured during a webinar appear here for the host to answer."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {questions.map(question => (
                  <li key={question.id as string} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden>
                      <MessageSquare size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-slate-900">
                        Question from {(question.asked_by_name as string) ?? 'an attendee'}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">
                        {question.question as string}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatRelative(question.created_at as string)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </EventsShell>
  )
}

function WebinarCard({
  webinar, href, timezone,
}: { webinar: WebinarWithStats; href: string; timezone: string }) {
  const provider = webinar.webinar?.provider
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-[16/9] w-full bg-slate-100">
        {webinar.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={webinar.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-700 text-indigo-200">
            <Video size={24} aria-hidden />
          </div>
        )}
        <span className="absolute left-2.5 top-2.5">
          <StatusBadge status={webinar.status} dot={webinar.status === 'live'} className="shadow-sm" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-[13.5px] font-semibold leading-snug text-slate-900">
          <Link href={href} className="hover:text-blue-700">{webinar.name}</Link>
        </h3>
        <p className="mt-1 text-[11.5px] text-slate-500">
          {formatEventDate(webinar.start_at, webinar.timezone || timezone)}
          {webinar.start_at && <> · {formatEventTime(webinar.start_at, webinar.timezone || timezone)}</>}
        </p>

        {webinar.hostName && (
          <p className="mt-2.5 flex items-center gap-2">
            <Avatar name={webinar.hostName} src={webinar.hostAvatarUrl} size={26} />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-slate-800">{webinar.hostName}</span>
              {webinar.hostRole && <span className="block truncate text-[10.5px] text-slate-500">{webinar.hostRole}</span>}
            </span>
          </p>
        )}

        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          {provider && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 font-medium">
              <Video size={11} aria-hidden />{titleCase(provider)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 font-medium">
            {webinar.webinar?.recording_state === 'available' ? 'Recording ready'
              : webinar.webinar?.will_record ? 'Will record' : 'No recording'}
          </span>
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <dd className="text-[14px] font-bold text-slate-900">{formatNumber(webinar.registrations)}</dd>
            <dt className="truncate text-[10.5px] text-slate-500">Registered</dt>
          </div>
          <div className="min-w-0">
            <dd className="text-[14px] font-bold text-slate-900">
              {webinar.attended ? formatNumber(webinar.attended) : '—'}
            </dd>
            <dt className="truncate text-[10.5px] text-slate-500" title={webinar.status === 'live' ? 'Attending' : 'Attended'}>
              {webinar.status === 'live' ? 'Attending' : 'Attended'}
            </dt>
          </div>
        </dl>
      </div>
    </article>
  )
}
