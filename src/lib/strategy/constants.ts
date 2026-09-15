// Canonical Campaign Manager → Strategy vocabulary.
// Every label, badge tone, tab order and view mode used by the seven Strategy
// surfaces resolves from here so the pages stay visually and semantically
// consistent, and so a status string never gets invented at the render layer.

import type { BadgeVariant } from '@/components/ui/Badge'

export const STRATEGY_MODULES = [
  'overview', 'objectives', 'audiences', 'research', 'positioning', 'plans', 'forecasts',
] as const
export type StrategyModule = typeof STRATEGY_MODULES[number]

export const STRATEGY_MODULE_META: Record<StrategyModule, {
  label: string
  href: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', href: '/app/strategy', title: 'Strategy', breadcrumb: 'Overview',
    description: 'Strategic planning and governance for sustained growth.',
  },
  objectives: {
    label: 'Objectives', href: '/app/strategy/objectives', title: 'Objectives', breadcrumb: 'Objectives',
    description: 'Manage and track strategic objectives that drive growth.',
  },
  audiences: {
    label: 'Audiences', href: '/app/strategy/audiences', title: 'Audiences', breadcrumb: 'Audiences',
    description: 'Understand, segment, and activate the right audiences for higher impact and ROI.',
  },
  research: {
    label: 'Research', href: '/app/strategy/research', title: 'Research', breadcrumb: 'Research',
    description: 'Discover, collect, and manage the insights that drive better strategy.',
  },
  positioning: {
    label: 'Positioning', href: '/app/strategy/positioning', title: 'Positioning', breadcrumb: 'Positioning',
    description: 'Define, differentiate, and validate how we win in the market.',
  },
  plans: {
    label: 'Plans', href: '/app/strategy/plans', title: 'Plans', breadcrumb: 'Plans',
    description: 'Execute strategic priorities through clear plans, milestones, and accountable ownership.',
  },
  forecasts: {
    label: 'Forecasts', href: '/app/strategy/forecasts', title: 'Forecasts', breadcrumb: 'Forecasts',
    description: 'Model future performance, compare scenarios, and track progress toward strategic targets.',
  },
}

// ── Objectives ───────────────────────────────────────────────────────────────
export const OBJECTIVE_STATUSES = [
  'draft', 'not_started', 'on_track', 'at_risk', 'off_track', 'completed', 'archived',
] as const
export type ObjectiveStatus = typeof OBJECTIVE_STATUSES[number]

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  draft: 'Draft', not_started: 'Not started', on_track: 'On track', at_risk: 'At risk',
  off_track: 'Off track', completed: 'Completed', archived: 'Archived',
}
export const OBJECTIVE_STATUS_BADGE: Record<ObjectiveStatus, BadgeVariant> = {
  draft: 'slate', not_started: 'slate', on_track: 'green', at_risk: 'amber',
  off_track: 'red', completed: 'blue', archived: 'slate',
}

/** Kanban columns, in delivery order. Archived is reachable but not a column. */
export const OBJECTIVE_BOARD_STATUSES: ObjectiveStatus[] = [
  'draft', 'not_started', 'on_track', 'at_risk', 'off_track', 'completed',
]

/** Status transitions the board and status menu allow. */
export const OBJECTIVE_TRANSITIONS: Record<ObjectiveStatus, ObjectiveStatus[]> = {
  draft: ['draft', 'not_started', 'on_track', 'archived'],
  not_started: ['not_started', 'draft', 'on_track', 'at_risk', 'off_track', 'archived'],
  on_track: ['on_track', 'at_risk', 'off_track', 'completed', 'archived'],
  at_risk: ['at_risk', 'on_track', 'off_track', 'completed', 'archived'],
  off_track: ['off_track', 'at_risk', 'on_track', 'completed', 'archived'],
  completed: ['completed', 'on_track', 'archived'],
  archived: ['archived', 'draft', 'not_started'],
}

export function canTransitionObjective(from: string, to: string): boolean {
  const allowed = OBJECTIVE_TRANSITIONS[from as ObjectiveStatus]
  return allowed ? allowed.includes(to as ObjectiveStatus) : false
}

export const OBJECTIVE_TYPES = [
  'awareness', 'growth', 'engagement', 'revenue', 'retention', 'efficiency', 'other',
] as const
export type ObjectiveType = typeof OBJECTIVE_TYPES[number]

