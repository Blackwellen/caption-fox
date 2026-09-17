import 'server-only'
import type { SocialSession } from './server'
import type { SocialChannelRow } from '@/types/social'
import type { MentionRow, SocialPostRow } from './queries'

// Record loaders for the Social detail routes. Every read is filtered by the
// session's workspace in addition to RLS, so an id from another workspace
// resolves to "not found" rather than leaking that the record exists.

export interface DeliveryRow {
  id: string; channel_id: string; status: string; attempt_count: number; max_attempts: number
  scheduled_at: string; last_attempt_at: string | null; sent_at: string | null
  failure_type: string | null; error_message: string | null; provider_post_id: string | null
  channel: { account_name: string; handle: string | null; platform: string } | null
}

export interface ActivityItem {
  id: string; action: string; summary: string; detail: string | null; severity: string
  actor_kind: string; created_at: string; actor: { full_name: string | null } | null
}

const ACTIVITY_COLUMNS = 'id, action, summary, detail, severity, actor_kind, created_at, actor:profiles!social_activity_actor_id_fkey(full_name)'

async function activityFor(session: SocialSession, entityId: string): Promise<ActivityItem[]> {
  const { data, error } = await session.supabase.from('social_activity')
    .select(ACTIVITY_COLUMNS)
    .eq('workspace_id', session.ctx.workspaceId).eq('entity_id', entityId)
    .order('created_at', { ascending: false }).limit(20)
  if (error) {
    // Fall back without the actor join if the FK name differs in this database.
    const { data: plain } = await session.supabase.from('social_activity')
      .select('id, action, summary, detail, severity, actor_kind, created_at')
      .eq('workspace_id', session.ctx.workspaceId).eq('entity_id', entityId)
      .order('created_at', { ascending: false }).limit(20)
    return ((plain ?? []) as Omit<ActivityItem, 'actor'>[]).map(row => ({ ...row, actor: null }))
  }
  return (data ?? []) as unknown as ActivityItem[]
}

