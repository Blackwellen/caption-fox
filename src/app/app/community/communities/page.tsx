import Link from 'next/link'
import { BarChart3, Eye, MoreHorizontal, Plus } from 'lucide-react'
import { requireCommunityModule } from '@/lib/community/server'
import {
  communityAggregates, delta, eventAggregates, listCommunities,
  recentActivity, workspaceMembers,
} from '@/lib/community/data'
import { parseCommunitiesQuery, hasAnyFilter, type RawParams } from '@/lib/community/query'
import {
  COMMUNITY_REGIONS, COMMUNITY_STATUSES, COMMUNITY_STATUS_BADGE, COMMUNITY_STATUS_LABELS,
  COMMUNITY_TYPES, COMMUNITY_TYPE_LABELS, COMMUNITY_PRIVACY, COMMUNITY_PRIVACY_BADGE,
  COMMUNITY_PRIVACY_LABELS, COMMUNITY_SORTS,
} from '@/lib/community/constants'
import CommunityHeader from '@/components/community/CommunityHeader'
import KpiStrip from '@/components/community/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/community/FilterBar'
import Pagination from '@/components/community/Pagination'
import ActivityFeed from '@/components/community/ActivityFeed'
import { TrendChart, DonutChart, DonutLegend, seriesToPoints } from '@/components/community/charts'
import { AccessBlocked, CommunityEmpty, LoadError } from '@/components/community/states'
import {
  Avatar, CARD, CARD_SHADOW, COMMUNITY_PAGE, Panel, ProgressBar,
  formatNumber, formatPercent, formatShortDate,
} from '@/components/community/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/community/types'

export const metadata = { title: 'Communities · Caption Fox' }