export const OBJECTIVE_TYPE_LABELS: Record<ObjectiveType, string> = {
  awareness: 'Awareness', growth: 'Growth', engagement: 'Engagement', revenue: 'Revenue',
  retention: 'Retention', efficiency: 'Efficiency', other: 'Other',
}
export const OBJECTIVE_TYPE_BADGE: Record<ObjectiveType, BadgeVariant> = {
  awareness: 'blue', growth: 'green', engagement: 'violet', revenue: 'blue',
  retention: 'red', efficiency: 'amber', other: 'slate',
}

// ── Confidence ───────────────────────────────────────────────────────────────
export function confidenceBand(value: number): { label: string; variant: BadgeVariant } {
  if (value >= 75) return { label: 'High', variant: 'green' }
  if (value >= 45) return { label: 'Medium', variant: 'amber' }
  return { label: 'Low', variant: 'red' }
}

// ── Shared priority ──────────────────────────────────────────────────────────
export const STRATEGY_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type StrategyPriority = typeof STRATEGY_PRIORITIES[number]
export const PRIORITY_LABELS: Record<StrategyPriority, string> = {
  low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
}
export const PRIORITY_BADGE: Record<StrategyPriority, BadgeVariant> = {
  low: 'slate', medium: 'blue', high: 'amber', urgent: 'red',
}
export const PRIORITY_RANK: Record<StrategyPriority, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

// ── Audiences ────────────────────────────────────────────────────────────────
export const AUDIENCE_STATUSES = ['draft', 'active', 'paused', 'archived'] as const
export type AudienceStatus = typeof AUDIENCE_STATUSES[number]
export const AUDIENCE_STATUS_LABELS: Record<AudienceStatus, string> = {
  draft: 'Draft', active: 'Active', paused: 'Paused', archived: 'Archived',
}
export const AUDIENCE_STATUS_BADGE: Record<AudienceStatus, BadgeVariant> = {
  draft: 'slate', active: 'green', paused: 'amber', archived: 'slate',
}

export const LIFECYCLE_STAGES = ['awareness', 'consideration', 'decision', 'retention', 'advocacy'] as const
export type AudienceLifecycle = typeof LIFECYCLE_STAGES[number]
export const LIFECYCLE_LABELS: Record<AudienceLifecycle, string> = {
  awareness: 'Awareness', consideration: 'Consideration', decision: 'Decision',
  retention: 'Retention', advocacy: 'Advocacy',
}
export const LIFECYCLE_BADGE: Record<AudienceLifecycle, BadgeVariant> = {
  awareness: 'amber', consideration: 'blue', decision: 'violet',
  retention: 'red', advocacy: 'green',
}

/** Fit-score band shown under the audience score ring. */
export function fitBand(value: number): { label: string; colour: string; variant: BadgeVariant } {
  if (value >= 90) return { label: 'Excellent', colour: '#10b981', variant: 'green' }
  if (value >= 80) return { label: 'Very Good', colour: '#22c55e', variant: 'green' }
  if (value >= 70) return { label: 'Good', colour: '#84cc16', variant: 'green' }
  if (value >= 55) return { label: 'Fair', colour: '#f59e0b', variant: 'amber' }
  return { label: 'Weak', colour: '#ef4444', variant: 'red' }
}

export const AUDIENCE_CHANNELS = [
  'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'pinterest',
  'google', 'email', 'search', 'display', 'podcast', 'video', 'social',
] as const

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok',
  youtube: 'YouTube', x: 'X', pinterest: 'Pinterest', google: 'Google', email: 'Email',
  search: 'Search', display: 'Display', podcast: 'Podcast', video: 'Video', social: 'Social Media',
}

export const CHANNEL_TINT: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-600 ring-pink-100',
  facebook: 'bg-blue-50 text-blue-600 ring-blue-100',
  linkedin: 'bg-sky-50 text-sky-700 ring-sky-100',
  tiktok: 'bg-slate-100 text-slate-800 ring-slate-200',
  youtube: 'bg-red-50 text-red-600 ring-red-100',
  x: 'bg-slate-100 text-slate-800 ring-slate-200',
  pinterest: 'bg-rose-50 text-rose-600 ring-rose-100',
  google: 'bg-amber-50 text-amber-700 ring-amber-100',
  email: 'bg-violet-50 text-violet-600 ring-violet-100',
  search: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  display: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  podcast: 'bg-purple-50 text-purple-600 ring-purple-100',
  video: 'bg-orange-50 text-orange-600 ring-orange-100',
  social: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
}

// ── Research ─────────────────────────────────────────────────────────────────
export const RESEARCH_SOURCE_TYPES = [
  'market_research', 'consumer_research', 'brand_research', 'competitive_intel',
  'customer_insights', 'qualitative', 'social_listening', 'other',
] as const
export type ResearchSource = typeof RESEARCH_SOURCE_TYPES[number]

