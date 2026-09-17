// Studio data layer.
//
// Every function is `(supabase, workspaceId, …)` and every query filters on
// `workspace_id` explicitly. RLS already enforces that boundary; the explicit
// filter is defence in depth and keeps the workspace-leading indexes hot.
//
// Errors are returned as data (`{ rows: [], total: 0, error }`) rather than
// thrown, so a failing panel renders the canonical error state instead of
// taking down the whole route.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudioQuery } from './query'
import { sanitiseSearch } from './query'
import type {
  ActivityRow, AiCounts, AiOutputPage, AiOutputRow, AssetVersionRow, BlockedTermRow,
  ContentCommentRow, ContentCounts, ContentPage, ContentRow, ContentVersionRow,
  IdeaCollectionRow, IdeaCounts, IdeaPage, IdeaRow, KeywordCounts, KeywordSetPage,
  KeywordSetRow, KeywordTermRow, MediaCollectionRow, MediaCounts, MediaPage, MediaRow,
  PromptRow, TemplateCounts, TemplatePage, TemplateRow, TemplateUsagePoint,
} from './types'

const OWNER_JOIN = 'owner:profiles!content_posts_owner_id_fkey(id, full_name, email, avatar_url)'

const CONTENT_COLUMNS = `
  id, workspace_id, title, internal_title, caption, hashtags, platforms, post_type, status,
  scheduled_at, published_at, thumbnail_url, media_urls, tags, tone, cta_label, cta_url,
  utm_enabled, utm_params, quality_score, quality_checks, source, template_id, idea_id,
  repurposed_from, campaign_id, brand_id, engagement, metadata, archived_at, created_at, updated_at,
  ${OWNER_JOIN},
  campaign:campaigns(id, name)
`

const IDEA_COLUMNS = `
  id, title, description, platforms, status, stage, score, source, tags, why_it_works,
  next_step, featured, ai_generated, collection_id, converted_to_post_id, metadata, archived_at,
  created_at, updated_at,
  owner:profiles!content_ideas_owner_id_fkey(id, full_name, email, avatar_url),
  collection:studio_idea_collections(id, name, colour)
`

const TEMPLATE_COLUMNS = `
  id, name, description, caption_template, platforms, channel, category, post_type, hashtags,
  tags, variables, status, cover_url, usage_count, brand_approved, is_global, approved_at,
  review_note, archived_at, created_at, updated_at,
  owner:profiles!content_templates_owner_id_fkey(id, full_name, email, avatar_url)
`

const KEYWORD_COLUMNS = `
  id, name, description, kind, status, platform, topic, language, region, icon, hashtags,
  relevance_score, avg_volume, competition, growth_30d, favourite, avg_reach, archived_at,
  created_at, updated_at,
  owner:profiles!hashtag_sets_owner_id_fkey(id, full_name, email, avatar_url)
`

const MEDIA_COLUMNS = `
  id, file_name, file_path, file_url, thumbnail_path, file_type, mime_type, file_size, width, height,
  duration_seconds, tags, alt_text, description, status, colour_profile, usage_count, version,
  collection_id, is_favourite, review_note, archived_at, created_at, updated_at,
  owner:profiles!media_assets_owner_id_fkey(id, full_name, email, avatar_url),
  collection:studio_media_collections(id, name)
`

const AI_COLUMNS = `
  id, type, prompt, output, channel, platform, tone, objective, audience, model, topic,
  word_count, match_score, bookmarked, status, used_content_id, batch_id,
  prompt_tokens, completion_tokens, created_at,
  author:profiles!ai_generations_user_id_fkey(id, full_name, email, avatar_url)
`

/** Supabase returns joined single relations as an array in some shapes. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normaliseJoins<T extends object>(rows: T[], keys: string[]): T[] {
  return rows.map(row => {
    const next: Record<string, unknown> = { ...(row as Record<string, unknown>) }
    for (const key of keys) if (key in next) next[key] = firstOf(next[key] as never)
    return next as unknown as T
  })
}

function startOfDay(offsetDays = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

function startOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — Compose, Content Library, Overview
// ═══════════════════════════════════════════════════════════════════════════

const CONTENT_SORTS: Record<string, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  scheduled_asc: { column: 'scheduled_at', ascending: true, nullsFirst: false },
  title_asc: { column: 'title', ascending: true },
  title_desc: { column: 'title', ascending: false },
  score_desc: { column: 'quality_score', ascending: false, nullsFirst: false },
}

export async function listContent(
  supabase: SupabaseClient,
  workspaceId: string,
  q: StudioQuery,
  opts: { limit?: number; paginate?: boolean; statuses?: string[] } = {},
): Promise<ContentPage> {
  let query = supabase
    .from('content_posts')
    .select(CONTENT_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = q.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

  if (opts.statuses?.length) query = query.in('status', opts.statuses)
  else if (q.status) query = query.eq('status', q.status)

  if (q.channel) query = query.contains('platforms', [q.channel])
  if (q.owner) query = query.eq('owner_id', q.owner)
  if (q.campaign) query = query.eq('campaign_id', q.campaign)
  if (q.tag) query = query.contains('tags', [q.tag])
  if (q.from) query = query.gte('updated_at', `${q.from}T00:00:00.000Z`)
  if (q.to) query = query.lte('updated_at', `${q.to}T23:59:59.999Z`)

  const term = sanitiseSearch(q.q)
  if (term) query = query.or(`title.ilike.%${term}%,caption.ilike.%${term}%,internal_title.ilike.%${term}%`)

  const sort = CONTENT_SORTS[q.sort] ?? CONTENT_SORTS.updated_desc
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? sort.ascending })
  // Stable secondary key so pagination can never skip or repeat a row.
  query = query.order('id', { ascending: true })

  if (opts.paginate !== false) {
    const from = (q.page - 1) * q.size
    query = query.range(from, from + q.size - 1)
  } else if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return {
    rows: normaliseJoins((data ?? []) as unknown as ContentRow[], ['owner', 'campaign']),
    total: count ?? 0,
    error: null,
  }
}

export async function getContent(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<{ row: ContentRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('content_posts').select(CONTENT_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (error) return { row: null, error: error.message }
  if (!data) return { row: null, error: null }
  return { row: normaliseJoins([data as unknown as ContentRow], ['owner', 'campaign'])[0], error: null }
}

/**
 * One round trip for every content count the KPI strips and pipeline need.
 * Selecting just `status, scheduled_at` keeps the payload small even at scale;
 * six `count` head-requests would be six network hops for the same answer.
 */
