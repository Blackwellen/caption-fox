/**
 * Pure rules for the HubSpot segment sync (no network, unit-tested).
 * Only list metadata and aggregated sizes are used — never contact records.
 */

export interface CrmSegment {
  externalId: string
  name: string
  size: number
  dynamic: boolean
  updatedAt: string | null
}

/** HubSpot private-app tokens look like `pat-<region>-<uuid>`. */
export function isPlausibleHubSpotToken(value: unknown): value is string {
  return typeof value === 'string' && /^pat-[a-z0-9]{2,6}-[A-Za-z0-9-]{20,120}$/.test(value.trim())
}

function toSize(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

/** Maps one page of `POST /crm/v3/lists/search` results to segments. */
export function mapHubSpotLists(payload: unknown): { segments: CrmSegment[]; hasMore: boolean; offset: number | null } {
  const body = (payload ?? {}) as { lists?: unknown[]; hasMore?: boolean; offset?: number }
  const segments: CrmSegment[] = []
  for (const raw of Array.isArray(body.lists) ? body.lists : []) {
    const list = raw as Record<string, unknown>
    const id = list.listId ?? list.id
    const name = typeof list.name === 'string' ? list.name.trim() : ''
    if ((typeof id !== 'string' && typeof id !== 'number') || !name) continue
    const extra = (list.additionalProperties ?? {}) as Record<string, unknown>
    segments.push({
      externalId: String(id),
      name: name.slice(0, 80),
      size: toSize(list.size ?? extra.hs_list_size),
      dynamic: list.processingType === 'DYNAMIC',
      updatedAt: typeof list.updatedAt === 'string' ? list.updatedAt : null,
    })
  }
  return { segments, hasMore: Boolean(body.hasMore), offset: typeof body.offset === 'number' ? body.offset : null }
}

/** Period-on-period growth as a percentage, clamped to the column's range. */
export function growthRate(previous: number | null | undefined, next: number): number {
  if (!previous || previous <= 0) return 0
  const rate = ((next - previous) / previous) * 100
  return Math.max(-9999, Math.min(9999, Math.round(rate * 100) / 100))
}
