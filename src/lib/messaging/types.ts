// Row shapes returned by the Messaging data layer. These mirror the Supabase
// columns the module actually selects — not the whole table — so a schema
// drift shows up at compile time rather than as a blank card.

import type { MessagingChannel } from './constants'

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface MessageRow {
  id: string
  workspace_id: string
  channel: MessagingChannel
  name: string
  message_type: string
  status: string
  sender_id: string | null
  subject: string | null
  content: Record<string, unknown>
  audience_id: string | null
  journey_id: string | null
  template_id: string | null
  campaign_id: string | null
  approval_status: string
  scheduled_at: string | null
  sent_at: string | null
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  converted_count: number
  opt_out_count: number
  failed_count: number
  owner_id: string | null
  version: number
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  audience?: { id: string; name: string; contact_count: number } | null
}

export interface AudienceRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  segment_type: string
  filter_definition: Record<string, unknown>
  tags: string[]
  contact_count: number
  owner_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface TemplateRow {
  id: string
  workspace_id: string
  name: string
  channel: MessagingChannel
  category: string
  status: string
  content: Record<string, unknown>
  variables: string[]
  tags: string[]
  usage_count: number
  unique_recipients: number
  avg_reuse_rate: number
  ctr_uplift: number | null
  provider_template_id: string | null
  provider_status: string | null
  owner_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface JourneyRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  journey_type: string
  status: string
  trigger: Record<string, unknown>
  canvas: { nodes: unknown[]; edges: unknown[] }
  audience_id: string | null
  contacts_in_flow: number
  total_entered: number
  on_track_rate: number
  conversion_rate: number
  health: string
  version: number
  owner_id: string | null
  last_launch_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  audience?: { id: string; name: string } | null
}

export interface ChannelConfigRow {
  id: string
  workspace_id: string
  channel: MessagingChannel
  status: string
  provider: string | null
  connected_at: string | null
  last_checked_at: string | null
  last_error: string | null
}

export interface ActivityRow {
  id: string
  workspace_id: string
  actor_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  summary: string
  link: string | null
  surface: string | null
  created_at: string
  actor?: PersonLite | null
}

export interface MetricPoint {
  metric_date: string
  channel: MessagingChannel
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  opt_outs: number
}

export interface KpiValue {
  id: string
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  icon: string
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
}
