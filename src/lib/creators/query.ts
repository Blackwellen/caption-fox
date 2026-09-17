// Canonical URL query-state for the Creators & UGC surfaces.
//
// Every filter, search term, sort, page and view mode lives in the URL so a
// refresh, a browser back/forward, a shared link and a saved view all restore
// the same screen. Invalid values fall back safely rather than throwing, and
// nothing here can widen the workspace scope — that is applied server-side.

import {
  AUDIENCE_BANDS, ASSET_TYPES, BRIEF_SORTS, BRIEF_STATUSES, CREATOR_CHANNELS,
  CREATOR_NICHES, CREATOR_REGIONS, CREATOR_SORTS, DEFAULT_PAGE_SIZE,
  PAGE_SIZES, PAYMENT_METHODS, PAYMENT_SORTS, PAYMENT_STATUSES,
  RELATIONSHIP_STATUSES, RIGHTS_SORTS, RIGHTS_STATUSES, RIGHTS_TERRITORIES,
  RIGHTS_READINESS, SUBMISSION_SORTS, SUBMISSION_STATUSES, USAGE_SCOPES,
  AVAILABILITY_VALUES, ISSUE_CATEGORIES,
} from './constants'

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

function positiveInt(value: string, max: number): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(parsed, max)
}

interface BaseQuery {
  q: string
  page: number
  size: number
  from: string
  to: string
}

function parseBase(params: RawParams, defaultSize = DEFAULT_PAGE_SIZE): BaseQuery {
  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const from = one(params, 'from')
  const to = one(params, 'to')
  return {
    q: one(params, 'q').slice(0, 120),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : defaultSize,
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
  }
}

// ── Overview ─────────────────────────────────────────────────────────────────

export interface OverviewQuery extends BaseQuery {
  view: 'cards' | 'table'
  campaign: string
  channel: string
  status: string
}

export function parseOverviewQuery(params: RawParams): OverviewQuery {
  return {
    ...parseBase(params),
    view: oneOf(one(params, 'view'), ['cards', 'table'] as const, 'cards'),
    campaign: one(params, 'campaign').slice(0, 64),
    channel: oneOf(one(params, 'channel'), ['', ...CREATOR_CHANNELS], ''),
    // Overview filters narrow the submission pipeline, so status is a review status.
    status: oneOf(one(params, 'status'), ['', ...SUBMISSION_STATUSES], ''),
  }
}

// ── Creators ─────────────────────────────────────────────────────────────────

export interface CreatorsQuery extends BaseQuery {
  view: 'table' | 'cards'
  niche: string
  audience: string
  platform: string
  region: string
  availability: string
  status: string
  rights: string
  tag: string
  owner: string
  rateMin: number | null
  rateMax: number | null
  engMin: number | null
  list: string
  shortlist: boolean
  archived: boolean
  sort: typeof CREATOR_SORTS[number]['id']
}

export function parseCreatorsQuery(params: RawParams): CreatorsQuery {
  return {
    ...parseBase(params),
    view: oneOf(one(params, 'view'), ['table', 'cards'] as const, 'table'),
    niche: oneOf(one(params, 'niche'), ['', ...CREATOR_NICHES], ''),
    audience: oneOf(one(params, 'audience'), ['', ...AUDIENCE_BANDS.map(b => b.id)], ''),
    platform: oneOf(one(params, 'platform'), ['', ...CREATOR_CHANNELS], ''),
    region: oneOf(one(params, 'region'), ['', ...CREATOR_REGIONS], ''),
    availability: oneOf(one(params, 'availability'), ['', ...AVAILABILITY_VALUES], ''),
    status: oneOf(one(params, 'status'), ['', ...RELATIONSHIP_STATUSES], ''),
    rights: oneOf(one(params, 'rights'), ['', ...RIGHTS_READINESS], ''),
    tag: one(params, 'tag').slice(0, 40),
    owner: one(params, 'owner').slice(0, 64),
    rateMin: positiveInt(one(params, 'rateMin'), 1_000_000),
    rateMax: positiveInt(one(params, 'rateMax'), 1_000_000),
    engMin: positiveInt(one(params, 'engMin'), 100),
    list: one(params, 'list').slice(0, 64),
    shortlist: one(params, 'shortlist') === '1',
    archived: one(params, 'archived') === '1',
    sort: oneOf(one(params, 'sort'), CREATOR_SORTS.map(s => s.id), 'recent'),
  }
}

