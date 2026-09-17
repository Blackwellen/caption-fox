// Canonical Campaign Manager -> Creators & UGC vocabulary.
//
// Every label, badge tone and ordering used by the six Creators & UGC
// surfaces resolves from here so the pages stay visually and semantically
// consistent, and so a status string is never invented at the page level.

import type { BadgeVariant } from '@/components/ui/Badge'

export const CREATOR_MODULES = [
  'overview', 'creators', 'briefs', 'submissions', 'rights', 'payments',
] as const
export type CreatorModule = typeof CREATOR_MODULES[number]

/** Legacy prefix; canonical URLs come from `creatorsBase(kind)` in ./routes. */
export const CREATOR_BASE = '/app/creators'

export const CREATOR_MODULE_META: Record<CreatorModule, {
  label: string
  /** Legacy path, kept for stored links; pages build URLs from their basePath. */
  href: string
  title: string
  description: string
  breadcrumb: string
}> = {
  overview: {
    label: 'Overview', href: CREATOR_BASE, title: 'Creators and UGC Overview', breadcrumb: 'Overview',
    description: 'Manage creator partnerships, UGC pipeline, rights, and payments in one place.',
  },
  creators: {
    label: 'Creators', href: `${CREATOR_BASE}/creators`, title: 'Creators', breadcrumb: 'Creators',
    description: 'Discover, manage, and collaborate with the perfect creators for your brand.',
  },
  briefs: {
    label: 'Briefs', href: `${CREATOR_BASE}/briefs`, title: 'Briefs', breadcrumb: 'Briefs',
    description: 'Create, manage and track creator briefs from draft to approval and delivery.',
  },
  submissions: {
    label: 'Submissions', href: `${CREATOR_BASE}/submissions`, title: 'Submissions', breadcrumb: 'Submissions',
    description: 'Review, approve, and manage creator submissions and UGC deliverables.',
  },
  rights: {
    label: 'Rights', href: `${CREATOR_BASE}/rights`, title: 'Rights', breadcrumb: 'Rights',
    description: 'Manage creator usage rights, licences, and compliance across all campaigns and assets.',
  },
  payments: {
    label: 'Payments', href: `${CREATOR_BASE}/payments`, title: 'Payments', breadcrumb: 'Payments',
    description: 'Track, manage, and reconcile creator payments and payouts.',
  },
}

// ── Creator relationship ─────────────────────────────────────────────────────
// The workspace's relationship with a creator. Deliberately separate from
// availability, rights readiness and payment readiness: a creator can be
// active but unavailable, or available with no rights on file.
export const RELATIONSHIP_STATUSES = [
  'discovered', 'invited', 'invitation_accepted', 'onboarding', 'available',
  'shortlisted', 'in_review', 'active', 'paused', 'unavailable', 'archived', 'blocked',
] as const
export type RelationshipStatus = typeof RELATIONSHIP_STATUSES[number]

export const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  discovered: 'Discovery', invited: 'Invited', invitation_accepted: 'Invitation accepted',
  onboarding: 'Onboarding', available: 'Available', shortlisted: 'Shortlisted',
  in_review: 'In Review', active: 'Active', paused: 'Paused',
  unavailable: 'Unavailable', archived: 'Archived', blocked: 'Blocked',
}

export const RELATIONSHIP_BADGE: Record<RelationshipStatus, BadgeVariant> = {
  discovered: 'slate', invited: 'blue', invitation_accepted: 'blue', onboarding: 'violet',
  available: 'green', shortlisted: 'violet', in_review: 'blue', active: 'green',
  paused: 'amber', unavailable: 'slate', archived: 'slate', blocked: 'red',
}

/** Relationship states that count as a live working relationship. */
export const ACTIVE_RELATIONSHIPS: RelationshipStatus[] = [
  'onboarding', 'available', 'shortlisted', 'in_review', 'active',
]

