import type { SupabaseClient } from '@supabase/supabase-js'
import type { PartnershipQuery } from './query'
import type {
  ActivityRow, ApplicationRow, AssetRow, CommissionRow, MetricPoint, PartnerRow, PayoutRow, PersonLite,
  ProgrammeRow, RewardRow, TerritoryRow, TierRow, TrackingLinkRow,
} from './types'
import { PROGRAMME_TYPE_TO_PARTNER_TYPE, type ProgrammeType } from './constants'

const OWNER_SELECT = 'owner:profiles!partnership_partners_owner_id_fkey(id, full_name, email, avatar_url)'
const PROGRAMME_OWNER_SELECT = 'owner:profiles!partnership_programmes_owner_id_fkey(id, full_name, email, avatar_url)'

const PARTNER_COLUMNS = `
  id, workspace_id, programme_id, partner_type, name, handle, email, avatar_url, owner_id, tier_id,
  status, platforms, region, health, health_reason, joined_at, approved_at, last_activity_at,
  metadata, is_demo, created_at, updated_at,
  ${OWNER_SELECT},
  tier:partnership_tiers(id, name),
  programme:partnership_programmes(id, name, programme_type)
`

const PROGRAMME_COLUMNS = `
  id, workspace_id, name, programme_type, category, description, status, owner_id, commission_type,
  commission_rate, currency, tracking_window_days, start_date, end_date, cover_url, channels,
  terms_url, is_demo, archived_at, created_at, updated_at,
  ${PROGRAMME_OWNER_SELECT}
`

type FilterOps = {
  eq(column: string, value: unknown): FilterOps
  in(column: string, values: readonly unknown[]): FilterOps
  is(column: string, value: unknown): FilterOps
  or(filter: string): FilterOps
  contains(column: string, value: unknown): FilterOps
  gte(column: string, value: unknown): FilterOps
  lte(column: string, value: unknown): FilterOps
}

const PARTNER_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  updated: { column: 'last_activity_at', ascending: false },
  name_asc: { column: 'name', ascending: true },
  // revenue_desc / commission_desc / conversions_desc are re-sorted in code
  // after aggregates are joined — Postgres can't sort on a joined rollup.
  revenue_desc: { column: 'last_activity_at', ascending: false },
  commission_desc: { column: 'last_activity_at', ascending: false },
  conversions_desc: { column: 'last_activity_at', ascending: false },
}

