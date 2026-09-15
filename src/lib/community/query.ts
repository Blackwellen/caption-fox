// Canonical URL query-state for the Community surfaces. Mirrors
// src/lib/creators/query.ts: every filter, search term, sort, page and view
// mode lives in the URL so a refresh, back/forward, a shared link and a saved
// view all restore the same screen.

import {
  ADVOCACY_PROGRAM_STATUSES, ADVOCACY_PROGRAM_TYPES, ADVOCACY_SORTS, ADVOCACY_TIERS,
  COMMUNITY_PRIVACY, COMMUNITY_REGIONS, COMMUNITY_SORTS, COMMUNITY_STATUSES, COMMUNITY_TYPES,
  DEFAULT_PAGE_SIZE, EVENT_SORTS, EVENT_STATUSES, EVENT_TYPES, LIFECYCLE_STAGES,
  MEMBER_ROLES, MEMBER_SORTS, MEMBER_STATUSES, MODERATION_CONTENT_TYPES, MODERATION_REASONS,
  MODERATION_SEVERITIES, MODERATION_SORTS, MODERATION_STATUSES, PAGE_SIZES,
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
}

export function parseOverviewQuery(params: RawParams): OverviewQuery {
  return { ...parseBase(params), view: oneOf(one(params, 'view'), ['cards', 'table'] as const, 'cards') }
}

// ── Communities ──────────────────────────────────────────────────────────────

export interface CommunitiesQuery extends BaseQuery {
  view: 'cards' | 'table'
  type: string
  owner: string
  status: string
  region: string
  privacy: string
  archived: boolean
  sort: typeof COMMUNITY_SORTS[number]['id']
}

export function parseCommunitiesQuery(params: RawParams): CommunitiesQuery {
  return {
    ...parseBase(params, 25),
    view: oneOf(one(params, 'view'), ['cards', 'table'] as const, 'cards'),
    type: oneOf(one(params, 'type'), ['', ...COMMUNITY_TYPES], ''),
    owner: one(params, 'owner').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...COMMUNITY_STATUSES], ''),
    region: oneOf(one(params, 'region'), ['', ...COMMUNITY_REGIONS], ''),
    privacy: oneOf(one(params, 'privacy'), ['', ...COMMUNITY_PRIVACY], ''),
    archived: one(params, 'archived') === '1',
    sort: oneOf(one(params, 'sort'), COMMUNITY_SORTS.map(s => s.id), 'recent'),
  }
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarQuery extends BaseQuery {
  view: 'calendar' | 'table'
  month: string
  community: string
  type: string
  owner: string
  status: string
  sort: typeof EVENT_SORTS[number]['id']
}

export function parseCalendarQuery(params: RawParams): CalendarQuery {
  const month = one(params, 'month')
  return {
    ...parseBase(params, 25),
    view: oneOf(one(params, 'view'), ['calendar', 'table'] as const, 'calendar'),
    month: /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7),
    community: one(params, 'community').slice(0, 64),
    type: oneOf(one(params, 'type'), ['', ...EVENT_TYPES], ''),
    owner: one(params, 'owner').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...EVENT_STATUSES], ''),
    sort: oneOf(one(params, 'sort'), EVENT_SORTS.map(s => s.id), 'date_soonest'),
  }
}

// ── Moderation ───────────────────────────────────────────────────────────────

export interface ModerationQuery extends BaseQuery {
  contentType: string
  severity: string
  community: string
  status: string
  reason: string
  assignee: string
  selected: string
  sort: typeof MODERATION_SORTS[number]['id']
}

export function parseModerationQuery(params: RawParams): ModerationQuery {
  return {
    ...parseBase(params, 25),
    contentType: oneOf(one(params, 'contentType'), ['', ...MODERATION_CONTENT_TYPES], ''),
    severity: oneOf(one(params, 'severity'), ['', ...MODERATION_SEVERITIES], ''),
    community: one(params, 'community').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...MODERATION_STATUSES], ''),
    reason: oneOf(one(params, 'reason'), ['', ...MODERATION_REASONS], ''),
    assignee: one(params, 'assignee').slice(0, 64),
    selected: one(params, 'selected').slice(0, 64),
    sort: oneOf(one(params, 'sort'), MODERATION_SORTS.map(s => s.id), 'newest'),
  }
}

// ── Members ──────────────────────────────────────────────────────────────────

export interface MembersQuery extends BaseQuery {
  role: string
  community: string
  lifecycle: string
  status: string
  segment: '' | 'top' | 'new' | 'at_risk' | 'advocates'
  sort: typeof MEMBER_SORTS[number]['id']
}

export function parseMembersQuery(params: RawParams): MembersQuery {
  return {
    ...parseBase(params, 25),
    role: oneOf(one(params, 'role'), ['', ...MEMBER_ROLES], ''),
    community: one(params, 'community').slice(0, 64),
    lifecycle: oneOf(one(params, 'lifecycle'), ['', ...LIFECYCLE_STAGES], ''),
    status: oneOf(one(params, 'status'), ['', ...MEMBER_STATUSES], ''),
    segment: oneOf(one(params, 'segment'), ['', 'top', 'new', 'at_risk', 'advocates'] as const, ''),
    sort: oneOf(one(params, 'sort'), MEMBER_SORTS.map(s => s.id), 'recent'),
  }
}

// ── Advocacy ─────────────────────────────────────────────────────────────────

export interface AdvocacyQuery extends BaseQuery {
  type: string
  owner: string
  community: string
  status: string
  tier: string
  sort: typeof ADVOCACY_SORTS[number]['id']
}

export function parseAdvocacyQuery(params: RawParams): AdvocacyQuery {
  return {
    ...parseBase(params, 25),
    type: oneOf(one(params, 'type'), ['', ...ADVOCACY_PROGRAM_TYPES], ''),
    owner: one(params, 'owner').slice(0, 64),
    community: one(params, 'community').slice(0, 64),
    status: oneOf(one(params, 'status'), ['', ...ADVOCACY_PROGRAM_STATUSES], ''),
    tier: oneOf(one(params, 'tier'), ['', ...ADVOCACY_TIERS], ''),
    sort: oneOf(one(params, 'sort'), ADVOCACY_SORTS.map(s => s.id), 'points_desc'),
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────────

type AnyQuery = Record<string, string | number | boolean | null | undefined>

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
