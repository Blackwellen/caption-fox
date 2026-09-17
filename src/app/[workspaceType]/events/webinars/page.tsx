import Link from 'next/link'
import { CalendarDays, CircleDot, Clock, HelpCircle, MessageSquare, TrendingUp, UserPlus, Users, Video } from 'lucide-react'
import EventsShell from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import { EventsFilterBar, Pagination, RangePicker, ViewSwitcher } from '@/components/events/FilterBar'
import { CreateButton, ExportButton, MoreActionsButton } from '@/components/events/HeaderActions'
import { AttendanceRateChart, ChartLegend, RegistrationTrendChart } from '@/components/events/charts'
import { EventsTable, PeoplePanel, RunOfShowPanel } from '@/components/events/records'
import { EventsCalendarView, EventsTimelineView } from '@/components/events/views'
import {
  EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, PanelLink, StatusBadge, SummaryStat,
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
        <KpiCard label="Upcoming Webinars" tone="blue" icon={<CalendarDays size={18} />}
          value={formatNumber(kpis.upcoming.value)} comparison="Scheduled ahead" />
        <KpiCard label="Registrations" tone="violet" icon={<Users size={18} />}
          value={formatNumber(kpis.registrations.value)} kpi={kpis.registrations}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Attendance Rate" tone="emerald" icon={<TrendingUp size={18} />}
          value={formatRate(kpis.attendanceRate.value)}
          comparison="Across all webinars" />
        <KpiCard label="Average Watch Time" tone="sky" icon={<Clock size={18} />}
          value={formatDuration(kpis.avgWatchSeconds.value)}
          comparison={kpis.avgWatchSeconds.value === null ? 'Needs a connected provider' : 'Reported by provider'} />
        <KpiCard label="Questions Submitted" tone="rose" icon={<HelpCircle size={18} />}
          value={formatNumber(kpis.questions.value)} comparison="All webinars" />
        <KpiCard label="Follow-up Leads" tone="indigo" icon={<UserPlus size={18} />}
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
        className="mb-3.5"
      />

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[745fr_410fr]">
        <div className="min-w-0 space-y-3.5">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white" aria-label="Webinar performance">
            <div className="border-b border-slate-100 px-3 py-2">
              <EventsFilterBar
                variant="inline"
                searchPlaceholder="Search webinars..."
                dateRangeLabel="Date Range"
                showMoreFilters={false}
                filters={[
                  {
                    key: 'status', label: 'Status', allLabel: 'All Statuses', width: 80,
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
                    key: 'platform', label: 'Platform', width: 90,
                    options: [...new Set(list.webinars.map(item => item.online_platform).filter(Boolean))]
                      .map(platform => ({ value: platform as string, label: platform as string })),
                  },
                ]}
              />
            </div>

            <div className="grid min-w-0 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
              <div className="min-w-0 px-4 pb-3 pt-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-semibold text-slate-900">Registrations Over Time</h2>
                  <RangePicker value={filters.range} />
                </div>
                <dl className="mb-4 mt-3 grid grid-cols-2">
                  <SummaryStat label="Total Registrations" value={formatNumber(totalRegs)} change={kpis.registrations.changePct} below />
                  <SummaryStat label="Avg. Daily Registrations" value={formatNumber(avgDaily)} change={null} below />
                </dl>
                <div className="pl-8">
                  <ChartLegend items={[
                    { label: 'Registrations', colour: '#2563eb' },
                    { label: 'Attendees', colour: '#7c3aed' },
                  ]} />
                </div>
                <div className="mt-2"><RegistrationTrendChart data={regTrend} height={140} /></div>
              </div>

              <div className="min-w-0 px-4 pb-3 pt-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-semibold text-slate-900">Attendance Rate Over Time</h2>
                  <RangePicker value={filters.range} />
                </div>
                <dl className="mb-4 mt-3">
                  <SummaryStat label="Average Attendance Rate" value={formatRate(kpis.attendanceRate.value)} change={kpis.attendanceRate.changePct} points below />
                </dl>
                <div className="pl-8">
                  <ChartLegend items={[{ label: 'Attendance Rate (%)', colour: '#10b981' }]} />
                </div>
                <div className="mt-2"><AttendanceRateChart data={attendanceTrend} height={140} /></div>
              </div>
            </div>
          </section>

          <Panel
            title="Your Webinars"
            contentClassName={filters.view === 'cards' ? 'px-3 pb-3 pt-3' : 'p-0'}
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
              <>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {list.webinars.slice(0, 4).map(webinar => (
                    <WebinarCard
                      key={webinar.id}
                      webinar={webinar}
                      href={webinarHref(webinar)}
                      timezone={workspace.timezone}
                    />
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <PanelLink href={`${page.basePath}/webinars?view=table`}>View all webinars →</PanelLink>
                </div>
              </>
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

        <div className="min-w-0 space-y-3.5">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <ViewSwitcher views={allowedViews} active={filters.view} fill />
          </div>

          <RunOfShowPanel
            sessions={runOfShow.sessions}
            title="Run of Show / Agenda"
            titleSuffix={runOfShow.event ? `• ${runOfShow.event.name}` : undefined}
            viewAllLabel="View Full Agenda"
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
              <ul className="py-1">
                {questions.map(question => (
                  <li key={question.id as string} className="flex min-h-[42px] items-start gap-3 px-4 py-[7px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600" aria-hidden>
                      <MessageSquare size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10.5px] font-semibold text-slate-900">
                        Question from {(question.asked_by_name as string) ?? 'an attendee'}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        {question.question as string}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">
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
  const recording = webinar.webinar?.recording_state === 'available' ? 'Recording'
    : webinar.webinar?.will_record ? 'Will Record' : 'No Recording'
  return (
    <article className="flex flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-[9/5] w-full bg-slate-100">
        {webinar.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={webinar.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-700 text-indigo-200">
            <Video size={24} aria-hidden />
          </div>
        )}
        <span className="absolute left-2 top-2">
          <StatusBadge status={webinar.status} dot={webinar.status === 'live'} solid className="px-1.5 py-[2px] text-[10px]" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2">
        <h3 className="truncate text-[11px] font-semibold leading-snug text-slate-900" title={webinar.name}>
          <Link href={href} className="hover:text-blue-700">{webinar.name}</Link>
        </h3>
        <p className="mt-1 truncate text-[10px] text-slate-500">
          {formatEventDate(webinar.start_at, webinar.timezone || timezone)}
          {webinar.start_at && <> • {formatEventTime(webinar.start_at, webinar.timezone || timezone)}</>}
        </p>

        {webinar.hostName && (
          <p className="mt-2 flex items-center gap-1.5">
            <Avatar name={webinar.hostName} src={webinar.hostAvatarUrl} size={20} />
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-medium leading-tight text-slate-700">{webinar.hostName}</span>
              {webinar.hostRole && <span className="block truncate text-[9.5px] leading-tight text-slate-500">{webinar.hostRole}</span>}
            </span>
          </p>
        )}

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600">
          {provider && (
            <span className="inline-flex items-center gap-1">
              <Video size={11} className="text-blue-600" aria-hidden />{titleCase(provider)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CircleDot size={11} className="text-slate-400" aria-hidden />{recording}
          </span>
        </p>

        <dl className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <div className="flex min-w-0 flex-col">
            <dt className="order-last truncate text-[9.5px] text-slate-500">Registered</dt>
            <dd className="text-[11px] font-semibold text-slate-900">{formatNumber(webinar.registrations)}</dd>
          </div>
          {webinar.attended > 0 && (
            <div className="flex min-w-0 flex-col">
              <dt className="order-last truncate text-[9.5px] text-slate-500">{webinar.status === 'live' ? 'Attending' : 'Attended'}</dt>
              <dd className="text-[11px] font-semibold text-slate-900">{formatNumber(webinar.attended)}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}
