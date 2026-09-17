// Shared Inbox + Fox AI Copilot record types (mirrors the live schema; see
// supabase/migrations/20260917120000_inbox_copilot_module.sql).

export type InboxTabId = 'unified' | 'assignments' | 'saved-views' | 'unassigned'

export type ConversationLane = 'open' | 'snoozed' | 'closed'
export type SlaStatus = 'on_track' | 'at_risk' | 'breached' | 'completed' | 'paused'
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type InboxChannel =
  | 'email' | 'sms' | 'whatsapp' | 'rcs' | 'instagram' | 'facebook' | 'live_chat'
  | 'x' | 'tiktok' | 'youtube' | 'linkedin' | 'push'

export interface ConversationRow {
  id: string
  workspace_id: string
  type: string
  platform: string
  subject: string | null
  sender_name: string | null
  sender_handle: string | null
  sender_avatar: string | null
  content: string | null
  status: string
  priority: ConversationPriority
  sentiment: string | null
  language: string | null
  tags: string[] | null
  assigned_to: string | null
  team_id: string | null
  contact_id: string | null
  is_read: boolean
  unread_count: number
  requires_reply: boolean
  waiting_on_customer: boolean
  escalated_at: string | null
  snoozed_until: string | null
  closed_at: string | null
  dismissed_at: string | null
  first_response_at: string | null
  sla_policy_id: string | null
  first_response_due_at: string | null
  resolution_due_at: string | null
  last_message_at: string | null
  last_message_preview: string | null
  suggested_owner_id: string | null
  suggested_owner_score: number | null
  created_at: string
  updated_at: string
  is_demo: boolean
  lane: ConversationLane
  sla_status: SlaStatus
  sla_due_at: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_avatar: string | null
  contact_segment: string | null
  contact_location: string | null
  assignee_name: string | null
  assignee_avatar: string | null
  team_name: string | null
}

export interface MessageRow {
  id: string
  thread_id: string
  content: string
  sender_type: 'external' | 'internal' | 'ai_draft'
  sent_by: string | null
  sent_at: string
  is_internal_note: boolean
  is_ai_generated: boolean
  delivery_status: 'pending' | 'sent' | 'failed' | 'simulated'
  failure_reason: string | null
  read_at: string | null
  attachments: AttachmentRef[]
  author_name?: string | null
  author_avatar?: string | null
}

export interface AttachmentRef {
  name: string
  size: number
  type: string
  path: string
  url?: string | null
}

export interface ActivityRow {
  id: string
  action: string
  summary: string
  actor_id: string | null
  actor_name?: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export interface MemberLite {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  jobTitle?: string | null
}

export interface TeamLite {
  id: string
  name: string
  memberIds: string[]
}

export interface ContactDetail {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  location: string | null
  segment: string | null
  tags: string[] | null
  lifetime_value_band: string | null
  sentiment_trend: string | null
  handle: string | null
  last_channel: string | null
  last_activity: string | null
  last_activity_at: string | null
}

export interface InboxCounts {
  open: number
  snoozed: number
  closed: number
  awaiting: number
  sla_at_risk: number
  overdue: number
  unassigned: number
  assigned_to_me: number
  team_queue: number
  assignable_today: number
  median_unowned_secs: number | null
  resolved_today: number
  resolved_yesterday: number
  avg_first_response_secs: number | null
  avg_first_response_prev_secs: number | null
  avg_resolution_secs: number | null
  avg_resolution_prev_secs: number | null
  channels: Record<string, number>
  unassigned_channels: Record<string, number>
  unassigned_tags: Record<string, number>
  unassigned_high: number
  unassigned_new: number
  unassigned_needs_review: number
  unassigned_mine: number
  my_open: number
  mentions: number
}

export interface KpiDelta {
  /** Fractional change, e.g. 0.146 for +14.6%. */
  pct: number | null
  /** Absolute change for small counts. */
  abs: number | null
}

export interface SavedViewRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  folder: string | null
  filters: ConversationFilters
  sort: ConversationSort
  is_pinned: boolean
  is_shared: boolean
  is_default: boolean
  visibility: 'personal' | 'team' | 'workspace'
  shared_team_id: string | null
  shared_at: string | null
  assignment_defaults: { team?: string; teamName?: string; assignee?: string; priority?: string; autoAssign?: boolean }
  sla_conditions: { priority: string; respond: number; resolve: number }[]
  needs_update: boolean
  usage_count: number
  last_used_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ConversationSort = 'newest' | 'oldest' | 'priority' | 'sla'

export interface ConversationFilters {
  lane?: ConversationLane
  platform?: string[]
  status?: ('awaiting' | 'waiting' | 'open' | 'escalated')[]
  priority?: string[]
  sla?: SlaStatus[]
  assignee?: string // 'me' | 'unassigned' | 'assigned' | uuid
  assignees?: string[]
  team?: string
  teamName?: string
  tags?: string[]
  segment?: string[]
  sentiment?: string[]
  language?: string[]
  age?: 'lt1h' | '1to4h' | 'gt4h' | 'gt24h'
  waiting?: boolean
  escalated?: boolean
  search?: string
  audienceLabel?: string
  queue?: string
}