export const RESEARCH_SOURCE_LABELS: Record<ResearchSource, string> = {
  market_research: 'Market Research', consumer_research: 'Consumer Research',
  brand_research: 'Brand Research', competitive_intel: 'Competitive Intel',
  customer_insights: 'Customer Insights', qualitative: 'Qualitative Research',
  social_listening: 'Social Listening', other: 'Other',
}

/** Donut colours for the "Research source mix" panel. */
export const RESEARCH_SOURCE_COLOUR: Record<ResearchSource, string> = {
  market_research: '#3b82f6', consumer_research: '#10b981', brand_research: '#f59e0b',
  competitive_intel: '#8b5cf6', customer_insights: '#06b6d4', qualitative: '#ec4899',
  social_listening: '#84cc16', other: '#cbd5e1',
}

export const RESEARCH_STATUSES = ['draft', 'in_review', 'approved', 'needs_revision', 'archived'] as const
export type ResearchStatus = typeof RESEARCH_STATUSES[number]
export const RESEARCH_STATUS_LABELS: Record<ResearchStatus, string> = {
  draft: 'Draft', in_review: 'In review', approved: 'On track',
  needs_revision: 'Needs revision', archived: 'Archived',
}
export const RESEARCH_STATUS_BADGE: Record<ResearchStatus, BadgeVariant> = {
  draft: 'slate', in_review: 'amber', approved: 'green', needs_revision: 'red', archived: 'slate',
}
/** Board columns for the Research board view. */
export const RESEARCH_BOARD_STATUSES: ResearchStatus[] = [
  'draft', 'in_review', 'approved', 'needs_revision', 'archived',
]
export const RESEARCH_TRANSITIONS: Record<ResearchStatus, ResearchStatus[]> = {
  draft: ['draft', 'in_review', 'archived'],
  in_review: ['in_review', 'approved', 'needs_revision', 'draft', 'archived'],
  approved: ['approved', 'needs_revision', 'archived'],
  needs_revision: ['needs_revision', 'in_review', 'draft', 'archived'],
  archived: ['archived', 'draft'],
}
export function canTransitionResearch(from: string, to: string): boolean {
  const allowed = RESEARCH_TRANSITIONS[from as ResearchStatus]
  return allowed ? allowed.includes(to as ResearchStatus) : false
}

// ── Shared impact ────────────────────────────────────────────────────────────
export const IMPACT_LEVELS = ['low', 'medium', 'high'] as const
export type ImpactLevel = typeof IMPACT_LEVELS[number]
export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  low: 'Low impact', medium: 'Medium impact', high: 'High impact',
}
export const IMPACT_SHORT: Record<ImpactLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' }
export const IMPACT_BADGE: Record<ImpactLevel, BadgeVariant> = {
  low: 'slate', medium: 'amber', high: 'green',
}

export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export type RiskLevel = typeof RISK_LEVELS[number]
export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low risk', medium: 'Medium risk', high: 'High risk',
}
export const RISK_BADGE: Record<RiskLevel, BadgeVariant> = {
  low: 'green', medium: 'amber', high: 'red',
}

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number]
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: 'Low', medium: 'Medium', high: 'High',
}
export const CONFIDENCE_BADGE: Record<ConfidenceLevel, BadgeVariant> = {
  low: 'red', medium: 'amber', high: 'green',
}

// ── Positioning ──────────────────────────────────────────────────────────────
export const FRAMEWORK_STATUSES = ['draft', 'in_review', 'approved', 'changes_requested', 'archived'] as const
export type FrameworkStatus = typeof FRAMEWORK_STATUSES[number]
export const FRAMEWORK_STATUS_LABELS: Record<FrameworkStatus, string> = {
  draft: 'Draft', in_review: 'In review', approved: 'Approved',
  changes_requested: 'Changes requested', archived: 'Archived',
}
export const FRAMEWORK_STATUS_BADGE: Record<FrameworkStatus, BadgeVariant> = {
  draft: 'slate', in_review: 'amber', approved: 'green', changes_requested: 'red', archived: 'slate',
}

export const MATRIX_SCORES = ['strong', 'moderate', 'weak', 'na'] as const
export type MatrixScore = typeof MATRIX_SCORES[number]
export const MATRIX_SCORE_LABELS: Record<MatrixScore, string> = {
  strong: 'Strong', moderate: 'Moderate', weak: 'Weak', na: 'N/A',
}
/** Dot colours for the competitive differentiation matrix. */
export const MATRIX_SCORE_DOT: Record<MatrixScore, string> = {
  strong: 'bg-emerald-500', moderate: 'bg-amber-400', weak: 'bg-red-400', na: 'bg-slate-300',
}
/** Next value when a matrix cell is clicked — cycles through the scale. */
export const MATRIX_SCORE_NEXT: Record<MatrixScore, MatrixScore> = {
  strong: 'moderate', moderate: 'weak', weak: 'na', na: 'strong',
}

