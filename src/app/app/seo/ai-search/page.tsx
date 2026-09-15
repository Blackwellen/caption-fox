import Link from 'next/link'
import { ExternalLink, LayoutGrid, MessageSquare, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getAiEngines, getAiPrompts, getAiSourceMix, getCitedPages, getOpportunities, getSiteDailyWithCompare,
} from '@/lib/seo/queries'
import { buildKpis, extraKpi } from '@/lib/seo/kpis'
import { matchPreset } from '@/lib/seo/range'
import { COLLECTION_METHOD_HELP, COLLECTION_METHOD_LABELS } from '@/lib/seo/metrics'
import { formatCompact, formatDateTime, formatPercent, humanise, relativeTime } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readParam, readNumber } from '@/lib/seo/url-state'
import { Card, CardHeader, EmptyPanel, InfoTip, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, Pagination, ViewSwitcher } from '@/components/seo/FilterBar'
import { Donut, TrendChart } from '@/components/seo/charts'
import { TrackPromptsWizard } from '@/components/seo/wizards/TrackPromptsWizard'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid size={13} /> },
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'prompts', label: 'Prompts', icon: <MessageSquare size={13} /> },
] as const

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT', perplexity: 'Perplexity', google_sge: 'Google AI Overviews',
  gemini: 'Gemini', claude: 'Claude', bing_copilot: 'Bing Copilot',
}

