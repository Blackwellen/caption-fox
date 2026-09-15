import Link from 'next/link'
import { CalendarPlus, Eye, Flag, Plus } from 'lucide-react'
import { requireCommunityModule } from '@/lib/community/server'
import {
  communityAggregates, delta, listCommunities, listMembershipRequests,
  listModerationReports, moderationAggregates, recentActivity, topMembers, upcomingEvents,
  memberAggregates, eventAggregates, advocacyAggregates, workspaceMembers,
} from '@/lib/community/data'
import { parseCommunitiesQuery, parseModerationQuery, type RawParams } from '@/lib/community/query'
import {
  COMMUNITY_REGIONS, COMMUNITY_STATUSES, COMMUNITY_TYPES, COMMUNITY_TYPE_LABELS,
  COMMUNITY_STATUS_LABELS, COMMUNITY_PRIVACY_BADGE, COMMUNITY_PRIVACY_LABELS,
  MODERATION_REASON_LABELS,
} from '@/lib/community/constants'
import CommunityHeader from '@/components/community/CommunityHeader'
import KpiStrip from '@/components/community/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/community/FilterBar'
import ActivityFeed from '@/components/community/ActivityFeed'
import { TrendChart, ChartLegend, DonutChart, DonutLegend } from '@/components/community/charts'
import { AccessBlocked, CommunityEmpty, LoadError } from '@/components/community/states'
import {
  Avatar, COMMUNITY_PAGE, Panel, formatAgo, formatNumber, formatPercent, formatShortDate,
} from '@/components/community/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/community/types'

export const metadata = { title: 'Community Overview · Caption Fox' }