export async function contentCounts(
  supabase: SupabaseClient, workspaceId: string,
): Promise<ContentCounts> {
  const empty: ContentCounts = {
    total: 0, draft: 0, pending_approval: 0, approved: 0, scheduled: 0,
    published: 0, failed: 0, archived: 0, scheduledThisWeek: 0, linkedAssets: 0, trends: {}, error: null,
  }

  const [posts, assets] = await Promise.all([
    supabase.from('content_posts').select('status, scheduled_at, media_urls, created_at, updated_at')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000),
    supabase.from('studio_content_assets').select('asset_id, created_at')
      .eq('workspace_id', workspaceId).limit(20_000),
  ])

  if (posts.error) return { ...empty, error: posts.error.message }

  const weekEnd = startOfDay(7)
  const now = new Date().toISOString()
  const counts: ContentCounts = { ...empty, trends: {} }
  // "vs last 30 days": today's figure against the same figure 30 days ago. A
  // record counts toward the earlier figure only if it was created (total) or
  // last changed (per status) before the cut-off.
  const cut = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const bump = (key: string, earlier: boolean) => {
    const t = (counts.trends[key] ??= { current: 0, previous: 0 })
    t.current += 1
    if (earlier) t.previous += 1
  }

  for (const row of posts.data ?? []) {
    counts.total += 1
    bump('total', row.created_at < cut)
    bump(row.status, row.updated_at < cut)
    const status = row.status as keyof ContentCounts
    if (status in counts && typeof counts[status] === 'number') {
      (counts[status] as number) += 1
    }
    if (row.status === 'scheduled' && row.scheduled_at && row.scheduled_at >= now && row.scheduled_at <= weekEnd) {
      counts.scheduledThisWeek += 1
    }
    if ((row.media_urls?.length ?? 0) > 0) counts.linkedAssets += 1
  }

  const firstLinked = new Map<string, string>()
  for (const row of assets.data ?? []) {
    const seen = firstLinked.get(row.asset_id)
    if (!seen || row.created_at < seen) firstLinked.set(row.asset_id, row.created_at)
  }
  for (const at of firstLinked.values()) bump('linked', at < cut)
  counts.linkedAssets = Math.max(counts.linkedAssets, firstLinked.size)
  return counts
}

export async function listContentVersions(
  supabase: SupabaseClient, workspaceId: string, postId: string, limit = 10,
): Promise<{ rows: ContentVersionRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('post_versions')
    .select('id, version_number, caption, hashtags, platforms, status, change_note, created_at, author:profiles!post_versions_changed_by_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId).eq('post_id', postId)
    .order('version_number', { ascending: false }).limit(limit)
  if (error) return { rows: [], error: error.message }
  return { rows: normaliseJoins((data ?? []) as unknown as ContentVersionRow[], ['author']), error: null }
}

export async function listContentComments(
  supabase: SupabaseClient, workspaceId: string, postId: string, limit = 50,
): Promise<{ rows: ContentCommentRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, body, parent_id, created_at, author:profiles!post_comments_user_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId).eq('post_id', postId)
    .order('created_at', { ascending: true }).limit(limit)
  if (error) return { rows: [], error: error.message }
  return { rows: normaliseJoins((data ?? []) as unknown as ContentCommentRow[], ['author']), error: null }
}

// ═══════════════════════════════════════════════════════════════════════════
// IDEAS
// ═══════════════════════════════════════════════════════════════════════════

const IDEA_SORTS: Record<string, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  score_desc: { column: 'score', ascending: false, nullsFirst: false },
  title_asc: { column: 'title', ascending: true },
  title_desc: { column: 'title', ascending: false },
}

export async function listIdeas(
  supabase: SupabaseClient,
  workspaceId: string,
  q: StudioQuery,
  opts: { paginate?: boolean; limit?: number; stage?: string; scoreBand?: string } = {},
): Promise<IdeaPage> {
  let query = supabase
    .from('content_ideas')
    .select(IDEA_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = q.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

  const stage = opts.stage ?? q.stage
  if (stage) query = query.eq('stage', stage)
  if (q.source) query = query.eq('source', q.source)
  if (q.owner) query = query.eq('owner_id', q.owner)
  if (q.collection) query = query.eq('collection_id', q.collection)
  if (opts.scoreBand === 'high') query = query.gte('score', 80)
  else if (opts.scoreBand === 'medium') query = query.gte('score', 60).lt('score', 80)
  else if (opts.scoreBand === 'low') query = query.lt('score', 60)
  if (q.tag) query = query.contains('tags', [q.tag])
  if (q.channel) query = query.contains('platforms', [q.channel])
  if (q.from) query = query.gte('created_at', `${q.from}T00:00:00.000Z`)
  if (q.to) query = query.lte('created_at', `${q.to}T23:59:59.999Z`)

  const term = sanitiseSearch(q.q)
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)

  const sort = IDEA_SORTS[q.sort] ?? IDEA_SORTS.score_desc
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? sort.ascending })
  query = query.order('id', { ascending: true })

  if (opts.paginate !== false) {
    const from = (q.page - 1) * q.size
    query = query.range(from, from + q.size - 1)
  } else if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return {
    rows: normaliseJoins((data ?? []) as unknown as IdeaRow[], ['owner', 'collection']),
    total: count ?? 0,
    error: null,
  }
}

export async function ideaCounts(supabase: SupabaseClient, workspaceId: string): Promise<IdeaCounts> {
  const { data, error } = await supabase
    .from('content_ideas').select('stage, status, source, created_at, updated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000)

  if (error) {
    return { total: 0, byStage: {}, newLast7: 0, savedInspirations: 0, converted: 0, trendSignals: 0, trends: {}, error: error.message }
  }
  const now = Date.now()
  const trends: Record<string, { current: number; previous: number }> = {}
  const bump = (key: string, iso: string | null) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    const bucket = (trends[key] ??= { current: 0, previous: 0 })
    if (t > now - 7 * 86_400_000) bucket.current += 1
    else if (t > now - 14 * 86_400_000) bucket.previous += 1
  }
  let trendSignals = 0

  const since = startOfDay(-7)
  const byStage: Record<string, number> = {}
  let newLast7 = 0
  let savedInspirations = 0

  for (const row of data ?? []) {
    byStage[row.stage] = (byStage[row.stage] ?? 0) + 1
    if (row.created_at >= since) newLast7 += 1
    if (row.status === 'saved') { savedInspirations += 1; bump('saved', row.created_at) }
    if (row.source === 'trend') { trendSignals += 1; bump('trend', row.created_at) }
    bump('new', row.created_at)
    // A stage "entry" is approximated by the last update, the moment it moved.
    bump(`stage:${row.stage}`, row.updated_at)
  }

  return {
    total: data?.length ?? 0,
    byStage,
    newLast7,
    savedInspirations,
    converted: byStage.converted ?? 0,
    trendSignals,
    trends,
    error: null,
  }
}

export interface IdeaTaskRow { id: string; title: string; due_on: string | null; done_at: string | null; idea_id: string; idea_title: string | null }

/** Open follow-up tasks on ideas, soonest due first. */
export async function listIdeaTasks(
  supabase: SupabaseClient, workspaceId: string, limit = 5, ideaId?: string,
): Promise<{ rows: IdeaTaskRow[]; error: string | null }> {
  let query = supabase.from('studio_idea_tasks')
    .select('id, title, due_on, done_at, idea_id, idea:content_ideas(title)')
    .eq('workspace_id', workspaceId).is('done_at', null)
  if (ideaId) query = query.eq('idea_id', ideaId)
  const { data, error } = await query
    .order('due_on', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).limit(limit)
  if (error) return { rows: [], error: error.message }
  return {
    rows: (data ?? []).map(r => ({
      id: r.id, title: r.title, due_on: r.due_on, done_at: r.done_at, idea_id: r.idea_id,
      idea_title: (firstOf(r.idea as never) as { title: string } | null)?.title ?? null,
    })),
    error: null,
  }
}

