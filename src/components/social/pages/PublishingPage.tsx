import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getApprovalQueue, getChannelPublishingSummary, getChannels, getPostsInRange, getPublishingAlerts, getSocialActivity,
  type SocialPostRow,
} from '@/lib/social/queries'
import { getCampaignNames, getPublishingTotals, getQueueList, getQueuedByChannel } from '@/lib/social/publishing-queries'
import { getComposerData } from '@/lib/social/composer'
import { changePct, compactNumber, previousRange, type DateRange } from '@/lib/social/metrics'
import { canAccessSocialCapability } from '@/lib/social/entitlements'
import { first, parseEnum, parseId, parseSearch, withParams } from '@/lib/social/url-state'
import type { SocialChannelRow, SocialProvider } from '@/types/social'
import type { SocialPageProps } from '../SocialRoute'
import { SocialHeader } from '../Header'
import { ComposerDialog } from '../ComposerDialog'
import {
  Ago, Avatar, Badge, Card, CardTitle, Delta, EmptyNote, fmtTime, PostStatusBadge, PROVIDER_NAMES, ProviderIcon, TextLink,
} from '../kit'
import { ExportMenu, FieldSelect, FilterPopover, Kebab, Menu, ParamTabs, PillSelect, PrimarySplit, SearchBox } from '../controls'
import Sparkline from '@/components/advertising/Sparkline'

// /{type}/social/publishing — Social Publishing, built to design reference (2).
// Main column: view tabs · channel cards · week calendar (or Queue / List /
// Board) · Scheduled Posts | Approval Queue. Right rail: Workflow Activity ·
// Publishing Alerts · Publishing Queue · week totals. All times are UTC.

const VIEWS = ['calendar', 'queue', 'list', 'board'] as const
const PLATFORM_ORDER: SocialProvider[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'x', 'youtube', 'pinterest', 'threads']
const SPARK: Record<string, string> = { instagram: '#F43F5E', tiktok: '#111827', facebook: '#2563EB', linkedin: '#2563EB', x: '#111827', youtube: '#EF4444', pinterest: '#E60023', threads: '#111827' }
const EVENT: Record<string, string> = {
  instagram: 'border-pink-200 bg-pink-50/80', youtube: 'border-rose-200 bg-rose-50/80', facebook: 'border-blue-200 bg-blue-50/70',
  linkedin: 'border-blue-200 bg-blue-50/70', tiktok: 'border-slate-300 bg-slate-100/80', x: 'border-slate-300 bg-slate-100/80',
}
const DAY = 24 * 60 * 60 * 1000
const FIRST_HOUR = 9
const LAST_HOUR = 18
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })

/** Sunday 00:00 UTC of the week containing `date`. */
function weekStart(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  return start
}

function parseWeek(raw: string | null): Date {
  const today = weekStart(new Date())
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || Math.abs(parsed.getTime() - today.getTime()) > 400 * DAY) return today
  return weekStart(parsed)
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const shortDateTime = (iso: string) => `${MONTH_DAY.format(new Date(iso))}, ${new Date(iso).getUTCFullYear()}`

