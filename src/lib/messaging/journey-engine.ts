import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendToContact, recountMessageStats } from './send'
import type { MessagingChannel } from './constants'
import type { RenderedContent } from './providers/types'

interface JourneyNode {
  id: string
  type: 'trigger' | 'message' | 'wait' | 'condition' | 'end'
  channel?: MessagingChannel
  content?: { subject?: string; body: string; headline?: string }
  waitHours?: number
  conditionType?: 'opened_previous' | 'clicked_previous'
  order: number
}
interface JourneyEdge { from: string; to: string }
interface JourneyCanvas { nodes: JourneyNode[]; edges: JourneyEdge[] }

interface JourneyRecord {
  id: string
  workspace_id: string
  canvas: JourneyCanvas
  audience_id: string | null
  total_entered: number
}

function nextNodeId(canvas: JourneyCanvas, currentId: string | null): string | null {
  if (currentId === null) return canvas.nodes[0]?.id ?? null
  const edge = canvas.edges.find(e => e.from === currentId)
  return edge?.to ?? null
}

function previousNodeId(canvas: JourneyCanvas, currentId: string): string | null {
  const edge = canvas.edges.find(e => e.to === currentId)
  return edge?.from ?? null
}

/** Walks backward from a condition node to the nearest preceding message step. */
function previousMessageNode(canvas: JourneyCanvas, conditionNodeId: string): JourneyNode | null {
  let cursor = previousNodeId(canvas, conditionNodeId)
  const visited = new Set<string>()
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor)
    const node = canvas.nodes.find(n => n.id === cursor)
    if (!node) return null
    if (node.type === 'message') return node
    cursor = previousNodeId(canvas, cursor)
  }
  return null
}

/**
 * Enrols contacts from a journey's entry audience who have not already
 * entered. Runs before every tick's advance pass so newly added audience
 * members are picked up without a separate "sync audience" step.
 */
async function enrolNewParticipants(supabase: SupabaseClient, journey: JourneyRecord): Promise<number> {
  if (!journey.audience_id || journey.canvas.nodes.length === 0) return 0

  const { data: members } = await supabase.from('messaging_audience_members')
    .select('contact_id').eq('audience_id', journey.audience_id)
  const memberIds = (members ?? []).map(m => m.contact_id as string)
  if (memberIds.length === 0) return 0

  const { data: existing } = await supabase.from('messaging_journey_participants')
    .select('contact_id').eq('journey_id', journey.id).in('contact_id', memberIds)
  const existingIds = new Set((existing ?? []).map(e => e.contact_id as string))

  const toEnrol = memberIds.filter(id => !existingIds.has(id))
  if (toEnrol.length === 0) return 0

  // The trigger node is entry-only bookkeeping; participants start at the
  // first actionable step after it.
  const triggerNode = journey.canvas.nodes.find(n => n.type === 'trigger')
  const startNodeId = triggerNode ? nextNodeId(journey.canvas, triggerNode.id) : journey.canvas.nodes[0]?.id ?? null

  await supabase.from('messaging_journey_participants').insert(
    toEnrol.map(contactId => ({ journey_id: journey.id, contact_id: contactId, status: 'active', current_node_id: startNodeId })),
  )
  return toEnrol.length
}

/** Ensures a draft message exists for a journey's message node, reusing one across ticks. */
async function ensureNodeMessage(
  supabase: SupabaseClient, journey: JourneyRecord, node: JourneyNode,
): Promise<{ id: string; senderId: string | null } | null> {
  if (!node.channel || !node.content) return null
  const key = `journey:${journey.id}:node:${node.id}`
  const { data: existing } = await supabase.from('messaging_messages')
    .select('id, sender_id').eq('workspace_id', journey.workspace_id).eq('journey_id', journey.id)
    .eq('message_type', 'journey').contains('content', { _journeyNodeKey: key }).maybeSingle()
  if (existing) return { id: existing.id, senderId: existing.sender_id }

  const { data: created } = await supabase.from('messaging_messages').insert({
    workspace_id: journey.workspace_id, channel: node.channel, name: `Journey step — ${node.id}`,
    message_type: 'journey', status: 'sending', journey_id: journey.id,
    content: { ...node.content, _journeyNodeKey: key }, subject: node.content.subject ?? null,
  }).select('id, sender_id').single()
  return created ? { id: created.id, senderId: created.sender_id } : null
}

