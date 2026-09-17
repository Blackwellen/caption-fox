import Link from 'next/link'
import {
  ExternalLink, Image as ImageIcon, LayoutGrid, Link2, MapPin, MessageCircleQuestion, Monitor, Newspaper, PanelRight, PlayCircle, ShoppingBag, Sparkle, Star, PieChart as BreakdownIcon, Smartphone, Table as TableIcon, Tablet, TrendingUp,
} from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getClusters, getCompetitors, getKeywordFacts, getOpportunities, getRankingChanges, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis } from '@/lib/seo/kpis'
import { matchPreset, bucketSeries, resolveGranularity } from '@/lib/seo/range'
import { breakdownBy, rankDistribution, type BreakdownRow } from '@/lib/seo/metrics'
import type { RankingChangeRow, SeoKeywordFact } from '@/lib/seo/queries'
import { formatCompact, formatDecimal, formatRank, humanise } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readParam, readNumber } from '@/lib/seo/url-state'
import { SEO_TOKENS, Card, CardHeader, DemoBadge, EmptyPanel, RankChange, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { Pagination, ViewSwitcher } from '@/components/seo/FilterBar'
import { ChartLegend, Donut, MiniTrend, TrendChart } from '@/components/seo/charts'
import { ChartRangeControls, PanelTabs } from '@/components/seo/PanelControls'
import { TrackingSources } from '@/components/seo/TrackingSources'
import { HeaderMenuSelect } from '@/components/seo/HeaderMenuSelect'
import { BrandLogo } from '@/components/brand/BrandLogo'
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
  const { site, ctx, range, blocked, capabilities, sources } = session

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
    getRankingChanges(scope, {
      direction,
      device: readParam(params, 'device'),
      country: readParam(params, 'country'),
      engine: readParam(params, 'engine'),
      page: readNumber(params, 'page') ?? 1,
      pageSize: view === 'table' ? 10 : 5,
    }),
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
        icon={<TrendingUp size={22} className="text-blue-600" aria-hidden />}
        subtitle="Measure and compare your SEO performance with transparent sources and export options."
        pathname="/app/seo/rankings"
        activePreset={matchPreset(range)}
        rangeLabel={range.label}
        params={params}
        filters={rankingFilters(sources)}
        badge={site.is_demo ? <span title={`Seeded demonstration data for ${site.domain}.`}><DemoBadge /></span> : undefined}
        extra={(
          <>
            <HeaderMenuSelect
              pathname="/app/seo/rankings"
              paramKey="engine"
              value={readParam(params, 'engine')}
              label="Search engine"
              placeholder="All engines"
              options={[{ value: 'google', label: 'Google', brand: 'google' }, { value: 'bing', label: 'Bing', brand: 'bing' }]}
            />
          </>
        )}
        exportHref={capabilities.exportRankings ? buildExportHref('rankings', params) : undefined}
        primarySlot={capabilities.trackKeywords
          ? (
            <AddKeywordsWizard
              clusters={clusters}
              label="Track Keywords"
              menu={[
                { label: 'Review tracked keywords', description: 'Audit coverage before adding more.', href: '/app/seo/keywords' },
                { label: 'Break rankings down', description: 'Compare by device, country or cluster.', href: '/app/seo/rankings?view=breakdown' },
              ]}
            />
          )
          : undefined}
      />

      <div className="mb-3">
        <ViewSwitcher pathname="/app/seo/rankings" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} underline />
      </div>

      <div className="mb-3"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      {view === 'breakdown'
        ? <BreakdownView facts={facts} params={params} />
        : view === 'table'
          ? <div className="mb-3"><RankingChangesCard changes={changes} direction={direction} params={params} /></div>
          : (
            <>
              <div className="mb-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_446px]">
                <div className="flex min-w-0 flex-col gap-3">
                  <Card>
                    <CardHeader
                      title="Rankings & Visibility Trend"
                      help="Average tracked position, visibility score and organic clicks over time, from the connected ranking source."
                      action={<ChartRangeControls pathname="/app/seo/rankings" params={params} activePreset={matchPreset(range)} granularity={granularity} />}
                    />
                    <div className="px-4 pb-2 pt-2.5">
                      <div className="mb-1">
                        <ChartLegend series={[
                          { label: 'Average Rank', colour: '#2563EB' },
                          { label: 'Visibility Score', colour: '#38BDF8', dashed: true },
                          { label: 'Organic Clicks', colour: '#10B981' },
                        ]} />
                      </div>
                      <TrendChart
                        height={150}
                        data={trendRows}
                        axisTitles
                        curve="linear"
                        leftLabel="Average Rank"
                        rightLabel="Visibility Score (%)"
                        right2Label="Organic Clicks"
                        series={[
                          { key: 'avg_position', label: 'Average Rank', colour: '#2563EB', reversed: true },
                          { key: 'visibility_score', label: 'Visibility Score', colour: '#38BDF8', axis: 'right', dashed: true },
                          { key: 'clicks', label: 'Organic Clicks', colour: '#10B981', axis: 'right2' },
                        ]}
                      />
                    </div>
                  </Card>

                  <RankingChangesCard changes={changes} direction={direction} params={params} />

                  <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                <Card className="min-w-0">
                  <CardHeader
                    title="Ranking Opportunities"
                    help="Keywords with a reachable improved position based on current rank, search volume and difficulty."
                    action={<Link href="/app/seo/keywords?sort=rank_change.desc" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>}
                  />
                  {opportunities.length === 0
                    ? <EmptyPanel title="No ranking opportunities yet" description="Opportunities appear once keywords are tracked with enough history." />
                    : (
                      <table className="w-full table-fixed text-[11.5px]">
                        <thead>
                          <tr className={SEO_TOKENS.tableHead}>
                            <th scope="col" className="w-[44%] px-3 py-1.5 text-left">Keyword</th>
                            <th scope="col" className="w-[21%] px-1 py-1.5 text-right">Potential</th>
                            <th scope="col" className="w-[18%] px-1 py-1.5 text-right">Volume</th>
                            <th scope="col" className="w-[17%] px-2 py-1.5 text-right">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opportunities.map(opp => (
                            <tr key={opp.id} className={SEO_TOKENS.tableRowTight}>
                              <td className="truncate px-3 py-1 font-medium text-slate-800">{opp.title}</td>
                              <td className="px-1 py-1 text-right text-slate-600">{opp.potential_rank != null ? `Top ${opp.potential_rank}` : '—'}</td>
                              <td className="px-1 py-1 text-right text-slate-600">{formatCompact(opp.search_volume)}</td>
                              <td className="px-2 py-1 text-right"><StatusChip status={opp.priority} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </Card>

                <Card className="min-w-0">
                  <CardHeader
                    title="Declining Rankings"
                    help="Keywords whose position worsened the most in the selected period."
                    action={<Link href="/app/seo/rankings?direction=declined" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>}
                  />
                  {declining.rows.length === 0
                    ? <EmptyPanel title="No declining keywords" description="Nothing has lost significant ranking in this period." />
                    : (
                      <table className="w-full table-fixed text-[11.5px]">
                        <thead>
                          <tr className={SEO_TOKENS.tableHead}>
                            <th scope="col" className="w-[44%] px-3 py-1.5 text-left">Keyword</th>
                            <th scope="col" className="w-[17%] px-1 py-1.5 text-right">Current</th>
                            <th scope="col" className="w-[17%] px-1 py-1.5 text-right">Previous</th>
                            <th scope="col" className="w-[22%] px-2 py-1.5 text-right">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {declining.rows.map(row => (
                            <tr key={row.id} className={SEO_TOKENS.tableRowTight}>
                              <td className="truncate px-3 py-1 font-medium text-slate-800">{row.keyword}</td>
                              <td className="px-1 py-1 text-right text-slate-600">{formatRank(row.current_rank)}</td>
                              <td className="px-1 py-1 text-right text-slate-500">{formatRank(row.previous_rank)}</td>
                              <td className="px-2 py-1 text-right"><RankChange value={row.rank_change} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </Card>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <Card className="min-w-0">
                    <CardHeader title="Ranking Distribution" help="Tracked keywords grouped by current position band." />
                    <div className="flex items-center gap-2 p-3">
                      <div className="w-[128px] shrink-0">
                        <Donut
                          size={128}
                          data={distribution.filter(d => d.count > 0).map(d => ({ label: d.label, value: d.count, colour: d.colour }))}
                          centreValue={formatCompact(facts.length)}
                          centreLabel="Total Keywords"
                        />
                      </div>
                      <ul className="min-w-0 flex-1 space-y-1">
                        {distribution.map(d => (
                          <li key={d.id} className="flex items-center gap-1.5 text-[11.5px]">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.colour }} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-slate-600">#{d.label}</span>
                            <span className="w-8 shrink-0 text-right font-semibold text-slate-800">{formatCompact(d.count)}</span>
                            <span className="w-11 shrink-0 text-right text-slate-400">{d.pct}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>

                  <TrackingSources sources={sources} canConnect={capabilities.connectSource} />

                  <Card className="min-w-0">
                    <CardHeader
                      title="Competitor Comparison"
                      help="Configured competitor domains compared on visibility and average rank across tracked keywords."
                      action={<Link href="/app/seo/rankings?view=breakdown&dim=cluster" className="text-xs font-medium text-blue-600 hover:text-blue-700">View full report</Link>}
                    />
                    {competitors.length === 0
                      ? <EmptyPanel title="No competitors configured" description="Add competitor domains to compare visibility and share of voice." />
                      : (
                        <table className="w-full table-fixed text-[11.5px]">
                          <thead>
                            <tr className={SEO_TOKENS.tableHead}>
                              <th scope="col" className="w-[36%] px-3 py-1.5 text-left">Domain</th>
                              <th scope="col" className="w-[18%] px-1 py-1.5"><span className="sr-only">Visibility trend</span></th>
                              <th scope="col" className="w-[13%] px-1 py-1.5 text-right">Visibility</th>
                              <th scope="col" className="w-[18%] px-1 py-1.5"><span className="sr-only">Average rank trend</span></th>
                              <th scope="col" className="w-[15%] px-3 py-1.5 text-right">Avg. Rank</th>
                            </tr>
                          </thead>
                          <tbody>
                            {competitors.map(c => (
                              <tr key={c.id} className={SEO_TOKENS.tableRowTight}>
                                <td className="px-3 py-1">
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.colour }} aria-hidden />
                                    <span className="truncate text-slate-700">{c.domain}</span>
                                    {c.is_self && <span className="shrink-0 rounded bg-blue-50 px-1 text-[10px] font-medium text-blue-600">You</span>}
                                  </span>
                                </td>
                                <td className="px-1 py-1"><MiniTrend data={(c.spark ?? []).map(p => ({ value: p.visibility }))} colour={c.colour} /></td>
                                <td className="px-1 py-1 text-right font-medium text-slate-700">{formatDecimal(c.visibility)}%</td>
                                <td className="px-1 py-1"><MiniTrend data={(c.spark ?? []).map(p => ({ value: p.avg_rank ?? null }))} colour={c.colour} reversed /></td>
                                <td className="px-3 py-1 text-right text-slate-600">{c.avg_rank != null ? formatDecimal(c.avg_rank, 1) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                  </Card>

                  <ActivityFeed title="Recent Activity & Alerts" items={activity} layout="list" viewAllHref="/app/seo" />
                </div>
              </div>
            </>
          )}

    </SeoPageChrome>
  )
}

const REGION_NAMES = new Intl.DisplayNames(['en-GB'], { type: 'region' })

/** Inline SVG flags: emoji flags do not render on Windows, which shows letters instead. */
function CountryFlag({ code }: { code: string }) {
  const c = code.toLowerCase()
  const box = 'h-[10px] w-[15px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-slate-200'
  if (c === 'gb' || c === 'uk') {
    return (
      <svg viewBox="0 0 60 40" className={box} aria-hidden>
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
        <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
      </svg>
    )
  }
  if (c === 'us') {
    return (
      <svg viewBox="0 0 76 40" className={box} aria-hidden>
        <rect width="76" height="40" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map(i => <rect key={i} y={(i * 40) / 13} width="76" height={40 / 13} fill="#B22234" />)}
        <rect width="30" height={(40 * 7) / 13} fill="#3C3B6E" />
      </svg>
    )
  }
  return <span className="w-[15px] shrink-0 text-[9px] font-semibold uppercase text-slate-400" aria-hidden>{c}</span>
}

function countryName(code: string) {
  try { return REGION_NAMES.of(code.toUpperCase()) ?? code.toUpperCase() } catch { return code.toUpperCase() }
}

const SERP_FEATURE_ICON: Record<string, typeof Monitor> = {
  featured_snippet: Star,
  people_also_ask: MessageCircleQuestion,
  local_pack: MapPin,
  image_pack: ImageIcon,
  video: PlayCircle,
  knowledge_panel: PanelRight,
  sitelinks: Link2,
  top_stories: Newspaper,
  reviews: Star,
  shopping: ShoppingBag,
}

const DEVICE_ICON: Record<string, typeof Monitor> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet }

const DIRECTION_TABS = [
  { id: 'all', label: 'All' },
  { id: 'improved', label: 'Improved', tone: 'green' },
  { id: 'declined', label: 'Declined', tone: 'red' },
] as const

/** Header Filters options, including the real connected sources. */
function rankingFilters(sources: { id: string; provider: string }[]) {
  return [
    { key: 'direction', placeholder: 'Movement', options: [{ value: 'improved', label: 'Improved only' }, { value: 'declined', label: 'Declined only' }] },
    { key: 'device', placeholder: 'Device', options: ['desktop', 'mobile', 'tablet'].map(v => ({ value: v, label: humanise(v) })) },
    { key: 'country', placeholder: 'Country', options: [{ value: 'gb', label: 'United Kingdom' }, { value: 'us', label: 'United States' }] },
    {
      key: 'source',
      placeholder: 'Source',
      options: sources.length
        ? sources.map(source => ({ value: source.id, label: humanise(source.provider) }))
        : [{ value: 'none', label: 'No source connected' }],
    },
  ]
}

/**
 * Top Ranking Changes. Shows the full provenance the reference calls for —
 * device, country, both positions, the SERP features recorded on the latest
 * ranking row and which source reported it.
 */
function RankingChangesCard({
  changes, direction, params,
}: {
  changes: { rows: RankingChangeRow[]; page: number; pageCount: number; total: number; pageSize: number }
  direction: string
  params: SearchParams
}) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Top Ranking Changes"
        help="Tracked keywords whose position moved in the selected period, largest movement first."
        action={(
          <>
            <PanelTabs pathname="/app/seo/rankings" params={params} paramKey="direction" resetKeys={['page']} active={direction} tabs={DIRECTION_TABS} />
            <Link href="/app/seo/rankings?view=table" className="whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-700">View full table</Link>
          </>
        )}
      />
      {changes.rows.length === 0
        ? <EmptyPanel title="No ranking changes yet" description="Once keyword positions move, changes will appear here." />
        : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-[11.5px]">
              <colgroup>
                <col className="w-[17%]" /><col className="w-[7%]" /><col className="w-[14%]" /><col className="w-[7%]" />
                <col className="w-[8%]" /><col className="w-[7%]" /><col className="w-[20%]" /><col className="w-[13%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr className={SEO_TOKENS.tableHead}>
                  <th scope="col" className="px-3 py-2 text-left">Keyword</th>
                  <th scope="col" className="px-2 py-2 text-left">Device</th>
                  <th scope="col" className="px-2 py-2 text-left">Location</th>
                  <th scope="col" className="px-1 py-2 text-right">Current</th>
                  <th scope="col" className="px-1 py-2 text-right">Previous</th>
                  <th scope="col" className="px-1 py-2 text-right">Change</th>
                  <th scope="col" className="px-2 py-2 text-left">URL</th>
                  <th scope="col" className="px-1 py-2 text-left">SERP Features</th>
                  <th scope="col" className="px-2 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {changes.rows.map(row => {
                  const DeviceIcon = DEVICE_ICON[row.device] ?? Monitor
                  return (
                    <tr key={row.id} className={SEO_TOKENS.tableRowTight}>
                      <td className="truncate px-3 py-1.5 font-medium text-slate-800">{row.keyword}</td>
                      <td className="px-1 py-1.5">
                        <DeviceIcon size={13} className="text-slate-400" aria-label={humanise(row.device)} />
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <CountryFlag code={row.country} />
                          <span className="truncate">{countryName(row.country)}</span>
                        </span>
                      </td>
                      <td className="px-1 py-1.5 text-right text-slate-600">{formatRank(row.current_rank)}</td>
                      <td className="px-1 py-1.5 text-right text-slate-500">{formatRank(row.previous_rank)}</td>
                      <td className="px-1 py-1.5 text-right"><RankChange value={row.rank_change} /></td>
                      <td className="px-2 py-1.5">
                        {row.landing_page
                          ? (
                            <a href={row.landing_page} className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline">
                              <span className="truncate">{row.landing_page}</span>
                              <ExternalLink size={11} className="shrink-0" aria-hidden />
                            </a>
                          )
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-1 py-1.5">
                        {row.serp_features.length === 0
                          ? <span className="text-slate-400">—</span>
                          : (
                            <span className="flex items-center gap-1.5" aria-label={`SERP features: ${row.serp_features.map(humanise).join(', ')}`}>
                              {row.serp_features.slice(0, 3).map(feature => {
                                const FeatureIcon = SERP_FEATURE_ICON[feature] ?? Sparkle
                                return <span key={feature} title={humanise(feature)} className="text-slate-500"><FeatureIcon size={13} aria-hidden /></span>
                              })}
                              {row.serp_features.length > 3 && (
                                <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">+{row.serp_features.length - 3}</span>
                              )}
                            </span>
                          )}
                      </td>
                      <td className="px-2 py-1.5"><BrandLogo brand={row.source === 'google_search_console' ? 'google' : row.source} size={15} title={humanise(row.source)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      <Pagination
        pathname="/app/seo/rankings"
        params={params}
        page={changes.page}
        pageCount={changes.pageCount}
        total={changes.total}
        pageSize={changes.pageSize}
        noun="keywords"
      />
    </Card>
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
            <div className="relative overflow-x-auto">
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
