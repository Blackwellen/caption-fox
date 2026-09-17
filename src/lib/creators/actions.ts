'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCreatorSession } from '@/lib/creators/server'
import type { CreatorCapabilities } from '@/lib/creators/entitlements'
import {
  canTransitionBrief, canTransitionPayment, canTransitionRights, canTransitionSubmission, effectiveRightsStatus,
  INVITATION_EXPIRY_DAYS, mediaTypeForMime, UPLOAD_LIMITS,
} from '@/lib/creators/constants'
import { batchBlockers, batchCurrency, reviewSecondsBetween, settledBatchStatus } from '@/lib/creators/rules'
import { storedLink } from '@/lib/creators/routes'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

/**
 * Every Creators & UGC surface renders under /{type}/creators, so one layout
 * revalidation refreshes all six pages and their detail routes.
 */
function revalidateCreators() {
  revalidatePath('/[workspaceType]/creators', 'layout')
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

async function logActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  actorId: string,
  entry: {
    entityType: string; entityId?: string | null; action: string
    summary: string; link?: string | null; surface?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('ugc_activity').insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    summary: entry.summary,
    link: entry.link ?? null,
    surface: entry.surface ?? null,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[creators] activity log failed', error.message)
}

async function authorise(capability: keyof CreatorCapabilities) {
  const session = await getCreatorSession()
  if (!session.capabilities[capability]) {
    return { session: null, error: 'Your role does not allow this action.' } as const
  }
  return { session, error: null } as const
}

async function ownsRecord(
  supabase: SupabaseClient, table: string, id: string, workspaceId: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

// ============================================================================
// Creators
// ============================================================================

export interface CreatorInput {
  name: string
  email?: string
  handle?: string
  niche?: string
  region?: string
  platforms?: string[]
  audience_size?: string
  engagement_rate?: string
  avg_rate?: string
  currency?: string
  bio?: string
  tags?: string[]
}

export async function createCreator(input: CreatorInput): Promise<ActionResult> {
  const { session, error } = await authorise('manageCreators')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const name = input.name.trim()
  if (!name) return fail('Creator name is required.')
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return fail('Enter a valid email address.')

  const { data, error: dbError } = await supabase.from('ugc_creators').insert({
    workspace_id: ctx.workspaceId,
    name,
    email: input.email?.trim() || null,
    handle: input.handle?.trim().replace(/^@/, '') || null,
    niche: input.niche || null,
    region: input.region || null,
    platforms: input.platforms ?? [],
    audience_size: Number(input.audience_size) || 0,
    engagement_rate: Number(input.engagement_rate) || 0,
    avg_rate: input.avg_rate ? Number(input.avg_rate) : null,
    rate_per_video: input.avg_rate ? Number(input.avg_rate) : null,
    currency: input.currency || 'GBP',
    bio: input.bio || null,
    tags: input.tags ?? [],
    relationship_status: 'discovered',
    source: 'manual',
    added_by: userId,
    owner_id: userId,
  }).select('id').single()

  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'creator', entityId: data.id, action: 'created',
    summary: `${name} was added to Creators`, link: storedLink('creators', data.id), surface: 'creators',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: `${name} added.` }
}

export async function updateCreator(id: string, patch: Partial<CreatorInput> & {
  relationship_status?: string; availability?: string; shortlisted?: boolean
  rights_readiness?: string; payment_ready?: boolean; owner_id?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageCreators')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_creators', id, ctx.workspaceId))) return fail('Creator not found in this workspace.')

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.email !== undefined) update.email = patch.email || null
  if (patch.handle !== undefined) update.handle = patch.handle?.replace(/^@/, '') || null
  if (patch.niche !== undefined) update.niche = patch.niche || null
  if (patch.region !== undefined) update.region = patch.region || null
  if (patch.platforms !== undefined) update.platforms = patch.platforms
  if (patch.audience_size !== undefined) update.audience_size = Number(patch.audience_size) || 0
  if (patch.engagement_rate !== undefined) update.engagement_rate = Number(patch.engagement_rate) || 0
  if (patch.avg_rate !== undefined) update.avg_rate = patch.avg_rate ? Number(patch.avg_rate) : null
  if (patch.bio !== undefined) update.bio = patch.bio || null
  if (patch.tags !== undefined) update.tags = patch.tags
  if (patch.relationship_status !== undefined) update.relationship_status = patch.relationship_status
  if (patch.availability !== undefined) update.availability = patch.availability
  if (patch.shortlisted !== undefined) update.shortlisted = patch.shortlisted
  if (patch.rights_readiness !== undefined) update.rights_readiness = patch.rights_readiness
  if (patch.payment_ready !== undefined) update.payment_ready = patch.payment_ready
  if (patch.owner_id !== undefined) update.owner_id = patch.owner_id || null

  const { error: dbError } = await supabase.from('ugc_creators').update(update).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'creator', entityId: id, action: 'updated',
    summary: 'Creator profile updated', link: storedLink('creators', id), surface: 'creators',
  })

  revalidateCreators()
  return { ok: true, message: 'Creator updated.' }
}

export async function archiveCreator(id: string, archived: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('manageCreators')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_creators', id, ctx.workspaceId))) return fail('Creator not found in this workspace.')

  const { error: dbError } = await supabase.from('ugc_creators')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      relationship_status: archived ? 'archived' : 'available',
    })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'creator', entityId: id, action: archived ? 'archived' : 'restored',
    summary: archived ? 'Creator archived' : 'Creator restored', link: storedLink('creators', id), surface: 'creators',
  })

  revalidateCreators()
  return { ok: true, message: archived ? 'Creator archived.' : 'Creator restored.' }
}

export async function toggleShortlist(id: string, shortlisted: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('manageCreators')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_creators', id, ctx.workspaceId))) return fail('Creator not found in this workspace.')

  const { error: dbError } = await supabase.from('ugc_creators')
    .update({ shortlisted }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'creator', entityId: id, action: shortlisted ? 'shortlisted' : 'unshortlisted',
    summary: shortlisted ? 'Added to shortlist' : 'Removed from shortlist',
    link: storedLink('creators', id), surface: 'creators',
  })

  revalidateCreators()
  return { ok: true }
}

// ── Lists ────────────────────────────────────────────────────────────────────

