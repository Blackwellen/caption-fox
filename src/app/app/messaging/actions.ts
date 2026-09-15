'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMessagingSession } from '@/lib/messaging/server'
import type { MessagingCapabilities } from '@/lib/messaging/entitlements'
import type { MessagingChannel } from '@/lib/messaging/constants'
import { sendToContact, recountMessageStats } from '@/lib/messaging/send'
import type { RenderedContent } from '@/lib/messaging/providers/types'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

function revalidateMessaging() {
  for (const path of [
    '/app/messaging', '/app/messaging/email', '/app/messaging/sms', '/app/messaging/whatsapp',
    '/app/messaging/rcs', '/app/messaging/push', '/app/messaging/journeys', '/app/messaging/templates',
  ]) revalidatePath(path)
}

async function logActivity(
  supabase: SupabaseClient, workspaceId: string, actorId: string,
  entry: { entityType: string; entityId?: string | null; action: string; summary: string; link?: string | null; surface?: string | null; metadata?: Record<string, unknown> },
) {
  const { error } = await supabase.from('messaging_activity').insert({
    workspace_id: workspaceId, actor_id: actorId, entity_type: entry.entityType,
    entity_id: entry.entityId ?? null, action: entry.action, summary: entry.summary,
    link: entry.link ?? null, surface: entry.surface ?? null, metadata: entry.metadata ?? {},
  })
  if (error) console.error('[messaging] activity log failed', error.message)
}

async function authorise(capability: keyof MessagingCapabilities) {
  const session = await getMessagingSession()
  if (!session.capabilities[capability]) return { session: null, error: 'Your role does not allow this action.' } as const
  return { session, error: null } as const
}

async function ownsRecord(supabase: SupabaseClient, table: string, id: string, workspaceId: string): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

// ============================================================================
// Messages
// ============================================================================

export interface MessageContentInput {
  subject?: string
  body: string
  headline?: string
  deepLink?: string
}

export interface MessageInput {
  channel: MessagingChannel
  name: string
  senderId?: string
  audienceId?: string
  content: MessageContentInput
}

function validateMessage(input: MessageInput): string | null {
  if (!input.name?.trim()) return 'Message name is required.'
  if (input.name.length > 140) return 'Message name must be 140 characters or fewer.'
  if (!input.content?.body?.trim()) return 'Message body is required.'
  if (input.content.body.length > 20_000) return 'Message body is too long.'
  if (input.channel === 'sms' && input.content.body.length > 918) return 'SMS body is limited to 6 segments (918 characters).'
  if (input.channel === 'email' && !input.content.subject?.trim()) return 'Email subject is required.'
  return null
}

function contentToJsonb(channel: MessagingChannel, content: MessageContentInput): Record<string, unknown> {
  if (channel === 'email') return { subject: content.subject?.trim(), body: content.body.trim() }
  if (channel === 'push') return { title: content.headline?.trim() || content.subject?.trim(), body: content.body.trim(), deepLink: content.deepLink?.trim() || null }
  if (channel === 'rcs') return { headline: content.headline?.trim(), body: content.body.trim() }
  return { body: content.body.trim() }
}

export async function createMessage(input: MessageInput): Promise<ActionResult> {
  const { session, error } = await authorise('create')
  if (!session) return fail(error)
  const invalid = validateMessage(input)
  if (invalid) return fail(invalid)

  const { supabase, ctx, userId } = session

  const { data, error: insertError } = await supabase.from('messaging_messages').insert({
    workspace_id: ctx.workspaceId,
    channel: input.channel,
    name: input.name.trim(),
    sender_id: input.senderId?.trim() || null,
    subject: input.channel === 'email' ? input.content.subject?.trim() || null : null,
    content: contentToJsonb(input.channel, input.content),
    audience_id: input.audienceId || null,
    owner_id: userId,
    status: 'draft',
  }).select('id, name').single()
  if (insertError) return fail(insertError.message)

  await supabase.from('messaging_message_versions').insert({
    message_id: data.id, version_number: 1, content: contentToJsonb(input.channel, input.content), created_by: userId,
  })

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: data.id, action: 'created',
    summary: `created ${input.channel} message ${data.name}`, link: `/app/messaging/${input.channel}`, surface: input.channel,
  })

  revalidateMessaging()
  return { ok: true, id: data.id, message: `${data.name} saved as a draft.` }
}

