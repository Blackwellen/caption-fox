import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signReadUrls, R2_PREFIX } from '@/lib/storage/r2'
import { safeSearchTerm } from './filters'
import type {
  ActivityRow, ContactDetail, ConversationFilters, ConversationRow, ConversationSort, InboxCounts,
  MemberLite, MessageRow, SavedViewRow, TeamLite,
} from './types'

// Canonical Inbox read layer. Every page and the Fox AI panel read through here;
// every query is scoped by workspace_id AND runs under the caller's RLS.

const EMPTY_COUNTS: InboxCounts = {
  open: 0, snoozed: 0, closed: 0, awaiting: 0, sla_at_risk: 0, overdue: 0, unassigned: 0, assigned_to_me: 0,
  team_queue: 0, assignable_today: 0, median_unowned_secs: null, resolved_today: 0, resolved_yesterday: 0,
  avg_first_response_secs: null, avg_first_response_prev_secs: null, avg_resolution_secs: null, avg_resolution_prev_secs: null,
  channels: {}, unassigned_channels: {}, unassigned_tags: {}, unassigned_high: 0, unassigned_new: 0,
  unassigned_needs_review: 0, unassigned_mine: 0, my_open: 0, mentions: 0,
}

// ------------------------------------------------------------------ media
/** Resolves `r2:` storage paths to short-lived signed URLs; http URLs pass through. */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const r2 = [...new Set(paths.filter((p): p is string => Boolean(p && p.startsWith(R2_PREFIX))))]
  const out = new Map<string, string | null>()
  for (const p of paths) if (p && !p.startsWith(R2_PREFIX)) out.set(p, p)
  if (r2.length) {
    try {
      const signed = await signReadUrls(r2, 3600)
      for (const [k, v] of signed) out.set(k, v)
    } catch {
      for (const p of r2) out.set(p, null)
    }
  }
  return out
}

async function hydrateConversationMedia(rows: ConversationRow[]): Promise<ConversationRow[]> {
  const map = await signPaths(rows.flatMap(r => [r.contact_avatar, r.sender_avatar, r.assignee_avatar]))
  const sign = (p: string | null) => (p ? map.get(p) ?? null : null)
  return rows.map(r => ({ ...r, contact_avatar: sign(r.contact_avatar), sender_avatar: sign(r.sender_avatar), assignee_avatar: sign(r.assignee_avatar) }))
}

// ------------------------------------------------------------------ counts
export async function getInboxCounts(sb: SupabaseClient, workspaceId: string, timezone: string) {
  const [{ data: counts }, { data: snapshot }] = await Promise.all([
    sb.rpc('inbox_overview_counts', { ws: workspaceId, tz: timezone }),
    sb.from('inbox_metric_snapshots').select('metrics, day').eq('workspace_id', workspaceId)
      .lt('day', new Date().toISOString().slice(0, 10)).order('day', { ascending: false }).limit(1).maybeSingle(),
  ])
  // Writes today's snapshot once so tomorrow's deltas have a baseline.
  void sb.rpc('inbox_record_snapshot', { ws: workspaceId, tz: timezone })
  return {
    counts: { ...EMPTY_COUNTS, ...((counts ?? {}) as Partial<InboxCounts>) },
    yesterday: (snapshot?.metrics ?? null) as Partial<InboxCounts> | null,
  }
}

// ------------------------------------------------------------------ conversations
export interface ListOptions {
  filters: ConversationFilters
  sort: ConversationSort
  page: number
  pageSize: number
  userId: string
}

