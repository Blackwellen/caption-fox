import { requireSocialSurface } from '@/lib/social/server'
import {
  buildInsights, dataSourceStatuses, getAudienceDemographics, getChannelBreakdown,
  getChannels, getContentPerformance, getEngagementBreakdown, getPeriodTotals, getReportPresets,
} from '@/lib/social/queries'
import { compactNumber, percent, rangeFromDays, signedPct, signedPp } from '@/lib/social/metrics'
import { AccessGate } from '@/components/social/AccessGate'
import { SocialSubNav } from '@/components/social/SocialSubNav'
import { ExportButton, ProviderLabel, RangePicker, StatusPill, TimeAgo, metricKpi, KpiCard } from '@/components/social/primitives'
import { EmptyState } from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

export default async function SocialAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const session = await requireSocialSurface('analytics')
  if (!session.access.allowed) return <div className="p-6"><AccessGate access={session.access} /></div>

  const days = Math.min(90, Math.max(7, Number(params.days ?? 7)))
  const range = rangeFromDays(days)

  const channels = await getChannels(session)
  const [totals, breakdown, content, engagementBreakdown, audience, { presets, scheduled }] = await Promise.all([
    getPeriodTotals(session, range),
    getChannelBreakdown(session, range, channels),
    getContentPerformance(session, range, { limit: 20 }),
    getEngagementBreakdown(session, range),
    getAudienceDemographics(session, range, channels),
    getReportPresets(session),
  ])
  const sources = dataSourceStatuses(channels, range)
  const insights = buildInsights({ totals: totals.current, previous: totals.previous, breakdown, series: totals.series })

  const kpis = [
    metricKpi({ key: 'reach', label: 'Total Reach', value: totals.current.reach, previous: totals.previous.reach || null, changePct: totals.previous.reach ? ((totals.current.reach - totals.previous.reach) / totals.previous.reach) * 100 : null }),
    metricKpi({ key: 'impressions', label: 'Impressions', value: totals.current.impressions, previous: totals.previous.impressions || null, changePct: totals.previous.impressions ? ((totals.current.impressions - totals.previous.impressions) / totals.previous.impressions) * 100 : null }),
    metricKpi({ key: 'engagements', label: 'Engagements', value: totals.current.engagements, previous: totals.previous.engagements || null, changePct: totals.previous.engagements ? ((totals.current.engagements - totals.previous.engagements) / totals.previous.engagements) * 100 : null }),
    metricKpi({ key: 'rate', label: 'Engagement Rate', value: (totals.current.engagementRate ?? 0) * 100, previous: totals.previous.engagementRate === null ? null : totals.previous.engagementRate * 100, changePct: null, format: 'percent' }),
    metricKpi({ key: 'followers', label: 'New Followers', value: totals.current.followerChange, previous: totals.previous.followerChange || null, changePct: totals.previous.followerChange ? ((totals.current.followerChange - totals.previous.followerChange) / totals.previous.followerChange) * 100 : null }),
    metricKpi({ key: 'clicks', label: 'Link Clicks', value: totals.current.linkClicks, previous: totals.previous.linkClicks || null, changePct: totals.previous.linkClicks ? ((totals.current.linkClicks - totals.previous.linkClicks) / totals.previous.linkClicks) * 100 : null }),
  ]

  return (
    <div className="p-4 sm:p-6">
      <SocialSubNav visible={session.surfaces} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Social Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500">Compare social performance across channels with transparent sources and exportable reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker days={days} />
          <ExportButton dataset="analytics" days={days} />
        </div>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(kpi => <KpiCard key={kpi.key} data={kpi} />)}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Performance by Channel</h2></div>
            {breakdown.length === 0 ? (
              <EmptyState compact title="No channels connected" description="Connect a channel to see performance breakdowns." />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Reach</th>
                  <th className="px-3 py-2 font-medium">Eng. Rate</th>
                  <th className="px-5 py-2 font-medium">vs Prev</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdown.map(row => (
                    <tr key={row.channel.id}>
                      <td className="px-5 py-2.5"><ProviderLabel provider={row.channel.platform} /></td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{compactNumber(row.reach)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{row.engagementRate === null ? '—' : `${(row.engagementRate * 100).toFixed(2)}%`}</td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">{row.reachChangePct === null ? '—' : signedPct(row.reachChangePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Content Performance</h2></div>
            {content.length === 0 ? (
              <EmptyState compact title="No published content in this range" description="Content metrics appear once posts are published and synced." />
            ) : (
              <div className="divide-y divide-slate-100">
                {content.slice(0, 10).map(row => (
                  <div key={row.post.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{row.post.title ?? row.post.caption?.slice(0, 50) ?? 'Untitled post'}</p>
                      <p className="text-xs text-slate-500">{(row.post.platforms ?? []).join(', ')}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-slate-900">{compactNumber(row.reach)} reach</p>
                      <p className="text-slate-500">{row.engagementRate === null ? 'No metrics' : `${(row.engagementRate * 100).toFixed(2)}%`}</p>
                    </div>
                    <StatusPill status={row.post.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Audience Demographics</h2></div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              {audience.map(dim => (
                <div key={dim.dimension}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 capitalize">{dim.dimension}</p>
                  {!dim.supported || dim.buckets.length === 0 ? (
                    <p className="text-xs text-slate-400">Not reported by connected channels.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dim.buckets.slice(0, 5).map(bucket => (
                        <div key={bucket.bucket} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{bucket.bucket}</span>
                          <span className="text-slate-500">{percent(bucket.share, 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dim.note && <p className="mt-1 text-[10px] text-slate-400">{dim.note}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Engagement Breakdown</h2></div>
            {!engagementBreakdown ? (
              <EmptyState compact title="No engagement data yet" description="Likes, comments, shares and saves will break down here." />
            ) : (
              <div className="space-y-2 p-5">
                {engagementBreakdown.parts.map(part => (
                  <div key={part.key}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{part.label}</span><span className="text-slate-500">{percent(part.share, 0)}</span></div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${part.share * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">AI Insights</h2></div>
            {insights.length === 0 ? (
              <EmptyState compact title="No notable changes" description="Insights appear when a metric moves meaningfully period over period." />
            ) : (
              <div className="divide-y divide-slate-100">
                {insights.map(insight => (
                  <div key={insight.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{insight.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{insight.detail}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{insight.method}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Report Shortcuts</h2></div>
            {presets.length === 0 && scheduled.length === 0 ? (
              <EmptyState compact title="No saved reports" description="Save a report preset to reuse it and schedule delivery." />
            ) : (
              <div className="divide-y divide-slate-100">
                {presets.map(preset => (
                  <div key={preset.id} className="px-5 py-2.5 text-sm">
                    <p className="font-medium text-slate-800">{preset.name}{preset.is_default ? ' (default)' : ''}</p>
                  </div>
                ))}
                {scheduled.map(row => (
                  <div key={row.id} className="px-5 py-2.5 text-sm">
                    <p className="font-medium text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.frequency} · {row.is_active ? 'Active' : 'Paused'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Data Sources</h2></div>
            {sources.length === 0 ? (
              <EmptyState compact title="No connected sources" description="Connect a channel to see data freshness here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {sources.map(source => (
                  <div key={source.channelId} className="px-5 py-2.5 text-sm">
                    <p className="text-slate-700">{source.accountName}</p>
                    <p className="text-xs text-slate-500">
                      Last sync <TimeAgo iso={source.lastSyncAt} />{source.incomplete && <span className="ml-1 text-amber-600">· incomplete for this range</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