export default async function CommunityOverviewPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCommunityModule('overview')

  if (!access.allowed) {
    return (
      <div className={COMMUNITY_PAGE}>
        <CommunityHeader module="overview" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCommunitiesQuery(params)
  const workspaceId = ctx.workspaceId

  const [
    communityAgg, memberAgg, eventAgg, advocacyAgg, moderationAgg,
    featured, queue, top, events, activity, requests, members,
  ] = await Promise.all([
    communityAggregates(supabase, workspaceId),
    memberAggregates(supabase, workspaceId),
    eventAggregates(supabase, workspaceId),
    advocacyAggregates(supabase, workspaceId),
    moderationAggregates(supabase, workspaceId),
    listCommunities(supabase, workspaceId, { ...query, status: query.status || 'active' }, { all: true, limit: 8 }),
    listModerationReports(supabase, workspaceId, parseModerationQuery({}), { all: true, limit: 5 }),
    topMembers(supabase, workspaceId, 8),
    upcomingEvents(supabase, workspaceId, 5),
    recentActivity(supabase, workspaceId, 6),
    listMembershipRequests(supabase, workspaceId, 50),
    workspaceMembers(supabase, workspaceId),
  ])

  const activeDelta = delta(communityAgg.active, communityAgg.previousActive)
  const membersDelta = delta(memberAgg.total, memberAgg.previousTotal)
  const eventsDelta = delta(eventAgg.scheduled, eventAgg.previousScheduled)
  const advocacyDelta = delta(advocacyAgg.advocacyMembers, advocacyAgg.previousAdvocacyMembers)
  const moderationDelta = delta(moderationAgg.pending, moderationAgg.previousPending)

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active communities', value: formatNumber(communityAgg.active), hint: `${activeDelta.pct >= 0 ? '+' : ''}${activeDelta.pct.toFixed(1)}% vs last 30 days`, trend: activeDelta.trend, icon: 'users', tone: 'blue', spark: communityAgg.createdSeries, href: '/app/community/communities' },
    { id: 'members', label: 'Total members', value: formatNumber(memberAgg.total), hint: `${membersDelta.pct >= 0 ? '+' : ''}${membersDelta.pct.toFixed(1)}% vs last 30 days`, trend: membersDelta.trend, icon: 'userCheck', tone: 'green', spark: memberAgg.joinedSeries, href: '/app/community/members' },
    { id: 'moderation', label: 'Pending moderation', value: formatNumber(moderationAgg.pending), hint: moderationAgg.pending > 0 ? 'Needs review' : 'Queue is clear', trend: moderationDelta.trend === 'up' ? 'down' : moderationDelta.trend === 'down' ? 'up' : 'flat', icon: 'flag', tone: moderationAgg.pending > 0 ? 'amber' : 'slate', href: '/app/community/moderation' },
    { id: 'events', label: 'Upcoming events', value: formatNumber(eventAgg.scheduled), hint: `${eventsDelta.pct >= 0 ? '+' : ''}${eventsDelta.pct.toFixed(1)}% vs last 30 days`, trend: eventsDelta.trend, icon: 'calendar', tone: 'violet', href: '/app/community/calendar' },
    { id: 'advocacy', label: 'Advocacy members', value: formatNumber(advocacyAgg.advocacyMembers), hint: `${advocacyDelta.pct >= 0 ? '+' : ''}${advocacyDelta.pct.toFixed(1)}% vs last 30 days`, trend: advocacyDelta.trend, icon: 'star', tone: 'amber', href: '/app/community/advocacy' },
    { id: 'engagement', label: 'Engagement rate', value: formatPercent(communityAgg.avgEngagement), hint: `${delta(communityAgg.avgEngagement, communityAgg.previousAvgEngagement).pct >= 0 ? '+' : ''}${delta(communityAgg.avgEngagement, communityAgg.previousAvgEngagement).pct.toFixed(1)}pp vs last 30 days`, trend: delta(communityAgg.avgEngagement, communityAgg.previousAvgEngagement).trend, icon: 'trend', tone: 'blue' },
  ]

  const filters: FilterSpec[] = [
    { key: 'type', label: 'Type', allLabel: 'All types', options: COMMUNITY_TYPES.map(t => ({ value: t, label: COMMUNITY_TYPE_LABELS[t] })) },
    { key: 'owner', label: 'Owner', allLabel: 'All owners', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })) },
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: COMMUNITY_STATUSES.map(s => ({ value: s, label: COMMUNITY_STATUS_LABELS[s] })) },
    { key: 'region', label: 'Region', allLabel: 'All regions', options: COMMUNITY_REGIONS.map(r => ({ value: r, label: r })), advanced: true },
  ]

  // Next actions and opportunities derive from real aggregate signals, never
  // from static copy — an item only appears when the number behind it is > 0.
  const nextActions = [
    moderationAgg.pending > 0 && { icon: <Flag size={14} />, label: `Review ${moderationAgg.pending} pending moderation ${moderationAgg.pending === 1 ? 'item' : 'items'}`, href: '/app/community/moderation', count: moderationAgg.pending },
    requests.length > 0 && { icon: <Plus size={14} />, label: `Approve ${requests.length} new member ${requests.length === 1 ? 'request' : 'requests'}`, href: '/app/community/members', count: requests.length },
    eventAgg.scheduled === 0 && { icon: <CalendarPlus size={14} />, label: 'Schedule your first community event', href: '/app/community/calendar', count: null },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; href: string; count: number | null }[]

  const moderationAlerts = [
    moderationAgg.critical > 0 && { label: `${moderationAgg.critical} critical ${moderationAgg.critical === 1 ? 'report needs' : 'reports need'} attention`, tone: 'red' as const },
    moderationAgg.spam > 0 && { label: `${moderationAgg.spam} spam reports logged`, tone: 'amber' as const },
    moderationAgg.repeatOffenders > 0 && { label: `${moderationAgg.repeatOffenders} repeat offender ${moderationAgg.repeatOffenders === 1 ? 'account' : 'accounts'} flagged`, tone: 'red' as const },
  ].filter(Boolean) as { label: string; tone: 'red' | 'amber' }[]

  const opportunities = [
    advocacyAgg.activeAmbassadors === 0 && { label: 'Launch an ambassador programme', hint: 'No active ambassadors yet', href: '/app/community/advocacy' },
    communityAgg.total > 0 && communityAgg.privateCount === 0 && { label: 'Create a private community for top members', hint: 'All communities are currently public', href: '/app/community/communities' },
    eventAgg.scheduled === 0 && { label: 'Host your first live session', hint: 'No events scheduled', href: '/app/community/calendar' },
  ].filter(Boolean) as { label: string; hint: string; href: string }[]

  return (
    <div className={COMMUNITY_PAGE}>
      <CommunityHeader
        module="overview" modules={modules}
        actions={(
          <>
            {capabilities.createCommunity && (
              <Link href="/app/community/communities?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                <Plus size={15} />New community
              </Link>
            )}
            {capabilities.createEvent && (
              <Link href="/app/community/calendar?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <CalendarPlus size={15} />Schedule event
              </Link>
            )}
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <FilterBar
          searchPlaceholder="Search communities, members, posts, events…"
          filters={filters}
          views={['cards', 'table']}
          activeView={query.view}
          values={query}
          showDateRange
        />

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <Panel title={`Featured communities (${featured.total})`} viewAllHref="/app/community/communities">
              {featured.error ? (
                <LoadError message={featured.error} />
              ) : featured.rows.length === 0 ? (
                <CommunityEmpty
                  title="No active communities yet"
                  message="Create your first community to start tracking membership, events and moderation."
                  action={capabilities.createCommunity && (
                    <Link href="/app/community/communities?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                      <Plus size={15} />New community
                    </Link>
                  )}
                />
              ) : (
                <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 pt-1">
                  {featured.rows.map(community => (
                    <Link
                      key={community.id} href={`/app/community/communities?q=${encodeURIComponent(community.name)}`}
                      className="w-[220px] shrink-0 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={community.name} src={community.cover_image_url} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-slate-900">{community.name}</p>
                          <Badge variant={COMMUNITY_PRIVACY_BADGE[community.privacy as keyof typeof COMMUNITY_PRIVACY_BADGE] ?? 'slate'}>
                            {COMMUNITY_PRIVACY_LABELS[community.privacy as keyof typeof COMMUNITY_PRIVACY_LABELS] ?? community.privacy}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-2.5 text-[12.5px] text-slate-500">{formatNumber(community.member_count)} members</p>
                      <p className="text-[11px] capitalize text-emerald-600">{community.activity_level.replace('_', ' ')} activity</p>
                      <p className="mt-1.5 truncate text-[11px] text-slate-400">Owner: {community.owner?.full_name ?? community.owner?.email ?? 'Unassigned'}</p>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title={`Moderation queue (${moderationAgg.pending})`} viewAllHref="/app/community/moderation" viewAllLabel="View full queue">
              {queue.error ? (
                <LoadError message={queue.error} />
              ) : queue.rows.length === 0 ? (
                <CommunityEmpty title="Nothing to review" message="New reports will show up here as members flag content." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {queue.rows.map(report => (
                    <li key={report.id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={report.reported_member?.display_name} src={report.reported_member?.avatar_url} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] text-slate-700">
                          <span className="font-medium text-slate-900">{report.reported_member?.display_name ?? 'Unknown member'}</span>
                          {' — '}{report.content_excerpt ?? 'No excerpt available'}
                        </p>
                        <p className="text-[11px] text-slate-400">{report.community?.name ?? 'Unknown community'} · {formatAgo(report.created_at)}</p>
                      </div>
                      <Badge variant="amber">{MODERATION_REASON_LABELS[report.reason as keyof typeof MODERATION_REASON_LABELS] ?? report.reason}</Badge>
                      <Link href={`/app/community/moderation?selected=${report.id}`} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View report">
                        <Eye size={14} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Top members" viewAllHref="/app/community/members">
              {top.length === 0 ? (
                <CommunityEmpty title="No members yet" message="Members will appear here once communities have activity." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3 font-medium">Member</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Joined</th>
                        <th className="px-3 py-2 font-medium">Engagement</th>
                        <th className="px-3 py-2 font-medium">Advocacy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {top.map(member => (
                        <tr key={member.id}>
                          <td className="py-2.5 pr-3">
                            <span className="flex items-center gap-2">
                              <Avatar name={member.display_name} src={member.avatar_url} size={26} />
                              <span className="truncate font-medium text-slate-800">{member.display_name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{member.role.replace('_', ' ')}</td>
                          <td className="px-3 py-2.5 text-slate-500">{formatShortDate(member.joined_at)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{member.engagement_score}</td>
                          <td className="px-3 py-2.5 text-slate-700">{member.advocacy_score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Upcoming events" viewAllHref="/app/community/calendar">
                {events.length === 0 ? (
                  <CommunityEmpty title="No events scheduled" message="Schedule a live session, AMA or challenge to see it here." />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {events.map(event => (
                      <li key={event.id} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-slate-800">{event.title}</p>
                          <p className="truncate text-[11px] text-slate-400">{event.community?.name ?? 'All communities'} · {formatShortDate(event.starts_at)}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-400">{formatNumber(event.rsvp_count)} RSVPs</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Community health" info="Derived from engagement trend, moderation volume and active-member ratio.">
                <div className="flex items-center gap-4">
                  <DonutChart slices={communityAgg.byHealth} total={communityAgg.total} caption="Total" size={140} />
                  <DonutLegend slices={communityAgg.byHealth} total={communityAgg.total} className="flex-1" />
                </div>
              </Panel>
            </div>

            <Panel title="Engagement trend" info="Posts, comments, reactions and shares over the last 30 days.">
              <TrendChart
                data={eventAgg.registrationsSeries}
                series={[{ key: 'registrations', label: 'Event registrations', colour: '#3b82f6' }]}
              />
              <ChartLegend series={[{ key: 'registrations', label: 'Event registrations', colour: '#3b82f6' }]} className="mt-2" />
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Next actions">
              {nextActions.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">You&apos;re all caught up.</p>
              ) : (
                <ul className="space-y-1">
                  {nextActions.map((action, i) => (
                    <li key={i}>
                      <Link href={action.href} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-slate-50">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{action.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700">{action.label}</span>
                        {action.count !== null && <Badge variant="blue">{action.count}</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Moderation alerts" viewAllHref="/app/community/moderation">
              {moderationAlerts.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No active alerts.</p>
              ) : (
                <ul className="space-y-2">
                  {moderationAlerts.map((alert, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px]">
                      <Flag size={13} className={alert.tone === 'red' ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-amber-500'} />
                      <span className="text-slate-700">{alert.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Community opportunities">
              {opportunities.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No suggestions right now.</p>
              ) : (
                <ul className="space-y-2.5">
                  {opportunities.map((op, i) => (
                    <li key={i}>
                      <Link href={op.href} className="block rounded-lg px-1 py-1 hover:bg-slate-50">
                        <span className="block text-[12.5px] font-medium text-slate-800">{op.label}</span>
                        <span className="block text-[11px] text-slate-400">{op.hint}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent activity" viewAllHref="/app/community">
              <ActivityFeed items={activity} />
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
