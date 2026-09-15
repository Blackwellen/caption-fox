import 'server-only'

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { CHANNEL_LABELS, MAX_PAGE_SIZE, CONFLICT_TYPE_LABELS } from './constants'
import {
  buildCalendarContext, isCalendarSurface, type CalendarContext,
} from './entitlements'
import {
  DEFAULT_TZ, addDays, endOfDayUtc, startOfDayUtc, startOfWeekUtc,
  zonedDateKey, formatDayLabel, todayKey, overlaps,
} from './dates'
import type {
  AgendaDay, AgendaKpis, CalendarActivity, CalendarConflict, CalendarKpis,
  CalendarLookups, ConflictKpis, ConflictLinkedRecord, ConflictRecommendation,
  ConflictHeatmapCell, ConflictTypeBreakdown, ConflictType, Priority, QueueAlert,
  QueueItem, QueueKpis, QueueLaneId, ScheduleEntry, ScheduleKind, ScheduleStatus,
  ThroughputPoint, ApprovalState, DeliveryState,
} from './types'

/**
 * Every query below is workspace-scoped in SQL *and* protected by RLS. A missing
 * table (migration not yet applied to this environment) degrades to an empty
 * result plus a recorded reason, so a page renders an honest error/empty state
 * instead of a white screen.
 */
export interface Loaded<T> { data: T; error: string | null }

async function safe<T>(fallback: T, run: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await run(), error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Never leak provider payloads or credentials into the UI.
    const safeMessage = /relation .* does not exist|schema cache|column .* does not exist/i.test(message)
      ? 'This area is not available yet in this environment. Apply the pending Calendar migration to enable it.'
      : 'We could not load this data. Try again, or contact support with reference CAL-QUERY.'
    if (process.env.NODE_ENV !== 'production') console.error('[calendar]', message)
    return { data: fallback, error: safeMessage }
  }
}

// ── Context ─────────────────────────────────────────────────────────────────

export interface CalendarSession {
  supabase: SupabaseClient
  ctx: CalendarContext
}

/**
 * Resolves auth + active workspace + membership + plan + flags.
 * Returns null when the visitor is not signed in, or the workspace type is not
 * entitled to the Calendar module at all.
 */
export const resolveCalendarSession = cache(async (basePath: string): Promise<CalendarSession | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) return null

  const [{ data: member }, { data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspace_members')
      .select('role, permissions')
      .eq('workspace_id', active.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('workspaces')
      .select('id, type, plan, plan_status, settings, owner_id')
      .eq('id', active.id).maybeSingle(),
    supabase.from('profiles')
      .select('full_name, timezone')
      .eq('id', user.id).maybeSingle(),
  ])

  // Server-side membership check — never trust the URL segment alone.
  const isOwner = workspace?.owner_id === user.id
  if (!member && !isOwner) return null

  const type = workspace?.type ?? active.type ?? null
  const settings = (workspace?.settings ?? {}) as Record<string, unknown>
  const flags = (settings.feature_flags ?? {}) as Record<string, boolean>

  const permissionsJson = member?.permissions
  const permissions = Array.isArray(permissionsJson)
    ? (permissionsJson as string[])
    : permissionsJson && typeof permissionsJson === 'object'
      ? Object.entries(permissionsJson as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k)
      : null

  const ctx = buildCalendarContext({
    workspaceId: active.id,
    workspaceType: type,
    basePath,
    planId: workspace?.plan,
    role: isOwner ? 'owner' : member?.role,
    permissions,
    flags,
    timezone: (settings.timezone as string) || profile?.timezone || DEFAULT_TZ,
    weekStartsOn: (settings.week_starts_on as number) ?? 0,
    locale: (settings.locale as string) || 'en-GB',
    userId: user.id,
    userName: profile?.full_name ?? null,
    userEmail: user.email ?? null,
  })

  // Workspace types outside the Calendar entitlement never reach a page.
  if (!isCalendarSurface(ctx.surface)) return null
  return { supabase, ctx }
})

// ── Lookups (filter option sets) ────────────────────────────────────────────

export async function fetchLookups(session: CalendarSession): Promise<Loaded<CalendarLookups>> {
  const { supabase, ctx } = session
  return safe<CalendarLookups>({ owners: [], teams: [], channels: [], campaigns: [] }, async () => {
    const [members, channels, campaigns] = await Promise.all([
      supabase.from('workspace_members')
        .select('user_id, role, profiles!workspace_members_user_id_fkey(id, full_name, email)')
        .eq('workspace_id', ctx.workspaceId),
      supabase.from('social_channels')
        .select('id, platform, account_name, is_active')
        .eq('workspace_id', ctx.workspaceId),
      supabase.from('campaigns')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .neq('status', 'archived')
        .order('name'),
    ])

    const owners = (members.data ?? []).map(row => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return { value: (p?.id ?? row.user_id) as string, label: (p?.full_name || p?.email || 'Team member') as string }
    }).filter(o => o.value)

    const teams = [...new Set((members.data ?? []).map(r => r.role as string).filter(Boolean))]
      .map(role => ({ value: role, label: TEAM_LABELS[role] ?? role }))

    const channelOptions = [...new Set((channels.data ?? []).map(c => c.platform as string))]
      .map(platform => ({ value: platform, label: CHANNEL_LABELS[platform] ?? platform }))

    return {
      owners,
      teams,
      channels: channelOptions,
      campaigns: (campaigns.data ?? []).map(c => ({ value: c.id as string, label: c.name as string })),
    }
  })
}

const TEAM_LABELS: Record<string, string> = {
  owner: 'Leadership', admin: 'Operations', manager: 'Marketing Team',
  member: 'Content Team', viewer: 'Client', ugc_creator: 'Creator Network',
}

export { CHANNEL_LABELS, MAX_PAGE_SIZE } from './constants'

// ── Schedule aggregation ────────────────────────────────────────────────────

interface RangeInput { startIso: string; endIso: string }

interface ScheduleFilterInput {
  owner?: string | null
  team?: string | null
  channel?: string | null
  status?: string | null
  priority?: string | null
  type?: string | null
  campaign?: string | null
  approval?: string | null
  conflict?: string | null
  search?: string | null
}

const POST_STATUS_MAP: Record<string, ScheduleStatus> = {
  draft: 'draft', pending_approval: 'pending', approved: 'approved',
  scheduled: 'scheduled', published: 'published', failed: 'failed', archived: 'cancelled',
}

const TASK_STATUS_MAP: Record<string, ScheduleStatus> = {
  todo: 'scheduled', in_progress: 'in_progress', review: 'in_review', done: 'completed',
}

/**
 * The single canonical aggregation. Only the visible window is fetched (never
 * the whole workspace), and every source query carries workspace_id.
 */
