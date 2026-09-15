import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarContext } from './entitlements'
import { addDays, formatTime, overlaps, startOfDayUtc, zonedDateKey } from './dates'
import { CHANNEL_LABELS } from './queries'
import type {
  CalendarConflict, ConflictRecommendation, ConflictSeverity, ConflictType, ScheduleEntry,
} from './types'

/**
 * Conflict detection engine.
 *
 * Detection is deterministic and runs server-side only — never in a client
 * render loop. Each detected condition produces a stable `signature`, so a
 * re-run updates the existing row instead of duplicating it, and a condition
 * that has disappeared is auto-resolved.
 */

export const DETECTOR_VERSION = 1

/** Minimum gap between two posts on the same channel before it reads as spam. */
const MIN_CHANNEL_SPACING_MINUTES = 120
/** Posts per channel per day above which the channel is saturated. */
const CHANNEL_SATURATION_PER_DAY = 4
/** Deliverables one person can realistically own on a single day. */
const OWNER_DAILY_CAPACITY = 5

export interface DetectedConflict {
  signature: string
  type: ConflictType
  severity: ConflictSeverity
  impact: 'high' | 'medium' | 'low'
  title: string
  description: string
  channels: string[]
  campaignId: string | null
  startAt: string | null
  endAt: string | null
  dueAt: string | null
  ownerId: string | null
  recommendations: ConflictRecommendation[]
  records: { kind: 'campaign' | 'content_post' | 'calendar_item' | 'publishing_job' | 'task' | 'approval' | 'profile'; id: string; label: string }[]
}

function signature(type: ConflictType, parts: (string | null | undefined)[]): string {
  const body = [type, ...parts.filter(Boolean).sort()].join('|')
  return createHash('sha1').update(body).digest('hex').slice(0, 32)
}

function recordKindFor(entry: ScheduleEntry): DetectedConflict['records'][number]['kind'] {
  switch (entry.kind) {
    case 'content': return 'content_post'
    case 'campaign': return 'campaign'
    case 'task': return 'task'
    case 'publishing': return 'publishing_job'
    case 'approval': return 'approval'
    default: return 'calendar_item'
  }
}

function rec(label: string, action: ConflictRecommendation['action'] = null, advisory = false): ConflictRecommendation {
  return { id: createHash('sha1').update(label).digest('hex').slice(0, 12), label, action, advisory }
}

/**
 * Severity is calculated, never a constant. It weighs delivery impact, how soon
 * the clash lands, how many records it touches, and whether publishing will
 * actually fail.
 */
export function calculateSeverity(input: {
  type: ConflictType
  startAt: string | null
  affectedCount: number
  blocksDelivery: boolean
  campaignPriority?: 'low' | 'medium' | 'high' | 'urgent'
  autoResolvable?: boolean
}): ConflictSeverity {
  let score = 0
  if (input.blocksDelivery) score += 4
  if (input.type === 'duplicate_slot' || input.type === 'launch_collision') score += 2
  if (input.type === 'approval_delay' || input.type === 'blocked_dependency') score += 2
  if (input.type === 'channel_saturation' || input.type === 'capacity_clash') score += 1
  if (input.type === 'date_invalid') score += 3

  if (input.startAt) {
    const hours = (new Date(input.startAt).getTime() - Date.now()) / 3600_000
    if (hours < 0) score += 3
    else if (hours < 24) score += 2
    else if (hours < 72) score += 1
  }
  if (input.affectedCount >= 5) score += 2
  else if (input.affectedCount >= 3) score += 1

  if (input.campaignPriority === 'urgent') score += 2
  else if (input.campaignPriority === 'high') score += 1
  if (input.autoResolvable) score -= 1

  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  if (score >= 1) return 'low'
  return 'info'
}

// ── Individual checks ───────────────────────────────────────────────────────