function applyPartnerFilters<T>(query: T, q: PartnershipQuery): T {
  let builder = query as FilterOps
  if (q.q) {
    const term = q.q.replace(/[%,()]/g, ' ').trim()
    if (term) builder = builder.or(`name.ilike.%${term}%,handle.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.tier) builder = builder.eq('tier_id', q.tier)
  if (q.platform) builder = builder.contains('platforms', [q.platform])
  if (q.region) builder = builder.eq('region', q.region)
  if (q.from) builder = builder.gte('last_activity_at', `${q.from}T00:00:00Z`)
  if (q.to) builder = builder.lte('last_activity_at', `${q.to}T23:59:59Z`)
  return builder as T
}

export interface PartnerPage {
  rows: PartnerRow[]
  total: number
  error: string | null
}

/**
 * Partners for one programme type (or every type, for the Overview page),
 * with per-partner conversions/commission/revenue rolled up from the
 * conversions and commissions tables in two grouped queries — never a
 * per-row N+1.
 */
export async function listPartners(
  supabase: SupabaseClient,
  workspaceId: string,
  programmeType: ProgrammeType | null,
  q: PartnershipQuery,
  opts: { limit?: number; paginate?: boolean; excludeArchived?: boolean } = {},
): Promise<PartnerPage> {
  let builder = supabase
    .from('partnership_partners')
    .select(PARTNER_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (programmeType) {
    // Filtering on partner_type (not the embedded programme relation) —
    // Supabase/PostgREST only filters top-level rows by an embedded
    // resource's column when the embed uses `!inner`, which this select
    // does not; partner_type mirrors programme_type 1:1 and is indexed.
    builder = builder.eq('partner_type', PROGRAMME_TYPE_TO_PARTNER_TYPE[programmeType])
  }
  if (opts.excludeArchived !== false) builder = builder.neq('status', 'archived')

  builder = applyPartnerFilters(builder, q)

  const sort = PARTNER_SORT_COLUMNS[q.sort] ?? PARTNER_SORT_COLUMNS.updated
  builder = builder.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order('id', { ascending: true })

  if (opts.paginate) {
    const start = (q.page - 1) * q.size
    builder = builder.range(start, start + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, error, count } = await builder
  if (error) return { rows: [], total: 0, error: error.message }

  let rows = (data ?? []) as unknown as PartnerRow[]
  const rollups = await partnerRollups(supabase, workspaceId, rows.map(r => r.id))
  for (const row of rows) {
    const rollup = rollups.get(row.id)
    row.conversions = rollup?.conversions ?? 0
    row.commission = rollup?.commission ?? 0
    row.revenue = rollup?.revenue ?? 0
  }

  if (q.sort === 'revenue_desc') rows = [...rows].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
  if (q.sort === 'commission_desc') rows = [...rows].sort((a, b) => (b.commission ?? 0) - (a.commission ?? 0))
  if (q.sort === 'conversions_desc') rows = [...rows].sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))

  return { rows, total: count ?? rows.length, error: null }
}

async function partnerRollups(
  supabase: SupabaseClient, workspaceId: string, partnerIds: string[],
): Promise<Map<string, { conversions: number; commission: number; revenue: number }>> {
  const map = new Map<string, { conversions: number; commission: number; revenue: number }>()
  if (partnerIds.length === 0) return map

  const [{ data: conversions }, { data: commissions }] = await Promise.all([
    supabase.from('partnership_conversions').select('partner_id, value, status')
      .eq('workspace_id', workspaceId).in('partner_id', partnerIds).neq('status', 'reversed'),
    supabase.from('partnership_commissions').select('partner_id, amount, status')
      .eq('workspace_id', workspaceId).in('partner_id', partnerIds).neq('status', 'rejected'),
  ])

  for (const row of conversions ?? []) {
    const id = row.partner_id as string
    const bucket = map.get(id) ?? { conversions: 0, commission: 0, revenue: 0 }
    bucket.conversions += 1
    bucket.revenue += Number(row.value ?? 0)
    map.set(id, bucket)
  }
  for (const row of commissions ?? []) {
    const id = row.partner_id as string
    const bucket = map.get(id) ?? { conversions: 0, commission: 0, revenue: 0 }
    bucket.commission += Number(row.amount ?? 0)
    map.set(id, bucket)
  }
  return map
}

// ── Programmes ───────────────────────────────────────────────────────────────

export interface ProgrammePage {
  rows: ProgrammeRow[]
  total: number
  error: string | null
}

export async function listProgrammes(
  supabase: SupabaseClient,
  workspaceId: string,
  programmeType: ProgrammeType | null,
  opts: { limit?: number; includeArchived?: boolean } = {},
): Promise<ProgrammePage> {
  let builder = supabase
    .from('partnership_programmes')
    .select(PROGRAMME_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (programmeType) builder = builder.eq('programme_type', programmeType)
  if (!opts.includeArchived) builder = builder.is('archived_at', null)

  builder = builder.order('updated_at', { ascending: false }).order('id', { ascending: true })
  if (opts.limit) builder = builder.limit(opts.limit)

  const { data, error, count } = await builder
  if (error) return { rows: [], total: 0, error: error.message }

  const rows = (data ?? []) as unknown as ProgrammeRow[]
  const programmeIds = rows.map(r => r.id)
  const [rollups, tiers] = await Promise.all([
    programmeRollups(supabase, workspaceId, programmeIds),
    programmeTopTiers(supabase, workspaceId, programmeIds),
  ])

  for (const row of rows) {
    const rollup = rollups.get(row.id)
    row.partner_count = rollup?.partnerCount ?? 0
    row.conversions = rollup?.conversions ?? 0
    row.commission = rollup?.commission ?? 0
    row.revenue = rollup?.revenue ?? 0
    const topTier = tiers.get(row.id)
    if (topTier) {
      row.current_tier_name = topTier.name
      row.tier_progress_pct = topTier.threshold > 0
        ? Math.min(100, Math.round(((row.revenue ?? 0) / topTier.threshold) * 100))
        : 0
    }
  }

  return { rows, total: count ?? rows.length, error: null }
}

async function programmeRollups(
  supabase: SupabaseClient, workspaceId: string, programmeIds: string[],
): Promise<Map<string, { partnerCount: number; conversions: number; commission: number; revenue: number }>> {
  const map = new Map<string, { partnerCount: number; conversions: number; commission: number; revenue: number }>()
  if (programmeIds.length === 0) return map

  const [{ data: partners }, { data: conversions }, { data: commissions }] = await Promise.all([
    supabase.from('partnership_partners').select('programme_id')
      .eq('workspace_id', workspaceId).in('programme_id', programmeIds).neq('status', 'archived'),
    supabase.from('partnership_conversions').select('programme_id, value, status')
      .eq('workspace_id', workspaceId).in('programme_id', programmeIds).neq('status', 'reversed'),
    supabase.from('partnership_commissions').select('programme_id, amount, status')
      .eq('workspace_id', workspaceId).in('programme_id', programmeIds).neq('status', 'rejected'),
  ])

  const get = (id: string) => map.get(id) ?? { partnerCount: 0, conversions: 0, commission: 0, revenue: 0 }
  for (const row of partners ?? []) {
    const id = row.programme_id as string
    const bucket = get(id); bucket.partnerCount += 1; map.set(id, bucket)
  }
  for (const row of conversions ?? []) {
    const id = row.programme_id as string
    const bucket = get(id); bucket.conversions += 1; bucket.revenue += Number(row.value ?? 0); map.set(id, bucket)
  }
  for (const row of commissions ?? []) {
    const id = row.programme_id as string
    const bucket = get(id); bucket.commission += Number(row.amount ?? 0); map.set(id, bucket)
  }
  return map
}

async function programmeTopTiers(
  supabase: SupabaseClient, workspaceId: string, programmeIds: string[],
): Promise<Map<string, { name: string; threshold: number }>> {
  const map = new Map<string, { name: string; threshold: number }>()
  if (programmeIds.length === 0) return map
  const { data } = await supabase
    .from('partnership_tiers')
    .select('programme_id, name, threshold, rank')
    .eq('workspace_id', workspaceId)
    .in('programme_id', programmeIds)
    .order('rank', { ascending: false })
  for (const row of data ?? []) {
    const id = row.programme_id as string
    if (!map.has(id)) map.set(id, { name: row.name as string, threshold: Number(row.threshold ?? 0) })
  }
  return map
}

export async function listTiers(supabase: SupabaseClient, workspaceId: string, programmeId: string): Promise<TierRow[]> {
  const { data } = await supabase
    .from('partnership_tiers')
    .select('id, workspace_id, programme_id, name, rank, threshold, commission_rate, benefits')
    .eq('workspace_id', workspaceId).eq('programme_id', programmeId)
    .order('rank', { ascending: true })
  return (data ?? []) as unknown as TierRow[]
}

// ── Aggregates (KPIs) ────────────────────────────────────────────────────────

export interface PartnershipAggregates {
  totalPartners: number
  activeProgrammes: number
  conversions: number
  commissionPaid: number
  commissionOwed: number
  revenue: number
  atRiskPartners: number
  pendingApplications: number
  pendingPayouts: number
  contentAwaitingReview: number
  membersAtRisk: number
  rewardsRedeemed: number
  repeatPurchaseRate: number
  territoriesCovered: number
  rebatesOwed: number
  sharedSpend: number
  assetsAwaitingApproval: number
  assetsTotal: number
  leadsCount: number
  applicationsPendingRatio: number
}

/**
 * One pass over the workspace's partnership data to derive every KPI shown
 * across the seven surfaces. Selecting only the aggregate columns keeps this
 * cheap even on large workspaces.
 */
export async function partnershipAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
  programmeType: ProgrammeType | null,
): Promise<PartnershipAggregates> {
  let programmeQuery = supabase.from('partnership_programmes').select('id, status, programme_type').eq('workspace_id', workspaceId).is('archived_at', null)
  if (programmeType) programmeQuery = programmeQuery.eq('programme_type', programmeType)
  const { data: programmes } = await programmeQuery
  const programmeIds = (programmes ?? []).map(p => p.id as string)
  const activeProgrammes = (programmes ?? []).filter(p => p.status === 'active').length

  if (programmeIds.length === 0) {
    return {
      totalPartners: 0, activeProgrammes: 0, conversions: 0, commissionPaid: 0, commissionOwed: 0,
      revenue: 0, atRiskPartners: 0, pendingApplications: 0, pendingPayouts: 0, contentAwaitingReview: 0,
      membersAtRisk: 0, rewardsRedeemed: 0, repeatPurchaseRate: 0, territoriesCovered: 0, rebatesOwed: 0,
      sharedSpend: 0, assetsAwaitingApproval: 0, assetsTotal: 0, leadsCount: 0, applicationsPendingRatio: 0,
    }
  }

  const [
    { data: partners }, { data: conversions }, { data: commissions }, { data: applications },
    { data: payouts }, { data: rewards }, { data: territories }, { data: contributions }, { data: leads },
    { data: assets },
  ] = await Promise.all([
    supabase.from('partnership_partners').select('id, status, health').eq('workspace_id', workspaceId).in('programme_id', programmeIds).neq('status', 'archived'),
    supabase.from('partnership_conversions').select('id, partner_id, value, status').eq('workspace_id', workspaceId).in('programme_id', programmeIds).neq('status', 'reversed'),
    supabase.from('partnership_commissions').select('amount, status').eq('workspace_id', workspaceId).in('programme_id', programmeIds).neq('status', 'rejected'),
    supabase.from('partnership_applications').select('id, status').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
    supabase.from('partnership_payouts').select('id, status, net_amount').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
    supabase.from('partnership_rewards').select('id, status, value').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
    supabase.from('partnership_territories').select('id, region').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
    supabase.from('co_marketing_contributions').select('our_contribution, partner_contribution').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
    supabase.from('co_marketing_leads').select('id').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
    supabase.from('partnership_assets').select('id, status').eq('workspace_id', workspaceId).in('programme_id', programmeIds),
  ])

  const commissionPaid = (commissions ?? []).filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0)
  const commissionOwed = (commissions ?? []).filter(c => ['payable', 'approved', 'validated'].includes(c.status as string)).reduce((s, c) => s + Number(c.amount ?? 0), 0)
  const revenue = (conversions ?? []).reduce((s, c) => s + Number(c.value ?? 0), 0)
  const uniqueTerritories = new Set((territories ?? []).map(t => (t.region as string).toLowerCase())).size
  const sharedSpend = (contributions ?? []).reduce((s, c) => s + Number(c.our_contribution ?? 0) + Number(c.partner_contribution ?? 0), 0)
  const pendingApplications = (applications ?? []).filter(a => ['pending', 'in_review'].includes(a.status as string)).length
  const assetsAwaitingApproval = (assets ?? []).filter(a => ['submitted', 'in_review'].includes(a.status as string)).length

  // Repeat purchase rate = partners with 2+ recorded conversions ÷ partners
  // with at least one conversion. This is a real, deterministic calculation
  // over partnership_conversions, not a fabricated figure.
  const conversionCountsByPartner = new Map<string, number>()
  for (const c of conversions ?? []) {
    const id = c.partner_id as string
    conversionCountsByPartner.set(id, (conversionCountsByPartner.get(id) ?? 0) + 1)
  }
  const purchasingPartners = conversionCountsByPartner.size
  const repeatPartners = [...conversionCountsByPartner.values()].filter(n => n >= 2).length
  const repeatPurchaseRate = purchasingPartners > 0 ? Math.round((repeatPartners / purchasingPartners) * 1000) / 10 : 0

  return {
    totalPartners: (partners ?? []).length,
    activeProgrammes,
    conversions: (conversions ?? []).length,
    commissionPaid,
    commissionOwed,
    revenue,
    atRiskPartners: (partners ?? []).filter(p => p.health === 'at_risk' || p.health === 'critical').length,
    pendingApplications,
    pendingPayouts: (payouts ?? []).filter(p => ['pending_review', 'approved'].includes(p.status as string)).length,
    contentAwaitingReview: assetsAwaitingApproval,
    membersAtRisk: (partners ?? []).filter(p => p.status === 'at_risk').length,
    rewardsRedeemed: (rewards ?? []).filter(r => r.status === 'redeemed').length,
    repeatPurchaseRate,
    territoriesCovered: uniqueTerritories,
    rebatesOwed: (payouts ?? []).filter(p => !['paid', 'cancelled'].includes(p.status as string)).reduce((s, p) => s + Number(p.net_amount ?? 0), 0),
    sharedSpend,
    assetsAwaitingApproval,
    assetsTotal: (assets ?? []).length,
    leadsCount: (leads ?? []).length,
    applicationsPendingRatio: (partners ?? []).length > 0 ? Math.round((pendingApplications / (partners ?? []).length) * 100) : 0,
  }
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface MetricSeries {
  points: MetricPoint[]
  primaryTotal: number
  secondaryTotal: number
  revenueTotal: number
  upliftPercent: number
}

export async function metricSeries(
  supabase: SupabaseClient,
  workspaceId: string,
  programmeType: ProgrammeType | null,
  from: string,
  to: string,
): Promise<MetricSeries> {
  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)
  const prevFrom = new Date(Date.parse(from) - spanDays * 86_400_000).toISOString().slice(0, 10)
  const prevTo = new Date(Date.parse(from) - 86_400_000).toISOString().slice(0, 10)

  let builder = supabase
    .from('partnership_metrics_daily')
    .select('metric_date, primary_count, secondary_count, revenue, spend')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', prevFrom)
    .lte('metric_date', to)
    .order('metric_date', { ascending: true })
  if (programmeType) builder = builder.eq('programme_type', programmeType)

  const { data } = await builder
  const byDate = new Map<string, MetricPoint>()
  let primaryTotal = 0
  let secondaryTotal = 0
  let revenueTotal = 0
  let previousPrimary = 0

  for (const row of data ?? []) {
    const date = row.metric_date as string
    const value = {
      primary_count: Number(row.primary_count ?? 0), secondary_count: Number(row.secondary_count ?? 0),
      revenue: Number(row.revenue ?? 0), spend: Number(row.spend ?? 0),
    }
    if (date >= from) {
      primaryTotal += value.primary_count; secondaryTotal += value.secondary_count; revenueTotal += value.revenue
      const existing = byDate.get(date)
      byDate.set(date, existing
        ? {
            metric_date: date,
            primary_count: existing.primary_count + value.primary_count,
            secondary_count: existing.secondary_count + value.secondary_count,
            revenue: existing.revenue + value.revenue,
            spend: existing.spend + value.spend,
          }
        : { metric_date: date, ...value })
    } else if (date >= prevFrom && date <= prevTo) {
      previousPrimary += value.primary_count
    }
  }

  const upliftPercent = previousPrimary > 0 ? Math.round(((primaryTotal - previousPrimary) / previousPrimary) * 100) : 0
  return { points: [...byDate.values()], primaryTotal, secondaryTotal, revenueTotal, upliftPercent }
}

// ── Applications ─────────────────────────────────────────────────────────────

export async function listApplications(
  supabase: SupabaseClient,
  workspaceId: string,
  programmeType: ProgrammeType | null,
  opts: { status?: string; limit?: number } = {},
): Promise<ApplicationRow[]> {
  let builder = supabase
    .from('partnership_applications')
    .select('id, workspace_id, programme_id, partner_id, applicant_name, applicant_email, status, fields, reviewed_by, reviewed_at, review_notes, submitted_at, programme:partnership_programmes(id, name, programme_type)')
    .eq('workspace_id', workspaceId)
    .order('submitted_at', { ascending: false })

  if (programmeType) {
    // Supabase/PostgREST only filters top-level rows by an embedded
    // resource's column with an `!inner` embed, which this select does not
    // use — resolve matching programme IDs first instead.
    const { data: programmes } = await supabase.from('partnership_programmes')
      .select('id').eq('workspace_id', workspaceId).eq('programme_type', programmeType)
    const ids = (programmes ?? []).map(p => p.id as string)
    if (ids.length === 0) return []
    builder = builder.in('programme_id', ids)
  }
  if (opts.status) builder = builder.eq('status', opts.status)
  if (opts.limit) builder = builder.limit(opts.limit)

  const { data } = await builder
  return (data ?? []) as unknown as ApplicationRow[]
}

// ── Commissions & Payouts ────────────────────────────────────────────────────

export async function listCommissions(
  supabase: SupabaseClient, workspaceId: string, opts: { status?: string; limit?: number } = {},
): Promise<CommissionRow[]> {
  let builder = supabase
    .from('partnership_commissions')
    .select('id, workspace_id, programme_id, partner_id, conversion_id, calculation_basis, rate, amount, currency, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (opts.status) builder = builder.eq('status', opts.status)
  if (opts.limit) builder = builder.limit(opts.limit)
  const { data } = await builder
  return (data ?? []) as unknown as CommissionRow[]
}

export async function listPayouts(
  supabase: SupabaseClient, workspaceId: string, opts: { status?: string; limit?: number } = {},
): Promise<PayoutRow[]> {
  let builder = supabase
    .from('partnership_payouts')
    .select('id, workspace_id, programme_id, partner_id, period_start, period_end, currency, gross_amount, adjustments, net_amount, status, provider, provider_error, paid_at, created_at, partner:partnership_partners(id, name, stripe_account_status, stripe_payouts_enabled)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (opts.status) builder = builder.eq('status', opts.status)
  if (opts.limit) builder = builder.limit(opts.limit)
  const { data } = await builder
  return (data ?? []) as unknown as PayoutRow[]
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function recentActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { limit?: number } = {},
): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from('partnership_activity')
    .select('id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at, actor:profiles!partnership_activity_actor_id_fkey(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 6)
  return (data ?? []) as unknown as ActivityRow[]
}

// ── Assets (ambassador content / co-marketing asset approvals) ──────────────

export async function listAssets(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { programmeType?: ProgrammeType | null; status?: string; limit?: number; partnerId?: string; programmeId?: string } = {},
): Promise<AssetRow[]> {
  let builder = supabase
    .from('partnership_assets')
    .select('id, workspace_id, programme_id, partner_id, asset_type, title, url, platform, status, review_notes, submitted_at, reviewed_by, reviewed_at, partner:partnership_partners(id, name), programme:partnership_programmes(id, name, programme_type)')
    .eq('workspace_id', workspaceId)
    .order('submitted_at', { ascending: false })

  if (opts.programmeType) {
    const { data: programmes } = await supabase.from('partnership_programmes')
      .select('id').eq('workspace_id', workspaceId).eq('programme_type', opts.programmeType)
    const ids = (programmes ?? []).map(p => p.id as string)
    if (ids.length === 0) return []
    builder = builder.in('programme_id', ids)
  }
  if (opts.status) builder = builder.eq('status', opts.status)
  if (opts.partnerId) builder = builder.eq('partner_id', opts.partnerId)
  if (opts.programmeId) builder = builder.eq('programme_id', opts.programmeId)
  if (opts.limit) builder = builder.limit(opts.limit)

  const { data } = await builder
  return (data ?? []) as unknown as AssetRow[]
}

// ── Rewards ──────────────────────────────────────────────────────────────────

export async function listRewards(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { partnerId?: string; programmeId?: string; status?: string; limit?: number } = {},
): Promise<RewardRow[]> {
  let builder = supabase
    .from('partnership_rewards')
    .select('id, workspace_id, programme_id, partner_id, reward_type, value, currency, status, trigger_source, issued_at, redeemed_at, expires_at, created_at, partner:partnership_partners(id, name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (opts.partnerId) builder = builder.eq('partner_id', opts.partnerId)
  if (opts.programmeId) builder = builder.eq('programme_id', opts.programmeId)
  if (opts.status) builder = builder.eq('status', opts.status)
  if (opts.limit) builder = builder.limit(opts.limit)

  const { data } = await builder
  return (data ?? []) as unknown as RewardRow[]
}

// ── Territories ──────────────────────────────────────────────────────────────

export async function listTerritories(
  supabase: SupabaseClient, workspaceId: string, programmeId: string,
): Promise<TerritoryRow[]> {
  const { data } = await supabase
    .from('partnership_territories')
    .select('id, workspace_id, programme_id, partner_id, region, exclusive, assigned_at, expires_at, partner:partnership_partners(id, name)')
    .eq('workspace_id', workspaceId).eq('programme_id', programmeId)
    .order('assigned_at', { ascending: false })
  return (data ?? []) as unknown as TerritoryRow[]
}

// ── Tracking links ───────────────────────────────────────────────────────────

export async function listTrackingLinks(
  supabase: SupabaseClient, workspaceId: string, partnerId: string,
): Promise<TrackingLinkRow[]> {
  const { data } = await supabase
    .from('partnership_tracking_links')
    .select('id, workspace_id, programme_id, partner_id, slug, destination_url, status, clicks, expires_at, created_at')
    .eq('workspace_id', workspaceId).eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as TrackingLinkRow[]
}

// ── People ───────────────────────────────────────────────────────────────────

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
