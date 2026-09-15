import type { SupabaseClient } from '@supabase/supabase-js'
import type { CampaignQuery } from './query'
import type {
  ActivityRow, CampaignRow, CompetitionRow, DependencyRow, GiveawayRow,
  MetricPoint, MilestoneRow, PersonLite, PhaseRow, TemplateRow,
} from './types'
import { PRIORITY_RANK, type CampaignPriority } from './constants'

const OWNER_SELECT = 'owner:profiles!campaigns_owner_id_fkey(id, full_name, email, avatar_url)'

const CAMPAIGN_COLUMNS = `
  id, workspace_id, name, description, campaign_type, status, lifecycle_stage, priority,
  health, progress, approval_status, budget, actual_spend, currency, engagements, reach,
  conversions, channels, tags, start_date, end_date, launch_date, thumbnail_url,
  template_id, owner_id, archived_at, created_at, updated_at,
  ${OWNER_SELECT}
`

/** Server-sortable columns. Priority sorts in code because its order is semantic. */
const SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  due_soonest: { column: 'end_date', ascending: true },
  due_latest: { column: 'end_date', ascending: false },
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  updated: { column: 'updated_at', ascending: false },
  budget_desc: { column: 'budget', ascending: false },
  progress_desc: { column: 'progress', ascending: false },
  priority: { column: 'updated_at', ascending: false },
}

/**
 * Structural view of the PostgREST filter builder.
 *
 * The real builder type is deeply generic and changes shape with every select;
 * the filter helper below only ever chains filters and returns `this`, so a
 * self-referential structural alias keeps it type-safe without `any`.
 */
type FilterOps = {
  eq(column: string, value: unknown): FilterOps
  in(column: string, values: readonly unknown[]): FilterOps
  is(column: string, value: unknown): FilterOps
  not(column: string, operator: string, value: unknown): FilterOps
  or(filter: string): FilterOps
  contains(column: string, value: unknown): FilterOps
}

/**
 * Applies the shared Campaigns filter set to a `campaigns` query.
 * Workspace scoping is applied by the caller and enforced again by RLS.
 */
function applyCampaignFilters<T>(query: T, q: CampaignQuery, opts: { types?: string[] } = {}): T {
  // The builder returns itself from every filter call, so narrowing to the
  // filter surface here and widening back preserves the caller's exact type.
  let builder = query as FilterOps

  if (opts.types?.length) builder = builder.in('campaign_type', opts.types)
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)

  if (q.q) {
    const term = q.q.replace(/[%,()]/g, ' ').trim()
    if (term) builder = builder.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (q.type) builder = builder.eq('campaign_type', q.type)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.stage) builder = builder.eq('lifecycle_stage', q.stage)
  if (q.priority) builder = builder.eq('priority', q.priority)
  if (q.health) builder = builder.eq('health', q.health)
  if (q.approval) builder = builder.eq('approval_status', q.approval)
  if (q.channel) builder = builder.contains('channels', [q.channel])
  if (q.tag) builder = builder.contains('tags', [q.tag])
  if (q.from) builder = builder.or(`end_date.is.null,end_date.gte.${q.from}`)
  if (q.to) builder = builder.or(`start_date.is.null,start_date.lte.${q.to}`)

  return builder as T
}

export interface CampaignPage {
  rows: CampaignRow[]
  total: number
  error: string | null
}

