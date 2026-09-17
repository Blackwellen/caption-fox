import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, ChevronDown, ChevronRight, Database, Eye, FileText, Heart, LayoutDashboard,
  MousePointer2, Percent, Plus, Sparkles, TrendingUp, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/lib/permissions'
import {
  buildInsights, dataSourceStatuses, getAudienceDemographics, getChannelBreakdown, getChannels, getContentPerformance,
  getEngagementBreakdown, getPeriodTotals, getReportPresets,
} from '@/lib/social/queries'
import { canAccessSocialCapability } from '@/lib/social/entitlements'
import { changePct, compactNumber, formatRangeLabel, previousRange, rangeFromDays, shortDay } from '@/lib/social/metrics'
import { parseDays, parseEnum, parseId, withParams } from '@/lib/social/url-state'
import type { SocialProvider } from '@/types/social'
import Sparkline from '@/components/advertising/Sparkline'
import type { SocialPageProps } from '../SocialRoute'
import { SocialHeader } from '../Header'
import { Ago, Card, CardTitle, Delta, EmptyNote, fmtCount, fmtRate, fmtTime, Hint, LineChart, PROVIDER_NAMES, ProviderIcon, TextLink } from '../kit'
import { FieldSelect, FilterPopover, Kebab, Menu, ParamTabs, PillSelect } from '../controls'
import { CreateReportDialog, ScheduleToggle } from '../analytics/AnalyticsClient'

// /{type}/social/analytics — Social Analytics, built to design reference (6).
// KPI strip · Performance Over Time | Performance by Channel · Content
// Performance | Top Performing Posts · Audience Demographics | Engagement
// Breakdown | Outcome Funnel, with an Insights / Reports rail on the right.

