// Row shapes returned by the Strategy data layer. These mirror the Supabase
// columns the module actually selects — not the whole table — so schema drift
// shows up at compile time rather than as a blank card.

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface StrategyRecordRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: string
  health_score: number
  owner_id: string | null
  start_date: string | null
  end_date: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface ObjectiveRow {
  id: string
  workspace_id: string
  strategy_id: string | null
  name: string
  description: string | null
  objective_type: string
  status: string
  progress: number
  confidence: number
  priority: string
  target_summary: string | null
  next_action: string | null
  owner_id: string | null
  start_date: string | null
  due_date: string | null
  tags: string[]
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  strategy?: { id: string; name: string } | null
  /** Resolved from `strategy_links`, only on surfaces that show them. */
  linkedAudiences?: LinkedRef[]
  linkedPlans?: LinkedRef[]
}

export interface LinkedRef { id: string; name: string }

export interface AudienceRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: string
  lifecycle_stage: string
  audience_size: number
  growth_rate: number
  fit_score: number
  data_completeness: number
  channels: string[]
  tags: string[]
  source: string
  owner_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  personas?: PersonaRow[]
  regions?: RegionRow[]
  linkedObjectives?: LinkedRef[]
}

export interface PersonaRow {
  id: string
  audience_id: string
  name: string
  summary: string | null
  share_pct: number
  avatar_url: string | null
  sort_order: number
}

export interface RegionRow {
  id: string
  audience_id: string
  country_code: string
  country_name: string
  share_pct: number
  audience_size: number
}

export interface AudienceMetricRow {
  id: string
  audience_id: string
  metric_group: string
  metric_key: string
  metric_label: string
  metric_value: number
  metric_date: string | null
}

export interface ResearchCollectionRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_at: string
  /** Populated by the library sidebar query. */
  item_count?: number
}

export interface ResearchRow {
  id: string
  workspace_id: string
  collection_id: string | null
  title: string
  summary: string | null
  source_type: string
  impact: string
  confidence: number
  status: string
  theme: string | null
  is_favourite: boolean
  tags: string[]
  file_path: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  owner_id: string | null
  created_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  collection?: { id: string; name: string } | null
  linkedObjectives?: LinkedRef[]
}

export interface FindingRow {
  id: string
  workspace_id: string
  research_id: string
  headline: string
  detail: string | null
  impact: string
  created_at: string
  research?: { id: string; title: string } | null
}

export interface FrameworkRow {
  id: string
  workspace_id: string
  name: string
  category_promise: string | null
  foundation: string | null
  positioning_statement: string | null
  target_audience_id: string | null
  is_primary: boolean
  version: number
  status: string
  consistency_score: number
  owner_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  audience?: { id: string; name: string } | null
  pillars?: PillarRow[]
}

export interface PillarRow {
  id: string
  framework_id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
}

export interface ProofPointRow {
  id: string
  workspace_id: string
  framework_id: string | null
  label: string
  category: string
  impact: string
  verification: string
  evidence_research_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ClaimRow {
  id: string
  workspace_id: string
  framework_id: string | null
  claim: string
  risk_level: string
  rationale: string | null
  sort_order: number
}

export interface CompetitorRow {
  id: string
  workspace_id: string
  framework_id: string | null
  name: string
  is_self: boolean
  website: string | null
  notes: string | null
  sort_order: number
}

export interface AttributeRow {
  id: string
  workspace_id: string
  framework_id: string
  name: string
  sort_order: number
}

export interface CompetitorScoreRow {
  id: string
  competitor_id: string
  attribute_id: string
  score: string
  note: string | null
}

export interface MessagingAssetRow {
  id: string
  workspace_id: string
  framework_id: string | null
  name: string
  asset_type: string
  audience_id: string | null
  status: string
  file_path: string | null
  file_name: string | null
  owner_id: string | null
  updated_at: string
  audience?: { id: string; name: string } | null
  framework?: { id: string; name: string } | null
}

export interface PlanRow {
  id: string
  workspace_id: string
  strategy_id: string | null
  name: string
  description: string | null
  status: string
  progress: number
  budget: number | null
  budget_spent: number
  currency: string
  owner_id: string | null
  start_date: string | null
  end_date: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  items?: PlanItemRow[]
}

export interface PlanItemRow {
  id: string
  workspace_id: string
  plan_id: string
  parent_id: string | null
  title: string
  item_type: string
  status: string
  priority: string
  progress: number
  owner_id: string | null
  start_date: string | null
  due_date: string | null
  notes: string | null
  sort_order: number
  updated_at: string
  owner?: PersonLite | null
  plan?: { id: string; name: string } | null
}

export interface PlanDependencyRow {
  id: string
  workspace_id: string
  plan_id: string
  depends_on_plan_id: string
  label: string | null
  risk_level: string
  blocked_items: number
  plan?: { id: string; name: string } | null
  dependsOn?: { id: string; name: string } | null
}

export interface PlanRiskRow {
  id: string
  workspace_id: string
  plan_id: string | null
  title: string
  detail: string | null
  severity: string
  status: string
  created_at: string
  plan?: { id: string; name: string } | null
}

export interface CapacityRow {
  id: string
  period_start: string
  allocated: number
  capacity: number
}

export interface ForecastRow {
  id: string
  workspace_id: string
  strategy_id: string | null
  name: string
  description: string | null
  metric: string
  currency: string
  period_start: string
  period_end: string
  target_value: number
  confidence: string
  risk_level: string
  status: string
  owner_id: string | null
  last_recalculated_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  scenarios?: ScenarioRow[]
}

export interface ScenarioRow {
  id: string
  workspace_id: string
  forecast_id: string
  name: string
  scenario_type: string
  is_expected: boolean
  probability: number
  forecast_value: number
  range_low: number | null
  range_high: number | null
  drivers: string[]
  risks: string[]
  last_recalculated_at: string | null
  sort_order: number
}

export interface ForecastPeriodRow {
  id: string
  forecast_id: string
  scenario_id: string | null
  period_label: string
  period_date: string
  target_value: number
  forecast_value: number
  actual_value: number | null
}

export interface AssumptionRow {
  id: string
  workspace_id: string
  forecast_id: string
  label: string
  value_text: string
  numeric_value: number | null
  unit: string | null
  confidence: string
  sort_order: number
  updated_at: string
}

export interface ApprovalRow {
  id: string
  workspace_id: string
  entity_type: string
  entity_id: string
  stage: string
  status: string
  requested_by: string | null
  approver_id: string | null
  comment: string | null
  due_date: string | null
  requested_at: string
  decided_at: string | null
  sort_order: number
  approver?: PersonLite | null
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

export interface HealthSnapshotRow {
  id: string
  snapshot_date: string
  health_score: number
  benchmark_score: number
  objectives_on_track: number
  objectives_total: number
}

// ── View models ──────────────────────────────────────────────────────────────

export interface KpiValue {
  id: string
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
  icon: string
  /** Optional inline sub-bar, e.g. "78% on track" under Objectives on Track. */
  bar?: { pct: number; label: string }
}
