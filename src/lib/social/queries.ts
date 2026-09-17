// Server-side data access for the Social module.
//
// Every query is scoped by `workspace_id` from the resolved session — never by
// a client-supplied value — on top of the RLS policies that already restrict
// each table to workspace members. Missing data stays missing: a metric with
// no synced source returns null so the UI can say so rather than showing 0.

import 'server-only'
import type { SocialSession } from './server'
import {
  buildSeries, changePct, compactNumber, eachDay, engagementRate, isoDate,
  isInfluencerMention, mentionPriority, previousRange, shareOfVoice, slaStateFor, sum,
  type DateRange,
} from './metrics'
import { capabilitiesFor } from './providers'
import type {
  ConnectionHealth, DataSourceStatus, SocialChannelRow, SocialProvider, TimeseriesPoint,
} from '@/types/social'

// ── Shared ───────────────────────────────────────────────────────────────────

const CHANNEL_COLUMNS = `
  id, workspace_id, platform, account_name, handle, account_id, account_type,
  avatar_url, profile_url, follower_count, health, granted_scopes, required_scopes,
  permission_mode, team_label, token_status, token_expires_at, last_sync_at,
  last_sync_status, last_successful_sync_at, is_active, connected_at,
  disconnected_at, is_demo
`

export async function getChannels(session: SocialSession, includeInactive = false): Promise<SocialChannelRow[]> {
  let query = session.supabase
    .from('social_channels')
    .select(CHANNEL_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId)
    .order('platform')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data } = await query
  return (data ?? []) as unknown as SocialChannelRow[]
}

interface ChannelDailyRow {
  channel_id: string
  date: string
  total_reach: number | null
  total_impressions: number | null
  total_engagement: number | null
  follower_change: number | null
  follower_count: number | null
  posts_published: number | null
}

/** Optional narrowing shared by the aggregate queries: one connected channel. */
export interface ChannelScope { channelId?: string | null; platform?: string | null }

async function channelDaily(session: SocialSession, range: DateRange, scope: ChannelScope = {}): Promise<ChannelDailyRow[]> {
  let query = session.supabase
    .from('channel_analytics')
    .select('channel_id, date, total_reach, total_impressions, total_engagement, follower_change, follower_count, posts_published')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('date', isoDate(range.from))
    .lte('date', isoDate(range.to))
    .order('date')
  if (scope.channelId) query = query.eq('channel_id', scope.channelId)
  const { data } = await query
  return (data ?? []) as ChannelDailyRow[]
}

interface PostAnalyticsRow {
  post_id: string
  platform: string
  recorded_at: string
  impressions: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  clicks: number | null
  profile_visits: number | null
  video_views: number | null
  engagement_rate: number | null
}

async function postAnalytics(session: SocialSession, range: DateRange, scope: ChannelScope = {}): Promise<PostAnalyticsRow[]> {
  let query = session.supabase
    .from('post_analytics')
    .select('post_id, platform, recorded_at, impressions, reach, likes, comments, shares, saves, clicks, profile_visits, video_views, engagement_rate')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('recorded_at', range.from.toISOString())
    .lte('recorded_at', range.to.toISOString())
  // Post metrics carry the platform, not the channel; a channel scope narrows by platform.
  if (scope.platform) query = query.eq('platform', scope.platform)
  const { data } = await query
  return (data ?? []) as PostAnalyticsRow[]
}

function engagementsOf(row: PostAnalyticsRow): number {
  return (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0)
}

export function dataSourceStatuses(channels: SocialChannelRow[], range: DateRange): DataSourceStatus[] {
  return channels.map(channel => ({
    channelId: channel.id,
    provider: channel.platform,
    accountName: channel.account_name,
    lastSyncAt: channel.last_successful_sync_at ?? channel.last_sync_at,
    health: channel.health,
    incomplete: !channel.last_successful_sync_at
      || new Date(channel.last_successful_sync_at) < range.to,
  }))
}

// ── Aggregate totals shared by Overview and Analytics ────────────────────────

export interface PeriodTotals {
  reach: number
  impressions: number
  engagements: number
  engagementRate: number | null
  profileClicks: number
  linkClicks: number
  followerChange: number
  /** True when no rollup rows at all exist for the window. */
  empty: boolean
}

function totalsFrom(daily: ChannelDailyRow[], posts: PostAnalyticsRow[]): PeriodTotals {
  const reach = sum(daily.map(row => row.total_reach))
  const impressions = sum(daily.map(row => row.total_impressions))
  const engagements = sum(daily.map(row => row.total_engagement))
  return {
    reach,
    impressions,
    engagements,
    engagementRate: engagementRate(engagements, reach || impressions),
    profileClicks: sum(posts.map(row => row.profile_visits)),
    linkClicks: sum(posts.map(row => row.clicks)),
    followerChange: sum(daily.map(row => row.follower_change)),
    empty: daily.length === 0 && posts.length === 0,
  }
}

export async function getPeriodTotals(
  session: SocialSession,
  range: DateRange,
  scope: ChannelScope = {},
): Promise<{ current: PeriodTotals; previous: PeriodTotals; series: TimeseriesPoint[]; previousSeries: TimeseriesPoint[]; daily: ChannelDailyRow[] }> {
  const prev = previousRange(range)
  const [daily, prevDaily, posts, prevPosts] = await Promise.all([
    channelDaily(session, range, scope),
    channelDaily(session, prev, scope),
    postAnalytics(session, range, scope),
    postAnalytics(session, prev, scope),
  ])
  return {
    current: totalsFrom(daily, posts),
    previous: totalsFrom(prevDaily, prevPosts),
    series: buildSeries(range, daily),
    previousSeries: buildSeries(prev, prevDaily),
    daily,
  }
}

// ── Per-channel breakdown ────────────────────────────────────────────────────

export interface ChannelBreakdown {
  channel: SocialChannelRow
  reach: number
  impressions: number
  engagements: number
  engagementRate: number | null
  reachChangePct: number | null
  rateChangePp: number | null
  followerChange: number
  postsPublished: number
  series: { date: string; value: number }[]
  /** True when the channel has no rollup rows in the window. */
  noData: boolean
}

