import Link from 'next/link'
import {
  CheckCircle2, ChevronRight, CircleDollarSign, Eye, FilePen, LayoutList, PauseCircle, ShieldCheck,
  SquareDashedKanban, TrendingUp, UserPlus, FileText, UploadCloud,
} from 'lucide-react'
import { requireCreatorModule, type CreatorSession } from '@/lib/creators/server'
import {
  activityVisuals, briefAggregates, campaignPerformance, creatorAggregates, creatorPickerList, deliveryRate,
  listSubmissions, paymentAggregates, recentActivity, rightsAggregates, submissionAggregates,
  topCreatorPerformance, workspaceCampaigns,
} from '@/lib/creators/data'
import { parseOverviewQuery, parseSubmissionsQuery } from '@/lib/creators/query'
import {
  CHANNEL_LABELS, CREATOR_CHANNELS, CREATOR_TIER_LABELS, SUBMISSION_STATUS_COLOUR, SUBMISSION_STATUS_LABELS,
  type CreatorTier, type SubmissionStatus,
} from '@/lib/creators/constants'
import { deltaLabel } from '@/lib/creators/rules'
import { delta } from '@/lib/creators/data'
import { cn } from '@/lib/utils'
import CreateBriefButton from '../CreateBriefButton'
import InviteCreatorButton from '../InviteCreatorButton'
import {
  DateRangeControl, ExportMenu, SearchBox, SelectControl, SettingsMenu, ViewToggle,
} from '../controls'
import {
  Avatar, DotLabel, Donut, Kpi, KpiGrid, Legend, LineChart, MediaChip, MiniTrend,
  Panel, PanelEmpty, Person, Pill, TD, TH, Thumb, TONE, type Slice, type Tone,
} from '../design'
import { formatAgo, formatCompact, formatDuration, formatMoneyShort, formatPercent } from '../primitives'
import { CreatorsFrame, kpiDelta, link, type RawSearchParams } from './shared'

const SUBMISSION_TONE: Record<string, Tone> = {
  draft: 'slate', waiting_review: 'amber', in_review: 'blue', changes_requested: 'red',
  approved: 'green', rejected: 'red', published: 'green',
}
const TIER_TONE: Record<string, Tone> = { elite: 'blue', pro: 'violet', creator: 'sky' }