export interface TrendSignal { id: string; name: string; growth: number }

/** Fastest-growing keyword clusters, the evidence behind trend-sourced ideas. */
export async function listTrendSignals(
  supabase: SupabaseClient, workspaceId: string, limit = 3,
): Promise<{ rows: TrendSignal[]; error: string | null }> {
  const { data, error } = await supabase.from('hashtag_sets').select('id, name, growth_30d')
    .eq('workspace_id', workspaceId).is('archived_at', null).not('growth_30d', 'is', null)
    .order('growth_30d', { ascending: false }).limit(limit)
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []).map(r => ({ id: r.id, name: r.name, growth: Number(r.growth_30d) })), error: null }
}

export async function listIdeaCollections(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ rows: IdeaCollectionRow[]; error: string | null }> {
  const [collections, ideas] = await Promise.all([
    supabase.from('studio_idea_collections')
      .select('id, name, description, colour')
      .eq('workspace_id', workspaceId).is('archived_at', null)
      .order('name', { ascending: true }).limit(100),
    supabase.from('content_ideas').select('collection_id')
      .eq('workspace_id', workspaceId).is('archived_at', null)
      .not('collection_id', 'is', null).limit(20_000),
  ])

  if (collections.error) return { rows: [], error: collections.error.message }

  const tally = new Map<string, number>()
  for (const row of ideas.data ?? []) {
    if (row.collection_id) tally.set(row.collection_id, (tally.get(row.collection_id) ?? 0) + 1)
  }

  return {
    rows: (collections.data ?? []).map(row => ({
      ...row, idea_count: tally.get(row.id) ?? 0,
    })) as IdeaCollectionRow[],
    error: null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATE_SORTS: Record<string, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  usage_desc: { column: 'usage_count', ascending: false },
  title_asc: { column: 'name', ascending: true },
  title_desc: { column: 'name', ascending: false },
}

export async function listTemplates(
  supabase: SupabaseClient,
  workspaceId: string,
  q: StudioQuery,
  opts: { paginate?: boolean; limit?: number; userId?: string } = {},
): Promise<TemplatePage> {
  let query = supabase
    .from('content_templates')
    .select(TEMPLATE_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = q.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

  if (q.status) query = query.eq('status', q.status)
  if (q.category) query = query.eq('category', q.category)
  if (q.channel) query = query.or(`channel.eq.${q.channel},platforms.cs.{${q.channel}}`)
  if (q.owner) query = query.eq('owner_id', q.owner)
  if (q.tag) query = query.contains('tags', [q.tag])

  const term = sanitiseSearch(q.q)
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)

  const sort = TEMPLATE_SORTS[q.sort] ?? TEMPLATE_SORTS.updated_desc
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? sort.ascending })
  query = query.order('id', { ascending: true })

  if (opts.paginate !== false) {
    const from = (q.page - 1) * q.size
    query = query.range(from, from + q.size - 1)
  } else if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }

  let rows = normaliseJoins((data ?? []) as unknown as TemplateRow[], ['owner'])

  if (opts.userId && rows.length) {
    const { data: favs } = await supabase
      .from('studio_template_favourites').select('template_id')
      .eq('workspace_id', workspaceId).eq('user_id', opts.userId)
      .in('template_id', rows.map(r => r.id))
    const set = new Set((favs ?? []).map(f => f.template_id))
    rows = rows.map(row => ({ ...row, favourite: set.has(row.id) }))
  }

  return { rows, total: count ?? 0, error: null }
}

export async function getTemplate(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<{ row: TemplateRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('content_templates').select(TEMPLATE_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (error) return { row: null, error: error.message }
  if (!data) return { row: null, error: null }
  return { row: normaliseJoins([data as unknown as TemplateRow], ['owner'])[0], error: null }
}

export async function templateCounts(
  supabase: SupabaseClient, workspaceId: string,
): Promise<TemplateCounts> {
  const { data, error } = await supabase
    .from('content_templates').select('id, name, status, brand_approved, usage_count, created_at')
    .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000)

  if (error) {
    return { total: 0, published: 0, brandApproved: 0, needsReview: 0, savedThisMonth: 0, savedLastMonth: 0, mostUsed: null, error: error.message }
  }

  const monthStart = startOfMonth()
  const lastMonthStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString() })()
  let published = 0, brandApproved = 0, needsReview = 0, savedThisMonth = 0, savedLastMonth = 0
  let mostUsed: TemplateCounts['mostUsed'] = null

  for (const row of data ?? []) {
    if (row.status === 'published') published += 1
    if (row.brand_approved) brandApproved += 1
    if (row.status === 'in_review' || row.status === 'changes_requested') needsReview += 1
    if (row.created_at >= monthStart) savedThisMonth += 1
    else if (row.created_at >= lastMonthStart) savedLastMonth += 1
    if (!mostUsed || (row.usage_count ?? 0) > mostUsed.usage_count) {
      mostUsed = { id: row.id, name: row.name, usage_count: row.usage_count ?? 0 }
    }
  }

  return { total: data?.length ?? 0, published, brandApproved, needsReview, savedThisMonth, savedLastMonth, mostUsed, error: null }
}

/** Real usage history for the template performance panel — never a random series. */
export async function templateUsageSeries(
  supabase: SupabaseClient, workspaceId: string, templateId: string, days = 30,
): Promise<{ points: TemplateUsagePoint[]; total: number; error: string | null }> {
  const since = startOfDay(-days)
  const { data, error } = await supabase
    .from('studio_template_usage').select('created_at')
    .eq('workspace_id', workspaceId).eq('template_id', templateId)
    .gte('created_at', since).order('created_at', { ascending: true }).limit(5_000)

  if (error) return { points: [], total: 0, error: error.message }

  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(startOfDay(-i).slice(0, 10), 0)
  }
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  return {
    points: [...buckets].map(([date, uses]) => ({ date, uses })),
    total: data?.length ?? 0,
    error: null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HASHTAGS & KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════

/** Postgres `numeric` columns arrive as strings; convert them once at the edge. */
const toNum = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
function normaliseKeywordSet<T extends KeywordSetRow>(row: T): T {
  return { ...row, competition: toNum(row.competition), growth_30d: toNum(row.growth_30d), avg_volume: toNum(row.avg_volume), relevance_score: toNum(row.relevance_score) }
}
function normaliseTerm(row: KeywordTermRow): KeywordTermRow {
  return { ...row, competition: toNum(row.competition), growth_30d: toNum(row.growth_30d), avg_volume: toNum(row.avg_volume), relevance: toNum(row.relevance) }
}

const KEYWORD_SORTS: Record<string, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  score_desc: { column: 'relevance_score', ascending: false, nullsFirst: false },
  title_asc: { column: 'name', ascending: true },
  title_desc: { column: 'name', ascending: false },
}

