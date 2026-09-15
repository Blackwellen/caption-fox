// Canonical Community module vocabulary.
//
// Every label, badge tone and ordering used by the six Community surfaces
// resolves from here so the pages stay visually and semantically consistent,
// mirroring src/lib/creators/constants.ts.

import type { BadgeVariant } from '@/components/ui/Badge'

export const COMMUNITY_MODULES = [
  'overview', 'communities', 'calendar', 'moderation', 'members', 'advocacy',
] as const
export type CommunityModule = typeof COMMUNITY_MODULES[number]

export const COMMUNITY_BASE = '/app/community'

export const COMMUNITY_MODULE_META: Record<CommunityModule, {
  label: string
  href: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', href: COMMUNITY_BASE, title: 'Community Overview', breadcrumb: 'Overview',
    description: 'Manage communities, moderation, member engagement, and advocacy programs.',
  },
  communities: {
    label: 'Communities', href: `${COMMUNITY_BASE}/communities`, title: 'Communities', breadcrumb: 'Communities',
    description: 'Browse and manage every community workspace, membership and health signal.',
  },
  calendar: {
    label: 'Calendar', href: `${COMMUNITY_BASE}/calendar`, title: 'Community Calendar', breadcrumb: 'Calendar',
    description: 'Schedule live sessions, AMAs, challenges and recurring community events.',
  },
  moderation: {
    label: 'Moderation', href: `${COMMUNITY_BASE}/moderation`, title: 'Community Moderation', breadcrumb: 'Moderation',
    description: 'Review reports, enforce policy and keep every community safe.',
  },
  members: {
    label: 'Members', href: `${COMMUNITY_BASE}/members`, title: 'Community Members', breadcrumb: 'Members',
    description: 'Understand membership lifecycle, engagement and churn risk across communities.',
  },
  advocacy: {
    label: 'Advocacy', href: `${COMMUNITY_BASE}/advocacy`, title: 'Community Advocacy', breadcrumb: 'Advocacy',
    description: 'Run ambassador, referral and UGC programs that turn members into advocates.',
  },
}

// ── Communities ──────────────────────────────────────────────────────────────
export const COMMUNITY_TYPES = [
  'brand', 'product', 'support', 'creator', 'customer', 'beta', 'regional', 'interest',
] as const
export type CommunityType = typeof COMMUNITY_TYPES[number]
export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  brand: 'Brand', product: 'Product', support: 'Support', creator: 'Creator',
  customer: 'Customer', beta: 'Beta / Insider', regional: 'Regional', interest: 'Interest group',
}

export const COMMUNITY_PRIVACY = ['public', 'private', 'restricted'] as const
export type CommunityPrivacy = typeof COMMUNITY_PRIVACY[number]
export const COMMUNITY_PRIVACY_LABELS: Record<CommunityPrivacy, string> = {
  public: 'Public', private: 'Private', restricted: 'Restricted',
}
export const COMMUNITY_PRIVACY_BADGE: Record<CommunityPrivacy, BadgeVariant> = {
  public: 'green', private: 'slate', restricted: 'amber',
}

export const COMMUNITY_STATUSES = ['draft', 'active', 'paused', 'restricted', 'archived'] as const
export type CommunityStatus = typeof COMMUNITY_STATUSES[number]
export const COMMUNITY_STATUS_LABELS: Record<CommunityStatus, string> = {
  draft: 'Draft', active: 'Active', paused: 'Paused', restricted: 'Restricted', archived: 'Archived',
}
export const COMMUNITY_STATUS_BADGE: Record<CommunityStatus, BadgeVariant> = {
  draft: 'slate', active: 'green', paused: 'amber', restricted: 'red', archived: 'slate',
}

export const ACTIVITY_LEVELS = ['low', 'moderate', 'high', 'very_high'] as const
export type ActivityLevel = typeof ACTIVITY_LEVELS[number]
export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  low: 'Low', moderate: 'Moderate', high: 'High', very_high: 'Very high',
}

