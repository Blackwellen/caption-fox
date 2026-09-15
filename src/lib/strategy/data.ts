// Strategy data layer. Every function is workspace-scoped by an explicit
// `.eq('workspace_id', …)` *and* guarded again by RLS, so a missing filter can
// never leak another tenant's rows. Errors are returned, never thrown, so a
// single failing panel degrades to its error state instead of the whole route.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StrategyQuery } from './query'
import { PRIORITY_RANK, type StrategyPriority } from './constants'
import type {
  ActivityRow, AssumptionRow, AttributeRow, AudienceMetricRow, AudienceRow,
  ApprovalRow, CapacityRow, ClaimRow, CompetitorRow, CompetitorScoreRow,
  FindingRow, ForecastPeriodRow, ForecastRow, FrameworkRow, HealthSnapshotRow,
  LinkedRef, MessagingAssetRow, ObjectiveRow, PersonaRow, PillarRow,
  PlanDependencyRow, PlanItemRow, PlanRiskRow, PlanRow, ProofPointRow,
  RegionRow, ResearchCollectionRow, ResearchRow, ScenarioRow, StrategyRecordRow,
} from './types'

/* eslint-disable @typescript-eslint/no-explicit-any -- the Supabase builder is
   re-assigned across conditional filters, which its generics cannot model. */
type Builder = any

export interface Page<T> { rows: T[]; total: number; error: string | null }

const EMPTY = <T>(error: string | null = null): Page<T> => ({ rows: [], total: 0, error })

/** Escapes a user search term for a PostgREST `or(...)` filter. */
function term(value: string): string {
  return value.replace(/[%,()*]/g, ' ').trim()
}

function dateRange(q: StrategyQuery, startCol: string, endCol: string, builder: Builder): Builder {
  let b = builder
  if (q.from) b = b.or(`${endCol}.is.null,${endCol}.gte.${q.from}`)
  if (q.to) b = b.or(`${startCol}.is.null,${startCol}.lte.${q.to}`)
  return b
}

// ── Strategy records ─────────────────────────────────────────────────────────

const STRATEGY_COLUMNS = `
  id, workspace_id, name, description, status, health_score, owner_id,
  start_date, end_date, archived_at, created_at, updated_at,
  owner:profiles!strategy_records_owner_id_fkey(id, full_name, email, avatar_url)
`

export async function listStrategyRecords(
  supabase: SupabaseClient, workspaceId: string, opts: { includeArchived?: boolean } = {},
): Promise<Page<StrategyRecordRow>> {
  let builder = supabase.from('strategy_records')
    .select(STRATEGY_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder
  if (!opts.includeArchived) builder = builder.is('archived_at', null)

  const { data, error, count } = await builder.order('name', { ascending: true })
  if (error) return EMPTY<StrategyRecordRow>(error.message)
  return { rows: (data ?? []) as unknown as StrategyRecordRow[], total: count ?? 0, error: null }
}

// ── Objectives ───────────────────────────────────────────────────────────────

const OBJECTIVE_COLUMNS = `
  id, workspace_id, strategy_id, name, description, objective_type, status, progress,
  confidence, priority, target_summary, next_action, owner_id, start_date, due_date,
  tags, archived_at, created_at, updated_at,
  owner:profiles!strategy_objectives_owner_id_fkey(id, full_name, email, avatar_url),
  strategy:strategy_records!strategy_objectives_strategy_id_fkey(id, name)
`

const SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  due_soonest: { column: 'due_date', ascending: true },
  due_latest: { column: 'due_date', ascending: false },
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  updated: { column: 'updated_at', ascending: false },
  progress_desc: { column: 'progress', ascending: false },
  confidence_desc: { column: 'confidence', ascending: false },
  size_desc: { column: 'audience_size', ascending: false },
  fit_desc: { column: 'fit_score', ascending: false },
  priority: { column: 'updated_at', ascending: false },
}

function sortFor(sort: string, fallback: string): { column: string; ascending: boolean } {
  return SORT_COLUMNS[sort] ?? SORT_COLUMNS[fallback] ?? SORT_COLUMNS.updated
}

/** Priority is semantic, so it sorts in code after the query returns. */
function applyPrioritySort<T extends { priority?: string }>(rows: T[], sort: string): T[] {
  if (sort !== 'priority') return rows
  return [...rows].sort((a, b) =>
    (PRIORITY_RANK[(a.priority ?? 'medium') as StrategyPriority] ?? 9)
    - (PRIORITY_RANK[(b.priority ?? 'medium') as StrategyPriority] ?? 9))
}