export async function listKeywordSets(
  supabase: SupabaseClient,
  workspaceId: string,
  q: StudioQuery,
  opts: { kind?: string; paginate?: boolean; limit?: number } = {},
): Promise<KeywordSetPage> {
  let query = supabase
    .from('hashtag_sets')
    .select(KEYWORD_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = q.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

  const kind = opts.kind ?? q.kind
  if (kind) query = query.eq('kind', kind)
  if (q.status) query = query.eq('status', q.status)
  if (q.channel) query = query.eq('platform', q.channel)
  if (q.topic) query = query.eq('topic', q.topic)
  if (q.language) query = query.eq('language', q.language)
  if (q.owner) query = query.eq('owner_id', q.owner)

  const term = sanitiseSearch(q.q)
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,topic.ilike.%${term}%`)

  const sort = KEYWORD_SORTS[q.sort] ?? KEYWORD_SORTS.updated_desc
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? sort.ascending })
  query = query.order('id', { ascending: true })

  if (opts.paginate !== false) {
    const from = (q.page - 1) * q.size
    query = query.range(from, from + q.size - 1)
  } else if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }

  const rows = normaliseJoins((data ?? []) as unknown as KeywordSetRow[], ['owner']).map(normaliseKeywordSet)

  // Term counts in one extra round trip rather than one per row (no N+1).
  if (rows.length) {
    const { data: terms } = await supabase
      .from('studio_keyword_terms').select('set_id')
      .eq('workspace_id', workspaceId).in('set_id', rows.map(r => r.id)).limit(20_000)
    const tally = new Map<string, number>()
    for (const t of terms ?? []) tally.set(t.set_id, (tally.get(t.set_id) ?? 0) + 1)
    for (const row of rows) row.term_count = tally.get(row.id) ?? row.hashtags?.length ?? 0
  }

  return { rows, total: count ?? 0, error: null }
}

export async function getKeywordSet(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<{ row: KeywordSetRow | null; terms: KeywordTermRow[]; error: string | null }> {
  const [set, terms] = await Promise.all([
    supabase.from('hashtag_sets').select(KEYWORD_COLUMNS)
      .eq('workspace_id', workspaceId).eq('id', id).maybeSingle(),
    supabase.from('studio_keyword_terms')
      .select('id, set_id, term, kind, avg_volume, competition, growth_30d, relevance, source')
      .eq('workspace_id', workspaceId).eq('set_id', id)
      .order('avg_volume', { ascending: false, nullsFirst: false }).limit(500),
  ])

  if (set.error) return { row: null, terms: [], error: set.error.message }
  if (!set.data) return { row: null, terms: [], error: null }

  return {
    row: normaliseKeywordSet(normaliseJoins([set.data as unknown as KeywordSetRow], ['owner'])[0]!),
    terms: ((terms.data ?? []) as KeywordTermRow[]).map(normaliseTerm),
    error: null,
  }
}

export async function listBlockedTerms(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ rows: BlockedTermRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('studio_blocked_terms').select('id, term, reason, created_at')
    .eq('workspace_id', workspaceId).order('term', { ascending: true }).limit(500)
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as BlockedTermRow[], error: null }
}

export async function keywordCounts(supabase: SupabaseClient, workspaceId: string): Promise<KeywordCounts> {
  const empty: KeywordCounts = {
    activeClusters: 0, hashtagSets: 0, recommendedHashtags: 0, trendingTerms: 0,
    savedGroups: 0, blockedTerms: 0, avgGrowth: null, trends: {}, error: null,
  }

  const [sets, terms, blocked] = await Promise.all([
    supabase.from('hashtag_sets').select('kind, status, growth_30d, hashtags, favourite, created_at')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(5_000),
    supabase.from('studio_keyword_terms').select('kind, growth_30d, created_at')
      .eq('workspace_id', workspaceId).limit(20_000),
    supabase.from('studio_blocked_terms').select('created_at')
      .eq('workspace_id', workspaceId).limit(5_000),
  ])

  if (sets.error) return { ...empty, error: sets.error.message }

  // Each KPI compares today's total with the total 30 days ago (total minus
  // what was added in the last 30 days), so the delta is real growth.
  const since = Date.now() - 30 * 86_400_000
  const trends: KeywordCounts['trends'] = {}
  const add = (key: string, iso: string, by = 1) => {
    const bucket = (trends[key] ??= { current: 0, previous: 0 })
    bucket.current += by
    if (new Date(iso).getTime() <= since) bucket.previous += by
  }

  let growthTotal = 0, growthCount = 0
  const counts = { ...empty, blockedTerms: blocked.data?.length ?? 0, trends }

  for (const row of sets.data ?? []) {
    if (row.kind === 'cluster' && row.status === 'active') { counts.activeClusters += 1; add('active', row.created_at) }
    if (row.kind === 'set') counts.hashtagSets += 1
    if (row.favourite) { counts.savedGroups += 1; add('saved', row.created_at) }
    counts.recommendedHashtags += row.hashtags?.length ?? 0
    add('hashtags', row.created_at, row.hashtags?.length ?? 0)
    const growth = toNum(row.growth_30d)
    if (growth !== null) { growthTotal += growth; growthCount += 1 }
  }

  for (const row of terms.data ?? []) {
    if (row.kind === 'hashtag') { counts.recommendedHashtags += 1; add('hashtags', row.created_at) }
    const growth = toNum(row.growth_30d)
    if (growth !== null && growth > 0) { counts.trendingTerms += 1; add('trending', row.created_at) }
  }
  for (const row of blocked.data ?? []) add('blocked', row.created_at)

  counts.avgGrowth = growthCount > 0 ? Math.round((growthTotal / growthCount) * 10) / 10 : null
  return counts
}

/**
 * Recommendation buckets derived from the workspace's own term data.
 * These are workspace signals, not live search-volume from an external
 * provider — the UI labels them as estimates for that reason.
 */
export async function keywordRecommendations(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{
  trending: KeywordTermRow[]
  lowCompetition: KeywordTermRow[]
  underused: KeywordTermRow[]
  audience: { term: string; lift: number; posts: number }[]
  error: string | null
}> {
  const [{ data, error }, posts] = await Promise.all([
    supabase
      .from('studio_keyword_terms')
      .select('id, set_id, term, kind, avg_volume, competition, growth_30d, relevance, source')
      .eq('workspace_id', workspaceId).limit(2_000),
    supabase.from('content_posts').select('hashtags, engagement')
      .eq('workspace_id', workspaceId).eq('status', 'published').not('hashtags', 'is', null).limit(2_000),
  ])

  if (error) return { trending: [], lowCompetition: [], underused: [], audience: [], error: error.message }

  // Audience favourites: hashtags whose published posts beat the workspace's
  // average engagement rate ((likes + comments + shares) / views).
  const rate = (e: Record<string, number> | null) => {
    const views = Number(e?.views ?? 0)
    return views > 0 ? (Number(e?.likes ?? 0) + Number(e?.comments ?? 0) + Number(e?.shares ?? 0)) / views : null
  }
  const scored = (posts.data ?? []).map(p => ({ tags: (p.hashtags ?? []) as string[], rate: rate(p.engagement as Record<string, number> | null) }))
    .filter((p): p is { tags: string[]; rate: number } => p.rate !== null)
  const baseline = scored.length ? scored.reduce((s, p) => s + p.rate, 0) / scored.length : 0
  const byTag = new Map<string, number[]>()
  for (const p of scored) for (const t of p.tags) byTag.set(t, [...(byTag.get(t) ?? []), p.rate])
  const audience = baseline > 0
    ? [...byTag].filter(([, rates]) => rates.length >= 2)
      .map(([term, rates]) => ({ term, posts: rates.length, lift: Math.round(((rates.reduce((s, r) => s + r, 0) / rates.length) / baseline - 1) * 1000) / 10 }))
      .filter(t => t.lift > 0).sort((a, b) => b.lift - a.lift).slice(0, 3)
    : []

  const rows = ((data ?? []) as KeywordTermRow[]).map(normaliseTerm)
  return {
    audience,
    trending: [...rows].filter(r => (r.growth_30d ?? 0) > 0)
      .sort((a, b) => (b.growth_30d ?? 0) - (a.growth_30d ?? 0)).slice(0, 3),
    lowCompetition: [...rows].filter(r => r.competition !== null && r.competition < 0.35)
      .sort((a, b) => (a.competition ?? 1) - (b.competition ?? 1)).slice(0, 3),
    underused: [...rows].filter(r => (r.avg_volume ?? 0) > 0 && (r.competition ?? 1) < 0.5)
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0)).slice(0, 3),
    error: null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════════════════════════════════════════

const MEDIA_SORTS: Record<string, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  updated_asc: { column: 'updated_at', ascending: true },
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  title_asc: { column: 'file_name', ascending: true },
  title_desc: { column: 'file_name', ascending: false },
  size_desc: { column: 'file_size', ascending: false, nullsFirst: false },
}

export async function listMedia(
  supabase: SupabaseClient,
  workspaceId: string,
  q: StudioQuery,
  opts: { paginate?: boolean; limit?: number } = {},
): Promise<MediaPage> {
  let query = supabase
    .from('media_assets')
    .select(MEDIA_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  query = q.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

  if (q.status) query = query.eq('status', q.status)
  // Type comes from the MIME type: the shared media table is also written by
  // Brand & Assets, whose `file_type` uses a different taxonomy.
  if (q.type === 'image' || q.type === 'video' || q.type === 'audio') query = query.like('mime_type', `${q.type}/%`)
  else if (q.type === 'document') query = query.or('mime_type.like.application/pdf,mime_type.like.application/vnd.openxmlformats%,mime_type.like.application/msword,mime_type.like.application/vnd.ms-%,mime_type.like.text/%')
  else if (q.type === 'other') query = query.or('mime_type.is.null,and(mime_type.not.like.image/%,mime_type.not.like.video/%,mime_type.not.like.audio/%,mime_type.not.like.application/pdf,mime_type.not.like.application/vnd.openxmlformats%,mime_type.not.like.text/%)')
  if (q.collection) query = query.eq('collection_id', q.collection)
  if (q.owner) query = query.eq('owner_id', q.owner)
  if (q.tag) query = query.contains('tags', [q.tag])
  if (q.from) query = query.gte('created_at', `${q.from}T00:00:00.000Z`)
  if (q.to) query = query.lte('created_at', `${q.to}T23:59:59.999Z`)

  const term = sanitiseSearch(q.q)
  if (term) query = query.or(`file_name.ilike.%${term}%,description.ilike.%${term}%,alt_text.ilike.%${term}%`)

  const sort = MEDIA_SORTS[q.sort] ?? MEDIA_SORTS.created_desc
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: sort.nullsFirst ?? sort.ascending })
  query = query.order('id', { ascending: true })

  if (opts.paginate !== false) {
    const from = (q.page - 1) * q.size
    query = query.range(from, from + q.size - 1)
  } else if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return {
    rows: normaliseJoins((data ?? []) as unknown as MediaRow[], ['owner', 'collection']),
    total: count ?? 0,
    error: null,
  }
}

export async function getMediaAsset(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<{ row: MediaRow | null; versions: AssetVersionRow[]; error: string | null }> {
  const [asset, versions] = await Promise.all([
    supabase.from('media_assets').select(MEDIA_COLUMNS)
      .eq('workspace_id', workspaceId).eq('id', id).maybeSingle(),
    supabase.from('studio_asset_versions')
      .select('id, version, file_url, file_size, note, created_at, author:profiles!studio_asset_versions_replaced_by_fkey(id, full_name, email, avatar_url)')
      .eq('workspace_id', workspaceId).eq('asset_id', id)
      .order('version', { ascending: false }).limit(20),
  ])

  if (asset.error) return { row: null, versions: [], error: asset.error.message }
  if (!asset.data) return { row: null, versions: [], error: null }

  return {
    row: normaliseJoins([asset.data as unknown as MediaRow], ['owner', 'collection'])[0],
    versions: normaliseJoins((versions.data ?? []) as unknown as AssetVersionRow[], ['author']),
    error: null,
  }
}

export async function listMediaCollections(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ rows: MediaCollectionRow[]; error: string | null }> {
  const [collections, assets] = await Promise.all([
    supabase.from('studio_media_collections').select('id, name, description, kind')
      .eq('workspace_id', workspaceId).is('archived_at', null)
      .order('name', { ascending: true }).limit(200),
    supabase.from('media_assets').select('collection_id')
      .eq('workspace_id', workspaceId).is('archived_at', null)
      .not('collection_id', 'is', null).limit(20_000),
  ])

  if (collections.error) return { rows: [], error: collections.error.message }

  const tally = new Map<string, number>()
  for (const row of assets.data ?? []) {
    if (row.collection_id) tally.set(row.collection_id, (tally.get(row.collection_id) ?? 0) + 1)
  }

  return {
    rows: (collections.data ?? []).map(row => ({ ...row, asset_count: tally.get(row.id) ?? 0 })) as MediaCollectionRow[],
    error: null,
  }
}

export async function mediaCounts(supabase: SupabaseClient, workspaceId: string): Promise<MediaCounts> {
  const { data, error } = await supabase
    .from('media_assets').select('status, file_size, created_at, usage_count')
    .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000)

  const empty = { total: 0, newUploads: 0, ready: 0, needsReview: 0, storageBytes: 0, linked: 0, totalPrev: 0, newUploadsPrev: 0, linkedPrev: 0 }
  if (error) return { ...empty, error: error.message }

  const monthStart = startOfMonth()
  const lastMonthStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString() })()
  const counts: MediaCounts = { ...empty, error: null }

  for (const row of data ?? []) {
    const before = row.created_at < monthStart
    counts.total += 1
    if (before) counts.totalPrev += 1
    counts.storageBytes += row.file_size ?? 0
    if (!before) counts.newUploads += 1
    else if (row.created_at >= lastMonthStart) counts.newUploadsPrev += 1
    if (row.status === 'ready') counts.ready += 1
    if (row.status === 'needs_review' || row.status === 'changes_requested') counts.needsReview += 1
    if ((row.usage_count ?? 0) > 0) { counts.linked += 1; if (before) counts.linkedPrev += 1 }
  }

  return counts
}

/** Assets attached to one content record, in display order. */
export async function listContentAssets(
  supabase: SupabaseClient, workspaceId: string, contentId: string,
): Promise<{ rows: MediaRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('studio_content_assets')
    .select(`position, asset:media_assets(${MEDIA_COLUMNS})`)
    .eq('workspace_id', workspaceId).eq('content_id', contentId)
    .order('position', { ascending: true })

  if (error) return { rows: [], error: error.message }
  const rows = (data ?? [])
    .map(row => firstOf(row.asset as never) as MediaRow | null)
    .filter((row): row is MediaRow => row !== null)
  return { rows: normaliseJoins(rows, ['owner', 'collection']), error: null }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI GENERATE
// ═══════════════════════════════════════════════════════════════════════════

export async function listAiOutputs(
  supabase: SupabaseClient,
  workspaceId: string,
  q: StudioQuery,
  opts: { paginate?: boolean; limit?: number; batchId?: string; types?: string[]; userId?: string } = {},
): Promise<AiOutputPage> {
  let query = supabase
    .from('ai_generations')
    .select(AI_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  if (opts.batchId) query = query.eq('batch_id', opts.batchId)
  if (opts.types?.length) query = query.in('type', opts.types)
  if (opts.userId) query = query.eq('user_id', opts.userId)
  if (!q.status) query = query.neq('status', 'discarded')
  if (q.status) query = query.eq('status', q.status)
  if (q.channel) query = query.or(`channel.eq.${q.channel},platform.eq.${q.channel}`)

  const term = sanitiseSearch(q.q)
  if (term) query = query.or(`topic.ilike.%${term}%,output.ilike.%${term}%,prompt.ilike.%${term}%`)

  query = query.order('created_at', { ascending: false }).order('id', { ascending: true })

  if (opts.paginate !== false) {
    const from = (q.page - 1) * q.size
    query = query.range(from, from + q.size - 1)
  } else if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error, count } = await query
  if (error) return { rows: [], total: 0, error: error.message }
  return {
    rows: normaliseJoins((data ?? []) as unknown as AiOutputRow[], ['author']),
    total: count ?? 0,
    error: null,
  }
}

export async function listPrompts(
  supabase: SupabaseClient, workspaceId: string, limit = 20,
): Promise<{ rows: PromptRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('studio_prompts')
    .select('id, name, prompt, channel, tone, objective, audience, usage_count, created_at, updated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('updated_at', { ascending: false }).limit(limit)
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as PromptRow[], error: null }
}

/**
 * AI usage and credit state. Credits are the workspace's monthly AI generation
 * allowance from the plan — the same number the generate action enforces, so
 * the meter and the guard can never disagree.
 */
export async function aiCounts(
  supabase: SupabaseClient, workspaceId: string, monthlyLimit: number,
): Promise<AiCounts> {
  const empty: AiCounts = {
    generationsToday: 0, generationsYesterday: 0, savedOutputs: 0, regenerationRate: 0,
    promptTemplates: 0, accepted: 0, acceptedRate: 0, creditsUsed: 0,
    creditsLimit: monthlyLimit, savedYesterday: 0, savedToday: 0, regenerationRateYesterday: 0,
    promptsCreatedToday: 0, acceptedRateYesterday: 0, error: null,
  }

  const [gens, prompts] = await Promise.all([
    supabase.from('ai_generations').select('status, bookmarked, created_at, batch_id')
      .eq('workspace_id', workspaceId).gte('created_at', startOfMonth()).limit(20_000),
    supabase.from('studio_prompts').select('created_at')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(5000),
  ])

  if (gens.error) return { ...empty, error: gens.error.message }

  const today = startOfDay()
  const yesterday = startOfDay(-1)
  const promptRows = prompts.data ?? []
  const counts = { ...empty, promptTemplates: promptRows.length, promptsCreatedToday: promptRows.filter(p => p.created_at >= today).length }
  const batches = new Map<string, number>()
  const priorBatches = new Map<string, number>()
  let priorTotal = 0
  let priorAccepted = 0

  for (const row of gens.data ?? []) {
    counts.creditsUsed += 1
    if (row.created_at >= today) counts.generationsToday += 1
    else if (row.created_at >= yesterday) counts.generationsYesterday += 1
    if (row.status === 'used') counts.accepted += 1
    if (row.bookmarked || row.status === 'used') {
      counts.savedOutputs += 1
      if (row.created_at >= today) counts.savedToday += 1
      else if (row.created_at >= yesterday) counts.savedYesterday += 1
    }
    if (row.batch_id) batches.set(row.batch_id, (batches.get(row.batch_id) ?? 0) + 1)
    if (row.created_at < today) {
      priorTotal += 1
      if (row.status === 'used') priorAccepted += 1
      if (row.batch_id) priorBatches.set(row.batch_id, (priorBatches.get(row.batch_id) ?? 0) + 1)
    }
  }
  const priorRegenerated = [...priorBatches.values()].filter(n => n > 1).length
  counts.regenerationRateYesterday = priorBatches.size > 0 ? Math.round((priorRegenerated / priorBatches.size) * 1000) / 10 : 0
  counts.acceptedRateYesterday = priorTotal > 0 ? Math.round((priorAccepted / priorTotal) * 1000) / 10 : 0

  // A batch with more than one output is a regeneration or a variation set.
  const regenerated = [...batches.values()].filter(n => n > 1).length
  counts.regenerationRate = batches.size > 0 ? Math.round((regenerated / batches.size) * 1000) / 10 : 0
  counts.acceptedRate = counts.creditsUsed > 0 ? Math.round((counts.accepted / counts.creditsUsed) * 1000) / 10 : 0

  return counts
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════

export async function listStudioActivity(
  supabase: SupabaseClient, workspaceId: string, limit = 12, entityType?: string, entityId?: string,
): Promise<{ rows: ActivityRow[]; error: string | null }> {
  let query = supabase
    .from('studio_activity')
    .select('id, entity_type, entity_id, action, summary, link, created_at, actor:profiles!studio_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) return { rows: [], error: error.message }
  return { rows: normaliseJoins((data ?? []) as unknown as ActivityRow[], ['actor']), error: null }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED LOOKUPS
// ═══════════════════════════════════════════════════════════════════════════

/** Workspace members, for the Owner filter and assignment selects. */
export async function listWorkspacePeople(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ id: string; label: string }[]> {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, profile:profiles!workspace_members_user_id_fkey(id, full_name, email)')
    .eq('workspace_id', workspaceId).limit(200)

  return (data ?? [])
    .map(row => firstOf(row.profile as never) as { id: string; full_name: string | null; email: string | null } | null)
    .filter((p): p is { id: string; full_name: string | null; email: string | null } => p !== null)
    .map(p => ({ id: p.id, label: p.full_name ?? p.email ?? 'Unknown' }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Active campaigns, for the Campaign filter and the composer select. */
export async function listWorkspaceCampaigns(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from('campaigns').select('id, name')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('name', { ascending: true }).limit(200)
  return (data ?? []) as { id: string; name: string }[]
}

/** Connected channels, so the composer only offers channels this workspace has. */
export interface PreviewAccount { platform: string; name: string; handle: string; avatar_url: string | null; followers: number | null }

/** The first connected account per platform, used to label live channel previews. */
export async function listPreviewAccounts(
  supabase: SupabaseClient, workspaceId: string,
): Promise<Record<string, PreviewAccount>> {
  const { data } = await supabase
    .from('social_channels').select('platform, account_name, handle, avatar_url, follower_count, created_at')
    .eq('workspace_id', workspaceId).is('disconnected_at', null)
    .order('created_at', { ascending: true }).limit(50)
  const out: Record<string, PreviewAccount> = {}
  for (const row of data ?? []) {
    const platform = String(row.platform)
    if (out[platform]) continue
    out[platform] = {
      platform, name: row.account_name ?? row.handle ?? platform, handle: row.handle ?? row.account_name ?? '',
      avatar_url: row.avatar_url ?? null, followers: row.follower_count ?? null,
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

export interface WindowCount { current: number; previous: number }
export interface OverviewStats {
  drafts: number
  review: number
  scheduledThisWeek: number
  aiOutputs: number
  trend: { drafts: WindowCount; review: WindowCount; scheduled: WindowCount; ai: WindowCount }
  pipeline: { ideation: number; draft: number; pending_approval: number; approved: number; scheduledWeek: number; publishedMonth: number }
  totalContent: number
  error: string | null
}

/**
 * Overview KPIs and pipeline in three parallel round trips. Every delta compares
 * the last 7 days with the 7 days before, from real timestamps — never a
 * stored or random percentage.
 */
export async function overviewStats(supabase: SupabaseClient, workspaceId: string): Promise<OverviewStats> {
  const since14 = startOfDay(-14)
  const [posts, ai, ideas] = await Promise.all([
    supabase.from('content_posts').select('status, created_at, updated_at, scheduled_at, published_at')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000),
    supabase.from('ai_generations').select('created_at')
      .eq('workspace_id', workspaceId).gte('created_at', startOfDay(-30)).limit(20_000),
    supabase.from('content_ideas').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).is('archived_at', null).not('stage', 'in', '(converted,archived)'),
  ])

  const zero = () => ({ current: 0, previous: 0 })
  const empty: OverviewStats = {
    drafts: 0, review: 0, scheduledThisWeek: 0, aiOutputs: 0,
    trend: { drafts: zero(), review: zero(), scheduled: zero(), ai: zero() },
    pipeline: { ideation: 0, draft: 0, pending_approval: 0, approved: 0, scheduledWeek: 0, publishedMonth: 0 },
    totalContent: 0, error: null,
  }
  if (posts.error) return { ...empty, error: posts.error.message }

  const now = Date.now()
  const d7 = now - 7 * 86_400_000
  const d14 = new Date(since14).getTime()
  const week = now + 7 * 86_400_000
  const month = new Date(startOfMonth()).getTime()
  const stats = { ...empty, trend: { drafts: zero(), review: zero(), scheduled: zero(), ai: zero() }, pipeline: { ...empty.pipeline } }
  const bucket = (w: WindowCount, iso: string | null) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    if (t >= d7 && t <= now) w.current += 1
    else if (t >= d14 && t < d7) w.previous += 1
  }

  for (const row of posts.data ?? []) {
    stats.totalContent += 1
    if (row.status === 'draft') { stats.drafts += 1; stats.pipeline.draft += 1; bucket(stats.trend.drafts, row.created_at) }
    if (row.status === 'pending_approval') { stats.review += 1; stats.pipeline.pending_approval += 1; bucket(stats.trend.review, row.updated_at) }
    if (row.status === 'approved') stats.pipeline.approved += 1
    if (row.status === 'scheduled' && row.scheduled_at) {
      const t = new Date(row.scheduled_at).getTime()
      if (t >= now && t <= week) { stats.scheduledThisWeek += 1; stats.pipeline.scheduledWeek += 1 }
      bucket(stats.trend.scheduled, row.updated_at)
    }
    if (row.status === 'published' && row.published_at && new Date(row.published_at).getTime() >= month) stats.pipeline.publishedMonth += 1
  }
  stats.trend.scheduled.current = Math.max(stats.trend.scheduled.current, 0)

  for (const row of ai.data ?? []) {
    stats.aiOutputs += 1
    bucket(stats.trend.ai, row.created_at)
  }
  stats.pipeline.ideation = ideas.count ?? 0
  return stats
}

export async function listWorkspaceChannels(
  supabase: SupabaseClient, workspaceId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('social_channels').select('platform')
    .eq('workspace_id', workspaceId).limit(50)
  const set = new Set((data ?? []).map(row => String(row.platform)))
  return [...set]
}

export interface ResumableDraft { id: string; caption: string; platforms: string[]; assetIds: string[] }

/**
 * The signed-in user's most recently edited draft, so the Overview quick
 * composer resumes real work instead of starting blank. Only drafts the user
 * created are resumed — never someone else's in-progress copy.
 */
export async function latestOwnDraft(
  supabase: SupabaseClient, workspaceId: string, userId: string, origin: 'quick_composer' | 'compose' = 'quick_composer',
): Promise<ResumableDraft | null> {
  let query = supabase.from('content_posts').select('id, caption, platforms, hashtags')
    .eq('workspace_id', workspaceId).eq('created_by', userId).eq('status', 'draft').is('archived_at', null)
  query = origin === 'quick_composer' ? query.eq('metadata->>origin', 'quick_composer') : query.or('metadata->>origin.is.null,metadata->>origin.neq.quick_composer')
  const { data } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  const { data: links } = await supabase.from('studio_content_assets').select('asset_id')
    .eq('workspace_id', workspaceId).eq('content_id', data.id).order('position', { ascending: true }).limit(10)
  // Hashtags are stored alongside the caption; the composer edits them inline.
  const caption = data.caption ?? ''
  const missing = ((data.hashtags ?? []) as string[]).filter(tag => !caption.toLowerCase().includes(tag.toLowerCase()))
  return {
    id: data.id, caption: missing.length ? `${caption.trimEnd()}

${missing.join(' ')}` : caption, platforms: (data.platforms ?? []) as string[],
    assetIds: (links ?? []).map(l => l.asset_id as string),
  }
}

export interface ComposeStats {
  drafts: WindowCount & { total: number }
  review: WindowCount & { total: number }
  scheduledToday: WindowCount & { total: number }
  needsAssets: WindowCount & { total: number }
  aiSuggestions: WindowCount & { total: number }
  blockers: WindowCount & { total: number }
  error: string | null
}

/**
 * Compose KPI strip. Every figure and delta is derived from real timestamps:
 * weekly windows compare the last 7 days with the 7 before; "scheduled today"
 * compares with yesterday. Blockers are drafts sent back for changes plus
 * reviews waiting longer than 48 hours and failed publishes.
 */
export async function composeStats(supabase: SupabaseClient, workspaceId: string): Promise<ComposeStats> {
  const zero = () => ({ current: 0, previous: 0, total: 0 })
  const empty: ComposeStats = {
    drafts: zero(), review: zero(), scheduledToday: zero(), needsAssets: zero(), aiSuggestions: zero(), blockers: zero(), error: null,
  }
  const [posts, links, ai] = await Promise.all([
    supabase.from('content_posts').select('id, status, created_at, updated_at, scheduled_at')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000),
    supabase.from('studio_content_assets').select('content_id').eq('workspace_id', workspaceId).limit(20_000),
    supabase.from('ai_generations').select('status, created_at')
      .eq('workspace_id', workspaceId).gte('created_at', startOfDay(-14)).limit(20_000),
  ])
  if (posts.error) return { ...empty, error: posts.error.message }

  const now = Date.now()
  const day = 86_400_000
  const today = new Date(startOfDay(0)).getTime()
  const withAssets = new Set((links.data ?? []).map(l => l.content_id as string))
  const stats: ComposeStats = { ...empty, drafts: zero(), review: zero(), scheduledToday: zero(), needsAssets: zero(), aiSuggestions: zero(), blockers: zero() }
  const week = (w: WindowCount, iso: string | null) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    if (t > now - 7 * day) w.current += 1
    else if (t > now - 14 * day) w.previous += 1
  }

  for (const row of posts.data ?? []) {
    if (row.status === 'draft') {
      stats.drafts.total += 1; week(stats.drafts, row.created_at)
      if (!withAssets.has(row.id)) { stats.needsAssets.total += 1; week(stats.needsAssets, row.created_at) }
    }
    if (row.status === 'pending_approval') {
      stats.review.total += 1; week(stats.review, row.updated_at)
      if (new Date(row.updated_at).getTime() < now - 2 * day) { stats.blockers.total += 1; week(stats.blockers, row.updated_at) }
    }
    if (row.status === 'failed') { stats.blockers.total += 1; week(stats.blockers, row.updated_at) }
    if (row.status === 'scheduled' && row.scheduled_at) {
      const t = new Date(row.scheduled_at).getTime()
      if (t >= today && t < today + day) stats.scheduledToday.current += 1
      if (t >= today - day && t < today) stats.scheduledToday.previous += 1
    }
  }
  stats.scheduledToday.total = stats.scheduledToday.current

  for (const row of ai.data ?? []) {
    if (row.status !== 'draft') continue
    stats.aiSuggestions.total += new Date(row.created_at).getTime() > now - 7 * day ? 1 : 0
    week(stats.aiSuggestions, row.created_at)
  }
  return stats
}

/** One idea by id, scoped to the workspace; null when missing or not visible. */
export async function getOrNullIdea(supabase: SupabaseClient, workspaceId: string, id: string): Promise<IdeaRow | null> {
  const { data } = await supabase.from('content_ideas').select(IDEA_COLUMNS).eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return data ? normaliseJoins([data as unknown as IdeaRow], ['owner', 'collection'])[0]! : null
}

export interface TemplatePerformance {
  points: TemplateUsagePoint[]
  uses: WindowCount
  drafts: WindowCount
  published: WindowCount
  error: string | null
}

/**
 * Template performance over a window, compared with the window before it:
 * how often it was used, how many drafts it produced and how many of those
 * were published. Every figure comes from usage events and content records.
 */
export async function templatePerformance(
  supabase: SupabaseClient, workspaceId: string, templateId: string, days = 30,
): Promise<TemplatePerformance> {
  const since = startOfDay(-days * 2)
  const cut = new Date(startOfDay(-days)).getTime()
  const [usage, posts] = await Promise.all([
    supabase.from('studio_template_usage').select('created_at, content_id')
      .eq('workspace_id', workspaceId).eq('template_id', templateId).gte('created_at', since).limit(10_000),
    supabase.from('content_posts').select('published_at, status')
      .eq('workspace_id', workspaceId).eq('template_id', templateId).eq('status', 'published').gte('published_at', since).limit(10_000),
  ])
  const empty = { current: 0, previous: 0 }
  if (usage.error) return { points: [], uses: empty, drafts: empty, published: empty, error: usage.error.message }

  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i -= 1) buckets.set(startOfDay(-i).slice(0, 10), 0)
  const uses = { current: 0, previous: 0 }
  const drafts = { current: 0, previous: 0 }
  for (const row of usage.data ?? []) {
    const recent = new Date(row.created_at).getTime() >= cut
    const key = row.created_at.slice(0, 10)
    if (recent && buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
    uses[recent ? 'current' : 'previous'] += 1
    if (row.content_id) drafts[recent ? 'current' : 'previous'] += 1
  }
  const published = { current: 0, previous: 0 }
  for (const row of posts.data ?? []) {
    if (!row.published_at) continue
    published[new Date(row.published_at).getTime() >= cut ? 'current' : 'previous'] += 1
  }
  return { points: [...buckets].map(([date, count]) => ({ date, uses: count })), uses, drafts, published, error: null }
}

/**
 * Fills 	humbnail_url from each post's first attached media when the post has
 * no stored thumbnail. One query for the whole page (no N+1). Paths stay as
 * storage paths so signStudioMedia signs them.
 */
export async function withContentCovers(supabase: SupabaseClient, workspaceId: string, rows: ContentRow[]): Promise<ContentRow[]> {
  const missing = rows.filter(r => !r.thumbnail_url).map(r => r.id)
  if (missing.length === 0) return rows
  const { data } = await supabase.from('studio_content_assets')
    .select('content_id, position, asset:media_assets(thumbnail_path, file_url, mime_type)')
    .eq('workspace_id', workspaceId).in('content_id', missing).order('position', { ascending: true }).limit(missing.length * 10)
  const covers = new Map<string, string>()
  for (const link of data ?? []) {
    if (covers.has(link.content_id)) continue
    const asset = firstOf(link.asset as never) as { thumbnail_path: string | null; file_url: string; mime_type: string | null } | null
    const cover = asset?.thumbnail_path ?? (asset?.mime_type?.startsWith('image/') ? asset.file_url : null)
    if (cover) covers.set(link.content_id, cover)
  }
  return rows.map(r => (r.thumbnail_url ? r : { ...r, thumbnail_url: covers.get(r.id) ?? null }))
}
/** Daily volume history per keyword group, oldest first, padded to `days` points. */
export async function keywordSeries(
  supabase: SupabaseClient, workspaceId: string, setIds: string[], days = 30,
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  if (setIds.length === 0) return out
  const since = startOfDay(-(days - 1)).slice(0, 10)
  const { data } = await supabase.from('studio_keyword_metrics_daily').select('set_id, day, avg_volume')
    .eq('workspace_id', workspaceId).in('set_id', setIds).gte('day', since).order('day', { ascending: true }).limit(setIds.length * days)
  for (const row of data ?? []) out.set(row.set_id, [...(out.get(row.set_id) ?? []), Number(row.avg_volume)])
  return out
}

export interface EngagementWindow { views: number; likes: number; comments: number; shares: number }

/** Engagement summed over the last `days` days per post, from the daily history table. */
export async function engagementWindow(
  supabase: SupabaseClient, workspaceId: string, postIds: string[], days = 7,
): Promise<Map<string, EngagementWindow>> {
  const out = new Map<string, EngagementWindow>()
  if (postIds.length === 0) return out
  const since = startOfDay(-(days - 1)).slice(0, 10)
  const { data } = await supabase.from('content_engagement_daily').select('post_id, views, likes, comments, shares')
    .eq('workspace_id', workspaceId).in('post_id', postIds).gte('day', since).limit(postIds.length * days)
  for (const row of data ?? []) {
    const cur = out.get(row.post_id) ?? { views: 0, likes: 0, comments: 0, shares: 0 }
    out.set(row.post_id, { views: cur.views + row.views, likes: cur.likes + row.likes, comments: cur.comments + row.comments, shares: cur.shares + row.shares })
  }
  return out
}