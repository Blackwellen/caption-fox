// Server queries for the Brand & Assets module.
//
// Every query is scoped to ctx.workspace.id in addition to RLS — defence in
// depth, and it keeps the planner on the workspace indexes. Independent reads
// are issued with Promise.all so a dashboard is one round of parallel queries
// rather than a waterfall.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BrandContext } from './context'
import { R2_PREFIX, signReadUrls } from '@/lib/storage/r2'
import type { AssetFilters, KitFilters, ProductFilters, RightsFilters } from './filters'
import type {
  BrandActivityItem, BrandAlert, BrandAssetCard, BrandKitCard, ProductCard,
  RightsChannel, RightsLicenseRow, RightsTerritory, AssetFolder, AssetCollection,
} from '@/types/brand-assets'

export const PROFILE = 'id, full_name, avatar_url'
const BRAND = 'id, name, slug, logo_url, primary_color, status, family_id'

/**
 * The subset of PostgREST filter methods a count needs. Declaring it explicitly
 * keeps `countOf` callers type-checked without dragging in the full generic
 * builder type, which does not survive the head:true count narrowing.
 */
interface CountQuery {
  eq: (column: string, value: unknown) => CountQuery
  gte: (column: string, value: unknown) => CountQuery
  lte: (column: string, value: unknown) => CountQuery
  in: (column: string, values: readonly unknown[]) => CountQuery
  is: (column: string, value: unknown) => CountQuery
  not: (column: string, operator: string, value: unknown) => CountQuery
  neq: (column: string, value: unknown) => CountQuery
}

/** Rows counted, not fetched — used for every KPI so nothing is client-side maths. */
export async function countOf(
  supabase: SupabaseClient,
  table: string,
  workspaceId: string,
  apply?: (q: CountQuery) => CountQuery,
): Promise<number> {
  const base = supabase.from(table)
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  const filtered = apply ? apply(base as unknown as CountQuery) : (base as unknown as CountQuery)
  const { count } = await (filtered as unknown as PromiseLike<{ count: number | null }>)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Media signing. Thumbnails and avatars are stored as `r2:` paths in a private
// bucket; the page receives short-lived signed URLs instead. Only paths under
// this workspace's own prefix are signed — anything else becomes null, so a
// row can never be used to mint a URL for another tenant's object.
// ---------------------------------------------------------------------------
const MEDIA_FIELDS = new Set(['thumbnail_path', 'avatar_url', 'logo_url'])

export async function signMedia<T>(ctx: BrandContext, data: T): Promise<T> {
  const allowed = `${R2_PREFIX}brand-assets/${ctx.workspace.id}/`
  const found = new Set<string>()
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node)) {
      if (MEDIA_FIELDS.has(k) && typeof v === 'string' && v.startsWith(R2_PREFIX)) found.add(v)
      else if (v && typeof v === 'object') walk(v)
    }
  }
  walk(data)
  if (found.size === 0) return data

  const signed = await signReadUrls([...found].filter(p => p.startsWith(allowed) && !p.includes('..')))
  const replace = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(replace); return }
    if (!node || typeof node !== 'object') return
    const rec = node as Record<string, unknown>
    for (const [k, v] of Object.entries(rec)) {
      if (MEDIA_FIELDS.has(k) && typeof v === 'string' && v.startsWith(R2_PREFIX)) rec[k] = signed.get(v) ?? null
      else if (v && typeof v === 'object') replace(v)
    }
  }
  replace(data)
  return data
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function startOfMonthIso(offsetMonths = 0): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offsetMonths)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// ===========================================================================
// OVERVIEW  —  /{type}/brand
// ===========================================================================

export interface OverviewData {
  kpis: {
    brandKits: number; brandKitsDelta: number
    approvedAssets: number; approvedAssetsDelta: number
    rightsExpiring: number; rightsExpiringDelta: number
    products: number; productsDelta: number
    usageRequests: number; usageRequestsDelta: number
    complianceScore: number; complianceScoreDelta: number
  }
  kits: BrandKitCard[]
  recentAssets: BrandAssetCard[]
  rights: RightsLicenseRow[]
  products: ProductCard[]
  activity: BrandActivityItem[]
  alerts: BrandAlert[]
  storage: { used: number; quota: number; percent: number }
}

export interface OverviewOptions {
  /** Recent Assets panel: asset_kind filter, sort and view — all URL-driven. */
  recentKind?: string | null
  recentSort?: 'newest' | 'name_asc' | 'size_desc'
}

export async function getOverviewData(ctx: BrandContext, opts: OverviewOptions = {}): Promise<OverviewData> {
  const { supabase, workspace, activeBrand } = ctx
  const ws = workspace.id
  const brandFilter = activeBrand?.id ?? null
  const thisMonth = startOfMonthIso(0)
  const in30 = isoDaysFromNow(30)
  const today = new Date().toISOString().slice(0, 10)

  const [
    kitCount, kitNew,
    approvedCount, approvedNew,
    expiringCount,
    productCount, productNew,
    usageCount, usageNew,
    conflictOpen, licenceTotal,
    kits, recentAssets, rights, products, activity, alerts,
  ] = await Promise.all([
    countOf(supabase, 'brand_kits', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'brand_kits', ws, q => q.gte('created_at', thisMonth)),
    countOf(supabase, 'media_assets', ws, q => q.eq('approval_status', 'approved').is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.eq('approval_status', 'approved').gte('created_at', thisMonth)),
    countOf(supabase, 'rights_licenses', ws, q => q.lte('expires_on', in30).gte('expires_on', today).not('status', 'in', '("cancelled","expired")')),
    countOf(supabase, 'products', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'products', ws, q => q.gte('created_at', thisMonth)),
    countOf(supabase, 'asset_usage_requests', ws, q => q.in('status', ['submitted', 'under_review'])),
    countOf(supabase, 'asset_usage_requests', ws, q => q.gte('created_at', thisMonth)),
    countOf(supabase, 'rights_conflicts', ws, q => q.is('resolved_at', null)),
    countOf(supabase, 'rights_licenses', ws),
    listBrandKits(ctx, 15),
    listRecentAssets(ctx, 6, opts.recentKind ?? null, opts.recentSort ?? 'newest'),
    listRecentLicenses(ctx, 4),
    listRecentProducts(ctx, 3),
    listActivity(ctx, 5),
    listAlerts(ctx, 4),
  ])

  void brandFilter

  // Compliance is derived, never stored: the share of licences with no open
  // conflict. No licences at all is treated as 100% rather than a divide by zero.
  const complianceScore = licenceTotal === 0
    ? 100
    : Math.max(0, Math.round(((licenceTotal - conflictOpen) / licenceTotal) * 100))

  const storage = ctx.storage
  return signMedia(ctx, {
    kpis: {
      brandKits: kitCount, brandKitsDelta: kitNew,
      approvedAssets: approvedCount, approvedAssetsDelta: approvedNew,
      rightsExpiring: expiringCount, rightsExpiringDelta: -expiringCount,
      products: productCount, productsDelta: productNew,
      usageRequests: usageCount, usageRequestsDelta: usageNew,
      complianceScore, complianceScoreDelta: 0,
    },
    kits, recentAssets, rights, products, activity, alerts,
    storage: {
      used: storage.bytes_used,
      quota: storage.bytes_quota,
      percent: storage.bytes_quota > 0
        ? Math.min(100, Math.round((storage.bytes_used / storage.bytes_quota) * 100))
        : 0,
    },
  })
}

// ===========================================================================
// BRAND KITS  —  /{type}/brand/kits
// ===========================================================================

