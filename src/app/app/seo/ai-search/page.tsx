import Link from 'next/link'
import {
  ArrowRight, BookOpen, CheckCircle2, CircleDashed, ExternalLink, Frown, LayoutGrid, Meh, MessageSquare,
  ShieldCheck, Smile, Sparkles, Table as TableIcon, TrendingUp,
} from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getAiEngines, getAiPrompts, getAiSourceMix, getCitedPages, getOpportunities, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis, extraKpi } from '@/lib/seo/kpis'
import { matchPreset, resolveGranularity, bucketSeries } from '@/lib/seo/range'
import { COLLECTION_METHOD_HELP, COLLECTION_METHOD_LABELS } from '@/lib/seo/metrics'
import { formatCompact, formatDateTime, formatPercent, humanise } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { buildExportHref, readEnum, readNumber, readParam, type SearchParams } from '@/lib/seo/url-state'
import { SEO_TOKENS, Card, CardHeader, DemoBadge, EmptyPanel, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { Pagination, SearchBox, ViewSwitcher } from '@/components/seo/FilterBar'
import { ChartLegend, Donut, TrendChart } from '@/components/seo/charts'
import { ChartRangeControls, PanelSelect } from '@/components/seo/PanelControls'
import { TrackPromptsWizard } from '@/components/seo/wizards/TrackPromptsWizard'
import { BrandLogo } from '@/components/brand/BrandLogo'
import type { SeoAiPrompt } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={13} /> },
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'prompts', label: 'Prompts', icon: <MessageSquare size={13} /> },
] as const

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT', perplexity: 'Perplexity', google_sge: 'Google SGE',
  gemini: 'Gemini', claude: 'Claude', bing_copilot: 'Bing Copilot',
}

const SOURCE_COLOURS = ['#2563EB', '#94A3B8', '#CBD5E1']

