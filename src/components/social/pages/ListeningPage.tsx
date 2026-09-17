import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, AtSign, BarChart3, BellRing, CalendarDays, ChevronLeft, ChevronRight, Hash, Heart, Percent, PieChart, Plus, SlidersHorizontal, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getListeningSources, getListeningTotals, getMentions, getMentionsByCountry, getSentimentSeries, getShareOfVoice, type MentionRow,
} from '@/lib/social/queries'
import { getListeningAggregates } from '@/lib/social/listening-queries'
import { canAccessSocialCapability } from '@/lib/social/entitlements'
import { changePct, compactNumber, formatRangeLabel, previousRange, rangeFromDays, shortDay } from '@/lib/social/metrics'
import { first, parseDays, parseEnum, parsePage, parseSearch, withParams } from '@/lib/social/url-state'
import { WORLD_COLS, WORLD_DOTS, WORLD_ROWS } from '@/components/brand-assets/ui/world-dots'
import Sparkline from '@/components/advertising/Sparkline'
import type { SocialPageProps } from '../SocialRoute'
import { SocialHeader } from '../Header'
import { Ago, Avatar, Badge, Card, CardTitle, Delta, EmptyNote, Hint, LineChart, PROVIDER_NAMES, ProviderIcon, SENTIMENT, TextLink } from '../kit'
import { ExportMenu, FieldSelect, FilterPopover, Kebab, Menu, ParamTabs, PillSelect, SearchBox } from '../controls'
import { CreateAlertDialog, ResolveAlertButton, StarButton } from '../listening/ListeningClient'

// /{type}/social/listening — Social Listening, built to design reference (4).
// Six summary cards · view tabs · Mentions Stream | Sentiment Over Time +
// Sentiment Breakdown | Trending Conversations · Top Keywords | Sources |
// Mentions by Region | Listening Alerts | High Priority Mentions.

const TABS = ['stream', 'table', 'trends', 'topics', 'influencers', 'geography'] as const
const STREAM_TABS = ['all', 'unread', 'favourites', 'high_priority'] as const
const SENT_COLOURS = { positive: '#22C55E', neutral: '#94A3B8', negative: '#EF4444' }
const SOURCE_ICON = new Set(['instagram', 'x', 'tiktok', 'linkedin', 'youtube', 'facebook', 'reddit'])
const COUNTRY = new Intl.DisplayNames(['en-GB'], { type: 'region' })
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const DOTS = WORLD_DOTS.split(';').map(dot => { const [c, r, iso] = dot.split(','); return { c: Number(c), r: Number(r), iso } })

const countryName = (code: string) => {
  if (code === 'UNKNOWN') return 'Unknown'
  try { return COUNTRY.of(code) ?? code } catch { return code }
}