export async function getChannelBreakdown(
  session: SocialSession,
  range: DateRange,
  channels: SocialChannelRow[],
): Promise<ChannelBreakdown[]> {
  const prev = previousRange(range)
  const [daily, prevDaily] = await Promise.all([
    channelDaily(session, range),
    channelDaily(session, prev),
  ])
  const days = eachDay(range)

  return channels.map(channel => {
    const rows = daily.filter(row => row.channel_id === channel.id)
    const prevRows = prevDaily.filter(row => row.channel_id === channel.id)
    const reach = sum(rows.map(row => row.total_reach))
    const impressions = sum(rows.map(row => row.total_impressions))
    const engagements = sum(rows.map(row => row.total_engagement))
    const prevReach = sum(prevRows.map(row => row.total_reach))
    const prevEngagements = sum(prevRows.map(row => row.total_engagement))
    const rate = engagementRate(engagements, reach || impressions)
    const prevRate = engagementRate(prevEngagements, prevReach)
    const byDate = new Map(rows.map(row => [row.date, row]))

    return {
      channel,
      reach,
      impressions,
      engagements,
      engagementRate: rate,
      reachChangePct: prevRows.length === 0 ? null : changePct(reach, prevReach),
      rateChangePp: rate === null || prevRate === null ? null : (rate - prevRate) * 100,
      followerChange: sum(rows.map(row => row.follower_change)),
      postsPublished: sum(rows.map(row => row.posts_published)),
      series: days.map(date => ({ date, value: byDate.get(date)?.total_reach ?? 0 })),
      noData: rows.length === 0,
    }
  })
}

// ── Posts ────────────────────────────────────────────────────────────────────

export interface SocialPostRow {
  id: string
  title: string | null
  caption: string | null
  status: string
  post_type: string
  platforms: string[] | null
  channel_id: string | null
  campaign_id: string | null
  scheduled_at: string | null
  published_at: string | null
  thumbnail_url: string | null
  media_urls: string[] | null
  owner_id: string | null
  created_by: string | null
  approval_required: boolean | null
  approved_at: string | null
  failure_summary: string | null
  updated_at: string
  timezone: string
  is_demo: boolean
}

const POST_COLUMNS = `
  id, title, caption, status, post_type, platforms, channel_id, campaign_id,
  scheduled_at, published_at, thumbnail_url, media_urls, owner_id, created_by,
  approval_required, approved_at, failure_summary, updated_at, timezone, is_demo
`

export async function getPostsInRange(
  session: SocialSession,
  range: DateRange,
  options: { statuses?: string[]; column?: 'scheduled_at' | 'published_at'; limit?: number } = {},
): Promise<SocialPostRow[]> {
  const column = options.column ?? 'scheduled_at'
  let query = session.supabase
    .from('content_posts')
    .select(POST_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId)
    .gte(column, range.from.toISOString())
    .lte(column, range.to.toISOString())
    .order(column, { ascending: column === 'scheduled_at' })
  if (options.statuses?.length) query = query.in('status', options.statuses)
  if (options.limit) query = query.limit(options.limit)
  const { data } = await query
  return (data ?? []) as unknown as SocialPostRow[]
}

export async function getRecentPublishedPosts(
  session: SocialSession,
  limit = 5,
  platform?: string | null,
): Promise<{ post: SocialPostRow; reach: number; engagementRate: number | null }[]> {
  let query = session.supabase
    .from('content_posts')
    .select(POST_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId)
    .in('status', ['published', 'partially_published'])
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (platform) query = query.contains('platforms', [platform])
  const { data } = await query
  const posts = (data ?? []) as unknown as SocialPostRow[]
  if (posts.length === 0) return []

  const { data: analytics } = await session.supabase
    .from('post_analytics')
    .select('post_id, reach, impressions, likes, comments, shares, saves')
    .eq('workspace_id', session.ctx.workspaceId)
    .in('post_id', posts.map(post => post.id))

  return posts.map(post => {
    const rows = (analytics ?? []).filter(row => row.post_id === post.id) as PostAnalyticsRow[]
    const reach = sum(rows.map(row => row.reach))
    const engagements = sum(rows.map(row => engagementsOf(row)))
    return { post, reach, engagementRate: rows.length ? engagementRate(engagements, reach) : null }
  })
}

export async function getUpcomingPosts(session: SocialSession, limit = 6, statuses: string[] = ['scheduled', 'queued', 'approved', 'pending_approval']): Promise<SocialPostRow[]> {
  const { data } = await session.supabase
    .from('content_posts')
    .select(POST_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId)
    .in('status', statuses)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(limit)
  return (data ?? []) as unknown as SocialPostRow[]
}

// ── Publishing ───────────────────────────────────────────────────────────────

export interface QueueRow {
  id: string
  post_id: string
  channel_id: string
  scheduled_at: string
  status: string
  attempt_count: number
  max_attempts: number
  failure_type: string | null
  error_message: string | null
  provider_permalink: string | null
  next_attempt_at: string | null
  sent_at: string | null
}

