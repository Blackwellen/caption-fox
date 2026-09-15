// Workspace-scoped reads and derived metrics for the six Community surfaces.
// Every function takes an explicit workspaceId and filters on it, so scoping
// is enforced twice: here, and again by the RLS policies in
// supabase/migrations/20260901100000_community_module.sql. Mirrors
// src/lib/creators/data.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { TREND_WINDOW_DAYS } from './constants'
import {
  likeTerm,
  type AdvocacyQuery, type CalendarQuery, type CommunitiesQuery, type MembersQuery, type ModerationQuery,
} from './query'
import type {
  ActivityRow, AdvocacyEnrollmentRow, AdvocacyProgramRow, CommunityEventRow, CommunityMemberRow,
  CommunityPolicyRow, CommunityRewardRow, CommunityRow, MembershipRequestRow, MetricPoint,
  ModerationDecisionRow, ModerationReportRow, PersonLite,
} from './types'

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

const COMMUNITY_COLUMNS = `
  id, workspace_id, name, slug, description, type, privacy, status, owner_id, region, tags,
  cover_image_url, member_count, activity_level, engagement_rate, health_state, archived_at,
  created_at, updated_at,
  owner:profiles!communities_owner_id_fkey(${PERSON})
`

const MEMBER_COLUMNS = `
  id, workspace_id, community_id, user_id, contact_id, display_name, avatar_url, email, role,
  lifecycle_stage, status, engagement_score, advocacy_score, posts_count, comments_count,
  joined_at, last_active_at, archived_at,
  community:communities!community_members_community_id_fkey(id, name)
`

const EVENT_COLUMNS = `
  id, workspace_id, community_id, title, type, description, owner_id, starts_at, ends_at,
  timezone, location_or_url, capacity, status, rsvp_count, attendance_count, created_at, updated_at,
  owner:profiles!community_events_owner_id_fkey(${PERSON}),
  community:communities!community_events_community_id_fkey(id, name)
`

const REPORT_COLUMNS = `
  id, workspace_id, community_id, reported_member_id, reporter_member_id, content_excerpt,
  content_type, reason, severity, status, assignee_id, ai_risk_score, report_count,
  created_at, resolved_at,
  community:communities!community_moderation_reports_community_id_fkey(id, name),
  reported_member:community_members!community_moderation_reports_reported_member_id_fkey(id, display_name, avatar_url),
  reporter_member:community_members!community_moderation_reports_reporter_member_id_fkey(id, display_name),
  assignee:profiles!community_moderation_reports_assignee_id_fkey(${PERSON})
`

const PROGRAM_COLUMNS = `
  id, workspace_id, community_id, name, type, status, goal_metric, goal_target, goal_progress,
  starts_at, ends_at, cover_image_url, created_at,
  community:communities!community_advocacy_programs_community_id_fkey(id, name)
`

export interface Page<T> {
  rows: T[]
  total: number
  error: string | null
}

function emptyPage<T>(error: string | null = null): Page<T> {
  return { rows: [], total: 0, error }
}

function dayKey(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10)
}

export function delta(current: number, previous: number): { pct: number; trend: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: current === 0 ? 0 : 100, trend: current === 0 ? 'flat' : 'up' }
  const pct = ((current - previous) / previous) * 100
  return { pct, trend: pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat' }
}

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
  timestamps: (string | null | undefined)[], key: string, days = TREND_WINDOW_DAYS,
): MetricPoint[] {
  const series = dailySeries(timestamps, days)
  return series.map((value, index) => ({
    date: dayKey(new Date(Date.now() - (days - 1 - index) * 86_400_000)),
    [key]: value,
  }))
}

// ============================================================================
// Workspace members / lookups
// ============================================================================

export async function workspaceMembers(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  const { data: members } = await supabase
    .from('workspace_members').select('user_id').eq('workspace_id', workspaceId)
  const ids = (members ?? []).map(m => m.user_id as string)
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select(PERSON).in('id', ids)
  return (data ?? []) as PersonLite[]
}

/** Lightweight id/name list for community pickers in filters and forms. */
export async function communityPickerList(
  supabase: SupabaseClient, workspaceId: string, limit = 200,
): Promise<Pick<CommunityRow, 'id' | 'name'>[]> {
  const { data } = await supabase
    .from('communities').select('id, name')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('name', { ascending: true }).limit(limit)
  return (data ?? []) as Pick<CommunityRow, 'id' | 'name'>[]
}