/** 15.1 Time overlap — same owner double-booked. */
function detectOwnerOverlaps(entries: ScheduleEntry[], ctx: CalendarContext): DetectedConflict[] {
  const byOwner = new Map<string, ScheduleEntry[]>()
  for (const entry of entries) {
    if (!entry.ownerId || entry.allDay) continue
    const list = byOwner.get(entry.ownerId) ?? []
    list.push(entry)
    byOwner.set(entry.ownerId, list)
  }

  const found: DetectedConflict[] = []
  for (const [ownerId, list] of byOwner) {
    const sorted = [...list].sort((a, b) => a.startAt.localeCompare(b.startAt))
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j]
        const aEnd = a.endAt ?? new Date(new Date(a.startAt).getTime() + 30 * 60000).toISOString()
        if (new Date(b.startAt).getTime() >= new Date(aEnd).getTime()) break
        if (!overlaps(a.startAt, aEnd, b.startAt, b.endAt)) continue
        found.push({
          signature: signature('overlap_collision', [ownerId, a.id, b.id]),
          type: 'overlap_collision',
          severity: calculateSeverity({ type: 'overlap_collision', startAt: a.startAt, affectedCount: 2, blocksDelivery: false }),
          impact: 'medium',
          title: `${a.ownerName ?? 'Owner'} double-booked`,
          description: `"${a.title}" and "${b.title}" overlap at ${formatTime(a.startAt, ctx.timezone, ctx.locale)}.`,
          channels: [a.channel, b.channel].filter(Boolean) as string[],
          campaignId: a.campaignId ?? b.campaignId ?? null,
          startAt: a.startAt, endAt: aEnd, dueAt: a.startAt,
          ownerId,
          recommendations: [
            rec('Reassign one item to another owner', 'reassign'),
            rec('Move the lower-priority item to the next free slot', 'reschedule'),
          ],
          records: [
            { kind: recordKindFor(a), id: a.recordId, label: a.title },
            { kind: recordKindFor(b), id: b.recordId, label: b.title },
            { kind: 'profile', id: ownerId, label: a.ownerName ?? 'Owner' },
          ],
        })
      }
    }
  }
  return found
}

/** 15.2 Channel collision — duplicate slots, minimum spacing, saturation. */
function detectChannelCollisions(entries: ScheduleEntry[], ctx: CalendarContext): DetectedConflict[] {
  const publishing = entries.filter(e => (e.kind === 'content' || e.kind === 'publishing') && e.channel && !e.allDay)
  const byChannel = new Map<string, ScheduleEntry[]>()
  for (const entry of publishing) {
    const list = byChannel.get(entry.channel!) ?? []
    list.push(entry)
    byChannel.set(entry.channel!, list)
  }

  const found: DetectedConflict[] = []
  for (const [channel, list] of byChannel) {
    const sorted = [...list].sort((a, b) => a.startAt.localeCompare(b.startAt))
    const channelLabel = CHANNEL_LABELS[channel] ?? channel

    // Duplicate slot + spacing
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1]
      const gapMinutes = (new Date(b.startAt).getTime() - new Date(a.startAt).getTime()) / 60000
      if (gapMinutes === 0) {
        found.push({
          signature: signature('duplicate_slot', [channel, a.id, b.id]),
          type: 'duplicate_slot',
          severity: calculateSeverity({ type: 'duplicate_slot', startAt: a.startAt, affectedCount: 2, blocksDelivery: true }),
          impact: 'medium',
          title: 'Duplicate publish slot',
          description: `Two ${channelLabel} items are scheduled for exactly ${formatTime(a.startAt, ctx.timezone, ctx.locale)}.`,
          channels: [channel],
          campaignId: a.campaignId ?? b.campaignId ?? null,
          startAt: a.startAt, endAt: null, dueAt: a.startAt,
          ownerId: a.ownerId ?? b.ownerId ?? null,
          recommendations: [
            rec('Move one item to a free slot', 'reschedule'),
            rec('Cancel the duplicate if it is the same content', 'cancel_duplicate'),
          ],
          records: [
            { kind: recordKindFor(a), id: a.recordId, label: a.title },
            { kind: recordKindFor(b), id: b.recordId, label: b.title },
          ],
        })
      } else if (gapMinutes < MIN_CHANNEL_SPACING_MINUTES) {
        found.push({
          signature: signature('overlap_collision', [channel, 'spacing', a.id, b.id]),
          type: 'overlap_collision',
          severity: calculateSeverity({ type: 'overlap_collision', startAt: a.startAt, affectedCount: 2, blocksDelivery: false, autoResolvable: true }),
          impact: 'low',
          title: `${channelLabel} posts too close together`,
          description: `"${a.title}" and "${b.title}" are only ${Math.round(gapMinutes)} minutes apart on ${channelLabel}.`,
          channels: [channel],
          campaignId: a.campaignId ?? b.campaignId ?? null,
          startAt: a.startAt, endAt: b.startAt, dueAt: a.startAt,
          ownerId: a.ownerId ?? b.ownerId ?? null,
          recommendations: [
            rec(`Allow at least ${MIN_CHANNEL_SPACING_MINUTES / 60} hours between posts`, 'space_posts'),
            rec('Reschedule one of the posts', 'reschedule'),
          ],
          records: [
            { kind: recordKindFor(a), id: a.recordId, label: a.title },
            { kind: recordKindFor(b), id: b.recordId, label: b.title },
          ],
        })
      }
    }

    // Saturation per day
    const perDay = new Map<string, ScheduleEntry[]>()
    for (const entry of sorted) {
      const key = zonedDateKey(entry.startAt, ctx.timezone)
      const list = perDay.get(key) ?? []
      list.push(entry)
      perDay.set(key, list)
    }
    for (const [day, items] of perDay) {
      if (items.length <= CHANNEL_SATURATION_PER_DAY) continue
      found.push({
        signature: signature('channel_saturation', [channel, day]),
        type: 'channel_saturation',
        severity: calculateSeverity({ type: 'channel_saturation', startAt: items[0].startAt, affectedCount: items.length, blocksDelivery: false }),
        impact: items.length > CHANNEL_SATURATION_PER_DAY * 2 ? 'high' : 'medium',
        title: `${channelLabel} channel overload`,
        description: `${items.length} ${channelLabel} items are scheduled on ${day}. The recommended maximum is ${CHANNEL_SATURATION_PER_DAY}.`,
        channels: [channel],
        campaignId: items[0].campaignId ?? null,
        startAt: items[0].startAt, endAt: items[items.length - 1].startAt, dueAt: items[0].startAt,
        ownerId: items[0].ownerId ?? null,
        recommendations: [
          rec('Spread posts across nearby days', 'reschedule'),
          rec('Prioritise the highest-value posts and defer the rest', null, true),
        ],
        records: items.slice(0, 8).map(e => ({ kind: recordKindFor(e), id: e.recordId, label: e.title })),
      })
    }
  }
  return found
}

