import Link from 'next/link'
import { PlayCircle } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  creatorPickerList, flaggedIssueCounts, listBriefs, listSubmissions,
  recentActivity, submissionAggregates, workspaceCampaigns, workspaceMembers, delta,
} from '@/lib/creators/data'
import { parseSubmissionsQuery, hasAnyFilter, type RawParams } from '@/lib/creators/query'
import {
  ASSET_TYPES, ASSET_TYPE_LABELS, CHANNEL_LABELS, CREATOR_CHANNELS,
  ISSUE_CATEGORIES, ISSUE_CATEGORY_LABELS, SUBMISSION_BOARD_STAGES,
  SUBMISSION_STATUS_BADGE, SUBMISSION_STATUS_COLOUR, SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUSES, type SubmissionStatus,
} from '@/lib/creators/constants'
import CreatorsHeader from '@/components/creators/CreatorsHeader'
import KpiStrip from '@/components/creators/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/creators/FilterBar'
import Pagination from '@/components/creators/Pagination'
import ActivityFeed from '@/components/creators/ActivityFeed'
import BulkApproveButton from '@/components/creators/BulkApproveButton'
import ExportButton, { HeaderOverflow } from '@/components/creators/ExportButton'
import { AccessBlocked, CreatorsEmpty, LoadError, PanelEmpty } from '@/components/creators/states'
import {
  Avatar, CARD, CARD_SHADOW, CREATORS_PAGE, CreatorChip, Panel,
  formatAgo, formatDuration, formatHoursMinutes, formatNumber, formatPercent,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/creators/types'

export const metadata = { title: 'Submissions · Caption Fox' }

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCreatorModule('submissions')

  if (!access.allowed) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="submissions" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseSubmissionsQuery(params)

  const [aggregates, page, issues, activity, briefs, campaigns, members, creators] = await Promise.all([
    submissionAggregates(supabase, ctx.workspaceId),
    listSubmissions(supabase, ctx.workspaceId, query),
    flaggedIssueCounts(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, 5, { entityType: 'submission' }),
    listBriefs(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 100, from: '', to: '', campaign: '', channel: '', owner: '', status: '',
      approval: '', creator: '', rights: '', due: '', budgetMin: null, budgetMax: null, archived: false, sort: 'recent', view: 'table',
    }, { all: true, limit: 200 }),
    workspaceCampaigns(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
    creatorPickerList(supabase, ctx.workspaceId),
  ])

  const waitingDelta = delta(aggregates.byStatus.waiting_review, aggregates.previous.waiting)
  const reviewDelta = delta(aggregates.byStatus.in_review, aggregates.previous.inReview)
  const approvedDelta = delta(aggregates.byStatus.approved + aggregates.byStatus.published, aggregates.previous.approved)
  const changesDelta = delta(aggregates.byStatus.changes_requested, aggregates.previous.changes)
  const reviewTimeDelta = aggregates.avgReviewSeconds !== null && aggregates.previous.avgReviewSeconds !== null
    ? delta(aggregates.avgReviewSeconds, aggregates.previous.avgReviewSeconds) : null

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total Submissions', value: formatNumber(aggregates.total), icon: 'file', tone: 'blue' },
    { id: 'waiting', label: 'Waiting Review', value: formatNumber(aggregates.byStatus.waiting_review), hint: `${waitingDelta.pct >= 0 ? '+' : ''}${waitingDelta.pct.toFixed(1)}% vs last 30 days`, trend: waitingDelta.trend, icon: 'clock', tone: 'amber' },
    { id: 'in-review', label: 'In Review', value: formatNumber(aggregates.byStatus.in_review), hint: `${reviewDelta.pct >= 0 ? '+' : ''}${reviewDelta.pct.toFixed(1)}% vs last 30 days`, trend: reviewDelta.trend, icon: 'gauge', tone: 'violet' },
    { id: 'approved', label: 'Approved', value: formatNumber(aggregates.byStatus.approved + aggregates.byStatus.published), hint: `${approvedDelta.pct >= 0 ? '+' : ''}${approvedDelta.pct.toFixed(1)}% vs last 30 days`, trend: approvedDelta.trend, icon: 'shieldCheck', tone: 'green' },
    { id: 'changes', label: 'Changes Requested', value: formatNumber(aggregates.byStatus.changes_requested), hint: `${changesDelta.pct >= 0 ? '+' : ''}${changesDelta.pct.toFixed(1)}% vs last 30 days`, trend: changesDelta.trend, icon: 'shieldAlert', tone: 'red' },
    { id: 'review-time', label: 'Avg. Review Time', value: formatHoursMinutes(aggregates.avgReviewSeconds), hint: reviewTimeDelta ? `${reviewTimeDelta.pct >= 0 ? '+' : ''}${reviewTimeDelta.pct.toFixed(1)}% vs last 30 days` : undefined, trend: reviewTimeDelta ? (reviewTimeDelta.trend === 'up' ? 'down' : reviewTimeDelta.trend === 'down' ? 'up' : 'flat') : undefined, icon: 'clock', tone: 'blue' },
  ]

  const filters: FilterSpec[] = [
    { key: 'creator', label: 'Creator', allLabel: 'All Creators', options: creators.map(c => ({ value: c.id, label: c.name })) },
    { key: 'brief', label: 'Brief', allLabel: 'All Briefs', options: briefs.rows.map(b => ({ value: b.id, label: b.title })) },
    { key: 'assetType', label: 'Asset Type', allLabel: 'All Types', options: ASSET_TYPES.map(t => ({ value: t, label: ASSET_TYPE_LABELS[t] })) },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: SUBMISSION_STATUSES.map(s => ({ value: s, label: SUBMISSION_STATUS_LABELS[s] })) },
    { key: 'reviewer', label: 'Reviewer', allLabel: 'All Reviewers', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })), advanced: true },
    { key: 'campaign', label: 'Campaign', allLabel: 'All Campaigns', options: campaigns.map(c => ({ value: c.id, label: c.name })), advanced: true },
    { key: 'channel', label: 'Channel', allLabel: 'All Channels', options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })), advanced: true },
    { key: 'issue', label: 'Issue', allLabel: 'All Issues', options: ISSUE_CATEGORIES.map(c => ({ value: c, label: ISSUE_CATEGORY_LABELS[c] })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const reviewableIds = page.rows.filter(row => row.status === 'waiting_review' || row.status === 'in_review').map(row => row.id)

  return (
    <div className={CREATORS_PAGE}>
      <CreatorsHeader
        module="submissions" modules={modules}
        actions={(
          <>
            <Link href="/app/creators/submissions?status=waiting_review" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              Review Queue
            </Link>
            {capabilities.bulkApprove && <BulkApproveButton ids={reviewableIds} />}
            <ExportButton entity="submissions" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data', onSelect: 'refresh' }]} />
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search submissions…" filters={filters}
              views={['gallery', 'table', 'board']} activeView={query.view} values={query}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CreatorsEmpty
                icon={filtered ? 'search' : 'creators'}
                title={filtered ? 'No submissions match these filters' : 'No submissions yet'}
                message={filtered ? 'Try widening your filters or clearing the search term.' : 'Submissions will appear here once creators deliver work against a brief.'}
              />
            ) : query.view === 'table' ? (
              <SubmissionTable rows={page.rows} />
            ) : query.view === 'board' ? (
              <SubmissionBoard rows={page.rows} />
            ) : (
              <SubmissionGallery rows={page.rows} />
            )}

            {page.rows.length > 0 && (
              <div className={`${CARD} ${CARD_SHADOW}`}>
                <Pagination page={query.page} size={query.size} total={page.total} label="submissions" />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title="Review Summary" viewAllHref="/app/analytics">
              <ul className="space-y-2 text-[12.5px]">
                <li className="flex justify-between"><span className="text-slate-600">First-time approval rate</span><span className="font-semibold text-slate-900">{formatPercent(aggregates.firstTimeApprovalRate, 0)}</span></li>
                <li className="flex justify-between"><span className="text-slate-600">Waiting + in review</span><span className="font-semibold text-slate-900">{aggregates.byStatus.waiting_review + aggregates.byStatus.in_review}</span></li>
                <li className="flex justify-between"><span className="text-slate-600">Rejected</span><span className="font-semibold text-red-600">{aggregates.byStatus.rejected}</span></li>
              </ul>
            </Panel>

            <Panel title="Flagged Issues" viewAllHref="/app/creators/submissions?issue=brand_guideline">
              {issues.length === 0 ? <PanelEmpty message="No open issues flagged on any submission." /> : (
                <ul className="space-y-2">
                  {issues.slice(0, 6).map(issue => (
                    <li key={issue.category} className="flex items-center justify-between text-[12.5px]">
                      <span className="truncate text-slate-600">{ISSUE_CATEGORY_LABELS[issue.category as keyof typeof ISSUE_CATEGORY_LABELS] ?? issue.category}</span>
                      <Badge variant="red">{issue.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Approval Activity" viewAllHref="/app/creators">
              <ActivityFeed items={activity} />
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}

function SubmissionGallery({ rows }: { rows: Awaited<ReturnType<typeof listSubmissions>>['rows'] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map(submission => (
        <Link
          key={submission.id} href={`/app/creators/submissions/${submission.id}`}
          className={`${CARD} ${CARD_SHADOW} overflow-hidden transition-colors hover:border-slate-300`}
        >
          <div className="relative aspect-video bg-slate-100">
            {submission.thumbnail_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={submission.thumbnail_url} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center text-slate-300"><PlayCircle size={28} /></span>}
            <span className="absolute left-2 top-2"><Badge variant={SUBMISSION_STATUS_BADGE[submission.status as SubmissionStatus]}>{SUBMISSION_STATUS_LABELS[submission.status as SubmissionStatus]}</Badge></span>
            {submission.duration_seconds && (
              <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">{formatDuration(submission.duration_seconds)}</span>
            )}
          </div>
          <div className="p-3">
            <p className="truncate text-[13px] font-medium text-slate-900">{submission.title ?? `Submission #${submission.id.slice(0, 6)}`}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Avatar name={submission.creator?.name} src={submission.creator?.avatar_url} size={18} />
              <span className="truncate text-[11px] text-slate-500">{submission.creator?.name ?? 'Unknown creator'}</span>
              <span className="ml-auto shrink-0 text-[11px] text-slate-400">{formatAgo(submission.submitted_at)}</span>
            </div>
            {submission.issue_count > 0 && (
              <p className="mt-1.5 text-[11px] font-medium text-red-600">{submission.issue_count} issue{submission.issue_count === 1 ? '' : 's'} flagged</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function SubmissionTable({ rows }: { rows: Awaited<ReturnType<typeof listSubmissions>>['rows'] }) {
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Submission</th>
              <th className="px-3 py-2.5 font-medium">Creator</th>
              <th className="px-3 py-2.5 font-medium">Brief</th>
              <th className="px-3 py-2.5 font-medium">Asset Type</th>
              <th className="px-3 py-2.5 font-medium">Submitted</th>
              <th className="px-3 py-2.5 font-medium">Reviewer</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Rights</th>
              <th className="px-3 py-2.5 font-medium">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(submission => (
              <tr key={submission.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <Link href={`/app/creators/submissions/${submission.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                    {submission.title ?? `Submission #${submission.id.slice(0, 6)}`}
                  </Link>
                </td>
                <td className="px-3 py-2.5"><CreatorChip creator={submission.creator} size={22} /></td>
                <td className="px-3 py-2.5 text-slate-500">{submission.brief?.title ?? '—'}</td>
                <td className="px-3 py-2.5 text-slate-600">{ASSET_TYPE_LABELS[submission.asset_type as keyof typeof ASSET_TYPE_LABELS] ?? submission.asset_type}</td>
                <td className="px-3 py-2.5 text-slate-500">{formatAgo(submission.submitted_at)}</td>
                <td className="px-3 py-2.5 text-slate-500">{submission.reviewer?.full_name ?? submission.reviewer?.email ?? '—'}</td>
                <td className="px-3 py-2.5"><Badge variant={SUBMISSION_STATUS_BADGE[submission.status as SubmissionStatus]}>{SUBMISSION_STATUS_LABELS[submission.status as SubmissionStatus]}</Badge></td>
                <td className="px-3 py-2.5 text-slate-500 capitalize">{submission.rights_status}</td>
                <td className="px-3 py-2.5">{submission.issue_count > 0 ? <Badge variant="red">{submission.issue_count}</Badge> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SubmissionBoard({ rows }: { rows: Awaited<ReturnType<typeof listSubmissions>>['rows'] }) {
  const columns = SUBMISSION_BOARD_STAGES.map(stage => ({ stage, items: rows.filter(row => row.status === stage) }))
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <div className="flex gap-3 overflow-x-auto p-3">
        {columns.map(({ stage, items }) => (
          <div key={stage} className="w-64 shrink-0 rounded-xl bg-slate-50/70 p-2.5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SUBMISSION_STATUS_COLOUR[stage] }} aria-hidden />
              <p className="text-[12.5px] font-semibold text-slate-700">{SUBMISSION_STATUS_LABELS[stage]}</p>
              <span className="ml-auto text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-2 py-4 text-center text-[11px] text-slate-400">Nothing here</p>}
              {items.map(submission => (
                <Link key={submission.id} href={`/app/creators/submissions/${submission.id}`} className="block rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:border-slate-300">
                  <p className="truncate text-[12.5px] font-medium text-slate-900">{submission.title ?? `Submission #${submission.id.slice(0, 6)}`}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{submission.creator?.name ?? 'Unknown creator'}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