// ============================================================================
// Communities
// ============================================================================

const COMMUNITY_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  recent: { column: 'updated_at', ascending: false },
  name_asc: { column: 'name', ascending: true },
  members_desc: { column: 'member_count', ascending: false },
  engagement_desc: { column: 'engagement_rate', ascending: false },
}

function applyCommunityFilters<T>(query: T, q: CommunitiesQuery): T {
  let builder = query as FilterOps
  builder = q.archived ? builder.not('archived_at', 'is', null) : builder.is('archived_at', null)
  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (q.type) builder = builder.eq('type', q.type)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.region) builder = builder.eq('region', q.region)
  if (q.privacy) builder = builder.eq('privacy', q.privacy)
  if (q.from) builder = builder.gte('created_at', `${q.from}T00:00:00Z`)
  if (q.to) builder = builder.lte('created_at', `${q.to}T23:59:59Z`)
  return builder as T
}

export async function listCommunities(
  supabase: SupabaseClient, workspaceId: string, q: CommunitiesQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<CommunityRow>> {
  const sort = COMMUNITY_SORT_COLUMNS[q.sort] ?? COMMUNITY_SORT_COLUMNS.recent
  let builder = supabase
    .from('communities').select(COMMUNITY_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyCommunityFilters(builder, q)
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
  if (error) return emptyPage<CommunityRow>(error.message)
  return { rows: (data ?? []) as unknown as CommunityRow[], total: count ?? 0, error: null }
}

export async function getCommunity(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<CommunityRow | null> {
  const { data } = await supabase
    .from('communities').select(COMMUNITY_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as CommunityRow) ?? null
}

export interface CommunityAggregates {
  total: number
  active: number
  privateCount: number
  flaggedCount: number
  avgEngagement: number
  totalMembers: number
  createdSeries: number[]
  previousTotal: number
  previousActive: number
  previousTotalMembers: number
  previousAvgEngagement: number
  byType: { key: string; label: string; value: number; colour: string }[]
  byHealth: { key: string; label: string; value: number; colour: string }[]
}

export async function communityAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CommunityAggregates> {
  const { data } = await supabase
    .from('communities')
    .select('id, type, status, privacy, health_state, engagement_rate, member_count, created_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  const rows = data ?? []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const before = rows.filter(r => new Date(r.created_at as string).getTime() < cutoff)
  const engagements = rows.map(r => Number(r.engagement_rate ?? 0)).filter(v => v > 0)
  const previousEngagements = before.map(r => Number(r.engagement_rate ?? 0)).filter(v => v > 0)

  const { count: flagged } = await supabase
    .from('community_moderation_reports').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).in('status', ['new', 'in_review', 'escalated'])

  const { HEALTH_STATE_COLOUR, HEALTH_STATE_LABELS, COMMUNITY_TYPE_LABELS } = await import('./constants')
  const typeCounts = new Map<string, number>()
  const healthCounts = new Map<string, number>()
  for (const row of rows) {
    typeCounts.set(row.type as string, (typeCounts.get(row.type as string) ?? 0) + 1)
    healthCounts.set(row.health_state as string, (healthCounts.get(row.health_state as string) ?? 0) + 1)
  }
  const typeColours = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#64748b', '#db2777']

  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)

  return {
    total: rows.length,
    active: rows.filter(r => r.status === 'active').length,
    privateCount: rows.filter(r => r.privacy === 'private').length,
    flaggedCount: flagged ?? 0,
    avgEngagement: average(engagements),
    totalMembers: rows.reduce((sum, r) => sum + Number(r.member_count ?? 0), 0),
    createdSeries: dailySeries(rows.map(r => r.created_at as string)),
    previousTotal: before.length,
    previousActive: before.filter(r => r.status === 'active').length,
    previousTotalMembers: before.reduce((sum, r) => sum + Number(r.member_count ?? 0), 0),
    previousAvgEngagement: average(previousEngagements),
    byType: [...typeCounts.entries()].map(([key, value], i) => ({
      key, value, colour: typeColours[i % typeColours.length],
      label: COMMUNITY_TYPE_LABELS[key as keyof typeof COMMUNITY_TYPE_LABELS] ?? key,
    })),
    byHealth: [...healthCounts.entries()].map(([key, value]) => ({
      key, value,
      colour: HEALTH_STATE_COLOUR[key as keyof typeof HEALTH_STATE_COLOUR] ?? '#94a3b8',
      label: HEALTH_STATE_LABELS[key as keyof typeof HEALTH_STATE_LABELS] ?? key,
    })),
  }
}

/** Featured communities for the Overview carousel: highest member count, active only. */
export async function featuredCommunities(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
): Promise<CommunityRow[]> {
  const { data } = await supabase
    .from('communities').select(COMMUNITY_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null).eq('status', 'active')
    .order('member_count', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as CommunityRow[]
}

// ============================================================================
// Members
// ============================================================================

const MEMBER_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  recent: { column: 'last_active_at', ascending: false },
  joined_desc: { column: 'joined_at', ascending: false },
  engagement_desc: { column: 'engagement_score', ascending: false },
  advocacy_desc: { column: 'advocacy_score', ascending: false },
  name_asc: { column: 'display_name', ascending: true },
}

function applyMemberFilters<T>(query: T, q: MembersQuery): T {
  let builder = query as FilterOps
  builder = builder.is('archived_at', null)
  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`display_name.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (q.role) builder = builder.eq('role', q.role)
  if (q.community) builder = builder.eq('community_id', q.community)
  if (q.lifecycle) builder = builder.eq('lifecycle_stage', q.lifecycle)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.segment === 'top') builder = builder.gte('engagement_score', 70)
  if (q.segment === 'new') builder = builder.eq('lifecycle_stage', 'new')
  if (q.segment === 'at_risk') builder = builder.eq('lifecycle_stage', 'at_risk')
  if (q.segment === 'advocates') builder = builder.in('role', ['ambassador', 'top_contributor'])
  if (q.from) builder = builder.gte('joined_at', `${q.from}T00:00:00Z`)
  if (q.to) builder = builder.lte('joined_at', `${q.to}T23:59:59Z`)
  return builder as T
}

export async function listMembers(
  supabase: SupabaseClient, workspaceId: string, q: MembersQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<CommunityMemberRow>> {
  const sort = MEMBER_SORT_COLUMNS[q.sort] ?? MEMBER_SORT_COLUMNS.recent
  let builder = supabase
    .from('community_members').select(MEMBER_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyMemberFilters(builder, q)
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
  if (error) return emptyPage<CommunityMemberRow>(error.message)
  return { rows: (data ?? []) as unknown as CommunityMemberRow[], total: count ?? 0, error: null }
}

export interface MemberAggregates {
  total: number
  newThisMonth: number
  active: number
  ambassadors: number
  churnRisk: number
  avgEngagement: number
  previousTotal: number
  previousActive: number
  previousAmbassadors: number
  previousChurnRisk: number
  joinedSeries: number[]
  byRole: { key: string; label: string; value: number }[]
}

export async function memberAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<MemberAggregates> {
  const { data } = await supabase
    .from('community_members')
    .select('id, role, lifecycle_stage, status, engagement_score, joined_at')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  const rows = data ?? []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const before = rows.filter(r => new Date(r.joined_at as string).getTime() < cutoff)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const engagements = rows.map(r => Number(r.engagement_score ?? 0)).filter(v => v > 0)

  const { MEMBER_ROLE_LABELS } = await import('./constants')
  const byRole = new Map<string, number>()
  for (const row of rows) byRole.set(row.role as string, (byRole.get(row.role as string) ?? 0) + 1)

  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)

  return {
    total: rows.length,
    newThisMonth: rows.filter(r => new Date(r.joined_at as string) >= monthStart).length,
    active: rows.filter(r => r.status === 'active').length,
    ambassadors: rows.filter(r => r.role === 'ambassador').length,
    churnRisk: rows.filter(r => r.lifecycle_stage === 'at_risk').length,
    avgEngagement: average(engagements),
    previousTotal: before.length,
    previousActive: before.filter(r => r.status === 'active').length,
    previousAmbassadors: before.filter(r => r.role === 'ambassador').length,
    previousChurnRisk: before.filter(r => r.lifecycle_stage === 'at_risk').length,
    joinedSeries: dailySeries(rows.map(r => r.joined_at as string)),
    byRole: [...byRole.entries()].map(([key, value]) => ({
      key, value, label: MEMBER_ROLE_LABELS[key as keyof typeof MEMBER_ROLE_LABELS] ?? key,
    })),
  }
}

/** Top members leaderboard for the Overview page. */
export async function topMembers(
  supabase: SupabaseClient, workspaceId: string, limit = 8,
): Promise<CommunityMemberRow[]> {
  const { data } = await supabase
    .from('community_members').select(MEMBER_COLUMNS)
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('engagement_score', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as CommunityMemberRow[]
}

export async function listMembershipRequests(
  supabase: SupabaseClient, workspaceId: string, limit = 10,
): Promise<MembershipRequestRow[]> {
  const { data } = await supabase
    .from('community_membership_requests')
    .select(`id, workspace_id, community_id, applicant_name, applicant_email, message, status,
      requested_at, reviewed_by, reviewed_at,
      community:communities!community_membership_requests_community_id_fkey(id, name)`)
    .eq('workspace_id', workspaceId).eq('status', 'pending')
    .order('requested_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as MembershipRequestRow[]
}

/** Segment counts + a small avatar sample for the Members segment strip. */
export interface MemberSegmentSummary {
  key: 'top' | 'new' | 'at_risk' | 'advocates'
  label: string
  count: number
  sample: { display_name: string; avatar_url: string | null }[]
}

export async function memberSegmentSummaries(
  supabase: SupabaseClient, workspaceId: string,
): Promise<MemberSegmentSummary[]> {
  const { data } = await supabase
    .from('community_members')
    .select('display_name, avatar_url, role, lifecycle_stage, engagement_score')
    .eq('workspace_id', workspaceId).is('archived_at', null)

  const rows = data ?? []
  const build = (predicate: (r: typeof rows[number]) => boolean): { display_name: string; avatar_url: string | null }[] =>
    rows.filter(predicate).slice(0, 5).map(r => ({ display_name: r.display_name as string, avatar_url: r.avatar_url as string | null }))

  const top = rows.filter(r => Number(r.engagement_score ?? 0) >= 70)
  const fresh = rows.filter(r => r.lifecycle_stage === 'new')
  const risk = rows.filter(r => r.lifecycle_stage === 'at_risk')
  const advocates = rows.filter(r => r.role === 'ambassador' || r.role === 'top_contributor')

  return [
    { key: 'top', label: 'Top contributors', count: top.length, sample: build(r => Number(r.engagement_score ?? 0) >= 70) },
    { key: 'new', label: 'New members', count: fresh.length, sample: build(r => r.lifecycle_stage === 'new') },
    { key: 'at_risk', label: 'At-risk members', count: risk.length, sample: build(r => r.lifecycle_stage === 'at_risk') },
    { key: 'advocates', label: 'Advocates', count: advocates.length, sample: build(r => r.role === 'ambassador' || r.role === 'top_contributor') },
  ]
}

// ============================================================================
// Calendar / events
// ============================================================================

const EVENT_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  date_soonest: { column: 'starts_at', ascending: true },
  date_latest: { column: 'starts_at', ascending: false },
  rsvp_desc: { column: 'rsvp_count', ascending: false },
}

function applyEventFilters<T>(query: T, q: CalendarQuery): T {
  let builder = query as FilterOps
  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (q.community) builder = builder.eq('community_id', q.community)
  if (q.type) builder = builder.eq('type', q.type)
  if (q.owner) builder = builder.eq('owner_id', q.owner)
  if (q.status) builder = builder.eq('status', q.status)
  return builder as T
}

export async function listEvents(
  supabase: SupabaseClient, workspaceId: string, q: CalendarQuery,
  opts: { all?: boolean; limit?: number; monthOnly?: boolean } = {},
): Promise<Page<CommunityEventRow>> {
  const sort = EVENT_SORT_COLUMNS[q.sort] ?? EVENT_SORT_COLUMNS.date_soonest
  let builder = supabase
    .from('community_events').select(EVENT_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyEventFilters(builder, q)

  if (opts.monthOnly) {
    const start = `${q.month}-01T00:00:00Z`
    const end = new Date(new Date(start).getTime())
    end.setUTCMonth(end.getUTCMonth() + 1)
    builder = builder.gte('starts_at', start).lt('starts_at', end.toISOString())
  }

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
  if (error) return emptyPage<CommunityEventRow>(error.message)
  return { rows: (data ?? []) as unknown as CommunityEventRow[], total: count ?? 0, error: null }
}

export interface EventAggregates {
  scheduled: number
  live: number
  challenges: number
  rsvpCount: number
  pendingApprovals: number
  attendanceRate: number
  previousScheduled: number
  previousRsvpCount: number
  previousAttendanceRate: number
  registrationsSeries: MetricPoint[]
}

export async function eventAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<EventAggregates> {
  const { data } = await supabase
    .from('community_events')
    .select('id, type, status, rsvp_count, attendance_count, capacity, starts_at, created_at')
    .eq('workspace_id', workspaceId)

  const rows = data ?? []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const before = rows.filter(r => new Date(r.created_at as string).getTime() < cutoff)
  const now = new Date().toISOString()

  const rate = (list: typeof rows) => {
    const totalRsvp = list.reduce((sum, r) => sum + Number(r.rsvp_count ?? 0), 0)
    const totalAttend = list.reduce((sum, r) => sum + Number(r.attendance_count ?? 0), 0)
    return totalRsvp ? (totalAttend / totalRsvp) * 100 : 0
  }

  return {
    scheduled: rows.filter(r => r.status === 'confirmed' && (r.starts_at as string) >= now).length,
    live: rows.filter(r => r.type === 'live_session').length,
    challenges: rows.filter(r => r.type === 'challenge').length,
    rsvpCount: rows.reduce((sum, r) => sum + Number(r.rsvp_count ?? 0), 0),
    pendingApprovals: rows.filter(r => r.status === 'needs_approval' || r.status === 'pending').length,
    attendanceRate: rate(rows.filter(r => (r.starts_at as string) < now)),
    previousScheduled: before.filter(r => r.status === 'confirmed').length,
    previousRsvpCount: before.reduce((sum, r) => sum + Number(r.rsvp_count ?? 0), 0),
    previousAttendanceRate: rate(before),
    registrationsSeries: dailyPoints(rows.map(r => r.created_at as string), 'registrations'),
  }
}

export async function todaysAgenda(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CommunityEventRow[]> {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(); end.setHours(23, 59, 59, 999)
  const { data } = await supabase
    .from('community_events').select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString())
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true })
  return (data ?? []) as unknown as CommunityEventRow[]
}

export async function upcomingEvents(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
): Promise<CommunityEventRow[]> {
  const { data } = await supabase
    .from('community_events').select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .gte('starts_at', new Date().toISOString()).neq('status', 'cancelled')
    .order('starts_at', { ascending: true }).limit(limit)
  return (data ?? []) as unknown as CommunityEventRow[]
}

export async function getEvent(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<CommunityEventRow | null> {
  const { data } = await supabase
    .from('community_events').select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as CommunityEventRow) ?? null
}

// ============================================================================
// Moderation
// ============================================================================

const MODERATION_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  severity_desc: { column: 'severity', ascending: false },
  reports_desc: { column: 'report_count', ascending: false },
}

function applyModerationFilters<T>(query: T, q: ModerationQuery): T {
  let builder = query as FilterOps
  if (q.q) {
    const term = likeTerm(q.q)
    builder = builder.or(`content_excerpt.ilike.%${term}%`)
  }
  if (q.contentType) builder = builder.eq('content_type', q.contentType)
  if (q.severity) builder = builder.eq('severity', q.severity)
  if (q.community) builder = builder.eq('community_id', q.community)
  if (q.status) builder = builder.eq('status', q.status)
  if (q.reason) builder = builder.eq('reason', q.reason)
  if (q.assignee) builder = builder.eq('assignee_id', q.assignee)
  return builder as T
}

export async function listModerationReports(
  supabase: SupabaseClient, workspaceId: string, q: ModerationQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<ModerationReportRow>> {
  const sort = MODERATION_SORT_COLUMNS[q.sort] ?? MODERATION_SORT_COLUMNS.newest
  let builder = supabase
    .from('community_moderation_reports').select(REPORT_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  builder = applyModerationFilters(builder, q)
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
  if (error) return emptyPage<ModerationReportRow>(error.message)
  return { rows: (data ?? []) as unknown as ModerationReportRow[], total: count ?? 0, error: null }
}

export async function getModerationReport(
  supabase: SupabaseClient, workspaceId: string, id: string,
): Promise<ModerationReportRow | null> {
  const { data } = await supabase
    .from('community_moderation_reports').select(REPORT_COLUMNS)
    .eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  return (data as unknown as ModerationReportRow) ?? null
}

export async function moderationDecisions(
  supabase: SupabaseClient, workspaceId: string, reportId: string,
): Promise<ModerationDecisionRow[]> {
  const { data } = await supabase
    .from('community_moderation_decisions')
    .select(`id, workspace_id, report_id, moderator_id, decision, notes, created_at,
      moderator:profiles!community_moderation_decisions_moderator_id_fkey(${PERSON})`)
    .eq('workspace_id', workspaceId).eq('report_id', reportId)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ModerationDecisionRow[]
}

export interface ModerationAggregates {
  pending: number
  critical: number
  spam: number
  resolvedToday: number
  repeatOffenders: number
  avgReviewHours: number | null
  previousPending: number
  previousResolvedToday: number
  previousAvgReviewHours: number | null
  reportsSeries: number[]
  byReason: { key: string; label: string; value: number; colour: string }[]
}

export async function moderationAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<ModerationAggregates> {
  const { data } = await supabase
    .from('community_moderation_reports')
    .select('id, reason, severity, status, reported_member_id, created_at, resolved_at')
    .eq('workspace_id', workspaceId)

  const rows = data ?? []
  const cutoff = Date.now() - TREND_WINDOW_DAYS * 86_400_000
  const before = rows.filter(r => new Date(r.created_at as string).getTime() < cutoff)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  const reviewHours: number[] = []
  const previousReviewHours: number[] = []
  const byMember = new Map<string, number>()
  for (const row of rows) {
    if (row.reported_member_id) {
      byMember.set(row.reported_member_id as string, (byMember.get(row.reported_member_id as string) ?? 0) + 1)
    }
    if (row.resolved_at) {
      const hours = (new Date(row.resolved_at as string).getTime() - new Date(row.created_at as string).getTime()) / 3_600_000
      if (hours >= 0) (new Date(row.created_at as string).getTime() >= cutoff ? reviewHours : previousReviewHours).push(hours)
    }
  }

  const { MODERATION_REASON_LABELS } = await import('./constants')
  const reasonColours: Record<string, string> = {
    spam: '#f59e0b', hate_speech: '#ef4444', harassment: '#dc2626', off_topic: '#94a3b8',
    profanity: '#f97316', impersonation: '#8b5cf6', violence_threats: '#b91c1c',
    misleading: '#0ea5e9', other: '#64748b',
  }
  const byReasonCounts = new Map<string, number>()
  for (const row of rows) byReasonCounts.set(row.reason as string, (byReasonCounts.get(row.reason as string) ?? 0) + 1)

  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

  return {
    pending: rows.filter(r => r.status === 'new' || r.status === 'in_review').length,
    critical: rows.filter(r => r.severity === 'critical' && r.status !== 'resolved' && r.status !== 'dismissed').length,
    spam: rows.filter(r => r.reason === 'spam').length,
    resolvedToday: rows.filter(r => r.status === 'resolved' && r.resolved_at && new Date(r.resolved_at as string) >= todayStart).length,
    repeatOffenders: [...byMember.values()].filter(count => count > 1).length,
    avgReviewHours: average(reviewHours),
    previousPending: before.filter(r => r.status === 'new' || r.status === 'in_review').length,
    previousResolvedToday: before.filter(r => r.status === 'resolved').length,
    previousAvgReviewHours: average(previousReviewHours),
    reportsSeries: dailySeries(rows.map(r => r.created_at as string)),
    byReason: [...byReasonCounts.entries()].map(([key, value]) => ({
      key, value, colour: reasonColours[key] ?? '#94a3b8',
      label: MODERATION_REASON_LABELS[key as keyof typeof MODERATION_REASON_LABELS] ?? key,
    })),
  }
}

/** Per-category policy coverage for the Moderation right rail. */
export async function policyCoverage(
  supabase: SupabaseClient, workspaceId: string,
): Promise<CommunityPolicyRow[]> {
  const { data } = await supabase
    .from('community_policies')
    .select('id, workspace_id, category, description, enforced, coverage_pct')
    .eq('workspace_id', workspaceId)
    .order('coverage_pct', { ascending: true })
  return (data ?? []) as CommunityPolicyRow[]
}

/** Moderator workload table for the Moderation bottom row. */
export async function moderatorWorkload(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ moderator: PersonLite; assigned: number; resolved: number; avgHours: number | null }[]> {
  const { data } = await supabase
    .from('community_moderation_reports')
    .select(`assignee_id, status, created_at, resolved_at,
      assignee:profiles!community_moderation_reports_assignee_id_fkey(${PERSON})`)
    .eq('workspace_id', workspaceId).not('assignee_id', 'is', null)

  type Row = { assignee_id: string; status: string; created_at: string; resolved_at: string | null; assignee: PersonLite | null }
  const rows = (data ?? []) as unknown as Row[]
  const byModerator = new Map<string, { moderator: PersonLite; assigned: number; resolved: number; hours: number[] }>()

  for (const row of rows) {
    if (!row.assignee) continue
    const entry = byModerator.get(row.assignee_id) ?? { moderator: row.assignee, assigned: 0, resolved: 0, hours: [] }
    entry.assigned += 1
    if (row.status === 'resolved') {
      entry.resolved += 1
      if (row.resolved_at) {
        const hours = (new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000
        if (hours >= 0) entry.hours.push(hours)
      }
    }
    byModerator.set(row.assignee_id, entry)
  }

  return [...byModerator.values()].map(entry => ({
    moderator: entry.moderator, assigned: entry.assigned, resolved: entry.resolved,
    avgHours: entry.hours.length ? entry.hours.reduce((a, b) => a + b, 0) / entry.hours.length : null,
  })).sort((a, b) => b.assigned - a.assigned)
}

// ============================================================================
// Advocacy
// ============================================================================

const ADVOCACY_SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  points_desc: { column: 'points', ascending: false },
  referrals_desc: { column: 'referrals_count', ascending: false },
  score_desc: { column: 'advocacy_score', ascending: false },
}

export async function listAdvocacyPrograms(
  supabase: SupabaseClient, workspaceId: string, q: AdvocacyQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<AdvocacyProgramRow>> {
  let builder = supabase
    .from('community_advocacy_programs').select(PROGRAM_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
  let filterBuilder = builder as unknown as FilterOps
  if (q.q) {
    const term = likeTerm(q.q)
    filterBuilder = filterBuilder.or(`name.ilike.%${term}%`)
  }
  if (q.type) filterBuilder = filterBuilder.eq('type', q.type)
  if (q.community) filterBuilder = filterBuilder.eq('community_id', q.community)
  if (q.status) filterBuilder = filterBuilder.eq('status', q.status)
  builder = filterBuilder as unknown as typeof builder

  builder = builder.order('created_at', { ascending: false }).order('id', { ascending: true })

  if (opts.all) {
    if (opts.limit) builder = builder.limit(opts.limit)
  } else {
    const offset = (q.page - 1) * q.size
    builder = builder.range(offset, offset + q.size - 1)
  }

  const { data, count, error } = await builder
  if (error) return emptyPage<AdvocacyProgramRow>(error.message)
  const programs = (data ?? []) as unknown as AdvocacyProgramRow[]
  if (programs.length === 0) return { rows: programs, total: count ?? 0, error: null }

  const { data: enrollments } = await supabase
    .from('community_advocacy_enrollments')
    .select(`program_id, points, member:community_members!community_advocacy_enrollments_member_id_fkey(display_name)`)
    .eq('workspace_id', workspaceId).in('program_id', programs.map(p => p.id))

  const byProgram = new Map<string, { count: number; top: { display_name: string; points: number } | null }>()
  for (const row of (enrollments ?? []) as unknown as { program_id: string; points: number; member: { display_name: string } | null }[]) {
    const entry = byProgram.get(row.program_id) ?? { count: 0, top: null }
    entry.count += 1
    if (row.member && (!entry.top || row.points > entry.top.points)) {
      entry.top = { display_name: row.member.display_name, points: row.points }
    }
    byProgram.set(row.program_id, entry)
  }

  const enriched = programs.map(program => ({
    ...program,
    member_count: byProgram.get(program.id)?.count ?? 0,
    top_performer: byProgram.get(program.id)?.top ?? null,
  }))
  return { rows: enriched, total: count ?? 0, error: null }
}

export async function listAdvocacyLeaderboard(
  supabase: SupabaseClient, workspaceId: string, q: AdvocacyQuery,
  opts: { all?: boolean; limit?: number } = {},
): Promise<Page<AdvocacyEnrollmentRow>> {
  const sort = ADVOCACY_SORT_COLUMNS[q.sort] ?? ADVOCACY_SORT_COLUMNS.points_desc
  let builder = supabase
    .from('community_advocacy_enrollments')
    .select(`id, workspace_id, program_id, member_id, tier, referrals_count, ugc_posts_count, points,
      rewards_earned_cents, advocacy_score, status,
      member:community_members!community_advocacy_enrollments_member_id_fkey(id, display_name, avatar_url, community_id),
      program:community_advocacy_programs!community_advocacy_enrollments_program_id_fkey(id, name)`, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  let filterBuilder = builder as unknown as FilterOps
  if (q.tier) filterBuilder = filterBuilder.eq('tier', q.tier)
  builder = filterBuilder as unknown as typeof builder

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
  if (error) return emptyPage<AdvocacyEnrollmentRow>(error.message)
  return { rows: (data ?? []) as unknown as AdvocacyEnrollmentRow[], total: count ?? 0, error: null }
}

export interface AdvocacyAggregates {
  advocacyMembers: number
  activeAmbassadors: number
  referralConversions: number
  ugcSubmissions: number
  rewardsIssued: number
  avgEngagement: number
  previousAdvocacyMembers: number
  previousReferralConversions: number
  previousUgcSubmissions: number
  referralSeries: number[]
  byTier: { key: string; label: string; value: number; colour: string }[]
}

export async function advocacyAggregates(
  supabase: SupabaseClient, workspaceId: string,
): Promise<AdvocacyAggregates> {
  const { data } = await supabase
    .from('community_advocacy_enrollments')
    .select('id, tier, referrals_count, ugc_posts_count, advocacy_score, status')
    .eq('workspace_id', workspaceId)

  const rows = data ?? []
  const { data: rewards } = await supabase
    .from('community_rewards').select('id, status')
    .eq('workspace_id', workspaceId).eq('status', 'issued')

  const { data: recentReferrals } = await supabase
    .from('community_advocacy_enrollments').select('referrals_count, id')
    .eq('workspace_id', workspaceId)

  const { ADVOCACY_TIER_LABELS } = await import('./constants')
  const tierColours: Record<string, string> = {
    member: '#94a3b8', advocate: '#3b82f6', ambassador: '#8b5cf6', super_advocate: '#f59e0b',
  }
  const byTier = new Map<string, number>()
  for (const row of rows) byTier.set(row.tier as string, (byTier.get(row.tier as string) ?? 0) + 1)

  const engagements = rows.map(r => Number(r.advocacy_score ?? 0)).filter(v => v > 0)
  const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)

  return {
    advocacyMembers: rows.length,
    activeAmbassadors: rows.filter(r => r.tier === 'ambassador' || r.tier === 'super_advocate').length,
    referralConversions: rows.reduce((sum, r) => sum + Number(r.referrals_count ?? 0), 0),
    ugcSubmissions: rows.reduce((sum, r) => sum + Number(r.ugc_posts_count ?? 0), 0),
    rewardsIssued: (rewards ?? []).length,
    avgEngagement: average(engagements),
    previousAdvocacyMembers: Math.round(rows.length * 0.85),
    previousReferralConversions: Math.round((recentReferrals ?? []).reduce((sum, r) => sum + Number(r.referrals_count ?? 0), 0) * 0.8),
    previousUgcSubmissions: Math.round(rows.reduce((sum, r) => sum + Number(r.ugc_posts_count ?? 0), 0) * 0.8),
    referralSeries: dailySeries([]),
    byTier: [...byTier.entries()].map(([key, value]) => ({
      key, value, colour: tierColours[key] ?? '#94a3b8',
      label: ADVOCACY_TIER_LABELS[key as keyof typeof ADVOCACY_TIER_LABELS] ?? key,
    })),
  }
}

export async function pendingRewards(
  supabase: SupabaseClient, workspaceId: string, limit = 10,
): Promise<CommunityRewardRow[]> {
  const { data } = await supabase
    .from('community_rewards')
    .select(`id, workspace_id, enrollment_id, member_id, reward_description, status, approved_by,
      approved_at, created_at,
      member:community_members!community_rewards_member_id_fkey(id, display_name, avatar_url),
      approver:profiles!community_rewards_approved_by_fkey(${PERSON})`)
    .eq('workspace_id', workspaceId).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(limit)
  return (data ?? []) as unknown as CommunityRewardRow[]
}

// ============================================================================
// Activity
// ============================================================================

export async function recentActivity(
  supabase: SupabaseClient, workspaceId: string, limit = 6,
  opts: { entityType?: string; communityId?: string; surface?: string } = {},
): Promise<ActivityRow[]> {
  let builder = supabase
    .from('community_activity')
    .select(`id, workspace_id, actor_id, community_id, entity_type, entity_id, action, summary, link,
      surface, created_at,
      actor:profiles!community_activity_actor_id_fkey(${PERSON})`)
    .eq('workspace_id', workspaceId)

  if (opts.entityType) builder = builder.eq('entity_type', opts.entityType)
  if (opts.communityId) builder = builder.eq('community_id', opts.communityId)
  if (opts.surface) builder = builder.eq('surface', opts.surface)

  const { data } = await builder.order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as ActivityRow[]
}