export async function createCreatorList(input: { name: string; description?: string; listType?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('manageLists')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  const name = input.name.trim()
  if (!name) return fail('List name is required.')

  const { data, error: dbError } = await supabase.from('creator_lists').insert({
    workspace_id: ctx.workspaceId, name, description: input.description || null,
    list_type: input.listType ?? 'list', owner_id: userId, created_by: userId,
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'list', entityId: data.id, action: 'created',
    summary: `List "${name}" created`, surface: 'creators',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: `List "${name}" created.` }
}

export async function addCreatorToList(listId: string, creatorId: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageLists')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'creator_lists', listId, ctx.workspaceId))) return fail('List not found.')
  if (!(await ownsRecord(supabase, 'ugc_creators', creatorId, ctx.workspaceId))) return fail('Creator not found.')

  const { error: dbError } = await supabase.from('creator_list_members')
    .upsert({ workspace_id: ctx.workspaceId, list_id: listId, creator_id: creatorId, added_by: userId }, { onConflict: 'list_id,creator_id' })
  if (dbError) return fail(dbError.message)

  revalidateCreators()
  return { ok: true, message: 'Added to list.' }
}

export async function removeCreatorFromList(listId: string, creatorId: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageLists')
  if (!session) return fail(error!)
  const { supabase, ctx } = session

  const { error: dbError } = await supabase.from('creator_list_members')
    .delete().eq('workspace_id', ctx.workspaceId).eq('list_id', listId).eq('creator_id', creatorId)
  if (dbError) return fail(dbError.message)

  revalidateCreators()
  return { ok: true, message: 'Removed from list.' }
}

// ── Invitations ──────────────────────────────────────────────────────────────

export interface InviteInput {
  email: string
  displayName?: string
  message?: string
  creatorId?: string
  requirePaymentDetails?: boolean
  requireRightsDetails?: boolean
}

export async function inviteCreator(input: InviteInput): Promise<ActionResult> {
  const { session, error } = await authorise('invite')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address.')

  const { data: existing } = await supabase
    .from('creator_invitations').select('id, status')
    .eq('workspace_id', ctx.workspaceId).eq('email', email).in('status', ['draft', 'sent']).maybeSingle()

  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000).toISOString()

  if (existing) {
    const { error: dbError } = await supabase.from('creator_invitations')
      .update({ sent_at: new Date().toISOString(), expires_at: expiresAt, message: input.message || null, status: 'sent' })
      .eq('id', existing.id)
    if (dbError) return fail(dbError.message)

    await logActivity(supabase, ctx.workspaceId, userId, {
      entityType: 'invitation', entityId: existing.id, action: 'resent',
      summary: `Invitation resent to ${email}`, surface: 'creators',
    })
    revalidateCreators()
    return { ok: true, id: existing.id, message: `Invitation resent to ${email}.` }
  }

  const { data, error: dbError } = await supabase.from('creator_invitations').insert({
    workspace_id: ctx.workspaceId,
    creator_id: input.creatorId || null,
    email,
    display_name: input.displayName || null,
    message: input.message || null,
    status: 'sent',
    require_payment_details: input.requirePaymentDetails ?? true,
    require_rights_details: input.requireRightsDetails ?? true,
    sent_at: new Date().toISOString(),
    expires_at: expiresAt,
    created_by: userId,
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  if (!input.creatorId) {
    await supabase.from('ugc_creators').insert({
      workspace_id: ctx.workspaceId,
      name: input.displayName || email.split('@')[0],
      email,
      relationship_status: 'invited',
      source: 'invitation',
      added_by: userId,
      owner_id: userId,
    })
  } else {
    await supabase.from('ugc_creators')
      .update({ relationship_status: 'invited' })
      .eq('id', input.creatorId).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'invitation', entityId: data.id, action: 'sent',
    summary: `Invitation sent to ${email}`, surface: 'creators',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: `Invitation sent to ${email}.` }
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('invite')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { error: dbError } = await supabase.from('creator_invitations')
    .update({ status: 'revoked' }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'invitation', entityId: id, action: 'revoked',
    summary: 'Invitation revoked', surface: 'creators',
  })

  revalidateCreators()
  return { ok: true, message: 'Invitation revoked.' }
}

// ============================================================================
// Briefs
// ============================================================================

export interface BriefInput {
  title: string
  description?: string
  campaign_id?: string
  category?: string
  priority?: string
  channels?: string[]
  deliverables?: string
  budget?: string
  currency?: string
  deadline?: string
  max_creators?: string
  rights_requirement?: string
  do_instructions?: string
  dont_instructions?: string
  creatorIds?: string[]
  deliverableItems?: { title: string; asset_type: string; quantity: number; channel?: string; due_date?: string }[]
}

export async function createBrief(input: BriefInput): Promise<ActionResult> {
  const { session, error } = await authorise('createBrief')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const title = input.title.trim()
  if (!title) return fail('Brief title is required.')

  const { data, error: dbError } = await supabase.from('ugc_briefs').insert({
    workspace_id: ctx.workspaceId,
    campaign_id: input.campaign_id || null,
    title,
    description: input.description || null,
    category: input.category || null,
    priority: input.priority || 'medium',
    channels: input.channels ?? [],
    platforms: input.channels ?? [],
    deliverables: input.deliverables || null,
    budget: input.budget ? Number(input.budget) : null,
    currency: input.currency || 'GBP',
    deadline: input.deadline || null,
    max_creators: input.max_creators ? Number(input.max_creators) : null,
    rights_requirement: input.rights_requirement || null,
    do_instructions: input.do_instructions || null,
    dont_instructions: input.dont_instructions || null,
    status: 'draft',
    approval_stage: 'not_sent',
    owner_id: userId,
    created_by: userId,
    deliverables_target: input.deliverableItems?.reduce((sum, item) => sum + Number(item.quantity || 1), 0) ?? 0,
  }).select('id').single()

  if (dbError) return fail(dbError.message)
  const briefId = data.id as string

  if (input.deliverableItems?.length) {
    await supabase.from('ugc_brief_deliverables').insert(
      input.deliverableItems.map((item, index) => ({
        workspace_id: ctx.workspaceId, brief_id: briefId, title: item.title,
        asset_type: item.asset_type, quantity: item.quantity || 1,
        channel: item.channel || null, due_date: item.due_date || null, position: index,
      })),
    )
  }

  if (input.creatorIds?.length) {
    const validCreators = await supabase.from('ugc_creators').select('id')
      .eq('workspace_id', ctx.workspaceId).in('id', input.creatorIds)
    const ids = (validCreators.data ?? []).map(row => row.id as string)
    if (ids.length) {
      await supabase.from('ugc_brief_creators').insert(
        ids.map(creatorId => ({
          workspace_id: ctx.workspaceId, brief_id: briefId, creator_id: creatorId,
          status: 'invited', created_by: userId,
        })),
      )
      await supabase.from('ugc_briefs').update({ creators_assigned: ids.length }).eq('id', briefId)
    }
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'brief', entityId: briefId, action: 'created',
    summary: `Brief "${title}" created`, link: storedLink('briefs', briefId), surface: 'briefs',
  })

  revalidateCreators()
  return { ok: true, id: briefId, message: `Brief "${title}" created.` }
}

export async function updateBriefStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('editBrief')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: brief } = await supabase.from('ugc_briefs').select('id, status, title').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!brief) return fail('Brief not found in this workspace.')
  if (!canTransitionBrief(brief.status as string, status)) return fail(`Cannot move a brief from "${brief.status}" to "${status}".`)

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'completed') update.completed_at = new Date().toISOString()

  const { error: dbError } = await supabase.from('ugc_briefs').update(update).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'brief', entityId: id, action: 'status_changed',
    summary: `Brief "${brief.title}" moved to ${status.replace(/_/g, ' ')}`,
    link: storedLink('briefs', id), surface: 'briefs',
  })

  revalidateCreators()
  return { ok: true, message: 'Brief status updated.' }
}

export async function archiveBrief(id: string, archived: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('deleteBrief')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_briefs', id, ctx.workspaceId))) return fail('Brief not found in this workspace.')

  const { error: dbError } = await supabase.from('ugc_briefs')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'brief', entityId: id, action: archived ? 'archived' : 'restored',
    summary: archived ? 'Brief archived' : 'Brief restored', link: storedLink('briefs', id), surface: 'briefs',
  })

  revalidateCreators()
  return { ok: true, message: archived ? 'Brief archived.' : 'Brief restored.' }
}

