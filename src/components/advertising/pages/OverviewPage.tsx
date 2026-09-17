import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Clock3, CircleDollarSign, Crosshair,
  Image as ImageIcon, Link2, MousePointerClick, Play, Plus, Plug, Rocket, ShoppingCart, TrendingUp,
} from 'lucide-react'
import ExportSplit from '../ExportSplit'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { comparisonRange, resolveRange, kpi } from '@/lib/advertising/queries/shared'
import { getOverviewData, providerLabel, type OverviewOptions } from '@/lib/advertising/queries/overview'
import {
  formatCurrency, formatDateRange, formatNumber,
  formatPercent, formatRelativeTime, formatRoas,
} from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader, { HeaderActionButton } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, FORMAT_LABELS, HEALTH_STATUS, OBJECTIVE_LABELS } from '../StatusPill'
import TrendChart, { TrendLegend } from '../TrendChart'
import { EmptyState, InfoDot, Panel } from '../Primitives'
import {
  ChipSelect, CompareButton, DateRangeButton, FiltersPopover, KebabMenu, ScrollRow, SegmentedParam,
} from '../MiniControls'

// /{type}/advertising — built to design reference (1).
// Layout: header + actions, date/compare/filters row, six KPI cards,
// connected-account strip, Campaign Performance | Alerts & Recent Activity,
// Creative Performance | Spend Trend | Budget Pacing.

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

const PLATFORM_OPTIONS = AD_PROVIDER_IDS.map(id => ({ value: id, label: providerLabel(id) }))
const TREND_METRICS = ['spend', 'conversions', 'roas', 'clicks'] as const
const TREND_FORMAT = { spend: 'currency', conversions: 'number', roas: 'roas', clicks: 'number' } as const

/**
 * Budget-utilisation colour bands used by the Budget Pacing panel:
 * ≥85% red (close to exhausting budget), 75–85% amber, below 75% green.
 */
const wholePounds = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)

function pacingColour(pct: number): string {
  if (pct >= 85) return 'bg-red-500'
  if (pct >= 75) return 'bg-orange-400'
  return 'bg-emerald-500'
}

