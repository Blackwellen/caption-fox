// Row shapes read by the Creators & UGC surfaces. These mirror the columns the
// module actually selects rather than the full generated table types, so a page
// cannot quietly depend on a column it never asked Supabase for.

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface CreatorRow {
  id: string
  workspace_id: string
  name: string
  email: string | null
  handle: string | null
  avatar_url: string | null
  bio: string | null
  niche: string | null
  region: string | null
  country: string | null
  languages: string[] | null
  platforms: string[] | null
  audience_size: number
  engagement_rate: number
  avg_rate: number | null
  rate_per_video: number | null
  currency: string | null
  creator_tier: string
  relationship_status: string
  rights_readiness: string
  payment_ready: boolean
  availability: string
  shortlisted: boolean
  campaign_fit: number
  owner_id: string | null
  tags: string[] | null
  source: string
  total_earnings: number
  portfolio_urls: string[] | null
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  /** Derived: open briefs this creator is currently assigned to. */
  active_briefs?: number
  /** Derived: submissions delivered by this creator in the workspace. */
  submission_count?: number
  approved_count?: number
  rights_count?: number
}

export interface CreatorListRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  list_type: string
  campaign_id: string | null
  owner_id: string | null
  is_shared: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  member_count?: number
}

export interface InvitationRow {
  id: string
  workspace_id: string
  creator_id: string | null
  email: string
  display_name: string | null
  message: string | null
  status: string
  expires_at: string | null
  sent_at: string | null
  responded_at: string | null
  created_at: string
}

export interface BriefRow {
  id: string
  workspace_id: string
  campaign_id: string | null
  title: string
  description: string | null
  status: string
  approval_stage: string
  priority: string
  category: string | null
  cover_url: string | null
  channels: string[] | null
  platforms: string[] | null
  deliverables: string | null
  do_instructions: string | null
  dont_instructions: string | null
  rights_requirement: string | null
  budget: number | null
  currency: string | null
  deadline: string | null
  max_creators: number | null
  creators_assigned: number
  deliverables_target: number
  deliverables_submitted: number
  owner_id: string | null
  completed_at: string | null
  archived_at: string | null
  board_position: number
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  campaign?: { id: string; name: string } | null
}

export interface BriefCreatorRow {
  id: string
  brief_id: string
  creator_id: string
  status: string
  agreed_rate: number | null
  currency: string
  invited_at: string
  responded_at: string | null
  creator?: CreatorRow | null
}

export interface BriefDeliverableRow {
  id: string
  brief_id: string
  title: string
  asset_type: string
  quantity: number
  channel: string | null
  due_date: string | null
  notes: string | null
  position: number
}

export interface SubmissionRow {
  id: string
  workspace_id: string
  brief_id: string
  creator_id: string
  campaign_id: string | null
  deliverable_id: string | null
  title: string | null
  status: string
  asset_type: string
  version: number
  rights_status: string
  reviewer_id: string | null
  thumbnail_url: string | null
  submission_url: string | null
  media_urls: string[] | null
  duration_seconds: number | null
  file_count: number
  views: number
  engagement_rate: number
  comments_count: number
  issue_count: number
  payment_eligible: boolean
  notes: string | null
  feedback: string | null
  submitted_at: string
  review_started_at: string | null
  review_seconds: number | null
  reviewed_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  creator?: CreatorRow | null
  brief?: { id: string; title: string } | null
  reviewer?: PersonLite | null
}

export interface SubmissionAssetRow {
  id: string
  submission_id: string
  version: number
  storage_path: string
  media_type: string
  mime_type: string | null
  size_bytes: number | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  thumbnail_path: string | null
  original_name: string | null
  created_at: string
  /** Populated at read time from a short-lived signed URL. */
  signed_url?: string | null
}

export interface SubmissionReviewRow {
  id: string
  submission_id: string
  version: number
  reviewer_id: string | null
  decision: string
  note: string | null
  creator_visible: boolean
  timecode_seconds: number | null
  created_at: string
  reviewer?: PersonLite | null
}

export interface SubmissionIssueRow {
  id: string
  submission_id: string
  category: string
  severity: string
  detail: string | null
  source: string
  status: string
  created_at: string
  resolved_at: string | null
}

export interface RightsRow {
  id: string
  workspace_id: string
  creator_id: string
  submission_id: string | null
  submission_version: number | null
  campaign_id: string | null
  brief_id: string | null
  asset_label: string
  rights_type: string
  usage_scope: string
  channels: string[] | null
  territories: string[] | null
  start_date: string | null
  expiry_date: string | null
  exclusivity: boolean
  modification_allowed: boolean
  paid_amplification: boolean
  whitelisting: boolean
  handle_usage: boolean
  agreement_url: string | null
  agreement_signed: boolean
  status: string
  owner_id: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  creator?: CreatorRow | null
  owner?: PersonLite | null
  submission?: { id: string; title: string | null; status: string; thumbnail_url: string | null } | null
  campaign?: { id: string; name: string; end_date: string | null } | null
}

export interface RightsRequestRow {
  id: string
  workspace_id: string
  rights_id: string | null
  creator_id: string
  submission_id: string | null
  requested_channels: string[] | null
  requested_territories: string[] | null
  requested_duration_days: number | null
  paid_media: boolean
  exclusivity: boolean
  proposed_fee: number | null
  currency: string
  message: string | null
  status: string
  counter_fee: number | null
  expires_at: string | null
  responded_at: string | null
  created_at: string
  creator?: CreatorRow | null
}

export interface PaymentRow {
  id: string
  workspace_id: string
  creator_id: string
  submission_id: string | null
  brief_id: string | null
  campaign_id: string | null
  batch_id: string | null
  amount: number
  currency: string
  status: string
  approval_state: string
  payment_method: string | null
  approved_by: string | null
  approved_at: string | null
  payout_date: string | null
  paid_at: string | null
  submitted_date: string | null
  invoice_number: string | null
  invoice_url: string | null
  invoice_status: string
  invoice_flag: string | null
  tax_status: string
  provider_reference: string | null
  failure_reason: string | null
  blocked_reason: string | null
  owner_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  creator?: CreatorRow | null
  brief?: { id: string; title: string } | null
  campaign?: { id: string; name: string } | null
  approver?: PersonLite | null
}

export interface PaymentBatchRow {
  id: string
  workspace_id: string
  name: string
  currency: string
  payment_method: string
  status: string
  total_amount: number
  item_count: number
  scheduled_for: string | null
  approved_by: string | null
  approved_at: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface PayoutAttemptRow {
  id: string
  payment_id: string
  attempt_no: number
  status: string
  provider: string | null
  provider_reference: string | null
  error_code: string | null
  error_message: string | null
  created_at: string
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

// ── Presentation values ──────────────────────────────────────────────────────

export interface KpiValue {
  id: string
  label: string
  value: string
  /** Formatted comparison copy, e.g. "12.5% vs last 30 days". */
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  /** Whether an upward move is good — payout time going down is good. */
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
  icon: string
  href?: string
  /** Daily series used by the card sparkline. */
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

export interface RightsConflict {
  type: string
  label: string
  severity: 'low' | 'medium' | 'high'
  count: number
  /** Rights record ids that triggered the conflict, capped for display. */
  sampleIds: string[]
}