export const HEALTH_STATES = ['excellent', 'good', 'average', 'needs_attention', 'critical'] as const
export type HealthState = typeof HEALTH_STATES[number]
export const HEALTH_STATE_LABELS: Record<HealthState, string> = {
  excellent: 'Excellent', good: 'Good', average: 'Average',
  needs_attention: 'Needs attention', critical: 'Critical',
}
export const HEALTH_STATE_BADGE: Record<HealthState, BadgeVariant> = {
  excellent: 'green', good: 'blue', average: 'amber', needs_attention: 'red', critical: 'red',
}
export const HEALTH_STATE_COLOUR: Record<HealthState, string> = {
  excellent: '#10b981', good: '#3b82f6', average: '#f59e0b', needs_attention: '#f97316', critical: '#ef4444',
}

export const COMMUNITY_REGIONS = ['UK', 'US', 'CA', 'AU', 'IE', 'DE', 'FR', 'ES', 'NL', 'Global', 'Other'] as const

// ── Members ──────────────────────────────────────────────────────────────────
export const MEMBER_ROLES = [
  'member', 'engaged_member', 'top_contributor', 'ambassador', 'moderator', 'admin',
] as const
export type MemberRole = typeof MEMBER_ROLES[number]
export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Member', engaged_member: 'Engaged Member', top_contributor: 'Top Contributor',
  ambassador: 'Ambassador', moderator: 'Moderator', admin: 'Admin',
}
export const MEMBER_ROLE_BADGE: Record<MemberRole, BadgeVariant> = {
  member: 'slate', engaged_member: 'blue', top_contributor: 'violet',
  ambassador: 'amber', moderator: 'blue', admin: 'green',
}

export const LIFECYCLE_STAGES = ['new', 'active', 'engaged', 'advocate', 'at_risk', 'inactive'] as const
export type LifecycleStage = typeof LIFECYCLE_STAGES[number]
export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  new: 'New', active: 'Active', engaged: 'Engaged', advocate: 'Advocate', at_risk: 'At risk', inactive: 'Inactive',
}
export const LIFECYCLE_STAGE_BADGE: Record<LifecycleStage, BadgeVariant> = {
  new: 'blue', active: 'green', engaged: 'violet', advocate: 'amber', at_risk: 'red', inactive: 'slate',
}

export const MEMBER_STATUSES = ['active', 'at_risk', 'inactive', 'suspended', 'banned', 'archived'] as const
export type MemberStatus = typeof MEMBER_STATUSES[number]
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Active', at_risk: 'At risk', inactive: 'Inactive',
  suspended: 'Suspended', banned: 'Banned', archived: 'Archived',
}
export const MEMBER_STATUS_DOT: Record<MemberStatus, string> = {
  active: 'bg-emerald-500', at_risk: 'bg-amber-500', inactive: 'bg-slate-300',
  suspended: 'bg-orange-500', banned: 'bg-red-500', archived: 'bg-slate-300',
}

export const MEMBERSHIP_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type MembershipRequestStatus = typeof MEMBERSHIP_REQUEST_STATUSES[number]

// ── Calendar / events ────────────────────────────────────────────────────────
export const EVENT_TYPES = [
  'live_session', 'ama', 'qa', 'webinar', 'challenge', 'training', 'community_event',
] as const
export type EventType = typeof EVENT_TYPES[number]
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  live_session: 'Live Session', ama: 'AMA', qa: 'Q&A', webinar: 'Webinar',
  challenge: 'Challenge', training: 'Training', community_event: 'Community event',
}
export const EVENT_TYPE_COLOUR: Record<EventType, string> = {
  live_session: '#3b82f6', ama: '#8b5cf6', qa: '#8b5cf6', webinar: '#0ea5e9',
  challenge: '#f59e0b', training: '#10b981', community_event: '#64748b',
}
export const EVENT_TYPE_BADGE: Record<EventType, BadgeVariant> = {
  live_session: 'blue', ama: 'violet', qa: 'violet', webinar: 'blue',
  challenge: 'amber', training: 'green', community_event: 'slate',
}

export const EVENT_STATUSES = ['confirmed', 'pending', 'needs_approval', 'cancelled'] as const
export type EventStatus = typeof EVENT_STATUSES[number]
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  confirmed: 'Confirmed', pending: 'Pending', needs_approval: 'Needs approval', cancelled: 'Cancelled',
}
export const EVENT_STATUS_BADGE: Record<EventStatus, BadgeVariant> = {
  confirmed: 'green', pending: 'amber', needs_approval: 'red', cancelled: 'slate',
}
export const EVENT_STATUS_DOT: Record<EventStatus, string> = {
  confirmed: 'bg-emerald-500', pending: 'bg-amber-500', needs_approval: 'bg-red-500', cancelled: 'bg-slate-300',
}

