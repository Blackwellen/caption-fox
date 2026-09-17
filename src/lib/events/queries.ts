import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanId } from '@/lib/plans'
import type { EventsContext } from './entitlements'
import type {
  EventActivityRecord, EventSessionRecord, EventSpeakerRecord, EventWithStats,
  EventsFilters, EventsSurface, FollowUpSequenceRecord, FollowUpStepRecord,
  FollowUpTaskWithRelations, GalaDockLinkState, GalaDockPlacement, KpiValue,
  PodcastEpisodeWithGuests, PodcastShowRecord, SponsorshipDeliverableRecord,
  SponsorshipWithRelations, TrendPoint, WebinarWithStats,
} from './types'

// Anything in this file runs on the server with the caller's Supabase session,
// so every read is already constrained by RLS. workspace_id is ALSO applied
// explicitly on every query: defence in depth, and it keeps the indexes hot.

/** workspaces.plan uses legacy names; map onto the canonical PlanId ladder. */
const PLAN_MAP: Record<string, PlanId> = {
  starter: 'free',
  free: 'free',
  creator_pro: 'creator_pro',
  team: 'team',
  brand: 'agency',
  agency: 'agency',
  enterprise: 'enterprise',
}

export interface EventsWorkspace {
  id: string
  name: string
  type: string
  plan: PlanId
  planStatus: string
  timezone: string
  currency: string
}

export interface ResolvedEventsContext {
  workspace: EventsWorkspace
  ctx: EventsContext
  userId: string
}

/**
 * Resolves workspace, membership role, per-member permission overrides and
 * feature flags into the single EventsContext every gate reads.
 * Returns null when the user is not a member of the workspace.
 */
export async function resolveEventsContext(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  surface: EventsSurface,
): Promise<ResolvedEventsContext | null> {
  const [{ data: workspace }, { data: membership }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, type, plan, plan_status, settings, owner_id')
      .eq('id', workspaceId)
      .maybeSingle(),
    supabase
      .from('workspace_members')
      .select('role, permissions')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (!workspace) return null

  const isOwner = workspace.owner_id === userId
  if (!membership && !isOwner) return null

  const settings = (workspace.settings ?? {}) as Record<string, unknown>
  const featureFlags = (settings.feature_flags ?? null) as Record<string, boolean> | null
  const overrides = membership?.permissions as Record<string, unknown> | string[] | null | undefined

  return {
    userId,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      plan: PLAN_MAP[workspace.plan] ?? 'free',
      planStatus: workspace.plan_status,
      timezone: (settings.timezone as string) ?? 'Europe/London',
      currency: (settings.currency as string) ?? 'GBP',
    },
    ctx: {
      surface,
      plan: PLAN_MAP[workspace.plan] ?? 'free',
      role: isOwner ? 'owner' : (membership?.role ?? 'viewer'),
      permissions: Array.isArray(overrides) ? (overrides as string[]) : null,
      featureFlags,
      workspaceStatus: workspace.plan_status,
    },
  }
}

// ---------------------------------------------------------------- helpers

function attendanceRate(eligible: number, attended: number): number | null {
  if (!eligible) return null
  return attended / eligible
}

function changePct(current: number, previous: number): number | null {
  if (!previous) return null
  return (current - previous) / previous
}

function windowFrom(days: number): { from: string; to: string; prevFrom: string; prevTo: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const prevTo = new Date(from.getTime())
  const prevFrom = new Date(from.getTime() - days * 86_400_000)
  return {
    from: from.toISOString(), to: to.toISOString(),
    prevFrom: prevFrom.toISOString(), prevTo: prevTo.toISOString(),
  }
}

type StatsRow = {
  event_id: string
  registrations: number
  eligible_registrations: number
  attended: number
  avg_watch_seconds: number | null
  awaiting_follow_up: number
}

async function loadStats(
  supabase: SupabaseClient, workspaceId: string, eventIds: string[],
): Promise<Map<string, StatsRow>> {
  if (eventIds.length === 0) return new Map()
  const { data } = await supabase
    .from('event_registration_stats')
    .select('event_id, registrations, eligible_registrations, attended, avg_watch_seconds, awaiting_follow_up')
    .eq('workspace_id', workspaceId)
    .in('event_id', eventIds)
  return new Map((data ?? []).map(row => [row.event_id as string, row as StatsRow]))
}

async function loadSponsorCounts(
  supabase: SupabaseClient, workspaceId: string, eventIds: string[],
): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map()
  const { data } = await supabase
    .from('event_sponsor_stats')
    .select('event_id, confirmed_sponsors')
    .eq('workspace_id', workspaceId)
    .in('event_id', eventIds)
  return new Map((data ?? []).map(r => [r.event_id as string, (r.confirmed_sponsors as number) ?? 0]))
}

async function loadOwners(
  supabase: SupabaseClient, ownerIds: (string | null)[],
): Promise<Map<string, { name: string | null; avatar: string | null }>> {
  const ids = [...new Set(ownerIds.filter(Boolean))] as string[]
  if (ids.length === 0) return new Map()
  const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
  return new Map((data ?? []).map(p => [p.id as string, { name: p.full_name as string | null, avatar: p.avatar_url as string | null }]))
}

async function loadGalaLinkedEventIds(
  supabase: SupabaseClient, workspaceId: string, eventIds: string[],
): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set()
  const { data } = await supabase
    .from('gala_dock_event_links')
    .select('event_id, connection_status')
    .eq('workspace_id', workspaceId)
    .eq('connection_status', 'connected')
    .in('event_id', eventIds)
  return new Set((data ?? []).map(r => r.event_id as string))
}

const EVENT_COLUMNS =
  'id, workspace_id, name, slug, summary, event_type, format, status, start_at, end_at, timezone, ' +
  'location_name, location_city, location_country, online_platform, online_url, cover_image_url, ' +
  'capacity, campaign_id, owner_id, tags, is_demo, created_at, updated_at'

/**
 * supabase-js cannot infer a select list built at runtime, so reads that use
 * EVENT_COLUMNS come back loosely typed. `rowsOf` is the single place that
 * normalisation happens — never scattered `as any` at call sites.
 */
function rowsOf(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : []
}

/** An empty result shaped like a Supabase response, for skipped lookups. */
function emptyResult(): Promise<{ data: Record<string, unknown>[] }> {
  return Promise.resolve({ data: [] })
}

