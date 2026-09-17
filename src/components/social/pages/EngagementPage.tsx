import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AtSign, CalendarDays, Check, ChevronDown, Clock3, Flag, Inbox, LayoutList, MessageCircle, MessagesSquare, Rss, Smile, Target, UserCheck, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getChannels, getConversation, getConversations, getEngagementTotals, getFlaggedConversations, getReplyTemplates,
  getResponseAnalytics, getTeamWorkload, getWorkspaceMembers, type ConversationRow,
} from '@/lib/social/queries'
import { getEngagementTabCounts } from '@/lib/social/engagement-queries'
import { capabilitiesFor } from '@/lib/social/providers'
import { changePct, formatDuration, formatRangeLabel, previousRange, rangeFromDays, shortDay } from '@/lib/social/metrics'
import { parseDays, parseEnum, parseId, parseSearch, withParams } from '@/lib/social/url-state'
import type { SocialProvider } from '@/types/social'
import type { SocialPageProps } from '../SocialRoute'
import { SocialHeader } from '../Header'
import { Ago, Avatar, Badge, Card, CardTitle, Delta, EmptyNote, fmtDateTime, LineChart, PROVIDER_NAMES, ProviderIcon, TextLink, type Tone } from '../kit'
import { FieldSelect, FilterPopover, Menu, PillSelect, SearchBox } from '../controls'
import { ReplyComposer, ThreadHeaderControls } from '../engagement/ThreadControls'

// /{type}/social/engagement — Social Engagement, built to design reference (3).
// Header filters · view tabs with live counts · KPI strip · Conversations list |
// selected conversation with reply composer | Response Analytics, Team
// Workload and Flagged Conversations. The selected thread is `?conversation=`.