export const CREATOR_TIERS = ['creator', 'pro', 'elite'] as const
export type CreatorTier = typeof CREATOR_TIERS[number]
export const CREATOR_TIER_LABELS: Record<CreatorTier, string> = {
  creator: 'Creator', pro: 'Pro', elite: 'Elite',
}
export const CREATOR_TIER_BADGE: Record<CreatorTier, BadgeVariant> = {
  creator: 'slate', pro: 'blue', elite: 'violet',
}

export const RIGHTS_READINESS = ['none', 'limited', 'full'] as const
export type RightsReadiness = typeof RIGHTS_READINESS[number]
export const RIGHTS_READINESS_LABELS: Record<RightsReadiness, string> = {
  none: 'No Rights', limited: 'Limited', full: 'Full Usage',
}
export const RIGHTS_READINESS_BADGE: Record<RightsReadiness, BadgeVariant> = {
  none: 'red', limited: 'amber', full: 'green',
}

export const AVAILABILITY_VALUES = ['unknown', 'available', 'limited', 'booked', 'unavailable'] as const
export type Availability = typeof AVAILABILITY_VALUES[number]
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  unknown: 'Not stated', available: 'Available', limited: 'Limited',
  booked: 'Booked', unavailable: 'Unavailable',
}

export const CREATOR_NICHES = [
  'beauty', 'fashion', 'fitness', 'food', 'gaming', 'home', 'lifestyle',
  'tech', 'travel', 'wellness', 'family', 'finance', 'pets', 'other',
] as const
export const NICHE_LABELS: Record<string, string> = {
  beauty: 'Beauty', fashion: 'Fashion', fitness: 'Fitness', food: 'Food',
  gaming: 'Gaming', home: 'Home', lifestyle: 'Lifestyle', tech: 'Tech',
  travel: 'Travel', wellness: 'Wellness', family: 'Family', finance: 'Finance',
  pets: 'Pets', other: 'Other',
}
export const NICHE_TINT: Record<string, string> = {
  beauty: 'bg-pink-50 text-pink-600 ring-pink-100',
  fashion: 'bg-violet-50 text-violet-600 ring-violet-100',
  fitness: 'bg-orange-50 text-orange-600 ring-orange-100',
  food: 'bg-amber-50 text-amber-700 ring-amber-100',
  gaming: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  home: 'bg-teal-50 text-teal-700 ring-teal-100',
  lifestyle: 'bg-sky-50 text-sky-700 ring-sky-100',
  tech: 'bg-slate-100 text-slate-700 ring-slate-200',
  travel: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  wellness: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  family: 'bg-rose-50 text-rose-600 ring-rose-100',
  finance: 'bg-blue-50 text-blue-700 ring-blue-100',
  pets: 'bg-lime-50 text-lime-700 ring-lime-100',
  other: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export const AUDIENCE_BANDS = [
  { id: 'nano', label: 'Nano (< 10K)', min: 0, max: 10_000 },
  { id: 'micro', label: 'Micro (10K – 100K)', min: 10_000, max: 100_000 },
  { id: 'mid', label: 'Mid (100K – 500K)', min: 100_000, max: 500_000 },
  { id: 'macro', label: 'Macro (500K – 1M)', min: 500_000, max: 1_000_000 },
  { id: 'mega', label: 'Mega (1M+)', min: 1_000_000, max: Number.MAX_SAFE_INTEGER },
] as const
export type AudienceBand = typeof AUDIENCE_BANDS[number]['id']

export const CREATOR_REGIONS = ['UK', 'US', 'CA', 'AU', 'IE', 'DE', 'FR', 'ES', 'NL', 'KR', 'JP', 'Other'] as const

// ── Channels / platforms ─────────────────────────────────────────────────────
export const CREATOR_CHANNELS = [
  'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'pinterest', 'twitch', 'web',
] as const
export type CreatorChannel = typeof CREATOR_CHANNELS[number]

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook',
  linkedin: 'LinkedIn', x: 'X', pinterest: 'Pinterest', twitch: 'Twitch', web: 'Web',
}

