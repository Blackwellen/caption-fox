'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getReputationSession, requireReputationAccess, type ReputationSession } from '@/lib/reputation/server'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import { emailProvider } from '@/lib/messaging/providers/email'
import { runReputationAi } from '@/lib/reputation/ai'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

const REPUTATION_PATHS = [
  '/app/reputation', '/app/reputation/media-lists', '/app/reputation/pitches',
  '/app/reputation/press-room', '/app/reputation/coverage', '/app/reputation/reviews',
  '/app/reputation/crisis',
]

function revalidateReputation() {
  for (const path of REPUTATION_PATHS) revalidatePath(path)
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

async function authorise(permission: Permission) {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, permission)
  if (!access.allowed) return { session: null, error: access.message ?? 'Not allowed.' } as const
  return { session, error: null } as const
}

async function ownsRecord(supabase: SupabaseClient, table: string, id: string, workspaceId: string): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

async function logActivity(
  supabase: SupabaseClient, workspaceId: string, actorId: string,
  entry: { entityType: string; entityId?: string | null; action: string; summary: string; link?: string | null; metadata?: Record<string, unknown> },
) {
  const { error } = await supabase.from('reputation_activity').insert({
    workspace_id: workspaceId, actor_id: actorId,
    entity_type: entry.entityType, entity_id: entry.entityId ?? null,
    action: entry.action, summary: entry.summary, link: entry.link ?? null,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[reputation] activity log failed', error.message)
}

// ============================================================================
// Media Contacts
// ============================================================================

export interface MediaContactInput {
  name: string
  email?: string
  outlet_id?: string
  role_title?: string
  beat?: string
  region?: string
  relationship_stage?: string
  notes?: string
}

export async function createMediaContact(input: MediaContactInput): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_MEDIA_CONTACTS_MANAGE)
  if (!session) return fail(error)
  if (!input.name.trim()) return fail('A contact name is required.')

  const { data, error: insertError } = await session.supabase.from('media_contacts').insert({
    workspace_id: session.workspaceId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    outlet_id: input.outlet_id || null,
    role_title: input.role_title?.trim() || null,
    beat: input.beat?.trim() || null,
    region: input.region?.trim() || null,
    relationship_stage: input.relationship_stage || 'new',
    notes: input.notes?.trim() || null,
    owner_id: session.userId,
    created_by: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'media_contact', entityId: data.id, action: 'created',
    summary: `Added media contact "${input.name.trim()}"`, link: '/app/reputation/media-lists',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Media contact added.' }
}

export async function updateMediaContactStage(id: string, stage: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_MEDIA_CONTACTS_MANAGE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'media_contacts', id, session.workspaceId))) return fail('Contact not found.')

  const { error: updateError } = await session.supabase.from('media_contacts')
    .update({ relationship_stage: stage, updated_at: new Date().toISOString() }).eq('id', id)
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'media_contact', entityId: id, action: 'stage_changed', summary: `Relationship stage set to ${stage.replace(/_/g, ' ')}`,
  })
  revalidateReputation()
  return { ok: true, message: 'Contact updated.' }
}

// ============================================================================
// Media Lists
// ============================================================================

export async function createMediaList(input: { name: string; description?: string; region?: string; beat?: string }): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_MEDIA_LISTS_MANAGE)
  if (!session) return fail(error)
  if (!input.name.trim()) return fail('A list name is required.')

  const { data, error: insertError } = await session.supabase.from('media_lists').insert({
    workspace_id: session.workspaceId, name: input.name.trim(), description: input.description?.trim() || null,
    region: input.region?.trim() || null, beat: input.beat?.trim() || null,
    owner_id: session.userId, created_by: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'media_list', entityId: data.id, action: 'created', summary: `Created media list "${input.name.trim()}"`, link: '/app/reputation/media-lists',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Media list created.' }
}

export async function addContactToList(listId: string, mediaContactId: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_MEDIA_LISTS_MANAGE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'media_lists', listId, session.workspaceId))) return fail('List not found.')
  if (!(await ownsRecord(session.supabase, 'media_contacts', mediaContactId, session.workspaceId))) return fail('Contact not found.')

  const { error: insertError } = await session.supabase.from('media_list_members')
    .upsert({ workspace_id: session.workspaceId, list_id: listId, media_contact_id: mediaContactId }, { onConflict: 'list_id,media_contact_id' })
  if (insertError) return fail(insertError.message)
  revalidateReputation()
  return { ok: true, message: 'Contact added to list.' }
}