export const PROOF_CATEGORIES = ['trust', 'efficiency', 'reliability', 'ecosystem', 'results', 'other'] as const
export const PROOF_CATEGORY_LABELS: Record<string, string> = {
  trust: 'Trust', efficiency: 'Efficiency', reliability: 'Reliability',
  ecosystem: 'Ecosystem', results: 'Results', other: 'Other',
}

export const VERIFICATION_STATES = ['unverified', 'in_review', 'verified'] as const
export const VERIFICATION_LABELS: Record<string, string> = {
  unverified: 'Unverified', in_review: 'In review', verified: 'Verified',
}
export const VERIFICATION_BADGE: Record<string, BadgeVariant> = {
  unverified: 'slate', in_review: 'amber', verified: 'green',
}

export const APPROVAL_STAGES = ['draft', 'review', 'legal_review', 'leadership', 'approved'] as const
export type ApprovalStage = typeof APPROVAL_STAGES[number]
export const APPROVAL_STAGE_LABELS: Record<ApprovalStage, string> = {
  draft: 'Draft', review: 'Review', legal_review: 'Legal Review',
  leadership: 'Leadership', approved: 'Approved',
}

export const APPROVAL_STATUSES = ['pending', 'approved', 'changes_requested', 'rejected'] as const
export type ApprovalStatus = typeof APPROVAL_STATUSES[number]
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending', approved: 'Completed', changes_requested: 'Changes requested', rejected: 'Rejected',
}

// ── Plans ────────────────────────────────────────────────────────────────────
export const PLAN_STATUSES = ['not_started', 'on_track', 'at_risk', 'off_track', 'completed', 'archived'] as const
export type PlanStatus = typeof PLAN_STATUSES[number]
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  not_started: 'Not started', on_track: 'On track', at_risk: 'At risk',
  off_track: 'Off track', completed: 'Completed', archived: 'Archived',
}
export const PLAN_STATUS_BADGE: Record<PlanStatus, BadgeVariant> = {
  not_started: 'slate', on_track: 'green', at_risk: 'amber',
  off_track: 'red', completed: 'blue', archived: 'slate',
}
/** Bar colours used by the Gantt. */
export const PLAN_STATUS_COLOUR: Record<PlanStatus, string> = {
  not_started: '#cbd5e1', on_track: '#10b981', at_risk: '#f59e0b',
  off_track: '#ef4444', completed: '#3b82f6', archived: '#cbd5e1',
}
export const PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  not_started: ['not_started', 'on_track', 'at_risk', 'off_track', 'archived'],
  on_track: ['on_track', 'at_risk', 'off_track', 'completed', 'archived'],
  at_risk: ['at_risk', 'on_track', 'off_track', 'completed', 'archived'],
  off_track: ['off_track', 'at_risk', 'on_track', 'completed', 'archived'],
  completed: ['completed', 'on_track', 'archived'],
  archived: ['archived', 'not_started'],
}
export function canTransitionPlan(from: string, to: string): boolean {
  const allowed = PLAN_TRANSITIONS[from as PlanStatus]
  return allowed ? allowed.includes(to as PlanStatus) : false
}

export const PLAN_ITEM_STATUSES = ['not_started', 'on_track', 'at_risk', 'off_track', 'completed', 'blocked'] as const
export type PlanItemStatus = typeof PLAN_ITEM_STATUSES[number]
export const PLAN_ITEM_STATUS_LABELS: Record<PlanItemStatus, string> = {
  not_started: 'Not started', on_track: 'On track', at_risk: 'At risk',
  off_track: 'Off track', completed: 'Completed', blocked: 'Blocked',
}
export const PLAN_ITEM_STATUS_BADGE: Record<PlanItemStatus, BadgeVariant> = {
  not_started: 'slate', on_track: 'green', at_risk: 'amber',
  off_track: 'red', completed: 'blue', blocked: 'red',
}

export const PLAN_ITEM_TYPES = ['phase', 'task', 'milestone'] as const
export type PlanItemType = typeof PLAN_ITEM_TYPES[number]
export const PLAN_ITEM_TYPE_LABELS: Record<PlanItemType, string> = {
  phase: 'Phase', task: 'Task', milestone: 'Milestone',
}

