import { CalendarDays, CheckCircle2, Radio, Star, Timer, Users } from 'lucide-react'
import EventsShell from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import { EventsFilterBar, Pagination, RangePicker, ViewSwitcher } from '@/components/events/FilterBar'
import { CreateButton, ExportButton, MoreActionsButton } from '@/components/events/HeaderActions'
import { RegistrationTrendChart } from '@/components/events/charts'
import { ActivityPanel, EventCard, RunOfShowPanel } from '@/components/events/records'
import EventsTableSelect from '@/components/events/EventsTableSelect'
import { EventsCalendarView, EventsTimelineView } from '@/components/events/views'
import { EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, SummaryStat } from '@/components/events/primitives'
import { ChartLegend } from '@/components/events/charts'
import { getEventsPageContext, parseEventsFilters } from '@/lib/events/page-context'
import {
  getEventActivity, getGalaDockState, getOverviewKpis, getRegistrationTrend,
  getRunOfShow, listEventOwners, listEvents,
} from '@/lib/events/queries'
import { formatNumber, formatRate } from '@/lib/events/format'
import type { EventViewMode, EventWithStats } from '@/lib/events/types'

export const dynamic = 'force-dynamic'

const VIEWS: EventViewMode[] = ['cards', 'table', 'calendar', 'timeline']

export const metadata = {
  title: 'Events · Caption Fox',
  description: 'Search, filter, and manage all your event records in one place.',
}

