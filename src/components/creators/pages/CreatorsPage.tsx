import Link from 'next/link'
import { Bookmark, ChevronRight } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  activeBriefCounts, activeCollaborations, activityVisuals, availabilitySummary, creatorAggregates, listCreatorLists,
  listCreators, listSavedViews, paymentAggregates, recentActivity, shortlistedCreators, submissionAggregates,
} from '@/lib/creators/data'
import { parseCreatorsQuery } from '@/lib/creators/query'
import {
  AUDIENCE_BANDS, AVAILABILITY_LABELS, AVAILABILITY_VALUES, CHANNEL_LABELS, CREATOR_CHANNELS, CREATOR_NICHES,
  CREATOR_REGIONS, CREATOR_SORTS, NICHE_LABELS, RELATIONSHIP_LABELS, RELATIONSHIP_STATUSES, RIGHTS_READINESS,
  RIGHTS_READINESS_LABELS,
} from '@/lib/creators/constants'
import { deltaLabel } from '@/lib/creators/rules'
import { delta } from '@/lib/creators/data'
import { cn } from '@/lib/utils'
import CreatorsTable from '../CreatorsTable'
import CreateListButton from '../CreateListButton'
import InviteCreatorButton from '../InviteCreatorButton'
import {
  ExportMenu, Pager, SaveViewButton, SavedViewsMenu, SearchBox, SelectControl, SettingsMenu, ViewToggle,
} from '../controls'
import {
  Avatar, BUTTON_PRIMARY, CARD, Kpi, KpiGrid, Panel, PanelEmpty, Sparkline, Thumb,
} from '../design'
import { formatAgo, formatCompact, formatMoneyShort } from '../primitives'
import { CreatorsFrame, kpiDelta, link, type RawSearchParams } from './shared'

