// Row shapes returned by the Campaigns data layer. These mirror the Supabase
// columns the module actually selects — not the whole table — so a schema drift
// shows up at compile time rather than as a blank card.

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface CampaignRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  campaign_type: string
  status: string
  lifecycle_stage: string
  priority: string
  health: string
  progress: number
  approval_status: string
  budget: number | null
  actual_spend: number | null
  currency: string | null
  engagements: number
  reach: number
  conversions: number
  channels: string[]
  tags: string[] | null
  start_date: string | null
  end_date: string | null
  launch_date: string | null
  thumbnail_url: string | null
  template_id: string | null
  owner_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  /** Linked content-post count, joined only where the surface displays it. */
  content_count?: number
}

export interface TemplateRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  category: string
  template_type: string
  status: string
  usage_count: number
  linked_workflows: number
  cover_url: string | null
  is_favourite: boolean
  channels: string[]
  default_budget: number | null
  default_duration_days: number | null
  owner_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface GiveawayRow {
  id: string
  workspace_id: string
  campaign_id: string | null
  title: string
  description: string | null
  status: string
  prize_title: string
  prize_value: number | null
  prize_currency: string
  prize_fulfilment: string
  approval_status: string
  progress: number
  health: string
  channels: string[]
  platform: string | null
  cover_url: string | null
  total_entries: number
  total_unique_participants: number
  winner_count: number
  start_date: string | null
  end_date: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  /** Winner candidates awaiting review — joined on the giveaways surface. */
  pending_winners?: number
  conversion_rate?: number
}

export interface GiveawayEntryRow {
  id: string
  giveaway_id: string
  workspace_id: string
  participant_handle: string | null
  participant_email: string | null
  entry_method: string | null
  is_valid: boolean
  is_winner: boolean
  winner_status: string
  source: string
  review_note: string | null
  disqualified_reason: string | null
  entered_at: string
}

export interface CompetitionRow {
  id: string
  workspace_id: string
  campaign_id: string | null
  title: string
  description: string | null
  competition_type: string
  status: string
  judging_stage: string
  approval_status: string
  progress: number
  health: string
  channels: string[]
  cover_url: string | null
  submission_count: number
  vote_count: number
  engagement_rate: number
  judging_type: string
  prize_title: string | null
  start_date: string | null
  end_date: string | null
  submission_deadline: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  /** Submissions still awaiting a judging decision. */
  judging_backlog?: number
}

export interface MilestoneRow {
  id: string
  workspace_id: string
  campaign_id: string
  title: string
  due_date: string
  milestone_type: string
  status: string
  owner_id: string | null
  depends_on_id: string | null
  notes: string | null
  completed_at: string | null
  campaign?: { id: string; name: string } | null
}

export interface PhaseRow {
  id: string
  campaign_id: string
  name: string
  start_date: string
  end_date: string
  accent: string
  sort_order: number
}

export interface DependencyRow {
  id: string
  campaign_id: string
  depends_on_campaign_id: string
  label: string | null
  status: string
  campaign?: { id: string; name: string } | null
  depends_on?: { id: string; name: string } | null
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
  engagements: number
  reach: number
  conversions: number
  spend: number
}

export interface KpiValue {
  id: string
  label: string
  value: string
  /** Sub-line under the value — a delta, a context note, or a target. */
  hint?: string
  /** Direction of the delta, used only when `hint` is a comparison. */
  trend?: 'up' | 'down' | 'flat'
  icon: string
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
}
