import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HelpCircle, Users as UsersIcon, Video } from 'lucide-react'
import EventsShell from '@/components/events/EventsShell'
import { DetailBreadcrumb, DetailHeaderBar, DetailTabStrip } from '@/components/events/DetailHeader'
import RegistrationsTable from '@/components/events/RegistrationsTable'
import { PeoplePanel, RunOfShowPanel } from '@/components/events/records'
import { EventsEmptyState, KpiCard, KpiStrip, Panel, StatusBadge } from '@/components/events/primitives'
import { Pagination } from '@/components/events/FilterBar'
import { getEventsPageContext } from '@/lib/events/page-context'
import { getWebinarQuestions } from '@/lib/events/queries'
import { getEventRegistrations, getEventSessions, getEventSpeakers, getWebinarDetail } from '@/lib/events/detail-queries'
import { formatDuration, formatEventDateTime, formatNumber, formatRate, formatRelative, titleCase } from '@/lib/events/format'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'registration', label: 'Registration' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'questions', label: 'Questions' },
]

export default async function WebinarDetailPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, id } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'webinars')
  const { supabase, workspace } = page

  const webinar = await getWebinarDetail(supabase, workspace.id, id)
  if (!webinar) notFound()

  const activeTab = (Array.isArray(query.tab) ? query.tab[0] : query.tab) || 'overview'
  const tab = TABS.some(t => t.id === activeTab) ? activeTab : 'overview'
  const detailPath = `${page.basePath}/webinars/${id}`
  const regPage = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1)

  const [sessions, speakers, registrationsResult, questions] = await Promise.all([
    getEventSessions(supabase, workspace.id, id),
    getEventSpeakers(supabase, workspace.id, id),
    tab === 'registration' ? getEventRegistrations(supabase, workspace.id, id, { page: regPage, pageSize: 25 }) : Promise.resolve(null),
    tab === 'questions' || tab === 'overview' ? getWebinarQuestions(supabase, workspace.id, 100).then(all => all.filter(q => q.event_id === id)) : Promise.resolve([]),
  ])

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
    >
      <DetailBreadcrumb parentLabel="Webinars" parentHref={`${page.basePath}/webinars`} recordName={webinar.name} />

      <DetailHeaderBar
        title={webinar.name}
        status={webinar.status}
        subtitle={[
          formatEventDateTime(webinar.start_at, webinar.timezone || workspace.timezone),
          webinar.webinar?.provider ? titleCase(webinar.webinar.provider) : webinar.online_platform,
        ].filter(Boolean).join(' · ')}
        cover={
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-900 to-slate-700 text-indigo-200">
            <Video size={24} />
          </span>
        }
        actions={
          webinar.webinar?.join_url ? (
            <a href={webinar.webinar.join_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700">
              Join link
            </a>
          ) : undefined
        }
      />

      <DetailTabStrip tabs={TABS} active={tab} basePath={detailPath} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <KpiStrip>
            <KpiCard label="Registrations" tone="violet" icon={<UsersIcon size={15} />} value={formatNumber(webinar.registrations)} comparison="Total" />
            <KpiCard label="Attendance Rate" tone="emerald" icon={<UsersIcon size={15} />} value={formatRate(webinar.attendanceRate)} comparison="Of eligible registrations" />
            <KpiCard label="Avg Watch Time" tone="sky" icon={<UsersIcon size={15} />} value={formatDuration(webinar.webinar?.avg_watch_seconds ?? null)} comparison="Reported by provider" />
            <KpiCard label="Questions" tone="rose" icon={<HelpCircle size={15} />} value={formatNumber(webinar.webinar?.questions_count ?? 0)} comparison="Submitted" />
            <KpiCard label="Recording" tone="indigo" icon={<Video size={15} />} value={titleCase(webinar.webinar?.recording_state ?? 'none')} comparison="Provider status" />
          </KpiStrip>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <RunOfShowPanel sessions={sessions} title="Agenda" viewAllHref={`${detailPath}?tab=agenda`} timezone={workspace.timezone} />
            <PeoplePanel
              people={speakers.map(s => ({ id: s.id, full_name: s.full_name, job_title: s.job_title, avatar_url: s.avatar_url, speaker_role: s.speaker_role }))}
              title="Speakers & Hosts"
              viewAllHref={`${detailPath}?tab=speakers`}
            />
          </div>
        </div>
      )}

      {tab === 'registration' && registrationsResult && (
        <div className="space-y-4">
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

      {tab === 'agenda' && (
        <Panel title="Agenda" contentClassName="p-0">
          {sessions.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No agenda yet" description="Add agenda items to plan the session." /></div>
          ) : (
            <ol className="divide-y divide-slate-50">
              {sessions.map(session => (
                <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-900">{session.title}</span>
                  <StatusBadge status={session.status} dot={session.status === 'live'} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      {tab === 'speakers' && (
        <PeoplePanel
          people={speakers.map(s => ({ id: s.id, full_name: s.full_name, job_title: s.job_title, avatar_url: s.avatar_url, speaker_role: s.speaker_role }))}
          title="Speakers & Hosts"
          viewAllHref={detailPath}
        />
      )}

      {tab === 'questions' && (
        <Panel title="Questions" contentClassName="p-0">
          {questions.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No questions yet" description="Audience questions will appear here during the webinar." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {questions.map(q => (
                <li key={q.id as string} className="flex items-start gap-2.5 px-4 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><HelpCircle size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-900">{(q.asked_by_name as string) ?? 'Attendee'}</span>
                    <span className="mt-0.5 block text-[12px] text-slate-600">{q.question as string}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatRelative(q.created_at as string)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <p className="mt-6">
        <Link href={`${page.basePath}/webinars`} className="text-[12.5px] font-semibold text-blue-600 hover:text-blue-700">← Back to webinars</Link>
      </p>
    </EventsShell>
  )
}