/** Looks up (without creating) the message a journey node's sends were recorded under. */
async function findNodeMessageId(supabase: SupabaseClient, journey: JourneyRecord, node: JourneyNode): Promise<string | null> {
  const key = `journey:${journey.id}:node:${node.id}`
  const { data } = await supabase.from('messaging_messages')
    .select('id').eq('workspace_id', journey.workspace_id).eq('journey_id', journey.id)
    .eq('message_type', 'journey').contains('content', { _journeyNodeKey: key }).maybeSingle()
  return data?.id ?? null
}

/**
 * Evaluates a condition node against real delivery events for the contact's
 * most recent preceding message step — never a placeholder pass-through.
 * Returns true when no real condition is configured, so an untyped condition
 * step still behaves as documented (informational only) rather than blocking.
 */
async function evaluateCondition(
  supabase: SupabaseClient, journey: JourneyRecord, node: JourneyNode, contactId: string,
): Promise<boolean> {
  if (!node.conditionType) return true
  const messageNode = previousMessageNode(journey.canvas, node.id)
  if (!messageNode) return true
  const messageId = await findNodeMessageId(supabase, journey, messageNode)
  if (!messageId) return false

  const eventType = node.conditionType === 'opened_previous' ? 'opened' : 'clicked'
  const { data } = await supabase.from('messaging_delivery_events')
    .select('id').eq('message_id', messageId).eq('contact_id', contactId).eq('event_type', eventType).limit(1).maybeSingle()
  return Boolean(data)
}

async function advanceParticipants(supabase: SupabaseClient, journey: JourneyRecord): Promise<{ advanced: number; sent: number }> {
  const { data: participants } = await supabase.from('messaging_journey_participants')
    .select('id, contact_id, status, current_node_id, metadata, messaging_contacts(id, email, phone, whatsapp_id, push_token, rcs_id, email_consent, sms_consent, whatsapp_consent, push_consent, rcs_consent, unsubscribed_at, do_not_contact)')
    .eq('journey_id', journey.id).in('status', ['active', 'waiting'])
  if (!participants?.length) return { advanced: 0, sent: 0 }

  let advanced = 0, sent = 0
  const now = Date.now()

  for (const participant of participants) {
    const contact = Array.isArray(participant.messaging_contacts) ? participant.messaging_contacts[0] : participant.messaging_contacts
    if (!contact) continue
    const node = journey.canvas.nodes.find(n => n.id === participant.current_node_id)

    if (!node) {
      await supabase.from('messaging_journey_participants')
        .update({ status: 'exited', exited_at: new Date().toISOString() }).eq('id', participant.id)
      continue
    }

    if (node.type === 'wait') {
      const metadata = (participant.metadata ?? {}) as { wait_until?: string }
      if (!metadata.wait_until) {
        const waitUntil = new Date(now + (node.waitHours ?? 24) * 3_600_000).toISOString()
        await supabase.from('messaging_journey_participants')
          .update({ status: 'waiting', metadata: { ...metadata, wait_until: waitUntil } }).eq('id', participant.id)
        continue
      }
      if (Date.parse(metadata.wait_until) > now) continue

      const next = nextNodeId(journey.canvas, node.id)
      await supabase.from('messaging_journey_participants')
        .update({ status: next ? 'active' : 'exited', current_node_id: next, exited_at: next ? null : new Date().toISOString(), metadata: {} })
        .eq('id', participant.id)
      advanced += 1
      continue
    }

    if (node.type === 'message' && node.channel && node.content) {
      const message = await ensureNodeMessage(supabase, journey, node)
      if (message) {
        const rendered: RenderedContent = { subject: node.content.subject, body: node.content.body }
        const outcome = await sendToContact(supabase, {
          workspaceId: journey.workspace_id, messageId: message.id, channel: node.channel,
          senderId: message.senderId, content: rendered, isTest: false,
        }, contact)
        if (outcome.status === 'sent') sent += 1
        await recountMessageStats(supabase, message.id)
      }

      const next = nextNodeId(journey.canvas, node.id)
      await supabase.from('messaging_journey_participants')
        .update({ status: next ? 'active' : 'exited', current_node_id: next, exited_at: next ? null : new Date().toISOString() })
        .eq('id', participant.id)
      advanced += 1
      continue
    }

    if (node.type === 'condition') {
      const met = await evaluateCondition(supabase, journey, node, contact.id)
      if (!met) {
        await supabase.from('messaging_journey_participants')
          .update({ status: 'exited', exited_at: new Date().toISOString(), metadata: { exit_reason: `condition not met: ${node.conditionType ?? node.id}` } })
          .eq('id', participant.id)
        advanced += 1
        continue
      }
      const next = nextNodeId(journey.canvas, node.id)
      await supabase.from('messaging_journey_participants')
        .update({ status: next ? 'active' : 'exited', current_node_id: next, exited_at: next ? null : new Date().toISOString() })
        .eq('id', participant.id)
      advanced += 1
      continue
    }

    // Trigger / end nodes carry no behaviour of their own — just pass through.
    const next = nextNodeId(journey.canvas, node.id)
    await supabase.from('messaging_journey_participants')
      .update({ status: next ? 'active' : 'exited', current_node_id: next, exited_at: next ? null : new Date().toISOString() })
      .eq('id', participant.id)
    advanced += 1
  }

  return { advanced, sent }
}

