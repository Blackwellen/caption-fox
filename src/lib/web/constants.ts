// Canonical Campaign Manager → Web & Conversion vocabulary.
// Every label, badge tone and ordering used by the six Web & Conversion
// surfaces resolves from here so the pages stay visually and semantically
// consistent — mirrors src/lib/messaging/constants.ts.

import type { BadgeVariant } from '@/components/ui/Badge'

export const WEB_MODULES = ['overview', 'pages', 'forms', 'funnels', 'experiments', 'tracking'] as const
export type WebModule = typeof WEB_MODULES[number]

export const WEB_MODULE_META: Record<WebModule, {
  label: string
  href: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', href: '/app/web', title: 'Web and Conversion', breadcrumb: 'Overview',
    description: 'Manage conversion experiences, pages, forms, funnels, experiments and tracking across your workspace.',
  },
  pages: {
    label: 'Pages', href: '/app/web/pages', title: 'Pages', breadcrumb: 'Pages',
    description: 'Create, manage and optimise landing pages, microsites and conversion destinations across your workspace.',
  },
  forms: {
    label: 'Forms', href: '/app/web/forms', title: 'Forms', breadcrumb: 'Forms',
    description: 'Build, publish and optimise conversion forms, capture flows and submission experiences across your workspace.',
  },
  funnels: {
    label: 'Funnels', href: '/app/web/funnels', title: 'Funnels', breadcrumb: 'Funnels',
    description: 'Plan, monitor and improve multi-step conversion funnels from traffic source to purchase or lead.',
  },
  experiments: {
    label: 'Experiments', href: '/app/web/experiments', title: 'Experiments', breadcrumb: 'Experiments',
    description: 'Run, monitor and evaluate A/B tests and conversion experiments across pages, forms and funnel steps.',
  },
  tracking: {
    label: 'Tracking', href: '/app/web/tracking', title: 'Tracking', breadcrumb: 'Tracking',
    description: 'Manage tracking events, pixels, destinations and conversion measurement across web experiences.',
  },
}

// ── Pages ────────────────────────────────────────────────────────────────────
export const PAGE_TYPES = ['landing_page', 'microsite'] as const
export type WebPageType = typeof PAGE_TYPES[number]
export const PAGE_TYPE_LABELS: Record<WebPageType, string> = { landing_page: 'Landing page', microsite: 'Microsite' }

export const PAGE_STATUSES = ['draft', 'published', 'archived'] as const
export type WebPageStatus = typeof PAGE_STATUSES[number]
export const PAGE_STATUS_LABELS: Record<WebPageStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }
export const PAGE_STATUS_BADGE: Record<WebPageStatus, BadgeVariant> = { draft: 'slate', published: 'green', archived: 'slate' }

// ── Forms ────────────────────────────────────────────────────────────────────
export const FORM_TYPES = ['lead_capture', 'subscription', 'registration', 'survey', 'contact'] as const
export type WebFormType = typeof FORM_TYPES[number]
export const FORM_TYPE_LABELS: Record<WebFormType, string> = {
  lead_capture: 'Lead capture', subscription: 'Subscription', registration: 'Registration', survey: 'Survey', contact: 'Contact',
}
/** Forms whose submissions count toward the "Qualified leads" KPI. */
export const QUALIFYING_FORM_TYPES: WebFormType[] = ['lead_capture', 'registration']

export const FORM_FIELD_TYPES = ['text', 'email', 'phone', 'select', 'checkbox'] as const
export type WebFormFieldType = typeof FORM_FIELD_TYPES[number]
export const FORM_FIELD_TYPE_LABELS: Record<WebFormFieldType, string> = {
  text: 'Text', email: 'Email', phone: 'Phone', select: 'Dropdown', checkbox: 'Checkbox',
}

export const FORM_STATUSES = ['draft', 'published', 'archived'] as const
export type WebFormStatus = typeof FORM_STATUSES[number]
export const FORM_STATUS_LABELS: Record<WebFormStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }
export const FORM_STATUS_BADGE: Record<WebFormStatus, BadgeVariant> = { draft: 'slate', published: 'green', archived: 'slate' }

// ── Funnels ──────────────────────────────────────────────────────────────────
export const FUNNEL_TYPES = ['standard', 'trial', 'lead_gen', 'promotion'] as const
export type WebFunnelType = typeof FUNNEL_TYPES[number]
export const FUNNEL_TYPE_LABELS: Record<WebFunnelType, string> = {
  standard: 'Standard', trial: 'Trial', lead_gen: 'Lead gen', promotion: 'Promotion',
}

