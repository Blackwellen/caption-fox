import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { requireCommunityModule } from '@/lib/community/server'
import {
  communityPickerList, listMembers, listMembershipRequests, memberAggregates,
  memberSegmentSummaries,
} from '@/lib/community/data'
import { buildHref, hasAnyFilter, parseMembersQuery, type RawParams } from '@/lib/community/query'
import {
  LIFECYCLE_STAGE_LABELS, LIFECYCLE_STAGES, MEMBER_ROLE_BADGE,
  MEMBER_ROLE_LABELS, MEMBER_ROLES, MEMBER_SORTS, MEMBER_STATUS_DOT, MEMBER_STATUS_LABELS, MEMBER_STATUSES,
} from '@/lib/community/constants'
import CommunityHeader from '@/components/community/CommunityHeader'
import KpiStrip from '@/components/community/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/community/FilterBar'
import Pagination from '@/components/community/Pagination'
import MembershipRequestActions from '@/components/community/MembershipRequestActions'
import { TrendChart, DonutChart, DonutLegend, seriesToPoints } from '@/components/community/charts'
import { AccessBlocked, CommunityEmpty, LoadError } from '@/components/community/states'
import {
  Avatar, AvatarStack, CARD, CARD_SHADOW, COMMUNITY_PAGE, Panel, StatusDot,
  formatAgo, formatNumber, formatShortDate,
} from '@/components/community/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/community/types'

export const metadata = { title: 'Community Members · Caption Fox' }