export const EVENT_REGISTRATION_STATUSES = ['registered', 'waitlisted', 'cancelled'] as const

// ── Moderation ───────────────────────────────────────────────────────────────
export const MODERATION_REASONS = [
  'spam', 'hate_speech', 'harassment', 'off_topic', 'profanity', 'impersonation', 'violence_threats', 'misleading', 'other',
] as const
export type ModerationReason = typeof MODERATION_REASONS[number]
export const MODERATION_REASON_LABELS: Record<ModerationReason, string> = {
  spam: 'Spam', hate_speech: 'Hate speech', harassment: 'Harassment', off_topic: 'Off topic',
  profanity: 'Profanity', impersonation: 'Impersonation', violence_threats: 'Violence / threats',
  misleading: 'Misleading', other: 'Other',
}

export const MODERATION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type ModerationSeverity = typeof MODERATION_SEVERITIES[number]
export const MODERATION_SEVERITY_LABELS: Record<ModerationSeverity, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
}
export const MODERATION_SEVERITY_BADGE: Record<ModerationSeverity, BadgeVariant> = {
  low: 'slate', medium: 'amber', high: 'red', critical: 'red',
}
export const MODERATION_SEVERITY_COLOUR: Record<ModerationSeverity, string> = {
  low: '#94a3b8', medium: '#f59e0b', high: '#ef4444', critical: '#b91c1c',
}

export const MODERATION_STATUSES = ['new', 'in_review', 'escalated', 'resolved', 'dismissed', 'archived'] as const
export type ModerationStatus = typeof MODERATION_STATUSES[number]
export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  new: 'New', in_review: 'In review', escalated: 'Escalated',
  resolved: 'Resolved', dismissed: 'Dismissed', archived: 'Archived',
}
export const MODERATION_STATUS_BADGE: Record<ModerationStatus, BadgeVariant> = {
  new: 'red', in_review: 'amber', escalated: 'violet', resolved: 'green', dismissed: 'slate', archived: 'slate',
}

export const MODERATION_CONTENT_TYPES = ['post', 'comment', 'message', 'profile', 'media', 'event'] as const
export const MODERATION_CONTENT_TYPE_LABELS: Record<string, string> = {
  post: 'Post', comment: 'Comment', message: 'Message', profile: 'Profile', media: 'Media', event: 'Event',
}

export const MODERATION_DECISIONS = [
  'approve', 'remove_content', 'warn_user', 'suspend_user', 'ban_user', 'escalate',
] as const
export type ModerationDecision = typeof MODERATION_DECISIONS[number]
export const MODERATION_DECISION_LABELS: Record<ModerationDecision, string> = {
  approve: 'Approve', remove_content: 'Remove content', warn_user: 'Warn user',
  suspend_user: 'Suspend user', ban_user: 'Ban user', escalate: 'Escalate',
}

export const MODERATION_TRANSITIONS: Record<ModerationStatus, ModerationStatus[]> = {
  new: ['new', 'in_review', 'escalated', 'dismissed', 'resolved'],
  in_review: ['in_review', 'escalated', 'resolved', 'dismissed'],
  escalated: ['escalated', 'in_review', 'resolved', 'dismissed'],
  resolved: ['resolved', 'archived'],
  dismissed: ['dismissed', 'archived'],
  archived: ['archived'],
}
export function canTransitionModeration(from: string, to: string): boolean {
  const allowed = MODERATION_TRANSITIONS[from as ModerationStatus]
  return allowed ? allowed.includes(to as ModerationStatus) : false
}

// ── Advocacy ─────────────────────────────────────────────────────────────────
export const ADVOCACY_PROGRAM_TYPES = ['ambassador', 'referral', 'ugc', 'beta_insider', 'events', 'challenge'] as const
export type AdvocacyProgramType = typeof ADVOCACY_PROGRAM_TYPES[number]
export const ADVOCACY_PROGRAM_TYPE_LABELS: Record<AdvocacyProgramType, string> = {
  ambassador: 'Ambassador', referral: 'Referral', ugc: 'UGC', beta_insider: 'Beta insider',
  events: 'Events', challenge: 'Challenge',
}

