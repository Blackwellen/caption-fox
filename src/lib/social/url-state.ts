// URL state parsing shared by the Social pages and API routes. Every value
// arrives from the query string, so each parser clamps to a known-safe value
// rather than trusting it — an invalid parameter can never widen a query.

export type SearchParams = Record<string, string | string[] | undefined>

export const RANGE_OPTIONS = [7, 14, 30, 90] as const

export function first(value: string | string[] | undefined | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Whole days between 1 and 365; anything else becomes `fallback`. */
export function parseDays(raw: string | string[] | undefined | null, fallback = 7): number {
  const value = Number.parseInt(first(raw) ?? '', 10)
  return Number.isFinite(value) && value >= 1 ? Math.min(365, value) : fallback
}

/** One of `allowed`, or the fallback. */
export function parseEnum<T extends string>(raw: string | string[] | undefined | null, allowed: readonly T[], fallback: T): T {
  const value = first(raw)
  return value !== null && (allowed as readonly string[]).includes(value) ? value as T : fallback
}

/** 1-based page number, capped so a hostile value cannot request a huge offset. */
export function parsePage(raw: string | string[] | undefined | null): number {
  const value = Number.parseInt(first(raw) ?? '', 10)
  return Number.isFinite(value) && value >= 1 ? Math.min(value, 10_000) : 1
}

/** A UUID or null — ids from the URL are never passed to a query unchecked. */
export function parseId(raw: string | string[] | undefined | null): string | null {
  const value = first(raw)
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null
}

/** Free-text search: trimmed, length-capped, and stripped of PostgREST filter syntax. */
export function parseSearch(raw: string | string[] | undefined | null): string | null {
  const value = (first(raw) ?? '').replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return value || null
}

/** Rebuilds a query string from params, applying updates (null removes a key). */
export function withParams(params: SearchParams, updates: Record<string, string | number | null>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const single = first(value)
    if (single !== null && single !== '') query.set(key, single)
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') query.delete(key)
    else query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}