export const KIT_SELECT = `
  id, workspace_id, brand_id, name, description, status, approval_status,
  logo_asset_id, team_name, consistency_score, current_version, published_version,
  owner_id, is_demo, created_at, updated_at,
  brand:brands(${BRAND}),
  owner:profiles!brand_kits_owner_id_fkey(${PROFILE}),
  colours:brand_kit_colours(id, name, hex, role, usage_notes, sort_order),
  typography:brand_kit_typography(id, style_name, font_family, font_weight, font_size_px, line_height_px, letter_spacing, sort_order),
  icons:brand_kit_icons(style_name, stroke_width, corner_style, fill_style)
`

export async function hydrateKits(ctx: BrandContext, rows: unknown[]): Promise<BrandKitCard[]> {
  const kits = (rows ?? []) as BrandKitCard[]
  if (kits.length === 0) return []

  // Two grouped counts instead of a per-card query — avoids N+1 on the grid.
  const ids = kits.map(k => k.id)
  const [{ data: assetRows }, { data: templateRows }] = await Promise.all([
    ctx.supabase.from('media_assets').select('brand_kit_id').eq('workspace_id', ctx.workspace.id).in('brand_kit_id', ids),
    ctx.supabase.from('brand_kit_templates').select('brand_kit_id').eq('workspace_id', ctx.workspace.id).in('brand_kit_id', ids),
  ])
  const assetTally = tally((assetRows ?? []) as { brand_kit_id: string }[], r => r.brand_kit_id)
  const templateTally = tally((templateRows ?? []) as { brand_kit_id: string }[], r => r.brand_kit_id)

  for (const kit of kits) {
    kit.asset_count = assetTally.get(kit.id) ?? 0
    kit.template_count = templateTally.get(kit.id) ?? 0
    kit.colours = (kit.colours ?? []).sort((a, b) => a.sort_order - b.sort_order)
    kit.typography = (kit.typography ?? []).sort((a, b) => a.sort_order - b.sort_order)
  }
  return kits
}

