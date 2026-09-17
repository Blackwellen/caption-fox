import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, BarChart3, CalendarClock, ChartNoAxesColumnIncreasing, ChevronRight, Eye, FileCheck2, Heart,
  MousePointer2, Percent, Plus, PlugZap, Settings2, TrendingDown, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getChannelBreakdown, getChannels, getEngagementFeed, getPeriodTotals, getRecentPublishedPosts, getUpcomingPosts,
} from '@/lib/social/queries'
import { getOverviewAlerts, type OverviewAlert } from '@/lib/social/overview'
import { getComposerData } from '@/lib/social/composer'
import {
  changePct, compactNumber, formatRangeLabel, performanceTier, PERFORMANCE_TIER_RULE, previousRange, rangeFromDays, shortDay, toWeekly,
} from '@/lib/social/metrics'
import { PERMISSIONS } from '@/lib/permissions'
import { canAccessSocialCapability } from '@/lib/social/entitlements'
import { parseDays, parseEnum, parseId, first, withParams } from '@/lib/social/url-state'
import { PROVIDER_COLOURS, type SocialProvider } from '@/types/social'
import type { SocialPageProps } from '../SocialRoute'
import { SocialHeader } from '../Header'
import { ComposerDialog } from '../ComposerDialog'
import {
  Ago, Avatar, Badge, Card, CardTitle, Delta, EmptyNote, fmtCount, fmtDateTime, fmtRate, HEALTH, LineChart, Legend,
  PROVIDER_NAMES, ProviderIcon, StackedBars, TextLink, type Tone,
} from '../kit'
import {
  DateRangeSelect, ExportMenu, FieldSelect, FilterPopover, Kebab, Menu, ParamTabs, PillSelect, PrimarySplit,
} from '../controls'
import Sparkline from '@/components/advertising/Sparkline'

// /{type}/social — Social Overview, built to design reference (1).
// Header · six KPI cards · channel cards · Content Performance | Social
// Performance Trend | Engagement Feed · Recent Posts | Upcoming Posts |
// Activity & Alerts. Every figure is a live aggregate for the selected range.

const METRICS = ['reach', 'impressions', 'engagements', 'rate'] as const
const FEED_FILTERS = ['all', 'comment', 'dm', 'mention'] as const
const PLATFORM_ORDER: SocialProvider[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'x', 'pinterest', 'threads']

const TYPE_LABEL: Record<string, string> = { reel: 'Reel', short: 'Video', story: 'Story', carousel: 'Carousel', thread: 'Text', pin: 'Pin', post: 'Image' }
const TIER: Record<string, { label: string; tone: Tone }> = {
  top: { label: 'Top Performer', tone: 'green' }, good: { label: 'Good', tone: 'blue' }, average: { label: 'Average', tone: 'orange' }, low: { label: 'Low', tone: 'red' },
}