export async function listConversations(sb: SupabaseClient, workspaceId: string, opts: ListOptions) {
  const filters = { ...opts.filters }
  if (filters.queue) {
    const { data: queue } = await sb.from('inbox_queues').select('filters').eq('workspace_id', workspaceId).eq('id', filters.queue).maybeSingle()
    Object.assign(filters, queueToFilters((queue?.filters ?? {}) as Record<string, unknown>))
  }

  let q = sb.from('inbox_conversation_list').select('*', { count: 'exact' }).eq('workspace_id', workspaceId)
  if (filters.lane) q = q.eq('lane', filters.lane)
  if (filters.platform?.length) q = q.in('platform', filters.platform)
  if (filters.priority?.length) q = q.in('priority', filters.priority)
  if (filters.sla?.length) q = q.in('sla_status', filters.sla)
  if (filters.sentiment?.length) q = q.in('sentiment', filters.sentiment)
  if (filters.language?.length) q = q.in('language', filters.language)
  if (filters.segment?.length) q = q.in('contact_segment', filters.segment)
  if (filters.tags?.length) q = q.overlaps('tags', filters.tags)
  if (filters.team) q = q.eq('team_id', filters.team)
  if (filters.teamName) q = q.eq('team_name', filters.teamName)
  if (filters.waiting) q = q.eq('waiting_on_customer', true)
  if (filters.escalated) q = q.not('escalated_at', 'is', null)
  if (filters.assignees?.length) q = q.in('assigned_to', filters.assignees)
  switch (filters.assignee) {
    case undefined: break
    case 'me': q = q.eq('assigned_to', opts.userId); break
    case 'unassigned': q = q.is('assigned_to', null).is('dismissed_at', null); break
    case 'assigned': q = q.not('assigned_to', 'is', null); break
    default: q = q.eq('assigned_to', filters.assignee)
  }
  if (filters.status?.length) {
    const parts = filters.status.map(s => s === 'awaiting' ? 'requires_reply.eq.true'
      : s === 'waiting' ? 'waiting_on_customer.eq.true'
      : s === 'escalated' ? 'escalated_at.not.is.null'
      : 'and(requires_reply.eq.false,waiting_on_customer.eq.false)')
    q = q.or(parts.join(','))
  }
  if (filters.age) {
    const hour = 3_600_000
    const at = (ms: number) => new Date(Date.now() - ms).toISOString()
    if (filters.age === 'lt1h') q = q.gte('created_at', at(hour))
    if (filters.age === '1to4h') q = q.lt('created_at', at(hour)).gte('created_at', at(4 * hour))
    if (filters.age === 'gt4h') q = q.lt('created_at', at(4 * hour))
    if (filters.age === 'gt24h') q = q.lt('created_at', at(24 * hour))
  }
  if (filters.search) {
    const term = safeSearchTerm(filters.search)
    if (term) q = q.or(['sender_name', 'contact_name', 'subject', 'last_message_preview', 'contact_email', 'sender_handle'].map(c => `${c}.ilike.%${term}%`).join(','))
  }

  switch (opts.sort) {
    case 'oldest': q = q.order('last_message_at', { ascending: true, nullsFirst: false }); break
    case 'priority': q = q.order('priority_rank', { ascending: false }).order('last_message_at', { ascending: false }); break
    case 'sla': q = q.order('sla_due_at', { ascending: true, nullsFirst: false }); break
    default: q = q.order('last_message_at', { ascending: false, nullsFirst: false })
  }
  q = q.order('id', { ascending: true })

  const from = (opts.page - 1) * opts.pageSize
  const { data, count, error } = await q.range(from, from + opts.pageSize - 1)
  return {
    rows: await hydrateConversationMedia((data ?? []) as ConversationRow[]),
    total: count ?? 0,
    error: error ? 'We couldn’t load conversations. Try again.' : null,
  }
}

export function queueToFilters(raw: Record<string, unknown>): ConversationFilters {
  const f: ConversationFilters = {}
  if (raw.assignee === 'me') f.assignee = 'me'
  if (Array.isArray(raw.priority)) f.priority = raw.priority as string[]
  if (Array.isArray(raw.sla)) f.sla = raw.sla as ConversationFilters['sla']
  if (raw.waiting) f.waiting = true
  if (raw.escalated) f.escalated = true
  if (Array.isArray(raw.segment)) f.segment = raw.segment as string[]
  if (Array.isArray(raw.tags)) f.tags = raw.tags as string[]
  if (typeof raw.teamName === 'string') f.teamName = raw.teamName
  return f
}

export interface ConversationDetail {
  conversation: ConversationRow
  messages: MessageRow[]
  activity: ActivityRow[]
  contact: ContactDetail | null
  contactStats: { total: number; avgResponseSecs: number | null }
}

