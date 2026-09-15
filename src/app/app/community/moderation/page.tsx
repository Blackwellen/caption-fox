import Link from 'next/link'
import { Ban, Eye, Flag, ShieldAlert, UserPlus } from 'lucide-react'
import { requireCommunityModule } from '@/lib/community/server'
import {
  getModerationReport, listModerationReports, moderationAggregates, moderationDecisions,
  moderatorWorkload, policyCoverage, recentActivity, workspaceMembers,
} from '@/lib/community/data'
import { buildHref, hasAnyFilter, parseModerationQuery, type RawParams } from '@/lib/community/query'
import {
  MODERATION_CONTENT_TYPE_LABELS, MODERATION_CONTENT_TYPES, MODERATION_REASON_LABELS,
  MODERATION_REASONS, MODERATION_SEVERITIES, MODERATION_SEVERITY_BADGE, MODERATION_SEVERITY_LABELS,
  MODERATION_SORTS, MODERATION_STATUS_BADGE, MODERATION_STATUS_LABELS, MODERATION_STATUSES,
} from '@/lib/community/constants'
import CommunityHeader from '@/components/community/CommunityHeader'
import KpiStrip from '@/components/community/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/community/FilterBar'
import Pagination from '@/components/community/Pagination'
import ActivityFeed from '@/components/community/ActivityFeed'
import ModerationDecisionActions from '@/components/community/ModerationDecisionActions'
import { TrendChart, DonutChart, DonutLegend, seriesToPoints } from '@/components/community/charts'
import { AccessBlocked, CommunityEmpty, LoadError, PanelEmpty } from '@/components/community/states'
import {
  Avatar, CARD, CARD_SHADOW, COMMUNITY_PAGE, Panel, PersonChip, formatAgo, formatDateTime,
  formatHours, formatNumber, formatPercent,
} from '@/components/community/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/community/types'

export const metadata = { title: 'Community Moderation · Caption Fox' }