const VIEWS = ['feed', 'inbox', 'threads', 'assigned', 'all', 'flagged'] as const
const TYPE_TAG: Record<string, { label: string; tone: Tone }> = {
  comment: { label: 'Comment', tone: 'blue' }, dm: { label: 'DM', tone: 'blue' }, mention: { label: 'Mention', tone: 'blue' }, message: { label: 'Message', tone: 'blue' },
}
const EXTRA_TAG: Record<string, Tone> = { Question: 'orange', Lead: 'orange', Escalation: 'red', Positive: 'green' }
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default async function EngagementPage({ session, searchParams, nav }: SocialPageProps) {
  const base = session.basePath
  const days = parseDays(searchParams.days)
  const range = rangeFromDays(days)
  const prev = previousRange(range)
  const view = parseEnum(searchParams.view, VIEWS, 'feed')
  const sort = parseEnum(searchParams.sort, ['newest', 'oldest', 'priority'] as const, 'newest')
  const sentiment = parseEnum(searchParams.sentiment, ['', 'positive', 'neutral', 'negative'] as const, '') || null
  const channelId = parseId(searchParams.channel)
  const assigneeId = parseId(searchParams.assignee)
  const channelType = parseEnum(searchParams.channelType, ['', 'instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'x'] as const, '') || null
  const search = parseSearch(searchParams.q)

  const channels = await getChannels(session)
  const scopedChannelId = channelId ?? (channelType ? channels.find(channel => channel.platform === channelType)?.id ?? null : null)

  const [totals, list, counts, analytics, workload, flagged, members, templates] = await Promise.all([
    getEngagementTotals(session, range),
    getConversations(session, range, {
      view, sort, search: search ?? undefined, sentiment: sentiment ?? undefined,
      channelId: scopedChannelId ?? undefined, assigneeId: assigneeId ?? undefined, pageSize: 40,
    }),
    getEngagementTabCounts(session, range, { channelId: scopedChannelId, assigneeId, sentiment }),
    getResponseAnalytics(session, range),
    getTeamWorkload(session),
    getFlaggedConversations(session, 3),
    getWorkspaceMembers(session),
    getReplyTemplates(session),
  ])

  const selectedId = parseId(searchParams.conversation) ?? list.rows[0]?.id ?? null
  const selected = selectedId ? await getConversation(session, selectedId) : null
  const thread = selected?.conversation ?? null

  const previous = totals.previous
  const kpis: { label: string; value: ReactNode; delta: number | null; unit?: '%' | 'pp'; inverse?: boolean; icon: ReactNode; sub?: string; valueClass?: string }[] = [
    { label: 'Unread Messages', value: totals.unread.toLocaleString('en-GB'), delta: changePct(totals.unread, previous.unread || null), inverse: true, icon: <MessageCircle size={18} /> },
    { label: 'Mentions', value: totals.mentions.toLocaleString('en-GB'), delta: changePct(totals.mentions, previous.mentions || null), icon: <AtSign size={18} /> },
    { label: 'Avg. Response Time', value: formatDuration(totals.averageResponseMinutes), delta: totals.averageResponseMinutes !== null && previous.averageResponseMinutes ? changePct(totals.averageResponseMinutes, previous.averageResponseMinutes) : null, inverse: true, icon: <Clock3 size={18} /> },
    { label: 'Resolved Conversations', value: totals.resolved.toLocaleString('en-GB'), delta: changePct(totals.resolved, previous.resolved || null), icon: <Check size={18} /> },
    { label: 'Overall Sentiment', value: totals.sentimentLabel, sub: totals.sentimentPositivePct === null ? undefined : `${Math.round(totals.sentimentPositivePct * 100)}%`, delta: null, icon: <Smile size={18} />, valueClass: totals.sentimentLabel === 'Positive' ? 'text-emerald-600' : totals.sentimentLabel === 'Negative' ? 'text-red-600' : 'text-amber-600' },
    { label: 'Engagement SLA', value: totals.slaMetPct === null ? '—' : `${Math.round(totals.slaMetPct * 100)}%`, delta: totals.slaMetPct !== null && previous.slaMetPct !== null ? (totals.slaMetPct - previous.slaMetPct) * 100 : null, unit: 'pp', icon: <Target size={18} /> },
  ]
  const compareLabel = `vs ${MONTH_DAY.format(prev.from)} – ${MONTH_DAY.format(prev.to)}`

  const responses = analytics.reduce((sum, day) => sum + day.responses, 0)
  const conversations = analytics.reduce((sum, day) => sum + day.conversations, 0)
  const maxWorkload = Math.max(1, ...workload.map(row => row.assigned))
  const channelOptions = channels.map(channel => ({ value: channel.id, label: `${PROVIDER_NAMES[channel.platform]} · ${channel.handle ?? channel.account_name}` }))
  const memberOptions = members.map(member => ({ value: member.id, label: member.name }))
  const tabs: { value: (typeof VIEWS)[number]; label: string; count: number | null; icon: ReactNode }[] = [
    { value: 'feed', label: 'Feed', count: null, icon: <Rss size={14} aria-hidden /> },
    { value: 'inbox', label: 'Inbox', count: counts.inbox, icon: <Inbox size={14} aria-hidden /> },
    { value: 'threads', label: 'Threads', count: null, icon: <MessagesSquare size={14} aria-hidden /> },
    { value: 'assigned', label: 'Assigned', count: counts.assigned, icon: <UserCheck size={14} aria-hidden /> },
    { value: 'all', label: 'All', count: null, icon: <LayoutList size={14} aria-hidden /> },
    { value: 'flagged', label: 'Flagged', count: counts.flagged, icon: <Flag size={14} aria-hidden /> },
  ]

  return (
    <>
      <SocialHeader
        title="Social Engagement"
        subtitle="Manage comments, DMs, mentions, and audience responses in one place."
        nav={nav}
        note={false}
        actions={(
          <>
            <PillSelect paramKey="days" label={`Date range, currently ${formatRangeLabel(range)}`} defaultValue="7" icon={<CalendarDays size={14} className="text-slate-500" aria-hidden />}
              options={[{ value: '7', label: formatRangeLabel(range) }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} className="min-w-[176px]" />
            <PillSelect paramKey="channel" label="Channel" allLabel="All Channels" options={channelOptions} className="min-w-[126px]" />
            <PillSelect paramKey="assignee" label="Assignee" allLabel="All Assignees" icon={<Users size={14} className="text-slate-500" aria-hidden />} options={memberOptions} className="min-w-[136px]" />
            <PillSelect paramKey="sentiment" label="Sentiment" allLabel="All Sentiment" icon={<Smile size={14} className="text-slate-500" aria-hidden />}
              options={[{ value: 'positive', label: 'Positive' }, { value: 'neutral', label: 'Neutral' }, { value: 'negative', label: 'Negative' }]} className="min-w-[136px]" />
            <div className="inline-flex rounded-lg shadow-sm">
              <Link href={withParams(searchParams, { view: 'inbox', conversation: null })} scroll={false}
                className="inline-flex h-10 items-center gap-2 rounded-l-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 lg:h-[34px] lg:text-[11.5px]">
                <Inbox size={14} aria-hidden /> Open Inbox
              </Link>
              <Menu label="More inbox actions" width="w-56" triggerClassName="inline-flex h-10 items-center rounded-r-lg border-l border-white/25 bg-blue-600 px-2.5 text-white hover:bg-blue-700 lg:h-[34px]" trigger={<ChevronDown size={15} aria-hidden />}>
                <Link href={withParams(searchParams, { view: 'flagged', conversation: null })}>Flagged conversations</Link>
                <Link href={withParams(searchParams, { view: 'assigned', assignee: session.userId, conversation: null })}>Assigned to me</Link>
                {session.can(PERMISSIONS.SOCIAL_ANALYTICS_EXPORT) && <a href={`/api/social/export?${new URLSearchParams({ dataset: 'engagement', format: 'csv', days: String(days), view })}`} download>Export conversations (CSV)</a>}
              </Menu>
            </div>
          </>
        )}
      />

      <Card className="px-3 pt-1 xl:px-3">
        <div role="tablist" aria-label="Conversation views" className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 [scrollbar-width:none]">
          {tabs.map(tab => {
            const active = tab.value === view
            return (
              <Link key={tab.value} role="tab" aria-selected={active} scroll={false} href={withParams(searchParams, { view: tab.value === 'feed' ? null : tab.value, conversation: null })}
                className={cn('-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium lg:h-[40px] lg:px-4 lg:text-[11px]', active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900')}>
                {tab.icon}{tab.label}
                {tab.count !== null && <span className={cn('rounded px-1.5 text-[11px] tabular-nums lg:text-[9.5px]', active ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600')}>{tab.count}</span>}
              </Link>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 py-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-[14px] xl:py-[13px]">
          {kpis.map(kpi => (
            <div key={kpi.label} className="flex gap-3 rounded-xl border border-slate-100 px-3 py-3 xl:h-[106px] xl:px-4 xl:py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 xl:h-[32px] xl:w-[32px]" aria-hidden>{kpi.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-[12px] text-slate-600 lg:text-[9.5px]">{kpi.label}</p>
                <p className={cn('mt-1 whitespace-nowrap text-[21px] font-semibold leading-none text-slate-900 tabular-nums lg:text-[21px]', kpi.valueClass)}>{kpi.value}</p>
                <p className="mt-1.5 text-[11px] lg:text-[9.5px]">{kpi.sub ? <span className="font-medium text-slate-700">{kpi.sub}</span> : <Delta value={kpi.delta} unit={kpi.unit} inverse={kpi.inverse} />}</p>
                <p className="mt-1 truncate text-[10.5px] text-slate-400 lg:text-[8.5px]">{compareLabel}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] xl:grid-cols-[312fr_516fr_335fr] xl:gap-[16px]">
        {/* Conversations */}
        <Card className="flex flex-col p-3 xl:h-[622px] xl:px-2 xl:pt-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 lg:text-[11.5px]">Conversations <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500 lg:text-[9px]">{list.total}</span></h2>
            <div className="flex items-center gap-1.5">
              <PillSelect compact paramKey="sort" label="Sort conversations" defaultValue="newest" options={[{ value: 'newest', label: 'Sort: Newest' }, { value: 'oldest', label: 'Sort: Oldest' }, { value: 'priority', label: 'Sort: Priority' }]} className="min-w-[80px]" />
              <FilterPopover activeCount={[search, channelType].filter(Boolean).length} clearKeys={['q', 'channelType']}
                className="[&>button]:h-8 [&>button]:px-2 [&>button]:text-[12px] lg:[&>button]:h-[22px] lg:[&>button]:text-[9px]">
                <SearchBox placeholder="Search conversations" />
                <FieldSelect paramKey="channelType" label="Platform" allLabel="All platforms" options={['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'x'].map(value => ({ value, label: PROVIDER_NAMES[value] }))} />
              </FilterPopover>
            </div>
          </div>
          {list.rows.length === 0 ? (
            <EmptyNote className="mt-3 flex-1" title="No conversations here" description={search || sentiment || channelId || assigneeId ? 'Try clearing filters or widening the date range.' : 'Comments, DMs and mentions from connected channels arrive here.'} />
          ) : (
            <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]" aria-label="Conversations">
              {list.rows.map(row => <ConversationItem key={row.id} row={row} active={row.id === selectedId} href={withParams(searchParams, { conversation: row.id })} />)}
            </ul>
          )}
        </Card>

        {/* Selected conversation */}
        <Card className="flex flex-col p-4 xl:h-[622px] xl:px-4 xl:pb-3 xl:pt-3">
          {!selected || !thread ? (
            <EmptyNote className="flex-1" title="Select a conversation" description="Choose a comment, DM or mention to read the thread and reply." />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar src={thread.sender_avatar} name={thread.sender_name} size={32} />
                  <div className="min-w-0">
                    <Link href={`${base}/conversations/${thread.id}`} className="block truncate text-[13px] font-semibold text-slate-900 hover:underline lg:text-[10.5px]">{thread.sender_handle ?? thread.sender_name}</Link>
                    <p className="truncate text-[11.5px] text-slate-500 lg:text-[9px]">
                      {thread.platform ? PROVIDER_NAMES[thread.platform] : 'Channel'} <span aria-hidden>•</span> {thread.type === 'dm' ? 'Message' : thread.type === 'mention' ? 'Mention' : 'Comment'} on {fmtDateTime(thread.created_at)}
                    </p>
                  </div>
                </div>
                <ThreadHeaderControls
                  conversationId={thread.id} sentiment={thread.sentiment} status={thread.status} isFlagged={thread.is_flagged}
                  assignedTo={thread.assigned_to} members={members.map(member => ({ id: member.id, name: member.name }))}
                  detailHref={`${base}/conversations/${thread.id}`}
                  can={{ assign: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_ASSIGN), resolve: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_RESOLVE), moderate: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_MODERATE) }}
                />
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {selected.post && (
                  <Link href={`${base}/posts/${selected.post.id}`} className="flex w-full max-w-[370px] gap-3 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 lg:ml-3">
                    {selected.post.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element -- storage-backed post media
                      <img src={selected.post.thumbnail_url} alt="" className="h-[92px] w-[92px] shrink-0 rounded-md object-cover" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-[11px] text-slate-500 lg:text-[8.5px]">{session.workspace.name}</span>
                      <span className="mt-1 block text-[13px] font-semibold text-slate-900 lg:text-[11px]">{selected.post.title ?? 'Untitled post'}</span>
                      <span className="mt-1 line-clamp-2 block text-[12px] text-slate-600 lg:text-[9px]">{selected.post.caption}</span>
                      {selected.post.published_at && <span className="mt-2 block text-[11px] text-slate-400 lg:text-[8.5px]">{fmtDateTime(selected.post.published_at)}</span>}
                    </span>
                  </Link>
                )}
                <ol className="space-y-3">
                  {selected.messages.map(message => {
                    const mine = message.sender_type !== 'external'
                    return (
                      <li key={message.id} className={cn('flex gap-2', mine && 'justify-end')}>
                        {!mine && <Avatar src={thread.sender_avatar} name={thread.sender_name} size={28} />}
                        <div className={cn('max-w-[78%] rounded-xl px-3 py-2 text-[13px] lg:text-[10px]',
                          message.is_internal_note ? 'border border-amber-200 bg-amber-50 text-amber-900' : mine ? 'border border-blue-100 bg-blue-50/70 text-slate-800' : 'border border-slate-100 bg-slate-50 text-slate-800')}>
                          <p className="flex items-baseline justify-between gap-6 font-semibold text-slate-900">
                            <span>{message.is_internal_note ? 'Internal note' : mine ? (message.sent_by === session.userId ? 'You' : message.author?.full_name ?? 'Your team') : thread.sender_handle}</span>
                            <Ago iso={message.sent_at} className="text-[11px] font-normal text-slate-400 lg:text-[8.5px]" />
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                          {mine && !message.is_internal_note && (
                            <p className="mt-0.5 text-right text-[11px] text-slate-400 lg:text-[8.5px]">{message.delivery_status === 'sent' ? '✓ Delivered' : message.delivery_status === 'failed' ? 'Failed to send' : 'Sending…'}</p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {thread.assignee && (
                  <p className="flex items-center gap-2 text-[11.5px] text-slate-500 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200 lg:text-[9px]">
                    Assigned to {thread.assigned_to === session.userId ? 'you' : thread.assignee.full_name}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <ReplyComposer
                  key={thread.id}
                  conversationId={thread.id} sentiment={thread.sentiment} tags={thread.tags}
                  templates={(templates as { id: string; title: string; content: string }[]).map(({ id, title, content }) => ({ id, title, content }))}
                  canReply={session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_REPLY)}
                  dmSupported={thread.platform ? capabilitiesFor(thread.platform as SocialProvider).sendDirectMessages : false}
                />
              </div>
            </>
          )}
        </Card>

        {/* Right rail */}
        <div className="grid min-w-0 content-start gap-4 md:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:grid-cols-1 xl:gap-[14px]">
          <Card className="p-3.5 xl:h-[222px]">
            <CardTitle title="Response Analytics">
              <PillSelect compact paramKey="days" label="Analytics range" defaultValue="7" options={[{ value: '7', label: '7 Days' }, { value: '14', label: '14 Days' }, { value: '30', label: '30 Days' }]} className="min-w-[58px]" />
            </CardTitle>
            <dl className="mt-2.5 grid grid-cols-4 gap-2 text-[11px] lg:text-[8.5px]">
              <div><dt className="text-slate-500">Conversations</dt><dd className="mt-0.5 text-[13px] font-semibold text-slate-900 lg:text-[11px]">{conversations}</dd></div>
              <div><dt className="text-slate-500">Responses</dt><dd className="mt-0.5 text-[13px] font-semibold text-slate-900 lg:text-[11px]">{responses}</dd></div>
              <div><dt className="whitespace-nowrap text-slate-500">Avg. Response</dt><dd className="mt-0.5 text-[13px] font-semibold text-slate-900 lg:text-[11px]">{formatDuration(totals.averageResponseMinutes)}</dd></div>
              <div><dt className="text-slate-500">SLA Met</dt><dd className="mt-0.5 text-[13px] font-semibold text-slate-900 lg:text-[11px]">{totals.slaMetPct === null ? '—' : `${Math.round(totals.slaMetPct * 100)}%`}</dd></div>
            </dl>
            <LineChart
              className="mt-2" height={80}
              labels={analytics.map(day => shortDay(day.date))}
              series={[
                { key: 'conversations', label: 'Conversations', color: '#3B6FF5', values: analytics.map(day => day.conversations) },
                { key: 'responses', label: 'Responses', color: '#22C55E', values: analytics.map(day => day.responses) },
              ]}
              summary={`${conversations} conversations and ${responses} responses over the period`}
            />
          </Card>

          <Card className="p-3.5 xl:h-[180px]">
            <CardTitle title="Team Workload" hint="Assigned conversations per teammate, with the share answered within SLA."><TextLink href={withParams(searchParams, { view: 'assigned', conversation: null })}>View All</TextLink></CardTitle>
            {workload.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">No conversations are assigned yet.</p> : (
              <ul className="mt-2 space-y-2 lg:space-y-[9px]">
                {workload.slice(0, 5).map(row => (
                  <li key={row.userId}>
                    <Link href={withParams(searchParams, { view: 'assigned', assignee: row.userId, conversation: null })} className="grid grid-cols-[1fr_24px_minmax(0,1.4fr)_32px] items-center gap-2 text-[12px] hover:opacity-80 lg:text-[9px]">
                      <span className="flex min-w-0 items-center gap-1.5"><Avatar src={row.avatarUrl} name={row.name} size={18} /><span className="truncate text-slate-700">{row.name}</span></span>
                      <span className="text-right font-medium tabular-nums text-slate-700">{row.assigned}</span>
                      <span className="h-[5px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(row.assigned / maxWorkload) * 100}%` }} /></span>
                      <span className="text-right tabular-nums text-slate-500">{row.slaPct === null ? '—' : `${Math.round(row.slaPct * 100)}%`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-3.5 xl:h-[192px]">
            <CardTitle title="Flagged Conversations" count={counts.flagged}><TextLink href={withParams(searchParams, { view: 'flagged', conversation: null })}>View All</TextLink></CardTitle>
            {flagged.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">Nothing is flagged for review.</p> : (
              <ul className="mt-2 divide-y divide-slate-100">
                {flagged.map(row => (
                  <li key={row.id}>
                    <Link href={withParams(searchParams, { conversation: row.id })} className="flex items-center gap-2 py-2 hover:bg-slate-50/70 lg:py-[9px]">
                      <span className="relative shrink-0">
                        <Avatar src={row.sender_avatar} name={row.sender_name} size={26} />
                        {row.platform && <ProviderIcon provider={row.platform} size={11} decorative className="absolute -bottom-0.5 -right-0.5 rounded-sm ring-1 ring-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-slate-800 lg:text-[9.5px]">{row.sender_handle ?? row.sender_name}</span>
                        <span className="block truncate text-[11px] text-slate-500 lg:text-[8.5px]">{row.flag_reason ?? row.content}</span>
                      </span>
                      <Badge tone={row.sentiment === 'negative' ? 'red' : 'orange'}>{row.sentiment === 'negative' ? 'Negative' : 'Needs Review'}</Badge>
                      <Ago iso={row.created_at} className="w-7 text-right text-[11px] text-slate-400 lg:text-[8.5px]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function ConversationItem({ row, active, href }: { row: ConversationRow; active: boolean; href: string }) {
  const type = TYPE_TAG[row.type] ?? { label: row.type, tone: 'blue' as Tone }
  const extra = row.tags.find(tag => !['Comment', 'DM', 'Mention', 'Message'].includes(tag))
  const sentimentTag = row.sentiment === 'positive' ? 'Positive' : row.sentiment === 'negative' ? 'Negative' : null
  const second = extra ?? sentimentTag
  return (
    <li>
      <Link href={href} scroll={false} aria-current={active ? 'true' : undefined}
        className={cn('flex gap-2.5 rounded-lg border px-2.5 py-2.5 transition-colors lg:py-[9px]', active ? 'border-blue-200 bg-blue-50/60' : 'border-transparent hover:bg-slate-50')}>
        <span className="relative shrink-0">
          <Avatar src={row.sender_avatar} name={row.sender_name} size={34} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {row.platform && <ProviderIcon provider={row.platform} size={13} />}
            <span className={cn('min-w-0 flex-1 truncate text-[13px] text-slate-900 lg:text-[10.5px]', row.is_read ? 'font-medium' : 'font-semibold')}>{row.sender_handle ?? row.sender_name}</span>
            <Ago iso={row.created_at} className="text-[11px] text-slate-400 lg:text-[8.5px]" />
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 lg:text-[9.5px]">{row.content}</span>
            {!row.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
          </span>
          <span className="mt-1.5 flex gap-1">
            <Badge tone={type.tone}>{type.label}</Badge>
            {second && <Badge tone={second === 'Negative' ? 'red' : EXTRA_TAG[second] ?? 'green'}>{second}</Badge>}
          </span>
        </span>
      </Link>
    </li>
  )
}