export async function listCampaigns(
  supabase: SupabaseClient,
  workspaceId: string,
  q: CampaignQuery,
  opts: { types?: string[]; limit?: number; paginate?: boolean } = {},
): Promise<CampaignPage> {
  const sort = SORT_COLUMNS[q.sort] ?? SORT_COLUMNS.due_soonest
  let builder = applyCampaignFilters(
    supabase.from('campaigns').select(CAMPAIGN_COLUMNS, { count: 'exact' }).eq('workspace_id', workspaceId),
    q, opts,
  )

  builder = builder.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    // Stable secondary key so pagination never duplicates or skips a record.
    .order('id', { ascending: true })

  if (opts.paginate) {
    const start = (q.page - 1) * q.size
    builder = builder.range(start, start + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, error, count } = await builder
  if (error) return { rows: [], total: 0, error: error.message }

  let rows = (data ?? []) as unknown as CampaignRow[]
  if (q.sort === 'priority') {
    rows = [...rows].sort((a, b) =>
      (PRIORITY_RANK[a.priority as CampaignPriority] ?? 9) - (PRIORITY_RANK[b.priority as CampaignPriority] ?? 9))
  }
  return { rows, total: count ?? rows.length, error: null }
}

/** Every campaign matching the filters, used by board / timeline / exports. */
export async function listAllCampaigns(
  supabase: SupabaseClient,
  workspaceId: string,
  q: CampaignQuery,
  opts: { types?: string[]; limit?: number } = {},
): Promise<CampaignPage> {
  return listCampaigns(supabase, workspaceId, q, { ...opts, limit: opts.limit ?? 500 })
}

// ── Aggregates ───────────────────────────────────────────────────────────────

export interface CampaignAggregates {
  total: number
  byStage: Record<string, number>
  byHealth: Record<string, number>
  activeThisMonth: number
  overdue: number
  budgetAtRisk: number
  pendingApprovals: number
  plannedLaunches: number
  upcomingDeadlines: number
  launchingSoon: number
  totalBudget: number
  totalSpend: number
}

/**
 * One pass over the workspace's live campaigns to derive every KPI the
 * Campaigns surfaces show. Selecting only the aggregate columns keeps this
 * cheap even on large workspaces and avoids a KPI-per-query N+1.
 */
export async function campaignAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { types?: string[] } = {},
): Promise<CampaignAggregates> {
  let builder = supabase
    .from('campaigns')
    .select('lifecycle_stage, health, approval_status, budget, actual_spend, start_date, end_date, launch_date, created_at')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
  if (opts.types?.length) builder = builder.in('campaign_type', opts.types)

  const { data } = await builder
  const rows = data ?? []

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000)
  const inFourteenDays = new Date(now.getTime() + 14 * 86_400_000)

  const agg: CampaignAggregates = {
    total: rows.length, byStage: {}, byHealth: {}, activeThisMonth: 0, overdue: 0,
    budgetAtRisk: 0, pendingApprovals: 0, plannedLaunches: 0, upcomingDeadlines: 0,
    launchingSoon: 0, totalBudget: 0, totalSpend: 0,
  }

  for (const row of rows) {
    const stage = row.lifecycle_stage as string
    const health = row.health as string
    agg.byStage[stage] = (agg.byStage[stage] ?? 0) + 1
    agg.byHealth[health] = (agg.byHealth[health] ?? 0) + 1

    const budget = Number(row.budget ?? 0)
    const spend = Number(row.actual_spend ?? 0)
    agg.totalBudget += budget
    agg.totalSpend += spend
    if (budget > 0 && spend > budget * 0.9) agg.budgetAtRisk += 1
    if (row.approval_status === 'pending') agg.pendingApprovals += 1

    const end = row.end_date ? new Date(row.end_date as string) : null
    if (end && end < now && stage !== 'completed') agg.overdue += 1
    if (end && end >= now && end <= inSevenDays) agg.upcomingDeadlines += 1

    const launch = row.launch_date ? new Date(row.launch_date as string) : (row.start_date ? new Date(row.start_date as string) : null)
    if (launch && launch >= now) {
      agg.plannedLaunches += 1
      if (launch <= inFourteenDays) agg.launchingSoon += 1
    }

    const start = row.start_date ? new Date(row.start_date as string) : new Date(row.created_at as string)
    if (start >= monthStart || (end && end >= monthStart)) agg.activeThisMonth += 1
  }

  return agg
}