export async function removeContactFromList(listId: string, mediaContactId: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_MEDIA_LISTS_MANAGE)
  if (!session) return fail(error)
  const { error: deleteError } = await session.supabase.from('media_list_members')
    .delete().eq('workspace_id', session.workspaceId).eq('list_id', listId).eq('media_contact_id', mediaContactId)
  if (deleteError) return fail(deleteError.message)
  revalidateReputation()
  return { ok: true, message: 'Contact removed from list.' }
}

// ============================================================================
// Pitches
// ============================================================================

export interface PitchInput { name: string; subject: string; body: string; list_id?: string }

export async function createPitch(input: PitchInput): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PITCHES_CREATE)
  if (!session) return fail(error)
  if (!input.name.trim()) return fail('A pitch name is required.')

  const { data, error: insertError } = await session.supabase.from('pitches').insert({
    workspace_id: session.workspaceId, name: input.name.trim(), subject: input.subject.trim(),
    body: input.body.trim(), list_id: input.list_id || null, status: 'draft',
    owner_id: session.userId, created_by: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)

  if (input.list_id) {
    const { data: members } = await session.supabase.from('media_list_members').select('media_contact_id').eq('list_id', input.list_id)
    if (members && members.length > 0) {
      await session.supabase.from('pitch_recipients').insert(
        members.map(m => ({ workspace_id: session.workspaceId, pitch_id: data.id, media_contact_id: m.media_contact_id, delivery_status: 'pending' })),
      )
    }
  }

  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'pitch', entityId: data.id, action: 'created', summary: `Drafted pitch "${input.name.trim()}"`, link: '/app/reputation/pitches',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Pitch created as a draft.' }
}

export async function submitPitchForApproval(id: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PITCHES_EDIT)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'pitches', id, session.workspaceId))) return fail('Pitch not found.')

  const { error: updateError } = await session.supabase.from('pitches')
    .update({ status: 'pending_approval', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft')
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'pitch', entityId: id, action: 'submitted_for_approval', summary: 'Pitch submitted for approval',
  })
  revalidateReputation()
  return { ok: true, message: 'Submitted for approval.' }
}

export async function approvePitch(id: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PITCHES_APPROVE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'pitches', id, session.workspaceId))) return fail('Pitch not found.')

  const { error: updateError } = await session.supabase.from('pitches')
    .update({ status: 'approved', approved_by: session.userId, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending_approval')
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'pitch', entityId: id, action: 'approved', summary: 'Pitch approved',
  })
  revalidateReputation()
  return { ok: true, message: 'Pitch approved.' }
}

/**
 * Real send: reuses the Messaging module's email provider (Resend). Never
 * marks a recipient as sent unless the provider actually reported success —
 * if RESEND_API_KEY / MESSAGING_EMAIL_FROM are not configured, this returns
 * a clear "not connected" error rather than faking delivery.
 */
