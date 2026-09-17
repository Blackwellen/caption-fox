import 'server-only'
import type { SocialSession } from './server'
import type { DateRange } from './metrics'

// Extra reads for Social Publishing that the shared query layer does not
// cover: campaign names for post rows, week-over-week published/engagement
// totals and the next queued posts per channel. All workspace-scoped.

export async function getCampaignNames(session: SocialSession, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()
  const { data } = await session.supabase.from('campaigns').select('id, name')
    .eq('workspace_id', session.ctx.workspaceId).in('id', unique)
  return new Map((data ?? []).map(row => [row.id as string, row.name as string]))
}

export async function getPublishingTotals(session: SocialSession, range: DateRange, previous: DateRange) {
  const workspaceId = session.ctx.workspaceId
  const count = (status: string[], column: 'scheduled_at' | 'published_at', window: DateRange) => session.supabase
    .from('content_posts').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).in('status', status)
    .gte(column, window.from.toISOString()).lte(column, window.to.toISOString())
  const engagement = async (window: DateRange) => {
    const { data } = await session.supabase.from('post_analytics')
      .select('likes, comments, shares, saves')
      .eq('workspace_id', workspaceId)
      .gte('recorded_at', window.from.toISOString()).lte('recorded_at', window.to.toISOString())
    return (data ?? []).reduce((sum, row) => sum + (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0), 0)
  }
  const scheduledStatuses = ['scheduled', 'queued', 'approved', 'publishing', 'published', 'partially_published']
  const [scheduled, scheduledPrev, published, publishedPrev, engaged, engagedPrev] = await Promise.all([
    count(scheduledStatuses, 'scheduled_at', range), count(scheduledStatuses, 'scheduled_at', previous),
    count(['published', 'partially_published'], 'published_at', range), count(['published', 'partially_published'], 'published_at', previous),
    engagement(range), engagement(previous),
  ])
  return {
    scheduled: scheduled.count ?? 0, scheduledPrev: scheduledPrev.count ?? 0,
    published: published.count ?? 0, publishedPrev: publishedPrev.count ?? 0,
    engagement: engaged, engagementPrev: engagedPrev,
  }
}

export interface QueuedByChannel { channelId: string; count: number; thumbs: { postId: string; url: string | null }[] }

/** Upcoming queued deliveries grouped per channel, with the next few post thumbnails. */
export async function getQueuedByChannel(session: SocialSession): Promise<QueuedByChannel[]> {
  const { data } = await session.supabase.from('publishing_queue')
    .select('channel_id, post_id, scheduled_at, post:content_posts(thumbnail_url)')
    .eq('workspace_id', session.ctx.workspaceId).eq('status', 'queued')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at').limit(500)
  type Row = { channel_id: string; post_id: string; post: { thumbnail_url: string | null } | null }
  const groups = new Map<string, QueuedByChannel>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const group = groups.get(row.channel_id) ?? { channelId: row.channel_id, count: 0, thumbs: [] }
    group.count += 1
    if (group.thumbs.length < 5) group.thumbs.push({ postId: row.post_id, url: row.post?.thumbnail_url ?? null })
    groups.set(row.channel_id, group)
  }
  return [...groups.values()]
}

export interface QueueListRow {
  id: string; post_id: string; channel_id: string; scheduled_at: string; status: string
  attempt_count: number; max_attempts: number; error_message: string | null; next_attempt_at: string | null
  post: { title: string | null; thumbnail_url: string | null } | null
  channel: { platform: string; handle: string | null; account_name: string } | null
}

export async function getQueueList(session: SocialSession, options: { status?: string | null; channelId?: string | null; limit?: number }): Promise<QueueListRow[]> {
  let query = session.supabase.from('publishing_queue')
    .select('id, post_id, channel_id, scheduled_at, status, attempt_count, max_attempts, error_message, next_attempt_at, post:content_posts(title, thumbnail_url), channel:social_channels!publishing_queue_channel_id_fkey(platform, handle, account_name)')
    .eq('workspace_id', session.ctx.workspaceId)
    .order('scheduled_at', { ascending: false }).order('id')
    .limit(options.limit ?? 100)
  if (options.status) query = query.eq('status', options.status)
  if (options.channelId) query = query.eq('channel_id', options.channelId)
  const { data } = await query
  return (data ?? []) as unknown as QueueListRow[]
}