export default async function SeoAiSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('ai-search', params)
  const { site, ctx, range, blocked, capabilities, freshness } = session

  if (blocked || !site) {
    return (
      <SeoPageChrome tab="ai-search" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>
        {!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start tracking AI search visibility." />}
      </SeoPageChrome>
    )
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'dashboard')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)
  const granularity = resolveGranularity(params)
  const promptsOnly = view !== 'dashboard'

  const filters = {
    q: readParam(params, 'q'),
    engine: readParam(params, 'engine'),
    citation: readParam(params, 'citation'),
    sentiment: readParam(params, 'sentiment'),
    page: readNumber(params, 'page') ?? 1,
    pageSize: promptsOnly ? 15 : 5,
  }

  const [{ current, previous }, engines, prompts, citedPages, sourceMix, opportunities, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getAiEngines(scope),
    getAiPrompts(scope, filters),
    getCitedPages(scope),
    getAiSourceMix(scope),
    getOpportunities(scope, { scope: 'ai_search', limit: 3 }),
    getActivity(scope, 'ai-search', 4),
  ])

  const baseKpis = buildKpis('ai-search', current, previous, 'browser_sample')
  const kpis = [
    ...baseKpis.slice(0, 1),
    ...(baseKpis.some(k => k.id === 'prompts') ? [] : [extraKpi('prompts', 'Tracked Prompts', prompts.total, null, 'Active prompts checked against answer engines for this site.', 'internal_tracker')]),
    ...baseKpis.slice(1),
    extraKpi('opportunities', 'Opportunities', opportunities.length, null, 'Open AI-search citation-gap and visibility opportunities.', 'internal_tracker'),
  ]

  const trendRows = bucketSeries(current, granularity).map(bucket => ({
    date: bucket[bucket.length - 1].date,
    ai_visibility_score: average(bucket.map(r => r.ai_visibility_score)),
    citation_rate: average(bucket.map(r => r.citation_rate)),
  }))
  const sourceDonut = sourceMix.map((row, i) => ({ label: humanise(row.bucket), value: Number(row.share_pct), colour: SOURCE_COLOURS[i % SOURCE_COLOURS.length] }))

  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])),
  ).toString()

  const promptsCard = (
    <Card className="min-w-0">
      <CardHeader
        title="Tracked Prompts"
        help={`Each prompt is checked on its schedule. ${COLLECTION_METHOD_HELP}`}
        action={(
          <>
            <SearchBox pathname="/app/seo/ai-search" params={params} placeholder="Search prompts..." className="w-[180px]" />
            <PanelSelect pathname="/app/seo/ai-search" params={params} paramKey="engine" resetKeys={['page']} label="Filter by engine" placeholder="All Engines" options={Object.entries(ENGINE_LABELS).map(([value, label]) => ({ value, label }))} />
            <PanelSelect pathname="/app/seo/ai-search" params={params} paramKey="citation" resetKeys={['page']} label="Filter by citation status" placeholder="All Status" options={[{ value: 'cited', label: 'Cited' }, { value: 'partial', label: 'Partially cited' }, { value: 'not_cited', label: 'Not cited' }]} />
            {!promptsOnly && <Link href="/app/seo/ai-search?view=prompts" className="whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-700">View all prompts</Link>}
          </>
        )}
      />
      <PromptTable rows={prompts.rows} />
      <Pagination
        pathname="/app/seo/ai-search"
        params={params}
        page={prompts.page}
        pageCount={prompts.pageCount}
        total={prompts.total}
        pageSize={prompts.pageSize}
        noun="prompts"
      />
    </Card>
  )

  return (
    <SeoPageChrome tab="ai-search" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="AI Search"
        subtitle="Track AI search visibility, citations, prompts, and answer engine performance."
        pathname="/app/seo/ai-search"
        activePreset={matchPreset(range)}
        rangeLabel={range.label}
        params={params}
        filters={[
          { key: 'engine', placeholder: 'Engine', options: Object.entries(ENGINE_LABELS).map(([value, label]) => ({ value, label })) },
          { key: 'citation', placeholder: 'Citation status', options: [{ value: 'cited', label: 'Cited' }, { value: 'partial', label: 'Partially cited' }, { value: 'not_cited', label: 'Not cited' }] },
          { key: 'sentiment', placeholder: 'Sentiment', options: ['positive', 'neutral', 'negative', 'mixed'].map(v => ({ value: v, label: humanise(v) })) },
        ]}
        badge={site.is_demo ? <span title={`Seeded demonstration data for ${site.domain}.`}><DemoBadge /></span> : undefined}
        exportHref={capabilities.exportAiSearch ? buildExportHref('ai-search', params) : undefined}
        primarySlot={capabilities.trackPrompts
          ? (
            <TrackPromptsWizard
              menu={[
                { label: 'Review all tracked prompts', description: 'Filter by engine, citation or sentiment.', href: '/app/seo/ai-search?view=prompts' },
                { label: 'See citation gaps', description: 'Prompts where competitors are cited instead.', href: '/app/seo/ai-search?citation=not_cited' },
              ]}
            />
          )
          : undefined}
      />

      <div className="-mt-3 mb-1.5 flex justify-end">
        <ViewSwitcher pathname="/app/seo/ai-search" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />
      </div>

      <div className="mb-3"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      {promptsOnly
        ? promptsCard
        : (
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_355px]">
            <div className="flex min-w-0 flex-col gap-3">
              <Card className="min-w-0">
                <CardHeader
                  title="AI Visibility Trend"
                  help={`Visibility score and citation rate across tracked prompts. ${COLLECTION_METHOD_HELP}`}
                  action={<ChartRangeControls pathname="/app/seo/ai-search" params={params} activePreset={matchPreset(range)} granularity={granularity} />}
                />
                <div className="px-4 pb-2 pt-2">
                  <div className="mb-1">
                    <ChartLegend series={[{ label: 'AI Visibility Score', colour: '#2563EB' }, { label: 'Citation Rate', colour: '#38BDF8', dashed: true }]} />
                  </div>
                  <TrendChart
                    height={176}
                    data={trendRows}
                    series={[
                      { key: 'ai_visibility_score', label: 'AI Visibility Score', colour: '#2563EB' },
                      { key: 'citation_rate', label: 'Citation Rate', colour: '#38BDF8', axis: 'right', dashed: true },
                    ]}
                  />
                </div>
              </Card>

              {promptsCard}

              <div className="grid min-w-0 gap-3 lg:grid-cols-[0.95fr_0.95fr_1.3fr]">
                <Card className="flex min-w-0 flex-col p-3.5">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600"><BookOpen size={13} aria-hidden /></span>
                    Prompt Brief
                  </p>
                  <p className="mt-1.5 flex-1 text-[11.5px] leading-relaxed text-slate-500">
                    AI search engines synthesise answers from multiple sources. Track how often your brand is referenced, cited and recommended.
                  </p>
                  <Link href="/app/seo/ai-search?view=prompts" className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:text-blue-700">
                    Learn more about AI Search tracking <ArrowRight size={12} aria-hidden />
                  </Link>
                </Card>

                <Card className="min-w-0 p-3.5">
                  <p className="text-[13.5px] font-semibold text-slate-900">Source Transparency</p>
                  {sourceDonut.length === 0
                    ? <p className="mt-2 text-[11.5px] text-slate-500">Source mix appears after the first prompt checks complete.</p>
                    : (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="w-[66px] shrink-0"><Donut data={sourceDonut} size={66} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-[10.5px] text-slate-500">How AI engines build answers</p>
                          <ul className="space-y-0.5 text-[11px]">
                            {sourceDonut.map(row => (
                              <li key={row.label} className="flex items-center gap-1.5">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.colour }} aria-hidden />
                                <span className="min-w-0 flex-1 truncate text-slate-600">{row.label}</span>
                                <span className="text-slate-700">{formatPercent(row.value, 1)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                </Card>

                <Card className="flex min-w-0 flex-col p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ShieldCheck size={17} aria-hidden /></span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-slate-900">Data Freshness</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                        Engine data follows each engine&apos;s disclosed collection method — this is not real-time monitoring.
                        {' '}Last full refresh: {freshness.lastSuccessfulSync ? formatDateTime(freshness.lastSuccessfulSync) : 'never'}.
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <StatusChip
                      status={freshness.status === 'up_to_date' ? 'healthy' : freshness.status === 'partial' ? 'needs_attention' : freshness.status === 'failed' ? 'error' : 'not_connected'}
                      label={freshness.status === 'up_to_date' ? 'Up to date' : freshness.status === 'partial' ? 'Partial coverage' : freshness.status === 'failed' ? 'Sync failed' : 'Never synced'}
                    />
                    <Link href="/app/seo/ai-search?view=table" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:text-blue-700">
                      View data coverage <ArrowRight size={12} aria-hidden />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Right rail ──────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-3">
              <Card className="min-w-0">
                <CardHeader title="Answer Engines Monitored" help={COLLECTION_METHOD_HELP} action={<Link href="/app/seo/ai-search?view=table" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
                {engines.length === 0
                  ? <EmptyPanel title="No engines configured" description="Answer engines appear here once prompt tracking is enabled." />
                  : (
                    <ul className="grid grid-cols-3 gap-1 p-2">
                      {engines.map(engine => {
                        return (
                          <li
                            key={engine.id}
                            title={`${ENGINE_LABELS[engine.engine] ?? engine.engine}: ${COLLECTION_METHOD_LABELS[engine.method]} · ${humanise(engine.health)}`}
                            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 px-1.5 py-1.5"
                          >
                            <BrandLogo brand={engine.engine} size={18} />
                            <span className="min-w-0">
                              <span className="block truncate text-[10.5px] text-slate-600">{ENGINE_LABELS[engine.engine] ?? engine.engine}</span>
                              <span className="block text-[12px] font-semibold text-slate-900">{formatPercent(engine.coverage_pct, 0)}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
              </Card>

              <Card className="min-w-0">
                <CardHeader title="Top Cited Pages" help="Your pages most often cited as a source in tracked AI answers, with the 28-day change." action={<Link href="/app/seo/ai-search?view=table" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
                {citedPages.length === 0
                  ? <EmptyPanel title="No citations yet" description="Pages cited by AI answer engines will appear here." />
                  : (
                    <ol className="divide-y divide-slate-100">
                      {citedPages.map((page, i) => (
                        <li key={page.page} className="flex items-center gap-2.5 px-4 py-1.5 text-[12px]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10.5px] font-medium text-slate-500">{i + 1}</span>
                          <a href={page.page} className="min-w-0 flex-1 truncate text-blue-600 hover:underline">{page.page}</a>
                          <span className="w-9 shrink-0 text-right text-slate-700">{formatCompact(page.citations)}</span>
                          <span className={`w-9 shrink-0 text-right font-medium ${(page.change_28d ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {(page.change_28d ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(page.change_28d ?? 0)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
              </Card>

              <Card className="min-w-0">
                <CardHeader title="Emerging Opportunities" help="Prompts with meaningful demand where your brand is rarely cited." action={<Link href="/app/seo/ai-search?citation=not_cited" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
                {opportunities.length === 0
                  ? <EmptyPanel title="No opportunities yet" description="Citation gaps will appear here once enough prompts are tracked." />
                  : (
                    <ul className="divide-y divide-slate-100">
                      {opportunities.map((opp, i) => (
                        <li key={opp.id} className="flex items-center gap-2.5 px-4 py-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-orange-50 text-orange-600'][i % 3]}`}>
                            {i % 2 === 0 ? <Sparkles size={13} aria-hidden /> : <TrendingUp size={13} aria-hidden />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-slate-800">{opp.title}</p>
                            {opp.description && <p className="truncate text-[11px] text-slate-500">{opp.description}</p>}
                          </div>
                          <StatusChip status={opp.priority} />
                        </li>
                      ))}
                    </ul>
                  )}
              </Card>

              <ActivityFeed title="Recent Activity" items={activity} layout="list" viewAllHref="/app/seo" />
            </div>
          </div>
        )}
    </SeoPageChrome>
  )
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

const CITATION = {
  cited: { label: 'Cited', icon: CheckCircle2, tone: 'text-emerald-600' },
  partial: { label: 'Partial', icon: CircleDashed, tone: 'text-amber-600' },
  not_cited: { label: 'Not Cited', icon: CircleDashed, tone: 'text-slate-400' },
  unknown: { label: 'Unknown', icon: CircleDashed, tone: 'text-slate-400' },
} as const

const SENTIMENT = {
  positive: { icon: Smile, tone: 'text-emerald-600' },
  neutral: { icon: Meh, tone: 'text-slate-400' },
  mixed: { icon: Meh, tone: 'text-amber-600' },
  negative: { icon: Frown, tone: 'text-red-600' },
} as const

function PromptTable({ rows }: { rows: SeoAiPrompt[] }) {
  if (rows.length === 0) {
    return <EmptyPanel title="No tracked prompts match these filters" description="Track a prompt to start monitoring AI search visibility." />
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[700px] table-fixed text-[12px]">
        <colgroup>
          <col className="w-[24%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[10%]" />
          <col className="w-[11%]" /><col className="w-[16%]" /><col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className={SEO_TOKENS.tableHead}>
            <th scope="col" className="px-4 py-2 text-left">Prompt</th>
            <th scope="col" className="px-2 py-2 text-left">Engine</th>
            <th scope="col" className="px-2 py-2 text-left">Visibility</th>
            <th scope="col" className="px-2 py-2 text-left">Citation</th>
            <th scope="col" className="px-2 py-2 text-left">Sentiment</th>
            <th scope="col" className="px-2 py-2 text-left">Linked Page</th>
            <th scope="col" className="px-2 py-2 text-left">Last Checked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const citation = CITATION[p.citation_status] ?? CITATION.unknown
            const CitationIcon = citation.icon
            const sentiment = p.sentiment ? SENTIMENT[p.sentiment] : null
            const SentimentIcon = sentiment?.icon
            return (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-1.5">
                  <p className="line-clamp-2 font-medium leading-snug text-slate-800" title={`${p.prompt} · ${COLLECTION_METHOD_LABELS[p.method]}`}>{p.prompt}</p>
                </td>
                <td className="px-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <BrandLogo brand={p.engine} size={15} />
                    <span className="truncate text-slate-700">{ENGINE_LABELS[p.engine] ?? p.engine}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 text-slate-700">{p.visibility ?? '—'}</span>
                    {p.visibility_band && p.visibility_band !== 'none' && <StatusChip status={p.visibility_band} />}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className={`flex items-center gap-1 ${citation.tone}`}>
                    <CitationIcon size={13} aria-hidden />
                    <span className="text-slate-600">{citation.label}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  {sentiment && SentimentIcon
                    ? (
                      <span className={`flex items-center gap-1 ${sentiment.tone}`}>
                        <SentimentIcon size={13} aria-hidden />
                        <span className="text-slate-600">{humanise(p.sentiment!)}</span>
                      </span>
                    )
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-1.5">
                  {p.linked_page
                    ? (
                      <a href={p.linked_page} className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline">
                        <span className="truncate">{p.linked_page}</span>
                        <ExternalLink size={11} className="shrink-0" aria-hidden />
                      </a>
                    )
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-1.5 text-[11px] leading-snug text-slate-500">
                  {p.last_checked_at ? formatDateTime(p.last_checked_at) : 'Not yet checked'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
