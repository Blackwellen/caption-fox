import Link from 'next/link'
import { ExternalLink, FileText, Sparkles } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import { getActivity, getBriefs, getOpportunities, getRankingChanges, getSiteDailyWithCompare } from '@/lib/seo/queries'
import { buildKpis, extraKpi } from '@/lib/seo/kpis'
import { matchPreset, resolveGranularity, bucketSeries } from '@/lib/seo/range'
import { formatCompact, formatRank } from '@/lib/seo/format'
import { SEO_TOKENS, Card, CardHeader, DemoBadge, DifficultyChip, EmptyPanel, IntentChip, OwnerAvatar, RankChange, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { TrendChart, ChartLegend } from '@/components/seo/charts'
import { ChartRangeControls, PanelTabs, PanelSelect, PanelPager } from '@/components/seo/PanelControls'
import { CreateBriefWizard } from '@/components/seo/wizards/CreateBriefWizard'
import { buildExportHref, readEnum, readNumber, readParam, type SearchParams } from '@/lib/seo/url-state'

export const dynamic = 'force-dynamic'

const MOVEMENT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'improved', label: 'Gainers', tone: 'green' },
  { id: 'declined', label: 'Losers', tone: 'red' },
] as const

const BRIEF_TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'awaiting_review', label: 'Review' },
  { id: 'published', label: 'Published' },
] as const

const BRIEF_ICON_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-blue-50 text-blue-600',
  awaiting_review: 'bg-violet-50 text-violet-600',
  changes_requested: 'bg-amber-50 text-amber-600',
  approved: 'bg-emerald-50 text-emerald-600',
  published: 'bg-emerald-50 text-emerald-600',
}

const OPP_ICON_TONE: Record<string, string> = {
  ranking_improvement: 'bg-blue-50 text-blue-600',
  faq_opportunity: 'bg-amber-50 text-amber-600',
  underperforming_page: 'bg-orange-50 text-orange-600',
  backlink_opportunity: 'bg-sky-50 text-sky-600',
  outdated_content: 'bg-emerald-50 text-emerald-600',
}

const INTENTS = ['informational', 'transactional', 'commercial', 'navigational'] as const

const OVERVIEW_FILTERS = [
  { key: 'mvIntent', placeholder: 'Search intent', options: INTENTS.map(i => ({ value: i, label: i[0].toUpperCase() + i.slice(1) })) },
  { key: 'dir', placeholder: 'Keyword movement', options: [{ value: 'improved', label: 'Gainers only' }, { value: 'declined', label: 'Losers only' }] },
  { key: 'briefStatus', placeholder: 'Brief status', options: BRIEF_TABS.filter(t => t.id !== 'all').map(t => ({ value: t.id, label: t.label })) },
]

