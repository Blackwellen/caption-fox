'use server'

import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { getChannelProvider } from '@/lib/messaging/providers'
import type { MessagingChannel } from '@/lib/messaging/constants'
import { guardInbox } from './context'
import type { InboxCapability } from './entitlements'
import type { ConversationFilters, ConversationSort } from './types'

// Every Inbox mutation. Each one re-resolves the session, workspace, role, plan
// and flags server-side (guardInbox), scopes every write by workspace_id, and
// records inbox_activity (+ audit_logs for sensitive changes).

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const MESSAGING_CHANNELS: MessagingChannel[] = ['email', 'sms', 'whatsapp', 'rcs']

function ids(value: string | string[]): string[] | null {
  const list = (Array.isArray(value) ? value : [value]).slice(0, 200)
  return list.length && list.every(v => UUID.test(v)) ? list : null
}

async function begin(capability: InboxCapability) {
  const g = await guardInbox(capability)
  return g
}

async function activity(
  g: Extract<Awaited<ReturnType<typeof guardInbox>>, { ok: true }>,
  threadIds: string[], action: string, summary: string, metadata: Record<string, unknown> = {},
) {
  if (!threadIds.length) return
  await g.supabase.from('inbox_activity').insert(threadIds.map(thread_id => ({
    workspace_id: g.workspace.id, thread_id, actor_id: g.userId, action, summary, metadata,
  })))
}

function refresh() {
  revalidatePath('/[workspaceType]/inbox', 'layout')
}

// ------------------------------------------------------------------ replies + notes
export async function sendReply(input: {
  threadId: string; body: string; mode: 'reply' | 'note'; close?: boolean; aiAssisted?: boolean
  attachments?: { name: string; size: number; type: string; path: string }[]
}): Promise<ActionResult<{ messageId: string; deliveryStatus: string; failureReason: string | null }>> {
  const g = await begin(input.mode === 'note' ? 'inbox.note' : 'inbox.reply')
  if (!g.ok) return g
  const body = input.body?.trim() ?? ''
  if (!UUID.test(input.threadId)) return { ok: false, error: 'Unknown conversation.' }
  if (!body && !input.attachments?.length) return { ok: false, error: 'Write a message before sending.' }
  if (body.length > 5000) return { ok: false, error: 'Messages are limited to 5,000 characters.' }
  const attachments = (input.attachments ?? []).slice(0, 10).filter(a => a.path.startsWith(`r2:inbox/${g.workspace.id}/`))

  const { data: thread } = await g.supabase.from('inbox_threads')
    .select('id, platform, is_demo, contact_id, subject, status')
    .eq('workspace_id', g.workspace.id).eq('id', input.threadId).maybeSingle()
  if (!thread) return { ok: false, error: 'Conversation not found.' }

  const isNote = input.mode === 'note'
  // Internal notes never reach a channel provider. Replies on demo
  // conversations are recorded without contacting any external service.
  let deliveryStatus: 'sent' | 'failed' | 'simulated' | 'pending' = isNote ? 'sent' : thread.is_demo ? 'simulated' : 'pending'
  let failureReason: string | null = null

  const { data: message, error } = await g.supabase.from('inbox_messages').insert({
    thread_id: thread.id, workspace_id: g.workspace.id, content: body || '(attachment)', sender_type: 'internal',
    sent_by: g.userId, is_internal_note: isNote, is_ai_generated: Boolean(input.aiAssisted), approved_by: input.aiAssisted ? g.userId : null,
    delivery_status: deliveryStatus === 'pending' ? 'pending' : deliveryStatus, attachments,
  }).select('id').single()
  if (error || !message) return { ok: false, error: 'Your message could not be saved. Try again.' }

  if (!isNote && !thread.is_demo) {
    const channel = thread.platform as MessagingChannel
    if (MESSAGING_CHANNELS.includes(channel) && thread.contact_id) {
      const { data: contact } = await g.supabase.from('messaging_contacts')
        .select('id, email, phone, whatsapp_id, push_token, rcs_id').eq('workspace_id', g.workspace.id).eq('id', thread.contact_id).maybeSingle()
      const provider = getChannelProvider(channel)
      const outcome = contact
        ? await provider.send({
            workspaceId: g.workspace.id, messageId: message.id, channel, senderId: g.userId, isTest: false,
            recipient: { contactId: contact.id, email: contact.email, phone: contact.phone, whatsappId: contact.whatsapp_id, pushToken: contact.push_token, rcsId: contact.rcs_id },
            content: { subject: thread.subject ? `Re: ${thread.subject}` : undefined, body },
          })
        : { status: 'failed' as const, reason: 'This conversation has no contact address.' }
      deliveryStatus = outcome.status === 'sent' ? 'sent' : 'failed'
      failureReason = outcome.status === 'sent' ? null : outcome.reason
      await g.supabase.from('inbox_messages').update({
        delivery_status: deliveryStatus, failure_reason: failureReason,
        provider_message_id: outcome.status === 'sent' ? outcome.providerMessageId : null,
      }).eq('id', message.id).eq('workspace_id', g.workspace.id)
      if (deliveryStatus === 'sent') {
        await g.supabase.from('inbox_threads').update({ first_response_at: undefined }).eq('id', thread.id).is('first_response_at', null)
      }
    } else {
      deliveryStatus = 'failed'
      failureReason = `Replying on ${thread.platform.replace('_', ' ')} isn’t connected for this workspace yet.`
      await g.supabase.from('inbox_messages').update({ delivery_status: 'failed', failure_reason: failureReason }).eq('id', message.id).eq('workspace_id', g.workspace.id)
    }
  }

  await activity(g, [thread.id], isNote ? 'note.added' : 'reply.sent', isNote ? 'Internal note added' : deliveryStatus === 'failed' ? 'Reply failed to send' : 'Reply sent', { message_id: message.id })
  if (input.close && !isNote && deliveryStatus !== 'failed') {
    await g.supabase.from('inbox_threads').update({ status: 'resolved', closed_at: new Date().toISOString(), resolved_at: new Date().toISOString(), requires_reply: false })
      .eq('workspace_id', g.workspace.id).eq('id', thread.id)
    await activity(g, [thread.id], 'conversation.closed', 'Conversation closed')
  }
  refresh()
  return { ok: true, data: { messageId: message.id, deliveryStatus, failureReason } }
}