export function activeCampaignCount(agg: CampaignAggregates): number {
  return (agg.byStage.in_progress ?? 0) + (agg.byStage.live ?? 0)
    + (agg.byStage.scheduled ?? 0) + (agg.byStage.in_review ?? 0)
}

export function onTrackRate(agg: CampaignAggregates): number {
  if (agg.total === 0) return 0
  return Math.round(((agg.byHealth.on_track ?? 0) / agg.total) * 100)
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface MetricSeries {
  points: MetricPoint[]
  engagements: number
  previousEngagements: number
  upliftPercent: number
}

/**
 * Daily engagement / reach / conversion series for the performance chart, plus
 * the equivalent previous window so the uplift KPI is a real comparison.
 */
export async function metricSeries(
  supabase: SupabaseClient,
  workspaceId: string,
  from: string,
  to: string,
): Promise<MetricSeries> {
  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)
  const prevFrom = new Date(Date.parse(from) - spanDays * 86_400_000).toISOString().slice(0, 10)
  const prevTo = new Date(Date.parse(from) - 86_400_000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('campaign_metrics_daily')
    .select('metric_date, engagements, reach, conversions, spend')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', prevFrom)
    .lte('metric_date', to)
    .order('metric_date', { ascending: true })

  const byDate = new Map<string, MetricPoint>()
  let engagements = 0
  let previousEngagements = 0

  for (const row of data ?? []) {
    const date = row.metric_date as string
    const value = {
      engagements: Number(row.engagements ?? 0),
      reach: Number(row.reach ?? 0),
      conversions: Number(row.conversions ?? 0),
      spend: Number(row.spend ?? 0),
    }
    if (date >= from) {
      engagements += value.engagements
      const existing = byDate.get(date)
      byDate.set(date, existing
        ? {
            metric_date: date,
            engagements: existing.engagements + value.engagements,
            reach: existing.reach + value.reach,
            conversions: existing.conversions + value.conversions,
            spend: existing.spend + value.spend,
          }
        : { metric_date: date, ...value })
    } else if (date >= prevFrom && date <= prevTo) {
      previousEngagements += value.engagements
    }
  }

  const upliftPercent = previousEngagements > 0
    ? Math.round(((engagements - previousEngagements) / previousEngagements) * 100)
    : 0

  return { points: [...byDate.values()], engagements, previousEngagements, upliftPercent }
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function recentActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { limit?: number; surface?: string; entityType?: string } = {},
): Promise<ActivityRow[]> {
  let builder = supabase
    .from('campaign_activity')
    .select('id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at, actor:profiles!campaign_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 6)

  if (opts.surface) builder = builder.eq('surface', opts.surface)
  if (opts.entityType) builder = builder.eq('entity_type', opts.entityType)

  const { data } = await builder
  return (data ?? []) as unknown as ActivityRow[]
}

// ── People ───────────────────────────────────────────────────────────────────

/** Workspace members, used to populate the Owner filter and assignment menus. */
export async function workspaceMembers(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, profiles(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)

  const people: PersonLite[] = []
  for (const row of data ?? []) {
    const p = (row as { profiles?: PersonLite | PersonLite[] }).profiles
    const person = Array.isArray(p) ? p[0] : p
    if (person?.id) people.push(person)
  }
  return people.sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATE_COLUMNS = `
  id, workspace_id, name, description, category, template_type, status, usage_count,
  linked_workflows, cover_url, is_favourite, channels, default_budget,
  default_duration_days, owner_id, archived_at, created_at, updated_at,
  owner:profiles!campaign_templates_owner_id_fkey(id, full_name, email, avatar_url)
`

export interface TemplateFilters {
  q: string
  category: string
  owner: string
  templateType: string
  status: string
  channel: string
  archived: boolean
  sort: string
  page: number
  size: number
}

export async function listTemplates(
  supabase: SupabaseClient,
  workspaceId: string,
  f: TemplateFilters,
): Promise<{ rows: TemplateRow[]; total: number; error: string | null }> {
  let builder = supabase
    .from('campaign_templates')
    .select(TEMPLATE_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  builder = f.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, ' ').trim()
    if (term) builder = builder.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (f.category) builder = builder.eq('category', f.category)
  if (f.owner) builder = builder.eq('owner_id', f.owner)
  if (f.templateType) builder = builder.eq('template_type', f.templateType)
  if (f.status) builder = builder.eq('status', f.status)
  if (f.channel) builder = builder.contains('channels', [f.channel])

  const sorts: Record<string, { column: string; ascending: boolean }> = {
    updated: { column: 'updated_at', ascending: false },
    name_asc: { column: 'name', ascending: true },
    used_desc: { column: 'usage_count', ascending: false },
    created: { column: 'created_at', ascending: false },
  }
  const sort = sorts[f.sort] ?? sorts.updated
  builder = builder.order(sort.column, { ascending: sort.ascending }).order('id', { ascending: true })

  const start = (f.page - 1) * f.size
  const { data, error, count } = await builder.range(start, start + f.size - 1)
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as TemplateRow[], total: count ?? 0, error: null }
}

export interface TemplateAggregates {
  total: number
  published: number
  draft: number
  inReview: number
  totalUses: number
  avgReuse: number
  recentlyUpdated: number
  mostUsed: TemplateRow | null
}

export async function templateAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<TemplateAggregates> {
  const { data } = await supabase
    .from('campaign_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  const rows = (data ?? []) as unknown as TemplateRow[]
  const weekAgo = Date.now() - 7 * 86_400_000
  const totalUses = rows.reduce((sum, row) => sum + row.usage_count, 0)

  return {
    total: rows.length,
    published: rows.filter(r => r.status === 'published').length,
    draft: rows.filter(r => r.status === 'draft').length,
    inReview: rows.filter(r => r.status === 'in_review').length,
    totalUses,
    avgReuse: rows.length ? Math.round((totalUses / rows.length) * 10) / 10 : 0,
    recentlyUpdated: rows.filter(r => Date.parse(r.updated_at) >= weekAgo).length,
    mostUsed: rows.reduce<TemplateRow | null>((best, row) =>
      !best || row.usage_count > best.usage_count ? row : best, null),
  }
}

// ── Giveaways ────────────────────────────────────────────────────────────────

const GIVEAWAY_COLUMNS = `
  id, workspace_id, campaign_id, title, description, status, prize_title, prize_value,
  prize_currency, prize_fulfilment, approval_status, progress, health, channels, platform,
  cover_url, total_entries, total_unique_participants, winner_count, start_date, end_date,
  owner_id, created_at, updated_at,
  owner:profiles!giveaways_owner_id_fkey(id, full_name, email, avatar_url)
`

export interface SimpleFilters {
  q: string
  status: string
  owner: string
  channel: string
  from: string
  to: string
  extra: string
  sort: string
  page: number
  size: number
}

export async function listGiveaways(
  supabase: SupabaseClient,
  workspaceId: string,
  f: SimpleFilters,
): Promise<{ rows: GiveawayRow[]; total: number; error: string | null }> {
  let builder = supabase
    .from('giveaways')
    .select(GIVEAWAY_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived')

  if (f.q) {
    const term = f.q.replace(/[%,()]/g, ' ').trim()
    if (term) builder = builder.or(`title.ilike.%${term}%,prize_title.ilike.%${term}%`)
  }
  if (f.status) builder = builder.eq('status', f.status)
  if (f.owner) builder = builder.eq('owner_id', f.owner)
  if (f.channel) builder = builder.contains('channels', [f.channel])
  if (f.extra) builder = builder.eq('prize_fulfilment', f.extra)
  if (f.from) builder = builder.or(`end_date.is.null,end_date.gte.${f.from}`)
  if (f.to) builder = builder.or(`start_date.is.null,start_date.lte.${f.to}T23:59:59`)

  const sorts: Record<string, { column: string; ascending: boolean }> = {
    due_soonest: { column: 'end_date', ascending: true },
    entries_desc: { column: 'total_entries', ascending: false },
    name_asc: { column: 'title', ascending: true },
    updated: { column: 'updated_at', ascending: false },
  }
  const sort = sorts[f.sort] ?? sorts.due_soonest
  builder = builder.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order('id', { ascending: true })

  const start = (f.page - 1) * f.size
  const { data, error, count } = await builder.range(start, start + f.size - 1)
  if (error) return { rows: [], total: 0, error: error.message }

  const rows = (data ?? []) as unknown as GiveawayRow[]
  for (const row of rows) {
    row.conversion_rate = row.total_entries > 0 && row.total_unique_participants > 0
      ? Math.round((row.total_unique_participants / row.total_entries) * 10_000) / 100
      : 0
  }
  return { rows, total: count ?? 0, error: null }
}

export interface GiveawayAggregates {
  active: number
  totalEntries: number
  conversionRate: number
  fulfilment: Record<string, number>
  fulfilmentRate: number
  prizeValueFulfilled: number
  prizeValueTotal: number
  approvalRate: number
  endingSoon: number
  pendingWinnerReviews: number
}

export async function giveawayAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<GiveawayAggregates> {
  const [{ data: giveaways }, { data: entries }] = await Promise.all([
    supabase.from('giveaways')
      .select('id, status, prize_fulfilment, prize_value, total_entries, total_unique_participants, end_date')
      .eq('workspace_id', workspaceId).neq('status', 'archived'),
    supabase.from('giveaway_entries')
      .select('winner_status').eq('workspace_id', workspaceId),
  ])

  const rows = giveaways ?? []
  const now = Date.now()
  const inSeven = now + 7 * 86_400_000

  const fulfilment: Record<string, number> = {}
  let totalEntries = 0
  let uniqueParticipants = 0
  let prizeValueTotal = 0
  let prizeValueFulfilled = 0
  let endingSoon = 0

  for (const row of rows) {
    const state = (row.prize_fulfilment as string) ?? 'pending'
    fulfilment[state] = (fulfilment[state] ?? 0) + 1
    totalEntries += Number(row.total_entries ?? 0)
    uniqueParticipants += Number(row.total_unique_participants ?? 0)
    const value = Number(row.prize_value ?? 0)
    prizeValueTotal += value
    if (state === 'fulfilled') prizeValueFulfilled += value
    const end = row.end_date ? Date.parse(row.end_date as string) : null
    if (end && end >= now && end <= inSeven) endingSoon += 1
  }

  const winnerStates = entries ?? []
  const reviewed = winnerStates.filter(e => ['approved', 'contacted', 'accepted', 'fulfilled', 'rejected'].includes(e.winner_status as string))
  const approved = reviewed.filter(e => e.winner_status !== 'rejected')

  return {
    active: rows.filter(r => r.status === 'active').length,
    totalEntries,
    conversionRate: totalEntries > 0 ? Math.round((uniqueParticipants / totalEntries) * 10_000) / 100 : 0,
    fulfilment,
    fulfilmentRate: rows.length ? Math.round(((fulfilment.fulfilled ?? 0) / rows.length) * 100) : 0,
    prizeValueFulfilled,
    prizeValueTotal,
    approvalRate: reviewed.length ? Math.round((approved.length / reviewed.length) * 100) : 0,
    endingSoon,
    pendingWinnerReviews: winnerStates.filter(e => e.winner_status === 'candidate').length,
  }
}

export interface WinnerQueueItem {
  giveawayId: string
  giveawayTitle: string
  coverUrl: string | null
  pending: number
}

export async function winnerReviewQueue(
  supabase: SupabaseClient,
  workspaceId: string,
  limit = 5,
): Promise<WinnerQueueItem[]> {
  const { data } = await supabase
    .from('giveaway_entries')
    .select('giveaway_id, giveaways(id, title, cover_url)')
    .eq('workspace_id', workspaceId)
    .eq('winner_status', 'candidate')

  const map = new Map<string, WinnerQueueItem>()
  for (const row of data ?? []) {
    const g = (row as { giveaways?: { id: string; title: string; cover_url: string | null } | { id: string; title: string; cover_url: string | null }[] }).giveaways
    const giveaway = Array.isArray(g) ? g[0] : g
    if (!giveaway) continue
    const existing = map.get(giveaway.id)
    if (existing) existing.pending += 1
    else map.set(giveaway.id, { giveawayId: giveaway.id, giveawayTitle: giveaway.title, coverUrl: giveaway.cover_url, pending: 1 })
  }
  return [...map.values()].sort((a, b) => b.pending - a.pending).slice(0, limit)
}

/** Daily entry counts for the entries-trend chart, plus the previous window. */
export async function giveawayEntriesTrend(
  supabase: SupabaseClient,
  workspaceId: string,
  from: string,
  to: string,
): Promise<{ date: string; entries: number; previous: number }[]> {
  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)
  const prevFrom = new Date(Date.parse(from) - spanDays * 86_400_000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('giveaway_entries')
    .select('entered_at')
    .eq('workspace_id', workspaceId)
    .gte('entered_at', `${prevFrom}T00:00:00Z`)
    .lte('entered_at', `${to}T23:59:59Z`)

  const current = new Map<string, number>()
  const previous = new Map<string, number>()
  for (const row of data ?? []) {
    const date = (row.entered_at as string).slice(0, 10)
    if (date >= from) current.set(date, (current.get(date) ?? 0) + 1)
    else previous.set(date, (previous.get(date) ?? 0) + 1)
  }

  const out: { date: string; entries: number; previous: number }[] = []
  for (let i = 0; i < spanDays; i++) {
    const date = new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10)
    const prevDate = new Date(Date.parse(prevFrom) + i * 86_400_000).toISOString().slice(0, 10)
    out.push({ date, entries: current.get(date) ?? 0, previous: previous.get(prevDate) ?? 0 })
  }
  return out
}

// ── Competitions ─────────────────────────────────────────────────────────────

const COMPETITION_COLUMNS = `
  id, workspace_id, campaign_id, title, description, competition_type, status, judging_stage,
  approval_status, progress, health, channels, cover_url, submission_count, vote_count,
  engagement_rate, judging_type, prize_title, start_date, end_date, submission_deadline,
  owner_id, created_at, updated_at,
  owner:profiles!competitions_owner_id_fkey(id, full_name, email, avatar_url)
`

export async function listCompetitions(
  supabase: SupabaseClient,
  workspaceId: string,
  f: SimpleFilters,
): Promise<{ rows: CompetitionRow[]; total: number; error: string | null }> {
  let builder = supabase
    .from('competitions')
    .select(COMPETITION_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived')

  if (f.q) {
    const term = f.q.replace(/[%,()]/g, ' ').trim()
    if (term) builder = builder.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (f.status) builder = builder.eq('status', f.status)
  if (f.owner) builder = builder.eq('owner_id', f.owner)
  if (f.channel) builder = builder.eq('competition_type', f.channel)
  if (f.extra) builder = builder.eq('judging_stage', f.extra)
  if (f.from) builder = builder.or(`end_date.is.null,end_date.gte.${f.from}`)
  if (f.to) builder = builder.or(`start_date.is.null,start_date.lte.${f.to}T23:59:59`)

  const sorts: Record<string, { column: string; ascending: boolean }> = {
    due_soonest: { column: 'end_date', ascending: true },
    submissions_desc: { column: 'submission_count', ascending: false },
    name_asc: { column: 'title', ascending: true },
    updated: { column: 'updated_at', ascending: false },
  }
  const sort = sorts[f.sort] ?? sorts.due_soonest
  builder = builder.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order('id', { ascending: true })

  const start = (f.page - 1) * f.size
  const { data, error, count } = await builder.range(start, start + f.size - 1)
  if (error) return { rows: [], total: 0, error: error.message }
  return { rows: (data ?? []) as unknown as CompetitionRow[], total: count ?? 0, error: null }
}

export interface CompetitionAggregates {
  active: number
  totalSubmissions: number
  judgingBacklog: number
  judgingDistribution: Record<string, number>
  conversionRate: number
  approvalRate: number
  closingSoon: number
  topPerformers: { id: string; title: string; coverUrl: string | null; rate: number }[]
}

export async function competitionAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CompetitionAggregates> {
  const [{ data: competitions }, { data: submissions }] = await Promise.all([
    supabase.from('competitions')
      .select('id, title, cover_url, status, submission_count, vote_count, engagement_rate, end_date')
      .eq('workspace_id', workspaceId).neq('status', 'archived'),
    supabase.from('competition_submissions')
      .select('judging_status').eq('workspace_id', workspaceId),
  ])

  const rows = competitions ?? []
  const now = Date.now()
  const inSeven = now + 7 * 86_400_000

  const distribution: Record<string, number> = {}
  for (const row of submissions ?? []) {
    const state = row.judging_status as string
    distribution[state] = (distribution[state] ?? 0) + 1
  }

  const totalSubmissions = (submissions ?? []).length
  const decided = totalSubmissions - (distribution.pending ?? 0) - (distribution.in_progress ?? 0)
  const approved = totalSubmissions - (distribution.rejected ?? 0) - (distribution.disqualified ?? 0) - (distribution.pending ?? 0) - (distribution.in_progress ?? 0)
  const totalVotes = rows.reduce((sum, r) => sum + Number(r.vote_count ?? 0), 0)

  return {
    active: rows.filter(r => r.status === 'open' || r.status === 'judging').length,
    totalSubmissions,
    judgingBacklog: (distribution.pending ?? 0) + (distribution.in_progress ?? 0) + (distribution.review ?? 0),
    judgingDistribution: distribution,
    conversionRate: totalVotes > 0 ? Math.round((totalSubmissions / totalVotes) * 10_000) / 100 : 0,
    approvalRate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
    closingSoon: rows.filter(r => {
      const end = r.end_date ? Date.parse(r.end_date as string) : null
      return end !== null && end >= now && end <= inSeven
    }).length,
    topPerformers: [...rows]
      .sort((a, b) => Number(b.engagement_rate ?? 0) - Number(a.engagement_rate ?? 0))
      .slice(0, 5)
      .map(r => ({
        id: r.id as string, title: r.title as string,
        coverUrl: (r.cover_url as string | null) ?? null,
        rate: Math.round(Number(r.engagement_rate ?? 0) * 100) / 100,
      })),
  }
}

/** Daily submission counts for the submissions-trend chart. */
export async function submissionsTrend(
  supabase: SupabaseClient,
  workspaceId: string,
  from: string,
  to: string,
): Promise<{ date: string; submissions: number; participants: number }[]> {
  const { data } = await supabase
    .from('competition_submissions')
    .select('submitted_at, participant_handle')
    .eq('workspace_id', workspaceId)
    .gte('submitted_at', `${from}T00:00:00Z`)
    .lte('submitted_at', `${to}T23:59:59Z`)

  const counts = new Map<string, { submissions: number; participants: Set<string> }>()
  for (const row of data ?? []) {
    const date = (row.submitted_at as string).slice(0, 10)
    const bucket = counts.get(date) ?? { submissions: 0, participants: new Set<string>() }
    bucket.submissions += 1
    if (row.participant_handle) bucket.participants.add(row.participant_handle as string)
    counts.set(date, bucket)
  }

  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)
  const out: { date: string; submissions: number; participants: number }[] = []
  for (let i = 0; i < spanDays; i++) {
    const date = new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10)
    const bucket = counts.get(date)
    out.push({ date, submissions: bucket?.submissions ?? 0, participants: bucket?.participants.size ?? 0 })
  }
  return out
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export async function listPhases(
  supabase: SupabaseClient,
  workspaceId: string,
  campaignIds: string[],
): Promise<PhaseRow[]> {
  if (campaignIds.length === 0) return []
  const { data } = await supabase
    .from('campaign_phases')
    .select('id, campaign_id, name, start_date, end_date, accent, sort_order')
    .eq('workspace_id', workspaceId)
    .in('campaign_id', campaignIds)
    .order('sort_order', { ascending: true })
  return (data ?? []) as unknown as PhaseRow[]
}

export async function listMilestones(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { campaignIds?: string[]; limit?: number; from?: string } = {},
): Promise<MilestoneRow[]> {
  let builder = supabase
    .from('campaign_milestones')
    .select('id, workspace_id, campaign_id, title, due_date, milestone_type, status, owner_id, depends_on_id, notes, completed_at, campaign:campaigns(id, name)')
    .eq('workspace_id', workspaceId)
    .order('due_date', { ascending: true })

  if (opts.campaignIds) {
    if (opts.campaignIds.length === 0) return []
    builder = builder.in('campaign_id', opts.campaignIds)
  }
  if (opts.from) builder = builder.gte('due_date', opts.from)
  if (opts.limit) builder = builder.limit(opts.limit)

  const { data } = await builder
  return (data ?? []) as unknown as MilestoneRow[]
}

export async function listDependencies(
  supabase: SupabaseClient,
  workspaceId: string,
  limit = 8,
): Promise<DependencyRow[]> {
  const { data } = await supabase
    .from('campaign_dependencies')
    .select('id, campaign_id, depends_on_campaign_id, label, status, campaign:campaigns!campaign_dependencies_campaign_id_fkey(id, name), depends_on:campaigns!campaign_dependencies_depends_on_campaign_id_fkey(id, name)')
    .eq('workspace_id', workspaceId)
    .limit(limit)
  return (data ?? []) as unknown as DependencyRow[]
}

// ── Cross-surface helpers ────────────────────────────────────────────────────

/** Content posts linked to each campaign — one grouped query, never per row. */
export async function contentCounts(
  supabase: SupabaseClient,
  workspaceId: string,
  campaignIds: string[],
): Promise<Record<string, number>> {
  if (campaignIds.length === 0) return {}
  const { data } = await supabase
    .from('content_posts')
    .select('campaign_id')
    .eq('workspace_id', workspaceId)
    .in('campaign_id', campaignIds)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = row.campaign_id as string | null
    if (id) counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

/**
 * Daily template usage, derived from campaigns actually created from a
 * template. This is real reuse, not a stored counter that can drift.
 */
export async function templateUsageTrend(
  supabase: SupabaseClient,
  workspaceId: string,
  from: string,
  to: string,
): Promise<{ date: string; uses: number; templates: number }[]> {
  const { data } = await supabase
    .from('campaigns')
    .select('created_at, template_id')
    .eq('workspace_id', workspaceId)
    .not('template_id', 'is', null)
    .gte('created_at', `${from}T00:00:00Z`)
    .lte('created_at', `${to}T23:59:59Z`)

  const byDate = new Map<string, { uses: number; templates: Set<string> }>()
  for (const row of data ?? []) {
    const date = (row.created_at as string).slice(0, 10)
    const bucket = byDate.get(date) ?? { uses: 0, templates: new Set<string>() }
    bucket.uses += 1
    bucket.templates.add(row.template_id as string)
    byDate.set(date, bucket)
  }

  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)
  const out: { date: string; uses: number; templates: number }[] = []
  for (let i = 0; i < spanDays; i++) {
    const date = new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10)
    const bucket = byDate.get(date)
    out.push({ date, uses: bucket?.uses ?? 0, templates: bucket?.templates.size ?? 0 })
  }
  return out
}
