// Canonical Campaign Manager → Campaigns vocabulary.
// Every label, badge tone and ordering used by the seven Campaigns surfaces
// resolves from here so the pages stay visually and semantically consistent.

import type { BadgeVariant } from '@/components/ui/Badge'

export const CAMPAIGN_MODULES = [
  'overview', 'all', 'giveaways', 'competitions', 'templates', 'board', 'timeline',
] as const
export type CampaignModule = typeof CAMPAIGN_MODULES[number]

export const CAMPAIGN_MODULE_META: Record<CampaignModule, {
  label: string
  href: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', href: '/app/campaigns', title: 'Campaigns', breadcrumb: 'Overview',
    description: 'Manage the entire campaign lifecycle, track performance, and take action on what matters most.',
  },
  all: {
    label: 'All', href: '/app/campaigns/all', title: 'All Campaigns', breadcrumb: 'All',
    description: 'Search, filter, sort, and manage all authorised campaign records across your organisation.',
  },
  giveaways: {
    label: 'Giveaways', href: '/app/campaigns/giveaways', title: 'Giveaways', breadcrumb: 'Giveaways',
    description: 'Manage giveaway campaigns, entries, rewards, approvals, and performance.',
  },
  competitions: {
    label: 'Competitions', href: '/app/campaigns/competitions', title: 'Competitions', breadcrumb: 'Competitions',
    description: 'Manage competition campaigns, judging workflows, submissions, and performance.',
  },
  templates: {
    label: 'Templates', href: '/app/campaigns/templates', title: 'Campaign Templates', breadcrumb: 'Templates',
    description: 'Manage reusable templates for campaign setup, launch workflows, budgets, and channels.',
  },
  board: {
    label: 'Board', href: '/app/campaigns/board', title: 'Campaign Board', breadcrumb: 'Board',
    description: 'An operational view of campaign records to plan, track and deliver work across stages.',
  },
  timeline: {
    label: 'Timeline', href: '/app/campaigns/timeline', title: 'Campaign Timeline', breadcrumb: 'Timeline',
    description: 'Alternative operational view of campaign records for planning and delivery.',
  },
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
export const LIFECYCLE_STAGES = [
  'planning', 'in_progress', 'in_review', 'scheduled', 'live', 'completed', 'at_risk', 'blocked', 'archived',
] as const
export type LifecycleStage = typeof LIFECYCLE_STAGES[number]

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  planning: 'Planning', in_progress: 'In progress', in_review: 'In review',
  scheduled: 'Scheduled', live: 'Live', completed: 'Completed',
  at_risk: 'At risk', blocked: 'Blocked', archived: 'Archived',
}

export const LIFECYCLE_BADGE: Record<LifecycleStage, BadgeVariant> = {
  planning: 'slate', in_progress: 'blue', in_review: 'violet', scheduled: 'blue',
  live: 'green', completed: 'green', at_risk: 'amber', blocked: 'red', archived: 'slate',
}

/** Columns rendered by the Campaign Board, in delivery order. */
export const BOARD_STAGES: LifecycleStage[] = [
  'planning', 'in_review', 'scheduled', 'live', 'completed', 'at_risk',
]

/** Stage transitions the board allows. Archived is terminal from the board. */
export const ALLOWED_STAGE_TRANSITIONS: Record<LifecycleStage, LifecycleStage[]> = {
  planning: ['planning', 'in_progress', 'in_review', 'scheduled', 'at_risk', 'blocked'],
  in_progress: ['in_progress', 'planning', 'in_review', 'scheduled', 'live', 'at_risk', 'blocked'],
  in_review: ['in_review', 'planning', 'in_progress', 'scheduled', 'at_risk', 'blocked'],
  scheduled: ['scheduled', 'in_review', 'live', 'at_risk', 'blocked'],
  live: ['live', 'scheduled', 'completed', 'at_risk', 'blocked'],
  completed: ['completed', 'live', 'archived'],
  at_risk: ['at_risk', 'planning', 'in_progress', 'in_review', 'scheduled', 'live', 'blocked'],
  blocked: ['blocked', 'planning', 'in_progress', 'in_review', 'at_risk'],
  archived: ['archived', 'planning'],
}

