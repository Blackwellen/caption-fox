'use server'

// Studio → Media mutations. Files live in the private Cloudflare R2 bucket
// under `studio/{workspaceId}/…`; rows live in the shared `media_assets` table
// (the same library Brand & Assets uses).

import type { SupabaseClient } from '@supabase/supabase-js'
import { studioBase } from '@/lib/studio/paths'
import {
  authorise, cleanArray, dbFail, fail, logActivity, logAudit, ownsRecord, revalidateStudio,
  type ActionResult,
} from '@/lib/studio/action-helpers'
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, MEDIA_STATUSES, mediaTypeFor } from '@/lib/studio/constants'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import {
  R2_PREFIX, createUploadUrl, deleteObject, inspectObject, isR2Configured, putObject, readObject, signReadUrls,
} from '@/lib/storage/r2'

/** Extension allowlist per MIME type: a renamed file whose extension and type disagree is rejected. */
const EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/gif': ['gif'], 'image/webp': ['webp'],
  'image/svg+xml': ['svg'], 'image/avif': ['avif'], 'video/mp4': ['mp4', 'm4v'], 'video/quicktime': ['mov'],
  'video/webm': ['webm'], 'audio/mpeg': ['mp3'], 'audio/wav': ['wav'], 'audio/mp4': ['m4a'],
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/csv': ['csv'], 'text/plain': ['txt'],
}

function validateFile(fileName: string, mime: string, size: number): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_UPLOAD_MIME.includes(mime) || !(EXTENSIONS[mime] ?? []).includes(ext)) {
    return `${fileName || 'This file'} is not a supported type. Upload images, video, audio, PDF, PowerPoint, Word, CSV or text files.`
  }
  if (!Number.isFinite(size) || size <= 0) return `${fileName} appears to be empty.`
  if (size > MAX_UPLOAD_BYTES) return `${fileName} is larger than the 5 GB limit.`
  return null
}

async function storageUsed(supabase: SupabaseClient, workspaceId: string): Promise<number> {
  const { data } = await supabase.from('media_assets').select('file_size')
    .eq('workspace_id', workspaceId).is('archived_at', null).limit(20_000)
  return (data ?? []).reduce((sum, row) => sum + (row.file_size ?? 0), 0)
}

/**
 * Step 1 of an upload: validates type, size and the plan's storage quota, checks
 * for a duplicate by checksum, then issues a 10-minute signed PUT under this
 * workspace's private R2 prefix. The browser never receives storage credentials.
 */
export async function requestMediaUpload(input: {
  fileName: string; contentType: string; size: number; checksum?: string; replaceAssetId?: string | null
}): Promise<ActionResult<{ url: string; storedPath: string; duplicateOf: { id: string; file_name: string } | null }>> {
  const { session, error } = await authorise(input.replaceAssetId ? 'editMedia' : 'uploadMedia')
  if (!session) return fail(error!)
  const { supabase, ctx } = session
  if (!isR2Configured()) return fail('File storage is not configured for this environment. Ask an administrator to connect Cloudflare R2.')

  const fileName = (input.fileName ?? '').trim().slice(0, 200)
  const invalid = validateFile(fileName, String(input.contentType ?? ''), Number(input.size))
  if (invalid) return fail(invalid, { file: invalid })

  if (input.replaceAssetId && !(await ownsRecord(supabase, 'media_assets', input.replaceAssetId, ctx.workspaceId))) {
    return fail('The asset you are replacing is not part of this workspace.')
  }
  if ((await storageUsed(supabase, ctx.workspaceId)) + Number(input.size) > session.limits.storageBytes) {
    return fail('This upload would exceed the storage included in your plan. Archive unused assets or upgrade.', { file: 'Storage limit reached.' })
  }

  let duplicateOf: { id: string; file_name: string } | null = null
  if (!input.replaceAssetId && input.checksum && /^[a-f0-9]{64}$/.test(input.checksum)) {
    const { data } = await supabase.from('media_assets').select('id, file_name')
      .eq('workspace_id', ctx.workspaceId).eq('checksum', input.checksum).is('archived_at', null).limit(1).maybeSingle()
    duplicateOf = data ?? null
  }

  const { url, storedPath } = await createUploadUrl({
    area: 'studio', workspaceId: ctx.workspaceId, fileName, contentType: String(input.contentType),
  })
  return { ok: true, data: { url, storedPath, duplicateOf } }
}

