// Row shapes returned by the Web & Conversion data layer. These mirror the
// Supabase columns the module actually selects — not the whole table — so a
// schema drift shows up at compile time rather than as a blank card.
// Mirrors src/lib/messaging/types.ts.

import type {
  WebPageType, WebPageStatus, WebFormType, WebFormStatus, WebFunnelType, WebFunnelStatus,
  WebExperimentType, WebExperimentStatus, TrafficSource, DeviceType, TrackingHealthStatus,
  TrackingDestinationProvider, DestinationStatus,
} from './constants'

export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface PageBlock { id: string; type: string; [key: string]: unknown }

export interface PageRow {
  id: string
  workspace_id: string
  name: string
  slug: string
  page_type: WebPageType
  status: WebPageStatus
  owner_id: string | null
  sessions: number
  conversions: number
  content: PageBlock[]
  seo_title: string | null
  seo_description: string | null
  version: number
  published_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface FormField { id: string; type: string; label: string; required: boolean; options?: string[] }

export interface FormRow {
  id: string
  workspace_id: string
  name: string
  form_type: WebFormType
  status: WebFormStatus
  owner_id: string | null
  destination_label: string | null
  submissions_count: number
  completed_count: number
  avg_completion_seconds: number
  fields: FormField[]
  confirmation_message: string
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface FormSubmissionRow {
  id: string
  workspace_id: string
  form_id: string
  data: Record<string, unknown>
  completed: boolean
  source_url: string | null
  created_at: string
}

export interface FunnelStepRow {
  id: string
  funnel_id: string
  step_order: number
  name: string
  users_count: number
}

export interface FunnelRow {
  id: string
  workspace_id: string
  name: string
  funnel_type: WebFunnelType
  status: WebFunnelStatus
  owner_id: string | null
  entries: number
  conversions: number
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
  steps?: FunnelStepRow[]
}

export interface ExperimentRow {
  id: string
  workspace_id: string
  name: string
  experiment_type: WebExperimentType
  surface_ref: string | null
  status: WebExperimentStatus
  owner_id: string | null
  control_visitors: number
  control_conversions: number
  variant_visitors: number
  variant_conversions: number
  traffic_allocation_percent: number
  starts_at: string | null
  ends_at: string | null
  winner: 'control' | 'variant' | null
  archived_at: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface ExperimentAssignmentRow {
  id: string
  experiment_id: string
  visitor_id: string
  variant: 'control' | 'variant'
  converted: boolean
  created_at: string
}

export interface TrackingEventRow {
  id: string
  workspace_id: string
  event_name: string
  event_category: 'conversion' | 'engagement'
  source: string
  destinations: string[]
  status: TrackingHealthStatus
  volume: number
  coverage_percent: number
  last_received_at: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
  owner?: PersonLite | null
}

export interface TrackingDestinationRow {
  id: string
  workspace_id: string
  provider: TrackingDestinationProvider
  name: string
  status: DestinationStatus
  last_success_at: string | null
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
  created_at: string
  actor?: PersonLite | null
}

export interface MetricPoint {
  metric_date: string
  source: TrafficSource
  device: DeviceType
  sessions: number
  conversions: number
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

/** One row of the mixed-entity "Web experiences" table on Overview. */
export interface WebExperienceRow {
  id: string
  kind: 'page' | 'form' | 'funnel' | 'experiment' | 'tracking_event'
  name: string
  subLabel: string
  typeLabel: string
  ownerName: string | null
  status: string
  statusLabel: string
  statusBadge: 'default' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate' | 'outline'
  traffic: number | null
  conversions: number | null
  conversionRate: number | null
  updatedAt: string
  href: string
}
