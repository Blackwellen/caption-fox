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
  EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, PanelLink,
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
          label="Total Events" tone="blue" icon={<CalendarDays size={17} />}
          value={formatNumber(kpis.totalEvents.value)} kpi={kpis.totalEvents}
          href={`${page.basePath}/events`} comparison={`vs last ${filters.range} days`}
        />
        <KpiCard
          label="Registrations" tone="violet" icon={<Users size={17} />}
          value={formatNumber(kpis.registrations.value)} kpi={kpis.registrations}
          comparison={`vs last ${filters.range} days`}
        />
        <KpiCard
          label="Attendance Rate" tone="emerald" icon={<TrendingUp size={17} />}
          value={formatRate(kpis.attendanceRate.value)} kpi={kpis.attendanceRate}
          comparison={`vs last ${filters.range} days`}
          tooltip="Attended registrations divided by eligible (confirmed, registered, attended or no-show) registrations."
        />
        {page.can('sponsorships.viewFinancials') ? (
          <KpiCard
            label="Sponsorship Revenue" tone="amber" icon={<DollarSign size={17} />}
            value={formatCurrency(kpis.sponsorshipRevenue.value, workspace.currency, true)}
            kpi={kpis.sponsorshipRevenue}
            href={page.visibleTabs.includes('sponsorships') ? `${page.basePath}/sponsorships` : undefined}
            comparison={`vs last ${filters.range} days`}
          />
        ) : (
          <KpiCard
            label="Sponsors" tone="amber" icon={<DollarSign size={17} />}
            value="Hidden"
            comparison="Sponsorship values are restricted for your role"
          />
        )}
        <KpiCard
          label="Follow-up Tasks" tone="rose" icon={<CheckCircle2 size={17} />}
          value={formatNumber(kpis.followUpTasks.value)} kpi={kpis.followUpTasks}
          href={page.visibleTabs.includes('follow-up') ? `${page.basePath}/follow-up` : undefined}
          comparison={`vs last ${filters.range} days`}
        />
        <KpiCard
          label="Upcoming Sessions" tone="sky" icon={<Clock size={17} />}
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
        body="Manage venues, schedules, sponsors, and logistics in one powerful platform. Caption Fox keeps the marketing; Gala Dock runs the day."
        className="mb-5"
      />

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
        <Panel
          title="Registration Performance"
          action={<RangePicker value={filters.range} />}
        >
          <dl className="mb-3 grid grid-cols-3 gap-3 border-b border-slate-100 pb-3">
            <SummaryStat label="Registrations" value={formatNumber(totals.registrations)} />
            <SummaryStat label="Attended" value={formatNumber(totals.attendees)} />
            <SummaryStat label="Attendance Rate" value={formatRate(trendRate)} />
          </dl>
          <ChartLegend items={[
            { label: 'Registrations', colour: '#2563eb' },
            { label: 'Attendees', colour: '#7c3aed' },
          ]} />
          <div className="mt-2">
            <RegistrationTrendChart data={trend} />
          </div>
        </Panel>

        <RunOfShowPanel
          sessions={runOfShow.sessions}
          title={runOfShow.event ? `Run of Show (${runOfShow.event.name})` : 'Run of Show'}
          viewAllHref={runOfShow.event ? `${page.basePath}/events/${runOfShow.event.id}` : `${page.basePath}/events`}
          timezone={workspace.timezone}
        />

        <ActivityPanel activity={activity} viewAllHref={`${page.basePath}/events`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <EventsFilterBar
            searchPlaceholder="Search events..."
            dateRangeLabel="Date Range"
            filters={[
              {
                key: 'type', label: 'Event Type',
                options: [
                  { value: 'conference', label: 'Conference' },
                  { value: 'in_person', label: 'In-person' },
                  { value: 'webinar', label: 'Webinar' },
                  { value: 'podcast', label: 'Podcast' },
                  { value: 'workshop', label: 'Workshop' },
                ],
              },
              {
                key: 'status', label: 'Status', allLabel: 'All Statuses',
                options: [
                  { value: 'draft', label: 'Draft' },
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'live', label: 'Live' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ],
              },
              { key: 'owner', label: 'Owner', options: owners.map(owner => ({ value: owner.id, label: owner.name })) },
            ]}
          />

          <Panel
            title="Event Summary"
            action={<ViewSwitcher views={allowedViews} active={filters.view} />}
            contentClassName={filters.view === 'cards' ? 'p-4' : 'p-0'}
          >
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
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                {list.events.map(event => (
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
          </Panel>
        </div>

        <UpcomingEventsPanel
          events={upcoming}
          hrefFor={eventHref}
          timezone={workspace.timezone}
          calendarHref={`${page.basePath}/events?view=calendar`}
          allHref={`${page.basePath}/events`}
        />
      </div>

      <p className="mt-8 text-center text-[11.5px] text-slate-400">
        All figures are computed from live workspace records. Watch time and provider
        metrics appear only where a webinar or podcast provider is connected.
      </p>
    </EventsShell>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-[19px] font-bold leading-tight text-slate-900">{value}</dd>
      <dt className="mt-0.5 text-[11.5px] text-slate-500">{label}</dt>
    </div>
  )
}
