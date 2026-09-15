// Canonical Campaign Manager → Messaging vocabulary.
// Every label, badge tone and ordering used by the eight Messaging surfaces
// resolves from here so the pages stay visually and semantically consistent.

import type { BadgeVariant } from '@/components/ui/Badge'

export const MESSAGING_MODULES = [
  'overview', 'email', 'sms', 'whatsapp', 'rcs', 'push', 'journeys', 'templates',
] as const
export type MessagingModule = typeof MESSAGING_MODULES[number]

export const MESSAGING_MODULE_META: Record<MessagingModule, {
  label: string
  href: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', href: '/app/messaging', title: 'Messaging Overview', breadcrumb: 'Overview',
    description: 'Orchestrate lifecycle messaging across channels, track performance, and take action to drive engagement and conversions.',
  },
  email: {
    label: 'Email', href: '/app/messaging/email', title: 'Email Messaging', breadcrumb: 'Email',
    description: 'Manage lifecycle email campaigns, deliverability, and performance.',
  },
  sms: {
    label: 'SMS', href: '/app/messaging/sms', title: 'SMS Messaging', breadcrumb: 'SMS',
    description: 'Manage SMS campaigns, journeys, compliance and performance.',
  },
  whatsapp: {
    label: 'WhatsApp', href: '/app/messaging/whatsapp', title: 'WhatsApp Messaging', breadcrumb: 'WhatsApp',
    description: 'Send, automate and analyse WhatsApp conversations with approved templates, journeys and rich engagement.',
  },
  rcs: {
    label: 'RCS', href: '/app/messaging/rcs', title: 'RCS Messaging', breadcrumb: 'RCS',
    description: 'Create branded rich messaging with carousels and actions, and track campaign performance.',
  },
  push: {
    label: 'Push', href: '/app/messaging/push', title: 'Push Messaging', breadcrumb: 'Push',
    description: 'Create and send mobile and web push notifications, build journeys, and track engagement performance.',
  },
  journeys: {
    label: 'Journeys', href: '/app/messaging/journeys', title: 'Messaging Journeys', breadcrumb: 'Journeys',
    description: 'Orchestrate automated cross-channel lifecycle automations to drive engagement, retention and revenue.',
  },
  templates: {
    label: 'Templates', href: '/app/messaging/templates', title: 'Messaging Templates', breadcrumb: 'Templates',
    description: 'Manage reusable message templates across email, SMS, WhatsApp, RCS and push.',
  },
}

// ── Channels ─────────────────────────────────────────────────────────────────
export const MESSAGING_CHANNELS = ['email', 'sms', 'whatsapp', 'rcs', 'push'] as const
export type MessagingChannel = typeof MESSAGING_CHANNELS[number]

export const CHANNEL_LABELS: Record<MessagingChannel, string> = {
  email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', rcs: 'RCS', push: 'Push',
}

export const CHANNEL_TINT: Record<MessagingChannel, string> = {
  email: 'bg-violet-50 text-violet-600 ring-violet-100',
  sms: 'bg-blue-50 text-blue-600 ring-blue-100',
  whatsapp: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  rcs: 'bg-sky-50 text-sky-700 ring-sky-100',
  push: 'bg-amber-50 text-amber-600 ring-amber-100',
}

// ── Message status / approval ────────────────────────────────────────────────
export const MESSAGE_STATUSES = ['draft', 'pending_approval', 'scheduled', 'sending', 'sent', 'paused', 'failed', 'cancelled'] as const
export type MessageStatus = typeof MESSAGE_STATUSES[number]

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  draft: 'Draft', pending_approval: 'Pending approval', scheduled: 'Scheduled', sending: 'Sending',
  sent: 'Sent', paused: 'Paused', failed: 'Failed', cancelled: 'Cancelled',
}
export const MESSAGE_STATUS_BADGE: Record<MessageStatus, BadgeVariant> = {
  draft: 'slate', pending_approval: 'amber', scheduled: 'blue', sending: 'blue',
  sent: 'green', paused: 'amber', failed: 'red', cancelled: 'slate',
}

export const APPROVAL_STATUSES = ['not_required', 'pending', 'approved', 'changes_requested', 'rejected'] as const
export type MessagingApprovalStatus = typeof APPROVAL_STATUSES[number]
export const APPROVAL_LABELS: Record<MessagingApprovalStatus, string> = {
  not_required: 'Not required', pending: 'Pending', approved: 'Approved',
  changes_requested: 'Changes requested', rejected: 'Rejected',
}
export const APPROVAL_BADGE: Record<MessagingApprovalStatus, BadgeVariant> = {
  not_required: 'slate', pending: 'amber', approved: 'green', changes_requested: 'violet', rejected: 'red',
}

// ── Journeys ─────────────────────────────────────────────────────────────────
export const JOURNEY_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const
export type JourneyStatus = typeof JOURNEY_STATUSES[number]
export const JOURNEY_STATUS_LABELS: Record<JourneyStatus, string> = {
  draft: 'Draft', active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived',
}
export const JOURNEY_STATUS_BADGE: Record<JourneyStatus, BadgeVariant> = {
  draft: 'slate', active: 'green', paused: 'amber', completed: 'blue', archived: 'slate',
}

export const JOURNEY_HEALTH_LABELS: Record<string, string> = {
  good: 'Good', at_risk: 'At risk', critical: 'Critical',
}
export const JOURNEY_HEALTH_BADGE: Record<string, BadgeVariant> = {
  good: 'green', at_risk: 'amber', critical: 'red',
}

// ── Templates ────────────────────────────────────────────────────────────────
export const TEMPLATE_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const
export type MessagingTemplateStatus = typeof TEMPLATE_STATUSES[number]
export const TEMPLATE_STATUS_LABELS: Record<MessagingTemplateStatus, string> = {
  draft: 'Draft', in_review: 'In review', published: 'Published', archived: 'Archived',
}
export const TEMPLATE_STATUS_BADGE: Record<MessagingTemplateStatus, BadgeVariant> = {
  draft: 'blue', in_review: 'violet', published: 'green', archived: 'slate',
}

// ── Channel health ───────────────────────────────────────────────────────────
export const CHANNEL_CONFIG_STATUSES = ['not_connected', 'connected', 'degraded', 'error'] as const
export type ChannelConfigStatus = typeof CHANNEL_CONFIG_STATUSES[number]
export const CHANNEL_CONFIG_LABELS: Record<ChannelConfigStatus, string> = {
  not_connected: 'Not connected', connected: 'Operational', degraded: 'Degraded', error: 'Error',
}
export const CHANNEL_CONFIG_BADGE: Record<ChannelConfigStatus, BadgeVariant> = {
  not_connected: 'slate', connected: 'green', degraded: 'amber', error: 'red',
}

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10