export async function sendPitch(id: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PITCHES_SEND)
  if (!session) return fail(error)

  const { data: pitch } = await session.supabase.from('pitches').select('id, subject, body, status').eq('id', id).eq('workspace_id', session.workspaceId).maybeSingle()
  if (!pitch) return fail('Pitch not found.')
  if (!['approved', 'paused'].includes(pitch.status)) return fail('Only approved pitches can be sent.')

  if (!emailProvider.isConfigured()) {
    return fail('No email provider is connected for this workspace. Connect one in Messaging → Settings → Channels before sending pitches.')
  }

  const { data: recipients } = await session.supabase
    .from('pitch_recipients').select('id, media_contact_id, delivery_status, media_contacts(email, name)')
    .eq('pitch_id', id).eq('delivery_status', 'pending')
  if (!recipients || recipients.length === 0) return fail('This pitch has no pending recipients to send to.')

  await session.supabase.from('pitches').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', id)

  let sent = 0
  let failed = 0
  for (const recipient of recipients as any[]) {
    const email = recipient.media_contacts?.email as string | null
    if (!email) { failed += 1; continue }
    const outcome = await emailProvider.send({
      workspaceId: session.workspaceId, messageId: id, channel: 'email', senderId: null,
      recipient: { contactId: recipient.media_contact_id, email },
      content: { subject: pitch.subject, body: pitch.body },
      isTest: false,
    })
    if (outcome.status === 'sent') {
      sent += 1
      await session.supabase.from('pitch_recipients').update({ delivery_status: 'sent', sent_at: new Date().toISOString() }).eq('id', recipient.id)
    } else {
      failed += 1
    }
  }

  const finalStatus = sent > 0 ? 'sent' : 'approved'
  await session.supabase.from('pitches').update({
    status: finalStatus, sent_at: sent > 0 ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }).eq('id', id)

  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'pitch', entityId: id, action: 'sent', summary: `Pitch sent to ${sent} recipient${sent === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''}`,
  })
  revalidateReputation()

  if (sent === 0) return fail(`Send failed for all ${failed} recipient(s) — check their email addresses and provider configuration.`)
  return { ok: true, message: `Sent to ${sent} recipient${sent === 1 ? '' : 's'}${failed > 0 ? `, ${failed} failed` : ''}.` }
}

// ============================================================================
// Press Releases
// ============================================================================

export async function createPressRelease(input: { title: string; subtitle?: string; body: string; category?: string }): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PRESS_ROOM_MANAGE)
  if (!session) return fail(error)
  if (!input.title.trim()) return fail('A title is required.')

  const { data, error: insertError } = await session.supabase.from('press_releases').insert({
    workspace_id: session.workspaceId, title: input.title.trim(), subtitle: input.subtitle?.trim() || null,
    body: input.body.trim(), category: input.category?.trim() || null, status: 'draft',
    author_id: session.userId, created_by: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'press_release', entityId: data.id, action: 'created', summary: `Drafted press release "${input.title.trim()}"`, link: '/app/reputation/press-room',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Press release drafted.' }
}

export async function setPressReleaseStatus(id: string, status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived'): Promise<ActionResult> {
  const permission = status === 'published' ? PERMISSIONS.REPUTATION_PRESS_ROOM_PUBLISH : PERMISSIONS.REPUTATION_PRESS_ROOM_MANAGE
  const { session, error } = await authorise(permission)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'press_releases', id, session.workspaceId))) return fail('Press release not found.')

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'published') patch.publish_date = new Date().toISOString().slice(0, 10)

  const { error: updateError } = await session.supabase.from('press_releases').update(patch).eq('id', id)
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'press_release', entityId: id, action: 'status_changed', summary: `Press release status set to ${status.replace(/_/g, ' ')}`,
  })
  revalidateReputation()
  return { ok: true, message: 'Press release updated.' }
}

// ============================================================================
// Coverage
// ============================================================================

export interface CoverageInput {
  publication: string; headline: string; url?: string; topic?: string
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed'; estimated_reach?: number
}

export async function createCoverageMention(input: CoverageInput): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_COVERAGE_MANAGE)
  if (!session) return fail(error)
  if (!input.publication.trim() || !input.headline.trim()) return fail('Publication and headline are required.')

  const { data, error: insertError } = await session.supabase.from('coverage_mentions').insert({
    workspace_id: session.workspaceId, publication: input.publication.trim(), headline: input.headline.trim(),
    url: input.url?.trim() || null, topic: input.topic?.trim() || null, sentiment: input.sentiment ?? 'neutral',
    estimated_reach: input.estimated_reach ?? null, source_type: 'manual', owner_id: session.userId, created_by: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'coverage_mention', entityId: data.id, action: 'tracked', summary: `Tracked coverage: "${input.headline.trim()}"`, link: '/app/reputation/coverage',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Coverage tracked.' }
}

// ============================================================================
// Reviews
// ============================================================================

export async function draftReviewResponse(reviewId: string, draftText: string, tone = 'professional'): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_REVIEWS_RESPOND)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'reviews', reviewId, session.workspaceId))) return fail('Review not found.')
  if (!draftText.trim()) return fail('A response cannot be empty.')

  const { data, error: insertError } = await session.supabase.from('review_responses').insert({
    workspace_id: session.workspaceId, review_id: reviewId, draft_text: draftText.trim(), tone, status: 'draft', author_id: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)
  await session.supabase.from('reviews').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', reviewId).eq('status', 'new')
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'review_response', entityId: data.id, action: 'drafted', summary: 'Drafted a review response',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Response drafted.' }
}