export async function updateMessageContent(id: string, channel: MessagingChannel, patch: Partial<MessageInput>): Promise<ActionResult> {
  const { session, error } = await authorise('edit')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  if (!await ownsRecord(supabase, 'messaging_messages', id, ctx.workspaceId)) return fail('Message not found in this workspace.')

  const { data: message } = await supabase.from('messaging_messages').select('version, status').eq('id', id).single()
  if (message && !['draft', 'pending_approval', 'changes_requested'].includes(message.status)) {
    return fail(`A message that is ${message.status.replace('_', ' ')} cannot be edited.`)
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.senderId !== undefined) update.sender_id = patch.senderId?.trim() || null
  if (patch.audienceId !== undefined) update.audience_id = patch.audienceId || null
  if (patch.content !== undefined) {
    update.content = contentToJsonb(channel, patch.content)
    if (channel === 'email') update.subject = patch.content.subject?.trim() || null
    update.version = (message?.version ?? 1) + 1
  }

  const { error: updateError } = await supabase.from('messaging_messages').update(update).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  if (patch.content !== undefined) {
    await supabase.from('messaging_message_versions').insert({
      message_id: id, version_number: update.version as number, content: update.content, created_by: userId,
    })
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: id, action: 'updated', summary: 'updated message content',
    link: `/app/messaging/${channel}`, surface: channel,
  })

  revalidateMessaging()
  return { ok: true, message: 'Message updated.' }
}

/**
 * Sends a single test message to the caller's own account email/phone — never
 * to the live audience. Uses the same provider + eligibility pipeline as a
 * real send, minus the consent/suppression gate, so it proves the actual
 * delivery path works.
 */
export async function sendTestMessage(id: string, testAddress: string): Promise<ActionResult> {
  const { session, error } = await authorise('testSend')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: msg } = await supabase.from('messaging_messages')
    .select('id, channel, name, sender_id, content, subject').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!msg) return fail('Message not found in this workspace.')
  if (!testAddress?.trim()) return fail('Enter an address to send the test to.')

  const channel = msg.channel as MessagingChannel
  const content = (msg.content ?? {}) as Record<string, string>
  const rendered: RenderedContent = {
    subject: msg.subject ?? content.subject, body: content.body ?? content.title ?? '',
  }

  const testContact = {
    id: `test-${userId}`, email: channel === 'email' ? testAddress.trim() : null,
    phone: channel === 'sms' ? testAddress.trim() : null,
    whatsapp_id: channel === 'whatsapp' ? testAddress.trim() : null,
    push_token: channel === 'push' ? testAddress.trim() : null,
    rcs_id: channel === 'rcs' ? testAddress.trim() : null,
    email_consent: true, sms_consent: true, whatsapp_consent: true, push_consent: true, rcs_consent: true,
    unsubscribed_at: null, do_not_contact: false,
  }

  const outcome = await sendToContact(supabase, {
    workspaceId: ctx.workspaceId, messageId: msg.id, channel, senderId: msg.sender_id, content: rendered, isTest: true,
  }, testContact)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: id, action: 'test_sent',
    summary: `sent a test of ${msg.name}`, link: `/app/messaging/${channel}`, surface: channel,
    metadata: { outcome: outcome.status },
  })

  if (outcome.status === 'sent') return { ok: true, message: 'Test message sent.' }
  if (outcome.status === 'not_connected') return fail(outcome.reason ?? 'This channel is not connected yet.')
  return fail(outcome.reason ?? 'The test send failed.')
}

/**
 * Sends a message to its full audience right now. Runs synchronously in this
 * phase (no queue/worker infrastructure exists yet) — safe for the audience
 * sizes a single request can process, documented as a scale limit in the
 * implementation tracker for a later phase to move onto a background queue.
 */
