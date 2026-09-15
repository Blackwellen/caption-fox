'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCreatorSession } from '@/lib/creators/server'
import type { CreatorCapabilities } from '@/lib/creators/entitlements'
import {
  canTransitionBrief, canTransitionPayment, canTransitionSubmission,
  INVITATION_EXPIRY_DAYS, mediaTypeForMime, UPLOAD_LIMITS,
} from '@/lib/creators/constants'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

const CREATOR_PATHS = [
  '/app/creators', '/app/creators/creators', '/app/creators/briefs',
  '/app/creators/submissions', '/app/creators/rights', '/app/creators/payments',
]

function revalidateCreators() {
  for (const path of CREATOR_PATHS) revalidatePath(path)
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
    summary: `${name} was added to Creators`, link: `/app/creators/creators/${data.id}`, surface: 'creators',
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
    summary: 'Creator profile updated', link: `/app/creators/creators/${id}`, surface: 'creators',
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
    summary: archived ? 'Creator archived' : 'Creator restored', link: `/app/creators/creators/${id}`, surface: 'creators',
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
    link: `/app/creators/creators/${id}`, surface: 'creators',
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
    summary: `Brief "${title}" created`, link: `/app/creators/briefs/${briefId}`, surface: 'briefs',
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
    link: `/app/creators/briefs/${id}`, surface: 'briefs',
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
    summary: archived ? 'Brief archived' : 'Brief restored', link: `/app/creators/briefs/${id}`, surface: 'briefs',
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
    summary: `Creator progress updated to ${status.replace(/_/g, ' ')}`, link: `/app/creators/briefs/${briefId}`, surface: 'briefs',
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
    summary: 'New submission delivered for review', link: `/app/creators/submissions/${submissionId}`, surface: 'submissions',
  })

  revalidateCreators()
  return { ok: true, id: submissionId, message: 'Submission uploaded for review.' }
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
    .from('ugc_submissions').select('id, status, title, creator_id')
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
    decision: input.decision, note: input.note || null,
    creator_visible: input.creatorVisible ?? false, timecode_seconds: input.timecodeSeconds ?? null,
  })
  if (reviewError) return fail(reviewError.message)

  if (nextStatus) {
    const update: Record<string, unknown> = {
      status: nextStatus, reviewer_id: userId, updated_at: new Date().toISOString(),
    }
    if (nextStatus === 'approved') {
      update.reviewed_at = new Date().toISOString()
      update.payment_eligible = true
    }
    if (input.decision === 'started' || submission.status === 'waiting_review') {
      update.review_started_at = new Date().toISOString()
    }
    await supabase.from('ugc_submissions').update(update).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  } else if (input.decision === 'started') {
    await supabase.from('ugc_submissions')
      .update({ status: 'in_review', reviewer_id: userId, review_started_at: new Date().toISOString() })
      .eq('id', input.id).eq('workspace_id', ctx.workspaceId).eq('status', 'waiting_review')
  }

  const label = nextStatus ? nextStatus.replace(/_/g, ' ') : 'reviewed'
  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'submission', entityId: input.id, action: input.decision,
    summary: `Submission ${label}`, link: `/app/creators/submissions/${input.id}`, surface: 'submissions',
  })

  revalidateCreators()
  return { ok: true, message: `Submission ${label}.` }
}

export async function bulkApproveSubmissions(ids: string[]): Promise<ActionResult> {
  const { session, error } = await authorise('bulkApprove')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (ids.length === 0) return fail('No submissions selected.')

  const { data: submissions } = await supabase
    .from('ugc_submissions').select('id, status').eq('workspace_id', ctx.workspaceId).in('id', ids)
  const eligible = (submissions ?? []).filter(row => canTransitionSubmission(row.status as string, 'approved'))
  if (eligible.length === 0) return fail('None of the selected submissions can be approved from their current status.')

  const eligibleIds = eligible.map(row => row.id as string)
  const { error: dbError } = await supabase.from('ugc_submissions')
    .update({ status: 'approved', reviewer_id: userId, reviewed_at: new Date().toISOString(), payment_eligible: true })
    .in('id', eligibleIds).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

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
    summary: `Issue flagged: ${input.category.replace(/_/g, ' ')}`, link: `/app/creators/submissions/${input.submissionId}`, surface: 'submissions',
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
    summary: `Rights record created for "${label}"`, link: `/app/creators/rights/${data.id}`, surface: 'rights',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: 'Rights record created.' }
}