export async function getConversationDetail(sb: SupabaseClient, workspaceId: string, id: string): Promise<ConversationDetail | null> {
  const { data: row } = await sb.from('inbox_conversation_list').select('*').eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (!row) return null
  const conversation = row as ConversationRow
  const [{ data: messages }, { data: activity }, contactRes, statsRes] = await Promise.all([
    sb.from('inbox_messages').select('id, thread_id, content, sender_type, sent_by, sent_at, is_internal_note, is_ai_generated, delivery_status, failure_reason, read_at, attachments')
      .eq('workspace_id', workspaceId).eq('thread_id', id).order('sent_at', { ascending: true }).limit(200),
    sb.from('inbox_activity').select('id, action, summary, actor_id, created_at, metadata')
      .eq('workspace_id', workspaceId).eq('thread_id', id).order('created_at', { ascending: false }).limit(20),
    conversation.contact_id
      ? sb.from('messaging_contacts').select('id, full_name, email, phone, avatar_url, location, segment, tags, lifetime_value_band, sentiment_trend, handle, last_channel, last_activity, last_activity_at')
          .eq('workspace_id', workspaceId).eq('id', conversation.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    conversation.contact_id
      ? sb.from('inbox_threads').select('created_at, first_response_at').eq('workspace_id', workspaceId).eq('contact_id', conversation.contact_id).limit(200)
      : Promise.resolve({ data: [] as { created_at: string; first_response_at: string | null }[] }),
  ])

  const authorIds = [...new Set([...(messages ?? []).map(m => m.sent_by), ...(activity ?? []).map(a => a.actor_id)].filter(Boolean))] as string[]
  const { data: authors } = authorIds.length
    ? await sb.from('profiles').select('id, full_name, avatar_url').in('id', authorIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] }
  const byId = new Map((authors ?? []).map(a => [a.id, a]))
  const contact = (contactRes.data ?? null) as ContactDetail | null
  const media = await signPaths([
    conversation.contact_avatar, conversation.sender_avatar, conversation.assignee_avatar, contact?.avatar_url,
    ...(authors ?? []).map(a => a.avatar_url),
    ...(messages ?? []).flatMap(m => ((m.attachments ?? []) as { path: string }[]).map(a => a.path)),
  ])
  const sign = (p: string | null | undefined) => (p ? media.get(p) ?? null : null)

  const stats = (statsRes.data ?? []) as { created_at: string; first_response_at: string | null }[]
  const responded = stats.filter(s => s.first_response_at)
  const avgResponseSecs = responded.length
    ? responded.reduce((sum, s) => sum + (new Date(s.first_response_at!).getTime() - new Date(s.created_at).getTime()) / 1000, 0) / responded.length
    : null

  return {
    conversation: { ...conversation, contact_avatar: sign(conversation.contact_avatar), sender_avatar: sign(conversation.sender_avatar), assignee_avatar: sign(conversation.assignee_avatar) },
    messages: (messages ?? []).map(m => ({
      ...(m as MessageRow),
      attachments: ((m.attachments ?? []) as MessageRow['attachments']).map(a => ({ ...a, url: sign(a.path) })),
      author_name: m.sent_by ? byId.get(m.sent_by)?.full_name ?? null : null,
      author_avatar: m.sent_by ? sign(byId.get(m.sent_by)?.avatar_url) : null,
    })),
    activity: (activity ?? []).map(a => ({ ...(a as ActivityRow), actor_name: a.actor_id ? byId.get(a.actor_id)?.full_name ?? null : null })),
    contact: contact ? { ...contact, avatar_url: sign(contact.avatar_url) } : null,
    contactStats: { total: stats.length, avgResponseSecs },
  }
}