export async function getPublishingQueue(session: SocialSession, limit = 200): Promise<QueueRow[]> {
  const { data } = await session.supabase
    .from('publishing_queue')
    .select('id, post_id, channel_id, scheduled_at, status, attempt_count, max_attempts, failure_type, error_message, provider_permalink, next_attempt_at, sent_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('scheduled_at')
    .limit(limit)
  return (data ?? []) as QueueRow[]
}

export interface ChannelPublishingSummary {
  channel: SocialChannelRow
  scheduled: number
  drafts: number
  needsApproval: number
  changePct: number | null
  series: { date: string; value: number }[]
}

export async function getChannelPublishingSummary(
  session: SocialSession,
  range: DateRange,
  channels: SocialChannelRow[],
): Promise<ChannelPublishingSummary[]> {
  const prev = previousRange(range)
  const [{ data: current }, { data: earlier }] = await Promise.all([
    session.supabase.from('content_posts')
      .select('id, status, channel_id, platforms, scheduled_at')
      .eq('workspace_id', session.ctx.workspaceId)
      .gte('scheduled_at', range.from.toISOString()).lte('scheduled_at', range.to.toISOString()),
    session.supabase.from('content_posts')
      .select('id, status, channel_id, platforms, scheduled_at')
      .eq('workspace_id', session.ctx.workspaceId)
      .gte('scheduled_at', prev.from.toISOString()).lte('scheduled_at', prev.to.toISOString()),
  ])

  type Row = { id: string; status: string; channel_id: string | null; platforms: string[] | null; scheduled_at: string | null }
  const rows = (current ?? []) as Row[]
  const prevRows = (earlier ?? []) as Row[]
  const days = eachDay(range)

  const matches = (row: Row, channel: SocialChannelRow) =>
    row.channel_id === channel.id || (row.platforms ?? []).includes(channel.platform)

  return channels.map(channel => {
    const mine = rows.filter(row => matches(row, channel))
    const minePrev = prevRows.filter(row => matches(row, channel))
    const scheduled = mine.filter(row => ['scheduled', 'queued', 'approved', 'publishing'].includes(row.status)).length
    const prevScheduled = minePrev.filter(row => ['scheduled', 'queued', 'approved', 'publishing'].includes(row.status)).length
    return {
      channel,
      scheduled,
      drafts: mine.filter(row => row.status === 'draft').length,
      needsApproval: mine.filter(row => row.status === 'pending_approval').length,
      changePct: minePrev.length === 0 ? null : changePct(scheduled, prevScheduled),
      series: days.map(date => ({
        date,
        value: mine.filter(row => row.scheduled_at?.slice(0, 10) === date).length,
      })),
    }
  })
}

export async function getApprovalQueue(session: SocialSession, limit = 10) {
  const { data } = await session.supabase
    .from('content_posts')
    .select(`${POST_COLUMNS}, requester:profiles!content_posts_created_by_fkey(id, full_name, avatar_url)`)
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('status', 'pending_approval')
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as unknown as (SocialPostRow & {
    requester: { id: string; full_name: string | null; avatar_url: string | null } | null
  })[]
}

export interface ActivityRow {
  id: string
  actor_id: string | null
  actor_kind: string
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  detail: string | null
  href: string | null
  severity: string
  created_at: string
  actor: { full_name: string | null; avatar_url: string | null } | null
}

export async function getSocialActivity(
  session: SocialSession,
  options: { limit?: number; entityTypes?: string[] } = {},
): Promise<ActivityRow[]> {
  let query = session.supabase
    .from('social_activity')
    .select('id, actor_id, actor_kind, action, entity_type, entity_id, summary, detail, href, severity, created_at, actor:profiles(full_name, avatar_url)')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 8)
  if (options.entityTypes?.length) query = query.in('entity_type', options.entityTypes)
  const { data } = await query
  return (data ?? []) as unknown as ActivityRow[]
}

export interface PublishingAlert {
  id: string
  severity: 'info' | 'warning' | 'error'
  title: string
  detail: string
  actionLabel: string | null
  href: string | null
  at: string
}

/** Real publishing problems, derived from the queue and connection issues. */
export async function getPublishingAlerts(session: SocialSession): Promise<PublishingAlert[]> {
  const [{ data: failed }, { data: issues }, { count: pendingApproval }] = await Promise.all([
    session.supabase.from('publishing_queue')
      .select('id, failure_type, error_message, last_attempt_at, next_attempt_at, post_id')
      .eq('workspace_id', session.ctx.workspaceId).eq('status', 'failed')
      .order('last_attempt_at', { ascending: false }).limit(10),
    session.supabase.from('social_connection_issues')
      .select('id, issue_type, severity, message, detected_at, channel_id')
      .eq('workspace_id', session.ctx.workspaceId).eq('status', 'open')
      .order('detected_at', { ascending: false }).limit(10),
    session.supabase.from('content_posts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', session.ctx.workspaceId).eq('status', 'pending_approval'),
  ])

  const alerts: PublishingAlert[] = []
  const failedRows = failed ?? []
  if (failedRows.length > 0) {
    alerts.push({
      id: 'failed-posts',
      severity: 'error',
      title: `${failedRows.length} post${failedRows.length === 1 ? '' : 's'} failed to publish`,
      detail: failedRows[0].error_message ?? 'Open the queue to review the provider error.',
      actionLabel: 'View details',
      href: `${session.basePath}/publishing?view=queue&status=failed`,
      at: failedRows[0].last_attempt_at ?? new Date().toISOString(),
    })
  }
  for (const issue of issues ?? []) {
    alerts.push({
      id: issue.id,
      severity: issue.severity === 'error' ? 'error' : 'warning',
      title: issue.message,
      detail: ISSUE_HINTS[issue.issue_type as keyof typeof ISSUE_HINTS] ?? 'Open Connections to resolve.',
      actionLabel: 'Open connection',
      href: `${session.basePath}/connections?channel=${issue.channel_id ?? ''}`,
      at: issue.detected_at,
    })
  }
  if ((pendingApproval ?? 0) > 0) {
    alerts.push({
      id: 'pending-approval',
      severity: 'info',
      title: `${pendingApproval} post${pendingApproval === 1 ? '' : 's'} pending approval`,
      detail: 'Approvals block scheduled delivery until they are cleared.',
      actionLabel: 'Review now',
      href: `${session.basePath}/publishing?view=list&approval=pending`,
      at: new Date().toISOString(),
    })
  }
  return alerts
}

const ISSUE_HINTS = {
  token_expiring: 'Renew the token before it expires to avoid failed publishes.',
  token_expired: 'Re-authenticate this channel to resume publishing and syncing.',
  missing_role: 'The connected user needs a page or channel role from the provider.',
  missing_permission: 'A required permission was not granted during authorisation.',
  scope_removed: 'A previously granted scope has been withdrawn by the provider.',
  webhook_disabled: 'Realtime events are paused for this channel.',
  sync_partial_failure: 'The last sync completed with errors — some records may be stale.',
  rate_limit: 'The provider is rate limiting this account. Requests will retry automatically.',
  provider_outage: 'The provider reported an outage. Retries continue in the background.',
  account_disconnected: 'This account is disconnected. Reconnect it to restore access.',
} as const

