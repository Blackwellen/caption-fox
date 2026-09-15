// Canonical URL query-state for the Web & Conversion surfaces.
//
// Every filter, search term and view mode lives in the URL so a refresh, a
// browser back/forward, and a shared link all restore the same screen.
// Invalid values fall back safely rather than throwing.
// Mirrors src/lib/messaging/query.ts.

import {
  PAGE_STATUSES, FORM_STATUSES, FUNNEL_STATUSES, EXPERIMENT_STATUSES, TRACKING_HEALTH_STATUSES,
} from './constants'

export interface WebQuery {
  q: string
  status: string
  owner: string
  type: string
  channel: string
  from: string
  to: string
  archived: boolean
  view: string
  page: number
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

/** Any status across pages/forms/funnels/experiments/tracking — validated per-entity where used. */
const ALL_STATUSES = [
  '', ...PAGE_STATUSES, ...FORM_STATUSES, ...FUNNEL_STATUSES, ...EXPERIMENT_STATUSES, ...TRACKING_HEALTH_STATUSES,
]

export function parseWebQuery(params: RawParams): WebQuery {
  const from = one(params, 'from')
  const to = one(params, 'to')
  const page = Number.parseInt(one(params, 'page'), 10)

  return {
    q: one(params, 'q').slice(0, 120),
    status: oneOf(one(params, 'status'), ALL_STATUSES, ''),
    owner: one(params, 'owner').slice(0, 64),
    type: one(params, 'type').slice(0, 40),
    channel: one(params, 'channel').slice(0, 40),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    archived: one(params, 'archived') === '1',
    view: oneOf(one(params, 'view'), ['cards', 'table'], 'cards'),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}