export default async function ModerationPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCommunityModule('moderation')

  if (!access.allowed) {
    return (
      <div className={COMMUNITY_PAGE}>
        <CommunityHeader module="moderation" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseModerationQuery(params)
  const workspaceId = ctx.workspaceId

  const [aggregates, page, coverage, workload, activity, members] = await Promise.all([
    moderationAggregates(supabase, workspaceId),
    listModerationReports(supabase, workspaceId, query),
    policyCoverage(supabase, workspaceId),
    moderatorWorkload(supabase, workspaceId),
    recentActivity(supabase, workspaceId, 6, { entityType: 'moderation' }),
    workspaceMembers(supabase, workspaceId),
  ])

  const selectedId = query.selected || page.rows[0]?.id || ''
  const [selectedReport, decisions] = selectedId
    ? await Promise.all([
      getModerationReport(supabase, workspaceId, selectedId),
      moderationDecisions(supabase, workspaceId, selectedId),
    ])
    : [null, []]

  const filters: FilterSpec[] = [
    { key: 'contentType', label: 'Content type', allLabel: 'All content', options: MODERATION_CONTENT_TYPES.map(t => ({ value: t, label: MODERATION_CONTENT_TYPE_LABELS[t] })) },
    { key: 'severity', label: 'Severity', allLabel: 'All severities', options: MODERATION_SEVERITIES.map(s => ({ value: s, label: MODERATION_SEVERITY_LABELS[s] })) },
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: MODERATION_STATUSES.map(s => ({ value: s, label: MODERATION_STATUS_LABELS[s] })) },
    { key: 'reason', label: 'Reason', allLabel: 'All reasons', options: MODERATION_REASONS.map(r => ({ value: r, label: MODERATION_REASON_LABELS[r] })), advanced: true },
    { key: 'assignee', label: 'Assignee', allLabel: 'All moderators', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })), advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Newest', options: MODERATION_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const reviewDelta = aggregates.avgReviewHours !== null && aggregates.previousAvgReviewHours !== null
    ? aggregates.avgReviewHours - aggregates.previousAvgReviewHours : 0

  const kpis: KpiValue[] = [
    { id: 'pending', label: 'Pending queue', value: formatNumber(aggregates.pending), hint: `${aggregates.pending - aggregates.previousPending >= 0 ? '+' : ''}${formatNumber(aggregates.pending - aggregates.previousPending)} vs last 30 days`, trend: aggregates.pending > aggregates.previousPending ? 'up' : 'down', icon: 'flag', tone: 'amber' },
    { id: 'critical', label: 'Critical reports', value: formatNumber(aggregates.critical), hint: aggregates.critical > 0 ? 'Needs urgent review' : 'None open', icon: 'shieldAlert', tone: aggregates.critical > 0 ? 'red' : 'slate' },
    { id: 'spam', label: 'Spam detected', value: formatNumber(aggregates.spam), hint: 'All time', icon: 'shieldAlert', tone: 'amber' },
    { id: 'resolved', label: 'Resolved today', value: formatNumber(aggregates.resolvedToday), hint: `${aggregates.resolvedToday - aggregates.previousResolvedToday >= 0 ? '+' : ''}${formatNumber(aggregates.resolvedToday - aggregates.previousResolvedToday)} vs yesterday's pace`, trend: aggregates.resolvedToday >= aggregates.previousResolvedToday ? 'up' : 'down', icon: 'checks', tone: 'green' },
    { id: 'repeat', label: 'Repeat offenders', value: formatNumber(aggregates.repeatOffenders), hint: 'Members with 2+ reports', icon: 'userCheck', tone: aggregates.repeatOffenders > 0 ? 'red' : 'slate' },
    { id: 'reviewTime', label: 'Avg review time', value: formatHours(aggregates.avgReviewHours), hint: aggregates.avgReviewHours !== null ? `${reviewDelta <= 0 ? '' : '+'}${formatHours(Math.abs(reviewDelta))} vs last 30 days` : 'No resolved reports yet', trend: reviewDelta <= 0 ? 'up' : 'down', icon: 'clock', tone: 'blue' },
  ]

  return (
    <div className={COMMUNITY_PAGE}>
      <CommunityHeader
        module="moderation" modules={modules}
        actions={(
          <>
            {capabilities.manageModerationRules && (
              <Link href="/app/community/moderation?new=rule" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700">
                <ShieldAlert size={15} />Create rule
              </Link>
            )}
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <FilterBar
          searchPlaceholder="Search reports or posts…"
          filters={filters}
          values={query}
        />

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
            {page.error ? (
              <div className="p-4"><LoadError message={page.error} /></div>
            ) : page.rows.length === 0 ? (
              <div className="p-4">
                <CommunityEmpty
                  icon={filtered ? 'search' : 'community'}
                  title={filtered ? 'No reports match these filters' : 'Queue is clear'}
                  message={filtered ? 'Try widening your filters.' : 'New reports will appear here as members flag content.'}
                />
              </div>
            ) : (
              <>
                <p className="border-b border-slate-100 px-4 py-2.5 text-[12px] text-slate-400">{page.total} reports</p>
                <ul className="divide-y divide-slate-100">
                  {page.rows.map(report => {
                    const active = report.id === selectedId
                    return (
                      <li key={report.id}>
                        <Link
                          href={buildHref('/app/community/moderation', query, { selected: report.id })}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${active ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <Avatar name={report.reported_member?.display_name} src={report.reported_member?.avatar_url} size={30} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] text-slate-700">
                              <span className="font-medium text-slate-900">@{report.reported_member?.display_name ?? 'unknown'}</span>
                              {' — '}{report.content_excerpt ?? 'No excerpt available'}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">{report.community?.name ?? 'Unknown community'} · {formatAgo(report.created_at)} · {report.report_count} {report.report_count === 1 ? 'report' : 'reports'}</p>
                          </div>
                          <Badge variant={MODERATION_SEVERITY_BADGE[report.severity as keyof typeof MODERATION_SEVERITY_BADGE] ?? 'slate'}>
                            {MODERATION_SEVERITY_LABELS[report.severity as keyof typeof MODERATION_SEVERITY_LABELS] ?? report.severity}
                          </Badge>
                          <Badge variant={MODERATION_STATUS_BADGE[report.status as keyof typeof MODERATION_STATUS_BADGE] ?? 'slate'}>
                            {MODERATION_STATUS_LABELS[report.status as keyof typeof MODERATION_STATUS_LABELS] ?? report.status}
                          </Badge>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <Pagination page={query.page} size={query.size} total={page.total} label="reports" />
              </>
            )}
          </div>

          <div className={`${CARD} ${CARD_SHADOW} flex flex-col overflow-hidden`}>
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-[13px] font-semibold text-slate-900">Selected report</h2>
            </div>
            <div className="flex-1 space-y-4 p-4">
              {!selectedReport ? (
                <PanelEmpty message="Select a report from the queue to review it." />
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={selectedReport.reported_member?.display_name} src={selectedReport.reported_member?.avatar_url} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">@{selectedReport.reported_member?.display_name ?? 'unknown'}</p>
                      <p className="text-[11px] text-slate-400">Report ID {selectedReport.id.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-2.5 text-[12.5px] text-slate-700">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{MODERATION_CONTENT_TYPE_LABELS[selectedReport.content_type as keyof typeof MODERATION_CONTENT_TYPE_LABELS] ?? selectedReport.content_type} in {selectedReport.community?.name ?? 'Unknown community'}</p>
                    <p className="mt-1">{selectedReport.content_excerpt ?? 'No excerpt available'}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Reported by</p>
                    <p className="mt-1 text-[12.5px] text-slate-700">
                      {selectedReport.reporter_member?.display_name ?? 'Anonymous'} · Reason: <span className="font-medium">{MODERATION_REASON_LABELS[selectedReport.reason as keyof typeof MODERATION_REASON_LABELS] ?? selectedReport.reason}</span>
                    </p>
                  </div>

                  {selectedReport.ai_risk_score !== null && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">AI risk signal</p>
                      <p className="mt-1 text-[12.5px] text-slate-700">
                        Risk score <span className="font-semibold text-slate-900">{selectedReport.ai_risk_score.toFixed(0)}/100</span> — advisory only, always confirmed by a human moderator.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Decision history</p>
                    {decisions.length === 0 ? (
                      <p className="mt-1 text-[12.5px] text-slate-400">No decisions recorded yet.</p>
                    ) : (
                      <ul className="mt-1 space-y-1.5">
                        {decisions.map(decision => (
                          <li key={decision.id} className="text-[12px] text-slate-600">
                            <PersonChip person={decision.moderator} /> — {decision.decision.replace('_', ' ')} <span className="text-slate-400">({formatDateTime(decision.created_at)})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <ModerationDecisionActions
                      reportId={selectedReport.id}
                      status={selectedReport.status}
                      canApprove={capabilities.reviewModeration}
                      canRemove={capabilities.removeContent}
                      canWarn={capabilities.warnUser}
                      canSuspend={capabilities.suspendUser}
                      canBan={capabilities.banUser}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Reports trend">
                <TrendChart data={seriesToPoints(aggregates.reportsSeries, 'reports')} series={[{ key: 'reports', label: 'Reports', colour: '#ef4444' }]} height={160} />
              </Panel>
              <Panel title="Reason distribution">
                <div className="flex items-center gap-4">
                  <DonutChart slices={aggregates.byReason} total={aggregates.byReason.reduce((s, r) => s + r.value, 0)} caption="Total" size={140} />
                  <DonutLegend slices={aggregates.byReason} total={aggregates.byReason.reduce((s, r) => s + r.value, 0)} className="flex-1" />
                </div>
              </Panel>
            </div>

            <Panel title="Moderator workload">
              {workload.length === 0 ? (
                <CommunityEmpty title="No assigned reports" message="Assign reports to moderators to see workload here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3 font-medium">Moderator</th>
                        <th className="px-3 py-2 font-medium">In queue</th>
                        <th className="px-3 py-2 font-medium">Resolved today</th>
                        <th className="px-3 py-2 font-medium">Avg review time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {workload.map((row, i) => (
                        <tr key={i}>
                          <td className="py-2.5 pr-3"><PersonChip person={row.moderator} /></td>
                          <td className="px-3 py-2.5 text-slate-700">{row.assigned - row.resolved}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.resolved}</td>
                          <td className="px-3 py-2.5 text-slate-500">{formatHours(row.avgHours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Recent moderation activity" viewAllHref="/app/community">
              <ActivityFeed items={activity} />
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Next actions">
              <ul className="space-y-1">
                {aggregates.critical > 0 && (
                  <li><Link href="/app/community/moderation?severity=critical" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><Flag size={13} className="text-red-500" />Review {aggregates.critical} critical reports<Badge variant="red" className="ml-auto">{aggregates.critical}</Badge></Link></li>
                )}
                {aggregates.pending > 0 && (
                  <li><Link href="/app/community/moderation" className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50"><Eye size={13} className="text-amber-500" />Triage {aggregates.pending} pending reports<Badge variant="amber" className="ml-auto">{aggregates.pending}</Badge></Link></li>
                )}
                {aggregates.pending === 0 && aggregates.critical === 0 && <li className="px-1 py-3 text-center text-[12.5px] text-slate-400">You&apos;re all caught up.</li>}
              </ul>
            </Panel>

            <Panel title="Moderation alerts">
              <ul className="space-y-2 text-[12.5px]">
                {aggregates.critical > 0 && <li className="flex items-center gap-2 text-red-600"><Ban size={13} />{aggregates.critical} critical reports open</li>}
                {aggregates.repeatOffenders > 0 && <li className="flex items-center gap-2 text-amber-600"><UserPlus size={13} />{aggregates.repeatOffenders} repeat offenders flagged</li>}
                {aggregates.critical === 0 && aggregates.repeatOffenders === 0 && <li className="text-slate-400">No active alerts.</li>}
              </ul>
            </Panel>

            <Panel title="Policy coverage" info="Share of reports in each category resolved under an active policy.">
              {coverage.length === 0 ? (
                <CommunityEmpty title="No policies configured" message="Add moderation policies to track enforcement coverage." />
              ) : (
                <ul className="space-y-2.5">
                  {coverage.map(policy => (
                    <li key={policy.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-600">{policy.category}</span>
                        <span className="font-medium text-slate-900">{formatPercent(policy.coverage_pct, 0)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, policy.coverage_pct)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