export const CHANNEL_TINT: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-600 ring-pink-100',
  tiktok: 'bg-slate-900 text-white ring-slate-900',
  youtube: 'bg-red-50 text-red-600 ring-red-100',
  facebook: 'bg-blue-50 text-blue-600 ring-blue-100',
  linkedin: 'bg-sky-50 text-sky-700 ring-sky-100',
  x: 'bg-slate-100 text-slate-800 ring-slate-200',
  pinterest: 'bg-rose-50 text-rose-600 ring-rose-100',
  twitch: 'bg-violet-50 text-violet-600 ring-violet-100',
  web: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
}

// ── Briefs ───────────────────────────────────────────────────────────────────
export const BRIEF_STATUSES = [
  'draft', 'open', 'in_progress', 'submitted', 'completed', 'on_hold', 'cancelled',
] as const
export type BriefStatus = typeof BRIEF_STATUSES[number]

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  draft: 'Draft', open: 'Open', in_progress: 'In Progress', submitted: 'Submitted',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
}
export const BRIEF_STATUS_BADGE: Record<BriefStatus, BadgeVariant> = {
  draft: 'slate', open: 'blue', in_progress: 'amber', submitted: 'violet',
  completed: 'green', on_hold: 'amber', cancelled: 'red',
}
/** Dot colour used on the board column headers and summary donut. */
export const BRIEF_STATUS_COLOUR: Record<BriefStatus, string> = {
  draft: '#f59e0b', open: '#3b82f6', in_progress: '#f97316', submitted: '#8b5cf6',
  completed: '#10b981', on_hold: '#94a3b8', cancelled: '#ef4444',
}

/** Columns rendered by the Briefs board, in delivery order. */
export const BRIEF_BOARD_STAGES: BriefStatus[] = [
  'draft', 'open', 'in_progress', 'submitted', 'completed',
]

/** Brief status transitions the board and status menu allow. */
export const BRIEF_TRANSITIONS: Record<BriefStatus, BriefStatus[]> = {
  draft: ['draft', 'open', 'cancelled'],
  open: ['open', 'draft', 'in_progress', 'on_hold', 'cancelled'],
  in_progress: ['in_progress', 'open', 'submitted', 'on_hold', 'cancelled'],
  submitted: ['submitted', 'in_progress', 'completed', 'on_hold'],
  completed: ['completed', 'submitted'],
  on_hold: ['on_hold', 'open', 'in_progress', 'cancelled'],
  cancelled: ['cancelled', 'draft'],
}

export function canTransitionBrief(from: string, to: string): boolean {
  const allowed = BRIEF_TRANSITIONS[from as BriefStatus]
  return allowed ? allowed.includes(to as BriefStatus) : false
}

export const BRIEF_APPROVAL_STAGES = [
  'not_sent', 'brief_sent', 'waiting_for_creator', 'in_review',
  'pending_approval', 'approved', 'changes_requested', 'rejected',
] as const
export type BriefApprovalStage = typeof BRIEF_APPROVAL_STAGES[number]
export const BRIEF_APPROVAL_LABELS: Record<BriefApprovalStage, string> = {
  not_sent: 'Not Sent', brief_sent: 'Brief Sent', waiting_for_creator: 'Waiting for Creator',
  in_review: 'In Review', pending_approval: 'Pending Approval', approved: 'Approved',
  changes_requested: 'Changes Requested', rejected: 'Rejected',
}
export const BRIEF_APPROVAL_BADGE: Record<BriefApprovalStage, BadgeVariant> = {
  not_sent: 'slate', brief_sent: 'blue', waiting_for_creator: 'amber', in_review: 'blue',
  pending_approval: 'amber', approved: 'green', changes_requested: 'violet', rejected: 'red',
}

