import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getChannelProvider } from './providers'
import type { RenderedContent, SendRecipient } from './providers/types'
import type { MessagingChannel } from './constants'

interface ContactForSend {
  id: string
  email: string | null
  phone: string | null
  whatsapp_id: string | null
  push_token: string | null
  rcs_id: string | null
  email_consent: boolean
  sms_consent: boolean
  whatsapp_consent: boolean
  push_consent: boolean
  rcs_consent: boolean
  unsubscribed_at: string | null
  do_not_contact: boolean
}

const CONSENT_FIELD: Record<MessagingChannel, keyof ContactForSend> = {
  email: 'email_consent', sms: 'sms_consent', whatsapp: 'whatsapp_consent', rcs: 'rcs_consent', push: 'push_consent',
}
const ADDRESS_FIELD: Record<MessagingChannel, keyof ContactForSend> = {
  email: 'email', sms: 'phone', whatsapp: 'whatsapp_id', rcs: 'rcs_id', push: 'push_token',
}

export interface EligibilityResult { eligible: boolean; reason?: string }

/**
 * Consent + suppression gate a message must pass before any provider call.
 * This runs again at send time (not only at audience-build time) so a
 * contact who unsubscribed between scheduling and sending is still protected.
 */
export function checkEligibility(contact: ContactForSend, channel: MessagingChannel): EligibilityResult {
  if (contact.do_not_contact) return { eligible: false, reason: 'Contact is marked do-not-contact.' }
  if (contact.unsubscribed_at) return { eligible: false, reason: 'Contact has unsubscribed.' }
  if (!contact[CONSENT_FIELD[channel]]) return { eligible: false, reason: `No ${channel} consent on file for this contact.` }
  if (!contact[ADDRESS_FIELD[channel]]) return { eligible: false, reason: `No ${channel} address on file for this contact.` }
  return { eligible: true }
}

async function isSuppressed(supabase: SupabaseClient, workspaceId: string, contactId: string, channel: MessagingChannel): Promise<boolean> {
  const { data } = await supabase.from('messaging_suppressions')
    .select('id').eq('workspace_id', workspaceId).eq('contact_id', contactId).eq('channel', channel).limit(1).maybeSingle()
  return Boolean(data)
}

function toRecipient(contact: ContactForSend): SendRecipient {
  return {
    contactId: contact.id, email: contact.email, phone: contact.phone,
    whatsappId: contact.whatsapp_id, pushToken: contact.push_token, rcsId: contact.rcs_id,
  }
}

interface DispatchOptions {
  workspaceId: string
  messageId: string
  channel: MessagingChannel
  senderId: string | null
  content: RenderedContent
  isTest: boolean
}

/**
 * Sends to one contact through the channel's provider adapter and records the
 * outcome as a delivery event. Idempotent per (message, contact): a contact
 * who already has a `sent` event for this message is skipped rather than
 * re-sent, so a retried dispatch or a duplicate journey tick never double-sends.
 */
export async function sendToContact(
  supabase: SupabaseClient, opts: DispatchOptions, contact: ContactForSend,
): Promise<{ status: 'sent' | 'skipped' | 'failed' | 'not_connected'; reason?: string }> {
  const { workspaceId, messageId, channel, isTest } = opts

  if (!isTest) {
    const { data: existing } = await supabase.from('messaging_delivery_events')
      .select('id').eq('message_id', messageId).eq('contact_id', contact.id).eq('event_type', 'sent').limit(1).maybeSingle()
    if (existing) return { status: 'skipped', reason: 'Already sent to this contact.' }

    if (await isSuppressed(supabase, workspaceId, contact.id, channel)) {
      return { status: 'skipped', reason: 'Contact is suppressed on this channel.' }
    }
    const eligibility = checkEligibility(contact, channel)
    if (!eligibility.eligible) return { status: 'skipped', reason: eligibility.reason }
  }

  const provider = getChannelProvider(channel)
  const outcome = await provider.send({
    workspaceId, messageId, channel, senderId: opts.senderId,
    recipient: toRecipient(contact), content: opts.content, isTest,
  })

  if (outcome.status === 'sent') {
    await supabase.from('messaging_delivery_events').insert({
      workspace_id: workspaceId, message_id: messageId, contact_id: contact.id, channel,
      event_type: 'sent', provider_message_id: outcome.providerMessageId, metadata: { is_test: isTest },
    })
    return { status: 'sent' }
  }
  if (outcome.status === 'not_connected') return { status: 'not_connected', reason: outcome.reason }

  await supabase.from('messaging_delivery_events').insert({
    workspace_id: workspaceId, message_id: messageId, contact_id: contact.id, channel,
    event_type: 'failed', metadata: { is_test: isTest, reason: outcome.reason },
  })
  return { status: 'failed', reason: outcome.reason }
}

/** Recomputes a message's rollup counters from its own delivery events. */
export async function recountMessageStats(supabase: SupabaseClient, messageId: string) {
  const { data } = await supabase.from('messaging_delivery_events').select('event_type').eq('message_id', messageId)
  const counts = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, opt_out: 0, failed: 0 }
  for (const row of data ?? []) {
    const type = row.event_type as string
    if (type === 'sent' || type === 'accepted') counts.sent += 1
    if (type === 'delivered') counts.delivered += 1
    if (type === 'opened' || type === 'read') counts.opened += 1
    if (type === 'clicked') counts.clicked += 1
    if (type === 'converted') counts.converted += 1
    if (type === 'opted_out') counts.opt_out += 1
    if (type === 'failed' || type === 'bounced' || type === 'rejected') counts.failed += 1
  }
  await supabase.from('messaging_messages').update({
    sent_count: counts.sent, delivered_count: counts.delivered || counts.sent, opened_count: counts.opened,
    clicked_count: counts.clicked, converted_count: counts.converted, opt_out_count: counts.opt_out,
    failed_count: counts.failed, updated_at: new Date().toISOString(),
  }).eq('id', messageId)
}
