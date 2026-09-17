// Workspace-scoped reads and derived metrics for the six Creators & UGC
// surfaces. Every function takes an explicit workspaceId and filters on it, so
// scoping is enforced twice: here, and again by the RLS policies in
// supabase/migrations/20260901000000_creators_ugc_module.sql.

import type { SupabaseClient } from '@supabase/supabase-js'
import { R2_PREFIX, signReadUrls } from '@/lib/storage/r2'
import {
  AUDIENCE_BANDS, ACTIVE_RELATIONSHIPS, RIGHTS_EXPIRING_DAYS, TREND_WINDOW_DAYS,
  daysUntil, effectiveRightsStatus,
  type BriefStatus, type PaymentStatus, type RightsStatus, type SubmissionStatus,
} from './constants'
import { likeTerm, type BriefsQuery, type CreatorsQuery, type PaymentsQuery, type RightsQuery, type SubmissionsQuery } from './query'
import type {
  ActivityRow, BriefCreatorRow, BriefDeliverableRow, BriefRow, CreatorListRow, CreatorRow,
  InvitationRow, MetricPoint, PaymentBatchRow, PaymentRow, PayoutAttemptRow, PersonLite,
  RightsConflict, RightsRequestRow, RightsRow, SubmissionAssetRow, SubmissionIssueRow,
  SubmissionReviewRow, SubmissionRow,
} from './types'

/**
 * Structural view of the PostgREST filter builder. The real builder type is
 * deeply generic and changes shape with every select; the helpers below only
 * chain filters and return `this`, so a self-referential alias keeps them
 * type-safe without `any`.
 */
type FilterOps = {
  eq(column: string, value: unknown): FilterOps
  neq(column: string, value: unknown): FilterOps
  in(column: string, values: readonly unknown[]): FilterOps
  is(column: string, value: unknown): FilterOps
  not(column: string, operator: string, value: unknown): FilterOps
  or(filter: string): FilterOps
  gt(column: string, value: unknown): FilterOps
  gte(column: string, value: unknown): FilterOps
  lt(column: string, value: unknown): FilterOps
  lte(column: string, value: unknown): FilterOps
  contains(column: string, value: unknown): FilterOps
}

const PERSON = 'id, full_name, email, avatar_url'

const CREATOR_COLUMNS = `
  id, workspace_id, name, email, handle, avatar_url, bio, niche, region, country,
  languages, platforms, audience_size, engagement_rate, avg_rate, rate_per_video,
  currency, creator_tier, relationship_status, rights_readiness, payment_ready,
  availability, shortlisted, campaign_fit, owner_id, tags, source, total_earnings,
  portfolio_urls, notes, archived_at, created_at, updated_at,
  owner:profiles!ugc_creators_owner_id_fkey(${PERSON})
`

const BRIEF_COLUMNS = `
  id, workspace_id, campaign_id, title, description, status, approval_stage, priority,
  category, cover_url, channels, platforms, deliverables, do_instructions, dont_instructions,
  rights_requirement, budget, currency, deadline, max_creators, creators_assigned,
  deliverables_target, deliverables_submitted, owner_id, completed_at, archived_at,
  board_position, created_at, updated_at, cover_path,
  owner:profiles!ugc_briefs_owner_id_fkey(${PERSON}),
  campaign:campaigns!ugc_briefs_campaign_id_fkey(id, name)
`

const SUBMISSION_COLUMNS = `
  id, workspace_id, brief_id, creator_id, campaign_id, deliverable_id, title, status,
  asset_type, version, rights_status, reviewer_id, thumbnail_url, submission_url,
  media_urls, duration_seconds, file_count, views, engagement_rate, comments_count,
  issue_count, payment_eligible, notes, feedback, submitted_at, review_started_at,
  review_seconds, reviewed_at, archived_at, created_at, updated_at, thumbnail_path,
  creator:ugc_creators!ugc_submissions_creator_id_fkey(id, name, handle, avatar_url, niche),
  brief:ugc_briefs!ugc_submissions_brief_id_fkey(id, title),
  reviewer:profiles!ugc_submissions_reviewer_id_fkey(${PERSON})
`

const RIGHTS_COLUMNS = `
  id, workspace_id, creator_id, submission_id, submission_version, campaign_id, brief_id,
  asset_label, rights_type, usage_scope, channels, territories, start_date, expiry_date,
  exclusivity, modification_allowed, paid_amplification, whitelisting, handle_usage,
  agreement_url, agreement_signed, status, owner_id, notes, archived_at, created_at, updated_at,
  creator:ugc_creators!ugc_rights_creator_id_fkey(id, name, handle, avatar_url),
  owner:profiles!ugc_rights_owner_id_fkey(${PERSON}),
  submission:ugc_submissions!ugc_rights_submission_id_fkey(id, title, status, thumbnail_url, thumbnail_path),
  campaign:campaigns!ugc_rights_campaign_id_fkey(id, name, end_date)
`

const PAYMENT_COLUMNS = `
  id, workspace_id, creator_id, submission_id, brief_id, campaign_id, batch_id, amount,
  currency, status, approval_state, payment_method, approved_by, approved_at, payout_date,
  paid_at, submitted_date, invoice_number, invoice_url, invoice_status, invoice_flag,
  tax_status, provider_reference, failure_reason, blocked_reason, owner_id, notes,
  created_at, updated_at,
  creator:ugc_creators!ugc_payments_creator_id_fkey(id, name, handle, avatar_url),
  brief:ugc_briefs!ugc_payments_brief_id_fkey(id, title),
  campaign:campaigns!ugc_payments_campaign_id_fkey(id, name),
  approver:profiles!ugc_payments_approved_by_fkey(${PERSON})
`

export interface Page<T> {
  rows: T[]
  total: number
  error: string | null
}

function emptyPage<T>(error: string | null = null): Page<T> {
  return { rows: [], total: 0, error }
}

// ── Private media ────────────────────────────────────────────────────────────
// Submission thumbnails, brief covers and agreements live in the private
// `ugc-submissions` bucket. Rows carry the storage path; pages only ever see a
// short-lived signed URL, resolved here in one batched request per query.

const MEDIA_BUCKET = 'ugc-submissions'
const SIGNED_URL_TTL_SECONDS = 60 * 30

export async function signStoragePaths(
  supabase: SupabaseClient, paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS)
  const map = new Map<string, string>()
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) map.set(entry.path, entry.signedUrl)
  }
  return map
}

/**
 * Member avatars uploaded through Brand & Assets are stored as `r2:` object
 * references. Walks loaded rows once, signs every such avatar in a single
 * batch and swaps in the short-lived URL (or null if it cannot be signed).
 */
export async function signAvatars<T>(data: T): Promise<T> {
  const refs = new Set<string>()
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'avatar_url' && typeof inner === 'string' && inner.startsWith(R2_PREFIX)) refs.add(inner)
      else if (inner && typeof inner === 'object') visit(inner)
    }
  }
  visit(data)
  if (refs.size === 0) return data
  const signed = await signReadUrls([...refs], 60 * 30)
  const swap = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(swap)
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [
      key,
      key === 'avatar_url' && typeof inner === 'string' && inner.startsWith(R2_PREFIX) ? signed.get(inner) ?? null : swap(inner),
    ]))
  }
  return swap(data) as T
}

async function withSubmissionMedia<T extends SubmissionRow>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  const signed = await signStoragePaths(supabase, rows.map(r => r.thumbnail_path))
  return signAvatars(rows.map(r => (r.thumbnail_path ? { ...r, thumbnail_url: signed.get(r.thumbnail_path) ?? null } : r)))
}

async function withBriefCovers<T extends BriefRow>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  const signed = await signStoragePaths(supabase, rows.map(r => r.cover_path))
  return signAvatars(rows.map(r => (r.cover_path ? { ...r, cover_url: signed.get(r.cover_path) ?? null } : r)))
}

async function withRightsMedia<T extends RightsRow>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  const signed = await signStoragePaths(supabase, rows.map(r => r.submission?.thumbnail_path))
  return signAvatars(rows.map(r => (r.submission?.thumbnail_path
    ? { ...r, submission: { ...r.submission, thumbnail_url: signed.get(r.submission.thumbnail_path) ?? null } }
    : r)))
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function dayKey(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10)
}

/** Percentage change between two window totals, guarding divide-by-zero. */
export function delta(current: number, previous: number): { pct: number; trend: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: current === 0 ? 0 : 100, trend: current === 0 ? 'flat' : 'up' }
  const pct = ((current - previous) / previous) * 100
  return { pct, trend: pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat' }
}

/** Buckets timestamps into a fixed-length daily series for the KPI sparklines. */
export function dailySeries(timestamps: (string | null | undefined)[], days = TREND_WINDOW_DAYS): number[] {
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i -= 1) buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), 0)
  for (const stamp of timestamps) {
    if (!stamp) continue
    const key = dayKey(stamp)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.values()]
}