export async function retryDelivery(messageId: string): Promise<ActionResult> {
  const g = await begin('inbox.reply')
  if (!g.ok) return g
  if (!UUID.test(messageId)) return { ok: false, error: 'Unknown message.' }
  const { data: msg } = await g.supabase.from('inbox_messages').select('id, thread_id, content, delivery_status')
    .eq('workspace_id', g.workspace.id).eq('id', messageId).maybeSingle()
  if (!msg || msg.delivery_status !== 'failed') return { ok: false, error: 'Only failed messages can be retried.' }
  await g.supabase.from('inbox_messages').delete().eq('id', msg.id).eq('workspace_id', g.workspace.id)
  return sendReply({ threadId: msg.thread_id, body: msg.content, mode: 'reply' }) as Promise<ActionResult>
}

export async function markConversationRead(threadId: string): Promise<ActionResult> {
  const g = await begin('inbox.view')
  if (!g.ok) return g
  if (!UUID.test(threadId) || !g.can('inbox.reply')) return { ok: true }
  await g.supabase.from('inbox_threads').update({ unread_count: 0, is_read: true }).eq('workspace_id', g.workspace.id).eq('id', threadId).gt('unread_count', 0)
  return { ok: true }
}

// ------------------------------------------------------------------ assignment
export async function assignConversations(input: {
  threadIds: string[]; userId?: string | null; teamId?: string | null; reason?: string; claim?: boolean
}): Promise<ActionResult<{ updated: number }>> {
  const list = ids(input.threadIds)
  if (!list) return { ok: false, error: 'Select at least one conversation.' }
  const g = await begin(list.length > 1 ? 'inbox.bulk_manage' : 'inbox.assign')
  if (!g.ok) return g
  const reason = input.reason?.trim().slice(0, 500) || null
  const toUser = input.claim ? g.userId : input.userId ?? null
  if (toUser && !UUID.test(toUser)) return { ok: false, error: 'Unknown assignee.' }
  if (input.teamId && !UUID.test(input.teamId)) return { ok: false, error: 'Unknown team.' }

  if (toUser) {
    const { data: member } = await g.supabase.from('workspace_members').select('user_id').eq('workspace_id', g.workspace.id).eq('user_id', toUser).maybeSingle()
    if (!member) return { ok: false, error: 'That person is not a member of this workspace.' }
  }
  if (input.teamId) {
    const { data: team } = await g.supabase.from('inbox_teams').select('id').eq('workspace_id', g.workspace.id).eq('id', input.teamId).maybeSingle()
    if (!team) return { ok: false, error: 'That team does not exist in this workspace.' }
  }

  const { data: before } = await g.supabase.from('inbox_threads').select('id, assigned_to, team_id, status').eq('workspace_id', g.workspace.id).in('id', list)
  const rows = before ?? []
  if (!rows.length) return { ok: false, error: 'Conversations not found.' }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.userId !== undefined || input.claim) {
    patch.assigned_to = toUser
    patch.dismissed_at = null
  }
  if (input.teamId !== undefined) patch.team_id = input.teamId
  const { error } = await g.supabase.from('inbox_threads').update(patch).eq('workspace_id', g.workspace.id).in('id', rows.map(r => r.id))
  if (error) return { ok: false, error: 'Assignment failed. Nothing was changed.' }
  // Assigned conversations move to the "assigned" status; unassigning reopens them.
  if ('assigned_to' in patch) {
    await g.supabase.from('inbox_threads').update({ status: toUser ? 'assigned' : 'open' })
      .eq('workspace_id', g.workspace.id).in('id', rows.map(r => r.id)).in('status', ['open', 'assigned'])
  }

  let name = 'Unassigned'
  if (toUser) {
    const { data: p } = await g.supabase.from('profiles').select('full_name').eq('id', toUser).maybeSingle()
    name = p?.full_name ?? 'team member'
  }
  let teamName: string | null = null
  if (input.teamId) {
    const { data: t } = await g.supabase.from('inbox_teams').select('name').eq('id', input.teamId).maybeSingle()
    teamName = t?.name ?? null
  }
  await g.supabase.from('inbox_assignment_history').insert(rows.map(r => ({
    workspace_id: g.workspace.id, thread_id: r.id, from_user_id: r.assigned_to, to_user_id: 'assigned_to' in patch ? toUser : r.assigned_to,
    from_team_id: r.team_id, to_team_id: input.teamId !== undefined ? input.teamId : r.team_id, actor_id: g.userId, reason,
  })))
  const summary = input.claim ? 'Claimed conversation'
    : 'assigned_to' in patch ? (toUser ? `${rows.some(r => r.assigned_to) ? 'Reassigned' : 'Assigned'} to ${name}` : 'Unassigned')
    : `Team changed to ${teamName ?? 'none'}`
  await activity(g, rows.map(r => r.id), 'conversation.assigned', summary, { reason, team: teamName })
  await logAudit(g.supabase, g.userId, { workspaceId: g.workspace.id, action: 'inbox.assigned', entityType: 'inbox_thread', entityId: rows[0].id, metadata: { count: rows.length, to_user: toUser, to_team: input.teamId ?? null, reason } })
  refresh()
  return { ok: true, data: { updated: rows.length } }
}

