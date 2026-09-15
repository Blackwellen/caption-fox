// Row shapes returned by the Partnerships data layer. These mirror the
// Supabase columns the module actually selects, not the whole table.

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface ProgrammeRow {
  id: string
  workspace_id: string
  name: string
  programme_type: string
  category: string | null
  description: string | null
  status: string
  owner_id: string | null
  commission_type: string
  commission_rate: number
  currency: string
  tracking_window_days: number
  start_date: string | null
  end_date: string | null
  cover_url: string | null
  channels: string[]
  terms_url: string | null
  is_demo: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  // Joined aggregates — only populated where the surface displays them.
  partner_count?: number
  conversions?: number
  commission?: number
  revenue?: number
  tier_progress_pct?: number
  current_tier_name?: string | null
}

export interface TierRow {
  id: string
  workspace_id: string
  programme_id: string
  name: string
  rank: number
  threshold: number
  commission_rate: number | null
  benefits: Record<string, unknown>
}

export interface PartnerRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_type: string
  name: string
  handle: string | null
  email: string | null
  avatar_url: string | null
  owner_id: string | null
  tier_id: string | null
  status: string
  platforms: string[]
  region: string | null
  health: string
  health_reason: string | null
  joined_at: string | null
  approved_at: string | null
  last_activity_at: string
  metadata: Record<string, unknown>
  is_demo: boolean
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  tier?: { id: string; name: string } | null
  programme?: { id: string; name: string; programme_type: string } | null
  // Joined aggregates for the partners table/cards.
  conversions?: number
  commission?: number
  revenue?: number
}

export interface ApplicationRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string | null
  applicant_name: string
  applicant_email: string | null
  status: string
  fields: Record<string, unknown>
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  submitted_at: string
  programme?: { id: string; name: string; programme_type: string } | null
}

export interface CommissionRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string
  conversion_id: string | null
  calculation_basis: string
  rate: number
  amount: number
  currency: string
  status: string
  created_at: string
}

export interface PayoutRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string
  period_start: string
  period_end: string
  currency: string
  gross_amount: number
  adjustments: number
  net_amount: number
  status: string
  provider: string | null
  provider_error?: string | null
  paid_at: string | null
  created_at: string
  partner?: { id: string; name: string; stripe_account_status?: string | null; stripe_payouts_enabled?: boolean | null } | null
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
  primary_count: number
  secondary_count: number
  revenue: number
  spend: number
}

export interface AssetRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string
  asset_type: string
  title: string
  url: string | null
  platform: string | null
  status: string
  review_notes: string | null
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  partner?: { id: string; name: string } | null
  programme?: { id: string; name: string; programme_type: string } | null
}

export interface RewardRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string
  reward_type: string
  value: number
  currency: string
  status: string
  trigger_source: string | null
  issued_at: string | null
  redeemed_at: string | null
  expires_at: string | null
  created_at: string
  partner?: { id: string; name: string } | null
}

export interface TerritoryRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string | null
  region: string
  exclusive: boolean
  assigned_at: string
  expires_at: string | null
  partner?: { id: string; name: string } | null
}

export interface TrackingLinkRow {
  id: string
  workspace_id: string
  programme_id: string
  partner_id: string
  slug: string
  destination_url: string
  status: string
  clicks: number
  expires_at: string | null
  created_at: string
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