// ── Briefs ───────────────────────────────────────────────────────────────────

export interface BriefsQuery extends BaseQuery {
  view: 'cards' | 'table' | 'timeline'
  campaign: string
  channel: string
  owner: string
  status: string
  approval: string
  creator: string
  rights: string
  due: '' | 'overdue' | '7' | '30' | '90'
  budgetMin: number | null
  budgetMax: number | null
  archived: boolean
  sort: typeof BRIEF_SORTS[number]['id']
}

export function parseBriefsQuery(params: RawParams): BriefsQuery {
  return {
    ...parseBase(params),
    view: oneOf(one(params, 'view'), ['cards', 'table', 'timeline'] as const, 'cards'),
    campaign: one(params, 'campaign').slice(0, 64),
    channel: oneOf(one(params, 'channel'), ['', ...CREATOR_CHANNELS], ''),
    owner: one(params, 'owner').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...BRIEF_STATUSES], ''),
    approval: one(params, 'approval').slice(0, 32),
    creator: one(params, 'creator').slice(0, 64),
    rights: one(params, 'rights').slice(0, 32),
    due: oneOf(one(params, 'due'), ['', 'overdue', '7', '30', '90'] as const, ''),
    budgetMin: positiveInt(one(params, 'budgetMin'), 100_000_000),
    budgetMax: positiveInt(one(params, 'budgetMax'), 100_000_000),
    archived: one(params, 'archived') === '1',
    sort: oneOf(one(params, 'sort'), BRIEF_SORTS.map(s => s.id), 'due_soonest'),
  }
}

// ── Submissions ──────────────────────────────────────────────────────────────

export interface SubmissionsQuery extends BaseQuery {
  view: 'gallery' | 'table' | 'board'
  creator: string
  brief: string
  assetType: string
  status: string
  reviewer: string
  rights: string
  issue: string
  campaign: string
  channel: string
  archived: boolean
  sort: typeof SUBMISSION_SORTS[number]['id']
}

export function parseSubmissionsQuery(params: RawParams): SubmissionsQuery {
  return {
    ...parseBase(params, 25),
    view: oneOf(one(params, 'view'), ['gallery', 'table', 'board'] as const, 'gallery'),
    creator: one(params, 'creator').slice(0, 64),
    brief: one(params, 'brief').slice(0, 64),
    assetType: oneOf(one(params, 'assetType'), ['', ...ASSET_TYPES], ''),
    status: oneOf(one(params, 'status'), ['', ...SUBMISSION_STATUSES], ''),
    reviewer: one(params, 'reviewer').slice(0, 64),
    rights: one(params, 'rights').slice(0, 32),
    issue: oneOf(one(params, 'issue'), ['', ...ISSUE_CATEGORIES], ''),
    campaign: one(params, 'campaign').slice(0, 64),
    channel: oneOf(one(params, 'channel'), ['', ...CREATOR_CHANNELS], ''),
    archived: one(params, 'archived') === '1',
    sort: oneOf(one(params, 'sort'), SUBMISSION_SORTS.map(s => s.id), 'newest'),
  }
}

// ── Rights ───────────────────────────────────────────────────────────────────

export interface RightsQuery extends BaseQuery {
  view: 'table' | 'cards' | 'calendar'
  territory: string
  channel: string
  campaign: string
  creator: string
  status: string
  scope: string
  owner: string
  expiry: '' | '30' | '60' | '90' | 'expired'
  archived: boolean
  sort: typeof RIGHTS_SORTS[number]['id']
}

