// Domain types for the shared Social module.
// Unions mirror the CHECK constraints in
// supabase/migrations/20260831000000_social_module.sql — keep both in step.

export const SOCIAL_PROVIDERS = [
  'instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'x', 'pinterest', 'threads',
] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

/** Brand colours used for provider chips, sparklines and legends. */
export const PROVIDER_COLOURS: Record<SocialProvider, string> = {
  instagram: '#E1306C',
  tiktok: '#111827',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  x: '#0F172A',
  pinterest: '#BD081C',
  threads: '#334155',
}

export type ConnectionHealth =
  | 'healthy' | 'watch' | 'warning' | 'error' | 'disconnected' | 'syncing' | 'expired'

export type TokenStatus = 'valid' | 'expiring' | 'expired' | 'revoked' | 'missing'
export type PermissionMode = 'read_write' | 'read_only'
export type AccountType =
  | 'business' | 'creator' | 'page' | 'company_page' | 'channel' | 'profile' | 'group'

export type PublishStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'queued' | 'publishing'
  | 'published' | 'partially_published' | 'failed' | 'cancelled' | 'archived'

export type QueueStatus = 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'skipped'

export type FailureType =
  | 'authentication' | 'permission' | 'rate_limit' | 'validation' | 'media_processing'
  | 'provider_rejection' | 'network' | 'timeout' | 'unknown'

export type PostType = 'post' | 'reel' | 'story' | 'carousel' | 'short' | 'thread' | 'pin'

export type ConversationType = 'comment' | 'dm' | 'mention' | 'review' | 'email'
export type ConversationStatus = 'open' | 'assigned' | 'resolved' | 'spam' | 'done'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type SentimentSource = 'unset' | 'model' | 'manual' | 'provider'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type SlaState = 'on_track' | 'warning' | 'breached' | 'met' | 'paused'

export type MentionSourceType =
  | 'first_party' | 'public_api' | 'third_party' | 'search_index' | 'manual_import' | 'estimated'
export type MentionPriority = 'low' | 'medium' | 'high'

export const MENTION_SOURCE_LABELS: Record<MentionSourceType, string> = {
  first_party: 'Connected channel',
  public_api: 'Public platform API',
  third_party: 'Third-party listening provider',
  search_index: 'Search index',
  manual_import: 'Manual import',
  estimated: 'Estimated',
}

export type AlertSeverity = 'low' | 'medium' | 'high'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'
export type AlertType =
  | 'volume_spike' | 'negative_sentiment' | 'viral' | 'competitor_mention' | 'new_mention'
  | 'keyword_trend' | 'influencer_mention' | 'product_issue' | 'crisis_risk' | 'feature_feedback'

export type ConnectionIssueType =
  | 'token_expiring' | 'token_expired' | 'missing_role' | 'missing_permission' | 'scope_removed'
  | 'webhook_disabled' | 'sync_partial_failure' | 'rate_limit' | 'provider_outage'
  | 'account_disconnected'

export type ConnectionIssueAction =
  | 'renew_token' | 'review_access' | 'update_scopes' | 'reconnect' | 'sync_now' | 'contact_support'

// ── Row shapes returned by the server data layer ─────────────────────────────

export interface SocialChannelRow {
  id: string
  workspace_id: string
  platform: SocialProvider
  account_name: string
  handle: string | null
  account_id: string | null
  account_type: AccountType | null
  avatar_url: string | null
  profile_url: string | null
  follower_count: number | null
  health: ConnectionHealth
  granted_scopes: string[]
  required_scopes: string[]
  permission_mode: PermissionMode
  team_label: string | null
  token_status: TokenStatus
  token_expires_at: string | null
  last_sync_at: string | null
  last_sync_status: string | null
  last_successful_sync_at: string | null
  is_active: boolean
  connected_at: string | null
  disconnected_at: string | null
  is_demo: boolean
}

export interface ChannelMetricSummary {
  channelId: string
  reach: number
  impressions: number
  engagements: number
  engagementRate: number | null
  followerChange: number
  postsPublished: number
  /** Ordered oldest → newest, one point per day in range. */
  series: { date: string; reach: number; engagements: number }[]
}

export interface MetricValue {
  value: number
  previous: number | null
  changePct: number | null
  /** Percentage-point delta — used where the metric is itself a percentage. */
  changePp: number | null
}

export interface SocialKpi extends MetricValue {
  key: string
  label: string
  format: 'number' | 'percent' | 'duration'
  /** Where the number came from, shown in the card tooltip. */
  source: string
  series: { date: string; value: number }[]
  /** Human note when the figure is partial or unavailable. */
  note?: string
}

export interface TimeseriesPoint {
  date: string
  reach: number
  impressions: number
  engagements: number
  engagementRate: number | null
}

export interface DataSourceStatus {
  channelId: string
  provider: SocialProvider
  accountName: string
  lastSyncAt: string | null
  health: ConnectionHealth
  /** True when the range requested is not fully covered by synced data. */
  incomplete: boolean
}