export async function publishReviewResponse(responseId: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_REVIEWS_RESPOND)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'review_responses', responseId, session.workspaceId))) return fail('Response not found.')

  const { data: response } = await session.supabase.from('review_responses').select('review_id').eq('id', responseId).single()
  const { error: updateError } = await session.supabase.from('review_responses')
    .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', responseId)
  if (updateError) return fail(updateError.message)
  if (response) await session.supabase.from('reviews').update({ status: 'responded', updated_at: new Date().toISOString() }).eq('id', response.review_id)

  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'review_response', entityId: responseId, action: 'published', summary: 'Published a review response',
  })
  revalidateReputation()
  return { ok: true, message: 'Response published.' }
}

export async function escalateReview(reviewId: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_REVIEWS_ESCALATE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'reviews', reviewId, session.workspaceId))) return fail('Review not found.')

  const { error: updateError } = await session.supabase.from('reviews').update({ status: 'escalated', updated_at: new Date().toISOString() }).eq('id', reviewId)
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'review', entityId: reviewId, action: 'escalated', summary: 'Review escalated',
  })
  revalidateReputation()
  return { ok: true, message: 'Review escalated.' }
}

// ============================================================================
// Crisis
// ============================================================================

export interface CrisisIncidentInput { title: string; description?: string; severity?: string; region?: string }

export async function createCrisisIncident(input: CrisisIncidentInput): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_CRISIS_CREATE)
  if (!session) return fail(error)
  if (!input.title.trim()) return fail('A title is required.')

  const { data, error: insertError } = await session.supabase.from('crisis_incidents').insert({
    workspace_id: session.workspaceId, title: input.title.trim(), description: input.description?.trim() || null,
    severity: input.severity ?? 'medium', region: input.region?.trim() || null, status: 'detected',
    owner_id: session.userId, created_by: session.userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)
  await session.supabase.from('crisis_timeline_events').insert({
    workspace_id: session.workspaceId, incident_id: data.id, event_type: 'detected',
    summary: 'Incident logged.', actor_id: session.userId,
  })
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'crisis_incident', entityId: data.id, action: 'created', summary: `Logged incident "${input.title.trim()}"`, link: '/app/reputation/crisis',
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Incident logged.' }
}

export async function setCrisisIncidentStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_CRISIS_MANAGE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'crisis_incidents', id, session.workspaceId))) return fail('Incident not found.')

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'resolved') patch.resolved_at = new Date().toISOString()

  const { error: updateError } = await session.supabase.from('crisis_incidents').update(patch).eq('id', id)
  if (updateError) return fail(updateError.message)
  await session.supabase.from('crisis_timeline_events').insert({
    workspace_id: session.workspaceId, incident_id: id, event_type: 'status_changed',
    summary: `Status changed to ${status.replace(/_/g, ' ')}.`, actor_id: session.userId,
  })
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'crisis_incident', entityId: id, action: 'status_changed', summary: `Incident status set to ${status.replace(/_/g, ' ')}`,
  })
  revalidateReputation()
  return { ok: true, message: 'Incident updated.' }
}

export async function addCrisisTimelineEvent(incidentId: string, summary: string, eventType = 'note'): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_CRISIS_MANAGE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'crisis_incidents', incidentId, session.workspaceId))) return fail('Incident not found.')
  if (!summary.trim()) return fail('A summary is required.')

  const { error: insertError } = await session.supabase.from('crisis_timeline_events').insert({
    workspace_id: session.workspaceId, incident_id: incidentId, event_type: eventType, summary: summary.trim(), actor_id: session.userId,
  })
  if (insertError) return fail(insertError.message)
  revalidateReputation()
  return { ok: true, message: 'Timeline updated.' }
}