/** Per-creator progress inside a brief. */
export const BRIEF_CREATOR_STATUSES = [
  'invited', 'viewed', 'accepted', 'declined', 'in_production',
  'submitted', 'changes_requested', 'approved', 'completed', 'cancelled',
] as const
export type BriefCreatorStatus = typeof BRIEF_CREATOR_STATUSES[number]
export const BRIEF_CREATOR_LABELS: Record<BriefCreatorStatus, string> = {
  invited: 'Invited', viewed: 'Viewed', accepted: 'Accepted', declined: 'Declined',
  in_production: 'In Production', submitted: 'Submitted', changes_requested: 'Changes Requested',
  approved: 'Approved', completed: 'Completed', cancelled: 'Cancelled',
}
export const BRIEF_CREATOR_BADGE: Record<BriefCreatorStatus, BadgeVariant> = {
  invited: 'blue', viewed: 'slate', accepted: 'green', declined: 'red',
  in_production: 'amber', submitted: 'violet', changes_requested: 'amber',
  approved: 'green', completed: 'green', cancelled: 'slate',
}

// ── Submissions ──────────────────────────────────────────────────────────────
export const SUBMISSION_STATUSES = [
  'draft', 'waiting_review', 'in_review', 'changes_requested', 'approved', 'rejected', 'published',
] as const
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number]

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Draft', waiting_review: 'Waiting Review', in_review: 'In Review',
  changes_requested: 'Changes Requested', approved: 'Approved',
  rejected: 'Rejected', published: 'Published',
}
export const SUBMISSION_STATUS_BADGE: Record<SubmissionStatus, BadgeVariant> = {
  draft: 'slate', waiting_review: 'amber', in_review: 'blue',
  changes_requested: 'red', approved: 'green', rejected: 'red', published: 'green',
}
export const SUBMISSION_STATUS_COLOUR: Record<SubmissionStatus, string> = {
  draft: '#94a3b8', waiting_review: '#f59e0b', in_review: '#8b5cf6',
  changes_requested: '#ef4444', approved: '#10b981', rejected: '#dc2626', published: '#059669',
}

export const SUBMISSION_BOARD_STAGES: SubmissionStatus[] = [
  'waiting_review', 'in_review', 'changes_requested', 'approved', 'rejected',
]

/**
 * Review lifecycle enforced on the server. Approving straight from
 * `waiting_review` is allowed (a reviewer can approve on first read), but a
 * rejected or approved submission cannot silently reopen without an explicit
 * new version.
 */
export const SUBMISSION_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: ['draft', 'waiting_review'],
  waiting_review: ['waiting_review', 'in_review', 'approved', 'changes_requested', 'rejected'],
  in_review: ['in_review', 'approved', 'changes_requested', 'rejected', 'waiting_review'],
  changes_requested: ['changes_requested', 'waiting_review', 'in_review', 'rejected'],
  approved: ['approved', 'published', 'in_review'],
  rejected: ['rejected', 'in_review'],
  published: ['published'],
}

export function canTransitionSubmission(from: string, to: string): boolean {
  const allowed = SUBMISSION_TRANSITIONS[from as SubmissionStatus]
  return allowed ? allowed.includes(to as SubmissionStatus) : false
}

export const ASSET_TYPES = [
  'video', 'image', 'carousel', 'audio', 'document', 'caption', 'raw_footage', 'package',
] as const
export type AssetType = typeof ASSET_TYPES[number]
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  video: 'Video', image: 'Image', carousel: 'Carousel', audio: 'Audio',
  document: 'Document', caption: 'Caption', raw_footage: 'Raw footage', package: 'Multi-file package',
}

