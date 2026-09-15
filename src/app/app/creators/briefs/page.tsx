import Link from 'next/link'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  briefAggregates, creatorPickerList, listBriefs, recentActivity, listSubmissions,
  upcomingBriefDeadlines, workspaceCampaigns, workspaceMembers, delta,
} from '@/lib/creators/data'
import { parseBriefsQuery, hasAnyFilter, type RawParams } from '@/lib/creators/query'
import {
  BRIEF_APPROVAL_BADGE, BRIEF_APPROVAL_LABELS, BRIEF_BOARD_STAGES, BRIEF_SORTS,
  BRIEF_STATUS_BADGE, BRIEF_STATUS_COLOUR, BRIEF_STATUS_LABELS, BRIEF_STATUSES,
  CHANNEL_LABELS, CREATOR_CHANNELS, type BriefStatus,
} from '@/lib/creators/constants'
import CreatorsHeader from '@/components/creators/CreatorsHeader'
import KpiStrip from '@/components/creators/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/creators/FilterBar'
import Pagination from '@/components/creators/Pagination'
import ActivityFeed from '@/components/creators/ActivityFeed'
import { DonutChart, DonutLegend } from '@/components/creators/charts'
import CreateBriefButton from '@/components/creators/CreateBriefButton'
import ExportButton, { HeaderOverflow } from '@/components/creators/ExportButton'
import BriefStatusMenu from '@/components/creators/BriefStatusMenu'
import { AccessBlocked, CreatorsEmpty, LoadError, PanelEmpty } from '@/components/creators/states'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, ChannelChips, Panel, PersonChip,
  formatMoneyShort, formatNumber, formatPercent, formatShortDate,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue, StatusCount } from '@/lib/creators/types'

export const metadata = { title: 'Briefs · Caption Fox' }

