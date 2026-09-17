import Link from 'next/link'
import {
  AlertCircle, Bell, CalendarCheck, CheckCircle2, Mail, MessageSquare, TrendingUp, Users,
} from 'lucide-react'
import EventsShell, { Avatar } from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import FollowUpBoard from '@/components/events/FollowUpBoard'
import { EventsFilterBar, RangePicker, ViewSwitcher } from '@/components/events/FilterBar'
import { ExportButton, MoreActionsButton } from '@/components/events/HeaderActions'
import { CreateSequenceButton } from '@/components/events/CreateModals'
import { ChartLegend, OutreachChart } from '@/components/events/charts'
import { ActivityPanel } from '@/components/events/records'
import {
  EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, PanelLink,
  DeltaTriangle, StatusBadge, TimelineDot,
} from '@/components/events/primitives'
import { getEventsPageContext, parseEventsFilters } from '@/lib/events/page-context'
import {
  getEventActivity, getFollowUpKpis, getFollowUpOwnerStats, getFollowUpReminders,
  getGalaDockState, getOutreachTrend, listEvents, listFollowUpSequences,
  listFollowUpTasks, listRecentRegistrationsToFollowUp,
} from '@/lib/events/queries'
import { formatChange, formatEventDate, formatNumber, formatRate, formatRelative, titleCase } from '@/lib/events/format'
import type { EventViewMode, FollowUpTaskWithRelations } from '@/lib/events/types'

export const dynamic = 'force-dynamic'

const VIEWS: EventViewMode[] = ['cards', 'table', 'board', 'timeline']

export const metadata = {
  title: 'Follow-up · Caption Fox',
  description: 'Manage post-event outreach, track engagement, and convert leads.',
}