export async function createCrisisStatement(incidentId: string, body: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_CRISIS_STATEMENTS_EDIT)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'crisis_incidents', incidentId, session.workspaceId))) return fail('Incident not found.')
  if (!body.trim()) return fail('Statement body cannot be empty.')

  const { data: existing } = await session.supabase.from('crisis_statements').select('version').eq('incident_id', incidentId).order('version', { ascending: false }).limit(1)
  const nextVersion = (existing?.[0]?.version ?? 0) + 1

  const { data, error: insertError } = await session.supabase.from('crisis_statements').insert({
    workspace_id: session.workspaceId, incident_id: incidentId, body: body.trim(), status: 'draft', version: nextVersion,
  }).select('id').single()
  if (insertError) return fail(insertError.message)

  await session.supabase.from('crisis_timeline_events').insert({
    workspace_id: session.workspaceId, incident_id: incidentId, event_type: 'statement_drafted',
    summary: `Statement drafted (v${nextVersion}).`, actor_id: session.userId,
  })
  revalidateReputation()
  return { ok: true, id: data.id, message: 'Statement drafted.' }
}

export async function setCrisisStatementStatus(id: string, status: 'draft' | 'legal_review' | 'approved' | 'published'): Promise<ActionResult> {
  const permission = status === 'approved' || status === 'published' ? PERMISSIONS.REPUTATION_CRISIS_STATEMENTS_APPROVE : PERMISSIONS.REPUTATION_CRISIS_STATEMENTS_EDIT
  const { session, error } = await authorise(permission)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'crisis_statements', id, session.workspaceId))) return fail('Statement not found.')

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'approved') { patch.approved_by = session.userId; patch.approved_at = new Date().toISOString() }
  if (status === 'published') patch.published_at = new Date().toISOString()

  const { data: statement, error: updateError } = await session.supabase.from('crisis_statements').update(patch).eq('id', id).select('incident_id').single()
  if (updateError) return fail(updateError.message)

  if (statement) {
    await session.supabase.from('crisis_timeline_events').insert({
      workspace_id: session.workspaceId, incident_id: statement.incident_id, event_type: 'statement_' + status,
      summary: `Statement ${status.replace(/_/g, ' ')}.`, actor_id: session.userId,
    })
  }
  revalidateReputation()
  return { ok: true, message: 'Statement updated.' }
}

// ============================================================================
// Edit-in-place
// ============================================================================

export async function updateMediaContact(id: string, input: MediaContactInput): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_MEDIA_CONTACTS_MANAGE)
  if (!session) return fail(error)
  if (!(await ownsRecord(session.supabase, 'media_contacts', id, session.workspaceId))) return fail('Contact not found.')
  if (!input.name.trim()) return fail('A contact name is required.')

  const { error: updateError } = await session.supabase.from('media_contacts').update({
    name: input.name.trim(), email: input.email?.trim() || null, role_title: input.role_title?.trim() || null,
    beat: input.beat?.trim() || null, region: input.region?.trim() || null, notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'media_contact', entityId: id, action: 'edited', summary: `Updated contact "${input.name.trim()}"`,
  })
  revalidateReputation()
  return { ok: true, message: 'Contact updated.' }
}

export async function updatePitchContent(id: string, input: { name: string; subject: string; body: string }): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PITCHES_EDIT)
  if (!session) return fail(error)
  const { data: pitch } = await session.supabase.from('pitches').select('status').eq('id', id).eq('workspace_id', session.workspaceId).maybeSingle()
  if (!pitch) return fail('Pitch not found.')
  if (pitch.status !== 'draft') return fail('Only draft pitches can be edited. Recall it to draft first if it was submitted in error.')
  if (!input.name.trim()) return fail('A pitch name is required.')

  const { error: updateError } = await session.supabase.from('pitches').update({
    name: input.name.trim(), subject: input.subject.trim(), body: input.body.trim(), updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'pitch', entityId: id, action: 'edited', summary: `Edited pitch "${input.name.trim()}"`,
  })
  revalidateReputation()
  return { ok: true, message: 'Pitch updated.' }
}