function PanelTitle({ title, hint, count, children }: { title: string; hint?: string; count?: number; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 lg:text-[13px]">
        {title}{count !== undefined && <span className="font-normal text-slate-400">({count})</span>}
        {hint && <InfoDot label={hint} />}
      </h2>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

function TextLink({ href, children, arrow }: { href: string; children: ReactNode; arrow?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700 hover:underline">
      {children}{arrow && <ArrowRight size={13} aria-hidden />}
    </Link>
  )
}

const ALERT_ICON: Record<string, { icon: ReactNode; tone: string }> = {
  budget_threshold: { icon: <AlertTriangle size={17} />, tone: 'text-red-500' },
  creative_disapproved: { icon: <AlertTriangle size={17} />, tone: 'text-amber-500' },
  scope_missing: { icon: <Clock3 size={17} />, tone: 'text-blue-500' },
  sync_failed: { icon: <Clock3 size={17} />, tone: 'text-blue-500' },
  rate_limited: { icon: <Clock3 size={17} />, tone: 'text-blue-500' },
  auth_expired: { icon: <AlertTriangle size={17} />, tone: 'text-red-500' },
  campaign_approved: { icon: <CheckCircle2 size={17} />, tone: 'text-emerald-500' },
  performance_change: { icon: <BarChart3 size={17} />, tone: 'text-blue-500' },
}
const ACTIVITY_ICON: Record<string, { icon: ReactNode; tone: string }> = {
  'sync.completed': { icon: <CheckCircle2 size={17} />, tone: 'text-emerald-500' },
  'campaign.approved': { icon: <CheckCircle2 size={17} />, tone: 'text-emerald-500' },
  'performance.spike': { icon: <BarChart3 size={17} />, tone: 'text-blue-500' },
}

function entityHref(base: string, type: string | null, id: string | null): string | null {
  if (!type || !id) return null
  if (type === 'campaign') return `${base}/campaigns/${id}`
  if (type === 'creative') return `${base}/creatives/${id}`
  if (type === 'account') return `${base}/accounts/${id}`
  if (type === 'audience') return `${base}/audiences/${id}`
  return null
}

export default async function OverviewPage({ session, searchParams, nav }: { session: AdvertisingSession; searchParams: SearchParams; nav?: ReactNode }) {
  const range = resolveRange({ preset: first(searchParams.range) })
  const compare = comparisonRange(range, first(searchParams.compare))
  const platform = first(searchParams.platform)
  const trendMetricParam = first(searchParams.trendMetric)
  const trendMetric = (TREND_METRICS as readonly string[]).includes(trendMetricParam ?? '') ? trendMetricParam as OverviewOptions['trendMetric'] : 'spend'
  const trendGrain = first(searchParams.trendGrain) === 'weekly' ? 'weekly' : 'daily'
  const level = first(searchParams.level) === 'ad_sets' ? 'ad_sets' : 'campaigns'

  const data = await getOverviewData(session.supabase, session.workspace.id, range, {
    providers: platform ? [platform] : [],
    compare,
    level,
    trendMetric,
    trendGrain,
    campaign: {
      platform: first(searchParams.cpPlatform), objective: first(searchParams.cpObjective),
      status: first(searchParams.cpStatus), accountId: first(searchParams.cpAccount),
    },
  })

  const base = session.basePath
  const canConnect = session.capabilities['accounts.connect']
  const canCreateCampaign = session.capabilities['campaigns.create']
  const canExport = session.capabilities['campaigns.export']
  const rangeLabel = formatDateRange(new Date(`${range.since}T00:00:00Z`), new Date(`${range.until}T00:00:00Z`))
  const compareLabel = formatDateRange(new Date(`${compare.since}T00:00:00Z`), new Date(`${compare.until}T00:00:00Z`))
  const exportHref = `/api/advertising/export?workspaceType=${session.workspaceType}&range=${first(searchParams.range) ?? 'last_30'}${platform ? `&platform=${platform}` : ''}`
  const rangeDays = Math.round((Date.parse(range.until) - Date.parse(range.since)) / 86400000) + 1

  const headerActions = (
    <>
      {canConnect && <HeaderActionButton action={{ key: 'connect', label: 'Connect Account', href: `${base}/accounts?connect=1`, icon: <Link2 size={15} /> }} />}
      {canCreateCampaign && <HeaderActionButton action={{ key: 'create', label: 'Create Campaign', href: `${base}/campaigns?create=1`, variant: 'primary', icon: <Plus size={15} /> }} />}
      {canExport && <ExportSplit href={exportHref} />}
    </>
  )

  if (!data.hasAnyAccount) {
    return (
      <div>
        <PageHeader title="Advertising Overview" hint="Paid-media performance across every connected platform." subtitle="Monitor paid media performance, spend, and ad operations across all channels." nav={nav} />
        <EmptyState
          icon={<Plug size={30} />}
          title="Connect your first advertising account"
          description="Meta, Google, TikTok, LinkedIn and more — once an account is connected and synced, spend, performance and pacing appear here automatically."
          action={canConnect ? (
            <Link href={`${base}/accounts?connect=1`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700">
              <Plug size={14} /> Connect Account
            </Link>
          ) : <p className="text-[12.5px] text-slate-400">Ask a workspace admin to connect an advertising account.</p>}
        />
      </div>
    )
  }

  const kpis = [
    { value: kpi({ id: 'spend', label: 'Total Spend', format: 'currency', current: data.currentTotals.spend, previous: data.previousTotals.spend, spark: data.spendSeries, tooltip: 'Total spend across every connected advertising account.' }), icon: <CircleDollarSign />, accent: '#2563EB' },
    { value: kpi({ id: 'roas', label: 'ROAS (All)', format: 'roas', current: data.currentTotals.roas, previous: data.previousTotals.roas, spark: data.roasSeries, tooltip: 'Attributed revenue divided by spend, blended across platforms.' }), icon: <TrendingUp />, accent: '#7C3AED' },
    { value: kpi({ id: 'ctr', label: 'CTR (All)', format: 'percent', current: data.currentTotals.ctr, previous: data.previousTotals.ctr, spark: data.ctrSeries, tooltip: 'Clicks divided by impressions, blended across platforms.' }), icon: <MousePointerClick />, accent: '#0D9488' },
    { value: kpi({ id: 'conversions', label: 'Conversions', format: 'integer', current: data.currentTotals.conversions, previous: data.previousTotals.conversions, spark: data.conversionsSeries, tooltip: 'Attributed conversions across every connected account.' }), icon: <ShoppingCart />, accent: '#EA580C' },
    { value: kpi({ id: 'cpa', label: 'CPA (All)', format: 'currency', inverse: true, current: data.currentTotals.cpa, previous: data.previousTotals.cpa, spark: data.cpaSeries, tooltip: 'Spend divided by conversions. A lower CPA is better.' }), icon: <Crosshair />, accent: '#2563EB' },
    { value: kpi({ id: 'active', label: 'Active Campaigns', format: 'integer', current: data.activeCampaignCount, previous: data.previousActiveCampaignCount, spark: data.activeSeries, tooltip: 'Campaigns currently live or learning on any connected platform.' }), icon: <Rocket />, accent: '#7C3AED' },
  ]

  const feed = [
    ...data.alerts.map(alert => ({ id: alert.id, title: alert.title, detail: alert.detail, createdAt: alert.createdAt, href: entityHref(base, alert.entityType, alert.entityId), ...(ALERT_ICON[alert.issueType] ?? { icon: <AlertTriangle size={17} />, tone: 'text-amber-500' }) })),
    ...data.activity.map(entry => ({ id: entry.id, title: entry.summary, detail: entry.actorLabel ? `by ${entry.actorLabel}` : null, createdAt: entry.createdAt, href: entityHref(base, entry.entityType, entry.entityId), ...(ACTIVITY_ICON[entry.eventType] ?? { icon: <CheckCircle2 size={17} />, tone: 'text-slate-400' }) })),
  ].slice(0, 5)

  return (
    <div>
      <PageHeader
        title="Advertising Overview" hint="Blended totals across every connected platform, in the selected date range."
        subtitle="Monitor paid media performance, spend, and ad operations across all channels."
        className="mb-3"
        nav={nav}
        toolbar={(
          <>
            <DateRangeButton label={rangeLabel} className="min-w-[184px]" />
            <CompareButton label={compareLabel} className="min-w-[184px]" />
            <FiltersPopover activeCount={platform ? 1 : 0}>
              <label className="block text-[11.5px] font-medium text-slate-500">Platform</label>
              <ChipSelect paramKey="platform" label="Platform" allLabel="All platforms" options={PLATFORM_OPTIONS} className="w-full [&>span]:w-full [&>span]:justify-between" />
            </FiltersPopover>
          </>
        )}
      >
        {headerActions}
      </PageHeader>

      {data.integrity.mixedCurrency && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Totals mix {data.integrity.currencies.join(', ')} accounts without conversion. Figures are summed as-is.
        </p>
      )}

      <section className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Key metrics">
        {kpis.map(card => <KpiCard key={card.value.id} kpi={card.value} icon={card.icon} accent={card.accent} comparisonLabel={compareLabel} />)}
      </section>

      <Panel className="mb-2 !py-3">
        <PanelTitle title="Connected Ad Accounts" count={data.accounts.length}>
          <TextLink href={`${base}/accounts`}>View All Accounts</TextLink>
        </PanelTitle>
        {data.accounts.length === 0 ? (
          <EmptyState compact title="No accounts synced yet" description="Connect a platform to see spend and health here." className="mt-3" />
        ) : (
          <ScrollRow label="connected ad accounts" className="mt-2">
            {data.accounts.map(account => (
              <article key={account.provider} className="w-[282px] shrink-0 snap-start rounded-[10px] border border-slate-200/80 bg-white px-4 py-3 lg:py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProviderLogo provider={account.provider} size={22} decorative />
                    <h3 className="truncate text-[14px] font-semibold text-slate-900 lg:text-[12.5px]">{providerLabel(account.provider)}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusPill status={account.health} map={HEALTH_STATUS} dot={false} className="rounded-md px-2 text-[11px]" />
                    <KebabMenu label={`${providerLabel(account.provider)} actions`}>
                      <Link href={`${base}/accounts?provider=${account.provider}`}>View accounts</Link>
                      <Link href={`${base}/campaigns?platform=${account.provider}`}>View campaigns</Link>
                      <Link href={`${base}/reports?platform=${account.provider}`}>Open report</Link>
                    </KebabMenu>
                  </div>
                </div>
                <div className="mt-1.5 flex items-start justify-between">
                  <div>
                    <p className="text-[11.5px] leading-4 text-slate-500 lg:text-[10.5px]">Spend ({rangeDays}d)</p>
                    <p className="mt-0.5 flex items-baseline gap-2 leading-5">
                      <span className="text-[14px] font-semibold tabular-nums text-slate-900 lg:text-[13.5px]">{formatCurrency(account.spend)}</span>
                      {account.spendChangePct !== null && (
                        <span className={`text-[11.5px] font-semibold ${account.spendChangePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          <span aria-hidden>{account.spendChangePct >= 0 ? '↑' : '↓'}</span> {Math.abs(account.spendChangePct).toFixed(1)}%
                          <span className="sr-only">{account.spendChangePct >= 0 ? 'up' : 'down'} on the comparison period</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11.5px] leading-4 text-slate-500 lg:text-[10.5px]">Accounts</p>
                    <p className="mt-0.5 text-[14px] font-semibold leading-5 text-slate-900 lg:text-[13.5px]">{account.accountCount}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 lg:mt-1.5 lg:pt-1.5">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500 lg:text-[10.5px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${account.health === 'connected' ? 'bg-emerald-500' : account.health === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden />
                    {account.lastSyncedAt ? `Last synced ${formatRelativeTime(account.lastSyncedAt)}` : 'Not synced yet'}
                  </span>
                  <Link href={`${base}/accounts?provider=${account.provider}`} className="rounded-md border border-slate-200 px-2.5 py-0.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50 lg:text-[10.5px]">View</Link>
                </div>
              </article>
            ))}
          </ScrollRow>
        )}
      </Panel>

      <div className="mb-2 grid gap-2 xl:grid-cols-[1.57fr_1fr]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-slate-900 lg:text-[13px]">Campaign Performance</h2>
            <SegmentedParam paramKey="level" defaultValue="campaigns" ariaLabel="Performance level" options={[{ value: 'campaigns', label: 'Campaigns' }, { value: 'ad_sets', label: 'Ad Sets' }]} />
            <TextLink href={`${base}/campaigns`}>View All</TextLink>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <ChipSelect paramKey="cpPlatform" label="Platform" allLabel="All Platforms" options={PLATFORM_OPTIONS} />
            <ChipSelect paramKey="cpObjective" label="Objective" prefix="Objective:" allLabel="Objective: All" options={Object.entries(OBJECTIVE_LABELS).map(([value, label]) => ({ value, label }))} />
            <ChipSelect paramKey="cpStatus" label="Status" prefix="Status:" allLabel="Status: All" options={Object.entries(CAMPAIGN_STATUS).map(([value, entry]) => ({ value, label: entry.label }))} />
            <details className="relative">
              <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <Plus size={13} aria-hidden /> Add filter
              </summary>
              <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg">
                <p className="mb-1.5 text-[11.5px] font-medium text-slate-500">Account</p>
                <ChipSelect paramKey="cpAccount" label="Account" allLabel="All accounts" options={data.accountOptions.map(option => ({ value: option.id, label: option.name }))} className="w-full [&>span]:w-full [&>span]:justify-between" />
              </div>
            </details>
          </div>

          {data.performanceRows.length === 0 ? (
            <EmptyState compact className="mt-3" title={level === 'ad_sets' ? 'No ad sets synced yet' : 'No campaigns match these filters'} description={level === 'ad_sets' ? 'Ad sets appear once a connected platform reports them.' : 'Try clearing the filters above.'} />
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px] lg:text-[10px]">
                <caption className="sr-only">Top {level === 'ad_sets' ? 'ad sets' : 'campaigns'} by spend</caption>
                <thead>
                  <tr className="border-b border-slate-100 text-[11.5px] font-semibold text-slate-700 lg:text-[10px] lg:font-medium">
                    <th className="py-1.5 pr-3 font-semibold">{level === 'ad_sets' ? 'Ad Set' : 'Campaign'}</th>
                    <th className="px-3 py-1 font-semibold">Spend</th>
                    <th className="px-3 py-1 font-semibold">ROAS</th>
                    <th className="px-3 py-1 font-semibold">CTR</th>
                    <th className="px-3 py-1 font-semibold">Conversions</th>
                    <th className="px-3 py-1 font-semibold">CPA</th>
                    <th className="px-3 py-1 font-semibold">Status</th>
                    <th className="w-8 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.performanceRows.map(row => {
                    const href = `${base}/campaigns/${row.parentId ?? row.id}`
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 lg:[&>td]:py-[3px]">
                        <td className="py-1 pr-3">
                          <Link href={href} className="flex items-center gap-2.5 text-slate-700 hover:text-blue-700">
                            <ProviderLogo provider={row.provider} size={16} decorative />
                            <span className="truncate">{row.name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-1 tabular-nums text-slate-700">{formatCurrency(row.spend)}</td>
                        <td className="px-3 py-1 tabular-nums text-slate-700">{formatRoas(row.roas)}</td>
                        <td className="px-3 py-1 tabular-nums text-slate-700">{formatPercent(row.ctr)}</td>
                        <td className="px-3 py-1 tabular-nums text-slate-700">{formatNumber(row.conversions)}</td>
                        <td className="px-3 py-1 tabular-nums text-slate-700">{formatCurrency(row.cpa)}</td>
                        <td className="px-3 py-1"><StatusPill status={row.status} map={CAMPAIGN_STATUS} dot={false} /></td>
                        <td className="py-[3px] text-right">
                          <KebabMenu size="sm" label={`${row.name} actions`}>
                            <Link href={href}>View {level === 'ad_sets' ? 'parent campaign' : 'campaign'}</Link>
                            <Link href={`${base}/creatives?q=${encodeURIComponent(row.name)}`}>View creatives</Link>
                          </KebabMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2"><TextLink href={`${base}/campaigns`} arrow>View all campaigns</TextLink></div>
        </Panel>

        <Panel>
          <PanelTitle title="Alerts & Recent Activity">
            <TextLink href={`${base}/accounts`}>View All</TextLink>
          </PanelTitle>
          {feed.length === 0 ? (
            <EmptyState compact title="All clear" description="No open alerts and no recent activity." className="mt-3" />
          ) : (
            <ul className="mt-2 space-y-1">
              {feed.map(item => {
                const body = (
                  <>
                    <span className={`mt-0.5 shrink-0 ${item.tone}`} aria-hidden>{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold leading-[18px] text-slate-800">{item.title}</p>
                      {item.detail && <p className="truncate text-[11px] leading-4 text-slate-500">{item.detail}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</span>
                  </>
                )
                return (
                  <li key={item.id}>
                    {item.href
                      ? <Link href={item.href} className="-mx-1.5 flex gap-3 rounded-md px-1.5 py-0.5 hover:bg-slate-50">{body}</Link>
                      : <div className="flex gap-3">{body}</div>}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-auto pt-2"><TextLink href={`${base}/accounts`} arrow>View all activity</TextLink></div>
        </Panel>
      </div>

      <div className="grid gap-2 xl:grid-cols-[442fr_320fr_450fr]">
        <Panel>
          <PanelTitle title="Creative Performance">
            <TextLink href={`${base}/creatives`}>View All</TextLink>
          </PanelTitle>
          {data.topCreatives.length === 0 ? (
            <EmptyState compact title="No creatives yet" description="Creatives synced from your accounts will appear here." className="mt-3" />
          ) : (
            <ScrollRow label="top creatives" className="mt-3 gap-2.5">
              {data.topCreatives.map(creative => (
                <Link key={creative.id} href={`${base}/creatives/${creative.id}`} className="w-[96px] shrink-0 snap-start overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-300">
                  <CreativeThumb format={creative.format} name={creative.name} url={creative.thumbnailUrl} />
                  <div className="p-2">
                    <p className="flex items-center gap-1 truncate text-[10.5px] text-slate-600">
                      <ProviderLogo provider={creative.provider} size={11} decorative />
                      {FORMAT_LABELS[creative.format] ?? creative.format}
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 text-[10px] text-slate-400"><span>Spend</span><span>CTR</span></div>
                    <div className="grid grid-cols-2 text-[11px] font-semibold tabular-nums text-slate-800">
                      <span>{formatCurrency(creative.spend, undefined, { compact: true })}</span>
                      <span>{formatPercent(creative.ctr)}</span>
                    </div>
                    <p className="text-[10.5px] tabular-nums text-slate-500">{formatNumber(creative.clicks, { compact: true })}</p>
                    <StatusPill status={creative.status} map={CAMPAIGN_STATUS} dot={false} className="mt-1.5 rounded-md px-2 text-[10.5px]" />
                  </div>
                </Link>
              ))}
            </ScrollRow>
          )}
        </Panel>

        <Panel>
          <PanelTitle title="Spend Trend" hint="Daily or weekly totals for the selected period, against the comparison period.">
            <ChipSelect paramKey="trendGrain" label="Granularity" allLabel="Daily" options={[{ value: 'weekly', label: 'Weekly' }]} />
            <ChipSelect paramKey="trendMetric" label="Metric" allLabel="Spend" options={[{ value: 'conversions', label: 'Conversions' }, { value: 'roas', label: 'ROAS' }, { value: 'clicks', label: 'Clicks' }]} />
          </PanelTitle>
          <TrendChart
            className="mt-4"
            points={data.trend}
            comparison={data.trendComparison}
            format={TREND_FORMAT[trendMetric ?? 'spend']}
            height={128}
            summary={`${trendMetric ?? 'spend'} ${trendGrain} trend for ${rangeLabel} compared with ${compareLabel}`}
          />
          <TrendLegend current={rangeLabel} comparison={compareLabel} />
        </Panel>

        <Panel>
          <PanelTitle title="Budget Pacing">
            <TextLink href={`${base}/campaigns?sort=budget_desc`}>View All</TextLink>
          </PanelTitle>
          {data.budgetPacing.length === 0 ? (
            <EmptyState compact title="No active budgets" description="Campaigns with a set budget will show pacing here." className="mt-3" />
          ) : (
            <ul className="mt-3 space-y-2.5">
              {data.budgetPacing.map(row => (
                <li key={row.id}>
                  <Link href={`${base}/campaigns/${row.id}`} className="grid grid-cols-[1fr_minmax(0,150px)_36px] items-center gap-3 text-[12px] hover:text-blue-700">
                    <span className="truncate font-medium text-slate-700">{row.name}</span>
                    <span className="min-w-0">
                      <span className="block truncate tabular-nums text-slate-600">{wholePounds(row.spend)} / {wholePounds(row.budget)}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${pacingColour(row.pct)}`} style={{ width: `${Math.min(100, row.pct)}%` }} />
                      </span>
                    </span>
                    <span className="text-right font-medium tabular-nums text-slate-700">{Math.round(row.pct)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto pt-4"><TextLink href={`${base}/campaigns?sort=budget_desc`} arrow>Manage budgets</TextLink></div>
        </Panel>
      </div>
    </div>
  )
}

/**
 * Creative thumbnail. Synced creatives with a stored thumbnail would render it
 * here via a signed URL; until one exists the tile shows the format honestly
 * rather than a stock photo.
 */
function CreativeThumb({ format, name, url }: { format: string; name: string; url: string | null }) {
  const isVideo = format === 'video' || format === 'reel' || format === 'story'
  if (url) {
    return (
      <div className="relative h-[86px] overflow-hidden bg-slate-100">
        {/* Signed, short-lived URL from the private bucket. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${FORMAT_LABELS[format] ?? format} creative: ${name}`} loading="lazy" className="h-full w-full object-cover" />
        {isVideo && (
          <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow-sm" aria-hidden>
            <Play size={12} className="ml-0.5 fill-current" />
          </span>
        )}
      </div>
    )
  }
  const tone = format === 'video' || format === 'reel' ? 'from-sky-100 to-indigo-100 text-indigo-400'
    : format === 'carousel' ? 'from-rose-50 to-amber-100 text-amber-500'
      : format === 'story' ? 'from-violet-50 to-fuchsia-100 text-fuchsia-400'
        : 'from-slate-100 to-slate-200 text-slate-400'
  return (
    <div className={`relative flex h-[86px] items-center justify-center bg-gradient-to-br ${tone}`} role="img" aria-label={`${FORMAT_LABELS[format] ?? format} creative: ${name}`}>
      {format === 'video' || format === 'reel' || format === 'story'
        ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm"><Play size={14} className="ml-0.5 fill-current" aria-hidden /></span>
        : <ImageIcon size={22} aria-hidden />}
    </div>
  )
}
