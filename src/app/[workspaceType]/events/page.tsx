import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock, DollarSign, TrendingUp, Users } from 'lucide-react'
import EventsShell from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import { EventsFilterBar, RangePicker, ViewSwitcher } from '@/components/events/FilterBar'
import { CreateButton, ExportButton } from '@/components/events/HeaderActions'
import { RegistrationTrendChart, ChartLegend } from '@/components/events/charts'
import {
  ActivityPanel, EventCard, EventsTable, RunOfShowPanel, UpcomingEventsPanel,
} from '@/components/events/records'
import { EventsCalendarView, EventsTimelineView } from '@/components/events/views'
import {
  EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, PanelLink, SummaryStat,
} from '@/components/events/primitives'
import { getEventsPageContext, parseEventsFilters } from '@/lib/events/page-context'
import {
  getEventActivity, getGalaDockState, getOverviewKpis, getRegistrationTrend,
  getRunOfShow, listEventOwners, listEvents, listUpcomingEvents,
} from '@/lib/events/queries'
import { formatCurrency, formatNumber, formatRate } from '@/lib/events/format'
import type { EventViewMode, EventWithStats } from '@/lib/events/types'

export const dynamic = 'force-dynamic'

const VIEWS: EventViewMode[] = ['cards', 'table', 'calendar', 'timeline']

export async function generateMetadata({ params }: { params: Promise<{ workspaceType: string }> }) {
  const { workspaceType } = await params
  return {
    title: 'Events Overview · Caption Fox',
    description: `Event marketing performance for the ${workspaceType} workspace.`,
  }
}

