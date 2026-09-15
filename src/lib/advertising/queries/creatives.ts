import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMetrics, series, totals, totalsByEntity, type DateRange, type MetricRow, type SeriesPoint } from './shared'
import { getProfileNames } from './accounts'
import { R2_PREFIX, signReadUrls } from '@/lib/storage/r2'

// Data for /{type}/advertising/creatives — grid/table/review views, the review
// queue, top performers and tests & variants. Assets live in the private
// `ad-creatives` bucket, so every thumbnail is returned as a short-lived
// signed URL, never a permanent public link.

export type CreativeListRow = {
  id: string
  name: string
  provider: string
  format: string
  status: string
  reviewStatus: string
  reviewSource: string
  providerFeedback: string | null
  internalFeedback: string | null
  campaignId: string | null
  campaignName: string | null
  adSetId: string | null
  thumbnailPath: string | null
  thumbnailUrl: string | null
  aspectRatio: string | null
  durationSeconds: number | null
  headline: string | null
  updatedAt: string
  createdAt: string
  createdByName: string | null
  isWinningVariant: boolean
  parentCreativeId: string | null
  spend: number
  ctr: number | null
  clicks: number
  conversions: number
  hookRate: number | null
}

/** CTR tiers used by the Performance Tier filter. */
export const CREATIVE_TIERS = [
  { value: 'high', label: 'High (CTR ≥ 3%)' },
  { value: 'medium', label: 'Medium (1.5–3%)' },
  { value: 'low', label: 'Low (< 1.5%)' },
  { value: 'none', label: 'No data' },
] as const

export function creativeTier(ctr: number | null): 'high' | 'medium' | 'low' | 'none' {
  if (ctr === null) return 'none'
  if (ctr >= 3) return 'high'
  if (ctr >= 1.5) return 'medium'
  return 'low'
}

export type CreativeFilters = {
  q?: string | null
  platform?: string | null
  format?: string | null
  aspect?: string | null
  status?: string | null
  reviewStatus?: string | null
  objective?: string | null
  performance?: string | null
  campaignId?: string | null
  sort?: string | null
  page: number
  pageSize: number
}

const COLUMNS = 'id, name, provider, format, status, review_status, review_source, provider_feedback, internal_feedback, campaign_id, ad_set_id, thumbnail_path, aspect_ratio, duration_seconds, headline, updated_at, created_at, created_by, is_winning_variant, parent_creative_id, external_id, ad_campaigns(name)'

const SORTERS: Record<string, (a: CreativeListRow, b: CreativeListRow) => number> = {
  updated: () => 0,
  name: (a, b) => a.name.localeCompare(b.name),
  spend: (a, b) => a.spend - b.spend,
  ctr: (a, b) => (a.ctr ?? -1) - (b.ctr ?? -1),
  hook: (a, b) => (a.hookRate ?? -1) - (b.hookRate ?? -1),
  conversions: (a, b) => a.conversions - b.conversions,
}

const clean = (value: string) => value.replace(/[%*,()]/g, '').trim()

export async function getCreativesPage(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: CreativeFilters,
): Promise<{ rows: CreativeListRow[]; total: number }> {
  let query = supabase.from('ad_creatives').select(COLUMNS).eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(1000)

  if (filters.q) {
    const q = clean(filters.q)
    const { data: matching } = await supabase.from('ad_campaigns').select('id').eq('workspace_id', workspaceId).ilike('name', `%${q}%`).limit(200)
    const campaignIds = (matching ?? []).map(row => row.id as string)
    const clauses = [`name.ilike.%${q}%`, `external_id.ilike.%${q}%`]
    if (/^[0-9a-f-]{8,36}$/i.test(q)) clauses.push(`id.eq.${q}`)
    if (campaignIds.length) clauses.push(`campaign_id.in.(${campaignIds.join(',')})`)
    query = query.or(clauses.join(','))
  }
  if (filters.objective) {
    const { data: objectiveCampaigns } = await supabase.from('ad_campaigns').select('id').eq('workspace_id', workspaceId).eq('objective', filters.objective)
    const ids = (objectiveCampaigns ?? []).map(row => row.id as string)
    if (ids.length === 0) return { rows: [], total: 0 }
    query = query.in('campaign_id', ids)
  }
  if (filters.platform) query = query.eq('provider', filters.platform)
  if (filters.format) query = query.eq('format', filters.format)
  if (filters.aspect) query = query.eq('aspect_ratio', filters.aspect)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.campaignId) query = query.eq('campaign_id', filters.campaignId)
  if (filters.reviewStatus) query = query.eq('review_status', filters.reviewStatus)

  const { data } = await query
  let rows = await hydrate(supabase, workspaceId, range, data ?? [])
  if (filters.performance) rows = rows.filter(row => creativeTier(row.ctr) === filters.performance)

  const sortKey = (filters.sort ?? 'updated_desc').replace(/_(asc|desc)$/, '')
  const ascending = filters.sort?.endsWith('_asc') ?? false
  const sorter = SORTERS[sortKey] ?? SORTERS.updated
  const sorted = sortKey === 'updated' ? rows : [...rows].sort((a, b) => ascending ? sorter(a, b) : sorter(b, a))
  const from = (filters.page - 1) * filters.pageSize
  const page = sorted.slice(from, from + filters.pageSize)
  return { total: sorted.length, rows: await signThumbnails(supabase, page) }
}

