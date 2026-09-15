// Shared URL-state helpers. Every filter, search term, sort, view and page
// lives in the query string so refresh, back/forward and shared links all
// restore the same state.

export type SearchParams = Record<string, string | string[] | undefined>

export function readParam(params: SearchParams | undefined, key: string): string | undefined {
  const value = params?.[key]
  const raw = Array.isArray(value) ? value[0] : value
  return raw && raw.length > 0 ? raw : undefined
}

export function readNumber(params: SearchParams | undefined, key: string): number | undefined {
  const raw = readParam(params, key)
  if (raw == null) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export function readEnum<T extends string>(
  params: SearchParams | undefined,
  key: string,
  allowed: readonly T[],
  fallback?: T,
): T | undefined {
  const raw = readParam(params, key)
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

export function readBool(params: SearchParams | undefined, key: string): boolean {
  return readParam(params, key) === '1'
}

/** Builds an href preserving the current query string with overrides applied. */
export function buildHref(
  pathname: string,
  params: SearchParams | URLSearchParams | undefined,
  overrides: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams()
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => search.set(key, value))
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      const raw = Array.isArray(value) ? value[0] : value
      if (raw != null && raw.length > 0) search.set(key, raw)
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === '') search.delete(key)
    else search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${pathname}?${query}` : pathname
}

/** Filter keys that reset pagination whenever they change. */
export const PAGINATION_RESET_KEYS = [
  'q', 'intent', 'cluster', 'status', 'owner', 'device', 'country', 'engine',
  'position', 'volumeMin', 'volumeMax', 'difficultyMin', 'difficultyMax',
  'priority', 'contentType', 'due', 'citation', 'sentiment', 'linkType',
  'authorityMin', 'authorityMax', 'tld', 'range', 'from', 'to', 'site', 'view',
]

export function withFilter(
  pathname: string,
  params: SearchParams | URLSearchParams | undefined,
  key: string,
  value: string | number | undefined | null,
): string {
  const overrides: Record<string, string | number | undefined | null> = { [key]: value }
  if (PAGINATION_RESET_KEYS.includes(key)) overrides.page = undefined
  return buildHref(pathname, params, overrides)
}

/** Description of one active filter chip, for the "clear all" bar. */
export interface ActiveFilter {
  key: string
  label: string
  value: string
}

/** Export links carry the current filters, search, sort and site — never a blank export. */
export function buildExportHref(surface: string, params: SearchParams | URLSearchParams | undefined): string {
  return buildHref('/api/seo/export', params, { surface })
}

export function activeFilters(
  params: SearchParams | undefined,
  labels: Record<string, string>,
  valueLabels: Record<string, (value: string) => string> = {},
): ActiveFilter[] {
  const result: ActiveFilter[] = []
  for (const [key, label] of Object.entries(labels)) {
    const value = readParam(params, key)
    if (!value) continue
    result.push({ key, label, value: valueLabels[key]?.(value) ?? value })
  }
  return result
}