export async function sendMessageNow(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('send')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: msg } = await supabase.from('messaging_messages')
    .select('id, channel, name, sender_id, content, subject, audience_id, status, approval_status')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!msg) return fail('Message not found in this workspace.')
  if (!['draft', 'scheduled', 'paused'].includes(msg.status)) return fail(`A message that is ${msg.status.replace('_', ' ')} cannot be sent.`)
  if (msg.approval_status === 'pending') return fail('This message is awaiting approval.')
  if (!msg.audience_id) return fail('Choose an audience before sending.')

  const channel = msg.channel as MessagingChannel
  const { data: members } = await supabase.from('messaging_audience_members')
    .select('contact_id, messaging_contacts(id, email, phone, whatsapp_id, push_token, rcs_id, email_consent, sms_consent, whatsapp_consent, push_consent, rcs_consent, unsubscribed_at, do_not_contact)')
    .eq('audience_id', msg.audience_id)

  const contacts = (members ?? [])
    .map(row => { const c = row.messaging_contacts; return Array.isArray(c) ? c[0] : c })
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  if (contacts.length === 0) return fail('The chosen audience has no contacts yet.')

  await supabase.from('messaging_messages').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', id)

  const content = (msg.content ?? {}) as Record<string, string>
  const rendered: RenderedContent = { subject: msg.subject ?? content.subject, body: content.body ?? content.title ?? '' }

  let sent = 0, skipped = 0, failed = 0, notConnected = false
  for (const contact of contacts) {
    const outcome = await sendToContact(supabase, {
      workspaceId: ctx.workspaceId, messageId: msg.id, channel, senderId: msg.sender_id, content: rendered, isTest: false,
    }, contact)
    if (outcome.status === 'sent') sent += 1
    else if (outcome.status === 'skipped') skipped += 1
    else if (outcome.status === 'not_connected') { notConnected = true; break }
    else failed += 1
  }

  await recountMessageStats(supabase, msg.id)
  await supabase.from('messaging_messages').update({
    status: notConnected ? 'failed' : 'sent',
  }).eq('id', id)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: id, action: notConnected ? 'send_failed' : 'sent',
    summary: notConnected ? `could not send ${msg.name}: channel not connected` : `sent ${msg.name} to ${sent} contacts`,
    link: `/app/messaging/${channel}`, surface: channel, metadata: { sent, skipped, failed },
  })

  revalidateMessaging()
  if (notConnected) return fail(`No ${channel} provider is connected for this workspace. Connect one in Messaging → Channels before sending.`)
  return { ok: true, message: `Sent to ${sent} contacts (${skipped} skipped, ${failed} failed).` }
}

export async function scheduleMessage(id: string, scheduledAt: string): Promise<ActionResult> {
  const { session, error } = await authorise('schedule')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  if (!await ownsRecord(supabase, 'messaging_messages', id, ctx.workspaceId)) return fail('Message not found in this workspace.')
  if (Number.isNaN(Date.parse(scheduledAt)) || Date.parse(scheduledAt) < Date.now()) return fail('Choose a valid future date and time.')

  const { error: updateError } = await supabase.from('messaging_messages')
    .update({ status: 'scheduled', scheduled_at: scheduledAt }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: id, action: 'scheduled', summary: `scheduled a message for ${scheduledAt}`, surface: 'messages',
  })
  revalidateMessaging()
  return { ok: true, message: 'Message scheduled.' }
}

export async function cancelMessage(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('edit')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  const { error: updateError } = await supabase.from('messaging_messages')
    .update({ status: 'cancelled' }).eq('id', id).eq('workspace_id', ctx.workspaceId).in('status', ['scheduled', 'draft', 'paused'])
  if (updateError) return fail(updateError.message)
  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'message', entityId: id, action: 'cancelled', summary: 'cancelled a message', surface: 'messages' })
  revalidateMessaging()
  return { ok: true, message: 'Message cancelled.' }
}

/**
 * Moves a draft into a real approval queue instead of letting it be sent
 * directly. Enforced server-side: `sendMessageNow` already refuses any
 * message whose `approval_status` is `pending`, so this is not cosmetic.
 */
