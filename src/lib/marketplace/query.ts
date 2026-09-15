// Canonical URL query-state for every Marketplace surface.
//
// Search terms, filters, sort, view mode, page and page size all live in the
// URL so refresh, browser back/forward, a shared link and a saved search all
// restore the same screen. Invalid values fall back safely rather than throwing.

import {
  SORTS, PAGE_SIZES, DEFAULT_PAGE_SIZE, PLATFORMS, REGIONS, LANGUAGES,
  BUDGET_BANDS, RATING_BANDS, TURNAROUND_BANDS, AUDIENCE_BANDS, ENGAGEMENT_BANDS,
  type MarketplaceSort,
} from './module'

export type ViewMode = 'cards' | 'list' | 'table' | 'grid'

export interface MarketplaceQuery {
  view: ViewMode
  q: string
  category: string
  location: string
  region: string
  country: string
  platform: string
  language: string
  budget: string
  rating: string
  turnaround: string
  audience: string
  engagement: string
  tag: string
  type: string
  status: string
  escrow: string
  delivery: string
  supplier: string
  from: string
  to: string
  available: boolean
  verified: boolean
  sort: MarketplaceSort
  page: number
  size: number
  compare: string[]
}

export type RawParams = Record<string, string | string[] | undefined>

function one(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

const ORDER_STATUSES = ['', 'pending', 'escrow_held', 'in_progress', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled']
const ESCROW_STATUSES = ['', 'pending_funding', 'funded', 'in_escrow', 'partially_released', 'released', 'on_hold', 'refund_pending', 'refunded', 'cancelled', 'failed']
const DELIVERY_STATUSES = ['', 'not_started', 'in_progress', 'pending_delivery', 'pending_review', 'delivered', 'overdue', 'cancelled']
const REQUEST_STATUSES = ['', 'draft', 'open', 'awaiting_proposals', 'shortlisted', 'closed_won', 'closed_cancelled']
const PROFILE_TYPES = ['', 'agency', 'freelancer', 'ads_manager', 'ugc_creator', 'influencer', 'discovery', 'rfq']

export function parseMarketplaceQuery(
  params: RawParams,
  opts: { views?: ViewMode[]; defaultView?: ViewMode; defaultSort?: MarketplaceSort } = {},
): MarketplaceQuery {
  const views = opts.views ?? ['cards', 'list']
  const defaultView = opts.defaultView ?? views[0]
  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const from = one(params, 'from')
  const to = one(params, 'to')
  const compareRaw = one(params, 'compare')

  const statusPool = [...ORDER_STATUSES, ...REQUEST_STATUSES]

  return {
    view: oneOf(one(params, 'view'), views, defaultView),
    q: one(params, 'q').slice(0, 120),
    category: one(params, 'category').slice(0, 60),
    location: one(params, 'location').slice(0, 60),
    region: oneOf(one(params, 'region'), ['', ...REGIONS], ''),
    country: one(params, 'country').slice(0, 4).toUpperCase(),
    platform: oneOf(one(params, 'platform'), ['', ...PLATFORMS], ''),
    language: oneOf(one(params, 'language'), ['', ...LANGUAGES], ''),
    budget: oneOf(one(params, 'budget'), BUDGET_BANDS.map(b => b.id), ''),
    rating: oneOf(one(params, 'rating'), RATING_BANDS.map(b => b.id), ''),
    turnaround: oneOf(one(params, 'turnaround'), TURNAROUND_BANDS.map(b => b.id), ''),
    audience: oneOf(one(params, 'audience'), AUDIENCE_BANDS.map(b => b.id), ''),
    engagement: oneOf(one(params, 'engagement'), ENGAGEMENT_BANDS.map(b => b.id), ''),
    tag: one(params, 'tag').slice(0, 40),
    type: oneOf(one(params, 'type'), PROFILE_TYPES, ''),
    status: oneOf(one(params, 'status'), statusPool, ''),
    escrow: oneOf(one(params, 'escrow'), ESCROW_STATUSES, ''),
    delivery: oneOf(one(params, 'delivery'), DELIVERY_STATUSES, ''),
    supplier: one(params, 'supplier').slice(0, 64),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    available: one(params, 'available') === '1',
    verified: one(params, 'verified') === '1',
    sort: oneOf(one(params, 'sort'), SORTS.map(s => s.id), opts.defaultSort ?? 'relevance'),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
    compare: compareRaw ? compareRaw.split(',').filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 4) : [],
  }
}

const FILTER_KEYS: (keyof MarketplaceQuery)[] = [
  'category', 'location', 'region', 'country', 'platform', 'language', 'budget',
  'rating', 'turnaround', 'audience', 'engagement', 'tag', 'type', 'status',
  'escrow', 'delivery', 'supplier',
]

/** Filters that meaningfully narrow results — drives the "Filters (n)" chip. */
export function activeFilterCount(query: MarketplaceQuery): number {
  let count = FILTER_KEYS.reduce((total, key) => total + (query[key] ? 1 : 0), 0)
  if (query.from || query.to) count += 1
  if (query.available) count += 1
  if (query.verified) count += 1
  return count
}

export function hasAnyFilter(query: MarketplaceQuery): boolean {
  return activeFilterCount(query) > 0 || query.q.length > 0
}

const DEFAULTS: Record<string, string | number | boolean> = {
  q: '', category: '', location: '', region: '', country: '', platform: '', language: '',
  budget: '', rating: '', turnaround: '', audience: '', engagement: '', tag: '', type: '',
  status: '', escrow: '', delivery: '', supplier: '', from: '', to: '',
  available: false, verified: false, sort: 'relevance', page: 1, size: DEFAULT_PAGE_SIZE,
}

/** Builds an href for the same route with a patched query — page resets on change. */
export function buildMarketplaceHref(
  pathname: string,
  query: MarketplaceQuery,
  patch: Partial<MarketplaceQuery>,
): string {
  const next = { ...query, ...patch }
  if (!('page' in patch)) next.page = 1

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (key === 'compare') {
      if (Array.isArray(value) && value.length) search.set('compare', value.join(','))
      continue
    }
    if (key === 'available' || key === 'verified') {
      if (value) search.set(key, '1')
      continue
    }
    if (value === '' || value === undefined || value === null) continue
    if (key !== 'view' && value === DEFAULTS[key]) continue
    search.set(key, String(value))
  }

  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** Serialises the filter state for a saved search record. */
export function queryToParams(query: MarketplaceQuery): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (key === 'compare' || key === 'page' || key === 'size' || key === 'view') continue
    if (value === '' || value === false || value === DEFAULTS[key]) continue
    out[key] = String(value)
  }
  return out
}