export async function updateBriefCreatorStatus(briefId: string, creatorId: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('editBrief')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { error: dbError } = await supabase.from('ugc_brief_creators')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('brief_id', briefId).eq('creator_id', creatorId).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'brief', entityId: briefId, action: 'creator_status_changed',
    summary: `Creator progress updated to ${status.replace(/_/g, ' ')}`, link: storedLink('briefs', briefId), surface: 'briefs',
  })

  revalidateCreators()
  return { ok: true }
}

// ============================================================================
// Submissions
// ============================================================================

export interface CreateSubmissionInput {
  briefId: string
  creatorId: string
  title?: string
  assetType?: string
  deliverableId?: string
  notes?: string
  files: { path: string; mediaType: string; mimeType: string; sizeBytes: number; originalName: string }[]
}

/**
 * Creates a submission and its asset rows in one pass. Files must already be
 * uploaded to the private `ugc-submissions` bucket by the client (see
 * `uploadSubmissionPath` below for the path contract) — this action only
 * records the references, so a failed database write cannot leave an
 * un-owned upload with no matching record.
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<ActionResult> {
  const { session, error } = await authorise('upload')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'ugc_briefs', input.briefId, ctx.workspaceId))) return fail('Brief not found in this workspace.')
  if (!(await ownsRecord(supabase, 'ugc_creators', input.creatorId, ctx.workspaceId))) return fail('Creator not found in this workspace.')
  if (input.files.length === 0) return fail('At least one file is required.')
  if (input.files.length > UPLOAD_LIMITS.maxFiles) return fail(`No more than ${UPLOAD_LIMITS.maxFiles} files per submission.`)
  const invalid = await verifyUploadedFiles(supabase, ctx.workspaceId, input.files)
  if (invalid) return fail(invalid)

  const { data, error: dbError } = await supabase.from('ugc_submissions').insert({
    workspace_id: ctx.workspaceId,
    brief_id: input.briefId,
    creator_id: input.creatorId,
    deliverable_id: input.deliverableId || null,
    title: input.title || null,
    asset_type: input.assetType || mediaTypeForMime(input.files[0].mimeType),
    status: 'waiting_review',
    version: 1,
    file_count: input.files.length,
    thumbnail_path: input.files.find(f => f.mediaType === 'image')?.path ?? null,
    notes: input.notes || null,
    submitted_at: new Date().toISOString(),
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  const submissionId = data.id as string
  const { error: assetError } = await supabase.from('ugc_submission_assets').insert(
    input.files.map(file => ({
      workspace_id: ctx.workspaceId, submission_id: submissionId, version: 1,
      storage_path: file.path, media_type: file.mediaType, mime_type: file.mimeType,
      size_bytes: file.sizeBytes, original_name: file.originalName, created_by: userId,
    })),
  )
  if (assetError) return fail(assetError.message)

  await supabase.from('ugc_briefs')
    .update({ deliverables_submitted: (await supabase.from('ugc_submissions').select('id', { count: 'exact', head: true }).eq('brief_id', input.briefId)).count ?? 0 })
    .eq('id', input.briefId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: submissionId, action: 'submitted',
    summary: 'New submission delivered for review', link: storedLink('submissions', submissionId), surface: 'submissions',
  })

  revalidateCreators()
  return { ok: true, id: submissionId, message: 'Submission uploaded for review.' }
}

/**
 * Re-checks client-reported uploads against storage: every path must sit in
 * this workspace's folder, use an allowed MIME type and size, and the object
 * must actually exist with a matching size. A forged path or a file that
 * never finished uploading is rejected before any record is written.
 */
async function verifyUploadedFiles(
  supabase: SupabaseClient, workspaceId: string,
  files: { path: string; mimeType: string; sizeBytes: number; mediaType: string }[],
): Promise<string | null> {
  for (const file of files) {
    const parts = file.path.split('/')
    if (parts[0] !== workspaceId || parts.length !== 3 || file.path.includes('..')) return 'Upload location is not valid for this workspace.'
    if (!UPLOAD_LIMITS.mimeTypes.includes(file.mimeType as never)) return 'One of the files has an unsupported type.'
    if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0 || file.sizeBytes > UPLOAD_LIMITS.maxBytes) return 'One of the files is empty or larger than 500 MB.'
    if (mediaTypeForMime(file.mimeType) !== file.mediaType) return 'File type metadata does not match the file.'
    const { data } = await supabase.storage.from(UPLOAD_LIMITS.bucket).list(`${parts[0]}/${parts[1]}`, { search: parts[2] })
    const stored = (data ?? []).find(object => object.name === parts[2])
    if (!stored) return 'An upload did not finish. Please retry the file.'
    const storedSize = Number((stored.metadata as { size?: number } | null)?.size ?? file.sizeBytes)
    if (storedSize !== file.sizeBytes) return 'An uploaded file does not match what was sent. Please retry.'
  }
  return null
}

/**
 * Adds a new version to an existing submission (typically after changes were
 * requested). Earlier versions and their reviews are kept; the approval of
 * version N never carries over to version N+1.
 */
export async function addSubmissionVersion(input: {
  submissionId: string; note?: string
  files: { path: string; mediaType: string; mimeType: string; sizeBytes: number; originalName: string }[]
}): Promise<ActionResult> {
  const { session, error } = await authorise('upload')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: submission } = await supabase.from('ugc_submissions')
    .select('id, status, version, title').eq('id', input.submissionId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!submission) return fail('Submission not found in this workspace.')
  if (!canTransitionSubmission(submission.status as string, 'waiting_review')) {
    return fail('A new version can only be uploaded while the submission is waiting, in review or has changes requested.')
  }
  if (input.files.length === 0 || input.files.length > UPLOAD_LIMITS.maxFiles) return fail(`Upload between 1 and ${UPLOAD_LIMITS.maxFiles} files.`)
  const invalid = await verifyUploadedFiles(supabase, ctx.workspaceId, input.files)
  if (invalid) return fail(invalid)

  const version = Number(submission.version ?? 1) + 1
  const { error: assetError } = await supabase.from('ugc_submission_assets').insert(input.files.map(file => ({
    workspace_id: ctx.workspaceId, submission_id: submission.id, version, storage_path: file.path, media_type: file.mediaType,
    mime_type: file.mimeType, size_bytes: file.sizeBytes, original_name: file.originalName.slice(0, 200), created_by: userId,
  })))
  if (assetError) return fail(assetError.message)

  const { error: updateError } = await supabase.from('ugc_submissions').update({
    version, status: 'waiting_review', file_count: input.files.length, submitted_at: new Date().toISOString(),
    review_started_at: null, reviewed_at: null, review_seconds: null, payment_eligible: false,
    thumbnail_path: input.files.find(f => f.mediaType === 'image')?.path ?? undefined,
    notes: input.note?.slice(0, 2000) || undefined,
  }).eq('id', submission.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: submission.id, action: 'version_uploaded',
    summary: `Version ${version} of "${submission.title ?? 'submission'}" uploaded for review`, link: storedLink('submissions', submission.id), surface: 'submissions',
  })
  revalidateCreators()
  return { ok: true, id: submission.id, message: `Version ${version} uploaded for review.` }
}

