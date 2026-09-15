// Canonical constants, row shapes and formatting helpers for the shared
// Marketplace module (/app/marketplace/*).
//
// The seller-side directory types live in ./supplier.ts and are reused here so
// there is a single definition of a supplier row across buyer and seller code.

import type { SupplierType } from './types'

// ── Module surfaces ──────────────────────────────────────────────────────────

export const MARKETPLACE_MODULES = [
  'overview', 'discover', 'influencers', 'services', 'ugc-creators',
  'categories', 'saved', 'requests', 'orders',
] as const
export type MarketplaceModule = (typeof MARKETPLACE_MODULES)[number]

export const MARKETPLACE_BASE = '/app/marketplace'

export const MODULE_ROUTES: Record<MarketplaceModule, string> = {
  overview: MARKETPLACE_BASE,
  discover: `${MARKETPLACE_BASE}/discover`,
  influencers: `${MARKETPLACE_BASE}/discover/influencers`,
  services: `${MARKETPLACE_BASE}/discover/services`,
  'ugc-creators': `${MARKETPLACE_BASE}/discover/ugc-creators`,
  categories: `${MARKETPLACE_BASE}/categories`,
  saved: `${MARKETPLACE_BASE}/saved`,
  requests: `${MARKETPLACE_BASE}/requests`,
  orders: `${MARKETPLACE_BASE}/orders`,
}

/** Primary Marketplace tab strip, in canonical order. */
export const MARKETPLACE_TABS: { id: MarketplaceModule; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'discover', label: 'Discover' },
  { id: 'categories', label: 'Categories' },
  { id: 'saved', label: 'Saved' },
  { id: 'requests', label: 'Requests' },
  { id: 'orders', label: 'Orders' },
]

/** Discover secondary navigation — the specialist search modes. */
export const DISCOVER_MODES: { id: MarketplaceModule; label: string }[] = [
  { id: 'discover', label: 'All discovery' },
  { id: 'influencers', label: 'Influencer search' },
  { id: 'services', label: 'Services search' },
  { id: 'ugc-creators', label: 'UGC creator search' },
]

/** The supplier types each specialist search mode is allowed to return. */
export const MODE_SUPPLIER_TYPES: Partial<Record<MarketplaceModule, SupplierType[]>> = {
  influencers: ['influencer'],
  'ugc-creators': ['ugc_creator'],
  services: ['agency', 'freelancer', 'ads_manager'],
}

// ── Profile presentation ─────────────────────────────────────────────────────

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  agency: 'Agency',
  freelancer: 'Freelancer',
  ads_manager: 'Ads manager',
  ugc_creator: 'UGC creator',
  influencer: 'Influencer',
}

export const PRICE_UNIT_LABELS: Record<string, string> = {
  project: 'per project', hour: 'per hour', day: 'per day', word: 'per word',
  post: 'per post', video: 'per video', month: 'per month',
}

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  linkedin: 'LinkedIn', facebook: 'Facebook', x: 'X', podcast: 'Podcast',
}

export const PLATFORMS = Object.keys(PLATFORM_LABELS)

export const REGIONS = ['Europe', 'North America', 'Asia Pacific', 'Middle East', 'Africa', 'South America']
export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Polish', 'Korean']

/** Budget bands used by every search card, in minor units. */
export const BUDGET_BANDS: { id: string; label: string; min?: number; max?: number }[] = [
  { id: '', label: 'Any budget' },
  { id: '0-25000', label: 'Under £250', min: 0, max: 25000 },
  { id: '25000-100000', label: '£250 – £1,000', min: 25000, max: 100000 },
  { id: '100000-250000', label: '£1,000 – £2,500', min: 100000, max: 250000 },
  { id: '250000-', label: '£2,500+', min: 250000 },
]

export const RATING_BANDS: { id: string; label: string; min: number }[] = [
  { id: '', label: 'Any rating', min: 0 },
  { id: '4', label: '4.0+ stars', min: 4 },
  { id: '4.5', label: '4.5+ stars', min: 4.5 },
  { id: '4.8', label: '4.8+ stars', min: 4.8 },
]

export const TURNAROUND_BANDS: { id: string; label: string; maxHours: number }[] = [
  { id: '', label: 'Any speed', maxHours: 0 },
  { id: '24', label: 'Within 24 hours', maxHours: 24 },
  { id: '48', label: 'Within 48 hours', maxHours: 48 },
  { id: '72', label: 'Within 3 days', maxHours: 72 },
  { id: '168', label: 'Within a week', maxHours: 168 },
]

