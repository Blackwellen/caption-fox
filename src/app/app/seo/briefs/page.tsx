import Link from 'next/link'
import { ExternalLink, Kanban, LayoutGrid, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import { getActivity, getBriefCounts, getBriefs, getOpportunities } from '@/lib/seo/queries'
import { extraKpi } from '@/lib/seo/kpis'
import { matchPreset } from '@/lib/seo/range'
import { formatCompact, formatDate, humanise } from '@/lib/seo/format'
import { dueLabel } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readParam, readNumber } from '@/lib/seo/url-state'
import {
  Card, CardHeader, EmptyPanel, IntentChip, ProgressBar, StatusChip,
} from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, Pagination, SortSelect, ViewSwitcher } from '@/components/seo/FilterBar'
import { CreateBriefWizard } from '@/components/seo/wizards/CreateBriefWizard'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'
import type { SeoBrief } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'board', label: 'Board', icon: <Kanban size={13} /> },
] as const

const BOARD_COLUMNS = ['draft', 'in_progress', 'awaiting_review', 'changes_requested', 'approved', 'published'] as const

export default async function SeoBriefsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('briefs', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return <SeoPageChrome tab="briefs" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>{!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start planning content briefs." />}</SeoPageChrome>
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'cards')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)

  const filters = {
    q: readParam(params, 'q'),
    status: view === 'board' ? undefined : readParam(params, 'status'),
    contentType: readParam(params, 'contentType'),
    priority: readParam(params, 'priority'),
    sort: readParam(params, 'sort') ?? 'due.asc',
    page: readNumber(params, 'page') ?? 1,
    pageSize: view === 'board' ? 200 : view === 'cards' ? 8 : 10,
  }

  const [counts, list, opportunities, activity] = await Promise.all([
    getBriefCounts(scope),
    getBriefs(scope, filters),
    getOpportunities(scope, { scope: 'content', limit: 5 }),
    getActivity(scope, 'briefs', 4),
  ])

  const contentGaps = await getOpportunities(scope, { scope: 'organic', limit: 50 })
  const gapCount = contentGaps.filter(o => o.category === 'content_gap' || o.category === 'faq_opportunity').length

  const kpis = [
    extraKpi('briefs', 'Total Briefs', counts.total, null, 'Content briefs tracked for this site, excluding archived briefs.', 'internal_tracker'),
    extraKpi('in-progress', 'In Progress', counts.inProgress, null, 'Briefs currently in the In Progress status.', 'internal_tracker'),
    extraKpi('awaiting-review', 'Awaiting Review', counts.awaitingReview, null, 'Briefs awaiting review or with changes requested.', 'internal_tracker'),
    extraKpi('published', 'Published', counts.published, null, 'Briefs published to a live URL.', 'internal_tracker'),
    extraKpi('gaps', 'Content Gaps', gapCount, null, 'Open content-gap and FAQ opportunities not yet attached to a brief.', 'internal_tracker'),
    extraKpi('traffic-potential', 'Est. Traffic Potential', counts.estTraffic, null, 'Sum of estimated monthly traffic potential across all briefs.', 'internal_tracker', 'compact'),
  ]

  const queryString = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])).toString()
  const selected = list.rows[0] ?? null

  return (
    <SeoPageChrome tab="briefs" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Briefs"
        subtitle="Manage SEO content briefs, track progress, and plan your organic content pipeline."
        pathname="/app/seo/briefs"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportBriefs ? buildExportHref('briefs', params) : undefined}
        primarySlot={capabilities.createBrief ? <CreateBriefWizard /> : undefined}
      />

      <div className="mb-5"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <FilterBar
            pathname="/app/seo/briefs"
            params={params}
            searchPlaceholder="Search briefs..."
            resultCount={list.total}
            resultNoun="briefs"
            selects={view === 'board' ? [] : [
              { key: 'status', placeholder: 'All Status', options: ['draft', 'in_progress', 'awaiting_review', 'changes_requested', 'approved', 'published'].map(v => ({ value: v, label: humanise(v) })) },
              { key: 'contentType', placeholder: 'Content Type', options: ['guide', 'how_to', 'checklist', 'listicle', 'comparison', 'landing_page', 'blog', 'case_study', 'faq'].map(v => ({ value: v, label: humanise(v) })) },
              { key: 'priority', placeholder: 'Priority', options: ['high', 'medium', 'low'].map(v => ({ value: v, label: humanise(v) })) },
            ]}
          />
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <ViewSwitcher pathname="/app/seo/briefs" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />
            {view !== 'board' && (
              <SortSelect
                pathname="/app/seo/briefs"
                params={params}
                options={[
                  { value: 'due.asc', label: 'Due date: Soonest' },
                  { value: 'completion.desc', label: 'Completion: Highest' },
                  { value: 'traffic.desc', label: 'Traffic potential' },
                  { value: 'title.asc', label: 'Title: A-Z' },
                ]}
              />
            )}
          </div>

          {view === 'board'
            ? <BoardView rows={list.rows} />
            : view === 'table'
              ? <TableView rows={list.rows} />
              : <CardsListView rows={list.rows} />}

          {view !== 'board' && <Pagination pathname="/app/seo/briefs" params={params} page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} />}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Brief Insights" />
            {selected
              ? (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-800">{selected.title}</p>
                  <p className="text-xs text-slate-500">{selected.target_keyword}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <Stat label="Current Rank" value={selected.keyword?.current_rank != null ? `#${selected.keyword.current_rank}` : 'Not ranking'} />
                    <Stat label="Search Volume" value={formatCompact(selected.keyword?.search_volume ?? 0)} />
                    <Stat label="Difficulty" value={selected.keyword?.difficulty != null ? String(selected.keyword.difficulty) : '—'} />
                    <Stat label="CPC" value={selected.keyword?.cpc != null ? `£${selected.keyword.cpc.toFixed(2)}` : '—'} />
                  </div>
                </div>
              )
              : <EmptyPanel title="No brief selected" description="Briefs matching your filters will show source keyword insights here." />}
          </Card>

          <Card className="p-5">
            <CardHeader title="Opportunities to Brief Next" action={<Link href="/app/seo/keywords" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
            <ul className="mt-3 space-y-2 text-sm">
              {opportunities.length === 0 && <li className="text-xs text-slate-400">No open content opportunities right now.</li>}
              {opportunities.map(opp => (
                <li key={opp.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-700">{opp.title}</span>
                  <span className="shrink-0 text-xs font-medium text-slate-400">{formatCompact(opp.search_volume)} vol</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ActivityFeed title="Recent Activity" items={activity} />
    </SeoPageChrome>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-slate-400">{label}</p><p className="mt-0.5 font-semibold text-slate-800">{value}</p></div>
}

function BriefRow({ brief }: { brief: SeoBrief }) {
  const due = dueLabel(brief.due_date)
  return (
    <Link href={`/app/seo/briefs/${brief.id}`} className="block px-5 py-3.5 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
            {brief.title}
            {brief.published_url && <ExternalLink size={12} className="shrink-0 text-slate-400" />}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{brief.target_keyword}</p>
        </div>
        <StatusChip status={brief.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <IntentChip intent={brief.intent} />
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{humanise(brief.content_type)}</span>
        <StatusChip status={brief.priority} />
        <span className={due.overdue ? 'font-medium text-red-600' : ''}>{brief.due_date ? formatDate(brief.due_date) : 'No due date'} · {due.text}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="w-40"><ProgressBar value={brief.completion} label={`${brief.title} completion`} /></div>
        <span className="text-xs font-medium text-slate-500">{brief.completion}%</span>
      </div>
    </Link>
  )
}

function CardsListView({ rows }: { rows: SeoBrief[] }) {
  if (rows.length === 0) return <EmptyPanel title="No briefs match these filters" description="Create a brief from a keyword or opportunity to start planning content." />
  return <div className="divide-y divide-slate-100">{rows.map(brief => <BriefRow key={brief.id} brief={brief} />)}</div>
}

function TableView({ rows }: { rows: SeoBrief[] }) {
  if (rows.length === 0) return <EmptyPanel title="No briefs match these filters" description="Create a brief from a keyword or opportunity to start planning content." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-2 text-left">Brief</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Priority</th>
            <th className="px-3 py-2 text-left">Owner</th>
            <th className="px-3 py-2 text-left">Due</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Complete</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(brief => (
            <tr key={brief.id} className="h-12 border-b border-slate-100 last:border-0">
              <td className="px-5 py-2.5"><Link href={`/app/seo/briefs/${brief.id}`} className="font-medium text-slate-800 hover:text-blue-600">{brief.title}</Link></td>
              <td className="px-3 py-2.5 text-slate-600">{humanise(brief.content_type)}</td>
              <td className="px-3 py-2.5"><StatusChip status={brief.priority} /></td>
              <td className="px-3 py-2.5 text-slate-600">{brief.owner?.full_name ?? '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{brief.due_date ? formatDate(brief.due_date) : '—'}</td>
              <td className="px-3 py-2.5"><StatusChip status={brief.status} /></td>
              <td className="px-3 py-2.5 text-slate-600">{brief.completion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BoardView({ rows }: { rows: SeoBrief[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 overflow-x-auto p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {BOARD_COLUMNS.map(status => {
        const items = rows.filter(row => row.status === status)
        return (
          <div key={status} className="min-w-[200px]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-slate-600">{humanise(status)}</p>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(brief => (
                <Link key={brief.id} href={`/app/seo/briefs/${brief.id}`} className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-300">
                  <p className="line-clamp-2 text-xs font-medium text-slate-800">{brief.title}</p>
                  <div className="mt-2"><ProgressBar value={brief.completion} label={`${brief.title} completion`} /></div>
                </Link>
              ))}
              {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">No briefs</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