export function parseRightsQuery(params: RawParams): RightsQuery {
  return {
    ...parseBase(params),
    view: oneOf(one(params, 'view'), ['table', 'cards', 'calendar'] as const, 'table'),
    territory: oneOf(one(params, 'territory'), ['', ...RIGHTS_TERRITORIES], ''),
    channel: oneOf(one(params, 'channel'), ['', ...CREATOR_CHANNELS], ''),
    campaign: one(params, 'campaign').slice(0, 64),
    creator: one(params, 'creator').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...RIGHTS_STATUSES], ''),
    scope: oneOf(one(params, 'scope'), ['', ...USAGE_SCOPES], ''),
    owner: one(params, 'owner').slice(0, 64),
    expiry: oneOf(one(params, 'expiry'), ['', '30', '60', '90', 'expired'] as const, ''),
    archived: one(params, 'archived') === '1',
    sort: oneOf(one(params, 'sort'), RIGHTS_SORTS.map(s => s.id), 'expiry_soonest'),
  }
}

// ── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentsQuery extends BaseQuery {
  view: 'table' | 'cards' | 'timeline'
  creator: string
  campaign: string
  brief: string
  status: string
  method: string
  approver: string
  currency: string
  invoice: string
  tax: string
  batch: string
  sort: typeof PAYMENT_SORTS[number]['id']
}

export function parsePaymentsQuery(params: RawParams): PaymentsQuery {
  return {
    ...parseBase(params),
    view: oneOf(one(params, 'view'), ['table', 'cards', 'timeline'] as const, 'table'),
    creator: one(params, 'creator').slice(0, 64),
    campaign: one(params, 'campaign').slice(0, 64),
    brief: one(params, 'brief').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...PAYMENT_STATUSES], ''),
    method: oneOf(one(params, 'method'), ['', ...PAYMENT_METHODS], ''),
    approver: one(params, 'approver').slice(0, 64),
    currency: one(params, 'currency').slice(0, 3).toUpperCase(),
    invoice: one(params, 'invoice').slice(0, 24),
    tax: one(params, 'tax').slice(0, 24),
    batch: one(params, 'batch').slice(0, 64),
    sort: oneOf(one(params, 'sort'), PAYMENT_SORTS.map(s => s.id), 'submitted_newest'),
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────────

type AnyQuery = Record<string, string | number | boolean | null | undefined>

/** Filter keys that meaningfully narrow results — drives the "Filters (n)" chip. */
const IGNORED_FILTER_KEYS = new Set(['q', 'view', 'sort', 'page', 'size'])

export function activeFilterCount(query: object): number {
  let count = 0
  let dateCounted = false
  for (const [key, value] of Object.entries(query as AnyQuery)) {
    if (IGNORED_FILTER_KEYS.has(key)) continue
    if (value === '' || value === null || value === undefined || value === false) continue
    if (key === 'from' || key === 'to') {
      if (!dateCounted) { count += 1; dateCounted = true }
      continue
    }
    count += 1
  }
  return count
}

export function hasAnyFilter(query: object): boolean {
  return activeFilterCount(query) > 0 || String((query as AnyQuery).q ?? '').length > 0
}

/**
 * Builds an href for the same route with a patched query. Page resets whenever
 * anything other than the page itself changes, so a filter can never leave the
 * user stranded on an out-of-range page.
 */
export function buildHref<T extends object>(pathname: string, query: T, patch: Partial<T>): string {
  const next: AnyQuery = { ...query, ...patch } as AnyQuery
  if (!('page' in patch)) next.page = 1

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (value === '' || value === null || value === undefined || value === false) continue
    if (key === 'page' && value === 1) continue
    if (key === 'size' && value === DEFAULT_PAGE_SIZE) continue
    search.set(key, value === true ? '1' : String(value))
  }

  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** Escapes a user search term for a PostgREST `ilike` / `or` filter. */
export function likeTerm(term: string): string {
  return term.replace(/[%_,()]/g, ch => `\\${ch}`)
}