export async function submitMessageForApproval(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('edit')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: message } = await supabase.from('messaging_messages')
    .select('id, name, channel, status, approval_status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!message) return fail('Message not found in this workspace.')
  if (!['draft', 'changes_requested'].includes(message.approval_status) && message.approval_status !== 'not_required') {
    return fail('This message is already in the approval queue.')
  }
  if (!['draft', 'paused'].includes(message.status)) return fail(`A message that is ${message.status.replace('_', ' ')} cannot be submitted for approval.`)

  const { error: updateError } = await supabase.from('messaging_messages')
    .update({ approval_status: 'pending', status: 'pending_approval', updated_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: id, action: 'submitted_for_approval',
    summary: `submitted ${message.name} for approval`, link: `/app/messaging/${message.channel}`, surface: message.channel,
  })
  revalidateMessaging()
  return { ok: true, message: 'Submitted for approval.' }
}

/**
 * Approver decision on a message in the queue. Approving returns the message
 * to `draft` so it can still be scheduled/sent deliberately — approval does
 * not itself trigger a send.
 */
export async function reviewMessageApproval(id: string, decision: 'approve' | 'reject' | 'request_changes', note?: string): Promise<ActionResult> {
  const { session, error } = await authorise('approve')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: message } = await supabase.from('messaging_messages')
    .select('id, name, channel, approval_status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!message) return fail('Message not found in this workspace.')
  if (message.approval_status !== 'pending') return fail('This message is not awaiting approval.')

  const nextApproval = { approve: 'approved', reject: 'rejected', request_changes: 'changes_requested' }[decision]
  const nextStatus = decision === 'approve' ? 'draft' : decision === 'reject' ? 'cancelled' : 'draft'

  const { error: updateError } = await supabase.from('messaging_messages')
    .update({ approval_status: nextApproval, status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'message', entityId: id, action: `approval_${nextApproval}`,
    summary: `${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'requested changes to'} ${message.name}${note ? `: ${note.slice(0, 200)}` : ''}`,
    link: `/app/messaging/${message.channel}`, surface: message.channel,
  })
  revalidateMessaging()
  return { ok: true, message: decision === 'approve' ? 'Message approved.' : decision === 'reject' ? 'Message rejected.' : 'Changes requested.' }
}

// ============================================================================
// Channel configuration
// ============================================================================

/**
 * Re-checks whether Email/SMS have real provider credentials configured on
 * this deployment and persists the result. This does NOT store secrets —
 * credentials live only in server environment variables; actually sending
 * through WhatsApp/RCS/Push still requires a real adapter to be built for
 * that provider (see `src/lib/messaging/providers/unconnected.ts`), so only
 * the channels with a real adapter (Email, SMS) can ever show "Connected".
 */
