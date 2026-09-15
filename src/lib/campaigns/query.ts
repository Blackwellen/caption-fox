// Canonical URL query-state for the Campaigns surfaces.
//
// Every filter, search term, sort, page and view mode lives in the URL so a
// refresh, a browser back/forward, a shared link and a saved view all restore
// the same screen. Invalid values fall back safely rather than throwing.

import {
  CAMPAIGN_SORTS, DEFAULT_PAGE_SIZE, PAGE_SIZES,
  LIFECYCLE_STAGES, PRIORITIES, HEALTH_VALUES, APPROVAL_STATUSES,
  CAMPAIGN_CHANNELS, type CampaignSort,
} from './constants'
import { CAMPAIGN_TYPES } from '@/lib/constants'

export type ViewMode = 'cards' | 'table' | 'board' | 'timeline'

export interface CampaignQuery {
  view: ViewMode
  q: string
  type: string
  owner: string
  stage: string
  priority: string
  health: string
  channel: string
  approval: string
  tag: string
  from: string
  to: string
  sort: CampaignSort
  page: number
  size: number
  archived: boolean
}

/** Next.js passes `searchParams` values as string | string[] | undefined. */
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

export function parseCampaignQuery(
  params: RawParams,
  opts: { views?: ViewMode[]; defaultView?: ViewMode } = {},
): CampaignQuery {
  const views = opts.views ?? ['cards', 'table']
  const defaultView = opts.defaultView ?? views[0]

  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const from = one(params, 'from')
  const to = one(params, 'to')

  return {
    view: oneOf(one(params, 'view'), views, defaultView),
    q: one(params, 'q').slice(0, 120),
    type: oneOf(one(params, 'type'), ['', ...CAMPAIGN_TYPES], ''),
    owner: one(params, 'owner').slice(0, 64),
    stage: oneOf(one(params, 'stage'), ['', ...LIFECYCLE_STAGES], ''),
    priority: oneOf(one(params, 'priority'), ['', ...PRIORITIES], ''),
    health: oneOf(one(params, 'health'), ['', ...HEALTH_VALUES], ''),
    channel: oneOf(one(params, 'channel'), ['', ...CAMPAIGN_CHANNELS], ''),
    approval: oneOf(one(params, 'approval'), ['', ...APPROVAL_STATUSES], ''),
    tag: one(params, 'tag').slice(0, 40),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    sort: oneOf(one(params, 'sort'), CAMPAIGN_SORTS.map(s => s.id), 'due_soonest'),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
    archived: one(params, 'archived') === '1',
  }
}

/** Filters that meaningfully narrow results — drives the "Filters (n)" chip. */
export function activeFilterCount(query: CampaignQuery): number {
  const keys: (keyof CampaignQuery)[] = ['type', 'owner', 'stage', 'priority', 'health', 'channel', 'approval', 'tag']
  let count = keys.reduce((total, key) => total + (query[key] ? 1 : 0), 0)
  if (query.from || query.to) count += 1
  if (query.archived) count += 1
  return count
}

export function hasAnyFilter(query: CampaignQuery): boolean {
  return activeFilterCount(query) > 0 || query.q.length > 0
}

/** Builds a href for the same route with a patched query — page resets on change. */
export function buildCampaignHref(
  pathname: string,
  query: CampaignQuery,
  patch: Partial<CampaignQuery>,
): string {
  const next = { ...query, ...patch }
  if (!('page' in patch)) next.page = 1

  const search = new URLSearchParams()
  const defaults: CampaignQuery = {
    ...next,
    q: '', type: '', owner: '', stage: '', priority: '', health: '', channel: '',
    approval: '', tag: '', from: '', to: '', sort: 'due_soonest', page: 1,
    size: DEFAULT_PAGE_SIZE, archived: false,
  }

  for (const [key, value] of Object.entries(next) as [keyof CampaignQuery, string | number | boolean][]) {
    if (key === 'archived') { if (value) search.set('archived', '1'); continue }
    if (value === '' || value === undefined || value === null) continue
    if (value === defaults[key] && key !== 'view') continue
    search.set(key, String(value))
  }

  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
