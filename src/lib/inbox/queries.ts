// Canonical Inbox data-access layer. All four Inbox pages (Unified, Assignments,
// Saved Views, Unassigned) and the Fox AI Copilot Inbox/Contacts states read and
// write through these functions so there is exactly one query surface for
// inbox_threads / inbox_messages / saved_replies / inbox_saved_views.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InboxThread, InboxMessage, SavedReply, InboxSavedView } from '@/types/database'

export type ThreadFilters = {
  status?: string[]
  assignedTo?: string | 'unassigned' | 'me' | 'assigned'
  priority?: string[]
  platform?: string[]
  type?: string[]
  slaState?: string[]
  isFlagged?: boolean
  search?: string
  tags?: string[]
}

export type ThreadSort = 'newest' | 'oldest' | 'priority' | 'sla'

const THREAD_COLUMNS = '*'

export async function listThreads(
  sb: SupabaseClient,
  workspaceId: string,
  filters: ThreadFilters = {},
  opts: { sort?: ThreadSort; page?: number; pageSize?: number; currentUserId?: string } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 25
  let query = sb.from('inbox_threads').select(THREAD_COLUMNS, { count: 'exact' }).eq('workspace_id', workspaceId)

  if (filters.status?.length) query = query.in('status', filters.status)
  if (filters.priority?.length) query = query.in('priority', filters.priority)
  if (filters.platform?.length) query = query.in('platform', filters.platform)
  if (filters.type?.length) query = query.in('type', filters.type)
  if (filters.slaState?.length) query = query.in('sla_state', filters.slaState)
  if (filters.isFlagged !== undefined) query = query.eq('is_flagged', filters.isFlagged)
  if (filters.tags?.length) query = query.overlaps('tags', filters.tags)
  if (filters.search) {
    query = query.or(`sender_name.ilike.%${filters.search}%,sender_handle.ilike.%${filters.search}%,content.ilike.%${filters.search}%`)
  }
  if (filters.assignedTo === 'unassigned') query = query.is('assigned_to', null)
  else if (filters.assignedTo === 'assigned') query = query.not('assigned_to', 'is', null)
  else if (filters.assignedTo === 'me' && opts.currentUserId) query = query.eq('assigned_to', opts.currentUserId)
  else if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo)

  switch (opts.sort) {
    case 'oldest': query = query.order('updated_at', { ascending: true }); break
    case 'priority': query = query.order('priority', { ascending: false }).order('updated_at', { ascending: false }); break
    case 'sla': query = query.order('sla_state', { ascending: false }).order('updated_at', { ascending: false }); break
    default: query = query.order('updated_at', { ascending: false })
  }

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query
  return { threads: (data as InboxThread[]) ?? [], count: count ?? 0, error }
}

export async function getThread(sb: SupabaseClient, threadId: string) {
  const { data, error } = await sb.from('inbox_threads').select('*').eq('id', threadId).single()
  return { thread: data as InboxThread | null, error }
}

export async function listMessages(sb: SupabaseClient, threadId: string) {
  const { data, error } = await sb.from('inbox_messages').select('*').eq('thread_id', threadId).order('sent_at', { ascending: true })
  return { messages: (data as InboxMessage[]) ?? [], error }
}

export async function sendMessage(
  sb: SupabaseClient,
  params: { threadId: string; workspaceId: string; content: string; senderType: 'internal' | 'external' | 'agent'; sentBy?: string | null; isInternalNote?: boolean; isAiGenerated?: boolean },
) {
  const { data, error } = await sb.from('inbox_messages').insert({
    thread_id: params.threadId,
    workspace_id: params.workspaceId,
    content: params.content,
    sender_type: params.senderType,
    sent_by: params.sentBy ?? null,
    is_internal_note: params.isInternalNote ?? false,
    is_ai_generated: params.isAiGenerated ?? false,
    delivery_status: 'sent',
  }).select().single()
  if (!error) {
    await sb.from('inbox_threads').update({ updated_at: new Date().toISOString(), status: 'open' }).eq('id', params.threadId)
  }
  return { message: data as InboxMessage | null, error }
}

export async function updateThread(sb: SupabaseClient, threadId: string, patch: Partial<InboxThread>) {
  const { data, error } = await sb.from('inbox_threads').update(patch).eq('id', threadId).select().single()
  return { thread: data as InboxThread | null, error }
}