export async function fetchScheduleEntries(
  session: CalendarSession,
  range: RangeInput,
  filters: ScheduleFilterInput = {},
): Promise<Loaded<ScheduleEntry[]>> {
  const { supabase, ctx } = session
  const { startIso, endIso } = range

  return safe<ScheduleEntry[]>([], async () => {
    const wantsKind = (kind: ScheduleKind) => !filters.type || filters.type === 'all' || filters.type === kind

    const [posts, tasks, campaigns, items, conflictLinks, profiles] = await Promise.all([
      wantsKind('content')
        ? supabase.from('content_posts')
            .select('id, title, caption, platforms, status, scheduled_at, published_at, campaign_id, created_by, approval_required, approved_at, post_type')
            .eq('workspace_id', ctx.workspaceId)
            .not('scheduled_at', 'is', null)
            .gte('scheduled_at', startIso).lte('scheduled_at', endIso)
            .order('scheduled_at')
            .limit(1000)
        : { data: [] as never[] },
      wantsKind('task')
        ? supabase.from('campaign_tasks')
            .select('id, title, description, status, priority, due_date, assigned_to, campaign_id')
            .eq('workspace_id', ctx.workspaceId)
            .not('due_date', 'is', null)
            .gte('due_date', startIso).lte('due_date', endIso)
            .order('due_date')
            .limit(1000)
        : { data: [] as never[] },
      wantsKind('campaign')
        ? supabase.from('campaigns')
            .select('id, name, status, start_date, end_date, created_by')
            .eq('workspace_id', ctx.workspaceId)
            .neq('status', 'archived')
            .limit(500)
        : { data: [] as never[] },
      supabase.from('calendar_items')
        .select('id, item_type, title, description, start_at, end_at, all_day, timezone, status, priority, channel, campaign_id, owner_id, team, location, meeting_url')
        .eq('workspace_id', ctx.workspaceId)
        .is('archived_at', null)
        .lte('start_at', endIso)
        .or(`end_at.gte.${startIso},and(end_at.is.null,start_at.gte.${startIso})`)
        .order('start_at')
        .limit(1000),
      supabase.from('calendar_conflict_records')
        .select('conflict_id, record_kind, record_id')
        .eq('workspace_id', ctx.workspaceId)
        .limit(2000),
      supabase.from('workspace_members')
        .select('user_id, role, profiles!workspace_members_user_id_fkey(id, full_name, email)')
        .eq('workspace_id', ctx.workspaceId),
    ])

    if (items.error && !isMissingRelation(items.error)) throw items.error
    if (posts && 'error' in posts && posts.error) throw posts.error

    const nameById = new Map<string, { name: string; team: string }>()
    for (const row of profiles.data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (p?.id) nameById.set(p.id as string, {
        name: (p.full_name || p.email || 'Team member') as string,
        team: TEAM_LABELS[row.role as string] ?? 'Team',
      })
    }

    const campaignNameById = new Map<string, string>()
    for (const c of campaigns.data ?? []) campaignNameById.set(c.id as string, c.name as string)

    const conflictsByRecord = new Map<string, string[]>()
    for (const link of conflictLinks.data ?? []) {
      const key = `${link.record_kind}:${link.record_id}`
      const list = conflictsByRecord.get(key) ?? []
      list.push(link.conflict_id as string)
      conflictsByRecord.set(key, list)
    }

    const entries: ScheduleEntry[] = []

    // Content posts ---------------------------------------------------------
    for (const post of posts.data ?? []) {
      const channel = (post.platforms as string[] | null)?.[0] ?? null
      entries.push({
        id: `content:${post.id}`,
        kind: 'content',
        recordId: post.id as string,
        title: (post.title || firstLine(post.caption as string | null) || 'Untitled post') as string,
        subtitle: post.post_type ? String(post.post_type) : null,
        startAt: post.scheduled_at as string,
        endAt: null,
        allDay: false,
        timezone: ctx.timezone,
        status: POST_STATUS_MAP[post.status as string] ?? 'scheduled',
        priority: 'medium',
        channel,
        campaignId: (post.campaign_id as string) ?? null,
        campaignName: post.campaign_id ? campaignNameById.get(post.campaign_id as string) ?? null : null,
        ownerId: (post.created_by as string) ?? null,
        ownerName: post.created_by ? nameById.get(post.created_by as string)?.name ?? null : null,
        team: post.created_by ? nameById.get(post.created_by as string)?.team ?? null : null,
        href: `${ctx.basePath}/studio/detail-${post.id}`,
        conflictIds: conflictsByRecord.get(`content_post:${post.id}`) ?? [],
        editable: true,
      })
    }

    // Tasks -----------------------------------------------------------------
    for (const task of tasks.data ?? []) {
      entries.push({
        id: `task:${task.id}`,
        kind: 'task',
        recordId: task.id as string,
        title: task.title as string,
        subtitle: (task.description as string | null) ?? null,
        startAt: task.due_date as string,
        endAt: null,
        allDay: false,
        timezone: ctx.timezone,
        status: TASK_STATUS_MAP[task.status as string] ?? 'scheduled',
        priority: (task.priority as Priority) ?? 'medium',
        channel: null,
        campaignId: (task.campaign_id as string) ?? null,
        campaignName: task.campaign_id ? campaignNameById.get(task.campaign_id as string) ?? null : null,
        ownerId: (task.assigned_to as string) ?? null,
        ownerName: task.assigned_to ? nameById.get(task.assigned_to as string)?.name ?? null : null,
        team: task.assigned_to ? nameById.get(task.assigned_to as string)?.team ?? null : null,
        href: `${ctx.basePath}/campaigns/detail-${task.campaign_id}`,
        conflictIds: conflictsByRecord.get(`task:${task.id}`) ?? [],
        editable: true,
      })
    }

    // Campaign launch / end milestones -------------------------------------
    for (const campaign of campaigns.data ?? []) {
      for (const [field, suffix] of [['start_date', 'launch'], ['end_date', 'ends']] as const) {
        const value = campaign[field] as string | null
        if (!value) continue
        const iso = `${value}T00:00:00.000Z`
        if (iso < startIso || iso > endIso) continue
        entries.push({
          id: `campaign:${campaign.id}:${suffix}`,
          kind: 'campaign',
          recordId: campaign.id as string,
          title: suffix === 'launch' ? `${campaign.name} launch` : `${campaign.name} ends`,
          subtitle: 'Campaign milestone',
          startAt: iso,
          endAt: null,
          allDay: true,
          timezone: ctx.timezone,
          status: campaign.status === 'completed' ? 'completed' : campaign.status === 'draft' ? 'draft' : 'scheduled',
          priority: 'high',
          channel: null,
          campaignId: campaign.id as string,
          campaignName: campaign.name as string,
          ownerId: (campaign.created_by as string) ?? null,
          ownerName: campaign.created_by ? nameById.get(campaign.created_by as string)?.name ?? null : null,
          team: null,
          href: `${ctx.basePath}/campaigns/detail-${campaign.id}`,
          conflictIds: conflictsByRecord.get(`campaign:${campaign.id}`) ?? [],
          editable: false,
        })
      }
    }

    // Calendar items --------------------------------------------------------
    for (const item of items.data ?? []) {
      const kind: ScheduleKind =
        item.item_type === 'meeting' ? 'meeting'
        : item.item_type === 'reminder' ? 'reminder'
        : item.item_type === 'milestone' || item.item_type === 'launch' ? 'milestone'
        : item.item_type === 'review' ? 'approval'
        : 'event'
      if (!wantsKind(kind)) continue
      entries.push({
        id: `item:${item.id}`,
        kind,
        recordId: item.id as string,
        title: item.title as string,
        subtitle: (item.description as string | null) ?? null,
        startAt: item.start_at as string,
        endAt: (item.end_at as string | null) ?? null,
        allDay: !!item.all_day,
        timezone: (item.timezone as string) || ctx.timezone,
        status: (item.status as ScheduleStatus) ?? 'scheduled',
        priority: (item.priority as Priority) ?? 'medium',
        channel: (item.channel as string | null) ?? null,
        campaignId: (item.campaign_id as string) ?? null,
        campaignName: item.campaign_id ? campaignNameById.get(item.campaign_id as string) ?? null : null,
        ownerId: (item.owner_id as string) ?? null,
        ownerName: item.owner_id ? nameById.get(item.owner_id as string)?.name ?? null : null,
        team: (item.team as string | null) ?? (item.owner_id ? nameById.get(item.owner_id as string)?.team ?? null : null),
        href: null,
        conflictIds: conflictsByRecord.get(`calendar_item:${item.id}`) ?? [],
        editable: true,
      })
    }

    return applyScheduleFilters(entries, filters).sort((a, b) => a.startAt.localeCompare(b.startAt))
  })
}

