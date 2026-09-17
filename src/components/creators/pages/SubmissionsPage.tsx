import Link from 'next/link'
import { CheckCircle2, Heart, MessageCircle, MoreHorizontal, Play, ScanSearch, XCircle } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  creatorPickerList, flaggedIssueCounts, listBriefs, listSubmissions, recentActivity, reviewQueue, reviewQueueCount,
  submissionAggregates, workspaceReviewers,
} from '@/lib/creators/data'
import { parseBriefsQuery, parseSubmissionsQuery } from '@/lib/creators/query'
import {
  ASSET_TYPE_LABELS, ASSET_TYPES, ISSUE_CATEGORY_LABELS, SUBMISSION_BOARD_STAGES, SUBMISSION_SORTS,
  SUBMISSION_STATUS_LABELS, SUBMISSION_STATUSES, type IssueCategory, type SubmissionStatus,
} from '@/lib/creators/constants'
import type { SubmissionRow } from '@/lib/creators/types'
import { cn } from '@/lib/utils'
import BulkApproveButton from '../BulkApproveButton'
import QueueActions from '../QueueActions'
import {
  DateRangeControl, ExportMenu, Pager, SearchBox, SelectControl, SettingsMenu, ViewToggle,
} from '../controls'
import {
  Avatar, BUTTON_PRIMARY, CARD, DotLabel, Donut, Kpi, KpiGrid, Legend, MediaChip, Panel, PanelEmpty, Pill, TD, TH,
  Thumb, type Slice, type Tone,
} from '../design'
import { formatAgo, formatCompact, formatDuration, formatHoursMinutes, formatPercent } from '../primitives'
import { CreatorsFrame, kpiDelta, link, type RawSearchParams } from './shared'

const TONE_BY_STATUS: Record<string, Tone> = {
  draft: 'slate', waiting_review: 'amber', in_review: 'violet', changes_requested: 'red', approved: 'green', rejected: 'red', published: 'green',
}
const SUMMARY_COLOUR: Record<string, string> = { waiting_review: '#f59e0b', in_review: '#8b5cf6', approved: '#22c55e', changes_requested: '#ef4444', rejected: '#94a3b8' }

const dateTime = (iso: string) => {
  const d = new Date(iso)
  return {
    date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(d),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' }).format(d),
  }
}