const PLATFORM_ORDER: SocialProvider[] = ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube', 'pinterest', 'threads']
const CONTENT_TYPES = { all: null, posts: 'post', reels: 'reel', stories: 'story', videos: 'short', carousels: 'carousel' } as const
const TYPE_LABEL: Record<string, string> = { reel: 'Reel', short: 'Video', story: 'Story', carousel: 'Carousel', thread: 'Text', pin: 'Pin', post: 'Image' }
const SORTS = ['reach_desc', 'rate_desc', 'rate_asc', 'recent'] as const
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const COUNTRY = new Intl.DisplayNames(['en-GB'], { type: 'region' })
const DONUT_BLUES = ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#CBD5E1']
const ENGAGEMENT_COLOURS: Record<string, string> = { likes: '#2563EB', comments: '#7C3AED', shares: '#8B5CF6', saves: '#10B981' }
const FREQUENCY: Record<string, string> = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month' }
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function AnalyticsPage({ session, searchParams, nav }: SocialPageProps) {
  const base = session.basePath
  const days = parseDays(searchParams.days)
  const range = rangeFromDays(days)
  const prev = previousRange(range)
  const grain = parseEnum(searchParams.grain, ['daily', 'weekly'] as const, 'daily')
  const channelMetric = parseEnum(searchParams.by, ['reach', 'impressions', 'engagements', 'rate'] as const, 'reach')
  const contentTab = parseEnum(searchParams.content, Object.keys(CONTENT_TYPES) as (keyof typeof CONTENT_TYPES)[], 'all')
  const sort = parseEnum(searchParams.sort, SORTS, 'recent')
  const rail = parseEnum(searchParams.rail, ['insights', 'reports'] as const, 'insights')
  const view = parseEnum(searchParams.view, ['dashboard', 'table', 'channels', 'audience'] as const, 'dashboard')

  const channels = await getChannels(session)
  const channelId = parseId(searchParams.channel)
  const scoped = channels.find(channel => channel.id === channelId) ?? null

  const canExport = session.can(PERMISSIONS.SOCIAL_ANALYTICS_EXPORT)
  const canCreateReport = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_ANALYTICS_CREATE_REPORT).allowed
  const canSchedule = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_ANALYTICS_SCHEDULE_REPORT).allowed

  const [totals, breakdown, content, engagement, audience, reports] = await Promise.all([
    getPeriodTotals(session, range, scoped ? { channelId: scoped.id, platform: scoped.platform } : {}),
    getChannelBreakdown(session, range, channels),
    getContentPerformance(session, range, { postType: CONTENT_TYPES[contentTab] ?? undefined, limit: view === 'table' ? 200 : 60 }),
    getEngagementBreakdown(session, range),
    getAudienceDemographics(session, range, channels),
    getReportPresets(session),
  ])

  const current = totals.current
  const previous = totals.previous
  const pct = (a: number, b: number) => changePct(a, b || null)
  const series = totals.series
  const weekly = grain === 'weekly'
  const chartPoints = weekly ? rollWeekly(series) : series
  const kpis: { key: string; label: string; value: string; delta: number | null; unit?: '%' | 'pp'; icon: ReactNode; spark: number[] }[] = [
    { key: 'reach', label: 'Total Reach', value: fmtCount(current.reach), delta: pct(current.reach, previous.reach), icon: <ChartNoAxesColumnIncreasing size={18} />, spark: series.map(point => point.reach) },
    { key: 'impressions', label: 'Impressions', value: fmtCount(current.impressions), delta: pct(current.impressions, previous.impressions), icon: <Eye size={18} />, spark: series.map(point => point.impressions) },
    { key: 'engagements', label: 'Engagements', value: fmtCount(current.engagements), delta: pct(current.engagements, previous.engagements), icon: <Heart size={18} />, spark: series.map(point => point.engagements) },
    { key: 'rate', label: 'Engagement Rate', value: fmtRate(current.engagementRate), delta: current.engagementRate !== null && previous.engagementRate !== null ? (current.engagementRate - previous.engagementRate) * 100 : null, unit: 'pp', icon: <Percent size={18} />, spark: series.map(point => point.engagementRate ?? 0) },
    { key: 'followers', label: 'New Followers', value: fmtCount(current.followerChange), delta: pct(current.followerChange, previous.followerChange), icon: <Users size={18} />, spark: dailyFollowers(totals.daily, series.map(point => point.date)) },
    { key: 'clicks', label: 'Link Clicks', value: fmtCount(current.linkClicks), delta: pct(current.linkClicks, previous.linkClicks), icon: <MousePointer2 size={18} />, spark: [] },
  ]

  // Performance by channel: one row per platform, summed across accounts.
  const platformRows = PLATFORM_ORDER.map(platform => {
    const rows = breakdown.filter(row => row.channel.platform === platform)
    if (rows.length === 0) return null
    const reach = rows.reduce((sum, row) => sum + row.reach, 0)
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0)
    const engagements = rows.reduce((sum, row) => sum + row.engagements, 0)
    const prevReach = rows.reduce((sum, row) => sum + (row.reachChangePct === null ? 0 : row.reach / (1 + row.reachChangePct / 100)), 0)
    return {
      platform, reach, impressions, engagements, rate: reach ? engagements / reach : null,
      change: prevReach ? changePct(reach, prevReach) : null,
      series: rows[0].series.map((point, index) => ({ date: point.date, value: rows.reduce((sum, row) => sum + (row.series[index]?.value ?? 0), 0) })),
      channelId: rows.sort((a, b) => b.reach - a.reach)[0].channel.id,
    }
  }).filter((row): row is NonNullable<typeof row> => Boolean(row))
  const metricValue = (row: (typeof platformRows)[number]) => channelMetric === 'impressions' ? row.impressions : channelMetric === 'engagements' ? row.engagements : channelMetric === 'rate' ? (row.rate ?? 0) : row.reach
  const metricTotal = platformRows.reduce((sum, row) => sum + metricValue(row), 0)

  const sortedContent = [...content].sort((a, b) => {
    if (sort === 'reach_desc') return b.reach - a.reach
    if (sort === 'rate_desc') return (b.engagementRate ?? -1) - (a.engagementRate ?? -1)
    if (sort === 'rate_asc') return (a.engagementRate ?? 99) - (b.engagementRate ?? 99)
    return (b.post.published_at ?? '').localeCompare(a.post.published_at ?? '')
  })
  const topPosts = [...content].filter(row => row.hasMetrics).sort((a, b) => b.reach - a.reach).slice(0, 5)
  const insights = buildInsights({ basePath: base, totals: current, previous, breakdown, series })
  const countries = audience.find(item => item.dimension === 'country')
  const ages = audience.find(item => item.dimension === 'age')
  const totalFollowers = channels.reduce((sum, channel) => sum + (channel.follower_count ?? 0), 0)
  const sources = dataSourceStatuses(channels, range)
  const incompleteSources = sources.filter(source => source.incomplete).length
  const funnel = [
    { label: 'Impressions', value: current.impressions },
    { label: 'Reach', value: current.reach },
    { label: 'Engagements', value: current.engagements },
    { label: 'Link Clicks', value: current.linkClicks },
  ]
  const channelOptions = channels.map(channel => ({ value: channel.id, label: `${PROVIDER_NAMES[channel.platform]} · ${channel.handle ?? channel.account_name}` }))
  const exportQuery = { days: String(days) }

  return (
    <>
      <SocialHeader
        title="Social Analytics"
        subtitle="Compare social performance across channels with transparent sources and exportable reports."
        nav={nav}
        compact
        actions={(
          <>
            <PillSelect paramKey="days" label={`Date range, currently ${formatRangeLabel(range)}`} defaultValue="7" icon={<CalendarDays size={14} className="text-slate-500" aria-hidden />}
              options={[{ value: '7', label: formatRangeLabel(range) }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} className="min-w-[150px]" />
            <span className="inline-flex h-10 flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 leading-tight lg:h-[34px]" title="Comparisons use the immediately preceding period of the same length.">
              <span className="text-[10px] text-slate-400 lg:text-[8px]">Compare to</span>
              <span className="text-[12.5px] font-medium text-slate-700 lg:text-[10.5px]">{MONTH_DAY.format(prev.from)} – {MONTH_DAY.format(prev.to)}, {prev.to.getFullYear()}</span>
            </span>
            <FilterPopover activeCount={scoped ? 1 : 0} clearKeys={['channel']}>
              <FieldSelect paramKey="channel" label="Channel" allLabel="All channels" options={channelOptions} />
            </FilterPopover>
            <span className="inline-flex h-10 flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 leading-tight lg:h-[34px]" title="Clicks and outcomes are credited to the last social post the user interacted with, as reported by each platform.">
              <span className="text-[10px] text-slate-400 lg:text-[8px]">Attribution</span>
              <span className="text-[12.5px] font-medium text-slate-700 lg:text-[10.5px]">Last Touch</span>
            </span>
            <PillSelect paramKey="view" label="Layout" defaultValue="dashboard" icon={<LayoutDashboard size={14} className="text-slate-500" aria-hidden />}
              options={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'table', label: 'Content table' }, { value: 'channels', label: 'Channels' }, { value: 'audience', label: 'Audience' }]} className="min-w-[104px]" />
            <div className="inline-flex rounded-lg shadow-sm">
              {canCreateReport
                ? <Link href={withParams(searchParams, { report: 'new' })} scroll={false} className="inline-flex h-10 items-center gap-2 rounded-l-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 lg:h-[34px] lg:text-[11.5px]"><Plus size={15} aria-hidden /> Create Report</Link>
                : <button type="button" disabled title="Your role or plan cannot create reports." className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-l-lg bg-blue-600 px-4 text-[13px] font-semibold text-white opacity-55 lg:h-[34px] lg:text-[11.5px]"><Plus size={15} aria-hidden /> Create Report</button>}
              <Menu label="Export analytics" width="w-52" triggerClassName="inline-flex h-10 items-center rounded-r-lg border-l border-white/25 bg-blue-600 px-2.5 text-white hover:bg-blue-700 lg:h-[34px]" trigger={<ChevronDown size={15} aria-hidden />}>
                {canExport ? (
                  <>
                    <a href={`/api/social/export?${new URLSearchParams({ dataset: 'analytics', format: 'pdf', ...exportQuery })}`} download>Export PDF report</a>
                    <a href={`/api/social/export?${new URLSearchParams({ dataset: 'analytics', format: 'xlsx', ...exportQuery })}`} download>Export Excel</a>
                    <a href={`/api/social/export?${new URLSearchParams({ dataset: 'analytics', format: 'csv', ...exportQuery })}`} download>Export CSV</a>
                  </>
                ) : <button type="button" disabled>Your role cannot export analytics</button>}
              </Menu>
            </div>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-[14px]">
        {kpis.map(kpi => (
          <Card key={kpi.key} className="relative px-3.5 pb-2 pt-3 xl:h-[94px]">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 xl:h-[34px] xl:w-[34px]" aria-hidden>{kpi.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-slate-700 lg:text-[9.5px]">{kpi.label}</p>
                <p className="flex items-baseline gap-1.5"><span className="text-[20px] font-semibold text-slate-900 tabular-nums lg:text-[19px]">{kpi.value}</span><Delta value={kpi.delta} unit={kpi.unit} /></p>
                <p className="truncate text-[11px] text-slate-400 lg:text-[8.5px]">vs {MONTH_DAY.format(prev.from)} – {MONTH_DAY.format(prev.to)}</p>
              </div>
            </div>
            <div className="absolute right-2 top-2.5">
              <Kebab label={`${kpi.label} options`}><Link href={withParams(searchParams, { view: 'table', sort: kpi.key === 'rate' ? 'rate_desc' : 'reach_desc' })}>See contributing posts</Link></Kebab>
            </div>
            <div className="mt-1 h-[16px]"><Sparkline points={kpi.spark.map((value, index) => ({ date: String(index), value }))} color="#3B6FF5" height={16} strokeWidth={1.3} fill summary={`${kpi.label} per day`} /></div>
          </Card>
        ))}
      </div>

      {scoped && <p role="status" className="mt-2 text-[12px] text-slate-500">KPIs and trend show <strong className="font-semibold text-slate-700">{scoped.handle ?? scoped.account_name}</strong> only.</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,905fr)_284fr] xl:gap-[16px]">
        <div className="min-w-0 space-y-4 xl:space-y-[14px]">
          {(view === 'dashboard' || view === 'channels') && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[492fr_398fr] xl:gap-[15px]">
              <Card className="flex flex-col p-3.5 xl:h-[270px] xl:py-3">
                <CardTitle title="Performance Over Time" hint="The axis shows reach. Impressions, engagements and engagement rate are each drawn on their own scale so trends can be compared; hover a point for its value.">
                  <PillSelect compact paramKey="grain" label="Granularity" defaultValue="daily" options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} className="min-w-[58px]" />
                </CardTitle>
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600 lg:text-[9px]">
                  {[['Reach', '#3B6FF5'], ['Impressions', '#A78BFA'], ['Engagements', '#22C55E'], ['Engagement Rate', '#F59E0B']].map(([label, color]) => <li key={label} className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} aria-hidden />{label}</li>)}
                </ul>
                <LineChart className="mt-2" height={170} labels={chartPoints.map(point => weekly ? `w/c ${shortDay(point.date)}` : shortDay(point.date))}
                  series={[
                    { key: 'reach', label: 'Reach', color: '#3B6FF5', values: chartPoints.map(point => point.reach), format: compactNumber },
                    { key: 'impressions', label: 'Impressions', color: '#A78BFA', values: chartPoints.map(point => point.impressions), band: [0.52, 0.68], format: compactNumber },
                    { key: 'engagements', label: 'Engagements', color: '#22C55E', values: chartPoints.map(point => point.engagements), band: [0.3, 0.44], format: compactNumber },
                    { key: 'rate', label: 'Engagement Rate', color: '#F59E0B', values: chartPoints.map(point => point.engagementRate), band: [0.08, 0.22], format: value => `${(value * 100).toFixed(2)}%` },
                  ]}
                  summary="Daily reach on the axis scale; impressions, engagements and engagement rate each drawn on their own scale so trends can be compared. Hover a point for its value." />
              </Card>

              <Card className="flex flex-col p-3.5 xl:h-[270px] xl:py-3">
                <CardTitle title="Performance by Channel">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500 lg:text-[9px]">View by
                    <PillSelect compact paramKey="by" label="Channel metric" defaultValue="reach" options={[{ value: 'reach', label: 'Reach' }, { value: 'impressions', label: 'Impressions' }, { value: 'engagements', label: 'Engagements' }, { value: 'rate', label: 'Eng. Rate' }]} className="min-w-[56px]" />
                  </span>
                </CardTitle>
                {platformRows.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No channel data" description="Connect a channel to compare performance." /> : (
                  <table className="mt-2 w-full text-left text-[12px] lg:text-[9.5px]">
                    <thead className="text-slate-500"><tr className="border-b border-slate-100 [&>th]:pb-1.5 [&>th]:font-medium"><th scope="col">Channel</th><th scope="col">{channelMetric === 'rate' ? 'Eng. Rate' : channelMetric[0].toUpperCase() + channelMetric.slice(1)}</th><th scope="col" className="text-right">%</th><th scope="col" className="w-[70px]"><span className="sr-only">Trend</span></th><th scope="col" className="text-right">vs Prev.</th></tr></thead>
                    <tbody>
                      {platformRows.slice(0, 6).map(row => (
                        <tr key={row.platform} className="[&>td]:py-[5px]">
                          <td><Link href={withParams(searchParams, { channel: row.channelId })} className="flex items-center gap-2 hover:underline"><ProviderIcon provider={row.platform} size={16} /><span className="text-slate-700">{PROVIDER_NAMES[row.platform]}</span></Link></td>
                          <td className="font-medium tabular-nums text-slate-900">{channelMetric === 'rate' ? fmtRate(row.rate) : compactNumber(metricValue(row))}</td>
                          <td className="text-right tabular-nums text-slate-600">{channelMetric === 'rate' || !metricTotal ? '—' : `${((metricValue(row) / metricTotal) * 100).toFixed(1)}%`}</td>
                          <td className="px-2"><span className="block h-[14px]"><Sparkline points={row.series} color={(row.change ?? 0) < 0 ? '#EF4444' : '#3B6FF5'} height={14} strokeWidth={1.1} summary={`${PROVIDER_NAMES[row.platform]} daily reach`} /></span></td>
                          <td className="text-right"><Delta value={row.change} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <Link href={withParams(searchParams, { view: 'channels' })} className="mt-auto inline-flex items-center justify-center gap-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9.5px]">View Channel Comparison <ArrowRight size={11} aria-hidden /></Link>
              </Card>
            </div>
          )}

          {(view === 'dashboard' || view === 'table') && (
            <div className={cn('grid grid-cols-1 gap-4 xl:gap-[15px]', view === 'dashboard' ? 'lg:grid-cols-2 xl:grid-cols-[492fr_398fr]' : '')}>
              <Card className={cn('flex flex-col p-3.5 xl:py-3', view === 'dashboard' && 'xl:h-[245px]')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14px] font-semibold text-slate-900 lg:text-[12.5px]">Content Performance</h2>
                  <ParamTabs paramKey="content" defaultValue="all" ariaLabel="Content type" variant="soft"
                    options={[{ value: 'all', label: 'All Content' }, { value: 'posts', label: 'Posts' }, { value: 'reels', label: 'Reels' }, { value: 'stories', label: 'Stories' }, { value: 'videos', label: 'Videos' }, { value: 'carousels', label: 'Carousels' }]} />
                </div>
                {sortedContent.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No published content in this range" description="Published posts and their metrics appear here after the next sync." /> : (
                  <div className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                    <table className="w-full min-w-[520px] table-fixed text-left text-[11px] xl:min-w-0 lg:text-[8.5px]">
                      <colgroup><col className="w-[27%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[13%]" /><col className="w-[9%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[11%]" /></colgroup>
                      <thead className="text-slate-500">
                        <tr className="border-b border-slate-100 [&>th]:pb-1.5 [&>th]:font-medium">
                          <th scope="col">Content</th><th scope="col" className="text-center">Channel</th><th scope="col">Type</th>
                          <SortHeader label="Published" value="recent" sort={sort} searchParams={searchParams} />
                          <SortHeader label="Reach" value="reach_desc" sort={sort} searchParams={searchParams} align="right" />
                          <th scope="col" className="text-right">Engagements</th>
                          <SortHeader label="Eng. Rate" value={sort === 'rate_desc' ? 'rate_asc' : 'rate_desc'} active={sort === 'rate_desc' || sort === 'rate_asc'} sort={sort} searchParams={searchParams} align="right" />
                          <th scope="col" className="text-right">Link Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedContent.slice(0, view === 'table' ? 200 : 5).map(row => (
                          <tr key={row.post.id} className="border-b border-slate-50 [&>td]:py-[4px]">
                            <td><Link href={`${base}/posts/${row.post.id}`} className="flex items-center gap-2 hover:underline"><Thumb src={row.post.thumbnail_url} /><span className="truncate font-medium text-slate-800">{row.post.title ?? 'Untitled post'}</span></Link></td>
                            <td className="text-center"><ProviderIcon provider={row.post.platforms?.[0] ?? 'instagram'} size={13} className="mx-auto" /></td>
                            <td className="text-slate-600">{TYPE_LABEL[row.post.post_type] ?? row.post.post_type}</td>
                            <td className="leading-tight text-slate-500">{row.post.published_at ? <>{MONTH_DAY.format(new Date(row.post.published_at))} {new Date(row.post.published_at).getUTCFullYear()}<br />{fmtTime(row.post.published_at)}</> : '—'}</td>
                            <td className="text-right tabular-nums">{row.hasMetrics ? compactNumber(row.reach) : '—'}</td>
                            <td className="text-right tabular-nums">{row.hasMetrics ? compactNumber(row.engagements) : '—'}</td>
                            <td className="text-right tabular-nums">{fmtRate(row.engagementRate, 1)}</td>
                            <td className="text-right tabular-nums">{row.hasMetrics ? compactNumber(row.linkClicks) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {view === 'dashboard' && <Link href={withParams(searchParams, { view: 'table' })} className="mt-1 inline-flex items-center justify-center gap-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9.5px]">View all content <ArrowRight size={11} aria-hidden /></Link>}
              </Card>

              {view === 'dashboard' && (
                <Card className="flex flex-col p-3.5 xl:h-[245px] xl:py-3">
                  <CardTitle title="Top Performing Posts"><TextLink href={withParams(searchParams, { view: 'table', sort: 'reach_desc' })}>View all ›</TextLink></CardTitle>
                  {topPosts.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No post metrics yet" /> : (
                    <table className="mt-1 w-full text-left text-[11px] lg:text-[8.5px]">
                      <thead className="text-slate-500"><tr className="[&>th]:pb-1 [&>th]:font-medium"><th scope="col" className="w-5"><span className="sr-only">Rank</span></th><th scope="col"><span className="sr-only">Post</span></th><th scope="col" className="text-right">Reach</th><th scope="col" className="text-right">Eng. Rate</th></tr></thead>
                      <tbody>
                        {topPosts.map((row, index) => (
                          <tr key={row.post.id} className="[&>td]:py-[3px]">
                            <td><span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] text-slate-500 lg:h-[15px] lg:w-[15px] lg:text-[8px]">{index + 1}</span></td>
                            <td>
                              <Link href={`${base}/posts/${row.post.id}`} className="flex items-center gap-2 hover:underline">
                                <Thumb src={row.post.thumbnail_url} size={26} />
                                <span className="min-w-0 leading-tight">
                                  <span className="block truncate font-medium text-slate-800">{row.post.title ?? 'Untitled post'}</span>
                                  <span className="flex items-center gap-1 text-slate-400"><ProviderIcon provider={row.post.platforms?.[0] ?? 'instagram'} size={9} decorative />{PROVIDER_NAMES[row.post.platforms?.[0] ?? 'instagram']} · {TYPE_LABEL[row.post.post_type] ?? row.post.post_type}</span>
                                </span>
                              </Link>
                            </td>
                            <td className="text-right tabular-nums">{compactNumber(row.reach)}</td>
                            <td className="text-right tabular-nums">{fmtRate(row.engagementRate, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}
            </div>
          )}

          {(view === 'dashboard' || view === 'audience') && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[372fr_262fr_243fr] xl:gap-[14px]">
              <Card className="p-3.5 md:col-span-2 xl:col-span-1 xl:h-[210px] xl:py-3">
                <CardTitle title="Audience Demographics" hint={countries?.note ?? 'From provider audience insights for connected accounts that report demographics.'}>
                  <TextLink href={withParams(searchParams, { view: 'audience' })}>View full report ›</TextLink>
                </CardTitle>
                {!countries?.buckets.length ? <EmptyNote className="mt-3" title="No audience data" description="Instagram, Facebook and YouTube report demographics once connected with insights permission." /> : (
                  <div className="mt-2 grid grid-cols-[112px_1fr_1fr] gap-3">
                    <Donut size={112} stroke={20} parts={countries.buckets.slice(0, 6).map((bucket, index) => ({ value: bucket.value, color: DONUT_BLUES[index] }))}
                      label="Followers by country" center={<><span className="block text-[15px] font-semibold text-slate-900">{compactNumber(totalFollowers)}</span><span className="block text-[8px] text-slate-500">Total Followers</span></>} />
                    <div className="min-w-0 border-r border-slate-100 pr-3">
                      <p className="text-[11px] font-medium text-slate-700 lg:text-[8.5px]">Top Countries</p>
                      <ul className="mt-1.5 space-y-1.5 text-[11px] lg:space-y-[6px] lg:text-[8px]">
                        {countries.buckets.slice(0, 6).map((bucket, index) => (
                          <li key={bucket.bucket} className="flex items-center gap-1.5"><span className="h-[6px] w-[6px] rounded-full" style={{ background: DONUT_BLUES[index] }} aria-hidden /><span className="flex-1 truncate text-slate-600">{countryLabel(bucket.bucket)}</span><span className="tabular-nums text-slate-700">{(bucket.share * 100).toFixed(1)}%</span></li>
                        ))}
                      </ul>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 lg:text-[8.5px]">Age Range</p>
                      <ul className="mt-1.5 space-y-2 text-[11px] lg:space-y-[9px] lg:text-[8px]">
                        {(ages?.buckets ?? []).slice().sort((a, b) => a.bucket.localeCompare(b.bucket)).map(bucket => (
                          <li key={bucket.bucket} className="grid grid-cols-[30px_1fr_30px] items-center gap-1.5">
                            <span className="text-slate-600">{bucket.bucket}</span>
                            <span className="h-[5px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${bucket.share * 100}%` }} /></span>
                            <span className="text-right tabular-nums text-slate-700">{(bucket.share * 100).toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-3.5 xl:h-[210px] xl:py-3">
                <CardTitle title="Engagement Breakdown" hint="Interactions on posts published in the range, from post insights." />
                {!engagement ? <EmptyNote className="mt-3" title="No engagement recorded" /> : (
                  <div className="mt-3 flex items-center gap-3">
                    <Donut size={112} stroke={22} parts={engagement.parts.map(part => ({ value: part.value, color: ENGAGEMENT_COLOURS[part.key] }))} label="Engagement breakdown"
                      center={<><span className="block text-[15px] font-semibold text-slate-900">{compactNumber(engagement.total)}</span><span className="block text-[8px] text-slate-500">Total Engagements</span></>} />
                    <ul className="min-w-0 flex-1 space-y-2 text-[11px] lg:text-[8.5px]">
                      {engagement.parts.map(part => (
                        <li key={part.key} className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full" style={{ background: ENGAGEMENT_COLOURS[part.key] }} aria-hidden /><span className="flex-1 text-slate-600">{part.label}</span><span className="tabular-nums text-slate-800">{(part.share * 100).toFixed(1)}%</span><span className="w-9 text-right tabular-nums text-slate-400">({compactNumber(part.value)})</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              <Card className="p-3.5 xl:h-[210px] xl:py-3">
                <CardTitle title="Outcome Funnel" hint="Each stage as a share of impressions. Conversions need Web & Conversion tracking on the destination site." />
                <ul className="mt-2 space-y-1">
                  {funnel.map((stage, index) => (
                    <li key={stage.label} className="grid grid-cols-[1fr_70px] items-center gap-2 text-[11px] lg:text-[8.5px]">
                      <span className="block bg-blue-100/70 py-[5px] pl-3 text-slate-700" style={{ marginLeft: `${index * 8}px`, marginRight: `${index * 8}px`, clipPath: 'polygon(0 0, 100% 0, 96% 100%, 4% 100%)' }}>{stage.label}</span>
                      <span className="text-right tabular-nums text-slate-800">{compactNumber(stage.value)}{index > 0 && current.impressions ? <span className="text-slate-400"> ({((stage.value / current.impressions) * 100).toFixed(1)}%)</span> : null}</span>
                    </li>
                  ))}
                  <li className="grid grid-cols-[1fr_70px] items-center gap-2 text-[11px] lg:text-[8.5px]">
                    <span className="block bg-slate-100 py-[5px] pl-3 text-slate-500" style={{ marginLeft: '32px', marginRight: '32px', clipPath: 'polygon(0 0, 100% 0, 96% 100%, 4% 100%)' }}>Conversions</span>
                    <span className="text-right text-slate-400" title="Not tracked for social yet">Not tracked</span>
                  </li>
                </ul>
                <p className="mt-2 flex justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] lg:text-[8.5px]"><span className="text-slate-600">Click-through Rate</span><span className="font-semibold text-blue-600">{current.impressions ? `${((current.linkClicks / current.impressions) * 100).toFixed(2)}%` : '—'}</span></p>
              </Card>
            </div>
          )}
        </div>

        {/* Right rail */}
        <Card className="h-fit p-3.5 xl:py-3">
          <div role="tablist" aria-label="Analytics side panel" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-50 p-0.5">
            {(['insights', 'reports'] as const).map(value => (
              <Link key={value} role="tab" aria-selected={rail === value} scroll={false} href={withParams(searchParams, { rail: value === 'insights' ? null : value })}
                className={cn('flex h-9 items-center justify-center rounded-md text-[13px] font-medium capitalize lg:h-[26px] lg:text-[10.5px]', rail === value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>{value}</Link>
            ))}
          </div>

          {rail === 'insights' ? (
            <>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-slate-700 lg:text-[9.5px]"><Sparkles size={13} className="text-blue-600" aria-hidden /> Insights <Hint label="Rule-based observations from your data. Each shows the rule that produced it." /></p>
              {insights.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">Not enough change in this period to highlight.</p> : (
                <ul className="mt-2 space-y-2.5">
                  {insights.map(insight => (
                    <li key={insight.id} className="rounded-lg border border-slate-100 p-3">
                      <p className="flex items-start gap-2 text-[12.5px] font-semibold text-slate-800 lg:text-[10px]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white lg:h-[18px] lg:w-[18px]" aria-hidden><TrendingUp size={10} /></span>{insight.title}</p>
                      <p className="mt-1 pl-8 text-[12px] text-slate-500 lg:pl-[26px] lg:text-[9px]">{insight.detail}</p>
                      <p className="mt-1 pl-8 text-[11px] italic text-slate-400 lg:pl-[26px] lg:text-[8px]">{insight.method}</p>
                      <Link href={insight.href} className="mt-1.5 inline-block pl-8 text-[12px] font-medium text-blue-600 hover:underline lg:pl-[26px] lg:text-[9px]">View details</Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          <div className="mt-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 lg:text-[9.5px]"><FileText size={13} className="text-blue-600" aria-hidden /> Report Shortcuts</p>
            {canCreateReport && <TextLink href={withParams(searchParams, { report: 'new' })}>New</TextLink>}
          </div>
          {reports.presets.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">No saved reports yet.</p> : (
            <ul className="mt-2 space-y-1.5">
              {reports.presets.slice(0, rail === 'reports' ? 20 : 4).map(preset => {
                const schedule = reports.scheduled.find(item => item.preset_id === preset.id)
                const presetDays = Number((preset.config as { days?: number }).days ?? 7)
                return (
                  <li key={preset.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                    <FileText size={15} className="shrink-0 text-blue-600" aria-hidden />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[12px] font-medium text-slate-800 lg:text-[9px]">{preset.name}</span>
                      <span className="block truncate text-[11px] text-slate-400 lg:text-[8px]">
                        {schedule ? `${schedule.is_active ? 'Scheduled' : 'Paused'} · ${scheduleLabel(schedule)}` : 'On demand'}
                      </span>
                    </span>
                    <Kebab label={`${preset.name} options`}>
                      <Link href={withParams(searchParams, { days: presetDays === 7 ? null : String(presetDays) })}>Open in dashboard</Link>
                      {canExport && <a href={`/api/social/export?${new URLSearchParams({ dataset: 'analytics', format: 'pdf', days: String(presetDays) })}`} download>Download PDF</a>}
                      {schedule && <ScheduleToggle scheduleId={schedule.id} active={schedule.is_active} allowed={canSchedule} />}
                    </Kebab>
                    <ChevronRight size={13} className="text-slate-300" aria-hidden />
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 lg:text-[9.5px]"><Database size={13} className="text-blue-600" aria-hidden /> Data Sources</p>
            <TextLink href={`${base}/connections`}>View all</TextLink>
          </div>
          <div className="mt-2 rounded-lg border border-slate-100 px-2.5 py-2 text-[11px] lg:text-[9px]">
            <p className="text-slate-500">Attribution Model</p>
            <p className="font-medium text-slate-800">Last Touch</p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 lg:text-[8.5px]">
            Data is aggregated from {sources.length} connected source{sources.length === 1 ? '' : 's'}.
            {incompleteSources > 0 && ` ${incompleteSources} have not synced past the end of this range, so recent days may be incomplete.`}
          </p>
          {sources[0] && <p className="mt-1 text-[11px] text-slate-400 lg:text-[8px]">Last sync <Ago iso={sources.map(source => source.lastSyncAt).filter(Boolean).sort().at(-1) ?? null} /> ago</p>}
          <Link href={`${base}/connections`} className="mt-1 inline-block text-[11px] font-medium text-blue-600 hover:underline lg:text-[8.5px]">Learn more about data sources</Link>
        </Card>
      </div>

      <CreateReportDialog defaultDays={days} canSchedule={canSchedule} />
    </>
  )
}

function scheduleLabel(schedule: { frequency: string; day_of_week: number | null; day_of_month: number | null }) {
  if (schedule.frequency === 'weekly' && schedule.day_of_week !== null) return `Every ${WEEKDAYS[schedule.day_of_week]}`
  if (schedule.frequency === 'monthly' && schedule.day_of_month !== null) return `Day ${schedule.day_of_month} of every month`
  return FREQUENCY[schedule.frequency] ?? schedule.frequency
}

function countryLabel(code: string) {
  if (code.length !== 2) return code
  try { return COUNTRY.of(code) ?? code } catch { return code }
}

function rollWeekly<T extends { date: string; reach: number; impressions: number; engagements: number; engagementRate: number | null }>(points: T[]) {
  const groups = new Map<string, T[]>()
  for (const point of points) {
    const day = new Date(`${point.date}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
    const key = day.toISOString().slice(0, 10)
    groups.set(key, [...(groups.get(key) ?? []), point])
  }
  return [...groups.entries()].map(([date, items]) => {
    const reach = items.reduce((sum, item) => sum + item.reach, 0)
    const engagements = items.reduce((sum, item) => sum + item.engagements, 0)
    return { date, reach, impressions: items.reduce((sum, item) => sum + item.impressions, 0), engagements, engagementRate: reach ? engagements / reach : null }
  })
}

function dailyFollowers(daily: { date: string; follower_change: number | null }[], dates: string[]) {
  return dates.map(date => daily.filter(row => row.date === date).reduce((sum, row) => sum + (row.follower_change ?? 0), 0))
}

function Thumb({ src, size = 20 }: { src: string | null; size?: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded bg-slate-100" style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed post thumbnail */}
      {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </span>
  )
}

function SortHeader({ label, value, sort, searchParams, align, active }: {
  label: string; value: string; sort: string; searchParams: SocialPageProps['searchParams']; align?: 'right'; active?: boolean
}) {
  const on = active ?? sort === value
  return (
    <th scope="col" className={cn(align === 'right' && 'text-right')} aria-sort={on ? (sort === 'rate_asc' ? 'ascending' : 'descending') : 'none'}>
      <Link href={withParams(searchParams, { sort: value === 'recent' ? null : value })} scroll={false} className={cn('hover:text-slate-800', on && 'font-semibold text-slate-800')}>{label}{on ? (sort === 'rate_asc' ? ' ↑' : ' ↓') : ''}</Link>
    </th>
  )
}

function Donut({ parts, size, stroke, label, center }: { parts: { value: number; color: string }[]; size: number; stroke: number; label: string; center?: ReactNode }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${parts.map(part => part.value).join(', ')}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        {total > 0 && parts.map((part, index) => {
          const length = (part.value / total) * circumference
          const arc = <circle key={index} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={part.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`} strokeDashoffset={-offset} />
          offset += length
          return arc
        })}
      </svg>
      {center && <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</span>}
    </span>
  )
}