export async function assignThread(sb: SupabaseClient, threadId: string, userId: string | null) {
  return updateThread(sb, threadId, { assigned_to: userId, status: userId ? 'assigned' : 'open' })
}

export async function listSavedReplies(sb: SupabaseClient, workspaceId: string) {
  const { data, error } = await sb.from('saved_replies').select('*').eq('workspace_id', workspaceId).is('archived_at', null).order('title')
  return { replies: (data as SavedReply[]) ?? [], error }
}

// ---------------------------------------------------------------------------
// KPI aggregates — real, computed from inbox_threads. No fabricated metrics.
// ---------------------------------------------------------------------------
export async function getInboxKpis(sb: SupabaseClient, workspaceId: string) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)

  const [openRes, awaitingRes, slaRiskRes, resolvedTodayRes, unassignedRes] = await Promise.all([
    sb.from('inbox_threads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('status', ['open', 'assigned']),
    sb.from('inbox_threads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('requires_reply', true).in('status', ['open', 'assigned']),
    sb.from('inbox_threads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('sla_state', ['warning', 'breached']),
    sb.from('inbox_threads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'resolved').gte('resolved_at', startOfDay.toISOString()),
    sb.from('inbox_threads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).is('assigned_to', null).in('status', ['open']),
  ])

  const { data: responseTimes } = await sb
    .from('inbox_threads')
    .select('created_at, first_response_at')
    .eq('workspace_id', workspaceId)
    .not('first_response_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  let avgFirstResponseMinutes: number | null = null
  if (responseTimes && responseTimes.length > 0) {
    const total = responseTimes.reduce((sum, r) => {
      const diff = new Date(r.first_response_at as string).getTime() - new Date(r.created_at as string).getTime()
      return sum + Math.max(0, diff)
    }, 0)
    avgFirstResponseMinutes = total / responseTimes.length / 60000
  }

  return {
    open: openRes.count ?? 0,
    awaitingReply: awaitingRes.count ?? 0,
    slaAtRisk: slaRiskRes.count ?? 0,
    resolvedToday: resolvedTodayRes.count ?? 0,
    unassigned: unassignedRes.count ?? 0,
    avgFirstResponseMinutes,
  }
}

export function slaMinutesRemaining(thread: InboxThread): number | null {
  if (thread.sla_state === 'met' || thread.sla_state === 'paused') return null
  const target = new Date(thread.created_at).getTime() + thread.sla_target_minutes * 60000
  return Math.round((target - Date.now()) / 60000)
}

// ---------------------------------------------------------------------------
// Saved Views
// ---------------------------------------------------------------------------
export async function listSavedViews(sb: SupabaseClient, workspaceId: string) {
  const { data, error } = await sb
    .from('inbox_saved_views')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
  return { views: (data as InboxSavedView[]) ?? [], error }
}

export async function createSavedView(
  sb: SupabaseClient,
  params: { workspaceId: string; name: string; description?: string; filters: ThreadFilters; sort: ThreadSort; createdBy: string; isShared?: boolean },
) {
  const { data, error } = await sb.from('inbox_saved_views').insert({
    workspace_id: params.workspaceId,
    name: params.name,
    description: params.description ?? null,
    filters: params.filters as object,
    sort: params.sort,
    created_by: params.createdBy,
    is_shared: params.isShared ?? true,
    is_pinned: false,
    is_default: false,
    usage_count: 0,
    last_used_at: null,
  }).select().single()
  return { view: data as InboxSavedView | null, error }
}

export async function updateSavedView(sb: SupabaseClient, id: string, patch: Partial<InboxSavedView>) {
  const { data, error } = await sb.from('inbox_saved_views').update(patch).eq('id', id).select().single()
  return { view: data as InboxSavedView | null, error }
}

export async function deleteSavedView(sb: SupabaseClient, id: string) {
  const { error } = await sb.from('inbox_saved_views').delete().eq('id', id)
  return { error }
}

export async function recordSavedViewUsage(sb: SupabaseClient, id: string, currentCount: number) {
  return updateSavedView(sb, id, { usage_count: currentCount + 1, last_used_at: new Date().toISOString() })
}

export const PLATFORM_EMOJI: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', linkedin: '💼', facebook: '👥', x: '✕', youtube: '▶️',
  email: '✉️', sms: '💬', whatsapp: '🟢', rcs: '📶', live_chat: '💬',
}

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open', assigned: 'Assigned', resolved: 'Resolved', spam: 'Spam', done: 'Done',
}

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
}