function applyScheduleFilters(entries: ScheduleEntry[], f: ScheduleFilterInput): ScheduleEntry[] {
  const search = f.search?.trim().toLowerCase()
  return entries.filter(entry => {
    if (f.owner && f.owner !== 'all' && entry.ownerId !== f.owner) return false
    if (f.team && f.team !== 'all' && entry.team !== f.team) return false
    if (f.channel && f.channel !== 'all' && entry.channel !== f.channel) return false
    if (f.status && f.status !== 'all' && entry.status !== f.status) return false
    if (f.priority && f.priority !== 'all' && entry.priority !== f.priority) return false
    if (f.campaign && f.campaign !== 'all' && entry.campaignId !== f.campaign) return false
    if (f.conflict === 'conflicted' && entry.conflictIds.length === 0) return false
    if (f.conflict === 'clear' && entry.conflictIds.length > 0) return false
    if (f.approval === 'pending' && entry.status !== 'pending' && entry.status !== 'in_review') return false
    if (f.approval === 'approved' && entry.status !== 'approved') return false
    if (search) {
      const hay = `${entry.title} ${entry.subtitle ?? ''} ${entry.campaignName ?? ''} ${entry.ownerName ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}

function firstLine(text: string | null) {
  if (!text) return null
  const line = text.split('\n')[0].trim()
  return line.length > 60 ? `${line.slice(0, 57)}…` : line
}

function isMissingRelation(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '')
}

// ── Calendar KPIs ───────────────────────────────────────────────────────────

export async function fetchCalendarKpis(session: CalendarSession): Promise<Loaded<CalendarKpis>> {
  const { supabase, ctx } = session
  const empty: CalendarKpis = {
    scheduledThisWeek: 0, scheduledThisWeekDelta: null,
    publishingDueToday: 0, publishingDueTodayDelta: null,
    conflictAlerts: 0, conflictAlertsDelta: null,
    onTimeRate: null, onTimeRateDelta: null,
    capacityUtilisation: null, capacityUtilisationDelta: null,
    upcomingLaunches: 0, nextLaunchLabel: null,
  }

  return safe<CalendarKpis>(empty, async () => {
    const now = new Date()
    const weekStart = startOfWeekUtc(now, ctx.weekStartsOn, ctx.timezone)
    const weekEnd = addDays(weekStart, 7)
    const prevWeekStart = addDays(weekStart, -7)
    const dayStart = startOfDayUtc(now, ctx.timezone)
    const dayEnd = endOfDayUtc(now, ctx.timezone)
    const yesterdayStart = addDays(dayStart, -1)
    const thirtyDaysAgo = addDays(now, -30)
    const sixtyDaysAgo = addDays(now, -60)

    const count = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0)

    const [
      thisWeek, lastWeek, dueToday, dueYesterday,
      openConflicts, conflictsLastWeek,
      recent, previous, launches, teamSize, weekLoad,
    ] = await Promise.all([
      count(supabase.from('content_posts').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', weekStart.toISOString()).lt('scheduled_at', weekEnd.toISOString())),
      count(supabase.from('content_posts').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', prevWeekStart.toISOString()).lt('scheduled_at', weekStart.toISOString())),
      count(supabase.from('publishing_queue').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
        .not('status', 'in', '(cancelled)')),
      count(supabase.from('publishing_queue').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', yesterdayStart.toISOString()).lt('scheduled_at', dayStart.toISOString())),
      count(supabase.from('calendar_conflicts').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId).in('status', ['open', 'in_progress', 'reopened'])),
      count(supabase.from('calendar_conflicts').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId).in('status', ['open', 'in_progress', 'reopened'])
        .lt('detected_at', weekStart.toISOString())),
      supabase.from('publishing_queue')
        .select('status, scheduled_at, published_at, sent_at')
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', thirtyDaysAgo.toISOString())
        .limit(2000),
      supabase.from('publishing_queue')
        .select('status, scheduled_at, published_at, sent_at')
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', sixtyDaysAgo.toISOString()).lt('scheduled_at', thirtyDaysAgo.toISOString())
        .limit(2000),
      supabase.from('campaigns')
        .select('id, name, start_date')
        .eq('workspace_id', ctx.workspaceId)
        .in('status', ['draft', 'active', 'live'])
        .gte('start_date', zonedDateKey(now, ctx.timezone))
        .order('start_date').limit(20),
      count(supabase.from('workspace_members').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)),
      count(supabase.from('campaign_tasks').select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .gte('due_date', weekStart.toISOString()).lt('due_date', weekEnd.toISOString())
        .neq('status', 'done')),
    ])

    const onTime = onTimeRate(recent.data ?? [])
    const onTimePrev = onTimeRate(previous.data ?? [])

    // Capacity = open deliverables this week against a 10-deliverable-per-seat
    // working week. Documented rather than a magic number in the UI.
    const seats = Math.max(teamSize, 1)
    const capacity = seats * 10
    const utilisation = capacity > 0 ? Math.min(100, Math.round((weekLoad / capacity) * 100)) : null

    return {
      scheduledThisWeek: thisWeek,
      scheduledThisWeekDelta: percentDelta(thisWeek, lastWeek),
      publishingDueToday: dueToday,
      publishingDueTodayDelta: percentDelta(dueToday, dueYesterday),
      conflictAlerts: openConflicts,
      conflictAlertsDelta: percentDelta(openConflicts, conflictsLastWeek),
      onTimeRate: onTime,
      onTimeRateDelta: onTime !== null && onTimePrev !== null ? onTime - onTimePrev : null,
      capacityUtilisation: utilisation,
      capacityUtilisationDelta: null,
      upcomingLaunches: (launches.data ?? []).length,
      nextLaunchLabel: (launches.data ?? [])[0]?.name as string ?? null,
    }
  })
}

function onTimeRate(rows: { status?: string | null; scheduled_at?: string | null; published_at?: string | null; sent_at?: string | null }[]): number | null {
  const done = rows.filter(r => r.status === 'published' || r.status === 'sent')
  if (done.length === 0) return null
  const onTime = done.filter(r => {
    const actual = r.published_at ?? r.sent_at
    if (!actual || !r.scheduled_at) return true
    // Within 15 minutes of the scheduled slot counts as on time.
    return new Date(actual).getTime() - new Date(r.scheduled_at).getTime() <= 15 * 60000
  }).length
  return Math.round((onTime / done.length) * 100)
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

// ── Publishing queue ────────────────────────────────────────────────────────

export interface QueueFilterInput extends ScheduleFilterInput {
  lane?: string | null
  delivery?: string | null
  sort?: string | null
  page?: number
  pageSize?: number
}

export function laneFor(approval: ApprovalState, delivery: DeliveryState): QueueLaneId {
  if (delivery === 'failed') return 'failed'
  // Items waiting on a reviewer are stored as drafts, so approval must win over draft.
  if (approval === 'awaiting_approval' || approval === 'changes_requested') return 'awaiting_approval'
  if (delivery === 'draft') return 'draft'
  if (delivery === 'scheduled' || delivery === 'processing') return 'scheduled'
  if (delivery === 'ready' || delivery === 'queued') return 'ready'
  if (approval === 'approved') return 'approved'
  return 'ready'
}

export async function fetchQueueItems(
  session: CalendarSession,
  range: RangeInput,
  filters: QueueFilterInput = {},
): Promise<Loaded<{ items: QueueItem[]; total: number }>> {
  const { supabase, ctx } = session
  return safe<{ items: QueueItem[]; total: number }>({ items: [], total: 0 }, async () => {
    const [rows, profiles, channels, campaigns] = await Promise.all([
      supabase.from('publishing_queue')
        .select(`
          id, post_id, channel_id, provider, provider_account_id, campaign_id, owner_id,
          scheduled_at, published_at, sent_at, status, approval_status, priority,
          attempt_count, last_attempt_at, next_retry_at, sla_due_at,
          failure_code, error_message,
          content_posts(id, title, caption, platforms, thumbnail_url, status)
        `)
        .eq('workspace_id', ctx.workspaceId)
        .gte('scheduled_at', range.startIso)
        .lte('scheduled_at', range.endIso)
        .order('scheduled_at')
        .limit(2000),
      supabase.from('workspace_members')
        .select('user_id, profiles!workspace_members_user_id_fkey(id, full_name, email)')
        .eq('workspace_id', ctx.workspaceId),
      supabase.from('social_channels')
        .select('id, platform, account_name, is_active, token_expires_at')
        .eq('workspace_id', ctx.workspaceId),
      supabase.from('campaigns').select('id, name').eq('workspace_id', ctx.workspaceId),
    ])
    if (rows.error) throw rows.error

    const nameById = new Map<string, string>()
    for (const row of profiles.data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (p?.id) nameById.set(p.id as string, (p.full_name || p.email || 'Team member') as string)
    }
    const channelById = new Map((channels.data ?? []).map(c => [c.id as string, c]))
    const campaignById = new Map((campaigns.data ?? []).map(c => [c.id as string, c.name as string]))

    const all: QueueItem[] = (rows.data ?? []).map(row => {
      const post = Array.isArray(row.content_posts) ? row.content_posts[0] : row.content_posts
      const channelRow = row.channel_id ? channelById.get(row.channel_id as string) : undefined
      const providerAccount = row.provider_account_id ? channelById.get(row.provider_account_id as string) : channelRow
      const approval = (row.approval_status as ApprovalState) ?? 'not_required'
      const delivery = (row.status as DeliveryState) ?? 'queued'
      const tokenValid = !providerAccount?.token_expires_at
        || new Date(providerAccount.token_expires_at as string).getTime() > Date.now()

      return {
        id: row.id as string,
        postId: (row.post_id as string) ?? null,
        title: (post?.title || firstLine(post?.caption as string | null) || 'Untitled item') as string,
        subtitle: channelRow ? `${CHANNEL_LABELS[channelRow.platform as string] ?? channelRow.platform} post` : null,
        thumbnailUrl: (post?.thumbnail_url as string) ?? null,
        channel: (channelRow?.platform as string) ?? (post?.platforms as string[] | null)?.[0] ?? null,
        provider: (row.provider as string) ?? (channelRow?.platform as string) ?? null,
        providerAccountId: (row.provider_account_id as string) ?? (row.channel_id as string) ?? null,
        providerAccountName: (providerAccount?.account_name as string) ?? null,
        providerConnected: !!providerAccount?.is_active && tokenValid,
        campaignId: (row.campaign_id as string) ?? null,
        campaignName: row.campaign_id ? campaignById.get(row.campaign_id as string) ?? null : null,
        ownerId: (row.owner_id as string) ?? null,
        ownerName: row.owner_id ? nameById.get(row.owner_id as string) ?? null : null,
        scheduledAt: (row.scheduled_at as string) ?? null,
        publishedAt: (row.published_at as string) ?? (row.sent_at as string) ?? null,
        approvalStatus: approval,
        deliveryStatus: delivery,
        priority: (row.priority as Priority) ?? 'medium',
        attemptCount: (row.attempt_count as number) ?? 0,
        lastAttemptAt: (row.last_attempt_at as string) ?? null,
        nextRetryAt: (row.next_retry_at as string) ?? null,
        slaDueAt: (row.sla_due_at as string) ?? null,
        failureCode: (row.failure_code as string) ?? null,
        failureMessage: safeFailureMessage(row.error_message as string | null),
        lane: laneFor(approval, delivery),
      }
    })

    const filtered = applyQueueFilters(all, filters)
    const sorted = sortQueue(filtered, filters.sort ?? 'scheduled_at')
    const page = Math.max(1, filters.page ?? 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, filters.pageSize ?? 10))
    return { items: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length }
  })
}

/** Provider errors can carry request payloads — only a category is surfaced. */
function safeFailureMessage(message: string | null): string | null {
  if (!message) return null
  const trimmed = message.split('\n')[0].slice(0, 160)
  return trimmed.replace(/(token|secret|key|authorization)[=:]\s*\S+/gi, '$1: [redacted]')
}

function applyQueueFilters(items: QueueItem[], f: QueueFilterInput): QueueItem[] {
  const search = f.search?.trim().toLowerCase()
  return items.filter(item => {
    if (f.lane && f.lane !== 'all' && item.lane !== f.lane) return false
    if (f.channel && f.channel !== 'all' && item.channel !== f.channel) return false
    if (f.owner && f.owner !== 'all' && item.ownerId !== f.owner) return false
    if (f.campaign && f.campaign !== 'all' && item.campaignId !== f.campaign) return false
    if (f.approval && f.approval !== 'all' && item.approvalStatus !== f.approval) return false
    if (f.delivery && f.delivery !== 'all' && item.deliveryStatus !== f.delivery) return false
    if (f.priority && f.priority !== 'all' && item.priority !== f.priority) return false
    if (search) {
      const hay = `${item.title} ${item.campaignName ?? ''} ${item.ownerName ?? ''} ${item.channel ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}

function sortQueue(items: QueueItem[], sort: string): QueueItem[] {
  const [field, dir = 'asc'] = sort.split(':')
  const sign = dir === 'desc' ? -1 : 1
  const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  return [...items].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'title': cmp = a.title.localeCompare(b.title); break
      case 'priority': cmp = priorityRank[a.priority] - priorityRank[b.priority]; break
      case 'owner': cmp = (a.ownerName ?? '').localeCompare(b.ownerName ?? ''); break
      case 'channel': cmp = (a.channel ?? '').localeCompare(b.channel ?? ''); break
      case 'approval': cmp = a.approvalStatus.localeCompare(b.approvalStatus); break
      case 'delivery': cmp = a.deliveryStatus.localeCompare(b.deliveryStatus); break
      default: cmp = (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')
    }
    // Stable tiebreak so pagination never reorders equal rows.
    return cmp !== 0 ? cmp * sign : a.id.localeCompare(b.id)
  })
}

export async function fetchQueueLaneCounts(
  session: CalendarSession, range: RangeInput,
): Promise<Loaded<Record<QueueLaneId, { count: number; preview: QueueItem[] }>>> {
  const all = await fetchQueueItems(session, range, { pageSize: MAX_PAGE_SIZE, page: 1 })
  const empty = {
    draft: { count: 0, preview: [] as QueueItem[] },
    awaiting_approval: { count: 0, preview: [] as QueueItem[] },
    approved: { count: 0, preview: [] as QueueItem[] },
    ready: { count: 0, preview: [] as QueueItem[] },
    scheduled: { count: 0, preview: [] as QueueItem[] },
    failed: { count: 0, preview: [] as QueueItem[] },
  }
  if (all.error) return { data: empty, error: all.error }
  const grouped = { ...empty }
  for (const item of all.data.items) {
    grouped[item.lane].count += 1
    if (grouped[item.lane].preview.length < 2) grouped[item.lane].preview.push(item)
  }
  return { data: grouped, error: null }
}

export async function fetchQueueKpis(session: CalendarSession): Promise<Loaded<QueueKpis>> {
  const { supabase, ctx } = session
  const empty: QueueKpis = {
    queued: 0, queuedDelta: null, awaitingApproval: 0, awaitingApprovalDelta: null,
    readyToPublish: 0, readyToPublishDelta: null, failed: 0, failedDelta: null,
    scheduledToday: 0, scheduledTodayDelta: null, slaRisk: 0, slaRiskDelta: null,
  }
  return safe<QueueKpis>(empty, async () => {
    const now = new Date()
    const dayStart = startOfDayUtc(now, ctx.timezone)
    const dayEnd = endOfDayUtc(now, ctx.timezone)
    const yesterdayStart = addDays(dayStart, -1)
    const soon = new Date(now.getTime() + 4 * 3600_000)

    const c = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0)
    const from = () => supabase.from('publishing_queue').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId)

    const [queued, queuedPrev, awaiting, awaitingPrev, ready, readyPrev, failed, failedPrev, today, yesterday, sla] =
      await Promise.all([
        c(from().in('status', ['queued', 'ready', 'scheduled', 'draft'])),
        c(from().in('status', ['queued', 'ready', 'scheduled', 'draft']).lt('created_at', dayStart.toISOString())),
        c(from().eq('approval_status', 'awaiting_approval')),
        c(from().eq('approval_status', 'awaiting_approval').lt('created_at', dayStart.toISOString())),
        c(from().eq('approval_status', 'approved').in('status', ['ready', 'queued'])),
        c(from().eq('approval_status', 'approved').in('status', ['ready', 'queued']).lt('created_at', dayStart.toISOString())),
        c(from().eq('status', 'failed')),
        c(from().eq('status', 'failed').lt('created_at', dayStart.toISOString())),
        c(from().gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())),
        c(from().gte('scheduled_at', yesterdayStart.toISOString()).lt('scheduled_at', dayStart.toISOString())),
        c(from().not('sla_due_at', 'is', null).lte('sla_due_at', soon.toISOString())
          .not('status', 'in', '(published,sent,cancelled)')),
      ])

    return {
      queued, queuedDelta: percentDelta(queued, queuedPrev),
      awaitingApproval: awaiting, awaitingApprovalDelta: percentDelta(awaiting, awaitingPrev),
      readyToPublish: ready, readyToPublishDelta: percentDelta(ready, readyPrev),
      failed, failedDelta: percentDelta(failed, failedPrev),
      scheduledToday: today, scheduledTodayDelta: percentDelta(today, yesterday),
      slaRisk: sla, slaRiskDelta: null,
    }
  })
}

