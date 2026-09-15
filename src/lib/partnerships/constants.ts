// Canonical Partnerships vocabulary. Every label, badge tone, ordering and
// metric definition used by the seven Partnerships surfaces resolves from
// here so the pages stay visually and semantically consistent.

import type { BadgeVariant } from '@/components/ui/Badge'

export const PARTNERSHIP_MODULES = [
  'overview', 'affiliates', 'referrals', 'ambassadors', 'loyalty', 'resellers', 'co_marketing',
] as const
export type PartnershipModule = typeof PARTNERSHIP_MODULES[number]

export const PROGRAMME_TYPES = [
  'affiliate', 'referral', 'ambassador', 'loyalty', 'reseller', 'co_marketing',
] as const
export type ProgrammeType = typeof PROGRAMME_TYPES[number]

/** Maps a module route to the programme type it manages. Overview has none. */
export const MODULE_PROGRAMME_TYPE: Partial<Record<PartnershipModule, ProgrammeType>> = {
  affiliates: 'affiliate', referrals: 'referral', ambassadors: 'ambassador',
  loyalty: 'loyalty', resellers: 'reseller', co_marketing: 'co_marketing',
}

/** partnership_partners.partner_type mirrors programme_type 1:1. */
export const PROGRAMME_TYPE_TO_PARTNER_TYPE: Record<ProgrammeType, string> = {
  affiliate: 'affiliate', referral: 'referral_advocate', ambassador: 'ambassador',
  loyalty: 'loyalty_member', reseller: 'reseller', co_marketing: 'co_marketing_partner',
}

export const PROGRAMME_TYPE_LABELS: Record<ProgrammeType, string> = {
  affiliate: 'Affiliate', referral: 'Referral', ambassador: 'Ambassador',
  loyalty: 'Loyalty', reseller: 'Reseller', co_marketing: 'Co-marketing',
}

export interface ModuleMeta {
  label: string
  href: string
  title: string
  breadcrumb: string
  description: string
  createPartnerLabel: string
  primaryMetricLabel: string
  secondaryMetricLabel: string
}

export const PARTNERSHIP_MODULE_META: Record<PartnershipModule, ModuleMeta> = {
  overview: {
    label: 'Overview', href: '/app/partnerships', title: 'Partnerships Overview', breadcrumb: 'Overview',
    description: 'Your primary Partnerships landing page. Manage programmes, partners, performance and take action on what matters most.',
    createPartnerLabel: 'New partner', primaryMetricLabel: 'Clicks', secondaryMetricLabel: 'Conversions',
  },
  affiliates: {
    label: 'Affiliates', href: '/app/partnerships/affiliates', title: 'Affiliate Partnerships', breadcrumb: 'Affiliates',
    description: 'Manage affiliate programmes, publishers, tracking links, commissions and partner performance.',
    createPartnerLabel: 'New affiliate', primaryMetricLabel: 'Clicks', secondaryMetricLabel: 'Conversions',
  },
  referrals: {
    label: 'Referrals', href: '/app/partnerships/referrals', title: 'Referral Partnerships', breadcrumb: 'Referrals',
    description: 'Manage referral programmes, advocates, referrals, rewards and referred revenue.',
    createPartnerLabel: 'New referral', primaryMetricLabel: 'Referrals', secondaryMetricLabel: 'Conversions',
  },
  ambassadors: {
    label: 'Ambassadors', href: '/app/partnerships/ambassadors', title: 'Brand Ambassadors', breadcrumb: 'Ambassadors',
    description: 'Manage ambassador programmes, creator partners, content approvals, performance and commissions.',
    createPartnerLabel: 'New ambassador', primaryMetricLabel: 'Reach', secondaryMetricLabel: 'Conversions',
  },
  loyalty: {
    label: 'Loyalty', href: '/app/partnerships/loyalty', title: 'Loyalty Partnerships', breadcrumb: 'Loyalty',
    description: 'Manage loyalty programmes, members, tiers, rewards, redemptions and repeat-purchase growth.',
    createPartnerLabel: 'New loyalty member', primaryMetricLabel: 'Members', secondaryMetricLabel: 'Redemptions',
  },
  resellers: {
    label: 'Resellers', href: '/app/partnerships/resellers', title: 'Reseller Partnerships', breadcrumb: 'Resellers',
    description: 'Manage reseller programmes, partner accounts, territories, pipeline, rebates and partner-generated revenue.',
    createPartnerLabel: 'New reseller', primaryMetricLabel: 'Opportunities', secondaryMetricLabel: 'Deals',
  },
  co_marketing: {
    label: 'Co-marketing', href: '/app/partnerships/co-marketing', title: 'Co-marketing Partnerships', breadcrumb: 'Co-marketing',
    description: 'Manage joint campaigns, shared content, partner contributions, shared spend, leads and attributed revenue.',
    createPartnerLabel: 'New co-marketing partner', primaryMetricLabel: 'Leads', secondaryMetricLabel: 'Conversions',
  },
}

// ── Programme lifecycle ──────────────────────────────────────────────────────
export const PROGRAMME_STATUSES = [
  'draft', 'in_review', 'active', 'paused', 'scheduled', 'closed', 'archived',
] as const
export type ProgrammeStatus = typeof PROGRAMME_STATUSES[number]

export const PROGRAMME_STATUS_LABELS: Record<ProgrammeStatus, string> = {
  draft: 'Draft', in_review: 'In review', active: 'Active', paused: 'Paused',
  scheduled: 'Scheduled', closed: 'Closed', archived: 'Archived',
}
export const PROGRAMME_STATUS_BADGE: Record<ProgrammeStatus, BadgeVariant> = {
  draft: 'slate', in_review: 'violet', active: 'green', paused: 'amber',
  scheduled: 'blue', closed: 'slate', archived: 'slate',
}

