import Link from 'next/link'
import { CalendarDays, CheckCircle2, DollarSign, Headphones, Mic, Play, TrendingUp } from 'lucide-react'
import EventsShell, { Avatar } from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import { EventsFilterBar, Pagination, RangePicker, ViewSwitcher } from '@/components/events/FilterBar'
import { ExportButton, MoreActionsButton } from '@/components/events/HeaderActions'
import { CreatePodcastEpisodeButton } from '@/components/events/CreateModals'
import { ChartLegend, ListenerTrendChart } from '@/components/events/charts'
import { ActivityPanel, RunOfShowPanel } from '@/components/events/records'
import {
  EventsEmptyState, EventsPageHeader, KpiCard, KpiStrip, Panel, PanelLink, StatusBadge,
} from '@/components/events/primitives'
import { getEventsPageContext, parseEventsFilters } from '@/lib/events/page-context'
import {
  getEventActivity, getGalaDockState, getListenerTrend, getPodcastKpis,
  getRunOfShow, getTopEpisodes, listPodcastEpisodes, listPodcastShows,
} from '@/lib/events/queries'
import { formatEventDate, formatEventTime, formatNumber, formatRate, titleCase } from '@/lib/events/format'
import type { EventViewMode, PodcastEpisodeWithGuests } from '@/lib/events/types'

export const dynamic = 'force-dynamic'

const VIEWS: EventViewMode[] = ['cards', 'table', 'calendar', 'timeline']

export const metadata = {
  title: 'Podcasts · Caption Fox',
  description: 'Plan, record, publish, and analyse your podcast episodes.',
}