export async function fetchQueueAlerts(session: CalendarSession): Promise<Loaded<QueueAlert[]>> {
  const { supabase, ctx } = session
  return safe<QueueAlert[]>([], async () => {
    const now = new Date().toISOString()
    const alerts: QueueAlert[] = []

    const c = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0)
    const from = () => supabase.from('publishing_queue').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId)

    const [pastSla, failed, bottleneck, channels] = await Promise.all([
      c(from().not('sla_due_at', 'is', null).lt('sla_due_at', now).not('status', 'in', '(published,sent,cancelled)')),
      c(from().eq('status', 'failed')),
      c(from().eq('approval_status', 'awaiting_approval').lt('scheduled_at', now)),
      supabase.from('social_channels')
        .select('id, platform, account_name, is_active, token_expires_at')
        .eq('workspace_id', ctx.workspaceId),
    ])

    if (pastSla > 0) alerts.push({
      kind: 'sla_breach', severity: 'high',
      title: `${pastSla} item${pastSla === 1 ? '' : 's'} past SLA`,
      detail: 'Require immediate attention', count: pastSla,
      filterQuery: 'sla=breached',
    })
    if (failed > 0) alerts.push({
      kind: 'failed_publish', severity: 'high',
      title: `${failed} failed publish${failed === 1 ? '' : 'es'}`,
      detail: 'Need resolution', count: failed,
      filterQuery: 'delivery=failed',
    })
    if (bottleneck > 0) alerts.push({
      kind: 'approval_bottleneck', severity: 'medium',
      title: `${bottleneck} approval bottleneck${bottleneck === 1 ? '' : 's'}`,
      detail: 'Blocking scheduled items', count: bottleneck,
      filterQuery: 'approval=awaiting_approval',
    })

    const broken = (channels.data ?? []).filter(ch =>
      ch.is_active === false || (ch.token_expires_at && new Date(ch.token_expires_at as string).getTime() < Date.now()))
    if (broken.length > 0) alerts.push({
      kind: 'provider_auth', severity: 'high',
      title: `${broken.length} channel connection${broken.length === 1 ? '' : 's'} need attention`,
      detail: broken.map(b => CHANNEL_LABELS[b.platform as string] ?? b.platform).join(', '),
      count: broken.length,
      filterQuery: 'delivery=failed',
    })

    return alerts
  })
}