export async function getReviewQueue(supabase: SupabaseClient, workspaceId: string, limit = 10): Promise<CreativeListRow[]> {
  const { data } = await supabase
    .from('ad_creatives').select(COLUMNS)
    .eq('workspace_id', workspaceId)
    .in('review_status', ['under_review', 'disapproved', 'changes_requested'])
    .order('updated_at', { ascending: false })
    .limit(limit)
  return signThumbnails(supabase, await hydrate(supabase, workspaceId, null, data ?? []))
}

export async function getTopPerformingCreatives(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5,
): Promise<CreativeListRow[]> {
  const { data } = await supabase.from('ad_creatives').select(COLUMNS).eq('workspace_id', workspaceId).limit(500)
  const rows = await hydrate(supabase, workspaceId, range, data ?? [])
  const top = rows.filter(row => row.ctr !== null).sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0)).slice(0, limit)
  return signThumbnails(supabase, top)
}

/** Grouped for the Tests & Variants tab: parent creative -> its variants. */
export async function getVariantGroups(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
): Promise<{ parent: CreativeListRow; variants: CreativeListRow[] }[]> {
  const { data } = await supabase.from('ad_creatives').select(COLUMNS).eq('workspace_id', workspaceId).not('parent_creative_id', 'is', null).limit(200)
  if (!data?.length) return []
  const rows = await hydrate(supabase, workspaceId, range, data)
  const byParent = new Map<string, CreativeListRow[]>()
  for (const row of rows) {
    if (!row.parentCreativeId) continue
    byParent.set(row.parentCreativeId, [...(byParent.get(row.parentCreativeId) ?? []), row])
  }
  if (byParent.size === 0) return []
  const { data: parents } = await supabase.from('ad_creatives').select(COLUMNS).eq('workspace_id', workspaceId).in('id', [...byParent.keys()])
  const parentRows = await hydrate(supabase, workspaceId, range, parents ?? [])
  return parentRows.map(parent => ({ parent, variants: byParent.get(parent.id) ?? [] }))
}

export type CreativeKpis = {
  current: ReturnType<typeof totals>
  previous: ReturnType<typeof totals>
  topCtr: number | null
  previousTopCtr: number | null
  hookRate: number | null
  previousHookRate: number | null
  activeCount: number
  disapprovedCount: number
  winningCount: number
  series: { spend: SeriesPoint[]; topCtr: SeriesPoint[]; hook: SeriesPoint[] }
}

/** Highest single-creative CTR in a set of rows (min 1,000 impressions, so one lucky click cannot top the chart). */
function topCtrOf(rows: MetricRow[]): number | null {
  let best: number | null = null
  for (const [, metric] of totalsByEntity(rows)) {
    if (metric.impressions < 1000 || metric.ctr === null) continue
    if (best === null || metric.ctr > best) best = metric.ctr
  }
  return best
}

/** Hook rate over video creatives only; image impressions would dilute it. */
function hookOf(rows: MetricRow[]): number | null {
  return totals(rows.filter(row => Number(row.video_views) > 0)).hookRate
}