// ── Engagement ───────────────────────────────────────────────────────────────

export interface ConversationRow {
  id: string
  channel_id: string | null
  platform: string | null
  type: string
  sender_name: string | null
  sender_handle: string | null
  sender_avatar: string | null
  content: string | null
  status: string
  sentiment: string | null
  sentiment_source: string
  sentiment_confidence: number | null
  assigned_to: string | null
  is_read: boolean
  is_flagged: boolean
  flag_reason: string | null
  priority: string
  tags: string[]
  first_response_at: string | null
  resolved_at: string | null
  sla_target_minutes: number
  sla_state: string
  related_post_id: string | null
  external_post_url: string | null
  created_at: string
  updated_at: string
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
}

const CONVERSATION_COLUMNS = `
  id, channel_id, platform, type, sender_name, sender_handle, sender_avatar, content,
  status, sentiment, sentiment_source, sentiment_confidence, assigned_to, is_read,
  is_flagged, flag_reason, priority, tags, first_response_at, resolved_at,
  sla_target_minutes, sla_state, related_post_id, external_post_url, created_at, updated_at,
  assignee:profiles!inbox_threads_assigned_to_fkey(id, full_name, avatar_url)
`

export interface ConversationFilters {
  view: 'feed' | 'inbox' | 'threads' | 'assigned' | 'all' | 'flagged'
  channelId?: string
  assigneeId?: string
  sentiment?: string
  search?: string
  sort?: 'newest' | 'oldest' | 'priority'
  page?: number
  pageSize?: number
}