export default async function OverviewPage({ session, searchParams, nav }: SocialPageProps) {
  const days = parseDays(searchParams.days)
  const range = rangeFromDays(days)
  const prev = previousRange(range)
  const metric = parseEnum(searchParams.metric, METRICS, 'reach')
  const grain = parseEnum(searchParams.grain, ['daily', 'weekly'] as const, 'daily')
  const feedFilter = parseEnum(searchParams.feed, FEED_FILTERS, 'all')
  const feedChannel = parseId(searchParams.feedChannel)
  const recentPlatform = first(searchParams.recent) && PLATFORM_ORDER.includes(first(searchParams.recent) as SocialProvider) ? first(searchParams.recent) as SocialProvider : null

  const channels = await getChannels(session)
  const channelFilter = parseId(searchParams.channel)
  const scoped = channels.find(channel => channel.id === channelFilter) ?? null
  const scope = scoped ? { channelId: scoped.id, platform: scoped.platform } : {}

  const canCreate = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_PUBLISHING_CREATE).allowed && session.surfaces.includes('publishing')
  const canExport = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_ANALYTICS_EXPORT).allowed
  const engagementOpen = session.surfaces.includes('engagement')

  const [totals, breakdown, feed, recent, upcoming, composer] = await Promise.all([
    getPeriodTotals(session, range, scope),
    getChannelBreakdown(session, range, channels),
    engagementOpen ? getEngagementFeed(session, feedFilter, feedChannel ?? undefined, 5) : Promise.resolve([]),
    getRecentPublishedPosts(session, 5, recentPlatform),
    getUpcomingPosts(session, 5, ['scheduled', 'queued', 'approved']),
    canCreate && first(searchParams.compose) ? getComposerData(session, parseId(searchParams.compose)) : Promise.resolve(null),
  ])
  const alerts = await getOverviewAlerts(session, range, { meanRate: totals.current.engagementRate, followerChange: totals.current.followerChange })

  const compareLabel = formatRangeLabel(prev).replace(/, \d{4}$/, '')
  const pct = (current: number, previous: number) => changePct(current, previous || null)
  const kpis: { key: string; label: string; value: string; delta: number | null; unit: '%' | 'pp'; icon: ReactNode; source: string }[] = [
    { key: 'reach', label: 'Total Reach', value: fmtCount(totals.current.reach), delta: pct(totals.current.reach, totals.previous.reach), unit: '%', icon: <ChartNoAxesColumnIncreasing size={17} />, source: 'Sum of daily reach reported by each connected channel. Reach is not de-duplicated across platforms.' },
    { key: 'engagements', label: 'Engagements', value: fmtCount(totals.current.engagements), delta: pct(totals.current.engagements, totals.previous.engagements), unit: '%', icon: <Heart size={17} />, source: 'Likes, comments, shares and saves from channel insights.' },
    { key: 'rate', label: 'Engagement Rate', value: fmtRate(totals.current.engagementRate), delta: totals.current.engagementRate !== null && totals.previous.engagementRate !== null ? (totals.current.engagementRate - totals.previous.engagementRate) * 100 : null, unit: 'pp', icon: <Percent size={17} />, source: 'Engagements ÷ reach across connected channels (impressions where reach is not reported).' },
    { key: 'impressions', label: 'Impressions', value: fmtCount(totals.current.impressions), delta: pct(totals.current.impressions, totals.previous.impressions), unit: '%', icon: <Eye size={17} />, source: 'Total impressions from channel insights.' },
    { key: 'clicks', label: 'Profile Clicks', value: fmtCount(totals.current.profileClicks), delta: pct(totals.current.profileClicks, totals.previous.profileClicks), unit: '%', icon: <MousePointer2 size={17} />, source: 'Profile visits attributed to published posts in the period.' },
    { key: 'followers', label: 'New Followers', value: fmtCount(totals.current.followerChange), delta: pct(totals.current.followerChange, totals.previous.followerChange), unit: '%', icon: <Users size={17} />, source: 'Net new followers (follows minus unfollows) reported per day.' },
  ]

  // Content Performance: daily (or weekly) stacks per platform for the chosen metric.
  const days7 = totals.series.map(point => point.date)
  const platformOf = new Map(channels.map(channel => [channel.id, channel.platform]))
  const platforms = PLATFORM_ORDER.filter(platform => channels.some(channel => channel.platform === platform))
  const field = metric === 'impressions' ? 'total_impressions' : metric === 'engagements' ? 'total_engagement' : 'total_reach'
  const stackValues = platforms.map(platform => days7.map(date => totals.daily
    .filter(row => row.date === date && platformOf.get(row.channel_id) === platform)
    .reduce((total, row) => total + (row[field] ?? 0), 0)))
  let chartLabels = days7.map(shortDay)
  let stacks = platforms.map((platform, index) => ({ key: platform, label: PROVIDER_NAMES[platform], color: PROVIDER_COLOURS[platform], values: stackValues[index] }))
  if (grain === 'weekly') {
    const weekly = toWeekly(days7.map((date, dayIndex) => ({ date, values: stacks.map(stack => stack.values[dayIndex]) })), items => ({ values: stacks.map((_, s) => items.reduce((total, item) => total + item.values[s], 0)) }))
    chartLabels = weekly.map(week => `w/c ${shortDay(week.date)}`)
    stacks = stacks.map((stack, s) => ({ ...stack, values: weekly.map(week => week.values[s]) }))
  }
  const rateSeries = platforms.map(platform => ({
    key: platform, label: PROVIDER_NAMES[platform], color: PROVIDER_COLOURS[platform],
    values: days7.map(date => {
      const rows = totals.daily.filter(row => row.date === date && platformOf.get(row.channel_id) === platform)
      const reach = rows.reduce((total, row) => total + (row.total_reach ?? 0), 0)
      return reach ? rows.reduce((total, row) => total + (row.total_engagement ?? 0), 0) / reach : null
    }),
  }))

  const trend = totals.series
  const recentTiered = recent.map(row => ({ ...row, tier: performanceTier(row.engagementRate, totals.current.engagementRate) }))
  // One card per platform: the account with the most reach represents it; the
  // others stay reachable from Connections and the channel filter.
  const cardChannels = PLATFORM_ORDER
    .map(platform => breakdown.filter(row => row.channel.platform === platform).sort((a, b) => b.reach - a.reach)[0])
    .filter((row): row is (typeof breakdown)[number] => Boolean(row))
    .slice(0, 6)
  const channelOptions = channels.map(channel => ({ value: channel.id, label: `${PROVIDER_NAMES[channel.platform]} · ${channel.handle ?? channel.account_name}` }))
  const base = session.basePath

  return (
    <>
      <SocialHeader
        title="Social Overview"
        subtitle="Monitor organic performance across channels, engage with your audience, and take action."
        nav={nav}
        actions={(
          <>
            <DateRangeSelect label={formatRangeLabel(range)} />
            <FilterPopover activeCount={scoped ? 1 : 0} clearKeys={['channel']}>
              <FieldSelect paramKey="channel" label="Channel" allLabel="All channels" options={channelOptions} />
            </FilterPopover>
            <Menu label="More actions" width="w-56" trigger={<>More <ChevronRight size={14} className="rotate-90 text-slate-400" aria-hidden /></>}>
              <Link href={`${base}/analytics`}>Open full analytics</Link>
              {session.surfaces.includes('publishing') && <Link href={`${base}/publishing`}>Publishing calendar</Link>}
              {engagementOpen && <Link href={`${base}/engagement`}>Engagement inbox</Link>}
              <Link href={`${base}/connections`}>Manage connections</Link>
            </Menu>
            <ExportMenu dataset="analytics" disabledReason={canExport ? null : 'Your role cannot export analytics.'} />
            <PrimarySplit
              href="?compose=1" label="Create Post" icon={<Plus size={15} aria-hidden />} menuLabel="More create options"
              disabledReason={canCreate ? (channels.length ? null : 'Connect a channel before creating posts.') : 'Your role or plan does not include publishing.'}
            >
              <Link href={`${base}/publishing?compose=1`}>Schedule in calendar</Link>
              <Link href={`/${session.kind}/studio`}>Open Studio</Link>
              <Link href={`/${session.kind}/campaigns`}>Create from a campaign</Link>
            </PrimarySplit>
          </>
        )}
      />

      {channels.length === 0 && (
        <EmptyNote
          className="mb-4"
          title="Connect a channel to see real performance"
          description="Overview fills from your connected social accounts — reach, engagement and content performance all come from synced data."
          action={<Link href={`${base}/connections?connect=1`} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-semibold text-white">Connect a channel</Link>}
        />
      )}
      {scoped && (
        <p className="mb-3 text-[12px] text-slate-500 lg:text-[10.5px]" role="status">
          Showing <strong className="font-semibold text-slate-700">{scoped.handle ?? scoped.account_name}</strong> only. Post-level figures (profile clicks) cover all {PROVIDER_NAMES[scoped.platform]} accounts.
        </p>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.key} className="relative flex h-full items-center gap-3 px-3.5 py-3 xl:h-[82px] xl:py-0" title={kpi.source}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 xl:h-[31px] xl:w-[31px]" aria-hidden>{kpi.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-slate-700 lg:text-[10px]">{kpi.label}</p>
              <p className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-[20px] font-semibold leading-none tracking-[-0.01em] text-slate-900 tabular-nums lg:text-[19.5px]">{kpi.value}</span>
                <Delta value={kpi.delta} unit={kpi.unit} digits={kpi.unit === 'pp' ? 1 : 1} />
              </p>
              <p className="mt-1 truncate text-[11px] text-slate-500 lg:text-[9px]">vs {compareLabel}</p>
            </div>
            <div className="absolute right-2 top-2.5">
              <Kebab label={`${kpi.label} options`}>
                <Link href={`${base}/analytics?metric=${kpi.key}`}>View in Analytics</Link>
                <p className="px-2.5 py-1.5 text-[11.5px] leading-snug text-slate-500">{kpi.source}</p>
              </Kebab>
            </div>
          </Card>
        ))}
      </div>

      {/* Channel cards */}
      {cardChannels.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4" role="region" aria-label="Channel performance" tabIndex={0}>
          {cardChannels.map(row => {
            const channel = row.channel
            const isViews = channel.platform === 'youtube'
            const health = channel.health === 'warning' ? HEALTH.watch : channel.health !== 'healthy' ? HEALTH[channel.health] : (row.reachChangePct ?? 0) < 0 ? HEALTH.watch : HEALTH.healthy
            const down = (row.reachChangePct ?? 0) < 0
            return (
              <Card key={channel.id} className="min-w-0 px-3.5 pb-2.5 pt-3 xl:h-[159px]">
                <div className="flex items-start gap-2">
                  <ProviderIcon provider={channel.platform} size={24} />
                  <Link href={`${base}/connections/${channel.id}`} className="min-w-0 flex-1 rounded hover:underline">
                    <p className="truncate text-[12.5px] font-semibold text-slate-900 lg:text-[10.5px]">{PROVIDER_NAMES[channel.platform]}</p>
                    <p className="truncate text-[11px] text-slate-500 lg:text-[9px]">{channel.handle ?? channel.account_name}</p>
                  </Link>
                  <Kebab label={`${PROVIDER_NAMES[channel.platform]} options`}>
                    <Link href={`${base}/analytics?channel=${channel.id}`}>View analytics</Link>
                    <Link href={`?channel=${channel.id}`}>Filter overview</Link>
                    <Link href={`${base}/connections/${channel.id}`}>Connection details</Link>
                  </Kebab>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11.5px] lg:mt-3.5 lg:text-[9.5px]">
                  <span className="font-medium text-slate-700">{isViews ? 'Views' : 'Reach'}</span>
                  <span className={cn('font-semibold', health.text)}>{health.label}</span>
                </div>
                <dl className="mt-2 space-y-1.5 text-[11px] lg:mt-2.5 lg:space-y-2 lg:text-[9px]">
                  <div className="grid grid-cols-[1fr_auto_3.2rem] items-baseline gap-1">
                    <dt className="text-slate-500">{isViews ? 'Views' : 'Reach'}</dt>
                    <dd className="text-right text-[12.5px] font-semibold text-slate-900 tabular-nums lg:text-[11px]">{row.noData ? '—' : compactNumber(row.reach)}</dd>
                    <dd className="text-right"><Delta value={row.reachChangePct} /></dd>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_3.2rem] items-baseline gap-1">
                    <dt className="text-slate-500">Eng. Rate</dt>
                    <dd className="text-right text-[12.5px] font-semibold text-slate-900 tabular-nums lg:text-[11px]">{fmtRate(row.engagementRate)}</dd>
                    <dd className="text-right"><Delta value={row.rateChangePp} unit="pp" /></dd>
                  </div>
                </dl>
                <div className="mt-2 h-[22px] lg:mt-3">
                  <Sparkline points={row.series} color={down ? '#EF4444' : '#3B6FF5'} height={22} strokeWidth={1.4} fill summary={`${PROVIDER_NAMES[channel.platform]} daily ${isViews ? 'views' : 'reach'}`} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Lower grid: 454 / 358 / 45 / 318 columns at the reference width */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[454fr_358fr_45fr_318fr] xl:grid-rows-[283px_68px_190px] xl:gap-x-[14px] xl:gap-y-[15px]">
        <Card className="flex flex-col p-4 xl:col-start-1 xl:row-start-1 xl:px-4 xl:pb-3 xl:pt-3.5">
          <CardTitle title="Content Performance" hint="Daily totals per platform from channel insights. Reach is platform-reported and not de-duplicated across platforms." />
          <div className="mt-3 flex items-center justify-between gap-2">
            <ParamTabs paramKey="metric" defaultValue="reach" ariaLabel="Content performance metric" variant="soft" options={[
              { value: 'reach', label: 'Reach' }, { value: 'impressions', label: 'Impressions' }, { value: 'engagements', label: 'Engagements' }, { value: 'rate', label: 'Eng. Rate' },
            ]} />
            <PillSelect compact paramKey="grain" label="Granularity" defaultValue="daily" options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} className="min-w-[62px]" />
          </div>
          <div className="mt-3 min-h-0 flex-1">
            {metric === 'rate'
              ? <LineChart labels={days7.map(shortDay)} series={rateSeries} height={140} leftFormat={value => `${(value * 100).toFixed(1)}%`} summary="Engagement rate per platform per day" />
              : <StackedBars labels={chartLabels} stacks={stacks} height={128} summary={`${metric} per platform per ${grain === 'weekly' ? 'week' : 'day'}`} />}
          </div>
          <Legend className="mt-2 justify-center" items={platforms.map(platform => ({ label: PROVIDER_NAMES[platform], color: PROVIDER_COLOURS[platform] }))} />
        </Card>

        <Card className="flex flex-col p-4 xl:col-span-2 xl:col-start-2 xl:row-start-1 xl:px-4 xl:pb-3 xl:pt-3.5">
          <CardTitle title="Social Performance Trend" hint="The axis is reach; impressions, engagements and rate are drawn on their own scales so trends can be compared. Hover a point for its exact value.">
            <PillSelect compact paramKey="days" label="Trend range" defaultValue="7" options={[{ value: '7', label: 'Last 7 Days' }, { value: '14', label: 'Last 14 Days' }, { value: '30', label: 'Last 30 Days' }]} className="min-w-[84px]" />
          </CardTitle>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            {[
              { key: 'reach', label: 'Reach', color: '#3B6FF5', value: fmtCount(totals.current.reach), delta: pct(totals.current.reach, totals.previous.reach), unit: '%' as const },
              { key: 'impressions', label: 'Impressions', color: '#A78BFA', value: fmtCount(totals.current.impressions), delta: pct(totals.current.impressions, totals.previous.impressions), unit: '%' as const },
              { key: 'engagements', label: 'Engagements', color: '#22C55E', value: fmtCount(totals.current.engagements), delta: pct(totals.current.engagements, totals.previous.engagements), unit: '%' as const },
              { key: 'rate', label: 'Eng. Rate', color: '#F59E0B', value: fmtRate(totals.current.engagementRate), delta: kpis[2].delta, unit: 'pp' as const },
            ].map(item => (
              <li key={item.key}>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600 lg:text-[9.5px]"><span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: item.color }} aria-hidden />{item.label}</p>
                <p className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap"><span className="text-[13px] font-semibold text-slate-900 tabular-nums lg:text-[11.5px]">{item.value}</span><Delta value={item.delta} unit={item.unit} /></p>
              </li>
            ))}
          </ul>
          <div className="mt-3 min-h-0 flex-1">
            <LineChart
              labels={trend.map(point => shortDay(point.date))}
              height={124}
              series={[
                { key: 'reach', label: 'Reach', color: '#3B6FF5', values: trend.map(point => point.reach), format: compactNumber },
                { key: 'impressions', label: 'Impressions', color: '#A78BFA', values: trend.map(point => point.impressions), band: [0.44, 0.6], format: compactNumber },
                { key: 'engagements', label: 'Engagements', color: '#22C55E', values: trend.map(point => point.engagements), band: [0.24, 0.38], format: compactNumber },
                { key: 'rate', label: 'Eng. Rate', color: '#F59E0B', values: trend.map(point => point.engagementRate), band: [0.04, 0.18], format: value => `${(value * 100).toFixed(2)}%` },
              ]}
              summary="Daily reach, impressions, engagements and engagement rate. Each line uses its own scale so the trends can be compared; hover a point for its value."
            />
          </div>
        </Card>

        <Card className="flex flex-col p-4 xl:col-start-4 xl:row-span-2 xl:row-start-1 xl:px-3.5 xl:pb-2.5 xl:pt-3.5">
          <CardTitle title="Engagement Feed" className="[&_h2]:shrink-0 [&_h2]:overflow-visible">
            <ParamTabs paramKey="feed" defaultValue="all" ariaLabel="Engagement feed filter" variant="underline" className="gap-0 [&_button]:h-7 [&_button]:px-1.5 lg:[&_button]:h-5 lg:[&_button]:px-1 lg:[&_button]:text-[8.5px]" options={[
              { value: 'all', label: 'All' }, { value: 'comment', label: 'Comments' }, { value: 'dm', label: 'DMs' }, { value: 'mention', label: 'Mentions' },
            ]} />
          </CardTitle>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <PillSelect compact paramKey="feedChannel" label="Feed channel" allLabel="All Channels" options={channelOptions} icon={<ProviderIcon provider={scoped?.platform ?? 'instagram'} size={11} decorative />} className="min-w-[116px]" />
            <Link href={engagementOpen ? `${base}/engagement` : `${base}/connections`} aria-label="Engagement settings" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 lg:h-[22px] lg:w-[22px]"><Settings2 size={12} aria-hidden /></Link>
          </div>
          {!engagementOpen ? (
            <EmptyNote className="mt-3 flex-1" title="Engagement inbox not included" description="Comments, DMs and mentions are part of the engagement inbox on Creator Pro and above." />
          ) : feed.length === 0 ? (
            <EmptyNote className="mt-3 flex-1" title="No conversations yet" description="New comments, DMs and mentions from connected channels appear here." />
          ) : (
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden">
              {feed.map(item => (
                <li key={item.id}>
                  <Link href={`${base}/conversations/${item.id}`} className="flex gap-2 rounded-md py-2.5 hover:bg-slate-50/80 lg:py-[6px]">
                    <ProviderIcon provider={item.platform ?? 'instagram'} size={15} className="mt-2" />
                    <Avatar src={item.sender_avatar} name={item.sender_name} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn('truncate text-[12px] text-slate-900 lg:text-[9.5px]', item.is_read ? 'font-medium' : 'font-semibold')}>{item.sender_handle ?? item.sender_name}</span>
                        <Ago iso={item.created_at} className="text-[10.5px] text-slate-400 lg:text-[8.5px]" />
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 lg:text-[9px]">{item.type === 'dm' ? 'sent you a message' : item.type === 'mention' ? 'mentioned you' : 'commented on your post'}</span>
                      <span className="block truncate text-[11px] text-slate-600 lg:text-[9px]">{item.content}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {engagementOpen && (
            <Link href={`${base}/engagement`} className="mt-1.5 flex h-8 items-center justify-center gap-1 rounded-md bg-slate-50 text-[12px] text-slate-600 hover:bg-slate-100 lg:h-[20px] lg:text-[9px]">View all <ChevronRight size={11} aria-hidden /></Link>
          )}
        </Card>

        <Card className="flex flex-col p-4 xl:col-start-1 xl:row-span-2 xl:row-start-2 xl:px-4 xl:pb-2 xl:pt-3.5">
          <CardTitle title="Recent Posts" hint={PERFORMANCE_TIER_RULE}>
            <TextLink href={`${base}/analytics?view=table`}>View All Posts</TextLink>
          </CardTitle>
          <nav aria-label="Recent posts by platform" className="mt-2.5 flex items-center gap-1 border-b border-slate-100 pl-8">
            {platforms.map(platform => (
              <Link
                key={platform} href={withParams(searchParams, { recent: platform === recentPlatform ? null : platform })}
                scroll={false} aria-current={platform === recentPlatform ? 'true' : undefined} aria-label={PROVIDER_NAMES[platform]}
                className={cn('-mb-px flex h-9 w-12 items-center justify-center border-b-2 lg:h-[26px] lg:w-[40px]', platform === recentPlatform ? 'border-blue-600' : 'border-transparent opacity-80 hover:opacity-100')}
              >
                <ProviderIcon provider={platform} size={15} decorative />
              </Link>
            ))}
          </nav>
          {recentTiered.length === 0 ? (
            <EmptyNote className="mt-3 flex-1" title={recentPlatform ? `No published ${PROVIDER_NAMES[recentPlatform]} posts` : 'No published posts yet'} description="Published posts and their performance appear here once they sync." />
          ) : (
            <div className="relative mt-1 min-h-0 flex-1 overflow-x-auto overflow-y-hidden xl:overflow-x-hidden">
              <table className="w-full min-w-[440px] table-fixed text-left text-[11px] xl:min-w-0 lg:text-[8.5px]">
                <colgroup><col className="w-[31%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[17%]" /></colgroup>
                <thead className="text-slate-500">
                  <tr className="[&>th]:py-1.5 [&>th]:font-medium">
                    <th scope="col">Post</th><th scope="col" className="text-center">Channel</th><th scope="col">Type</th><th scope="col">Published</th>
                    <th scope="col" className="text-right">Reach</th><th scope="col" className="text-right">Eng. Rate</th><th scope="col" className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {recentTiered.map(({ post, reach, engagementRate, tier }) => (
                    <tr key={post.id} className="border-t border-slate-50 [&>td]:py-[5px]">
                      <td className="min-w-0">
                        <Link href={`${base}/posts/${post.id}`} className="flex items-center gap-2 rounded hover:underline">
                          <Thumb src={post.thumbnail_url} />
                          <span className="truncate font-medium text-slate-800">{post.title ?? 'Untitled post'}</span>
                        </Link>
                      </td>
                      <td className="text-center"><ProviderIcon provider={post.platforms?.[0] ?? 'instagram'} size={13} className="mx-auto" /></td>
                      <td>{TYPE_LABEL[post.post_type] ?? post.post_type}</td>
                      <td className="whitespace-nowrap leading-tight text-slate-500">{post.published_at ? <>{fmtDateTime(post.published_at).replace(/ at|,/g, '').replace(/ (\d+:\d+ [AP]M)$/, '')}<br />{fmtDateTime(post.published_at).match(/\d+:\d+ [AP]M/)?.[0]}</> : '—'}</td>
                      <td className="text-right tabular-nums">{reach ? compactNumber(reach) : '—'}</td>
                      <td className="text-right tabular-nums">{fmtRate(engagementRate)}</td>
                      <td className="text-center">{tier ? <Badge tone={TIER[tier].tone}>{TIER[tier].label}</Badge> : <span className="text-slate-400">No data</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-4 xl:col-start-2 xl:row-span-2 xl:row-start-2 xl:px-4 xl:pb-2 xl:pt-3.5">
          <CardTitle title="Upcoming Posts">
            {session.surfaces.includes('publishing') && <TextLink href={`${base}/publishing`}>View Calendar</TextLink>}
          </CardTitle>
          {upcoming.length === 0 ? (
            <EmptyNote className="mt-3 flex-1" title="Nothing scheduled" description="Scheduled posts appear here in the order they will publish." action={canCreate ? <Link href="?compose=1" scroll={false} className="text-[12.5px] font-medium text-blue-600 hover:underline">Schedule a post</Link> : undefined} />
          ) : (
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-slate-100">
              {upcoming.map(post => (
                <li key={post.id} className="flex items-center gap-2.5 py-2 lg:py-[7px]">
                  <span className="w-12 shrink-0 text-[10.5px] leading-tight text-slate-500 lg:text-[8.5px]">
                    {post.scheduled_at ? <>{fmtDateTime(post.scheduled_at).split(' ').slice(0, 2).join(' ')}<br />{fmtDateTime(post.scheduled_at).match(/\d+:\d+ [AP]M/)?.[0]}</> : '—'}
                  </span>
                  <ProviderIcon provider={post.platforms?.[0] ?? 'instagram'} size={14} />
                  <Thumb src={post.thumbnail_url} size={26} />
                  <Link href={`${base}/posts/${post.id}`} className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-800 hover:underline lg:text-[9.5px]">{post.title ?? 'Untitled post'}</Link>
                  <Badge tone={post.status === 'pending_approval' ? 'amber' : 'blue'}>{post.status === 'pending_approval' ? 'Pending' : 'Scheduled'}</Badge>
                  <Kebab label={`${post.title ?? 'Post'} options`}>
                    <Link href={`${base}/posts/${post.id}`}>Open post</Link>
                    {canCreate && <Link href={`?compose=${post.id}`} scroll={false}>Edit or reschedule</Link>}
                  </Kebab>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col p-4 xl:col-span-2 xl:col-start-3 xl:row-start-3 xl:px-3.5 xl:pb-2 xl:pt-3">
          <CardTitle title="Activity & Alerts">
            <TextLink href={`${base}/analytics`}>View All</TextLink>
          </CardTitle>
          {alerts.length === 0 ? (
            <EmptyNote className="mt-2 flex-1" title="All clear" description="Approvals, spikes, failures and milestones appear here as they happen." />
          ) : (
            <ul className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-hidden">
              {[...alerts].sort((a, b) => ALERT_ORDER.indexOf(a.kind) - ALERT_ORDER.indexOf(b.kind)).slice(0, 5).map(alert => <AlertRow key={alert.id} alert={alert} />)}
            </ul>
          )}
        </Card>
      </div>

      {composer && <ComposerDialog data={composer} canApproveOwn={session.can(PERMISSIONS.SOCIAL_PUBLISHING_APPROVE)} brandHref={`/${session.kind}/brand`} />}
    </>
  )
}

function Thumb({ src, size = 22 }: { src: string | null; size?: number }) {
  return (
    <span className="shrink-0 overflow-hidden rounded bg-slate-100" style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed post thumbnail */}
      {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </span>
  )
}

const ALERT_ORDER: OverviewAlert['kind'][] = ['approval', 'spike', 'low_performance', 'reminder', 'milestone', 'failure', 'connection']

const ALERT_STYLE: Record<OverviewAlert['kind'], { icon: ReactNode; tile: string }> = {
  approval: { icon: <FileCheck2 size={13} />, tile: 'bg-amber-50 text-amber-600' },
  spike: { icon: <BarChart3 size={13} />, tile: 'bg-pink-50 text-pink-600' },
  low_performance: { icon: <TrendingDown size={13} />, tile: 'bg-blue-50 text-blue-600' },
  reminder: { icon: <CalendarClock size={13} />, tile: 'bg-indigo-50 text-indigo-600' },
  milestone: { icon: <Users size={13} />, tile: 'bg-emerald-50 text-emerald-600' },
  failure: { icon: <AlertTriangle size={13} />, tile: 'bg-red-50 text-red-600' },
  connection: { icon: <PlugZap size={13} />, tile: 'bg-orange-50 text-orange-600' },
}

function AlertRow({ alert }: { alert: OverviewAlert }) {
  const style = ALERT_STYLE[alert.kind]
  return (
    <li className="flex items-center gap-2.5 py-1.5 lg:py-[5px]">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full lg:h-[24px] lg:w-[24px]', style.tile)} aria-hidden>{style.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-slate-800 lg:text-[9.5px]">{alert.title}</span>
        <span className="block truncate text-[11px] text-slate-500 lg:text-[9px]">{alert.detail}</span>
      </span>
      <Link href={alert.href} className="inline-flex h-8 min-w-[52px] items-center justify-center rounded-md border border-slate-200 px-2.5 text-[11.5px] font-medium text-blue-600 hover:bg-slate-50 lg:h-[21px] lg:min-w-[46px] lg:text-[9px]">{alert.actionLabel}</Link>
      <Ago iso={alert.at} className="w-7 text-right text-[10.5px] text-slate-400 lg:text-[8.5px]" />
    </li>
  )
}