export const ISSUE_CATEGORIES = [
  'brand_guideline', 'missing_disclosure', 'missing_music_licence', 'low_resolution',
  'wrong_aspect_ratio', 'incorrect_product_usage', 'missing_talking_point',
  'prohibited_claim', 'copyright_risk', 'trademark_risk', 'missing_raw_file',
  'missing_caption', 'rights_mismatch',
] as const
export type IssueCategory = typeof ISSUE_CATEGORIES[number]
export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  brand_guideline: 'Brand guideline mismatch',
  missing_disclosure: 'Missing disclosures',
  missing_music_licence: 'Missing music licence',
  low_resolution: 'Low resolution / quality',
  wrong_aspect_ratio: 'Incorrect aspect ratio',
  incorrect_product_usage: 'Incorrect product usage',
  missing_talking_point: 'Missing required talking point',
  prohibited_claim: 'Prohibited claim',
  copyright_risk: 'Copyright / trademark risk',
  trademark_risk: 'Trademark risk',
  missing_raw_file: 'Missing raw file',
  missing_caption: 'Missing caption',
  rights_mismatch: 'Rights mismatch',
}

/** Upload validation shared by the client picker and the server action. */
export const UPLOAD_LIMITS = {
  bucket: 'ugc-submissions',
  maxBytes: 500 * 1024 * 1024,
  maxFiles: 20,
  mimeTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'application/pdf',
  ],
} as const