export default async function PodcastsPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'podcasts')

  const allowedViews = VIEWS.filter(view =>
    view === 'calendar' ? page.can('views.calendar')
      : view === 'timeline' ? page.can('views.timeline') : true)
  const filters = parseEventsFilters(query, allowedViews, 'cards')

  const { supabase, workspace } = page
  const [list, kpis, trend, topEpisodes, runOfShow, activity, shows, gala] = await Promise.all([
    listPodcastEpisodes(supabase, workspace.id, filters),
    getPodcastKpis(supabase, workspace.id, filters.range),
    getListenerTrend(supabase, workspace.id, filters.range),
    getTopEpisodes(supabase, workspace.id, 5),
    getRunOfShow(supabase, workspace.id, undefined, 6, ['podcast']),
    getEventActivity(supabase, workspace.id, 5, ['podcast_episode', 'podcast_show', 'sponsorship', 'speaker']),
    listPodcastShows(supabase, workspace.id),
    getGalaDockState(supabase, workspace.id, page.userId),
  ])

  const listens = trend.reduce((sum, point) => sum + Number(point.listens ?? 0), 0)
  const unique = trend.reduce((sum, point) => sum + Number(point.unique ?? 0), 0)
  const episodeHref = (episode: { id: string }) => `${page.basePath}/podcasts/${episode.id}`

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
      searchPlaceholder="Search episodes, guests, shows..."
    >
      <EventsPageHeader
        title="Podcasts"
        subtitle="Plan, record, publish, and analyse your podcast episodes."
        actions={
          <>
            <ExportButton
              routeSegment={workspaceType}
              resource="podcasts"
              disabledReason={page.can('events.export') ? null : 'Your role cannot export podcast data'}
            />
            <CreatePodcastEpisodeButton
              routeSegment={workspaceType}
              shows={shows.map(s => ({ id: s.id, name: s.name }))}
              disabledReason={page.can('podcasts.manage') ? null : 'Your role cannot create episodes'}
            />
            <MoreActionsButton
              items={[
                { label: 'Connect a distribution provider', href: `${page.workspaceRoot}/integrations` },
                { label: 'Episode calendar', href: `${page.basePath}/podcasts?view=calendar` },
              ]}
            />
          </>
        }
      />

      <KpiStrip>
        <KpiCard label="Planned Episodes" tone="blue" icon={<CalendarDays size={17} />}
          value={formatNumber(kpis.plannedEpisodes.value)} comparison="Draft, planned or scheduled" />
        <KpiCard label="Live Recordings" tone="violet" icon={<Mic size={17} />}
          value={formatNumber(kpis.liveRecordings.value)} comparison="Recording now" />
        <KpiCard label="Downloads / Listeners" tone="indigo" icon={<Headphones size={17} />}
          value={formatNumber(kpis.listeners.value)} kpi={kpis.listeners}
          comparison={`vs last ${filters.range} days`} />
        <KpiCard label="Completion Rate" tone="emerald" icon={<TrendingUp size={17} />}
          value={formatRate(kpis.completionRate.value)}
          comparison={kpis.completionRate.value === null ? 'Needs provider metrics' : 'Average across episodes'} />
        <KpiCard label="Sponsor Slots" tone="amber" icon={<DollarSign size={17} />}
          value={formatNumber(kpis.sponsorSlots.value)}
          href={page.visibleTabs.includes('sponsorships') ? `${page.basePath}/sponsorships` : undefined}
          comparison="Podcast read deliverables" />
        <KpiCard label="Follow-up Items" tone="rose" icon={<CheckCircle2 size={17} />}
          value={formatNumber(kpis.followUpItems.value)}
          href={page.visibleTabs.includes('follow-up') ? `${page.basePath}/follow-up` : undefined}
          comparison="Open tasks" />
      </KpiStrip>

      <GalaDockPromotion
        placement="podcasts-banner"
        routeSegment={workspaceType}
        connectionState={gala.connectionState}
        workspaceUrl={gala.workspaceUrl}
        syncError={gala.syncError}
        dismissed={gala.dismissedPlacements.includes('podcasts-banner')}
        title="Manage your podcast productions on Gala Dock"
        body="Streamline venues, recording logistics, sponsors and distribution in one powerful platform."
        className="mb-5"
      />

      <div className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-[280px] flex-1">
            <EventsFilterBar
              searchPlaceholder="Search episodes..."
              dateRangeLabel="Date Range"
              filters={[
                {
                  key: 'status', label: 'Status', allLabel: 'All Statuses',
                  options: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'planned', label: 'Planned' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'recording', label: 'Recording' },
                    { value: 'recorded', label: 'Recorded' },
                    { value: 'editing', label: 'Editing' },
                    { value: 'published', label: 'Published' },
                  ],
                },
                {
                  key: 'type', label: 'Recording Type',
                  options: [
                    { value: 'in_studio', label: 'In-studio' },
                    { value: 'remote', label: 'Remote' },
                    { value: 'live', label: 'Live' },
                    { value: 'field', label: 'Field' },
                  ],
                },
                {
                  key: 'distribution', label: 'Distribution',
                  options: [
                    { value: 'not_distributed', label: 'Not distributed' },
                    { value: 'queued', label: 'Queued' },
                    { value: 'published', label: 'Published' },
                    { value: 'failed', label: 'Failed' },
                  ],
                },
              ]}
            />
          </div>
          <ViewSwitcher views={allowedViews} active={filters.view} />
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
        <Panel title="Listener Trends" action={<RangePicker value={filters.range} />}>
          <dl className="mb-2 grid grid-cols-2 gap-3">
            <div>
              <dd className="text-[19px] font-bold text-slate-900">{formatNumber(listens)}</dd>
              <dt className="text-[11.5px] text-slate-500">Listens</dt>
            </div>
            <div>
              <dd className="text-[19px] font-bold text-slate-900">{formatNumber(unique)}</dd>
              <dt className="text-[11.5px] text-slate-500">Unique Listeners</dt>
            </div>
          </dl>
          <ChartLegend items={[
            { label: 'Listens', colour: '#2563eb' },
            { label: 'Unique listeners', colour: '#7c3aed' },
          ]} />
          <div className="mt-2"><ListenerTrendChart data={trend} height={175} /></div>
        </Panel>

        <Panel
          title="Top Episodes by Listens"
          action={<PanelLink href={`${page.basePath}/podcasts?sort=listens`}>View All</PanelLink>}
          contentClassName="p-0"
        >
          {topEpisodes.length === 0 ? (
            <div className="p-4">
              <EventsEmptyState
                title="No listen data yet"
                description="Listen counts appear once a distribution provider reports them, or once you record them manually."
              />
            </div>
          ) : (
            <ol className="divide-y divide-slate-50">
              {topEpisodes.map((episode, index) => (
                <li key={episode.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-3 shrink-0 text-[12px] font-bold text-slate-400">{index + 1}</span>
                  <EpisodeThumb episode={episode} size={34} />
                  <span className="min-w-0 flex-1">
                    <Link href={episodeHref(episode)} className="block truncate text-[12.5px] font-semibold text-slate-900 hover:text-blue-700">
                      {episode.title}
                    </Link>
                    <span className="block text-[11px] text-slate-500">
                      {formatEventDate(episode.published_at ?? episode.scheduled_at, workspace.timezone)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-700">
                    {formatNumber(episode.listens)}
                  </span>
                  <Link
                    href={episodeHref(episode)}
                    className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Open ${episode.title}`}
                  >
                    <Play size={13} />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <RunOfShowPanel
          sessions={runOfShow.sessions}
          title="Run of Show"
          subtitle={runOfShow.event?.name}
          viewAllHref={runOfShow.event ? `${page.basePath}/podcasts/${runOfShow.event.id}` : `${page.basePath}/podcasts`}
          timezone={workspace.timezone}
          relativeOffsets
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.62fr_1fr]">
        <Panel
          title="Episodes"
          action={<PanelLink href={`${page.basePath}/podcasts?view=table`}>View all episodes →</PanelLink>}
          contentClassName={filters.view === 'cards' ? 'p-4' : 'p-0'}
        >
          {list.total === 0 ? (
            <EventsEmptyState
              title={filters.q ? `No episodes match “${filters.q}”` : 'No episodes yet'}
              description={
                filters.q
                  ? 'Try a different search term or clear the filters.'
                  : shows.length === 0
                    ? 'Create your first episode — a show is created alongside it so distribution and listener metrics have somewhere to land.'
                    : 'Create an episode to plan the run sheet, guests, sponsors and distribution.'
              }
              icon={<Mic size={26} />}
            />
          ) : filters.view === 'cards' ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {list.episodes.slice(0, 4).map(episode => (
                <EpisodeCard
                  key={episode.id}
                  episode={episode}
                  href={episodeHref(episode)}
                  timezone={workspace.timezone}
                />
              ))}
            </div>
          ) : (
            <>
              <EpisodeTable episodes={list.episodes} hrefFor={episodeHref} timezone={workspace.timezone} />
              <Pagination page={list.page} pageSize={list.pageSize} total={list.total} />
            </>
          )}
        </Panel>

        <ActivityPanel
          activity={activity}
          title="Guest & Episode Activity"
          viewAllHref={`${page.basePath}/podcasts`}
        />
      </div>
    </EventsShell>
  )
}

function EpisodeThumb({ episode, size = 44 }: { episode: PodcastEpisodeWithGuests; size?: number }) {
  if (episode.cover_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={episode.cover_image_url}
        alt=""
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-900 to-slate-700 text-indigo-200"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Mic size={Math.round(size * 0.4)} />
    </span>
  )
}

function EpisodeCard({
  episode, href, timezone,
}: { episode: PodcastEpisodeWithGuests; href: string; timezone: string }) {
  const guest = episode.guests[0]
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-[16/10] w-full">
        {episode.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={episode.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b1150] to-[#2b1b6b] px-3 text-center">
            <span className="text-[13px] font-black uppercase leading-tight tracking-wide text-white/90">
              {episode.showName ?? episode.title}
            </span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5">
          <StatusBadge status={episode.status} dot={episode.status === 'recording'} className="shadow-sm" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-[13px] font-semibold leading-snug text-slate-900">
          <Link href={href} className="hover:text-blue-700">
            {episode.episode_number ? <span className="text-slate-400">#{episode.episode_number} </span> : null}
            {episode.title}
          </Link>
        </h3>

        {guest && (
          <p className="mt-2 flex items-center gap-2">
            <Avatar name={guest.full_name} src={guest.avatar_url} size={26} />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-slate-800">{guest.full_name}</span>
              {(guest.job_title || guest.company) && (
                <span className="block truncate text-[10.5px] text-slate-500">
                  {[guest.job_title, guest.company].filter(Boolean).join(', ')}
                </span>
              )}
            </span>
          </p>
        )}

        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={11} aria-hidden />
            {formatEventDate(episode.scheduled_at ?? episode.published_at, timezone)}
          </span>
          <span>{titleCase(episode.recording_type)}</span>
          {episode.studio_location && <span>{episode.studio_location}</span>}
          {episode.scheduled_at && <span>{formatEventTime(episode.scheduled_at, timezone)}</span>}
        </p>

        <p className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600">
            <StatusBadge status={episode.distribution_state === 'published' ? 'published' : 'draft'}
              label={titleCase(episode.distribution_state)} />
          </span>
          {episode.listens > 0 && (
            <span className="text-right">
              <span className="block text-[13px] font-bold text-slate-900">{formatNumber(episode.listens)}</span>
              <span className="block text-[10px] text-slate-500">Listens</span>
            </span>
          )}
        </p>
      </div>
    </article>
  )
}

function EpisodeTable({
  episodes, hrefFor, timezone,
}: {
  episodes: PodcastEpisodeWithGuests[]
  hrefFor: (episode: { id: string }) => string
  timezone: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">Podcast episodes</caption>
        <thead>
          <tr className="border-b border-slate-100 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3">Episode</th>
            <th scope="col" className="px-3 py-3">Show</th>
            <th scope="col" className="px-3 py-3">Status</th>
            <th scope="col" className="px-3 py-3">Recording</th>
            <th scope="col" className="px-3 py-3">Date</th>
            <th scope="col" className="px-3 py-3">Distribution</th>
            <th scope="col" className="px-3 py-3 text-right">Listens</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {episodes.map(episode => (
            <tr key={episode.id} className="text-[13px] text-slate-700 hover:bg-slate-50/70">
              <th scope="row" className="px-4 py-3 text-left font-medium">
                <Link href={hrefFor(episode)} className="font-semibold text-slate-900 hover:text-blue-700">
                  {episode.episode_number ? `#${episode.episode_number} ` : ''}{episode.title}
                </Link>
              </th>
              <td className="px-3 py-3">{episode.showName ?? '—'}</td>
              <td className="px-3 py-3"><StatusBadge status={episode.status} /></td>
              <td className="px-3 py-3">{titleCase(episode.recording_type)}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatEventDate(episode.scheduled_at ?? episode.published_at, timezone)}
              </td>
              <td className="px-3 py-3">{titleCase(episode.distribution_state)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatNumber(episode.listens)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