/** 15.3 Capacity — a single owner carrying too much on one day. */
function detectCapacityClashes(entries: ScheduleEntry[], ctx: CalendarContext): DetectedConflict[] {
  const byOwnerDay = new Map<string, ScheduleEntry[]>()
  for (const entry of entries) {
    if (!entry.ownerId) continue
    if (entry.status === 'completed' || entry.status === 'published' || entry.status === 'cancelled') continue
    const key = `${entry.ownerId}|${zonedDateKey(entry.startAt, ctx.timezone)}`
    const list = byOwnerDay.get(key) ?? []
    list.push(entry)
    byOwnerDay.set(key, list)
  }

  const found: DetectedConflict[] = []
  for (const [key, items] of byOwnerDay) {
    if (items.length <= OWNER_DAILY_CAPACITY) continue
    const [ownerId, day] = key.split('|')
    found.push({
      signature: signature('capacity_clash', [ownerId, day]),
      type: 'capacity_clash',
      severity: calculateSeverity({ type: 'capacity_clash', startAt: items[0].startAt, affectedCount: items.length, blocksDelivery: false }),
      impact: items.length > OWNER_DAILY_CAPACITY * 2 ? 'high' : 'medium',
      title: `${items[0].ownerName ?? 'Owner'} over capacity`,
      description: `${items[0].ownerName ?? 'This owner'} is overbooked with ${items.length} deliverables on ${day}. Working capacity is ${OWNER_DAILY_CAPACITY}.`,
      channels: [...new Set(items.map(i => i.channel).filter(Boolean))] as string[],
      campaignId: items[0].campaignId ?? null,
      startAt: items[0].startAt, endAt: items[items.length - 1].startAt, dueAt: items[0].startAt,
      ownerId,
      recommendations: [
        rec('Reassign the lowest-priority deliverables', 'reassign'),
        rec('Move non-urgent work to the following day', 'reschedule'),
      ],
      records: [
        { kind: 'profile', id: ownerId, label: items[0].ownerName ?? 'Owner' },
        ...items.slice(0, 8).map(e => ({ kind: recordKindFor(e), id: e.recordId, label: e.title })),
      ],
    })
  }
  return found
}