export default async function OverviewPage({ searchParams }: { searchParams: RawSearchParams }) {
  const { access, ...session } = await requireCreatorModule('overview')
  const { supabase, ctx, capabilities, modules, basePath } = session
  const query = parseOverviewQuery(searchParams)

  if (!access.allowed) return <CreatorsFrame session={session} module="overview" access={access}>{null}</CreatorsFrame>

  const filters = { q: query.q, campaign: query.campaign, channel: query.channel, status: query.status, from: query.from, to: query.to }
  const submissionQuery = parseSubmissionsQuery({
    ...searchParams, size: '10', page: '1', view: 'gallery', sort: 'newest', creator: '', brief: '', q: '',
  })
  const showRights = modules.includes('rights')
  const showPayments = modules.includes('payments') && capabilities.viewPayments

  const [
    creators, briefs, submissions, rights, payments, performance, recent, activity, campaign, campaigns, creatorPicker,
  ] = await Promise.all([
    creatorAggregates(supabase, ctx.workspaceId),
    briefAggregates(supabase, ctx.workspaceId),
    submissionAggregates(supabase, ctx.workspaceId),
    showRights ? rightsAggregates(supabase, ctx.workspaceId) : Promise.resolve(null),
    showPayments ? paymentAggregates(supabase, ctx.workspaceId) : Promise.resolve(null),
    topCreatorPerformance(supabase, ctx.workspaceId, 5, filters),
    listSubmissions(supabase, ctx.workspaceId, { ...submissionQuery, status: query.status, campaign: query.campaign, size: 10 }),
    recentActivity(supabase, ctx.workspaceId, 5),
    campaignPerformance(supabase, ctx.workspaceId),
    workspaceCampaigns(supabase, ctx.workspaceId),
    capabilities.createBrief ? creatorPickerList(supabase, ctx.workspaceId) : Promise.resolve([]),
  ])
  const visuals = await activityVisuals(supabase, ctx.workspaceId, activity)

  const waiting = submissions.byStatus.waiting_review + submissions.byStatus.in_review
  const rate = deliveryRate(briefs, submissions)
  const kpis: Kpi[] = [
    { id: 'active', label: 'Active Creators', value: creators.active.toLocaleString('en-GB'), tone: 'blue', icon: 'users', spark: creators.createdSeries, href: `${basePath}/creators?status=active`, ...kpiDelta(creators.active, creators.previousActive) },
    { id: 'open', label: 'Open Briefs', value: briefs.byStatus.open.toLocaleString('en-GB'), tone: 'blue', icon: 'file', spark: briefs.createdSeries, href: `${basePath}/briefs?status=open`, ...kpiDelta(briefs.byStatus.open, briefs.previous.open) },
    { id: 'waiting', label: 'Submissions Waiting Review', value: waiting.toLocaleString('en-GB'), tone: 'amber', icon: 'clock', spark: submissions.submittedSeries, href: `${basePath}/submissions?status=waiting_review`, ...kpiDelta(waiting, submissions.previous.waiting + submissions.previous.inReview) },
    rights
      ? { id: 'rights', label: 'Approved Usage Rights', value: rights.byStatus.active.toLocaleString('en-GB'), tone: 'green', icon: 'shield', spark: rights.createdSeries, href: `${basePath}/rights?status=active`, ...kpiDelta(rights.byStatus.active, rights.previous.active) }
      : { id: 'rights', label: 'Approved Usage Rights', value: '—', delta: 'Available from the Team plan', tone: 'slate', icon: 'shield' },
    payments
      ? { id: 'payments', label: 'Pending Payments', value: formatMoneyShort(payments.pendingAmount, payments.currency), tone: 'violet', icon: 'money', spark: payments.spendSeries.map(p => Number(p.total)), href: `${basePath}/payments`, ...kpiDelta(payments.pendingAmount, payments.previous.pendingAmount) }
      : { id: 'payments', label: 'Pending Payments', value: '—', delta: modules.includes('payments') ? 'Restricted for your role' : 'Available from the Team plan', tone: 'slate', icon: 'money' },
    { id: 'delivery', label: 'Campaign Delivery Rate', value: formatPercent(rate), tone: 'blue', icon: 'target', delta: 'Approved vs requested deliverables', trend: 'flat', spark: submissions.submittedSeries, tooltip: 'Approved or published deliverables divided by the deliverables your briefs requested.' },
  ]

  const briefRows: { key: keyof typeof briefs.byStatus; label: string; icon: typeof FilePen; tone?: Tone }[] = [
    { key: 'draft', label: 'Draft', icon: FilePen },
    { key: 'open', label: 'Open', icon: SquareDashedKanban, tone: 'green' },
    { key: 'in_progress', label: 'In Progress', icon: LayoutList, tone: 'blue' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'green' },
    { key: 'on_hold', label: 'On Hold', icon: PauseCircle, tone: 'orange' },
  ]

  const workflow: Slice[] = (['waiting_review', 'in_review', 'changes_requested', 'approved', 'rejected'] as SubmissionStatus[]).map(key => ({
    key, label: SUBMISSION_STATUS_LABELS[key], value: submissions.byStatus[key] + (key === 'approved' ? submissions.byStatus.published : 0),
    colour: { waiting_review: '#f59e0b', in_review: '#3b82f6', changes_requested: '#f16063', approved: '#22c55e', rejected: '#8b5cf6' }[key as string] ?? SUBMISSION_STATUS_COLOUR[key],
    href: `${basePath}/submissions?status=${key}`,
  }))
  const workflowTotal = workflow.reduce((a, s) => a + s.value, 0)

  const reachDelta = delta(campaign.totalReach, campaign.previousReach)
  const engagementDelta = delta(campaign.totalEngagements, campaign.previousEngagements)
  const rateDiff = campaign.avgEngagementRate - campaign.previousRate

  return (
    <CreatorsFrame
      session={session} module="overview" access={access}
      actions={(
        <>
          {capabilities.createBrief && <CreateBriefButton creators={creatorPicker} campaigns={campaigns} />}
          {capabilities.invite && <InviteCreatorButton />}
          <ExportMenu entity="creators" allowed={capabilities.export} related={[
            { entity: 'briefs', label: 'Brief register (CSV)' },
            { entity: 'submissions', label: 'Submission register (CSV)' },
            ...(showRights ? [{ entity: 'rights', label: 'Rights register (CSV)' }] : []),
            ...(showPayments ? [{ entity: 'payments', label: 'Payment register (CSV)' }] : []),
          ]} />
        </>
      )}
    >
      <KpiGrid items={kpis} />

      {/* Filter row: search · date · campaign · channel · status · view · settings */}
      <div className="mb-4 flex flex-wrap items-center gap-[12px]">
        <SearchBox placeholder="Search creators..." width={180} className="max-sm:!w-full" />
        <DateRangeControl width={172} allLabel="All dates" />
        <SelectControl spec={{ key: 'campaign', label: 'Campaign', all: 'All Campaigns', width: 150, options: campaigns.map(c => ({ value: c.id, label: c.name })) }} />
        <SelectControl spec={{ key: 'channel', label: 'Channel', all: 'All Channels', width: 150, options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) }} />
        <SelectControl spec={{ key: 'status', label: 'Submission status', all: 'All Statuses', width: 150, options: (['waiting_review', 'in_review', 'changes_requested', 'approved', 'rejected', 'published'] as SubmissionStatus[]).map(s => ({ value: s, label: SUBMISSION_STATUS_LABELS[s] })) }} />
        <div className="ml-auto flex items-center gap-[13px]">
          <ViewToggle active={query.view} views={[{ id: 'cards', label: 'Card View', icon: 'cards' }, { id: 'table', label: 'Table View', icon: 'table' }]} />
          <SettingsMenu showPageSize={false} defaultSort="recent" sortKey="sort" sorts={[{ value: 'recent', label: 'Most recent' }]} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-[15px] xl:grid-cols-[717fr_411fr]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-[14px]">
          <Panel title="Top Creator Performance" href={`${basePath}/creators?sort=audience_desc`} hrefLabel="View all creators" bodyClassName="px-0 pb-0 pt-[6px]">
            {performance.length === 0 ? (
              <PanelEmpty className="min-h-[200px]">
                {query.q || query.campaign || query.channel || query.status || query.from
                  ? 'No creators match these filters.'
                  : 'Once creators deliver content, their reach, approvals, rights and earnings appear here.'}
              </PanelEmpty>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <caption className="sr-only">Top creators by reach</caption>
                  <thead className="border-y border-[#eef0f4]">
                    <tr>
                      <th scope="col" className={cn(TH, 'pl-[14px]')}>Creator</th>
                      <th scope="col" className={TH} />
                      <th scope="col" className={TH}>Reach</th>
                      <th scope="col" className={cn(TH, 'text-center')}>Eng. Rate</th>
                      <th scope="col" className={cn(TH, 'text-center')}>Submissions</th>
                      <th scope="col" className={TH}>Approved</th>
                      <th scope="col" className={TH}>Usage Rights</th>
                      <th scope="col" className={cn(TH, 'pr-[14px] text-right')}>Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map(row => (
                      <tr key={row.creator.id} className="h-[39.5px] border-b border-[#f1f3f6] last:border-0 hover:bg-[#fafbfd]">
                        <td className={cn(TD, 'pl-[14px]')}>
                          <Person name={row.creator.name} handle={row.creator.handle} src={row.creator.avatar_url} size={26} href={`${basePath}/creators/${row.creator.id}`} />
                        </td>
                        <td className={TD}>
                          <Pill tone={TIER_TONE[row.creator.creator_tier] ?? 'sky'}>{CREATOR_TIER_LABELS[row.creator.creator_tier as CreatorTier] ?? 'Creator'}</Pill>
                        </td>
                        <td className={TD}><span className="inline-flex items-center gap-3 tabular-nums">{formatCompact(row.reach)}<MiniTrend values={row.spark} /></span></td>
                        <td className={cn(TD, 'text-center tabular-nums')}>{formatPercent(row.engagementRate)}</td>
                        <td className={cn(TD, 'text-center tabular-nums')}>{row.submissions}</td>
                        <td className={cn(TD, 'tabular-nums')}>{row.approved} <span className="ml-1.5 text-[9.5px] text-[#8a94a6]">{row.approvalRate.toFixed(0)}%</span></td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-3 tabular-nums">{row.rights}
                            {row.rights > 0 ? <DotLabel tone="green" className="text-[9.5px] text-[#16a34a]">Active</DotLabel> : <span className="text-[9.5px] text-[#98a2b3]">None</span>}
                          </span>
                        </td>
                        <td className={cn(TD, 'pr-[14px] text-right font-medium tabular-nums text-[#101828]')}>{formatMoneyShort(row.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Recent Submissions" href={`${basePath}/submissions`} hrefLabel="View all submissions" bodyClassName="pt-[6px]">
            {recent.rows.length === 0 ? (
              <PanelEmpty className="min-h-[160px]">No submissions yet. Creator deliverables land here as soon as they are uploaded.</PanelEmpty>
            ) : query.view === 'table' ? (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead><tr className="border-b border-[#eef0f4]">
                    {['Submission', 'Creator', 'Status', 'Submitted', 'Views', 'Eng. Rate'].map(h => <th key={h} scope="col" className={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {recent.rows.slice(0, 5).map(sub => (
                      <tr key={sub.id} className="h-10 border-b border-[#f1f3f6] last:border-0">
                        <td className={TD}><Link href={`${basePath}/submissions/${sub.id}`} className="font-medium text-[#101828] hover:underline">{sub.title ?? 'Untitled submission'}</Link></td>
                        <td className={TD}>{sub.creator?.name ?? '—'}</td>
                        <td className={TD}><Pill tone={SUBMISSION_TONE[sub.status] ?? 'slate'}>{SUBMISSION_STATUS_LABELS[sub.status as SubmissionStatus] ?? sub.status}</Pill></td>
                        <td className={TD}>{formatAgo(sub.submitted_at)}</td>
                        <td className={cn(TD, 'tabular-nums')}>{formatCompact(sub.views)}</td>
                        <td className={cn(TD, 'tabular-nums')}>{formatPercent(sub.engagement_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="relative">
                <ul className="grid grid-cols-2 gap-[11px] sm:grid-cols-3 lg:grid-cols-5">
                  {recent.rows.slice(0, 5).map(sub => (
                    <li key={sub.id} className="min-w-0">
                      <Link href={`${basePath}/submissions/${sub.id}`} className="group block overflow-hidden rounded-[9px] border border-[#e8ebf0] bg-white hover:border-[#cfd6e2] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <span className="relative block aspect-[130/92]">
                          <Thumb src={sub.thumbnail_url} alt={sub.title ?? 'Submission preview'} className="h-full w-full" />
                          <span className="absolute left-[6px] top-[6px]"><MediaChip tone={SUBMISSION_TONE[sub.status] ?? 'slate'}>{SUBMISSION_STATUS_LABELS[sub.status as SubmissionStatus] ?? sub.status}</MediaChip></span>
                          {(sub.duration_seconds || sub.file_count > 1) && (
                            <span className="absolute bottom-[6px] right-[6px] rounded bg-black/65 px-[5px] py-px text-[9px] font-medium text-white">
                              {sub.duration_seconds ? formatDuration(sub.duration_seconds) : `${sub.file_count} files`}
                            </span>
                          )}
                        </span>
                        <span className="block px-[9px] pb-[9px] pt-[8px]">
                          <span className="block truncate text-[10.5px] font-medium text-[#101828]">{sub.title ?? 'Untitled submission'}</span>
                          <span className="mt-[7px] flex items-center gap-[6px]">
                            <Avatar name={sub.creator?.name} src={sub.creator?.avatar_url} size={17} />
                            <span className="min-w-0 flex-1 truncate text-[9.5px] text-[#344054]">{sub.creator?.name ?? 'Unknown'}</span>
                            <span className="shrink-0 text-[9px] text-[#98a2b3]">{formatAgo(sub.submitted_at)}</span>
                          </span>
                          <span className="mt-[8px] flex items-center gap-[12px] text-[9.5px] text-[#475467]">
                            <span className="inline-flex items-center gap-[5px]"><Eye size={12} className="text-[#667085]" aria-hidden /><span className="sr-only">Views</span>{sub.views ? formatCompact(sub.views) : '—'}</span>
                            <span className="inline-flex items-center gap-[5px]"><TrendingUp size={12} className="text-[#667085]" aria-hidden /><span className="sr-only">Engagement rate</span>{sub.engagement_rate ? formatPercent(sub.engagement_rate) : '—'}</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {recent.total > 5 && (
                  <Link href={`${basePath}/submissions`} aria-label="See more submissions"
                    className="absolute -right-[12px] top-[58px] hidden h-[26px] w-[26px] items-center justify-center rounded-full border border-[#e4e7ec] bg-white text-[#344054] shadow-sm hover:bg-slate-50 lg:flex">
                    <ChevronRight size={14} />
                  </Link>
                )}
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] md:grid-cols-[345fr_356fr]">
            <Panel title="Workflow Status Distribution" href={`${basePath}/submissions?view=board`} hrefLabel="View full report">
              {workflowTotal === 0 ? <PanelEmpty>No submissions in the review pipeline.</PanelEmpty> : (
                <div className="flex items-center gap-[22px] pt-[6px]">
                  <Donut slices={workflow} total={workflowTotal} caption="Submissions" size={130} thickness={21} />
                  <Legend slices={workflow} total={workflowTotal} className="flex-1 space-y-[12px]" />
                </div>
              )}
            </Panel>

            <Panel title="Campaign Performance Overview" href="/app/analytics" hrefLabel="View analytics">
              <dl className="grid grid-cols-3 divide-x divide-[#eef0f4] pb-[8px]">
                {[
                  { label: 'Total Reach', value: formatCompact(campaign.totalReach), d: deltaLabel(reachDelta.pct, '').trim(), trend: reachDelta.trend },
                  { label: 'Total Engagements', value: formatCompact(campaign.totalEngagements), d: deltaLabel(engagementDelta.pct, '').trim(), trend: engagementDelta.trend },
                  { label: 'Avg. Eng. Rate', value: formatPercent(campaign.avgEngagementRate), d: `${Math.abs(rateDiff).toFixed(1)}pp`, trend: rateDiff >= 0 ? 'up' as const : 'down' as const },
                ].map(stat => (
                  <div key={stat.label} className="px-[10px] first:pl-0">
                    <dt className="text-[9.5px] text-[#667085]">{stat.label}</dt>
                    <dd className="mt-[4px] text-[14px] font-semibold text-[#101828]">{stat.value}</dd>
                    <dd className={cn('mt-[2px] text-[9px]', stat.trend === 'down' ? 'text-[#dc2626]' : 'text-[#16a34a]')}>{stat.trend === 'down' ? '↘' : '↗'} {stat.d}</dd>
                  </div>
                ))}
              </dl>
              <LineChart data={campaign.series} height={104} series={[
                { key: 'reach', label: 'Reach', colour: '#3b82f6', area: true },
                { key: 'engagements', label: 'Engagements', colour: '#3b82f6', dashed: true },
              ]} />
            </Panel>
          </div>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-[14px]">
          <Panel title="Briefs Summary" href={`${basePath}/briefs`} hrefLabel="View all briefs" bodyClassName="px-0 pb-0 pt-[4px]">
            <ul className="mx-[14px] rounded-[9px] border border-[#eef0f4] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              {briefRows.map(row => {
                const Icon = row.icon
                return (
                  <li key={row.key} className="border-b border-[#f1f3f6] last:border-0">
                    <Link href={`${basePath}/briefs?status=${row.key}`} className="flex h-[35px] items-center gap-[12px] px-[14px] text-[11.5px] text-[#101828] hover:bg-[#fafbfd]">
                      <Icon size={14} className="text-[#667085]" aria-hidden />
                      <span className="flex-1">{row.label}</span>
                      {row.tone && <span className={cn('h-[5px] w-[5px] rounded-full', TONE[row.tone].dot)} aria-hidden />}
                      <span className="w-6 text-right tabular-nums">{briefs.byStatus[row.key]}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-[10px] flex items-end gap-6 border-t border-[#eef0f4] px-[14px] pb-[12px] pt-[10px]">
              <div>
                <p className="text-[9.5px] text-[#667085]">Total Briefs</p>
                <p className="mt-[2px] text-[13px] font-semibold text-[#101828]">{briefs.total}</p>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block h-[4px] overflow-hidden rounded-full bg-[#edf0f5]" role="progressbar" aria-label="Brief completion rate" aria-valuenow={Math.round(briefs.completionRate)} aria-valuemin={0} aria-valuemax={100}>
                  <span className="block h-full rounded-full bg-[#1d6bf3]" style={{ width: `${Math.min(100, briefs.completionRate)}%` }} />
                </span>
                <p className="mt-[8px] text-[9.5px] text-[#475467]">Completion Rate</p>
              </div>
              <p className="text-[13px] font-semibold text-[#101828]">{briefs.completionRate.toFixed(0)}%</p>
            </div>
          </Panel>

          <Panel title="Rights & Payments" href={showRights ? `${basePath}/rights` : null}>
            <div className="grid grid-cols-2 gap-[10px]">
              <div className="rounded-[9px] border border-[#eef0f4] p-[10px]">
                <p className="text-[10.5px] font-semibold text-[#101828]">Usage Rights</p>
                {rights ? (
                  <ul className="mt-[10px] space-y-[9px] text-[10px] text-[#344054]">
                    <li className="flex justify-between"><DotLabel tone="green">Active</DotLabel><span className="font-medium">{rights.byStatus.active}</span></li>
                    <li className="flex justify-between"><DotLabel tone="amber">Expiring Soon</DotLabel><span className="font-medium">{rights.expiringSoon}</span></li>
                    <li className="flex justify-between"><DotLabel tone="red">Expired</DotLabel><span className="font-medium text-[#dc2626]">{rights.byStatus.expired}</span></li>
                  </ul>
                ) : <p className="mt-3 text-[10px] text-[#98a2b3]">Rights tracking is available from the Team plan.</p>}
                <Link href={showRights ? `${basePath}/rights` : '/app/settings/billing'} className="mt-[12px] flex h-[26px] items-center justify-center rounded-md border border-[#e4e7ec] text-[10px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]">
                  {showRights ? 'Manage Rights' : 'View plans'}
                </Link>
              </div>
              <div className="rounded-[9px] border border-[#eef0f4] p-[10px]">
                <p className="text-[10.5px] font-semibold text-[#101828]">Payments</p>
                {payments ? (
                  <ul className="mt-[10px] space-y-[9px] text-[10px] text-[#344054]">
                    <li className="flex justify-between"><DotLabel tone="violet">Pending</DotLabel><span className="font-medium text-[#7c3aed]">{formatMoneyShort(payments.pendingAmount, payments.currency)}</span></li>
                    <li className="flex justify-between"><DotLabel tone="blue">In Review</DotLabel><span className="font-medium text-[#2563eb]">{formatMoneyShort(payments.inReviewAmount, payments.currency)}</span></li>
                    <li className="flex justify-between"><DotLabel tone="green">Paid <span className="text-[#98a2b3]">(This Month)</span></DotLabel><span className="font-medium text-[#16a34a]">{formatMoneyShort(payments.paidThisMonth, payments.currency)}</span></li>
                  </ul>
                ) : <p className="mt-3 text-[10px] text-[#98a2b3]">{modules.includes('payments') ? 'Payment values are restricted for your role.' : 'Creator payments are available from the Team plan.'}</p>}
                <Link href={showPayments ? `${basePath}/payments` : '/app/settings/billing'} className="mt-[12px] flex h-[26px] items-center justify-center rounded-md border border-[#e4e7ec] text-[10px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]">
                  {showPayments ? 'Go to Payments' : 'View plans'}
                </Link>
              </div>
            </div>
          </Panel>

          <Panel title="Recent Activity" href={`${basePath}/submissions`} className="flex-1" bodyClassName="pt-[4px]">
            <ActivityList session={session} items={activity} visuals={visuals} />
          </Panel>
        </div>
      </div>
    </CreatorsFrame>
  )
}

const ENTITY_ICON = { creator: UserPlus, invitation: UserPlus, brief: FileText, submission: UploadCloud, rights: ShieldCheck, payment: CircleDollarSign, payment_batch: CircleDollarSign }
const ENTITY_TONE: Record<string, Tone> = { creator: 'slate', invitation: 'slate', brief: 'green', submission: 'amber', rights: 'green', payment: 'violet', payment_batch: 'violet' }

export function ActivityList({
  session, items, visuals, dense,
}: {
  session: CreatorSession
  items: Awaited<ReturnType<typeof recentActivity>>
  visuals?: Awaited<ReturnType<typeof activityVisuals>>
  dense?: boolean
}) {
  if (items.length === 0) return <PanelEmpty>Activity from creators, briefs, submissions, rights and payments appears here.</PanelEmpty>
  return (
    <ul className={cn(dense ? 'space-y-[10px]' : 'space-y-[12px]')}>
      {items.map(item => {
        const href = link(session, item.link)
        const visual = visuals?.[item.id]
        const Icon = ENTITY_ICON[item.entity_type as keyof typeof ENTITY_ICON] ?? FileText
        const actorName = item.actor?.full_name ?? null
        const lead = visual?.avatarUrl
          ? <Avatar name={item.summary} src={visual.avatarUrl} size={26} />
          : ['payment', 'payment_batch', 'brief', 'rights'].includes(item.entity_type) || !actorName
            ? <span className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full', TONE[ENTITY_TONE[item.entity_type] ?? 'slate'].chip)}><Icon size={13} aria-hidden /></span>
            : <Avatar name={actorName} src={item.actor?.avatar_url} size={26} />
        const body = (
          <span className="flex items-start gap-[10px]">
            {lead}
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] leading-[14px] text-[#101828]">{item.summary}</span>
              <span className="mt-[2px] block text-[9.5px] text-[#98a2b3]">{formatAgo(item.created_at)}</span>
            </span>
            {visual?.thumbnailUrl && <Thumb src={visual.thumbnailUrl} alt="" className="h-[30px] w-[30px] shrink-0 rounded-md" />}
          </span>
        )
        return (
          <li key={item.id}>
            {href
              ? <Link href={href} className="block rounded-md hover:bg-[#fafbfd] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{body}</Link>
              : body}
          </li>
        )
      })}
    </ul>
  )
}