export default async function PublishingPage({ session, searchParams, nav }: SocialPageProps) {
  const base = session.basePath
  const view = parseEnum(searchParams.view, VIEWS, 'calendar')
  const start = parseWeek(first(searchParams.week))
  const range: DateRange = { from: start, to: new Date(start.getTime() + 7 * DAY - 1) }
  const prev = previousRange(range)
  const statusFilter = first(searchParams.status)
  const activityFilter = parseEnum(searchParams.activity, ['all', 'posts', 'approvals', 'system'] as const, 'all')
  const search = parseSearch(searchParams.q)

  const channels = await getChannels(session)
  const channelId = parseId(searchParams.channel)
  const scopedChannel = channels.find(channel => channel.id === channelId) ?? null

  const canCreate = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_PUBLISHING_CREATE).allowed
  const canExport = session.can(PERMISSIONS.SOCIAL_PUBLISHING_EXPORT)

  const [weekPosts, summaries, approvals, alerts, activity, queued, totals, queueRows, composer] = await Promise.all([
    getPostsInRange(session, range, { limit: 500 }),
    getChannelPublishingSummary(session, range, channels),
    getApprovalQueue(session, 20),
    getPublishingAlerts(session),
    getSocialActivity(session, {
      limit: first(searchParams.activityLimit) === 'all' ? 40 : 5,
      entityTypes: activityFilter === 'posts' ? ['content_post'] : activityFilter === 'approvals' ? ['content_post'] : activityFilter === 'system' ? ['social_channel'] : undefined,
    }),
    getQueuedByChannel(session),
    getPublishingTotals(session, range, prev),
    view === 'queue' ? getQueueList(session, { status: statusFilter, channelId: scopedChannel?.id, limit: 100 }) : Promise.resolve([]),
    canCreate && first(searchParams.compose) ? getComposerData(session, parseId(searchParams.compose)) : Promise.resolve(null),
  ])

  const matchesChannel = (post: SocialPostRow) => !scopedChannel || post.channel_id === scopedChannel.id || (post.platforms ?? []).includes(scopedChannel.platform)
  const matchesSearch = (post: SocialPostRow) => !search || `${post.title ?? ''} ${post.caption ?? ''}`.toLowerCase().includes(search.toLowerCase())
  const posts = weekPosts.filter(post => matchesChannel(post) && matchesSearch(post) && (!statusFilter || post.status === statusFilter))
  const scheduledPosts = posts.filter(post => ['scheduled', 'queued', 'approved'].includes(post.status))
  const campaignNames = await getCampaignNames(session, [...scheduledPosts, ...approvals].map(post => post.campaign_id))
  const filteredActivity = activityFilter === 'approvals' ? activity.filter(row => /approv|submitted/.test(row.action)) : activity

  // One card per platform, summed across that platform's accounts.
  const cards = PLATFORM_ORDER.map(platform => {
    const rows = summaries.filter(row => row.channel.platform === platform)
    if (rows.length === 0) return null
    const primary = rows.slice().sort((a, b) => b.scheduled - a.scheduled)[0]
    return {
      platform, channel: primary.channel,
      scheduled: rows.reduce((sum, row) => sum + row.scheduled, 0),
      drafts: rows.reduce((sum, row) => sum + row.drafts, 0),
      needsApproval: rows.reduce((sum, row) => sum + row.needsApproval, 0),
      changePct: rows.length === 1 ? primary.changePct : null,
      series: primary.series.map((point, index) => ({ date: point.date, value: rows.reduce((sum, row) => sum + (row.series[index]?.value ?? 0), 0) })),
    }
  }).filter((card): card is NonNullable<typeof card> => Boolean(card)).slice(0, 6)

  const channelOptions = channels.map(channel => ({ value: channel.id, label: `${PROVIDER_NAMES[channel.platform]} · ${channel.handle ?? channel.account_name}` }))
  const weekLabel = `${MONTH_DAY.format(range.from)} – ${MONTH_DAY.format(new Date(range.to.getTime() - 1))}, ${range.to.getUTCFullYear()}`
  const thisWeek = weekStart(new Date())
  const weekOptions = [-2, -1, 0, 1, 2, 3].map(offset => {
    const date = new Date(thisWeek.getTime() + offset * 7 * DAY)
    return { value: offset === 0 ? '' : isoDay(date), label: offset === 0 ? `This week (${MONTH_DAY.format(date)})` : `Week of ${MONTH_DAY.format(date)}` }
  })

  return (
    <>
      <SocialHeader
        title="Social Publishing"
        subtitle="Schedule, approve, and publish content across all channels with ease."
        nav={nav}
        actions={(
          <>
            <PillSelect paramKey="week" label={`Week, currently ${weekLabel}`} icon={<CalendarDays size={14} className="text-slate-500" aria-hidden />}
              options={weekOptions.filter(option => option.value)} allLabel={weekLabel} className="min-w-[182px]" />
            <FilterPopover activeCount={[statusFilter, search].filter(Boolean).length} clearKeys={['status', 'q']}>
              <FieldSelect paramKey="status" label="Status" options={[
                { value: 'draft', label: 'Draft' }, { value: 'pending_approval', label: 'Pending approval' }, { value: 'scheduled', label: 'Scheduled' },
                { value: 'published', label: 'Published' }, { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' },
              ]} />
            </FilterPopover>
            <PillSelect paramKey="channel" label="Channel" allLabel="Channels" options={channelOptions}
              icon={scopedChannel ? <ProviderIcon provider={scopedChannel.platform} size={14} decorative /> : <RefreshCw size={13} className="text-slate-500" aria-hidden />} className="min-w-[112px]" />
            <Menu label="More actions" width="w-56" trigger={<>More <ChevronDown size={14} className="text-slate-400" aria-hidden /></>}>
              <Link href={withParams(searchParams, { view: 'queue', status: 'failed' })}>Failed deliveries</Link>
              <Link href={withParams(searchParams, { view: 'list', status: 'pending_approval' })}>Pending approvals</Link>
              <Link href={`/${session.kind}/calendar`}>Open workspace calendar</Link>
              <Link href={`${base}/connections`}>Manage connections</Link>
            </Menu>
            <ExportMenu dataset="posts" extra={{ days: '7' }} disabledReason={canExport ? null : 'Your role cannot export publishing data.'} />
            <PrimarySplit href={withParams(searchParams, { compose: '1' })} label="Schedule Post" icon={<Plus size={15} aria-hidden />} menuLabel="More scheduling options"
              disabledReason={canCreate ? (channels.length ? null : 'Connect a channel before scheduling posts.') : 'Your role or plan does not include publishing.'}>
              <Link href={withParams(searchParams, { compose: '1' })}>New post</Link>
              <Link href={`/${session.kind}/studio`}>Create in Studio</Link>
              <Link href={`/${session.kind}/campaigns`}>From a campaign</Link>
            </PrimarySplit>
          </>
        )}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,940fr)_248fr] xl:gap-[15px]">
        <div className="min-w-0 space-y-4 xl:space-y-[15px]">
          <ParamTabs paramKey="view" defaultValue="calendar" ariaLabel="Publishing view" variant="soft" className="w-fit bg-slate-100/70"
            options={[{ value: 'calendar', label: 'Calendar' }, { value: 'queue', label: 'Queue' }, { value: 'list', label: 'List' }, { value: 'board', label: 'Board' }]} />

          {channels.length === 0 && (
            <EmptyNote title="Connect a channel to start publishing" description="Scheduled posts need a connected account to deliver to."
              action={<Link href={`${base}/connections?connect=1`} className="text-[13px] font-medium text-blue-600 hover:underline">Connect a channel</Link>} />
          )}

          {cards.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-[14px]">
              {cards.map(card => (
                <Card key={card.platform} className="min-w-0 px-3 pb-2 pt-3 xl:h-[150px]">
                  <div className="flex items-start gap-2">
                    <ProviderIcon provider={card.platform} size={24} />
                    <Link href={`${base}/connections/${card.channel.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate text-[12.5px] font-semibold text-slate-900 lg:text-[10.5px]">{PROVIDER_NAMES[card.platform]}</p>
                      <p className="truncate text-[11px] text-slate-500 lg:text-[9px]">{card.channel.handle ?? card.channel.account_name}</p>
                    </Link>
                    <Kebab label={`${PROVIDER_NAMES[card.platform]} options`}>
                      <Link href={withParams(searchParams, { channel: card.channel.id })}>Filter to this channel</Link>
                      <Link href={withParams(searchParams, { view: 'queue', channel: card.channel.id })}>View queue</Link>
                      <Link href={`${base}/connections/${card.channel.id}`}>Connection details</Link>
                    </Kebab>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-[22px] font-semibold leading-none text-slate-900 tabular-nums lg:text-[21px]">{card.scheduled}</span>
                    <span className="text-[11px] text-slate-500 lg:text-[8.5px]">Scheduled</span>
                    <Delta className="ml-auto" value={card.changePct} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] lg:text-[8.5px]">
                    <div><dd className="text-[13px] font-semibold text-slate-900 lg:text-[11px]">{card.drafts}</dd><dt className="text-slate-500">Drafts</dt></div>
                    <div><dd className="text-[13px] font-semibold text-slate-900 lg:text-[11px]">{card.needsApproval}</dd><dt className="text-slate-500">Needs Approval</dt></div>
                  </dl>
                  <div className="mt-1.5 h-[20px]">
                    <Sparkline points={card.series} color={SPARK[card.platform]} height={20} strokeWidth={1.3} summary={`${PROVIDER_NAMES[card.platform]} posts per day this week`} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {view === 'calendar' && <WeekCalendar posts={posts} start={start} weekLabel={weekLabel} searchParams={searchParams} base={base} canCreate={canCreate} />}
          {view === 'queue' && <QueueView rows={queueRows} base={base} statusFilter={statusFilter} />}
          {view === 'list' && <ListView posts={posts} base={base} campaigns={campaignNames} />}
          {view === 'board' && <BoardView posts={posts} base={base} />}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[469fr_456fr] xl:gap-[14px]">
            <Card className="flex flex-col p-4 xl:h-[285px] xl:px-3.5 xl:pb-2 xl:pt-3">
              <CardTitle title="Scheduled Posts" count={scheduledPosts.length}>
                <TextLink href={withParams(searchParams, { view: null })}>View Calendar</TextLink>
              </CardTitle>
              {scheduledPosts.length === 0 ? (
                <EmptyNote className="mt-3 flex-1" title="Nothing scheduled this week" description="Scheduled posts for the selected week and channels appear here." />
              ) : (
                <div className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-hidden xl:overflow-x-hidden">
                  <table className="w-full min-w-[460px] table-fixed xl:min-w-0 text-left text-[11px] lg:text-[8.5px]">
                    <colgroup><col className="w-[25%]" /><col className="w-[9%]" /><col className="w-[16%]" /><col className="w-[22%]" /><col className="w-[16%]" /><col className="w-[12%]" /></colgroup>
                    <thead className="text-slate-500"><tr className="[&>th]:pb-1.5 [&>th]:font-medium"><th scope="col">Post</th><th scope="col" className="text-center">Channel</th><th scope="col">Scheduled Time</th><th scope="col">Content</th><th scope="col">Campaign</th><th scope="col" className="text-center">Status</th></tr></thead>
                    <tbody>
                      {scheduledPosts.slice(0, 5).map(post => (
                        <tr key={post.id} className="border-t border-slate-50 [&>td]:py-[3px]">
                          <td><Link href={`${base}/posts/${post.id}`} className="flex items-center gap-2 hover:underline"><Thumb src={post.thumbnail_url} size={24} /><span className="truncate font-medium text-slate-800">{post.title ?? 'Untitled post'}</span></Link></td>
                          <td className="text-center"><ProviderIcon provider={post.platforms?.[0] ?? 'instagram'} size={13} className="mx-auto" /></td>
                          <td className="leading-tight text-slate-600">{post.scheduled_at ? <>{shortDateTime(post.scheduled_at)}<br />{fmtTime(post.scheduled_at)}</> : '—'}</td>
                          <td className="truncate text-slate-500" title={post.caption ?? undefined}>{post.caption ?? '—'}</td>
                          <td className="truncate">{post.campaign_id && campaignNames.get(post.campaign_id) ? <Link href={`/${session.kind}/campaigns/${post.campaign_id}`} className="text-blue-600 hover:underline">{campaignNames.get(post.campaign_id)}</Link> : <span className="text-slate-400">—</span>}</td>
                          <td className="text-center"><PostStatusBadge status={post.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Link href={withParams(searchParams, { view: 'list', status: 'scheduled' })} className="mt-1 inline-flex w-fit items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9.5px]">View all scheduled posts <ArrowRight size={11} aria-hidden /></Link>
            </Card>

            <Card className="flex flex-col p-4 xl:h-[285px] xl:px-3.5 xl:pb-2 xl:pt-3">
              <CardTitle title="Approval Queue" count={approvals.length}>
                <TextLink href={withParams(searchParams, { view: 'list', status: 'pending_approval' })}>View all</TextLink>
              </CardTitle>
              {approvals.length === 0 ? (
                <EmptyNote className="mt-3 flex-1" title="No posts waiting for approval" description="Posts sent for review appear here until a reviewer decides." />
              ) : (
                <div className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-hidden xl:overflow-x-hidden">
                  <table className="w-full min-w-[440px] table-fixed xl:min-w-0 text-left text-[11px] lg:text-[8.5px]">
                    <colgroup><col className="w-[32%]" /><col className="w-[9%]" /><col className="w-[27%]" /><col className="w-[19%]" /><col className="w-[13%]" /></colgroup>
                    <thead className="text-slate-500"><tr className="[&>th]:pb-1.5 [&>th]:font-medium"><th scope="col">Post</th><th scope="col" /><th scope="col">Requested by</th><th scope="col">Campaign</th><th scope="col" className="text-center">Status</th></tr></thead>
                    <tbody>
                      {approvals.slice(0, 5).map(post => (
                        <tr key={post.id} className="border-t border-slate-50 [&>td]:py-[4px]">
                          <td><Link href={`${base}/posts/${post.id}`} className="flex items-center gap-2 hover:underline"><Thumb src={post.thumbnail_url} size={24} /><span className="truncate font-medium text-slate-800">{post.title ?? 'Untitled post'}</span></Link></td>
                          <td><ProviderIcon provider={post.platforms?.[0] ?? 'instagram'} size={17} /></td>
                          <td>
                            <span className="flex items-center gap-1.5">
                              <Avatar src={post.requester?.avatar_url} name={post.requester?.full_name} size={20} />
                              <span className="min-w-0 leading-tight"><span className="block truncate font-medium text-slate-800">{post.requester?.full_name ?? 'Teammate'}</span><span className="block truncate text-slate-400">{shortDateTime(post.updated_at)}, {fmtTime(post.updated_at)}</span></span>
                            </span>
                          </td>
                          <td className="truncate">{post.campaign_id && campaignNames.get(post.campaign_id) ? <span className="text-emerald-600">{campaignNames.get(post.campaign_id)}</span> : <span className="text-slate-400">—</span>}</td>
                          <td className="text-center"><Badge tone="amber">Pending</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Link href={withParams(searchParams, { view: 'list', status: 'pending_approval' })} className="mt-1 inline-flex w-fit items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9.5px]">Go to Approvals <ArrowRight size={11} aria-hidden /></Link>
            </Card>
          </div>

        </div>

        {/* Right rail */}
        <div className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-1 xl:gap-[10px]">
          <Card className="p-3.5 xl:pb-2">
            <CardTitle title="Workflow Activity"><TextLink href={withParams(searchParams, { activityLimit: first(searchParams.activityLimit) === 'all' ? null : 'all' })}>{first(searchParams.activityLimit) === 'all' ? 'Show less' : 'View all'}</TextLink></CardTitle>
            <PillSelect compact paramKey="activity" label="Activity type" defaultValue="all" className="mt-2 min-w-[80px]"
              options={[{ value: 'all', label: 'All Activity' }, { value: 'posts', label: 'Posts' }, { value: 'approvals', label: 'Approvals' }, { value: 'system', label: 'Connections' }]} />
            {filteredActivity.length === 0 ? (
              <p className="mt-3 text-[12px] text-slate-500">No publishing activity yet.</p>
            ) : (
              <ul className="mt-2 space-y-2.5 lg:space-y-[11px]">
                {filteredActivity.map(item => (
                  <li key={item.id} className="flex gap-2">
                    {item.actor_kind === 'system'
                      ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 lg:h-[24px] lg:w-[24px]" aria-hidden><RefreshCw size={12} /></span>
                      : <Avatar src={item.actor?.avatar_url} name={item.actor?.full_name} size={24} />}
                    <div className="min-w-0 flex-1 text-[11.5px] leading-tight lg:text-[9px]">
                      <p className="flex justify-between gap-2"><span className="truncate font-semibold text-slate-800">{item.actor?.full_name ?? (item.actor_kind === 'system' ? 'System' : 'Teammate')}</span><Ago iso={item.created_at} className="text-slate-400" /></p>
                      <p className="text-slate-500">{item.summary}</p>
                      {item.detail && (item.href ? <Link href={item.href} className="block truncate text-slate-600 hover:underline">{item.detail}</Link> : <p className="truncate text-slate-600">{item.detail}</p>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-3.5 xl:pb-2.5">
            <CardTitle title="Publishing Alerts"><TextLink href={withParams(searchParams, { view: 'queue', status: 'failed' })}>View all</TextLink></CardTitle>
            {alerts.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">No publishing problems.</p> : (
              <ul className="mt-2 space-y-2 lg:space-y-[9px]">
                {alerts.slice(0, 4).map(alert => (
                  <li key={alert.id} className="flex items-center gap-2 text-[11.5px] lg:text-[8.5px]">
                    {alert.severity === 'error' ? <AlertTriangle size={13} className="shrink-0 text-red-500" aria-hidden />
                      : alert.severity === 'warning' ? <AlertTriangle size={13} className="shrink-0 text-amber-500" aria-hidden />
                        : <ShieldCheck size={13} className="shrink-0 text-emerald-500" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-slate-700" title={alert.detail}>{alert.title}</span>
                    {alert.href && <Link href={alert.href} className="shrink-0 text-blue-600 hover:underline">{alert.actionLabel}</Link>}
                    <Ago iso={alert.at} className="w-7 shrink-0 text-right text-slate-400" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-3.5 xl:pb-2.5">
            <CardTitle title="Publishing Queue"><TextLink href={withParams(searchParams, { view: 'queue', status: 'queued' })}>View Queue</TextLink></CardTitle>
            {queued.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">Nothing queued.</p> : (
              <ul className="mt-2 space-y-2">
                {queued.map(group => ({ group, channel: channels.find(channel => channel.id === group.channelId) }))
                  .filter((item): item is { group: typeof queued[number]; channel: SocialChannelRow } => Boolean(item.channel))
                  .sort((a, b) => PLATFORM_ORDER.indexOf(a.channel.platform) - PLATFORM_ORDER.indexOf(b.channel.platform))
                  .slice(0, 5)
                  .map(({ group, channel }) => (
                    <li key={group.channelId} className="flex items-center gap-2">
                      <ProviderIcon provider={channel.platform} size={22} />
                      <Link href={withParams(searchParams, { view: 'queue', channel: channel.id, status: 'queued' })} className="w-[62px] min-w-0 leading-tight hover:underline">
                        <span className="block truncate text-[11.5px] font-medium text-slate-800 lg:text-[8.5px]">{PROVIDER_NAMES[channel.platform]}</span>
                        <span className="block truncate text-[10.5px] text-slate-400 lg:text-[8px]">{channel.handle ?? channel.account_name}</span>
                      </Link>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700 lg:h-[18px] lg:w-[18px] lg:text-[9px]">{group.count}</span>
                      <span className="flex min-w-0 flex-1 items-center gap-1">
                        {group.thumbs.slice(0, 4).map(thumb => <Link key={thumb.postId} href={`${base}/posts/${thumb.postId}`} aria-label="Open queued post"><Thumb src={thumb.url} size={18} /></Link>)}
                        {group.count > 4 && <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500 lg:text-[8px]">+{group.count - 4}</span>}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card className="grid grid-cols-3 gap-2 p-3.5">
            {[
              { label: 'Total Scheduled', value: totals.scheduled, delta: changePct(totals.scheduled, totals.scheduledPrev || null) },
              { label: 'Published', value: totals.published, delta: changePct(totals.published, totals.publishedPrev || null) },
              { label: 'Engagement', value: totals.engagement, delta: changePct(totals.engagement, totals.engagementPrev || null) },
            ].map(item => (
              <div key={item.label} className="min-w-0">
                <p className="truncate text-[11px] text-slate-500 lg:text-[8.5px]">{item.label}</p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-1"><span className="text-[15px] font-semibold text-slate-900 tabular-nums lg:text-[13px]">{compactNumber(item.value)}</span><Delta value={item.delta} /></p>
                <p className="truncate text-[10.5px] text-slate-400 lg:text-[8px]">vs {MONTH_DAY.format(prev.from)} – {MONTH_DAY.format(prev.to)}</p>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {composer && <ComposerDialog data={composer} canApproveOwn={session.can(PERMISSIONS.SOCIAL_PUBLISHING_APPROVE)} brandHref={`/${session.kind}/brand`} />}
    </>
  )
}

function Thumb({ src, size = 22 }: { src: string | null; size?: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded bg-slate-100" style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed post thumbnail */}
      {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </span>
  )
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function WeekCalendar({ posts, start, weekLabel, searchParams, base, canCreate }: {
  posts: SocialPostRow[]; start: Date; weekLabel: string; searchParams: SocialPageProps['searchParams']; base: string; canCreate: boolean
}) {
  const days = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * DAY))
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => FIRST_HOUR + index)
  const span = LAST_HOUR - FIRST_HOUR
  const now = new Date()
  const todayIndex = days.findIndex(day => isoDay(day) === isoDay(now))
  const nowFraction = (now.getUTCHours() + now.getUTCMinutes() / 60 - FIRST_HOUR) / span
  const prevWeek = isoDay(new Date(start.getTime() - 7 * DAY))
  const nextWeek = isoDay(new Date(start.getTime() + 7 * DAY))
  const thisWeek = isoDay(weekStart(now))

  const placed = posts.filter(post => post.scheduled_at).map(post => {
    const at = new Date(post.scheduled_at!)
    const dayIndex = Math.floor((at.getTime() - start.getTime()) / DAY)
    const hour = at.getUTCHours() + at.getUTCMinutes() / 60
    const fraction = Math.min(Math.max((hour - FIRST_HOUR) / span, 0), 1 - 1.25 / span)
    return { post, dayIndex, fraction, outside: hour < FIRST_HOUR || hour >= LAST_HOUR }
  }).filter(item => item.dayIndex >= 0 && item.dayIndex < 7)
    .sort((a, b) => a.dayIndex - b.dayIndex || a.fraction - b.fraction)

  // Posts whose blocks would collide share the slot side by side (up to three
  // lanes); anything beyond that collapses into a "+N more" link for the day.
  const blockHeight = 1.15 / span
  const MAX_LANES = 3
  const laid: (typeof placed[number] & { lane: number; lanes: number })[] = []
  const overflow = new Map<number, { count: number; fraction: number }>()
  for (let day = 0; day < 7; day += 1) {
    const items = placed.filter(item => item.dayIndex === day)
    const laneEnds: number[] = []
    const assigned = items.map(item => {
      let lane = laneEnds.findIndex(end => end <= item.fraction)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
      laneEnds[lane] = item.fraction + blockHeight
      return { ...item, lane }
    })
    for (const item of assigned) {
      const group = assigned.filter(other => Math.abs(other.fraction - item.fraction) < blockHeight)
      const lanes = Math.min(MAX_LANES, Math.max(...group.map(other => other.lane)) + 1)
      if (item.lane >= MAX_LANES) {
        const entry = overflow.get(day) ?? { count: 0, fraction: item.fraction }
        overflow.set(day, { count: entry.count + 1, fraction: entry.fraction })
      } else {
        laid.push({ ...item, lanes })
      }
    }
  }

  // A free afternoon slot on the next open day invites scheduling, as in the reference.
  const suggestDay = canCreate ? days.findIndex((day, index) => index > Math.max(todayIndex, -1) && !placed.some(item => item.dayIndex === index && item.fraction > 0.5 && item.fraction < 0.8)) : -1
  const suggestAt = suggestDay >= 0 ? new Date(days[suggestDay].getTime() + 15 * 60 * 60 * 1000).toISOString().slice(0, 16) : null

  return (
    <Card className="p-4 xl:h-[350px] xl:px-3 xl:pb-2 xl:pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold text-slate-900 lg:text-[11.5px]">{weekLabel}</h2>
        <Link href={withParams(searchParams, { week: prevWeek === thisWeek ? null : prevWeek })} scroll={false} aria-label="Previous week" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 lg:h-[20px] lg:w-[20px]"><ChevronLeft size={12} /></Link>
        <Link href={withParams(searchParams, { week: nextWeek === thisWeek ? null : nextWeek })} scroll={false} aria-label="Next week" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 lg:h-[20px] lg:w-[20px]"><ChevronRight size={12} /></Link>
        <Link href={withParams(searchParams, { week: null })} scroll={false} className="flex h-8 items-center rounded-md border border-slate-200 px-2.5 text-[12px] text-slate-600 hover:bg-slate-50 lg:h-[20px] lg:text-[9px]">Today</Link>
        <span className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-[12px] text-slate-600 lg:h-[22px] lg:text-[9px]" title="Week view">Week</span>
      </div>

      <div className="mt-2 overflow-x-auto overflow-y-hidden">
        <div className="min-w-[760px]">
          <div className="ml-10 grid grid-cols-7" aria-hidden>
            {days.map((day, index) => (
              <div key={index} className="flex h-8 items-center justify-center gap-1 text-[12px] text-slate-600 lg:h-[24px] lg:text-[9.5px]">
                {WEEKDAY.format(day)} {index === todayIndex ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white lg:h-[17px] lg:w-[17px] lg:text-[8.5px]">{day.getUTCDate()}</span> : day.getUTCDate()}
              </div>
            ))}
          </div>
          <div className="relative flex h-[440px] xl:h-[262px]">
            <div className="relative w-10 shrink-0" aria-hidden>
              {hours.map((hour, index) => (
                <span key={hour} className="absolute right-1.5 -translate-y-1/2 whitespace-nowrap text-[10px] text-slate-400 lg:text-[8px]" style={{ top: `${(index / span) * 100}%` }}>
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </span>
              ))}
            </div>
            <div className="relative grid flex-1 grid-cols-7 border-l border-t border-slate-100">
              {hours.slice(0, -1).map((hour, index) => (
                <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: `${(index / span) * 100}%` }} aria-hidden />
              ))}
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="relative border-r border-slate-100" role="list" aria-label={`${WEEKDAY.format(day)} ${MONTH_DAY.format(day)}`}>
                  {laid.filter(item => item.dayIndex === dayIndex).map(({ post, fraction, outside, lane, lanes }) => (
                    <Link
                      key={post.id} role="listitem" href={`${base}/posts/${post.id}`}
                      className={cn('absolute block overflow-hidden rounded-md border px-1.5 py-1 hover:z-10 hover:shadow-sm', EVENT[post.platforms?.[0] ?? ''] ?? 'border-slate-200 bg-slate-50', post.status === 'pending_approval' && 'border-dashed', post.status === 'failed' && 'border-red-300 bg-red-50')}
                      style={{ top: `${fraction * 100}%`, height: `${blockHeight * 100}%`, left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 6px)` }}
                      title={`${post.title ?? 'Untitled post'} · ${fmtTime(post.scheduled_at!)} UTC${outside ? ' (outside the hours shown)' : ''}`}
                    >
                      {lanes === 1
                        ? <span className="flex items-center gap-1 whitespace-nowrap text-[9.5px] text-slate-500 lg:text-[7.5px]"><ProviderIcon provider={post.platforms?.[0] ?? 'instagram'} size={11} decorative />{fmtTime(post.scheduled_at!)}</span>
                        : <ProviderIcon provider={post.platforms?.[0] ?? 'instagram'} size={11} decorative />}
                      <span className="block truncate text-[11px] font-medium text-slate-800 lg:text-[8.5px]">{post.title ?? 'Untitled post'}</span>
                    </Link>
                  ))}
                  {overflow.has(dayIndex) && (
                    <Link href={withParams(searchParams, { view: 'list' })} scroll={false}
                      className="absolute right-1 z-[1] rounded bg-slate-800 px-1 text-[10px] font-medium text-white lg:text-[8px]"
                      style={{ top: `${overflow.get(dayIndex)!.fraction * 100}%` }}>
                      +{overflow.get(dayIndex)!.count} more
                    </Link>
                  )}
                  {dayIndex === suggestDay && suggestAt && (
                    <Link href={withParams(searchParams, { compose: `at:${suggestAt}` })} scroll={false}
                      className="absolute inset-x-1 flex items-center justify-center rounded-md border border-dashed border-slate-300 text-[11px] font-medium text-blue-600 hover:bg-blue-50 lg:text-[9px]"
                      style={{ top: `${((15 - FIRST_HOUR) / span) * 100 + 1}%`, height: `${(0.95 / span) * 100}%` }}>
                      <Plus size={11} aria-hidden /> Schedule
                    </Link>
                  )}
                </div>
              ))}
              {todayIndex >= 0 && nowFraction >= 0 && nowFraction <= 1 && (
                <div className="pointer-events-none absolute inset-x-0 border-t border-red-400" style={{ top: `${nowFraction * 100}%` }} aria-hidden>
                  <span className="absolute -left-[42px] -top-2 rounded bg-red-500 px-1 text-[9px] font-medium text-white lg:text-[7.5px]">{fmtTime(now.toISOString())}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only">{placed.length} posts scheduled in this week. All times shown in UTC.</p>
    </Card>
  )
}