/** Gantt time scales. `days` is the value each column represents. */
export const GANTT_SCALES = [
  { id: 'days', label: 'Days', days: 1 },
  { id: 'weeks', label: 'Weeks', days: 7 },
  { id: 'months', label: 'Months', days: 30 },
] as const
export type GanttScale = typeof GANTT_SCALES[number]['id']

// ── Forecasts ────────────────────────────────────────────────────────────────
export const FORECAST_METRICS = ['revenue', 'pipeline', 'leads', 'conversions', 'reach', 'other'] as const
export type ForecastMetric = typeof FORECAST_METRICS[number]
export const FORECAST_METRIC_LABELS: Record<ForecastMetric, string> = {
  revenue: 'Revenue', pipeline: 'Pipeline', leads: 'Leads',
  conversions: 'Conversions', reach: 'Reach', other: 'Other',
}
/** Metrics measured in money — everything else formats as a plain number. */
export const MONETARY_METRICS: ForecastMetric[] = ['revenue', 'pipeline']

export const SCENARIO_TYPES = ['best', 'expected', 'downside', 'custom'] as const
export type ScenarioType = typeof SCENARIO_TYPES[number]
export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  best: 'Best case', expected: 'Expected case', downside: 'Downside case', custom: 'Custom scenario',
}
export const SCENARIO_COLOUR: Record<ScenarioType, string> = {
  best: '#10b981', expected: '#3b82f6', downside: '#ef4444', custom: '#8b5cf6',
}

export const FORECAST_STATUSES = ['draft', 'active', 'archived'] as const
export type ForecastStatus = typeof FORECAST_STATUSES[number]
export const FORECAST_STATUS_LABELS: Record<ForecastStatus, string> = {
  draft: 'Draft', active: 'Active', archived: 'Archived',
}
export const FORECAST_STATUS_BADGE: Record<ForecastStatus, BadgeVariant> = {
  draft: 'slate', active: 'green', archived: 'slate',
}

// ── Sorting ──────────────────────────────────────────────────────────────────
export const STRATEGY_SORTS = [
  { id: 'due_soonest', label: 'Due date (soonest)' },
  { id: 'due_latest', label: 'Due date (latest)' },
  { id: 'name_asc', label: 'Name (A–Z)' },
  { id: 'name_desc', label: 'Name (Z–A)' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'progress_desc', label: 'Progress (highest)' },
  { id: 'confidence_desc', label: 'Confidence (highest)' },
  { id: 'size_desc', label: 'Audience size (largest)' },
  { id: 'fit_desc', label: 'Fit score (highest)' },
  { id: 'priority', label: 'Priority' },
] as const
export type StrategySort = typeof STRATEGY_SORTS[number]['id']

export const PAGE_SIZES = [12, 24, 48, 96] as const
export const DEFAULT_PAGE_SIZE = 12

// ── Activity ─────────────────────────────────────────────────────────────────
export const ACTIVITY_ENTITIES = [
  'strategy', 'objective', 'audience', 'research', 'framework', 'proof_point', 'claim',
  'competitor', 'plan', 'plan_item', 'forecast', 'scenario', 'assumption', 'approval', 'system',
] as const
export type ActivityEntity = typeof ACTIVITY_ENTITIES[number]

/** Route each activity entity links back to, so a feed row is never a dead link. */
export const ACTIVITY_ENTITY_HREF: Record<ActivityEntity, string> = {
  strategy: '/app/strategy', objective: '/app/strategy/objectives',
  audience: '/app/strategy/audiences', research: '/app/strategy/research',
  framework: '/app/strategy/positioning', proof_point: '/app/strategy/positioning',
  claim: '/app/strategy/positioning', competitor: '/app/strategy/positioning',
  plan: '/app/strategy/plans', plan_item: '/app/strategy/plans',
  forecast: '/app/strategy/forecasts', scenario: '/app/strategy/forecasts',
  assumption: '/app/strategy/forecasts', approval: '/app/strategy/positioning',
  system: '/app/strategy',
}

// ── Uploads ──────────────────────────────────────────────────────────────────
/** Research uploads. Kept narrow — anything else is rejected server-side. */
export const RESEARCH_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
] as const
export const RESEARCH_FILE_MAX_BYTES = 25 * 1024 * 1024

/** Short file-type badge shown on a research card. */
export function fileKind(mime: string | null | undefined): 'pdf' | 'doc' | 'sheet' | 'slides' | 'image' | 'text' {
  if (!mime) return 'text'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('presentation')) return 'slides'
  if (mime.includes('spreadsheet') || mime === 'text/csv' || mime.includes('ms-excel')) return 'sheet'
  if (mime.includes('word')) return 'doc'
  if (mime.startsWith('image/')) return 'image'
  return 'text'
}
