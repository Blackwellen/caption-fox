import Link from 'next/link'
import { ExternalLink, Kanban, LayoutGrid, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getBriefComments, getBriefCounts, getBriefSections, getBriefs, getKeywordSparks, getOpportunities,
} from '@/lib/seo/queries'
import { extraKpi } from '@/lib/seo/kpis'
import { matchPreset } from '@/lib/seo/range'
import { dueLabel, formatCompact, formatDate, humanise, relativeTime } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { buildExportHref, buildHref, readEnum, readNumber, readParam, type SearchParams } from '@/lib/seo/url-state'
import {
  SEO_TOKENS, Card, CardHeader, DemoBadge, DifficultyChip, EmptyPanel, IntentChip, OwnerAvatar, ProgressBar, StatusChip,
} from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, Pagination, ViewSwitcher } from '@/components/seo/FilterBar'
import { MiniTrend } from '@/components/seo/charts'
import { CreateBriefWizard } from '@/components/seo/wizards/CreateBriefWizard'
import { BriefStatusControl } from '@/components/seo/wizards/BriefStatusControl'
import { BriefCommentComposer } from '@/components/seo/wizards/BriefCommentComposer'
import type { SeoBrief } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'board', label: 'Board', icon: <Kanban size={13} /> },
] as const

const BOARD_COLUMNS = ['draft', 'in_progress', 'awaiting_review', 'changes_requested', 'approved', 'published'] as const
const STATUSES = ['draft', 'in_progress', 'awaiting_review', 'changes_requested', 'approved', 'published']
const CONTENT_TYPES = ['guide', 'how_to', 'checklist', 'listicle', 'comparison', 'landing_page', 'blog', 'case_study', 'faq']