// ── Queue, List and Board views ──────────────────────────────────────────────

const QUEUE_STATUS: Record<string, { label: string; tone: 'blue' | 'green' | 'red' | 'amber' | 'slate' }> = {
  queued: { label: 'Queued', tone: 'blue' }, processing: { label: 'Publishing', tone: 'blue' }, sent: { label: 'Published', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' }, skipped: { label: 'Awaiting approval', tone: 'amber' }, cancelled: { label: 'Cancelled', tone: 'slate' },
}

function QueueView({ rows, base, statusFilter }: { rows: Awaited<ReturnType<typeof getQueueList>>; base: string; statusFilter: string | null }) {
  return (
    <Card className="p-4">
      <CardTitle title="Delivery queue" count={rows.length} hint="One row per channel delivery. Failed deliveries retry automatically up to their attempt limit.">
        <PillSelect compact paramKey="status" label="Delivery status" allLabel="All statuses" className="min-w-[100px]"
          options={Object.entries(QUEUE_STATUS).map(([value, style]) => ({ value, label: style.label }))} />
      </CardTitle>
      {rows.length === 0 ? (
        <EmptyNote className="mt-3" title={statusFilter ? 'No deliveries match this status' : 'The queue is empty'} description="Deliveries are created when posts are scheduled or published." />
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px] lg:text-[11px]">
            <thead className="text-slate-500"><tr className="[&>th]:py-2 [&>th]:font-medium"><th scope="col">Post</th><th scope="col">Channel</th><th scope="col">Scheduled (UTC)</th><th scope="col">Attempts</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map(row => {
                const style = QUEUE_STATUS[row.status] ?? { label: row.status, tone: 'slate' as const }
                return (
                  <tr key={row.id} className="border-t border-slate-100 [&>td]:py-2">
                    <td><Link href={`${base}/posts/${row.post_id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:underline"><Thumb src={row.post?.thumbnail_url ?? null} size={26} />{row.post?.title ?? 'Untitled post'}</Link>
                      {row.error_message && <span className="mt-0.5 block text-[11.5px] text-red-600">{row.error_message}</span>}</td>
                    <td><span className="flex items-center gap-1.5">{row.channel && <ProviderIcon provider={row.channel.platform} size={16} />}{row.channel?.handle ?? row.channel?.account_name}</span></td>
                    <td className="text-slate-600">{shortDateTime(row.scheduled_at)}, {fmtTime(row.scheduled_at)}</td>
                    <td className="tabular-nums text-slate-600">{row.attempt_count} / {row.max_attempts}</td>
                    <td><Badge tone={style.tone}>{style.label}</Badge>{row.next_attempt_at && row.status === 'failed' && <span className="ml-1 text-[11px] text-slate-500"><Clock3 size={11} className="inline" aria-hidden /> retry <Ago iso={row.next_attempt_at} /></span>}</td>
                    <td className="text-right"><Kebab label="Delivery options"><Link href={`${base}/posts/${row.post_id}`}>Open post{row.status === 'failed' ? ' to retry' : ''}</Link><Link href={`${base}/connections/${row.channel_id}`}>Channel connection</Link></Kebab></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function ListView({ posts, base, campaigns }: { posts: SocialPostRow[]; base: string; campaigns: Map<string, string> }) {
  return (
    <Card className="p-4">
      <CardTitle title="Posts this week" count={posts.length}>
        <SearchBox placeholder="Search posts" className="w-44" />
      </CardTitle>
      {posts.length === 0 ? <EmptyNote className="mt-3" title="No posts match" description="Try another week, channel, status or search." /> : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px] lg:text-[11px]">
            <thead className="text-slate-500"><tr className="[&>th]:py-2 [&>th]:font-medium"><th scope="col">Post</th><th scope="col">Channels</th><th scope="col">Scheduled (UTC)</th><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-t border-slate-100 [&>td]:py-2">
                  <td><Link href={`${base}/posts/${post.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:underline"><Thumb src={post.thumbnail_url} size={26} />{post.title ?? 'Untitled post'}</Link></td>
                  <td><span className="flex gap-1">{(post.platforms ?? []).map(platform => <ProviderIcon key={platform} provider={platform} size={15} />)}</span></td>
                  <td className="text-slate-600">{post.scheduled_at ? `${shortDateTime(post.scheduled_at)}, ${fmtTime(post.scheduled_at)}` : '—'}</td>
                  <td className="text-slate-600">{post.campaign_id ? campaigns.get(post.campaign_id) ?? '—' : '—'}</td>
                  <td><PostStatusBadge status={post.status} /></td>
                  <td className="text-right"><Kebab label={`${post.title ?? 'Post'} options`}><Link href={`${base}/posts/${post.id}`}>Open post</Link>{!['published', 'publishing', 'cancelled'].includes(post.status) && <Link href={`?compose=${post.id}`} scroll={false}>Edit or reschedule</Link>}</Kebab></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

const BOARD: { key: string; label: string; statuses: string[] }[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'review', label: 'Needs approval', statuses: ['pending_approval'] },
  { key: 'scheduled', label: 'Scheduled', statuses: ['approved', 'scheduled', 'queued', 'publishing'] },
  { key: 'published', label: 'Published', statuses: ['published', 'partially_published'] },
  { key: 'failed', label: 'Failed', statuses: ['failed'] },
]

function BoardView({ posts, base }: { posts: SocialPostRow[]; base: string }) {
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
      {BOARD.map(column => {
        const items = posts.filter(post => column.statuses.includes(post.status))
        return (
          <Card key={column.key} className="w-64 shrink-0 snap-start p-3 lg:w-auto" aria-label={`${column.label}, ${items.length} posts`}>
            <CardTitle level="h3" title={column.label} count={items.length} />
            <ul className="mt-2 space-y-2">
              {items.length === 0 && <li className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[12px] text-slate-400">No posts</li>}
              {items.map(post => (
                <li key={post.id}>
                  <Link href={`${base}/posts/${post.id}`} className="block rounded-lg border border-slate-100 p-2 hover:border-slate-200 hover:shadow-sm">
                    <span className="flex items-center gap-2"><Thumb src={post.thumbnail_url} size={28} /><span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-800 lg:text-[11px]">{post.title ?? 'Untitled post'}</span></span>
                    <span className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 lg:text-[9.5px]">
                      <span className="flex gap-1">{(post.platforms ?? []).map(platform => <ProviderIcon key={platform} provider={platform} size={13} decorative />)}</span>
                      {post.scheduled_at ? `${MONTH_DAY.format(new Date(post.scheduled_at))}, ${fmtTime(post.scheduled_at)}` : 'Unscheduled'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