export default async function SeoAiSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('ai-search', params)
  const { site, ctx, range, blocked, capabilities, freshness } = session

  if (blocked || !site) {
    return <SeoPageChrome tab="ai-search" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>{!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start tracking AI search visibility." />}</SeoPageChrome>
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'dashboard')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)

  const filters = {
    q: readParam(params, 'q'),
    engine: readParam(params, 'engine'),
    citation: readParam(params, 'citation'),
    sentiment: readParam(params, 'sentiment'),
    page: readNumber(params, 'page') ?? 1,
    pageSize: 5,
  }

  const [{ current, previous }, engines, prompts, citedPages, sourceMix, opportunities, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getAiEngines(scope),
    getAiPrompts(scope, filters),
    getCitedPages(scope),
    getAiSourceMix(scope),
    getOpportunities(scope, { scope: 'ai_search', limit: 5 }),
    getActivity(scope, 'ai-search', 4),
  ])

  const kpis = buildKpis('ai-search', current, previous, 'browser_sample').concat([
    extraKpi('opportunities', 'Opportunities', opportunities.length, null, 'Open AI-search citation-gap and visibility opportunities.', 'internal_tracker'),
  ])

  const queryString = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])).toString()
  const trendRows = current.map(row => ({ date: row.date, ai_visibility_score: row.ai_visibility_score, citation_rate: row.citation_rate }))
  const sourceDonut = sourceMix.map((row, i) => ({ label: humanise(row.bucket), value: row.share_pct, colour: ['#2563EB', '#94A3B8', '#CBD5E1'][i % 3] }))

  return (
    <SeoPageChrome tab="ai-search" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="AI Search"
        subtitle="Track AI search visibility, citations, prompts, and answer engine performance."
        pathname="/app/seo/ai-search"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportAiSearch ? buildExportHref('ai-search', params) : undefined}
        primarySlot={capabilities.trackPrompts ? <TrackPromptsWizard /> : undefined}
      />

      <div className="mb-4"><ViewSwitcher pathname="/app/seo/ai-search" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} /></div>

      <div className="mb-5"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader
            title="AI Visibility Trend"
            help="Visibility score and citation rate across tracked prompts. Collection method varies per engine — see Answer Engines Monitored."
          />
          <div className="p-5"><TrendChart data={trendRows} series={[{ key: 'ai_visibility_score', label: 'AI Visibility Score', colour: '#2563EB' }, { key: 'citation_rate', label: 'Citation Rate', colour: '#38BDF8', axis: 'right', dashed: true }]} /></div>
        </Card>

        <Card>
          <CardHeader title="Answer Engines Monitored" help={COLLECTION_METHOD_HELP} />
          <ul className="divide-y divide-slate-100">
            {engines.map(engine => (
              <li key={engine.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{ENGINE_LABELS[engine.engine] ?? engine.engine}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">{COLLECTION_METHOD_LABELS[engine.method]}<InfoTip text={COLLECTION_METHOD_HELP} /></p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-800">{formatPercent(engine.coverage_pct, 0)}</p>
                  <StatusChip status={engine.health} />
                </div>
              </li>
            ))}
            {engines.length === 0 && <li className="px-5 py-6"><EmptyPanel title="No engines configured" description="Answer engines will appear here once tracking is enabled." /></li>}
          </ul>
        </Card>
      </div>

      <div className="mb-5">
        <Card>
          <FilterBar
            pathname="/app/seo/ai-search"
            params={params}
            searchPlaceholder="Search prompts..."
            resultCount={prompts.total}
            resultNoun="prompts"
            selects={[
              { key: 'engine', placeholder: 'All Engines', options: Object.entries(ENGINE_LABELS).map(([value, label]) => ({ value, label })) },
              { key: 'citation', placeholder: 'All Status', options: [{ value: 'cited', label: 'Cited' }, { value: 'not_cited', label: 'Not Cited' }, { value: 'partial', label: 'Partial' }] },
              { key: 'sentiment', placeholder: 'Sentiment', options: ['positive', 'neutral', 'negative', 'mixed'].map(v => ({ value: v, label: humanise(v) })) },
            ]}
          />
          {prompts.rows.length === 0
            ? <EmptyPanel title="No tracked prompts match these filters" description="Track a prompt to start monitoring AI search visibility." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2 text-left">Prompt</th>
                      <th className="px-3 py-2 text-left">Engine</th>
                      <th className="px-3 py-2 text-left">Visibility</th>
                      <th className="px-3 py-2 text-left">Citation</th>
                      <th className="px-3 py-2 text-left">Sentiment</th>
                      <th className="px-3 py-2 text-left">Linked Page</th>
                      <th className="px-3 py-2 text-left">Last Checked</th>
                      <th className="px-3 py-2 text-left">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prompts.rows.map(p => (
                      <tr key={p.id} className="h-12 border-b border-slate-100 last:border-0">
                        <td className="max-w-xs truncate px-5 py-2.5 font-medium text-slate-800">{p.prompt}</td>
                        <td className="px-3 py-2.5 text-slate-600">{ENGINE_LABELS[p.engine]}</td>
                        <td className="px-3 py-2.5"><StatusChip status={p.visibility_band ?? 'low'} label={p.visibility != null ? `${p.visibility} · ${humanise(p.visibility_band ?? 'low')}` : '—'} /></td>
                        <td className="px-3 py-2.5"><StatusChip status={p.citation_status} /></td>
                        <td className="px-3 py-2.5">{p.sentiment ? <StatusChip status={p.sentiment} /> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5 text-slate-600">{p.linked_page ?? <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5 text-slate-500">{relativeTime(p.last_checked_at)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{COLLECTION_METHOD_LABELS[p.method]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <Pagination pathname="/app/seo/ai-search" params={params} page={prompts.page} pageCount={prompts.pageCount} total={prompts.total} pageSize={prompts.pageSize} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top Cited Pages" />
          {citedPages.length === 0
            ? <EmptyPanel title="No citations yet" description="Pages cited by AI answer engines will appear here." />
            : (
              <ul className="divide-y divide-slate-100">
                {citedPages.map((page, i) => (
                  <li key={page.page} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-4 text-xs text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{page.page}</span>
                    <span className="font-medium text-slate-800">{formatCompact(page.citations)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card>
          <CardHeader title="Emerging Opportunities" />
          {opportunities.length === 0
            ? <EmptyPanel title="No opportunities yet" description="Citation gaps will appear here once enough prompts are tracked." />
            : (
              <ul className="divide-y divide-slate-100">
                {opportunities.map(opp => (
                  <li key={opp.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0 truncate text-sm text-slate-700">{opp.title}</span>
                    <StatusChip status={opp.priority} />
                  </li>
                ))}
              </ul>
            )}
        </Card>

      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <CardHeader title="Prompt Brief" />
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            AI search engines synthesise answers from multiple sources. Track how often your brand is referenced, cited and recommended by tracking the prompts your customers are likely to ask.
          </p>
          <Link href="/app/seo/ai-search?view=prompts" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            Learn more about AI Search tracking
            <ExternalLink size={12} />
          </Link>
        </Card>

        <Card className="p-5">
          <CardHeader title="Source Transparency" help="How AI engines build the answers your brand appears in, aggregated across tracked prompt checks." />
          <div className="mt-3"><Donut data={sourceDonut} /></div>
          <ul className="mt-2 space-y-1 text-xs">
            {sourceDonut.map(row => (
              <li key={row.label} className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.colour }} />{row.label}</span><span className="font-medium text-slate-700">{formatPercent(row.value, 1)}</span></li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <CardHeader title="Data Freshness" help="All AI engine data reflects the collection method disclosed per engine above. This is not real-time monitoring." />
          <div className="mt-3 flex items-center gap-2">
            <StatusChip
              status={freshness.status === 'up_to_date' ? 'healthy' : freshness.status === 'partial' ? 'needs_attention' : freshness.status === 'failed' ? 'error' : 'not_connected'}
              label={freshness.status === 'up_to_date' ? 'Up to date' : freshness.status === 'partial' ? 'Partial coverage' : freshness.status === 'failed' ? 'Sync failed' : 'Never synced'}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Last full refresh: {freshness.lastSuccessfulSync ? formatDateTime(freshness.lastSuccessfulSync) : 'Never'}</p>
          <p className="mt-1 text-xs text-slate-500">{freshness.coverageNote}</p>
          <Link href="/app/seo/ai-search?view=table" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
            View data coverage
            <ExternalLink size={11} />
          </Link>
        </Card>
      </div>

      <ActivityFeed items={activity} />
    </SeoPageChrome>
  )
}