/** Decorates raw event rows with the aggregates every list surface needs. */
async function decorateEvents(
  supabase: SupabaseClient, workspaceId: string, rows: Record<string, unknown>[],
): Promise<EventWithStats[]> {
  const ids = rows.map(r => r.id as string)
  const [stats, sponsors, owners, galaLinked] = await Promise.all([
    loadStats(supabase, workspaceId, ids),
    loadSponsorCounts(supabase, workspaceId, ids),
    loadOwners(supabase, rows.map(r => (r.owner_id as string | null) ?? null)),
    loadGalaLinkedEventIds(supabase, workspaceId, ids),
  ])

  return rows.map(row => {
    const stat = stats.get(row.id as string)
    const owner = row.owner_id ? owners.get(row.owner_id as string) : undefined
    return {
      ...(row as unknown as EventWithStats),
      registrations: stat?.registrations ?? 0,
      attended: stat?.attended ?? 0,
      attendanceRate: attendanceRate(stat?.eligible_registrations ?? 0, stat?.attended ?? 0),
      sponsorCount: sponsors.get(row.id as string) ?? 0,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: owner?.avatar ?? null,
      galaDockLinked: galaLinked.has(row.id as string),
    }
  })
}

// ---------------------------------------------------------------- directory

const SORTABLE: Record<string, { column: string; ascending: boolean }> = {
  'date-desc': { column: 'start_at', ascending: false },
  'date-asc': { column: 'start_at', ascending: true },
  'name-asc': { column: 'name', ascending: true },
  'name-desc': { column: 'name', ascending: false },
  'created-desc': { column: 'created_at', ascending: false },
}

export interface EventListResult {
  events: EventWithStats[]
  total: number
  page: number
  pageSize: number
}

export async function listEvents(
  supabase: SupabaseClient,
  workspaceId: string,
  filters: EventsFilters = {},
  options: { types?: string[]; excludeTypes?: string[] } = {},
): Promise<EventListResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 10))
  const sort = SORTABLE[filters.sort ?? 'date-desc'] ?? SORTABLE['date-desc']

  let query = supabase
    .from('events')
    .select(EVENT_COLUMNS, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  if (options.types?.length) query = query.in('event_type', options.types)
  if (options.excludeTypes?.length) {
    query = query.not('event_type', 'in', `(${options.excludeTypes.join(',')})`)
  }
  if (filters.q) {
    const term = filters.q.replaceAll(',', ' ').replaceAll('%', '')
    query = query.or(
      `name.ilike.%${term}%,location_city.ilike.%${term}%,location_name.ilike.%${term}%,summary.ilike.%${term}%`,
    )
  }
  // A caller-supplied selection narrows the workspace-scoped query; it can
  // never widen it, so a crafted id list cannot reach another workspace.
  if (filters.ids?.length) query = query.in('id', filters.ids)
  if (filters.type && filters.type !== 'all') query = query.eq('event_type', filters.type)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.owner && filters.owner !== 'all') query = query.eq('owner_id', filters.owner)
  if (filters.platform && filters.platform !== 'all') query = query.eq('online_platform', filters.platform)
  if (filters.dateFrom) query = query.gte('start_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('start_at', filters.dateTo)

  const { data, count } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  return {
    events: await decorateEvents(supabase, workspaceId, rowsOf(data)),
    total: count ?? 0,
    page,
    pageSize,
  }
}

/** Distinct owners with events, for the Owner filter. */
export async function listEventOwners(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from('events')
    .select('owner_id')
    .eq('workspace_id', workspaceId)
    .not('owner_id', 'is', null)
  const owners = await loadOwners(supabase, (data ?? []).map(r => r.owner_id as string))
  return [...owners.entries()].map(([id, o]) => ({ id, name: o.name ?? 'Unnamed' }))
}

// ---------------------------------------------------------------- KPIs

export interface OverviewKpis {
  totalEvents: KpiValue
  /** Attended registrations in the window (the design's Registration Performance strip). */
  attended: KpiValue
  registrations: KpiValue
  attendanceRate: KpiValue
  sponsorshipRevenue: KpiValue
  followUpTasks: KpiValue
  upcomingSessions: KpiValue
}

