// Row shapes read by the Community surfaces. These mirror the columns the
// module actually selects rather than the full generated table types, so a
// page cannot quietly depend on a column it never asked Supabase for.

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface CommunityRow {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  type: string
  privacy: string
  status: string
  owner_id: string | null
  region: string | null
  tags: string[] | null
  cover_image_url: string | null
  member_count: number
  activity_level: string
  engagement_rate: number
  health_state: string
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  /** Derived: events scheduled for this community in the future. */
  upcoming_event_count?: number
  /** Derived: open moderation reports tied to this community. */
  flagged_count?: number
}

export interface CommunityMemberRow {
  id: string
  workspace_id: string
  community_id: string
  user_id: string | null
  contact_id: string | null
  display_name: string
  avatar_url: string | null
  email: string | null
  role: string
  lifecycle_stage: string
  status: string
  engagement_score: number
  advocacy_score: number
  posts_count: number
  comments_count: number
  joined_at: string
  last_active_at: string | null
  archived_at: string | null
  community?: { id: string; name: string } | null
}

export interface MembershipRequestRow {
  id: string
  workspace_id: string
  community_id: string
  applicant_name: string
  applicant_email: string | null
  message: string | null
  status: string
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  community?: { id: string; name: string } | null
}

export interface CommunityEventRow {
  id: string
  workspace_id: string
  community_id: string | null
  title: string
  type: string
  description: string | null
  owner_id: string | null
  starts_at: string
  ends_at: string | null
  timezone: string
  location_or_url: string | null
  capacity: number | null
  status: string
  rsvp_count: number
  attendance_count: number
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  community?: { id: string; name: string } | null
}

export interface EventRegistrationRow {
  id: string
  workspace_id: string
  event_id: string
  member_id: string
  status: string
  attended: boolean
  registered_at: string
}

export interface ModerationReportRow {
  id: string
  workspace_id: string
  community_id: string
  reported_member_id: string | null
  reporter_member_id: string | null
  content_excerpt: string | null
  content_type: string
  reason: string
  severity: string
  status: string
  assignee_id: string | null
  ai_risk_score: number | null
  report_count: number
  created_at: string
  resolved_at: string | null
  community?: { id: string; name: string } | null
  reported_member?: { id: string; display_name: string; avatar_url: string | null } | null
  reporter_member?: { id: string; display_name: string } | null
  assignee?: PersonLite | null
}

export interface ModerationDecisionRow {
  id: string
  workspace_id: string
  report_id: string
  moderator_id: string | null
  decision: string
  notes: string | null
  created_at: string
  moderator?: PersonLite | null
}

export interface CommunityPolicyRow {
  id: string
  workspace_id: string
  category: string
  description: string
  enforced: boolean
  coverage_pct: number
}

export interface AdvocacyProgramRow {
  id: string
  workspace_id: string
  community_id: string | null
  name: string
  type: string
  status: string
  goal_metric: string | null
  goal_target: number
  goal_progress: number
  starts_at: string | null
  ends_at: string | null
  cover_image_url: string | null
  created_at: string
  community?: { id: string; name: string } | null
  /** Derived: enrolled member count. */
  member_count?: number
  /** Derived: top performing enrollment for the card summary. */
  top_performer?: { display_name: string; points: number } | null
}

export interface AdvocacyEnrollmentRow {
  id: string
  workspace_id: string
  program_id: string
  member_id: string
  tier: string
  referrals_count: number
  ugc_posts_count: number
  points: number
  rewards_earned_cents: number
  advocacy_score: number
  status: string
  member?: { id: string; display_name: string; avatar_url: string | null; community_id: string } | null
  program?: { id: string; name: string } | null
  community?: { id: string; name: string } | null
}

export interface CommunityRewardRow {
  id: string
  workspace_id: string
  enrollment_id: string
  member_id: string
  reward_description: string
  status: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  member?: { id: string; display_name: string; avatar_url: string | null } | null
  approver?: PersonLite | null
}

export interface ActivityRow {
  id: string
  workspace_id: string
  actor_id: string | null
  community_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  summary: string
  link: string | null
  surface: string | null
  created_at: string
  actor?: PersonLite | null
}

// ── Presentation values ──────────────────────────────────────────────────────

export interface KpiValue {
  id: string
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
  icon: string
  href?: string
  spark?: number[]
}

export interface MetricPoint {
  date: string
  [key: string]: string | number
}

export interface StatusCount {
  key: string
  label: string
  value: number
  colour: string
}
