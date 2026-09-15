// URL query-state for the Automations surfaces. Mirrors
// src/lib/community/query.ts.

import {
  AUTOMATION_SORTS, AUTOMATION_STATUSES, DEFAULT_PAGE_SIZE, PAGE_SIZES,
  RUN_STATUSES, TEMPLATE_CATEGORIES, TRIGGER_SOURCES,
} from './constants'

export type RawParams = Record<string, string | string[] | undefined>

function one(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

interface BaseQuery { q: string; page: number; size: number }

function parseBase(params: RawParams, defaultSize = DEFAULT_PAGE_SIZE): BaseQuery {
  const rawPage = Number.parseInt(one(params, 'page'), 10)
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  return {
    q: one(params, 'q').slice(0, 120),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : defaultSize,
  }
}

export interface AutomationsQuery extends BaseQuery {
  status: string
  category: string
  sort: typeof AUTOMATION_SORTS[number]['id']
}

export function parseAutomationsQuery(params: RawParams): AutomationsQuery {
  return {
    ...parseBase(params, 25),
    status: oneOf(one(params, 'status'), ['', ...AUTOMATION_STATUSES], ''),
    category: oneOf(one(params, 'category'), ['', ...TEMPLATE_CATEGORIES], ''),
    sort: oneOf(one(params, 'sort'), AUTOMATION_SORTS.map(s => s.id), 'recent'),
  }
}

export interface RunLogsQuery extends BaseQuery {
  status: string
  source: string
  automation: string
}

export function parseRunLogsQuery(params: RawParams): RunLogsQuery {
  return {
    ...parseBase(params, 25),
    status: oneOf(one(params, 'status'), ['', ...RUN_STATUSES], ''),
    source: oneOf(one(params, 'source'), ['', ...TRIGGER_SOURCES], ''),
    automation: one(params, 'automation').slice(0, 64),
  }
}

export function hasAnyFilter(query: object): boolean {
  const record = query as Record<string, unknown>
  return Object.entries(record).some(([key, value]) => {
    if (['page', 'size', 'sort'].includes(key)) return false
    return value !== '' && value !== null && value !== undefined
  })
}

export function buildHref<T extends object>(pathname: string, query: T, patch: Partial<T>): string {
  const next: Record<string, unknown> = { ...query, ...patch }
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

export function likeTerm(term: string): string {
  return term.replace(/[%_,()]/g, ch => `\\${ch}`)
}