/** Deterministic, workspace-scoped storage path for a new submission file. */
export async function uploadSubmissionPath(mimeType: string, originalName: string): Promise<ActionResult & { path?: string }> {
  const { session, error } = await authorise('upload')
  if (!session) return fail(error!)
  if (!UPLOAD_LIMITS.mimeTypes.includes(mimeType as never)) return fail('Unsupported file type.')

  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `${session.ctx.workspaceId}/${randomUUID()}/${safeName}`
  return { ok: true, path }
}

export async function reviewSubmission(input: {
  id: string
  decision: 'started' | 'approved' | 'changes_requested' | 'rejected' | 'note'
  note?: string
  creatorVisible?: boolean
  timecodeSeconds?: number
}): Promise<ActionResult> {
  const { session, error } = await authorise('review')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: submission } = await supabase
    .from('ugc_submissions').select('id, status, title, creator_id, version, submitted_at, review_started_at')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!submission) return fail('Submission not found in this workspace.')

  const statusMap: Record<string, string> = {
    approved: 'approved', changes_requested: 'changes_requested', rejected: 'rejected',
  }
  const nextStatus = statusMap[input.decision]

  if (nextStatus) {
    if (!session.capabilities.approve) return fail('Your role cannot approve or reject submissions.')
    if (!canTransitionSubmission(submission.status as string, nextStatus)) {
      return fail(`Cannot move a submission from "${submission.status}" to "${nextStatus}".`)
    }
  }

  const { error: reviewError } = await supabase.from('ugc_submission_reviews').insert({
    workspace_id: ctx.workspaceId, submission_id: input.id, reviewer_id: userId,
    version: Number(submission.version ?? 1),
    decision: input.decision, note: input.note || null,
    creator_visible: input.creatorVisible ?? false, timecode_seconds: input.timecodeSeconds ?? null,
  })
  if (reviewError) return fail(reviewError.message)

  if (nextStatus) {
    const update: Record<string, unknown> = {
      status: nextStatus, reviewer_id: userId, updated_at: new Date().toISOString(),
    }
    // Review time runs from the start of review (or delivery, if the reviewer
    // decided on first read) to this decision, and feeds "Avg. Review Time".
    const decidedAt = new Date().toISOString()
    update.reviewed_at = decidedAt
    update.review_seconds = reviewSecondsBetween(
      (submission.review_started_at as string | null) ?? (submission.submitted_at as string | null), decidedAt,
    )
    if (nextStatus === 'approved') update.payment_eligible = true
    if (!submission.review_started_at) update.review_started_at = decidedAt
    await supabase.from('ugc_submissions').update(update).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  } else if (input.decision === 'started') {
    await supabase.from('ugc_submissions')
      .update({ status: 'in_review', reviewer_id: userId, review_started_at: new Date().toISOString() })
      .eq('id', input.id).eq('workspace_id', ctx.workspaceId).eq('status', 'waiting_review')
  }

  const label = nextStatus ? nextStatus.replace(/_/g, ' ') : 'reviewed'
  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: input.id, action: input.decision,
    summary: `Submission ${label}`, link: storedLink('submissions', input.id), surface: 'submissions',
  })

  revalidateCreators()
  return { ok: true, message: `Submission ${label}.` }
}

export async function bulkApproveSubmissions(ids: string[]): Promise<ActionResult> {
  const { session, error } = await authorise('bulkApprove')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (ids.length === 0) return fail('No submissions selected.')

  if (ids.length > 200) return fail('Bulk approve is limited to 200 submissions at a time.')

  const { data: submissions } = await supabase
    .from('ugc_submissions').select('id, status, submitted_at, review_started_at')
    .eq('workspace_id', ctx.workspaceId).in('id', ids)
  const eligible = (submissions ?? []).filter(row => canTransitionSubmission(row.status as string, 'approved'))
  if (eligible.length === 0) return fail('None of the selected submissions can be approved from their current status.')

  const eligibleIds = eligible.map(row => row.id as string)
  const decidedAt = new Date().toISOString()
  for (const row of eligible) {
    // Conditional on status so a concurrent reviewer's decision is never overwritten.
    const { error: dbError } = await supabase.from('ugc_submissions')
      .update({
        status: 'approved', reviewer_id: userId, reviewed_at: decidedAt, payment_eligible: true,
        review_started_at: (row.review_started_at as string | null) ?? decidedAt,
        review_seconds: reviewSecondsBetween((row.review_started_at as string | null) ?? (row.submitted_at as string), decidedAt),
      })
      .eq('id', row.id).eq('workspace_id', ctx.workspaceId).eq('status', row.status)
    if (dbError) return fail(dbError.message)
  }

  await supabase.from('ugc_submission_reviews').insert(
    eligibleIds.map(id => ({ workspace_id: ctx.workspaceId, submission_id: id, reviewer_id: userId, decision: 'approved', note: 'Bulk approved' })),
  )

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', action: 'bulk_approved',
    summary: `${eligibleIds.length} submission(s) bulk approved`, surface: 'submissions',
  })

  revalidateCreators()
  const skipped = ids.length - eligibleIds.length
  return { ok: true, message: skipped > 0 ? `${eligibleIds.length} approved, ${skipped} skipped (invalid status).` : `${eligibleIds.length} submissions approved.` }
}

export async function raiseSubmissionIssue(input: {
  submissionId: string; category: string; severity?: string; detail?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('review')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_submissions', input.submissionId, ctx.workspaceId))) return fail('Submission not found.')

  const { error: dbError } = await supabase.from('ugc_submission_issues').insert({
    workspace_id: ctx.workspaceId, submission_id: input.submissionId, category: input.category,
    severity: input.severity || 'medium', detail: input.detail || null, source: 'reviewer',
    status: 'open', raised_by: userId,
  })
  if (dbError) return fail(dbError.message)

  const { count } = await supabase.from('ugc_submission_issues')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', input.submissionId).in('status', ['open', 'confirmed'])
  await supabase.from('ugc_submissions').update({ issue_count: count ?? 0 }).eq('id', input.submissionId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: input.submissionId, action: 'issue_flagged',
    summary: `Issue flagged: ${input.category.replace(/_/g, ' ')}`, link: storedLink('submissions', input.submissionId), surface: 'submissions',
  })

  revalidateCreators()
  return { ok: true, message: 'Issue flagged.' }
}