export default async function MembersPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCommunityModule('members')

  if (!access.allowed) {
    return (
      <div className={COMMUNITY_PAGE}>
        <CommunityHeader module="members" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseMembersQuery(params)
  const workspaceId = ctx.workspaceId

  const [aggregates, page, segments, requests, communities] = await Promise.all([
    memberAggregates(supabase, workspaceId),
    listMembers(supabase, workspaceId, query),
    memberSegmentSummaries(supabase, workspaceId),
    listMembershipRequests(supabase, workspaceId, 8),
    communityPickerList(supabase, workspaceId),
  ])

  const filters: FilterSpec[] = [
    { key: 'role', label: 'Role', allLabel: 'All roles', options: MEMBER_ROLES.map(r => ({ value: r, label: MEMBER_ROLE_LABELS[r] })) },
    { key: 'community', label: 'Community', allLabel: 'All communities', options: communities.map(c => ({ value: c.id, label: c.name })) },
    { key: 'lifecycle', label: 'Lifecycle stage', allLabel: 'All stages', options: LIFECYCLE_STAGES.map(l => ({ value: l, label: LIFECYCLE_STAGE_LABELS[l] })) },
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: MEMBER_STATUSES.map(s => ({ value: s, label: MEMBER_STATUS_LABELS[s] })), advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Recently active', options: MEMBER_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const churnDelta = aggregates.churnRisk - aggregates.previousChurnRisk

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total members', value: formatNumber(aggregates.total), hint: `${aggregates.total - aggregates.previousTotal >= 0 ? '+' : ''}${formatNumber(aggregates.total - aggregates.previousTotal)} vs last 30 days`, trend: aggregates.total >= aggregates.previousTotal ? 'up' : 'down', icon: 'users', tone: 'blue', spark: aggregates.joinedSeries },
    { id: 'new', label: 'New this month', value: formatNumber(aggregates.newThisMonth), hint: 'Joined since the 1st', icon: 'userCheck', tone: 'green' },
    { id: 'active', label: 'Active members', value: formatNumber(aggregates.active), hint: `${aggregates.active - aggregates.previousActive >= 0 ? '+' : ''}${formatNumber(aggregates.active - aggregates.previousActive)} vs last 30 days`, trend: aggregates.active >= aggregates.previousActive ? 'up' : 'down', icon: 'checks', tone: 'green' },
    { id: 'ambassadors', label: 'Ambassadors', value: formatNumber(aggregates.ambassadors), hint: `${aggregates.ambassadors - aggregates.previousAmbassadors >= 0 ? '+' : ''}${formatNumber(aggregates.ambassadors - aggregates.previousAmbassadors)} vs last 30 days`, trend: aggregates.ambassadors >= aggregates.previousAmbassadors ? 'up' : 'down', icon: 'star', tone: 'amber' },
    { id: 'churn', label: 'Churn risk', value: formatNumber(aggregates.churnRisk), hint: `${churnDelta >= 0 ? '+' : ''}${formatNumber(churnDelta)} vs last 30 days`, trend: churnDelta > 0 ? 'down' : 'up', icon: 'shieldAlert', tone: aggregates.churnRisk > 0 ? 'red' : 'slate' },
    { id: 'engagement', label: 'Avg engagement', value: aggregates.avgEngagement.toFixed(0), hint: 'Score out of 100', icon: 'trend', tone: 'blue' },
  ]

  return (
    <div className={COMMUNITY_PAGE}>
      <CommunityHeader
        module="members" modules={modules}
        actions={(
          <>
            {capabilities.inviteMembers && (
              <Link href="/app/community/members?invite=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                <UserPlus size={15} />Invite members
              </Link>
            )}
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {segments.map(segment => (
            <Link
              key={segment.key} href={buildHref('/app/community/members', query, { segment: query.segment === segment.key ? '' : segment.key })}
              className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2 p-3 transition-colors hover:border-slate-300 ${query.segment === segment.key ? 'border-blue-300 bg-blue-50/40' : ''}`}
            >
              <p className="text-[12px] font-medium text-slate-500">{segment.label}</p>
              <p className="text-[20px] font-bold text-slate-900">{formatNumber(segment.count)}</p>
              <AvatarStack people={segment.sample} />
            </Link>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search members…"
              filters={filters}
              values={query}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CommunityEmpty
                icon={filtered ? 'search' : 'community'}
                title={filtered ? 'No members match these filters' : 'No members yet'}
                message={filtered ? 'Try widening your filters.' : 'Invite members or approve join requests to get started.'}
              />
            ) : (
              <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Member</th>
                        <th className="px-3 py-2.5 font-medium">Community</th>
                        <th className="px-3 py-2.5 font-medium">Role</th>
                        <th className="px-3 py-2.5 font-medium">Joined</th>
                        <th className="px-3 py-2.5 font-medium">Posts</th>
                        <th className="px-3 py-2.5 font-medium">Engagement</th>
                        <th className="px-3 py-2.5 font-medium">Advocacy</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {page.rows.map(member => (
                        <tr key={member.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <Avatar name={member.display_name} src={member.avatar_url} size={28} />
                              <span className="min-w-0 truncate font-medium text-slate-900">{member.display_name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{member.community?.name ?? '—'}</td>
                          <td className="px-3 py-2.5"><Badge variant={MEMBER_ROLE_BADGE[member.role as keyof typeof MEMBER_ROLE_BADGE] ?? 'slate'}>{MEMBER_ROLE_LABELS[member.role as keyof typeof MEMBER_ROLE_LABELS] ?? member.role}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-500">{formatShortDate(member.joined_at)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{formatNumber(member.posts_count)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{member.engagement_score}</td>
                          <td className="px-3 py-2.5 text-slate-700">{member.advocacy_score}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot className={MEMBER_STATUS_DOT[member.status as keyof typeof MEMBER_STATUS_DOT] ?? 'bg-slate-300'} />
                              <span className="text-slate-600">{MEMBER_STATUS_LABELS[member.status as keyof typeof MEMBER_STATUS_LABELS] ?? member.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={query.page} size={query.size} total={page.total} label="members" />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Member growth trend">
                <TrendChart data={seriesToPoints(aggregates.joinedSeries, 'joined')} series={[{ key: 'joined', label: 'New members', colour: '#10b981' }]} height={160} />
              </Panel>
              <Panel title="Role distribution">
                <div className="flex items-center gap-4">
                  <DonutChart slices={aggregates.byRole.map((r, i) => ({ ...r, colour: ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'][i % 5] }))} total={aggregates.total} caption="Total" size={140} />
                  <DonutLegend slices={aggregates.byRole.map((r, i) => ({ ...r, colour: ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'][i % 5] }))} total={aggregates.total} className="flex-1" />
                </div>
              </Panel>
            </div>
          </div>

          <aside className="space-y-4">
            <Panel title="Next actions">
              <ul className="space-y-1">
                {requests.length > 0 && (
                  <li><Link href="#membership-requests" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><UserPlus size={13} className="text-blue-500" />Approve {requests.length} new member requests<Badge variant="blue" className="ml-auto">{requests.length}</Badge></Link></li>
                )}
                {aggregates.churnRisk > 0 && (
                  <li><Link href={buildHref('/app/community/members', query, { lifecycle: 'at_risk' })} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><UserPlus size={13} className="text-red-500" />Re-engage {aggregates.churnRisk} at-risk members<Badge variant="red" className="ml-auto">{aggregates.churnRisk}</Badge></Link></li>
                )}
                {requests.length === 0 && aggregates.churnRisk === 0 && <li className="px-1 py-3 text-center text-[12.5px] text-slate-400">You&apos;re all caught up.</li>}
              </ul>
            </Panel>

            <Panel title="Membership requests" className="scroll-mt-4">
              <div id="membership-requests" />
              {requests.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No pending requests.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {requests.map(request => (
                    <li key={request.id} className="flex items-center gap-2.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-slate-800">{request.applicant_name}</p>
                        <p className="truncate text-[11px] text-slate-400">{request.community?.name ?? 'Unknown community'} · {formatAgo(request.requested_at)}</p>
                      </div>
                      <MembershipRequestActions requestId={request.id} canApprove={capabilities.approveMembers} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Community opportunities">
              {aggregates.ambassadors === 0 ? (
                <p className="py-2 text-[12.5px] text-slate-600">No ambassadors yet — consider promoting your most engaged members.</p>
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
