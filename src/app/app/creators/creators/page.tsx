import Link from 'next/link'
import { Bookmark, Star } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  creatorAggregates, listCreatorLists, listCreators,
  recentActivity, shortlistedCreators, workspaceMembers, delta,
} from '@/lib/creators/data'
import { parseCreatorsQuery, hasAnyFilter, type RawParams } from '@/lib/creators/query'
import {
  AUDIENCE_BANDS, AVAILABILITY_LABELS, AVAILABILITY_VALUES, CHANNEL_LABELS,
  CREATOR_CHANNELS, CREATOR_NICHES, CREATOR_REGIONS, CREATOR_SORTS,
  NICHE_LABELS, RELATIONSHIP_LABELS, RELATIONSHIP_STATUSES, RIGHTS_READINESS,
  RIGHTS_READINESS_LABELS, type RelationshipStatus, type RightsReadiness,
} from '@/lib/creators/constants'
import CreatorsHeader from '@/components/creators/CreatorsHeader'
import KpiStrip from '@/components/creators/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/creators/FilterBar'
import Pagination from '@/components/creators/Pagination'
import ActivityFeed from '@/components/creators/ActivityFeed'
import InviteCreatorButton from '@/components/creators/InviteCreatorButton'
import CreateCreatorButton from '@/components/creators/CreateCreatorButton'
import ExportButton, { HeaderOverflow } from '@/components/creators/ExportButton'
import CreatorRowActions from '@/components/creators/CreatorRowActions'
import { AccessBlocked, CreatorsEmpty, LoadError } from '@/components/creators/states'
import {
  Avatar, CARD, CARD_SHADOW, CREATORS_PAGE, ChannelChips, CreatorChip, NicheChip,
  Panel, formatMoneyShort, formatNumber, formatPercent,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/creators/types'

export const metadata = { title: 'Creators · Caption Fox' }

export default async function CreatorsListPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCreatorModule('creators')

  if (!access.allowed) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="creators" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCreatorsQuery(params)

  const [aggregates, page, lists, featured, activity, members] = await Promise.all([
    creatorAggregates(supabase, ctx.workspaceId),
    listCreators(supabase, ctx.workspaceId, query),
    listCreatorLists(supabase, ctx.workspaceId),
    shortlistedCreators(supabase, ctx.workspaceId, 4),
    recentActivity(supabase, ctx.workspaceId, 5, { entityType: 'creator' }),
    workspaceMembers(supabase, ctx.workspaceId),
  ])

  const activeDelta = delta(aggregates.active, aggregates.previousActive)
  const shortlistDelta = delta(aggregates.shortlisted, aggregates.previousShortlisted)
  const rightsDelta = delta(aggregates.rightsReady, aggregates.previousRightsReady)

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total Creators', value: formatNumber(aggregates.total), hint: `${activeDelta.pct >= 0 ? '+' : ''}${activeDelta.pct.toFixed(1)}% vs last 30 days`, trend: activeDelta.trend, icon: 'users', tone: 'blue', spark: aggregates.createdSeries },
    { id: 'active', label: 'Active Collaborations', value: formatNumber(aggregates.active), hint: 'Onboarding through active', icon: 'checks', tone: 'green' },
    { id: 'shortlisted', label: 'Shortlisted', value: formatNumber(aggregates.shortlisted), hint: `${shortlistDelta.pct >= 0 ? '+' : ''}${shortlistDelta.pct.toFixed(1)}% vs last 30 days`, trend: shortlistDelta.trend, icon: 'star', tone: 'violet' },
    { id: 'engagement', label: 'Avg. Engagement Rate', value: formatPercent(aggregates.avgEngagement), hint: 'Across all workspace creators', icon: 'trend', tone: 'blue' },
    { id: 'rate', label: 'Avg. Cost per Deliverable', value: formatMoneyShort(aggregates.avgRate), hint: 'Median rate card', icon: 'pound', tone: 'amber' },
    { id: 'rights', label: 'Rights-Ready Creators', value: formatNumber(aggregates.rightsReady), hint: `${rightsDelta.pct >= 0 ? '+' : ''}${rightsDelta.pct.toFixed(1)}% vs last 30 days`, trend: rightsDelta.trend, icon: 'shieldCheck', tone: 'green' },
  ]

  const filters: FilterSpec[] = [
    { key: 'niche', label: 'Niche', allLabel: 'All Niches', options: CREATOR_NICHES.map(n => ({ value: n, label: NICHE_LABELS[n] })) },
    { key: 'audience', label: 'Audience Size', allLabel: 'All Sizes', options: AUDIENCE_BANDS.map(b => ({ value: b.id, label: b.label })) },
    { key: 'platform', label: 'Platform', allLabel: 'All Platforms', options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
    { key: 'region', label: 'Region', allLabel: 'All Regions', options: CREATOR_REGIONS.map(r => ({ value: r, label: r })) },
    { key: 'availability', label: 'Availability', allLabel: 'All Availability', options: AVAILABILITY_VALUES.map(a => ({ value: a, label: AVAILABILITY_LABELS[a] })) },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: RELATIONSHIP_STATUSES.map(s => ({ value: s, label: RELATIONSHIP_LABELS[s] })) },
    { key: 'rights', label: 'Rights', allLabel: 'All Rights', options: RIGHTS_READINESS.map(r => ({ value: r, label: RIGHTS_READINESS_LABELS[r] })), advanced: true },
    { key: 'owner', label: 'Owner', allLabel: 'All Owners', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })), advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Recently updated', options: CREATOR_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)

  return (
    <div className={CREATORS_PAGE}>
      <CreatorsHeader
        module="creators" modules={modules}
        actions={(
          <>
            {capabilities.invite && <InviteCreatorButton />}
            {capabilities.manageCreators && <CreateCreatorButton />}
            <ExportButton entity="creators" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data', onSelect: 'refresh' }, { label: 'Manage lists', href: '/app/creators/creators?list=' }]} />
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search creators by name, handle, or keyword…"
              filters={filters}
              views={['table', 'cards']}
              activeView={query.view}
              values={query}
              showDateRange={false}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CreatorsEmpty
                icon={filtered ? 'search' : 'creators'}
                title={filtered ? 'No creators match these filters' : 'No creators yet'}
                message={filtered ? 'Try widening your filters or clearing the search term.' : 'Invite your first creator or add one manually to start building your roster.'}
                action={!filtered && capabilities.invite ? <InviteCreatorButton /> : undefined}
              />
            ) : query.view === 'table' ? (
              <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Creator</th>
                        <th className="px-3 py-2.5 font-medium">Niche</th>
                        <th className="px-3 py-2.5 font-medium">Audience</th>
                        <th className="px-3 py-2.5 font-medium">Region</th>
                        <th className="px-3 py-2.5 font-medium">Platforms</th>
                        <th className="px-3 py-2.5 font-medium">Eng. Rate</th>
                        <th className="px-3 py-2.5 font-medium">Rate Card</th>
                        <th className="px-3 py-2.5 font-medium">Rights</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {page.rows.map(creator => (
                        <tr key={creator.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <CreatorChip creator={creator} href={`/app/creators/creators/${creator.id}`} />
                          </td>
                          <td className="px-3 py-2.5"><NicheChip niche={creator.niche} /></td>
                          <td className="px-3 py-2.5 text-slate-600">{formatNumber(creator.audience_size)}</td>
                          <td className="px-3 py-2.5 text-slate-600">{creator.region ?? '—'}</td>
                          <td className="px-3 py-2.5"><ChannelChips channels={creator.platforms} /></td>
                          <td className="px-3 py-2.5 text-slate-600">{formatPercent(creator.engagement_rate)}</td>
                          <td className="px-3 py-2.5 text-slate-600">{creator.avg_rate ? formatMoneyShort(creator.avg_rate, creator.currency ?? 'GBP') : '—'}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant={creator.rights_readiness === 'full' ? 'green' : creator.rights_readiness === 'limited' ? 'amber' : 'red'}>
                              {RIGHTS_READINESS_LABELS[creator.rights_readiness as RightsReadiness] ?? creator.rights_readiness}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="blue">{RELATIONSHIP_LABELS[creator.relationship_status as RelationshipStatus] ?? creator.relationship_status}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <CreatorRowActions creator={creator} lists={lists} canManage={capabilities.manageCreators} canManageLists={capabilities.manageLists} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={query.page} size={query.size} total={page.total} label="creators" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {page.rows.map(creator => (
                  <Link
                    key={creator.id} href={`/app/creators/creators/${creator.id}`}
                    className={`${CARD} ${CARD_SHADOW} flex flex-col gap-3 p-4 transition-colors hover:border-slate-300`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={creator.name} src={creator.avatar_url} size={40} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{creator.name}</p>
                          <p className="truncate text-xs text-slate-400">{creator.handle ? `@${creator.handle}` : '—'}</p>
                        </div>
                      </div>
                      {creator.shortlisted && <Star size={15} className="shrink-0 fill-amber-400 text-amber-400" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <NicheChip niche={creator.niche} />
                      <ChannelChips channels={creator.platforms} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-500">
                      <span>Audience <b className="text-slate-800">{formatNumber(creator.audience_size)}</b></span>
                      <span>Eng. <b className="text-slate-800">{formatPercent(creator.engagement_rate)}</b></span>
                      <span>Rate <b className="text-slate-800">{creator.avg_rate ? formatMoneyShort(creator.avg_rate) : '—'}</b></span>
                      <span>{creator.region ?? '—'}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <Badge variant="blue">{RELATIONSHIP_LABELS[creator.relationship_status as RelationshipStatus] ?? creator.relationship_status}</Badge>
                      <Badge variant={creator.rights_readiness === 'full' ? 'green' : creator.rights_readiness === 'limited' ? 'amber' : 'red'}>
                        {RIGHTS_READINESS_LABELS[creator.rights_readiness as RightsReadiness] ?? creator.rights_readiness}
                      </Badge>
                    </div>
                  </Link>
                ))}
                <div className="sm:col-span-2 xl:col-span-3">
                  <div className={`${CARD} ${CARD_SHADOW}`}>
                    <Pagination page={query.page} size={query.size} total={page.total} label="creators" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title={`Featured / Shortlist (${featured.length})`} viewAllHref="/app/creators/creators?shortlist=1">
              {featured.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">Shortlist creators to keep them handy here.</p>
              ) : (
                <ul className="space-y-2.5">
                  {featured.map(creator => (
                    <li key={creator.id}>
                      <Link href={`/app/creators/creators/${creator.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-slate-50">
                        <Avatar name={creator.name} src={creator.avatar_url} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-800">{creator.name}</span>
                          <span className="block truncate text-[11px] text-slate-400">{creator.handle ? `@${creator.handle}` : formatNumber(creator.audience_size)}</span>
                        </span>
                        <Bookmark size={14} className="shrink-0 fill-blue-500 text-blue-500" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent Creator Activity" viewAllHref="/app/creators">
              <ActivityFeed items={activity} />
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