/**
 * Step 2: re-reads the stored object's real size and type from R2 (the client's
 * claims are never trusted), then creates the `media_assets` row. When replacing,
 * the previous file is kept as a version and the record keeps its links.
 */
export async function finaliseMediaUpload(input: {
  storedPath: string; fileName: string; checksum?: string
  width?: number | null; height?: number | null; durationSeconds?: number | null
  collectionId?: string | null; tags?: string[]; description?: string; replaceAssetId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const { session, error } = await authorise(input.replaceAssetId ? 'editMedia' : 'uploadMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!input.storedPath.startsWith(`${R2_PREFIX}studio/${ctx.workspaceId}/`) || input.storedPath.includes('..')) {
    return fail('That upload does not belong to this workspace.')
  }
  const head = await inspectObject(input.storedPath)
  if (!head || head.size <= 0) return fail('The upload did not complete. Please try again.')
  const fileName = (input.fileName ?? '').trim().slice(0, 200)
  const mime = head.contentType ?? ''
  const invalid = validateFile(fileName, mime, head.size)
  if (invalid) { await deleteObject(input.storedPath); return fail(invalid) }
  if (input.collectionId && !(await ownsRecord(supabase, 'studio_media_collections', input.collectionId, ctx.workspaceId))) {
    await deleteObject(input.storedPath)
    return fail('That collection is not part of this workspace.')
  }

  const type = mediaTypeFor(mime)
  const checksum = input.checksum && /^[a-f0-9]{64}$/.test(input.checksum) ? input.checksum : null
  const width = typeof input.width === 'number' && Number.isFinite(input.width) ? Math.round(input.width) : null
  const height = typeof input.height === 'number' && Number.isFinite(input.height) ? Math.round(input.height) : null
  const duration = typeof input.durationSeconds === 'number' && Number.isFinite(input.durationSeconds) ? input.durationSeconds : null
  const status = session.capabilities.approveMedia ? 'ready' : 'needs_review'

  if (input.replaceAssetId) {
    const { data: prev } = await supabase.from('media_assets')
      .select('id, file_name, file_path, file_url, file_size, version')
      .eq('id', input.replaceAssetId).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!prev) { await deleteObject(input.storedPath); return fail('The asset you are replacing was not found.') }
    const version = prev.version ?? 1
    const { error: versionError } = await supabase.from('studio_asset_versions').insert({
      workspace_id: ctx.workspaceId, asset_id: prev.id, version,
      file_path: prev.file_path, file_url: prev.file_url, file_size: prev.file_size,
      replaced_by: userId, note: `Replaced by ${fileName}`,
    })
    if (versionError) { await deleteObject(input.storedPath); return dbFail('replaceMedia.version', versionError) }
    const { error: updateError } = await supabase.from('media_assets').update({
      file_name: fileName, file_path: input.storedPath, file_url: input.storedPath, mime_type: mime, file_type: type,
      file_size: head.size, width, height, duration_seconds: duration, checksum, version: version + 1,
      thumbnail_path: type === 'image' ? input.storedPath : null, status, updated_at: new Date().toISOString(),
    }).eq('id', prev.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('replaceMedia.update', updateError)
    await logActivity(supabase, ctx.workspaceId, userId, {
      entityType: 'asset', entityId: prev.id, action: 'replaced',
      summary: `replaced ${prev.file_name} with version ${version + 1}`, link: `${studioBase(ctx)}/media?selected=${prev.id}`,
    })
    await logAudit(supabase, ctx.workspaceId, userId, {
      action: 'studio.media.replaced', resourceType: 'media_asset', resourceId: prev.id,
      metadata: { version: version + 1, size: head.size, mime },
    })
    revalidateStudio()
    return { ok: true, id: prev.id, data: { id: prev.id }, message: `Version ${version + 1} of ${prev.file_name} uploaded.` }
  }

  const { data, error: insertError } = await supabase.from('media_assets').insert({
    workspace_id: ctx.workspaceId, file_name: fileName, file_path: input.storedPath, file_url: input.storedPath,
    thumbnail_path: type === 'image' ? input.storedPath : null, storage_bucket: 'r2',
    file_type: type, asset_kind: type === 'document' ? (mime === 'application/pdf' ? 'pdf' : 'document') : type,
    mime_type: mime, file_size: head.size, width, height, duration_seconds: duration,
    collection_id: input.collectionId || null, checksum,
    tags: cleanArray(input.tags, undefined, 20), description: input.description?.slice(0, 1000) ?? null,
    // Uploads from people who cannot approve land in review rather than
    // silently becoming approved brand assets.
    status, processing_state: 'ready', scan_state: 'pending', version: 1,
    owner_id: userId, uploaded_by: userId,
  }).select('id').single()
  if (insertError) { await deleteObject(input.storedPath); return dbFail('finaliseMediaUpload', insertError) }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'asset', entityId: data.id, action: 'uploaded',
    summary: `uploaded ${fileName}`, link: `${studioBase(ctx)}/media?selected=${data.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.uploaded', resourceType: 'media_asset', resourceId: data.id,
    metadata: { file_name: fileName, size: head.size, mime },
  })
  revalidateStudio()
  return { ok: true, id: data.id, data: { id: data.id }, message: `${fileName} uploaded.` }
}

/** A short-lived signed download link, audit-logged. */
export async function downloadMediaAsset(input: { id: string }): Promise<ActionResult<{ url: string }>> {
  const { session, error } = await authorise('viewMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  const { data: asset } = await supabase.from('media_assets').select('id, file_name, file_path')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!asset) return fail('That asset is not part of this workspace.')
  const allowed = [`${R2_PREFIX}studio/${ctx.workspaceId}/`, `${R2_PREFIX}brand-assets/${ctx.workspaceId}/`]
  if (!allowed.some(prefix => asset.file_path.startsWith(prefix))) return fail('This asset has no downloadable file in storage.')
  const signed = await signReadUrls([asset.file_path], 120)
  const url = signed.get(asset.file_path)
  if (!url) return fail('The file could not be found in storage.')
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.downloaded', resourceType: 'media_asset', resourceId: asset.id, metadata: { file_name: asset.file_name },
  })
  return { ok: true, data: { url } }
}

export async function updateMediaAsset(input: {
  id: string
  fileName?: string
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.fileName !== undefined) {
    const name = input.fileName.trim()
    if (!name) return fail('The file needs a name.', { fileName: 'A name is required.' })
    patch.file_name = name.slice(0, 200)
  }
  if (input.altText !== undefined) patch.alt_text = input.altText.slice(0, 500) || null
  if (input.description !== undefined) patch.description = input.description.slice(0, 1000) || null
  if (input.tags !== undefined) patch.tags = cleanArray(input.tags.map(t => t.toLowerCase()), undefined, 20)
  if (input.collectionId !== undefined) patch.collection_id = input.collectionId || null

  const { error: updateError } = await supabase
    .from('media_assets').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('updateMediaAsset', updateError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.updated', resourceType: 'media_asset', resourceId: input.id,
    metadata: { fields: Object.keys(patch).filter(k => k !== 'updated_at') },
  })
  revalidateStudio()
  return { ok: true, message: 'Asset updated.' }
}

const CROPPABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_CROP_BYTES = 40 * 1024 * 1024

/**
 * Crops (and optionally rotates) an image on the server and saves the result as
 * a new version of the same asset. The crop box arrives as fractions of the
 * displayed image (0–1), so it is resolution-independent; the original file is
 * kept in version history by the shared replace path.
 */
export async function cropMediaAsset(input: {
  id: string
  crop: { x: number; y: number; width: number; height: number }
  rotate?: 0 | 90 | 180 | 270
}): Promise<ActionResult<{ width: number; height: number }>> {
  const { session, error } = await authorise('editMedia')
  if (!session) return fail(error!)
  const { supabase, ctx } = session
  if (!isR2Configured()) return fail('File storage is not configured for this environment.')

  const { x, y, width, height } = input.crop ?? {}
  const valid = [x, y, width, height].every(v => typeof v === 'number' && Number.isFinite(v))
    && x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1.0001 && y + height <= 1.0001
  if (!valid) return fail('Choose a crop area inside the image.')
  const rotate = [0, 90, 180, 270].includes(Number(input.rotate)) ? Number(input.rotate) : 0

  const { data: asset } = await supabase.from('media_assets').select('id, file_name, file_path, mime_type, file_size, status')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!asset) return fail('That asset is not part of this workspace.')
  if (asset.status === 'archived') return fail('Restore the asset before editing it.')
  if (!CROPPABLE.includes(asset.mime_type ?? '')) return fail('Only JPEG, PNG, WebP and AVIF images can be cropped.')
  const allowed = [`${R2_PREFIX}studio/${ctx.workspaceId}/`, `${R2_PREFIX}brand-assets/${ctx.workspaceId}/`]
  if (!allowed.some(p => asset.file_path.startsWith(p)) || asset.file_path.includes('..')) return fail('This asset has no editable file in storage.')
  if ((asset.file_size ?? 0) > MAX_CROP_BYTES) return fail('Images larger than 40 MB cannot be cropped in the browser editor.')

  const source = await readObject(asset.file_path)
  if (!source) return fail('The original file could not be read from storage.')

  let output: { data: Buffer; info: { width: number; height: number } }
  try {
    const sharp = (await import('sharp')).default
    // Orientation is applied first so the crop matches what the user saw.
    const oriented = sharp(source, { limitInputPixels: 268_402_689 }).rotate()
    const meta = await sharp(await oriented.clone().toBuffer()).metadata()
    const W = meta.width ?? 0
    const H = meta.height ?? 0
    if (!W || !H) return fail('The image dimensions could not be read.')
    const left = Math.min(W - 1, Math.max(0, Math.round(x * W)))
    const top = Math.min(H - 1, Math.max(0, Math.round(y * H)))
    const cropW = Math.max(1, Math.min(W - left, Math.round(width * W)))
    const cropH = Math.max(1, Math.min(H - top, Math.round(height * H)))
    let pipeline = oriented.extract({ left, top, width: cropW, height: cropH })
    if (rotate) pipeline = pipeline.rotate(rotate)
    const format = asset.mime_type === 'image/png' ? 'png' : asset.mime_type === 'image/webp' ? 'webp' : asset.mime_type === 'image/avif' ? 'avif' : 'jpeg'
    output = await pipeline.toFormat(format, format === 'jpeg' ? { quality: 92, mozjpeg: true } : {}).toBuffer({ resolveWithObject: true })
  } catch (cause) {
    console.error('[studio:media] crop failed:', cause instanceof Error ? cause.message.slice(0, 200) : 'unknown')
    return fail('The image could not be cropped. It may be corrupt or in an unsupported format.')
  }

  const storedPath = await putObject({
    area: 'studio', workspaceId: ctx.workspaceId, fileName: asset.file_name,
    contentType: asset.mime_type ?? 'image/jpeg', body: output.data,
  })
  const saved = await finaliseMediaUpload({
    storedPath, fileName: asset.file_name, width: output.info.width, height: output.info.height, replaceAssetId: asset.id,
  })
  if (!saved.ok) { await deleteObject(storedPath); return fail(saved.error ?? 'The cropped image could not be saved.') }
  return { ok: true, id: asset.id, data: { width: output.info.width, height: output.info.height }, message: `Cropped to ${output.info.width} x ${output.info.height}. The original is kept in Versions.` }
}

/** Stars or un-stars an asset for quick access. */
export async function toggleMediaFavourite(input: { id: string }): Promise<ActionResult<{ favourite: boolean }>> {
  const { session, error } = await authorise('viewMedia')
  if (!session) return fail(error!)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('media_assets').select('id, is_favourite')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That asset is not part of this workspace.')
  const next = !current.is_favourite
  const { error: updateError } = await supabase.from('media_assets').update({ is_favourite: next })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('toggleMediaFavourite', updateError)
  revalidateStudio()
  return { ok: true, data: { favourite: next }, message: next ? 'Added to favourites.' : 'Removed from favourites.' }
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
  if (input.status === 'changes_requested' && !input.note?.trim()) {
    return fail('Explain what needs to change.', { note: 'A reason is required.' })
  }

  const patch: Record<string, unknown> = {
    status: input.status, review_note: input.note?.slice(0, 500) ?? null,
  }
  if (input.status === 'ready') { patch.approved_by = userId; patch.approved_at = new Date().toISOString() }
  if (input.status === 'archived') patch.archived_at = new Date().toISOString()
  if (current.status === 'archived' && input.status !== 'archived') patch.archived_at = null

  const { error: updateError } = await supabase
    .from('media_assets').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('setMediaStatus', updateError)

  const verb = input.status === 'ready' ? 'approved'
    : input.status === 'changes_requested' ? 'requested changes to'
      : input.status === 'archived' ? 'archived'
        : current.status === 'archived' ? 'restored' : 'updated'
  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'asset', entityId: input.id, action: input.status,
    summary: `${verb} ${current.file_name}`,
    link: `${studioBase(ctx)}/media?selected=${input.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.media.${input.status}`, resourceType: 'media_asset', resourceId: input.id,
    metadata: { from: current.status, to: input.status },
  })
  revalidateStudio()
  return { ok: true, message: `${current.file_name} ${verb}.` }
}

export async function bulkMediaAction(
  input: { ids: string[]; action: 'approve' | 'archive' | 'restore' | 'move'; collectionId?: string | null },
): Promise<ActionResult<{ affected: number }>> {
  const capability: keyof StudioCapabilities = input.action === 'approve' ? 'approveMedia' : 'editMedia'
  const { session, error } = await authorise(capability)
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const ids = cleanArray(input.ids, undefined, 200)
  if (ids.length === 0) return fail('Select at least one asset.')
  if (input.action === 'move' && input.collectionId
    && !(await ownsRecord(supabase, 'studio_media_collections', input.collectionId, ctx.workspaceId))) {
    return fail('That collection is not part of this workspace.')
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> =
    input.action === 'approve' ? { status: 'ready', approved_by: userId, approved_at: now }
      : input.action === 'archive' ? { status: 'archived', archived_at: now }
        : input.action === 'restore' ? { status: 'ready', archived_at: null }
          : { collection_id: input.collectionId || null }

  const { data, error: updateError } = await supabase.from('media_assets').update(patch)
    .eq('workspace_id', ctx.workspaceId).in('id', ids).select('id')
  if (updateError) return dbFail('bulkMediaAction', updateError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.media.bulk_${input.action}`, resourceType: 'media_asset',
    metadata: { count: data?.length ?? 0, collection_id: input.collectionId ?? null },
  })
  revalidateStudio()
  return { ok: true, data: { affected: data?.length ?? 0 }, message: `${data?.length ?? 0} assets updated.` }
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

  const { error: deleteError } = await supabase
    .from('media_assets').delete().eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return dbFail('deleteMediaAsset', deleteError)

  // Only Studio-owned objects are removed from storage; shared Brand & Assets
  // files stay under that module's lifecycle.
  if (asset.file_path.startsWith(`${R2_PREFIX}studio/${ctx.workspaceId}/`)) await deleteObject(asset.file_path)

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

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.media.collection_created', resourceType: 'studio_media_collection', resourceId: data.id,
  })
  revalidateStudio()
  return { ok: true, id: data.id, message: 'Collection created.' }
}