export const AUDIENCE_BANDS: { id: string; label: string; min: number; max?: number }[] = [
  { id: '', label: 'Any audience', min: 0 },
  { id: '10000-100000', label: '10K – 100K', min: 10_000, max: 100_000 },
  { id: '100000-1000000', label: '100K – 1M', min: 100_000, max: 1_000_000 },
  { id: '1000000-', label: '1M+', min: 1_000_000 },
]

export const ENGAGEMENT_BANDS: { id: string; label: string; min: number }[] = [
  { id: '', label: 'Any engagement', min: 0 },
  { id: '2', label: '2%+', min: 2 },
  { id: '3', label: '3%+', min: 3 },
  { id: '5', label: '5%+', min: 5 },
]

export const SORTS = [
  { id: 'relevance', label: 'Best match' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'reviews', label: 'Most reviewed' },
  { id: 'price_low', label: 'Lowest price' },
  { id: 'price_high', label: 'Highest price' },
  { id: 'fastest', label: 'Fastest turnaround' },
  { id: 'audience', label: 'Largest audience' },
] as const
export type MarketplaceSort = (typeof SORTS)[number]['id']

export const PAGE_SIZES = [12, 24, 48] as const
export const DEFAULT_PAGE_SIZE = 12
export const MAX_COMPARE = 3

/** Popular search chips shown inside each premium search card. */
export const POPULAR_SEARCHES: Record<string, string[]> = {
  overview: ['YouTube', 'Video Editing', 'UGC Creators', 'SEO Content', 'Logo Design', 'LinkedIn', 'Voice Over'],
  discover: ['YouTube', 'Video Editing', 'UGC Creators', 'SEO Content', 'Logo Design', 'LinkedIn', 'Voice Over', 'Podcast', 'Web Design'],
  influencers: ['Fitness & Wellness', 'Beauty & Skincare', 'Tech Reviewers', 'Fashion & Style', 'Travel', 'Gaming', 'Home & Living', 'Food & Recipes'],
  services: ['Video Editing', 'UGC Creation', 'Social Media Content', 'Voice Over', 'Animation', 'Graphic Design', 'SEO Content', 'Translation'],
  'ugc-creators': ['Skincare unboxing', 'Tech reviews', 'Fitness transformation', 'Home organization', 'Beauty tutorial', 'App demo'],
  categories: ['Video Editing', 'UGC Creators', 'Voice Over', 'SEO Services', 'Graphic Design', 'Web Development', 'Copywriting'],
}

// ── Row shapes ───────────────────────────────────────────────────────────────

export interface MarketplaceProfile {
  id: string
  slug: string
  display_name: string
  type: SupplierType
  headline: string | null
  tagline: string | null
  bio: string | null
  location: string | null
  region: string | null
  country: string | null
  avatar_url: string | null
  cover_url: string | null
  rating: number
  reviews_count: number
  verified: boolean
  status: string
  tags: string[] | null
  platforms: string[] | null
  languages: string[] | null
  badges: string[] | null
  starting_price_cents: number | null
  price_unit: string | null
  min_order_cents: number | null
  currency: string
  turnaround_hours: number | null
  response_time_minutes: number | null
  on_time_delivery_pct: number | null
  job_success_pct: number | null
  projects_count: number | null
  available_now: boolean | null
  audience_size: number | null
  audience_summary: string | null
  engagement_rate: number | null
  follower_counts: Record<string, number> | null
  is_demo: boolean
}

export interface MarketplaceCategory {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  accent: string | null
  sort_order: number
  supplier_count: number
  projects_count: number
  avg_rating: number
  avg_price_cents: number
}

export interface SavedItem {
  id: string
  item_type: 'supplier' | 'creator' | 'service'
  supplier_id: string | null
  listing_id: string | null
  note: string | null
  tags: string[] | null
  collection: string | null
  last_interaction_at: string | null
  created_at: string
  supplier?: MarketplaceProfile | null
}

export interface SavedSearch {
  id: string
  name: string
  mode: string
  params: Record<string, string>
  result_count: number | null
  shared: boolean
  updated_at: string
}

export type RequestStatus = 'draft' | 'open' | 'awaiting_proposals' | 'shortlisted' | 'closed_won' | 'closed_cancelled'

export interface MarketplaceRequest {
  id: string
  reference: string
  kind: 'discovery' | 'rfq'
  title: string
  category: string | null
  description: string | null
  deliverables: string[] | null
  budget_min_cents: number | null
  budget_max_cents: number | null
  currency: string
  deadline: string | null
  status: RequestStatus
  proposals_requested: number | null
  created_at: string
  updated_at: string
  invited_count: number
  response_count: number
  invited_profiles: Pick<MarketplaceProfile, 'id' | 'display_name' | 'avatar_url'>[]
}

