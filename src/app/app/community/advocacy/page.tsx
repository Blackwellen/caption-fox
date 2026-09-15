import Link from 'next/link'
import { Gift, Plus, Trophy } from 'lucide-react'
import { requireCommunityModule } from '@/lib/community/server'
import {
  advocacyAggregates, communityPickerList, listAdvocacyLeaderboard, listAdvocacyPrograms,
  pendingRewards, recentActivity,
} from '@/lib/community/data'
import { hasAnyFilter, parseAdvocacyQuery, type RawParams } from '@/lib/community/query'
import {
  ADVOCACY_PROGRAM_STATUS_BADGE, ADVOCACY_PROGRAM_STATUS_LABELS, ADVOCACY_PROGRAM_STATUSES,
  ADVOCACY_PROGRAM_TYPE_LABELS, ADVOCACY_PROGRAM_TYPES, ADVOCACY_SORTS, ADVOCACY_TIER_BADGE,
  ADVOCACY_TIER_LABELS, ADVOCACY_TIERS,
} from '@/lib/community/constants'
import CommunityHeader from '@/components/community/CommunityHeader'
import KpiStrip from '@/components/community/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/community/FilterBar'
import Pagination from '@/components/community/Pagination'
import ActivityFeed from '@/components/community/ActivityFeed'
import RewardApprovalActions from '@/components/community/RewardApprovalActions'
import { TrendChart, DonutChart, DonutLegend, BarList } from '@/components/community/charts'
import { AccessBlocked, CommunityEmpty, LoadError } from '@/components/community/states'
import {
  Avatar, CARD, CARD_SHADOW, COMMUNITY_PAGE, Panel, ProgressBar,
  formatMoneyShort, formatNumber, formatShortDate,
} from '@/components/community/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/community/types'

export const metadata = { title: 'Community Advocacy · Caption Fox' }