export default async function BriefsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCreatorModule('briefs')

  if (!access.allowed) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="briefs" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseBriefsQuery(params)

  const [aggregates, page, deadlines, activity, submissions, campaigns, members, creators] = await Promise.all([
    briefAggregates(supabase, ctx.workspaceId),
    listBriefs(supabase, ctx.workspaceId, query),
    upcomingBriefDeadlines(supabase, ctx.workspaceId, 5),
    recentActivity(supabase, ctx.workspaceId, 5, { entityType: 'brief' }),
    listSubmissions(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 4, from: '', to: '', creator: '', brief: '', assetType: '',
      status: '', reviewer: '', rights: '', issue: '', campaign: '', channel: '', archived: false, sort: 'newest', view: 'gallery',
    }),
    workspaceCampaigns(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
    creatorPickerList(supabase, ctx.workspaceId),
  ])

  const openDelta = delta(aggregates.byStatus.open, aggregates.previous.open)
  const draftDelta = delta(aggregates.byStatus.draft, aggregates.previous.draft)
  const progressDelta = delta(aggregates.byStatus.in_progress, aggregates.previous.inProgress)
  const submittedDelta = delta(aggregates.submittedDeliverables, aggregates.previous.submitted)
  const completionDelta = delta(aggregates.completionRate, aggregates.previous.completionRate)

  const kpis: KpiValue[] = [
    { id: 'open', label: 'Open Briefs', value: formatNumber(aggregates.byStatus.open), hint: `${openDelta.pct >= 0 ? '+' : ''}${openDelta.pct.toFixed(1)}% vs last 30 days`, trend: openDelta.trend, icon: 'file', tone: 'blue' },
    { id: 'draft', label: 'Draft Briefs', value: formatNumber(aggregates.byStatus.draft), hint: `${draftDelta.pct >= 0 ? '+' : ''}${draftDelta.pct.toFixed(1)}% vs last 30 days`, trend: draftDelta.trend, icon: 'file', tone: 'slate' },
    { id: 'progress', label: 'In Progress', value: formatNumber(aggregates.byStatus.in_progress), hint: `${progressDelta.pct >= 0 ? '+' : ''}${progressDelta.pct.toFixed(1)}% vs last 30 days`, trend: progressDelta.trend, icon: 'clock', tone: 'amber' },
    { id: 'submitted', label: 'Submitted Deliverables', value: formatNumber(aggregates.submittedDeliverables), hint: `${submittedDelta.pct >= 0 ? '+' : ''}${submittedDelta.pct.toFixed(1)}% vs last 30 days`, trend: submittedDelta.trend, icon: 'checks', tone: 'violet' },
    { id: 'completion', label: 'Completion Rate', value: formatPercent(aggregates.completionRate, 0), hint: `${completionDelta.pct >= 0 ? '+' : ''}${completionDelta.pct.toFixed(1)}pp vs last 30 days`, trend: completionDelta.trend, icon: 'target', tone: 'green' },
    { id: 'approve-time', label: 'Avg. Time to Approve', value: aggregates.avgApprovalDays !== null ? `${aggregates.avgApprovalDays.toFixed(1)} days` : '—', hint: 'From creation to completion', icon: 'calendar', tone: 'blue' },
  ]

  const filters: FilterSpec[] = [
    { key: 'campaign', label: 'Campaign', allLabel: 'All Campaigns', options: campaigns.map(c => ({ value: c.id, label: c.name })) },
    { key: 'channel', label: 'Channel', allLabel: 'All Channels', options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
    { key: 'owner', label: 'Owner', allLabel: 'All Owners', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })) },
    { key: 'status', label: 'Status', allLabel: 'All Statuses', options: BRIEF_STATUSES.map(s => ({ value: s, label: BRIEF_STATUS_LABELS[s] })) },
    { key: 'due', label: 'Deadline', allLabel: 'Due Anytime', options: [{ value: 'overdue', label: 'Overdue' }, { value: '7', label: 'Next 7 days' }, { value: '30', label: 'Next 30 days' }, { value: '90', label: 'Next 90 days' }], advanced: true },
    { key: 'creator', label: 'Creator', allLabel: 'All Creators', options: creators.map(c => ({ value: c.id, label: c.name })), advanced: true },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Deadline (soonest)', options: BRIEF_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const donutSlices: StatusCount[] = BRIEF_STATUSES.map(status => ({
    key: status, label: BRIEF_STATUS_LABELS[status], value: aggregates.byStatus[status], colour: BRIEF_STATUS_COLOUR[status],
  }))

  return (
    <div className={CREATORS_PAGE}>
      <CreatorsHeader
        module="briefs" modules={modules}
        actions={(
          <>
            {capabilities.createBrief && <CreateBriefButton creators={creators} campaigns={campaigns} />}
            <ExportButton entity="briefs" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data', onSelect: 'refresh' }]} />
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search briefs…" filters={filters}
              views={['cards', 'table', 'timeline']} activeView={query.view} values={query}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CreatorsEmpty
                icon={filtered ? 'search' : 'creators'}
                title={filtered ? 'No briefs match these filters' : 'No briefs yet'}
                message={filtered ? 'Try widening your filters or clearing the search term.' : 'Create your first brief to start assigning work to creators.'}
                action={!filtered && capabilities.createBrief ? <CreateBriefButton creators={creators} campaigns={campaigns} /> : undefined}
              />
            ) : query.view === 'table' ? (
              <BriefTable rows={page.rows} query={query} canEdit={capabilities.editBrief} />
            ) : query.view === 'timeline' ? (
              <BriefTimeline rows={page.rows} />
            ) : (
              <BriefBoard rows={page.rows} canEdit={capabilities.editBrief} />
            )}

            {page.rows.length > 0 && query.view !== 'timeline' && (
              <div className={`${CARD} ${CARD_SHADOW}`}>
                <Pagination page={query.page} size={query.size} total={page.total} label="briefs" />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title="Brief Summary" viewAllHref="/app/analytics">
              <div className="flex items-center gap-4">
                <DonutChart slices={donutSlices} total={aggregates.total} caption="Total Briefs" size={140} thickness={18} />
                <DonutLegend slices={donutSlices} total={aggregates.total} className="flex-1" />
              </div>
            </Panel>

            <Panel title="Upcoming Deadlines" viewAllHref="/app/creators/briefs?due=30">
              {deadlines.length === 0 ? <PanelEmpty message="No upcoming deadlines in the next window." /> : (
                <ul className="space-y-2.5">
                  {deadlines.map(brief => (
                    <li key={brief.id}>
                      <Link href={`/app/creators/briefs/${brief.id}`} className="flex items-center justify-between rounded-lg px-1 py-1 text-[12.5px] hover:bg-slate-50">
                        <span className="min-w-0 truncate text-slate-700">{brief.title}</span>
                        <span className="shrink-0 font-medium text-amber-600">{formatShortDate(brief.deadline)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent Activity" viewAllHref="/app/creators">
              <ActivityFeed items={activity} />
            </Panel>

            <Panel title="Recent Submissions" viewAllHref="/app/creators/submissions" bodyClassName="px-4">
              {submissions.rows.length === 0 ? <PanelEmpty message="Submissions will appear here once creators start delivering." /> : (
                <div className="grid grid-cols-4 gap-1.5">
                  {submissions.rows.map(submission => (
                    <Link
                      key={submission.id} href={`/app/creators/submissions/${submission.id}`}
                      className="aspect-square overflow-hidden rounded-lg bg-slate-100"
                      title={submission.title ?? 'Submission'}
                    >
                      {submission.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={submission.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        : <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No preview</span>}
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}

function BriefBoard({ rows, canEdit }: { rows: Awaited<ReturnType<typeof listBriefs>>['rows']; canEdit: boolean }) {
  const columns = BRIEF_BOARD_STAGES.map(stage => ({ stage, items: rows.filter(row => row.status === stage) }))

  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Briefs Board</p>
          <p className="text-[11px] text-slate-400">Change a brief&apos;s status from its card menu · {rows.length} briefs shown</p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto p-3">
        {columns.map(({ stage, items }) => (
          <div key={stage} className="w-72 shrink-0 rounded-xl bg-slate-50/70 p-2.5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BRIEF_STATUS_COLOUR[stage] }} aria-hidden />
              <p className="text-[12.5px] font-semibold text-slate-700">{BRIEF_STATUS_LABELS[stage]}</p>
              <span className="ml-auto text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-2 py-4 text-center text-[11px] text-slate-400">Nothing here</p>}
              {items.map(brief => (
                <div key={brief.id} className="group rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                  <Link href={`/app/creators/briefs/${brief.id}`} className="block">
                    <p className="truncate text-[13px] font-medium text-slate-900">{brief.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{brief.campaign?.name ?? 'No linked campaign'}</p>
                  </Link>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{brief.creators_assigned} creator{brief.creators_assigned === 1 ? '' : 's'}</span>
                    <span>{brief.deadline ? formatShortDate(brief.deadline) : 'No deadline'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <ChannelChips channels={brief.channels} max={2} />
                    {canEdit && <BriefStatusMenu id={brief.id} current={brief.status as BriefStatus} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BriefTable({
  rows, canEdit,
}: { rows: Awaited<ReturnType<typeof listBriefs>>['rows']; query: ReturnType<typeof parseBriefsQuery>; canEdit: boolean }) {
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Brief</th>
              <th className="px-3 py-2.5 font-medium">Campaign</th>
              <th className="px-3 py-2.5 font-medium">Creators</th>
              <th className="px-3 py-2.5 font-medium">Deliverables</th>
              <th className="px-3 py-2.5 font-medium">Deadline</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Approval</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(brief => (
              <tr key={brief.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <Link href={`/app/creators/briefs/${brief.id}`} className="font-medium text-slate-800 hover:text-blue-600">{brief.title}</Link>
                </td>
                <td className="px-3 py-2.5 text-slate-500">{brief.campaign?.name ?? '—'}</td>
                <td className="px-3 py-2.5 text-slate-600">{brief.creators_assigned}</td>
                <td className="px-3 py-2.5 text-slate-600">{brief.deliverables_submitted} / {brief.deliverables_target || '—'}</td>
                <td className="px-3 py-2.5 text-slate-600">{brief.deadline ? formatShortDate(brief.deadline) : '—'}</td>
                <td className="px-3 py-2.5"><Badge variant={BRIEF_STATUS_BADGE[brief.status as BriefStatus]}>{BRIEF_STATUS_LABELS[brief.status as BriefStatus]}</Badge></td>
                <td className="px-3 py-2.5"><Badge variant={BRIEF_APPROVAL_BADGE[brief.approval_stage as keyof typeof BRIEF_APPROVAL_BADGE]}>{BRIEF_APPROVAL_LABELS[brief.approval_stage as keyof typeof BRIEF_APPROVAL_LABELS] ?? brief.approval_stage}</Badge></td>
                <td className="px-3 py-2.5"><PersonChip person={brief.owner} /></td>
                <td className="px-4 py-2.5 text-right">{canEdit && <BriefStatusMenu id={brief.id} current={brief.status as BriefStatus} compact />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BriefTimeline({ rows }: { rows: Awaited<ReturnType<typeof listBriefs>>['rows'] }) {
  const withDates = rows.filter(row => row.deadline)
  if (withDates.length === 0) {
    return <CreatorsEmpty title="No dated briefs" message="Briefs need a deadline to appear on the timeline." />
  }
  const sorted = [...withDates].sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  return (
    <div className={`${CARD} ${CARD_SHADOW} p-4`}>
      <ol className="space-y-4 border-l-2 border-slate-100 pl-4">
        {sorted.map(brief => (
          <li key={brief.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white" style={{ backgroundColor: BRIEF_STATUS_COLOUR[brief.status as BriefStatus] }} aria-hidden />
            <Link href={`/app/creators/briefs/${brief.id}`} className="text-[13px] font-medium text-slate-800 hover:text-blue-600">{brief.title}</Link>
            <p className="text-[11px] text-slate-400">{formatShortDate(brief.deadline)} · {brief.creators_assigned} creators · {formatMoneyShort(brief.budget, brief.currency ?? 'GBP')}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