export interface JourneyTickResult {
  journeysProcessed: number
  participantsEnrolled: number
  participantsAdvanced: number
  messagesSent: number
}

/**
 * One tick of the journey engine: enrol newly-eligible contacts, advance every
 * active/waiting participant one step, send any message steps that are due.
 * Designed to be invoked on a schedule (see /api/messaging/journeys/tick) —
 * every step re-checks consent and suppression at send time via `sendToContact`.
 */
export async function runJourneyEngineTick(supabase: SupabaseClient): Promise<JourneyTickResult> {
  const { data: journeys } = await supabase.from('messaging_journeys')
    .select('id, workspace_id, canvas, audience_id, total_entered').eq('status', 'active')

  const result: JourneyTickResult = { journeysProcessed: 0, participantsEnrolled: 0, participantsAdvanced: 0, messagesSent: 0 }
  if (!journeys?.length) return result

  for (const journey of journeys as unknown as JourneyRecord[]) {
    const enrolled = await enrolNewParticipants(supabase, journey)
    const { advanced, sent } = await advanceParticipants(supabase, journey)

    const { count: inFlow } = await supabase.from('messaging_journey_participants')
      .select('id', { count: 'exact', head: true }).eq('journey_id', journey.id).in('status', ['active', 'waiting'])
    const { count: totalEntered } = await supabase.from('messaging_journey_participants')
      .select('id', { count: 'exact', head: true }).eq('journey_id', journey.id)
    const { count: exited } = await supabase.from('messaging_journey_participants')
      .select('id', { count: 'exact', head: true }).eq('journey_id', journey.id).eq('status', 'exited')

    await supabase.from('messaging_journeys').update({
      contacts_in_flow: inFlow ?? 0,
      total_entered: totalEntered ?? journey.total_entered,
      on_track_rate: totalEntered ? Math.round(((totalEntered - (exited ?? 0)) / totalEntered) * 100) : 0,
    }).eq('id', journey.id)

    result.journeysProcessed += 1
    result.participantsEnrolled += enrolled
    result.participantsAdvanced += advanced
    result.messagesSent += sent
  }

  return result
}
