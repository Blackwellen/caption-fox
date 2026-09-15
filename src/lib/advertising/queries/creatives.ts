import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMetrics, totalsByEntity, type DateRange } from './shared'

// Data for /{type}/advertising/creatives — grid/table/review views, the review
// queue, and the top-performers rail.

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
  headline: string | null
  updatedAt: string
  isWinningVariant: boolean
  parentCreativeId: string | null
  spend: number
  ctr: number | null
  clicks: number
  conversions: number
  hookRate: number | null
}

export type CreativeFilters = {
  q?: string | null
  platform?: string | null
  format?: string | null
  status?: string | null
  campaignId?: string | null
  reviewStatus?: string | null
  sort?: string | null
  page: number
  pageSize: number
}

const SORT_COLUMNS: Record<string, string> = { name: 'name', updated: 'updated_at' }

export async function getCreativesPage(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, filters: CreativeFilters,
): Promise<{ rows: CreativeListRow[]; total: number }> {
  let query = supabase
    .from('ad_creatives')
    .select('id, name, provider, format, status, review_status, review_source, provider_feedback, internal_feedback, campaign_id, ad_set_id, thumbnail_path, headline, updated_at, is_winning_variant, parent_creative_id, ad_campaigns(name)', { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.platform) query = query.eq('provider', filters.platform)
  if (filters.format) query = query.eq('format', filters.format)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.campaignId) query = query.eq('campaign_id', filters.campaignId)
  if (filters.reviewStatus) query = query.eq('review_status', filters.reviewStatus)

  const sortKey = (filters.sort ?? 'updated_desc').replace(/_(asc|desc)$/, '')
  const ascending = filters.sort?.endsWith('_asc') ?? false
  query = query.order(SORT_COLUMNS[sortKey] ?? 'updated_at', { ascending })

  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, count } = await query
  const creatives = data ?? []
  const rows = await hydrate(supabase, workspaceId, range, creatives)
  return { total: count ?? 0, rows }
}

export async function getReviewQueue(supabase: SupabaseClient, workspaceId: string, limit = 10): Promise<CreativeListRow[]> {
  const { data } = await supabase
    .from('ad_creatives')
    .select('id, name, provider, format, status, review_status, review_source, provider_feedback, internal_feedback, campaign_id, ad_set_id, thumbnail_path, headline, updated_at, is_winning_variant, parent_creative_id, ad_campaigns(name)')
    .eq('workspace_id', workspaceId)
    .in('review_status', ['under_review', 'disapproved', 'changes_requested'])
    .order('updated_at', { ascending: false })
    .limit(limit)
  return hydrate(supabase, workspaceId, { since: '1970-01-01', until: '1970-01-01', label: '' }, data ?? [], true)
}

export async function getTopPerformingCreatives(
  supabase: SupabaseClient, workspaceId: string, range: DateRange, limit = 5,
): Promise<CreativeListRow[]> {
  const { data } = await supabase
    .from('ad_creatives')
    .select('id, name, provider, format, status, review_status, review_source, provider_feedback, internal_feedback, campaign_id, ad_set_id, thumbnail_path, headline, updated_at, is_winning_variant, parent_creative_id, ad_campaigns(name)')
    .eq('workspace_id', workspaceId)
    .limit(300)
  const rows = await hydrate(supabase, workspaceId, range, data ?? [])
  return rows.filter(row => row.ctr !== null).sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0)).slice(0, limit)
}

/** Grouped for the Tests and Variants panel: parent creative -> its variants. */
export async function getVariantGroups(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
): Promise<{ parent: CreativeListRow; variants: CreativeListRow[] }[]> {
  const { data } = await supabase
    .from('ad_creatives')
    .select('id, name, provider, format, status, review_status, review_source, provider_feedback, internal_feedback, campaign_id, ad_set_id, thumbnail_path, headline, updated_at, is_winning_variant, parent_creative_id, ad_campaigns(name)')
    .eq('workspace_id', workspaceId)
    .not('parent_creative_id', 'is', null)
    .limit(200)
  if (!data?.length) return []

  const rows = await hydrate(supabase, workspaceId, range, data)
  const byParent = new Map<string, CreativeListRow[]>()
  for (const row of rows) {
    if (!row.parentCreativeId) continue
    const list = byParent.get(row.parentCreativeId) ?? []
    list.push(row)
    byParent.set(row.parentCreativeId, list)
  }
  if (byParent.size === 0) return []

  const { data: parents } = await supabase
    .from('ad_creatives')
    .select('id, name, provider, format, status, review_status, review_source, provider_feedback, internal_feedback, campaign_id, ad_set_id, thumbnail_path, headline, updated_at, is_winning_variant, parent_creative_id, ad_campaigns(name)')
    .in('id', [...byParent.keys()])
  const parentRows = await hydrate(supabase, workspaceId, range, parents ?? [])

  return parentRows.map(parent => ({ parent, variants: byParent.get(parent.id) ?? [] }))
}

async function hydrate(
  supabase: SupabaseClient, workspaceId: string, range: DateRange,
  creatives: Record<string, unknown>[], skipMetrics = false,
): Promise<CreativeListRow[]> {
  if (creatives.length === 0) return []
  const byEntity = skipMetrics
    ? new Map()
    : totalsByEntity(await loadMetrics(supabase, {
      workspaceId, entityType: 'creative', range, entityIds: creatives.map(creative => creative.id as string),
    }))

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
      adSetId: creative.ad_set_id as string | null, thumbnailPath: creative.thumbnail_path as string | null,
      headline: creative.headline as string | null, updatedAt: creative.updated_at as string,
      isWinningVariant: !!creative.is_winning_variant, parentCreativeId: creative.parent_creative_id as string | null,
      spend: metric?.spend ?? 0, ctr: metric?.ctr ?? null, clicks: metric?.clicks ?? 0,
      conversions: metric?.conversions ?? 0, hookRate: metric?.hookRate ?? null,
    }
  })
}