export async function resolveSubmissionIssue(id: string, submissionId: string, status: 'confirmed' | 'dismissed' | 'resolved'): Promise<ActionResult> {
  const { session, error } = await authorise('review')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_submissions', submissionId, ctx.workspaceId))) return fail('Submission not found.')

  const { error: dbError } = await supabase.from('ugc_submission_issues')
    .update({ status, resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  const { count } = await supabase.from('ugc_submission_issues')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId).in('status', ['open', 'confirmed'])
  await supabase.from('ugc_submissions').update({ issue_count: count ?? 0 }).eq('id', submissionId)

  revalidateCreators()
  return { ok: true, message: 'Issue updated.' }
}

// ============================================================================
// Rights
// ============================================================================

export interface RightsInput {
  creatorId: string
  submissionId?: string
  campaignId?: string
  briefId?: string
  assetLabel: string
  usageScope: string
  channels?: string[]
  territories?: string[]
  startDate?: string
  expiryDate?: string
  exclusivity?: boolean
  modificationAllowed?: boolean
  paidAmplification?: boolean
  whitelisting?: boolean
  handleUsage?: boolean
  agreementUrl?: string
  agreementSigned?: boolean
  notes?: string
}

export async function createRightsRecord(input: RightsInput): Promise<ActionResult> {
  const { session, error } = await authorise('manageRights')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'ugc_creators', input.creatorId, ctx.workspaceId))) return fail('Creator not found in this workspace.')
  const label = input.assetLabel.trim()
  if (!label) return fail('Asset label is required.')
  if (input.startDate && input.expiryDate && input.expiryDate < input.startDate) return fail('Expiry date cannot be before the start date.')

  const { data, error: dbError } = await supabase.from('ugc_rights').insert({
    workspace_id: ctx.workspaceId, creator_id: input.creatorId,
    submission_id: input.submissionId || null, campaign_id: input.campaignId || null,
    brief_id: input.briefId || null, asset_label: label, usage_scope: input.usageScope,
    channels: input.channels ?? [], territories: input.territories ?? [],
    start_date: input.startDate || null, expiry_date: input.expiryDate || null,
    exclusivity: input.exclusivity ?? false, modification_allowed: input.modificationAllowed ?? false,
    paid_amplification: input.paidAmplification ?? false, whitelisting: input.whitelisting ?? false,
    handle_usage: input.handleUsage ?? false, agreement_url: input.agreementUrl || null,
    agreement_signed: input.agreementSigned ?? false,
    status: input.agreementSigned ? 'active' : 'pending_approval',
    owner_id: userId, notes: input.notes || null, created_by: userId,
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  if (input.submissionId) {
    const { data: submission } = await supabase.from('ugc_submissions').select('version').eq('id', input.submissionId).maybeSingle()
    await supabase.from('ugc_rights').update({ submission_version: submission?.version ?? 1 }).eq('id', data.id)
    await supabase.from('ugc_submissions').update({ rights_status: input.agreementSigned ? 'active' : 'pending' }).eq('id', input.submissionId)
  }

  await supabase.from('ugc_creators').update({
    rights_readiness: ['full_digital', 'perpetual', 'exclusive'].includes(input.usageScope) ? 'full' : 'limited',
  }).eq('id', input.creatorId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'rights', entityId: data.id, action: 'created',
    summary: `Rights record created for "${label}"`, link: storedLink('rights', data.id), surface: 'rights',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: 'Rights record created.' }
}

export async function updateRightsStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('approveRights')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  const { data: record } = await supabase.from('ugc_rights')
    .select('id, status, expiry_date, agreement_signed, submission_id')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!record) return fail('Rights record not found.')

  const current = effectiveRightsStatus(record.status as string, record.expiry_date as string | null)
  if (!canTransitionRights(current, status)) {
    return fail(`Cannot move a rights record from "${current.replace(/_/g, ' ')}" to "${status.replace(/_/g, ' ')}".`)
  }
  if (status === 'active' && !record.agreement_signed) {
    return fail('A licence cannot become active until its agreement is signed.')
  }

  const { error: dbError } = await supabase.from('ugc_rights')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  if (record.submission_id) {
    const submissionRights: Record<string, string> = { active: 'active', restricted: 'restricted', revoked: 'revoked', expired: 'expired' }
    if (submissionRights[status]) {
      await supabase.from('ugc_submissions').update({ rights_status: submissionRights[status] })
        .eq('id', record.submission_id).eq('workspace_id', ctx.workspaceId)
    }
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'rights', entityId: id, action: 'status_changed',
    summary: `Rights status changed to ${status.replace(/_/g, ' ')}`, link: storedLink('rights', id), surface: 'rights',
  })

  revalidateCreators()
  return { ok: true, message: 'Rights status updated.' }
}

/**
 * Renews a licence as a new linked record (the original stays as history).
 * The renewal starts pending approval; the original moves to renewal pending.
 */