export async function fetchThroughput(session: CalendarSession, days = 7): Promise<Loaded<ThroughputPoint[]>> {
  const { supabase, ctx } = session
  return safe<ThroughputPoint[]>([], async () => {
    const since = addDays(new Date(), -days)
    const { data, error } = await supabase.from('publishing_queue')
      .select('status, scheduled_at, published_at, sent_at')
      .eq('workspace_id', ctx.workspaceId)
      .gte('scheduled_at', since.toISOString())
      .limit(5000)
    if (error) throw error

    const buckets = new Map<string, ThroughputPoint>()
    for (let i = days; i >= 0; i--) {
      const key = zonedDateKey(addDays(new Date(), -i), ctx.timezone)
      buckets.set(key, { date: key, published: 0, scheduled: 0, failed: 0 })
    }
    for (const row of data ?? []) {
      const key = zonedDateKey((row.published_at ?? row.sent_at ?? row.scheduled_at) as string, ctx.timezone)
      const bucket = buckets.get(key)
      if (!bucket) continue
      if (row.status === 'published' || row.status === 'sent') bucket.published += 1
      else if (row.status === 'failed') bucket.failed += 1
      else bucket.scheduled += 1
    }
    return [...buckets.values()]
  })
}

export async function fetchDelayedItems(session: CalendarSession, limit = 5): Promise<Loaded<QueueItem[]>> {
  const now = new Date()
  const result = await fetchQueueItems(session, {
    startIso: addDays(now, -60).toISOString(),
    endIso: now.toISOString(),
  }, { pageSize: MAX_PAGE_SIZE, sort: 'scheduled_at' })
  if (result.error) return { data: [], error: result.error }
  const overdue = result.data.items
    .filter(item => item.scheduledAt
      && new Date(item.scheduledAt).getTime() < now.getTime()
      && !['published', 'sent', 'cancelled'].includes(item.deliveryStatus))
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
  return { data: overdue.slice(0, limit), error: null }
}

