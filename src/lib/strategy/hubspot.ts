import 'server-only'
import { mapHubSpotLists, type CrmSegment } from './crm-rules'

const API = 'https://api.hubapi.com'
const MAX_LISTS = 500

export class HubSpotError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function call(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
  } catch {
    throw new HubSpotError('HubSpot could not be reached. Try again in a moment.', 0)
  }
  if (res.status === 401) throw new HubSpotError('HubSpot rejected the access token. Check it has not been revoked.', 401)
  if (res.status === 403) throw new HubSpotError('The HubSpot private app is missing the crm.lists.read scope.', 403)
  if (res.status === 429) throw new HubSpotError('HubSpot is rate limiting this account. Try again in a minute.', 429)
  if (!res.ok) throw new HubSpotError(`HubSpot returned an error (${res.status}).`, res.status)
  return res.json()
}

/** Verifies the token and returns a label for the connected portal. */
export async function testHubSpotToken(token: string): Promise<{ accountLabel: string }> {
  const details = await call(token, '/account-info/v3/details') as { portalId?: number; accountType?: string }
  // Confirms the list scope up front so a connection never "succeeds" and then fails every sync.
  await call(token, '/crm/v3/lists/search', { method: 'POST', body: JSON.stringify({ count: 1, offset: 0, query: '' }) })
  return { accountLabel: details.portalId ? `HubSpot portal ${details.portalId}` : 'HubSpot' }
}

/** Every contact list's name and size, paginated, capped at 500 lists. */
export async function fetchHubSpotSegments(token: string): Promise<{ segments: CrmSegment[]; truncated: boolean }> {
  const segments: CrmSegment[] = []
  let offset = 0
  for (let page = 0; page < 20; page++) {
    const payload = await call(token, '/crm/v3/lists/search', {
      method: 'POST',
      body: JSON.stringify({ count: 100, offset, query: '', additionalProperties: ['hs_list_size'] }),
    })
    const result = mapHubSpotLists(payload)
    segments.push(...result.segments)
    if (segments.length >= MAX_LISTS) return { segments: segments.slice(0, MAX_LISTS), truncated: true }
    if (!result.hasMore || result.offset === null || result.offset === offset) break
    offset = result.offset
  }
  return { segments, truncated: false }
}