export async function refreshChannelHealth(): Promise<ActionResult> {
  const { session, error } = await authorise('manageChannels')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { getChannelProvider } = await import('@/lib/messaging/providers')
  const checks: { channel: 'email' | 'sms'; provider: string }[] = [
    { channel: 'email', provider: 'Resend' }, { channel: 'sms', provider: 'Twilio' },
  ]

  const results: string[] = []
  for (const { channel, provider } of checks) {
    const configured = getChannelProvider(channel).isConfigured()
    const { error: upsertError } = await supabase.from('messaging_channel_configs').upsert({
      workspace_id: ctx.workspaceId, channel,
      status: configured ? 'connected' : 'not_connected',
      provider: configured ? provider : null,
      connected_at: configured ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,channel' })
    if (upsertError) return fail(upsertError.message)
    results.push(`${channel}: ${configured ? 'connected' : 'not connected'}`)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'channel', action: 'health_checked',
    summary: `checked channel health (${results.join(', ')})`, surface: 'channels',
  })
  revalidateMessaging()
  return { ok: true, message: `Checked. ${results.join(' · ')}.` }
}

// ============================================================================
// Audiences
// ============================================================================

export async function createAudience(input: { name: string; description?: string; pastedContacts: string; channel: MessagingChannel }): Promise<ActionResult> {
  const { session, error } = await authorise('manageAudience')
  if (!session) return fail(error)
  const name = input.name?.trim()
  if (!name) return fail('Audience name is required.')

  const { supabase, ctx, userId } = session

  const lines = input.pastedContacts.split(/[\n,]/).map(l => l.trim()).filter(Boolean)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneRe = /^\+?[0-9][0-9\s-]{6,}$/
  const isEmail = input.channel === 'email'

  const valid: string[] = []
  let invalidCount = 0
  for (const line of lines) {
    if (isEmail ? emailRe.test(line) : phoneRe.test(line)) valid.push(line)
    else invalidCount += 1
  }
  if (valid.length === 0) return fail('No valid contacts were found in the pasted list.')
  if (valid.length > 5000) return fail('Audiences created this way are limited to 5,000 contacts — use import for larger lists.')

  const { data: audience, error: audienceError } = await supabase.from('messaging_audiences').insert({
    workspace_id: ctx.workspaceId, name, description: input.description?.trim() || null,
    segment_type: 'static', owner_id: userId, contact_count: 0,
  }).select('id, name').single()
  if (audienceError) return fail(audienceError.message)

  const contactPayload = valid.map(value => ({
    workspace_id: ctx.workspaceId,
    email: isEmail ? value : null,
    phone: !isEmail ? value : null,
    source: 'manual',
    email_consent: isEmail, sms_consent: !isEmail && input.channel === 'sms',
    whatsapp_consent: !isEmail && input.channel === 'whatsapp', rcs_consent: !isEmail && input.channel === 'rcs',
  }))
  const { data: contacts, error: contactsError } = await supabase.from('messaging_contacts').insert(contactPayload).select('id')
  if (contactsError) return fail(contactsError.message)

  await supabase.from('messaging_audience_members').insert((contacts ?? []).map(c => ({ audience_id: audience.id, contact_id: c.id })))
  await supabase.from('messaging_audiences').update({ contact_count: contacts?.length ?? 0 }).eq('id', audience.id)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'audience', entityId: audience.id, action: 'created',
    summary: `created audience ${audience.name} with ${contacts?.length ?? 0} contacts`, surface: 'audience',
    metadata: { invalid: invalidCount },
  })

  revalidateMessaging()
  return {
    ok: true, id: audience.id,
    message: `${audience.name} created with ${contacts?.length ?? 0} contacts${invalidCount > 0 ? ` (${invalidCount} invalid rows skipped)` : ''}. Consent is recorded as given by whoever pasted this list — confirm real opt-in before sending.`,
  }
}

// ============================================================================
// Templates
// ============================================================================

export interface TemplateInput {
  name: string
  channel: MessagingChannel
  category?: string
  content: MessageContentInput
}

export async function createMessagingTemplate(input: TemplateInput): Promise<ActionResult> {
  const { session, error } = await authorise('manageTemplates')
  if (!session) return fail(error)
  const name = input.name?.trim()
  if (!name) return fail('Template name is required.')
  if (!input.content?.body?.trim()) return fail('Template content is required.')

  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('messaging_templates').insert({
    workspace_id: ctx.workspaceId, name, channel: input.channel, category: input.category || 'lifecycle',
    content: contentToJsonb(input.channel, input.content), owner_id: userId, status: 'draft',
  }).select('id, name').single()
  if (insertError) return fail(insertError.message)

  await supabase.from('messaging_template_versions').insert({ template_id: data.id, version_number: 1, content: contentToJsonb(input.channel, input.content), created_by: userId })

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: data.id, action: 'created', summary: `created template ${data.name}`,
    link: '/app/messaging/templates', surface: 'templates',
  })
  revalidateMessaging()
  return { ok: true, id: data.id, message: `${data.name} created as a draft.` }
}

const TEMPLATE_TRANSITIONS: Record<string, string[]> = {
  submit_review: ['draft'], publish: ['draft', 'in_review'], archive: ['draft', 'in_review', 'published'],
}

export async function setMessagingTemplateStatus(id: string, intent: 'submit_review' | 'publish' | 'archive'): Promise<ActionResult> {
  const needsApproval = intent === 'publish'
  const { session, error } = await authorise(needsApproval ? 'approveTemplates' : 'manageTemplates')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: template } = await supabase.from('messaging_templates').select('id, name, status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!template) return fail('Template not found in this workspace.')
  if (!TEMPLATE_TRANSITIONS[intent].includes(template.status)) return fail(`A ${template.status.replace('_', ' ')} template cannot be ${intent.replace('_', ' ')}d.`)

  const nextStatus = { submit_review: 'in_review', publish: 'published', archive: 'archived' }[intent]
  const { error: updateError } = await supabase.from('messaging_templates')
    .update({ status: nextStatus, updated_at: new Date().toISOString(), archived_at: intent === 'archive' ? new Date().toISOString() : null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: id, action: intent, summary: `${intent.replace('_', ' ')} template ${template.name}`,
    link: '/app/messaging/templates', surface: 'templates',
  })
  revalidateMessaging()
  return { ok: true, message: `Template ${nextStatus.replace('_', ' ')}.` }
}