export default async function ListeningPage({ session, searchParams, nav }: SocialPageProps) {
  const base = session.basePath
  const days = parseDays(searchParams.days)
  const range = rangeFromDays(days)
  const prev = previousRange(range)
  const tab = parseEnum(searchParams.tab, TABS, 'stream')
  const streamTab = parseEnum(searchParams.mentions, STREAM_TABS, 'all')
  const source = first(searchParams.source)
  const sentiment = parseEnum(searchParams.sentiment, ['', 'positive', 'neutral', 'negative'] as const, '') || null
  const search = parseSearch(searchParams.q)
  const page = parsePage(searchParams.page)
  const priorityScope = parseEnum(searchParams.priority, ['all', 'negative', 'influencer'] as const, 'all')
  const pageSize = tab === 'table' ? 15 : 5

  const canAlert = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_LISTENING_CREATE_ALERT).allowed
  const canExport = session.can(PERMISSIONS.SOCIAL_LISTENING_EXPORT)
  const brandLabel = 'captionfox'

  const [totals, stream, series, sources, countries, sov, aggregates, highPriority] = await Promise.all([
    getListeningTotals(session, range),
    getMentions(session, range, { tab: streamTab, source: source ?? undefined, sentiment: sentiment ?? undefined, search: search ?? undefined, page, pageSize }),
    getSentimentSeries(session, range),
    getListeningSources(session),
    getMentionsByCountry(session, range),
    getShareOfVoice(session, range, brandLabel),
    getListeningAggregates(session, range),
    getMentions(session, range, { tab: 'high_priority', sentiment: priorityScope === 'negative' ? 'negative' : undefined, pageSize: 12 }),
  ])

  const pages = Math.max(1, Math.ceil(stream.total / pageSize))
  const topics = totals.topics
  const sourceRows = (sources as { id: string; source_key: string; label: string; mention_count: number; share_pct: number | null }[])
  const maxSource = Math.max(1, ...sourceRows.map(row => row.mention_count))
  const priorityRows = (priorityScope === 'influencer' ? highPriority.rows.filter(row => row.is_influencer) : highPriority.rows).slice(0, 3)
  const topicChips = aggregates.hashtags.length >= 3 ? aggregates.hashtags.slice(0, 3).map(row => row.tag) : topics.slice(0, 3).map(topic => `#${topic.label.replace(/[^\p{L}\p{N}]+/gu, '')}`)
  const brandShare = sov.rows.find(row => row.label === brandLabel)?.share ?? null
  const countryCounts = new Map(countries.buckets.map(bucket => [bucket.code, bucket.count]))
  const maxCountry = Math.max(1, ...countries.buckets.filter(bucket => bucket.code !== 'UNKNOWN').map(bucket => bucket.count))
  const sourceOptions = ['instagram', 'x', 'tiktok', 'linkedin', 'youtube', 'facebook', 'reddit', 'blogs'].map(value => ({ value, label: PROVIDER_NAMES[value] ?? value }))
  const compare = `vs ${MONTH_DAY.format(prev.from)} – ${MONTH_DAY.format(prev.to)}`
  const alertTotals = aggregates.alertCounts

  const kpi = (icon: ReactNode, title: string, children: ReactNode, menu?: ReactNode) => (
    <Card className="relative flex flex-col p-3.5 xl:h-[132px] xl:px-4 xl:py-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 xl:h-[30px] xl:w-[30px]" aria-hidden>{icon}</span>
        <p className="min-w-0 flex-1 pt-1 text-[12px] font-medium text-slate-700 lg:text-[9.5px]">{title}</p>
        {menu && <Kebab label={`${title} options`}>{menu}</Kebab>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  )

  return (
    <>
      <SocialHeader
        title="Social Listening"
        subtitle="Monitor conversations, keywords, and trends to understand what people are saying about your brand."
        nav={nav}
        compact
        actions={(
          <>
            <PillSelect paramKey="days" label={`Date range, currently ${formatRangeLabel(range)}`} defaultValue="7" icon={<CalendarDays size={14} className="text-slate-500" aria-hidden />}
              options={[{ value: '7', label: formatRangeLabel(range) }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} className="min-w-[150px]" />
            <FilterPopover activeCount={[search, source, sentiment].filter(Boolean).length} clearKeys={['q', 'source', 'sentiment', 'page']}>
              <SearchBox placeholder="Search mentions" />
              <FieldSelect paramKey="source" label="Source" allLabel="All sources" options={sourceOptions} />
              <FieldSelect paramKey="sentiment" label="Sentiment" allLabel="All sentiment" options={[{ value: 'positive', label: 'Positive' }, { value: 'neutral', label: 'Neutral' }, { value: 'negative', label: 'Negative' }]} />
            </FilterPopover>
            <Menu label="Tracked keywords" width="w-56" trigger={<>Keywords ({aggregates.keywords.length})<ChevronRight size={13} className="rotate-90 text-slate-400" aria-hidden /></>}>
              {aggregates.keywords.slice(0, 12).map(row => (
                <Link key={row.keyword} href={withParams(searchParams, { q: row.keyword, page: null })}>{row.keyword}<span className="ml-auto text-slate-400">{row.count}</span></Link>
              ))}
            </Menu>
            <PillSelect paramKey="source" label="Channels" allLabel={`Channels (${sourceRows.length})`} options={sourceOptions} className="min-w-[112px]" />
            <PillSelect paramKey="sentiment" label="Sentiment" allLabel="Sentiment" options={[{ value: 'positive', label: 'Positive' }, { value: 'neutral', label: 'Neutral' }, { value: 'negative', label: 'Negative' }]} className="min-w-[96px]" />
            <ExportMenu dataset="listening" extra={{ days: String(days) }} disabledReason={canExport ? null : 'Your role cannot export listening data.'} />
            {canAlert
              ? <Link href={withParams(searchParams, { alert: 'new' })} scroll={false} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 lg:h-[34px] lg:text-[11.5px]"><Plus size={15} aria-hidden /> Create Alert</Link>
              : <button type="button" disabled title="Your role or plan cannot create listening alerts." className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white opacity-55 lg:h-[34px] lg:text-[11.5px]"><Plus size={15} aria-hidden /> Create Alert</button>}
          </>
        )}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 xl:gap-[14px]">
        {kpi(<BarChart3 size={16} />, 'Total Mentions', (
          <>
            <p className="mt-1 flex items-baseline gap-1.5 pl-[40px]"><span className="text-[20px] font-semibold text-slate-900 tabular-nums">{compactNumber(totals.total)}</span><Delta value={totals.changePct} /></p>
            <p className="pl-[40px] text-[11px] text-slate-400 lg:text-[8.5px]">{compare}</p>
            <div className="mt-1.5 h-[30px]"><Sparkline points={series.map(day => ({ date: day.date, value: day.positive + day.neutral + day.negative }))} color="#3B6FF5" height={30} strokeWidth={1.4} summary="Mentions per day" /></div>
          </>
        ))}
        {kpi(<Heart size={16} />, 'Brand Sentiment', (
          <div className="mt-1 flex items-center gap-3">
            <Donut size={62} stroke={9} parts={[
              { value: totals.sentiment.positive, color: SENT_COLOURS.positive }, { value: totals.sentiment.neutral, color: SENT_COLOURS.neutral }, { value: totals.sentiment.negative, color: SENT_COLOURS.negative },
            ]} label="Brand sentiment" />
            <ul className="min-w-0 flex-1 space-y-1 text-[11px] lg:text-[9px]">
              {(['positive', 'neutral', 'negative'] as const).map(key => (
                <li key={key} className="flex items-center gap-1.5"><span className="h-[6px] w-[6px] rounded-full" style={{ background: SENT_COLOURS[key] }} aria-hidden /><span className="flex-1 capitalize text-slate-600">{key}</span><span className="font-medium tabular-nums text-slate-800">{pct(totals.sentiment[`${key}Pct`])}</span></li>
              ))}
            </ul>
          </div>
        ), <Link href={withParams(searchParams, { tab: 'trends' })}>View sentiment trend</Link>)}
        {kpi(<Percent size={16} />, 'Trending Topics', (
          <>
            <p className="mt-0.5 flex items-baseline gap-1.5 pl-[40px]"><span className="text-[20px] font-semibold text-slate-900 tabular-nums">{topics.filter(topic => (topic.growth_pct ?? 0) >= 15).length}</span><span className="text-[11px] text-slate-400 lg:text-[8.5px]">rising this period</span></p>
            <p className="mt-2 flex flex-wrap gap-1">
              {topicChips.map(chip => <Link key={chip} href={withParams(searchParams, { q: chip.replace('#', ''), page: null })} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 lg:text-[8.5px]">{chip}</Link>)}
              {topics.length > 3 && <Link href={withParams(searchParams, { tab: 'topics' })} className="px-1 py-0.5 text-[11px] text-slate-500 hover:underline lg:text-[8.5px]">+{topics.length - 3} more</Link>}
            </p>
          </>
        ), <Link href={withParams(searchParams, { tab: 'topics' })}>View all topics</Link>)}
        {kpi(<Users size={16} />, 'Influencer Mentions', (
          <>
            <p className="mt-0.5 flex items-baseline gap-1.5 pl-[40px]"><span className="text-[20px] font-semibold text-slate-900 tabular-nums">{aggregates.influencerCount}</span><Delta value={changePct(totals.influencerMentions, totals.previousInfluencerMentions || null)} /></p>
            <p className="pl-[40px] text-[11px] text-slate-400 lg:text-[8.5px]">Authors with 10K+ followers or verified</p>
            <p className="mt-2 flex items-center">
              {aggregates.influencers.slice(0, 6).map(person => <Avatar key={person.handle} src={person.avatar} name={person.name ?? person.handle} size={24} ring className="-ml-1.5 first:ml-0" />)}
              {aggregates.influencers.length > 6 && <span className="ml-1.5 text-[11px] text-slate-500 lg:text-[9px]">+{aggregates.influencers.length - 6}</span>}
            </p>
          </>
        ), <Link href={withParams(searchParams, { tab: 'influencers' })}>View influencers</Link>)}
        {kpi(<PieChart size={16} />, 'Share of Voice', (
          <>
            <p className="mt-0.5 flex items-baseline gap-1.5 pl-[40px]"><span className="text-[20px] font-semibold text-slate-900 tabular-nums">{pct(brandShare, 1)}</span><Hint label={sov.method} /></p>
            <ul className="mt-1.5 space-y-1 text-[11px] lg:text-[8.5px]">
              {sov.rows.slice(0, 3).map(row => (
                <li key={row.label} className="grid grid-cols-[52px_1fr_36px] items-center gap-2">
                  <span className="truncate text-slate-600">{row.label === brandLabel ? 'Caption Fox' : row.label}</span>
                  <span className="h-[4px] rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${row.share * 100}%`, background: row.label === brandLabel ? '#2563EB' : '#94A3B8' }} /></span>
                  <span className="text-right tabular-nums text-slate-700">{pct(row.share, 1)}</span>
                </li>
              ))}
            </ul>
          </>
        ))}
        {kpi(<BellRing size={16} />, 'Active Alerts', (
          <>
            <p className="mt-0.5 flex items-baseline gap-1.5 pl-[40px]"><span className="text-[20px] font-semibold text-slate-900 tabular-nums">{alertTotals.total}</span>{alertTotals.newThisPeriod > 0 && <span className="text-[11px] text-emerald-600 lg:text-[9px]">↑ {alertTotals.newThisPeriod} new</span>}</p>
            <p className="pl-[40px] text-[11px] text-slate-400 lg:text-[8.5px]">Requiring attention</p>
            <ul className="mt-1.5 space-y-1 text-[11px] lg:text-[9px]">
              {([['High', alertTotals.high, 'bg-red-500'], ['Medium', alertTotals.medium, 'bg-amber-500'], ['Low', alertTotals.low, 'bg-emerald-500']] as const).map(([label, count, dot]) => (
                <li key={label} className="flex items-center gap-1.5"><span className={cn('h-[6px] w-[6px] rounded-full', dot)} aria-hidden /><span className="flex-1 text-slate-600">{label}</span><span className="font-medium tabular-nums text-slate-800">{count}</span></li>
              ))}
            </ul>
          </>
        ))}
      </div>

      <ParamTabs paramKey="tab" defaultValue="stream" ariaLabel="Listening views" variant="soft" className="mt-4 w-fit bg-transparent" keep={{ page: null }}
        options={[{ value: 'stream', label: 'Stream' }, { value: 'table', label: 'Table' }, { value: 'trends', label: 'Trends' }, { value: 'topics', label: 'Topics' }, { value: 'influencers', label: 'Influencers' }, { value: 'geography', label: 'Geography' }]} />

      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,918fr)_304fr] xl:gap-[16px]">
      <div className="min-w-0 space-y-4 xl:space-y-[15px]">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[576fr_326fr] xl:gap-[16px]">
        {/* Main view */}
        <Card className="flex min-w-0 flex-col p-3.5 xl:h-[365px] xl:px-3 xl:py-3">
          {tab === 'stream' || tab === 'table' ? (
            <>
              <CardTitle title={tab === 'table' ? 'Mentions Table' : 'Mentions Stream'} hint="Public posts and first-party comments matching your tracked keywords." />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ParamTabs paramKey="mentions" defaultValue="all" ariaLabel="Mention filter" variant="soft" keep={{ page: null }}
                  options={[{ value: 'all', label: 'All Mentions' }, { value: 'unread', label: 'Unread' }, { value: 'favourites', label: 'Favorites' }, { value: 'high_priority', label: 'High Priority' }]} />
                <SearchBox placeholder="Search mentions..." className="ml-auto w-44 lg:w-40" />
                <Link href={withParams(searchParams, { tab: 'table', page: null })} aria-label="Open table view" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 lg:h-[26px] lg:w-[26px]"><SlidersHorizontal size={13} /></Link>
              </div>
              {stream.rows.length === 0 ? (
                <EmptyNote className="mt-3 flex-1" title="No mentions match" description={search || source || sentiment ? 'Try clearing filters or widening the date range.' : 'Mentions appear once your keywords are tracked and sources sync.'} />
              ) : (
                <div className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full min-w-[540px] table-fixed text-left text-[11px] xl:min-w-0 lg:text-[8.5px]">
                    <colgroup><col className="w-[19%]" /><col className="w-[32%]" /><col className="w-[7%]" /><col className="w-[11%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[6%]" /><col className="w-[8%]" /></colgroup>
                    <thead className="text-slate-500"><tr className="border-b border-slate-100 [&>th]:py-1.5 [&>th]:font-medium"><th scope="col">Author</th><th scope="col">Mention</th><th scope="col" className="text-center">Source</th><th scope="col" className="text-center">Sentiment</th><th scope="col" className="text-right">Reach</th><th scope="col" className="text-right">Eng. Rate</th><th scope="col" className="text-right">Time</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {stream.rows.map(row => <MentionRowView key={row.id} row={row} base={base} />)}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 lg:text-[8.5px]">
                <span>Showing {stream.total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, stream.total)} of {stream.total.toLocaleString('en-GB')} mentions</span>
                <Pagination page={page} pages={pages} searchParams={searchParams} />
              </div>
            </>
          ) : tab === 'trends' ? (
            <>
              <CardTitle title="Daily mentions" />
              <div className="mt-2 min-h-0 flex-1 overflow-auto">
                <table className="w-full text-left text-[12px] lg:text-[10px]">
                  <thead className="text-slate-500"><tr className="[&>th]:py-1.5 [&>th]:font-medium"><th scope="col">Day</th><th scope="col" className="text-right">Positive</th><th scope="col" className="text-right">Neutral</th><th scope="col" className="text-right">Negative</th><th scope="col" className="text-right">Total</th></tr></thead>
                  <tbody>{series.slice().reverse().map(day => (
                    <tr key={day.date} className="border-t border-slate-100 [&>td]:py-1.5"><td>{shortDay(day.date)}</td><td className="text-right text-emerald-600">{day.positive}</td><td className="text-right text-slate-600">{day.neutral}</td><td className="text-right text-red-600">{day.negative}</td><td className="text-right font-medium">{day.positive + day.neutral + day.negative}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : tab === 'topics' ? (
            <>
              <CardTitle title="Topics" count={topics.length} hint="Clusters recomputed from mentions over a rolling 7-day window." />
              <ul className="mt-2 min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
                {topics.length === 0 && <li className="py-6 text-center text-[12px] text-slate-500">No topics computed yet.</li>}
                {topics.map(topic => (
                  <li key={topic.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><Link href={withParams(searchParams, { tab: 'stream', q: topic.label.split(':')[0], page: null })} className="text-[13px] font-semibold text-slate-800 hover:underline lg:text-[11px]">{topic.label}</Link><p className="text-[12px] text-slate-500 lg:text-[9.5px]">{topic.summary}</p></div>
                    <span className="text-right text-[12px] tabular-nums lg:text-[10px]">{topic.mention_count} mentions<br /><Delta value={topic.growth_pct} /></span>
                  </li>
                ))}
              </ul>
            </>
          ) : tab === 'influencers' ? (
            <>
              <CardTitle title="Influencers mentioning you" count={aggregates.influencers.length} />
              <ul className="mt-2 grid min-h-0 flex-1 content-start gap-2 overflow-auto sm:grid-cols-2">
                {aggregates.influencers.length === 0 && <li className="py-6 text-center text-[12px] text-slate-500">No influencer mentions in this period.</li>}
                {aggregates.influencers.slice(0, 24).map(person => (
                  <li key={person.handle}><Link href={withParams(searchParams, { tab: 'stream', q: person.handle, page: null })} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 hover:bg-slate-50"><Avatar src={person.avatar} name={person.name} size={28} /><span className="min-w-0 text-[12px] lg:text-[10px]"><span className="block truncate font-semibold text-slate-800">{person.name ?? person.handle}</span><span className="block truncate text-slate-500">@{person.handle}</span></span></Link></li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <CardTitle title="Mentions by country" count={countries.buckets.length} />
              <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-auto">
                {countries.buckets.map(bucket => (
                  <li key={bucket.code} className="grid grid-cols-[1fr_2fr_48px_44px] items-center gap-3 text-[12px] lg:text-[10px]">
                    <span className="truncate text-slate-700">{countryName(bucket.code)}</span>
                    <span className="h-[5px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(bucket.count / maxCountry) * 100}%` }} /></span>
                    <span className="text-right tabular-nums">{bucket.count}</span><span className="text-right tabular-nums text-slate-500">{pct(bucket.share, 1)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Sentiment column */}
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-1 xl:grid-rows-[205px_150px] xl:gap-[10px]">
          <Card className="flex flex-col p-3.5 xl:py-3">
            <CardTitle title="Sentiment Over Time">
              <PillSelect compact paramKey="days" label="Sentiment range" defaultValue="7" options={[{ value: '7', label: 'Last 7 Days' }, { value: '14', label: 'Last 14 Days' }, { value: '30', label: 'Last 30 Days' }]} className="min-w-[78px]" />
            </CardTitle>
            <ul className="mt-1.5 flex gap-4 text-[11px] text-slate-600 lg:text-[9px]">
              {(['positive', 'neutral', 'negative'] as const).map(key => <li key={key} className="flex items-center gap-1.5 capitalize"><span className="h-[6px] w-[6px] rounded-full" style={{ background: SENT_COLOURS[key] }} aria-hidden />{key}</li>)}
            </ul>
            <LineChart className="mt-2" height={110} labels={series.map(day => shortDay(day.date))}
              series={(['positive', 'neutral', 'negative'] as const).map(key => ({ key, label: SENTIMENT[key].label, color: SENT_COLOURS[key], values: series.map(day => day[key]) }))}
              summary="Positive, neutral and negative mentions per day" />
          </Card>
          <Card className="p-3.5 xl:py-3">
            <CardTitle title="Sentiment Breakdown" />
            <div className="mt-2 flex items-center gap-4">
              <Donut size={96} stroke={13} parts={[
                { value: totals.sentiment.positive, color: SENT_COLOURS.positive }, { value: totals.sentiment.neutral, color: SENT_COLOURS.neutral }, { value: totals.sentiment.negative, color: SENT_COLOURS.negative },
              ]} label="Sentiment breakdown" center={<><span className="block text-[14px] font-semibold text-slate-900 lg:text-[13px]">{compactNumber(totals.total)}</span><span className="block text-[9px] text-slate-500 lg:text-[7.5px]">Total Mentions</span></>} />
              <ul className="min-w-0 flex-1 space-y-2.5 text-[12px] lg:text-[9.5px]">
                {(['positive', 'neutral', 'negative'] as const).map(key => (
                  <li key={key} className="grid grid-cols-[1fr_44px_40px] items-center gap-2">
                    <span className="flex items-center gap-1.5 capitalize text-slate-700"><span className="h-[7px] w-[7px] rounded-full" style={{ background: SENT_COLOURS[key] }} aria-hidden />{key}</span>
                    <span className="text-right tabular-nums text-slate-700">{pct(totals.sentiment[`${key}Pct`], 1)}</span>
                    <span className="text-right tabular-nums text-slate-500">{compactNumber(totals.sentiment[key])}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

      </div>

      {/* Lower cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[218fr_196fr_238fr_222fr] xl:gap-[15px]">
        <Card className="flex flex-col p-3.5 xl:h-[300px] xl:py-3">
          <CardTitle title="Top Keywords" hint="How many mentions in range contain each tracked keyword." />
          {aggregates.keywords.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No keywords tracked" /> : (
            <p className="mt-3 flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-x-2.5 gap-y-1 overflow-hidden text-center leading-none">
              {shuffleForCloud(aggregates.keywords.slice(0, 16)).map(row => {
                const max = aggregates.keywords[0]?.count || 1
                const weight = row.count / max
                return (
                  <Link key={row.keyword} href={withParams(searchParams, { q: row.keyword, tab: 'stream', page: null })} title={`${row.count} mentions`}
                    className={cn('hover:underline', weight > 0.6 ? 'font-semibold text-blue-700' : weight > 0.3 ? 'text-blue-600' : 'text-blue-400')}
                    style={{ fontSize: `${Math.round(9 + weight * 22)}px` }}>
                    {row.keyword}
                  </Link>
                )
              })}
            </p>
          )}
          <TextLink href={withParams(searchParams, { tab: 'table' })} className="mt-1 self-center">View all keywords →</TextLink>
        </Card>

        <Card className="flex flex-col p-3.5 xl:h-[300px] xl:py-3">
          <CardTitle title="Sources / Channels" />
          <ul className="mt-2.5 min-h-0 flex-1 space-y-2 overflow-hidden lg:space-y-[9px]">
            {sourceRows.slice(0, 8).map(row => (
              <li key={row.id}>
                <Link href={withParams(searchParams, { source: row.source_key, tab: 'stream', page: null })} className="grid grid-cols-[14px_1fr_1.1fr_34px_30px] items-center gap-1.5 text-[11px] hover:opacity-80 lg:text-[8.5px]">
                  {SOURCE_ICON.has(row.source_key) ? <ProviderIcon provider={row.source_key} size={13} decorative /> : <span className="h-[13px] w-[13px] rounded bg-emerald-500" aria-hidden />}
                  <span className="truncate text-slate-700">{row.label}</span>
                  <span className="h-[4px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(row.mention_count / maxSource) * 100}%` }} /></span>
                  <span className="text-right tabular-nums text-slate-700">{compactNumber(row.mention_count)}</span>
                  <span className="text-right tabular-nums text-slate-400">{row.share_pct === null ? '—' : `${row.share_pct}%`}</span>
                </Link>
              </li>
            ))}
          </ul>
          <TextLink href={`${base}/connections`} className="mt-1 self-center">View all sources →</TextLink>
        </Card>

        <Card className="flex flex-col p-3.5 xl:h-[300px] xl:py-3">
          <CardTitle title="Mentions by Region" hint="Country is inferred from the author profile where the source provides it." />
          <figure className="m-0 mt-2">
            <svg viewBox={`0 ${2 * 6} ${WORLD_COLS * 6} ${(WORLD_ROWS - 12) * 6}`} className="h-auto w-full" role="img" aria-label={`World map of mentions across ${countries.buckets.length} countries`}>
              {DOTS.map((dot, index) => {
                const count = dot.iso ? countryCounts.get(dot.iso) ?? 0 : 0
                const fill = count === 0 ? '#DBE4F0' : count >= maxCountry * 0.5 ? '#1D4ED8' : count >= maxCountry * 0.15 ? '#3B82F6' : '#93C5FD'
                return <rect key={index} x={dot.c * 6} y={dot.r * 6} width={5.6} height={5.6} rx={1} fill={fill} />
              })}
            </svg>
          </figure>
          <p className="mt-1.5 text-[11px] font-medium text-slate-600 lg:text-[8.5px]">Top Countries</p>
          <ul className="mt-1 min-h-0 flex-1 space-y-1 overflow-hidden">
            {countries.buckets.filter(bucket => bucket.code !== 'UNKNOWN').slice(0, 5).map(bucket => (
              <li key={bucket.code} className="grid grid-cols-[1fr_1fr_34px_30px] items-center gap-1.5 text-[11px] lg:text-[8.5px]">
                <span className="truncate text-slate-700">{countryName(bucket.code)}</span>
                <span className="h-[4px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(bucket.count / maxCountry) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{compactNumber(bucket.count)}</span>
                <span className="text-right tabular-nums text-slate-400">{pct(bucket.share, 1)}</span>
              </li>
            ))}
          </ul>
          <TextLink href={withParams(searchParams, { tab: 'geography' })} className="mt-1 self-center">View full geography →</TextLink>
        </Card>

        <Card className="flex flex-col p-3.5 xl:h-[300px] xl:py-3">
          <CardTitle title="Listening Alerts"><TextLink href={withParams(searchParams, { tab: 'stream', mentions: 'high_priority' })}>View all</TextLink></CardTitle>
          {totals.alerts.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No active alerts" /> : (
            <ul className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-hidden">
              {totals.alerts.slice(0, 5).map(alert => (
                <li key={alert.id} className="flex gap-2">
                  <span className={cn('w-0.5 shrink-0 rounded-full', alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500')} aria-hidden />
                  <Badge tone={alert.severity === 'high' ? 'red' : alert.severity === 'medium' ? 'orange' : 'green'} className="mt-0.5 capitalize">{alert.severity}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-slate-800 lg:text-[9px]">{alert.title}</span>
                    <span className="line-clamp-2 text-[11px] text-slate-500 lg:text-[8.5px]">{alert.message}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <Ago iso={alert.triggered_at} className="text-[11px] text-slate-400 lg:text-[8.5px]" />
                    <Kebab label={`${alert.title} options`}><ResolveAlertButton alertId={alert.id} allowed={session.can(PERMISSIONS.SOCIAL_LISTENING_MANAGE_ALERT)} /></Kebab>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

      </div>
      </div>
      <div className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-1 xl:gap-[10px]">
        {/* Trending conversations */}
        <Card className="flex flex-col p-3.5 xl:h-[400px] xl:py-3">
          <CardTitle title="Trending Conversations" hint="Topics with at least 25 mentions and 15% growth over the previous 7 days are marked as trending.">
            <PillSelect compact paramKey="days" label="Trending range" defaultValue="7" options={[{ value: '7', label: 'Last 7 Days' }, { value: '30', label: 'Last 30 Days' }]} className="min-w-[78px]" />
          </CardTitle>
          {topics.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No trending topics yet" description="Topics appear once enough mentions are collected." /> : (
            <ul className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-hidden">
              {topics.slice(0, 5).map((topic, index) => (
                <li key={topic.id}>
                  <Link href={withParams(searchParams, { tab: 'stream', q: topic.label.split(':')[0], page: null })} className="flex items-start gap-2.5 rounded-md hover:bg-slate-50">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 lg:h-[24px] lg:w-[24px]" aria-hidden>{[<Hash key="a" size={13} />, <Users key="b" size={13} />, <AtSign key="c" size={13} />, <Percent key="d" size={13} />, <BarChart3 key="e" size={13} />][index % 5]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-slate-800 lg:text-[9.5px]">{topic.label}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500 lg:text-[8.5px]">{compactNumber(topic.mention_count)} mentions <Delta value={topic.growth_pct} digits={0} /></span>
                      <span className="line-clamp-2 text-[11px] text-slate-500 lg:text-[8.5px]">{topic.summary}</span>
                    </span>
                    <span className="h-[28px] w-[70px] shrink-0 pt-1"><Sparkline points={(aggregates.topicSeries.get(topic.label) ?? []).map((value, day) => ({ date: String(day), value }))} color="#3B6FF5" height={24} strokeWidth={1.3} summary={`${topic.label} mentions per day`} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={withParams(searchParams, { tab: 'topics' })} className="mt-1 inline-flex items-center justify-center gap-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9px]">View all conversations <ArrowRight size={11} aria-hidden /></Link>
        </Card>
        <Card className="flex flex-col p-3.5 xl:h-[270px] xl:py-3">
          <CardTitle title="High Priority Mentions" hint="Priority weighs negative sentiment, audience size and engagement.">
            <PillSelect compact paramKey="priority" label="Priority scope" defaultValue="all" options={[{ value: 'all', label: 'All' }, { value: 'negative', label: 'Negative' }, { value: 'influencer', label: 'Influencers' }]} className="min-w-[46px]" />
          </CardTitle>
          {priorityRows.length === 0 ? <EmptyNote className="mt-3 flex-1" title="Nothing urgent" description="High-priority mentions appear here as they arrive." /> : (
            <ul className="mt-2 min-h-0 flex-1 space-y-3 overflow-hidden">
              {priorityRows.map(row => (
                <li key={row.id}>
                  <Link href={`${base}/listening/mentions/${row.id}`} className="flex gap-2.5 rounded-md hover:bg-slate-50">
                    <Avatar src={row.author_avatar_url} name={row.author_name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 text-[12px] font-semibold text-slate-800 lg:text-[9.5px]">{row.author_name ?? row.author_handle}<Ago iso={row.mentioned_at} className="text-[11px] font-normal text-slate-400 lg:text-[8.5px]" /></span>
                      <span className="block text-[11px] text-slate-400 lg:text-[8.5px]">@{row.author_handle}</span>
                      <span className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-600 lg:text-[9px]">{row.content}</span>
                      <span className="mt-1 flex items-center gap-2"><Badge tone={SENTIMENT[row.sentiment]?.tone ?? 'slate'}>{SENTIMENT[row.sentiment]?.label ?? row.sentiment}</Badge><span className="text-[11px] text-slate-500 lg:text-[8.5px]">{compactNumber(row.reach_estimate ?? 0)} reach</span></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <TextLink href={withParams(searchParams, { tab: 'stream', mentions: 'high_priority', page: null })} className="mt-1 self-center">View all high priority →</TextLink>
        </Card>
      </div>
    </div>

      <CreateAlertDialog keywordSuggestions={aggregates.keywords.map(row => row.keyword)} sourceOptions={sourceOptions} />
    </>
  )
}

function pct(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`
}

/** Interleaves big and small words so the cloud reads as a cloud, deterministically. */
function shuffleForCloud<T>(items: T[]): T[] {
  const out: T[] = []
  items.forEach((item, index) => { if (index % 2 === 0) out.push(item); else out.unshift(item) })
  return out
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
          const dash = <circle key={index} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={part.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, length - 1.5)} ${circumference}`} strokeDashoffset={-offset} />
          offset += length
          return dash
        })}
      </svg>
      {center && <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</span>}
    </span>
  )
}

function Pagination({ page, pages, searchParams }: { page: number; pages: number; searchParams: SocialPageProps['searchParams'] }) {
  if (pages <= 1) return null
  const numbers = [...new Set([1, 2, 3, page - 1, page, page + 1, pages].filter(value => value >= 1 && value <= pages))].sort((a, b) => a - b)
  const link = 'flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 tabular-nums lg:h-[20px] lg:min-w-[20px]'
  return (
    <nav aria-label="Mentions pages" className="flex items-center gap-0.5">
      <Link aria-label="Previous page" aria-disabled={page === 1} href={withParams(searchParams, { page: page > 2 ? page - 1 : null })} scroll={false} className={cn(link, page === 1 && 'pointer-events-none opacity-40')}><ChevronLeft size={12} /></Link>
      {numbers.map((value, index) => (
        <span key={value} className="flex items-center">
          {index > 0 && value - numbers[index - 1] > 1 && <span className="px-1">…</span>}
          <Link href={withParams(searchParams, { page: value === 1 ? null : value })} scroll={false} aria-current={value === page ? 'page' : undefined}
            className={cn(link, value === page ? 'border border-blue-200 bg-blue-50 font-semibold text-blue-700' : 'hover:bg-slate-50')}>{value}</Link>
        </span>
      ))}
      <Link aria-label="Next page" aria-disabled={page === pages} href={withParams(searchParams, { page: Math.min(pages, page + 1) })} scroll={false} className={cn(link, page === pages && 'pointer-events-none opacity-40')}><ChevronRight size={12} /></Link>
    </nav>
  )
}

function MentionRowView({ row, base }: { row: MentionRow; base: string }) {
  const sentiment = SENTIMENT[row.sentiment] ?? SENTIMENT.neutral
  return (
    <tr className={cn('border-b border-slate-50 align-middle [&>td]:py-2 lg:[&>td]:py-[7px]', !row.is_read && 'bg-blue-50/30')}>
      <td>
        <Link href={`${base}/listening/mentions/${row.id}`} className="flex items-center gap-2 hover:underline">
          <Avatar src={row.author_avatar_url} name={row.author_name} size={26} />
          <span className="min-w-0 leading-tight"><span className="block truncate font-semibold text-slate-800">{row.author_name ?? row.author_handle}</span><span className="block truncate text-slate-400">@{row.author_handle}</span></span>
        </Link>
      </td>
      <td className="pr-3"><span className="line-clamp-2 leading-snug text-slate-600">{highlight(row.content)}</span></td>
      <td className="text-center">{SOURCE_ICON.has(row.platform) ? <ProviderIcon provider={row.platform} size={17} className="mx-auto" /> : <span className="text-slate-500">{row.platform}</span>}</td>
      <td className="text-center"><Badge tone={sentiment.tone}>{sentiment.label}</Badge></td>
      <td className="text-right tabular-nums text-slate-700">{compactNumber(row.reach_estimate ?? 0)}</td>
      <td className="text-right tabular-nums text-slate-700">{pct(row.engagement_rate, 2)}</td>
      <td className="text-right"><Ago iso={row.mentioned_at} className="text-slate-500" /></td>
      <td>
        <span className="flex items-center justify-end">
          <StarButton mentionId={row.id} starred={row.is_starred} label={row.author_name ?? row.author_handle ?? 'author'} />
          <Kebab label="Mention options"><Link href={`${base}/listening/mentions/${row.id}`}>Open mention</Link></Kebab>
        </span>
      </td>
    </tr>
  )
}

/** Highlights @handles and #hashtags as the reference does, without injecting HTML. */
function highlight(text: string) {
  return text.split(/([@#][\p{L}\p{N}_]+)/gu).map((part, index) => /^[@#]/.test(part) ? <span key={index} className="text-blue-600">{part}</span> : part)
}