export function canTransitionStage(from: string, to: string): boolean {
  const allowed = ALLOWED_STAGE_TRANSITIONS[from as LifecycleStage]
  return allowed ? allowed.includes(to as LifecycleStage) : false
}

// ── Health / status ──────────────────────────────────────────────────────────
export const HEALTH_VALUES = ['on_track', 'at_risk', 'overdue', 'blocked'] as const
export type CampaignHealth = typeof HEALTH_VALUES[number]

export const HEALTH_LABELS: Record<CampaignHealth, string> = {
  on_track: 'On track', at_risk: 'At risk', overdue: 'Overdue', blocked: 'Blocked',
}
export const HEALTH_BADGE: Record<CampaignHealth, BadgeVariant> = {
  on_track: 'green', at_risk: 'amber', overdue: 'red', blocked: 'red',
}

/** Health rollup shown in the "Health" column — combines health with overdue dates. */
export function healthLabel(health: string, endDate?: string | null): { label: string; variant: BadgeVariant } {
  const overdue = Boolean(endDate) && new Date(endDate as string) < new Date()
  if (health === 'blocked') return { label: 'Blocked', variant: 'red' }
  if (health === 'overdue' || (overdue && health !== 'on_track')) return { label: 'Overdue', variant: 'red' }
  if (health === 'at_risk') return { label: 'At risk', variant: 'amber' }
  return { label: 'Healthy', variant: 'green' }
}

// ── Priority ─────────────────────────────────────────────────────────────────
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type CampaignPriority = typeof PRIORITIES[number]

export const PRIORITY_LABELS: Record<CampaignPriority, string> = {
  low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
}
export const PRIORITY_BADGE: Record<CampaignPriority, BadgeVariant> = {
  low: 'slate', medium: 'blue', high: 'amber', urgent: 'red',
}
export const PRIORITY_RANK: Record<CampaignPriority, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

// ── Approval ─────────────────────────────────────────────────────────────────
export const APPROVAL_STATUSES = ['not_required', 'pending', 'approved', 'changes_requested', 'rejected'] as const
export type ApprovalStatus = typeof APPROVAL_STATUSES[number]

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  not_required: 'Not required', pending: 'Pending', approved: 'Approved',
  changes_requested: 'Changes requested', rejected: 'Rejected',
}
export const APPROVAL_BADGE: Record<ApprovalStatus, BadgeVariant> = {
  not_required: 'slate', pending: 'amber', approved: 'green',
  changes_requested: 'violet', rejected: 'red',
}

// ── Templates ────────────────────────────────────────────────────────────────
export const TEMPLATE_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const
export type TemplateStatus = typeof TEMPLATE_STATUSES[number]

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  draft: 'Draft', in_review: 'In review', published: 'Published', archived: 'Archived',
}
export const TEMPLATE_STATUS_BADGE: Record<TemplateStatus, BadgeVariant> = {
  draft: 'blue', in_review: 'violet', published: 'green', archived: 'slate',
}

export const TEMPLATE_TYPES = ['multi_channel', 'single_channel', 'social_email', 'omnichannel', 'event', 'other'] as const
export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  multi_channel: 'Multi-channel', single_channel: 'Single channel',
  social_email: 'Social + Email', omnichannel: 'Omnichannel', event: 'Event', other: 'Other',
}

// ── Giveaways ────────────────────────────────────────────────────────────────
export const PRIZE_FULFILMENT = ['pending', 'in_progress', 'fulfilled', 'cancelled'] as const
export const PRIZE_FULFILMENT_LABELS: Record<string, string> = {
  pending: 'Pending', in_progress: 'In progress', fulfilled: 'Fulfilled', cancelled: 'Cancelled',
}
export const PRIZE_FULFILMENT_BADGE: Record<string, BadgeVariant> = {
  pending: 'violet', in_progress: 'amber', fulfilled: 'blue', cancelled: 'green',
}

