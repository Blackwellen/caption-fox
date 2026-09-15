'use server'

// Studio → Media mutations.

import {
  authorise, cleanArray, dbFail, fail, logActivity, logAudit, ownsRecord, revalidateStudio,
  type ActionResult,
} from '@/lib/studio/action-helpers'
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, MEDIA_STATUSES, mediaTypeFor } from '@/lib/studio/constants'
import type { StudioCapabilities } from '@/lib/studio/entitlements'

/**
 * Registers an object that has already been uploaded to Supabase Storage under
 * this workspace's prefix. The prefix is re-checked server-side, so a client
 * cannot claim an object belonging to another workspace.
 */
export async function registerMediaAsset(input: {
  fileName: string
  storagePath: string
  publicUrl: string
  mimeType: string
  fileSize: number
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  collectionId?: string | null
  altText?: string
  description?: string
  tags?: string[]
}): Promise<ActionResult> {
  const { session, error } = await authorise('uploadMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const fileName = input.fileName?.trim() ?? ''
  if (!fileName) return fail('The file needs a name.', { fileName: 'A name is required.' })

  if (!ALLOWED_UPLOAD_MIME.includes(input.mimeType)) {
    return fail(`${input.mimeType || 'That file type'} is not supported.`, { file: 'Unsupported file type.' })
  }
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0 || input.fileSize > MAX_UPLOAD_BYTES) {
    return fail('Files must be between 1 byte and 5 GB.', { file: 'File is too large.' })
  }
  // The path must sit inside this workspace's prefix — never trust a client path.
  if (!input.storagePath.startsWith(`${ctx.workspaceId}/`) || input.storagePath.includes('..')) {
    return fail('That upload path is not valid for this workspace.')
  }
  if (input.collectionId
    && !(await ownsRecord(supabase, 'studio_media_collections', input.collectionId, ctx.workspaceId))) {
    return fail('That collection is not part of this workspace.')
  }

  // Storage quota is a plan gate, enforced here rather than only in the UI.
  const { data: existing } = await supabase
    .from('media_assets').select('file_size')
    .eq('workspace_id', ctx.workspaceId).is('archived_at', null).limit(20_000)
  const used = (existing ?? []).reduce((sum, row) => sum + (row.file_size ?? 0), 0)
  if (used + input.fileSize > session.limits.storageBytes) {
    return fail('This workspace has reached its storage limit. Upgrade your plan or archive unused assets.')
  }

  const { data, error: insertError } = await supabase
    .from('media_assets')
    .insert({
      workspace_id: ctx.workspaceId,
      file_name: fileName.slice(0, 255),
      file_path: input.storagePath,
      file_url: input.publicUrl,
      file_type: mediaTypeFor(input.mimeType),
      mime_type: input.mimeType,
      file_size: Math.round(input.fileSize),
      width: input.width ?? null,
      height: input.height ?? null,
      duration_seconds: input.durationSeconds ?? null,
      collection_id: input.collectionId || null,
      alt_text: input.altText?.slice(0, 500) ?? null,
      description: input.description?.slice(0, 1000) ?? null,
      tags: cleanArray(input.tags, undefined, 20),
      // Uploads from users who cannot approve land in review rather than
      // silently becoming an approved brand asset.
      status: session.capabilities.approveMedia ? 'ready' : 'needs_review',
      owner_id: userId, uploaded_by: userId,
    })
    .select('id').single()
  if (insertError) return dbFail('registerMediaAsset', insertError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'asset', entityId: data.id, action: 'uploaded',
    summary: `uploaded ${fileName}`, link: `/app/studio/media?selected=${data.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.uploaded', resourceType: 'media_asset', resourceId: data.id,
    metadata: { file_name: fileName, size: input.fileSize, mime: input.mimeType },
  })
  revalidateStudio()
  return { ok: true, id: data.id, message: `${fileName} uploaded.` }
}

export async function updateMediaAsset(input: {
  id: string
  altText?: string
  description?: string
  tags?: string[]
  collectionId?: string | null
}): Promise<ActionResult> {
  const { session, error } = await authorise('editMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'media_assets', input.id, ctx.workspaceId))) {
    return fail('That asset is not part of this workspace.')
  }
  if (input.collectionId
    && !(await ownsRecord(supabase, 'studio_media_collections', input.collectionId, ctx.workspaceId))) {
    return fail('That collection is not part of this workspace.')
  }

  const { error: updateError } = await supabase
    .from('media_assets')
    .update({
      alt_text: input.altText?.slice(0, 500) ?? null,
      description: input.description?.slice(0, 1000) ?? null,
      tags: cleanArray(input.tags, undefined, 20),
      collection_id: input.collectionId || null,
    })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('updateMediaAsset', updateError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.updated', resourceType: 'media_asset', resourceId: input.id,
  })
  revalidateStudio()
  return { ok: true, message: 'Asset updated.' }
}

export async function setMediaStatus(
  input: { id: string; status: string; note?: string },
): Promise<ActionResult> {
  if (!(MEDIA_STATUSES as readonly string[]).includes(input.status)) return fail('Unknown status.')
  const capability: keyof StudioCapabilities =
    input.status === 'ready' || input.status === 'changes_requested' ? 'approveMedia' : 'editMedia'

  const { session, error } = await authorise(capability)
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase
    .from('media_assets').select('id, file_name, status')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That asset is not part of this workspace.')

  const patch: Record<string, unknown> = {
    status: input.status, review_note: input.note?.slice(0, 500) ?? null,
  }
  if (input.status === 'ready') { patch.approved_by = userId; patch.approved_at = new Date().toISOString() }
  if (input.status === 'archived') patch.archived_at = new Date().toISOString()
  if (current.status === 'archived' && input.status !== 'archived') patch.archived_at = null

  const { error: updateError } = await supabase
    .from('media_assets').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('setMediaStatus', updateError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'asset', entityId: input.id, action: input.status,
    summary: `${input.status === 'ready' ? 'approved' : 'updated'} ${current.file_name}`,
    link: `/app/studio/media?selected=${input.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.media.${input.status}`, resourceType: 'media_asset', resourceId: input.id,
    metadata: { from: current.status, to: input.status },
  })
  revalidateStudio()
  return { ok: true, message: 'Asset updated.' }
}

export async function deleteMediaAsset(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('deleteMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: asset } = await supabase
    .from('media_assets').select('id, file_name, file_path')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!asset) return fail('That asset is not part of this workspace.')

  const { count } = await supabase
    .from('studio_content_assets').select('asset_id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId).eq('asset_id', input.id)
  if ((count ?? 0) > 0) {
    return fail(`This asset is used in ${count} content record${count === 1 ? '' : 's'}. Remove it there first, or archive it instead.`)
  }

  // Remove the stored object first: an orphaned row is recoverable, whereas an
  // orphaned object in a private bucket is invisible to everyone.
  const { error: storageError } = await supabase.storage.from('media').remove([asset.file_path])
  if (storageError) console.error('[studio] storage delete failed:', storageError.message)

  const { error: deleteError } = await supabase
    .from('media_assets').delete().eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return dbFail('deleteMediaAsset', deleteError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.deleted', resourceType: 'media_asset', resourceId: input.id,
    metadata: { file_name: asset.file_name },
  })
  revalidateStudio()
  return { ok: true, message: `${asset.file_name} deleted.` }
}

export async function createMediaCollection(
  input: { name: string; kind?: string; description?: string },
): Promise<ActionResult> {
  const { session, error } = await authorise('uploadMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const name = input.name?.trim() ?? ''
  if (!name) return fail('Name the collection.', { name: 'A name is required.' })

  const kinds = ['campaign', 'brand', 'social', 'team', 'custom']
  const { data, error: insertError } = await supabase
    .from('studio_media_collections')
    .insert({
      workspace_id: ctx.workspaceId, name: name.slice(0, 120),
      description: input.description?.slice(0, 500) ?? null,
      kind: kinds.includes(input.kind ?? '') ? input.kind : 'custom',
      created_by: userId,
    })
    .select('id').single()
  if (insertError) {
    if (insertError.code === '23505') {
      return fail('A collection with that name already exists.', { name: 'Already in use.' })
    }
    return dbFail('createMediaCollection', insertError)
  }

  revalidateStudio()
  return { ok: true, id: data.id, message: 'Collection created.' }
}