export default async function CreatorsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const { access, ...session } = await requireCreatorModule('creators')
  const { supabase, ctx, capabilities, modules, basePath, userId } = session
  const query = parseCreatorsQuery(searchParams)
  if (!access.allowed) return <CreatorsFrame session={session} module="creators" access={access}>{null}</CreatorsFrame>

  const showSpend = modules.includes('payments') && capabilities.viewPayments
  const [page, aggregates, collaborations, lists, shortlist, availability, activity, views, submissions, payments] = await Promise.all([
    listCreators(supabase, ctx.workspaceId, query),
    creatorAggregates(supabase, ctx.workspaceId),
    activeCollaborations(supabase, ctx.workspaceId),
    listCreatorLists(supabase, ctx.workspaceId),
    shortlistedCreators(supabase, ctx.workspaceId, 4),
    availabilitySummary(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, 4, { surface: 'creators' }),
    listSavedViews(supabase, ctx.workspaceId, 'creators'),
    submissionAggregates(supabase, ctx.workspaceId),
    showSpend ? paymentAggregates(supabase, ctx.workspaceId) : Promise.resolve(null),
  ])
  const [briefCounts, visuals] = await Promise.all([
    activeBriefCounts(supabase, ctx.workspaceId, page.rows.map(r => r.id)),
    activityVisuals(supabase, ctx.workspaceId, activity),
  ])

  const approvedDeliverables = submissions.byStatus.approved + submissions.byStatus.published
  const costPerDeliverable = payments && approvedDeliverables > 0 ? payments.totalSpend / approvedDeliverables : aggregates.avgRate
  const availabilityDelta = delta(availability.available, availability.previousAvailable)

  const kpis: Kpi[] = [
    { id: 'total', label: 'Total Creators', value: aggregates.total.toLocaleString('en-GB'), tone: 'blue', icon: 'users', spark: aggregates.createdSeries, href: `${basePath}/creators`, ...kpiDelta(aggregates.total, aggregates.previousTotal) },
    { id: 'collab', label: 'Active Collaborations', value: collaborations.current.toLocaleString('en-GB'), tone: 'blue', icon: 'file', spark: aggregates.createdSeries, href: `${basePath}/briefs?status=in_progress`, ...kpiDelta(collaborations.current, collaborations.previous) },
    { id: 'shortlisted', label: 'Shortlisted', value: aggregates.shortlisted.toLocaleString('en-GB'), tone: 'orange', icon: 'badge', spark: aggregates.createdSeries, href: `${basePath}/creators?shortlist=1`, ...kpiDelta(aggregates.shortlisted, aggregates.previousShortlisted) },
    { id: 'engagement', label: 'Avg. Engagement Rate', value: `${aggregates.avgEngagement.toFixed(2)}%`, tone: 'green', icon: 'shield', spark: submissions.submittedSeries, delta: `Across ${aggregates.total} creators`, trend: 'flat', href: `${basePath}/creators?sort=engagement_desc` },
    { id: 'cost', label: 'Avg. Cost per Deliverable', value: formatMoneyShort(costPerDeliverable), tone: 'violet', icon: 'money', spark: payments?.spendSeries.map(p => Number(p.paid)) ?? aggregates.createdSeries, delta: payments ? `Paid spend ÷ ${approvedDeliverables} approved` : 'Average rate card', trend: 'flat', tooltip: 'Paid creator spend divided by approved deliverables. Falls back to the average rate card when payment values are not visible to your role.' },
    { id: 'rights', label: 'Rights-Ready Creators', value: aggregates.rightsReady.toLocaleString('en-GB'), tone: 'blue', icon: 'target', spark: aggregates.createdSeries, href: `${basePath}/creators?rights=full`, ...kpiDelta(aggregates.rightsReady, aggregates.previousRightsReady) },
  ]

  const creators = page.rows.map(row => ({ ...row, active_briefs: briefCounts[row.id] ?? 0 }))
  const hasFilters = Boolean(query.q || query.niche || query.audience || query.platform || query.region || query.availability || query.status || query.rights || query.list || query.shortlist)
  const activeList = query.list ? lists.find(l => l.id === query.list) : null
  const fitMax = Math.max(100, ...availability.campaigns.map(c => c.fit))

  return (
    <CreatorsFrame
      session={session} module="creators" access={access}
      actions={(
        <>
          {capabilities.invite && <InviteCreatorButton className={BUTTON_PRIMARY} />}
          {capabilities.manageLists && <CreateListButton />}
          <ExportMenu entity="creators" allowed={capabilities.export} />
        </>
      )}
    >
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-[13px] xl:grid-cols-[910fr_238fr]">
        <section className={cn(CARD, 'min-w-0')} aria-label="Creator directory">
          <div className="border-b border-[#eef0f4] px-[10px] py-[8px]">
            <SearchBox placeholder="Search creators by name, handle, or keyword..." big />
          </div>
          <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 px-[10px] pb-[14px] pt-[12px] sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto] lg:items-end">
            <SelectControl labelled spec={{ key: 'niche', label: 'Niche', all: 'All Niches', options: CREATOR_NICHES.map(n => ({ value: n, label: NICHE_LABELS[n] })) }} />
            <SelectControl labelled spec={{ key: 'audience', label: 'Audience Size', all: 'All Sizes', options: AUDIENCE_BANDS.map(b => ({ value: b.id, label: b.label })) }} />
            <SelectControl labelled spec={{ key: 'platform', label: 'Platform', all: 'All Platforms', options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) }} />
            <SelectControl labelled spec={{ key: 'region', label: 'Region', all: 'All Regions', options: CREATOR_REGIONS.map(r => ({ value: r, label: r })) }} />
            <SelectControl labelled spec={{ key: 'availability', label: 'Availability', all: 'All Availability', options: AVAILABILITY_VALUES.map(a => ({ value: a, label: AVAILABILITY_LABELS[a] })) }} />
            <SelectControl labelled spec={{ key: 'status', label: 'Status', all: 'All Statuses', options: RELATIONSHIP_STATUSES.map(s => ({ value: s, label: RELATIONSHIP_LABELS[s] })) }} />
            <MoreFiltersSlot lists={lists} />
          </div>

          <div className="flex flex-wrap items-center gap-[14px] border-t border-[#eef0f4] px-[10px] py-[13px]">
            <SavedViewsMenu surface="creators" width={140} views={views.map(v => ({ id: v.id, name: v.name, query: v.query, is_shared: v.is_shared, mine: v.owner_id === userId }))} />
            <SaveViewButton surface="creators" />
            {activeList && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eef4ff] px-2 py-1 text-[10.5px] font-medium text-[#1d4ed8]">
                <Bookmark size={12} aria-hidden />List: {activeList.name} ({activeList.member_count})
              </span>
            )}
            <div className="ml-auto flex items-center gap-[10px]">
              <ViewToggle active={query.view} views={[{ id: 'cards', label: 'Card View', icon: 'cards' }, { id: 'table', label: 'Table View', icon: 'table' }]} />
              <SettingsMenu defaultSort="recent" sorts={CREATOR_SORTS.map(s => ({ value: s.id, label: s.label }))} />
            </div>
          </div>

          <div className="border-t border-[#eef0f4]">
            {page.error ? (
              <PanelEmpty className="text-red-600">We could not load creators ({page.error}). Refresh to retry; reference CF-CREATORS.</PanelEmpty>
            ) : creators.length === 0 ? (
              <PanelEmpty className="min-h-[260px]">
                {hasFilters ? 'No creators match these filters. Clear a filter or broaden your search.' : 'No creators yet. Invite a creator or add one from the Marketplace to start your roster.'}
              </PanelEmpty>
            ) : (
              <CreatorsTable
                creators={creators} lists={lists} basePath={basePath} view={query.view}
                canManage={capabilities.manageCreators} canManageLists={capabilities.manageLists} canExport={capabilities.export}
              />
            )}
          </div>
          <Pager className="border-t border-[#eef0f4] px-[14px] py-[14px]" page={query.page} size={query.size} total={page.total} noun="creators" />
        </section>

        <aside className="flex min-w-0 flex-col gap-[13px]" aria-label="Creator insights">
          <Panel titleClassName="text-[12px]" title={`Featured / Shortlist (${aggregates.shortlisted})`} href={`${basePath}/creators?shortlist=1`}>
            {shortlist.length === 0 ? <PanelEmpty>No shortlisted creators yet. Use the star or bulk actions to shortlist.</PanelEmpty> : (
              <ul className="space-y-[10px] pt-[4px]">
                {shortlist.map(creator => (
                  <li key={creator.id}>
                    <Link href={`${basePath}/creators/${creator.id}`} className="flex items-center gap-[9px] rounded-md hover:bg-[#fafbfd]">
                      <Avatar name={creator.name} src={creator.avatar_url} size={30} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[10.5px] font-medium text-[#101828]">{creator.name}</span>
                        <span className="block truncate text-[9px] text-[#8a94a6]">@{creator.handle}</span>
                      </span>
                      <span className="text-[10.5px] tabular-nums text-[#344054]">{formatCompact(creator.audience_size)}</span>
                      <Bookmark size={14} className="ml-2 fill-[#1d6bf3] text-[#1d6bf3]" aria-label="Shortlisted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`${basePath}/creators?shortlist=1`} className="mt-[14px] flex h-[28px] items-center justify-center rounded-md border border-[#e4e7ec] text-[10px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]">View Shortlist</Link>
          </Panel>

          <Panel titleClassName="text-[12px]" title="Availability & Campaign Fit" href={`${basePath}/creators?availability=available`}>
            <div className="rounded-[9px] border border-[#eef0f4] p-[10px]">
              <p className="text-[9px] text-[#667085]">Creators available for your campaigns</p>
              <div className="flex items-end gap-2">
                <div>
                  <p className="mt-[3px] text-[18px] font-semibold text-[#101828]">{availability.available}</p>
                  <p className="text-[9px] text-[#16a34a]">↗ {deltaLabel(availabilityDelta.pct, 'vs last 7 days')}</p>
                </div>
                <Sparkline values={availability.series} colour="#22c55e" className="h-[30px] flex-1" />
              </div>
            </div>
            <p className="mb-[8px] mt-[12px] text-[9.5px] font-semibold text-[#101828]">Top campaign fit</p>
            {availability.campaigns.length === 0 ? <p className="text-[10px] text-[#98a2b3]">Assign creators to campaign briefs to see fit scores.</p> : (
              <ul className="space-y-[8px]">
                {availability.campaigns.map(campaign => (
                  <li key={campaign.id} className="flex items-center gap-2 text-[9.5px] text-[#344054]" title="Average stored fit score of creators assigned to this campaign's briefs">
                    <span className="min-w-0 flex-1 truncate">{campaign.name}</span>
                    <span className="block h-[5px] w-[62px] overflow-hidden rounded-full bg-[#edf0f5]">
                      <span className="block h-full rounded-full bg-[#22c55e]" style={{ width: `${(campaign.fit / fitMax) * 100}%` }} />
                    </span>
                    <span className="w-7 text-right tabular-nums">{campaign.fit}%</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`${basePath}/creators?availability=available&sort=fit_desc`} className="mt-[14px] flex h-[28px] items-center justify-center rounded-md border border-[#e4e7ec] text-[10px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]">Browse Matching Creators</Link>
          </Panel>

          <Panel titleClassName="text-[12px]" title="Recent Creator Activity" href={`${basePath}/creators?sort=recent`} className="flex-1">
            {activity.length === 0 ? <PanelEmpty>Invitations, shortlists and rate card updates appear here.</PanelEmpty> : (
              <ul className="space-y-[12px]">
                {activity.map(item => {
                  const href = link(session, item.link)
                  const body = (
                    <span className="flex items-start gap-[9px]">
                      {visuals[item.id]?.avatarUrl || visuals[item.id]?.thumbnailUrl
                        ? <Thumb src={visuals[item.id]?.avatarUrl ?? visuals[item.id]?.thumbnailUrl} alt="" className="h-[26px] w-[26px] shrink-0 rounded-full" />
                        : <Avatar name={item.actor?.full_name} src={item.actor?.avatar_url} size={26} />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9.5px] leading-[13px] text-[#101828]">{item.summary}</span>
                        <span className="block text-[8.5px] text-[#98a2b3]">{formatAgo(item.created_at)}</span>
                      </span>
                      {href && <ChevronRight size={13} className="mt-1 text-[#98a2b3]" aria-hidden />}
                    </span>
                  )
                  return <li key={item.id}>{href ? <Link href={href} className="block rounded-md hover:bg-[#fafbfd]">{body}</Link> : body}</li>
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </CreatorsFrame>
  )
}

/** The "More Filters" control: rights readiness and list, in the same slot as the reference. */
function MoreFiltersSlot({ lists }: { lists: { id: string; name: string }[] }) {
  return (
    <div className="flex items-end">
      <details className="group relative">
        <summary className="flex h-[34px] cursor-pointer list-none items-center rounded-lg border border-[#dfe3ea] bg-white px-[12px] text-[11px] font-medium text-[#344054] hover:border-[#cbd2dd]">
          More Filters
        </summary>
        <div className="absolute right-0 top-full z-40 mt-1 w-64 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <SelectControl labelled spec={{ key: 'rights', label: 'Rights readiness', all: 'Any rights', options: RIGHTS_READINESS.map(r => ({ value: r, label: RIGHTS_READINESS_LABELS[r] })) }} />
          <SelectControl labelled spec={{ key: 'list', label: 'Creator list', all: 'All creators', options: lists.map(l => ({ value: l.id, label: l.name })) }} />
          <SelectControl labelled spec={{ key: 'shortlist', label: 'Shortlist', all: 'Everyone', options: [{ value: '1', label: 'Shortlisted only' }] }} />
        </div>
      </details>
    </div>
  )
}