export type ProposalStatus = 'submitted' | 'shortlisted' | 'clarification' | 'rejected' | 'accepted' | 'withdrawn'

export interface MarketplaceProposal {
  id: string
  request_id: string
  supplier_id: string
  amount_cents: number
  currency: string
  delivery_days: number | null
  message: string | null
  status: ProposalStatus
  capability_score: number | null
  availability_score: number | null
  created_at: string
  supplier?: MarketplaceProfile | null
  request_title?: string | null
  match_score: number
}

export type EscrowStatus =
  | 'pending_funding' | 'funded' | 'in_escrow' | 'partially_released' | 'released'
  | 'on_hold' | 'refund_pending' | 'refunded' | 'cancelled' | 'failed'

export type DeliveryStatus =
  | 'not_started' | 'in_progress' | 'pending_delivery' | 'pending_review'
  | 'delivered' | 'overdue' | 'cancelled'

export type DisputeState = 'under_review' | 'awaiting_buyer' | 'awaiting_seller' | 'mediation' | 'resolved'

export interface MarketplaceOrder {
  id: string
  reference: string
  title: string | null
  category: string | null
  supplier_id: string
  amount_cents: number
  currency: string
  status: string
  escrow_status: EscrowStatus
  delivery_status: DeliveryStatus
  current_milestone: string | null
  due_date: string | null
  dispute_state: DisputeState | null
  released_cents: number
  refunded_cents: number
  created_at: string
  updated_at: string
  supplier?: MarketplaceProfile | null
}

export interface OrderMilestone {
  id: string
  order_id: string
  position: number
  title: string
  amount_cents: number
  due_date: string | null
  status: string
}

export interface MarketplaceDispute {
  id: string
  order_id: string
  stage: string
  reason: string | null
  severity: string | null
  amount_cents: number | null
  requested_resolution: string | null
  created_at: string
  order?: Pick<MarketplaceOrder, 'reference' | 'supplier_id'> | null
  supplier_name?: string | null
}

export interface ActivityEntry {
  id: string
  event: string
  summary: string
  entity_type: string | null
  entity_id: string | null
  href: string | null
  created_at: string
}

// ── Status metadata ──────────────────────────────────────────────────────────

