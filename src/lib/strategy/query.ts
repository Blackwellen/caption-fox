// Canonical URL query-state for the Strategy surfaces.
//
// Every filter, search term, sort, page and view mode lives in the URL so a
// refresh, a browser back/forward, a shared link and a saved view all restore
// the same screen. Invalid values fall back safely rather than throwing, so a
// hand-edited query string can never crash a route.

import {
  STRATEGY_SORTS, DEFAULT_PAGE_SIZE, PAGE_SIZES,
  OBJECTIVE_STATUSES, OBJECTIVE_TYPES, STRATEGY_PRIORITIES,
  AUDIENCE_STATUSES, LIFECYCLE_STAGES, AUDIENCE_CHANNELS,
  RESEARCH_SOURCE_TYPES, RESEARCH_STATUSES, IMPACT_LEVELS, CONFIDENCE_LEVELS,
  FRAMEWORK_STATUSES, PLAN_STATUSES, FORECAST_STATUSES, GANTT_SCALES,
  type StrategySort,
} from './constants'

/** Every view mode used anywhere in Strategy. Each page declares its own subset. */
export type ViewMode =
  | 'dashboard' | 'cards' | 'table' | 'timeline' | 'kanban'
  | 'map' | 'compare' | 'library' | 'board'
  | 'framework' | 'matrix' | 'gantt' | 'calendar' | 'charts' | 'scenarios'

