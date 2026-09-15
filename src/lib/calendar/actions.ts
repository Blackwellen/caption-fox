'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canAccessCalendarCapability, type CalendarCapability, type CalendarContext,
} from './entitlements'
import {
  resolveCalendarSession, fetchScheduleEntries, fetchQueueItems, MAX_PAGE_SIZE,
  type CalendarSession,
} from './queries'
import { detectConflicts, detectionWindow, persistDetectionRun } from './conflicts'
import { formValueToUtcIso } from './dates'
import { parseIcs, parseCsv } from './export'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  data?: T
}

const GENERIC_ERROR = 'We could not complete that action. Try again, or contact support with reference CAL-ACTION.'

/**
 * Every mutation goes through this guard: it re-resolves the session on the
 * server (never trusting a client-supplied workspace id), then re-checks the
 * capability. Hiding a button is not security.
 */
async function guard(
  basePath: string,
  capability: CalendarCapability,
): Promise<{ session: CalendarSession } | { error: string }> {
  const session = await resolveCalendarSession(basePath)
  if (!session) return { error: 'You do not have access to this workspace.' }
  if (!canAccessCalendarCapability(session.ctx, capability)) {
    return { error: 'You do not have permission to perform this action.' }
  }
  return { session }
}

/** Audit trail. Uses the real `audit_logs` column names and never throws. */
async function audit(
  supabase: SupabaseClient,
  ctx: CalendarContext,
  action: string,
  resource: { type: string; id: string | null },
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from('audit_logs').insert({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.userId,
      action: `calendar.${action}`,
      resource_type: resource.type,
      resource_id: resource.id,
      metadata: { ...metadata, source_route: `${ctx.basePath}/calendar` },
    })
  } catch {
    // Auditing must never break the primary action.
  }
}

function revalidateCalendar(ctx: CalendarContext) {
  revalidatePath(`${ctx.basePath}/calendar`)
  revalidatePath(`${ctx.basePath}/calendar/publishing-queue`)
  revalidatePath(`${ctx.basePath}/calendar/agenda`)
  revalidatePath(`${ctx.basePath}/calendar/conflicts`)
}

// ── Schedule items ──────────────────────────────────────────────────────────

export interface ScheduleItemInput {
  basePath: string
  id?: string
  itemType: string
  title: string
  description?: string
  startDate: string     // yyyy-MM-dd
  startTime?: string    // HH:mm
  endDate?: string
  endTime?: string
  allDay?: boolean
  timezone?: string
  status?: string
  priority?: string
  channel?: string
  campaignId?: string
  ownerId?: string
  team?: string
  location?: string
  meetingUrl?: string
  recurrenceRule?: string
  /** Client-generated key so a double submit cannot create two records. */
  requestId?: string
}

function validateScheduleItem(input: ScheduleItemInput, timezone: string) {
  const fieldErrors: Record<string, string> = {}
  if (!input.title?.trim()) fieldErrors.title = 'Give this item a title.'
  else if (input.title.trim().length > 180) fieldErrors.title = 'Keep the title under 180 characters.'
  if (!input.startDate) fieldErrors.startDate = 'Choose a start date.'

  const startIso = input.startDate
    ? formValueToUtcIso(input.allDay ? input.startDate : `${input.startDate}T${input.startTime || '09:00'}`, timezone)
    : null
  if (input.startDate && !startIso) fieldErrors.startDate = 'That start date is not valid.'

  let endIso: string | null = null
  if (input.endDate) {
    endIso = formValueToUtcIso(input.allDay ? input.endDate : `${input.endDate}T${input.endTime || input.startTime || '09:00'}`, timezone)
    if (!endIso) fieldErrors.endDate = 'That end date is not valid.'
    else if (startIso && new Date(endIso) < new Date(startIso)) {
      fieldErrors.endDate = 'The end must be after the start.'
    }
  }
  if (input.meetingUrl && !/^https?:\/\//i.test(input.meetingUrl)) {
    fieldErrors.meetingUrl = 'Enter a full URL beginning with https://'
  }
  return { fieldErrors, startIso, endIso }
}