export async function renewRights(id: string, input: { expiryDate: string; notes?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('manageRights')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: original } = await supabase.from('ugc_rights')
    .select('id, creator_id, submission_id, submission_version, campaign_id, brief_id, asset_label, rights_type, usage_scope, channels, territories, expiry_date, exclusivity, modification_allowed, paid_amplification, whitelisting, handle_usage, status')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!original) return fail('Rights record not found.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate)) return fail('Choose a renewal expiry date.')

  const current = effectiveRightsStatus(original.status as string, original.expiry_date as string | null)
  if (!['active', 'expired', 'renewal_pending'].includes(current)) return fail('Only active or expired licences can be renewed.')
  const startDate = (original.expiry_date as string | null) ?? new Date().toISOString().slice(0, 10)
  if (input.expiryDate <= startDate) return fail('The renewal must end after the current licence expiry.')

  const { id: _omit, status: _status, expiry_date: _expiry, ...terms } = original
  void _omit; void _status; void _expiry
  const { data, error: dbError } = await supabase.from('ugc_rights').insert({
    ...terms, workspace_id: ctx.workspaceId, rights_type: 'renewal', renewed_from_id: id,
    start_date: startDate, expiry_date: input.expiryDate, status: 'pending_approval',
    agreement_signed: false, owner_id: userId, created_by: userId, notes: input.notes || null,
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  if (current === 'active') {
    await supabase.from('ugc_rights').update({ status: 'renewal_pending' }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'rights', entityId: data.id, action: 'renewal_requested',
    summary: `Renewal started for "${original.asset_label}" to ${input.expiryDate}`, link: storedLink('rights', data.id), surface: 'rights',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: 'Renewal created and awaiting approval.' }
}

export async function sendUsageRequest(input: {
  creatorId: string; submissionId?: string; requestedChannels?: string[]
  requestedTerritories?: string[]; requestedDurationDays?: string; paidMedia?: boolean
  exclusivity?: boolean; proposedFee?: string; currency?: string; message?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageRights')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_creators', input.creatorId, ctx.workspaceId))) return fail('Creator not found in this workspace.')

  const { data, error: dbError } = await supabase.from('ugc_rights_requests').insert({
    workspace_id: ctx.workspaceId, creator_id: input.creatorId, submission_id: input.submissionId || null,
    requested_channels: input.requestedChannels ?? [], requested_territories: input.requestedTerritories ?? [],
    requested_duration_days: input.requestedDurationDays ? Number(input.requestedDurationDays) : null,
    paid_media: input.paidMedia ?? false, exclusivity: input.exclusivity ?? false,
    proposed_fee: input.proposedFee ? Number(input.proposedFee) : null, currency: input.currency || 'GBP',
    message: input.message || null, status: 'sent',
    expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), created_by: userId,
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'rights', entityId: data.id, action: 'usage_requested',
    summary: 'Usage rights request sent to creator', surface: 'rights',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: 'Usage request sent.' }
}

/**
 * Records the creator's response to a usage request. Accepting never makes a
 * licence live on its own: it creates a rights record that still needs its
 * agreement signed and an approval before it becomes active.
 */
export async function respondUsageRequest(input: {
  id: string; response: 'accepted' | 'declined' | 'countered'; counterFee?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageRights')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: request } = await supabase.from('ugc_rights_requests')
    .select('id, status, creator_id, submission_id, requested_channels, requested_territories, requested_duration_days, paid_media, exclusivity, proposed_fee, counter_fee, currency')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!request) return fail('Usage request not found in this workspace.')
  if (!['sent', 'countered'].includes(request.status as string)) return fail('This request has already been resolved.')

  const update: Record<string, unknown> = { status: input.response, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (input.response === 'countered') {
    const fee = Number(input.counterFee)
    if (!Number.isFinite(fee) || fee < 0) return fail('Enter the counter-offer fee.')
    update.counter_fee = fee
  }
  const { error: dbError } = await supabase.from('ugc_rights_requests').update(update).eq('id', request.id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  let rightsId: string | undefined
  if (input.response === 'accepted') {
    const { data: submission } = request.submission_id
      ? await supabase.from('ugc_submissions').select('title, version, campaign_id, brief_id').eq('id', request.submission_id).maybeSingle()
      : { data: null }
    const start = new Date()
    const expiry = request.requested_duration_days ? new Date(start.getTime() + Number(request.requested_duration_days) * 86_400_000) : null
    const { data: rights, error: rightsError } = await supabase.from('ugc_rights').insert({
      workspace_id: ctx.workspaceId, creator_id: request.creator_id, submission_id: request.submission_id,
      submission_version: submission?.version ?? null, campaign_id: submission?.campaign_id ?? null, brief_id: submission?.brief_id ?? null,
      asset_label: submission?.title ?? 'Licensed asset', usage_scope: request.paid_media ? 'paid_social' : 'organic_only',
      channels: request.requested_channels ?? [], territories: request.requested_territories ?? [],
      start_date: start.toISOString().slice(0, 10), expiry_date: expiry ? expiry.toISOString().slice(0, 10) : null,
      exclusivity: request.exclusivity, paid_amplification: request.paid_media, status: 'pending_approval',
      agreement_signed: false, owner_id: userId, created_by: userId,
      notes: `Created from an accepted usage request (fee ${request.counter_fee ?? request.proposed_fee ?? 'not set'} ${request.currency}).`,
    }).select('id').single()
    if (rightsError) return fail(rightsError.message)
    rightsId = rights.id
    await supabase.from('ugc_rights_requests').update({ rights_id: rights.id }).eq('id', request.id)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'rights', entityId: rightsId ?? request.id, action: `usage_request_${input.response}`,
    summary: `Usage request ${input.response}${input.response === 'countered' ? ` at ${request.currency} ${Number(input.counterFee).toFixed(2)}` : ''}`,
    link: rightsId ? storedLink('rights', rightsId) : storedLink('creators', request.creator_id as string), surface: 'rights',
  })
  revalidateCreators()
  return { ok: true, id: rightsId, message: input.response === 'accepted' ? 'Accepted ? a rights record was created for approval.' : `Request marked ${input.response}.` }
}

// ============================================================================
// Payments
// ============================================================================

export interface PaymentInput {
  creatorId: string
  briefId?: string
  campaignId?: string
  submissionId?: string
  amount: string
  currency?: string
  paymentMethod?: string
  invoiceNumber?: string
  notes?: string
}

export async function createPayment(input: PaymentInput): Promise<ActionResult> {
  const { session, error } = await authorise('managePayments')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'ugc_creators', input.creatorId, ctx.workspaceId))) return fail('Creator not found in this workspace.')
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter a valid payment amount.')

  const { data, error: dbError } = await supabase.from('ugc_payments').insert({
    workspace_id: ctx.workspaceId, creator_id: input.creatorId, brief_id: input.briefId || null,
    campaign_id: input.campaignId || null, submission_id: input.submissionId || null,
    amount, currency: input.currency || 'GBP', payment_method: input.paymentMethod || null,
    invoice_number: input.invoiceNumber || null, invoice_status: input.invoiceNumber ? 'submitted' : 'required',
    notes: input.notes || null, status: 'draft', owner_id: userId, created_by: userId,
    submitted_date: new Date().toISOString(),
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment', entityId: data.id, action: 'created',
    summary: `Payment of ${input.currency ?? 'GBP'} ${amount.toFixed(2)} recorded`, link: storedLink('payments', data.id), surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: 'Payment recorded.' }
}

export async function updatePaymentStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('approvePayments')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (['processing', 'paid', 'failed', 'partially_paid'].includes(status)) {
    return fail('Payout outcomes are recorded with "Record payout" so every attempt and provider reference is kept.')
  }
  const { data: payment } = await supabase.from('ugc_payments').select('id, status, creator_id').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!payment) return fail('Payment not found in this workspace.')
  if (!canTransitionPayment(payment.status as string, status)) return fail(`Cannot move a payment from "${payment.status}" to "${status}".`)

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'approved') { update.approval_state = 'approved'; update.approved_by = userId; update.approved_at = new Date().toISOString() }
  if (status === 'paid') update.paid_at = new Date().toISOString()

  const { error: dbError } = await supabase.from('ugc_payments').update(update).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  if (status === 'paid') {
    const { data: paidPayments } = await supabase.from('ugc_payments').select('amount').eq('creator_id', payment.creator_id).eq('status', 'paid')
    const total = (paidPayments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
    await supabase.from('ugc_creators').update({ total_earnings: total }).eq('id', payment.creator_id)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment', entityId: id, action: 'status_changed',
    summary: `Payment moved to ${status.replace(/_/g, ' ')}`, link: storedLink('payments', id), surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, message: 'Payment status updated.' }
}

/**
 * Creates a payout batch from selected payments. Every payment is re-checked
 * on the server against the same rules the wizard shows (approval, invoice,
 * tax, payout details, not already batched), the batch must be one currency,
 * and a caller-supplied idempotency key makes a double-submit return the
 * original batch instead of creating a second one.
 */