// ------------------------------------------------------------------ state changes
export async function updateConversations(input: {
  threadIds: string[]
  action: 'close' | 'reopen' | 'snooze' | 'unsnooze' | 'priority' | 'escalate' | 'dismiss' | 'sla'
  priority?: string
  snoozeMinutes?: number
  slaPolicyId?: string
}): Promise<ActionResult<{ updated: number }>> {
  const list = ids(input.threadIds)
  if (!list) return { ok: false, error: 'Select at least one conversation.' }
  const capability: InboxCapability = list.length > 1 ? 'inbox.bulk_manage'
    : input.action === 'sla' || input.action === 'priority' ? 'inbox.sla.manage'
    : input.action === 'snooze' || input.action === 'unsnooze' ? 'inbox.snooze'
    : input.action === 'dismiss' || input.action === 'escalate' ? 'inbox.assign'
    : 'inbox.close'
  const g = await begin(input.action === 'priority' && list.length === 1 ? 'inbox.tags.manage' : capability)
  if (!g.ok) return g

  const now = new Date()
  let patch: Record<string, unknown>
  let summary: string
  switch (input.action) {
    case 'close': patch = { status: 'resolved', closed_at: now.toISOString(), resolved_at: now.toISOString(), requires_reply: false, snoozed_until: null }; summary = 'Conversation closed'; break
    case 'reopen': patch = { status: 'open', closed_at: null, resolved_at: null, snoozed_until: null }; summary = 'Conversation reopened'; break
    case 'snooze': {
      const mins = Math.min(Math.max(Math.round(input.snoozeMinutes ?? 60), 15), 60 * 24 * 30)
      patch = { snoozed_until: new Date(now.getTime() + mins * 60_000).toISOString() }
      summary = `Snoozed for ${mins >= 1440 ? `${Math.round(mins / 1440)}d` : mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`}`
      break
    }
    case 'unsnooze': patch = { snoozed_until: null }; summary = 'Snooze removed'; break
    case 'priority':
      if (!input.priority || !PRIORITIES.includes(input.priority)) return { ok: false, error: 'Choose a priority.' }
      patch = { priority: input.priority }; summary = `Priority set to ${input.priority[0].toUpperCase()}${input.priority.slice(1)}`; break
    case 'escalate': patch = { escalated_at: now.toISOString(), priority: 'urgent' }; summary = 'Conversation escalated'; break
    case 'dismiss': patch = { dismissed_at: now.toISOString() }; summary = 'Dismissed from unassigned triage'; break
    case 'sla': {
      if (!input.slaPolicyId || !UUID.test(input.slaPolicyId)) return { ok: false, error: 'Choose an SLA policy.' }
      const { data: policy } = await g.supabase.from('inbox_sla_policies').select('id, name').eq('workspace_id', g.workspace.id).eq('id', input.slaPolicyId).maybeSingle()
      if (!policy) return { ok: false, error: 'That SLA policy does not exist.' }
      patch = { sla_policy_id: policy.id }; summary = `SLA changed to ${policy.name}`; break
    }
  }
  const { data, error } = await g.supabase.from('inbox_threads').update({ ...patch, updated_at: now.toISOString() })
    .eq('workspace_id', g.workspace.id).in('id', list).select('id')
  if (error) return { ok: false, error: 'That change could not be saved. Nothing was changed.' }
  const changed = (data ?? []).map(r => r.id)
  await activity(g, changed, `conversation.${input.action}`, summary)
  if (['close', 'dismiss', 'sla', 'escalate'].includes(input.action) || changed.length > 1) {
    await logAudit(g.supabase, g.userId, { workspaceId: g.workspace.id, action: `inbox.${input.action}`, entityType: 'inbox_thread', entityId: changed[0], metadata: { count: changed.length } })
  }
  refresh()
  return { ok: true, data: { updated: changed.length } }
}

export async function updateTags(input: { threadIds: string[]; add?: string[]; remove?: string[] }): Promise<ActionResult> {
  const list = ids(input.threadIds)
  if (!list) return { ok: false, error: 'Select at least one conversation.' }
  const g = await begin(list.length > 1 ? 'inbox.bulk_manage' : 'inbox.tags.manage')
  if (!g.ok) return g
  const clean = (v?: string[]) => (v ?? []).map(t => t.trim().slice(0, 40)).filter(Boolean).slice(0, 10)
  const add = clean(input.add)
  const remove = new Set(clean(input.remove))
  if (!add.length && !remove.size) return { ok: false, error: 'Nothing to change.' }
  const { data: rows } = await g.supabase.from('inbox_threads').select('id, tags').eq('workspace_id', g.workspace.id).in('id', list)
  for (const row of rows ?? []) {
    const next = [...new Set([...(row.tags ?? []).filter((t: string) => !remove.has(t)), ...add])].slice(0, 20)
    const { error } = await g.supabase.from('inbox_threads').update({ tags: next }).eq('workspace_id', g.workspace.id).eq('id', row.id)
    if (error) return { ok: false, error: 'Tags could not be saved.' }
  }
  await activity(g, (rows ?? []).map(r => r.id), 'tags.changed', add.length ? `Tag added: ${add.join(', ')}` : `Tag removed: ${[...remove].join(', ')}`)
  refresh()
  return { ok: true }
}

export async function applyRoutingRules(threadIds: string[]): Promise<ActionResult<{ routed: number }>> {
  const list = ids(threadIds)
  if (!list) return { ok: false, error: 'Select at least one conversation.' }
  const g = await begin('inbox.assign')
  if (!g.ok) return g
  const [{ data: rules }, { data: rows }] = await Promise.all([
    g.supabase.from('inbox_routing_rules').select('id, name, conditions, actions').eq('workspace_id', g.workspace.id).eq('is_active', true).order('position'),
    g.supabase.from('inbox_conversation_list').select('id, platform, tags, contact_segment, last_message_preview, content').eq('workspace_id', g.workspace.id).in('id', list),
  ])
  let routed = 0
  for (const row of rows ?? []) {
    const text = `${row.content ?? ''} ${row.last_message_preview ?? ''}`.toLowerCase()
    const rule = (rules ?? []).find(r => {
      const c = r.conditions as { segment?: string[]; keywords?: string[]; channel?: string[] }
      if (c.segment && !c.segment.includes(row.contact_segment ?? '')) return false
      if (c.channel && !c.channel.includes(row.platform)) return false
      if (c.keywords && !c.keywords.some(k => text.includes(k.toLowerCase()))) return false
      return Boolean(c.segment || c.channel || c.keywords)
    })
    if (!rule) continue
    const a = rule.actions as { team?: string; priority?: string; tags?: string[] }
    await g.supabase.from('inbox_threads').update({
      ...(a.team ? { team_id: a.team } : {}), ...(a.priority ? { priority: a.priority } : {}),
      ...(a.tags ? { tags: [...new Set([...(row.tags ?? []), ...a.tags])] } : {}),
    }).eq('workspace_id', g.workspace.id).eq('id', row.id)
    await g.supabase.from('inbox_routing_rules').update({ match_count: undefined }).eq('id', rule.id)
    await activity(g, [row.id], 'conversation.routed', `Routed by rule “${rule.name}”`, { rule_id: rule.id })
    routed++
  }
  refresh()
  return { ok: true, data: { routed } }
}

// ------------------------------------------------------------------ saved views
export async function saveView(input: {
  id?: string; name: string; description?: string; folder?: string; filters: ConversationFilters; sort: ConversationSort
  visibility: 'personal' | 'team' | 'workspace'; sharedTeamId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const g = await begin(input.visibility === 'personal' ? 'inbox.saved_views.create' : 'inbox.saved_views.share')
  if (!g.ok) return g
  const name = input.name?.trim()
  if (!name || name.length > 80) return { ok: false, error: 'Give the view a name (80 characters max).' }
  if (!['personal', 'team', 'workspace'].includes(input.visibility)) return { ok: false, error: 'Choose who can see this view.' }
  const record = {
    name, description: input.description?.trim().slice(0, 300) || null, folder: input.folder?.trim().slice(0, 60) || null,
    filters: input.filters ?? {}, sort: input.sort ?? 'newest', visibility: input.visibility, is_shared: input.visibility !== 'personal',
    shared_team_id: input.visibility === 'team' && input.sharedTeamId && UUID.test(input.sharedTeamId) ? input.sharedTeamId : null,
    shared_at: input.visibility !== 'personal' ? new Date().toISOString() : null, needs_update: false,
  }
  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: 'Unknown view.' }
    const { data, error } = await g.supabase.from('inbox_saved_views').update(record).eq('workspace_id', g.workspace.id).eq('id', input.id).select('id').maybeSingle()
    if (error || !data) return { ok: false, error: 'Only the owner or a manager can edit this view.' }
    await g.supabase.from('inbox_activity').insert({ workspace_id: g.workspace.id, saved_view_id: data.id, actor_id: g.userId, action: 'saved_view.updated', summary: 'Updated filters' })
    refresh()
    return { ok: true, data: { id: data.id } }
  }
  const { data, error } = await g.supabase.from('inbox_saved_views').insert({ ...record, workspace_id: g.workspace.id, created_by: g.userId }).select('id').single()
  if (error || !data) return { ok: false, error: 'The view could not be created.' }
  await g.supabase.from('inbox_activity').insert({ workspace_id: g.workspace.id, saved_view_id: data.id, actor_id: g.userId, action: 'saved_view.created', summary: 'Created view' })
  refresh()
  return { ok: true, data: { id: data.id } }
}

export async function savedViewAction(input: {
  id: string; action: 'pin' | 'unpin' | 'duplicate' | 'delete' | 'default' | 'share' | 'unshare' | 'rename' | 'use'; name?: string
}): Promise<ActionResult<{ id?: string }>> {
  if (!UUID.test(input.id)) return { ok: false, error: 'Unknown view.' }
  const g = await begin(input.action === 'share' ? 'inbox.saved_views.share' : input.action === 'use' ? 'inbox.saved_views' : 'inbox.saved_views.create')
  if (!g.ok) return g
  const { data: view } = await g.supabase.from('inbox_saved_views').select('*').eq('workspace_id', g.workspace.id).eq('id', input.id).maybeSingle()
  if (!view) return { ok: false, error: 'View not found.' }
  const log = (action: string, summary: string) => g.supabase.from('inbox_activity').insert({ workspace_id: g.workspace.id, saved_view_id: view.id, actor_id: g.userId, action, summary })

  switch (input.action) {
    case 'use':
      await g.supabase.from('inbox_saved_view_usage').insert({ view_id: view.id, workspace_id: g.workspace.id, user_id: g.userId })
      await g.supabase.from('inbox_saved_views').update({ usage_count: (view.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() }).eq('id', view.id).eq('workspace_id', g.workspace.id)
      return { ok: true }
    case 'duplicate': {
      const { id: _id, created_at: _c, updated_at: _u, usage_count: _n, last_used_at: _l, ...rest } = view
      const { data, error } = await g.supabase.from('inbox_saved_views').insert({ ...rest, name: `${view.name} (copy)`.slice(0, 80), created_by: g.userId, is_pinned: false, is_default: false, visibility: 'personal', is_shared: false, is_demo: false, usage_count: 0 }).select('id').single()
      if (error || !data) return { ok: false, error: 'The view could not be duplicated.' }
      refresh()
      return { ok: true, data: { id: data.id } }
    }
    case 'delete': {
      const { error, count } = await g.supabase.from('inbox_saved_views').delete({ count: 'exact' }).eq('workspace_id', g.workspace.id).eq('id', view.id)
      if (error || !count) return { ok: false, error: 'Only the owner or a manager can delete this view.' }
      await logAudit(g.supabase, g.userId, { workspaceId: g.workspace.id, action: 'inbox.saved_view.deleted', entityType: 'inbox_saved_view', entityId: view.id, metadata: { name: view.name } })
      refresh()
      return { ok: true }
    }
    default: {
      const patch = input.action === 'pin' ? { is_pinned: true }
        : input.action === 'unpin' ? { is_pinned: false }
        : input.action === 'default' ? { is_default: true }
        : input.action === 'share' ? { visibility: 'workspace', is_shared: true, shared_at: new Date().toISOString() }
        : input.action === 'unshare' ? { visibility: 'personal', is_shared: false, shared_team_id: null }
        : { name: input.name?.trim().slice(0, 80) }
      if (input.action === 'rename' && !patch.name) return { ok: false, error: 'Give the view a name.' }
      if (input.action === 'default') await g.supabase.from('inbox_saved_views').update({ is_default: false }).eq('workspace_id', g.workspace.id).eq('created_by', g.userId)
      const { data, error } = await g.supabase.from('inbox_saved_views').update(patch).eq('workspace_id', g.workspace.id).eq('id', view.id).select('id').maybeSingle()
      if (error || !data) return { ok: false, error: 'Only the owner or a manager can change this view.' }
      await log(`saved_view.${input.action}`, input.action === 'share' ? 'Shared with workspace' : input.action === 'unshare' ? 'Made personal' : input.action === 'rename' ? 'Renamed view' : input.action === 'pin' ? 'Pinned view' : input.action === 'unpin' ? 'Unpinned view' : 'Set as default')
      refresh()
      return { ok: true }
    }
  }
}