export function dailyPoints(
  timestamps: (string | null | undefined)[],
  key: string,
  days = TREND_WINDOW_DAYS,
): MetricPoint[] {
  const series = dailySeries(timestamps, days)
  return series.map((value, index) => ({
    date: dayKey(new Date(Date.now() - (days - 1 - index) * 86_400_000)),
    [key]: value,
  }))
}

// ============================================================================
// Workspace members
// ============================================================================

export async function workspaceMembers(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  const { data: members } = await supabase
    .from('workspace_members').select('user_id').eq('workspace_id', workspaceId)
  const ids = (members ?? []).map(m => m.user_id as string)
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select(PERSON).in('id', ids)
  return signAvatars((data ?? []) as PersonLite[])
}

export async function workspaceCampaigns(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from('campaigns').select('id, name')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(200)
  return (data ?? []) as { id: string; name: string }[]
}

// ============================================================================
// Creators
// ============================================================================

const CREATOR_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  recent: { column: 'updated_at', ascending: false },
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  audience_desc: { column: 'audience_size', ascending: false },
  engagement_desc: { column: 'engagement_rate', ascending: false },
  rate_asc: { column: 'avg_rate', ascending: true },
  rate_desc: { column: 'avg_rate', ascending: false },
  fit_desc: { column: 'campaign_fit', ascending: false },
}

function applyCreatorFilters<T>(query: T, q: CreatorsQuery): T {
  let builder = query as FilterOps
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)

  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`name.ilike.%${term}%,handle.ilike.%${term}%,niche.ilike.%${term}%,bio.ilike.%${term}%`)
  }
  if (q.niche) builder = builder.eq('niche', q.niche)
  if (q.region) builder = builder.eq('region', q.region)
  if (q.availability) builder = builder.eq('availability', q.availability)
  if (q.status) builder = builder.eq('relationship_status', q.status)
  if (q.rights) builder = builder.eq('rights_readiness', q.rights)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.platform) builder = builder.contains('platforms', [q.platform])
  if (q.tag) builder = builder.contains('tags', [q.tag])
  if (q.shortlist) builder = builder.eq('shortlisted', true)
  if (q.rateMin !== null) builder = builder.gte('avg_rate', q.rateMin)
  if (q.rateMax !== null) builder = builder.lte('avg_rate', q.rateMax)
  if (q.engMin !== null) builder = builder.gte('engagement_rate', q.engMin)
  if (q.audience) {
    const band = AUDIENCE_BANDS.find(b => b.id === q.audience)
    if (band) builder = builder.gte('audience_size', band.min).lte('audience_size', band.max)
  }
  if (q.from) builder = builder.gte('created_at', `${q.from}T00:00:00Z`)
  if (q.to) builder = builder.lte('created_at', `${q.to}T23:59:59Z`)
  return builder as T
}

export async function listCreators(
  supabase: SupabaseClient, workspaceId: string, q: CreatorsQuery,
): Promise<Page<CreatorRow>> {
  let listIds: string[] | null = null
  if (q.list) {
    const { data: members } = await supabase
      .from('creator_list_members').select('creator_id')
      .eq('workspace_id', workspaceId).eq('list_id', q.list)
    listIds = (members ?? []).map(m => m.creator_id as string)
    if (listIds.length === 0) return emptyPage<CreatorRow>()
  }

  const sort = CREATOR_SORT_COLUMNS[q.sort] ?? CREATOR_SORT_COLUMNS.recent
  const offset = (q.page - 1) * q.size

  let builder = supabase
    .from('ugc_creators')
    .select(CREATOR_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyCreatorFilters(builder, q)
  if (listIds) builder = builder.in('id', listIds)

  const { data, count, error } = await builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })
    .range(offset, offset + q.size - 1)

  if (error) return emptyPage<CreatorRow>(error.message)
  return { rows: await signAvatars((data ?? []) as unknown as CreatorRow[]), total: count ?? 0, error: null }
}

export interface CreatorAggregates {
  total: number
  active: number
  shortlisted: number
  rightsReady: number
  avgEngagement: number
  avgRate: number
  createdSeries: number[]
  previousTotal: number
  previousActive: number
  previousShortlisted: number
  previousRightsReady: number
}

export async function creatorAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CreatorAggregates> {
  const { data } = await supabase
    .from('ugc_creators')
    .select('id, relationship_status, shortlisted, rights_readiness, engagement_rate, avg_rate, created_at')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  const rows = data ?? []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const before = rows.filter(r => new Date(r.created_at as string).getTime() < cutoff)

  const rates = rows.map(r => Number(r.avg_rate ?? 0)).filter(v => v > 0)
  const engagements = rows.map(r => Number(r.engagement_rate ?? 0)).filter(v => v > 0)

  return {
    total: rows.length,
    active: rows.filter(r => ACTIVE_RELATIONSHIPS.includes(r.relationship_status as never)).length,
    shortlisted: rows.filter(r => r.shortlisted).length,
    rightsReady: rows.filter(r => r.rights_readiness === 'full').length,
    avgEngagement: engagements.length ? engagements.reduce((a, b) => a + b, 0) / engagements.length : 0,
    avgRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
    createdSeries: dailySeries(rows.map(r => r.created_at as string)),
    previousTotal: before.length,
    previousActive: before.filter(r => ACTIVE_RELATIONSHIPS.includes(r.relationship_status as never)).length,
    previousShortlisted: before.filter(r => r.shortlisted).length,
    previousRightsReady: before.filter(r => r.rights_readiness === 'full').length,
  }
}

/** Lightweight id/name/handle/avatar list for creator pickers in wizards and modals. */
export async function creatorPickerList(
  supabase: SupabaseClient, workspaceId: string, limit = 200,
): Promise<Pick<CreatorRow, 'id' | 'name' | 'handle' | 'avatar_url'>[]> {
  const { data } = await supabase
    .from('ugc_creators').select('id, name, handle, avatar_url')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('name', { ascending: true }).limit(limit)
  return (data ?? []) as Pick<CreatorRow, 'id' | 'name' | 'handle' | 'avatar_url'>[]
}