export interface StrategyQuery {
  view: ViewMode
  q: string
  status: string
  type: string
  owner: string
  strategy: string
  priority: string
  persona: string
  region: string
  lifecycle: string
  channel: string
  source: string
  impact: string
  confidence: string
  collection: string
  tag: string
  framework: string
  audience: string
  market: string
  completeness: string
  from: string
  to: string
  sort: StrategySort
  page: number
  size: number
  archived: boolean
  favourites: boolean
  /** Gantt time scale. */
  scale: string
  /** Audience ids selected for the Compare view. */
  compare: string[]
  /** Currently-open forecast on the Forecasts surface. */
  forecast: string
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

/** Ids arrive as `a,b,c`. Anything that is not a uuid-ish token is dropped. */
function idList(value: string, max = 4): string[] {
  return value.split(',').map(part => part.trim())
    .filter(part => /^[0-9a-fA-F-]{8,36}$/.test(part))
    .slice(0, max)
}

const ALL_STATUSES = [
  ...OBJECTIVE_STATUSES, ...AUDIENCE_STATUSES, ...RESEARCH_STATUSES,
  ...FRAMEWORK_STATUSES, ...PLAN_STATUSES, ...FORECAST_STATUSES,
] as const

export function parseStrategyQuery(
  params: RawParams,
  opts: { views?: ViewMode[]; defaultView?: ViewMode; defaultSort?: StrategySort } = {},
): StrategyQuery {
  const views = opts.views ?? ['cards', 'table']
  const defaultView = opts.defaultView ?? views[0]
  const defaultSort = opts.defaultSort ?? 'due_soonest'

  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const from = one(params, 'from')
  const to = one(params, 'to')

  return {
    view: oneOf(one(params, 'view'), views, defaultView),
    q: one(params, 'q').slice(0, 120),
    status: oneOf(one(params, 'status'), ['', ...ALL_STATUSES], ''),
    type: oneOf(one(params, 'type'), ['', ...OBJECTIVE_TYPES], ''),
    owner: one(params, 'owner').slice(0, 64),
    strategy: one(params, 'strategy').slice(0, 64),
    priority: oneOf(one(params, 'priority'), ['', ...STRATEGY_PRIORITIES], ''),
    persona: one(params, 'persona').slice(0, 64),
    region: one(params, 'region').slice(0, 8).toUpperCase(),
    lifecycle: oneOf(one(params, 'lifecycle'), ['', ...LIFECYCLE_STAGES], ''),
    channel: oneOf(one(params, 'channel'), ['', ...AUDIENCE_CHANNELS], ''),
    source: oneOf(one(params, 'source'), ['', ...RESEARCH_SOURCE_TYPES], ''),
    impact: oneOf(one(params, 'impact'), ['', ...IMPACT_LEVELS], ''),
    confidence: oneOf(one(params, 'confidence'), ['', ...CONFIDENCE_LEVELS], ''),
    collection: one(params, 'collection').slice(0, 64),
    tag: one(params, 'tag').slice(0, 40),
    framework: one(params, 'framework').slice(0, 64),
    audience: one(params, 'audience').slice(0, 64),
    market: one(params, 'market').slice(0, 40),
    completeness: oneOf(one(params, 'completeness'), ['', 'complete', 'partial', 'missing'], ''),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    sort: oneOf(one(params, 'sort'), STRATEGY_SORTS.map(s => s.id), defaultSort),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE,
    archived: one(params, 'archived') === '1',
    favourites: one(params, 'favourites') === '1',
    scale: oneOf(one(params, 'scale'), GANTT_SCALES.map(s => s.id), 'weeks'),
    compare: idList(one(params, 'compare')),
    forecast: one(params, 'forecast').slice(0, 64),
  }
}

/** Filter keys that meaningfully narrow results — drives the "Filters (n)" chip. */
const FILTER_KEYS: (keyof StrategyQuery)[] = [
  'status', 'type', 'owner', 'strategy', 'priority', 'persona', 'region', 'lifecycle',
  'channel', 'source', 'impact', 'confidence', 'collection', 'tag', 'framework',
  'audience', 'market', 'completeness',
]

export function activeFilterCount(query: StrategyQuery): number {
  let count = FILTER_KEYS.reduce((total, key) => total + (query[key] ? 1 : 0), 0)
  if (query.from || query.to) count += 1
  if (query.archived) count += 1
  if (query.favourites) count += 1
  return count
}

export function hasAnyFilter(query: StrategyQuery): boolean {
  return activeFilterCount(query) > 0 || query.q.length > 0
}

/** The default value of every non-view key, used to keep hrefs short. */
function defaultsFor(sort: StrategySort): Record<string, unknown> {
  return {
    q: '', status: '', type: '', owner: '', strategy: '', priority: '', persona: '',
    region: '', lifecycle: '', channel: '', source: '', impact: '', confidence: '',
    collection: '', tag: '', framework: '', audience: '', market: '', completeness: '',
    from: '', to: '', sort, page: 1, size: DEFAULT_PAGE_SIZE,
    archived: false, favourites: false, scale: 'weeks', forecast: '',
  }
}

/**
 * Builds an href for the same route with a patched query. The page resets to 1
 * on any change other than an explicit page change, so a filter never lands the
 * user on an empty page N.
 */
export function buildStrategyHref(
  pathname: string,
  query: StrategyQuery,
  patch: Partial<StrategyQuery>,
  defaultSort: StrategySort = 'due_soonest',
): string {
  const next = { ...query, ...patch }
  if (!('page' in patch)) next.page = 1

  const search = new URLSearchParams()
  const defaults = defaultsFor(defaultSort)

  for (const [key, value] of Object.entries(next)) {
    if (key === 'archived' || key === 'favourites') { if (value) search.set(key, '1'); continue }
    if (key === 'compare') {
      const list = value as string[]
      if (list.length) search.set('compare', list.join(','))
      continue
    }
    if (value === '' || value === undefined || value === null) continue
    if (key !== 'view' && value === defaults[key]) continue
    search.set(key, String(value))
  }

  const qs = search.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** Toggles one id in the Compare selection, capped so the view stays readable. */
export function toggleCompare(current: string[], id: string, max = 4): string[] {
  if (current.includes(id)) return current.filter(item => item !== id)
  return current.length >= max ? current : [...current, id]
}