export async function updatePressReleaseContent(id: string, input: { title: string; subtitle?: string; body: string; category?: string }): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PRESS_ROOM_MANAGE)
  if (!session) return fail(error)
  const { data: release } = await session.supabase.from('press_releases').select('status').eq('id', id).eq('workspace_id', session.workspaceId).maybeSingle()
  if (!release) return fail('Press release not found.')
  if (release.status === 'published') return fail('Published releases cannot be edited — archive it and create a new one instead.')
  if (!input.title.trim()) return fail('A title is required.')

  const { error: updateError } = await session.supabase.from('press_releases').update({
    title: input.title.trim(), subtitle: input.subtitle?.trim() || null, body: input.body.trim(),
    category: input.category?.trim() || null, updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (updateError) return fail(updateError.message)
  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'press_release', entityId: id, action: 'edited', summary: `Edited press release "${input.title.trim()}"`,
  })
  revalidateReputation()
  return { ok: true, message: 'Press release updated.' }
}

// ============================================================================
// Coverage import (CSV)
// ============================================================================

/**
 * Parses a small pasted/uploaded CSV (publication,headline,url,topic,sentiment,estimated_reach)
 * and inserts real coverage_mentions rows. Deduplicates against existing rows by URL
 * within this workspace. No external service required.
 */
export async function importCoverageCsv(csvText: string): Promise<ActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_COVERAGE_IMPORT)
  if (!session) return fail(error)

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return fail('The file is empty.')

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const required = ['publication', 'headline']
  if (!required.every(col => header.includes(col))) {
    return fail('CSV must include at least "publication" and "headline" columns. Optional: url, topic, sentiment, estimated_reach.')
  }
  const idx = (col: string) => header.indexOf(col)

  const { data: existing } = await session.supabase.from('coverage_mentions').select('url').eq('workspace_id', session.workspaceId).not('url', 'is', null)
  const existingUrls = new Set((existing ?? []).map(r => r.url))

  const rows: Record<string, unknown>[] = []
  let skippedDuplicates = 0
  let skippedInvalid = 0

  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(c => c.trim())
    const publication = cols[idx('publication')]
    const headline = cols[idx('headline')]
    if (!publication || !headline) { skippedInvalid += 1; continue }

    const url = idx('url') >= 0 ? (cols[idx('url')] || null) : null
    if (url && existingUrls.has(url)) { skippedDuplicates += 1; continue }

    const sentimentRaw = idx('sentiment') >= 0 ? cols[idx('sentiment')]?.toLowerCase() : 'neutral'
    const sentiment = ['positive', 'neutral', 'negative', 'mixed'].includes(sentimentRaw ?? '') ? sentimentRaw : 'neutral'
    const reachRaw = idx('estimated_reach') >= 0 ? Number(cols[idx('estimated_reach')]) : NaN

    rows.push({
      workspace_id: session.workspaceId, publication, headline, url,
      topic: idx('topic') >= 0 ? (cols[idx('topic')] || null) : null,
      sentiment, estimated_reach: Number.isFinite(reachRaw) && reachRaw > 0 ? reachRaw : null,
      source_type: 'import', owner_id: session.userId, created_by: session.userId,
    })
    if (url) existingUrls.add(url)
  }

  if (rows.length === 0) {
    return fail(`Nothing to import — ${skippedDuplicates} duplicate(s), ${skippedInvalid} invalid row(s).`)
  }

  const { error: insertError } = await session.supabase.from('coverage_mentions').insert(rows)
  if (insertError) return fail(insertError.message)

  await logActivity(session.supabase, session.workspaceId, session.userId, {
    entityType: 'coverage_mention', action: 'imported', summary: `Imported ${rows.length} coverage mention(s) from CSV`,
  })
  revalidateReputation()
  const suffix = [skippedDuplicates > 0 ? `${skippedDuplicates} duplicate(s) skipped` : null, skippedInvalid > 0 ? `${skippedInvalid} invalid row(s) skipped` : null].filter(Boolean).join(', ')
  return { ok: true, message: `Imported ${rows.length} mention(s)${suffix ? ` (${suffix})` : ''}.` }
}

// ============================================================================
// AI drafting (Azure OpenAI) — every result is a draft the user must review
// and explicitly save; nothing here writes to a record directly.
// ============================================================================

export interface AiActionResult extends ActionResult { text?: string }

