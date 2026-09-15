import Link from 'next/link'
import { ExternalLink, LayoutGrid, Table as TableIcon, PieChart as BreakdownIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getClusters, getCompetitors, getKeywordFacts, getOpportunities, getRankingChanges, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis } from '@/lib/seo/kpis'
import { matchPreset, bucketSeries, resolveGranularity } from '@/lib/seo/range'
import { breakdownBy, rankDistribution, type BreakdownRow } from '@/lib/seo/metrics'
import type { SeoKeywordFact } from '@/lib/seo/queries'
import { formatCompact, formatDecimal, formatRank, humanise, relativeTime } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readParam, readNumber } from '@/lib/seo/url-state'
import { Card, CardHeader, EmptyPanel, RankChange, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { Pagination, ViewSwitcher } from '@/components/seo/FilterBar'
import { Donut, MiniTrend, TrendChart } from '@/components/seo/charts'
import { AddKeywordsWizard } from '@/components/seo/wizards/AddKeywordsWizard'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={13} /> },
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'breakdown', label: 'Breakdown', icon: <BreakdownIcon size={13} /> },
] as const

export default async function SeoRankingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('rankings', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return <SeoPageChrome tab="rankings" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>{!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start tracking rankings." />}</SeoPageChrome>
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'dashboard')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)
  const granularity = resolveGranularity(params)

  const direction = readEnum(params, 'direction', ['all', 'improved', 'declined'] as const, 'all')!

  const [{ current, previous }, facts, changes, competitors, opportunities, declining, activity, clusters] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getKeywordFacts(scope),
    getRankingChanges(scope, { direction, page: readNumber(params, 'page') ?? 1, pageSize: 5 }),
    getCompetitors(scope, range.from),
    getOpportunities(scope, { scope: 'ranking', limit: 5 }),
    getRankingChanges(scope, { direction: 'declined', page: 1, pageSize: 5, sort: 'change.asc' }),
    getActivity(scope, 'rankings', 4),
    getClusters(scope),
  ])

  const kpis = buildKpis('rankings', current, previous, 'google_search_console')
  const distribution = rankDistribution(facts)
  const trendRows = bucketSeries(current, granularity).map(bucket => ({
    date: bucket[bucket.length - 1].date,
    avg_position: average(bucket.map(r => r.avg_position)),
    visibility_score: average(bucket.map(r => r.visibility_score)),
    clicks: sum(bucket.map(r => r.clicks)),
  }))

  const queryString = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])).toString()

  return (
    <SeoPageChrome tab="rankings" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Rankings"
        subtitle="Measure and compare your SEO performance with transparent sources and export options."
        pathname="/app/seo/rankings"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportRankings ? buildExportHref('rankings', params) : undefined}
        primarySlot={capabilities.trackKeywords ? <AddKeywordsWizard clusters={clusters} label="Track Keywords" /> : undefined}
      />

      <div className="mb-4"><ViewSwitcher pathname="/app/seo/rankings" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} /></div>

      <div className="mb-5"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      {view === 'breakdown'
        ? <BreakdownView facts={facts} params={params} />
        : (
          <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <Card>
              <CardHeader title="Rankings & Visibility Trend" help="Average tracked position, visibility score and organic clicks over time." />
              <div className="p-5">
                <TrendChart
                  data={trendRows}
                  series={[
                    { key: 'avg_position', label: 'Average Rank', colour: '#2563EB', reversed: true },
                    { key: 'visibility_score', label: 'Visibility Score', colour: '#38BDF8', axis: 'right' },
                    { key: 'clicks', label: 'Organic Clicks', colour: '#10B981', axis: 'right', dashed: true },
                  ]}
                />
              </div>
            </Card>
            <Card className="p-5">
              <CardHeader title="Ranking Distribution" />
              <div className="mt-3"><Donut data={distribution.filter(d => d.count > 0).map(d => ({ label: d.label, value: d.count, colour: d.colour }))} centreValue={String(facts.length)} centreLabel="Total Keywords" /></div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {distribution.map(d => (
                  <li key={d.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.colour }} />{d.label}</span>
                    <span className="font-medium text-slate-700">{d.count} · {d.pct}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Top Ranking Changes"
            action={(
              <div className="flex items-center gap-1 text-xs">
                {(['all', 'improved', 'declined'] as const).map(d => (
                  <Link key={d} href={`/app/seo/rankings?${new URLSearchParams({ ...flatParams(params), direction: d, page: '' }).toString()}`} className={d === direction ? 'rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700' : 'rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50'}>
                    {d === 'all' ? 'All' : d === 'improved' ? 'Improved' : 'Declined'}
                  </Link>
                ))}
              </div>
            )}
          />
          {changes.rows.length === 0
            ? <EmptyPanel title="No ranking changes yet" description="Once keyword positions move, changes will appear here." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2 text-left">Keyword</th>
                      <th className="px-3 py-2 text-left">Device</th>
                      <th className="px-3 py-2 text-left">Current Rank</th>
                      <th className="px-3 py-2 text-left">Previous</th>
                      <th className="px-3 py-2 text-left">Change</th>
                      <th className="px-3 py-2 text-left">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.rows.map(row => (
                      <tr key={row.id} className="h-12 border-b border-slate-100 last:border-0">
                        <td className="px-5 py-2.5 font-medium text-slate-800">{row.keyword}</td>
                        <td className="px-3 py-2.5 capitalize text-slate-600">{row.device}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatRank(row.current_rank)}</td>
                        <td className="px-3 py-2.5 text-slate-500">{formatRank(row.previous_rank)}</td>
                        <td className="px-3 py-2.5"><RankChange value={row.rank_change} /></td>
                        <td className="px-3 py-2.5">{row.landing_page ? <a href={row.landing_page} className="inline-flex items-center gap-1 text-blue-600 hover:underline">{row.landing_page}<ExternalLink size={11} /></a> : <span className="text-slate-400">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <Pagination pathname="/app/seo/rankings" params={params} page={changes.page} pageCount={changes.pageCount} total={changes.total} pageSize={changes.pageSize} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Competitor Comparison" help="Configured competitor domains compared on visibility, average rank and share of voice." />
          {competitors.length === 0
            ? <EmptyPanel title="No competitors configured" description="Add competitor domains to compare visibility and share of voice." />
            : (
              <ul className="divide-y divide-slate-100">
                {competitors.map(c => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.colour }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{c.domain}{c.is_self && <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">You</span>}</span>
                    <MiniTrend data={(c.spark ?? []).map(p => ({ value: p.visibility }))} colour={c.colour} />
                    <span className="w-16 shrink-0 text-right text-sm font-medium text-slate-700">{formatDecimal(c.visibility)}%</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card>
          <CardHeader title="Declining Rankings" help="Keywords whose position worsened the most in the selected period." />
          {declining.rows.length === 0
            ? <EmptyPanel title="No declining keywords" description="Nothing has lost significant ranking in this period." />
            : (
              <ul className="divide-y divide-slate-100">
                {declining.rows.map(row => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0 truncate text-sm text-slate-700">{row.keyword}</span>
                    <RankChange value={row.rank_change} />
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader title="Ranking Opportunities" help="Keywords with a reachable improved position based on current rank, volume and difficulty." />
          {opportunities.length === 0
            ? <EmptyPanel title="No ranking opportunities yet" description="Opportunities appear once keywords are tracked with enough history." />
            : (
              <ul className="divide-y divide-slate-100">
                {opportunities.map(opp => (
                  <li key={opp.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{opp.title}</p></div>
                    <span className="text-xs text-slate-500">Potential: #{opp.potential_rank ?? '—'}</span>
                    <StatusChip status={opp.priority} />
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <ActivityFeed items={activity} />
    </SeoPageChrome>
  )
}

const BREAKDOWN_DIMENSIONS = [
  { id: 'intent', label: 'Intent' },
  { id: 'device', label: 'Device' },
  { id: 'search_engine', label: 'Search Engine' },
  { id: 'country', label: 'Country' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'landing_page', label: 'Landing Page' },
  { id: 'rank_band', label: 'Rank Band' },
] as const

type BreakdownDimension = typeof BREAKDOWN_DIMENSIONS[number]['id']

function computeBreakdown(facts: SeoKeywordFact[], dimension: BreakdownDimension): BreakdownRow[] {
  switch (dimension) {
    case 'intent':
      return breakdownBy(facts, f => humanise(f.intent), f => f.current_rank, f => f.search_volume)
    case 'device':
      return breakdownBy(facts, f => humanise(f.device), f => f.current_rank, f => f.search_volume)
    case 'search_engine':
      return breakdownBy(facts, f => humanise(f.search_engine), f => f.current_rank, f => f.search_volume)
    case 'country':
      return breakdownBy(facts, f => f.country?.toUpperCase(), f => f.current_rank, f => f.search_volume)
    case 'cluster':
      return breakdownBy(facts, f => f.cluster_name, f => f.current_rank, f => f.search_volume)
    case 'landing_page':
      return breakdownBy(facts, f => (f.landing_page ? 'Has landing page' : 'No landing page'), f => f.current_rank, f => f.search_volume)
    case 'rank_band': {
      const dist = rankDistribution(facts)
      return dist.filter(d => d.count > 0).map(d => ({
        label: d.label, count: d.count, avgRank: null, volume: facts.filter(f => f.current_rank != null && f.current_rank >= d.min && f.current_rank <= d.max).reduce((sum, f) => sum + f.search_volume, 0), pct: d.pct,
      }))
    }
  }
}

function BreakdownView({ facts, params }: { facts: SeoKeywordFact[]; params: SearchParams }) {
  const dimension = readEnum(params, 'dim', BREAKDOWN_DIMENSIONS.map(d => d.id), 'intent')!
  const rows = computeBreakdown(facts, dimension)
  const dimensionLabel = BREAKDOWN_DIMENSIONS.find(d => d.id === dimension)?.label ?? 'Intent'

  return (
    <div className="mb-5">
      <Card>
        <CardHeader
          title={`Breakdown by ${dimensionLabel}`}
          help="Tracked keywords grouped by a real dimension from the keyword and ranking data — keyword count, average rank and search volume per group."
          action={(
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {BREAKDOWN_DIMENSIONS.map(d => (
                <Link
                  key={d.id}
                  href={`/app/seo/rankings?${new URLSearchParams({ ...flatParams(params), view: 'breakdown', dim: d.id }).toString()}`}
                  className={d.id === dimension ? 'rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700' : 'rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50'}
                >
                  {d.label}
                </Link>
              ))}
            </div>
          )}
        />
        {rows.length === 0
          ? <EmptyPanel title="No data for this dimension yet" description="Track more keywords to populate this breakdown." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2 text-left">{dimensionLabel}</th>
                    <th className="px-3 py-2 text-left">Keywords</th>
                    <th className="px-3 py-2 text-left">Share</th>
                    <th className="px-3 py-2 text-left">Average Rank</th>
                    <th className="px-3 py-2 text-left">Search Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.label} className="h-11 border-b border-slate-100 last:border-0">
                      <td className="px-5 py-2 font-medium text-slate-800">{row.label}</td>
                      <td className="px-3 py-2 text-slate-600">{formatCompact(row.count)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.pct}%</td>
                      <td className="px-3 py-2 text-slate-600">{row.avgRank != null ? formatDecimal(row.avgRank, 1) : '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{formatCompact(row.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  )
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

function flatParams(params: SearchParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v]] : []))
}
