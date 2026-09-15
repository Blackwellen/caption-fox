// URL <-> query-state for the Brand & Assets module.
//
// Every list surface is driven from searchParams so that refresh, browser
// back/forward and a pasted link all reproduce the same view, and so exports can
// reuse exactly what the user is looking at. Unknown or malformed values fall
// back to the default rather than throwing.

import type { AssetView, KitView, ProductView, RightsView } from '@/types/brand-assets'

export type RawParams = Record<string, string | string[] | undefined>

function one(params: RawParams, key: string): string | undefined {
  const v = params[key]
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t ? t : undefined
}

function many(params: RawParams, key: string): string[] {
  const v = params[key]
  if (!v) return []
  const list = Array.isArray(v) ? v : v.split(',')
  return list.map(s => s.trim()).filter(Boolean)
}

function intIn(params: RawParams, key: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(one(params, key) ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function pick<T extends string>(params: RawParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = one(params, key)
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback
}

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
/** Hard ceiling so a crafted URL cannot ask for an unbounded scan. */
export const MAX_PAGE_SIZE = 100

export interface BaseFilters {
  q: string | null
  brandId: string | null
  ownerId: string | null
  sort: string
  page: number
  pageSize: number
}

function baseFrom(params: RawParams, defaultSort: string, defaultPageSize = DEFAULT_PAGE_SIZE): BaseFilters {
  return {
    q: one(params, 'q') ?? null,
    brandId: one(params, 'brand') ?? null,
    ownerId: one(params, 'owner') ?? null,
    sort: one(params, 'sort') ?? defaultSort,
    page: intIn(params, 'page', 1, 1, 10_000),
    pageSize: intIn(params, 'pageSize', defaultPageSize, 1, MAX_PAGE_SIZE),
  }
}

// ---------------------------------------------------------------------------
// Brand Kits
// ---------------------------------------------------------------------------
export interface KitFilters extends BaseFilters {
  view: KitView
  team: string | null
  status: string | null
  familyId: string | null
  approval: string | null
  tags: string[]
  /** Kit whose brand system fills the lower panels; defaults to the first kit. */
  kitId: string | null
}

export function parseKitFilters(params: RawParams): KitFilters {
  return {
    ...baseFrom(params, 'recently_updated'),
    kitId: one(params, 'kit') ?? null,
    view: pick(params, 'view', ['cards', 'table'] as const, 'cards'),
    team: one(params, 'team') ?? null,
    status: one(params, 'status') ?? null,
    familyId: one(params, 'family') ?? null,
    approval: one(params, 'approval') ?? null,
    tags: many(params, 'tags'),
  }
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
export interface AssetFilters extends BaseFilters {
  view: AssetView
  kind: string | null
  status: string | null
  rights: string | null
  folderId: string | null
  collectionId: string | null
  productId: string | null
  addedFrom: string | null
  addedTo: string | null
  favouritesOnly: boolean
}

/** "Date Added" presets (days back) → ISO lower bound. */
export const ADDED_PRESETS = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', '365': 'Last 12 months' } as const

export function parseAssetFilters(params: RawParams): AssetFilters {
  const added = one(params, 'added')
  const addedFrom = added && added in ADDED_PRESETS
    ? new Date(Date.now() - Number(added) * 86_400_000).toISOString()
    : (one(params, 'addedFrom') ?? null)
  return {
    ...baseFrom(params, 'newest', 10),
    view: pick(params, 'view', ['grid', 'list', 'table'] as const, 'grid'),
    kind: one(params, 'type') ?? null,
    status: one(params, 'status') ?? null,
    rights: one(params, 'rights') ?? null,
    folderId: one(params, 'folder') ?? null,
    collectionId: one(params, 'collection') ?? null,
    productId: one(params, 'product') ?? null,
    addedFrom,
    addedTo: one(params, 'addedTo') ?? null,
    favouritesOnly: one(params, 'favourites') === '1',
  }
}

// ---------------------------------------------------------------------------
// Rights
// ---------------------------------------------------------------------------
export interface RightsFilters extends BaseFilters {
  view: RightsView
  territory: string | null
  channel: string | null
  status: string | null
  licenseType: string | null
  productId: string | null
  expiryFrom: string | null
  expiryTo: string | null
  /** Calendar view anchor, ISO date. */
  anchor: string | null
}

export function parseRightsFilters(params: RawParams): RightsFilters {
  return {
    ...baseFrom(params, 'expiry_asc', 6),
    view: pick(params, 'view', ['table', 'calendar', 'cards'] as const, 'table'),
    territory: one(params, 'territory') ?? null,
    channel: one(params, 'channel') ?? null,
    status: one(params, 'status') ?? null,
    licenseType: one(params, 'licenseType') ?? null,
    productId: one(params, 'product') ?? null,
    expiryFrom: one(params, 'expiryFrom') ?? null,
    expiryTo: one(params, 'expiryTo') ?? null,
    anchor: one(params, 'anchor') ?? null,
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export interface ProductFilters extends BaseFilters {
  view: ProductView
  categoryId: string | null
  collectionId: string | null
  status: string | null
  market: string | null
  readiness: string | null
  missingAsset: string | null
  productLine: string | null
}

export function parseProductFilters(params: RawParams): ProductFilters {
  return {
    ...baseFrom(params, 'recently_updated', 6),
    view: pick(params, 'view', ['cards', 'list', 'table'] as const, 'cards'),
    categoryId: one(params, 'category') ?? null,
    collectionId: one(params, 'collection') ?? null,
    status: one(params, 'status') ?? null,
    market: one(params, 'market') ?? null,
    readiness: one(params, 'readiness') ?? null,
    missingAsset: one(params, 'missing') ?? null,
    productLine: one(params, 'line') ?? null,
  }
}

// ---------------------------------------------------------------------------
// URL building — used by filter controls, pagination and view switchers so the
// whole module produces shareable links rather than local component state.
// ---------------------------------------------------------------------------

/** Keys that reset paging when changed — a new filter must return to page 1. */
const PAGE_RESETTING = new Set([
  'q', 'brand', 'owner', 'sort', 'view', 'team', 'status', 'family', 'approval',
  'tags', 'type', 'rights', 'folder', 'collection', 'product', 'addedFrom', 'added',
  'addedTo', 'favourites', 'territory', 'channel', 'licenseType', 'expiryFrom',
  'expiryTo', 'category', 'market', 'readiness', 'missing', 'line', 'pageSize',
])

export function buildHref(
  pathname: string,
  current: RawParams,
  patch: Record<string, string | number | boolean | null | undefined>,
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) {
    if (v === undefined) continue
    const s = Array.isArray(v) ? v.join(',') : v
    if (s) sp.set(k, s)
  }
  let resetsPage = false
  for (const [k, v] of Object.entries(patch)) {
    if (PAGE_RESETTING.has(k)) resetsPage = true
    if (v === null || v === undefined || v === '' || v === false) sp.delete(k)
    else sp.set(k, String(v))
  }
  if (resetsPage && !('page' in patch)) sp.delete('page')
  const qs = sp.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** Active filter chips, so the user can see and clear what is applied. */
export interface FilterChip { key: string; label: string; value: string }

export function chipsFor(filters: Record<string, unknown>, labels: Record<string, string>): FilterChip[] {
  const out: FilterChip[] = []
  for (const [key, label] of Object.entries(labels)) {
    const v = filters[key]
    if (v === null || v === undefined || v === '' || v === false) continue
    if (Array.isArray(v) && v.length === 0) continue
    out.push({ key, label, value: Array.isArray(v) ? v.join(', ') : String(v) })
  }
  return out
}