// ── Agenda ──────────────────────────────────────────────────────────────────

export function groupIntoAgendaDays(entries: ScheduleEntry[], ctx: CalendarContext): AgendaDay[] {
  const today = todayKey(ctx.timezone)
  const map = new Map<string, AgendaDay>()
  for (const entry of entries) {
    const key = zonedDateKey(entry.startAt, ctx.timezone)
    let day = map.get(key)
    if (!day) {
      day = {
        date: key,
        label: formatDayLabel(entry.startAt, ctx.timezone, ctx.locale),
        isToday: key === today,
        allDay: [], timed: [], count: 0,
      }
      map.set(key, day)
    }
    ;(entry.allDay ? day.allDay : day.timed).push(entry)
    day.count += 1
  }
  for (const day of map.values()) {
    day.timed.sort((a, b) => a.startAt.localeCompare(b.startAt))
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchAgendaKpis(session: CalendarSession): Promise<Loaded<AgendaKpis>> {
  const { supabase, ctx } = session
  const empty: AgendaKpis = {
    todayItems: 0, todayItemsDelta: null, thisWeek: 0, thisWeekDelta: null,
    pendingApprovals: 0, highPriorityApprovals: 0, overdueTasks: 0, overdueTasksDelta: null,
    openConflicts: 0, conflictsNeedingAttention: 0, teamLoad: null, teamLoadLabel: 'No data',
  }
  return safe<AgendaKpis>(empty, async () => {
    const now = new Date()
    const dayStart = startOfDayUtc(now, ctx.timezone)
    const dayEnd = endOfDayUtc(now, ctx.timezone)
    const weekStart = startOfWeekUtc(now, ctx.weekStartsOn, ctx.timezone)
    const weekEnd = addDays(weekStart, 7)

    const [today, week, approvals, highApprovals, overdue, overdueYesterday, conflicts, criticalConflicts, seats, weekLoad] =
      await Promise.all([
        countRange(supabase, ctx.workspaceId, dayStart, dayEnd),
        countRange(supabase, ctx.workspaceId, weekStart, weekEnd),
        supabase.from('approvals').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).eq('status', 'pending').then(r => r.count ?? 0),
        supabase.from('campaign_tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).eq('status', 'review')
          .in('priority', ['high', 'urgent']).then(r => r.count ?? 0),
        supabase.from('campaign_tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).neq('status', 'done')
          .lt('due_date', now.toISOString()).then(r => r.count ?? 0),
        supabase.from('campaign_tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).neq('status', 'done')
          .lt('due_date', addDays(now, -1).toISOString()).then(r => r.count ?? 0),
        supabase.from('calendar_conflicts').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).in('status', ['open', 'in_progress', 'reopened']).then(r => r.count ?? 0),
        supabase.from('calendar_conflicts').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).in('status', ['open', 'reopened'])
          .in('severity', ['critical', 'high']).then(r => r.count ?? 0),
        supabase.from('workspace_members').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).then(r => r.count ?? 0),
        supabase.from('campaign_tasks').select('id', { count: 'exact', head: true })
          .eq('workspace_id', ctx.workspaceId).neq('status', 'done')
          .gte('due_date', weekStart.toISOString()).lt('due_date', weekEnd.toISOString()).then(r => r.count ?? 0),
      ])

    const capacity = Math.max(seats, 1) * 10
    const load = capacity > 0 ? Math.min(100, Math.round((weekLoad / capacity) * 100)) : null

    return {
      todayItems: today,
      todayItemsDelta: null,
      thisWeek: week,
      thisWeekDelta: null,
      pendingApprovals: approvals,
      highPriorityApprovals: highApprovals,
      overdueTasks: overdue,
      overdueTasksDelta: percentDelta(overdue, overdueYesterday),
      openConflicts: conflicts,
      conflictsNeedingAttention: criticalConflicts,
      teamLoad: load,
      teamLoadLabel: load === null ? 'No data' : load < 60 ? 'Light' : load <= 85 ? 'Balanced' : 'Over capacity',
    }
  })
}

async function countRange(supabase: SupabaseClient, workspaceId: string, start: Date, end: Date) {
  const [posts, tasks, items] = await Promise.all([
    supabase.from('content_posts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).then(r => r.count ?? 0),
    supabase.from('campaign_tasks').select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('due_date', start.toISOString()).lt('due_date', end.toISOString()).then(r => r.count ?? 0),
    Promise.resolve(
      supabase.from('calendar_items').select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId).is('archived_at', null)
        .gte('start_at', start.toISOString()).lt('start_at', end.toISOString()),
    ).then(r => r.count ?? 0, () => 0),
  ])
  return posts + tasks + items
}

// ── Conflicts ───────────────────────────────────────────────────────────────

export interface ConflictFilterInput {
  search?: string | null
  severity?: string | null
  owner?: string | null
  assignee?: string | null
  channel?: string | null
  type?: string | null
  status?: string | null
  campaign?: string | null
  team?: string | null
  impact?: string | null
  page?: number
  pageSize?: number
}

export { CONFLICT_TYPE_LABELS } from './constants'

export async function fetchConflicts(
  session: CalendarSession,
  range: RangeInput,
  filters: ConflictFilterInput = {},
): Promise<Loaded<{ conflicts: CalendarConflict[]; total: number }>> {
  const { supabase, ctx } = session
  return safe<{ conflicts: CalendarConflict[]; total: number }>({ conflicts: [], total: 0 }, async () => {
    const [rows, links, profiles, campaigns] = await Promise.all([
      supabase.from('calendar_conflicts')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .gte('detected_at', range.startIso)
        .lte('detected_at', range.endIso)
        .order('severity')
        .order('detected_at', { ascending: false })
        .limit(1000),
      supabase.from('calendar_conflict_records')
        .select('conflict_id, record_kind, record_id, label')
        .eq('workspace_id', ctx.workspaceId).limit(4000),
      supabase.from('workspace_members')
        .select('user_id, profiles!workspace_members_user_id_fkey(id, full_name, email)')
        .eq('workspace_id', ctx.workspaceId),
      supabase.from('campaigns').select('id, name').eq('workspace_id', ctx.workspaceId),
    ])
    if (rows.error) throw rows.error

    const nameById = new Map<string, string>()
    for (const row of profiles.data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (p?.id) nameById.set(p.id as string, (p.full_name || p.email || 'Team member') as string)
    }
    const campaignById = new Map((campaigns.data ?? []).map(c => [c.id as string, c.name as string]))

    const linksByConflict = new Map<string, ConflictLinkedRecord[]>()
    for (const link of links.data ?? []) {
      const list = linksByConflict.get(link.conflict_id as string) ?? []
      list.push({
        kind: link.record_kind as ConflictLinkedRecord['kind'],
        id: link.record_id as string,
        label: (link.label as string) ?? 'Linked record',
        href: hrefForRecord(ctx.basePath, link.record_kind as string, link.record_id as string),
      })
      linksByConflict.set(link.conflict_id as string, list)
    }

    const all: CalendarConflict[] = (rows.data ?? []).map(row => ({
      id: row.id as string,
      reference: row.reference as string,
      type: row.conflict_type as ConflictType,
      severity: row.severity as CalendarConflict['severity'],
      impact: row.impact as CalendarConflict['impact'],
      title: row.title as string,
      description: (row.description as string) ?? null,
      status: row.status as CalendarConflict['status'],
      channels: (row.channels as string[]) ?? [],
      campaignId: (row.campaign_id as string) ?? null,
      campaignName: row.campaign_id ? campaignById.get(row.campaign_id as string) ?? null : null,
      detectedAt: row.detected_at as string,
      startAt: (row.start_at as string) ?? null,
      endAt: (row.end_at as string) ?? null,
      dueAt: (row.due_at as string) ?? null,
      ownerId: (row.owner_id as string) ?? null,
      ownerName: row.owner_id ? nameById.get(row.owner_id as string) ?? null : null,
      assigneeId: (row.assignee_id as string) ?? null,
      assigneeName: row.assignee_id ? nameById.get(row.assignee_id as string) ?? null : null,
      recommendations: (row.recommendations as ConflictRecommendation[]) ?? [],
      resolutionNotes: (row.resolution_notes as string) ?? null,
      resolvedAt: (row.resolved_at as string) ?? null,
      resolvedByName: row.resolved_by ? nameById.get(row.resolved_by as string) ?? null : null,
      linkedRecords: linksByConflict.get(row.id as string) ?? [],
    }))

    const filtered = applyConflictFilters(all, filters)
    const page = Math.max(1, filters.page ?? 1)
    const pageSize = Math.min(60, Math.max(6, filters.pageSize ?? 6))
    return { conflicts: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length }
  })
}

function hrefForRecord(basePath: string, kind: string, id: string): string | null {
  switch (kind) {
    case 'campaign': return `${basePath}/campaigns/detail-${id}`
    case 'content_post': return `${basePath}/studio/detail-${id}`
    case 'publishing_job': return `${basePath}/calendar/publishing-queue?selected=${id}`
    case 'calendar_item': return `${basePath}/calendar?selected=${id}`
    default: return null
  }
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

function applyConflictFilters(list: CalendarConflict[], f: ConflictFilterInput): CalendarConflict[] {
  const search = f.search?.trim().toLowerCase()
  return list.filter(c => {
    if (f.severity && f.severity !== 'all' && c.severity !== f.severity) return false
    if (f.owner && f.owner !== 'all' && c.ownerId !== f.owner) return false
    if (f.assignee && f.assignee !== 'all' && c.assigneeId !== f.assignee) return false
    if (f.channel && f.channel !== 'all' && !c.channels.includes(f.channel)) return false
    if (f.type && f.type !== 'all' && c.type !== f.type) return false
    if (f.campaign && f.campaign !== 'all' && c.campaignId !== f.campaign) return false
    if (f.impact && f.impact !== 'all' && c.impact !== f.impact) return false
    if (f.status && f.status !== 'all') {
      if (f.status === 'active' ? !['open', 'in_progress', 'reopened'].includes(c.status) : c.status !== f.status) return false
    } else if (!['open', 'in_progress', 'reopened'].includes(c.status)) {
      return false // default view shows active conflicts
    }
    if (search) {
      const hay = `${c.reference} ${c.title} ${c.description ?? ''} ${c.campaignName ?? ''} ${c.ownerName ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  }).sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || b.detectedAt.localeCompare(a.detectedAt))
}

export async function fetchConflictKpis(session: CalendarSession): Promise<Loaded<ConflictKpis>> {
  const { supabase, ctx } = session
  const empty: ConflictKpis = {
    open: 0, openDelta: null, highSeverity: 0, highSeverityDelta: null,
    capacityClashes: 0, capacityClashesDelta: null, approvalBlockers: 0, approvalBlockersDelta: null,
    overlappingLaunches: 0, overlappingLaunchesDelta: null, resolvedThisWeek: 0, resolvedThisWeekDelta: null,
  }
  return safe<ConflictKpis>(empty, async () => {
    const now = new Date()
    const sevenDaysAgo = addDays(now, -7).toISOString()
    const fourteenDaysAgo = addDays(now, -14).toISOString()
    const active = ['open', 'in_progress', 'reopened']

    const c = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0)
    const from = () => supabase.from('calendar_conflicts').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId)

    const [open, openPrev, high, highPrev, capacity, capacityPrev, approval, approvalPrev, launch, launchPrev, resolved, resolvedPrev] =
      await Promise.all([
        c(from().in('status', active)),
        c(from().in('status', active).lt('detected_at', sevenDaysAgo)),
        c(from().in('status', active).in('severity', ['critical', 'high'])),
        c(from().in('status', active).in('severity', ['critical', 'high']).lt('detected_at', sevenDaysAgo)),
        c(from().in('status', active).eq('conflict_type', 'capacity_clash')),
        c(from().in('status', active).eq('conflict_type', 'capacity_clash').lt('detected_at', sevenDaysAgo)),
        c(from().in('status', active).eq('conflict_type', 'approval_delay')),
        c(from().in('status', active).eq('conflict_type', 'approval_delay').lt('detected_at', sevenDaysAgo)),
        c(from().in('status', active).eq('conflict_type', 'launch_collision')),
        c(from().in('status', active).eq('conflict_type', 'launch_collision').lt('detected_at', sevenDaysAgo)),
        c(from().eq('status', 'resolved').gte('resolved_at', sevenDaysAgo)),
        c(from().eq('status', 'resolved').gte('resolved_at', fourteenDaysAgo).lt('resolved_at', sevenDaysAgo)),
      ])

    return {
      open, openDelta: percentDelta(open, openPrev),
      highSeverity: high, highSeverityDelta: percentDelta(high, highPrev),
      capacityClashes: capacity, capacityClashesDelta: percentDelta(capacity, capacityPrev),
      approvalBlockers: approval, approvalBlockersDelta: percentDelta(approval, approvalPrev),
      overlappingLaunches: launch, overlappingLaunchesDelta: percentDelta(launch, launchPrev),
      resolvedThisWeek: resolved, resolvedThisWeekDelta: percentDelta(resolved, resolvedPrev),
    }
  })
}

export async function fetchConflictAnalytics(
  session: CalendarSession, range: RangeInput,
): Promise<Loaded<{ breakdown: ConflictTypeBreakdown[]; heatmap: ConflictHeatmapCell[]; channels: string[]; buckets: string[] }>> {
  const { supabase, ctx } = session
  const empty = { breakdown: [] as ConflictTypeBreakdown[], heatmap: [] as ConflictHeatmapCell[], channels: [] as string[], buckets: [] as string[] }
  return safe(empty, async () => {
    const { data, error } = await supabase.from('calendar_conflicts')
      .select('conflict_type, severity, channels, start_at, detected_at')
      .eq('workspace_id', ctx.workspaceId)
      .in('status', ['open', 'in_progress', 'reopened'])
      .gte('detected_at', range.startIso).lte('detected_at', range.endIso)
      .limit(3000)
    if (error) throw error
    const rows = data ?? []

    const counts = new Map<ConflictType, number>()
    for (const row of rows) {
      const t = row.conflict_type as ConflictType
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    const total = rows.length
    const breakdown: ConflictTypeBreakdown[] = [...counts.entries()]
      .map(([type, count]) => ({ type, label: CONFLICT_TYPE_LABELS[type], count, share: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)

    // Heatmap: channel x week-of-month bucket for the requested range.
    const buckets = ['1–7', '8–14', '15–21', '22–28', '29–31']
    const channelSet = new Set<string>()
    const cellCounts = new Map<string, number>()
    for (const row of rows) {
      const when = (row.start_at ?? row.detected_at) as string
      const day = Number(zonedDateKey(when, ctx.timezone).slice(-2))
      const bucket = buckets[Math.min(4, Math.floor((day - 1) / 7))]
      const channels = ((row.channels as string[]) ?? []).length ? (row.channels as string[]) : ['unassigned']
      for (const channel of channels) {
        channelSet.add(channel)
        const key = `${channel}|${bucket}`
        cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1)
      }
    }
    const channels = [...channelSet].sort()
    const max = Math.max(1, ...cellCounts.values())
    const heatmap: ConflictHeatmapCell[] = []
    for (const channel of channels) {
      for (const bucket of buckets) {
        const count = cellCounts.get(`${channel}|${bucket}`) ?? 0
        heatmap.push({
          channel, bucket, count,
          weight: count === 0 ? 'none' : count / max > 0.66 ? 'high' : count / max > 0.33 ? 'medium' : 'low',
        })
      }
    }
    return { breakdown, heatmap, channels, buckets }
  })
}

export async function fetchConflictActivity(session: CalendarSession, limit = 5): Promise<Loaded<CalendarActivity[]>> {
  const { supabase, ctx } = session
  return safe<CalendarActivity[]>([], async () => {
    const [activity, profiles] = await Promise.all([
      supabase.from('calendar_conflict_activity')
        .select('id, conflict_id, actor_id, action, summary, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false }).limit(limit),
      supabase.from('workspace_members')
        .select('user_id, profiles!workspace_members_user_id_fkey(id, full_name, email)')
        .eq('workspace_id', ctx.workspaceId),
    ])
    if (activity.error) throw activity.error

    const nameById = new Map<string, string>()
    for (const row of profiles.data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (p?.id) nameById.set(p.id as string, (p.full_name || p.email || 'Team member') as string)
    }

    return (activity.data ?? []).map(row => ({
      id: row.id as string,
      action: row.action as string,
      summary: row.summary as string,
      detail: null,
      actorName: row.actor_id ? nameById.get(row.actor_id as string) ?? null : 'System',
      createdAt: row.created_at as string,
      href: `${ctx.basePath}/calendar/conflicts?selected=${row.conflict_id}`,
      tone: row.action === 'resolved' ? 'success' : row.action === 'reopened' ? 'warning' : 'info',
    }))
  })
}

// ── Activity feed ───────────────────────────────────────────────────────────

const ACTIVITY_TONE: Record<string, CalendarActivity['tone']> = {
  approved: 'success', published: 'success', resolved: 'success', completed: 'success',
  failed: 'danger', detected: 'warning', cancelled: 'warning',
  created: 'info', queued: 'info', updated: 'info', moved: 'info', rescheduled: 'info', scheduled: 'info',
}

/** Audit verbs are namespaced (`queue_approved`, `conflict_detected`), so match on the outcome word. */
function activityTone(verb: string): CalendarActivity['tone'] {
  const outcome = verb.split('_').pop() ?? verb
  return ACTIVITY_TONE[outcome] ?? 'neutral'
}

export async function fetchCalendarActivity(session: CalendarSession, limit = 5): Promise<Loaded<CalendarActivity[]>> {
  const { supabase, ctx } = session
  return safe<CalendarActivity[]>([], async () => {
    const [logs, profiles] = await Promise.all([
      supabase.from('audit_logs')
        .select('id, actor_id, action, resource_type, resource_id, metadata, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .like('action', 'calendar%')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase.from('workspace_members')
        .select('user_id, profiles!workspace_members_user_id_fkey(id, full_name, email)')
        .eq('workspace_id', ctx.workspaceId),
    ])
    if (logs.error) throw logs.error

    const nameById = new Map<string, string>()
    for (const row of profiles.data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (p?.id) nameById.set(p.id as string, (p.full_name || p.email || 'Team member') as string)
    }

    return (logs.data ?? []).map(row => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>
      const verb = String(row.action).replace(/^calendar\./, '')
      return {
        id: row.id as string,
        action: verb,
        summary: (meta.summary as string) ?? humaniseAction(verb, meta),
        detail: null,
        actorName: row.actor_id ? nameById.get(row.actor_id as string) ?? null : 'System',
        createdAt: row.created_at as string,
        href: hrefForRecord(ctx.basePath, String(row.resource_type ?? ''), String(row.resource_id ?? '')),
        tone: activityTone(verb),
      }
    })
  })
}

function humaniseAction(action: string, meta: Record<string, unknown>): string {
  const title = (meta.title as string) ?? 'Record'
  const map: Record<string, string> = {
    item_created: `${title} created`,
    item_updated: `${title} updated`,
    item_moved: `${title} rescheduled`,
    item_cancelled: `${title} cancelled`,
    queue_queued: `${title} queued for publishing`,
    queue_approved: `${title} approved`,
    queue_published: `${title} published`,
    queue_failed: `${title} failed to publish`,
    queue_retried: `${title} retried`,
    queue_cancelled: `${title} cancelled`,
    conflict_detected: `Conflict detected for ${title}`,
    conflict_assigned: `${title} assigned`,
    conflict_resolved: `${title} marked as resolved`,
    import_completed: 'Calendar import completed',
  }
  return map[action] ?? `${title} ${action.replace(/_/g, ' ')}`
}

// ── Small helper used by several panels ─────────────────────────────────────

/** Upcoming items with a real due time, used by "Next actions" / "Due soon". */
export function nextActions(entries: ScheduleEntry[], now = new Date(), limit = 5): ScheduleEntry[] {
  return entries
    .filter(e => new Date(e.startAt).getTime() >= now.getTime())
    .filter(e => e.status !== 'published' && e.status !== 'completed' && e.status !== 'cancelled')
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, limit)
}

export { overlaps }