/** 15.4 Approval — publish before approval, or an approval already overdue. */
function detectApprovalConflicts(
  entries: ScheduleEntry[],
  queue: { id: string; title: string; scheduledAt: string | null; approvalStatus: string; channel: string | null; campaignId: string | null; ownerId: string | null }[],
  ctx: CalendarContext,
): DetectedConflict[] {
  const found: DetectedConflict[] = []
  const now = Date.now()

  for (const item of queue) {
    if (item.approvalStatus !== 'awaiting_approval' && item.approvalStatus !== 'changes_requested') continue
    if (!item.scheduledAt) continue
    const hoursToPublish = (new Date(item.scheduledAt).getTime() - now) / 3600_000
    if (hoursToPublish > 24) continue

    found.push({
      signature: signature('approval_delay', [item.id]),
      type: 'approval_delay',
      severity: calculateSeverity({
        type: 'approval_delay', startAt: item.scheduledAt, affectedCount: 1, blocksDelivery: true,
      }),
      impact: hoursToPublish < 0 ? 'high' : 'medium',
      title: hoursToPublish < 0 ? 'Approval overdue past publish time' : 'Approval delay risk',
      description: hoursToPublish < 0
        ? `"${item.title}" was due to publish at ${formatTime(item.scheduledAt, ctx.timezone, ctx.locale)} but is still awaiting approval.`
        : `"${item.title}" publishes in under 24 hours and is still awaiting approval.`,
      channels: item.channel ? [item.channel] : [],
      campaignId: item.campaignId ?? null,
      startAt: item.scheduledAt, endAt: null, dueAt: item.scheduledAt,
      ownerId: item.ownerId ?? null,
      recommendations: [
        rec('Escalate to the assigned approver', null, true),
        rec('Extend the publish deadline', 'extend_deadline'),
        rec('Reschedule until after approval completes', 'reschedule'),
      ],
      records: [{ kind: 'publishing_job', id: item.id, label: item.title }],
    })
  }

  // Multiple approval deadlines landing on one reviewer at the same moment.
  const approvals = entries.filter(e => e.kind === 'approval' && e.ownerId)
  const byOwnerSlot = new Map<string, ScheduleEntry[]>()
  for (const entry of approvals) {
    const key = `${entry.ownerId}|${entry.startAt}`
    const list = byOwnerSlot.get(key) ?? []
    list.push(entry)
    byOwnerSlot.set(key, list)
  }
  for (const [key, items] of byOwnerSlot) {
    if (items.length < 2) continue
    const [ownerId] = key.split('|')
    found.push({
      signature: signature('approval_delay', ['simultaneous', ...items.map(i => i.id)]),
      type: 'approval_delay',
      severity: calculateSeverity({ type: 'approval_delay', startAt: items[0].startAt, affectedCount: items.length, blocksDelivery: true }),
      impact: 'medium',
      title: 'Approval bottleneck',
      description: `${items.length} approvals are due at the same time for ${items[0].ownerName ?? 'one reviewer'}.`,
      channels: [],
      campaignId: items[0].campaignId ?? null,
      startAt: items[0].startAt, endAt: null, dueAt: items[0].startAt,
      ownerId,
      recommendations: [
        rec('Distribute approvals across reviewers', 'reassign'),
        rec('Stagger the approval deadlines', 'reschedule'),
      ],
      records: items.map(e => ({ kind: recordKindFor(e), id: e.recordId, label: e.title })),
    })
  }

  return found
}

