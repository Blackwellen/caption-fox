import Link from 'next/link'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  briefAggregates, creatorPickerList, listBriefs, listSubmissions, recentActivity, upcomingBriefDeadlines,
  workspaceCampaigns, workspaceMembers,
} from '@/lib/creators/data'
import { parseBriefsQuery, parseSubmissionsQuery } from '@/lib/creators/query'
import {
  BRIEF_APPROVAL_LABELS, BRIEF_SORTS, BRIEF_STATUS_LABELS, CHANNEL_LABELS, CREATOR_CHANNELS,
  type BriefApprovalStage, type BriefStatus,
} from '@/lib/creators/constants'
import { daysLeft, nowMs } from '@/lib/creators/rules'
import type { BriefRow } from '@/lib/creators/types'
import { cn } from '@/lib/utils'
import BriefBoard, { DuplicateTemplateButton } from '../BriefBoard'
import CreateBriefButton from '../CreateBriefButton'
import {
  ExportMenu, Pager, PresetControl, SearchBox, SelectControl, SettingsMenu, ViewToggle,
} from '../controls'
import {
  Avatar, CARD, Donut, Kpi, KpiGrid, Legend, Panel, PanelEmpty, Pill, TD, TH, Thumb, type Slice, type Tone,
} from '../design'
import { formatAgo } from '../primitives'
import { CreatorsFrame, kpiDelta, link, type RawSearchParams } from './shared'

const STATUS_TONE: Record<string, Tone> = { draft: 'slate', open: 'blue', in_progress: 'orange', submitted: 'green', completed: 'green', on_hold: 'amber', cancelled: 'red' }
const APPROVAL_TONE: Record<string, Tone> = {
  not_sent: 'slate', brief_sent: 'blue', waiting_for_creator: 'orange', in_review: 'blue',
  pending_approval: 'orange', approved: 'green', changes_requested: 'violet', rejected: 'red',
}
const SUMMARY_COLOUR: Record<string, string> = { draft: '#fbbf24', open: '#3b82f6', in_progress: '#f97316', submitted: '#a78bba', completed: '#22c55e' }

const fmtDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))

function dueLabel(brief: BriefRow) {
  if (brief.status === 'completed') return { text: '', tone: 'text-[#16a34a]' }
  const left = daysLeft(brief.deadline)
  if (left === null) return { text: 'No deadline', tone: 'text-[#98a2b3]' }
  if (left < 0) return { text: `${Math.abs(left)} days overdue`, tone: 'text-[#dc2626]' }
  return { text: `${left} day${left === 1 ? '' : 's'} left`, tone: left <= 7 ? 'text-[#dc2626]' : left <= 21 ? 'text-[#ea580c]' : 'text-[#ea580c]' }
}

