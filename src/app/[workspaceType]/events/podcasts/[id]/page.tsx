import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Headphones, Mic, TrendingUp } from 'lucide-react'
import EventsShell, { Avatar } from '@/components/events/EventsShell'
import { DetailBreadcrumb, DetailHeaderBar, DetailTabStrip } from '@/components/events/DetailHeader'
import { EventsEmptyState, KpiCard, KpiStrip, Panel, StatusBadge } from '@/components/events/primitives'
import { getEventsPageContext } from '@/lib/events/page-context'
import { getEventSessions, getPodcastEpisodeDetail } from '@/lib/events/detail-queries'
import { formatEventDate, formatNumber, formatRate, titleCase } from '@/lib/events/format'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'run-of-show', label: 'Run of Show' },
  { id: 'guests', label: 'Guests' },
  { id: 'notes', label: 'Show Notes' },
]

export default async function PodcastEpisodeDetailPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, id } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'podcasts')
  const { supabase, workspace } = page

  const episode = await getPodcastEpisodeDetail(supabase, workspace.id, id)
  if (!episode) notFound()

  const activeTab = (Array.isArray(query.tab) ? query.tab[0] : query.tab) || 'overview'
  const tab = TABS.some(t => t.id === activeTab) ? activeTab : 'overview'
  const detailPath = `${page.basePath}/podcasts/${id}`

  const sessions = episode.event_id ? await getEventSessions(supabase, workspace.id, episode.event_id) : []

  return (
    <EventsShell
      basePath={page.basePath}
      activeTab="podcasts"
      visibleTabs={page.visibleTabs}
      workspaces={page.workspaces}
      activeWorkspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}
      user={page.user}
      notificationCount={page.notificationCount}
      planUsage={page.planUsage}
    >
      <DetailBreadcrumb parentLabel="Podcasts" parentHref={`${page.basePath}/podcasts`} recordName={episode.title} />

      <DetailHeaderBar
        title={episode.episode_number ? `#${episode.episode_number} ${episode.title}` : episode.title}
        status={episode.status}
        subtitle={[episode.showName, titleCase(episode.recording_type), formatEventDate(episode.scheduled_at ?? episode.published_at, workspace.timezone)].filter(Boolean).join(' · ')}
        cover={
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#1b1150] to-[#2b1b6b] text-indigo-200">
            {episode.cover_image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={episode.cover_image_url} alt="" className="h-full w-full object-cover" />
              : <Mic size={24} />}
          </span>
        }
        actions={
          episode.distribution_url ? (
            <a href={episode.distribution_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700">
              Listen
            </a>
          ) : undefined
        }
      />

      <DetailTabStrip tabs={TABS} active={tab} basePath={detailPath} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <KpiStrip>
            <KpiCard label="Listens" tone="blue" icon={<Headphones size={15} />} value={formatNumber(episode.listens)} comparison="Total" />
            <KpiCard label="Unique Listeners" tone="violet" icon={<Headphones size={15} />} value={formatNumber(episode.unique_listeners)} comparison="Total" />
            <KpiCard label="Completion Rate" tone="emerald" icon={<TrendingUp size={15} />} value={formatRate(episode.completion_rate)} comparison="Average" />
            <KpiCard label="Distribution" tone="amber" icon={<Mic size={15} />} value={titleCase(episode.distribution_state)} comparison="Current state" />
          </KpiStrip>
          <Panel title="Summary">
            {episode.summary ? (
              <p className="text-[13.5px] leading-relaxed text-slate-700">{episode.summary}</p>
            ) : (
              <p className="text-[13px] text-slate-400">No summary added yet.</p>
            )}
          </Panel>
          {episode.guests.length > 0 && (
            <Panel title="Guests" contentClassName="p-0">
              <ul className="divide-y divide-slate-50">
                {episode.guests.map(guest => (
                  <li key={guest.id} className="flex items-center gap-2.5 px-4 py-3">
                    <Avatar name={guest.full_name} src={guest.avatar_url} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">{guest.full_name}</span>
                      {(guest.job_title || guest.company) && (
                        <span className="block truncate text-[11px] text-slate-500">{[guest.job_title, guest.company].filter(Boolean).join(', ')}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {tab === 'run-of-show' && (
        <Panel title="Run of Show" contentClassName="p-0">
          {sessions.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No run sheet yet" description="Add segments to build the episode run sheet." /></div>
          ) : (
            <ol className="divide-y divide-slate-50">
              {sessions.map(session => (
                <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 text-[11.5px] font-medium tabular-nums text-slate-500">
                    {session.offset_seconds !== null
                      ? `${String(Math.floor((session.offset_seconds ?? 0) / 60)).padStart(2, '0')}:${String((session.offset_seconds ?? 0) % 60).padStart(2, '0')}`
                      : '—'}
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-slate-900">{session.title}</span>
                  <StatusBadge status={session.status} dot={session.status === 'live'} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      {tab === 'guests' && (
        <Panel title="Guests" contentClassName="p-0">
          {episode.guests.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No guests added" description="Add guests to this episode to track confirmation status." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {episode.guests.map(guest => (
                <li key={guest.id} className="flex items-center gap-2.5 px-4 py-3">
                  <Avatar name={guest.full_name} src={guest.avatar_url} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-slate-900">{guest.full_name}</span>
                    {(guest.job_title || guest.company) && (
                      <span className="block truncate text-[11px] text-slate-500">{[guest.job_title, guest.company].filter(Boolean).join(', ')}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'notes' && (
        <Panel title="Show Notes">
          {episode.show_notes ? (
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700">{episode.show_notes}</p>
          ) : (
            <EventsEmptyState title="No show notes yet" description="Show notes appear here once added, ready to publish alongside the episode." />
          )}
        </Panel>
      )}

      <p className="mt-6">
        <Link href={`${page.basePath}/podcasts`} className="text-[12.5px] font-semibold text-blue-600 hover:text-blue-700">← Back to podcasts</Link>
      </p>
    </EventsShell>
  )
}