/** 15.6 Date validity + launch collision. */
function detectDateAndLaunchConflicts(entries: ScheduleEntry[], ctx: CalendarContext): DetectedConflict[] {
  const found: DetectedConflict[] = []

  for (const entry of entries) {
    if (entry.endAt && new Date(entry.endAt).getTime() < new Date(entry.startAt).getTime()) {
      found.push({
        signature: signature('date_invalid', [entry.id]),
        type: 'date_invalid',
        severity: calculateSeverity({ type: 'date_invalid', startAt: entry.startAt, affectedCount: 1, blocksDelivery: true }),
        impact: 'high',
        title: 'Invalid schedule dates',
        description: `"${entry.title}" ends before it starts.`,
        channels: entry.channel ? [entry.channel] : [],
        campaignId: entry.campaignId ?? null,
        startAt: entry.startAt, endAt: entry.endAt, dueAt: entry.startAt,
        ownerId: entry.ownerId ?? null,
        recommendations: [rec('Correct the end date so it follows the start date', 'reschedule')],
        records: [{ kind: recordKindFor(entry), id: entry.recordId, label: entry.title }],
      })
    }
  }

  // Two campaign launches landing on the same day.
  const launches = entries.filter(e => e.kind === 'campaign' && e.title.endsWith('launch'))
  const byDay = new Map<string, ScheduleEntry[]>()
  for (const launch of launches) {
    const key = zonedDateKey(launch.startAt, ctx.timezone)
    const list = byDay.get(key) ?? []
    list.push(launch)
    byDay.set(key, list)
  }
  for (const [day, items] of byDay) {
    if (items.length < 2) continue
    found.push({
      signature: signature('launch_collision', [day, ...items.map(i => i.recordId)]),
      type: 'launch_collision',
      severity: calculateSeverity({ type: 'launch_collision', startAt: items[0].startAt, affectedCount: items.length, blocksDelivery: false, campaignPriority: 'high' }),
      impact: 'high',
      title: 'Overlapping campaign launches',
      description: `${items.length} campaigns launch on ${day}, competing for the same audience attention.`,
      channels: [],
      campaignId: items[0].campaignId ?? null,
      startAt: items[0].startAt, endAt: null, dueAt: items[0].startAt,
      ownerId: items[0].ownerId ?? null,
      recommendations: [
        rec('Stagger the launches by at least one day', 'reschedule'),
        rec('Confirm the campaigns target different audiences', null, true),
      ],
      records: items.map(e => ({ kind: 'campaign' as const, id: e.recordId, label: e.campaignName ?? e.title })),
    })
  }

  return found
}

/** 15.5 Dependency — publishing content whose campaign has not started. */
function detectDependencyConflicts(
  entries: ScheduleEntry[],
  campaigns: { id: string; name: string; start_date: string | null; end_date: string | null; status: string }[],
): DetectedConflict[] {
  const byId = new Map(campaigns.map(c => [c.id, c]))
  const found: DetectedConflict[] = []

  for (const entry of entries) {
    if (entry.kind !== 'content' || !entry.campaignId) continue
    const campaign = byId.get(entry.campaignId)
    if (!campaign) continue
    const start = campaign.start_date ? new Date(`${campaign.start_date}T00:00:00Z`).getTime() : null
    const end = campaign.end_date ? new Date(`${campaign.end_date}T23:59:59Z`).getTime() : null
    const at = new Date(entry.startAt).getTime()
    const before = start !== null && at < start
    const after = end !== null && at > end
    if (!before && !after) continue

    found.push({
      signature: signature('blocked_dependency', [entry.id, campaign.id]),
      type: 'blocked_dependency',
      severity: calculateSeverity({ type: 'blocked_dependency', startAt: entry.startAt, affectedCount: 2, blocksDelivery: before }),
      impact: 'medium',
      title: 'Content scheduled outside its campaign window',
      description: `"${entry.title}" is scheduled ${before ? 'before' : 'after'} the "${campaign.name}" campaign window.`,
      channels: entry.channel ? [entry.channel] : [],
      campaignId: campaign.id,
      startAt: entry.startAt, endAt: null, dueAt: entry.startAt,
      ownerId: entry.ownerId ?? null,
      recommendations: [
        rec('Move the content inside the campaign window', 'reschedule'),
        rec('Extend the campaign dates to cover this content', 'extend_deadline'),
      ],
      records: [
        { kind: 'content_post', id: entry.recordId, label: entry.title },
        { kind: 'campaign', id: campaign.id, label: campaign.name },
      ],
    })
  }
  return found
}

// ── Orchestration ───────────────────────────────────────────────────────────

export function detectConflicts(input: {
  entries: ScheduleEntry[]
  queue: Parameters<typeof detectApprovalConflicts>[1]
  campaigns: Parameters<typeof detectDependencyConflicts>[1]
  ctx: CalendarContext
}): DetectedConflict[] {
  const { entries, queue, campaigns, ctx } = input
  const all = [
    ...detectOwnerOverlaps(entries, ctx),
    ...detectChannelCollisions(entries, ctx),
    ...detectCapacityClashes(entries, ctx),
    ...detectApprovalConflicts(entries, queue, ctx),
    ...detectDateAndLaunchConflicts(entries, ctx),
    ...detectDependencyConflicts(entries, campaigns),
  ]
  // De-duplicate by signature — a single condition can be found by two checks.
  const seen = new Map<string, DetectedConflict>()
  for (const conflict of all) if (!seen.has(conflict.signature)) seen.set(conflict.signature, conflict)
  return [...seen.values()]
}