// ── Partner lifecycle ────────────────────────────────────────────────────────
export const PARTNER_STATUSES = [
  'applicant', 'pending_review', 'approved', 'active', 'paused', 'at_risk',
  'suspended', 'rejected', 'offboarded', 'archived',
] as const
export type PartnerStatus = typeof PARTNER_STATUSES[number]

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  applicant: 'Applicant', pending_review: 'Pending review', approved: 'Approved', active: 'Active',
  paused: 'Paused', at_risk: 'At risk', suspended: 'Suspended', rejected: 'Rejected',
  offboarded: 'Offboarded', archived: 'Archived',
}
export const PARTNER_STATUS_BADGE: Record<PartnerStatus, BadgeVariant> = {
  applicant: 'slate', pending_review: 'amber', approved: 'blue', active: 'green',
  paused: 'amber', at_risk: 'amber', suspended: 'red', rejected: 'red',
  offboarded: 'slate', archived: 'slate',
}

export const PARTNER_HEALTH_LABELS: Record<string, string> = {
  healthy: 'Healthy', at_risk: 'At risk', critical: 'Critical',
}
export const PARTNER_HEALTH_BADGE: Record<string, BadgeVariant> = {
  healthy: 'green', at_risk: 'amber', critical: 'red',
}

// ── Applications ─────────────────────────────────────────────────────────────
export const APPLICATION_STATUSES = [
  'pending', 'in_review', 'approved', 'changes_requested', 'rejected', 'withdrawn',
] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending', in_review: 'In review', approved: 'Approved',
  changes_requested: 'Changes requested', rejected: 'Rejected', withdrawn: 'Withdrawn',
}
export const APPLICATION_STATUS_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  pending: 'amber', in_review: 'violet', approved: 'green',
  changes_requested: 'blue', rejected: 'red', withdrawn: 'slate',
}

// ── Commissions ───────────────────────────────────────────────────────────────
export const COMMISSION_STATUSES = [
  'pending', 'validated', 'approved', 'on_hold', 'reversed', 'payable', 'paid', 'rejected',
] as const
export type CommissionStatus = typeof COMMISSION_STATUSES[number]
export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Pending', validated: 'Validated', approved: 'Approved', on_hold: 'On hold',
  reversed: 'Reversed', payable: 'Payable', paid: 'Paid', rejected: 'Rejected',
}
export const COMMISSION_STATUS_BADGE: Record<CommissionStatus, BadgeVariant> = {
  pending: 'slate', validated: 'blue', approved: 'violet', on_hold: 'amber',
  reversed: 'red', payable: 'blue', paid: 'green', rejected: 'red',
}

// ── Payouts ───────────────────────────────────────────────────────────────────
export const PAYOUT_STATUSES = [
  'draft', 'pending_review', 'approved', 'processing', 'paid', 'partially_paid', 'failed', 'on_hold', 'cancelled',
] as const
export type PayoutStatus = typeof PAYOUT_STATUSES[number]
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  draft: 'Draft', pending_review: 'Pending review', approved: 'Approved', processing: 'Processing',
  paid: 'Paid', partially_paid: 'Partially paid', failed: 'Failed', on_hold: 'On hold', cancelled: 'Cancelled',
}
export const PAYOUT_STATUS_BADGE: Record<PayoutStatus, BadgeVariant> = {
  draft: 'slate', pending_review: 'amber', approved: 'blue', processing: 'violet',
  paid: 'green', partially_paid: 'blue', failed: 'red', on_hold: 'amber', cancelled: 'slate',
}

// ── Rewards ───────────────────────────────────────────────────────────────────
export const REWARD_TYPES = ['cash', 'gift_card', 'store_credit', 'free_product', 'discount', 'points', 'custom'] as const
export const REWARD_TYPE_LABELS: Record<string, string> = {
  cash: 'Cash', gift_card: 'Gift card', store_credit: 'Store credit',
  free_product: 'Free product', discount: 'Discount', points: 'Points', custom: 'Custom',
}
export const REWARD_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', issued: 'Issued', redeemed: 'Redeemed', expired: 'Expired',
}
export const REWARD_STATUS_BADGE: Record<string, BadgeVariant> = {
  pending: 'amber', issued: 'blue', redeemed: 'green', expired: 'slate',
}

// ── Platforms / channels shown as chips on partner cards ────────────────────
export const PARTNER_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'pinterest', 'web', 'email'] as const
export const PLATFORM_TINT: Record<string, string> = {
  instagram: 'bg-pink-50 text-pink-600 ring-pink-100',
  tiktok: 'bg-slate-100 text-slate-800 ring-slate-200',
  youtube: 'bg-red-50 text-red-600 ring-red-100',
  facebook: 'bg-blue-50 text-blue-600 ring-blue-100',
  x: 'bg-slate-100 text-slate-800 ring-slate-200',
  linkedin: 'bg-sky-50 text-sky-700 ring-sky-100',
  pinterest: 'bg-rose-50 text-rose-600 ring-rose-100',
  web: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  email: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export const PARTNER_SORTS = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'revenue_desc', label: 'Revenue (highest)' },
  { id: 'commission_desc', label: 'Commission (highest)' },
  { id: 'conversions_desc', label: 'Conversions (highest)' },
  { id: 'name_asc', label: 'Name (A–Z)' },
] as const
export type PartnerSort = typeof PARTNER_SORTS[number]['id']

export const PAGE_SIZES = [12, 24, 48, 96] as const
export const DEFAULT_PAGE_SIZE = 12