export default async function SeoBriefsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('briefs', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return (
      <SeoPageChrome tab="briefs" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>
        {!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start planning content briefs." />}
      </SeoPageChrome>
    )
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'cards')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)

  const filters = {
    q: readParam(params, 'q'),
    status: view === 'board' ? undefined : readParam(params, 'status'),
    owner: readParam(params, 'owner'),
    contentType: readParam(params, 'contentType'),
    priority: readParam(params, 'priority'),
    due: readEnum(params, 'due', ['overdue', 'this_week', 'no_date'] as const),
    sort: readParam(params, 'sort') ?? 'due.asc',
    page: readNumber(params, 'page') ?? 1,
    pageSize: view === 'board' ? 200 : 6,
  }

  const [counts, list, opportunities, activity, gapPool] = await Promise.all([
    getBriefCounts(scope),
    getBriefs(scope, filters),
    getOpportunities(scope, { scope: 'content', limit: 5 }),
    getActivity(scope, 'briefs', 4),
    getOpportunities(scope, { scope: 'organic', limit: 50 }),
  ])

  const gapCount = gapPool.filter(o => o.category === 'content_gap' || o.category === 'faq_opportunity').length

  // The rail follows an explicit URL selection, falling back to the first row.
  const selectedId = readParam(params, 'brief')
  const selected = list.rows.find(row => row.id === selectedId) ?? list.rows[0] ?? null

  const [sections, comments, keywordSpark] = selected
    ? await Promise.all([
      getBriefSections(scope, selected.id),
      getBriefComments(scope, selected.id),
      selected.keyword_id
        ? getKeywordSparks(scope, [selected.keyword_id], range.from)
        : Promise.resolve(new Map<string, { date: string; position: number | null }[]>()),
    ])
    : [[], [], new Map<string, { date: string; position: number | null }[]>()]

  const kpis = [
    extraKpi('briefs', 'Total Briefs', counts.total, null, 'Content briefs tracked for this site, excluding archived briefs.', 'internal_tracker'),
    extraKpi('in-progress', 'In Progress', counts.inProgress, null, 'Briefs currently in the In Progress status.', 'internal_tracker'),
    extraKpi('awaiting-review', 'Awaiting Review', counts.awaitingReview, null, 'Briefs awaiting review or with changes requested.', 'internal_tracker'),
    extraKpi('published', 'Published', counts.published, null, 'Briefs published to a live URL.', 'internal_tracker'),
    extraKpi('gaps', 'Content Gaps', gapCount, null, 'Open content-gap and FAQ opportunities not yet attached to a brief.', 'internal_tracker'),
    extraKpi('traffic-potential', 'Est. Traffic Potential', counts.estTraffic, null, 'Sum of estimated monthly traffic potential across all briefs.', 'internal_tracker', 'compact'),
  ]

  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])),
  ).toString()

  const filterSelects = view === 'board' ? [] : [
    { key: 'status', placeholder: 'All Status', options: STATUSES.map(v => ({ value: v, label: humanise(v) })) },
    { key: 'contentType', placeholder: 'Content Type', options: CONTENT_TYPES.map(v => ({ value: v, label: humanise(v) })) },
    { key: 'priority', placeholder: 'Priority', options: ['high', 'medium', 'low'].map(v => ({ value: v, label: humanise(v) })) },
  ]
  const moreFilters = [
    { key: 'due', placeholder: 'Due date', options: [{ value: 'overdue', label: 'Overdue' }, { value: 'this_week', label: 'Due this week' }, { value: 'no_date', label: 'No due date' }] },
    { key: 'sort', placeholder: 'Sort by', options: [
      { value: 'due.asc', label: 'Due date: Soonest' },
      { value: 'completion.desc', label: 'Completion: Highest' },
      { value: 'traffic.desc', label: 'Traffic potential' },
      { value: 'title.asc', label: 'Title: A–Z' },
    ] },
  ]

  return (
    <SeoPageChrome tab="briefs" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Briefs"
        subtitle="Manage SEO content briefs, track progress, and plan your organic content pipeline."
        pathname="/app/seo/briefs"
        activePreset={matchPreset(range)}
        rangeLabel={range.label}
        params={params}
        filters={[...filterSelects, ...moreFilters]}
        badge={site.is_demo ? <span title={`Seeded demonstration data for ${site.domain}.`}><DemoBadge /></span> : undefined}
        exportHref={capabilities.exportBriefs ? buildExportHref('briefs', params) : undefined}
        primarySlot={capabilities.createBrief
          ? (
            <CreateBriefWizard
              menu={[
                { label: 'Brief from an opportunity', description: 'Start from an open content gap.', href: '/app/seo/briefs?view=cards&sort=traffic.desc' },
                { label: 'Open the pipeline board', description: 'See every brief by status.', href: '/app/seo/briefs?view=board' },
              ]}
            />
          )
          : undefined}
      />

      <div className="mb-3"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="mb-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_346px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0 overflow-hidden">
            <FilterBar
              pathname="/app/seo/briefs"
              params={params}
              searchPlaceholder="Search briefs..."
              resultCount={list.total}
              resultNoun="briefs"
              selects={filterSelects}
              leading={<ViewSwitcher pathname="/app/seo/briefs" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />}
            />

            {view === 'board'
              ? <BoardView rows={list.rows} canReview={capabilities.reviewBrief} />
              : view === 'table'
                ? <TableView rows={list.rows} />
                : <CardsListView rows={list.rows} params={params} selectedId={selected?.id ?? null} canReview={capabilities.reviewBrief} />}

            {view !== 'board' && (
              <Pagination
                pathname="/app/seo/briefs"
                params={params}
                page={list.page}
                pageCount={list.pageCount}
                total={list.total}
                pageSize={list.pageSize}
                noun="briefs"
              />
            )}
          </Card>

          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <ActivityFeed title="Recent Activity" items={activity} layout="list" viewAllHref="/app/seo" />

            <Card className="min-w-0">
              <CardHeader
                title="Comments"
                subtitle={selected ? selected.title : undefined}
                action={selected ? <Link href={`/app/seo/briefs/${selected.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link> : undefined}
              />
              {!selected
                ? <EmptyPanel title="No brief selected" description="Select a brief to read and reply to its comments." />
                : comments.length === 0
                  ? <EmptyPanel title="No comments yet" description="Start the conversation for this brief — reviewers will see it on the brief page." />
                  : (
                    <ul className="divide-y divide-slate-100">
                      {comments.slice(0, 3).map(comment => (
                        <li key={comment.id} className="flex items-start gap-2 px-3 py-2">
                          <OwnerAvatar owner={comment.author ?? null} size={22} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-baseline gap-1.5 text-[12px]">
                              <span className="font-semibold text-slate-800">{comment.author?.full_name ?? 'Teammate'}</span>
                              <span className="text-[11px] text-slate-400">{relativeTime(comment.created_at)}</span>
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-slate-600">{comment.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              {selected && capabilities.reviewBrief && (
                <div className="border-t border-slate-100 px-3 py-2">
                  <BriefCommentComposer briefId={selected.id} compact />
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader
              title="Brief Insights"
              action={selected ? <Link href={`/app/seo/briefs/${selected.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">View full report</Link> : undefined}
            />
            {!selected
              ? <EmptyPanel title="No brief selected" description="Briefs matching your filters will show source keyword insights here." />
              : (
                <div className="p-3">
                  <Link href={`/app/seo/briefs/${selected.id}`} className="flex items-center gap-1 text-[13px] font-semibold text-slate-800 hover:text-blue-600">
                    <span className="truncate">{selected.title}</span>
                    <ExternalLink size={11} className="shrink-0 text-slate-400" aria-hidden />
                  </Link>
                  <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{selected.target_keyword}</p>
                  <dl className="mt-2.5 grid grid-cols-4 gap-2">
                    <Stat label="Current Rank" value={selected.keyword?.current_rank != null ? `#${selected.keyword.current_rank}` : 'Not ranking'} />
                    <Stat label="Search Volume" value={formatCompact(selected.keyword?.search_volume ?? 0)} />
                    <Stat label="KD" value={selected.keyword?.difficulty != null ? String(selected.keyword.difficulty) : '—'} chip={selected.keyword?.difficulty ?? null} />
                    <Stat label="CPC" value={selected.keyword?.cpc != null ? `£${Number(selected.keyword.cpc).toFixed(2)}` : '—'} />
                  </dl>
                  <div className="mt-3 rounded-lg border border-slate-200 p-2">
                    <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden />
                      Ranking Trend
                    </p>
                    {selected.keyword_id && (keywordSpark.get(selected.keyword_id)?.length ?? 0) > 1
                      ? <MiniTrend wide reversed colour="#2563EB" data={(keywordSpark.get(selected.keyword_id) ?? []).map(p => ({ value: p.position }))} />
                      : <p className="py-2 text-center text-[11px] text-slate-400">No ranking history for this keyword yet.</p>}
                  </div>
                </div>
              )}
          </Card>

          <Card>
            <CardHeader
              title="Brief Outline Preview"
              action={selected
                ? <Link href={`/app/seo/briefs/${selected.id}#outline`} className="inline-flex h-6 items-center rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50">Edit Outline</Link>
                : undefined}
            />
            {!selected
              ? <EmptyPanel title="No brief selected" description="Select a brief to preview its outline." />
              : sections.length === 0
                ? <EmptyPanel title="No outline yet" description="Add H1, H2 and H3 sections on the brief page to build its outline." />
                : (
                  <ol className="divide-y divide-slate-100">
                    {sections.slice(0, 9).map(section => (
                      <li key={section.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="w-5 shrink-0 rounded bg-slate-100 text-center text-[10px] font-semibold uppercase text-slate-500">{section.level}</span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-700">{section.title}</span>
                        <span
                          aria-label={section.completed ? 'Complete' : 'Not started'}
                          title={section.completed ? 'Complete' : 'Not started'}
                          className={section.completed
                            ? 'h-3.5 w-3.5 shrink-0 rounded-full bg-emerald-100 ring-1 ring-inset ring-emerald-400'
                            : 'h-3.5 w-3.5 shrink-0 rounded-full bg-white ring-1 ring-inset ring-slate-300'}
                        />
                      </li>
                    ))}
                  </ol>
                )}
          </Card>

          <Card>
            <CardHeader
              title="Opportunities to Brief Next"
              action={<Link href="/app/seo/keywords" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>}
            />
            {opportunities.length === 0
              ? <EmptyPanel title="No open content opportunities" description="Content gaps and FAQ opportunities appear here once keyword coverage is analysed." />
              : (
                <table className="w-full table-fixed text-[12px]">
                  <thead>
                    <tr className={SEO_TOKENS.tableHead}>
                      <th scope="col" className="w-[48%] px-3 py-1.5 text-left">Keyword</th>
                      <th scope="col" className="w-[17%] px-1 py-1.5 text-right">Vol.</th>
                      <th scope="col" className="w-[13%] px-1 py-1.5 text-right">KD</th>
                      <th scope="col" className="w-[22%] px-2 py-1.5 text-right leading-tight">Potential<br />Traffic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map(opp => (
                      <tr key={opp.id} className={SEO_TOKENS.tableRowTight}>
                        <td className="truncate px-3 py-1 text-slate-700">{opp.title}</td>
                        <td className="px-1 py-1 text-right text-slate-600">{formatCompact(opp.search_volume)}</td>
                        <td className="px-1 py-1 text-right">{opp.potential_rank != null ? <DifficultyChip value={opp.potential_rank} /> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-2 py-1 text-right text-slate-600">{formatCompact(opp.potential_traffic)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </Card>
        </div>
      </div>
    </SeoPageChrome>
  )
}

function Stat({ label, value, chip }: { label: string; value: string; chip?: number | null }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10.5px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px] font-semibold text-slate-800">
        {chip != null ? <DifficultyChip value={chip} /> : value}
      </dd>
    </div>
  )
}

/**
 * The reference's default Cards view: one dense row per brief under a shared
 * column header, with the row acting as the rail selection and the title
 * linking through to the brief.
 */
function CardsListView({
  rows, params, selectedId, canReview,
}: { rows: SeoBrief[]; params: SearchParams; selectedId: string | null; canReview: boolean }) {
  if (rows.length === 0) {
    return <EmptyPanel title="No briefs match these filters" description="Create a brief from a keyword or opportunity to start planning content." />
  }
  return (
    <div className="relative overflow-x-auto">
      <div className="min-w-[780px]">
        <div className={`grid grid-cols-[minmax(0,1fr)_68px_88px_54px_38px_80px_108px_70px] items-center gap-1.5 border-b border-slate-100 px-3 py-1.5 ${SEO_TOKENS.tableHead}`}>
          <span>Brief &amp; Keyword</span>
          <span className="truncate">Type</span>
          <span>Intent</span>
          <span>Priority</span>
          <span className="truncate">Owner</span>
          <span>Due Date</span>
          <span>Status</span>
          <span>Complete</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.map(brief => {
            const due = dueLabel(brief.due_date)
            const current = brief.id === selectedId
            return (
              <li
                key={brief.id}
                className={current ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_68px_88px_54px_38px_80px_108px_70px] items-center gap-1.5 px-3 py-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Link
                      href={buildHref('/app/seo/briefs', params, { brief: brief.id })}
                      scroll={false}
                      aria-label={`Show insights for ${brief.title}`}
                      aria-current={current ? 'true' : undefined}
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded border ${current ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white hover:border-blue-400'}`}
                    >
                      {current && (
                        <svg viewBox="0 0 12 12" className="h-full w-full text-white" aria-hidden>
                          <path d="M3 6.2 5 8.2 9 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/app/seo/briefs/${brief.id}`} className="flex items-center gap-1 text-[12px] font-medium text-slate-800 hover:text-blue-600">
                        <span className="truncate">{brief.title}</span>
                        {brief.published_url && <ExternalLink size={11} className="shrink-0 text-slate-400" aria-hidden />}
                      </Link>
                      <p className="truncate text-[11px] text-slate-500">{brief.target_keyword}</p>
                      {brief.keyword && (
                        <p className="truncate text-[10.5px] text-slate-400">
                          Vol: {formatCompact(brief.keyword.search_volume)}
                          {brief.keyword.difficulty != null && <> · KD: {brief.keyword.difficulty}</>}
                          {brief.keyword.cpc != null && <> · CPC: £{Number(brief.keyword.cpc).toFixed(2)}</>}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="justify-self-start truncate rounded bg-slate-100 px-1.5 py-0.5 text-center text-[10.5px] text-slate-600">{humanise(brief.content_type)}</span>
                  <span className="min-w-0"><IntentChip intent={brief.intent} /></span>
                  <span className="min-w-0"><StatusChip status={brief.priority} /></span>
                  <span><OwnerAvatar owner={brief.owner} size={22} /></span>
                  <span className="min-w-0 text-[11px]">
                    <span className="block truncate text-slate-600">{brief.due_date ? formatDate(brief.due_date) : 'No due date'}</span>
                    <span className={due.overdue ? 'block truncate font-medium text-red-600' : 'block truncate text-slate-400'}>{due.text}</span>
                  </span>
                  <span className="min-w-0">
                    {canReview
                      ? <BriefStatusControl briefId={brief.id} status={brief.status} compact />
                      : <StatusChip status={brief.status} />}
                  </span>
                  <span className="min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-slate-600">{brief.completion}%</span>
                    <ProgressBar value={brief.completion} label={`${brief.title} completion`} />
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function TableView({ rows }: { rows: SeoBrief[] }) {
  if (rows.length === 0) {
    return <EmptyPanel title="No briefs match these filters" description="Create a brief from a keyword or opportunity to start planning content." />
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed text-[12.5px]">
        <colgroup>
          <col className="w-[30%]" /><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[10%]" />
          <col className="w-[13%]" /><col className="w-[14%]" /><col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className={SEO_TOKENS.tableHead}>
            <th scope="col" className="px-3 py-2 text-left">Brief</th>
            <th scope="col" className="px-2 py-2 text-left">Type</th>
            <th scope="col" className="px-2 py-2 text-left">Priority</th>
            <th scope="col" className="px-2 py-2 text-left">Owner</th>
            <th scope="col" className="px-2 py-2 text-left">Due</th>
            <th scope="col" className="px-2 py-2 text-left">Status</th>
            <th scope="col" className="px-2 py-2 text-left">Complete</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(brief => (
            <tr key={brief.id} className={SEO_TOKENS.tableRowTight}>
              <td className="truncate px-3 py-1.5">
                <Link href={`/app/seo/briefs/${brief.id}`} className="font-medium text-slate-800 hover:text-blue-600">{brief.title}</Link>
              </td>
              <td className="truncate px-2 py-1.5 text-slate-600">{humanise(brief.content_type)}</td>
              <td className="px-2 py-1.5"><StatusChip status={brief.priority} /></td>
              <td className="px-2 py-1.5"><OwnerAvatar owner={brief.owner} size={22} /></td>
              <td className="truncate px-2 py-1.5 text-slate-600">{brief.due_date ? formatDate(brief.due_date) : '—'}</td>
              <td className="px-2 py-1.5"><StatusChip status={brief.status} /></td>
              <td className="px-2 py-1.5 text-slate-600">{brief.completion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BoardView({ rows, canReview }: { rows: SeoBrief[]; canReview: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 overflow-x-auto p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {BOARD_COLUMNS.map(status => {
        const items = rows.filter(row => row.status === status)
        return (
          <div key={status} className="min-w-[170px]">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <p className="text-[11.5px] font-semibold text-slate-600">{humanise(status)}</p>
              <span className="text-[11px] text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map(brief => (
                <div key={brief.id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <Link href={`/app/seo/briefs/${brief.id}`} className="line-clamp-2 text-[11.5px] font-medium text-slate-800 hover:text-blue-600">{brief.title}</Link>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <OwnerAvatar owner={brief.owner} size={18} />
                    <span className="flex-1"><ProgressBar value={brief.completion} label={`${brief.title} completion`} /></span>
                    <span className="text-[10px] text-slate-400">{brief.completion}%</span>
                  </div>
                  {canReview && (
                    <div className="mt-1.5">
                      <BriefStatusControl briefId={brief.id} status={brief.status} compact />
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-[10.5px] text-slate-400">No briefs</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