export function mediaTypeForMime(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

// ── Rights ───────────────────────────────────────────────────────────────────
export const RIGHTS_STATUSES = [
  'draft', 'requested', 'pending_approval', 'active', 'expired',
  'restricted', 'revoked', 'renewal_pending', 'rejected',
] as const
export type RightsStatus = typeof RIGHTS_STATUSES[number]

export const RIGHTS_STATUS_LABELS: Record<RightsStatus, string> = {
  draft: 'Draft', requested: 'Requested', pending_approval: 'Pending Approval',
  active: 'Active', expired: 'Expired', restricted: 'Restricted',
  revoked: 'Revoked', renewal_pending: 'Renewal Pending', rejected: 'Rejected',
}
export const RIGHTS_STATUS_BADGE: Record<RightsStatus, BadgeVariant> = {
  draft: 'slate', requested: 'blue', pending_approval: 'violet', active: 'green',
  expired: 'red', restricted: 'amber', revoked: 'slate', renewal_pending: 'blue', rejected: 'red',
}
export const RIGHTS_STATUS_COLOUR: Record<RightsStatus, string> = {
  draft: '#cbd5e1', requested: '#3b82f6', pending_approval: '#8b5cf6', active: '#10b981',
  expired: '#ef4444', restricted: '#f59e0b', revoked: '#94a3b8',
  renewal_pending: '#0ea5e9', rejected: '#dc2626',
}

/**
 * Rights lifecycle enforced by the server. A licence only becomes active from
 * an approval step, and a revoked or rejected record never silently reopens.
 */
export const RIGHTS_TRANSITIONS: Record<RightsStatus, RightsStatus[]> = {
  draft: ['draft', 'requested', 'pending_approval'],
  requested: ['requested', 'pending_approval', 'rejected'],
  pending_approval: ['pending_approval', 'active', 'rejected', 'restricted'],
  active: ['active', 'restricted', 'revoked', 'renewal_pending', 'expired'],
  expired: ['expired', 'renewal_pending'],
  restricted: ['restricted', 'active', 'revoked'],
  revoked: ['revoked'],
  renewal_pending: ['renewal_pending', 'active', 'expired', 'revoked'],
  rejected: ['rejected', 'draft'],
}

export function canTransitionRights(from: string, to: string): boolean {
  const allowed = RIGHTS_TRANSITIONS[from as RightsStatus]
  return allowed ? allowed.includes(to as RightsStatus) : false
}

export const USAGE_SCOPES = [
  'organic_only', 'paid_social', 'full_digital', 'broadcast', 'print', 'retail',
  'internal', 'single_use', 'limited', 'exclusive', 'perpetual', 'custom',
] as const
export type UsageScope = typeof USAGE_SCOPES[number]
export const USAGE_SCOPE_LABELS: Record<UsageScope, string> = {
  organic_only: 'Organic Only', paid_social: 'Paid Social', full_digital: 'Full Digital',
  broadcast: 'Broadcast', print: 'Print', retail: 'Retail', internal: 'Internal',
  single_use: 'Single Use', limited: 'Limited', exclusive: 'Exclusive',
  perpetual: 'Perpetual', custom: 'Custom',
}
export const USAGE_SCOPE_BADGE: Record<UsageScope, BadgeVariant> = {
  organic_only: 'blue', paid_social: 'violet', full_digital: 'blue', broadcast: 'violet',
  print: 'slate', retail: 'slate', internal: 'slate', single_use: 'amber',
  limited: 'amber', exclusive: 'violet', perpetual: 'green', custom: 'slate',
}

export const RIGHTS_TERRITORIES = [
  'Worldwide', 'UK', 'US', 'CA', 'EU', 'North America', 'APAC', 'AU', 'Other',
] as const

/** Days before expiry at which a licence is reported as "expiring soon". */
export const RIGHTS_EXPIRING_DAYS = 30

/**
 * Derives the live rights status from stored status plus dates, so an expired
 * licence can never keep displaying "Active" because nobody updated the row.
 */
export function effectiveRightsStatus(status: string, expiryDate?: string | null): RightsStatus {
  const stored = status as RightsStatus
  if (stored === 'revoked' || stored === 'rejected' || stored === 'restricted') return stored
  if (!expiryDate) return stored
  const expiry = new Date(`${expiryDate}T23:59:59Z`).getTime()
  if (Number.isNaN(expiry)) return stored
  if (expiry < Date.now() && (stored === 'active' || stored === 'renewal_pending')) return 'expired'
  return stored
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null
  const target = new Date(`${date}T23:59:59Z`).getTime()
  if (Number.isNaN(target)) return null
  const days = (target - Date.now()) / 86_400_000
  return days < 0 ? Math.floor(days) : Math.ceil(days)
}

export const RIGHTS_CONFLICT_TYPES = [
  'expired_in_active_campaign', 'channel_not_licensed', 'territory_not_licensed',
  'paid_media_not_licensed', 'outside_date_range', 'exclusivity_conflict',
  'handle_usage_not_permitted', 'modification_not_permitted', 'missing_agreement',
  'agreement_not_signed', 'unapproved_submission_version', 'campaign_beyond_expiry',
  'request_still_pending',
] as const
export type RightsConflictType = typeof RIGHTS_CONFLICT_TYPES[number]
export const RIGHTS_CONFLICT_LABELS: Record<RightsConflictType, string> = {
  expired_in_active_campaign: 'Assets with expired rights',
  channel_not_licensed: 'Channel not licensed',
  territory_not_licensed: 'Territories missing documentation',
  paid_media_not_licensed: 'Paid media not licensed',
  outside_date_range: 'Usage outside licensed date range',
  exclusivity_conflict: 'Exclusive rights conflict',
  handle_usage_not_permitted: 'Creator handle usage not permitted',
  modification_not_permitted: 'Modification not permitted',
  missing_agreement: 'Missing agreement',
  agreement_not_signed: 'Agreement not signed',
  unapproved_submission_version: 'Rights linked to an unapproved version',
  campaign_beyond_expiry: 'Campaign runs beyond rights expiry',
  request_still_pending: 'Rights pending approval',
}

// ── Payments ─────────────────────────────────────────────────────────────────
export const PAYMENT_STATUSES = [
  'draft', 'invoice_required', 'invoice_submitted', 'in_review', 'pending_approval',
  'approved', 'scheduled', 'processing', 'paid', 'failed', 'on_hold',
  'cancelled', 'refunded', 'partially_paid',
] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: 'Draft', invoice_required: 'Invoice Required', invoice_submitted: 'Invoice Submitted',
  in_review: 'In Review', pending_approval: 'Pending Approval', approved: 'Approved',
  scheduled: 'Scheduled', processing: 'Processing', paid: 'Paid', failed: 'Failed',
  on_hold: 'On Hold', cancelled: 'Cancelled', refunded: 'Refunded', partially_paid: 'Partially Paid',
}
export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, BadgeVariant> = {
  draft: 'slate', invoice_required: 'amber', invoice_submitted: 'blue', in_review: 'amber',
  pending_approval: 'violet', approved: 'green', scheduled: 'blue', processing: 'blue',
  paid: 'green', failed: 'red', on_hold: 'amber', cancelled: 'slate',
  refunded: 'violet', partially_paid: 'amber',
}
export const PAYMENT_STATUS_COLOUR: Record<PaymentStatus, string> = {
  draft: '#cbd5e1', invoice_required: '#f59e0b', invoice_submitted: '#38bdf8', in_review: '#f59e0b',
  pending_approval: '#8b5cf6', approved: '#22c55e', scheduled: '#3b82f6', processing: '#0ea5e9',
  paid: '#10b981', failed: '#ef4444', on_hold: '#94a3b8', cancelled: '#64748b',
  refunded: '#a855f7', partially_paid: '#f97316',
}