export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCommunityModule('communities')

  if (!access.allowed) {
    return (
      <div className={COMMUNITY_PAGE}>
        <CommunityHeader module="communities" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCommunitiesQuery(params)
  const workspaceId = ctx.workspaceId

  const [aggregates, page, activity, members, eventAgg] = await Promise.all([
    communityAggregates(supabase, workspaceId),
    listCommunities(supabase, workspaceId, query),
    recentActivity(supabase, workspaceId, 6, { entityType: 'community' }),
    workspaceMembers(supabase, workspaceId),
    eventAggregates(supabase, workspaceId),
  ])

  const activeDelta = delta(aggregates.active, aggregates.previousActive)
  const engagementDelta = delta(aggregates.avgEngagement, aggregates.previousAvgEngagement)

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total communities', value: formatNumber(aggregates.total), hint: 'Excludes archived', icon: 'users', tone: 'blue', spark: aggregates.createdSeries },
    { id: 'active', label: 'Active', value: formatNumber(aggregates.active), hint: `${activeDelta.pct >= 0 ? '+' : ''}${activeDelta.pct.toFixed(1)}% vs last 30 days`, trend: activeDelta.trend, icon: 'checks', tone: 'green' },
    { id: 'private', label: 'Private communities', value: formatNumber(aggregates.privateCount), hint: 'Invite-only or restricted', icon: 'shieldCheck', tone: 'slate' },
    { id: 'events', label: 'Upcoming events', value: formatNumber(eventAgg.scheduled), hint: 'See Calendar for detail', icon: 'calendar', tone: 'violet' },
    { id: 'flagged', label: 'Moderation flagged', value: formatNumber(aggregates.flaggedCount), hint: aggregates.flaggedCount > 0 ? 'Open reports' : 'All clear', icon: 'flag', tone: aggregates.flaggedCount > 0 ? 'amber' : 'slate' },
    { id: 'engagement', label: 'Avg engagement', value: formatPercent(aggregates.avgEngagement), hint: `${engagementDelta.pct >= 0 ? '+' : ''}${engagementDelta.pct.toFixed(1)}pp vs last 30 days`, trend: engagementDelta.trend, icon: 'trend', tone: 'blue' },
  ]

  const filters: FilterSpec[] = [
    { key: 'type', label: 'Type', allLabel: 'All types', options: COMMUNITY_TYPES.map(t => ({ value: t, label: COMMUNITY_TYPE_LABELS[t] })) },
    { key: 'owner', label: 'Owner', allLabel: 'All owners', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })) },
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: COMMUNITY_STATUSES.map(s => ({ value: s, label: COMMUNITY_STATUS_LABELS[s] })) },
    { key: 'region', label: 'Region', allLabel: 'All regions', options: COMMUNITY_REGIONS.map(r => ({ value: r, label: r })) },
    { key: 'privacy', label: 'Privacy', allLabel: 'All privacy', options: COMMUNITY_PRIVACY.map(p => ({ value: p, label: COMMUNITY_PRIVACY_LABELS[p] })), advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Recently updated', options: COMMUNITY_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const topPerforming = [...page.rows].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 5)

  return (
    <div className={COMMUNITY_PAGE}>
      <CommunityHeader
        module="communities" modules={modules}
        actions={(
          <>
            {capabilities.createCommunity && (
              <Link href="/app/community/communities?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                <Plus size={15} />New community
              </Link>
            )}
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search communities…"
              filters={filters}
              views={['cards', 'table']}
              activeView={query.view}
              values={query}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CommunityEmpty
                icon={filtered ? 'search' : 'community'}
                title={filtered ? 'No communities match these filters' : 'No communities yet'}
                message={filtered ? 'Try widening your filters or clearing the search term.' : 'Create your first community to start tracking membership and engagement.'}
                action={!filtered && capabilities.createCommunity && (
                  <Link href="/app/community/communities?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                    <Plus size={15} />New community
                  </Link>
                )}
              />
            ) : query.view === 'table' ? (
              <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Community</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 font-medium">Owner</th>
                        <th className="px-3 py-2.5 font-medium">Members</th>
                        <th className="px-3 py-2.5 font-medium">Engagement</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Updated</th>
                        <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {page.rows.map(community => (
                        <tr key={community.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <Avatar name={community.name} src={community.cover_image_url} size={28} />
                              <span className="min-w-0 truncate font-medium text-slate-900">{community.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{COMMUNITY_TYPE_LABELS[community.type as keyof typeof COMMUNITY_TYPE_LABELS] ?? community.type}</td>
                          <td className="px-3 py-2.5 text-slate-500">{community.owner?.full_name ?? community.owner?.email ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-700">{formatNumber(community.member_count)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={community.engagement_rate} className="w-16" />
                              <span className="text-slate-500">{formatPercent(community.engagement_rate)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={COMMUNITY_STATUS_BADGE[community.status as keyof typeof COMMUNITY_STATUS_BADGE] ?? 'slate'}>
                              {COMMUNITY_STATUS_LABELS[community.status as keyof typeof COMMUNITY_STATUS_LABELS] ?? community.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{formatShortDate(community.updated_at)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1">
                              <Link href={`/app/community/communities?q=${encodeURIComponent(community.name)}`} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View"><Eye size={14} /></Link>
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300" aria-hidden><MoreHorizontal size={14} /></span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={query.page} size={query.size} total={page.total} label="communities" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {page.rows.map(community => (
                  <div key={community.id} className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2.5 p-4`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={community.name} src={community.cover_image_url} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">{community.name}</p>
                          <p className="truncate text-[11px] text-slate-400">{COMMUNITY_TYPE_LABELS[community.type as keyof typeof COMMUNITY_TYPE_LABELS] ?? community.type}</p>
                        </div>
                      </div>
                      <Badge variant={COMMUNITY_PRIVACY_BADGE[community.privacy as keyof typeof COMMUNITY_PRIVACY_BADGE] ?? 'slate'}>
                        {COMMUNITY_PRIVACY_LABELS[community.privacy as keyof typeof COMMUNITY_PRIVACY_LABELS] ?? community.privacy}
                      </Badge>
                    </div>
                    <p className="text-[12.5px] text-slate-500">{formatNumber(community.member_count)} members</p>
                    <p className="text-[11px] capitalize text-emerald-600">{community.activity_level.replace('_', ' ')} activity · {formatPercent(community.engagement_rate)} engagement</p>
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Avatar name={community.owner?.full_name} src={community.owner?.avatar_url} size={16} />
                        {community.owner?.full_name ?? 'Unassigned'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Link href={`/app/community/communities?q=${encodeURIComponent(community.name)}`} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View"><Eye size={14} /></Link>
                        <Link href="/app/community" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Analytics"><BarChart3 size={14} /></Link>
                      </span>
                    </div>
                  </div>
                ))}
                <div className="sm:col-span-2 xl:col-span-4">
                  <div className={`${CARD} ${CARD_SHADOW}`}>
                    <Pagination page={query.page} size={query.size} total={page.total} label="communities" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Community growth" info="Total and active communities over the last 30 days.">
                <TrendChart
                  data={seriesToPoints(aggregates.createdSeries, 'created')}
                  series={[{ key: 'created', label: 'New communities', colour: '#3b82f6' }]}
                  height={160}
                />
              </Panel>
              <Panel title="Community type distribution">
                <div className="flex items-center gap-4">
                  <DonutChart slices={aggregates.byType} total={aggregates.total} caption="Total" size={140} />
                  <DonutLegend slices={aggregates.byType} total={aggregates.total} className="flex-1" />
                </div>
              </Panel>
            </div>

            <Panel title="Top performing communities">
              {topPerforming.length === 0 ? (
                <CommunityEmpty title="No data yet" message="Engagement leaders will appear once communities have activity." />
              ) : (
                <ol className="space-y-2">
                  {topPerforming.map((community, i) => (
                    <li key={community.id} className="flex items-center gap-3 text-[12.5px]">
                      <span className="w-4 shrink-0 text-slate-400">{i + 1}</span>
                      <Avatar name={community.name} src={community.cover_image_url} size={24} />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{community.name}</span>
                      <span className="w-16 shrink-0 text-right text-slate-500">{formatNumber(community.member_count)}</span>
                      <span className="w-14 shrink-0 text-right text-emerald-600">{formatPercent(community.engagement_rate)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Recent activity" viewAllHref="/app/community">
              <ActivityFeed items={activity} />
            </Panel>
            <Panel title="Community opportunities">
              {aggregates.privateCount === 0 && aggregates.total > 0 ? (
                <p className="py-2 text-[12.5px] text-slate-600">All communities are public — consider a private space for top contributors.</p>
              ) : (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No suggestions right now.</p>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