export async function getCreativeKpis(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, compare: DateRange,
): Promise<CreativeKpis> {
  const [current, previous, active, disapproved, winning] = await Promise.all([
    loadMetrics(supabase, { workspaceId, entityType: 'creative', range }),
    loadMetrics(supabase, { workspaceId, entityType: 'creative', range: compare }),
    supabase.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'active'),
    supabase.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('review_status', 'disapproved'),
    supabase.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('is_winning_variant', true),
  ])

  const byDay = new Map<string, MetricRow[]>()
  for (const row of current) byDay.set(row.metric_date, [...(byDay.get(row.metric_date) ?? []), row])
  const daily = series(current, range, 'spend')

  return {
    current: totals(current), previous: totals(previous),
    topCtr: topCtrOf(current), previousTopCtr: topCtrOf(previous),
    hookRate: hookOf(current), previousHookRate: hookOf(previous),
    activeCount: active.count ?? 0, disapprovedCount: disapproved.count ?? 0, winningCount: winning.count ?? 0,
    series: {
      spend: daily,
      topCtr: daily.map(point => ({ date: point.date, value: Math.max(0, ...[...totalsByEntity(byDay.get(point.date) ?? [])].map(([, metric]) => metric.ctr ?? 0)) })),
      hook: daily.map(point => ({ date: point.date, value: hookOf(byDay.get(point.date) ?? []) ?? 0 })),
    },
  }
}

/** Distinct aspect ratios in use, for the Format filter. */
export async function getAspectRatios(supabase: SupabaseClient, workspaceId: string): Promise<string[]> {
  const { data } = await supabase.from('ad_creatives').select('aspect_ratio').eq('workspace_id', workspaceId).not('aspect_ratio', 'is', null)
  return [...new Set((data ?? []).map(row => row.aspect_ratio as string))].sort()
}

/** Short-lived signed URLs for thumbnails, from R2 (`r2:` paths) or the private Supabase bucket. */
export async function signThumbnails<T extends { thumbnailPath: string | null; thumbnailUrl?: string | null }>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  const paths = rows.map(row => row.thumbnailPath).filter((path): path is string => !!path)
  if (paths.length === 0) return rows
  const r2Paths = paths.filter(path => path.startsWith(R2_PREFIX))
  const supabasePaths = paths.filter(path => !path.startsWith(R2_PREFIX))
  const [r2Urls, { data }] = await Promise.all([
    r2Paths.length ? signReadUrls(r2Paths) : Promise.resolve(new Map<string, string | null>()),
    supabasePaths.length ? supabase.storage.from('ad-creatives').createSignedUrls(supabasePaths, 60 * 10) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ])
  const urls = new Map<string, string | null>([...(data ?? []).map(entry => [entry.path ?? '', entry.signedUrl] as const), ...r2Urls])
  return rows.map(row => ({ ...row, thumbnailUrl: row.thumbnailPath ? urls.get(row.thumbnailPath) ?? null : null }))
}

async function hydrate(
  supabase: SupabaseClient, workspaceId: string, range: DateRange | null, creatives: Record<string, unknown>[],
): Promise<CreativeListRow[]> {
  if (creatives.length === 0) return []
  const [metrics, creators] = await Promise.all([
    range ? loadMetrics(supabase, { workspaceId, entityType: 'creative', range, entityIds: creatives.map(creative => creative.id as string) }) : Promise.resolve([]),
    getProfileNames(supabase, creatives.map(creative => creative.created_by as string | null)),
  ])
  const byEntity = totalsByEntity(metrics)

  return creatives.map(creative => {
    const metric = byEntity.get(creative.id as string)
    const campaign = creative.ad_campaigns as unknown as { name?: string } | { name?: string }[] | null
    const campaignName = Array.isArray(campaign) ? campaign[0]?.name : campaign?.name
    return {
      id: creative.id as string, name: creative.name as string, provider: creative.provider as string,
      format: creative.format as string, status: creative.status as string,
      reviewStatus: creative.review_status as string, reviewSource: creative.review_source as string,
      providerFeedback: creative.provider_feedback as string | null, internalFeedback: creative.internal_feedback as string | null,
      campaignId: creative.campaign_id as string | null, campaignName: campaignName ?? null,
      adSetId: creative.ad_set_id as string | null, thumbnailPath: creative.thumbnail_path as string | null, thumbnailUrl: null,
      aspectRatio: creative.aspect_ratio as string | null,
      durationSeconds: creative.duration_seconds === null ? null : Number(creative.duration_seconds),
      headline: creative.headline as string | null, updatedAt: creative.updated_at as string, createdAt: creative.created_at as string,
      createdByName: creators.get(creative.created_by as string) ?? null,
      isWinningVariant: !!creative.is_winning_variant, parentCreativeId: creative.parent_creative_id as string | null,
      spend: metric?.spend ?? 0, ctr: metric?.ctr ?? null, clicks: metric?.clicks ?? 0,
      conversions: metric?.conversions ?? 0, hookRate: metric?.hookRate ?? null,
    }
  })
}