/**
 * Persists a detection run: upserts new/changed conflicts, and auto-resolves any
 * previously open conflict whose condition no longer holds. Runs server-side
 * (route handler / server action / background job) — never on render.
 */
export async function persistDetectionRun(
  supabase: SupabaseClient,
  ctx: CalendarContext,
  detected: DetectedConflict[],
  window: { startIso: string; endIso: string },
): Promise<{ created: number; updated: number; autoResolved: number }> {
  const { data: existing, error } = await supabase
    .from('calendar_conflicts')
    .select('id, signature, status, reference')
    .eq('workspace_id', ctx.workspaceId)
    .in('status', ['open', 'in_progress', 'reopened'])
    .gte('detected_at', window.startIso)
    .lte('detected_at', window.endIso)
  if (error) throw error

  const bySignature = new Map((existing ?? []).map(row => [row.signature as string, row]))
  const detectedSignatures = new Set(detected.map(d => d.signature))

  let created = 0, updated = 0

  for (const conflict of detected) {
    const current = bySignature.get(conflict.signature)
    const payload = {
      workspace_id: ctx.workspaceId,
      conflict_type: conflict.type,
      severity: conflict.severity,
      impact: conflict.impact,
      title: conflict.title,
      description: conflict.description,
      channels: conflict.channels,
      campaign_id: conflict.campaignId,
      start_at: conflict.startAt,
      end_at: conflict.endAt,
      due_at: conflict.dueAt,
      owner_id: conflict.ownerId,
      recommendations: conflict.recommendations,
      signature: conflict.signature,
      detector_version: DETECTOR_VERSION,
    }

    if (current) {
      const { error: updateError } = await supabase
        .from('calendar_conflicts').update(payload).eq('id', current.id).eq('workspace_id', ctx.workspaceId)
      if (updateError) throw updateError
      updated += 1
      continue
    }

    const { data: reference } = await supabase.rpc('next_conflict_reference', { p_workspace: ctx.workspaceId })
    const { data: inserted, error: insertError } = await supabase
      .from('calendar_conflicts')
      .insert({ ...payload, reference: (reference as string) ?? `CONF-${Date.now().toString().slice(-4)}`, status: 'open' })
      .select('id').single()
    if (insertError) {
      // A concurrent run inserted the same signature first — that is fine.
      if (insertError.code === '23505') { updated += 1; continue }
      throw insertError
    }
    created += 1

    if (conflict.records.length) {
      await supabase.from('calendar_conflict_records').insert(
        conflict.records.map(record => ({
          conflict_id: inserted.id,
          workspace_id: ctx.workspaceId,
          record_kind: record.kind,
          record_id: record.id,
          label: record.label,
        })),
      )
    }
    await supabase.from('calendar_conflict_activity').insert({
      conflict_id: inserted.id,
      workspace_id: ctx.workspaceId,
      actor_id: null,
      action: 'detected',
      summary: `${conflict.title} detected by the scheduling engine`,
    })
  }

  // Conditions that no longer hold are closed automatically, with a trail.
  const stale = (existing ?? []).filter(row => !detectedSignatures.has(row.signature as string))
  for (const row of stale) {
    await supabase.from('calendar_conflicts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution_notes: 'Condition no longer detected.' })
      .eq('id', row.id).eq('workspace_id', ctx.workspaceId)
    await supabase.from('calendar_conflict_activity').insert({
      conflict_id: row.id,
      workspace_id: ctx.workspaceId,
      action: 'resolved',
      summary: 'Auto-resolved — the scheduling condition no longer applies.',
    })
  }

  return { created, updated, autoResolved: stale.length }
}

/** Default detection window: yesterday through 60 days ahead. */
export function detectionWindow(ctx: CalendarContext) {
  const now = new Date()
  return {
    startIso: startOfDayUtc(addDays(now, -1), ctx.timezone).toISOString(),
    endIso: addDays(now, 60).toISOString(),
  }
}

/** A dry-run preview used by the resolution panel, without persisting. */
export function summariseConflict(conflict: CalendarConflict): string {
  return `${conflict.reference} · ${conflict.title} · ${conflict.severity}`
}
