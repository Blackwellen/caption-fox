// Server queries for the Brand & Assets module.
//
// Every query is scoped to ctx.workspace.id in addition to RLS — defence in
// depth, and it keeps the planner on the workspace indexes. Independent reads
// are issued with Promise.all so a dashboard is one round of parallel queries
// rather than a waterfall.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BrandContext } from './context'
import type { AssetFilters, KitFilters, ProductFilters, RightsFilters } from './filters'
import type {
  BrandActivityItem, BrandAlert, BrandAssetCard, BrandKitCard, ProductCard,
  RightsChannel, RightsLicenseRow, RightsTerritory, AssetFolder, AssetCollection,
} from '@/types/brand-assets'

const PROFILE = 'id, full_name, avatar_url'
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
async function countOf(
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

export async function getOverviewData(ctx: BrandContext): Promise<OverviewData> {
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
    listBrandKits(ctx, 5),
    listRecentAssets(ctx, 6),
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
  return {
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
  }
}

// ===========================================================================
// BRAND KITS  —  /{type}/brand/kits
// ===========================================================================

const KIT_SELECT = `
  id, workspace_id, brand_id, name, description, status, approval_status,
  logo_asset_id, team_name, consistency_score, current_version, published_version,
  owner_id, is_demo, created_at, updated_at,
  brand:brands(${BRAND}),
  owner:profiles!brand_kits_owner_id_fkey(${PROFILE}),
  colours:brand_kit_colours(id, name, hex, role, usage_notes, sort_order),
  typography:brand_kit_typography(id, style_name, font_family, font_weight, font_size_px, line_height_px, letter_spacing, sort_order)
`

async function hydrateKits(ctx: BrandContext, rows: unknown[]): Promise<BrandKitCard[]> {
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

export interface KitsPage {
  kits: BrandKitCard[]
  total: number
  kpis: { totalKits: number; activeBrands: number; templates: number; pendingApprovals: number; linkedAssets: number; consistencyScore: number }
  recentUpdates: BrandActivityItem[]
  approvalQueue: { id: string; name: string; status: string; updated_at: string; owner: { full_name: string | null; avatar_url: string | null } | null }[]
  comments: { id: string; body: string; created_at: string; author: { full_name: string | null; avatar_url: string | null } | null }[]
  teams: string[]
}

export async function getKitsPage(ctx: BrandContext, f: KitFilters): Promise<KitsPage> {
  const ws = ctx.workspace.id
  const { supabase } = ctx

  let q = supabase.from('brand_kits').select(KIT_SELECT, { count: 'exact' })
    .eq('workspace_id', ws)
    .is('archived_at', null)

  if (f.brandId) q = q.eq('brand_id', f.brandId)
  else if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
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

  const [{ data, count }, kpis, recentUpdates, approvalQueue, comments, teams] = await Promise.all([
    q,
    kitKpis(ctx),
    listActivity(ctx, 5, ['brand_kit']),
    listKitApprovalQueue(ctx, 5),
    listKitComments(ctx, 3),
    listKitTeams(ctx),
  ])

  return {
    kits: await hydrateKits(ctx, data ?? []),
    total: count ?? 0,
    kpis, recentUpdates, approvalQueue, comments, teams,
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
  const [totalKits, activeBrands, templates, pendingApprovals, linkedAssets, scoreRows] = await Promise.all([
    countOf(supabase, 'brand_kits', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'brands', ws, q => q.eq('status', 'active').is('archived_at', null)),
    countOf(supabase, 'brand_kit_templates', ws),
    countOf(supabase, 'brand_kits', ws, q => q.eq('approval_status', 'pending')),
    countOf(supabase, 'media_assets', ws, q => q.not('brand_kit_id', 'is', null)),
    supabase.from('brand_kits').select('consistency_score').eq('workspace_id', ws).not('consistency_score', 'is', null),
  ])
  const scores = ((scoreRows.data ?? []) as { consistency_score: number }[]).map(r => Number(r.consistency_score))
  const consistencyScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0
  return { totalKits, activeBrands, templates, pendingApprovals, linkedAssets, consistencyScore }
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
    .select(`id, body, created_at, author:profiles!brand_kit_comments_author_id_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as { id: string; body: string; created_at: string; author: { full_name: string | null; avatar_url: string | null } | null }[]
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

const ASSET_SELECT = `
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

async function listRecentAssets(ctx: BrandContext, limit: number): Promise<BrandAssetCard[]> {
  let q = ctx.supabase.from('media_assets').select(ASSET_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return (data ?? []) as unknown as BrandAssetCard[]
}

export interface AssetsPage {
  assets: BrandAssetCard[]
  total: number
  kpis: { total: number; approved: number; inReview: number; expiringSoon: number; storageUsed: number; storageQuota: number; downloadRequests: number }
  folders: AssetFolder[]
  collections: AssetCollection[]
  recentlyUsed: BrandAssetCard[]
  recentUploads: BrandAssetCard[]
  approvalQueue: { id: string; asset_name: string; priority: string; created_at: string; brand: string | null; requester: { full_name: string | null; avatar_url: string | null } | null }[]
  flagged: { id: string; asset_name: string; issue: string; detected_at: string }[]
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

  const [{ data, count }, kpis, folders, collections, recentlyUsed, recentUploads, approvalQueue, flagged, insights] =
    await Promise.all([
      q,
      assetKpis(ctx),
      listFolders(ctx),
      listCollections(ctx),
      listRecentAssets(ctx, 5),
      listRecentAssets(ctx, 5),
      listAssetApprovalQueue(ctx, 5),
      listFlaggedAssets(ctx, 6),
      assetInsights(ctx),
    ])

  return {
    assets: (data ?? []) as unknown as BrandAssetCard[],
    total: count ?? 0,
    kpis, folders, collections, recentlyUsed, recentUploads, approvalQueue, flagged, insights,
  }
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
  const [total, approved, inReview, expiringSoon, downloadRequests] = await Promise.all([
    countOf(supabase, 'media_assets', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.eq('approval_status', 'approved').is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.eq('approval_status', 'pending').is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.not('expires_at', 'is', null).lte('expires_at', in30)),
    countOf(supabase, 'asset_downloads', ws),
  ])
  return {
    total, approved, inReview, expiringSoon, downloadRequests,
    storageUsed: ctx.storage.bytes_used,
    storageQuota: ctx.storage.bytes_quota,
  }
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
    .select(`id, priority, created_at, asset:media_assets(id, file_name, brand:brands(name)), requester:profiles!asset_approvals_requested_by_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; priority: string; created_at: string
    asset: { file_name: string; brand: { name: string } | null } | null
    requester: { full_name: string | null; avatar_url: string | null } | null
  }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
    asset_name: r.asset?.file_name ?? 'Unknown asset',
    priority: r.priority,
    created_at: r.created_at,
    brand: r.asset?.brand?.name ?? null,
    requester: r.requester,
  }))
}

const CONFLICT_LABEL: Record<string, string> = {
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
    .select('id, conflict_type, detected_at, asset:media_assets(file_name)')
    .eq('workspace_id', ctx.workspace.id)
    .is('resolved_at', null)
    .not('asset_id', 'is', null)
    .order('detected_at', { ascending: false })
    .limit(limit)
  type Row = { id: string; conflict_type: string; detected_at: string; asset: { file_name: string } | null }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
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

const LICENSE_SELECT = `
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

function hydrateLicenses(rows: unknown[]): RightsLicenseRow[] {
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

async function listRecentLicenses(ctx: BrandContext, limit: number): Promise<RightsLicenseRow[]> {
  let q = ctx.supabase.from('rights_licenses').select(LICENSE_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .order('expires_on', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return hydrateLicenses(data ?? [])
}

export interface RightsPage {
  licenses: RightsLicenseRow[]
  total: number
  kpis: { activeLicenses: number; expiringSoon: number; restrictedAssets: number; regionsCovered: number; pendingRenewals: number; complianceScore: number }
  expiring: RightsLicenseRow[]
  highRisk: { id: string; label: string; detail: string; severity: string }[]
  coverage: { region: string; count: number; level: 'full' | 'partial' | 'limited' | 'none' }[]
  renewals: { id: string; name: string; due_on: string; status: string }[]
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

  const [{ data, count }, kpis, expiring, highRisk, coverage, renewals, statusSummary, activity, territories, channels] =
    await Promise.all([
      q,
      rightsKpis(ctx),
      listExpiring(ctx, 4),
      listHighRisk(ctx, 4),
      rightsCoverage(ctx),
      listRenewals(ctx, 5),
      rightsStatusSummary(ctx),
      listActivity(ctx, 5, ['license', 'agreement']),
      listTerritories(ctx),
      listChannels(ctx),
    ])

  return {
    licenses: hydrateLicenses(data ?? []),
    total: count ?? 0,
    kpis, expiring, highRisk, coverage, renewals, statusSummary, activity, territories, channels,
  }
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
  const [activeLicenses, expiringSoon, restrictedAssets, pendingRenewals, total, conflicts, terr] = await Promise.all([
    countOf(supabase, 'rights_licenses', ws, q => q.eq('status', 'active').is('archived_at', null)),
    countOf(supabase, 'rights_licenses', ws, q => q.gte('expires_on', today).lte('expires_on', in30).is('archived_at', null)),
    countOf(supabase, 'media_assets', ws, q => q.eq('rights_state', 'restricted').is('archived_at', null)),
    countOf(supabase, 'rights_renewals', ws, q => q.in('status', ['pending', 'in_progress'])),
    countOf(supabase, 'rights_licenses', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'rights_conflicts', ws, q => q.is('resolved_at', null)),
    supabase.from('rights_license_territories')
      .select('territory:rights_territories(iso_codes)').eq('workspace_id', ws),
  ])
  const isoSet = new Set<string>()
  for (const row of (terr.data ?? []) as unknown as { territory: { iso_codes: string[] } | null }[]) {
    for (const c of row.territory?.iso_codes ?? []) isoSet.add(c)
  }
  const complianceScore = total === 0 ? 100 : Math.max(0, Math.round(((total - conflicts) / total) * 100))
  return { activeLicenses, expiringSoon, restrictedAssets, regionsCovered: isoSet.size, pendingRenewals, complianceScore }
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
    .select('id, conflict_type, severity, detail, asset:media_assets(file_name), license:rights_licenses(name)')
    .eq('workspace_id', ctx.workspace.id)
    .is('resolved_at', null)
    .order('severity', { ascending: false })
    .order('detected_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; conflict_type: string; severity: string; detail: string | null
    asset: { file_name: string } | null; license: { name: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map(r => ({
    id: r.id,
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

async function listTerritories(ctx: BrandContext): Promise<RightsTerritory[]> {
  const { data } = await ctx.supabase
    .from('rights_territories').select('id, code, name, region, iso_codes')
    .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspace.id}`)
    .order('name')
  return (data ?? []) as RightsTerritory[]
}

async function listChannels(ctx: BrandContext): Promise<RightsChannel[]> {
  const { data } = await ctx.supabase
    .from('rights_channels').select('id, code, name')
    .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspace.id}`)
    .order('name')
  return (data ?? []) as RightsChannel[]
}

// ===========================================================================
// PRODUCTS  —  /{type}/brand/products
// ===========================================================================

const PRODUCT_SELECT = `
  id, workspace_id, brand_id, category_id, collection_id, name, sku, description,
  product_line, status, primary_asset_id, readiness_score, readiness_state,
  owner_id, is_favourite, is_demo, created_at, updated_at,
  brand:brands(${BRAND}),
  owner:profiles!products_owner_id_fkey(${PROFILE}),
  category:product_categories(name),
  primary_asset:media_assets!products_primary_asset_id_fkey(id, file_name, thumbnail_path, file_url),
  product_markets(market_code)
`

async function hydrateProducts(ctx: BrandContext, rows: unknown[]): Promise<ProductCard[]> {
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

async function listRecentProducts(ctx: BrandContext, limit: number): Promise<ProductCard[]> {
  let q = ctx.supabase.from('products').select(PRODUCT_SELECT)
    .eq('workspace_id', ctx.workspace.id)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (ctx.activeBrand) q = q.eq('brand_id', ctx.activeBrand.id)
  const { data } = await q
  return hydrateProducts(ctx, data ?? [])
}

export interface ProductsPage {
  products: ProductCard[]
  total: number
  kpis: { products: number; activeSkus: number; draftProducts: number; linkedAssets: number; campaignReady: number; missingAssets: number }
  missingBreakdown: { key: string; label: string; count: number }[]
  readiness: { ready: number; review: number; notReady: number; percent: number }
  flagged: { id: string; name: string; sku: string; issue: string; status: string; updated_at: string; owner: { full_name: string | null; avatar_url: string | null } | null }[]
  recentUpdates: BrandActivityItem[]
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

  const [{ data, count }, kpis, missingBreakdown, readiness, flagged, recentUpdates, topCategories, categories, collections] =
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
    ])

  return {
    products: await hydrateProducts(ctx, data ?? []),
    total: count ?? 0,
    kpis, missingBreakdown, readiness, flagged, recentUpdates, topCategories, categories, collections,
  }
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
  const [products, activeSkus, draftProducts, linkedAssets, ready, missing] = await Promise.all([
    countOf(supabase, 'products', ws, q => q.is('archived_at', null)),
    countOf(supabase, 'product_variants', ws, q => q.eq('status', 'active')),
    countOf(supabase, 'products', ws, q => q.eq('status', 'draft').is('archived_at', null)),
    countOf(supabase, 'product_assets', ws),
    countOf(supabase, 'products', ws, q => q.eq('readiness_state', 'ready').is('archived_at', null)),
    countOf(supabase, 'product_readiness_checks', ws, q => q.eq('passed', false)),
  ])
  return {
    products, activeSkus, draftProducts, linkedAssets, missingAssets: missing,
    campaignReady: products ? Math.round((ready / products) * 100) : 0,
  }
}

const READINESS_LABEL: Record<string, string> = {
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
    .select(`id, name, sku, status, readiness_state, updated_at, owner:profiles!products_owner_id_fkey(${PROFILE}), product_readiness_checks(check_key, passed)`)
    .eq('workspace_id', ctx.workspace.id)
    .neq('readiness_state', 'ready')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)
  type Row = {
    id: string; name: string; sku: string; status: string; readiness_state: string; updated_at: string
    owner: { full_name: string | null; avatar_url: string | null } | null
    product_readiness_checks: { check_key: string; passed: boolean }[]
  }
  return ((data ?? []) as unknown as Row[]).map(r => {
    const failed = r.product_readiness_checks?.filter(c => !c.passed) ?? []
    return {
      id: r.id, name: r.name, sku: r.sku,
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

async function listCategories(ctx: BrandContext) {
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
    .select(`id, workspace_id, entity_type, entity_id, action, summary, href, created_at, actor:profiles!brand_activity_actor_id_fkey(${PROFILE})`)
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