export default async function EventsOverviewPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'overview')

  const allowedViews = VIEWS.filter(view =>
    view === 'calendar' ? page.can('views.calendar')
      : view === 'timeline' ? page.can('views.timeline') : true)
  const filters = parseEventsFilters(query, allowedViews, 'cards')

  const { supabase, workspace } = page
  const [kpis, trend, runOfShow, activity, list, upcoming, owners, gala] = await Promise.all([
    getOverviewKpis(supabase, workspace.id, filters.range),
    getRegistrationTrend(supabase, workspace.id, filters.range),
    getRunOfShow(supabase, workspace.id, undefined, 6),
    getEventActivity(supabase, workspace.id, 5),
    listEvents(supabase, workspace.id, { ...filters, pageSize: 4 }),
    listUpcomingEvents(supabase, workspace.id, 3),
    listEventOwners(supabase, workspace.id),
    getGalaDockState(supabase, workspace.id, page.userId),
  ])

  const eventHref = (event: EventWithStats) => `${page.basePath}/events/${event.id}`
  const totals = trend.reduce(
    (acc, point) => ({
      registrations: acc.registrations + Number(point.registrations ?? 0),
      attendees: acc.attendees + Number(point.attendees ?? 0),
    }),
    { registrations: 0, attendees: 0 },
  )
  const trendRate = totals.registrations ? totals.attendees / totals.registrations : null
  // "(Today)" is only claimed when the run sheet really belongs to today.
  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: workspace.timezone }).format(new Date(iso))
  const runOfShowIsToday = Boolean(
    runOfShow.event?.start_at && dayKey(runOfShow.event.start_at) === dayKey(new Date().toISOString()),
  )

  return (
    <EventsShell
      basePath={page.basePath}
      activeTab="overview"
      visibleTabs={page.visibleTabs}
      workspaces={page.workspaces}
      activeWorkspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}
      user={page.user}
      notificationCount={page.notificationCount}
      planUsage={page.planUsage}
    >
      <EventsPageHeader
        title="Events Overview"
        subtitle="Track performance, engagement, and ROI across all your events."
        actions={
          <>
            <ExportButton
              routeSegment={workspaceType}
              resource="events"
              disabledReason={page.can('events.export') ? null : 'Your role cannot export event data'}
            />
            <CreateButton
              label="Create Event"
              routeSegment={workspaceType}
              disabledReason={page.can('events.create') ? null : 'Your role cannot create events'}
              options={[
                { id: 'in_person', label: 'In-person event', description: 'Conference, workshop or meet-up', eventType: 'conference' },
                { id: 'webinar', label: 'Webinar', description: 'Online session with registrations', eventType: 'webinar' },
                { id: 'podcast', label: 'Podcast recording', description: 'Episode with guests and a run sheet', eventType: 'podcast' },
              ]}
            />
          </>
        }
      />

      <KpiStrip>
        <KpiCard
          label="Total Events" tone="blue" icon={<CalendarDays size={18} />}
          value={formatNumber(kpis.totalEvents.value)} kpi={kpis.totalEvents}
          href={`${page.basePath}/events`} comparison={`vs last ${filters.range} days`}
        />
        <KpiCard
          label="Registrations" tone="violet" icon={<Users size={18} />}
          value={formatNumber(kpis.registrations.value)} kpi={kpis.registrations}
          comparison={`vs last ${filters.range} days`}
        />
        <KpiCard
          label="Attendance Rate" tone="emerald" icon={<TrendingUp size={18} />}
          value={formatRate(kpis.attendanceRate.value)} kpi={kpis.attendanceRate}
          comparison={`vs last ${filters.range} days`}
          tooltip="Attended registrations divided by eligible (confirmed, registered, attended or no-show) registrations."
        />
        {page.can('sponsorships.viewFinancials') ? (
          <KpiCard
            label="Sponsorship Revenue" tone="amber" icon={<DollarSign size={18} />}
            value={formatCurrency(kpis.sponsorshipRevenue.value, workspace.currency)}
            kpi={kpis.sponsorshipRevenue}
            href={page.visibleTabs.includes('sponsorships') ? `${page.basePath}/sponsorships` : undefined}
            comparison={`vs last ${filters.range} days`}
          />
        ) : (
          <KpiCard
            label="Sponsors" tone="amber" icon={<DollarSign size={18} />}
            value="Hidden"
            comparison="Sponsorship values are restricted for your role"
          />
        )}
        <KpiCard
          label="Follow-up Tasks" tone="rose" icon={<CheckCircle2 size={18} />}
          value={formatNumber(kpis.followUpTasks.value)} kpi={kpis.followUpTasks}
          href={page.visibleTabs.includes('follow-up') ? `${page.basePath}/follow-up` : undefined}
          comparison={`vs last ${filters.range} days`}
        />
        <KpiCard
          label="Upcoming Sessions" tone="sky" icon={<Clock size={18} />}
          value={formatNumber(kpis.upcomingSessions.value)} comparison="Next 30 days"
        />
      </KpiStrip>

      <GalaDockPromotion
        placement="overview-banner"
        routeSegment={workspaceType}
        connectionState={gala.connectionState}
        workspaceUrl={gala.workspaceUrl}
        syncError={gala.syncError}
        dismissed={gala.dismissedPlacements.includes('overview-banner')}
        title="Power event operations with Gala Dock"
        body="Manage venues, schedules, sponsors, and logistics in one powerful platform."
        className="mb-3.5"
      />

      <div className="mb-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-[409fr_352fr_376fr]">
        <Panel
          title="Registration Performance"
          action={<RangePicker value={filters.range} />}
          contentClassName="px-4 pb-3 pt-4"
        >
          <dl className="mb-5 grid grid-cols-3 divide-x divide-slate-100">
            <SummaryStat label="Registrations" value={formatNumber(totals.registrations)} change={kpis.registrations.changePct} />
            <SummaryStat label="Attended" value={formatNumber(totals.attendees)} change={kpis.attended.changePct} />
            <SummaryStat label="Attendance Rate" value={formatRate(trendRate)} change={kpis.attendanceRate.changePct} points />
          </dl>
          <div className="pl-10">
            <ChartLegend items={[
              { label: 'Registrations', colour: '#2563eb' },
              { label: 'Attendees', colour: '#7c3aed' },
            ]} />
          </div>
          <div className="mt-2">
            <RegistrationTrendChart data={trend} height={140} />
          </div>
        </Panel>

        <RunOfShowPanel
          sessions={runOfShow.sessions}
          title="Run of Show"
          // Same pattern as the reference's "Run of Show • Episode #56": one line, so the row keeps its height.
          titleSuffix={runOfShowIsToday ? '(Today)' : runOfShow.event ? `• ${runOfShow.event.name}` : undefined}
          viewAllHref={runOfShow.event ? `${page.basePath}/events/${runOfShow.event.id}` : `${page.basePath}/events`}
          timezone={workspace.timezone}
        />

        <ActivityPanel activity={activity} viewAllHref={`${page.basePath}/events`} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[745fr_405fr]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white" aria-label="Event summary">
          <div className="border-b border-slate-100 px-3 py-2">
            <EventsFilterBar
              variant="inline"
              searchPlaceholder="Search events..."
              dateRangeLabel="Date Range"
              showMoreFilters={false}
              filters={[
                {
                  key: 'type', label: 'Event Type', width: 100,
                  options: [
                    { value: 'conference', label: 'Conference' },
                    { value: 'in_person', label: 'In-person' },
                    { value: 'webinar', label: 'Webinar' },
                    { value: 'podcast', label: 'Podcast' },
                    { value: 'workshop', label: 'Workshop' },
                  ],
                },
                {
                  key: 'status', label: 'Status', allLabel: 'All Statuses', width: 80,
                  options: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'upcoming', label: 'Upcoming' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'live', label: 'Live' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ],
                },
                { key: 'owner', label: 'Owner', width: 80, options: owners.map(owner => ({ value: owner.id, label: owner.name })) },
              ]}
            />
          </div>

          <div className="px-3 pb-4 pt-3">
            <h2 className="mb-3 text-[13px] font-semibold text-slate-900">Event Summary</h2>
            {list.events.length === 0 ? (
              <EventsEmptyState
                title="No events match this view"
                description="Adjust the filters, or create your first event to start tracking registrations, attendance and sponsorship."
                action={
                  page.can('events.create')
                    ? <Link href={`${page.basePath}/events`} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white">Go to events</Link>
                    : undefined
                }
              />
            ) : filters.view === 'cards' ? (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {list.events.slice(0, 4).map(event => (
                  <EventCard key={event.id} event={event} href={eventHref(event)} timezone={workspace.timezone} />
                ))}
              </div>
            ) : filters.view === 'table' ? (
              <EventsTable events={list.events} hrefFor={eventHref} timezone={workspace.timezone} />
            ) : filters.view === 'calendar' ? (
              <EventsCalendarView events={list.events} hrefFor={eventHref} timezone={workspace.timezone} />
            ) : (
              <EventsTimelineView events={list.events} hrefFor={eventHref} timezone={workspace.timezone} />
            )}

            {list.events.length > 0 && (
              <div className="mt-4 text-center">
                <PanelLink href={`${page.basePath}/events`}>View all events →</PanelLink>
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white" aria-label="Upcoming events">
          <div className="border-b border-slate-100 px-3 py-2">
            <ViewSwitcher views={allowedViews} active={filters.view} fill />
          </div>
          <UpcomingEventsPanel
            embedded
            events={upcoming}
            hrefFor={eventHref}
            timezone={workspace.timezone}
            calendarHref={`${page.basePath}/events?view=calendar`}
            allHref={`${page.basePath}/events`}
          />
        </section>
      </div>

      <p className="mt-8 text-center text-[10.5px] text-slate-400">
        All figures are computed from live workspace records. Watch time and provider
        metrics appear only where a webinar or podcast provider is connected.
      </p>
    </EventsShell>
  )
}