export async function createPaymentBatch(input: {
  name: string; paymentIds: string[]; scheduledFor?: string; idempotencyKey: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('processPayouts')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (input.paymentIds.length === 0) return fail('Select at least one payment for this batch.')
  if (input.paymentIds.length > 500) return fail('A batch can hold at most 500 payments.')
  if (!/^[\w-]{8,80}$/.test(input.idempotencyKey)) return fail('Invalid request key.')
  if (input.scheduledFor && !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledFor)) return fail('Choose a valid payout date.')

  const { data: existingBatch } = await supabase.from('ugc_payment_batches')
    .select('id').eq('workspace_id', ctx.workspaceId).eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (existingBatch) return { ok: true, id: existingBatch.id, message: 'Batch already created.' }

  const { data: payments } = await supabase.from('ugc_payments')
    .select('id, amount, currency, payment_method, status, approval_state, invoice_status, tax_status, batch_id, creator_id')
    .eq('workspace_id', ctx.workspaceId).in('id', input.paymentIds)
  const rows = payments ?? []
  if (rows.length !== input.paymentIds.length) return fail('One or more selected payments do not belong to this workspace.')

  const { data: creators } = await supabase.from('ugc_creators').select('id, payment_ready')
    .eq('workspace_id', ctx.workspaceId).in('id', [...new Set(rows.map(r => r.creator_id as string))])
  const ready = new Map((creators ?? []).map(c => [c.id as string, Boolean(c.payment_ready)]))

  const blocked = rows
    .map(row => ({ id: row.id as string, reasons: batchBlockers({
      status: row.status as string, approval_state: row.approval_state as string,
      invoice_status: row.invoice_status as string, tax_status: row.tax_status as string,
      payment_method: row.payment_method as string | null, batch_id: row.batch_id as string | null,
      currency: row.currency as string,
    }, ready.get(row.creator_id as string) ?? false) }))
    .filter(entry => entry.reasons.length > 0)
  if (blocked.length > 0) {
    return fail(`${blocked.length} selected payment(s) are not ready: ${[...new Set(blocked.flatMap(b => b.reasons))].join('; ')}.`)
  }

  const currency = batchCurrency(rows.map(r => ({ currency: r.currency as string })))
  if (!currency.ok) return fail(currency.error)
  const methods = [...new Set(rows.map(r => r.payment_method as string))]
  const total = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const name = input.name.trim().slice(0, 80) || `Payout batch ${new Date().toLocaleDateString('en-GB')}`

  const { data: batch, error: batchError } = await supabase.from('ugc_payment_batches').insert({
    workspace_id: ctx.workspaceId, name, currency: currency.currency,
    payment_method: methods.length === 1 ? methods[0] : 'manual',
    status: 'pending_approval', total_amount: total, item_count: rows.length,
    scheduled_for: input.scheduledFor || null, idempotency_key: input.idempotencyKey, created_by: userId,
  }).select('id').single()
  if (batchError) {
    // A racing double-submit hits the unique idempotency index: return the winner.
    const { data: winner } = await supabase.from('ugc_payment_batches')
      .select('id').eq('workspace_id', ctx.workspaceId).eq('idempotency_key', input.idempotencyKey).maybeSingle()
    if (winner) return { ok: true, id: winner.id, message: 'Batch already created.' }
    return fail(batchError.message)
  }

  // Assign only rows still unbatched, so two concurrent batches can never claim the same payment.
  const { data: claimed, error: assignError } = await supabase.from('ugc_payments')
    .update({ batch_id: batch.id, payout_date: input.scheduledFor || null })
    .in('id', rows.map(r => r.id as string)).eq('workspace_id', ctx.workspaceId).is('batch_id', null)
    .select('id, status')
  if (assignError || (claimed ?? []).length !== rows.length) {
    await supabase.from('ugc_payments').update({ batch_id: null }).eq('batch_id', batch.id)
    await supabase.from('ugc_payment_batches').update({ status: 'cancelled' }).eq('id', batch.id)
    return fail(assignError?.message ?? 'Some payments were added to another batch at the same time. Nothing was batched; please retry.')
  }
  for (const row of claimed ?? []) {
    if (row.status === 'approved' || row.status === 'failed') {
      await supabase.from('ugc_payments').update({ status: 'scheduled' }).eq('id', row.id).eq('workspace_id', ctx.workspaceId)
    }
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment_batch', entityId: batch.id, action: 'created',
    summary: `New payment batch "${name}" was created with ${rows.length} payments`, surface: 'payments',
    metadata: { total, currency: currency.currency },
  })

  revalidateCreators()
  return { ok: true, id: batch.id, message: `Batch created with ${rows.length} payments.` }
}

/** Approves a batch pending approval. Payments stay scheduled until payout is recorded. */
export async function approvePaymentBatch(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('approvePayments')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: batch } = await supabase.from('ugc_payment_batches').select('id, status, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!batch) return fail('Batch not found in this workspace.')
  if (batch.status !== 'pending_approval') return fail('Only batches pending approval can be approved.')

  const { data: updated, error: dbError } = await supabase.from('ugc_payment_batches')
    .update({ status: 'scheduled', approved_by: userId, approved_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId).eq('status', 'pending_approval').select('id')
  if (dbError) return fail(dbError.message)
  if ((updated ?? []).length === 0) return { ok: true, message: 'Batch was already approved.' }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment_batch', entityId: id, action: 'approved',
    summary: `Payment batch "${batch.name}" was approved`, surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, message: 'Batch approved and scheduled.' }
}

/** Approves every batch currently pending approval (header "Approve Payouts"). */
export async function approvePendingBatches(): Promise<ActionResult> {
  const { session, error } = await authorise('approvePayments')
  if (!session) return fail(error!)
  const { data: batches } = await session.supabase.from('ugc_payment_batches')
    .select('id').eq('workspace_id', session.ctx.workspaceId).eq('status', 'pending_approval')
  const ids = (batches ?? []).map(b => b.id as string)
  if (ids.length === 0) return fail('There are no payout batches waiting for approval.')
  for (const batchId of ids) {
    const result = await approvePaymentBatch(batchId)
    if (!result.ok) return result
  }
  return { ok: true, message: `${ids.length} payout batch${ids.length === 1 ? '' : 'es'} approved.` }
}

/**
 * Records the outcome of a payout made through the workspace's own payment
 * rail (bank, PayPal, Wise). Caption Fox never moves money from the browser: it
 * records each attempt with its provider reference, settles the payment, and
 * rolls the batch up to completed / partially completed / failed.
 */
export async function recordPayoutOutcome(input: {
  paymentId: string; outcome: 'paid' | 'failed'; providerReference?: string; failureReason?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('processPayouts')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: payment } = await supabase.from('ugc_payments')
    .select('id, status, amount, currency, creator_id, batch_id, payment_method')
    .eq('id', input.paymentId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!payment) return fail('Payment not found in this workspace.')
  if (input.outcome === 'paid' && !input.providerReference?.trim()) return fail('Enter the payout reference from your bank or payment provider.')
  if (input.outcome === 'failed' && !input.failureReason?.trim()) return fail('Enter why the payout failed.')
  if (!['scheduled', 'processing'].includes(payment.status as string)) {
    return fail(`Only scheduled or processing payments can be settled (this one is ${String(payment.status).replace(/_/g, ' ')}).`)
  }

  if (payment.status === 'scheduled') {
    const { error: startError } = await supabase.from('ugc_payments').update({ status: 'processing' })
      .eq('id', payment.id).eq('workspace_id', ctx.workspaceId).eq('status', 'scheduled')
    if (startError) return fail(startError.message)
  }

  const { count } = await supabase.from('ugc_payout_attempts').select('id', { count: 'exact', head: true }).eq('payment_id', payment.id)
  const { error: attemptError } = await supabase.from('ugc_payout_attempts').insert({
    workspace_id: ctx.workspaceId, payment_id: payment.id, batch_id: payment.batch_id,
    attempt_no: (count ?? 0) + 1, status: input.outcome === 'paid' ? 'succeeded' : 'failed',
    provider: payment.payment_method ?? 'manual', provider_reference: input.providerReference?.trim().slice(0, 120) || null,
    error_message: input.failureReason?.trim().slice(0, 500) || null, created_by: userId,
  })
  if (attemptError) return fail(attemptError.message)

  const settled = input.outcome === 'paid'
    ? { status: 'paid', paid_at: new Date().toISOString(), provider_reference: input.providerReference!.trim().slice(0, 120), failure_reason: null }
    : { status: 'failed', failure_reason: input.failureReason!.trim().slice(0, 500) }
  const { error: settleError } = await supabase.from('ugc_payments').update(settled)
    .eq('id', payment.id).eq('workspace_id', ctx.workspaceId).eq('status', 'processing')
  if (settleError) return fail(settleError.message)

  if (input.outcome === 'paid') {
    const { data: paid } = await supabase.from('ugc_payments').select('amount')
      .eq('workspace_id', ctx.workspaceId).eq('creator_id', payment.creator_id).eq('status', 'paid')
    await supabase.from('ugc_creators').update({ total_earnings: (paid ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0) })
      .eq('id', payment.creator_id).eq('workspace_id', ctx.workspaceId)
  }

  if (payment.batch_id) {
    const { data: items } = await supabase.from('ugc_payments').select('status').eq('batch_id', payment.batch_id)
    const batchStatus = settledBatchStatus((items ?? []).map(i => i.status as string))
    await supabase.from('ugc_payment_batches').update({
      status: batchStatus, processed_at: batchStatus === 'processing' ? null : new Date().toISOString(),
    }).eq('id', payment.batch_id).eq('workspace_id', ctx.workspaceId)
  }

  const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: (payment.currency as string) || 'GBP' }).format(Number(payment.amount))
  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment', entityId: payment.id, action: input.outcome === 'paid' ? 'payout_paid' : 'payout_failed',
    summary: input.outcome === 'paid' ? `Payout of ${amount} was completed` : `Payout of ${amount} failed`,
    link: storedLink('payments', payment.id), surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, message: input.outcome === 'paid' ? 'Payout recorded as paid.' : 'Payout recorded as failed.' }
}