export async function saveScheduleItem(input: ScheduleItemInput): Promise<ActionResult<{ id: string }>> {
  const capability: CalendarCapability = input.id ? 'calendar.edit' : 'calendar.create'
  const guarded = await guard(input.basePath, capability)
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  const timezone = input.timezone || ctx.timezone
  const { fieldErrors, startIso, endIso } = validateScheduleItem(input, timezone)
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, error: 'Check the highlighted fields.' }

  const payload = {
    workspace_id: ctx.workspaceId,
    item_type: input.itemType || 'event',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    start_at: startIso,
    end_at: endIso,
    all_day: !!input.allDay,
    timezone,
    status: input.status || 'scheduled',
    priority: input.priority || 'medium',
    channel: input.channel || null,
    campaign_id: input.campaignId || null,
    owner_id: input.ownerId || ctx.userId,
    team: input.team || null,
    location: input.location?.trim() || null,
    meeting_url: input.meetingUrl?.trim() || null,
    recurrence_rule: input.recurrenceRule || null,
    updated_by: ctx.userId,
  }

  try {
    if (input.id) {
      // Ownership re-checked in the WHERE clause as well as by RLS.
      const { data, error } = await supabase.from('calendar_items')
        .update(payload).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
        .select('id').single()
      if (error) throw error
      await audit(supabase, ctx, 'item_updated', { type: 'calendar_item', id: data.id }, { title: payload.title })
      revalidateCalendar(ctx)
      return { ok: true, data: { id: data.id } }
    }

    // Idempotency: a repeated submit with the same requestId returns the first record.
    const externalUid = input.requestId ? `req:${input.requestId}` : null
    if (externalUid) {
      const { data: existing } = await supabase.from('calendar_items')
        .select('id').eq('workspace_id', ctx.workspaceId).eq('external_uid', externalUid).maybeSingle()
      if (existing) return { ok: true, data: { id: existing.id } }
    }

    const { data, error } = await supabase.from('calendar_items')
      .insert({ ...payload, created_by: ctx.userId, source: 'manual', external_uid: externalUid })
      .select('id').single()
    if (error) throw error
    await audit(supabase, ctx, 'item_created', { type: 'calendar_item', id: data.id }, { title: payload.title })
    revalidateCalendar(ctx)
    return { ok: true, data: { id: data.id } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:saveScheduleItem]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

/** Drag-to-reschedule and the keyboard "move to…" alternative both land here. */
export async function rescheduleEntry(input: {
  basePath: string
  entryId: string            // "kind:recordId"
  startAt: string            // ISO
  endAt?: string | null
}): Promise<ActionResult<{ conflictsDetected: number }>> {
  const guarded = await guard(input.basePath, 'calendar.reschedule')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  const [kind, recordId] = input.entryId.split(':')
  if (!kind || !recordId) return { ok: false, error: 'That item cannot be moved.' }
  if (Number.isNaN(new Date(input.startAt).getTime())) return { ok: false, error: 'That date is not valid.' }
  if (input.endAt && new Date(input.endAt) < new Date(input.startAt)) {
    return { ok: false, error: 'The end must be after the start.' }
  }

  try {
    let previous: string | null = null
    if (kind === 'content') {
      const { data: before } = await supabase.from('content_posts')
        .select('scheduled_at, status').eq('id', recordId).eq('workspace_id', ctx.workspaceId).maybeSingle()
      if (!before) return { ok: false, error: 'That item no longer exists.' }
      if (before.status === 'published') return { ok: false, error: 'Published content cannot be rescheduled.' }
      previous = before.scheduled_at as string
      const { error } = await supabase.from('content_posts')
        .update({ scheduled_at: input.startAt }).eq('id', recordId).eq('workspace_id', ctx.workspaceId)
      if (error) throw error
      await supabase.from('publishing_queue')
        .update({ scheduled_at: input.startAt })
        .eq('post_id', recordId).eq('workspace_id', ctx.workspaceId)
        .not('status', 'in', '(published,sent,cancelled)')
    } else if (kind === 'item') {
      const { data: before } = await supabase.from('calendar_items')
        .select('start_at, status').eq('id', recordId).eq('workspace_id', ctx.workspaceId).maybeSingle()
      if (!before) return { ok: false, error: 'That item no longer exists.' }
      if (before.status === 'completed' || before.status === 'cancelled') {
        return { ok: false, error: 'Completed or cancelled items cannot be moved.' }
      }
      previous = before.start_at as string
      const { error } = await supabase.from('calendar_items')
        .update({ start_at: input.startAt, end_at: input.endAt ?? null, updated_by: ctx.userId })
        .eq('id', recordId).eq('workspace_id', ctx.workspaceId)
      if (error) throw error
    } else if (kind === 'task') {
      const { error } = await supabase.from('campaign_tasks')
        .update({ due_date: input.startAt }).eq('id', recordId).eq('workspace_id', ctx.workspaceId)
      if (error) throw error
    } else {
      return { ok: false, error: 'Campaign milestones are moved from the campaign record.' }
    }

    await audit(supabase, ctx, 'item_moved', { type: kind === 'content' ? 'content_post' : 'calendar_item', id: recordId },
      { from: previous, to: input.startAt })

    const detection = await runDetection(guarded.session)
    revalidateCalendar(ctx)
    return { ok: true, data: { conflictsDetected: detection.created } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:reschedule]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function archiveScheduleItem(input: { basePath: string; id: string }): Promise<ActionResult> {
  const guarded = await guard(input.basePath, 'calendar.delete')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  try {
    const { error } = await supabase.from('calendar_items')
      .update({ archived_at: new Date().toISOString(), status: 'cancelled', updated_by: ctx.userId })
      .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (error) throw error
    await audit(supabase, ctx, 'item_cancelled', { type: 'calendar_item', id: input.id })
    revalidateCalendar(ctx)
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ── Publishing queue ────────────────────────────────────────────────────────

export async function queueContent(input: {
  basePath: string
  postId: string
  channelId?: string
  campaignId?: string
  scheduledDate: string
  scheduledTime: string
  priority?: string
  requiresApproval?: boolean
  requestId?: string
}): Promise<ActionResult<{ id: string }>> {
  const guarded = await guard(input.basePath, 'queue.create')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  const scheduledAt = formValueToUtcIso(`${input.scheduledDate}T${input.scheduledTime}`, ctx.timezone)
  if (!scheduledAt) return { ok: false, fieldErrors: { scheduledDate: 'Choose a valid date and time.' }, error: 'Check the highlighted fields.' }

  try {
    // The post must belong to this workspace — checked explicitly, not just by RLS.
    const { data: post } = await supabase.from('content_posts')
      .select('id, title').eq('id', input.postId).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!post) return { ok: false, error: 'That content item is not available in this workspace.' }

    if (input.channelId) {
      const { data: channel } = await supabase.from('social_channels')
        .select('id').eq('id', input.channelId).eq('workspace_id', ctx.workspaceId).maybeSingle()
      if (!channel) return { ok: false, error: 'That channel is not available in this workspace.' }
    }

    const idempotencyKey = input.requestId ?? randomUUID()
    const { data: existing } = await supabase.from('publishing_queue')
      .select('id').eq('workspace_id', ctx.workspaceId).eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing) return { ok: true, data: { id: existing.id } }

    const { data, error } = await supabase.from('publishing_queue').insert({
      workspace_id: ctx.workspaceId,
      post_id: input.postId,
      channel_id: input.channelId ?? null,
      provider_account_id: input.channelId ?? null,
      campaign_id: input.campaignId ?? null,
      owner_id: ctx.userId,
      created_by: ctx.userId,
      scheduled_at: scheduledAt,
      sla_due_at: scheduledAt,
      status: input.requiresApproval ? 'draft' : 'queued',
      approval_status: input.requiresApproval ? 'awaiting_approval' : 'not_required',
      priority: input.priority ?? 'medium',
      idempotency_key: idempotencyKey,
    }).select('id').single()
    if (error) throw error

    await audit(supabase, ctx, 'queue_queued', { type: 'publishing_job', id: data.id }, { title: post.title })
    revalidateCalendar(ctx)
    return { ok: true, data: { id: data.id } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:queueContent]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

async function loadOwnedQueueItems(supabase: SupabaseClient, ctx: CalendarContext, ids: string[]) {
  const { data, error } = await supabase.from('publishing_queue')
    .select('id, status, approval_status, post_id, channel_id, provider_account_id, scheduled_at, attempt_count, content_posts(title)')
    .eq('workspace_id', ctx.workspaceId).in('id', ids)
  if (error) throw error
  return data ?? []
}

function titleOf(row: { content_posts?: unknown }) {
  const post = Array.isArray(row.content_posts) ? row.content_posts[0] : row.content_posts
  return (post as { title?: string } | null)?.title ?? 'Queue item'
}

export async function setApprovalState(input: {
  basePath: string
  ids: string[]
  state: 'approved' | 'changes_requested' | 'rejected' | 'awaiting_approval'
  note?: string
}): Promise<ActionResult<{ updated: number; skipped: number }>> {
  const guarded = await guard(input.basePath, 'queue.approve')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  if (!input.ids.length) return { ok: false, error: 'Select at least one item.' }

  try {
    const rows = await loadOwnedQueueItems(supabase, ctx, input.ids)
    // A mixed bulk selection is validated per record, not assumed.
    const eligible = rows.filter(r => !['published', 'sent', 'cancelled'].includes(r.status as string))
    if (!eligible.length) return { ok: false, error: 'None of the selected items can change approval state.' }

    const { error } = await supabase.from('publishing_queue')
      .update({
        approval_status: input.state,
        status: input.state === 'approved' ? 'ready' : 'draft',
      })
      .eq('workspace_id', ctx.workspaceId)
      .in('id', eligible.map(r => r.id as string))
    if (error) throw error

    for (const row of eligible) {
      await audit(supabase, ctx, input.state === 'approved' ? 'queue_approved' : 'queue_changes_requested',
        { type: 'publishing_job', id: row.id as string },
        { title: titleOf(row), note: input.note?.slice(0, 500) })
    }
    revalidateCalendar(ctx)
    return { ok: true, data: { updated: eligible.length, skipped: rows.length - eligible.length } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:setApprovalState]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

/**
 * Hands eligible items to the publishing worker. No external network call is
 * made from here — the job is marked `processing` and the worker performs the
 * provider request, so a browser component never touches a provider API and a
 * success is never fabricated.
 */
export async function publishNow(input: {
  basePath: string
  ids: string[]
}): Promise<ActionResult<{ queued: number; blocked: { id: string; reason: string }[] }>> {
  const capability: CalendarCapability = input.ids.length > 1 ? 'queue.bulkPublish' : 'queue.publish'
  const guarded = await guard(input.basePath, capability)
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  if (!input.ids.length) return { ok: false, error: 'Select at least one item.' }

  try {
    const rows = await loadOwnedQueueItems(supabase, ctx, input.ids)
    const channelIds = [...new Set(rows.map(r => (r.provider_account_id ?? r.channel_id) as string).filter(Boolean))]
    const { data: channels } = channelIds.length
      ? await supabase.from('social_channels')
          .select('id, is_active, token_expires_at, account_name, platform')
          .eq('workspace_id', ctx.workspaceId).in('id', channelIds)
      : { data: [] }
    const channelById = new Map((channels ?? []).map(c => [c.id as string, c]))

    const blocked: { id: string; reason: string }[] = []
    const eligible: string[] = []

    for (const row of rows) {
      const id = row.id as string
      if (['published', 'sent'].includes(row.status as string)) { blocked.push({ id, reason: 'Already published' }); continue }
      if (row.status === 'cancelled') { blocked.push({ id, reason: 'Cancelled' }); continue }
      if (row.approval_status === 'awaiting_approval' || row.approval_status === 'changes_requested') {
        blocked.push({ id, reason: 'Awaiting approval' }); continue
      }
      const channelId = (row.provider_account_id ?? row.channel_id) as string | null
      if (!channelId) { blocked.push({ id, reason: 'No channel connected' }); continue }
      const channel = channelById.get(channelId)
      if (!channel?.is_active) { blocked.push({ id, reason: 'Channel disconnected — reconnect it in Settings › Channels' }); continue }
      if (channel.token_expires_at && new Date(channel.token_expires_at as string).getTime() < Date.now()) {
        blocked.push({ id, reason: 'Channel access expired — reconnect it in Settings › Channels' }); continue
      }
      eligible.push(id)
    }

    if (eligible.length) {
      const { error } = await supabase.from('publishing_queue')
        .update({ status: 'processing', last_attempt_at: new Date().toISOString() })
        .eq('workspace_id', ctx.workspaceId)
        .in('id', eligible)
        // Guard against a concurrent worker having already taken the job.
        .not('status', 'in', '(published,sent,cancelled,processing)')
      if (error) throw error

      for (const id of eligible) {
        await audit(supabase, ctx, 'queue_publish_requested', { type: 'publishing_job', id })
      }
    }

    revalidateCalendar(ctx)
    return { ok: true, data: { queued: eligible.length, blocked } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:publishNow]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function retryQueueItem(input: { basePath: string; id: string }): Promise<ActionResult> {
  const guarded = await guard(input.basePath, 'queue.retry')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  try {
    const { data: row } = await supabase.from('publishing_queue')
      .select('id, status, attempt_count').eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!row) return { ok: false, error: 'That item no longer exists.' }
    if (row.status !== 'failed') return { ok: false, error: 'Only failed items can be retried.' }
    if ((row.attempt_count as number) >= 5) {
      return { ok: false, error: 'This item has reached the retry limit. Edit it and queue it again.' }
    }
    const { error } = await supabase.from('publishing_queue').update({
      status: 'queued',
      failure_code: null,
      error_message: null,
      next_retry_at: null,
    }).eq('id', input.id).eq('workspace_id', ctx.workspaceId).eq('status', 'failed')
    if (error) throw error
    await audit(supabase, ctx, 'queue_retried', { type: 'publishing_job', id: input.id })
    revalidateCalendar(ctx)
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function cancelQueueItems(input: { basePath: string; ids: string[] }): Promise<ActionResult<{ cancelled: number }>> {
  const guarded = await guard(input.basePath, 'queue.cancel')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  if (!input.ids.length) return { ok: false, error: 'Select at least one item.' }
  try {
    const { data, error } = await supabase.from('publishing_queue')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId).in('id', input.ids)
      .not('status', 'in', '(published,sent)')
      .select('id')
    if (error) throw error
    for (const row of data ?? []) await audit(supabase, ctx, 'queue_cancelled', { type: 'publishing_job', id: row.id as string })
    revalidateCalendar(ctx)
    return { ok: true, data: { cancelled: (data ?? []).length } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function rescheduleQueueItems(input: {
  basePath: string
  ids: string[]
  date: string
  time: string
}): Promise<ActionResult<{ updated: number }>> {
  const guarded = await guard(input.basePath, 'queue.edit')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  const scheduledAt = formValueToUtcIso(`${input.date}T${input.time}`, ctx.timezone)
  if (!scheduledAt) return { ok: false, fieldErrors: { date: 'Choose a valid date and time.' } }
  try {
    const { data, error } = await supabase.from('publishing_queue')
      .update({ scheduled_at: scheduledAt, sla_due_at: scheduledAt })
      .eq('workspace_id', ctx.workspaceId).in('id', input.ids)
      .not('status', 'in', '(published,sent,cancelled)')
      .select('id')
    if (error) throw error
    for (const row of data ?? []) {
      await audit(supabase, ctx, 'queue_rescheduled', { type: 'publishing_job', id: row.id as string }, { to: scheduledAt })
    }
    await runDetection(guarded.session)
    revalidateCalendar(ctx)
    return { ok: true, data: { updated: (data ?? []).length } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

export async function setQueuePriority(input: {
  basePath: string; ids: string[]; priority: 'low' | 'medium' | 'high' | 'urgent'
}): Promise<ActionResult<{ updated: number }>> {
  const guarded = await guard(input.basePath, 'queue.edit')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  try {
    const { data, error } = await supabase.from('publishing_queue')
      .update({ priority: input.priority })
      .eq('workspace_id', ctx.workspaceId).in('id', input.ids).select('id')
    if (error) throw error
    revalidateCalendar(ctx)
    return { ok: true, data: { updated: (data ?? []).length } }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ── Conflicts ───────────────────────────────────────────────────────────────

async function runDetection(session: CalendarSession) {
  const { supabase, ctx } = session
  const window = detectionWindow(ctx)
  const [entries, queue, campaigns] = await Promise.all([
    fetchScheduleEntries(session, window),
    fetchQueueItems(session, window, { pageSize: MAX_PAGE_SIZE }),
    supabase.from('campaigns').select('id, name, start_date, end_date, status').eq('workspace_id', ctx.workspaceId),
  ])
  if (entries.error || queue.error) return { created: 0, updated: 0, autoResolved: 0 }

  const detected = detectConflicts({
    entries: entries.data,
    queue: queue.data.items.map(i => ({
      id: i.id, title: i.title, scheduledAt: i.scheduledAt,
      approvalStatus: i.approvalStatus, channel: i.channel,
      campaignId: i.campaignId, ownerId: i.ownerId,
    })),
    campaigns: (campaigns.data ?? []) as never,
    ctx,
  })

  try {
    return await persistDetectionRun(supabase, ctx, detected, window)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:detection]', err)
    return { created: 0, updated: 0, autoResolved: 0 }
  }
}

export async function detectConflictsNow(input: { basePath: string }): Promise<ActionResult<{ created: number; autoResolved: number }>> {
  const guarded = await guard(input.basePath, 'calendar.conflicts')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const result = await runDetection(guarded.session)
  revalidateCalendar(guarded.session.ctx)
  return { ok: true, data: { created: result.created, autoResolved: result.autoResolved } }
}

async function conflictActivity(
  supabase: SupabaseClient, ctx: CalendarContext,
  conflictId: string, action: string, summary: string,
  from?: string | null, to?: string | null,
) {
  try {
    await supabase.from('calendar_conflict_activity').insert({
      conflict_id: conflictId, workspace_id: ctx.workspaceId, actor_id: ctx.userId,
      action, summary, from_value: from ?? null, to_value: to ?? null,
    })
  } catch { /* activity must not break the action */ }
}

export async function updateConflict(input: {
  basePath: string
  id: string
  assigneeId?: string | null
  dueDate?: string | null
  status?: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'reopened'
  resolutionNotes?: string
}): Promise<ActionResult> {
  const capability: CalendarCapability =
    input.status === 'resolved' ? 'conflicts.resolve'
    : input.status === 'dismissed' ? 'conflicts.dismiss'
    : input.status === 'reopened' ? 'conflicts.reopen'
    : 'conflicts.assign'
  const guarded = await guard(input.basePath, capability)
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  try {
    const { data: before } = await supabase.from('calendar_conflicts')
      .select('id, reference, title, status, assignee_id, due_at')
      .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!before) return { ok: false, error: 'That conflict no longer exists.' }
    if (before.status === 'resolved' && input.status && input.status !== 'reopened') {
      return { ok: false, error: 'This conflict is already resolved. Reopen it first to make changes.' }
    }
    if ((input.status === 'resolved' || input.status === 'dismissed') && !input.resolutionNotes?.trim()) {
      return { ok: false, fieldErrors: { resolutionNotes: 'Add a short note explaining the resolution.' } }
    }

    const patch: Record<string, unknown> = {}
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) {
        const { data: member } = await supabase.from('workspace_members')
          .select('user_id').eq('workspace_id', ctx.workspaceId).eq('user_id', input.assigneeId).maybeSingle()
        if (!member) return { ok: false, error: 'That person is not a member of this workspace.' }
      }
      patch.assignee_id = input.assigneeId || null
    }
    if (input.dueDate !== undefined) {
      patch.due_at = input.dueDate ? formValueToUtcIso(input.dueDate, ctx.timezone) : null
      if (input.dueDate && !patch.due_at) return { ok: false, fieldErrors: { dueDate: 'Choose a valid date.' } }
    }
    if (input.status) {
      patch.status = input.status
      if (input.status === 'resolved') {
        patch.resolved_at = new Date().toISOString()
        patch.resolved_by = ctx.userId
      } else if (input.status === 'reopened') {
        patch.resolved_at = null
        patch.resolved_by = null
      }
    }
    if (input.resolutionNotes !== undefined) patch.resolution_notes = input.resolutionNotes.slice(0, 2000)
    if (!Object.keys(patch).length) return { ok: true }

    const { error } = await supabase.from('calendar_conflicts')
      .update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (error) throw error

    if (input.status) {
      await conflictActivity(supabase, ctx, input.id, input.status,
        `${before.reference} ${input.status === 'resolved' ? 'marked as resolved' : input.status.replace('_', ' ')}`,
        before.status as string, input.status)
    }
    if (input.assigneeId !== undefined) {
      await conflictActivity(supabase, ctx, input.id, 'assigned', `${before.reference} assignee updated`)
    }
    await audit(supabase, ctx, `conflict_${input.status ?? 'updated'}`, { type: 'calendar_conflict', id: input.id },
      { title: before.title, reference: before.reference })

    revalidateCalendar(ctx)
    return { ok: true }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:updateConflict]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

/**
 * Applies a recommended action from the resolution panel. Each branch performs a
 * real state change; nothing is hidden client-side.
 */
export async function applyConflictRecommendation(input: {
  basePath: string
  conflictId: string
  action: 'reschedule' | 'reassign' | 'extend_deadline' | 'cancel_duplicate' | 'space_posts'
  targetRecordId?: string
  newStartAt?: string
  newOwnerId?: string
}): Promise<ActionResult> {
  const guarded = await guard(input.basePath, 'conflicts.resolve')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  try {
    const { data: links } = await supabase.from('calendar_conflict_records')
      .select('record_kind, record_id').eq('conflict_id', input.conflictId).eq('workspace_id', ctx.workspaceId)
    const target = (links ?? []).find(l => !input.targetRecordId || l.record_id === input.targetRecordId)
    if (!target) return { ok: false, error: 'No linked record to act on.' }

    switch (input.action) {
      case 'reschedule':
      case 'space_posts': {
        if (!input.newStartAt) return { ok: false, error: 'Choose a new time first.' }
        const kind = target.record_kind === 'content_post' ? 'content'
          : target.record_kind === 'calendar_item' ? 'item'
          : target.record_kind === 'task' ? 'task' : null
        if (!kind) return { ok: false, error: 'That record type cannot be rescheduled here.' }
        const moved = await rescheduleEntry({
          basePath: input.basePath,
          entryId: `${kind}:${target.record_id}`,
          startAt: input.newStartAt,
        })
        if (!moved.ok) return { ok: false, error: moved.error, fieldErrors: moved.fieldErrors }
        break
      }
      case 'reassign': {
        if (!input.newOwnerId) return { ok: false, error: 'Choose a new owner first.' }
        const { data: member } = await supabase.from('workspace_members')
          .select('user_id').eq('workspace_id', ctx.workspaceId).eq('user_id', input.newOwnerId).maybeSingle()
        if (!member) return { ok: false, error: 'That person is not a member of this workspace.' }
        if (target.record_kind === 'calendar_item') {
          await supabase.from('calendar_items').update({ owner_id: input.newOwnerId })
            .eq('id', target.record_id).eq('workspace_id', ctx.workspaceId)
        } else if (target.record_kind === 'task') {
          await supabase.from('campaign_tasks').update({ assigned_to: input.newOwnerId })
            .eq('id', target.record_id).eq('workspace_id', ctx.workspaceId)
        } else if (target.record_kind === 'publishing_job') {
          await supabase.from('publishing_queue').update({ owner_id: input.newOwnerId })
            .eq('id', target.record_id).eq('workspace_id', ctx.workspaceId)
        } else {
          return { ok: false, error: 'That record type cannot be reassigned here.' }
        }
        break
      }
      case 'extend_deadline': {
        if (!input.newStartAt) return { ok: false, error: 'Choose a new deadline first.' }
        await supabase.from('calendar_conflicts')
          .update({ due_at: input.newStartAt }).eq('id', input.conflictId).eq('workspace_id', ctx.workspaceId)
        break
      }
      case 'cancel_duplicate': {
        if (target.record_kind === 'publishing_job') {
          const cancelled = await cancelQueueItems({ basePath: input.basePath, ids: [target.record_id as string] })
          if (!cancelled.ok) return { ok: false, error: cancelled.error }
        } else if (target.record_kind === 'calendar_item') {
          const archived = await archiveScheduleItem({ basePath: input.basePath, id: target.record_id as string })
          if (!archived.ok) return archived
        } else {
          return { ok: false, error: 'That record type cannot be cancelled here.' }
        }
        break
      }
    }

    await conflictActivity(supabase, ctx, input.conflictId, 'recommendation_applied',
      `Applied recommended action: ${input.action.replace(/_/g, ' ')}`)
    await runDetection(guarded.session)
    revalidateCalendar(ctx)
    return { ok: true }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:applyRecommendation]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ── Import ──────────────────────────────────────────────────────────────────

export interface ImportPreviewRow {
  index: number
  title: string
  startAt: string | null
  endAt: string | null
  allDay: boolean
  itemType: string
  duplicate: boolean
  error: string | null
}

const MAX_IMPORT_BYTES = 2 * 1024 * 1024
const MAX_IMPORT_ROWS = 500

export async function previewCalendarImport(input: {
  basePath: string
  filename: string
  content: string
  timezone?: string
}): Promise<ActionResult<{ rows: ImportPreviewRow[]; validCount: number; invalidCount: number; duplicateCount: number }>> {
  const guarded = await guard(input.basePath, 'calendar.import')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  if (Buffer.byteLength(input.content, 'utf8') > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'That file is larger than the 2 MB import limit.' }
  }
  const extension = input.filename.toLowerCase().split('.').pop()
  if (extension !== 'ics' && extension !== 'csv') {
    return { ok: false, error: 'Import accepts .ics and .csv files.' }
  }

  const timezone = input.timezone || ctx.timezone
  const rows: ImportPreviewRow[] = []

  if (extension === 'ics') {
    const parsed = parseIcs(input.content)
    for (const invalid of parsed.invalidRows) {
      rows.push({ index: invalid.line, title: '—', startAt: null, endAt: null, allDay: false, itemType: 'event', duplicate: false, error: invalid.reason })
    }
    parsed.events.slice(0, MAX_IMPORT_ROWS).forEach((event, i) => {
      const startAt = event.startAt.endsWith('Z') ? event.startAt : formValueToUtcIso(event.startAt.slice(0, 16), timezone)
      rows.push({
        index: i + 1, title: event.title,
        startAt,
        endAt: event.endAt && event.endAt.endsWith('Z')
          ? event.endAt
          : event.endAt ? formValueToUtcIso(event.endAt.slice(0, 16), timezone) : null,
        allDay: event.allDay, itemType: 'event', duplicate: false,
        error: startAt ? null : 'Unreadable start date',
      })
    })
  } else {
    const parsed = parseCsv(input.content)
    if (!parsed.headers.includes('Title') || !parsed.headers.includes('Start')) {
      return { ok: false, error: 'The CSV needs at least "Title" and "Start" columns. Download the template to see the expected format.' }
    }
    parsed.rows.slice(0, MAX_IMPORT_ROWS).forEach(row => {
      const allDay = /^y|^true/i.test(row.values['All day'] ?? '')
      const raw = (row.values.Start ?? '').replace(' ', 'T')
      const startAt = formValueToUtcIso(allDay ? raw.slice(0, 10) : raw.slice(0, 16), timezone)
      const endRaw = (row.values.End ?? '').replace(' ', 'T')
      rows.push({
        index: row.index,
        title: row.values.Title || '—',
        startAt,
        endAt: endRaw ? formValueToUtcIso(endRaw.slice(0, 16), timezone) : null,
        allDay,
        itemType: row.values.Type || 'event',
        duplicate: false,
        error: !row.values.Title ? 'Missing title' : !startAt ? 'Unreadable start date' : null,
      })
    })
  }

  // Duplicate detection against records already in this workspace.
  const candidates = rows.filter(r => r.startAt && !r.error)
  if (candidates.length) {
    const starts = candidates.map(r => r.startAt as string)
    const { data: existing } = await supabase.from('calendar_items')
      .select('title, start_at').eq('workspace_id', ctx.workspaceId).in('start_at', starts)
    const seen = new Set((existing ?? []).map(e => `${(e.title as string).toLowerCase()}|${e.start_at}`))
    for (const row of candidates) {
      if (seen.has(`${row.title.toLowerCase()}|${row.startAt}`)) row.duplicate = true
    }
  }

  return {
    ok: true,
    data: {
      rows,
      validCount: rows.filter(r => !r.error && !r.duplicate).length,
      invalidCount: rows.filter(r => r.error).length,
      duplicateCount: rows.filter(r => r.duplicate).length,
    },
  }
}

export async function commitCalendarImport(input: {
  basePath: string
  rows: { title: string; startAt: string; endAt: string | null; allDay: boolean; itemType: string }[]
  timezone?: string
}): Promise<ActionResult<{ imported: number }>> {
  const guarded = await guard(input.basePath, 'calendar.import')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session
  const valid = input.rows.filter(r => r.title?.trim() && r.startAt && !Number.isNaN(new Date(r.startAt).getTime()))
  if (!valid.length) return { ok: false, error: 'There is nothing valid to import.' }
  if (valid.length > MAX_IMPORT_ROWS) return { ok: false, error: `Import is limited to ${MAX_IMPORT_ROWS} rows per file.` }

  try {
    // workspace_id is always the server-resolved workspace — never taken from the file.
    const { data, error } = await supabase.from('calendar_items').insert(
      valid.map(row => ({
        workspace_id: ctx.workspaceId,
        item_type: ['event', 'meeting', 'reminder', 'milestone', 'launch', 'review'].includes(row.itemType) ? row.itemType : 'event',
        title: row.title.trim().slice(0, 180),
        start_at: row.startAt,
        end_at: row.endAt,
        all_day: row.allDay,
        timezone: input.timezone || ctx.timezone,
        status: 'scheduled',
        source: 'import',
        created_by: ctx.userId,
        owner_id: ctx.userId,
      })),
    ).select('id')
    if (error) throw error
    await audit(supabase, ctx, 'import_completed', { type: 'calendar_item', id: null }, { imported: (data ?? []).length })
    await runDetection(guarded.session)
    revalidateCalendar(ctx)
    return { ok: true, data: { imported: (data ?? []).length } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:import]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ── Tasks (Agenda "Create task") ────────────────────────────────────────────

export async function createAgendaTask(input: {
  basePath: string
  title: string
  description?: string
  campaignId: string
  dueDate: string
  dueTime?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo?: string
  requestId?: string
}): Promise<ActionResult<{ id: string }>> {
  const guarded = await guard(input.basePath, 'agenda.create')
  if ('error' in guarded) return { ok: false, error: guarded.error }
  const { supabase, ctx } = guarded.session

  const fieldErrors: Record<string, string> = {}
  if (!input.title?.trim()) fieldErrors.title = 'Give this task a title.'
  if (!input.campaignId) fieldErrors.campaignId = 'Tasks belong to a campaign — choose one.'
  if (!input.dueDate) fieldErrors.dueDate = 'Choose a due date.'
  const dueIso = input.dueDate ? formValueToUtcIso(`${input.dueDate}T${input.dueTime || '17:00'}`, ctx.timezone) : null
  if (input.dueDate && !dueIso) fieldErrors.dueDate = 'That due date is not valid.'
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, error: 'Check the highlighted fields.' }

  try {
    // The campaign must belong to this workspace — a client cannot attach a task
    // to someone else's campaign by editing the payload.
    const { data: campaign } = await supabase.from('campaigns')
      .select('id').eq('id', input.campaignId).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!campaign) return { ok: false, error: 'That campaign is not available in this workspace.' }

    if (input.assignedTo) {
      const { data: member } = await supabase.from('workspace_members')
        .select('user_id').eq('workspace_id', ctx.workspaceId).eq('user_id', input.assignedTo).maybeSingle()
      if (!member) return { ok: false, error: 'That person is not a member of this workspace.' }
    }

    // Idempotency: a repeated submit finds the identical task rather than duplicating.
    if (input.requestId) {
      const { data: existing } = await supabase.from('campaign_tasks')
        .select('id').eq('workspace_id', ctx.workspaceId).eq('campaign_id', input.campaignId)
        .eq('title', input.title.trim()).eq('due_date', dueIso).maybeSingle()
      if (existing) return { ok: true, data: { id: existing.id } }
    }

    const { data, error } = await supabase.from('campaign_tasks').insert({
      workspace_id: ctx.workspaceId,
      campaign_id: input.campaignId,
      title: input.title.trim().slice(0, 180),
      description: input.description?.trim() || null,
      status: 'todo',
      priority: input.priority ?? 'medium',
      due_date: dueIso,
      assigned_to: input.assignedTo || ctx.userId,
      created_by: ctx.userId,
    }).select('id').single()
    if (error) throw error

    await audit(supabase, ctx, 'task_created', { type: 'task', id: data.id }, { title: input.title.trim() })
    revalidateCalendar(ctx)
    revalidatePath(`${ctx.basePath}/campaigns`)
    return { ok: true, data: { id: data.id } }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('[calendar:createAgendaTask]', err)
    return { ok: false, error: GENERIC_ERROR }
  }
}