export async function getOverviewKpis(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<OverviewKpis> {
  const w = windowFrom(days)
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString()

  const [
    totalNow, totalPrev,
    regsNow, regsPrev,
    attendedNow, eligibleNow, attendedPrev, eligiblePrev,
    revenueNow, revenuePrev,
    tasksNow, tasksPrev,
    sessionsNext,
  ] = await Promise.all([
    countRows(supabase, 'events', workspaceId, q => q.is('archived_at', null)),
    countRows(supabase, 'events', workspaceId, q => q.is('archived_at', null).lt('created_at', w.from)),
    countRows(supabase, 'event_registrations', workspaceId, q => q.gte('registered_at', w.from)),
    countRows(supabase, 'event_registrations', workspaceId, q => q.gte('registered_at', w.prevFrom).lt('registered_at', w.prevTo)),
    countRows(supabase, 'event_registrations', workspaceId, q => q.eq('attended', true).gte('registered_at', w.from)),
    countRows(supabase, 'event_registrations', workspaceId, q => q.in('status', ['confirmed', 'registered', 'attended', 'checked_in', 'no_show']).gte('registered_at', w.from)),
    countRows(supabase, 'event_registrations', workspaceId, q => q.eq('attended', true).gte('registered_at', w.prevFrom).lt('registered_at', w.prevTo)),
    countRows(supabase, 'event_registrations', workspaceId, q => q.in('status', ['confirmed', 'registered', 'attended', 'checked_in', 'no_show']).gte('registered_at', w.prevFrom).lt('registered_at', w.prevTo)),
    sumSponsorshipValue(supabase, workspaceId, w.from, w.to),
    sumSponsorshipValue(supabase, workspaceId, w.prevFrom, w.prevTo),
    countRows(supabase, 'event_followup_tasks', workspaceId, q => q.not('status', 'in', '(completed,cancelled)')),
    countRows(supabase, 'event_followup_tasks', workspaceId, q => q.not('status', 'in', '(completed,cancelled)').lt('created_at', w.from)),
    countRows(supabase, 'event_sessions', workspaceId, q => q.gte('start_at', new Date().toISOString()).lte('start_at', in30)),
  ])

  const rateNow = attendanceRate(eligibleNow, attendedNow)
  const ratePrev = attendanceRate(eligiblePrev, attendedPrev)

  return {
    totalEvents: { value: totalNow, changePct: changePct(totalNow, totalPrev) },
    registrations: { value: regsNow, changePct: changePct(regsNow, regsPrev) },
    attended: { value: attendedNow, changePct: changePct(attendedNow, attendedPrev) },
    attendanceRate: {
      value: rateNow,
      changePct: rateNow !== null && ratePrev !== null ? rateNow - ratePrev : null,
    },
    sponsorshipRevenue: { value: revenueNow, changePct: changePct(revenueNow, revenuePrev) },
    followUpTasks: {
      value: tasksNow,
      changePct: null,
      // With no prior baseline the "change" would just restate the value
      // ("86" against "86"), which reads as a delta it is not.
      changeAbs: tasksPrev > 0 ? tasksNow - tasksPrev : null,
    },
    upcomingSessions: { value: sessionsNext, changePct: null },
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type QueryTweak = (q: any) => any

async function countRows(
  supabase: SupabaseClient, table: string, workspaceId: string, tweak?: QueryTweak,
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
  if (tweak) q = tweak(q)
  const { count } = await q
  return count ?? 0
}

async function sumSponsorshipValue(
  supabase: SupabaseClient, workspaceId: string, from: string, to: string,
): Promise<number> {
  const { data } = await supabase
    .from('sponsorships')
    .select('value, contract_signed_at, created_at')
    .eq('workspace_id', workspaceId)
    .in('stage', ['contracted', 'active', 'completed'])
  return (data ?? []).reduce((sum, row) => {
    const at = (row.contract_signed_at as string | null) ?? (row.created_at as string)
    return at >= from && at <= to ? sum + Number(row.value ?? 0) : sum
  }, 0)
}

// ---------------------------------------------------------------- trends

export async function getRegistrationTrend(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<TrendPoint[]> {
  const w = windowFrom(days)
  const { data } = await supabase.rpc('events_registration_trend', {
    p_workspace: workspaceId, p_from: w.from, p_to: w.to, p_event: null,
  })
  return (data ?? []).map((row: { day: string; registrations: number; attendees: number }) => ({
    day: row.day, registrations: row.registrations, attendees: row.attendees,
  }))
}

export async function getWebinarAttendanceTrend(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<TrendPoint[]> {
  const w = windowFrom(days)
  const { data } = await supabase.rpc('webinar_attendance_trend', {
    p_workspace: workspaceId, p_from: w.from, p_to: w.to,
  })
  return (data ?? []).map((row: { day: string; attendance_rate: number | null }) => ({
    day: row.day, rate: row.attendance_rate === null ? null : Number(row.attendance_rate) * 100,
  }))
}

export async function getOutreachTrend(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<TrendPoint[]> {
  const w = windowFrom(days)
  const { data } = await supabase.rpc('events_outreach_trend', {
    p_workspace: workspaceId, p_from: w.from, p_to: w.to,
  })
  return (data ?? []).map((row: { day: string; sent: number; opened: number; replied: number; meetings: number }) => ({
    day: row.day, sent: row.sent, opened: row.opened, replied: row.replied, meetings: row.meetings,
  }))
}

export async function getListenerTrend(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<TrendPoint[]> {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const { data } = await supabase.rpc('podcast_listener_trend', {
    p_workspace: workspaceId,
    p_from: from.toISOString().slice(0, 10),
    p_to: to.toISOString().slice(0, 10),
    p_show: null,
  })
  return (data ?? []).map((row: { day: string; listens: number; unique_listeners: number }) => ({
    day: row.day, listens: row.listens, unique: row.unique_listeners,
  }))
}

export async function getSponsorshipRevenueTrend(
  supabase: SupabaseClient, workspaceId: string, year = new Date().getFullYear(),
): Promise<TrendPoint[]> {
  const { data } = await supabase.rpc('sponsorship_revenue_trend', {
    p_workspace: workspaceId, p_year: year,
  })
  // For the current year, stop at this month: later months have not happened,
  // and plotting them as £0 draws a false collapse at the end of the line.
  const currentMonth = new Date().toISOString().slice(0, 7)
  return (data ?? [])
    .filter((row: { month: string }) => year !== new Date().getFullYear() || String(row.month).slice(0, 7) <= currentMonth)
    .map((row: { month: string; this_year: string; last_year: string }) => ({
      day: row.month, thisYear: Number(row.this_year), lastYear: Number(row.last_year),
    }))
}

// ---------------------------------------------------------------- run of show

export async function getRunOfShow(
  supabase: SupabaseClient, workspaceId: string, eventId?: string, limit = 6,
  /** Restricts auto-selection (live-then-next) to these event_type values — e.g. ['webinar'] on the
   *  Webinars page — so "Run of Show" never surfaces an unrelated live event from elsewhere in the workspace. */
  eventTypes?: string[],
): Promise<{ sessions: EventSessionRecord[]; event: { id: string; name: string; start_at: string | null } | null }> {
  let targetEventId = eventId ?? null

  if (!targetEventId) {
    // "Today" in the design = the live event, else the next upcoming one.
    let liveQuery = supabase
      .from('events').select('id, name')
      .eq('workspace_id', workspaceId).eq('status', 'live')
    if (eventTypes?.length) liveQuery = liveQuery.in('event_type', eventTypes)
    const { data: live } = await liveQuery.limit(1).maybeSingle()
    if (live) targetEventId = live.id as string
    else {
      let nextQuery = supabase
        .from('events').select('id, name')
        .eq('workspace_id', workspaceId)
        .gte('start_at', new Date(Date.now() - 86_400_000).toISOString())
        .not('status', 'in', '(cancelled,archived)')
      if (eventTypes?.length) nextQuery = nextQuery.in('event_type', eventTypes)
      const { data: next } = await nextQuery.order('start_at', { ascending: true }).limit(1).maybeSingle()
      targetEventId = (next?.id as string) ?? null

      // Nothing live and nothing ahead: fall back to the most recent event of
      // this type so the panel shows the last run sheet instead of an empty
      // state the moment an event finishes.
      if (!targetEventId) {
        let lastQuery = supabase
          .from('events').select('id, name')
          .eq('workspace_id', workspaceId)
          .not('status', 'in', '(cancelled,archived)')
          .not('start_at', 'is', null)
        if (eventTypes?.length) lastQuery = lastQuery.in('event_type', eventTypes)
        const { data: last } = await lastQuery.order('start_at', { ascending: false }).limit(1).maybeSingle()
        targetEventId = (last?.id as string) ?? null
      }
    }
  }
  if (!targetEventId) return { sessions: [], event: null }

  const [{ data: sessions }, { data: event }] = await Promise.all([
    supabase
      .from('event_sessions')
      .select('id, event_id, title, description, session_type, start_at, end_at, offset_seconds, position, room, status')
      .eq('workspace_id', workspaceId).eq('event_id', targetEventId)
      .order('position', { ascending: true }).order('start_at', { ascending: true })
      .limit(limit),
    supabase.from('events').select('id, name, start_at').eq('id', targetEventId).maybeSingle(),
  ])

  return {
    sessions: (sessions ?? []) as unknown as EventSessionRecord[],
    event: event ? { id: event.id as string, name: event.name as string, start_at: (event.start_at as string | null) ?? null } : null,
  }
}

export async function getSpeakers(
  supabase: SupabaseClient, workspaceId: string, eventId?: string, limit = 6,
): Promise<EventSpeakerRecord[]> {
  let q = supabase
    .from('event_speakers')
    .select('id, event_id, full_name, job_title, company, avatar_url, speaker_role, confirmation_status, position')
    .eq('workspace_id', workspaceId)
  if (eventId) q = q.eq('event_id', eventId)
  const { data } = await q.order('position', { ascending: true }).limit(limit)
  return (data ?? []) as unknown as EventSpeakerRecord[]
}

// ---------------------------------------------------------------- activity

export async function getEventActivity(
  supabase: SupabaseClient, workspaceId: string, limit = 6, entityTypes?: string[],
): Promise<EventActivityRecord[]> {
  let q = supabase
    .from('event_activity')
    .select('id, event_id, entity_type, entity_id, action, summary, href, actor_name, actor_avatar_url, created_at')
    .eq('workspace_id', workspaceId)
  if (entityTypes?.length) q = q.in('entity_type', entityTypes)
  const { data } = await q.order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as unknown as EventActivityRecord[]
}

// ---------------------------------------------------------------- webinars

export interface WebinarKpis {
  upcoming: KpiValue
  registrations: KpiValue
  attendanceRate: KpiValue
  avgWatchSeconds: KpiValue
  questions: KpiValue
  followUpLeads: KpiValue
}

export async function listWebinars(
  supabase: SupabaseClient, workspaceId: string, filters: EventsFilters = {},
): Promise<{ webinars: WebinarWithStats[]; total: number; page: number; pageSize: number }> {
  const base = await listEvents(supabase, workspaceId, filters, { types: ['webinar'] })
  const ids = base.events.map(e => e.id)

  const [{ data: details }, hosts] = await Promise.all([
    ids.length
      ? supabase.from('webinar_details')
          .select('event_id, provider, provider_status, topic, join_url, will_record, recording_state, avg_watch_seconds, questions_count, polls_count, last_synced_at')
          .eq('workspace_id', workspaceId).in('event_id', ids)
      : emptyResult(),
    ids.length
      ? supabase.from('event_speakers')
          .select('event_id, full_name, job_title, avatar_url, speaker_role')
          .eq('workspace_id', workspaceId).in('event_id', ids).eq('speaker_role', 'host')
      : emptyResult(),
  ])

  const detailMap = new Map((details ?? []).map(d => [d.event_id as string, d]))
  const hostMap = new Map((hosts.data ?? []).map(h => [h.event_id as string, h]))

  return {
    ...base,
    webinars: base.events.map(event => {
      const host = hostMap.get(event.id)
      return {
        ...event,
        webinar: (detailMap.get(event.id) ?? null) as WebinarWithStats['webinar'],
        hostName: (host?.full_name as string) ?? null,
        hostRole: (host?.job_title as string) ?? null,
        hostAvatarUrl: (host?.avatar_url as string) ?? null,
      }
    }),
  }
}

export async function getWebinarKpis(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<WebinarKpis> {
  const w = windowFrom(days)
  const { data: webinarEvents } = await supabase
    .from('events').select('id, start_at, status')
    .eq('workspace_id', workspaceId).eq('event_type', 'webinar').is('archived_at', null)

  const ids = (webinarEvents ?? []).map(e => e.id as string)
  const nowIso = new Date().toISOString()
  const pastIds = (webinarEvents ?? [])
    .filter(e => e.start_at && (e.start_at as string) <= nowIso)
    .map(e => e.id as string)
  const upcoming = (webinarEvents ?? []).filter(
    e => e.start_at && (e.start_at as string) > new Date().toISOString() && e.status !== 'cancelled',
  ).length

  if (ids.length === 0) {
    const empty: KpiValue = { value: 0, changePct: null }
    return {
      upcoming: { value: upcoming, changePct: null },
      registrations: empty, attendanceRate: { value: null, changePct: null },
      avgWatchSeconds: { value: null, changePct: null }, questions: empty, followUpLeads: empty,
    }
  }

  // Counted with `head: true` so PostgREST returns the true count. Reading
  // `data.length` silently caps at the 1,000-row response limit, which made
  // every large workspace report exactly 1,000 registrations.
  const [{ count: regs }, { count: prevRegs }, { data: stats }, { count: questionCount }, { count: leads }] = await Promise.all([
    supabase.from('event_registrations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('event_id', ids).gte('registered_at', w.from),
    supabase.from('event_registrations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('event_id', ids)
      .gte('registered_at', w.prevFrom).lt('registered_at', w.prevTo),
    supabase.from('event_registration_stats')
      .select('eligible_registrations, attended, avg_watch_seconds')
      .eq('workspace_id', workspaceId).in('event_id', pastIds.length ? pastIds : ids),
    supabase.from('webinar_questions').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('event_id', ids),
    supabase.from('event_registrations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('event_id', ids)
      .in('follow_up_status', ['not_contacted', 'in_progress', 'waiting']),
  ])

  const eligible = (stats ?? []).reduce((s, r) => s + Number(r.eligible_registrations ?? 0), 0)
  const attended = (stats ?? []).reduce((s, r) => s + Number(r.attended ?? 0), 0)
  const watchValues = (stats ?? []).map(r => Number(r.avg_watch_seconds ?? 0)).filter(v => v > 0)

  return {
    upcoming: { value: upcoming, changePct: null },
    registrations: {
      value: regs ?? 0,
      changePct: changePct(regs ?? 0, prevRegs ?? 0),
    },
    attendanceRate: { value: attendanceRate(eligible, attended), changePct: null },
    avgWatchSeconds: {
      value: watchValues.length ? Math.round(watchValues.reduce((a, b) => a + b, 0) / watchValues.length) : null,
      changePct: null,
    },
    questions: { value: questionCount ?? 0, changePct: null },
    followUpLeads: { value: leads ?? 0, changePct: null },
  }
}

export async function getWebinarQuestions(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
) {
  const { data } = await supabase
    .from('webinar_questions')
    .select('id, event_id, asked_by_name, question, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

// ---------------------------------------------------------------- podcasts

export interface PodcastKpis {
  plannedEpisodes: KpiValue
  liveRecordings: KpiValue
  listeners: KpiValue
  completionRate: KpiValue
  sponsorSlots: KpiValue
  followUpItems: KpiValue
}

export async function listPodcastEpisodes(
  supabase: SupabaseClient, workspaceId: string, filters: EventsFilters = {},
): Promise<{ episodes: PodcastEpisodeWithGuests[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(4, filters.pageSize ?? 12))

  let query = supabase
    .from('podcast_episodes')
    .select(
      'id, show_id, event_id, episode_number, title, summary, cover_image_url, status, recording_type, ' +
      'studio_location, scheduled_at, recorded_at, published_at, distribution_state, listens, ' +
      'unique_listeners, completion_rate',
      { count: 'exact' },
    )
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  if (filters.q) {
    const term = filters.q.replaceAll(',', ' ').replaceAll('%', '')
    query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%`)
  }
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.type && filters.type !== 'all') query = query.eq('recording_type', filters.type)
  if (filters.distribution && filters.distribution !== 'all') query = query.eq('distribution_state', filters.distribution)
  if (filters.dateFrom) query = query.gte('scheduled_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('scheduled_at', filters.dateTo)

  const { data, count } = await query
    .order('episode_number', { ascending: false, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const rows = rowsOf(data)
  const ids = rows.map(r => r.id as string)
  const showIds = [...new Set(rows.map(r => r.show_id as string | null).filter(Boolean))] as string[]

  const [{ data: guests }, { data: shows }] = await Promise.all([
    ids.length
      ? supabase.from('podcast_episode_guests')
          .select('id, episode_id, full_name, job_title, company, avatar_url')
          .eq('workspace_id', workspaceId).in('episode_id', ids)
      : emptyResult(),
    showIds.length
      ? supabase.from('podcast_shows').select('id, name').eq('workspace_id', workspaceId).in('id', showIds)
      : emptyResult(),
  ])

  const showMap = new Map((shows ?? []).map(s => [s.id as string, s.name as string]))

  return {
    total: count ?? 0, page, pageSize,
    episodes: rows.map(row => ({
      ...(row as unknown as PodcastEpisodeWithGuests),
      guests: (guests ?? [])
        .filter(g => g.episode_id === row.id)
        .map(g => ({
          id: g.id as string, full_name: g.full_name as string,
          job_title: g.job_title as string | null, company: g.company as string | null,
          avatar_url: g.avatar_url as string | null,
        })),
      showName: row.show_id ? (showMap.get(row.show_id as string) ?? null) : null,
    })),
  }
}

export async function getPodcastKpis(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<PodcastKpis> {
  const w = windowFrom(days)
  const [planned, recording, followUp, sponsorSlots] = await Promise.all([
    countRows(supabase, 'podcast_episodes', workspaceId, q => q.in('status', ['planned', 'scheduled', 'draft']).is('archived_at', null)),
    countRows(supabase, 'podcast_episodes', workspaceId, q => q.eq('status', 'recording').is('archived_at', null)),
    countRows(supabase, 'event_followup_tasks', workspaceId, q => q.not('status', 'in', '(completed,cancelled)')),
    countRows(supabase, 'sponsorship_deliverables', workspaceId, q => q.eq('deliverable_type', 'podcast_read')),
  ])

  const [{ data: nowRows }, { data: prevRows }, { data: completion }] = await Promise.all([
    supabase.from('podcast_listener_daily').select('listens')
      .eq('workspace_id', workspaceId).gte('day', w.from.slice(0, 10)),
    supabase.from('podcast_listener_daily').select('listens')
      .eq('workspace_id', workspaceId).gte('day', w.prevFrom.slice(0, 10)).lt('day', w.prevTo.slice(0, 10)),
    supabase.from('podcast_episodes').select('completion_rate')
      .eq('workspace_id', workspaceId).not('completion_rate', 'is', null),
  ])

  const listens = (nowRows ?? []).reduce((s, r) => s + Number(r.listens ?? 0), 0)
  const prevListens = (prevRows ?? []).reduce((s, r) => s + Number(r.listens ?? 0), 0)
  const rates = (completion ?? []).map(r => Number(r.completion_rate))

  return {
    plannedEpisodes: { value: planned, changePct: null },
    liveRecordings: { value: recording, changePct: null },
    listeners: { value: listens, changePct: changePct(listens, prevListens) },
    completionRate: {
      value: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      changePct: null,
    },
    sponsorSlots: { value: sponsorSlots, changePct: null },
    followUpItems: { value: followUp, changePct: null },
  }
}

export async function getTopEpisodes(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<PodcastEpisodeWithGuests[]> {
  const { data } = await supabase
    .from('podcast_episodes')
    .select('id, show_id, event_id, episode_number, title, summary, cover_image_url, status, recording_type, studio_location, scheduled_at, recorded_at, published_at, distribution_state, listens, unique_listeners, completion_rate')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .order('listens', { ascending: false })
    .limit(limit)
  return (data ?? []).map(row => ({ ...(row as unknown as PodcastEpisodeWithGuests), guests: [], showName: null }))
}

export async function listPodcastShows(
  supabase: SupabaseClient, workspaceId: string,
): Promise<PodcastShowRecord[]> {
  const { data } = await supabase
    .from('podcast_shows')
    .select('id, name, cover_image_url, distribution_provider, provider_status')
    .eq('workspace_id', workspaceId).is('archived_at', null).order('name')
  return (data ?? []) as unknown as PodcastShowRecord[]
}

// ---------------------------------------------------------------- sponsorships

export interface SponsorshipKpis {
  activeSponsors: KpiValue
  pipelineValue: KpiValue
  revenue: KpiValue
  deliverablesDue: KpiValue
  renewalOpportunities: KpiValue
  followUpTasks: KpiValue
}

export async function listSponsorships(
  supabase: SupabaseClient, workspaceId: string, filters: EventsFilters = {},
): Promise<{ sponsorships: SponsorshipWithRelations[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(4, filters.pageSize ?? 12))

  let query = supabase
    .from('sponsorships')
    .select(
      'id, sponsor_id, event_id, package_id, tier, value, currency, stage, status, proposal_sent_at, ' +
      'contract_signed_at, activation_start_at, renewal_due_at, payment_status, owner_id',
      { count: 'exact' },
    )
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)

  if (filters.status && filters.status !== 'all') query = query.eq('stage', filters.status)
  if (filters.tier && filters.tier !== 'all') query = query.eq('tier', filters.tier)
  if (filters.event && filters.event !== 'all') query = query.eq('event_id', filters.event)
  if (filters.owner && filters.owner !== 'all') query = query.eq('owner_id', filters.owner)
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

  // Most recently worked relationships first, so a long book of completed
  // contracts never pushes live sponsorships off the portfolio.
  const { data, count } = await query
    .order('updated_at', { ascending: false })
    .order('value', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  let rows = rowsOf(data)
  const sponsorIds = [...new Set(rows.map(r => r.sponsor_id as string))]
  const eventIds = [...new Set(rows.map(r => r.event_id as string | null).filter(Boolean))] as string[]

  const [{ data: sponsors }, { data: events }, { data: deliverables }, owners, { data: packages }] = await Promise.all([
    sponsorIds.length
      ? supabase.from('sponsors').select('id, name, company_name, logo_url, industry')
          .eq('workspace_id', workspaceId).in('id', sponsorIds)
      : emptyResult(),
    eventIds.length
      ? supabase.from('events').select('id, name').eq('workspace_id', workspaceId).in('id', eventIds)
      : emptyResult(),
    rows.length
      ? supabase.from('sponsorship_deliverable_stats').select('sponsorship_id, total, completed')
          .eq('workspace_id', workspaceId).in('sponsorship_id', rows.map(r => r.id as string))
      : emptyResult(),
    loadOwners(supabase, rows.map(r => r.owner_id as string | null)),
    rows.some(r => r.package_id)
      ? supabase.from('sponsorship_packages').select('id, name').eq('workspace_id', workspaceId)
      : emptyResult(),
  ])

  const sponsorMap = new Map((sponsors ?? []).map(s => [s.id as string, s]))
  const eventMap = new Map((events ?? []).map(e => [e.id as string, e.name as string]))
  const packageMap = new Map((packages ?? []).map(p => [p.id as string, p.name as string]))
  const deliverableMap = new Map((deliverables ?? []).map(d => [d.sponsorship_id as string, d]))

  // Free-text search runs after the join because it spans sponsor + event names.
  if (filters.q) {
    const term = filters.q.toLowerCase()
    rows = rows.filter(r => {
      const sponsor = sponsorMap.get(r.sponsor_id as string)
      const eventName = r.event_id ? eventMap.get(r.event_id as string) : null
      return [sponsor?.name, sponsor?.company_name, eventName]
        .filter(Boolean).some(v => (v as string).toLowerCase().includes(term))
    })
  }

  return {
    total: filters.q ? rows.length : (count ?? 0), page, pageSize,
    sponsorships: rows.map(row => {
      const owner = row.owner_id ? owners.get(row.owner_id as string) : undefined
      const deliverable = deliverableMap.get(row.id as string)
      return {
        ...(row as unknown as SponsorshipWithRelations),
        value: Number(row.value ?? 0),
        sponsor: (sponsorMap.get(row.sponsor_id as string) ?? null) as SponsorshipWithRelations['sponsor'],
        eventName: row.event_id ? (eventMap.get(row.event_id as string) ?? null) : null,
        packageName: row.package_id ? (packageMap.get(row.package_id as string) ?? null) : null,
        deliverablesTotal: Number(deliverable?.total ?? 0),
        deliverablesCompleted: Number(deliverable?.completed ?? 0),
        ownerName: owner?.name ?? null,
        ownerAvatarUrl: owner?.avatar ?? null,
      }
    }),
  }
}

export async function getSponsorshipKpis(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<SponsorshipKpis> {
  const w = windowFrom(days)
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString()

  const [{ data: all }, deliverablesDue, followUp] = await Promise.all([
    supabase.from('sponsorships')
      .select('id, sponsor_id, value, stage, renewal_due_at, contract_signed_at, created_at')
      .eq('workspace_id', workspaceId).is('archived_at', null),
    countRows(supabase, 'sponsorship_deliverables', workspaceId,
      q => q.not('status', 'in', '(completed,approved,cancelled)').not('due_at', 'is', null).lte('due_at', soon)),
    countRows(supabase, 'event_followup_tasks', workspaceId, q => q.not('status', 'in', '(completed,cancelled)')),
  ])

  const rows = all ?? []
  const activeSponsors = new Set(
    rows.filter(r => ['contracted', 'active'].includes(r.stage as string)).map(r => r.sponsor_id as string),
  ).size
  const pipeline = rows
    .filter(r => ['prospect', 'contacted', 'proposal', 'negotiation', 'verbal'].includes(r.stage as string))
    .reduce((s, r) => s + Number(r.value ?? 0), 0)
  // Revenue is the value CONTRACTED IN THE SELECTED WINDOW. Summing the whole
  // book here while comparing against a single previous month produced a
  // meaningless delta (a lifetime total vs one month, e.g. "+109.3%").
  const signedAt = (r: { contract_signed_at?: unknown; created_at?: unknown }) =>
    (r.contract_signed_at as string | null) ?? (r.created_at as string)
  const revenue = rows.filter(r => {
    if (!['contracted', 'active', 'completed'].includes(r.stage as string)) return false
    const at = signedAt(r)
    return at >= w.from && at <= w.to
  }).reduce((s, r) => s + Number(r.value ?? 0), 0)
  const revenuePrev = rows.filter(r => {
    if (!['contracted', 'active', 'completed'].includes(r.stage as string)) return false
    const at = signedAt(r)
    return at >= w.prevFrom && at < w.prevTo
  }).reduce((s, r) => s + Number(r.value ?? 0), 0)
  const renewals = rows.filter(
    r => r.renewal_due_at && (r.renewal_due_at as string) <= soon,
  ).length

  return {
    activeSponsors: { value: activeSponsors, changePct: null },
    pipelineValue: { value: pipeline, changePct: null },
    revenue: { value: revenue, changePct: changePct(revenue, revenuePrev) },
    deliverablesDue: { value: deliverablesDue, changePct: null },
    renewalOpportunities: { value: renewals, changePct: null },
    followUpTasks: { value: followUp, changePct: null },
  }
}

export async function getDeliverableSummary(
  supabase: SupabaseClient, workspaceId: string,
): Promise<{ type: string; total: number; completed: number }[]> {
  const { data } = await supabase
    .from('sponsorship_deliverables')
    .select('deliverable_type, status')
    .eq('workspace_id', workspaceId)

  const map = new Map<string, { total: number; completed: number }>()
  for (const row of data ?? []) {
    const key = row.deliverable_type as string
    const entry = map.get(key) ?? { total: 0, completed: 0 }
    entry.total += 1
    if (['completed', 'approved'].includes(row.status as string)) entry.completed += 1
    map.set(key, entry)
  }
  return [...map.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.total - a.total)
}

export async function getActivationTimeline(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
): Promise<SponsorshipDeliverableRecord[] & { sponsorName?: string }[]> {
  const { data } = await supabase
    .from('sponsorship_deliverables')
    .select('id, sponsorship_id, title, deliverable_type, status, due_at, completed_at')
    .eq('workspace_id', workspaceId)
    .not('due_at', 'is', null)
    .order('due_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as never
}

export async function listSponsors(
  supabase: SupabaseClient, workspaceId: string,
) {
  const { data } = await supabase
    .from('sponsors').select('id, name, company_name, logo_url, industry')
    .eq('workspace_id', workspaceId).is('archived_at', null).order('name')
  return data ?? []
}

// ---------------------------------------------------------------- follow-up

export interface FollowUpKpis {
  tasks: KpiValue
  leadsToContact: KpiValue
  responses: KpiValue
  meetingsBooked: KpiValue
  conversionRate: KpiValue
  outstandingActions: KpiValue
}

export async function getFollowUpKpis(
  supabase: SupabaseClient, workspaceId: string, days = 30,
): Promise<FollowUpKpis> {
  const w = windowFrom(days)
  const [tasks, leads, outstanding] = await Promise.all([
    countRows(supabase, 'event_followup_tasks', workspaceId, q => q.not('status', 'in', '(cancelled)')),
    countRows(supabase, 'event_registrations', workspaceId, q => q.eq('follow_up_status', 'not_contacted')),
    countRows(supabase, 'event_followup_tasks', workspaceId,
      q => q.not('status', 'in', '(completed,cancelled)').lte('due_at', new Date().toISOString())),
  ])

  // Counted server-side per type and window. Fetching the rows and filtering
  // in JS silently capped at PostgREST's 1,000-row limit once a workspace had
  // real outreach volume, understating every figure on this page.
  const countOutreach = async (type: string, from: string, to: string) => {
    const { count } = await supabase
      .from('event_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('outreach_type', type)
      .gte('occurred_at', from)
      .lt('occurred_at', to)
    return count ?? 0
  }

  const [
    replies, repliesPrev, meetings, meetingsPrev,
    sent, sentPrev, conversions, conversionsPrev,
  ] = await Promise.all([
    countOutreach('email_replied', w.from, w.to),
    countOutreach('email_replied', w.prevFrom, w.prevTo),
    countOutreach('meeting_booked', w.from, w.to),
    countOutreach('meeting_booked', w.prevFrom, w.prevTo),
    countOutreach('email_sent', w.from, w.to),
    countOutreach('email_sent', w.prevFrom, w.prevTo),
    countOutreach('converted', w.from, w.to),
    countOutreach('converted', w.prevFrom, w.prevTo),
  ])

  const rate = sent ? conversions / sent : null
  const ratePrev = sentPrev ? conversionsPrev / sentPrev : null

  return {
    tasks: { value: tasks, changePct: null },
    leadsToContact: { value: leads, changePct: null },
    responses: { value: replies, changePct: changePct(replies, repliesPrev) },
    meetingsBooked: { value: meetings, changePct: changePct(meetings, meetingsPrev) },
    conversionRate: {
      value: rate,
      changePct: rate !== null && ratePrev !== null ? rate - ratePrev : null,
    },
    outstandingActions: { value: outstanding, changePct: null },
  }
}

export async function listFollowUpTasks(
  supabase: SupabaseClient, workspaceId: string, filters: EventsFilters = {},
): Promise<FollowUpTaskWithRelations[]> {
  let query = supabase
    .from('event_followup_tasks')
    .select('id, event_id, sequence_id, registration_id, title, description, status, priority, due_at, completed_at, owner_id, position, outcome')
    .eq('workspace_id', workspaceId)

  if (filters.q) {
    const term = filters.q.replaceAll(',', ' ').replaceAll('%', '')
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.event && filters.event !== 'all') query = query.eq('event_id', filters.event)
  if (filters.sequence && filters.sequence !== 'all') query = query.eq('sequence_id', filters.sequence)
  if (filters.owner && filters.owner !== 'all') query = query.eq('owner_id', filters.owner)
  if (filters.dateFrom) query = query.gte('due_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('due_at', filters.dateTo)

  const { data } = await query.order('position', { ascending: true }).order('due_at', { ascending: true }).limit(200)
  const rows = rowsOf(data)

  const eventIds = [...new Set(rows.map(r => r.event_id as string | null).filter(Boolean))] as string[]
  const regIds = [...new Set(rows.map(r => r.registration_id as string | null).filter(Boolean))] as string[]
  const seqIds = [...new Set(rows.map(r => r.sequence_id as string | null).filter(Boolean))] as string[]

  const [{ data: events }, { data: regs }, { data: seqs }, owners] = await Promise.all([
    eventIds.length ? supabase.from('events').select('id, name').eq('workspace_id', workspaceId).in('id', eventIds) : Promise.resolve({ data: [] }),
    regIds.length ? supabase.from('event_registrations').select('id, full_name, avatar_url').eq('workspace_id', workspaceId).in('id', regIds) : Promise.resolve({ data: [] }),
    seqIds.length ? supabase.from('event_followup_sequences').select('id, name').eq('workspace_id', workspaceId).in('id', seqIds) : Promise.resolve({ data: [] }),
    loadOwners(supabase, rows.map(r => r.owner_id as string | null)),
  ])

  const eventMap = new Map((events ?? []).map(e => [e.id as string, e.name as string]))
  const regMap = new Map((regs ?? []).map(r => [r.id as string, r]))
  const seqMap = new Map((seqs ?? []).map(s => [s.id as string, s.name as string]))

  return rows.map(row => {
    const reg = row.registration_id ? regMap.get(row.registration_id as string) : undefined
    const owner = row.owner_id ? owners.get(row.owner_id as string) : undefined
    return {
      ...(row as unknown as FollowUpTaskWithRelations),
      eventName: row.event_id ? (eventMap.get(row.event_id as string) ?? null) : null,
      contactName: (reg?.full_name as string) ?? null,
      contactAvatarUrl: (reg?.avatar_url as string) ?? null,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: owner?.avatar ?? null,
      sequenceName: row.sequence_id ? (seqMap.get(row.sequence_id as string) ?? null) : null,
    }
  })
}

export async function listFollowUpSequences(
  supabase: SupabaseClient, workspaceId: string,
): Promise<(FollowUpSequenceRecord & { steps: FollowUpStepRecord[] })[]> {
  const { data: sequences } = await supabase
    .from('event_followup_sequences')
    .select('id, event_id, name, description, status, conversion_goal')
    .eq('workspace_id', workspaceId).is('archived_at', null)
    .order('created_at', { ascending: false })

  const ids = (sequences ?? []).map(s => s.id as string)
  const { data: steps } = ids.length
    ? await supabase.from('event_followup_steps')
        .select('id, sequence_id, position, delay_days, step_type, title, body')
        .eq('workspace_id', workspaceId).in('sequence_id', ids).order('position')
    : { data: [] as Record<string, unknown>[] }

  return (sequences ?? []).map(seq => ({
    ...(seq as unknown as FollowUpSequenceRecord),
    steps: (steps ?? []).filter(s => s.sequence_id === seq.id) as unknown as FollowUpStepRecord[],
  }))
}

export async function listRecentRegistrationsToFollowUp(
  supabase: SupabaseClient, workspaceId: string, limit = 5,
) {
  const { data } = await supabase
    .from('event_registrations')
    .select('id, event_id, full_name, avatar_url, registered_at, follow_up_status')
    .eq('workspace_id', workspaceId)
    .not('follow_up_status', 'in', '(completed,converted,excluded)')
    .order('registered_at', { ascending: false })
    .limit(limit)

  const rows = rowsOf(data)
  const eventIds = [...new Set(rows.map(r => r.event_id as string))]
  const { data: events } = eventIds.length
    ? await supabase.from('events').select('id, name').eq('workspace_id', workspaceId).in('id', eventIds)
    : { data: [] as Record<string, unknown>[] }
  const eventMap = new Map((events ?? []).map(e => [e.id as string, e.name as string]))

  return rows.map(r => ({
    id: r.id as string,
    name: r.full_name as string,
    avatarUrl: r.avatar_url as string | null,
    eventName: eventMap.get(r.event_id as string) ?? null,
    registeredAt: r.registered_at as string,
    followUpStatus: r.follow_up_status as string,
  }))
}

export async function getFollowUpOwnerStats(
  supabase: SupabaseClient, workspaceId: string, limit = 3,
) {
  const { data } = await supabase.rpc('events_followup_owner_stats', { p_workspace: workspaceId })
  const rows = ((data ?? []) as { owner_id: string; total: number; completed: number }[]).slice(0, limit)
  const owners = await loadOwners(supabase, rows.map(r => r.owner_id))
  return rows.map(r => ({
    id: r.owner_id,
    name: owners.get(r.owner_id)?.name ?? 'Unassigned',
    avatarUrl: owners.get(r.owner_id)?.avatar ?? null,
    total: r.total,
    completionRate: r.total ? r.completed / r.total : 0,
  }))
}

export async function getFollowUpReminders(
  supabase: SupabaseClient, workspaceId: string,
) {
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [dueToday, sequencesNeedingAttention, meetingsThisWeek] = await Promise.all([
    countRows(supabase, 'event_followup_tasks', workspaceId,
      q => q.not('status', 'in', '(completed,cancelled)').lte('due_at', endOfDay.toISOString())),
    countRows(supabase, 'event_followup_sequences', workspaceId, q => q.eq('status', 'paused')),
    countRows(supabase, 'event_outreach_events', workspaceId,
      // Outreach events record when a meeting was BOOKED (always in the past);
      // there is no scheduled-meeting time, so count bookings made this week.
      q => q.eq('outreach_type', 'meeting_booked').gte('occurred_at', weekAgo)),
  ])

  return { dueToday, sequencesNeedingAttention, meetingsThisWeek }
}

// ---------------------------------------------------------------- gala dock

export async function getGalaDockState(
  supabase: SupabaseClient, workspaceId: string, userId: string, eventId?: string,
): Promise<GalaDockLinkState> {
  const [{ data: workspaceLink }, { data: eventLink }, { data: dismissals }] = await Promise.all([
    supabase.from('gala_dock_workspace_links')
      .select('gala_dock_workspace_url, connection_status, last_synced_at, sync_status, sync_error')
      .eq('workspace_id', workspaceId).maybeSingle(),
    eventId
      ? supabase.from('gala_dock_event_links')
          .select('gala_dock_event_url, connection_status, sync_status, sync_error, last_synced_at')
          .eq('workspace_id', workspaceId).eq('event_id', eventId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('gala_dock_promotion_dismissals')
      .select('placement').eq('workspace_id', workspaceId).eq('user_id', userId),
  ])

  const dismissedPlacements = (dismissals ?? []).map(d => d.placement as GalaDockPlacement)

  if (workspaceLink?.connection_status === 'error' || eventLink?.connection_status === 'error') {
    return {
      connectionState: 'error',
      workspaceUrl: (workspaceLink?.gala_dock_workspace_url as string) ?? null,
      eventUrl: (eventLink?.gala_dock_event_url as string) ?? null,
      lastSyncedAt: (workspaceLink?.last_synced_at as string) ?? null,
      syncError: (eventLink?.sync_error as string) ?? (workspaceLink?.sync_error as string) ?? null,
      dismissedPlacements,
    }
  }
  if (eventLink?.connection_status === 'connected') {
    return {
      connectionState: 'event-linked',
      workspaceUrl: (workspaceLink?.gala_dock_workspace_url as string) ?? null,
      eventUrl: (eventLink.gala_dock_event_url as string) ?? null,
      lastSyncedAt: (eventLink.last_synced_at as string) ?? null,
      syncError: null,
      dismissedPlacements,
    }
  }
  if (workspaceLink?.connection_status === 'connected') {
    return {
      connectionState: 'workspace-connected',
      workspaceUrl: (workspaceLink.gala_dock_workspace_url as string) ?? null,
      eventUrl: null,
      lastSyncedAt: (workspaceLink.last_synced_at as string) ?? null,
      syncError: null,
      dismissedPlacements,
    }
  }
  return {
    connectionState: 'not-connected',
    workspaceUrl: null, eventUrl: null, lastSyncedAt: null, syncError: null,
    dismissedPlacements,
  }
}

// ---------------------------------------------------------------- upcoming

export async function listUpcomingEvents(
  supabase: SupabaseClient, workspaceId: string, limit = 3,
): Promise<EventWithStats[]> {
  const { data } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .gte('start_at', new Date().toISOString())
    .not('status', 'in', '(cancelled,archived)')
    .order('start_at', { ascending: true })
    .limit(limit)
  return decorateEvents(supabase, workspaceId, rowsOf(data))
}
