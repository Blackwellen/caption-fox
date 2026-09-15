// Canonical URL query-state for the Studio surfaces.
//
// Every filter, search term, sort, page and view mode lives in the URL so a
// refresh, a browser back/forward, a shared link and a deep link all restore the
// same screen. Invalid values fall back safely rather than throwing.

import {
  STUDIO_SORTS, PAGE_SIZES, DEFAULT_PAGE_SIZE,
  CONTENT_STATUSES, IDEA_STAGES, TEMPLATE_STATUSES, MEDIA_STATUSES, MEDIA_TYPES,
  STUDIO_CHANNELS, KEYWORD_KINDS, IDEA_SOURCES, TEMPLATE_CATEGORIES,
  type StudioSort,
} from './constants'

export type ViewMode = 'cards' | 'table' | 'list' | 'board' | 'grid'

export interface StudioQuery {
  view: ViewMode
  q: string
  status: string
  stage: string
  channel: string
  type: string
  category: string
  source: string
  owner: string
  collection: string
  tag: string
  topic: string
  language: string
  kind: string
  campaign: string
  from: string
  to: string
  sort: StudioSort
  page: number
  size: number
  archived: boolean
  /** Currently selected record, so the detail rail survives a refresh. */
  selected: string
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

/** Only accepts a well-formed UUID, so `selected` can never become an injection vector. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function uuidOrEmpty(value: string): string {
  return UUID.test(value) ? value : ''
}

export function parseStudioQuery(
  params: RawParams,
  opts: {
    views?: ViewMode[]
    defaultView?: ViewMode
    defaultSort?: StudioSort
    defaultSize?: number
  } = {},
): StudioQuery {
  const views = opts.views ?? ['cards', 'table']
  const defaultView = opts.defaultView ?? views[0]
  const defaultSort = opts.defaultSort ?? 'updated_desc'
  const defaultSize = opts.defaultSize ?? DEFAULT_PAGE_SIZE

  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const from = one(params, 'from')
  const to = one(params, 'to')

  return {
    view: oneOf(one(params, 'view'), views, defaultView),
    q: one(params, 'q').slice(0, 120),
    status: oneOf(one(params, 'status'), ['', ...CONTENT_STATUSES, ...TEMPLATE_STATUSES, ...MEDIA_STATUSES], ''),
    stage: oneOf(one(params, 'stage'), ['', ...IDEA_STAGES], ''),
    channel: oneOf(one(params, 'channel'), ['', ...STUDIO_CHANNELS], ''),
    type: oneOf(one(params, 'type'), ['', ...MEDIA_TYPES], ''),
    category: oneOf(one(params, 'category'), ['', ...TEMPLATE_CATEGORIES], ''),
    source: oneOf(one(params, 'source'), ['', ...IDEA_SOURCES], ''),
    kind: oneOf(one(params, 'kind'), ['', ...KEYWORD_KINDS], ''),
    owner: uuidOrEmpty(one(params, 'owner')),
    collection: uuidOrEmpty(one(params, 'collection')),
    campaign: uuidOrEmpty(one(params, 'campaign')),
    tag: one(params, 'tag').slice(0, 40),
    topic: one(params, 'topic').slice(0, 60),
    language: one(params, 'language').slice(0, 10),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    sort: oneOf(one(params, 'sort'), STUDIO_SORTS.map(s => s.id), defaultSort),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : defaultSize,
    archived: one(params, 'archived') === '1',
    selected: uuidOrEmpty(one(params, 'selected')),
  }
}

const FILTER_KEYS: (keyof StudioQuery)[] = [
  'status', 'stage', 'channel', 'type', 'category', 'source', 'kind',
  'owner', 'collection', 'campaign', 'tag', 'topic', 'language',
]

/** Filters that meaningfully narrow results — drives the "Filters (n)" chip. */
export function activeFilterCount(query: StudioQuery): number {
  let count = FILTER_KEYS.reduce((total, key) => total + (query[key] ? 1 : 0), 0)
  if (query.from || query.to) count += 1
  if (query.archived) count += 1
  return count
}

export function hasAnyFilter(query: StudioQuery): boolean {
  return activeFilterCount(query) > 0 || query.q.length > 0
}

/**
 * Builds a href for the same route with a patched query. Page always resets on
 * a filter change so a user is never left staring at page 7 of 2 results.
 * `selected` is preserved unless it is explicitly patched.
 */
export function buildStudioHref(
  pathname: string,
  query: StudioQuery,
  patch: Partial<StudioQuery>,
  defaults: { view?: ViewMode; sort?: StudioSort; size?: number } = {},
): string {
  const next = { ...query, ...patch }
  if (!('page' in patch)) next.page = 1

  const defaultView = defaults.view ?? 'cards'
  const defaultSort = defaults.sort ?? 'updated_desc'
  const defaultSize = defaults.size ?? DEFAULT_PAGE_SIZE

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(next) as [keyof StudioQuery, string | number | boolean][]) {
    if (key === 'archived') { if (value) search.set('archived', '1'); continue }
    if (value === '' || value === undefined || value === null) continue
    if (key === 'view' && value === defaultView) continue
    if (key === 'sort' && value === defaultSort) continue
    if (key === 'size' && value === defaultSize) continue
    if (key === 'page' && value === 1) continue
    search.set(key, String(value))
  }

  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/**
 * Escapes a user search term before it reaches a PostgREST `or(...)` filter.
 * `%`, `,`, `(` and `)` are structural in that grammar, so they are stripped
 * rather than passed through.
 */
export function sanitiseSearch(term: string): string {
  return term.replace(/[%,()*]/g, ' ').trim()
}
