// Pure URL-state parsing for the Events module.
//
// Kept free of server-only imports so the parsing rules (bounds, whitelists,
// fallbacks) can be unit-tested directly — this is the boundary that decides
// what a query string is allowed to ask the database for.

import type { EventsFilters, EventViewMode } from './types'

/** Parses query params into typed, bounded filters. Invalid input is ignored. */
export function parseEventsFilters(
  searchParams: Record<string, string | string[] | undefined>,
  allowedViews: EventViewMode[],
  defaultView: EventViewMode,
): EventsFilters & { view: EventViewMode; range: number } {
  const one = (key: string): string | undefined => {
    const value = searchParams[key]
    const raw = Array.isArray(value) ? value[0] : value
    return raw?.trim() ? raw.trim().slice(0, 120) : undefined
  }
  const requestedView = one('view') as EventViewMode | undefined
  const range = Number(one('range'))

  return {
    q: one('q'),
    type: one('type'),
    status: one('status'),
    owner: one('owner'),
    event: one('event'),
    sequence: one('sequence'),
    sponsor: one('sponsor'),
    tier: one('tier'),
    topic: one('topic'),
    speaker: one('speaker'),
    platform: one('platform'),
    recording: one('recording'),
    distribution: one('distribution'),
    dateFrom: one('dateFrom'),
    dateTo: one('dateTo'),
    sort: one('sort'),
    page: Math.max(1, Number(one('page')) || 1),
    pageSize: [10, 25, 50].includes(Number(one('pageSize'))) ? Number(one('pageSize')) : 10,
    view: requestedView && allowedViews.includes(requestedView) ? requestedView : defaultView,
    range: [7, 30, 90].includes(range) ? range : 30,
  }
}