export const FUNNEL_STATUSES = ['active', 'at_risk', 'paused', 'archived'] as const
export type WebFunnelStatus = typeof FUNNEL_STATUSES[number]
export const FUNNEL_STATUS_LABELS: Record<WebFunnelStatus, string> = {
  active: 'Active', at_risk: 'At risk', paused: 'Paused', archived: 'Archived',
}
export const FUNNEL_STATUS_BADGE: Record<WebFunnelStatus, BadgeVariant> = {
  active: 'green', at_risk: 'red', paused: 'amber', archived: 'slate',
}

// ── Experiments ──────────────────────────────────────────────────────────────
export const EXPERIMENT_TYPES = ['page', 'form', 'funnel'] as const
export type WebExperimentType = typeof EXPERIMENT_TYPES[number]
export const EXPERIMENT_TYPE_LABELS: Record<WebExperimentType, string> = { page: 'Page', form: 'Form', funnel: 'Funnel' }

export const EXPERIMENT_STATUSES = ['draft', 'planning', 'scheduled', 'running', 'paused', 'analyzing', 'completed', 'archived'] as const
export type WebExperimentStatus = typeof EXPERIMENT_STATUSES[number]
export const EXPERIMENT_STATUS_LABELS: Record<WebExperimentStatus, string> = {
  draft: 'Draft', planning: 'Planning', scheduled: 'Scheduled', running: 'Running',
  paused: 'Paused', analyzing: 'Analyzing', completed: 'Completed', archived: 'Archived',
}
export const EXPERIMENT_STATUS_BADGE: Record<WebExperimentStatus, BadgeVariant> = {
  draft: 'slate', planning: 'slate', scheduled: 'blue', running: 'green',
  paused: 'amber', analyzing: 'violet', completed: 'blue', archived: 'slate',
}

// ── Tracking ─────────────────────────────────────────────────────────────────
export const TRACKING_HEALTH_STATUSES = ['healthy', 'warning', 'critical'] as const
export type TrackingHealthStatus = typeof TRACKING_HEALTH_STATUSES[number]
export const TRACKING_HEALTH_LABELS: Record<TrackingHealthStatus, string> = {
  healthy: 'Healthy', warning: 'Warning', critical: 'Critical',
}
export const TRACKING_HEALTH_BADGE: Record<TrackingHealthStatus, BadgeVariant> = {
  healthy: 'green', warning: 'amber', critical: 'red',
}

export const TRACKING_DESTINATION_PROVIDERS = [
  'ga4', 'meta_pixel', 'linkedin_insight', 'google_ads', 'webhook', 'crm', 'segment', 'warehouse',
] as const
export type TrackingDestinationProvider = typeof TRACKING_DESTINATION_PROVIDERS[number]
export const TRACKING_DESTINATION_LABELS: Record<TrackingDestinationProvider, string> = {
  ga4: 'Google Analytics 4', meta_pixel: 'Meta Pixel', linkedin_insight: 'LinkedIn Insight Tag',
  google_ads: 'Google Ads', webhook: 'Custom Webhook', crm: 'CRM', segment: 'Segment', warehouse: 'Warehouse (BigQuery)',
}

export const DESTINATION_STATUSES = ['healthy', 'warning', 'error'] as const
export type DestinationStatus = typeof DESTINATION_STATUSES[number]
export const DESTINATION_STATUS_LABELS: Record<DestinationStatus, string> = {
  healthy: 'Healthy', warning: 'Warning', error: 'Error',
}
export const DESTINATION_STATUS_BADGE: Record<DestinationStatus, BadgeVariant> = {
  healthy: 'green', warning: 'amber', error: 'red',
}

// ── Traffic sources / devices (metrics dimensions) ──────────────────────────
export const TRAFFIC_SOURCES = ['organic_search', 'paid_search', 'direct', 'social', 'referral', 'other'] as const
export type TrafficSource = typeof TRAFFIC_SOURCES[number]
export const TRAFFIC_SOURCE_LABELS: Record<TrafficSource, string> = {
  organic_search: 'Organic Search', paid_search: 'Paid Search', direct: 'Direct',
  social: 'Social', referral: 'Referral', other: 'Other',
}

export const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'] as const
export type DeviceType = typeof DEVICE_TYPES[number]
export const DEVICE_LABELS: Record<DeviceType, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' }

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10