function tally<T>(rows: T[], key: (row: T) => string | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

async function listBrandKits(ctx: BrandContext, limit: number): Promise<BrandKitCard[]> {
  let q = ctx.supabase.from('brand_kits').select(KIT_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return hydrateKits(ctx, data ?? [])
}

export interface KitSystem {
  kit: BrandKitCard
  logos: { id: string; label: string; lockup_type: string; background: string | null }[]
  templates: { id: string; name: string; template_type: string; dimensions: string | null; thumbnail_path: string | null }[]
  documents: { id: string; title: string; doc_type: string; version_label: string | null; file_size: number | null }[]
  tone: { statement: string | null; traits: string[] } | null
  linkedAssets: { id: string; file_name: string; thumbnail_path: string | null; asset_kind: string }[]
  linkedTotal: number
}

export interface KitsPage {
  kits: BrandKitCard[]
  total: number
  kpis: {
    totalKits: number; totalKitsDelta: number; activeBrands: number; activeBrandsDelta: number
    templates: number; templatesDelta: number; pendingApprovals: number; pendingApprovalsDelta: number
    linkedAssets: number; linkedAssetsDelta: number; consistencyScore: number
  }
  recentUpdates: BrandActivityItem[]
  approvalQueue: { id: string; name: string; status: string; updated_at: string; owner: { full_name: string | null; avatar_url: string | null } | null }[]
  comments: { id: string; body: string; created_at: string; kit_id: string; author: { full_name: string | null; avatar_url: string | null } | null }[]
  teams: string[]
  families: { id: string; name: string }[]
  system: KitSystem | null
}

export async function getKitsPage(ctx: BrandContext, f: KitFilters): Promise<KitsPage> {
  const ws = ctx.workspace.id
  const { supabase } = ctx

  let q = supabase.from('brand_kits').select(KIT_SELECT, { count: 'exact' })
    .eq('workspace_id', ws)
    .is('archived_at', null)

  if (f.brandId) q = q.eq('brand_id', f.brandId)
  else if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  if (f.familyId) {
    // Family membership resolves through the caller's own brand list — no extra query, no cross-tenant ids.
    const ids = ctx.brands.filter(b => b.family_id === f.familyId).map(b => b.id)
    q = q.in('brand_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }
  if (f.status) q = q.eq('status', f.status)
  if (f.approval) q = q.eq('approval_status', f.approval)
  if (f.team) q = q.eq('team_name', f.team)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  // ilike on name + description; escaped so % and _ in user input stay literal.
  if (f.q) {
    const term = f.q.replace(/[%_]/g, m => `\\${m}`)
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }

  q = applyKitSort(q, f.sort)
  const from = (f.page - 1) * f.pageSize
  q = q.range(from, from + f.pageSize - 1)

  const [{ data, count }, kpis, recentUpdates, approvalQueue, comments, teams, families] = await Promise.all([
    q,
    kitKpis(ctx),
    listActivity(ctx, 5, ['brand_kit']),
    listKitApprovalQueue(ctx, 5),
    listKitComments(ctx, 2),
    listKitTeams(ctx),
    ctx.supabase.from('brand_families').select('id, name').eq('workspace_id', ws).is('archived_at', null).order('name'),
  ])

  const kits = await hydrateKits(ctx, data ?? [])
  const lead = kits.find(k => k.id === f.kitId) ?? kits[0] ?? null
  const system = lead ? await loadKitSystem(ctx, lead) : null

  return signMedia(ctx, {
    kits, total: count ?? 0, kpis, recentUpdates, approvalQueue, comments, teams,
    families: (families.data ?? []) as { id: string; name: string }[],
    system,
  })
}

/** Every panel of one kit's brand system, in one parallel round. */
export async function loadKitSystem(ctx: BrandContext, kit: BrandKitCard): Promise<KitSystem> {
  const ws = ctx.workspace.id
  const [logos, templates, documents, tone, linked, linkedCount] = await Promise.all([
    ctx.supabase.from('brand_kit_logos').select('id, label, lockup_type, background').eq('workspace_id', ws).eq('brand_kit_id', kit.id).order('sort_order'),
    ctx.supabase.from('brand_kit_templates').select('id, name, template_type, dimensions, asset:media_assets(thumbnail_path)').eq('workspace_id', ws).eq('brand_kit_id', kit.id).order('sort_order').limit(4),
    ctx.supabase.from('brand_kit_documents').select('id, title, doc_type, version_label, asset:media_assets(file_size)').eq('workspace_id', ws).eq('brand_kit_id', kit.id).order('sort_order').limit(4),
    ctx.supabase.from('brand_kit_tone').select('statement, traits').eq('workspace_id', ws).eq('brand_kit_id', kit.id).maybeSingle(),
    ctx.supabase.from('media_assets').select('id, file_name, thumbnail_path, asset_kind').eq('workspace_id', ws).eq('brand_kit_id', kit.id).is('archived_at', null).not('thumbnail_path', 'is', null).order('created_at', { ascending: false }).limit(4),
    countOf(ctx.supabase, 'media_assets', ws, q => q.eq('brand_kit_id', kit.id).is('archived_at', null)),
  ])
  type WithAsset<T> = T & { asset: { thumbnail_path?: string | null; file_size?: number | null } | { thumbnail_path?: string | null; file_size?: number | null }[] | null }
  const one = <T,>(a: T | T[] | null) => (Array.isArray(a) ? a[0] : a) ?? null
  return {
    kit,
    logos: (logos.data ?? []) as KitSystem['logos'],
    templates: ((templates.data ?? []) as WithAsset<{ id: string; name: string; template_type: string; dimensions: string | null }>[])
      .map(({ asset, ...t }) => ({ ...t, thumbnail_path: one(asset)?.thumbnail_path ?? null })),
    documents: ((documents.data ?? []) as WithAsset<{ id: string; title: string; doc_type: string; version_label: string | null }>[])
      .map(({ asset, ...d }) => ({ ...d, file_size: one(asset)?.file_size ?? null })),
    tone: (tone.data ?? null) as KitSystem['tone'],
    linkedAssets: (linked.data ?? []) as KitSystem['linkedAssets'],
    linkedTotal: linkedCount,
  }
}

function applyKitSort<T extends { order: (c: string, o?: { ascending: boolean }) => T }>(q: T, sort: string): T {
  switch (sort) {
    case 'name_asc': return q.order('name', { ascending: true })
    case 'name_desc': return q.order('name', { ascending: false })
    case 'created_desc': return q.order('created_at', { ascending: false })
    case 'status': return q.order('status', { ascending: true })
    default: return q.order('updated_at', { ascending: false })
  }
}

async function kitKpis(ctx: BrandContext) {
  const ws = ctx.workspace.id
  const { supabase } = ctx
  const month = startOfMonthIso(0)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const [totalKits, totalKitsDelta, activeBrands, activeBrandsDelta, templates, templatesDelta,
    pendingApprovals, pendingApprovalsDelta, linkedAssets, linkedAssetsDelta, scoreRows] = await Promise.all([
    countOf(supabase, 'brand_kits', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'brand_kits', ws, q => q.gte('created_at', month)),
    countOf(supabase, 'brands', ws, q => q.eq('status', 'active').is('archived_at', null)),
    countOf(supabase, 'brands', ws, q => q.gte('created_at', month)),
    countOf(supabase, 'brand_kit_templates', ws),
    countOf(supabase, 'brand_kit_templates', ws, q => q.gte('created_at', month)),
    countOf(supabase, 'brand_kits', ws, q => q.eq('approval_status', 'pending')),
    countOf(supabase, 'brand_kits', ws, q => q.eq('approval_status', 'pending').gte('updated_at', weekAgo)),
    countOf(supabase, 'media_assets', ws, q => q.not('brand_kit_id', 'is', null).is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.not('brand_kit_id', 'is', null).gte('created_at', month)),
    supabase.from('brand_kits').select('consistency_score').eq('workspace_id', ws).is('archived_at', null).not('consistency_score', 'is', null),
  ])
  const scores = ((scoreRows.data ?? []) as { consistency_score: number }[]).map(r => Number(r.consistency_score))
  const consistencyScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  return {
    totalKits, totalKitsDelta, activeBrands, activeBrandsDelta, templates, templatesDelta,
    pendingApprovals, pendingApprovalsDelta, linkedAssets, linkedAssetsDelta, consistencyScore,
  }
}

async function listKitApprovalQueue(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('brand_kits')
    .select(`id, name, approval_status, updated_at, owner:profiles!brand_kits_owner_id_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id)
    .in('approval_status', ['pending', 'changes_requested', 'approved'])
    .order('updated_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as unknown as { id: string; name: string; approval_status: string; updated_at: string; owner: { full_name: string | null; avatar_url: string | null } | null }[])
    .map(r => ({ id: r.id, name: r.name, status: r.approval_status, updated_at: r.updated_at, owner: r.owner }))
}

async function listKitComments(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('brand_kit_comments')
    .select(`id, body, created_at, kit_id:brand_kit_id, author:profiles!brand_kit_comments_author_id_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as { id: string; body: string; created_at: string; kit_id: string; author: { full_name: string | null; avatar_url: string | null } | null }[]
}

async function listKitTeams(ctx: BrandContext): Promise<string[]> {
  const { data } = await ctx.supabase
    .from('brand_kits').select('team_name')
    .eq('workspace_id', ctx.workspace.id)
    .not('team_name', 'is', null)
  const set = new Set(((data ?? []) as { team_name: string }[]).map(r => r.team_name))
  return [...set].sort()
}

// ===========================================================================
// ASSETS  —  /{type}/brand/assets
// ===========================================================================

export const ASSET_SELECT = `
  id, workspace_id, brand_id, brand_kit_id, folder_id, owner_id,
  file_name, file_path, file_url, file_type, file_size, mime_type,
  width, height, duration_seconds, tags, alt_text,
  asset_kind, approval_status, rights_state, usage_scope,
  storage_bucket, thumbnail_path, preview_path, checksum, version_no,
  is_favourite, processing_state, scan_state, expires_at, download_count,
  is_demo, created_at, updated_at, archived_at,
  brand:brands(${BRAND}),
  owner:profiles!media_assets_owner_id_fkey(${PROFILE})
`

async function listRecentAssets(
  ctx: BrandContext, limit: number, kind: string | null = null, sort: 'newest' | 'name_asc' | 'size_desc' = 'newest',
): Promise<BrandAssetCard[]> {
  let q = ctx.supabase.from('media_assets').select(ASSET_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
  q = sort === 'name_asc' ? q.order('file_name', { ascending: true })
    : sort === 'size_desc' ? q.order('file_size', { ascending: false })
      : q.order('created_at', { ascending: false })
  q = q.limit(limit)
  if (kind) q = q.eq('asset_kind', kind)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return (data ?? []) as unknown as BrandAssetCard[]
}

export interface AssetsPage {
  assets: BrandAssetCard[]
  total: number
  kpis: {
    total: number; totalDelta: number; approved: number; approvedDelta: number; inReview: number; inReviewDelta: number
    expiringSoon: number; storageUsed: number; storageQuota: number; downloadRequests: number; downloadsDelta: number
  }
  members: { id: string; full_name: string | null }[]
  eligibleForApproval: { id: string; file_name: string; approval_status: string }[]
  folders: AssetFolder[]
  collections: AssetCollection[]
  recentlyUsed: BrandAssetCard[]
  recentUploads: BrandAssetCard[]
  approvalQueue: { id: string; asset_id: string | null; thumbnail_path: string | null; asset_kind: string; asset_name: string; priority: string; created_at: string; brand: string | null; requester: { full_name: string | null; avatar_url: string | null } | null }[]
  flagged: { id: string; asset_id: string | null; thumbnail_path: string | null; asset_kind: string; asset_name: string; issue: string; detected_at: string }[]
  insights: { kind: string; count: number; percent: number }[]
}

export async function getAssetsPage(ctx: BrandContext, f: AssetFilters): Promise<AssetsPage> {
  const ws = ctx.workspace.id
  const { supabase } = ctx

  let q = supabase.from('media_assets').select(ASSET_SELECT, { count: 'exact' })
    .eq('workspace_id', ws)
    .is('archived_at', null)

  if (f.brandId) q = q.eq('brand_id', f.brandId)
  else if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  if (f.kind) q = q.eq('asset_kind', f.kind)
  if (f.status) q = q.eq('approval_status', f.status)
  if (f.rights) q = q.eq('rights_state', f.rights)
  if (f.folderId) q = q.eq('folder_id', f.folderId)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.favouritesOnly) q = q.eq('is_favourite', true)
  if (f.addedFrom) q = q.gte('created_at', f.addedFrom)
  if (f.addedTo) q = q.lte('created_at', f.addedTo)
  if (f.q) {
    const term = f.q.replace(/[%_]/g, m => `\\${m}`)
    // Name, alt text and tag membership — a tag search must match the array.
    q = q.or(`file_name.ilike.%${term}%,alt_text.ilike.%${term}%,tags.cs.{${term}}`)
  }
  if (f.collectionId) {
    const { data: items } = await supabase.from('asset_collection_items')
      .select('asset_id').eq('workspace_id', ws).eq('collection_id', f.collectionId)
    const ids = ((items ?? []) as { asset_id: string }[]).map(r => r.asset_id)
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }
  if (f.productId) {
    const { data: links } = await supabase.from('product_assets')
      .select('asset_id').eq('workspace_id', ws).eq('product_id', f.productId)
    const ids = ((links ?? []) as { asset_id: string }[]).map(r => r.asset_id)
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  q = applyAssetSort(q, f.sort)
  const from = (f.page - 1) * f.pageSize
  q = q.range(from, from + f.pageSize - 1)

  const [{ data, count }, kpis, folders, collections, recentlyUsed, recentUploads, approvalQueue, flagged, insights, members, eligible] =
    await Promise.all([
      q,
      assetKpis(ctx),
      listFolders(ctx),
      listCollections(ctx),
      listRecentlyUsed(ctx, 5),
      listRecentAssets(ctx, 5),
      listAssetApprovalQueue(ctx, 5),
      listFlaggedAssets(ctx, 5),
      assetInsights(ctx),
      listMembers(ctx),
      ctx.supabase.from('media_assets').select('id, file_name, approval_status').eq('workspace_id', ws)
        .in('approval_status', ['draft', 'changes_requested', 'rejected']).is('archived_at', null).order('updated_at', { ascending: false }).limit(50),
    ])

  return signMedia(ctx, {
    assets: (data ?? []) as unknown as BrandAssetCard[],
    total: count ?? 0,
    kpis, folders, collections, recentlyUsed, recentUploads, approvalQueue, flagged, insights, members,
    eligibleForApproval: (eligible.data ?? []) as { id: string; file_name: string; approval_status: string }[],
  })
}

function applyAssetSort<T extends { order: (c: string, o?: { ascending: boolean }) => T }>(q: T, sort: string): T {
  switch (sort) {
    case 'oldest': return q.order('created_at', { ascending: true })
    case 'name_asc': return q.order('file_name', { ascending: true })
    case 'name_desc': return q.order('file_name', { ascending: false })
    case 'size_desc': return q.order('file_size', { ascending: false })
    case 'downloads': return q.order('download_count', { ascending: false })
    default: return q.order('created_at', { ascending: false })
  }
}

async function assetKpis(ctx: BrandContext) {
  const ws = ctx.workspace.id
  const { supabase } = ctx
  const in30 = isoDaysFromNow(30)
  const month = startOfMonthIso(0)
  const [total, totalDelta, approved, approvedDelta, inReview, inReviewDelta, expiringSoon, downloadRequests, downloadsDelta] = await Promise.all([
    countOf(supabase, 'media_assets', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.is('archived_at', null).gte('created_at', month)),
    countOf(supabase, 'media_assets', ws, q => q.eq('approval_status', 'approved').is('archived_at', null)),
    countOf(supabase, 'asset_approvals', ws, q => q.eq('status', 'approved').gte('decided_at', month)),
    countOf(supabase, 'media_assets', ws, q => q.eq('approval_status', 'pending').is('archived_at', null)),
    countOf(supabase, 'asset_approvals', ws, q => q.gte('created_at', month)),
    countOf(supabase, 'media_assets', ws, q => q.not('expires_at', 'is', null).lte('expires_at', in30).is('archived_at', null)),
    countOf(supabase, 'asset_downloads', ws),
    countOf(supabase, 'asset_downloads', ws, q => q.gte('created_at', month)),
  ])
  return {
    total, totalDelta, approved, approvedDelta, inReview, inReviewDelta, expiringSoon, downloadRequests, downloadsDelta,
    storageUsed: ctx.storage.bytes_used,
    storageQuota: ctx.storage.bytes_quota,
  }
}

/** Assets most recently downloaded (real usage), falling back to recent edits when there are no downloads yet. */
async function listRecentlyUsed(ctx: BrandContext, limit: number): Promise<BrandAssetCard[]> {
  const { data } = await ctx.supabase.from('asset_downloads')
    .select(`created_at, asset:media_assets(${ASSET_SELECT})`)
    .eq('workspace_id', ctx.workspace.id).order('created_at', { ascending: false }).limit(limit * 4)
  const seen = new Set<string>()
  const used: BrandAssetCard[] = []
  for (const row of (data ?? []) as unknown as { created_at: string; asset: BrandAssetCard | null }[]) {
    if (!row.asset || row.asset.archived_at || seen.has(row.asset.id)) continue
    seen.add(row.asset.id)
    used.push({ ...row.asset, updated_at: row.created_at })
    if (used.length === limit) break
  }
  if (used.length > 0) return used
  const { data: recent } = await ctx.supabase.from('media_assets').select(ASSET_SELECT)
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(limit)
  return (recent ?? []) as unknown as BrandAssetCard[]
}

/** Workspace members for owner filters. Two queries so no FK naming is assumed. */
async function listMembers(ctx: BrandContext): Promise<{ id: string; full_name: string | null }[]> {
  const { data: m } = await ctx.supabase.from('workspace_members').select('user_id').eq('workspace_id', ctx.workspace.id)
  const ids = ((m ?? []) as { user_id: string }[]).map(r => r.user_id)
  if (ids.length === 0) return []
  const { data } = await ctx.supabase.from('profiles').select('id, full_name').in('id', ids).order('full_name')
  return (data ?? []) as { id: string; full_name: string | null }[]
}

async function listFolders(ctx: BrandContext): Promise<AssetFolder[]> {
  const { data } = await ctx.supabase
    .from('asset_folders')
    .select('id, workspace_id, parent_id, name, path')
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .order('name')
  const folders = (data ?? []) as AssetFolder[]
  if (folders.length === 0) return []
  const { data: assets } = await ctx.supabase
    .from('media_assets').select('folder_id')
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null)
    .not('folder_id', 'is', null)
  const counts = tally((assets ?? []) as { folder_id: string }[], r => r.folder_id)
  for (const f of folders) f.asset_count = counts.get(f.id) ?? 0
  return folders
}

async function listCollections(ctx: BrandContext): Promise<AssetCollection[]> {
  const { data } = await ctx.supabase
    .from('asset_collections')
    .select('id, workspace_id, name, description, is_shared')
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .order('name')
  return (data ?? []) as AssetCollection[]
}

async function listAssetApprovalQueue(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('asset_approvals')
    .select(`id, priority, created_at, asset:media_assets(id, file_name, thumbnail_path, asset_kind, brand:brands(name)), requester:profiles!asset_approvals_requested_by_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; priority: string; created_at: string
    asset: { id: string; file_name: string; thumbnail_path: string | null; asset_kind: string; brand: { name: string } | null } | null
    requester: { full_name: string | null; avatar_url: string | null } | null
  }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
    asset_id: r.asset?.id ?? null,
    thumbnail_path: r.asset?.thumbnail_path ?? null,
    asset_kind: r.asset?.asset_kind ?? 'other',
    asset_name: r.asset?.file_name ?? 'Unknown asset',
    priority: r.priority,
    created_at: r.created_at,
    brand: r.asset?.brand?.name ?? null,
    requester: r.requester,
  }))
}

export const CONFLICT_LABEL: Record<string, string> = {
  outside_territory: 'Outside licensed territory',
  unauthorised_channel: 'Unauthorised channel',
  expired_licence: 'Licence expired',
  no_licence: 'No active licence',
  incompatible_product: 'Incompatible product link',
  campaign_outside_period: 'Campaign outside licence period',
  modification_prohibited: 'Modification prohibited',
  exclusivity_clash: 'Exclusivity clash',
  missing_agreement: 'Agreement missing',
  expired_agreement: 'Agreement expired',
  scope_exceeded: 'Usage beyond licensed scope',
}

async function listFlaggedAssets(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('rights_conflicts')
    .select('id, conflict_type, detected_at, asset:media_assets(id, file_name, thumbnail_path, asset_kind)')
    .eq('workspace_id', ctx.workspace.id)
    .is('resolved_at', null)
    .not('asset_id', 'is', null)
    .order('detected_at', { ascending: false })
    .limit(limit)
  type Row = { id: string; conflict_type: string; detected_at: string; asset: { id: string; file_name: string; thumbnail_path: string | null; asset_kind: string } | null }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
    asset_id: r.asset?.id ?? null,
    thumbnail_path: r.asset?.thumbnail_path ?? null,
    asset_kind: r.asset?.asset_kind ?? 'other',
    asset_name: r.asset?.file_name ?? 'Unknown asset',
    issue: CONFLICT_LABEL[r.conflict_type] ?? r.conflict_type,
    detected_at: r.detected_at,
  }))
}

async function assetInsights(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('media_assets').select('asset_kind')
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null)
  const rows = (data ?? []) as { asset_kind: string }[]
  const total = rows.length
  const groups: Record<string, string> = {
    image: 'Images', video: 'Videos', pdf: 'Documents', document: 'Documents',
    presentation: 'Documents', template: 'Templates', social: 'Images',
    packaging: 'Images', design: 'Images', audio: 'Others', archive: 'Others', other: 'Others',
  }
  const counts = tally(rows, r => groups[r.asset_kind] ?? 'Others')
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count, percent: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
}

// ===========================================================================
// RIGHTS  —  /{type}/brand/rights
// ===========================================================================

export const LICENSE_SELECT = `
  id, workspace_id, brand_id, asset_id, product_id, name, reference,
  license_type, licensor, licensee, status, starts_on, expires_on, renewal_due_on,
  usage_scope, exclusivity, modification_allowed, distribution_limit, risk_level,
  owner_id, notes, is_demo, created_at, updated_at,
  asset:media_assets(id, file_name, thumbnail_path, asset_kind),
  product:products(id, name, sku),
  owner:profiles!rights_licenses_owner_id_fkey(${PROFILE}),
  license_territories:rights_license_territories(territory:rights_territories(id, code, name, region, iso_codes)),
  license_channels:rights_license_channels(channel:rights_channels(id, code, name))
`

export function hydrateLicenses(rows: unknown[]): RightsLicenseRow[] {
  const now = new Date()
  type Raw = RightsLicenseRow & {
    license_territories?: { territory: RightsTerritory | null }[]
    license_channels?: { channel: RightsChannel | null }[]
  }
  return ((rows ?? []) as unknown as Raw[]).map(r => ({
    ...r,
    territories: (r.license_territories ?? []).map(t => t.territory).filter((t): t is RightsTerritory => Boolean(t)),
    channels: (r.license_channels ?? []).map(c => c.channel).filter((c): c is RightsChannel => Boolean(c)),
    days_remaining: r.expires_on ? daysBetween(now, new Date(r.expires_on)) : null,
  }))
}

/** Live licences, soonest expiry first — what needs attention next, not what already lapsed. */
async function listRecentLicenses(ctx: BrandContext, limit: number): Promise<RightsLicenseRow[]> {
  let q = ctx.supabase.from('rights_licenses').select(LICENSE_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .in('status', ['active', 'expiring_soon', 'renewal_pending'])
    .order('expires_on', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return hydrateLicenses(data ?? [])
}

export interface RightsPage {
  licenses: RightsLicenseRow[]
  total: number
  kpis: {
    activeLicenses: number; activeDelta: number; expiringSoon: number; expiringIn30: number
    restrictedAssets: number; restrictedAttention: number; regionsCovered: number; regionsNew: number
    pendingRenewals: number; renewalsNeedAction: number; complianceScore: number
  }
  expiring: RightsLicenseRow[]
  highRisk: { id: string; label: string; detail: string; severity: string; asset_id: string | null; license_id: string | null; thumbnail_path: string | null; asset_kind: string }[]
  coverage: { region: string; count: number; level: 'full' | 'partial' | 'limited' | 'none' }[]
  isoCoverage: Record<string, number>
  worldwide: number
  renewals: { id: string; license_id: string; name: string; due_on: string; status: string; expires_on: string | null }[]
  weekStart: string
  calendar: { id: string; name: string; date: string; kind: 'start' | 'expiry' | 'renewal'; status: string }[]
  owners: { id: string; full_name: string | null }[]
  products: { id: string; name: string }[]
  statusSummary: { status: string; count: number; percent: number }[]
  activity: BrandActivityItem[]
  territories: RightsTerritory[]
  channels: RightsChannel[]
}

export async function getRightsPage(ctx: BrandContext, f: RightsFilters): Promise<RightsPage> {
  const ws = ctx.workspace.id
  const { supabase } = ctx

  let q = supabase.from('rights_licenses').select(LICENSE_SELECT, { count: 'exact' })
    .eq('workspace_id', ws)
    .is('archived_at', null)

  if (f.brandId) q = q.eq('brand_id', f.brandId)
  else if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  if (f.status) q = q.eq('status', f.status)
  if (f.licenseType) q = q.eq('license_type', f.licenseType)
  if (f.productId) q = q.eq('product_id', f.productId)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.expiryFrom) q = q.gte('expires_on', f.expiryFrom)
  if (f.expiryTo) q = q.lte('expires_on', f.expiryTo)
  if (f.q) {
    const term = f.q.replace(/[%_]/g, m => `\\${m}`)
    q = q.or(`name.ilike.%${term}%,reference.ilike.%${term}%,licensor.ilike.%${term}%`)
  }
  // Territory/channel filters resolve through the join tables first.
  if (f.territory) {
    const { data } = await supabase.from('rights_license_territories')
      .select('license_id, territory:rights_territories!inner(code)')
      .eq('workspace_id', ws)
    const ids = ((data ?? []) as unknown as { license_id: string; territory: { code: string } | null }[])
      .filter(r => r.territory?.code === f.territory).map(r => r.license_id)
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }
  if (f.channel) {
    const { data } = await supabase.from('rights_license_channels')
      .select('license_id, channel:rights_channels!inner(code)')
      .eq('workspace_id', ws)
    const ids = ((data ?? []) as unknown as { license_id: string; channel: { code: string } | null }[])
      .filter(r => r.channel?.code === f.channel).map(r => r.license_id)
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  q = applyRightsSort(q, f.sort)
  const from = (f.page - 1) * f.pageSize
  q = q.range(from, from + f.pageSize - 1)

  // Week strip for Upcoming Renewals and the month grid for Calendar view, both anchored on ?anchor.
  const anchor = f.anchor && /^\d{4}-\d{2}-\d{2}$/.test(f.anchor) ? new Date(`${f.anchor}T00:00:00Z`) : new Date()
  const weekStart = new Date(anchor); weekStart.setUTCHours(0, 0, 0, 0)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))

  const [{ data, count }, kpis, expiring, highRisk, coverage, geo, renewals, statusSummary, activity, territories, channels, owners, products, calendar] =
    await Promise.all([
      q,
      rightsKpis(ctx),
      listExpiring(ctx, 4),
      listHighRisk(ctx, 4),
      rightsCoverage(ctx),
      isoCoverage(ctx),
      listRenewalsFrom(ctx, weekStart.toISOString().slice(0, 10), 3),
      rightsStatusSummary(ctx),
      listActivity(ctx, 5, ['license', 'agreement']),
      listTerritories(ctx),
      listChannels(ctx),
      listMembers(ctx),
      ctx.supabase.from('products').select('id, name').eq('workspace_id', ws).is('archived_at', null).order('name'),
      f.view === 'calendar' ? rightsCalendar(ctx, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)) : Promise.resolve([]),
    ])

  return signMedia(ctx, {
    licenses: hydrateLicenses(data ?? []),
    total: count ?? 0,
    kpis, expiring, highRisk, coverage, renewals, statusSummary, activity, territories, channels, owners, calendar,
    isoCoverage: geo.iso, worldwide: geo.worldwide,
    weekStart: weekStart.toISOString().slice(0, 10),
    products: (products.data ?? []) as { id: string; name: string }[],
  })
}

/** Per-country licence counts from the licence↔territory links; worldwide counted separately. */
async function isoCoverage(ctx: BrandContext): Promise<{ iso: Record<string, number>; worldwide: number }> {
  const { data } = await ctx.supabase.from('rights_license_territories')
    .select('license_id, territory:rights_territories(code, iso_codes), license:rights_licenses!inner(status, archived_at)')
    .eq('workspace_id', ctx.workspace.id)
  type Row = { license_id: string; territory: { code: string; iso_codes: string[] } | null; license: { status: string; archived_at: string | null } | null }
  const iso: Record<string, number> = {}
  const worldwide = new Set<string>()
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.territory || !r.license || r.license.archived_at || ['expired', 'cancelled', 'draft'].includes(r.license.status)) continue
    if (r.territory.code === 'worldwide') { worldwide.add(r.license_id); continue }
    for (const c of new Set(r.territory.iso_codes ?? [])) iso[c] = (iso[c] ?? 0) + 1
  }
  return { iso, worldwide: worldwide.size }
}

async function listRenewalsFrom(ctx: BrandContext, from: string, limit: number) {
  const { data } = await ctx.supabase.from('rights_renewals')
    .select('id, license_id, due_on, status, license:rights_licenses(name, expires_on)')
    .eq('workspace_id', ctx.workspace.id).in('status', ['pending', 'in_progress']).gte('due_on', from)
    .order('due_on', { ascending: true }).limit(limit)
  type Row = { id: string; license_id: string; due_on: string; status: string; license: { name: string; expires_on: string | null } | null }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id, license_id: r.license_id, name: r.license?.name ?? 'Licence', due_on: r.due_on, status: r.status, expires_on: r.license?.expires_on ?? null,
  }))
}

/** Start, expiry and renewal milestones that fall inside one month. */
async function rightsCalendar(ctx: BrandContext, from: string, to: string) {
  const { data } = await ctx.supabase.from('rights_licenses')
    .select('id, name, status, starts_on, expires_on, renewal_due_on')
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null)
    .or(`and(expires_on.gte.${from},expires_on.lte.${to}),and(starts_on.gte.${from},starts_on.lte.${to}),and(renewal_due_on.gte.${from},renewal_due_on.lte.${to})`)
  const out: RightsPage['calendar'] = []
  for (const l of (data ?? []) as { id: string; name: string; status: string; starts_on: string | null; expires_on: string | null; renewal_due_on: string | null }[]) {
    const inRange = (d: string | null) => d && d >= from && d <= to
    if (inRange(l.starts_on)) out.push({ id: l.id, name: l.name, date: l.starts_on!, kind: 'start', status: l.status })
    if (inRange(l.renewal_due_on)) out.push({ id: l.id, name: l.name, date: l.renewal_due_on!, kind: 'renewal', status: l.status })
    if (inRange(l.expires_on)) out.push({ id: l.id, name: l.name, date: l.expires_on!, kind: 'expiry', status: l.status })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Every licence matching the current filters, for CSV export (bounded). */
export async function exportRights(ctx: BrandContext, f: RightsFilters): Promise<RightsLicenseRow[]> {
  const rows: RightsLicenseRow[] = []
  for (let page = 1; page <= 50; page++) {
    const res = await getRightsPageRows(ctx, { ...f, page, pageSize: 100 })
    rows.push(...res.rows)
    if (res.rows.length < 100) break
  }
  return rows
}

async function getRightsPageRows(ctx: BrandContext, f: RightsFilters): Promise<{ rows: RightsLicenseRow[] }> {
  const ws = ctx.workspace.id
  let q = ctx.supabase.from('rights_licenses').select(LICENSE_SELECT).eq('workspace_id', ws).is('archived_at', null)
  if (f.brandId) q = q.eq('brand_id', f.brandId)
  if (f.status) q = q.eq('status', f.status)
  if (f.licenseType) q = q.eq('license_type', f.licenseType)
  if (f.productId) q = q.eq('product_id', f.productId)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.expiryFrom) q = q.gte('expires_on', f.expiryFrom)
  if (f.expiryTo) q = q.lte('expires_on', f.expiryTo)
  if (f.q) {
    const term = f.q.replace(/[%_,()]/g, m => `\\${m}`)
    q = q.or(`name.ilike.%${term}%,reference.ilike.%${term}%,licensor.ilike.%${term}%`)
  }
  q = applyRightsSort(q, f.sort)
  const from = (f.page - 1) * f.pageSize
  const { data } = await q.range(from, from + f.pageSize - 1)
  let rows = hydrateLicenses(data ?? [])
  if (f.territory) rows = rows.filter(r => r.territories.some(t => t.code === f.territory))
  if (f.channel) rows = rows.filter(r => r.channels.some(c => c.code === f.channel))
  return { rows }
}

function applyRightsSort<T extends { order: (c: string, o?: { ascending: boolean; nullsFirst?: boolean }) => T }>(q: T, sort: string): T {
  switch (sort) {
    case 'expiry_desc': return q.order('expires_on', { ascending: false, nullsFirst: false })
    case 'name_asc': return q.order('name', { ascending: true })
    case 'status': return q.order('status', { ascending: true })
    case 'created_desc': return q.order('created_at', { ascending: false })
    default: return q.order('expires_on', { ascending: true, nullsFirst: false })
  }
}

async function rightsKpis(ctx: BrandContext) {
  const ws = ctx.workspace.id
  const { supabase } = ctx
  const today = new Date().toISOString().slice(0, 10)
  const in30 = isoDaysFromNow(30)
  const in90 = isoDaysFromNow(90)
  const month = startOfMonthIso(0)
  const [activeLicenses, activeDelta, expiringSoon, expiringIn30, restrictedAssets, restrictedAttention,
    pendingRenewals, renewalsNeedAction, total, conflicts, terr] = await Promise.all([
    countOf(supabase, 'rights_licenses', ws, q => q.eq('status', 'active').is('archived_at', null)),
    countOf(supabase, 'rights_licenses', ws, q => q.eq('status', 'active').gte('created_at', month)),
    countOf(supabase, 'rights_licenses', ws, q => q.gte('expires_on', today).lte('expires_on', in90).is('archived_at', null)),
    countOf(supabase, 'rights_licenses', ws, q => q.gte('expires_on', today).lte('expires_on', in30).is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.in('rights_state', ['restricted', 'expired']).is('archived_at', null)),
    countOf(supabase, 'rights_conflicts', ws, q => q.is('resolved_at', null).eq('severity', 'high')),
    countOf(supabase, 'rights_renewals', ws, q => q.in('status', ['pending', 'in_progress'])),
    countOf(supabase, 'rights_renewals', ws, q => q.in('status', ['pending', 'in_progress']).lte('due_on', in30)),
    countOf(supabase, 'rights_licenses', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'rights_conflicts', ws, q => q.is('resolved_at', null)),
    supabase.from('rights_license_territories')
      .select('territory:rights_territories(iso_codes), license:rights_licenses!inner(created_at, status)').eq('workspace_id', ws),
  ])
  const isoSet = new Set<string>(), newSet = new Set<string>()
  for (const row of (terr.data ?? []) as unknown as { territory: { iso_codes: string[] } | null; license: { created_at: string; status: string } | null }[]) {
    if (!row.license || ['expired', 'cancelled'].includes(row.license.status)) continue
    for (const c of row.territory?.iso_codes ?? []) { isoSet.add(c); if (row.license.created_at >= month) newSet.add(c) }
  }
  const complianceScore = total === 0 ? 100 : Math.max(0, Math.round(((total - conflicts) / total) * 100))
  return {
    activeLicenses, activeDelta, expiringSoon, expiringIn30, restrictedAssets, restrictedAttention,
    regionsCovered: isoSet.size, regionsNew: newSet.size, pendingRenewals, renewalsNeedAction, complianceScore,
  }
}

async function listExpiring(ctx: BrandContext, limit: number): Promise<RightsLicenseRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const in90 = isoDaysFromNow(90)
  const { data } = await ctx.supabase.from('rights_licenses').select(LICENSE_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .gte('expires_on', today).lte('expires_on', in90)
    .is('archived_at', null)
    .order('expires_on', { ascending: true })
    .limit(limit)
  return hydrateLicenses(data ?? [])
}

async function listHighRisk(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('rights_conflicts')
    .select('id, conflict_type, severity, detail, asset_id, license_id, asset:media_assets(file_name, thumbnail_path, asset_kind), license:rights_licenses(name)')
    .eq('workspace_id', ctx.workspace.id)
    .is('resolved_at', null)
    .order('severity', { ascending: true })
    .order('detected_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; conflict_type: string; severity: string; detail: string | null; asset_id: string | null; license_id: string | null
    asset: { file_name: string; thumbnail_path: string | null; asset_kind: string } | null; license: { name: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
    asset_id: r.asset_id, license_id: r.license_id,
    thumbnail_path: r.asset?.thumbnail_path ?? null, asset_kind: r.asset?.asset_kind ?? 'image',
    label: r.asset?.file_name ?? r.license?.name ?? 'Unknown record',
    detail: r.detail ?? CONFLICT_LABEL[r.conflict_type] ?? r.conflict_type,
    severity: r.severity,
  }))
}

/** Coverage is computed from actual licence↔territory links, never hardcoded. */
async function rightsCoverage(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('rights_license_territories')
    .select('license_id, territory:rights_territories(name, region)')
    .eq('workspace_id', ctx.workspace.id)
  type Row = { license_id: string; territory: { name: string; region: string | null } | null }
  const counts = tally((data ?? []) as unknown as Row[], r => r.territory?.name ?? null)
  return [...counts.entries()]
    .map(([region, count]) => ({
      region,
      count,
      level: (count >= 35 ? 'full' : count >= 10 ? 'partial' : count >= 1 ? 'limited' : 'none') as 'full' | 'partial' | 'limited' | 'none',
    }))
    .sort((a, b) => b.count - a.count)
}

async function listRenewals(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('rights_renewals')
    .select('id, due_on, status, license:rights_licenses(name)')
    .eq('workspace_id', ctx.workspace.id)
    .in('status', ['pending', 'in_progress'])
    .order('due_on', { ascending: true })
    .limit(limit)
  type Row = { id: string; due_on: string; status: string; license: { name: string } | null }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id, name: r.license?.name ?? 'Licence', due_on: r.due_on, status: r.status,
  }))
}

async function rightsStatusSummary(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('rights_licenses').select('status')
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null)
  const rows = (data ?? []) as { status: string }[]
  const total = rows.length
  const counts = tally(rows, r => r.status)
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count, percent: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
}

export async function listTerritories(ctx: BrandContext): Promise<RightsTerritory[]> {
  const { data } = await ctx.supabase
    .from('rights_territories').select('id, code, name, region, iso_codes')
    .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspace.id}`)
    .order('name')
  return (data ?? []) as RightsTerritory[]
}

export async function listChannels(ctx: BrandContext): Promise<RightsChannel[]> {
  const { data } = await ctx.supabase
    .from('rights_channels').select('id, code, name')
    .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspace.id}`)
    .order('name')
  return (data ?? []) as RightsChannel[]
}

// ===========================================================================
// PRODUCTS  —  /{type}/brand/products
// ===========================================================================

export const PRODUCT_SELECT = `
  id, workspace_id, brand_id, category_id, collection_id, name, sku, description,
  product_line, status, primary_asset_id, readiness_score, readiness_state,
  owner_id, is_favourite, is_demo, created_at, updated_at,
  brand:brands(${BRAND}),
  owner:profiles!products_owner_id_fkey(${PROFILE}),
  category:product_categories(name),
  primary_asset:media_assets!products_primary_asset_id_fkey(id, file_name, thumbnail_path, file_url),
  product_markets(market_code)
`

export async function hydrateProducts(ctx: BrandContext, rows: unknown[]): Promise<ProductCard[]> {
  type Raw = ProductCard & {
    category: { name: string } | null
    product_markets?: { market_code: string }[]
  }
  const products = (rows ?? []) as unknown as Raw[]
  if (products.length === 0) return []

  const ids = products.map(p => p.id)
  const { data: links } = await ctx.supabase
    .from('product_assets').select('product_id')
    .eq('workspace_id', ctx.workspace.id).in('product_id', ids)
  const counts = tally((links ?? []) as { product_id: string }[], r => r.product_id)

  return products.map(p => ({
    ...p,
    category_name: p.category?.name ?? null,
    markets: (p.product_markets ?? []).map(m => m.market_code),
    linked_asset_count: counts.get(p.id) ?? 0,
  }))
}

/** Overview preview: the most campaign-ready products first. */
async function listRecentProducts(ctx: BrandContext, limit: number): Promise<ProductCard[]> {
  let q = ctx.supabase.from('products').select(PRODUCT_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    // Same order as the Product Library's default "Recently Updated", so the
    // Overview preview is the head of that list.
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return hydrateProducts(ctx, data ?? [])
}

export interface ProductsPage {
  products: ProductCard[]
  total: number
  kpis: {
    products: number; productsDelta: number; activeSkus: number; activeSkusDelta: number; draftProducts: number; draftDelta: number
    linkedAssets: number; linkedDelta: number; campaignReady: number; missingAssets: number; missingDelta: number
  }
  missingBreakdown: { key: string; label: string; count: number }[]
  readiness: { ready: number; review: number; notReady: number; percent: number }
  flagged: { id: string; name: string; sku: string; issue: string; status: string; updated_at: string; thumbnail_path: string | null; owner: { full_name: string | null; avatar_url: string | null } | null }[]
  recentUpdates: (BrandActivityItem & { thumbnail_path: string | null; product_name: string | null })[]
  owners: { id: string; full_name: string | null }[]
  markets: string[]
  linkable: { id: string; file_name: string; thumbnail_path: string | null; asset_kind: string; rights_state: string }[]
  topCategories: { name: string; count: number }[]
  categories: { id: string; name: string }[]
  collections: { id: string; name: string }[]
}

export async function getProductsPage(ctx: BrandContext, f: ProductFilters): Promise<ProductsPage> {
  const ws = ctx.workspace.id
  const { supabase } = ctx

  let q = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' })
    .eq('workspace_id', ws)
    .is('archived_at', null)

  if (f.brandId) q = q.eq('brand_id', f.brandId)
  else if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  if (f.categoryId) q = q.eq('category_id', f.categoryId)
  if (f.collectionId) q = q.eq('collection_id', f.collectionId)
  if (f.status) q = q.eq('status', f.status)
  if (f.readiness) q = q.eq('readiness_state', f.readiness)
  if (f.ownerId) q = q.eq('owner_id', f.ownerId)
  if (f.productLine) q = q.eq('product_line', f.productLine)
  if (f.q) {
    const term = f.q.replace(/[%_]/g, m => `\\${m}`)
    q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (f.market) {
    const { data } = await supabase.from('product_markets')
      .select('product_id').eq('workspace_id', ws).eq('market_code', f.market)
    const ids = ((data ?? []) as { product_id: string }[]).map(r => r.product_id)
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }
  if (f.missingAsset) {
    const { data } = await supabase.from('product_readiness_checks')
      .select('product_id').eq('workspace_id', ws).eq('check_key', f.missingAsset).eq('passed', false)
    const ids = ((data ?? []) as { product_id: string }[]).map(r => r.product_id)
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  q = applyProductSort(q, f.sort)
  const from = (f.page - 1) * f.pageSize
  q = q.range(from, from + f.pageSize - 1)

  const [{ data, count }, kpis, missingBreakdown, readiness, flagged, activity, topCategories, categories, collections, owners, marketRows, linkable] =
    await Promise.all([
      q,
      productKpis(ctx),
      missingAssetBreakdown(ctx),
      readinessSummary(ctx),
      listFlaggedProducts(ctx, 4),
      listActivity(ctx, 5, ['product']),
      topCategoriesOf(ctx),
      listCategories(ctx),
      listProductCollections(ctx),
      listMembers(ctx),
      supabase.from('product_markets').select('market_code').eq('workspace_id', ws),
      supabase.from('media_assets').select('id, file_name, thumbnail_path, asset_kind, rights_state').eq('workspace_id', ws)
        .eq('approval_status', 'approved').is('archived_at', null).order('updated_at', { ascending: false }).limit(80),
    ])

  // Product thumbnails for the update feed, in one query rather than per row.
  const ids = [...new Set(activity.map(a => a.entity_id).filter((x): x is string => !!x))]
  const { data: prodThumbs } = ids.length
    ? await supabase.from('products').select('id, name, primary_asset:media_assets!products_primary_asset_id_fkey(thumbnail_path)').eq('workspace_id', ws).in('id', ids)
    : { data: [] }
  type PT = { id: string; name: string; primary_asset: { thumbnail_path: string | null } | { thumbnail_path: string | null }[] | null }
  const thumbBy = new Map(((prodThumbs ?? []) as PT[]).map(p => [p.id, { name: p.name, thumb: (Array.isArray(p.primary_asset) ? p.primary_asset[0] : p.primary_asset)?.thumbnail_path ?? null }]))
  const recentUpdates = activity.map(a => ({ ...a, thumbnail_path: a.entity_id ? thumbBy.get(a.entity_id)?.thumb ?? null : null, product_name: a.entity_id ? thumbBy.get(a.entity_id)?.name ?? null : null }))

  return signMedia(ctx, {
    products: await hydrateProducts(ctx, data ?? []),
    total: count ?? 0,
    kpis, missingBreakdown, readiness, flagged, recentUpdates, topCategories, categories, collections, owners,
    markets: [...new Set(((marketRows.data ?? []) as { market_code: string }[]).map(m => m.market_code))].sort(),
    linkable: (linkable.data ?? []) as ProductsPage['linkable'],
  })
}

function applyProductSort<T extends { order: (c: string, o?: { ascending: boolean }) => T }>(q: T, sort: string): T {
  switch (sort) {
    case 'name_asc': return q.order('name', { ascending: true })
    case 'name_desc': return q.order('name', { ascending: false })
    case 'sku_asc': return q.order('sku', { ascending: true })
    case 'readiness_desc': return q.order('readiness_score', { ascending: false })
    case 'readiness_asc': return q.order('readiness_score', { ascending: true })
    case 'created_desc': return q.order('created_at', { ascending: false })
    default: return q.order('updated_at', { ascending: false })
  }
}

async function productKpis(ctx: BrandContext) {
  const ws = ctx.workspace.id
  const { supabase } = ctx
  const month = startOfMonthIso(0)
  const [products, productsDelta, activeSkus, activeSkusDelta, draftProducts, draftDelta, linkedAssets, linkedDelta, ready, missing, missingDelta] = await Promise.all([
    countOf(supabase, 'products', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'products', ws, q => q.gte('created_at', month)),
    countOf(supabase, 'product_variants', ws, q => q.eq('status', 'active')),
    countOf(supabase, 'product_variants', ws, q => q.eq('status', 'active').gte('created_at', month)),
    countOf(supabase, 'products', ws, q => q.eq('status', 'draft').is('archived_at', null)),
    countOf(supabase, 'products', ws, q => q.eq('status', 'draft').gte('created_at', month)),
    countOf(supabase, 'product_assets', ws),
    countOf(supabase, 'product_assets', ws, q => q.gte('created_at', month)),
    countOf(supabase, 'products', ws, q => q.eq('readiness_state', 'ready').is('archived_at', null)),
    countOf(supabase, 'product_readiness_checks', ws, q => q.eq('passed', false)),
    countOf(supabase, 'product_readiness_checks', ws, q => q.eq('passed', false).gte('evaluated_at', month)),
  ])
  return {
    products, productsDelta, activeSkus, activeSkusDelta, draftProducts, draftDelta, linkedAssets, linkedDelta,
    missingAssets: missing, missingDelta, campaignReady: products ? Math.round((ready / products) * 100) : 0,
  }
}

export const READINESS_LABEL: Record<string, string> = {
  primary_image: 'Missing Primary Image',
  lifestyle_image: 'Missing Lifestyle Image',
  packshot: 'Missing Packshot',
  product_video: 'Missing 360° / Video',
  description: 'Missing Description',
  localisation: 'Missing Localisation',
  brand_compliance: 'Brand guideline mismatch',
  rights_coverage: 'Missing rights coverage',
  required_metadata: 'Missing metadata',
  approved_assets: 'Unapproved assets',
  market_data: 'Missing market data',
}

async function missingAssetBreakdown(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('product_readiness_checks').select('check_key')
    .eq('workspace_id', ctx.workspace.id).eq('passed', false)
  const counts = tally((data ?? []) as { check_key: string }[], r => r.check_key)
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: READINESS_LABEL[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

async function readinessSummary(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('products').select('readiness_state')
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null)
  const rows = (data ?? []) as { readiness_state: string }[]
  const counts = tally(rows, r => r.readiness_state)
  const ready = counts.get('ready') ?? 0
  const review = counts.get('review') ?? 0
  const notReady = counts.get('not_ready') ?? 0
  const total = rows.length
  return { ready, review, notReady, percent: total ? Math.round((ready / total) * 100) : 0 }
}

async function listFlaggedProducts(ctx: BrandContext, limit: number) {
  const { data } = await ctx.supabase
    .from('products')
    .select(`id, name, sku, status, readiness_state, updated_at, owner:profiles!products_owner_id_fkey(${PROFILE}), primary_asset:media_assets!products_primary_asset_id_fkey(thumbnail_path), product_readiness_checks(check_key, passed)`)
    .eq('workspace_id', ctx.workspace.id)
    .neq('readiness_state', 'ready')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; name: string; sku: string; status: string; readiness_state: string; updated_at: string
    owner: { full_name: string | null; avatar_url: string | null } | null
    primary_asset: { thumbnail_path: string | null } | null
    product_readiness_checks: { check_key: string; passed: boolean }[]
  }
  return ((data ?? []) as unknown as Row[]).map(r => {
    const failed = r.product_readiness_checks?.filter(c => !c.passed) ?? []
    return {
      id: r.id, name: r.name, sku: r.sku, thumbnail_path: r.primary_asset?.thumbnail_path ?? null,
      issue: failed.length ? (READINESS_LABEL[failed[0].check_key] ?? failed[0].check_key) : 'Review required',
      status: r.readiness_state === 'not_ready' ? 'Not Ready' : 'Review',
      updated_at: r.updated_at,
      owner: r.owner,
    }
  })
}

async function topCategoriesOf(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('products').select('category:product_categories(name)')
    .eq('workspace_id', ctx.workspace.id).is('archived_at', null)
  type Row = { category: { name: string } | null }
  const counts = tally((data ?? []) as unknown as Row[], r => r.category?.name ?? null)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export async function listCategories(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('product_categories').select('id, name')
    .eq('workspace_id', ctx.workspace.id).order('name')
  return (data ?? []) as { id: string; name: string }[]
}

async function listProductCollections(ctx: BrandContext) {
  const { data } = await ctx.supabase
    .from('product_collections').select('id, name')
    .eq('workspace_id', ctx.workspace.id).order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ===========================================================================
// SHARED — activity and alerts
// ===========================================================================

export async function listActivity(
  ctx: BrandContext,
  limit: number,
  entityTypes?: string[],
): Promise<BrandActivityItem[]> {
  let q = ctx.supabase
    .from('brand_activity')
    .select(`id, workspace_id, entity_type, entity_id, action, summary, href, metadata, created_at, actor:profiles!brand_activity_actor_id_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (entityTypes?.length) q = q.in('entity_type', entityTypes)
  const { data } = await q
  return (data ?? []) as unknown as BrandActivityItem[]
}

export async function listAlerts(ctx: BrandContext, limit: number): Promise<BrandAlert[]> {
  const { data } = await ctx.supabase
    .from('brand_alerts')
    .select('id, workspace_id, alert_type, severity, title, body, href, resolved_at, created_at')
    .eq('workspace_id', ctx.workspace.id)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as BrandAlert[]
}