/** Terminal states: editing these needs an explicit correction workflow. */
export const PAYMENT_LOCKED_STATUSES: PaymentStatus[] = ['paid', 'refunded', 'cancelled']

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ['draft', 'invoice_required', 'in_review', 'cancelled'],
  invoice_required: ['invoice_required', 'invoice_submitted', 'on_hold', 'cancelled'],
  invoice_submitted: ['invoice_submitted', 'in_review', 'on_hold', 'cancelled'],
  in_review: ['in_review', 'pending_approval', 'on_hold', 'cancelled'],
  pending_approval: ['pending_approval', 'approved', 'in_review', 'on_hold', 'cancelled'],
  approved: ['approved', 'scheduled', 'on_hold', 'cancelled'],
  scheduled: ['scheduled', 'processing', 'on_hold', 'cancelled'],
  processing: ['processing', 'paid', 'partially_paid', 'failed'],
  paid: ['paid', 'refunded'],
  failed: ['failed', 'scheduled', 'on_hold', 'cancelled'],
  on_hold: ['on_hold', 'in_review', 'pending_approval', 'cancelled'],
  cancelled: ['cancelled'],
  refunded: ['refunded'],
  partially_paid: ['partially_paid', 'paid', 'failed'],
}

export function canTransitionPayment(from: string, to: string): boolean {
  const allowed = PAYMENT_TRANSITIONS[from as PaymentStatus]
  return allowed ? allowed.includes(to as PaymentStatus) : false
}

/**
 * Payment methods Caption Fox can actually record today. Provider-processed
 * payouts stay out of this list until an integration is connected, so the UI
 * never offers a rail that does not exist.
 */
export const PAYMENT_METHODS = ['bank_transfer', 'paypal', 'wise', 'manual'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer', paypal: 'PayPal', wise: 'Wise', manual: 'Manual payment',
}
export const PAYMENT_METHOD_COLOUR: Record<string, string> = {
  bank_transfer: '#3b82f6', paypal: '#0ea5e9', wise: '#22c55e', manual: '#a855f7',
}

export const APPROVAL_STATES = ['not_submitted', 'pending', 'approved', 'rejected'] as const
export type ApprovalState = typeof APPROVAL_STATES[number]
export const APPROVAL_STATE_LABELS: Record<ApprovalState, string> = {
  not_submitted: 'Not submitted', pending: 'In Review', approved: 'Approved by', rejected: 'Rejected',
}

