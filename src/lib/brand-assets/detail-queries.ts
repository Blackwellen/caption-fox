// Detail-page queries for the Brand & Assets module: one record plus its
// related records, always scoped to ctx.workspace.id. A foreign, malformed or
// missing id returns null so the route renders a not-found state rather than
// leaking whether the record exists in another workspace.

import type { BrandContext } from './context'
import {
  ASSET_SELECT, CONFLICT_LABEL, KIT_SELECT, LICENSE_SELECT, PRODUCT_SELECT, PROFILE, READINESS_LABEL,
  countOf, hydrateKits, hydrateLicenses, hydrateProducts, listCategories, listChannels, listTerritories,
  loadKitSystem, signMedia, type KitSystem, type ProductsPage,
} from './queries'
import type {
  BrandActivityItem, BrandAssetCard, ProductCard, RightsChannel, RightsLicenseRow, RightsTerritory,
} from '@/types/brand-assets'

/** Readiness check names as shown on the product page (the list page uses "Missing …" phrasing). */
const CHECK_LABEL: Record<string, string> = {
  primary_image: 'Primary image', packshot: 'Packshot', lifestyle_image: 'Lifestyle image', product_video: 'Product video or 360°',
  description: 'Description (20+ characters)', required_metadata: 'Category and metadata', market_data: 'Market data',
  localisation: 'Localised for non-US markets', approved_assets: 'All linked assets approved', rights_coverage: 'Rights coverage',
  brand_compliance: 'Brand guideline compliance',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: string | undefined): v is string => !!v && UUID.test(v)

async function entityActivity(ctx: BrandContext, entityId: string, limit = 20): Promise<BrandActivityItem[]> {
  const { data } = await ctx.supabase.from('brand_activity')
    .select(`id, workspace_id, entity_type, entity_id, action, summary, href, metadata, created_at, actor:profiles!brand_activity_actor_id_fkey(${PROFILE})`)
    .eq('workspace_id', ctx.workspace.id).eq('entity_id', entityId).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as BrandActivityItem[]
}

// ---------------------------------------------------------------------------
export interface KitDetail {
  system: KitSystem
  versions: { id: string; version: number; change_summary: string | null; status: string; published_at: string | null; created_at: string }[]
  comments: { id: string; body: string; created_at: string; author: { full_name: string | null; avatar_url: string | null } | null }[]
  activity: BrandActivityItem[]
}

