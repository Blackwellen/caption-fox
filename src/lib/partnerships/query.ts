// Canonical URL query-state for the Partnerships surfaces. Every filter,
// search term, sort, page and view mode lives in the URL so a refresh,
// browser back/forward and a shared link all restore the same screen.

import { PARTNER_SORTS, DEFAULT_PAGE_SIZE, PAGE_SIZES, PARTNER_STATUSES, type PartnerSort } from './constants'

export type ViewMode = 'cards' | 'table'

export interface PartnershipQuery {
  view: ViewMode
  q: string
  owner: string
  status: string
  tier: string
  platform: string
  region: string
  from: string
  to: string
  sort: PartnerSort
  page: number
  size: number
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

export function parsePartnershipQuery(params: RawParams): PartnershipQuery {
  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const from = one(params, 'from')
  const to = one(params, 'to')

  return {
    view: oneOf(one(params, 'view'), ['cards', 'table'], 'cards'),
    q: one(params, 'q').slice(0, 120),
    owner: one(params, 'owner').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...PARTNER_STATUSES], ''),
    tier: one(params, 'tier').slice(0, 40),
    platform: one(params, 'platform').slice(0, 40),
    region: one(params, 'region').slice(0, 64),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    sort: oneOf(one(params, 'sort'), PARTNER_SORTS.map(s => s.id), 'updated'),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
  }
}

export function activeFilterCount(query: PartnershipQuery): number {
  const keys: (keyof PartnershipQuery)[] = ['owner', 'status', 'tier', 'platform', 'region']
  let count = keys.reduce((total, key) => total + (query[key] ? 1 : 0), 0)
  if (query.from || query.to) count += 1
  return count
}

export function buildPartnershipHref(
  pathname: string,
  query: PartnershipQuery,
  patch: Partial<PartnershipQuery>,
): string {
  const next = { ...query, ...patch }
  if (!('page' in patch)) next.page = 1

  const search = new URLSearchParams()
  const defaults: PartnershipQuery = {
    ...next, q: '', owner: '', status: '', tier: '', platform: '', region: '',
    from: '', to: '', sort: 'updated', page: 1, size: DEFAULT_PAGE_SIZE,
  }

  for (const [key, value] of Object.entries(next) as [keyof PartnershipQuery, string | number][]) {
    if (value === '' || value === undefined || value === null) continue
    if (value === defaults[key] && key !== 'view') continue
    search.set(key, String(value))
  }

  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