export const INVOICE_STATUSES = ['not_required', 'required', 'submitted', 'approved', 'flagged'] as const
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  not_required: 'Not required', required: 'Required', submitted: 'Submitted',
  approved: 'Approved', flagged: 'Flagged',
}
export const TAX_STATUSES = ['not_required', 'missing', 'submitted', 'verified'] as const
export const TAX_STATUS_LABELS: Record<string, string> = {
  not_required: 'Not required', missing: 'Missing tax info', submitted: 'Submitted', verified: 'Verified',
}

export const BATCH_STATUSES = [
  'draft', 'pending_approval', 'approved', 'scheduled', 'processing',
  'completed', 'partially_completed', 'failed', 'cancelled',
] as const
export type BatchStatus = typeof BATCH_STATUSES[number]
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved',
  scheduled: 'Scheduled', processing: 'Processing', completed: 'Completed',
  partially_completed: 'Partially completed', failed: 'Failed', cancelled: 'Cancelled',
}

/** Payments in these states are eligible to join a payout batch. */
export const BATCH_ELIGIBLE_STATUSES: PaymentStatus[] = ['approved', 'scheduled', 'failed']

// ── Invitations ──────────────────────────────────────────────────────────────
export const INVITATION_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired', 'revoked'] as const
export type InvitationStatus = typeof INVITATION_STATUSES[number]
export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined',
  expired: 'Expired', revoked: 'Revoked',
}
export const INVITATION_EXPIRY_DAYS = 14

// ── Sorting / paging ─────────────────────────────────────────────────────────
export const CREATOR_SORTS = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'name_asc', label: 'Name (A–Z)' },
  { id: 'name_desc', label: 'Name (Z–A)' },
  { id: 'audience_desc', label: 'Audience (largest)' },
  { id: 'engagement_desc', label: 'Engagement rate (highest)' },
  { id: 'rate_asc', label: 'Rate card (lowest)' },
  { id: 'rate_desc', label: 'Rate card (highest)' },
  { id: 'fit_desc', label: 'Campaign fit (best)' },
] as const
export type CreatorSort = typeof CREATOR_SORTS[number]['id']

export const BRIEF_SORTS = [
  { id: 'due_soonest', label: 'Deadline (soonest)' },
  { id: 'due_latest', label: 'Deadline (latest)' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'name_asc', label: 'Brief (A–Z)' },
  { id: 'budget_desc', label: 'Budget (highest)' },
  { id: 'creators_desc', label: 'Creators assigned (most)' },
] as const
export type BriefSort = typeof BRIEF_SORTS[number]['id']

export const SUBMISSION_SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'issues_desc', label: 'Most issues' },
  { id: 'engagement_desc', label: 'Engagement (highest)' },
  { id: 'views_desc', label: 'Views (highest)' },
] as const
export type SubmissionSort = typeof SUBMISSION_SORTS[number]['id']

export const RIGHTS_SORTS = [
  { id: 'expiry_soonest', label: 'Expiry (soonest)' },
  { id: 'expiry_latest', label: 'Expiry (latest)' },
  { id: 'start_newest', label: 'Start date (newest)' },
  { id: 'creator_asc', label: 'Creator (A–Z)' },
  { id: 'asset_asc', label: 'Asset (A–Z)' },
] as const
export type RightsSort = typeof RIGHTS_SORTS[number]['id']

export const PAYMENT_SORTS = [
  { id: 'submitted_newest', label: 'Submitted (newest)' },
  { id: 'submitted_oldest', label: 'Submitted (oldest)' },
  { id: 'amount_desc', label: 'Amount (highest)' },
  { id: 'amount_asc', label: 'Amount (lowest)' },
  { id: 'payout_soonest', label: 'Payout date (soonest)' },
  { id: 'creator_asc', label: 'Creator (A–Z)' },
] as const
export type PaymentSort = typeof PAYMENT_SORTS[number]['id']

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10
/** Cards/gallery views show a denser first page than the tables. */
export const DEFAULT_GALLERY_PAGE_SIZE = 25

/** Rolling comparison window used by every KPI delta on these surfaces. */
export const TREND_WINDOW_DAYS = 30