export async function getCreator(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<CreatorRow | null> {
  const { data } = await supabase
    .from('ugc_creators').select(CREATOR_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as CreatorRow) ?? null
}

/** Shortlisted creators for the "Featured / Shortlist" panel. */
export async function shortlistedCreators(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
): Promise<CreatorRow[]> {
  const { data } = await supabase
    .from('ugc_creators').select(CREATOR_COLUMNS)
    .eq('workspace_id', workspaceId).eq('shortlisted', true).is('archived_at', null)
    .order('audience_size', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as CreatorRow[]
}

export async function listCreatorLists(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CreatorListRow[]> {
  const { data } = await supabase
    .from('creator_lists')
    .select('id, workspace_id, name, description, list_type, campaign_id, owner_id, is_shared, archived_at, created_at, updated_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('created_at', { ascending: false }).limit(100)
  const lists = (data ?? []) as CreatorListRow[]
  if (lists.length === 0) return lists

  const { data: members } = await supabase
    .from('creator_list_members').select('list_id')
    .eq('workspace_id', workspaceId).in('list_id', lists.map(l => l.id))
  const counts = new Map<string, number>()
  for (const member of members ?? []) {
    const key = member.list_id as string
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return lists.map(list => ({ ...list, member_count: counts.get(list.id) ?? 0 }))
}

export async function listInvitations(
  supabase: SupabaseClient, workspaceId: string, limit = 25,
): Promise<InvitationRow[]> {
  const { data } = await supabase
    .from('creator_invitations')
    .select('id, workspace_id, creator_id, email, display_name, message, status, expires_at, sent_at, responded_at, created_at')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as InvitationRow[]
}

/**
 * Top performing creators for the Overview leaderboard. Reach, engagement and
 * earnings are aggregated from real submissions and paid payments rather than
 * stored on the creator row, so the leaderboard cannot drift from source data.
 */
export interface CreatorPerformance {
  creator: CreatorRow
  reach: number
  engagementRate: number
  submissions: number
  approved: number
  approvalRate: number
  rights: number
  earnings: number
  spark: number[]
}

export interface PerformanceFilters {
  q?: string
  campaign?: string
  channel?: string
  status?: string
  from?: string
  to?: string
}

export async function topCreatorPerformance(
  supabase: SupabaseClient, workspaceId: string, limit = 5, filters: PerformanceFilters = {},
): Promise<CreatorPerformance[]> {
  let creatorQuery = supabase.from('ugc_creators').select(CREATOR_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (filters.q) {
    const term = likeTerm(filters.q)
    creatorQuery = creatorQuery.or(`name.ilike.%${term}%,handle.ilike.%${term}%,niche.ilike.%${term}%`)
  }
  if (filters.channel) creatorQuery = creatorQuery.contains('platforms', [filters.channel])

  let submissionQuery = supabase.from('ugc_submissions').select('creator_id, status, views, engagement_rate, submitted_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (filters.campaign) submissionQuery = submissionQuery.eq('campaign_id', filters.campaign)
  if (filters.status) submissionQuery = submissionQuery.eq('status', filters.status)
  if (filters.from) submissionQuery = submissionQuery.gte('submitted_at', `${filters.from}T00:00:00Z`)
  if (filters.to) submissionQuery = submissionQuery.lte('submitted_at', `${filters.to}T23:59:59Z`)

  const [{ data: creators }, { data: submissions }, { data: rights }, { data: payments }] = await Promise.all([
    creatorQuery,
    submissionQuery,
    supabase.from('ugc_rights').select('creator_id, status, expiry_date')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('ugc_payments').select('creator_id, amount, status')
      .eq('workspace_id', workspaceId).eq('status', 'paid'),
  ])

  const byCreator = new Map<string, CreatorPerformance>()
  for (const creator of (creators ?? []) as unknown as CreatorRow[]) {
    byCreator.set(creator.id, {
      creator, reach: 0, engagementRate: 0, submissions: 0, approved: 0,
      approvalRate: 0, rights: 0, earnings: 0, spark: [],
    })
  }

  const engagementTotals = new Map<string, number[]>()
  const stamps = new Map<string, string[]>()
  for (const row of submissions ?? []) {
    const entry = byCreator.get(row.creator_id as string)
    if (!entry) continue
    entry.reach += Number(row.views ?? 0)
    entry.submissions += 1
    if (row.status === 'approved' || row.status === 'published') entry.approved += 1
    const list = engagementTotals.get(row.creator_id as string) ?? []
    if (Number(row.engagement_rate ?? 0) > 0) list.push(Number(row.engagement_rate))
    engagementTotals.set(row.creator_id as string, list)
    const dates = stamps.get(row.creator_id as string) ?? []
    dates.push(row.submitted_at as string)
    stamps.set(row.creator_id as string, dates)
  }
  for (const row of rights ?? []) {
    const entry = byCreator.get(row.creator_id as string)
    if (!entry) continue
    if (effectiveRightsStatus(row.status as string, row.expiry_date as string | null) === 'active') entry.rights += 1
  }
  for (const row of payments ?? []) {
    const entry = byCreator.get(row.creator_id as string)
    if (entry) entry.earnings += Number(row.amount ?? 0)
  }

  for (const [id, entry] of byCreator) {
    const list = engagementTotals.get(id) ?? []
    entry.engagementRate = list.length ? list.reduce((a, b) => a + b, 0) / list.length : Number(entry.creator.engagement_rate ?? 0)
    entry.approvalRate = entry.submissions ? (entry.approved / entry.submissions) * 100 : 0
    entry.spark = dailySeries(stamps.get(id) ?? [], 14)
  }

  return [...byCreator.values()]
    .filter(entry => (filters.campaign || filters.status || filters.from || filters.to)
      ? entry.submissions > 0
      : entry.submissions > 0 || entry.earnings > 0)
    .sort((a, b) => b.reach - a.reach || b.earnings - a.earnings)
    .slice(0, limit)
}

// ============================================================================
// Briefs
// ============================================================================

const BRIEF_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  due_soonest: { column: 'deadline', ascending: true },
  due_latest: { column: 'deadline', ascending: false },
  recent: { column: 'updated_at', ascending: false },
  name_asc: { column: 'title', ascending: true },
  budget_desc: { column: 'budget', ascending: false },
  creators_desc: { column: 'creators_assigned', ascending: false },
}

function applyBriefFilters<T>(query: T, q: BriefsQuery): T {
  let builder = query as FilterOps
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)

  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`)
  }
  if (q.campaign) builder = builder.eq('campaign_id', q.campaign)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.approval) builder = builder.eq('approval_stage', q.approval)
  if (q.rights) builder = builder.eq('rights_requirement', q.rights)
  if (q.channel) builder = builder.contains('channels', [q.channel])
  if (q.budgetMin !== null) builder = builder.gte('budget', q.budgetMin)
  if (q.budgetMax !== null) builder = builder.lte('budget', q.budgetMax)
  if (q.from) builder = builder.gte('deadline', q.from)
  if (q.to) builder = builder.lte('deadline', q.to)

  const today = new Date().toISOString().slice(0, 10)
  if (q.due === 'overdue') {
    builder = builder.not('deadline', 'is', null).lte('deadline', today)
  } else if (q.due) {
    const horizon = new Date(Date.now() + Number(q.due) * 86_400_000).toISOString().slice(0, 10)
    builder = builder.gte('deadline', today).lte('deadline', horizon)
  }
  return builder as T
}

export async function listBriefs(
  supabase: SupabaseClient, workspaceId: string, q: BriefsQuery,
  opts: { limit?: number; all?: boolean } = {},
): Promise<Page<BriefRow>> {
  let creatorBriefIds: string[] | null = null
  if (q.creator) {
    const { data } = await supabase
      .from('ugc_brief_creators').select('brief_id')
      .eq('workspace_id', workspaceId).eq('creator_id', q.creator)
    creatorBriefIds = (data ?? []).map(r => r.brief_id as string)
    if (creatorBriefIds.length === 0) return emptyPage<BriefRow>()
  }

  const sort = BRIEF_SORT_COLUMNS[q.sort] ?? BRIEF_SORT_COLUMNS.due_soonest
  let builder = supabase
    .from('ugc_briefs').select(BRIEF_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyBriefFilters(builder, q)
  if (creatorBriefIds) builder = builder.in('id', creatorBriefIds)

  builder = builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (!opts.all) {
    const offset = (q.page - 1) * q.size
    builder = builder.range(offset, offset + q.size - 1)
  } else if (opts.limit) {
    builder = builder.limit(opts.limit)
  }

  const { data, count, error } = await builder
  if (error) return emptyPage<BriefRow>(error.message)
  return { rows: await withBriefCovers(supabase, (data ?? []) as unknown as BriefRow[]), total: count ?? 0, error: null }
}

export interface BriefAggregates {
  total: number
  byStatus: Record<BriefStatus, number>
  submittedDeliverables: number
  targetDeliverables: number
  completionRate: number
  avgApprovalDays: number | null
  previous: { open: number; draft: number; inProgress: number; submitted: number; completionRate: number; avgApprovalDays: number | null }
  createdSeries: number[]
}

const EMPTY_BRIEF_STATUS: Record<BriefStatus, number> = {
  draft: 0, open: 0, in_progress: 0, submitted: 0, completed: 0, on_hold: 0, cancelled: 0,
}

export async function briefAggregates(
  supabase: SupabaseClient, workspaceId: string, campaignId?: string,
): Promise<BriefAggregates> {
  let builder = supabase
    .from('ugc_briefs')
    .select('id, status, deliverables_target, deliverables_submitted, created_at, completed_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)
  if (campaignId) builder = builder.eq('campaign_id', campaignId)
  const { data } = await builder

  const rows = data ?? []
  const byStatus = { ...EMPTY_BRIEF_STATUS }
  let submitted = 0
  let target = 0
  const approvalDays: number[] = []
  const previousApprovalDays: number[] = []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000

  for (const row of rows) {
    const status = row.status as BriefStatus
    if (status in byStatus) byStatus[status] += 1
    submitted += Number(row.deliverables_submitted ?? 0)
    target += Number(row.deliverables_target ?? 0)
    if (row.completed_at) {
      const days = (new Date(row.completed_at as string).getTime() - new Date(row.created_at as string).getTime()) / 86_400_000
      if (days >= 0) (new Date(row.completed_at as string).getTime() >= cutoff ? approvalDays : previousApprovalDays).push(days)
    }
  }

  const previousRows = rows.filter(r => new Date(r.created_at as string).getTime() < cutoff)
  const previousCompleted = previousRows.filter(r => r.status === 'completed').length
  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

  return {
    total: rows.length,
    byStatus,
    submittedDeliverables: submitted,
    targetDeliverables: target,
    completionRate: rows.length ? (byStatus.completed / rows.length) * 100 : 0,
    avgApprovalDays: average(approvalDays),
    previous: {
      open: previousRows.filter(r => r.status === 'open').length,
      draft: previousRows.filter(r => r.status === 'draft').length,
      inProgress: previousRows.filter(r => r.status === 'in_progress').length,
      submitted: previousRows.reduce((total, r) => total + Number(r.deliverables_submitted ?? 0), 0),
      completionRate: previousRows.length ? (previousCompleted / previousRows.length) * 100 : 0,
      avgApprovalDays: average(previousApprovalDays),
    },
    createdSeries: dailySeries(rows.map(r => r.created_at as string)),
  }
}

export async function getBrief(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<BriefRow | null> {
  const { data } = await supabase
    .from('ugc_briefs').select(BRIEF_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!data) return null
  const [brief] = await withBriefCovers(supabase, [data as unknown as BriefRow])
  return brief
}

export async function briefCreators(
  supabase: SupabaseClient, workspaceId: string, briefId: string,
): Promise<BriefCreatorRow[]> {
  const { data } = await supabase
    .from('ugc_brief_creators')
    .select(`id, brief_id, creator_id, status, agreed_rate, currency, invited_at, responded_at,
      creator:ugc_creators!ugc_brief_creators_creator_id_fkey(${CREATOR_COLUMNS})`)
    .eq('workspace_id', workspaceId).eq('brief_id', briefId)
    .order('invited_at', { ascending: true })
  return (data ?? []) as unknown as BriefCreatorRow[]
}

export async function briefDeliverables(
  supabase: SupabaseClient, workspaceId: string, briefId: string,
): Promise<BriefDeliverableRow[]> {
  const { data } = await supabase
    .from('ugc_brief_deliverables')
    .select('id, brief_id, title, asset_type, quantity, channel, due_date, notes, position')
    .eq('workspace_id', workspaceId).eq('brief_id', briefId)
    .order('position', { ascending: true })
  return (data ?? []) as BriefDeliverableRow[]
}

export async function upcomingBriefDeadlines(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<BriefRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ugc_briefs').select(BRIEF_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .not('deadline', 'is', null).gte('deadline', today)
    .in('status', ['draft', 'open', 'in_progress', 'submitted'])
    .order('deadline', { ascending: true }).limit(limit)
  return withBriefCovers(supabase, (data ?? []) as unknown as BriefRow[])
}

// ============================================================================
// Submissions
// ============================================================================

const SUBMISSION_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: 'submitted_at', ascending: false },
  oldest: { column: 'submitted_at', ascending: true },
  issues_desc: { column: 'issue_count', ascending: false },
  engagement_desc: { column: 'engagement_rate', ascending: false },
  views_desc: { column: 'views', ascending: false },
}

function applySubmissionFilters<T>(query: T, q: SubmissionsQuery): T {
  let builder = query as FilterOps
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)

  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`title.ilike.%${term}%,notes.ilike.%${term}%`)
  }
  if (q.creator) builder = builder.eq('creator_id', q.creator)
  if (q.brief) builder = builder.eq('brief_id', q.brief)
  if (q.campaign) builder = builder.eq('campaign_id', q.campaign)
  if (q.assetType) builder = builder.eq('asset_type', q.assetType)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.reviewer) builder = builder.eq('reviewer_id', q.reviewer)
  if (q.rights) builder = builder.eq('rights_status', q.rights)
  if (q.from) builder = builder.gte('submitted_at', `${q.from}T00:00:00Z`)
  if (q.to) builder = builder.lte('submitted_at', `${q.to}T23:59:59Z`)
  return builder as T
}

export async function listSubmissions(
  supabase: SupabaseClient, workspaceId: string, q: SubmissionsQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<SubmissionRow>> {
  let issueIds: string[] | null = null
  if (q.issue) {
    const { data } = await supabase
      .from('ugc_submission_issues').select('submission_id')
      .eq('workspace_id', workspaceId).eq('category', q.issue).in('status', ['open', 'confirmed'])
    issueIds = [...new Set((data ?? []).map(r => r.submission_id as string))]
    if (issueIds.length === 0) return emptyPage<SubmissionRow>()
  }

  const sort = SUBMISSION_SORT_COLUMNS[q.sort] ?? SUBMISSION_SORT_COLUMNS.newest
  let builder = supabase
    .from('ugc_submissions').select(SUBMISSION_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applySubmissionFilters(builder, q)
  if (issueIds) builder = builder.in('id', issueIds)

  builder = builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (opts.all) {
    if (opts.limit) builder = builder.limit(opts.limit)
  } else {
    const offset = (q.page - 1) * q.size
    builder = builder.range(offset, offset + q.size - 1)
  }

  const { data, count, error } = await builder
  if (error) return emptyPage<SubmissionRow>(error.message)
  return { rows: await withSubmissionMedia(supabase, (data ?? []) as unknown as SubmissionRow[]), total: count ?? 0, error: null }
}

export interface SubmissionAggregates {
  total: number
  byStatus: Record<SubmissionStatus, number>
  avgReviewSeconds: number | null
  firstTimeApprovalRate: number
  previous: { total: number; waiting: number; inReview: number; approved: number; changes: number; avgReviewSeconds: number | null }
  submittedSeries: number[]
}

const EMPTY_SUBMISSION_STATUS: Record<SubmissionStatus, number> = {
  draft: 0, waiting_review: 0, in_review: 0, changes_requested: 0,
  approved: 0, rejected: 0, published: 0,
}

export async function submissionAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<SubmissionAggregates> {
  const { data } = await supabase
    .from('ugc_submissions')
    .select('id, status, version, review_seconds, submitted_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  const rows = data ?? []
  const byStatus = { ...EMPTY_SUBMISSION_STATUS }
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const reviewSeconds: number[] = []
  const previousReviewSeconds: number[] = []
  let approvedFirstTime = 0
  let approvedTotal = 0

  for (const row of rows) {
    const status = row.status as SubmissionStatus
    if (status in byStatus) byStatus[status] += 1
    const seconds = Number(row.review_seconds ?? 0)
    const recent = new Date(row.submitted_at as string).getTime() >= cutoff
    if (seconds > 0) (recent ? reviewSeconds : previousReviewSeconds).push(seconds)
    if (status === 'approved' || status === 'published') {
      approvedTotal += 1
      if (Number(row.version ?? 1) === 1) approvedFirstTime += 1
    }
  }

  const previousRows = rows.filter(r => new Date(r.submitted_at as string).getTime() < cutoff)
  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

  return {
    total: rows.length,
    byStatus,
    avgReviewSeconds: average(reviewSeconds),
    firstTimeApprovalRate: approvedTotal ? (approvedFirstTime / approvedTotal) * 100 : 0,
    previous: {
      total: previousRows.length,
      waiting: previousRows.filter(r => r.status === 'waiting_review').length,
      inReview: previousRows.filter(r => r.status === 'in_review').length,
      approved: previousRows.filter(r => r.status === 'approved' || r.status === 'published').length,
      changes: previousRows.filter(r => r.status === 'changes_requested').length,
      avgReviewSeconds: average(previousReviewSeconds),
    },
    submittedSeries: dailySeries(rows.map(r => r.submitted_at as string)),
  }
}

export async function getSubmission(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<SubmissionRow | null> {
  const { data } = await supabase
    .from('ugc_submissions').select(SUBMISSION_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!data) return null
  const [submission] = await withSubmissionMedia(supabase, [data as unknown as SubmissionRow])
  return submission
}

/**
 * Submission media. The bucket is private, so each asset is returned with a
 * short-lived signed URL rather than a permanent public link.
 */
export async function submissionAssets(
  supabase: SupabaseClient, workspaceId: string, submissionId: string,
): Promise<SubmissionAssetRow[]> {
  const { data } = await supabase
    .from('ugc_submission_assets')
    .select('id, submission_id, version, storage_path, media_type, mime_type, size_bytes, width, height, duration_seconds, thumbnail_path, original_name, created_at')
    .eq('workspace_id', workspaceId).eq('submission_id', submissionId)
    .order('version', { ascending: false }).order('created_at', { ascending: true })

  const assets = (data ?? []) as SubmissionAssetRow[]
  if (assets.length === 0) return assets

  const { data: signed } = await supabase.storage
    .from('ugc-submissions')
    .createSignedUrls(assets.map(a => a.storage_path), 60 * 10)

  const urls = new Map((signed ?? []).map(entry => [entry.path ?? '', entry.signedUrl]))
  return assets.map(asset => ({ ...asset, signed_url: urls.get(asset.storage_path) ?? null }))
}

export async function submissionReviews(
  supabase: SupabaseClient, workspaceId: string, submissionId: string,
): Promise<SubmissionReviewRow[]> {
  const { data } = await supabase
    .from('ugc_submission_reviews')
    .select(`id, submission_id, version, reviewer_id, decision, note, creator_visible, timecode_seconds, created_at,
      reviewer:profiles!ugc_submission_reviews_reviewer_id_fkey(${PERSON})`)
    .eq('workspace_id', workspaceId).eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
  return signAvatars((data ?? []) as unknown as SubmissionReviewRow[])
}

export async function submissionIssues(
  supabase: SupabaseClient, workspaceId: string, submissionId: string,
): Promise<SubmissionIssueRow[]> {
  const { data } = await supabase
    .from('ugc_submission_issues')
    .select('id, submission_id, category, severity, detail, source, status, created_at, resolved_at')
    .eq('workspace_id', workspaceId).eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
  return (data ?? []) as SubmissionIssueRow[]
}

/** Flagged-issue counts for the Submissions right rail. */
export async function flaggedIssueCounts(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ category: string; count: number }[]> {
  const { data } = await supabase
    .from('ugc_submission_issues').select('category')
    .eq('workspace_id', workspaceId).in('status', ['open', 'confirmed'])
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const key = row.category as string
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

/** The reviewer queue: everything waiting on a human, oldest first. */
export async function reviewQueue(
  supabase: SupabaseClient, workspaceId: string, limit = 10,
): Promise<SubmissionRow[]> {
  const { data } = await supabase
    .from('ugc_submissions').select(SUBMISSION_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .in('status', ['waiting_review', 'in_review'])
    .order('submitted_at', { ascending: true }).limit(limit)
  return withSubmissionMedia(supabase, (data ?? []) as unknown as SubmissionRow[])
}

export async function reviewQueueCount(
  supabase: SupabaseClient, workspaceId: string,
): Promise<number> {
  const { count } = await supabase
    .from('ugc_submissions').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .in('status', ['waiting_review', 'in_review'])
  return count ?? 0
}

// ============================================================================
// Rights
// ============================================================================

const RIGHTS_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  expiry_soonest: { column: 'expiry_date', ascending: true },
  expiry_latest: { column: 'expiry_date', ascending: false },
  start_newest: { column: 'start_date', ascending: false },
  creator_asc: { column: 'created_at', ascending: false },
  asset_asc: { column: 'asset_label', ascending: true },
}

function applyRightsFilters<T>(query: T, q: RightsQuery): T {
  let builder = query as FilterOps
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)

  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`asset_label.ilike.%${term}%,notes.ilike.%${term}%`)
  }
  if (q.creator) builder = builder.eq('creator_id', q.creator)
  if (q.campaign) builder = builder.eq('campaign_id', q.campaign)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.scope) builder = builder.eq('usage_scope', q.scope)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.channel) builder = builder.contains('channels', [q.channel])
  if (q.territory) builder = builder.contains('territories', [q.territory])
  if (q.from) builder = builder.gte('expiry_date', q.from)
  if (q.to) builder = builder.lte('expiry_date', q.to)

  const today = new Date().toISOString().slice(0, 10)
  if (q.expiry === 'expired') {
    builder = builder.not('expiry_date', 'is', null).lt('expiry_date', today)
  } else if (q.expiry) {
    const horizon = new Date(Date.now() + Number(q.expiry) * 86_400_000).toISOString().slice(0, 10)
    builder = builder.gte('expiry_date', today).lte('expiry_date', horizon)
  }
  return builder as T
}

export async function listRights(
  supabase: SupabaseClient, workspaceId: string, q: RightsQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<RightsRow>> {
  const sort = RIGHTS_SORT_COLUMNS[q.sort] ?? RIGHTS_SORT_COLUMNS.expiry_soonest
  let builder = supabase
    .from('ugc_rights').select(RIGHTS_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyRightsFilters(builder, q)
  builder = builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (opts.all) {
    if (opts.limit) builder = builder.limit(opts.limit)
  } else {
    const offset = (q.page - 1) * q.size
    builder = builder.range(offset, offset + q.size - 1)
  }

  const { data, count, error } = await builder
  if (error) return emptyPage<RightsRow>(error.message)
  return { rows: await withRightsMedia(supabase, (data ?? []) as unknown as RightsRow[]), total: count ?? 0, error: null }
}

export interface RightsAggregates {
  total: number
  byStatus: Record<RightsStatus, number>
  expiringSoon: number
  pendingApprovals: number
  restricted: number
  renewalsThisMonth: number
  complianceRate: number
  fullyLicensed: number
  limitedLicence: number
  unlicensedAssets: number
  createdSeries: number[]
  expiredSeries: number[]
  previous: { active: number; expiringSoon: number; pending: number; restricted: number; renewals: number; complianceRate: number }
}

const EMPTY_RIGHTS_STATUS: Record<RightsStatus, number> = {
  draft: 0, requested: 0, pending_approval: 0, active: 0, expired: 0,
  restricted: 0, revoked: 0, renewal_pending: 0, rejected: 0,
}

export async function rightsAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<RightsAggregates> {
  const [{ data }, { count: submissionCount }] = await Promise.all([
    supabase.from('ugc_rights')
      .select('id, status, usage_scope, expiry_date, start_date, created_at')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('ugc_submissions').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).is('archived_at', null),
  ])

  const rows = data ?? []
  const byStatus = { ...EMPTY_RIGHTS_STATUS }
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const monthEnd = new Date()
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)
  const monthEndKey = monthEnd.toISOString().slice(0, 10)
  const todayKey = new Date().toISOString().slice(0, 10)

  let expiringSoon = 0
  let renewalsThisMonth = 0
  let fullyLicensed = 0
  let limitedLicence = 0
  const expiredStamps: string[] = []

  for (const row of rows) {
    const status = effectiveRightsStatus(row.status as string, row.expiry_date as string | null)
    if (status in byStatus) byStatus[status] += 1
    const remaining = daysUntil(row.expiry_date as string | null)
    if (status === 'active' && remaining !== null && remaining >= 0 && remaining <= RIGHTS_EXPIRING_DAYS) expiringSoon += 1
    if (row.expiry_date && (row.expiry_date as string) >= todayKey && (row.expiry_date as string) <= monthEndKey) renewalsThisMonth += 1
    if (status === 'active') {
      if (['full_digital', 'perpetual', 'exclusive'].includes(row.usage_scope as string)) fullyLicensed += 1
      else limitedLicence += 1
    }
    if (status === 'expired' && row.expiry_date) expiredStamps.push(`${row.expiry_date}T00:00:00Z`)
  }

  const previousRows = rows.filter(r => new Date(r.created_at as string).getTime() < cutoff)
  const previousActive = previousRows.filter(r => effectiveRightsStatus(r.status as string, r.expiry_date as string | null) === 'active').length
  const previousCompliance = previousRows.length ? (previousActive / previousRows.length) * 100 : 0
  const assetsWithRights = fullyLicensed + limitedLicence
  const unlicensed = Math.max(0, (submissionCount ?? 0) - assetsWithRights)
  const denominator = assetsWithRights + unlicensed + byStatus.pending_approval + byStatus.restricted

  return {
    total: rows.length,
    byStatus,
    expiringSoon,
    pendingApprovals: byStatus.pending_approval + byStatus.requested,
    restricted: byStatus.restricted,
    renewalsThisMonth,
    complianceRate: denominator ? (assetsWithRights / denominator) * 100 : 0,
    fullyLicensed,
    limitedLicence,
    unlicensedAssets: unlicensed,
    createdSeries: dailySeries(rows.map(r => r.created_at as string)),
    expiredSeries: dailySeries(expiredStamps),
    previous: {
      active: previousActive,
      expiringSoon: previousRows.filter(r => {
        const remaining = daysUntil(r.expiry_date as string | null)
        return remaining !== null && remaining >= 0 && remaining <= RIGHTS_EXPIRING_DAYS
      }).length,
      pending: previousRows.filter(r => r.status === 'pending_approval' || r.status === 'requested').length,
      restricted: previousRows.filter(r => r.status === 'restricted').length,
      renewals: previousRows.filter(r => r.expiry_date).length,
      complianceRate: previousCompliance,
    },
  }
}

export async function getRights(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<RightsRow | null> {
  const { data } = await supabase
    .from('ugc_rights').select(RIGHTS_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!data) return null
  const [record] = await withRightsMedia(supabase, [data as unknown as RightsRow])
  return record
}

export async function expiringLicences(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<RightsRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ugc_rights').select(RIGHTS_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .in('status', ['active', 'renewal_pending'])
    .not('expiry_date', 'is', null).gte('expiry_date', today)
    .order('expiry_date', { ascending: true }).limit(limit)
  return withRightsMedia(supabase, (data ?? []) as unknown as RightsRow[])
}

export async function recentRightsApprovals(
  supabase: SupabaseClient, workspaceId: string, limit = 4,
): Promise<RightsRow[]> {
  const { data } = await supabase
    .from('ugc_rights').select(RIGHTS_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null).eq('status', 'active')
    .order('updated_at', { ascending: false }).limit(limit)
  return withRightsMedia(supabase, (data ?? []) as unknown as RightsRow[])
}

export async function listRightsRequests(
  supabase: SupabaseClient, workspaceId: string, limit = 25, creatorId?: string,
): Promise<RightsRequestRow[]> {
  let builder = supabase
    .from('ugc_rights_requests')
    .select(`id, workspace_id, rights_id, creator_id, submission_id, requested_channels,
      requested_territories, requested_duration_days, paid_media, exclusivity, proposed_fee,
      currency, message, status, counter_fee, expires_at, responded_at, created_at,
      creator:ugc_creators!ugc_rights_requests_creator_id_fkey(id, name, handle, avatar_url)`)
    .eq('workspace_id', workspaceId)
  if (creatorId) builder = builder.eq('creator_id', creatorId)
  const { data } = await builder
    .order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as RightsRequestRow[]
}

/**
 * Derives compliance alerts from the actual rights, campaign and submission
 * records rather than from a manually chosen status badge. Each conflict names
 * the records that produced it so it can be acted on.
 */
export async function rightsConflicts(
  supabase: SupabaseClient, workspaceId: string,
): Promise<RightsConflict[]> {
  const { data } = await supabase
    .from('ugc_rights')
    .select(`id, status, expiry_date, start_date, territories, channels, agreement_url,
      agreement_signed, paid_amplification, submission_id, submission_version,
      campaign:campaigns!ugc_rights_campaign_id_fkey(id, status, end_date),
      submission:ugc_submissions!ugc_rights_submission_id_fkey(id, status, version)`)
    .eq('workspace_id', workspaceId).is('archived_at', null)

  type Row = {
    id: string; status: string; expiry_date: string | null; territories: string[] | null
    agreement_url: string | null; agreement_signed: boolean
    campaign: { status: string | null; end_date: string | null } | null
    submission: { status: string; version: number } | null
    submission_version: number | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const buckets = new Map<string, { severity: 'low' | 'medium' | 'high'; ids: string[] }>()
  const add = (type: string, severity: 'low' | 'medium' | 'high', id: string) => {
    const bucket = buckets.get(type) ?? { severity, ids: [] }
    bucket.ids.push(id)
    buckets.set(type, bucket)
  }

  const activeCampaignStatuses = new Set(['live', 'scheduled', 'in_production', 'reporting'])

  for (const row of rows) {
    const status = effectiveRightsStatus(row.status, row.expiry_date)

    if (status === 'expired' && row.campaign && activeCampaignStatuses.has(row.campaign.status ?? '')) {
      add('expired_in_active_campaign', 'high', row.id)
    }
    if (status === 'pending_approval' || status === 'requested') {
      add('request_still_pending', 'medium', row.id)
    }
    if (status === 'restricted') {
      add('expired_in_active_campaign', 'medium', row.id)
    }
    if (!row.territories || row.territories.length === 0) {
      add('territory_not_licensed', 'low', row.id)
    }
    if (!row.agreement_url) {
      add('missing_agreement', 'medium', row.id)
    } else if (!row.agreement_signed) {
      add('agreement_not_signed', 'medium', row.id)
    }
    if (row.submission && row.submission.status !== 'approved' && row.submission.status !== 'published' && status === 'active') {
      add('unapproved_submission_version', 'high', row.id)
    }
    if (
      row.submission && row.submission_version !== null
      && row.submission.version !== row.submission_version && status === 'active'
    ) {
      add('unapproved_submission_version', 'high', row.id)
    }
    if (
      row.campaign?.end_date && row.expiry_date
      && row.campaign.end_date > row.expiry_date && status === 'active'
    ) {
      add('campaign_beyond_expiry', 'high', row.id)
    }
  }

  return [...buckets.entries()]
    .map(([type, bucket]) => ({
      type,
      label: type,
      severity: bucket.severity,
      count: bucket.ids.length,
      sampleIds: bucket.ids.slice(0, 10),
    }))
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 }
      return rank[a.severity] - rank[b.severity] || b.count - a.count
    })
}

// ============================================================================
// Payments
// ============================================================================

const PAYMENT_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  submitted_newest: { column: 'submitted_date', ascending: false },
  submitted_oldest: { column: 'submitted_date', ascending: true },
  amount_desc: { column: 'amount', ascending: false },
  amount_asc: { column: 'amount', ascending: true },
  payout_soonest: { column: 'payout_date', ascending: true },
  creator_asc: { column: 'created_at', ascending: false },
}

function applyPaymentFilters<T>(query: T, q: PaymentsQuery): T {
  let builder = query as FilterOps
  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`invoice_number.ilike.%${term}%,notes.ilike.%${term}%,provider_reference.ilike.%${term}%`)
  }
  if (q.creator) builder = builder.eq('creator_id', q.creator)
  if (q.campaign) builder = builder.eq('campaign_id', q.campaign)
  if (q.brief) builder = builder.eq('brief_id', q.brief)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.method) builder = builder.eq('payment_method', q.method)
  if (q.approver) builder = builder.eq('approved_by', q.approver)
  if (q.currency) builder = builder.eq('currency', q.currency)
  if (q.invoice) builder = builder.eq('invoice_status', q.invoice)
  if (q.tax) builder = builder.eq('tax_status', q.tax)
  if (q.batch) builder = builder.eq('batch_id', q.batch)
  if (q.from) builder = builder.gte('payout_date', q.from)
  if (q.to) builder = builder.lte('payout_date', q.to)
  return builder as T
}

export async function listPayments(
  supabase: SupabaseClient, workspaceId: string, q: PaymentsQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<PaymentRow>> {
  const sort = PAYMENT_SORT_COLUMNS[q.sort] ?? PAYMENT_SORT_COLUMNS.submitted_newest
  let builder = supabase
    .from('ugc_payments').select(PAYMENT_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyPaymentFilters(builder, q)
  builder = builder
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })

  if (opts.all) {
    if (opts.limit) builder = builder.limit(opts.limit)
  } else {
    const offset = (q.page - 1) * q.size
    builder = builder.range(offset, offset + q.size - 1)
  }

  const { data, count, error } = await builder
  if (error) return emptyPage<PaymentRow>(error.message)
  return { rows: await signAvatars((data ?? []) as unknown as PaymentRow[]), total: count ?? 0, error: null }
}

export interface PaymentAggregates {
  total: number
  byStatus: Record<PaymentStatus, number>
  pendingAmount: number
  paidThisMonth: number
  inReviewAmount: number
  upcomingAmount: number
  totalSpend: number
  avgPayoutDays: number | null
  currency: string
  byMethod: { method: string; count: number; amount: number }[]
  byCampaign: { id: string | null; name: string; amount: number }[]
  spendSeries: MetricPoint[]
  previous: { pendingAmount: number; paidAmount: number; inReviewAmount: number; totalSpend: number; avgPayoutDays: number | null; upcomingAmount: number }
}

const EMPTY_PAYMENT_STATUS: Record<PaymentStatus, number> = {
  draft: 0, invoice_required: 0, invoice_submitted: 0, in_review: 0, pending_approval: 0,
  approved: 0, scheduled: 0, processing: 0, paid: 0, failed: 0, on_hold: 0,
  cancelled: 0, refunded: 0, partially_paid: 0,
}

const PENDING_STATUSES: PaymentStatus[] = [
  'draft', 'invoice_required', 'invoice_submitted', 'in_review', 'pending_approval', 'approved', 'scheduled',
]
const REVIEW_STATUSES: PaymentStatus[] = ['in_review', 'pending_approval']

export async function paymentAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<PaymentAggregates> {
  const { data } = await supabase
    .from('ugc_payments')
    .select(`id, status, amount, currency, payment_method, payout_date, paid_at, submitted_date,
      created_at, campaign_id, campaign:campaigns!ugc_payments_campaign_id_fkey(id, name)`)
    .eq('workspace_id', workspaceId)

  type Row = {
    id: string; status: string; amount: number; currency: string | null
    payment_method: string | null; payout_date: string | null; paid_at: string | null
    submitted_date: string | null; created_at: string; campaign_id: string | null
    campaign: { id: string; name: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const byStatus = { ...EMPTY_PAYMENT_STATUS }
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const previousMonthStart = new Date(monthStart)
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1)
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const todayKey = new Date().toISOString().slice(0, 10)

  let pendingAmount = 0
  let paidThisMonth = 0
  let previousPaid = 0
  let inReviewAmount = 0
  let upcomingAmount = 0
  let totalSpend = 0
  let previousSpend = 0
  let previousPending = 0
  let previousReview = 0
  const payoutDays: number[] = []
  const previousPayoutDays: number[] = []
  const methods = new Map<string, { count: number; amount: number }>()
  const campaigns = new Map<string, { name: string; amount: number }>()
  const spendByDay = new Map<string, { total: number; paid: number }>()

  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    spendByDay.set(dayKey(new Date(Date.now() - i * 86_400_000)), { total: 0, paid: 0 })
  }

  for (const row of rows) {
    const status = row.status as PaymentStatus
    const amount = Number(row.amount ?? 0)
    if (status in byStatus) byStatus[status] += 1

    const recent = new Date(row.created_at).getTime() >= cutoff
    if (PENDING_STATUSES.includes(status)) { if (recent) pendingAmount += amount; else previousPending += amount }
    if (REVIEW_STATUSES.includes(status)) { if (recent) inReviewAmount += amount; else previousReview += amount }

    if (status === 'paid' || status === 'partially_paid') {
      totalSpend += amount
      const paidAt = row.paid_at ? new Date(row.paid_at) : null
      if (paidAt && paidAt >= monthStart) paidThisMonth += amount
      else if (paidAt && paidAt >= previousMonthStart) previousPaid += amount
      if (paidAt && paidAt.getTime() >= cutoff) {
        const key = dayKey(paidAt)
        const bucket = spendByDay.get(key)
        if (bucket) bucket.paid += amount
      } else {
        previousSpend += amount
      }
      if (row.submitted_date && row.paid_at) {
        const days = (new Date(row.paid_at).getTime() - new Date(row.submitted_date).getTime()) / 86_400_000
        if (days >= 0) (recent ? payoutDays : previousPayoutDays).push(days)
      }
    }

    if (['approved', 'scheduled', 'processing'].includes(status) && row.payout_date
      && row.payout_date >= todayKey && row.payout_date <= weekAhead) {
      upcomingAmount += amount
    }

    const created = new Date(row.created_at)
    if (created.getTime() >= cutoff) {
      const bucket = spendByDay.get(dayKey(created))
      if (bucket) bucket.total += amount
    }

    const method = row.payment_method ?? 'manual'
    const methodEntry = methods.get(method) ?? { count: 0, amount: 0 }
    methodEntry.count += 1
    methodEntry.amount += amount
    methods.set(method, methodEntry)

    const campaignKey = row.campaign_id ?? 'none'
    const campaignEntry = campaigns.get(campaignKey) ?? { name: row.campaign?.name ?? 'Unassigned', amount: 0 }
    campaignEntry.amount += amount
    campaigns.set(campaignKey, campaignEntry)
  }

  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

  return {
    total: rows.length,
    byStatus,
    pendingAmount,
    paidThisMonth,
    inReviewAmount,
    upcomingAmount,
    totalSpend,
    avgPayoutDays: average(payoutDays),
    currency: rows[0]?.currency ?? 'GBP',
    byMethod: [...methods.entries()]
      .map(([method, entry]) => ({ method, ...entry }))
      .sort((a, b) => b.count - a.count),
    byCampaign: [...campaigns.entries()]
      .map(([id, entry]) => ({ id: id === 'none' ? null : id, name: entry.name, amount: entry.amount }))
      .sort((a, b) => b.amount - a.amount),
    spendSeries: [...spendByDay.entries()].map(([date, value]) => ({ date, total: value.total, paid: value.paid })),
    previous: {
      pendingAmount: previousPending,
      paidAmount: previousPaid,
      inReviewAmount: previousReview,
      totalSpend: previousSpend,
      avgPayoutDays: average(previousPayoutDays),
      upcomingAmount,
    },
  }
}

export async function getPayment(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<PaymentRow | null> {
  const { data } = await supabase
    .from('ugc_payments').select(PAYMENT_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return data ? signAvatars(data as unknown as PaymentRow) : null
}

export async function payoutAttempts(
  supabase: SupabaseClient, workspaceId: string, paymentId: string,
): Promise<PayoutAttemptRow[]> {
  const { data } = await supabase
    .from('ugc_payout_attempts')
    .select('id, payment_id, attempt_no, status, provider, provider_reference, error_code, error_message, created_at')
    .eq('workspace_id', workspaceId).eq('payment_id', paymentId)
    .order('attempt_no', { ascending: false })
  return (data ?? []) as PayoutAttemptRow[]
}

export async function listPaymentBatches(
  supabase: SupabaseClient, workspaceId: string, limit = 25,
): Promise<PaymentBatchRow[]> {
  const { data } = await supabase
    .from('ugc_payment_batches')
    .select('id, workspace_id, name, currency, payment_method, status, total_amount, item_count, scheduled_for, approved_by, approved_at, processed_at, created_at, updated_at')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as PaymentBatchRow[]
}

/** Grouped upcoming payout dates for the Payments right rail. */
export async function upcomingPayouts(
  supabase: SupabaseClient, workspaceId: string, days = 14,
): Promise<{ date: string; count: number; amount: number }[]> {
  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ugc_payments').select('payout_date, amount, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['approved', 'scheduled', 'processing'])
    .not('payout_date', 'is', null).gte('payout_date', today).lte('payout_date', horizon)

  const grouped = new Map<string, { count: number; amount: number }>()
  for (const row of data ?? []) {
    const key = row.payout_date as string
    const entry = grouped.get(key) ?? { count: 0, amount: 0 }
    entry.count += 1
    entry.amount += Number(row.amount ?? 0)
    grouped.set(key, entry)
  }
  return [...grouped.entries()]
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function flaggedInvoices(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<PaymentRow[]> {
  const { data } = await supabase
    .from('ugc_payments').select(PAYMENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .or('invoice_status.eq.flagged,tax_status.eq.missing,status.eq.failed')
    .order('updated_at', { ascending: false }).limit(limit)
  return signAvatars((data ?? []) as unknown as PaymentRow[])
}

/**
 * Payments eligible to join a payout batch. Eligibility is a real gate, not a
 * label: the creator must be payment-ready, the invoice and tax state must be
 * settled, and the payment must not already sit in another batch.
 */
export interface EligiblePayment extends PaymentRow {
  blockedReasons: string[]
}

export async function batchEligiblePayments(
  supabase: SupabaseClient, workspaceId: string,
): Promise<EligiblePayment[]> {
  const { data } = await supabase
    .from('ugc_payments').select(PAYMENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .in('status', ['approved', 'scheduled', 'failed'])
    .is('batch_id', null)
    .order('payout_date', { ascending: true }).limit(200)

  const rows = (data ?? []) as unknown as PaymentRow[]
  if (rows.length === 0) return []

  const { data: creators } = await supabase
    .from('ugc_creators').select('id, payment_ready')
    .eq('workspace_id', workspaceId).in('id', [...new Set(rows.map(r => r.creator_id))])
  const readiness = new Map((creators ?? []).map(c => [c.id as string, Boolean(c.payment_ready)]))

  return rows.map(row => {
    const blockedReasons: string[] = []
    if (!readiness.get(row.creator_id)) blockedReasons.push('Creator payout details incomplete')
    if (row.invoice_status === 'required') blockedReasons.push('Invoice not submitted')
    if (row.invoice_status === 'flagged') blockedReasons.push('Invoice flagged for review')
    if (row.tax_status === 'missing') blockedReasons.push('Tax information missing')
    if (row.approval_state !== 'approved') blockedReasons.push('Payment not approved')
    if (!row.payment_method) blockedReasons.push('No payment method recorded')
    return { ...row, blockedReasons }
  })
}

// ============================================================================
// Activity
// ============================================================================

export async function recentActivity(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
  opts: { entityType?: string; entityId?: string; surface?: string } = {},
): Promise<ActivityRow[]> {
  let builder = supabase
    .from('ugc_activity')
    .select(`id, workspace_id, actor_id, entity_type, entity_id, action, summary, link, surface, created_at,
      actor:profiles!ugc_activity_actor_id_fkey(${PERSON})`)
    .eq('workspace_id', workspaceId)

  if (opts.entityType) builder = builder.eq('entity_type', opts.entityType)
  if (opts.entityId) builder = builder.eq('entity_id', opts.entityId)
  if (opts.surface) builder = builder.eq('surface', opts.surface)

  const { data } = await builder.order('created_at', { ascending: false }).limit(limit)
  return signAvatars((data ?? []) as unknown as ActivityRow[])
}

// ============================================================================
// Overview roll-up
// ============================================================================

export interface CampaignPerformanceSummary {
  totalReach: number
  totalEngagements: number
  avgEngagementRate: number
  previousReach: number
  previousEngagements: number
  previousRate: number
  series: MetricPoint[]
}

export async function campaignPerformance(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CampaignPerformanceSummary> {
  const { data } = await supabase
    .from('ugc_submissions')
    .select('views, engagement_rate, comments_count, submitted_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .gte('submitted_at', isoDaysAgo(TREND_WINDOW_DAYS * 2))

  const rows = data ?? []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const buckets = new Map<string, { reach: number; engagements: number }>()
  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    buckets.set(dayKey(new Date(Date.now() - i * 86_400_000)), { reach: 0, engagements: 0 })
  }

  let reach = 0
  let engagements = 0
  let previousReach = 0
  let previousEngagements = 0
  const rates: number[] = []
  const previousRates: number[] = []

  for (const row of rows) {
    const views = Number(row.views ?? 0)
    const rate = Number(row.engagement_rate ?? 0)
    const engaged = Math.round(views * (rate / 100))
    const recent = new Date(row.submitted_at as string).getTime() >= cutoff
    if (recent) {
      reach += views
      engagements += engaged
      if (rate > 0) rates.push(rate)
      const bucket = buckets.get(dayKey(row.submitted_at as string))
      if (bucket) { bucket.reach += views; bucket.engagements += engaged }
    } else {
      previousReach += views
      previousEngagements += engaged
      if (rate > 0) previousRates.push(rate)
    }
  }

  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)

  return {
    totalReach: reach,
    totalEngagements: engagements,
    avgEngagementRate: average(rates),
    previousReach,
    previousEngagements,
    previousRate: average(previousRates),
    series: [...buckets.entries()].map(([date, value]) => ({ date, ...value })),
  }
}

/** Delivery rate: approved deliverables against everything a brief asked for. */
export function deliveryRate(briefs: BriefAggregates, submissions: SubmissionAggregates): number {
  const approved = submissions.byStatus.approved + submissions.byStatus.published
  if (briefs.targetDeliverables > 0) return Math.min(100, (approved / briefs.targetDeliverables) * 100)
  if (submissions.total === 0) return 0
  return (approved / submissions.total) * 100
}

// ============================================================================
// Design panels
// ============================================================================

export interface SavedViewRow {
  id: string
  name: string
  surface: string
  query: Record<string, string>
  is_shared: boolean
  owner_id: string
}

/** The caller's own views plus views teammates shared, for one surface. */
export async function listSavedViews(
  supabase: SupabaseClient, workspaceId: string, surface: string,
): Promise<SavedViewRow[]> {
  const { data } = await supabase.from('creator_saved_views')
    .select('id, name, surface, query, is_shared, owner_id')
    .eq('workspace_id', workspaceId).eq('surface', surface)
    .order('name', { ascending: true }).limit(50)
  return (data ?? []) as SavedViewRow[]
}

export interface AvailabilitySummary {
  available: number
  previousAvailable: number
  series: number[]
  campaigns: { id: string; name: string; fit: number }[]
}

/**
 * "Availability & Campaign Fit". Availability counts live creator
 * relationships marked available; the week-on-week comparison uses creators
 * added before the last 7 days. Campaign fit is the average stored fit score
 * (0-100) of the creators assigned to that campaign's briefs.
 */
export async function availabilitySummary(
  supabase: SupabaseClient, workspaceId: string,
): Promise<AvailabilitySummary> {
  const [{ data: creators }, { data: assignments }] = await Promise.all([
    supabase.from('ugc_creators').select('id, availability, campaign_fit, created_at')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    supabase.from('ugc_brief_creators')
      .select('creator_id, brief:ugc_briefs!ugc_brief_creators_brief_id_fkey(campaign_id, archived_at, campaign:campaigns!ugc_briefs_campaign_id_fkey(id, name))')
      .eq('workspace_id', workspaceId),
  ])
  const rows = creators ?? []
  const weekAgo = Date.now() - 7 * 86_400_000
  const available = rows.filter(r => r.availability === 'available')
  const fitById = new Map(rows.map(r => [r.id as string, Number(r.campaign_fit ?? 0)]))

  type Assignment = { creator_id: string; brief: { archived_at: string | null; campaign: { id: string; name: string } | null } | null }
  const byCampaign = new Map<string, { name: string; scores: number[] }>()
  for (const row of (assignments ?? []) as unknown as Assignment[]) {
    const campaign = row.brief?.campaign
    if (!campaign || row.brief?.archived_at) continue
    const entry = byCampaign.get(campaign.id) ?? { name: campaign.name, scores: [] }
    const score = fitById.get(row.creator_id)
    if (score !== undefined) entry.scores.push(score)
    byCampaign.set(campaign.id, entry)
  }

  return {
    available: available.length,
    previousAvailable: available.filter(r => new Date(r.created_at as string).getTime() < weekAgo).length,
    series: dailySeries(available.map(r => r.created_at as string), 14).reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []),
    campaigns: [...byCampaign.entries()]
      .filter(([, e]) => e.scores.length > 0)
      .map(([id, e]) => ({ id, name: e.name, fit: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length) }))
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 5),
  }
}

export interface ActivityVisual { avatarUrl: string | null; thumbnailUrl: string | null }

/**
 * Thumbnails for activity rows: the submission's signed preview or the
 * creator's avatar, resolved in two batched reads so the feed never N+1s.
 */
export async function activityVisuals(
  supabase: SupabaseClient, workspaceId: string, items: ActivityRow[],
): Promise<Record<string, ActivityVisual>> {
  const submissionIds = items.filter(i => i.entity_type === 'submission' && i.entity_id).map(i => i.entity_id as string)
  const creatorIds = items.filter(i => i.entity_type === 'creator' && i.entity_id).map(i => i.entity_id as string)
  const [{ data: subs }, { data: creators }] = await Promise.all([
    submissionIds.length
      ? supabase.from('ugc_submissions').select('id, thumbnail_path, thumbnail_url').eq('workspace_id', workspaceId).in('id', submissionIds)
      : Promise.resolve({ data: [] as { id: string; thumbnail_path: string | null; thumbnail_url: string | null }[] }),
    creatorIds.length
      ? supabase.from('ugc_creators').select('id, avatar_url').eq('workspace_id', workspaceId).in('id', creatorIds)
      : Promise.resolve({ data: [] as { id: string; avatar_url: string | null }[] }),
  ])
  const signed = await signStoragePaths(supabase, (subs ?? []).map(s => s.thumbnail_path))
  const out: Record<string, ActivityVisual> = {}
  for (const item of items) {
    if (!item.entity_id) continue
    if (item.entity_type === 'submission') {
      const sub = (subs ?? []).find(s => s.id === item.entity_id)
      if (sub) out[item.id] = { avatarUrl: null, thumbnailUrl: sub.thumbnail_path ? signed.get(sub.thumbnail_path) ?? null : sub.thumbnail_url }
    } else if (item.entity_type === 'creator') {
      const creator = (creators ?? []).find(c => c.id === item.entity_id)
      if (creator) out[item.id] = { avatarUrl: creator.avatar_url, thumbnailUrl: null }
    }
  }
  return out
}

/** Workspace members who can review, for reviewer filters and reassignment. */
export async function workspaceReviewers(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  const { data: members } = await supabase.from('workspace_members').select('user_id, role')
    .eq('workspace_id', workspaceId).in('role', ['owner', 'admin', 'manager'])
  const ids = (members ?? []).map(m => m.user_id as string)
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select(PERSON).in('id', ids).order('full_name')
  return signAvatars((data ?? []) as PersonLite[])
}

export interface RightsTrendPoint extends MetricPoint { created: number; expired: number }

/** Daily created vs expired licences for the "Rights Activity Trend" chart. */
export function rightsTrend(aggregates: RightsAggregates): RightsTrendPoint[] {
  return aggregates.createdSeries.map((created, index) => ({
    date: new Date(Date.now() - (aggregates.createdSeries.length - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    created,
    expired: aggregates.expiredSeries[index] ?? 0,
  }))
}
/** Open brief assignments per creator, for the "Active Briefs" column (one query per page). */
export async function activeBriefCounts(
  supabase: SupabaseClient, workspaceId: string, creatorIds: string[],
): Promise<Record<string, number>> {
  if (creatorIds.length === 0) return {}
  const { data } = await supabase.from('ugc_brief_creators')
    .select('creator_id, status, brief:ugc_briefs!ugc_brief_creators_brief_id_fkey(status, archived_at)')
    .eq('workspace_id', workspaceId).in('creator_id', creatorIds)
    .not('status', 'in', '(declined,cancelled,completed)')
  const counts: Record<string, number> = {}
  type Row = { creator_id: string; brief: { status: string; archived_at: string | null } | null }
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.brief || row.brief.archived_at || !['open', 'in_progress', 'submitted'].includes(row.brief.status)) continue
    counts[row.creator_id] = (counts[row.creator_id] ?? 0) + 1
  }
  return counts
}

/** Creators currently engaged on at least one open brief ("Active Collaborations"). */
export async function activeCollaborations(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ current: number; previous: number }> {
  const { data } = await supabase.from('ugc_brief_creators')
    .select('creator_id, status, invited_at, brief:ugc_briefs!ugc_brief_creators_brief_id_fkey(status, archived_at)')
    .eq('workspace_id', workspaceId)
    .in('status', ['accepted', 'in_production', 'submitted', 'changes_requested', 'approved'])
  type Row = { creator_id: string; invited_at: string; brief: { status: string; archived_at: string | null } | null }
  const rows = ((data ?? []) as unknown as Row[]).filter(r => r.brief && !r.brief.archived_at && ['open', 'in_progress', 'submitted'].includes(r.brief.status))
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  return {
    current: new Set(rows.map(r => r.creator_id)).size,
    previous: new Set(rows.filter(r => Date.parse(r.invited_at) < cutoff).map(r => r.creator_id)).size,
  }
}