export default async function AdvocacyPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCommunityModule('advocacy')

  if (!access.allowed) {
    return (
      <div className={COMMUNITY_PAGE}>
        <CommunityHeader module="advocacy" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseAdvocacyQuery(params)
  const workspaceId = ctx.workspaceId

  const [aggregates, programs, leaderboard, rewards, activity, communities] = await Promise.all([
    advocacyAggregates(supabase, workspaceId),
    listAdvocacyPrograms(supabase, workspaceId, query, { all: true, limit: 12 }),
    listAdvocacyLeaderboard(supabase, workspaceId, query),
    pendingRewards(supabase, workspaceId, 8),
    recentActivity(supabase, workspaceId, 6, { entityType: 'advocacy' }),
    communityPickerList(supabase, workspaceId),
  ])

  const filters: FilterSpec[] = [
    { key: 'type', label: 'Program type', allLabel: 'All types', options: ADVOCACY_PROGRAM_TYPES.map(t => ({ value: t, label: ADVOCACY_PROGRAM_TYPE_LABELS[t] })) },
    { key: 'community', label: 'Community', allLabel: 'All communities', options: communities.map(c => ({ value: c.id, label: c.name })) },
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: ADVOCACY_PROGRAM_STATUSES.map(s => ({ value: s, label: ADVOCACY_PROGRAM_STATUS_LABELS[s] })) },
    { key: 'tier', label: 'Tier', allLabel: 'All tiers', options: ADVOCACY_TIERS.map(t => ({ value: t, label: ADVOCACY_TIER_LABELS[t] })), advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Points (highest)', options: ADVOCACY_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const referralDelta = aggregates.referralConversions - aggregates.previousReferralConversions
  const ugcDelta = aggregates.ugcSubmissions - aggregates.previousUgcSubmissions

  const kpis: KpiValue[] = [
    { id: 'members', label: 'Advocacy members', value: formatNumber(aggregates.advocacyMembers), hint: `${aggregates.advocacyMembers - aggregates.previousAdvocacyMembers >= 0 ? '+' : ''}${formatNumber(aggregates.advocacyMembers - aggregates.previousAdvocacyMembers)} vs last 30 days`, trend: aggregates.advocacyMembers >= aggregates.previousAdvocacyMembers ? 'up' : 'down', icon: 'star', tone: 'amber' },
    { id: 'ambassadors', label: 'Active ambassadors', value: formatNumber(aggregates.activeAmbassadors), hint: 'Ambassador + super advocate tier', icon: 'userCheck', tone: 'violet' },
    { id: 'referrals', label: 'Referral conversions', value: formatNumber(aggregates.referralConversions), hint: `${referralDelta >= 0 ? '+' : ''}${formatNumber(referralDelta)} vs last 30 days`, trend: referralDelta >= 0 ? 'up' : 'down', icon: 'trend', tone: 'blue' },
    { id: 'ugc', label: 'UGC submissions', value: formatNumber(aggregates.ugcSubmissions), hint: `${ugcDelta >= 0 ? '+' : ''}${formatNumber(ugcDelta)} vs last 30 days`, trend: ugcDelta >= 0 ? 'up' : 'down', icon: 'layers', tone: 'green' },
    { id: 'rewards', label: 'Rewards issued', value: formatNumber(aggregates.rewardsIssued), hint: 'All time', icon: 'gift', tone: 'amber' },
    { id: 'engagement', label: 'Advocacy engagement', value: aggregates.avgEngagement.toFixed(0), hint: 'Avg advocacy score', icon: 'trend', tone: 'blue' },
  ]

  return (
    <div className={COMMUNITY_PAGE}>
      <CommunityHeader
        module="advocacy" modules={modules}
        actions={(
          <>
            {capabilities.createAdvocacyProgram && (
              <Link href="/app/community/advocacy?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                <Plus size={15} />New program
              </Link>
            )}
            {capabilities.createAdvocacyProgram && (
              <Link href="/app/community/advocacy?new=challenge" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Trophy size={15} />Create challenge
              </Link>
            )}
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <FilterBar
              searchPlaceholder="Search programs…"
              filters={filters}
              values={query}
            />

            {programs.error ? (
              <LoadError message={programs.error} />
            ) : programs.rows.length === 0 ? (
              <CommunityEmpty
                icon={filtered ? 'search' : 'community'}
                title={filtered ? 'No programs match these filters' : 'No advocacy programs yet'}
                message={filtered ? 'Try widening your filters.' : 'Launch an ambassador, referral or UGC programme to grow advocacy.'}
                action={!filtered && capabilities.createAdvocacyProgram && (
                  <Link href="/app/community/advocacy?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                    <Plus size={15} />New program
                  </Link>
                )}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {programs.rows.map(program => {
                  const progressPct = program.goal_target > 0 ? (program.goal_progress / program.goal_target) * 100 : 0
                  return (
                    <div key={program.id} className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2.5 p-4`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">{program.name}</p>
                          <p className="text-[11px] text-slate-400">{ADVOCACY_PROGRAM_TYPE_LABELS[program.type as keyof typeof ADVOCACY_PROGRAM_TYPE_LABELS] ?? program.type}</p>
                        </div>
                        <Badge variant={ADVOCACY_PROGRAM_STATUS_BADGE[program.status as keyof typeof ADVOCACY_PROGRAM_STATUS_BADGE] ?? 'slate'}>
                          {ADVOCACY_PROGRAM_STATUS_LABELS[program.status as keyof typeof ADVOCACY_PROGRAM_STATUS_LABELS] ?? program.status}
                        </Badge>
                      </div>
                      <p className="text-[12.5px] text-slate-500">{formatNumber(program.member_count ?? 0)} members</p>
                      {program.goal_metric && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{program.goal_metric}</span>
                            <span>{progressPct.toFixed(0)}% of goal</span>
                          </div>
                          <ProgressBar value={progressPct} tone="amber" />
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                        <span>{program.ends_at ? `Ends ${formatShortDate(program.ends_at)}` : program.starts_at ? `Starts ${formatShortDate(program.starts_at)}` : '—'}</span>
                        {program.top_performer && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Avatar name={program.top_performer.display_name} size={16} />
                            {program.top_performer.display_name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Panel title={`Advocacy leaderboard (${leaderboard.total})`}>
              {leaderboard.error ? (
                <LoadError message={leaderboard.error} />
              ) : leaderboard.rows.length === 0 ? (
                <CommunityEmpty title="No enrolled advocates yet" message="Members appear here once they join an advocacy programme." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Member</th>
                        <th className="px-3 py-2 font-medium">Community</th>
                        <th className="px-3 py-2 font-medium">Tier</th>
                        <th className="px-3 py-2 font-medium">Referrals</th>
                        <th className="px-3 py-2 font-medium">UGC posts</th>
                        <th className="px-3 py-2 font-medium">Points</th>
                        <th className="px-3 py-2 font-medium">Rewards earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {leaderboard.rows.map((row, i) => (
                        <tr key={row.id}>
                          <td className="py-2.5 pr-3 text-slate-400">{(query.page - 1) * query.size + i + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <Avatar name={row.member?.display_name} src={row.member?.avatar_url} size={26} />
                              <span className="truncate font-medium text-slate-800">{row.member?.display_name ?? 'Unknown member'}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{row.program?.name ?? '—'}</td>
                          <td className="px-3 py-2.5"><Badge variant={ADVOCACY_TIER_BADGE[row.tier as keyof typeof ADVOCACY_TIER_BADGE] ?? 'slate'}>{ADVOCACY_TIER_LABELS[row.tier as keyof typeof ADVOCACY_TIER_LABELS] ?? row.tier}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-700">{formatNumber(row.referrals_count)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{formatNumber(row.ugc_posts_count)}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">{formatNumber(row.points)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{formatMoneyShort(row.rewards_earned_cents / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={query.page} size={query.size} total={leaderboard.total} label="advocates" />
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Referral trend">
                <TrendChart data={[]} series={[{ key: 'referrals', label: 'Referrals', colour: '#3b82f6' }]} emptyMessage="Referral tracking will chart here once conversions start coming in." height={160} />
              </Panel>
              <Panel title="Ambassador tier distribution">
                <div className="flex items-center gap-4">
                  <DonutChart slices={aggregates.byTier} total={aggregates.advocacyMembers} caption="Total" size={140} />
                  <DonutLegend slices={aggregates.byTier} total={aggregates.advocacyMembers} className="flex-1" />
                </div>
              </Panel>
            </div>

            <Panel title="Top advocacy channels">
              <BarList
                items={[
                  { key: 'referrals', label: 'Referrals', value: aggregates.referralConversions },
                  { key: 'ugc', label: 'UGC', value: aggregates.ugcSubmissions },
                ]}
                total={aggregates.referralConversions + aggregates.ugcSubmissions}
              />
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Next actions">
              <ul className="space-y-1">
                {rewards.length > 0 && <li><Link href="#reward-approvals" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><Gift size={13} className="text-amber-500" />Approve {rewards.length} pending rewards<Badge variant="amber" className="ml-auto">{rewards.length}</Badge></Link></li>}
                {aggregates.activeAmbassadors === 0 && <li><Link href="/app/community/advocacy?new=1" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><Trophy size={13} className="text-violet-500" />Launch your first ambassador programme</Link></li>}
                {rewards.length === 0 && aggregates.activeAmbassadors > 0 && <li className="px-1 py-3 text-center text-[12.5px] text-slate-400">You&apos;re all caught up.</li>}
              </ul>
            </Panel>

            <Panel title="Reward approvals" className="scroll-mt-4">
              <div id="reward-approvals" />
              {rewards.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No pending reward approvals.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {rewards.map(reward => (
                    <li key={reward.id} className="flex items-center gap-2.5 py-2.5">
                      <Avatar name={reward.member?.display_name} src={reward.member?.avatar_url} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-slate-800">{reward.member?.display_name ?? 'Unknown member'}</p>
                        <p className="truncate text-[11px] text-slate-400">{reward.reward_description}</p>
                      </div>
                      <RewardApprovalActions rewardId={reward.id} canApprove={capabilities.approveRewards} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent activity" viewAllHref="/app/community">
              <ActivityFeed items={activity} />
            </Panel>

            <Panel title="Advocacy opportunities">
              {aggregates.ugcSubmissions === 0 ? (
                <p className="py-2 text-[12.5px] text-slate-600">No UGC submissions yet — consider launching a UGC programme.</p>
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