export async function updateMediaCollection(
  input: { id: string; name?: string; archive?: boolean; remove?: boolean },
): Promise<ActionResult> {
  const { session, error } = await authorise('editMedia')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  if (!(await ownsRecord(supabase, 'studio_media_collections', input.id, ctx.workspaceId))) {
    return fail('That collection is not part of this workspace.')
  }

  if (input.remove) {
    if (!session.capabilities.deleteMedia) return fail('Your role does not allow deleting collections.')
    const { count } = await supabase.from('media_assets').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).eq('collection_id', input.id)
    if ((count ?? 0) > 0) return fail('Only empty collections can be deleted. Move or archive its assets first.')
    const { error: deleteError } = await supabase.from('studio_media_collections').delete()
      .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (deleteError) return dbFail('deleteMediaCollection', deleteError)
  } else {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) return fail('Name the collection.', { name: 'A name is required.' })
      patch.name = name.slice(0, 120)
    }
    if (input.archive !== undefined) patch.archived_at = input.archive ? new Date().toISOString() : null
    const { error: updateError } = await supabase.from('studio_media_collections').update(patch)
      .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('updateMediaCollection', updateError)
  }

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.media.collection_${input.remove ? 'deleted' : input.archive ? 'archived' : 'updated'}`,
    resourceType: 'studio_media_collection', resourceId: input.id,
  })
  revalidateStudio()
  return { ok: true, message: input.remove ? 'Collection deleted.' : 'Collection updated.' }
}