export async function listObjectives(
  supabase: SupabaseClient, workspaceId: string, q: StrategyQuery,
  opts: { limit?: number; paginate?: boolean; statuses?: string[] } = {},
): Promise<Page<ObjectiveRow>> {
  const sort = sortFor(q.sort, 'due_soonest')
  let builder = supabase.from('strategy_objectives')
    .select(OBJECTIVE_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder

  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  const search = term(q.q)
  if (search) builder = builder.or(`name.ilike.%${search}%,description.ilike.%${search}%,next_action.ilike.%${search}%`)
  if (q.status) builder = builder.eq('status', q.status)
  if (opts.statuses?.length) builder = builder.in('status', opts.statuses)
  if (q.type) builder = builder.eq('objective_type', q.type)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.strategy) builder = builder.eq('strategy_id', q.strategy)
  if (q.priority) builder = builder.eq('priority', q.priority)
  if (q.tag) builder = builder.contains('tags', [q.tag])
  builder = dateRange(q, 'start_date', 'due_date', builder)

  builder = builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    // Stable secondary key so pagination never duplicates or skips a record.
    .order('id', { ascending: true })

  if (opts.paginate) {
    const start = (q.page - 1) * q.size
    builder = builder.range(start, start + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, error, count } = await builder
  if (error) return EMPTY<ObjectiveRow>(error.message)
  return {
    rows: applyPrioritySort((data ?? []) as unknown as ObjectiveRow[], q.sort),
    total: count ?? 0,
    error: null,
  }
}

export async function getObjective(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<ObjectiveRow | null> {
  const { data } = await supabase.from('strategy_objectives')
    .select(OBJECTIVE_COLUMNS).eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as ObjectiveRow) ?? null
}

/** Status counts across the *unfiltered* workspace — the KPI row and donut. */
export async function objectiveStatusCounts(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ counts: Record<string, number>; total: number; error: string | null }> {
  const { data, error } = await supabase.from('strategy_objectives')
    .select('status, confidence, due_date, progress')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  if (error) return { counts: {}, total: 0, error: error.message }
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return { counts, total: (data ?? []).length, error: null }
}

/** Average confidence, used by the Objectives KPI strip. */
export async function objectiveAggregates(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase.from('strategy_objectives')
    .select('status, confidence, progress, updated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  const rows = (data ?? []) as { status: string; confidence: number; progress: number }[]
  const total = rows.length
  const avgConfidence = total ? Math.round(rows.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / total) : 0
  const avgProgress = total ? Math.round(rows.reduce((sum, r) => sum + (r.progress ?? 0), 0) / total) : 0
  return { total, avgConfidence, avgProgress, rows }
}

// ── Links ────────────────────────────────────────────────────────────────────

type LinkRow = { source_type: string; source_id: string; target_type: string; target_id: string }

/**
 * Resolves `strategy_links` for a set of source records into display refs.
 * Runs one query per target table rather than per record, so a page with 24
 * objectives still issues a constant number of queries (no N+1).
 */
export async function resolveLinks(
  supabase: SupabaseClient, workspaceId: string,
  sourceType: string, sourceIds: string[],
): Promise<Record<string, { audiences: LinkedRef[]; plans: LinkedRef[]; objectives: LinkedRef[]; research: LinkedRef[] }>> {
  const result: Record<string, { audiences: LinkedRef[]; plans: LinkedRef[]; objectives: LinkedRef[]; research: LinkedRef[] }> = {}
  for (const id of sourceIds) result[id] = { audiences: [], plans: [], objectives: [], research: [] }
  if (sourceIds.length === 0) return result

  // Links are stored one-way but read both ways, so a link created from either
  // side shows on both records.
  const [{ data: outbound }, { data: inbound }] = await Promise.all([
    supabase.from('strategy_links').select('source_type, source_id, target_type, target_id')
      .eq('workspace_id', workspaceId).eq('source_type', sourceType).in('source_id', sourceIds),
    supabase.from('strategy_links').select('source_type, source_id, target_type, target_id')
      .eq('workspace_id', workspaceId).eq('target_type', sourceType).in('target_id', sourceIds),
  ])

  const pairs: { owner: string; type: string; id: string }[] = []
  for (const row of (outbound ?? []) as LinkRow[]) pairs.push({ owner: row.source_id, type: row.target_type, id: row.target_id })
  for (const row of (inbound ?? []) as LinkRow[]) pairs.push({ owner: row.target_id, type: row.source_type, id: row.source_id })

  const TABLES: Record<string, { table: string; column: string; bucket: 'audiences' | 'plans' | 'objectives' | 'research' }> = {
    audience: { table: 'strategy_audiences', column: 'name', bucket: 'audiences' },
    plan: { table: 'strategy_plans', column: 'name', bucket: 'plans' },
    objective: { table: 'strategy_objectives', column: 'name', bucket: 'objectives' },
    research: { table: 'strategy_research_items', column: 'title', bucket: 'research' },
  }

  const byType = new Map<string, Set<string>>()
  for (const pair of pairs) {
    if (!TABLES[pair.type]) continue
    if (!byType.has(pair.type)) byType.set(pair.type, new Set())
    byType.get(pair.type)!.add(pair.id)
  }

  const names = new Map<string, string>()
  await Promise.all([...byType.entries()].map(async ([type, ids]) => {
    const spec = TABLES[type]
    const { data } = await (supabase.from(spec.table) as Builder)
      .select(`id, ${spec.column}`).eq('workspace_id', workspaceId).in('id', [...ids])
    for (const row of ((data ?? []) as Record<string, string>[])) {
      names.set(`${type}:${row.id}`, row[spec.column])
    }
  }))

  for (const pair of pairs) {
    const spec = TABLES[pair.type]
    if (!spec || !result[pair.owner]) continue
    const name = names.get(`${pair.type}:${pair.id}`)
    if (!name) continue
    const bucket = result[pair.owner][spec.bucket]
    if (!bucket.some(item => item.id === pair.id)) bucket.push({ id: pair.id, name })
  }

  return result
}

// ── Audiences ────────────────────────────────────────────────────────────────

const AUDIENCE_COLUMNS = `
  id, workspace_id, name, description, status, lifecycle_stage, audience_size,
  growth_rate, fit_score, data_completeness, channels, tags, source, owner_id,
  archived_at, created_at, updated_at,
  owner:profiles!strategy_audiences_owner_id_fkey(id, full_name, email, avatar_url)
`

export async function listAudiences(
  supabase: SupabaseClient, workspaceId: string, q: StrategyQuery,
  opts: { limit?: number; paginate?: boolean; ids?: string[] } = {},
): Promise<Page<AudienceRow>> {
  const sort = sortFor(q.sort, 'size_desc')
  let builder = supabase.from('strategy_audiences')
    .select(AUDIENCE_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder

  if (opts.ids?.length) builder = builder.in('id', opts.ids)
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  const search = term(q.q)
  if (search) builder = builder.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.lifecycle) builder = builder.eq('lifecycle_stage', q.lifecycle)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.channel) builder = builder.contains('channels', [q.channel])
  if (q.tag) builder = builder.contains('tags', [q.tag])
  if (q.completeness === 'complete') builder = builder.gte('data_completeness', 90)
  if (q.completeness === 'partial') builder = builder.gte('data_completeness', 50).lt('data_completeness', 90)
  if (q.completeness === 'missing') builder = builder.lt('data_completeness', 50)

  builder = builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (opts.paginate) {
    const start = (q.page - 1) * q.size
    builder = builder.range(start, start + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, error, count } = await builder
  if (error) return EMPTY<AudienceRow>(error.message)
  let rows = (data ?? []) as unknown as AudienceRow[]

  // Region is a child-table filter, so it narrows the result set after the
  // fetch rather than forcing a join the sort cannot use.
  if (q.region) {
    const { data: regionRows } = await supabase.from('strategy_audience_regions')
      .select('audience_id').eq('workspace_id', workspaceId).eq('country_code', q.region)
    const allowed = new Set(((regionRows ?? []) as { audience_id: string }[]).map(r => r.audience_id))
    rows = rows.filter(row => allowed.has(row.id))
  }
  if (q.persona) {
    const { data: personaRows } = await supabase.from('strategy_audience_personas')
      .select('audience_id').eq('workspace_id', workspaceId).ilike('name', `%${term(q.persona)}%`)
    const allowed = new Set(((personaRows ?? []) as { audience_id: string }[]).map(r => r.audience_id))
    rows = rows.filter(row => allowed.has(row.id))
  }

  return { rows, total: q.region || q.persona ? rows.length : count ?? 0, error: null }
}

/** Personas + regions for a batch of audiences — one query each, never per row. */
export async function hydrateAudiences(
  supabase: SupabaseClient, workspaceId: string, rows: AudienceRow[],
): Promise<AudienceRow[]> {
  if (rows.length === 0) return rows
  const ids = rows.map(row => row.id)

  const [{ data: personas }, { data: regions }, links] = await Promise.all([
    supabase.from('strategy_audience_personas')
      .select('id, audience_id, name, summary, share_pct, avatar_url, sort_order')
      .eq('workspace_id', workspaceId).in('audience_id', ids).order('sort_order'),
    supabase.from('strategy_audience_regions')
      .select('id, audience_id, country_code, country_name, share_pct, audience_size')
      .eq('workspace_id', workspaceId).in('audience_id', ids).order('share_pct', { ascending: false }),
    resolveLinks(supabase, workspaceId, 'audience', ids),
  ])

  const personaBy = new Map<string, PersonaRow[]>()
  for (const row of (personas ?? []) as unknown as PersonaRow[]) {
    if (!personaBy.has(row.audience_id)) personaBy.set(row.audience_id, [])
    personaBy.get(row.audience_id)!.push(row)
  }
  const regionBy = new Map<string, RegionRow[]>()
  for (const row of (regions ?? []) as unknown as RegionRow[]) {
    if (!regionBy.has(row.audience_id)) regionBy.set(row.audience_id, [])
    regionBy.get(row.audience_id)!.push(row)
  }

  return rows.map(row => ({
    ...row,
    personas: personaBy.get(row.id) ?? [],
    regions: regionBy.get(row.id) ?? [],
    linkedObjectives: links[row.id]?.objectives ?? [],
  }))
}

export async function listAudienceMetrics(
  supabase: SupabaseClient, workspaceId: string, groups: string[], audienceIds?: string[],
): Promise<AudienceMetricRow[]> {
  let builder = supabase.from('strategy_audience_metrics')
    .select('id, audience_id, metric_group, metric_key, metric_label, metric_value, metric_date')
    .eq('workspace_id', workspaceId).in('metric_group', groups) as Builder
  if (audienceIds?.length) builder = builder.in('audience_id', audienceIds)
  const { data } = await builder.order('metric_date', { ascending: true, nullsFirst: true })
  return (data ?? []) as unknown as AudienceMetricRow[]
}

/** Workspace-wide geographic rollup for the Map view — aggregated, never per person. */
export async function audienceGeography(supabase: SupabaseClient, workspaceId: string) {
  const { data, error } = await supabase.from('strategy_audience_regions')
    .select('country_code, country_name, audience_size, share_pct')
    .eq('workspace_id', workspaceId)

  if (error) return { rows: [], countries: 0, error: error.message }
  const totals = new Map<string, { code: string; name: string; size: number }>()
  for (const row of (data ?? []) as { country_code: string; country_name: string; audience_size: number }[]) {
    const current = totals.get(row.country_code)
    if (current) current.size += row.audience_size
    else totals.set(row.country_code, { code: row.country_code, name: row.country_name, size: row.audience_size })
  }
  const rows = [...totals.values()].sort((a, b) => b.size - a.size)
  return { rows, countries: rows.length, error: null }
}

export async function audienceAggregates(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase.from('strategy_audiences')
    .select('status, audience_size, fit_score, data_completeness, growth_rate')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  const rows = (data ?? []) as { status: string; audience_size: number; fit_score: number; data_completeness: number }[]
  const total = rows.length
  const active = rows.filter(row => row.status === 'active').length
  const totalSize = rows.reduce((sum, row) => sum + Number(row.audience_size ?? 0), 0)
  const avgFit = total ? Math.round(rows.reduce((sum, row) => sum + row.fit_score, 0) / total) : 0
  const avgCompleteness = total ? Math.round(rows.reduce((sum, row) => sum + row.data_completeness, 0) / total) : 0
  return { total, active, totalSize, avgFit, avgCompleteness, missingPct: Math.max(0, 100 - avgCompleteness) }
}

// ── Research ─────────────────────────────────────────────────────────────────

const RESEARCH_COLUMNS = `
  id, workspace_id, collection_id, title, summary, source_type, impact, confidence,
  status, theme, is_favourite, tags, file_path, file_name, file_type, file_size,
  owner_id, created_by, reviewed_by, reviewed_at, review_note, archived_at,
  created_at, updated_at,
  owner:profiles!strategy_research_items_owner_id_fkey(id, full_name, email, avatar_url),
  collection:strategy_research_collections!strategy_research_items_collection_id_fkey(id, name)
`

export async function listResearch(
  supabase: SupabaseClient, workspaceId: string, q: StrategyQuery,
  opts: { limit?: number; paginate?: boolean; statuses?: string[]; mine?: string } = {},
): Promise<Page<ResearchRow>> {
  const sort = sortFor(q.sort, 'updated')
  let builder = supabase.from('strategy_research_items')
    .select(RESEARCH_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder

  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  const search = term(q.q)
  if (search) builder = builder.or(`title.ilike.%${search}%,summary.ilike.%${search}%,theme.ilike.%${search}%`)
  if (q.source) builder = builder.eq('source_type', q.source)
  if (q.impact) builder = builder.eq('impact', q.impact)
  if (q.status) builder = builder.eq('status', q.status)
  if (opts.statuses?.length) builder = builder.in('status', opts.statuses)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.collection) builder = builder.eq('collection_id', q.collection)
  if (q.tag) builder = builder.contains('tags', [q.tag])
  if (q.favourites) builder = builder.eq('is_favourite', true)
  if (opts.mine) builder = builder.eq('created_by', opts.mine)
  // Confidence is stored 0–100 but filtered as a band.
  if (q.confidence === 'high') builder = builder.gte('confidence', 75)
  if (q.confidence === 'medium') builder = builder.gte('confidence', 45).lt('confidence', 75)
  if (q.confidence === 'low') builder = builder.lt('confidence', 45)

  builder = builder
    .order(sort.column === 'due_date' ? 'updated_at' : sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (opts.paginate) {
    const start = (q.page - 1) * q.size
    builder = builder.range(start, start + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, error, count } = await builder
  if (error) return EMPTY<ResearchRow>(error.message)
  return { rows: (data ?? []) as unknown as ResearchRow[], total: count ?? 0, error: null }
}

export async function listCollections(
  supabase: SupabaseClient, workspaceId: string,
): Promise<ResearchCollectionRow[]> {
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from('strategy_research_collections')
      .select('id, workspace_id, name, description, created_at')
      .eq('workspace_id', workspaceId).order('name'),
    supabase.from('strategy_research_items')
      .select('collection_id').eq('workspace_id', workspaceId).is('archived_at', null),
  ])

  const tally = new Map<string, number>()
  for (const row of (counts ?? []) as { collection_id: string | null }[]) {
    if (row.collection_id) tally.set(row.collection_id, (tally.get(row.collection_id) ?? 0) + 1)
  }
  return ((data ?? []) as unknown as ResearchCollectionRow[])
    .map(row => ({ ...row, item_count: tally.get(row.id) ?? 0 }))
}

export async function researchAggregates(supabase: SupabaseClient, workspaceId: string) {
  const [{ data: live }, { count: archived }] = await Promise.all([
    supabase.from('strategy_research_items')
      .select('status, impact, confidence, source_type, theme, is_favourite, created_by')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('strategy_research_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).not('archived_at', 'is', null),
  ])

  const rows = (live ?? []) as { status: string; impact: string; confidence: number; source_type: string; theme: string | null }[]
  const total = rows.length
  const highImpact = rows.filter(row => row.impact === 'high').length
  const pendingReview = rows.filter(row => row.status === 'in_review').length
  const avgConfidence = total ? Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / total) : 0

  const sourceMix = new Map<string, number>()
  for (const row of rows) sourceMix.set(row.source_type, (sourceMix.get(row.source_type) ?? 0) + 1)

  const themes = new Map<string, number>()
  for (const row of rows) {
    if (row.impact === 'high' && row.theme) themes.set(row.theme, (themes.get(row.theme) ?? 0) + 1)
  }

  return {
    total, highImpact, pendingReview, avgConfidence,
    archived: archived ?? 0,
    sourceMix: [...sourceMix.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value),
    themes: [...themes.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6),
  }
}

export async function listFindings(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<FindingRow[]> {
  const { data } = await supabase.from('strategy_research_findings')
    .select('id, workspace_id, research_id, headline, detail, impact, created_at, research:strategy_research_items!strategy_research_findings_research_id_fkey(id, title)')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as FindingRow[]
}

export async function listAllTags(supabase: SupabaseClient, workspaceId: string): Promise<string[]> {
  const { data } = await supabase.from('strategy_research_items')
    .select('tags').eq('workspace_id', workspaceId).is('archived_at', null)
  const tags = new Set<string>()
  for (const row of (data ?? []) as { tags: string[] }[]) for (const tag of row.tags ?? []) tags.add(tag)
  return [...tags].sort()
}

// ── Positioning ──────────────────────────────────────────────────────────────

const FRAMEWORK_COLUMNS = `
  id, workspace_id, name, category_promise, foundation, positioning_statement,
  target_audience_id, is_primary, version, status, consistency_score, owner_id,
  archived_at, created_at, updated_at,
  owner:profiles!strategy_positioning_frameworks_owner_id_fkey(id, full_name, email, avatar_url),
  audience:strategy_audiences!strategy_positioning_frameworks_target_audience_id_fkey(id, name)
`

export async function listFrameworks(
  supabase: SupabaseClient, workspaceId: string, q: StrategyQuery,
): Promise<Page<FrameworkRow>> {
  let builder = supabase.from('strategy_positioning_frameworks')
    .select(FRAMEWORK_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder

  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  const search = term(q.q)
  if (search) builder = builder.or(`name.ilike.%${search}%,category_promise.ilike.%${search}%`)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.audience) builder = builder.eq('target_audience_id', q.audience)
  if (q.framework) builder = builder.eq('id', q.framework)

  const { data, error, count } = await builder
    .order('is_primary', { ascending: false }).order('name', { ascending: true })
  if (error) return EMPTY<FrameworkRow>(error.message)
  return { rows: (data ?? []) as unknown as FrameworkRow[], total: count ?? 0, error: null }
}

export async function getFrameworkDetail(
  supabase: SupabaseClient, workspaceId: string, frameworkId: string,
) {
  const [pillars, proofPoints, claims, competitors, attributes, scores, approvals] = await Promise.all([
    supabase.from('strategy_positioning_pillars')
      .select('id, framework_id, name, description, icon, sort_order')
      .eq('workspace_id', workspaceId).eq('framework_id', frameworkId).order('sort_order'),
    supabase.from('strategy_proof_points')
      .select('id, workspace_id, framework_id, label, category, impact, verification, evidence_research_id, sort_order, created_at, updated_at')
      .eq('workspace_id', workspaceId).eq('framework_id', frameworkId).order('sort_order'),
    supabase.from('strategy_claims')
      .select('id, workspace_id, framework_id, claim, risk_level, rationale, sort_order')
      .eq('workspace_id', workspaceId).eq('framework_id', frameworkId).order('sort_order'),
    supabase.from('strategy_competitors')
      .select('id, workspace_id, framework_id, name, is_self, website, notes, sort_order')
      .eq('workspace_id', workspaceId).eq('framework_id', frameworkId).order('sort_order'),
    supabase.from('strategy_competitor_attributes')
      .select('id, workspace_id, framework_id, name, sort_order')
      .eq('workspace_id', workspaceId).eq('framework_id', frameworkId).order('sort_order'),
    supabase.from('strategy_competitor_scores')
      .select('id, competitor_id, attribute_id, score, note').eq('workspace_id', workspaceId),
    supabase.from('strategy_approvals')
      .select('id, workspace_id, entity_type, entity_id, stage, status, requested_by, approver_id, comment, due_date, requested_at, decided_at, sort_order, approver:profiles!strategy_approvals_approver_id_fkey(id, full_name, email, avatar_url)')
      .eq('workspace_id', workspaceId).eq('entity_type', 'framework').eq('entity_id', frameworkId)
      .order('sort_order'),
  ])

  return {
    pillars: (pillars.data ?? []) as unknown as PillarRow[],
    proofPoints: (proofPoints.data ?? []) as unknown as ProofPointRow[],
    claims: (claims.data ?? []) as unknown as ClaimRow[],
    competitors: (competitors.data ?? []) as unknown as CompetitorRow[],
    attributes: (attributes.data ?? []) as unknown as AttributeRow[],
    scores: (scores.data ?? []) as unknown as CompetitorScoreRow[],
    approvals: (approvals.data ?? []) as unknown as ApprovalRow[],
  }
}

export async function listMessagingAssets(
  supabase: SupabaseClient, workspaceId: string, limit = 8,
): Promise<MessagingAssetRow[]> {
  const { data } = await supabase.from('strategy_messaging_assets')
    .select('id, workspace_id, framework_id, name, asset_type, audience_id, status, file_path, file_name, owner_id, updated_at, audience:strategy_audiences!strategy_messaging_assets_audience_id_fkey(id, name), framework:strategy_positioning_frameworks!strategy_messaging_assets_framework_id_fkey(id, name)')
    .eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as MessagingAssetRow[]
}

export async function positioningAggregates(supabase: SupabaseClient, workspaceId: string) {
  const [{ data: frameworks }, { data: proofPoints }, { data: assets }, { data: claims }, { data: approvals }, { data: scores }] = await Promise.all([
    supabase.from('strategy_positioning_frameworks').select('id, status, consistency_score')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('strategy_proof_points').select('id, verification').eq('workspace_id', workspaceId),
    supabase.from('strategy_messaging_assets').select('id, status').eq('workspace_id', workspaceId),
    supabase.from('strategy_claims').select('id, risk_level').eq('workspace_id', workspaceId),
    supabase.from('strategy_approvals').select('id, status').eq('workspace_id', workspaceId).eq('status', 'pending'),
    supabase.from('strategy_competitor_scores').select('id, score').eq('workspace_id', workspaceId),
  ])

  const frameworkRows = (frameworks ?? []) as { status: string; consistency_score: number }[]
  const proofRows = (proofPoints ?? []) as { verification: string }[]
  const assetRows = (assets ?? []) as { status: string }[]
  const scoreRows = (scores ?? []) as { score: string }[]

  const activeFrameworks = frameworkRows.filter(row => row.status !== 'archived').length
  const approvedAssets = assetRows.filter(row => row.status === 'approved').length
  const verified = proofRows.filter(row => row.verification === 'verified').length
  const consistency = frameworkRows.length
    ? Math.round(frameworkRows.reduce((sum, row) => sum + row.consistency_score, 0) / frameworkRows.length)
    : 0

  return {
    activeFrameworks,
    approvedAssets, totalAssets: assetRows.length,
    proofCoverage: proofRows.length ? Math.round((verified / proofRows.length) * 100) : 0,
    // A competitor "gap" is any attribute we score weak or N/A against.
    competitorGaps: scoreRows.filter(row => row.score === 'weak' || row.score === 'na').length,
    consistency,
    pendingApprovals: (approvals ?? []).length,
    highRiskClaims: ((claims ?? []) as { risk_level: string }[]).filter(row => row.risk_level === 'high').length,
  }
}

// ── Plans ────────────────────────────────────────────────────────────────────

const PLAN_COLUMNS = `
  id, workspace_id, strategy_id, name, description, status, progress, budget,
  budget_spent, currency, owner_id, start_date, end_date, archived_at,
  created_at, updated_at,
  owner:profiles!strategy_plans_owner_id_fkey(id, full_name, email, avatar_url)
`

export async function listPlans(
  supabase: SupabaseClient, workspaceId: string, q: StrategyQuery,
  opts: { limit?: number; paginate?: boolean } = {},
): Promise<Page<PlanRow>> {
  const sort = sortFor(q.sort, 'due_soonest')
  let builder = supabase.from('strategy_plans')
    .select(PLAN_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder

  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  const search = term(q.q)
  if (search) builder = builder.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.strategy) builder = builder.eq('strategy_id', q.strategy)
  builder = dateRange(q, 'start_date', 'end_date', builder)

  builder = builder
    .order(sort.column === 'due_date' ? 'start_date' : sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (opts.paginate) {
    const start = (q.page - 1) * q.size
    builder = builder.range(start, start + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, error, count } = await builder
  if (error) return EMPTY<PlanRow>(error.message)
  return { rows: (data ?? []) as unknown as PlanRow[], total: count ?? 0, error: null }
}

/** Plan items for a set of plans — one query, then grouped in memory. */
export async function listPlanItems(
  supabase: SupabaseClient, workspaceId: string, planIds: string[],
): Promise<PlanItemRow[]> {
  if (planIds.length === 0) return []
  const { data } = await supabase.from('strategy_plan_items')
    .select('id, workspace_id, plan_id, parent_id, title, item_type, status, priority, progress, owner_id, start_date, due_date, notes, sort_order, updated_at, owner:profiles!strategy_plan_items_owner_id_fkey(id, full_name, email, avatar_url), plan:strategy_plans!strategy_plan_items_plan_id_fkey(id, name)')
    .eq('workspace_id', workspaceId).in('plan_id', planIds)
    .order('sort_order').order('start_date', { nullsFirst: false })
  return (data ?? []) as unknown as PlanItemRow[]
}

export async function listUpcomingMilestones(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<PlanItemRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase.from('strategy_plan_items')
    .select('id, workspace_id, plan_id, parent_id, title, item_type, status, priority, progress, owner_id, start_date, due_date, notes, sort_order, updated_at, plan:strategy_plans!strategy_plan_items_plan_id_fkey(id, name)')
    .eq('workspace_id', workspaceId).eq('item_type', 'milestone')
    .neq('status', 'completed').gte('due_date', today)
    .order('due_date', { ascending: true }).limit(limit)
  return (data ?? []) as unknown as PlanItemRow[]
}

export async function listPlanDependencies(
  supabase: SupabaseClient, workspaceId: string, limit = 10,
): Promise<PlanDependencyRow[]> {
  const { data } = await supabase.from('strategy_plan_dependencies')
    .select('id, workspace_id, plan_id, depends_on_plan_id, label, risk_level, blocked_items, plan:strategy_plans!strategy_plan_dependencies_plan_id_fkey(id, name), dependsOn:strategy_plans!strategy_plan_dependencies_depends_on_plan_id_fkey(id, name)')
    .eq('workspace_id', workspaceId).order('risk_level', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as PlanDependencyRow[]
}

export async function listPlanRisks(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
): Promise<PlanRiskRow[]> {
  const { data } = await supabase.from('strategy_plan_risks')
    .select('id, workspace_id, plan_id, title, detail, severity, status, created_at, plan:strategy_plans!strategy_plan_risks_plan_id_fkey(id, name)')
    .eq('workspace_id', workspaceId).neq('status', 'resolved')
    .order('severity', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as PlanRiskRow[]
}

export async function listCapacity(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CapacityRow[]> {
  const { data } = await supabase.from('strategy_plan_capacity')
    .select('id, period_start, allocated, capacity')
    .eq('workspace_id', workspaceId).order('period_start')
  return (data ?? []) as unknown as CapacityRow[]
}

export async function planAggregates(supabase: SupabaseClient, workspaceId: string) {
  const monthEnd = new Date()
  monthEnd.setMonth(monthEnd.getMonth() + 1)

  const [{ data: plans }, { data: items }, { data: deps }] = await Promise.all([
    supabase.from('strategy_plans').select('status, progress, budget, budget_spent')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('strategy_plan_items').select('item_type, status, due_date')
      .eq('workspace_id', workspaceId),
    supabase.from('strategy_plan_dependencies').select('risk_level').eq('workspace_id', workspaceId),
  ])

  const planRows = (plans ?? []) as { status: string; progress: number; budget: number | null; budget_spent: number }[]
  const itemRows = (items ?? []) as { item_type: string; status: string; due_date: string | null }[]
  const depRows = (deps ?? []) as { risk_level: string }[]

  const statusCounts: Record<string, number> = {}
  for (const row of planRows) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1

  const horizon = monthEnd.toISOString().slice(0, 10)
  const milestonesDue = itemRows.filter(row =>
    row.item_type === 'milestone' && row.status !== 'completed' && row.due_date && row.due_date <= horizon).length
  const blocked = itemRows.filter(row => row.status === 'blocked').length

  const budget = planRows.reduce((sum, row) => sum + Number(row.budget ?? 0), 0)
  const spent = planRows.reduce((sum, row) => sum + Number(row.budget_spent ?? 0), 0)
  const completion = planRows.length
    ? Math.round(planRows.reduce((sum, row) => sum + row.progress, 0) / planRows.length) : 0

  const highRiskDeps = depRows.filter(row => row.risk_level === 'high').length
  const dependencyRisk = highRiskDeps > 2 ? 'High' : highRiskDeps > 0 ? 'Medium' : 'Low'

  return {
    activePlans: planRows.filter(row => row.status !== 'archived' && row.status !== 'completed').length,
    total: planRows.length,
    statusCounts,
    milestonesDue,
    blocked,
    completion,
    // "Aligned" means spend is at or under budget; 100% when nothing is budgeted.
    budgetAlignment: budget > 0 ? Math.max(0, Math.min(100, Math.round(100 - ((spent - budget) / budget) * 100))) : 100,
    dependencyRisk,
    highRiskDeps,
  }
}

export async function listHighPriorityItems(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
): Promise<PlanItemRow[]> {
  const { data } = await supabase.from('strategy_plan_items')
    .select('id, workspace_id, plan_id, parent_id, title, item_type, status, priority, progress, owner_id, start_date, due_date, notes, sort_order, updated_at, owner:profiles!strategy_plan_items_owner_id_fkey(id, full_name, email, avatar_url), plan:strategy_plans!strategy_plan_items_plan_id_fkey(id, name)')
    .eq('workspace_id', workspaceId).in('priority', ['high', 'urgent']).neq('status', 'completed')
    .order('due_date', { ascending: true, nullsFirst: false }).limit(limit)
  return (data ?? []) as unknown as PlanItemRow[]
}

// ── Forecasts ────────────────────────────────────────────────────────────────

const FORECAST_COLUMNS = `
  id, workspace_id, strategy_id, name, description, metric, currency, period_start,
  period_end, target_value, confidence, risk_level, status, owner_id,
  last_recalculated_at, archived_at, created_at, updated_at,
  owner:profiles!strategy_forecasts_owner_id_fkey(id, full_name, email, avatar_url)
`

export async function listForecasts(
  supabase: SupabaseClient, workspaceId: string, q: StrategyQuery,
): Promise<Page<ForecastRow>> {
  let builder = supabase.from('strategy_forecasts')
    .select(FORECAST_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId) as Builder

  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  const search = term(q.q)
  if (search) builder = builder.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.strategy) builder = builder.eq('strategy_id', q.strategy)
  if (q.from) builder = builder.gte('period_end', q.from)
  if (q.to) builder = builder.lte('period_start', q.to)

  const { data, error, count } = await builder
    .order('period_start', { ascending: false }).order('id', { ascending: true })
  if (error) return EMPTY<ForecastRow>(error.message)
  return { rows: (data ?? []) as unknown as ForecastRow[], total: count ?? 0, error: null }
}

export async function getForecastDetail(
  supabase: SupabaseClient, workspaceId: string, forecastId: string,
) {
  const [scenarios, periods, assumptions] = await Promise.all([
    supabase.from('strategy_forecast_scenarios')
      .select('id, workspace_id, forecast_id, name, scenario_type, is_expected, probability, forecast_value, range_low, range_high, drivers, risks, last_recalculated_at, sort_order')
      .eq('workspace_id', workspaceId).eq('forecast_id', forecastId).order('sort_order'),
    supabase.from('strategy_forecast_periods')
      .select('id, forecast_id, scenario_id, period_label, period_date, target_value, forecast_value, actual_value')
      .eq('workspace_id', workspaceId).eq('forecast_id', forecastId).order('period_date'),
    supabase.from('strategy_forecast_assumptions')
      .select('id, workspace_id, forecast_id, label, value_text, numeric_value, unit, confidence, sort_order, updated_at')
      .eq('workspace_id', workspaceId).eq('forecast_id', forecastId).order('sort_order'),
  ])

  return {
    scenarios: (scenarios.data ?? []) as unknown as ScenarioRow[],
    periods: (periods.data ?? []) as unknown as ForecastPeriodRow[],
    assumptions: (assumptions.data ?? []) as unknown as AssumptionRow[],
  }
}

/** Workspace-wide forecast rollup used by both Overview and the Forecasts KPIs. */
export async function forecastAggregates(supabase: SupabaseClient, workspaceId: string) {
  const { data: forecasts } = await supabase.from('strategy_forecasts')
    .select('id, target_value, confidence, risk_level, currency, metric, last_recalculated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null).eq('status', 'active')

  const rows = (forecasts ?? []) as {
    id: string; target_value: number; confidence: string; risk_level: string
    currency: string; metric: string; last_recalculated_at: string | null
  }[]
  if (rows.length === 0) {
    return {
      count: 0, target: 0, expected: 0, best: 0, downside: 0, variancePct: 0,
      confidence: 'medium', risk: 'medium', currency: 'GBP', lastRecalculated: null as string | null,
    }
  }

  const { data: scenarios } = await supabase.from('strategy_forecast_scenarios')
    .select('forecast_id, scenario_type, is_expected, forecast_value')
    .eq('workspace_id', workspaceId).in('forecast_id', rows.map(row => row.id))

  const scenarioRows = (scenarios ?? []) as { scenario_type: string; is_expected: boolean; forecast_value: number }[]
  const sum = (predicate: (row: typeof scenarioRows[number]) => boolean) =>
    scenarioRows.filter(predicate).reduce((total, row) => total + Number(row.forecast_value ?? 0), 0)

  const target = rows.reduce((total, row) => total + Number(row.target_value ?? 0), 0)
  const expected = sum(row => row.is_expected)
  const best = sum(row => row.scenario_type === 'best')
  const downside = sum(row => row.scenario_type === 'downside')

  // Modal confidence across active forecasts, so one outlier cannot flip the KPI.
  const tally = (key: 'confidence' | 'risk_level') => {
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'medium'
  }

  const recalculated = rows.map(row => row.last_recalculated_at).filter(Boolean).sort().at(-1) ?? null

  return {
    count: rows.length, target, expected, best, downside,
    variancePct: target > 0 ? Number((((expected - target) / target) * 100).toFixed(1)) : 0,
    confidence: tally('confidence'),
    risk: tally('risk_level'),
    currency: rows[0].currency ?? 'GBP',
    lastRecalculated: recalculated,
  }
}

/** Periods for the Overview "Forecast vs target" bar chart. */
export async function forecastPeriodSeries(
  supabase: SupabaseClient, workspaceId: string, limit = 12,
): Promise<{ label: string; date: string; forecast: number; target: number }[]> {
  const { data } = await supabase.from('strategy_forecast_periods')
    .select('period_label, period_date, target_value, forecast_value, scenario_id, strategy_forecast_scenarios!inner(is_expected)')
    .eq('workspace_id', workspaceId)
    .eq('strategy_forecast_scenarios.is_expected', true)
    .order('period_date', { ascending: true })

  type Row = { period_label: string; period_date: string; target_value: number; forecast_value: number }
  const grouped = new Map<string, { label: string; date: string; forecast: number; target: number }>()
  for (const row of ((data ?? []) as unknown as Row[])) {
    const key = row.period_date
    const current = grouped.get(key)
    if (current) {
      current.forecast += Number(row.forecast_value ?? 0)
      current.target += Number(row.target_value ?? 0)
    } else {
      grouped.set(key, {
        label: row.period_label, date: row.period_date,
        forecast: Number(row.forecast_value ?? 0), target: Number(row.target_value ?? 0),
      })
    }
  }
  return [...grouped.values()].slice(-limit)
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function listActivity(
  supabase: SupabaseClient, workspaceId: string,
  opts: { limit?: number; entityTypes?: string[]; surface?: string } = {},
): Promise<ActivityRow[]> {
  let builder = supabase.from('strategy_activity')
    .select('id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at, actor:profiles!strategy_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId) as Builder

  if (opts.entityTypes?.length) builder = builder.in('entity_type', opts.entityTypes)
  if (opts.surface) builder = builder.eq('surface', opts.surface)

  const { data } = await builder.order('created_at', { ascending: false }).limit(opts.limit ?? 6)
  return (data ?? []) as unknown as ActivityRow[]
}

/**
 * Writes one activity/audit entry. Never throws — a failed audit write must not
 * roll back the user's successful change, but it is surfaced in server logs.
 */
export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    workspaceId: string; actorId: string; entityType: string; entityId?: string | null
    action: string; summary: string; link?: string | null; surface?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.from('strategy_activity').insert({
    workspace_id: entry.workspaceId,
    actor_id: entry.actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    summary: entry.summary,
    link: entry.link ?? null,
    surface: entry.surface ?? null,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[strategy] activity log failed', error.message)
}

// ── Health snapshots ─────────────────────────────────────────────────────────

export async function listHealthSnapshots(
  supabase: SupabaseClient, workspaceId: string, months = 6,
): Promise<HealthSnapshotRow[]> {
  const { data } = await supabase.from('strategy_health_snapshots')
    .select('id, snapshot_date, health_score, benchmark_score, objectives_on_track, objectives_total')
    .eq('workspace_id', workspaceId).order('snapshot_date', { ascending: true }).limit(months)
  return (data ?? []) as unknown as HealthSnapshotRow[]
}