export default async function SeoOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('overview', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return (
      <SeoPageChrome tab="overview" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>
        {!blocked && <NoSiteState />}
      </SeoPageChrome>
    )
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const granularity = resolveGranularity(params)
  const direction = readEnum(params, 'dir', ['all', 'improved', 'declined'] as const, 'all')!
  const movementIntent = readEnum(params, 'mvIntent', INTENTS)
  const movementPage = Math.max(1, readNumber(params, 'mvPage') ?? 1)
  const briefStatus = readParam(params, 'briefStatus')

  const [{ current, previous }, movements, briefs, opportunities, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getRankingChanges(scope, { direction, intent: movementIntent, page: movementPage, pageSize: 5, sort: 'change.desc' }),
    getBriefs(scope, { status: briefStatus, page: 1, pageSize: 5, sort: 'updated.desc' }),
    getOpportunities(scope, { scope: 'organic', limit: 5 }),
    getActivity(scope, 'overview', 5),
  ])

  const kpis = buildKpis('overview', current, previous, 'google_search_console').concat([
    extraKpi('opportunities', 'Opportunities', opportunities.length, null, 'Open opportunity records generated from ranking bands, content gaps and link prospects.', 'internal_tracker'),
  ])

  const trendRows = bucketSeries(current, granularity).map(bucket => ({
    date: bucket[bucket.length - 1].date,
    avg_position: average(bucket.map(r => r.avg_position)),
    visibility_score: average(bucket.map(r => r.visibility_score)),
  }))

  return (
    <SeoPageChrome tab="overview" tabs={session.tabs} blocked={null}>
      <SeoHeader
        title="SEO & Discovery Overview"
        subtitle="Track rankings, discover opportunities, and grow organic traffic."
        badge={site.is_demo ? <span title={`Seeded demonstration data for ${site.domain}.`}><DemoBadge /></span> : undefined}
        pathname="/app/seo"
        activePreset={matchPreset(range)}
        rangeLabel={range.label}
        params={params}
        filters={OVERVIEW_FILTERS}
        exportHref={capabilities.exportKeywords ? buildExportHref('overview', params) : undefined}
        primarySlot={capabilities.createBrief
          ? (
            <CreateBriefWizard
              menu={[
                { label: 'Browse keyword opportunities', description: 'Pick a tracked keyword to brief against.', href: '/app/seo/keywords?view=clusters' },
                { label: 'Open the briefs board', description: 'See everything already in the pipeline.', href: '/app/seo/briefs?view=board' },
              ]}
            />
          )
          : undefined}
      />

      <div className="mb-3">
        <KpiStrip kpis={kpis} compareLabel={range.compareLabel} />
      </div>

      <div className="mb-3 grid items-start gap-3 xl:grid-cols-[1.62fr_1fr]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader
              title="Ranking Trend"
              help="Average tracked position and visibility score across the selected period."
              action={<ChartRangeControls pathname="/app/seo" params={params} activePreset={matchPreset(range)} granularity={granularity} />}
            />
            <div className="px-4 pb-2 pt-2.5">
              <div className="mb-1">
                <ChartLegend series={[{ label: 'Average Rank', colour: '#2563EB' }, { label: 'Visibility Score', colour: '#38BDF8', dashed: true }]} />
              </div>
              <TrendChart
                height={176}
                curve="linear"
                data={trendRows}
                series={[
                  { key: 'avg_position', label: 'Average Rank', colour: '#2563EB', reversed: true },
                  { key: 'visibility_score', label: 'Visibility Score', colour: '#38BDF8', axis: 'right', dashed: true },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Keyword Movements"
              help="Keywords whose tracked position changed within the selected period, largest movement first."
              action={(
                <>
                  <PanelTabs pathname="/app/seo" params={params} paramKey="dir" resetKeys={['mvPage']} active={direction} tabs={MOVEMENT_TABS} />
                  <PanelSelect
                    pathname="/app/seo"
                    params={params}
                    paramKey="mvIntent"
                    resetKeys={['mvPage']}
                    label="Filter keyword movements by intent"
                    placeholder="All Intent"
                    options={INTENTS.map(i => ({ value: i, label: i[0].toUpperCase() + i.slice(1) }))}
                  />
                  <Link href="/app/seo/keywords" className="whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-700">View full report</Link>
                </>
              )}
            />
            {movements.rows.length === 0
              ? <EmptyPanel title="No keyword movement yet" description="Once keywords are tracked and ranked, position changes will appear here." />
              : (
                <>
                  <div className="relative overflow-x-auto">
                    <table className="w-full min-w-[620px] table-fixed text-[11.5px]">
                      <colgroup>
                        <col className="w-[24%]" /><col className="w-[15%]" /><col className="w-[9%]" /><col className="w-[10%]" />
                        <col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[19%]" />
                      </colgroup>
                      <thead>
                        <tr className={SEO_TOKENS.tableHead}>
                          <th scope="col" className="px-4 py-2 text-left">Keyword</th>
                          <th scope="col" className="px-2 py-2 text-left">Intent</th>
                          <th scope="col" className="px-2 py-2 text-left">Volume</th>
                          <th scope="col" className="px-2 py-2 text-left">Difficulty</th>
                          <th scope="col" className="whitespace-nowrap px-2 py-2 text-left">Current Rank</th>
                          <th scope="col" className="whitespace-nowrap px-2 py-2 text-left">Rank Change</th>
                          <th scope="col" className="whitespace-nowrap px-2 py-2 text-left">Landing Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.rows.map(row => (
                          <tr key={row.id} className={SEO_TOKENS.tableRowTight}>
                            <td className="truncate px-4 py-1.5 font-medium text-slate-800">{row.keyword}</td>
                            <td className="px-2 py-1.5"><IntentChip intent={row.intent} /></td>
                            <td className="px-2 py-1.5 text-slate-600">{formatCompact(row.search_volume)}</td>
                            <td className="px-2 py-1.5"><DifficultyChip value={row.difficulty} /></td>
                            <td className="px-2 py-1.5 text-slate-600">{formatRank(row.current_rank)}</td>
                            <td className="px-2 py-1.5"><RankChange value={row.rank_change} /></td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PanelPager
                    pathname="/app/seo"
                    params={params}
                    pageKey="mvPage"
                    page={movements.page}
                    pageCount={movements.pageCount}
                    total={movements.total}
                    pageSize={movements.pageSize}
                    noun="keywords"
                  />
                </>
              )}
          </Card>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader title="Content Briefs" action={<Link href="/app/seo/briefs" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
            <div className="border-b border-slate-100 px-4 py-1.5">
              <PanelTabs pathname="/app/seo" params={params} paramKey="briefStatus" active={briefStatus ?? 'all'} tabs={BRIEF_TABS} variant="segmented" />
            </div>
            {briefs.rows.length === 0
              ? (
                <EmptyPanel
                  title="No briefs in this state"
                  description="Create a content brief from a keyword or opportunity to plan your next piece of content."
                  action={capabilities.createBrief ? <CreateBriefWizard label="Create your first brief" variant="link" /> : undefined}
                />
              )
              : (
                <ul className="divide-y divide-slate-100">
                  {briefs.rows.map(brief => (
                    <li key={brief.id}>
                      <Link href={`/app/seo/briefs/${brief.id}`} className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-slate-50">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${BRIEF_ICON_TONE[brief.status] ?? 'bg-slate-50 text-slate-400'}`}>
                          <FileText size={14} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium leading-tight text-slate-800">{brief.title}</p>
                          <p className="mt-px truncate text-[11.5px] leading-tight text-slate-500">Target: {brief.target_keyword}</p>
                        </div>
                        <StatusChip status={brief.status} />
                        <OwnerAvatar owner={brief.owner} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Card>

          <Card>
            <CardHeader title="Top SEO Opportunities" action={<Link href="/app/seo/keywords?view=clusters" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
            {opportunities.length === 0
              ? <EmptyPanel title="No opportunities yet" description="Opportunities are generated from ranking bands, content gaps and underperforming pages once keywords are tracked." icon={<Sparkles size={16} />} />
              : (
                <div>
                  <table className="w-full table-fixed text-[11.5px]">
                    <thead>
                      <tr className={SEO_TOKENS.tableHead}>
                        <th scope="col" className="w-[49%] px-4 py-2 text-left">Opportunity</th>
                        <th scope="col" className="w-[12%] px-1 py-2 text-right">Volume</th>
                        <th scope="col" className="w-[21%] whitespace-nowrap px-1 py-2 text-right">Potential Traffic</th>
                        <th scope="col" className="w-[18%] px-4 py-2 text-right">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map(opp => (
                        <tr key={opp.id} className={SEO_TOKENS.tableRowTight}>
                          <td className="px-4 py-1.5">
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${OPP_ICON_TONE[opp.category] ?? 'bg-blue-50 text-blue-600'}`}>
                                <Sparkles size={11} aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[12.5px] font-medium leading-tight text-slate-800">{opp.title}</p>
                                {opp.description && <p className="mt-px truncate text-[11.5px] leading-tight text-slate-500">{opp.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600">{formatCompact(opp.search_volume)}</td>
                          <td className="px-2 py-1.5 text-right text-slate-600">{formatCompact(opp.potential_traffic)}</td>
                          <td className="px-4 py-1.5 text-right"><StatusChip status={opp.priority} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>
        </div>
      </div>

      <ActivityFeed items={activity} viewAllHref="/app/seo/keywords" />
    </SeoPageChrome>
  )
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

function NoSiteState() {
  return (
    <EmptyPanel
      title="No SEO site connected yet"
      description="Connect a domain to start tracking keywords, rankings and content briefs for this workspace."
    />
  )
}