export default async function FollowUpPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'follow-up')

  const allowedViews = VIEWS.filter(view => (view === 'timeline' ? page.can('views.timeline') : true))
  const filters = parseEventsFilters(query, allowedViews, 'cards')

  const { supabase, workspace } = page
  const [kpis, trend, tasks, sequences, recent, activity, reminders, owners, events, gala] = await Promise.all([
    getFollowUpKpis(supabase, workspace.id, filters.range),
    getOutreachTrend(supabase, workspace.id, filters.range),
    listFollowUpTasks(supabase, workspace.id, filters),
    listFollowUpSequences(supabase, workspace.id),
    listRecentRegistrationsToFollowUp(supabase, workspace.id, 5),
    getEventActivity(supabase, workspace.id, 5, ['followup_task', 'sequence', 'registration']),
    getFollowUpReminders(supabase, workspace.id),
    getFollowUpOwnerStats(supabase, workspace.id, 3),
    listEvents(supabase, workspace.id, { pageSize: 50 }),
    getGalaDockState(supabase, workspace.id, page.userId),
  ])

  const totals = trend.reduce(
    (acc, point) => ({
      sent: acc.sent + Number(point.sent ?? 0),
      opened: acc.opened + Number(point.opened ?? 0),
      replied: acc.replied + Number(point.replied ?? 0),
      meetings: acc.meetings + Number(point.meetings ?? 0),
    }),
    { sent: 0, opened: 0, replied: 0, meetings: 0 },
  )
  const activeSequence = sequences.find(sequence => sequence.status === 'active') ?? sequences[0] ?? null

  return (
    <EventsShell
      basePath={page.basePath}
      activeTab="follow-up"
      visibleTabs={page.visibleTabs}
      workspaces={page.workspaces}
      activeWorkspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}
      user={page.user}
      notificationCount={page.notificationCount}
      planUsage={page.planUsage}
      searchPlaceholder="Search follow-up tasks, leads, sequences..."
    >
      <EventsPageHeader
        title="Follow-up"
        subtitle="Manage post-event outreach, track engagement, and convert leads into lasting relationships."
        actions={
          <>
            <ExportButton
              routeSegment={workspaceType}
              resource="follow-up"
              disabledReason={page.can('events.export') ? null : 'Your role cannot export follow-up data'}
            />
            <Link
              href={`${page.basePath}/follow-up?view=board`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Users size={15} aria-hidden />
              Assign Tasks
            </Link>
            <CreateSequenceButton
              routeSegment={workspaceType}
              events={events.events.map(ev => ({ id: ev.id, name: ev.name }))}
              disabledReason={
                page.can('followUp.sequences')
                  ? null
                  : page.blocker('followUp.sequences') === 'plan'
                    ? `Sequences are on the ${page.requiredPlanLabel('followUp.sequences')} plan`
                    : 'Your role cannot create sequences'
              }
            />
            <MoreActionsButton
              items={[
                { label: 'Board view', href: `${page.basePath}/follow-up?view=board` },
                { label: 'Open automations', href: `${page.workspaceRoot}/automations` },
              ]}
            />
          </>
        }
      />

      <KpiStrip>
        <KpiCard label="Follow-up Tasks" tone="blue" icon={<Users size={18} />}
          value={formatNumber(kpis.tasks.value)} comparison="All open and completed" />
        <KpiCard label="Leads to Contact" tone="violet" icon={<Mail size={18} />}
          value={formatNumber(kpis.leadsToContact.value)} comparison="Not yet contacted" />
        <KpiCard label="Responses" tone="emerald" icon={<MessageSquare size={18} />}
          value={formatNumber(kpis.responses.value)} kpi={kpis.responses}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Meetings Booked" tone="amber" icon={<CalendarCheck size={18} />}
          value={formatNumber(kpis.meetingsBooked.value)} kpi={kpis.meetingsBooked}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Conversion Rate" tone="indigo" icon={<TrendingUp size={18} />}
          value={formatRate(kpis.conversionRate.value)} kpi={kpis.conversionRate}
          comparison={`vs last ${filters.range} days`}
          tooltip="Conversions divided by outreach emails sent in the period." />
        <KpiCard label="Outstanding Actions" tone="rose" icon={<AlertCircle size={18} />}
          value={formatNumber(kpis.outstandingActions.value)} comparison="Past due" />
      </KpiStrip>

      <GalaDockPromotion
        placement="follow-up-banner"
        routeSegment={workspaceType}
        connectionState={gala.connectionState}
        workspaceUrl={gala.workspaceUrl}
        syncError={gala.syncError}
        dismissed={gala.dismissedPlacements.includes('follow-up-banner')}
        title="Elevate your next event with Gala Dock"
        body="The all-in-one platform for event management, ticketing, sponsors and attendee engagement."
        className="mb-3.5"
      />

      <div className="mb-3.5 grid grid-cols-1 items-center gap-3.5 xl:grid-cols-[791fr_380fr]">
        <div className="min-w-0">
          <EventsFilterBar
            variant="inline"
            showMoreFilters={false}
            searchPlaceholder="Search follow-up tasks, leads, sequences..."
            dateRangeLabel="Date Range"
            filters={[
              { key: 'event', label: 'Event', width: 72, options: events.events.map(event => ({ value: event.id, label: event.name })) },
              {
                key: 'status', label: 'Status', allLabel: 'All Statuses', width: 72,
                options: [
                  { value: 'not_started', label: 'Not started' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'waiting', label: 'Waiting' },
                  { value: 'completed', label: 'Completed' },
                ],
              },
              { key: 'sequence', label: 'Sequence', width: 90, options: sequences.map(sequence => ({ value: sequence.id, label: sequence.name })) },
              { key: 'owner', label: 'Owner', width: 76, options: owners.map(owner => ({ value: owner.id, label: owner.name })) },
            ]}
          />
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <ViewSwitcher views={allowedViews} active={filters.view} fill />
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-[433fr_348fr_380fr]">
        <Panel title="Outreach Performance" action={<RangePicker value={filters.range} />} contentClassName="px-4 pb-3 pt-4">
          <dl className="mb-4 grid grid-cols-4 gap-2">
            <Metric label="Emails Sent" value={formatNumber(totals.sent)} />
            <Metric label="Open Rate" value={formatRate(totals.sent ? totals.opened / totals.sent : null)} />
            <Metric label="Reply Rate" value={formatRate(totals.sent ? totals.replied / totals.sent : null)} />
            <Metric label="Meetings Booked" value={formatNumber(totals.meetings)} change={kpis.meetingsBooked.changePct} />
          </dl>
          <div className="pl-6">
            <ChartLegend items={[
              { label: 'Emails Sent', colour: '#2563eb' },
              { label: 'Opens', colour: '#7c3aed' },
              { label: 'Replies', colour: '#10b981' },
            ]} />
          </div>
          <div className="mt-2"><OutreachChart data={trend} height={150} /></div>
          <p className="mt-1 text-[10px] text-slate-400">
            Opens are counted only where the sending provider reports them.
          </p>
        </Panel>

        <Panel
          title="Recent Registrations to Follow Up"
          action={<PanelLink href={`${page.basePath}/follow-up?status=not_started`}>View All</PanelLink>}
          contentClassName="p-0"
        >
          {recent.length === 0 ? (
            <div className="p-4">
              <EventsEmptyState
                title="Everyone has been contacted"
                description="New registrations appear here the moment they arrive, ready to assign."
              />
            </div>
          ) : (
            <ol className="px-4 py-2">
              {recent.map((person, index) => (
                <li key={person.id} className="relative flex min-h-[47px] items-start gap-2.5 py-[5px]">
                  {index < recent.length - 1 && (
                    <span className="absolute left-[3.5px] top-[17px] h-[calc(100%-6px)] w-px bg-slate-200" aria-hidden />
                  )}
                  <TimelineDot state={person.followUpStatus === 'not_contacted' ? 'completed' : 'live'} />
                  <Avatar name={person.name} src={person.avatarUrl} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10.5px] font-semibold leading-tight text-slate-900">{person.name}</span>
                    <span className="block truncate text-[10px] leading-snug text-slate-500">{person.eventName ?? 'Unassigned event'}</span>
                    <span className="block truncate text-[10px] leading-snug text-slate-400">Registered {formatRelative(person.registeredAt)}</span>
                  </span>
                  <StatusBadge
                    status={person.followUpStatus === 'not_contacted' ? 'upcoming' : person.followUpStatus}
                    label={person.followUpStatus === 'not_contacted' ? 'Not Contacted' : titleCase(person.followUpStatus)}
                    className="mt-0.5 px-1.5 py-[1px] text-[10px]"
                  />
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <ActivityPanel activity={activity} viewAllHref={`${page.basePath}/follow-up`} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[586fr_218fr_355fr]">
        <div className="min-w-0">
          <Panel title="Follow-up Tasks" contentClassName="p-2.5" className="h-full">
            {tasks.length === 0 ? (
              <EventsEmptyState
                title={filters.q ? `No tasks match “${filters.q}”` : 'No follow-up tasks yet'}
                description={
                  filters.q
                    ? 'Try a different search term or clear the filters.'
                    : 'Assign tasks from a registration, or activate a sequence to generate them automatically.'
                }
                icon={<CheckCircle2 size={26} />}
              />
            ) : filters.view === 'table' ? (
              <TaskTable tasks={tasks} timezone={workspace.timezone} />
            ) : filters.view === 'timeline' ? (
              <TaskTimeline tasks={tasks} timezone={workspace.timezone} />
            ) : (
              <FollowUpBoard
                tasks={tasks}
                routeSegment={workspaceType}
                basePath={page.basePath}
                timezone={workspace.timezone}
                canManage={page.can('followUp.manage')}
              />
            )}
          </Panel>
        </div>

        <div className="min-w-0">
          <Panel
            title="Follow-up Playbook"
            className="h-full"
            contentClassName="px-4 py-3"
            description={activeSequence ? activeSequence.name : undefined}
          >
            {!activeSequence || activeSequence.steps.length === 0 ? (
              <EventsEmptyState
                title="No sequence steps yet"
                description="A sequence turns a registration list into a scheduled outreach plan — thank-you, value follow-up, then a personal touch."
              />
            ) : (
              <ol>
                {activeSequence.steps.map((step, index) => (
                  <li key={step.id} className="flex gap-2.5">
                    <span className="flex flex-col items-center">
                      <TimelineDot state={index === 0 ? 'completed' : index === 1 ? 'live' : 'upcoming'} />
                      {index < activeSequence.steps.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden />
                      )}
                    </span>
                    <span className="w-[38px] shrink-0 pt-[3px] text-[10px] text-slate-600">Day {step.delay_days}</span>
                    <span className="min-w-0 pb-4">
                      <span className="block text-[10px] font-semibold leading-snug text-slate-900">{step.title}</span>
                      {step.body && <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{step.body}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {page.can('followUp.sequences') && (
              <div className="mt-1 text-center">
                <PanelLink href={`${page.basePath}/follow-up/sequences`}>Manage sequences →</PanelLink>
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-3.5">
          <Panel
            title="Reminders"
            action={<PanelLink href={`${page.basePath}/follow-up?status=not_started`}>View All</PanelLink>}
            contentClassName="p-0"
          >
            <ul className="divide-y divide-slate-50">
              <Reminder
                icon={<Bell size={14} />} tone="rose"
                title={`${reminders.dueToday} ${reminders.dueToday === 1 ? 'task' : 'tasks'} due today`}
                body="High priority follow-ups"
              />
              <Reminder
                icon={<Mail size={14} />} tone="blue"
                title={`${reminders.sequencesNeedingAttention} ${reminders.sequencesNeedingAttention === 1 ? 'sequence needs' : 'sequences need'} attention`}
                body="Paused — review and resume outreach"
              />
              <Reminder
                icon={<CalendarCheck size={14} />} tone="emerald"
                title={`${reminders.meetingsThisWeek} ${reminders.meetingsThisWeek === 1 ? 'meeting' : 'meetings'} booked this week`}
                body="Booked from follow-up in the last 7 days"
              />
            </ul>
          </Panel>

          <Panel title="Top Owners" action={<PanelLink href={`${page.basePath}/follow-up`}>View All</PanelLink>} contentClassName="p-0">
            {owners.length === 0 ? (
              <div className="p-4">
                <EventsEmptyState
                  title="No owners yet"
                  description="Assign follow-up tasks to teammates to see completion rates here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {owners.map(owner => (
                  <li key={owner.id} className="flex items-center gap-2.5 px-4 py-3">
                    <Avatar name={owner.name} src={owner.avatarUrl} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold text-slate-900">{owner.name}</span>
                      <span className="block text-[10px] text-slate-500">{owner.total} tasks</span>
                    </span>
                    <span className="flex w-[110px] shrink-0 items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <span className="block h-full rounded-full bg-blue-600" style={{ width: `${owner.completionRate * 100}%` }} />
                      </span>
                      <span className="text-[10.5px] font-semibold text-slate-700">{formatRate(owner.completionRate, 0)}</span>
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

function Metric({ label, value, change }: { label: string; value: string; change?: number | null }) {
  const hasChange = change !== null && change !== undefined
  const positive = (change ?? 0) >= 0
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] text-slate-500" title={label}>{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[15px] font-semibold leading-tight text-slate-900">{value}</span>
        {hasChange && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
            <DeltaTriangle positive={positive} />
            {formatChange(change).replace(/^[+-]/, '')}
          </span>
        )}
      </dd>
    </div>
  )
}

function Reminder({
  icon, tone, title, body,
}: { icon: React.ReactNode; tone: 'rose' | 'blue' | 'emerald'; title: string; body: string }) {
  const tones = {
    rose: 'bg-rose-50 text-rose-500',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <li className="flex items-start gap-2.5 px-4 py-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`} aria-hidden>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11.5px] font-semibold text-slate-900">{title}</span>
        <span className="block text-[10px] text-slate-500">{body}</span>
      </span>
    </li>
  )
}

function TaskTable({ tasks, timezone }: { tasks: FollowUpTaskWithRelations[]; timezone: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">Follow-up tasks</caption>
        <thead>
          <tr className="border-b border-slate-100 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-3 py-3">Task</th>
            <th scope="col" className="px-3 py-3">Contact</th>
            <th scope="col" className="px-3 py-3">Event</th>
            <th scope="col" className="px-3 py-3">Sequence</th>
            <th scope="col" className="px-3 py-3">Status</th>
            <th scope="col" className="px-3 py-3">Due</th>
            <th scope="col" className="px-3 py-3">Owner</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map(task => (
            <tr key={task.id} className="text-[13px] text-slate-700 hover:bg-slate-50/70">
              <th scope="row" className="px-3 py-3 text-left font-semibold text-slate-900">{task.title}</th>
              <td className="px-3 py-3">{task.contactName ?? '—'}</td>
              <td className="px-3 py-3">{task.eventName ?? '—'}</td>
              <td className="px-3 py-3">{task.sequenceName ?? '—'}</td>
              <td className="px-3 py-3"><StatusBadge status={task.status} label={titleCase(task.status)} /></td>
              <td className="whitespace-nowrap px-3 py-3">{formatEventDate(task.due_at, timezone)}</td>
              <td className="px-3 py-3">{task.ownerName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TaskTimeline({ tasks, timezone }: { tasks: FollowUpTaskWithRelations[]; timezone: string }) {
  const dated = tasks.filter(task => task.due_at).sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1))
  if (dated.length === 0) {
    return (
      <EventsEmptyState
        title="No dated tasks"
        description="Give tasks a due date to plot them on the outreach timeline."
      />
    )
  }
  return (
    <ol className="space-y-2.5 border-l border-slate-200 pl-5">
      {dated.map(task => (
        <li key={task.id} className="relative">
          <span className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" aria-hidden />
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[13px] font-semibold text-slate-900">{task.title}</p>
            <p className="mt-0.5 text-[10.5px] text-slate-500">
              Due {formatEventDate(task.due_at, timezone)}
              {task.contactName && <> · {task.contactName}</>}
              {task.ownerName && <> · Owner {task.ownerName}</>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