export async function updateRightsStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('approveRights')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'ugc_rights', id, ctx.workspaceId))) return fail('Rights record not found.')

  const { error: dbError } = await supabase.from('ugc_rights')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'rights', entityId: id, action: 'status_changed',
    summary: `Rights status changed to ${status.replace(/_/g, ' ')}`, link: `/app/creators/rights/${id}`, surface: 'rights',
  })

  revalidateCreators()
  return { ok: true, message: 'Rights status updated.' }
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
    summary: `Payment of ${input.currency ?? 'GBP'} ${amount.toFixed(2)} recorded`, link: `/app/creators/payments/${data.id}`, surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, id: data.id, message: 'Payment recorded.' }
}

export async function updatePaymentStatus(id: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('approvePayments')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

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
    summary: `Payment moved to ${status.replace(/_/g, ' ')}`, link: `/app/creators/payments/${id}`, surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, message: 'Payment status updated.' }
}

/**
 * Creates a payout batch from the selected eligible payments. Runs as one
 * insert of the batch followed by one update assigning `batch_id`, guarded by
 * a caller-supplied idempotency key so a double-click cannot create two
 * batches for the same click.
 */
export async function createPaymentBatch(input: {
  name: string; paymentIds: string[]; scheduledFor?: string; idempotencyKey: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('processPayouts')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (input.paymentIds.length === 0) return fail('Select at least one payment for this batch.')

  const { data: existingBatch } = await supabase.from('ugc_payment_batches')
    .select('id').eq('workspace_id', ctx.workspaceId).eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (existingBatch) return { ok: true, id: existingBatch.id, message: 'Batch already created.' }

  const { data: payments } = await supabase.from('ugc_payments')
    .select('id, amount, currency, payment_method, status, batch_id')
    .eq('workspace_id', ctx.workspaceId).in('id', input.paymentIds)
  const eligible = (payments ?? []).filter(row => row.batch_id === null && ['approved', 'scheduled', 'failed'].includes(row.status as string))
  if (eligible.length === 0) return fail('None of the selected payments are eligible for a batch.')

  const currency = eligible[0].currency as string
  const total = eligible.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  const { data: batch, error: batchError } = await supabase.from('ugc_payment_batches').insert({
    workspace_id: ctx.workspaceId, name: input.name.trim() || `Payout batch ${new Date().toLocaleDateString('en-GB')}`,
    currency, payment_method: (eligible[0].payment_method as string) || 'bank_transfer',
    status: 'pending_approval', total_amount: total, item_count: eligible.length,
    scheduled_for: input.scheduledFor || null, idempotency_key: input.idempotencyKey, created_by: userId,
  }).select('id').single()
  if (batchError) return fail(batchError.message)

  const eligibleIds = eligible.map(row => row.id as string)
  const { error: assignError } = await supabase.from('ugc_payments')
    .update({ batch_id: batch.id, status: 'scheduled', payout_date: input.scheduledFor || null })
    .in('id', eligibleIds).eq('workspace_id', ctx.workspaceId)
  if (assignError) return fail(assignError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment_batch', entityId: batch.id, action: 'created',
    summary: `Payment batch "${input.name}" created with ${eligibleIds.length} payments`, surface: 'payments',
  })

  revalidateCreators()
  const skipped = input.paymentIds.length - eligibleIds.length
  return { ok: true, id: batch.id, message: skipped > 0 ? `Batch created with ${eligibleIds.length} payments (${skipped} skipped).` : `Batch created with ${eligibleIds.length} payments.` }
}

export async function approvePaymentBatch(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('approvePayments')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: batch } = await supabase.from('ugc_payment_batches').select('id, status, name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!batch) return fail('Batch not found in this workspace.')
  if (batch.status !== 'pending_approval') return fail('Only batches pending approval can be approved.')

  const { error: dbError } = await supabase.from('ugc_payment_batches')
    .update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (dbError) return fail(dbError.message)

  await supabase.from('ugc_payments').update({ status: 'approved' }).eq('batch_id', id).eq('status', 'scheduled')

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payment_batch', entityId: id, action: 'approved',
    summary: `Payment batch "${batch.name}" approved`, surface: 'payments',
  })

  revalidateCreators()
  return { ok: true, message: 'Batch approved.' }
}
