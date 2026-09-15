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
  repurposed_from, campaign_id, brand_id, engagement, archived_at, created_at, updated_at,
  ${OWNER_JOIN},
  campaign:campaigns(id, name)
`

const IDEA_COLUMNS = `
  id, title, description, platforms, status, stage, score, source, tags, why_it_works,
  next_step, featured, ai_generated, collection_id, converted_to_post_id, archived_at,
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
  id, file_name, file_path, file_url, file_type, mime_type, file_size, width, height,
  duration_seconds, tags, alt_text, description, status, colour_profile, usage_count, version,
  collection_id, archived_at, created_at, updated_at,
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
    published: 0, failed: 0, archived: 0, scheduledThisWeek: 0, linkedAssets: 0, error: null,
  }

  const [posts, assets] = await Promise.all([
    supabase.from('content_posts').select('status, scheduled_at, media_urls')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000),
    supabase.from('studio_content_assets').select('asset_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
  ])

  if (posts.error) return { ...empty, error: posts.error.message }

  const weekEnd = startOfDay(7)
  const now = new Date().toISOString()
  const counts = { ...empty }

  for (const row of posts.data ?? []) {
    counts.total += 1
    const status = row.status as keyof ContentCounts
    if (status in counts && typeof counts[status] === 'number') {
      (counts[status] as number) += 1
    }
    if (row.status === 'scheduled' && row.scheduled_at && row.scheduled_at >= now && row.scheduled_at <= weekEnd) {
      counts.scheduledThisWeek += 1
    }
    if ((row.media_urls?.length ?? 0) > 0) counts.linkedAssets += 1
  }

  counts.linkedAssets = Math.max(counts.linkedAssets, assets.count ?? 0)
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
  opts: { paginate?: boolean; limit?: number; stage?: string } = {},
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
    .from('content_ideas').select('stage, status, created_at')
    .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000)

  if (error) {
    return { total: 0, byStage: {}, newLast7: 0, savedInspirations: 0, converted: 0, error: error.message }
  }

  const since = startOfDay(-7)
  const byStage: Record<string, number> = {}
  let newLast7 = 0
  let savedInspirations = 0

  for (const row of data ?? []) {
    byStage[row.stage] = (byStage[row.stage] ?? 0) + 1
    if (row.created_at >= since) newLast7 += 1
    if (row.status === 'saved') savedInspirations += 1
  }

  return {
    total: data?.length ?? 0,
    byStage,
    newLast7,
    savedInspirations,
    converted: byStage.converted ?? 0,
    error: null,
  }
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
    return { total: 0, published: 0, brandApproved: 0, needsReview: 0, savedThisMonth: 0, mostUsed: null, error: error.message }
  }

  const monthStart = startOfMonth()
  let published = 0, brandApproved = 0, needsReview = 0, savedThisMonth = 0
  let mostUsed: TemplateCounts['mostUsed'] = null

  for (const row of data ?? []) {
    if (row.status === 'published') published += 1
    if (row.brand_approved) brandApproved += 1
    if (row.status === 'in_review' || row.status === 'changes_requested') needsReview += 1
    if (row.created_at >= monthStart) savedThisMonth += 1
    if (!mostUsed || (row.usage_count ?? 0) > mostUsed.usage_count) {
      mostUsed = { id: row.id, name: row.name, usage_count: row.usage_count ?? 0 }
    }
  }

  return { total: data?.length ?? 0, published, brandApproved, needsReview, savedThisMonth, mostUsed, error: null }
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

  const rows = normaliseJoins((data ?? []) as unknown as KeywordSetRow[], ['owner'])

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
    row: normaliseJoins([set.data as unknown as KeywordSetRow], ['owner'])[0],
    terms: (terms.data ?? []) as KeywordTermRow[],
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
    savedGroups: 0, blockedTerms: 0, avgGrowth: null, error: null,
  }

  const [sets, terms, blocked] = await Promise.all([
    supabase.from('hashtag_sets').select('kind, status, growth_30d, hashtags, favourite')
      .eq('workspace_id', workspaceId).is('archived_at', null).limit(5_000),
    supabase.from('studio_keyword_terms').select('kind, growth_30d')
      .eq('workspace_id', workspaceId).limit(20_000),
    supabase.from('studio_blocked_terms').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
  ])

  if (sets.error) return { ...empty, error: sets.error.message }

  let growthTotal = 0, growthCount = 0
  const counts = { ...empty, blockedTerms: blocked.count ?? 0 }

  for (const row of sets.data ?? []) {
    if (row.kind === 'cluster' && row.status === 'active') counts.activeClusters += 1
    if (row.kind === 'set') counts.hashtagSets += 1
    if (row.favourite) counts.savedGroups += 1
    counts.recommendedHashtags += row.hashtags?.length ?? 0
    if (typeof row.growth_30d === 'number') { growthTotal += row.growth_30d; growthCount += 1 }
  }

  for (const row of terms.data ?? []) {
    if (row.kind === 'hashtag') counts.recommendedHashtags += 1
    if (typeof row.growth_30d === 'number' && row.growth_30d > 0) counts.trendingTerms += 1
  }

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
  error: string | null
}> {
  const { data, error } = await supabase
    .from('studio_keyword_terms')
    .select('id, set_id, term, kind, avg_volume, competition, growth_30d, relevance, source')
    .eq('workspace_id', workspaceId).limit(2_000)

  if (error) return { trending: [], lowCompetition: [], underused: [], error: error.message }

  const rows = (data ?? []) as KeywordTermRow[]
  return {
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
  if (q.type) query = query.eq('file_type', q.type)
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

  if (error) {
    return { total: 0, newUploads: 0, ready: 0, needsReview: 0, storageBytes: 0, linked: 0, error: error.message }
  }

  const monthStart = startOfMonth()
  const counts = { total: 0, newUploads: 0, ready: 0, needsReview: 0, storageBytes: 0, linked: 0, error: null }

  for (const row of data ?? []) {
    counts.total += 1
    counts.storageBytes += row.file_size ?? 0
    if (row.created_at >= monthStart) counts.newUploads += 1
    if (row.status === 'ready') counts.ready += 1
    if (row.status === 'needs_review' || row.status === 'changes_requested') counts.needsReview += 1
    if ((row.usage_count ?? 0) > 0) counts.linked += 1
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
  opts: { paginate?: boolean; limit?: number; batchId?: string } = {},
): Promise<AiOutputPage> {
  let query = supabase
    .from('ai_generations')
    .select(AI_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  if (opts.batchId) query = query.eq('batch_id', opts.batchId)
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
    creditsLimit: monthlyLimit, error: null,
  }

  const [gens, prompts] = await Promise.all([
    supabase.from('ai_generations').select('status, bookmarked, created_at, batch_id')
      .eq('workspace_id', workspaceId).gte('created_at', startOfMonth()).limit(20_000),
    supabase.from('studio_prompts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).is('archived_at', null),
  ])

  if (gens.error) return { ...empty, error: gens.error.message }

  const today = startOfDay()
  const yesterday = startOfDay(-1)
  const counts = { ...empty, promptTemplates: prompts.count ?? 0 }
  const batches = new Map<string, number>()

  for (const row of gens.data ?? []) {
    counts.creditsUsed += 1
    if (row.created_at >= today) counts.generationsToday += 1
    else if (row.created_at >= yesterday) counts.generationsYesterday += 1
    if (row.status === 'used') counts.accepted += 1
    if (row.bookmarked || row.status === 'used') counts.savedOutputs += 1
    if (row.batch_id) batches.set(row.batch_id, (batches.get(row.batch_id) ?? 0) + 1)
  }

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
  supabase: SupabaseClient, workspaceId: string, limit = 12,
): Promise<{ rows: ActivityRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('studio_activity')
    .select('id, entity_type, entity_id, action, summary, link, created_at, actor:profiles!studio_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(limit)
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
export async function listWorkspaceChannels(
  supabase: SupabaseClient, workspaceId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('social_channels').select('platform')
    .eq('workspace_id', workspaceId).limit(50)
  const set = new Set((data ?? []).map(row => String(row.platform)))
  return [...set]
}