export default async function BriefsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const { access, ...session } = await requireCreatorModule('briefs')
  const { supabase, ctx, capabilities, basePath } = session
  const query = parseBriefsQuery(searchParams)
  if (!access.allowed) return <CreatorsFrame session={session} module="briefs" access={access}>{null}</CreatorsFrame>

  const size = query.view === 'table' ? query.size : Math.min(query.size, 7)
  const [page, board, aggregates, summary, deadlines, activity, recentSubs, campaigns, members, creatorPicker, templates] = await Promise.all([
    listBriefs(supabase, ctx.workspaceId, { ...query, size }),
    query.view === 'cards' ? listBriefs(supabase, ctx.workspaceId, { ...query, status: '', sort: 'recent' }, { all: true, limit: 250 }) : Promise.resolve(null),
    briefAggregates(supabase, ctx.workspaceId),
    briefAggregates(supabase, ctx.workspaceId, query.campaign || undefined),
    upcomingBriefDeadlines(supabase, ctx.workspaceId, 5),
    recentActivity(supabase, ctx.workspaceId, 5, { surface: 'briefs' }),
    listSubmissions(supabase, ctx.workspaceId, { ...parseSubmissionsQuery({}), size: 4 }),
    workspaceCampaigns(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
    capabilities.createBrief ? creatorPickerList(supabase, ctx.workspaceId) : Promise.resolve([]),
    capabilities.createBrief ? listBriefs(supabase, ctx.workspaceId, { ...parseBriefsQuery({}), sort: 'recent' }, { all: true, limit: 100 }) : Promise.resolve(null),
  ])

  const d = aggregates.avgApprovalDays
  const pd = aggregates.previous.avgApprovalDays
  const approvalDelta = d !== null && pd !== null ? d - pd : null
  const rateDiff = aggregates.completionRate - aggregates.previous.completionRate
  const boardCounts: Record<string, number> = {}
  for (const b of board?.rows ?? []) boardCounts[b.status] = (boardCounts[b.status] ?? 0) + 1

  const kpis: Kpi[] = [
    { id: 'open', label: 'Open Briefs', value: String(aggregates.byStatus.open), tone: 'blue', icon: 'file', spark: aggregates.createdSeries, href: `${basePath}/briefs?status=open`, ...kpiDelta(aggregates.byStatus.open, aggregates.previous.open) },
    { id: 'draft', label: 'Draft Briefs', value: String(aggregates.byStatus.draft), tone: 'blue', icon: 'file', spark: aggregates.createdSeries, href: `${basePath}/briefs?status=draft`, ...kpiDelta(aggregates.byStatus.draft, aggregates.previous.draft) },
    { id: 'progress', label: 'In Progress', value: String(aggregates.byStatus.in_progress), tone: 'orange', icon: 'clock', spark: aggregates.createdSeries, href: `${basePath}/briefs?status=in_progress`, ...kpiDelta(aggregates.byStatus.in_progress, aggregates.previous.inProgress) },
    { id: 'submitted', label: 'Submitted Deliverables', value: String(aggregates.submittedDeliverables), tone: 'green', icon: 'shield', spark: aggregates.createdSeries, href: `${basePath}/submissions`, ...kpiDelta(aggregates.submittedDeliverables, aggregates.previous.submitted) },
    { id: 'completion', label: 'Completion Rate', value: `${aggregates.completionRate.toFixed(0)}%`, tone: 'violet', icon: 'money', spark: aggregates.createdSeries, delta: `${Math.abs(rateDiff).toFixed(1)}pp vs last 30 days`, trend: rateDiff > 0 ? 'up' : rateDiff < 0 ? 'down' : 'flat', href: `${basePath}/briefs?status=completed` },
    { id: 'approve', label: 'Avg. Time to Approve', value: d === null ? '—' : `${d.toFixed(1)} days`, tone: 'blue', icon: 'timer', spark: aggregates.createdSeries,
      delta: approvalDelta === null ? 'Brief created to completion' : `${approvalDelta < 0 ? '−' : ''}${Math.abs(approvalDelta).toFixed(1)} days vs last 30 days`, trend: approvalDelta === null ? 'flat' : approvalDelta <= 0 ? 'down' : 'up' },
  ]

  const summarySlices: Slice[] = (['draft', 'open', 'in_progress', 'submitted', 'completed'] as BriefStatus[]).map(key => ({
    key, label: BRIEF_STATUS_LABELS[key], value: summary.byStatus[key], colour: SUMMARY_COLOUR[key], href: `${basePath}/briefs?status=${key}`,
  }))
  const summaryTotal = summarySlices.reduce((a, s) => a + s.value, 0)
  const hasFilters = Boolean(query.q || query.campaign || query.channel || query.owner || query.status || query.due)

  const table = (
    <section className={cn(CARD, 'min-w-0')} aria-labelledby="all-briefs">
      <header className="flex items-center gap-3 px-[14px] pb-[8px] pt-[14px]">
        <h2 id="all-briefs" className="text-[12.5px] font-semibold text-[#101828]">All Briefs</h2>
        <span className="text-[10px] text-[#8a94a6]">{page.total} briefs</span>
      </header>
      {page.rows.length === 0 ? (
        <PanelEmpty className="min-h-[220px]">{hasFilters ? 'No briefs match these filters.' : 'No briefs yet. Create a brief to start commissioning creators.'}</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[700px] [&_td]:px-[6px] [&_th]:px-[6px]">
            <caption className="sr-only">Briefs</caption>
            <thead className="border-y border-[#eef0f4]">
              <tr className="h-[38px]">
                {['Brief', 'Campaign', 'Creators', 'Deliverables', 'Deadline', 'Status', 'Approval Stage', 'Owner'].map(h => (
                  <th key={h} scope="col" className={cn(TH, h === 'Brief' && 'pl-[14px]')}>{h}</th>
                ))}
                <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map(brief => {
                const due = dueLabel(brief)
                return (
                  <tr key={brief.id} className="h-[42px] border-b border-[#f1f3f6] last:border-0 hover:bg-[#fafbfd]">
                    <td className={cn(TD, 'pl-[14px]')}>
                      <Link href={`${basePath}/briefs/${brief.id}`} className="flex items-center gap-[10px] font-medium text-[#101828] hover:underline">
                        <Thumb src={brief.cover_url} alt="" className="h-[26px] w-[26px] shrink-0 rounded-[5px]" />
                        <span className="max-w-[124px] truncate text-[10.5px]">{brief.title}</span>
                      </Link>
                    </td>
                    <td className={cn(TD, 'max-w-[82px] truncate text-[10px] text-[#475467]')}>{brief.campaign?.name ?? '—'}</td>
                    <td className={cn(TD, 'text-[10px] tabular-nums')}>{brief.creators_assigned}</td>
                    <td className={cn(TD, 'text-[10px] tabular-nums')}>{brief.deliverables_submitted} <span className="px-1 text-[#98a2b3]">/</span> {brief.deliverables_target}</td>
                    <td className={cn(TD, 'text-[10px] leading-tight')}>
                      {brief.status === 'completed' && brief.completed_at
                        ? <span className="text-[#16a34a]">{fmtDate(brief.completed_at.slice(0, 10))}</span>
                        : <>{brief.deadline ? fmtDate(brief.deadline) : '—'}<span className={cn('block text-[9px]', due.tone)}>{due.text}</span></>}
                    </td>
                    <td className={TD}><Pill tone={STATUS_TONE[brief.status] ?? 'slate'}>{BRIEF_STATUS_LABELS[brief.status as BriefStatus] ?? brief.status}</Pill></td>
                    <td className={TD}><Pill tone={APPROVAL_TONE[brief.approval_stage] ?? 'slate'}>{BRIEF_APPROVAL_LABELS[brief.approval_stage as BriefApprovalStage] ?? brief.approval_stage}</Pill></td>
                    <td className={TD}>
                      <span className="flex max-w-[92px] items-center gap-[6px] text-[10px]"><Avatar name={brief.owner?.full_name} src={brief.owner?.avatar_url} size={20} /><span className="truncate">{brief.owner?.full_name ?? 'Unassigned'}</span></span>
                    </td>
                    <td className={cn(TD, 'pr-[12px] text-right')}>
                      <Link href={`${basePath}/briefs/${brief.id}`} aria-label={`Open ${brief.title}`} className="inline-flex h-6 w-6 items-center justify-center rounded text-[#667085] hover:bg-slate-100">⋮</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager compact className="border-t border-[#eef0f4] px-[14px] py-[10px]" page={query.page} size={size} total={page.total} noun="briefs" sizes={query.view === 'table' ? [10, 25, 50, 100] : [7]} />
    </section>
  )

  return (
    <CreatorsFrame
      session={session} module="briefs" access={access}
      actions={(
        <>
          {capabilities.createBrief && <CreateBriefButton creators={creatorPicker} campaigns={campaigns} />}
          {capabilities.createBrief && <DuplicateTemplateButton briefs={(templates?.rows ?? []).map(b => ({ id: b.id, title: b.title, status: b.status }))} />}
          <ExportMenu entity="briefs" allowed={capabilities.export} />
        </>
      )}
    >
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-[16px] xl:grid-cols-[808fr_317fr]">
        <div className="flex min-w-0 flex-col gap-[14px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <SearchBox placeholder="Search briefs..." width={180} />
            <SelectControl spec={{ key: 'campaign', label: 'Campaign', all: 'All Campaigns', width: 128, options: campaigns.map(c => ({ value: c.id, label: c.name })) }} />
            <SelectControl spec={{ key: 'channel', label: 'Channel', all: 'All Channels', width: 122, options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) }} />
            <SelectControl spec={{ key: 'owner', label: 'Owner', all: 'All Owners', width: 110, options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) }} />
            <SelectControl spec={{ key: 'status', label: 'Status', all: 'All Statuses', width: 105, options: (Object.keys(BRIEF_STATUS_LABELS) as BriefStatus[]).map(s => ({ value: s, label: BRIEF_STATUS_LABELS[s] })) }} />
            <PresetControl icon spec={{ key: 'due', label: 'Due date', all: 'Due Anytime', width: 120, options: [{ value: 'overdue', label: 'Overdue' }, { value: '7', label: 'Next 7 days' }, { value: '30', label: 'Next 30 days' }, { value: '90', label: 'Next 90 days' }] }} />
          </div>

          {query.view === 'cards' && (
            <section className={cn(CARD, 'min-w-0 p-[12px] pt-[10px]')} aria-labelledby="briefs-board">
              <header className="mb-[8px] flex items-center gap-3 px-[2px]">
                <h2 id="briefs-board" className="text-[12.5px] font-semibold text-[#101828]">Briefs Board</h2>
                <span className="text-[10px] text-[#8a94a6]">{capabilities.editBrief ? 'Drag to reorder' : 'View only'} • {board?.total ?? 0} briefs</span>
              </header>
              {(board?.rows.length ?? 0) === 0
                ? <PanelEmpty className="min-h-[220px]">{hasFilters ? 'No briefs match these filters.' : 'Your board is empty. Create a brief to get started.'}</PanelEmpty>
                : <BriefBoard briefs={board!.rows} counts={boardCounts} canEdit={capabilities.editBrief} />}
            </section>
          )}

          {query.view === 'timeline' ? <BriefTimeline now={nowMs()} briefs={page.rows} basePath={basePath} total={page.total} page={query.page} size={size} /> : table}
        </div>

        <aside className="flex min-w-0 flex-col gap-[14px]" aria-label="Brief insights">
          <div className="flex items-center gap-[10px]">
            <ViewToggle className="flex-1 justify-between" active={query.view} views={[{ id: 'cards', label: 'Cards', icon: 'cards' }, { id: 'table', label: 'Table', icon: 'table' }, { id: 'timeline', label: 'Timeline', icon: 'timeline' }]} />
            <SettingsMenu defaultSort="due_soonest" sorts={BRIEF_SORTS.map(s => ({ value: s.id, label: s.label }))} />
          </div>

          <Panel title="Brief Summary" action={<SelectControl spec={{ key: 'campaign', label: 'Summary campaign', all: 'All Campaigns', width: 118, fixedWidth: true, options: campaigns.map(c => ({ value: c.id, label: c.name })) }} />}>
            {summaryTotal === 0 ? <PanelEmpty>No briefs yet.</PanelEmpty> : (
              <>
                <div className="flex items-center gap-[20px]">
                  <Donut slices={summarySlices} total={summaryTotal} caption="Total Briefs" size={124} thickness={20} />
                  <Legend slices={summarySlices} total={summaryTotal} className="flex-1 space-y-[9px]" />
                </div>
                <Link href="/app/analytics" className="mt-[8px] block text-center text-[10px] font-medium text-[#1d6bf3] hover:underline">View analytics</Link>
              </>
            )}
          </Panel>

          <Panel title="Upcoming Deadlines" href={`/${session.kind}/calendar`} hrefLabel="View calendar">
            {deadlines.length === 0 ? <PanelEmpty>No upcoming brief deadlines.</PanelEmpty> : (
              <ul className="space-y-[9px]">
                {deadlines.map((brief, i) => {
                  const left = daysLeft(brief.deadline) ?? 0
                  return (
                    <li key={brief.id}>
                      <Link href={`${basePath}/briefs/${brief.id}`} className="flex items-center gap-[8px] text-[9.5px] hover:underline">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full border-[1.5px] border-[#f59e0b]" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[#101828]">{brief.title}</span>
                        <span className="w-[66px] text-[#475467]">{brief.deadline ? fmtDate(brief.deadline) : ''}</span>
                        <span className={cn('w-[54px] text-right', left <= 7 || i === 0 ? 'text-[#dc2626]' : 'text-[#ea580c]')}>{left} days left</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Recent Activity" href={`${basePath}/briefs?sort=recent`}>
            {activity.length === 0 ? <PanelEmpty>Brief changes appear here.</PanelEmpty> : (
              <ul className="space-y-[10px]">
                {activity.map(item => {
                  const href = link(session, item.link)
                  const body = (
                    <span className="flex items-start gap-[8px]">
                      <Avatar name={item.actor?.full_name} src={item.actor?.avatar_url} size={24} />
                      <span className="min-w-0 flex-1 text-[9.5px] leading-[13px] text-[#101828]">
                        {item.summary}
                        {item.actor?.full_name && <span className="block text-[#8a94a6]">by {item.actor.full_name}</span>}
                      </span>
                      <span className="shrink-0 text-[9px] text-[#98a2b3]">{formatAgo(item.created_at)}</span>
                    </span>
                  )
                  return <li key={item.id}>{href ? <Link href={href} className="block rounded hover:bg-[#fafbfd]">{body}</Link> : body}</li>
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Recent Submissions" href={`${basePath}/submissions`}>
            {recentSubs.rows.length === 0 ? <PanelEmpty>No submissions yet.</PanelEmpty> : (
              <ul className="grid grid-cols-5 gap-[6px]">
                {recentSubs.rows.slice(0, 4).map(sub => (
                  <li key={sub.id}>
                    <Link href={`${basePath}/submissions/${sub.id}`} aria-label={sub.title ?? 'Submission'} className="block overflow-hidden rounded-[6px]">
                      <Thumb src={sub.thumbnail_url} alt={sub.title ?? 'Submission'} className="aspect-[53/76] w-full" />
                    </Link>
                  </li>
                ))}
                {recentSubs.total > 4 && (
                  <li>
                    <Link href={`${basePath}/submissions`} className="relative block overflow-hidden rounded-[6px]" aria-label={`${recentSubs.total - 4} more submissions`}>
                      <Thumb src={recentSubs.rows[3]?.thumbnail_url} alt="" className="aspect-[53/76] w-full" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[13px] font-semibold text-white">+{recentSubs.total - 4}</span>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </CreatorsFrame>
  )
}

/** Timeline view: each brief's lifetime from creation to deadline, with today marked. */
function BriefTimeline({ briefs, basePath, total, page, size, now }: { briefs: BriefRow[]; basePath: string; total: number; page: number; size: number; now: number }) {
  const dated = briefs.filter(b => b.deadline)
  if (dated.length === 0) {
    return <section className={CARD}><PanelEmpty className="min-h-[240px]">No briefs with deadlines to place on the timeline.</PanelEmpty></section>
  }
  const start = Math.min(...dated.map(b => Date.parse(b.created_at)), now - 7 * 86_400_000)
  const end = Math.max(...dated.map(b => Date.parse(`${b.deadline}T23:59:59Z`)), now + 7 * 86_400_000)
  const span = end - start
  const pct = (t: number) => `${(((t - start) / span) * 100).toFixed(2)}%`
  const months: { label: string; left: string }[] = []
  const cursor = new Date(start); cursor.setUTCDate(1)
  while (cursor.getTime() <= end) {
    if (cursor.getTime() >= start) months.push({ label: new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(cursor), left: pct(cursor.getTime()) })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return (
    <section className={cn(CARD, 'min-w-0 p-[14px]')} aria-labelledby="brief-timeline">
      <h2 id="brief-timeline" className="mb-3 text-[12.5px] font-semibold text-[#101828]">Brief Timeline <span className="ml-2 text-[10px] font-normal text-[#8a94a6]">{total} briefs</span></h2>
      <div className="relative ml-[180px] h-5 border-b border-[#eef0f4] text-[9.5px] text-[#667085]" aria-hidden>
        {months.map(m => <span key={m.label} className="absolute -translate-x-1/2" style={{ left: m.left }}>{m.label}</span>)}
      </div>
      <ul className="relative mt-2 space-y-[8px]">
        <span className="absolute bottom-0 top-0 z-10 w-px bg-[#ef4444]" style={{ left: `calc(180px + (100% - 180px) * ${((now - start) / span).toFixed(4)})` }} aria-hidden />
        {dated.map(brief => {
          const from = Date.parse(brief.created_at)
          const to = Date.parse(`${brief.deadline}T23:59:59Z`)
          return (
            <li key={brief.id} className="flex items-center">
              <Link href={`${basePath}/briefs/${brief.id}`} className="w-[180px] shrink-0 truncate pr-3 text-[10.5px] font-medium text-[#101828] hover:underline">{brief.title}</Link>
              <span className="relative block h-[18px] flex-1 rounded bg-[#f7f8fa]">
                <span className="absolute top-0 h-full rounded bg-[#1d6bf3]/80"
                  style={{ left: pct(from), width: `max(6px, ${(((to - from) / span) * 100).toFixed(2)}%)` }}
                  title={`${BRIEF_STATUS_LABELS[brief.status as BriefStatus]} · ${new Date(from).toLocaleDateString('en-GB')} → ${brief.deadline}`} />
              </span>
              <span className="sr-only">{BRIEF_STATUS_LABELS[brief.status as BriefStatus]}, created {brief.created_at.slice(0, 10)}, due {brief.deadline}</span>
            </li>
          )
        })}
      </ul>
      <Pager compact className="mt-3 border-t border-[#eef0f4] pt-[10px]" page={page} size={size} total={total} noun="briefs" />
    </section>
  )
}