export default async function EventsDirectoryPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'events')

  const allowedViews = VIEWS.filter(view =>
    view === 'calendar' ? page.can('views.calendar')
      : view === 'timeline' ? page.can('views.timeline') : true)
  const filters = parseEventsFilters(query, allowedViews, 'cards')

  const { supabase, workspace } = page
  const [list, kpis, trend, runOfShow, activity, owners, gala, live, upcomingCount, sponsorCount] = await Promise.all([
    listEvents(supabase, workspace.id, filters),
    getOverviewKpis(supabase, workspace.id, filters.range),
    getRegistrationTrend(supabase, workspace.id, filters.range),
    getRunOfShow(supabase, workspace.id, undefined, 6),
    getEventActivity(supabase, workspace.id, 4),
    listEventOwners(supabase, workspace.id),
    getGalaDockState(supabase, workspace.id, page.userId),
    supabase.from('events').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id).eq('status', 'live'),
    supabase.from('events').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id).in('status', ['upcoming', 'scheduled'])
      .gte('start_at', new Date().toISOString()),
    supabase.from('sponsorships').select('sponsor_id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id).in('stage', ['contracted', 'active']),
  ])

  const eventHref = (event: EventWithStats) => `${page.basePath}/events/${event.id}`
  const cardEvents = list.events
  const totals = trend.reduce((sum, point) => sum + Number(point.registrations ?? 0), 0)
  const attendees = trend.reduce((sum, point) => sum + Number(point.attendees ?? 0), 0)
  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: workspace.timezone }).format(new Date(iso))
  const runOfShowIsToday = Boolean(
    runOfShow.event?.start_at && dayKey(runOfShow.event.start_at) === dayKey(new Date().toISOString()),
  )

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
      <EventsPageHeader
        title="Events"
        subtitle="Search, filter, and manage all your event records in one place."
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
                { id: 'conference', label: 'Conference', description: 'Multi-session in-person event', eventType: 'conference' },
                { id: 'workshop', label: 'Workshop', description: 'Hands-on session with capacity', eventType: 'workshop' },
                { id: 'webinar', label: 'Webinar', description: 'Online session with registrations', eventType: 'webinar' },
              ]}
            />
            <MoreActionsButton
              items={[
                { label: 'Open calendar view', href: `${page.basePath}/events?view=calendar` },
                { label: 'Open timeline view', href: `${page.basePath}/events?view=timeline` },
                { label: 'Follow-up tasks', href: `${page.basePath}/follow-up` },
              ]}
            />
          </>
        }
      />

      <KpiStrip>
        <KpiCard label="Total Events" tone="blue" icon={<CalendarDays size={18} />}
          value={formatNumber(kpis.totalEvents.value)} kpi={kpis.totalEvents}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Live Events" tone="emerald" icon={<Radio size={18} />}
          value={formatNumber(live.count ?? 0)} comparison="Running now" />
        <KpiCard label="Upcoming Events" tone="violet" icon={<Timer size={18} />}
          value={formatNumber(upcomingCount.count ?? 0)} comparison="Scheduled ahead" />
        <KpiCard label="Registrations" tone="sky" icon={<Users size={18} />}
          value={formatNumber(kpis.registrations.value)} kpi={kpis.registrations}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Sponsors" tone="amber" icon={<Star size={18} />}
          value={formatNumber(sponsorCount.count ?? 0)} comparison="Contracted or active" />
        <KpiCard label="Follow-up Outstanding" tone="rose" icon={<CheckCircle2 size={18} />}
          value={formatNumber(kpis.followUpTasks.value)} kpi={kpis.followUpTasks}
          href={page.visibleTabs.includes('follow-up') ? `${page.basePath}/follow-up` : undefined}
          comparison={`vs last ${filters.range} days`} />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[2fr_1fr]">
        {/* ------------------------------------------------------ main column */}
        <div className="min-w-0 space-y-3.5">
          <EventsFilterBar
            variant="stacked"
            searchPlaceholder="Search events by name, location, or tag..."
            dateRangeLabel="Date Range"
            extraCount={[filters.dateFrom, filters.dateTo].filter(Boolean).length}
            filters={[
              {
                key: 'type', label: 'Event Type', allLabel: 'All Types',
                options: [
                  { value: 'conference', label: 'Conference' },
                  { value: 'summit', label: 'Summit' },
                  { value: 'in_person', label: 'In-person' },
                  { value: 'webinar', label: 'Webinar' },
                  { value: 'podcast', label: 'Podcast' },
                  { value: 'workshop', label: 'Workshop' },
                  { value: 'roundtable', label: 'Roundtable' },
                  { value: 'product_launch', label: 'Product launch' },
                  { value: 'networking', label: 'Networking' },
                ],
              },
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
              { key: 'owner', label: 'Owner', options: owners.map(owner => ({ value: owner.id, label: owner.name })) },
            ]}
          />

          {list.total === 0 ? (
            <Panel>
              <EventsEmptyState
                title={filters.q ? `No events match “${filters.q}”` : 'No events yet'}
                description={
                  filters.q
                    ? 'Try a different search term, or clear the filters to see every event in this workspace.'
                    : 'Create your first event to start tracking registrations, attendance, sponsorship and follow-up.'
                }
                icon={<CalendarDays size={26} />}
              />
            </Panel>
          ) : (
            <>
              {/* Card strip mirrors the reference: a scannable row above the table. */}
              {filters.view === 'cards' && (
                // Four cards in view; the rest of the page scrolls sideways.
                <div
                  className="relative grid snap-x auto-cols-[minmax(172px,calc((100%-30px)/4))] grid-flow-col gap-2.5 overflow-x-auto pb-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]"
                  role="region"
                  aria-label="Event cards"
                  tabIndex={0}
                >
                  {cardEvents.map(event => (
                    <div key={event.id} className="snap-start">
                      <EventCard event={event} href={eventHref(event)} timezone={workspace.timezone} />
                    </div>
                  ))}
                </div>
              )}

              <Panel contentClassName="p-0">
                {filters.view === 'calendar' ? (
                  <EventsCalendarView events={list.events} hrefFor={eventHref} timezone={workspace.timezone} />
                ) : filters.view === 'timeline' ? (
                  <EventsTimelineView events={list.events} hrefFor={eventHref} timezone={workspace.timezone} />
                ) : (
                  <EventsTableSelect
                    events={list.events}
                    basePath={page.basePath}
                    timezone={workspace.timezone}
                    routeSegment={workspaceType}
                    canExport={page.can('events.export')}
                  />
                )}
                <Pagination page={list.page} pageSize={list.pageSize} total={list.total} />
              </Panel>
            </>
          )}
        </div>

        {/* ------------------------------------------------------- right rail */}
        <div className="min-w-0 space-y-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            <ViewSwitcher views={allowedViews} active={filters.view} fill />
          </div>

          <GalaDockPromotion
            placement="events-sidebar"
            routeSegment={workspaceType}
            connectionState={gala.connectionState}
            workspaceUrl={gala.workspaceUrl}
            syncError={gala.syncError}
            dismissed={gala.dismissedPlacements.includes('events-sidebar')}
            title="Manage your events with Gala Dock"
            body="Powerful tools for venues, schedules, sponsors and logistics — built to make every event unforgettable."
          />

          <Panel title="Registration Snapshot" action={<RangePicker value={filters.range} />} contentClassName="px-3 pb-3 pt-3">
            <dl className="mb-2 grid grid-cols-2 divide-x divide-slate-100">
              <SummaryStat label="Registrations" value={formatNumber(totals)} change={kpis.registrations.changePct} />
              <SummaryStat label="Attendance Rate" value={formatRate(totals ? attendees / totals : null)} change={kpis.attendanceRate.changePct} points />
            </dl>
            <RegistrationTrendChart data={trend} height={120} />
            <div className="mt-1 flex justify-center">
              <ChartLegend items={[
                { label: 'Registrations', colour: '#2563eb' },
                { label: 'Attendees', colour: '#7c3aed' },
              ]} />
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

          <ActivityPanel activity={activity} viewAllHref={`${page.basePath}`} />
        </div>
      </div>
    </EventsShell>
  )
}