export const ADVOCACY_PROGRAM_STATUSES = ['draft', 'active', 'upcoming', 'completed', 'archived'] as const
export type AdvocacyProgramStatus = typeof ADVOCACY_PROGRAM_STATUSES[number]
export const ADVOCACY_PROGRAM_STATUS_LABELS: Record<AdvocacyProgramStatus, string> = {
  draft: 'Draft', active: 'Active', upcoming: 'Upcoming', completed: 'Completed', archived: 'Archived',
}
export const ADVOCACY_PROGRAM_STATUS_BADGE: Record<AdvocacyProgramStatus, BadgeVariant> = {
  draft: 'slate', active: 'green', upcoming: 'blue', completed: 'violet', archived: 'slate',
}

export const ADVOCACY_TIERS = ['member', 'advocate', 'ambassador', 'super_advocate'] as const
export type AdvocacyTier = typeof ADVOCACY_TIERS[number]
export const ADVOCACY_TIER_LABELS: Record<AdvocacyTier, string> = {
  member: 'Member', advocate: 'Advocate', ambassador: 'Ambassador', super_advocate: 'Super Advocate',
}
export const ADVOCACY_TIER_BADGE: Record<AdvocacyTier, BadgeVariant> = {
  member: 'slate', advocate: 'blue', ambassador: 'violet', super_advocate: 'amber',
}

export const ADVOCACY_ENROLLMENT_STATUSES = ['active', 'paused', 'removed'] as const

export const REWARD_STATUSES = ['pending', 'approved', 'rejected', 'issued', 'redeemed'] as const
export type RewardStatus = typeof REWARD_STATUSES[number]
export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', issued: 'Issued', redeemed: 'Redeemed',
}
export const REWARD_STATUS_BADGE: Record<RewardStatus, BadgeVariant> = {
  pending: 'amber', approved: 'blue', rejected: 'red', issued: 'green', redeemed: 'slate',
}

// ── Sorting / paging ─────────────────────────────────────────────────────────
export const COMMUNITY_SORTS = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'name_asc', label: 'Name (A–Z)' },
  { id: 'members_desc', label: 'Members (most)' },
  { id: 'engagement_desc', label: 'Engagement (highest)' },
] as const
export type CommunitySort = typeof COMMUNITY_SORTS[number]['id']

export const EVENT_SORTS = [
  { id: 'date_soonest', label: 'Date (soonest)' },
  { id: 'date_latest', label: 'Date (latest)' },
  { id: 'rsvp_desc', label: 'RSVPs (most)' },
] as const
export type EventSort = typeof EVENT_SORTS[number]['id']

export const MODERATION_SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'severity_desc', label: 'Severity (highest)' },
  { id: 'reports_desc', label: 'Report count (most)' },
] as const
export type ModerationSort = typeof MODERATION_SORTS[number]['id']

export const MEMBER_SORTS = [
  { id: 'recent', label: 'Recently active' },
  { id: 'joined_desc', label: 'Joined (newest)' },
  { id: 'engagement_desc', label: 'Engagement (highest)' },
  { id: 'advocacy_desc', label: 'Advocacy score (highest)' },
  { id: 'name_asc', label: 'Name (A–Z)' },
] as const
export type MemberSort = typeof MEMBER_SORTS[number]['id']

export const ADVOCACY_SORTS = [
  { id: 'points_desc', label: 'Points (highest)' },
  { id: 'referrals_desc', label: 'Referrals (most)' },
  { id: 'score_desc', label: 'Advocacy score (highest)' },
] as const
export type AdvocacySort = typeof ADVOCACY_SORTS[number]['id']

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10
export const DEFAULT_GALLERY_PAGE_SIZE = 25

/** Rolling comparison window used by every KPI delta on these surfaces. */
export const TREND_WINDOW_DAYS = 30

/** Days before expiry a compliance-style deadline is flagged (unused today, kept for parity with other modules). */
export const REVIEW_SLA_HOURS = 24