// ============================================================================
// Journeys
// ============================================================================

export interface JourneyStepInput {
  id: string
  type: 'trigger' | 'message' | 'wait' | 'condition' | 'end'
  channel?: MessagingChannel
  content?: MessageContentInput
  waitHours?: number
  conditionLabel?: string
  /** When set, the journey engine evaluates a real delivery event instead of passing through. */
  conditionType?: 'opened_previous' | 'clicked_previous'
  triggerLabel?: string
}

export interface JourneyInput {
  name: string
  description?: string
  journeyType?: string
  audienceId?: string
  steps: JourneyStepInput[]
}

export async function createJourney(input: JourneyInput): Promise<ActionResult> {
  const { session, error } = await authorise('manageJourneys')
  if (!session) return fail(error)
  const name = input.name?.trim()
  if (!name) return fail('Journey name is required.')
  if (input.steps.length === 0) return fail('Add at least one step.')

  const { supabase, ctx, userId } = session
  const nodes = input.steps.map((step, index) => ({ ...step, order: index }))
  const edges = input.steps.slice(0, -1).map((step, index) => ({ from: step.id, to: input.steps[index + 1].id }))

  const { data, error: insertError } = await supabase.from('messaging_journeys').insert({
    workspace_id: ctx.workspaceId, name, description: input.description?.trim() || null,
    journey_type: input.journeyType || 'lifecycle', audience_id: input.audienceId || null,
    canvas: { nodes, edges }, owner_id: userId, status: 'draft',
  }).select('id, name').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'journey', entityId: data.id, action: 'created', summary: `created journey ${data.name}`,
    link: '/app/messaging/journeys', surface: 'journeys',
  })
  revalidateMessaging()
  return { ok: true, id: data.id, message: `${data.name} created as a draft.` }
}

export async function updateJourneySteps(id: string, steps: JourneyStepInput[]): Promise<ActionResult> {
  const { session, error } = await authorise('manageJourneys')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  if (!await ownsRecord(supabase, 'messaging_journeys', id, ctx.workspaceId)) return fail('Journey not found in this workspace.')

  const nodes = steps.map((step, index) => ({ ...step, order: index }))
  const edges = steps.slice(0, -1).map((step, index) => ({ from: step.id, to: steps[index + 1].id }))

  const { error: updateError } = await supabase.from('messaging_journeys')
    .update({ canvas: { nodes, edges }, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, { entityType: 'journey', entityId: id, action: 'updated', summary: 'updated journey steps', link: '/app/messaging/journeys', surface: 'journeys' })
  revalidateMessaging()
  return { ok: true, message: 'Journey updated.' }
}

export async function setJourneyStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<ActionResult> {
  const { session, error } = await authorise(status === 'active' ? 'activateJourneys' : 'manageJourneys')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: journey } = await supabase.from('messaging_journeys').select('id, name, canvas, audience_id, status').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!journey) return fail('Journey not found in this workspace.')
  if (status === 'active') {
    const canvas = journey.canvas as { nodes?: unknown[] }
    if (!canvas?.nodes?.length) return fail('Add at least one step before activating.')
    if (!journey.audience_id) return fail('Choose an entry audience before activating.')
  }

  const { error: updateError } = await supabase.from('messaging_journeys')
    .update({ status, last_launch_at: status === 'active' ? new Date().toISOString() : undefined, updated_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'journey', entityId: id, action: status, summary: `${status} journey ${journey.name}`,
    link: '/app/messaging/journeys', surface: 'journeys',
  })
  revalidateMessaging()
  return { ok: true, message: `Journey ${status}.` }
}