export const ESCROW_META: Record<EscrowStatus, { label: string; cls: string; dot: string }> = {
  pending_funding: { label: 'Pending funding', cls: 'text-slate-600 bg-slate-100', dot: 'bg-slate-400' },
  funded: { label: 'Funded', cls: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
  in_escrow: { label: 'In escrow', cls: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
  partially_released: { label: 'Partly released', cls: 'text-violet-700 bg-violet-50', dot: 'bg-violet-500' },
  released: { label: 'Released', cls: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
  on_hold: { label: 'On hold', cls: 'text-amber-700 bg-amber-50', dot: 'bg-amber-500' },
  refund_pending: { label: 'Refund pending', cls: 'text-amber-700 bg-amber-50', dot: 'bg-amber-500' },
  refunded: { label: 'Refunded', cls: 'text-slate-600 bg-slate-100', dot: 'bg-slate-400' },
  cancelled: { label: 'Cancelled', cls: 'text-slate-600 bg-slate-100', dot: 'bg-slate-400' },
  failed: { label: 'Failed', cls: 'text-red-700 bg-red-50', dot: 'bg-red-500' },
}

export const DELIVERY_META: Record<DeliveryStatus, { label: string; cls: string; dot: string }> = {
  not_started: { label: 'Not started', cls: 'text-slate-600 bg-slate-100', dot: 'bg-slate-400' },
  in_progress: { label: 'In progress', cls: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
  pending_delivery: { label: 'Pending delivery', cls: 'text-amber-700 bg-amber-50', dot: 'bg-amber-500' },
  pending_review: { label: 'Pending review', cls: 'text-amber-700 bg-amber-50', dot: 'bg-amber-500' },
  delivered: { label: 'Delivered', cls: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
  overdue: { label: 'Overdue', cls: 'text-red-700 bg-red-50', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', cls: 'text-slate-600 bg-slate-100', dot: 'bg-slate-400' },
}

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'text-slate-600 bg-slate-100' },
  open: { label: 'Open', cls: 'text-blue-700 bg-blue-50' },
  awaiting_proposals: { label: 'Awaiting proposals', cls: 'text-amber-700 bg-amber-50' },
  shortlisted: { label: 'Shortlisted', cls: 'text-emerald-700 bg-emerald-50' },
  closed_won: { label: 'Closed won', cls: 'text-emerald-700 bg-emerald-50' },
  closed_cancelled: { label: 'Closed cancelled', cls: 'text-red-700 bg-red-50' },
}

export const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; cls: string }> = {
  submitted: { label: 'New', cls: 'text-blue-700 bg-blue-50' },
  shortlisted: { label: 'Shortlisted', cls: 'text-emerald-700 bg-emerald-50' },
  clarification: { label: 'Clarification', cls: 'text-amber-700 bg-amber-50' },
  rejected: { label: 'Rejected', cls: 'text-slate-600 bg-slate-100' },
  accepted: { label: 'Accepted', cls: 'text-emerald-700 bg-emerald-50' },
  withdrawn: { label: 'Withdrawn', cls: 'text-slate-600 bg-slate-100' },
}

export const MILESTONE_META: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Not started', cls: 'text-slate-600 bg-slate-100' },
  in_progress: { label: 'In progress', cls: 'text-blue-700 bg-blue-50' },
  submitted: { label: 'Submitted', cls: 'text-violet-700 bg-violet-50' },
  pending_review: { label: 'Pending review', cls: 'text-amber-700 bg-amber-50' },
  revision_requested: { label: 'Revision requested', cls: 'text-amber-700 bg-amber-50' },
  approved: { label: 'Approved', cls: 'text-emerald-700 bg-emerald-50' },
  released: { label: 'Released', cls: 'text-emerald-700 bg-emerald-50' },
  overdue: { label: 'Overdue', cls: 'text-red-700 bg-red-50' },
  cancelled: { label: 'Cancelled', cls: 'text-slate-600 bg-slate-100' },
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function money(cents: number | null | undefined, currency = 'GBP', opts: { compact?: boolean } = {}): string {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** Per-word prices are stored in whole pence and must not be rounded away. */
export function startingPrice(profile: Pick<MarketplaceProfile, 'starting_price_cents' | 'price_unit' | 'currency'>): string {
  const cents = profile.starting_price_cents
  if (cents === null || cents === undefined) return 'On request'
  if (profile.price_unit === 'word') {
    return `${new Intl.NumberFormat('en-GB', { style: 'currency', currency: profile.currency || 'GBP', minimumFractionDigits: 2 }).format(cents / 100)}/word`
  }
  return money(cents, profile.currency || 'GBP')
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function turnaround(hours: number | null | undefined): string {
  if (!hours) return '—'
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

export function responseTime(minutes: number | null | undefined): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(digits)}%`
}

/** Human deadline copy plus the urgency tone used by the request cards. */
export function deadlineState(deadline: string | null): { label: string; tone: 'neutral' | 'warn' | 'danger' } {
  if (!deadline) return { label: 'No deadline', tone: 'neutral' }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(`${deadline}T00:00:00`)
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'danger' }
  if (days === 0) return { label: 'Due today', tone: 'danger' }
  if (days <= 3) return { label: `in ${days} days`, tone: 'warn' }
  return { label: `in ${days} days`, tone: 'neutral' }
}

/**
 * Proposal match score. Deterministic and explainable: price competitiveness
 * against the other proposals on the same request, plus the supplier's
 * capability, availability and rating signals. Never a random number.
 */
export function matchScore(input: {
  amountCents: number
  cheapestCents: number
  dearestCents: number
  capability: number | null
  availability: number | null
  rating: number | null
}): number {
  const span = Math.max(1, input.dearestCents - input.cheapestCents)
  const price = 100 - ((input.amountCents - input.cheapestCents) / span) * 100
  const capability = input.capability ?? 75
  const availability = input.availability ?? 75
  const rating = ((input.rating ?? 4) / 5) * 100
  return Math.round(price * 0.3 + capability * 0.3 + availability * 0.2 + rating * 0.2)
}

/** Stable brand-tinted cover gradient for profiles without a cover image. */
export function coverGradient(seed: string): string {
  const palette = [
    'linear-gradient(135deg,#2563eb,#1e40af)',
    'linear-gradient(135deg,#7c3aed,#4c1d95)',
    'linear-gradient(135deg,#0891b2,#0e7490)',
    'linear-gradient(135deg,#059669,#065f46)',
    'linear-gradient(135deg,#db2777,#9d174d)',
    'linear-gradient(135deg,#ea580c,#9a3412)',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}