export async function getConversations(
  session: SocialSession,
  range: DateRange,
  filters: ConversationFilters,
): Promise<{ rows: ConversationRow[]; total: number }> {
  const pageSize = filters.pageSize ?? 25
  const page = Math.max(1, filters.page ?? 1)

  let query = session.supabase
    .from('inbox_threads')
    .select(CONVERSATION_COLUMNS, { count: 'exact' })
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())

  switch (filters.view) {
    case 'inbox': query = query.eq('is_read', false).neq('status', 'resolved'); break
    case 'threads': query = query.eq('type', 'dm'); break
    case 'assigned': query = query.not('assigned_to', 'is', null); break
    case 'flagged': query = query.eq('is_flagged', true); break
    case 'feed': query = query.neq('status', 'spam'); break
    default: break
  }
  if (filters.channelId) query = query.eq('channel_id', filters.channelId)
  if (filters.assigneeId) query = query.eq('assigned_to', filters.assigneeId)
  if (filters.sentiment) query = query.eq('sentiment', filters.sentiment)
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.or(`content.ilike.%${term}%,sender_name.ilike.%${term}%,sender_handle.ilike.%${term}%`)
  }

  if (filters.sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (filters.sort === 'priority') query = query.order('priority', { ascending: false }).order('created_at', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const { data, count } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  return { rows: (data ?? []) as unknown as ConversationRow[], total: count ?? 0 }
}

export async function getConversation(session: SocialSession, id: string) {
  const { data } = await session.supabase
    .from('inbox_threads')
    .select(CONVERSATION_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('id', id)
    .maybeSingle()
  if (!data) return null

  const [{ data: messages }, { data: post }] = await Promise.all([
    session.supabase.from('inbox_messages')
      .select('id, content, sender_type, sent_by, sent_at, is_internal_note, delivery_status, failure_reason, is_ai_generated, author:profiles!inbox_messages_sent_by_fkey(full_name, avatar_url)')
      .eq('workspace_id', session.ctx.workspaceId).eq('thread_id', id).order('sent_at'),
    (data as unknown as ConversationRow).related_post_id
      ? session.supabase.from('content_posts').select(POST_COLUMNS)
          .eq('workspace_id', session.ctx.workspaceId)
          .eq('id', (data as unknown as ConversationRow).related_post_id!).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    conversation: data as unknown as ConversationRow,
    messages: (messages ?? []) as unknown as {
      id: string; content: string; sender_type: string; sent_by: string | null; sent_at: string
      is_internal_note: boolean; delivery_status: string; failure_reason: string | null
      is_ai_generated: boolean; author: { full_name: string | null; avatar_url: string | null } | null
    }[],
    post: (post ?? null) as unknown as SocialPostRow | null,
  }
}

export interface EngagementTotals {
  unread: number
  mentions: number
  averageResponseMinutes: number | null
  resolved: number
  sentimentPositivePct: number | null
  sentimentLabel: string
  slaMetPct: number | null
  previous: {
    unread: number; mentions: number; averageResponseMinutes: number | null
    resolved: number; sentimentPositivePct: number | null; slaMetPct: number | null
  }
}

interface SlaRow { created_at: string; first_response_at: string | null; sla_target_minutes: number; sentiment: string | null; type: string; is_read: boolean; status: string }

async function engagementRows(session: SocialSession, range: DateRange): Promise<SlaRow[]> {
  const { data } = await session.supabase
    .from('inbox_threads')
    .select('created_at, first_response_at, sla_target_minutes, sentiment, type, is_read, status')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())
  return (data ?? []) as SlaRow[]
}

function summariseEngagement(rows: SlaRow[]) {
  const responded = rows.filter(row => row.first_response_at)
  const responseMinutes = responded.map(row =>
    (new Date(row.first_response_at!).getTime() - new Date(row.created_at).getTime()) / 60000)
  const withSentiment = rows.filter(row => row.sentiment)
  const met = responded.filter(row =>
    slaStateFor({ createdAt: row.created_at, firstResponseAt: row.first_response_at, targetMinutes: row.sla_target_minutes }) === 'met')
  return {
    unread: rows.filter(row => !row.is_read).length,
    mentions: rows.filter(row => row.type === 'mention').length,
    averageResponseMinutes: responseMinutes.length ? sum(responseMinutes) / responseMinutes.length : null,
    resolved: rows.filter(row => row.status === 'resolved' || row.status === 'done').length,
    sentimentPositivePct: withSentiment.length
      ? withSentiment.filter(row => row.sentiment === 'positive').length / withSentiment.length
      : null,
    slaMetPct: responded.length ? met.length / responded.length : null,
  }
}

export async function getEngagementTotals(session: SocialSession, range: DateRange): Promise<EngagementTotals> {
  const [rows, prevRows] = await Promise.all([
    engagementRows(session, range),
    engagementRows(session, previousRange(range)),
  ])
  const current = summariseEngagement(rows)
  const previous = summariseEngagement(prevRows)
  const positive = current.sentimentPositivePct
  return {
    ...current,
    sentimentLabel: positive === null ? 'No data'
      : positive >= 0.6 ? 'Positive' : positive >= 0.4 ? 'Mixed' : 'Negative',
    previous,
  }
}

export async function getResponseAnalytics(session: SocialSession, range: DateRange) {
  const rows = await engagementRows(session, range)
  const days = eachDay(range)
  return days.map(date => {
    const dayRows = rows.filter(row => row.created_at.slice(0, 10) === date)
    return {
      date,
      conversations: dayRows.length,
      responses: dayRows.filter(row => row.first_response_at).length,
    }
  })
}

export async function getTeamWorkload(session: SocialSession) {
  const [{ data: members }, { data: threads }] = await Promise.all([
    session.supabase.from('workspace_members')
      .select('user_id, role, profiles!workspace_members_user_id_fkey(id, full_name, avatar_url)')
      .eq('workspace_id', session.ctx.workspaceId),
    session.supabase.from('inbox_threads')
      .select('assigned_to, status, first_response_at, created_at, sla_target_minutes')
      .eq('workspace_id', session.ctx.workspaceId)
      .not('assigned_to', 'is', null),
  ])

  type Member = { user_id: string; profiles: { id: string; full_name: string | null; avatar_url: string | null } | null }
  const rows = (threads ?? []) as { assigned_to: string; status: string; first_response_at: string | null; created_at: string; sla_target_minutes: number }[]

  return ((members ?? []) as unknown as Member[])
    .map(member => {
      const mine = rows.filter(row => row.assigned_to === member.user_id)
      const responded = mine.filter(row => row.first_response_at)
      const met = responded.filter(row =>
        slaStateFor({ createdAt: row.created_at, firstResponseAt: row.first_response_at, targetMinutes: row.sla_target_minutes }) === 'met')
      return {
        userId: member.user_id,
        name: member.profiles?.full_name ?? 'Teammate',
        avatarUrl: member.profiles?.avatar_url ?? null,
        assigned: mine.length,
        slaPct: responded.length ? met.length / responded.length : null,
      }
    })
    .filter(row => row.assigned > 0)
    .sort((a, b) => b.assigned - a.assigned)
}

export async function getFlaggedConversations(session: SocialSession, limit = 5) {
  const { data } = await session.supabase
    .from('inbox_threads')
    .select('id, sender_name, sender_handle, sender_avatar, content, sentiment, flag_reason, created_at, platform')
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('is_flagged', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getReplyTemplates(session: SocialSession) {
  const { data } = await session.supabase
    .from('saved_replies')
    .select('id, title, content, category, platforms, is_shared, usage_count')
    .eq('workspace_id', session.ctx.workspaceId)
    .is('archived_at', null)
    .order('usage_count', { ascending: false })
  return data ?? []
}

export async function getWorkspaceMembers(session: SocialSession) {
  const { data } = await session.supabase
    .from('workspace_members')
    .select('user_id, role, profiles!workspace_members_user_id_fkey(id, full_name, avatar_url)')
    .eq('workspace_id', session.ctx.workspaceId)
  type Row = { user_id: string; role: string; profiles: { id: string; full_name: string | null; avatar_url: string | null } | null }
  return ((data ?? []) as unknown as Row[]).map(row => ({
    id: row.user_id,
    name: row.profiles?.full_name ?? 'Teammate',
    avatarUrl: row.profiles?.avatar_url ?? null,
    role: row.role,
  }))
}

// ── Listening ────────────────────────────────────────────────────────────────

export interface MentionRow {
  id: string
  keyword_id: string | null
  platform: string
  source_type: string
  source_key: string | null
  author_name: string | null
  author_handle: string | null
  author_avatar_url: string | null
  author_followers: number | null
  author_verified: boolean
  content: string
  url: string | null
  sentiment: string
  reach_estimate: number | null
  engagement_count: number
  engagement_rate: number | null
  priority: string
  topic: string | null
  country_code: string | null
  is_read: boolean
  is_starred: boolean
  is_influencer: boolean
  mentioned_at: string
}

const MENTION_COLUMNS = `
  id, keyword_id, platform, source_type, source_key, author_name, author_handle,
  author_avatar_url, author_followers, author_verified, content, url, sentiment,
  reach_estimate, engagement_count, engagement_rate, priority, topic, country_code,
  is_read, is_starred, is_influencer, mentioned_at
`

export interface MentionFilters {
  tab: 'all' | 'unread' | 'favourites' | 'high_priority'
  search?: string
  source?: string
  sentiment?: string
  page?: number
  pageSize?: number
}

export async function getMentions(
  session: SocialSession,
  range: DateRange,
  filters: MentionFilters,
): Promise<{ rows: MentionRow[]; total: number }> {
  const pageSize = filters.pageSize ?? 5
  const page = Math.max(1, filters.page ?? 1)

  let query = session.supabase
    .from('brand_mentions')
    .select(MENTION_COLUMNS, { count: 'exact' })
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('mentioned_at', range.from.toISOString())
    .lte('mentioned_at', range.to.toISOString())

  if (filters.tab === 'unread') query = query.eq('is_read', false)
  if (filters.tab === 'favourites') query = query.eq('is_starred', true)
  if (filters.tab === 'high_priority') query = query.eq('priority', 'high')
  if (filters.source) query = query.eq('platform', filters.source)
  if (filters.sentiment) query = query.eq('sentiment', filters.sentiment)
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.or(`content.ilike.%${term}%,author_name.ilike.%${term}%,author_handle.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('mentioned_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  return { rows: (data ?? []) as MentionRow[], total: count ?? 0 }
}

export async function getListeningTotals(session: SocialSession, range: DateRange) {
  const prev = previousRange(range)
  const [{ data: rows }, { data: prevRows }, { data: topics }, { data: alerts }] = await Promise.all([
    session.supabase.from('brand_mentions')
      .select('sentiment, reach_estimate, is_influencer, mentioned_at, topic, country_code, platform, source_type')
      .eq('workspace_id', session.ctx.workspaceId)
      .gte('mentioned_at', range.from.toISOString()).lte('mentioned_at', range.to.toISOString()),
    session.supabase.from('brand_mentions')
      .select('sentiment, is_influencer, mentioned_at')
      .eq('workspace_id', session.ctx.workspaceId)
      .gte('mentioned_at', prev.from.toISOString()).lte('mentioned_at', prev.to.toISOString()),
    session.supabase.from('listening_topics')
      .select('id, label, summary, mention_count, growth_pct, computed_at')
      .eq('workspace_id', session.ctx.workspaceId)
      .order('mention_count', { ascending: false }).limit(6),
    session.supabase.from('listening_alerts')
      .select('id, alert_type, title, message, severity, status, triggered_at')
      .eq('workspace_id', session.ctx.workspaceId).eq('status', 'active')
      .order('triggered_at', { ascending: false }).limit(6),
  ])

  type Row = { sentiment: string; reach_estimate: number | null; is_influencer: boolean; mentioned_at: string; topic: string | null; country_code: string | null; platform: string; source_type: string }
  const current = (rows ?? []) as Row[]
  const earlier = (prevRows ?? []) as { sentiment: string; is_influencer: boolean; mentioned_at: string }[]

  const positive = current.filter(row => row.sentiment === 'positive').length
  const neutral = current.filter(row => row.sentiment === 'neutral').length
  const negative = current.filter(row => row.sentiment === 'negative').length
  const total = current.length

  return {
    total,
    previousTotal: earlier.length,
    changePct: earlier.length === 0 ? null : changePct(total, earlier.length),
    sentiment: {
      positive, neutral, negative,
      positivePct: total ? positive / total : null,
      neutralPct: total ? neutral / total : null,
      negativePct: total ? negative / total : null,
      previousPositivePct: earlier.length ? earlier.filter(row => row.sentiment === 'positive').length / earlier.length : null,
    },
    influencerMentions: current.filter(row => row.is_influencer).length,
    previousInfluencerMentions: earlier.filter(row => row.is_influencer).length,
    topics: (topics ?? []) as { id: string; label: string; summary: string | null; mention_count: number; growth_pct: number | null; computed_at: string }[],
    alerts: (alerts ?? []) as { id: string; alert_type: string; title: string; message: string | null; severity: string; status: string; triggered_at: string }[],
    rows: current,
  }
}

export async function getSentimentSeries(session: SocialSession, range: DateRange) {
  const { data } = await session.supabase
    .from('brand_mentions')
    .select('sentiment, mentioned_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('mentioned_at', range.from.toISOString())
    .lte('mentioned_at', range.to.toISOString())
  const rows = (data ?? []) as { sentiment: string; mentioned_at: string }[]
  return eachDay(range).map(date => {
    const day = rows.filter(row => row.mentioned_at.slice(0, 10) === date)
    return {
      date,
      positive: day.filter(row => row.sentiment === 'positive').length,
      neutral: day.filter(row => row.sentiment === 'neutral').length,
      negative: day.filter(row => row.sentiment === 'negative').length,
    }
  })
}

export async function getListeningSources(session: SocialSession) {
  const { data } = await session.supabase
    .from('listening_sources')
    .select('id, source_key, label, source_type, coverage_note, mention_count, share_pct, is_enabled, last_seen_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('mention_count', { ascending: false })
  return data ?? []
}

export async function getListeningKeywords(session: SocialSession) {
  const { data } = await session.supabase
    .from('listening_keywords')
    .select('id, keyword, match_type, platforms, is_active, topic, color')
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('is_active', true)
    .order('keyword')
  return data ?? []
}

export async function getListeningAlertRules(session: SocialSession) {
  const { data } = await session.supabase
    .from('listening_alert_rules')
    .select('id, name, keywords, channels, sources, sentiments, severity, frequency, is_active, created_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('created_at', { ascending: false })
  return data ?? []
}

/** Share of voice across the workspace's own brand and tracked competitors. */
export async function getShareOfVoice(session: SocialSession, range: DateRange, brandLabel: string) {
  const [{ data: mentions }, { data: competitors }] = await Promise.all([
    session.supabase.from('brand_mentions')
      .select('content, keyword_id, mentioned_at')
      .eq('workspace_id', session.ctx.workspaceId)
      .gte('mentioned_at', range.from.toISOString()).lte('mentioned_at', range.to.toISOString()),
    session.supabase.from('competitor_profiles')
      .select('id, competitor_name').eq('workspace_id', session.ctx.workspaceId).eq('is_active', true),
  ])
  const rows = (mentions ?? []) as { content: string }[]
  const rivals = ((competitors ?? []) as { id: string; competitor_name: string }[])
    .map(row => ({ id: row.id, name: row.competitor_name }))
  if (rows.length === 0) return { rows: [], method: 'No mentions in this window.' }

  const counts: Record<string, number> = { [brandLabel]: 0 }
  for (const rival of rivals) counts[rival.name] = 0
  let others = 0
  for (const row of rows) {
    const text = (row.content ?? '').toLowerCase()
    const rival = rivals.find(item => text.includes(item.name.toLowerCase()))
    if (rival) counts[rival.name] += 1
    else if (text.includes(brandLabel.toLowerCase())) counts[brandLabel] += 1
    else others += 1
  }
  if (others > 0) counts['Others'] = others

  return {
    rows: shareOfVoice({ counts }),
    method: `Mentions matching the workspace keyword set across ${rivals.length + 1} tracked brands, ${rows.length} mentions in range. Unattributed mentions are grouped as Others.`,
  }
}

export async function getMentionsByCountry(session: SocialSession, range: DateRange) {
  const { data } = await session.supabase
    .from('brand_mentions')
    .select('country_code')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('mentioned_at', range.from.toISOString())
    .lte('mentioned_at', range.to.toISOString())
  const rows = (data ?? []) as { country_code: string | null }[]
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = row.country_code ?? 'UNKNOWN'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = rows.length
  return {
    total,
    buckets: [...counts.entries()]
      .map(([code, count]) => ({ code, count, share: total ? count / total : 0 }))
      .sort((a, b) => b.count - a.count),
  }
}

// ── Connections ──────────────────────────────────────────────────────────────

export async function getSyncRuns(session: SocialSession, limit = 20) {
  const { data } = await session.supabase
    .from('social_sync_runs')
    .select('id, channel_id, kind, status, trigger_source, records_synced, error_type, error_message, started_at, finished_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('started_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getWebhookEvents(session: SocialSession, limit = 12) {
  const { data } = await session.supabase
    .from('social_webhook_events')
    .select('id, channel_id, provider, event_type, summary, status, received_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('received_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getConnectionIssues(session: SocialSession) {
  const { data } = await session.supabase
    .from('social_connection_issues')
    .select('id, channel_id, issue_type, severity, message, action_kind, status, detected_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .eq('status', 'open')
    .order('detected_at', { ascending: false })
  return (data ?? []).map(issue => ({
    ...issue,
    hint: ISSUE_HINTS[issue.issue_type as keyof typeof ISSUE_HINTS] ?? null,
  }))
}

export async function getConnectionHealthSeries(session: SocialSession, range: DateRange) {
  const { data } = await session.supabase
    .from('social_sync_runs')
    .select('status, started_at, channel_id')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('started_at', range.from.toISOString())
    .lte('started_at', range.to.toISOString())
  const rows = (data ?? []) as { status: string; started_at: string; channel_id: string }[]
  return eachDay(range).map(date => {
    const day = rows.filter(row => row.started_at.slice(0, 10) === date)
    return {
      date,
      healthy: day.filter(row => row.status === 'success').length,
      warning: day.filter(row => row.status === 'partial').length,
      error: day.filter(row => row.status === 'failed').length,
    }
  })
}

/** Per-channel sync success rate over the window — the "Health by Channel" bars. */
export async function getHealthByChannel(session: SocialSession, range: DateRange, channels: SocialChannelRow[]) {
  const { data } = await session.supabase
    .from('social_sync_runs')
    .select('status, channel_id')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('started_at', range.from.toISOString())
    .lte('started_at', range.to.toISOString())
  const rows = (data ?? []) as { status: string; channel_id: string }[]
  return channels.map(channel => {
    const mine = rows.filter(row => row.channel_id === channel.id)
    const ok = mine.filter(row => row.status === 'success').length
    return {
      channel,
      total: mine.length,
      successPct: mine.length ? ok / mine.length : null,
    }
  })
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface ContentPerformanceRow {
  post: SocialPostRow
  reach: number
  impressions: number
  engagements: number
  engagementRate: number | null
  linkClicks: number
  hasMetrics: boolean
}

export async function getContentPerformance(
  session: SocialSession,
  range: DateRange,
  options: { postType?: string; limit?: number } = {},
): Promise<ContentPerformanceRow[]> {
  let query = session.supabase
    .from('content_posts')
    .select(POST_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId)
    .in('status', ['published', 'partially_published'])
    .gte('published_at', range.from.toISOString())
    .lte('published_at', range.to.toISOString())
    .order('published_at', { ascending: false })
  if (options.postType) query = query.eq('post_type', options.postType)
  const { data } = await query.limit(options.limit ?? 50)
  const posts = (data ?? []) as unknown as SocialPostRow[]
  if (posts.length === 0) return []

  const { data: analytics } = await session.supabase
    .from('post_analytics')
    .select('post_id, reach, impressions, likes, comments, shares, saves, clicks')
    .eq('workspace_id', session.ctx.workspaceId)
    .in('post_id', posts.map(post => post.id))

  return posts.map(post => {
    const rows = ((analytics ?? []) as PostAnalyticsRow[]).filter(row => row.post_id === post.id)
    const reach = sum(rows.map(row => row.reach))
    const impressions = sum(rows.map(row => row.impressions))
    const engagements = sum(rows.map(row => engagementsOf(row)))
    return {
      post,
      reach,
      impressions,
      engagements,
      engagementRate: rows.length ? engagementRate(engagements, reach || impressions) : null,
      linkClicks: sum(rows.map(row => row.clicks)),
      hasMetrics: rows.length > 0,
    }
  })
}

export async function getEngagementBreakdown(session: SocialSession, range: DateRange) {
  const rows = await postAnalytics(session, range)
  if (rows.length === 0) return null
  const likes = sum(rows.map(row => row.likes))
  const comments = sum(rows.map(row => row.comments))
  const shares = sum(rows.map(row => row.shares))
  const saves = sum(rows.map(row => row.saves))
  const total = likes + comments + shares + saves
  if (total === 0) return null
  return {
    total,
    parts: [
      { key: 'likes', label: 'Likes', value: likes, share: likes / total },
      { key: 'comments', label: 'Comments', value: comments, share: comments / total },
      { key: 'shares', label: 'Shares', value: shares, share: shares / total },
      { key: 'saves', label: 'Saves', value: saves, share: saves / total },
    ],
  }
}

export interface AudienceBucket { bucket: string; value: number; share: number }

export async function getAudienceDemographics(
  session: SocialSession,
  range: DateRange,
  channels: SocialChannelRow[],
): Promise<{ dimension: string; buckets: AudienceBucket[]; supported: boolean; note: string | null }[]> {
  const { data } = await session.supabase
    .from('social_audience_metrics')
    .select('dimension, bucket, value, channel_id')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('date', isoDate(range.from))
    .lte('date', isoDate(range.to))
  const rows = (data ?? []) as { dimension: string; bucket: string; value: number; channel_id: string | null }[]

  const supportedDimensions = new Set(
    channels.flatMap(channel => capabilitiesFor(channel.platform).audienceDimensions),
  )
  const unsupported = channels.filter(channel => capabilitiesFor(channel.platform).audienceDimensions.length === 0)

  return (['country', 'age', 'gender'] as const).map(dimension => {
    const mine = rows.filter(row => row.dimension === dimension)
    const totals = new Map<string, number>()
    for (const row of mine) totals.set(row.bucket, (totals.get(row.bucket) ?? 0) + row.value)
    const total = sum([...totals.values()])
    return {
      dimension,
      supported: supportedDimensions.has(dimension),
      buckets: [...totals.entries()]
        .map(([bucket, value]) => ({ bucket, value, share: total ? value / total : 0 }))
        .sort((a, b) => b.value - a.value),
      note: unsupported.length
        ? `${unsupported.map(channel => channel.account_name).join(', ')} do not return audience demographics — those followers are excluded.`
        : null,
    }
  })
}

export async function getReportPresets(session: SocialSession) {
  const [{ data: presets }, { data: scheduled }] = await Promise.all([
    session.supabase.from('social_report_presets')
      .select('id, name, description, config, is_default, updated_at')
      .eq('workspace_id', session.ctx.workspaceId).order('is_default', { ascending: false }),
    session.supabase.from('scheduled_reports')
      .select('id, name, frequency, day_of_week, day_of_month, send_time, is_active, next_send_at, preset_id, format')
      .eq('workspace_id', session.ctx.workspaceId).order('created_at', { ascending: false }),
  ])
  return {
    presets: (presets ?? []) as { id: string; name: string; description: string | null; config: Record<string, unknown>; is_default: boolean; updated_at: string }[],
    scheduled: (scheduled ?? []) as { id: string; name: string; frequency: string; day_of_week: number | null; day_of_month: number | null; send_time: string | null; is_active: boolean; next_send_at: string | null; preset_id: string | null; format: string }[],
  }
}

/**
 * Rule-based analytics observations. Every insight names the rule that produced
 * it and links to the records behind it — no causal claims are invented.
 */
export interface AnalyticsInsight {
  id: string
  title: string
  detail: string
  method: string
  href: string
}

export function buildInsights(input: {
  /** Canonical Social base path, e.g. `/brand/social`, for evidence links. */
  basePath: string
  totals: PeriodTotals
  previous: PeriodTotals
  breakdown: ChannelBreakdown[]
  series: TimeseriesPoint[]
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  const reachChange = changePct(input.totals.reach, input.previous.reach)
  if (reachChange !== null && Math.abs(reachChange) >= 5) {
    const leaders = [...input.breakdown]
      .filter(row => row.reachChangePct !== null)
      .sort((a, b) => (b.reachChangePct ?? 0) - (a.reachChangePct ?? 0))
      .slice(0, 2)
    insights.push({
      id: 'reach-change',
      title: `Reach is ${reachChange >= 0 ? 'up' : 'down'} ${Math.abs(reachChange).toFixed(1)}%`,
      detail: leaders.length
        ? `Largest movement on ${leaders.map(row => row.channel.account_name).join(' and ')}.`
        : 'Compared with the previous period of the same length.',
      method: 'Rule: period-over-period reach change of 5% or more.',
      href: `${input.basePath}/analytics?view=channels`,
    })
  }

  const rate = input.totals.engagementRate
  const prevRate = input.previous.engagementRate
  if (rate !== null && prevRate !== null && Math.abs(rate - prevRate) >= 0.001) {
    const best = [...input.breakdown]
      .filter(row => row.rateChangePp !== null)
      .sort((a, b) => (b.rateChangePp ?? 0) - (a.rateChangePp ?? 0))[0]
    insights.push({
      id: 'engagement-rate',
      title: `Engagement rate ${rate >= prevRate ? 'improving' : 'softening'}`,
      detail: `${((rate - prevRate) * 100).toFixed(2)}pp versus the previous period${best ? `, with ${best.channel.account_name} moving most` : ''}.`,
      method: 'Rule: engagement-rate delta of 0.1pp or more, using each provider’s own denominator.',
      href: `${input.basePath}/analytics?view=channels`,
    })
  }

  const byWeekday = new Map<number, { engagements: number; days: number }>()
  for (const point of input.series) {
    const weekday = new Date(`${point.date}T12:00:00Z`).getUTCDay()
    const entry = byWeekday.get(weekday) ?? { engagements: 0, days: 0 }
    entry.engagements += point.engagements
    entry.days += 1
    byWeekday.set(weekday, entry)
  }
  const bestDay = [...byWeekday.entries()]
    .filter(([, entry]) => entry.days > 0)
    .sort((a, b) => b[1].engagements / b[1].days - a[1].engagements / a[1].days)[0]
  if (bestDay && bestDay[1].engagements > 0) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    insights.push({
      id: 'best-day',
      title: `Best posting day: ${names[bestDay[0]]}`,
      detail: `${names[bestDay[0]]}s averaged ${compactNumber(bestDay[1].engagements / bestDay[1].days)} engagements per day in this window.`,
      method: 'Rule: highest mean daily engagements by weekday across the selected range.',
      href: `${input.basePath}/publishing?view=calendar`,
    })
  }

  return insights
}

// ── Overview engagement feed ─────────────────────────────────────────────────

export async function getEngagementFeed(
  session: SocialSession,
  filter: 'all' | 'comment' | 'dm' | 'mention',
  channelId: string | undefined,
  limit = 6,
) {
  let query = session.supabase
    .from('inbox_threads')
    .select('id, type, platform, channel_id, sender_name, sender_handle, sender_avatar, content, created_at, is_read')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (filter !== 'all') query = query.eq('type', filter)
  if (channelId) query = query.eq('channel_id', channelId)
  const { data } = await query
  return data ?? []
}

export { engagementsOf, isInfluencerMention, mentionPriority }
export type { ConnectionHealth, SocialProvider }