export async function getKitDetail(ctx: BrandContext, id: string): Promise<KitDetail | null> {
  if (!isUuid(id)) return null
  const { data } = await ctx.supabase.from('brand_kits').select(KIT_SELECT).eq('workspace_id', ctx.workspace.id).eq('id', id).maybeSingle()
  if (!data) return null
  const [kit] = await hydrateKits(ctx, [data])
  const [system, versions, comments, activity] = await Promise.all([
    loadKitSystem(ctx, kit),
    ctx.supabase.from('brand_kit_versions').select('id, version, change_summary, status, published_at, created_at')
      .eq('workspace_id', ctx.workspace.id).eq('brand_kit_id', id).order('version', { ascending: false }),
    ctx.supabase.from('brand_kit_comments').select(`id, body, created_at, author:profiles!brand_kit_comments_author_id_fkey(${PROFILE})`)
      .eq('workspace_id', ctx.workspace.id).eq('brand_kit_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
    entityActivity(ctx, id),
  ])
  return signMedia(ctx, {
    system, activity,
    versions: (versions.data ?? []) as KitDetail['versions'],
    comments: (comments.data ?? []) as unknown as KitDetail['comments'],
  })
}

// ---------------------------------------------------------------------------
export interface AssetDetail {
  asset: BrandAssetCard
  versions: { id: string; version_no: number; file_size: number | null; change_summary: string | null; created_at: string }[]
  approvals: { id: string; status: string; priority: string; note: string | null; created_at: string; decided_at: string | null }[]
  usage: { id: string; status: string; purpose: string | null; channels: string[]; territories: string[]; starts_on: string | null; ends_on: string | null; created_at: string }[]
  licenses: RightsLicenseRow[]
  products: { id: string; name: string; sku: string; link_type: string }[]
  conflicts: { id: string; conflict_type: string; severity: string; detail: string | null }[]
  folder: string | null
  downloads: number
  activity: BrandActivityItem[]
  territories: RightsTerritory[]
  channels: RightsChannel[]
}

export async function getAssetDetail(ctx: BrandContext, id: string): Promise<AssetDetail | null> {
  if (!isUuid(id)) return null
  const ws = ctx.workspace.id
  const { data } = await ctx.supabase.from('media_assets').select(ASSET_SELECT).eq('workspace_id', ws).eq('id', id).maybeSingle()
  if (!data) return null
  const asset = data as unknown as BrandAssetCard
  const [versions, approvals, usage, licenses, links, conflicts, folder, downloads, activity, territories, channels] = await Promise.all([
    ctx.supabase.from('asset_versions').select('id, version_no, file_size, change_summary, created_at').eq('workspace_id', ws).eq('asset_id', id).order('version_no', { ascending: false }),
    ctx.supabase.from('asset_approvals').select('id, status, priority, note, created_at, decided_at').eq('workspace_id', ws).eq('asset_id', id).order('created_at', { ascending: false }),
    ctx.supabase.from('asset_usage_requests').select('id, status, purpose, channels, territories, starts_on, ends_on, created_at').eq('workspace_id', ws).eq('asset_id', id).order('created_at', { ascending: false }),
    ctx.supabase.from('rights_licenses').select(LICENSE_SELECT).eq('workspace_id', ws).eq('asset_id', id),
    ctx.supabase.from('product_assets').select('link_type, product:products(id, name, sku)').eq('workspace_id', ws).eq('asset_id', id),
    ctx.supabase.from('rights_conflicts').select('id, conflict_type, severity, detail').eq('workspace_id', ws).eq('asset_id', id).is('resolved_at', null),
    asset.folder_id ? ctx.supabase.from('asset_folders').select('name').eq('workspace_id', ws).eq('id', asset.folder_id).maybeSingle() : Promise.resolve({ data: null }),
    countOf(ctx.supabase, 'asset_downloads', ws, q => q.eq('asset_id', id)),
    entityActivity(ctx, id),
    listTerritories(ctx), listChannels(ctx),
  ])
  type L = { link_type: string; product: { id: string; name: string; sku: string } | null }
  return signMedia(ctx, {
    asset, downloads, activity, territories, channels,
    versions: (versions.data ?? []) as AssetDetail['versions'],
    approvals: (approvals.data ?? []) as AssetDetail['approvals'],
    usage: (usage.data ?? []) as AssetDetail['usage'],
    licenses: hydrateLicenses(licenses.data ?? []),
    products: ((links.data ?? []) as unknown as L[]).filter(l => l.product).map(l => ({ ...l.product!, link_type: l.link_type })),
    conflicts: ((conflicts.data ?? []) as AssetDetail['conflicts']).map(c => ({ ...c, detail: c.detail ?? CONFLICT_LABEL[c.conflict_type] ?? c.conflict_type })),
    folder: (folder.data as { name: string } | null)?.name ?? null,
  })
}

// ---------------------------------------------------------------------------
export interface LicenseDetail {
  license: RightsLicenseRow
  agreements: { id: string; title: string; signed_on: string | null; expires_on: string | null; created_at: string; asset_id: string | null }[]
  renewals: { id: string; due_on: string; status: string; new_terms: string | null; completed_at: string | null }[]
  conflicts: { id: string; conflict_type: string; severity: string; detail: string | null; detected_at: string }[]
  activity: BrandActivityItem[]
}

export async function getLicenseDetail(ctx: BrandContext, id: string): Promise<LicenseDetail | null> {
  if (!isUuid(id)) return null
  const ws = ctx.workspace.id
  const { data } = await ctx.supabase.from('rights_licenses').select(LICENSE_SELECT).eq('workspace_id', ws).eq('id', id).maybeSingle()
  if (!data) return null
  const [license] = hydrateLicenses([data])
  const [agreements, renewals, conflicts, activity] = await Promise.all([
    ctx.supabase.from('rights_agreements').select('id, title, signed_on, expires_on, created_at, asset_id').eq('workspace_id', ws).eq('license_id', id).order('created_at', { ascending: false }),
    ctx.supabase.from('rights_renewals').select('id, due_on, status, new_terms, completed_at').eq('workspace_id', ws).eq('license_id', id).order('due_on', { ascending: false }),
    ctx.supabase.from('rights_conflicts').select('id, conflict_type, severity, detail, detected_at').eq('workspace_id', ws).eq('license_id', id).is('resolved_at', null),
    entityActivity(ctx, id),
  ])
  return signMedia(ctx, {
    license, activity,
    agreements: (agreements.data ?? []) as LicenseDetail['agreements'],
    renewals: (renewals.data ?? []) as LicenseDetail['renewals'],
    conflicts: ((conflicts.data ?? []) as LicenseDetail['conflicts']).map(c => ({ ...c, detail: c.detail ?? CONFLICT_LABEL[c.conflict_type] ?? c.conflict_type })),
  })
}

// ---------------------------------------------------------------------------
export interface ProductDetail {
  product: ProductCard
  checks: { check_key: string; label: string; passed: boolean; weight: number }[]
  assets: { id: string; file_name: string; thumbnail_path: string | null; asset_kind: string; link_type: string; approval_status: string; rights_state: string }[]
  variants: { id: string; sku: string; name: string; status: string }[]
  licenses: RightsLicenseRow[]
  activity: BrandActivityItem[]
  linkable: ProductsPage['linkable']
}

export async function getProductDetail(ctx: BrandContext, id: string): Promise<ProductDetail | null> {
  if (!isUuid(id)) return null
  const ws = ctx.workspace.id
  const { data } = await ctx.supabase.from('products').select(PRODUCT_SELECT).eq('workspace_id', ws).eq('id', id).maybeSingle()
  if (!data) return null
  const [product] = await hydrateProducts(ctx, [data])
  const [checks, links, variants, licenses, activity, linkable] = await Promise.all([
    ctx.supabase.from('product_readiness_checks').select('check_key, passed, weight').eq('workspace_id', ws).eq('product_id', id),
    ctx.supabase.from('product_assets').select('link_type, asset:media_assets(id, file_name, thumbnail_path, asset_kind, approval_status, rights_state)').eq('workspace_id', ws).eq('product_id', id).order('sort_order'),
    ctx.supabase.from('product_variants').select('id, sku, name, status').eq('workspace_id', ws).eq('product_id', id).order('sku'),
    ctx.supabase.from('rights_licenses').select(LICENSE_SELECT).eq('workspace_id', ws).eq('product_id', id),
    entityActivity(ctx, id),
    ctx.supabase.from('media_assets').select('id, file_name, thumbnail_path, asset_kind, rights_state').eq('workspace_id', ws)
      .eq('approval_status', 'approved').is('archived_at', null).order('updated_at', { ascending: false }).limit(80),
  ])
  type L = { link_type: string; asset: Omit<ProductDetail['assets'][number], 'link_type'> | null }
  return signMedia(ctx, {
    product, activity,
    checks: ((checks.data ?? []) as { check_key: string; passed: boolean; weight: number }[])
      .map(c => ({ ...c, weight: Number(c.weight), label: CHECK_LABEL[c.check_key] ?? READINESS_LABEL[c.check_key] ?? c.check_key }))
      .sort((a, b) => Number(a.passed) - Number(b.passed) || b.weight - a.weight),
    assets: ((links.data ?? []) as unknown as L[]).filter(l => l.asset).map(l => ({ ...l.asset!, link_type: l.link_type })),
    variants: (variants.data ?? []) as ProductDetail['variants'],
    licenses: hydrateLicenses(licenses.data ?? []),
    linkable: (linkable.data ?? []) as ProductsPage['linkable'],
  })
}

// ---------------------------------------------------------------------------
export interface ActivityPageData { items: BrandActivityItem[]; total: number }

const ACTIVITY_TYPES = ['brand', 'brand_kit', 'asset', 'folder', 'collection', 'license', 'agreement', 'product', 'usage_request', 'approval']

export async function getActivityPage(ctx: BrandContext, type: string | null, page: number, pageSize = 25): Promise<ActivityPageData> {
  let q = ctx.supabase.from('brand_activity')
    .select(`id, workspace_id, entity_type, entity_id, action, summary, href, metadata, created_at, actor:profiles!brand_activity_actor_id_fkey(${PROFILE})`, { count: 'exact' })
    .eq('workspace_id', ctx.workspace.id).order('created_at', { ascending: false })
  if (type && ACTIVITY_TYPES.includes(type)) q = q.eq('entity_type', type)
  const from = (page - 1) * pageSize
  const { data, count } = await q.range(from, from + pageSize - 1)
  return signMedia(ctx, { items: (data ?? []) as unknown as BrandActivityItem[], total: count ?? 0 })
}

/** Lookups the create forms need, scoped to this workspace. */
export async function getCreateLookups(ctx: BrandContext) {
  const ws = ctx.workspace.id
  const [territories, channels, assets, products, categories] = await Promise.all([
    listTerritories(ctx), listChannels(ctx),
    ctx.supabase.from('media_assets').select('id, file_name').eq('workspace_id', ws).is('archived_at', null).order('file_name').limit(300),
    ctx.supabase.from('products').select('id, name, sku').eq('workspace_id', ws).is('archived_at', null).order('name'),
    listCategories(ctx),
  ])
  return {
    territories, channels, categories,
    assets: (assets.data ?? []) as { id: string; file_name: string }[],
    products: (products.data ?? []) as { id: string; name: string; sku: string }[],
  }
}