/** Re-queues a failed payout for another attempt. Attempt history is kept. */
export async function retryPayout(paymentId: string): Promise<ActionResult> {
  const { session, error } = await authorise('processPayouts')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  const { data, error: dbError } = await supabase.from('ugc_payments')
    .update({ status: 'scheduled', failure_reason: null })
    .eq('id', paymentId).eq('workspace_id', ctx.workspaceId).eq('status', 'failed').select('id')
  if (dbError) return fail(dbError.message)
  if ((data ?? []).length === 0) return fail('Only failed payouts can be retried.')

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment', entityId: paymentId, action: 'payout_retry',
    summary: 'Failed payout re-scheduled for another attempt', link: storedLink('payments', paymentId), surface: 'payments',
  })
  revalidateCreators()
  return { ok: true, message: 'Payout re-scheduled.' }
}

// ============================================================================
// Review assignment
// ============================================================================

export async function reassignReviewer(submissionId: string, reviewerId: string): Promise<ActionResult> {
  const { session, error } = await authorise('approve')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_submissions', submissionId, ctx.workspaceId))) return fail('Submission not found.')
  const { data: member } = await supabase.from('workspace_members').select('user_id, role')
    .eq('workspace_id', ctx.workspaceId).eq('user_id', reviewerId).maybeSingle()
  if (!member || !['owner', 'admin', 'manager'].includes(member.role as string)) {
    return fail('The reviewer must be an owner, admin or manager of this workspace.')
  }

  const { error: dbError } = await supabase.from('ugc_submissions').update({ reviewer_id: reviewerId })
    .eq('id', submissionId).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)
  await supabase.from('ugc_submission_reviews').insert({
    workspace_id: ctx.workspaceId, submission_id: submissionId, reviewer_id: userId, decision: 'reassigned',
  })
  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: submissionId, action: 'reassigned',
    summary: 'Submission reviewer reassigned', link: storedLink('submissions', submissionId), surface: 'submissions',
  })
  revalidateCreators()
  return { ok: true, message: 'Reviewer updated.' }
}

// ============================================================================
// Saved views
// ============================================================================

const SAVED_VIEW_SURFACES = ['creators', 'briefs', 'submissions', 'rights', 'payments'] as const
const SAVED_VIEW_KEYS = new Set([
  'q', 'view', 'sort', 'size', 'from', 'to', 'niche', 'audience', 'platform', 'region', 'availability', 'status',
  'rights', 'tag', 'owner', 'rateMin', 'rateMax', 'engMin', 'list', 'shortlist', 'campaign', 'channel', 'approval',
  'creator', 'due', 'brief', 'assetType', 'reviewer', 'issue', 'territory', 'scope', 'expiry', 'method',
  'approver', 'currency', 'invoice', 'tax', 'batch',
])

/**
 * Saves the current URL state as a named view. Only known filter keys are
 * stored, and the page parser re-validates them on load, so a saved (or
 * shared) view can never widen what the viewer is allowed to see.
 */
export async function saveCreatorsView(input: {
  surface: string; name: string; query: Record<string, string>; shared?: boolean
}): Promise<ActionResult> {
  const { session, error } = await authorise('view')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(SAVED_VIEW_SURFACES as readonly string[]).includes(input.surface)) return fail('Unknown view surface.')
  const name = input.name.trim().slice(0, 60)
  if (!name) return fail('Give this view a name.')

  const query = Object.fromEntries(Object.entries(input.query)
    .filter(([key, value]) => SAVED_VIEW_KEYS.has(key) && typeof value === 'string' && value.length <= 120))

  const { data, error: dbError } = await supabase.from('creator_saved_views').upsert({
    workspace_id: ctx.workspaceId, owner_id: userId, surface: input.surface, name, query,
    is_shared: Boolean(input.shared), updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,owner_id,surface,name' }).select('id').single()
  if (dbError) return fail(dbError.message)

  revalidateCreators()
  return { ok: true, id: data.id, message: `View "${name}" saved.` }
}

export async function deleteCreatorsView(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('view')
  if (!session) return fail(error!)
  const { error: dbError } = await session.supabase.from('creator_saved_views').delete()
    .eq('id', id).eq('workspace_id', session.ctx.workspaceId).eq('owner_id', session.userId)
  if (dbError) return fail(dbError.message)
  revalidateCreators()
  return { ok: true, message: 'View deleted.' }
}

// ============================================================================
// Brief templates
// ============================================================================

/**
 * Duplicates an existing brief (fields and deliverables, never creators,
 * submissions or dates in the past) as a new draft to use as a template.
 */
export async function duplicateBrief(id: string, title?: string): Promise<ActionResult> {
  const { session, error } = await authorise('createBrief')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: source } = await supabase.from('ugc_briefs')
    .select('title, description, campaign_id, category, priority, channels, platforms, deliverables, do_instructions, dont_instructions, rights_requirement, budget, currency, max_creators, deliverables_target, cover_path, cover_url')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!source) return fail('Brief not found in this workspace.')

  const newTitle = (title?.trim() || `Copy of ${source.title}`).slice(0, 160)
  const { data, error: dbError } = await supabase.from('ugc_briefs').insert({
    ...source, title: newTitle, workspace_id: ctx.workspaceId, status: 'draft', approval_stage: 'not_sent',
    deadline: null, creators_assigned: 0, deliverables_submitted: 0, owner_id: userId, created_by: userId,
  }).select('id').single()
  if (dbError) return fail(dbError.message)

  const { data: deliverables } = await supabase.from('ugc_brief_deliverables')
    .select('title, asset_type, quantity, channel, notes, position').eq('workspace_id', ctx.workspaceId).eq('brief_id', id)
  if (deliverables?.length) {
    await supabase.from('ugc_brief_deliverables').insert(deliverables.map(d => ({ ...d, workspace_id: ctx.workspaceId, brief_id: data.id })))
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'brief', entityId: data.id, action: 'duplicated',
    summary: `Brief "${newTitle}" created from template "${source.title}"`, link: storedLink('briefs', data.id), surface: 'briefs',
  })
  revalidateCreators()
  return { ok: true, id: data.id, message: `Draft "${newTitle}" created.` }
}