// ------------------------------------------------------------------ people
export async function listMembers(sb: SupabaseClient, workspaceId: string): Promise<MemberLite[]> {
  const { data } = await sb.from('workspace_members')
    .select('role, profile:profiles!workspace_members_user_id_fkey(id, full_name, avatar_url, job_title)')
    .eq('workspace_id', workspaceId)
  const rows = (data ?? []).map(m => {
    const p = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as { id: string; full_name: string | null; avatar_url: string | null; job_title: string | null } | null
    return p ? { id: p.id, name: p.full_name ?? 'Team member', avatarUrl: p.avatar_url, role: m.role as string, jobTitle: p.job_title } : null
  }).filter(Boolean) as MemberLite[]
  const media = await signPaths(rows.map(r => r.avatarUrl))
  return rows.map(r => ({ ...r, avatarUrl: r.avatarUrl ? media.get(r.avatarUrl) ?? null : null })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function listTeams(sb: SupabaseClient, workspaceId: string): Promise<TeamLite[]> {
  const { data } = await sb.from('inbox_teams').select('id, name, inbox_team_members(user_id)').eq('workspace_id', workspaceId).order('name')
  return (data ?? []).map(t => ({ id: t.id, name: t.name, memberIds: ((t.inbox_team_members ?? []) as { user_id: string }[]).map(m => m.user_id) }))
}

export interface QueueRow { id: string; name: string; icon: string; count: number; isSystem: boolean }

export async function listQueues(sb: SupabaseClient, workspaceId: string): Promise<QueueRow[]> {
  const [{ data: queues }, { data: counts }] = await Promise.all([
    sb.from('inbox_queues').select('id, name, icon, position, is_system').eq('workspace_id', workspaceId).order('position'),
    sb.rpc('inbox_queue_counts', { ws: workspaceId }),
  ])
  const byId = new Map(((counts ?? []) as { queue_id: string; conversations: number }[]).map(c => [c.queue_id, Number(c.conversations)]))
  return (queues ?? []).map(q => ({ id: q.id, name: q.name, icon: q.icon, count: byId.get(q.id) ?? 0, isSystem: q.is_system }))
}

export interface WorkloadRow { userId: string; name: string; avatarUrl: string | null; active: number; capacity: number }

export async function getWorkload(sb: SupabaseClient, workspaceId: string): Promise<WorkloadRow[]> {
  const { data } = await sb.rpc('inbox_workload', { ws: workspaceId })
  const rows = ((data ?? []) as { user_id: string; full_name: string; avatar_url: string | null; active: number; capacity: number }[])
  const media = await signPaths(rows.map(r => r.avatar_url))
  return rows.map(r => ({ userId: r.user_id, name: r.full_name, avatarUrl: r.avatar_url ? media.get(r.avatar_url) ?? null : null, active: Number(r.active), capacity: r.capacity }))
}

export async function getRoutingSummary(sb: SupabaseClient, workspaceId: string) {
  const { data } = await sb.from('inbox_routing_rules').select('id, name, is_active, match_count, conditions, actions').eq('workspace_id', workspaceId).order('position')
  const rules = data ?? []
  return { rules, active: rules.filter(r => r.is_active).length }
}

// ------------------------------------------------------------------ saved views
export async function listSavedViews(sb: SupabaseClient, workspaceId: string): Promise<SavedViewRow[]> {
  const { data } = await sb.from('inbox_saved_views').select('*').eq('workspace_id', workspaceId)
    .order('is_pinned', { ascending: false }).order('folder', { ascending: true }).order('name', { ascending: true })
  return (data ?? []) as SavedViewRow[]
}

export async function getSavedViewInsights(sb: SupabaseClient, workspaceId: string, viewId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000)
  since.setHours(0, 0, 0, 0)
  const [{ data: usage }, { data: activity }] = await Promise.all([
    sb.from('inbox_saved_view_usage').select('user_id, used_at').eq('workspace_id', workspaceId).eq('view_id', viewId).gte('used_at', since.toISOString()).limit(5000),
    sb.from('inbox_activity').select('id, action, summary, actor_id, created_at, metadata').eq('workspace_id', workspaceId).eq('saved_view_id', viewId).order('created_at', { ascending: false }).limit(5),
  ])
  const rows = usage ?? []
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(since.getTime() + i * 86_400_000)
    const next = day.getTime() + 86_400_000
    return { date: day.toISOString(), count: rows.filter(r => { const t = new Date(r.used_at).getTime(); return t >= day.getTime() && t < next }).length }
  })
  const byUser = new Map<string, number>()
  for (const r of rows) if (r.user_id) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1)
  const ids = [...new Set([...byUser.keys(), ...(activity ?? []).map(a => a.actor_id).filter(Boolean) as string[]])]
  const { data: people } = ids.length ? await sb.from('profiles').select('id, full_name, avatar_url').in('id', ids) : { data: [] }
  const media = await signPaths((people ?? []).map(p => p.avatar_url))
  const person = new Map((people ?? []).map(p => [p.id, { name: p.full_name as string, avatarUrl: p.avatar_url ? media.get(p.avatar_url) ?? null : null }]))
  return {
    total: rows.length,
    byDay,
    topUsers: [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ id, count, ...(person.get(id) ?? { name: 'Team member', avatarUrl: null }) })),
    activity: (activity ?? []).map(a => ({ ...(a as ActivityRow), actor_name: a.actor_id ? person.get(a.actor_id)?.name ?? null : null, actor_avatar: a.actor_id ? person.get(a.actor_id)?.avatarUrl ?? null : null })),
  }
}