export default async function SubmissionsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const { access, ...session } = await requireCreatorModule('submissions')
  const { supabase, ctx, capabilities, basePath, userId } = session
  const query = parseSubmissionsQuery(searchParams)
  if (!access.allowed) return <CreatorsFrame session={session} module="submissions" access={access}>{null}</CreatorsFrame>

  const size = query.view === 'gallery' ? Math.min(query.size, 8) : query.size
  const [page, board, aggregates, queue, queueCount, issues, activity, creators, briefs, reviewers] = await Promise.all([
    listSubmissions(supabase, ctx.workspaceId, { ...query, size }),
    query.view === 'board' ? listSubmissions(supabase, ctx.workspaceId, query, { all: true, limit: 300 }) : Promise.resolve(null),
    submissionAggregates(supabase, ctx.workspaceId),
    reviewQueue(supabase, ctx.workspaceId, 5),
    reviewQueueCount(supabase, ctx.workspaceId),
    flaggedIssueCounts(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, 5, { surface: 'submissions' }),
    creatorPickerList(supabase, ctx.workspaceId),
    listBriefs(supabase, ctx.workspaceId, { ...parseBriefsQuery({}), sort: 'name_asc' }, { all: true, limit: 200 }),
    workspaceReviewers(supabase, ctx.workspaceId),
  ])

  const reviewDelta = aggregates.avgReviewSeconds !== null && aggregates.previous.avgReviewSeconds !== null
    ? (aggregates.avgReviewSeconds - aggregates.previous.avgReviewSeconds) / 3600 : null
  const approved = aggregates.byStatus.approved + aggregates.byStatus.published

  const kpis: Kpi[] = [
    { id: 'total', label: 'Total Submissions', value: aggregates.total.toLocaleString('en-GB'), tone: 'blue', icon: 'users', spark: aggregates.submittedSeries, href: `${basePath}/submissions`, ...kpiDelta(aggregates.total, aggregates.previous.total) },
    { id: 'waiting', label: 'Waiting Review', value: String(aggregates.byStatus.waiting_review), tone: 'orange', icon: 'clock', spark: aggregates.submittedSeries, href: `${basePath}/submissions?status=waiting_review`, ...kpiDelta(aggregates.byStatus.waiting_review, aggregates.previous.waiting) },
    { id: 'in_review', label: 'In Review', value: String(aggregates.byStatus.in_review), tone: 'violet', icon: 'money', spark: aggregates.submittedSeries, href: `${basePath}/submissions?status=in_review`, ...kpiDelta(aggregates.byStatus.in_review, aggregates.previous.inReview) },
    { id: 'approved', label: 'Approved', value: approved.toLocaleString('en-GB'), tone: 'green', icon: 'shield', spark: aggregates.submittedSeries, href: `${basePath}/submissions?status=approved`, ...kpiDelta(approved, aggregates.previous.approved) },
    { id: 'changes', label: 'Changes Requested', value: String(aggregates.byStatus.changes_requested), tone: 'red', icon: 'refresh', spark: aggregates.submittedSeries, href: `${basePath}/submissions?status=changes_requested`, ...kpiDelta(aggregates.byStatus.changes_requested, aggregates.previous.changes) },
    { id: 'review_time', label: 'Avg. Review Time', value: formatHoursMinutes(aggregates.avgReviewSeconds), tone: 'blue', icon: 'timer', spark: aggregates.submittedSeries,
      delta: reviewDelta === null ? 'Start of review to decision' : `${Math.abs(reviewDelta).toFixed(1)}h vs last 30 days`, trend: reviewDelta === null ? 'flat' : reviewDelta <= 0 ? 'down' : 'up' },
  ]

  const summary: Slice[] = (['waiting_review', 'in_review', 'approved', 'changes_requested', 'rejected'] as SubmissionStatus[]).map(key => ({
    key, label: SUBMISSION_STATUS_LABELS[key], value: key === 'approved' ? approved : aggregates.byStatus[key], colour: SUMMARY_COLOUR[key], href: `${basePath}/submissions?status=${key}`,
  }))
  const summaryTotal = summary.reduce((a, s) => a + s.value, 0)
  const reviewable = page.rows.filter(r => r.status === 'waiting_review' || r.status === 'in_review').map(r => r.id)
  const hasFilters = Boolean(query.q || query.creator || query.brief || query.assetType || query.status || query.reviewer || query.from || query.rights || query.issue)

  return (
    <CreatorsFrame
      session={session} module="submissions" access={access}
      actions={(
        <>
          <Link href={queue[0] ? `${basePath}/submissions/${queue[0].id}` : `${basePath}/submissions?status=waiting_review`} className={BUTTON_PRIMARY}>
            <ScanSearch size={16} aria-hidden />Review Queue
            <span className="ml-1 rounded-full bg-white px-[6px] text-[10px] font-semibold text-[#1d6bf3]">{queueCount}</span>
          </Link>
          {capabilities.bulkApprove && <BulkApproveButton ids={reviewable} />}
          <ExportMenu entity="submissions" allowed={capabilities.export} />
        </>
      )}
    >
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-[16px] xl:grid-cols-[898fr_234fr]">
        <div className="min-w-0">
          <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
            <SearchBox placeholder="Search submissions..." width={200} />
            <SelectControl spec={{ key: 'creator', label: 'Creator', all: 'Creator', width: 100, options: creators.map(c => ({ value: c.id, label: c.name })) }} />
            <SelectControl spec={{ key: 'brief', label: 'Brief', all: 'Brief', width: 78, options: briefs.rows.map(b => ({ value: b.id, label: b.title })) }} />
            <SelectControl spec={{ key: 'assetType', label: 'Asset type', all: 'Asset Type', width: 100, options: ASSET_TYPES.map(t => ({ value: t, label: ASSET_TYPE_LABELS[t] })) }} />
            <SelectControl spec={{ key: 'status', label: 'Status', all: 'Status', width: 82, options: SUBMISSION_STATUSES.map(s => ({ value: s, label: SUBMISSION_STATUS_LABELS[s] })) }} />
            <SelectControl spec={{ key: 'reviewer', label: 'Reviewer', all: 'Reviewer', width: 100, options: reviewers.map(r => ({ value: r.id, label: r.id === userId ? 'You' : r.full_name ?? r.email ?? 'Reviewer' })) }} />
            <DateRangeControl width={158} allLabel="Any date" />
          </div>

          <div className="mb-[10px] flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold text-[#101828]">{page.total.toLocaleString('en-GB')} results</p>
            <div className="ml-auto flex items-center gap-[10px]">
              <ViewToggle size="sm" active={query.view} views={[{ id: 'gallery', label: 'Gallery', icon: 'gallery' }, { id: 'table', label: 'Table', icon: 'table' }, { id: 'board', label: 'Board', icon: 'board' }]} />
              <SelectControl spec={{ key: 'sort', label: 'Sort by', all: 'Sort by: Newest', width: 118, options: SUBMISSION_SORTS.filter(s => s.id !== 'newest').map(s => ({ value: s.id, label: `Sort by: ${s.label}` })) }} />
              <SettingsMenu defaultSort="newest" sorts={SUBMISSION_SORTS.map(s => ({ value: s.id, label: s.label }))} extra={[
                { key: 'issue', label: 'Flagged issue', all: 'Any issue', options: Object.entries(ISSUE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })) },
              ]} />
            </div>
          </div>

          {page.error ? <PanelEmpty className="text-red-600">We could not load submissions ({page.error}). Reference CF-CREATORS.</PanelEmpty>
            : page.rows.length === 0 ? (
              <div className={CARD}><PanelEmpty className="min-h-[240px]">{hasFilters ? 'No submissions match these filters.' : 'No submissions yet. Creator deliverables appear here once uploaded against a brief.'}</PanelEmpty></div>
            ) : query.view === 'table' ? (
              <SubmissionTable rows={page.rows} basePath={basePath} />
            ) : query.view === 'board' ? (
              <SubmissionBoard rows={board?.rows ?? []} basePath={basePath} />
            ) : (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-[13px] sm:grid-cols-2 lg:grid-cols-4">
                {page.rows.map(sub => <GalleryCard key={sub.id} sub={sub} basePath={basePath} />)}
              </ul>
            )}
          {query.view !== 'board' && page.total > size && (
            <Pager compact className="mt-3" page={query.page} size={size} total={page.total} noun="submissions" sizes={query.view === 'gallery' ? [8] : [10, 25, 50, 100]} />
          )}

          <section id="review-queue" className={cn(CARD, 'mt-[14px] min-w-0')} aria-labelledby="queue-title">
            <header className="flex items-center gap-[8px] px-[14px] pb-[6px] pt-[12px]">
              <h2 id="queue-title" className="text-[12.5px] font-semibold text-[#101828]">Review Queue</h2>
              <span className="rounded-md bg-[#eef4ff] px-[6px] text-[10px] font-semibold text-[#1d6bf3]">{queueCount}</span>
            </header>
            {queue.length === 0 ? <PanelEmpty>The review queue is clear.</PanelEmpty> : (
              <div className="relative overflow-x-auto px-[6px]">
                <table className="w-full min-w-[760px]">
                  <caption className="sr-only">Submissions waiting for review, oldest first</caption>
                  <thead className="border-b border-[#eef0f4]">
                    <tr className="h-[30px]">
                      {['Submission', 'Creator', 'Brief', 'Submitted At', 'Reviewer', 'Rights Status', 'Outcome', 'Actions'].map(h => (
                        <th key={h} scope="col" className={cn(TH, 'py-[6px] text-[9px]', h === 'Actions' && 'text-center')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(sub => {
                      const at = dateTime(sub.submitted_at)
                      return (
                        <tr key={sub.id} className="h-[37px] border-b border-[#f1f3f6] last:border-0">
                          <td className={TD}>
                            <span className="flex items-center gap-[9px]">
                              <span className="relative block h-[26px] w-[36px] shrink-0 overflow-hidden rounded-[4px]">
                                <Thumb src={sub.thumbnail_url} alt="" className="h-full w-full" />
                                {(sub.duration_seconds || sub.file_count > 1) && <span className="absolute bottom-0 left-0 bg-black/60 px-[2px] text-[7px] text-white">{sub.duration_seconds ? formatDuration(sub.duration_seconds) : `${sub.file_count} files`}</span>}
                              </span>
                              <span className="max-w-[120px] truncate text-[10px] font-medium text-[#101828]">{sub.title ?? 'Untitled'}</span>
                            </span>
                          </td>
                          <td className={TD}>
                            <span className="flex items-center gap-[7px]">
                              <Avatar name={sub.creator?.name} src={sub.creator?.avatar_url} size={22} />
                              <span className="leading-tight"><span className="block text-[9.5px] font-medium text-[#101828]">{sub.creator?.name}</span><span className="block text-[8.5px] text-[#8a94a6]">@{sub.creator?.handle}</span></span>
                            </span>
                          </td>
                          <td className={cn(TD, 'max-w-[110px] truncate text-[9.5px] text-[#475467]')}>{sub.brief?.title ?? '—'}</td>
                          <td className={cn(TD, 'text-[9.5px] leading-tight')}>{at.date}<span className="block text-[#8a94a6]">{at.time}</span></td>
                          <td className={cn(TD, 'text-[9.5px]')}>{sub.reviewer_id === userId ? 'You' : sub.reviewer?.full_name ?? 'Unassigned'}</td>
                          <td className={cn(TD, 'text-[9.5px]')}><DotLabel tone={sub.rights_status === 'active' ? 'green' : 'orange'}>{sub.rights_status === 'active' ? 'Active' : sub.rights_status === 'none' ? 'Pending' : sub.rights_status.replace(/_/g, ' ')}</DotLabel></td>
                          <td className={cn(TD, 'text-[9.5px] text-[#98a2b3]')}>{sub.status === 'in_review' ? 'In review' : '—'}</td>
                          <td className={cn(TD, 'text-center')}>
                            <QueueActions id={sub.id} status={sub.status} href={`${basePath}/submissions/${sub.id}`} canReview={capabilities.review} canApprove={capabilities.approve} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Link href={`${basePath}/submissions?status=waiting_review&sort=oldest&view=table`} className="block border-t border-[#f1f3f6] py-[10px] text-center text-[10px] font-medium text-[#1d6bf3] hover:underline">
              View all in queue →
            </Link>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-[14px]" aria-label="Review insights">
          <div className="flex items-center gap-[10px]">
            <div className="flex-1">
              <SelectControl spec={{ key: 'rights', label: 'Rights status', all: 'Rights Status', options: ['none', 'pending', 'requested', 'active', 'expired', 'restricted', 'revoked'].map(v => ({ value: v, label: v === 'none' ? 'No rights' : v[0].toUpperCase() + v.slice(1) })) }} />
            </div>
          </div>

          <Panel title="Review Summary" titleClassName="text-[12px]" action={<span className="text-[9.5px] text-[#475467]">All time</span>}>
            {summaryTotal === 0 ? <PanelEmpty>No submissions yet.</PanelEmpty> : (
              <>
                <div className="flex items-center gap-[8px]">
                  <Donut slices={summary} total={aggregates.total} caption="Total" size={82} thickness={13} />
                  <Legend slices={summary} total={aggregates.total} className="min-w-0 flex-1 space-y-[8px] [&_li]:text-[8px] [&_li_span]:!overflow-visible" />
                </div>
                <dl className="mt-[12px] grid grid-cols-2 border-t border-[#eef0f4] pt-[10px]">
                  <div>
                    <dt className="text-[8.5px] text-[#667085]">Avg. Review Time</dt>
                    <dd className="text-[13px] font-semibold text-[#101828]">{formatHoursMinutes(aggregates.avgReviewSeconds)}</dd>
                  </div>
                  <div className="border-l border-[#eef0f4] pl-[10px]">
                    <dt className="text-[8.5px] text-[#667085]">First Time Approval</dt>
                    <dd className="text-[13px] font-semibold text-[#101828]">{formatPercent(aggregates.firstTimeApprovalRate, 0)}</dd>
                  </div>
                </dl>
              </>
            )}
          </Panel>

          <Panel title="Flagged Issues" titleClassName="text-[12px]" href={`${basePath}/submissions?view=table&sort=issues_desc`}>
            {issues.length === 0 ? <PanelEmpty>No open issues. Issues flagged in review appear here.</PanelEmpty> : (
              <ul className="space-y-[9px]">
                {issues.slice(0, 5).map(issue => (
                  <li key={issue.category}>
                    <Link href={`${basePath}/submissions?issue=${issue.category}`} className="flex items-center justify-between text-[9.5px] text-[#344054] hover:underline">
                      {ISSUE_CATEGORY_LABELS[issue.category as IssueCategory] ?? issue.category}
                      <span className="rounded bg-[#fdeeee] px-[5px] text-[9px] font-semibold text-[#dc2626]">{issue.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Approval Activity" titleClassName="text-[12px]" href={`${basePath}/submissions?status=approved`} className="flex-1">
            {activity.length === 0 ? <PanelEmpty>Review decisions appear here.</PanelEmpty> : (
              <ul className="space-y-[12px]">
                {activity.map(item => {
                  const href = link(session, item.link)
                  const good = ['approved', 'bulk_approved', 'submitted'].includes(item.action)
                  const body = (
                    <span className="flex items-start gap-[8px]">
                      <Avatar name={item.actor?.full_name} src={item.actor?.avatar_url} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9.5px] leading-[13px] text-[#101828]">{item.summary}</span>
                        <span className="block text-[8.5px] text-[#98a2b3]">{formatAgo(item.created_at)}</span>
                      </span>
                      {good ? <CheckCircle2 size={14} className="mt-1 shrink-0 text-[#22c55e]" aria-label="Positive outcome" /> : <XCircle size={14} className="mt-1 shrink-0 text-[#ef4444]" aria-label="Needs attention" />}
                    </span>
                  )
                  return <li key={item.id}>{href ? <Link href={href} className="block rounded hover:bg-[#fafbfd]">{body}</Link> : body}</li>
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </CreatorsFrame>
  )
}

function GalleryCard({ sub, basePath }: { sub: SubmissionRow; basePath: string }) {
  return (
    <li className={cn(CARD, 'group relative overflow-hidden')}>
      <Link href={`${basePath}/submissions/${sub.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
        <span className="relative block aspect-[188/111] overflow-hidden">
          <Thumb src={sub.thumbnail_url} alt={sub.title ?? 'Submission preview'} className="h-full w-full transition-transform group-hover:scale-[1.02]" />
          <span className="absolute left-[8px] top-[8px]"><MediaChip tone={TONE_BY_STATUS[sub.status] ?? 'slate'}>{SUBMISSION_STATUS_LABELS[sub.status as SubmissionStatus] ?? sub.status}</MediaChip></span>
          <span className="absolute right-[8px] top-[7px] flex h-[16px] w-[16px] items-center justify-center rounded-full bg-black/25 text-white" aria-hidden><MoreHorizontal size={11} /></span>
          {(sub.duration_seconds || sub.file_count > 1) && (
            <span className="absolute bottom-[8px] right-[8px] inline-flex items-center gap-[3px] rounded bg-black/65 px-[5px] py-px text-[9px] font-medium text-white">
              {sub.duration_seconds ? <><Play size={8} className="fill-white" aria-hidden />{formatDuration(sub.duration_seconds)}</> : `${sub.file_count} files`}
            </span>
          )}
        </span>
        <span className="block px-[8px] pb-[9px] pt-[9px]">
          <span className="block truncate text-[10.5px] font-semibold text-[#101828]">{sub.title ?? 'Untitled submission'}</span>
          <span className="mt-[2px] block truncate text-[9px] text-[#8a94a6]">{sub.brief?.title ?? '—'}</span>
          <span className="mt-[8px] flex items-center gap-[7px]">
            <Avatar name={sub.creator?.name} src={sub.creator?.avatar_url} size={20} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[9.5px] font-medium text-[#101828]">{sub.creator?.name}</span>
              <span className="block truncate text-[8.5px] text-[#8a94a6]">@{sub.creator?.handle}</span>
            </span>
          </span>
          <span className="mt-[9px] flex items-center justify-between text-[9.5px] text-[#475467]">
            <span className="inline-flex items-center gap-[4px]"><Play size={11} aria-hidden /><span className="sr-only">Views</span>{sub.views ? formatCompact(sub.views) : '—'}</span>
            <span className="inline-flex items-center gap-[4px]"><Heart size={11} aria-hidden /><span className="sr-only">Engagement rate</span>{sub.engagement_rate ? formatPercent(sub.engagement_rate) : '—'}</span>
            <span className="inline-flex items-center gap-[4px]"><MessageCircle size={11} aria-hidden /><span className="sr-only">Comments</span>{sub.comments_count || '—'}</span>
          </span>
        </span>
      </Link>
    </li>
  )
}

function SubmissionTable({ rows, basePath }: { rows: SubmissionRow[]; basePath: string }) {
  return (
    <div className={cn(CARD, 'relative overflow-x-auto')}>
      <table className="w-full min-w-[760px]">
        <caption className="sr-only">Submissions</caption>
        <thead className="border-b border-[#eef0f4]">
          <tr className="h-[36px]">{['Submission', 'Creator', 'Brief', 'Asset Type', 'Submitted', 'Reviewer', 'Status', 'Rights', 'Issues'].map(h => <th key={h} scope="col" className={TH}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(sub => (
            <tr key={sub.id} className="h-[42px] border-b border-[#f1f3f6] last:border-0 hover:bg-[#fafbfd]">
              <td className={TD}>
                <Link href={`${basePath}/submissions/${sub.id}`} className="flex items-center gap-[9px] font-medium text-[#101828] hover:underline">
                  <Thumb src={sub.thumbnail_url} alt="" className="h-[26px] w-[36px] rounded-[4px]" /><span className="max-w-[150px] truncate text-[10.5px]">{sub.title ?? 'Untitled'}</span>
                </Link>
              </td>
              <td className={cn(TD, 'text-[10px]')}>{sub.creator?.name ?? '—'}</td>
              <td className={cn(TD, 'max-w-[120px] truncate text-[10px]')}>{sub.brief?.title ?? '—'}</td>
              <td className={cn(TD, 'text-[10px]')}>{ASSET_TYPE_LABELS[sub.asset_type as keyof typeof ASSET_TYPE_LABELS] ?? sub.asset_type}</td>
              <td className={cn(TD, 'text-[10px]')}>{formatAgo(sub.submitted_at)}</td>
              <td className={cn(TD, 'text-[10px]')}>{sub.reviewer?.full_name ?? 'Unassigned'}</td>
              <td className={TD}><Pill tone={TONE_BY_STATUS[sub.status] ?? 'slate'}>{SUBMISSION_STATUS_LABELS[sub.status as SubmissionStatus] ?? sub.status}</Pill></td>
              <td className={cn(TD, 'text-[10px] capitalize')}>{sub.rights_status.replace(/_/g, ' ')}</td>
              <td className={cn(TD, 'text-[10px] tabular-nums', sub.issue_count > 0 && 'font-semibold text-[#dc2626]')}>{sub.issue_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SubmissionBoard({ rows, basePath }: { rows: SubmissionRow[]; basePath: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
      {SUBMISSION_BOARD_STAGES.map(stage => {
        const column = rows.filter(r => r.status === stage || (stage === 'approved' && r.status === 'published'))
        return (
          <section key={stage} className={cn(CARD, 'min-w-0 p-[8px]')} aria-label={`${SUBMISSION_STATUS_LABELS[stage]} submissions`}>
            <header className="mb-[8px] flex items-center justify-between px-[2px]">
              <DotLabel colour={SUMMARY_COLOUR[stage]} className="text-[10.5px] font-medium text-[#101828]">{SUBMISSION_STATUS_LABELS[stage]}</DotLabel>
              <span className="text-[9.5px] text-[#8a94a6]">{column.length}</span>
            </header>
            <ul className="max-h-[560px] space-y-[8px] overflow-y-auto">
              {column.length === 0 && <li className="rounded-md border border-dashed border-[#e4e7ec] py-6 text-center text-[10px] text-[#98a2b3]">Empty</li>}
              {column.map(sub => (
                <li key={sub.id}>
                  <Link href={`${basePath}/submissions/${sub.id}`} className="block overflow-hidden rounded-md border border-[#eef0f4] hover:border-[#cfd6e2]">
                    <Thumb src={sub.thumbnail_url} alt="" className="aspect-video w-full" />
                    <span className="block p-[6px]">
                      <span className="block truncate text-[10px] font-medium text-[#101828]">{sub.title ?? 'Untitled'}</span>
                      <span className="block truncate text-[9px] text-[#8a94a6]">{sub.creator?.name} · {formatAgo(sub.submitted_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
