import Link from 'next/link'
import { ExternalLink, LayoutGrid, ListTree, Star, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getClusters, getKeywordFacts, getKeywords, getKeywordSparks, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis, extraKpi } from '@/lib/seo/kpis'
import { matchPreset } from '@/lib/seo/range'
import { averageRank, estimatedTraffic, quickWinScore, visibilityScore } from '@/lib/seo/metrics'
import { formatCompact, formatRank, humanise } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readNumber, readParam } from '@/lib/seo/url-state'
import {
  SEO_TOKENS, Card, CardHeader, DifficultyChip, EmptyPanel, IntentChip, RankChange, StatusChip,
} from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, Pagination, SortSelect, ViewSwitcher } from '@/components/seo/FilterBar'
import { Donut, DistributionBars, TrendChart, MiniTrend } from '@/components/seo/charts'
import { rankDistribution } from '@/lib/seo/metrics'
import { AddKeywordsWizard } from '@/components/seo/wizards/AddKeywordsWizard'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'
import type { SeoKeyword } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
  { id: 'clusters', label: 'Clusters', icon: <ListTree size={13} /> },
] as const

export default async function SeoKeywordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('keywords', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return <SeoPageChrome tab="keywords" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>{!blocked && <NoSite />}</SeoPageChrome>
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'table')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)

  const filters = {
    q: readParam(params, 'q'),
    intent: readParam(params, 'intent'),
    cluster: readParam(params, 'cluster'),
    status: readParam(params, 'status'),
    device: readParam(params, 'device'),
    position: readParam(params, 'position'),
    volumeMin: readNumber(params, 'volumeMin'),
    difficultyMin: readNumber(params, 'difficultyMin'),
    sort: readParam(params, 'sort') ?? 'volume.desc',
    page: readNumber(params, 'page') ?? 1,
    pageSize: view === 'cards' ? 12 : 10,
  }

  const [{ current, previous }, clusters, facts, list] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getClusters(scope),
    getKeywordFacts(scope),
    view === 'clusters' ? Promise.resolve(null) : getKeywords(scope, filters),
  ])

  const sparks = list ? await getKeywordSparks(scope, list.rows.map(k => k.id), range.from) : new Map()
  const activity = await getActivity(scope, 'keywords', 4)

  const kpis = buildKpis('keywords', current, previous, 'google_search_console').concat([
    extraKpi('keyword-opps', 'Keyword Opportunities', facts.filter(k => quickWinScore(k) >= 60).length, null, 'Keywords with a quick-win score of 60 or higher. See tooltip on Quick Wins below for the formula.', 'internal_tracker'),
    extraKpi('traffic', 'Est. Organic Traffic', estimatedTraffic(facts), null, 'Estimated monthly organic sessions from tracked keywords at their current position.', 'google_search_console', 'compact'),
  ])

  const distribution = rankDistribution(facts)
  const clusterDonut = clusters.map((cluster, i) => ({
    label: cluster.name,
    value: facts.filter(k => k.cluster_id === cluster.id).length,
    colour: cluster.colour || DONUT_PALETTE[i % DONUT_PALETTE.length],
  })).filter(c => c.value > 0)

  const intentBreakdown = (['informational', 'transactional', 'commercial', 'navigational', 'other'] as const)
    .map(intent => ({ intent, count: facts.filter(k => k.intent === intent).length }))
    .filter(row => row.count > 0)

  const quickWins = [...facts]
    .map(k => ({ ...k, score: quickWinScore(k) }))
    .filter(k => k.current_rank != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const trendRows = current.map(row => ({ date: row.date, avg_position: row.avg_position, visibility_score: row.visibility_score }))

  const queryString = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])).toString()

  return (
    <SeoPageChrome tab="keywords" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Keywords"
        subtitle="Manage your tracked keywords and monitor organic discovery performance."
        pathname="/app/seo/keywords"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportKeywords ? buildExportHref('keywords', params) : undefined}
        primarySlot={capabilities.addKeywords ? <AddKeywordsWizard clusters={clusters} /> : undefined}
      />

      <div className="mb-5"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="mb-5">
        <Card>
          <FilterBar
            pathname="/app/seo/keywords"
            params={params}
            searchPlaceholder="Search keywords..."
            resultCount={list?.total}
            resultNoun="keywords"
            selects={[
              { key: 'intent', placeholder: 'Intent', options: ['informational', 'transactional', 'commercial', 'navigational'].map(v => ({ value: v, label: humanise(v) })) },
              { key: 'cluster', placeholder: 'Cluster', options: clusters.map(c => ({ value: c.id, label: c.name })) },
              { key: 'position', placeholder: 'Position', options: ['1-3', '4-10', '11-20', '21-50', '51-100', 'not-ranking'].map(v => ({ value: v, label: v === 'not-ranking' ? 'Not ranking' : v })) },
              { key: 'status', placeholder: 'Status', options: ['winning', 'rising', 'stable', 'declining', 'not_ranking'].map(v => ({ value: v, label: humanise(v) })) },
            ]}
          />
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <ViewSwitcher pathname="/app/seo/keywords" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />
            {view !== 'clusters' && (
              <SortSelect
                pathname="/app/seo/keywords"
                params={params}
                options={[
                  { value: 'volume.desc', label: 'Volume: High to low' },
                  { value: 'volume.asc', label: 'Volume: Low to high' },
                  { value: 'difficulty.desc', label: 'Difficulty: High to low' },
                  { value: 'rank.asc', label: 'Rank: Best first' },
                  { value: 'rank_change.desc', label: 'Rank change: Biggest gain' },
                ]}
              />
            )}
          </div>

          {view === 'clusters'
            ? <ClustersView clusters={clusters} facts={facts} />
            : view === 'cards'
              ? <CardsView rows={list!.rows} sparks={sparks} />
              : <TableView rows={list!.rows} sparks={sparks} />}

          {view !== 'clusters' && (
            <Pagination pathname="/app/seo/keywords" params={params} page={list!.page} pageCount={list!.pageCount} total={list!.total} pageSize={list!.pageSize} />
          )}
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <CardHeader title="Keyword Clusters" />
          <div className="pt-4"><Donut data={clusterDonut} centreValue={String(facts.length)} centreLabel="Total Keywords" /></div>
        </Card>
        <Card className="p-5">
          <CardHeader title="SERP Intent Breakdown" />
          <ul className="mt-4 space-y-3">
            {intentBreakdown.map(row => (
              <li key={row.intent}>
                <div className="mb-1 flex items-center justify-between text-xs"><IntentChip intent={row.intent} /><span className="font-medium text-slate-600">{row.count} · {Math.round((row.count / (facts.length || 1)) * 100)}%</span></div>
                <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(row.count / (facts.length || 1)) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <CardHeader title="Top Opportunities (Quick Wins)" help="Combines position band, search volume, keyword difficulty and whether a landing page exists." />
          <ol className="mt-3 space-y-2 text-sm">
            {quickWins.map((k, i) => (
              <li key={k.id} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700">{k.keyword}</span>
                <span className="shrink-0 text-xs font-semibold text-emerald-600">+{k.score}</span>
              </li>
            ))}
            {quickWins.length === 0 && <li className="text-xs text-slate-400">No quick wins yet.</li>}
          </ol>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ranking Distribution" subtitle={`Avg. Rank: ${averageRank(facts) ?? '—'}`} />
          <div className="p-5"><DistributionBars data={distribution.map(d => ({ label: d.label, count: d.count, colour: d.colour }))} /></div>
        </Card>
        <Card>
          <CardHeader title="Rankings Trend" />
          <div className="p-5"><TrendChart data={trendRows} series={[{ key: 'avg_position', label: 'Average Rank', colour: '#2563EB', reversed: true }]} height={200} /></div>
        </Card>
      </div>

      <ActivityFeed title="Recent Activity" items={activity} />
    </SeoPageChrome>
  )
}

const DONUT_PALETTE = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9', '#64748B']

function TableView({ rows, sparks }: { rows: SeoKeyword[]; sparks: Map<string, { date: string; position: number | null }[]> }) {
  if (rows.length === 0) return <EmptyPanel title="No keywords match these filters" description="Try clearing filters or add keywords to start tracking organic discovery performance." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className={SEO_TOKENS.tableHead}>
            <th className="w-8 px-5 py-2" />
            <th className="px-3 py-2 text-left">Keyword</th>
            <th className="px-3 py-2 text-left">Cluster</th>
            <th className="px-3 py-2 text-left">Intent</th>
            <th className="px-3 py-2 text-left">Volume</th>
            <th className="px-3 py-2 text-left">Difficulty</th>
            <th className="px-3 py-2 text-left">Rank</th>
            <th className="px-3 py-2 text-left">Change</th>
            <th className="px-3 py-2 text-left">Landing Page</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(k => (
            <tr key={k.id} className={SEO_TOKENS.tableRow}>
              <td className="px-5 py-2.5">{k.is_favourite && <Star size={13} className="fill-amber-400 text-amber-400" />}</td>
              <td className="px-3 py-2.5 font-medium text-slate-800">{k.keyword}</td>
              <td className="px-3 py-2.5">{k.cluster ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{k.cluster.name}</span> : <span className="text-xs text-slate-400">—</span>}</td>
              <td className="px-3 py-2.5"><IntentChip intent={k.intent} /></td>
              <td className="px-3 py-2.5 text-slate-600">{formatCompact(k.search_volume)}</td>
              <td className="px-3 py-2.5"><DifficultyChip value={k.difficulty} /></td>
              <td className="px-3 py-2.5 text-slate-600">{formatRank(k.current_rank)}</td>
              <td className="px-3 py-2.5"><RankChange value={k.rank_change} /></td>
              <td className="px-3 py-2.5">
                {k.landing_page ? <a href={k.landing_page} className="inline-flex items-center gap-1 text-blue-600 hover:underline">{k.landing_page}<ExternalLink size={11} /></a> : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-3 py-2.5"><StatusChip status={k.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardsView({ rows, sparks }: { rows: SeoKeyword[]; sparks: Map<string, { date: string; position: number | null }[]> }) {
  if (rows.length === 0) return <EmptyPanel title="No keywords match these filters" description="Try clearing filters or add keywords to start tracking organic discovery performance." />
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(k => (
        <div key={k.id} className="rounded-lg border border-slate-200 p-3.5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{k.keyword}</p>
            <StatusChip status={k.status} />
          </div>
          <div className="mb-2 flex items-center gap-1.5"><IntentChip intent={k.intent} />{k.cluster && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{k.cluster.name}</span>}</div>
          <div className="mb-2"><MiniTrend data={(sparks.get(k.id) ?? []).map(p => ({ value: p.position }))} colour="#2563EB" /></div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="font-semibold text-slate-800">{formatCompact(k.search_volume)}</p><p className="text-slate-400">Volume</p></div>
            <div><DifficultyChip value={k.difficulty} /><p className="mt-0.5 text-slate-400">Difficulty</p></div>
            <div><p className="font-semibold text-slate-800">{formatRank(k.current_rank)}</p><p className="text-slate-400">Rank</p></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ClustersView({ clusters, facts }: { clusters: { id: string; name: string; colour: string }[]; facts: Pick<SeoKeyword, 'cluster_id' | 'search_volume' | 'current_rank'>[] }) {
  if (clusters.length === 0) return <EmptyPanel title="No clusters yet" description="Keywords can be grouped into clusters to track topic-level performance." />
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {clusters.map(cluster => {
        const rows = facts.filter(k => k.cluster_id === cluster.id)
        if (rows.length === 0) return null
        return (
          <Link key={cluster.id} href={`/app/seo/keywords?cluster=${cluster.id}`} className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50/30">
            <div className="mb-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cluster.colour }} /><p className="text-sm font-semibold text-slate-800">{cluster.name}</p></div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div><p className="font-semibold text-slate-800">{rows.length}</p><p className="text-slate-400">Keywords</p></div>
              <div><p className="font-semibold text-slate-800">{averageRank(rows) ?? '—'}</p><p className="text-slate-400">Avg. Rank</p></div>
              <div><p className="font-semibold text-slate-800">{formatCompact(rows.reduce((s, r) => s + r.search_volume, 0))}</p><p className="text-slate-400">Volume</p></div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function NoSite() {
  return <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start tracking keywords for this workspace." />
}