export async function getPostDetail(session: SocialSession, id: string) {
  const workspaceId = session.ctx.workspaceId
  const { data: post } = await session.supabase.from('content_posts')
    .select('id, title, caption, status, post_type, platforms, channel_id, campaign_id, scheduled_at, published_at, thumbnail_url, media_urls, owner_id, created_by, approval_required, approved_at, failure_summary, updated_at, timezone, is_demo, hashtags, created_at')
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!post) return null

  const [{ data: deliveries }, { data: metrics }, activity, { data: campaign }, { data: owner }] = await Promise.all([
    session.supabase.from('publishing_queue')
      .select('id, channel_id, status, attempt_count, max_attempts, scheduled_at, last_attempt_at, sent_at, failure_type, error_message, provider_post_id, channel:social_channels!publishing_queue_channel_id_fkey(account_name, handle, platform)')
      .eq('workspace_id', workspaceId).eq('post_id', id).order('scheduled_at', { ascending: false }).limit(50),
    session.supabase.from('post_analytics')
      .select('platform, recorded_at, impressions, reach, likes, comments, shares, saves, clicks, profile_visits, video_views, engagement_rate')
      .eq('workspace_id', workspaceId).eq('post_id', id).order('recorded_at', { ascending: false }).limit(20),
    activityFor(session, id),
    post.campaign_id
      ? session.supabase.from('campaigns').select('id, name').eq('workspace_id', workspaceId).eq('id', post.campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
    post.owner_id
      ? session.supabase.from('profiles').select('full_name, avatar_url').eq('id', post.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    post: post as unknown as SocialPostRow & { hashtags: string[] | null; created_at: string },
    deliveries: (deliveries ?? []) as unknown as DeliveryRow[],
    metrics: (metrics ?? []) as {
      platform: string; recorded_at: string; impressions: number | null; reach: number | null; likes: number | null
      comments: number | null; shares: number | null; saves: number | null; clicks: number | null
      profile_visits: number | null; video_views: number | null; engagement_rate: number | null
    }[],
    activity,
    campaign: campaign as { id: string; name: string } | null,
    owner: owner as { full_name: string | null; avatar_url: string | null } | null,
  }
}

export async function getChannelDetail(session: SocialSession, id: string) {
  const workspaceId = session.ctx.workspaceId
  const { data: channel } = await session.supabase.from('social_channels')
    .select('id, workspace_id, platform, account_name, handle, account_id, account_type, avatar_url, profile_url, follower_count, health, granted_scopes, required_scopes, permission_mode, team_label, token_status, token_expires_at, last_sync_at, last_sync_status, last_successful_sync_at, is_active, connected_at, disconnected_at, is_demo')
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!channel) return null

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [{ data: runs }, { data: issues }, { data: events }, { data: daily }, activity] = await Promise.all([
    session.supabase.from('social_sync_runs')
      .select('id, kind, status, trigger_source, records_synced, error_type, error_message, started_at, finished_at')
      .eq('workspace_id', workspaceId).eq('channel_id', id).order('started_at', { ascending: false }).limit(15),
    session.supabase.from('social_connection_issues')
      .select('id, issue_type, severity, message, status, detected_at')
      .eq('workspace_id', workspaceId).eq('channel_id', id).eq('status', 'open').order('detected_at', { ascending: false }),
    session.supabase.from('social_webhook_events')
      .select('id, event_type, summary, status, received_at')
      .eq('workspace_id', workspaceId).eq('channel_id', id).order('received_at', { ascending: false }).limit(10),
    session.supabase.from('channel_analytics')
      .select('date, total_reach, total_impressions, total_engagement, follower_change, follower_count')
      .eq('workspace_id', workspaceId).eq('channel_id', id).gte('date', since).order('date'),
    activityFor(session, id),
  ])

  return {
    channel: channel as unknown as SocialChannelRow,
    runs: (runs ?? []) as {
      id: string; kind: string; status: string; trigger_source: string; records_synced: number | null
      error_type: string | null; error_message: string | null; started_at: string; finished_at: string | null
    }[],
    issues: (issues ?? []) as { id: string; issue_type: string; severity: string; message: string; status: string; detected_at: string }[],
    events: (events ?? []) as { id: string; event_type: string; summary: string | null; status: string; received_at: string }[],
    daily: (daily ?? []) as {
      date: string; total_reach: number | null; total_impressions: number | null; total_engagement: number | null
      follower_change: number | null; follower_count: number | null
    }[],
    activity,
  }
}

export async function getMentionDetail(session: SocialSession, id: string) {
  const workspaceId = session.ctx.workspaceId
  const { data: mention } = await session.supabase.from('brand_mentions')
    .select('id, keyword_id, platform, source_type, source_key, author_name, author_handle, author_avatar_url, author_followers, author_verified, content, url, sentiment, reach_estimate, engagement_count, engagement_rate, priority, topic, country_code, is_read, is_starred, is_influencer, mentioned_at, is_actioned')
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!mention) return null

  const row = mention as unknown as MentionRow & { is_actioned: boolean | null }
  const [{ data: keyword }, { data: related }] = await Promise.all([
    row.keyword_id
      ? session.supabase.from('listening_keywords').select('keyword').eq('workspace_id', workspaceId).eq('id', row.keyword_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.author_handle
      ? session.supabase.from('brand_mentions')
          .select('id, platform, content, sentiment, mentioned_at')
          .eq('workspace_id', workspaceId).eq('author_handle', row.author_handle).neq('id', id)
          .order('mentioned_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ])
  return {
    mention: row,
    keyword: (keyword as { keyword: string } | null)?.keyword ?? null,
    related: (related ?? []) as { id: string; platform: string; content: string; sentiment: string; mentioned_at: string }[],
  }
}