export const WINNER_STATUSES = ['none', 'candidate', 'approved', 'rejected', 'contacted', 'accepted', 'fulfilled', 'replaced'] as const
export type WinnerStatus = typeof WINNER_STATUSES[number]
export const WINNER_STATUS_LABELS: Record<WinnerStatus, string> = {
  none: 'Not a winner', candidate: 'Awaiting review', approved: 'Approved', rejected: 'Rejected',
  contacted: 'Contacted', accepted: 'Accepted', fulfilled: 'Prize fulfilled', replaced: 'Replaced',
}
export const WINNER_STATUS_BADGE: Record<WinnerStatus, BadgeVariant> = {
  none: 'slate', candidate: 'amber', approved: 'green', rejected: 'red',
  contacted: 'blue', accepted: 'violet', fulfilled: 'green', replaced: 'slate',
}

// ── Competitions ─────────────────────────────────────────────────────────────
export const JUDGING_STAGES = ['pending', 'in_progress', 'review', 'shortlist', 'final_review', 'completed'] as const
export type JudgingStage = typeof JUDGING_STAGES[number]
export const JUDGING_STAGE_LABELS: Record<JudgingStage, string> = {
  pending: 'Pending', in_progress: 'In progress', review: 'Review',
  shortlist: 'Shortlist', final_review: 'Final review', completed: 'Completed',
}
export const JUDGING_STAGE_BADGE: Record<JudgingStage, BadgeVariant> = {
  pending: 'slate', in_progress: 'blue', review: 'amber',
  shortlist: 'violet', final_review: 'blue', completed: 'green',
}

export const SUBMISSION_STATUSES = ['pending', 'in_progress', 'review', 'shortlist', 'final_review', 'completed', 'rejected', 'disqualified'] as const
export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  ...JUDGING_STAGE_LABELS, rejected: 'Rejected', disqualified: 'Disqualified',
}

// ── Channels ─────────────────────────────────────────────────────────────────
export const CAMPAIGN_CHANNELS = [
  'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'pinterest', 'email', 'web',
] as const
export type CampaignChannel = typeof CAMPAIGN_CHANNELS[number]

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook',
  linkedin: 'LinkedIn', x: 'X', pinterest: 'Pinterest', email: 'Email', web: 'Web',
}

/** Brand tints for the channel chips shown on cards. */
export const CHANNEL_TINT: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-600 ring-pink-100',
  tiktok: 'bg-slate-100 text-slate-800 ring-slate-200',
  youtube: 'bg-red-50 text-red-600 ring-red-100',
  facebook: 'bg-blue-50 text-blue-600 ring-blue-100',
  linkedin: 'bg-sky-50 text-sky-700 ring-sky-100',
  x: 'bg-slate-100 text-slate-800 ring-slate-200',
  pinterest: 'bg-rose-50 text-rose-600 ring-rose-100',
  email: 'bg-violet-50 text-violet-600 ring-violet-100',
  web: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
}

// ── Sorting ──────────────────────────────────────────────────────────────────
export const CAMPAIGN_SORTS = [
  { id: 'due_soonest', label: 'Due date (soonest)' },
  { id: 'due_latest', label: 'Due date (latest)' },
  { id: 'name_asc', label: 'Name (A–Z)' },
  { id: 'name_desc', label: 'Name (Z–A)' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'budget_desc', label: 'Budget (highest)' },
  { id: 'progress_desc', label: 'Progress (highest)' },
  { id: 'priority', label: 'Priority' },
] as const
export type CampaignSort = typeof CAMPAIGN_SORTS[number]['id']

export const PAGE_SIZES = [12, 24, 48, 96] as const
export const DEFAULT_PAGE_SIZE = 12