export async function aiSuggestPitchAngles(topic: string): Promise<AiActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_PITCHES_CREATE)
  if (!session) return fail(error)
  if (!topic.trim()) return fail('Describe what the pitch is about first.')

  const outcome = await runReputationAi(session.supabase, session.workspaceId, session.userId, {
    action: 'suggest_pitch_angle',
    system: 'You are a PR strategist helping a comms team pitch journalists. Suggest 3 distinct, concrete press angles for the given topic. Each angle: a punchy subject line, then one sentence on why it is newsworthy right now. Plain text, numbered 1-3, no preamble or sign-off.',
    prompt: `Topic: ${topic.trim()}`,
    maxOutputTokens: 300,
  })
  if (!outcome.ok) return fail(outcome.error ?? 'AI request failed.')
  return { ok: true, text: outcome.text }
}

export async function aiDraftReviewResponse(reviewId: string): Promise<AiActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_REVIEWS_RESPOND)
  if (!session) return fail(error)

  const { data: review } = await session.supabase.from('reviews').select('reviewer_name, rating, review_text, sentiment, source').eq('id', reviewId).eq('workspace_id', session.workspaceId).maybeSingle()
  if (!review) return fail('Review not found.')

  const outcome = await runReputationAi(session.supabase, session.workspaceId, session.userId, {
    action: 'draft_review_response', entityType: 'review', entityId: reviewId,
    system: 'You write short, warm, specific customer review responses for a brand. Match tone to sentiment: thank genuinely for positive reviews, apologise and offer a concrete next step for negative reviews without over-promising or admitting legal fault. 2-4 sentences. No greeting placeholders like [Name] — write it generically addressable. Plain text only, no markdown.',
    prompt: `Source: ${review.source}\nRating: ${review.rating}/5\nSentiment: ${review.sentiment}\nReview: "${review.review_text ?? '(no text)'}"`,
    maxOutputTokens: 220,
  })
  if (!outcome.ok) return fail(outcome.error ?? 'AI request failed.')
  return { ok: true, text: outcome.text }
}

export async function aiDraftCrisisStatement(incidentId: string): Promise<AiActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_CRISIS_STATEMENTS_EDIT)
  if (!session) return fail(error)

  const { data: incident } = await session.supabase.from('crisis_incidents').select('title, description, severity, status').eq('id', incidentId).eq('workspace_id', session.workspaceId).maybeSingle()
  if (!incident) return fail('Incident not found.')

  const outcome = await runReputationAi(session.supabase, session.workspaceId, session.userId, {
    action: 'draft_crisis_statement', entityType: 'crisis_incident', entityId: incidentId,
    system: 'You draft cautious, factual holding statements for a company communications team responding to a reputation incident. Acknowledge the issue, state that it is being investigated/addressed, avoid admitting legal liability, avoid speculation, and commit to a follow-up. 3-5 sentences. This is a DRAFT for human legal/PR review, not final copy. Plain text only.',
    prompt: `Incident: ${incident.title}\nSeverity: ${incident.severity}\nDescription: ${incident.description ?? '(none provided)'}`,
    maxOutputTokens: 260,
  })
  if (!outcome.ok) return fail(outcome.error ?? 'AI request failed.')
  return { ok: true, text: outcome.text }
}

export async function aiSummariseCoverage(): Promise<AiActionResult> {
  const { session, error } = await authorise(PERMISSIONS.REPUTATION_COVERAGE_VIEW)
  if (!session) return fail(error)

  const { data: mentions } = await session.supabase
    .from('coverage_mentions').select('publication, headline, sentiment, published_at')
    .eq('workspace_id', session.workspaceId).order('published_at', { ascending: false }).limit(15)
  if (!mentions || mentions.length === 0) return fail('No coverage to summarise yet.')

  const list = mentions.map(m => `- [${m.sentiment}] ${m.publication}: ${m.headline}`).join('\n')
  const outcome = await runReputationAi(session.supabase, session.workspaceId, session.userId, {
    action: 'summarise_coverage',
    system: 'You summarise a list of real, already-tracked media coverage for a comms lead. 3-4 sentences: overall sentiment trend, any notable outlet, one thing to watch. Only use the mentions given — never invent outlets or headlines not listed. Plain text only.',
    prompt: `Recent coverage (most recent first):\n${list}`,
    maxOutputTokens: 220,
  })
  if (!outcome.ok) return fail(outcome.error ?? 'AI request failed.')
  return { ok: true, text: outcome.text }
}
