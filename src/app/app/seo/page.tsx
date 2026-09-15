import Link from 'next/link'
import { ExternalLink, Sparkles } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import { getActivity, getBriefs, getOpportunities, getRankingChanges, getSiteDailyWithCompare } from '@/lib/seo/queries'
import { buildKpis, extraKpi } from '@/lib/seo/kpis'
import { matchPreset, resolveGranularity, bucketSeries } from '@/lib/seo/range'
import { formatCompact, formatRank } from '@/lib/seo/format'
import { SEO_TOKENS, Card, CardHeader, DemoBadge, DifficultyChip, EmptyPanel, IntentChip, RankChange, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { TrendChart, ChartLegend } from '@/components/seo/charts'
import { GRANULARITIES } from '@/lib/seo/range'
import { CreateBriefWizard } from '@/components/seo/wizards/CreateBriefWizard'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'

export const dynamic = 'force-dynamic'

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

  const [{ current, previous }, movements, briefs, opportunities, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    getRankingChanges(scope, { direction: 'all', page: 1, pageSize: 5, sort: 'change.desc' }),
    getBriefs(scope, { page: 1, pageSize: 5, sort: 'updated.desc' }),
    getOpportunities(scope, { scope: 'organic', limit: 5 }),
    getActivity(scope, 'overview', 6),
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
        pathname="/app/seo"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportKeywords ? buildExportHref('overview', params) : undefined}
        primarySlot={capabilities.createBrief ? <CreateBriefWizard /> : undefined}
      />

      {site.is_demo && <div className="mb-4"><DemoBadge /> <span className="ml-2 text-xs text-slate-500">This workspace is showing seeded demonstration data for {site.domain}.</span></div>}

      <div className="mb-5">
        <KpiStrip kpis={kpis} compareLabel={range.compareLabel} />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Ranking Trend"
            help="Average tracked position and visibility score across the selected period."
            action={<GranularityLinks pathname="/app/seo" params={params} />}
          />
          <div className="p-5">
            <div className="mb-3"><ChartLegend series={[{ label: 'Average Rank', colour: '#2563EB' }, { label: 'Visibility Score', colour: '#38BDF8', dashed: true }]} /></div>
            <TrendChart
              data={trendRows}
              series={[
                { key: 'avg_position', label: 'Average Rank', colour: '#2563EB', reversed: true },
                { key: 'visibility_score', label: 'Visibility Score', colour: '#38BDF8', axis: 'right', dashed: true },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Content Briefs" action={<Link href="/app/seo/briefs" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
          {briefs.rows.length === 0
            ? <EmptyPanel title="No briefs yet" description="Create a content brief from a keyword or opportunity to plan your next piece of content." action={capabilities.createBrief ? <CreateBriefWizard label="Create your first brief" variant="link" /> : undefined} />
            : (
              <ul className="divide-y divide-slate-100">
                {briefs.rows.map(brief => (
                  <li key={brief.id}>
                    <Link href={`/app/seo/briefs/${brief.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{brief.title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">Target: {brief.target_keyword}</p>
                      </div>
                      <StatusChip status={brief.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Keyword Movements"
            help="Keywords whose tracked position changed within the selected period, largest movement first."
            action={<Link href="/app/seo/keywords" className="text-xs font-medium text-blue-600 hover:text-blue-700">View full report</Link>}
          />
          {movements.rows.length === 0
            ? <EmptyPanel title="No keyword movement yet" description="Once keywords are tracked and ranked, position changes will appear here." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className={SEO_TOKENS.tableHead}>
                      <th className="px-5 py-2 text-left">Keyword</th>
                      <th className="px-3 py-2 text-left">Volume</th>
                      <th className="px-3 py-2 text-left">Current Rank</th>
                      <th className="px-3 py-2 text-left">Rank Change</th>
                      <th className="px-3 py-2 text-left">Landing Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.rows.map(row => (
                      <tr key={row.id} className={SEO_TOKENS.tableRow}>
                        <td className="px-5 py-2.5 font-medium text-slate-800">{row.keyword}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatCompact(row.search_volume)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatRank(row.current_rank)}</td>
                        <td className="px-3 py-2.5"><RankChange value={row.rank_change} /></td>
                        <td className="px-3 py-2.5">
                          {row.landing_page
                            ? <a href={row.landing_page} className="inline-flex items-center gap-1 text-blue-600 hover:underline">{row.landing_page}<ExternalLink size={11} /></a>
                            : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
      </div>

      <div className="mb-5">
        <Card>
          <CardHeader title="Top SEO Opportunities" action={<Link href="/app/seo/keywords?view=clusters" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
          {opportunities.length === 0
            ? <EmptyPanel title="No opportunities yet" description="Opportunities are generated from ranking bands, content gaps and underperforming pages once keywords are tracked." icon={<Sparkles size={16} />} />
            : (
              <ul className="divide-y divide-slate-100">
                {opportunities.map(opp => (
                  <li key={opp.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{opp.title}</p>
                      {opp.description && <p className="mt-0.5 truncate text-xs text-slate-500">{opp.description}</p>}
                    </div>
                    <div className="hidden text-right text-xs text-slate-500 sm:block">
                      <p>{formatCompact(opp.search_volume)} vol</p>
                      <p>{formatCompact(opp.potential_traffic)} traffic</p>
                    </div>
                    <StatusChip status={opp.priority} />
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <ActivityFeed items={activity} viewAllHref="/app/seo/keywords" />
    </SeoPageChrome>
  )
}

function GranularityLinks({ pathname, params }: { pathname: string; params: SearchParams }) {
  const active = resolveGranularity(params)
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {GRANULARITIES.map(g => {
        const search = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
          const raw = Array.isArray(value) ? value[0] : value
          if (raw) search.set(key, raw)
        }
        search.set('granularity', g.id)
        return (
          <a
            key={g.id}
            href={`${pathname}?${search.toString()}`}
            className={g.id === active ? 'rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-900 shadow-sm' : 'rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700'}
          >
            {g.label}
          </a>
        )
      })}
    </div>
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
