import 'server-only'
import { randomBytes } from 'node:crypto'
import type { AdProvider } from '../providers'
import { ProviderApiError, type AdapterContext } from './types'

// Shared HTTP layer for every ad-platform adapter: retry with backoff, provider
// rate-limit handling, cursor pagination and error redaction.
//
// Nothing here logs a token. Errors carry a short reference the customer can
// quote to support, and support correlates it with the server log.

const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 500
const DEFAULT_TIMEOUT_MS = 30_000

/** Status codes worth retrying. 429 is rate limiting; 5xx is provider-side. */
function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600)
}

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader)
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000)
  }
  // Exponential with jitter so parallel syncs do not resonate.
  const exponential = BASE_DELAY_MS * 2 ** attempt
  return Math.min(exponential + Math.random() * 250, 30_000)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Strips anything token-shaped from a provider error body before logging. */
export function redact(text: string): string {
  return text
    .replace(/([A-Za-z0-9_-]{24,})/g, '[redacted]')
    .replace(/(access_token|refresh_token|client_secret|developer[_-]?token)"?\s*[:=]\s*"?[^",&\s}]+/gi, '$1=[redacted]')
    .slice(0, 400)
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  /** Extra headers merged over the auth header. */
  headers?: Record<string, string>
  /** Some providers want the token in a custom header instead of Bearer. */
  authHeader?: (token: string) => Record<string, string>
  timeoutMs?: number
}

export async function providerFetch<T>(ctx: AdapterContext, options: RequestOptions): Promise<T> {
  const url = new URL(options.path.startsWith('http') ? options.path : `${ctx.apiBase}${options.path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'CaptionFox-Advertising/1.0',
    ...(options.authHeader ? options.authHeader(ctx.accessToken) : { Authorization: `Bearer ${ctx.accessToken}` }),
    ...options.headers,
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let lastError: ProviderApiError | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout

    let response: Response
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
        cache: 'no-store',
      })
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === 'TimeoutError'
      lastError = new ProviderApiError(
        aborted ? 'The advertising platform did not respond in time.' : 'Could not reach the advertising platform.',
        ctx.provider, 0, true, reference(),
      )
      if (attempt < MAX_ATTEMPTS - 1) { await sleep(backoffMs(attempt, null)); continue }
      throw lastError
    }

    if (response.ok) {
      const text = await response.text()
      if (!text) return {} as T
      try { return JSON.parse(text) as T } catch {
        throw new ProviderApiError('The advertising platform returned an unreadable response.', ctx.provider, response.status, false, reference())
      }
    }

    const bodyText = await response.text().catch(() => '')
    const retryable = isRetryable(response.status)
    lastError = new ProviderApiError(
      describe(ctx.provider, response.status, bodyText),
      ctx.provider, response.status, retryable, reference(),
    )
    if (retryable && attempt < MAX_ATTEMPTS - 1) {
      await sleep(backoffMs(attempt, response.headers.get('retry-after')))
      continue
    }
    throw lastError
  }

  throw lastError ?? new ProviderApiError('Unknown provider failure.', ctx.provider, 0, false, reference())
}

function reference(): string {
  return randomBytes(5).toString('hex')
}

/** Customer-facing messages. Provider text is redacted before it is included. */
function describe(provider: AdProvider, status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'The advertising platform rejected the stored authorisation. Reconnect the account to grant access again.'
  }
  if (status === 429) return 'The advertising platform is rate limiting this workspace. The sync will retry shortly.'
  if (status === 404) return 'The requested record no longer exists on the advertising platform.'
  if (status >= 500) return 'The advertising platform is currently unavailable.'
  return `The advertising platform rejected the request (${status}). ${redact(body)}`.trim()
}

/**
 * Walks a cursor-paginated collection. `next` returns the cursor for the
 * following page, or null when the collection is exhausted. Guards against a
 * provider returning the same cursor forever.
 */
export async function paginate<TPage, TItem>(
  fetchPage: (cursor: string | null) => Promise<TPage>,
  extract: (page: TPage) => { items: TItem[]; next: string | null },
  limit = 50,
): Promise<TItem[]> {
  const items: TItem[] = []
  const seen = new Set<string>()
  let cursor: string | null = null

  for (let page = 0; page < limit; page += 1) {
    const result = extract(await fetchPage(cursor))
    items.push(...result.items)
    if (!result.next) break
    if (seen.has(result.next)) break
    seen.add(result.next)
    cursor = result.next
  }
  return items
}

/** Provider money often arrives as minor units or as a string. */
export function money(value: unknown, minorUnits = false): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value))
  if (!Number.isFinite(parsed)) return null
  return minorUnits ? parsed / 100 : parsed
}

export function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? 0))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Provider dates come in many shapes; normalise to an ISO date string. */
export function isoDate(value: unknown): string | null {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function dayString(value: unknown): string {
  const iso = isoDate(value)
  return iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
}
