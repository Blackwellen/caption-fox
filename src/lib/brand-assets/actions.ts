'use server'

// Server actions for the Brand & Assets module.
//
// Every action re-resolves the caller's workspace, role and entitlements on the
// server (never trusting a client-supplied workspace or brand id), checks the
// capability through the central resolver, validates input, writes, records
// activity and revalidates the module. A hidden button is not a permission.

import { revalidatePath } from 'next/cache'
import { resolveBrandContext, type BrandContext } from './context'
import { canAccessBrandCapability, type BrandCapability } from './entitlements'
import {
  createUploadUrl, deleteObject, inspectObject, isR2Configured, R2_PREFIX, signReadUrls,
} from '@/lib/storage/r2'

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; field?: string }

const fail = (error: string, field?: string): ActionResult<never> => ({ ok: false, error, field })

async function gate(workspaceType: string, capability: BrandCapability): Promise<{ ctx: BrandContext } | { error: ActionResult<never> }> {
  const res = await resolveBrandContext(workspaceType)
  if (!res.ok) return { error: fail(res.message) }
  const decision = canAccessBrandCapability(res.context.entitlements, capability)
  if (!decision.allowed) return { error: fail(decision.message ?? 'Not permitted.') }
  return { ctx: res.context }
}

function done(ctx: BrandContext) {
  revalidatePath(`${ctx.basePath}/brand`, 'layout')
}

async function activity(
  ctx: BrandContext,
  entry: { entity_type: string; entity_id: string | null; action: string; summary: string; href?: string | null; brand_id?: string | null; metadata?: Record<string, unknown> },
) {
  await ctx.supabase.from('brand_activity').insert({
    workspace_id: ctx.workspace.id, actor_id: ctx.userId, brand_id: entry.brand_id ?? null,
    entity_type: entry.entity_type, entity_id: entry.entity_id, action: entry.action,
    summary: entry.summary.slice(0, 240), href: entry.href ?? null, metadata: entry.metadata ?? {},
  })
}

/** A brand id is only accepted if it belongs to the caller's workspace. */
function ownBrand(ctx: BrandContext, brandId: unknown): string | null {
  return typeof brandId === 'string' && ctx.brands.some(b => b.id === brandId) ? brandId : null
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

const HEX = /^#[0-9a-f]{6}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/

// ===========================================================================
// BRAND KITS
// ===========================================================================

export async function createBrandKit(workspaceType: string, input: {
  brandId: string; name: string; description?: string; teamName?: string
  colours: { name: string; hex: string; role: string }[]
  headingFont: string; bodyFont: string
  toneStatement?: string; toneTraits?: string[]
  submit: boolean
}): Promise<ActionResult<{ id: string }>> {
  const g = await gate(workspaceType, 'brand.kits.create'); if ('error' in g) return g.error
  const { ctx } = g
  const brandId = ownBrand(ctx, input.brandId)
  if (!brandId) return fail('Choose a brand in this workspace.', 'brandId')
  const name = text(input.name, 120)
  if (name.length < 2) return fail('Give the kit a name of at least 2 characters.', 'name')
  const colours = (input.colours ?? []).filter(c => HEX.test(c.hex)).slice(0, 12)
  if (colours.length === 0) return fail('Add at least one colour as a 6-digit hex value.', 'colours')
  const heading = text(input.headingFont, 60), body = text(input.bodyFont, 60)
  if (!heading || !body) return fail('Choose heading and body fonts.', 'fonts')

  const { data: kit, error } = await ctx.supabase.from('brand_kits').insert({
    workspace_id: ctx.workspace.id, brand_id: brandId, name,
    description: text(input.description, 600) || null, team_name: text(input.teamName, 60) || null,
    status: input.submit ? 'review' : 'draft', approval_status: input.submit ? 'pending' : 'none',
    owner_id: ctx.userId, created_by: ctx.userId, updated_by: ctx.userId, current_version: 1,
  }).select('id').single()
  if (error || !kit) return fail('The brand kit could not be saved. Please try again.')

  const ROLES = ['primary', 'secondary', 'accent', 'neutral', 'surface', 'success', 'warning', 'danger']
  await Promise.all([
    ctx.supabase.from('brand_kit_colours').insert(colours.map((c, i) => ({
      workspace_id: ctx.workspace.id, brand_kit_id: kit.id, name: text(c.name, 40) || `Colour ${i + 1}`,
      hex: c.hex.toUpperCase(), role: ROLES.includes(c.role) ? c.role : 'neutral', sort_order: i,
    }))),
    ctx.supabase.from('brand_kit_typography').insert([
      { style_name: 'Heading 1', font_family: heading, font_weight: 'Bold', font_size_px: 44, line_height_px: 52, sort_order: 0 },
      { style_name: 'Heading 2', font_family: heading, font_weight: 'Semi Bold', font_size_px: 32, line_height_px: 40, sort_order: 1 },
      { style_name: 'Body', font_family: body, font_weight: 'Regular', font_size_px: 16, line_height_px: 24, sort_order: 2 },
      { style_name: 'Caption', font_family: body, font_weight: 'Regular', font_size_px: 12, line_height_px: 16, sort_order: 3 },
    ].map(t => ({ ...t, workspace_id: ctx.workspace.id, brand_kit_id: kit.id }))),
    input.toneStatement ? ctx.supabase.from('brand_kit_tone').insert({
      workspace_id: ctx.workspace.id, brand_kit_id: kit.id, statement: text(input.toneStatement, 400),
      traits: (input.toneTraits ?? []).map(t => text(t, 30)).filter(Boolean).slice(0, 8),
    }) : Promise.resolve(),
    ctx.supabase.from('brand_kit_versions').insert({
      workspace_id: ctx.workspace.id, brand_kit_id: kit.id, version: 1,
      change_summary: 'Initial brand system.', status: 'draft', created_by: ctx.userId,
      snapshot: { colours, heading, body },
    }),
  ])

  await activity(ctx, { entity_type: 'brand_kit', entity_id: kit.id, brand_id: brandId, action: 'created',
    summary: `Created ${name}${input.submit ? ' and submitted it for approval' : ''}`, href: `${ctx.basePath}/brand/kits/${kit.id}` })
  done(ctx)
  return { ok: true, data: { id: kit.id }, message: input.submit ? 'Brand kit submitted for approval.' : 'Brand kit saved as draft.' }
}

export async function decideKitApproval(workspaceType: string, kitId: string, decision: 'submit' | 'approve' | 'request_changes', note?: string): Promise<ActionResult> {
  const cap: BrandCapability = decision === 'submit' ? 'brand.kits.edit' : 'brand.kits.approve'
  const g = await gate(workspaceType, cap); if ('error' in g) return g.error
  const { ctx } = g
  const { data: kit } = await ctx.supabase.from('brand_kits').select('id, name, brand_id, approval_status, current_version')
    .eq('id', kitId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!kit) return fail('Brand kit not found.')

  // Valid transitions only — the database state, not the button, decides.
  const from = kit.approval_status as string
  if (decision === 'submit' && !['none', 'changes_requested', 'rejected'].includes(from)) return fail('This kit is already in review or approved.')
  if (decision !== 'submit' && from !== 'pending') return fail('Only kits awaiting approval can be decided.')

  const patch = decision === 'submit' ? { approval_status: 'pending', status: 'review' }
    : decision === 'approve' ? { approval_status: 'approved', status: 'active', published_version: kit.current_version }
      : { approval_status: 'changes_requested', status: 'draft' }
  const { error } = await ctx.supabase.from('brand_kits').update({ ...patch, updated_by: ctx.userId, updated_at: new Date().toISOString() })
    .eq('id', kitId).eq('workspace_id', ctx.workspace.id)
  if (error) return fail('The approval could not be recorded.')
  if (decision === 'approve') {
    await ctx.supabase.from('brand_kit_versions').update({ status: 'published', published_at: new Date().toISOString() })
      .eq('brand_kit_id', kitId).eq('version', kit.current_version)
  }
  if (note) {
    await ctx.supabase.from('brand_kit_comments').insert({ workspace_id: ctx.workspace.id, brand_kit_id: kitId, author_id: ctx.userId, body: text(note, 1000) })
  }
  const verb = decision === 'submit' ? 'Submitted' : decision === 'approve' ? 'Approved' : 'Requested changes on'
  await activity(ctx, { entity_type: 'brand_kit', entity_id: kitId, brand_id: kit.brand_id, action: decision, summary: `${verb} ${kit.name}`, href: `${ctx.basePath}/brand/kits/${kitId}` })
  done(ctx)
  return { ok: true, data: null, message: `${verb} ${kit.name}.` }
}

export async function addKitComment(workspaceType: string, kitId: string, body: string): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.kits.view'); if ('error' in g) return g.error
  const { ctx } = g
  const clean = text(body, 1000)
  if (!clean) return fail('Write a comment first.', 'body')
  const { data: kit } = await ctx.supabase.from('brand_kits').select('id, name').eq('id', kitId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!kit) return fail('Brand kit not found.')
  const { error } = await ctx.supabase.from('brand_kit_comments').insert({ workspace_id: ctx.workspace.id, brand_kit_id: kitId, author_id: ctx.userId, body: clean })
  if (error) return fail('Your comment could not be posted.')
  done(ctx)
  return { ok: true, data: null, message: 'Comment posted.' }
}

export async function setKitArchived(workspaceType: string, kitId: string, archived: boolean): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.kits.edit'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: kit } = await ctx.supabase.from('brand_kits').update({ archived_at: archived ? new Date().toISOString() : null, status: archived ? 'archived' : 'draft' })
    .eq('id', kitId).eq('workspace_id', ctx.workspace.id).select('id, name, brand_id').maybeSingle()
  if (!kit) return fail('Brand kit not found.')
  await activity(ctx, { entity_type: 'brand_kit', entity_id: kitId, brand_id: kit.brand_id, action: archived ? 'archived' : 'restored', summary: `${archived ? 'Archived' : 'Restored'} ${kit.name}` })
  done(ctx)
  return { ok: true, data: null, message: archived ? 'Brand kit archived.' : 'Brand kit restored.' }
}

// ===========================================================================
// ASSETS — upload pipeline
//   1. requestAssetUpload: validate type/size/quota/duplicate, issue signed PUT
//   2. browser PUTs the bytes straight to R2
//   3. finaliseAssetUpload: re-read the object's real size/type from R2, then
//      create the record. The client's claims about the file are never trusted.
// ===========================================================================

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024
const KIND_BY_MIME: [RegExp, string][] = [
  [/^image\/(jpeg|png|webp|gif|avif)$/, 'image'], [/^image\/svg\+xml$/, 'design'],
  [/^video\/(mp4|quicktime|webm)$/, 'video'], [/^audio\/(mpeg|wav|mp4|aac)$/, 'audio'],
  [/^application\/pdf$/, 'pdf'],
  [/presentationml|ms-powerpoint|keynote/, 'presentation'],
  [/wordprocessingml|msword|text\/plain/, 'document'],
  [/photoshop|illustrator|postscript|figma/, 'design'],
  [/^application\/(zip|x-zip-compressed)$/, 'archive'],
]
const EXT_BY_KIND: Record<string, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'], video: ['mp4', 'mov', 'webm'], audio: ['mp3', 'wav', 'm4a', 'aac'],
  pdf: ['pdf'], presentation: ['pptx', 'ppt', 'key'], document: ['docx', 'doc', 'txt'],
  design: ['psd', 'ai', 'eps', 'svg', 'fig'], archive: ['zip'],
}

function kindFor(mime: string, fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const byMime = KIND_BY_MIME.find(([re]) => re.test(mime))?.[1]
  const kind = byMime ?? Object.entries(EXT_BY_KIND).find(([, exts]) => exts.includes(ext))?.[0] ?? null
  // Extension and MIME must agree — a renamed executable is rejected here.
  if (!kind || !EXT_BY_KIND[kind]?.includes(ext)) return null
  return kind
}

export async function requestAssetUpload(workspaceType: string, input: {
  fileName: string; contentType: string; size: number; checksum?: string
}): Promise<ActionResult<{ url: string; storedPath: string; kind: string; duplicateOf: { id: string; file_name: string } | null }>> {
  const g = await gate(workspaceType, 'brand.assets.upload'); if ('error' in g) return g.error
  const { ctx } = g
  if (!isR2Configured()) return fail('File storage is not configured for this environment. Ask an administrator to connect Cloudflare R2.')
  const fileName = text(input.fileName, 200)
  const kind = kindFor(String(input.contentType ?? ''), fileName)
  if (!kind) return fail(`${fileName || 'This file'} is not a supported type. Upload images, video, audio, PDF, Office, design files or ZIP archives.`)
  const size = Number(input.size)
  if (!Number.isFinite(size) || size <= 0) return fail('The file appears to be empty.')
  if (size > MAX_UPLOAD_BYTES) return fail(`${fileName} is larger than the 250 MB limit.`)
  const { bytes_used, bytes_quota } = ctx.storage
  if (bytes_quota > 0 && bytes_used + size > bytes_quota) return fail('Uploading this file would exceed your storage quota. Free space or upgrade your plan.')

  let duplicateOf: { id: string; file_name: string } | null = null
  if (input.checksum && /^[a-f0-9]{64}$/.test(input.checksum)) {
    const { data } = await ctx.supabase.from('media_assets').select('id, file_name')
      .eq('workspace_id', ctx.workspace.id).eq('checksum', input.checksum).is('archived_at', null).limit(1).maybeSingle()
    duplicateOf = data ?? null
  }

  const { url, storedPath } = await createUploadUrl({
    area: 'brand-assets', workspaceId: ctx.workspace.id, fileName, contentType: String(input.contentType),
  })
  return { ok: true, data: { url, storedPath, kind, duplicateOf } }
}

export async function finaliseAssetUpload(workspaceType: string, input: {
  storedPath: string; fileName: string; checksum?: string
  brandId?: string | null; folderId?: string | null; tags?: string[]; usageScope?: string
  rightsState?: string; submitForApproval?: boolean; replaceAssetId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const g = await gate(workspaceType, 'brand.assets.upload'); if ('error' in g) return g.error
  const { ctx } = g
  // The path must be one this workspace was issued.
  if (!input.storedPath.startsWith(`${R2_PREFIX}brand-assets/${ctx.workspace.id}/`) || input.storedPath.includes('..')) {
    return fail('That upload does not belong to this workspace.')
  }
  const head = await inspectObject(input.storedPath)
  if (!head || head.size <= 0) return fail('The upload did not complete. Please try again.')
  const fileName = text(input.fileName, 200)
  const kind = kindFor(head.contentType ?? '', fileName)
  if (!kind) { await deleteObject(input.storedPath); return fail('The uploaded file type is not allowed.') }
  if (head.size > MAX_UPLOAD_BYTES) { await deleteObject(input.storedPath); return fail('The uploaded file exceeds 250 MB.') }

  let folderId: string | null = null
  if (input.folderId) {
    const { data } = await ctx.supabase.from('asset_folders').select('id').eq('id', input.folderId).eq('workspace_id', ctx.workspace.id).maybeSingle()
    folderId = data?.id ?? null
  }
  const RIGHTS = ['unspecified', 'licensed', 'all_media', 'internal_use', 'public_use', 'restricted']
  const rightsState = RIGHTS.includes(String(input.rightsState)) ? String(input.rightsState) : 'unspecified'
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const isVisual = kind === 'image'
  const checksum = input.checksum && /^[a-f0-9]{64}$/.test(input.checksum) ? input.checksum : null

  // Replacing an existing asset keeps the record and its links; history goes to asset_versions.
  if (input.replaceAssetId) {
    const { data: prev } = await ctx.supabase.from('media_assets').select('id, file_name, file_path, file_size, mime_type, checksum, version_no, brand_id')
      .eq('id', input.replaceAssetId).eq('workspace_id', ctx.workspace.id).maybeSingle()
    if (!prev) return fail('The asset you are replacing was not found.')
    await ctx.supabase.from('asset_versions').insert({
      workspace_id: ctx.workspace.id, asset_id: prev.id, version_no: prev.version_no, file_path: prev.file_path,
      file_size: prev.file_size, mime_type: prev.mime_type, checksum: prev.checksum, change_summary: `Replaced by ${fileName}`, created_by: ctx.userId,
    })
    const { error } = await ctx.supabase.from('media_assets').update({
      file_name: fileName, file_path: input.storedPath, file_type: ext, file_size: head.size, mime_type: head.contentType,
      asset_kind: kind, checksum, version_no: prev.version_no + 1, thumbnail_path: isVisual ? input.storedPath : null,
      approval_status: 'pending', updated_at: new Date().toISOString(),
    }).eq('id', prev.id).eq('workspace_id', ctx.workspace.id)
    if (error) return fail('The new version could not be saved.')
    await ctx.supabase.from('asset_approvals').insert({ workspace_id: ctx.workspace.id, asset_id: prev.id, status: 'pending', priority: 'medium', requested_by: ctx.userId, note: 'New version uploaded' })
    await activity(ctx, { entity_type: 'asset', entity_id: prev.id, brand_id: prev.brand_id, action: 'versioned', summary: `Uploaded v${prev.version_no + 1} of ${prev.file_name}`, href: `${ctx.basePath}/brand/assets/${prev.id}` })
    await recalcStorage(ctx)
    done(ctx)
    return { ok: true, data: { id: prev.id }, message: `Version ${prev.version_no + 1} uploaded and sent for approval.` }
  }

  const { data: asset, error } = await ctx.supabase.from('media_assets').insert({
    workspace_id: ctx.workspace.id, brand_id: ownBrand(ctx, input.brandId), folder_id: folderId,
    owner_id: ctx.userId, uploaded_by: ctx.userId, file_name: fileName, file_path: input.storedPath,
    file_url: `r2://${fileName}`, file_type: ext, file_size: head.size, mime_type: head.contentType,
    asset_kind: kind, approval_status: input.submitForApproval ? 'pending' : 'draft', rights_state: rightsState,
    usage_scope: text(input.usageScope, 60) || null, storage_bucket: 'r2', checksum,
    // Images are their own preview; other kinds show a typed file tile until a
    // preview is generated, rather than a fake thumbnail.
    thumbnail_path: isVisual ? input.storedPath : null,
    processing_state: 'ready', scan_state: 'pending',
    tags: (input.tags ?? []).map(t => text(t, 30).toLowerCase()).filter(Boolean).slice(0, 20),
  }).select('id').single()
  if (error || !asset) { await deleteObject(input.storedPath); return fail('The asset could not be saved. The upload was discarded.') }

  if (input.submitForApproval) {
    await ctx.supabase.from('asset_approvals').insert({ workspace_id: ctx.workspace.id, asset_id: asset.id, status: 'pending', priority: 'medium', requested_by: ctx.userId })
  }
  await activity(ctx, { entity_type: 'asset', entity_id: asset.id, brand_id: ownBrand(ctx, input.brandId), action: 'uploaded', summary: `Uploaded ${fileName}`, href: `${ctx.basePath}/brand/assets/${asset.id}` })
  await recalcStorage(ctx)
  done(ctx)
  return { ok: true, data: { id: asset.id }, message: `${fileName} uploaded.` }
}

async function recalcStorage(ctx: BrandContext) {
  const { data } = await ctx.supabase.from('media_assets').select('file_size').eq('workspace_id', ctx.workspace.id).is('archived_at', null)
  const rows = (data ?? []) as { file_size: number | null }[]
  await ctx.supabase.from('workspace_storage').upsert({
    workspace_id: ctx.workspace.id, bytes_used: rows.reduce((n, r) => n + (r.file_size ?? 0), 0),
    asset_count: rows.length, recalculated_at: new Date().toISOString(),
  })
}

export async function createFolder(workspaceType: string, name: string): Promise<ActionResult<{ id: string }>> {
  const g = await gate(workspaceType, 'brand.assets.edit'); if ('error' in g) return g.error
  const { ctx } = g
  const clean = text(name, 80)
  if (clean.length < 2) return fail('Folder names need at least 2 characters.', 'name')
  const path = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const { data, error } = await ctx.supabase.from('asset_folders').insert({ workspace_id: ctx.workspace.id, name: clean, path, created_by: ctx.userId }).select('id').single()
  if (error?.code === '23505') return fail('A folder with that name already exists.', 'name')
  if (error || !data) return fail('The folder could not be created.')
  await activity(ctx, { entity_type: 'folder', entity_id: data.id, action: 'created', summary: `Created folder ${clean}` })
  done(ctx)
  return { ok: true, data: { id: data.id }, message: `Folder "${clean}" created.` }
}

export async function toggleFavourite(workspaceType: string, assetId: string): Promise<ActionResult<{ favourite: boolean }>> {
  const g = await gate(workspaceType, 'brand.assets.view'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: a } = await ctx.supabase.from('media_assets').select('is_favourite').eq('id', assetId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!a) return fail('Asset not found.')
  const { error } = await ctx.supabase.from('media_assets').update({ is_favourite: !a.is_favourite }).eq('id', assetId).eq('workspace_id', ctx.workspace.id)
  if (error) return fail('Could not update favourite.')
  done(ctx)
  return { ok: true, data: { favourite: !a.is_favourite } }
}

export async function submitAssetsForApproval(workspaceType: string, assetIds: string[], priority: 'low' | 'medium' | 'high', note?: string): Promise<ActionResult<{ count: number }>> {
  const g = await gate(workspaceType, 'brand.usage_requests.create'); if ('error' in g) return g.error
  const { ctx } = g
  const ids = [...new Set(assetIds)].slice(0, 100)
  const { data: rows } = await ctx.supabase.from('media_assets').select('id, file_name, approval_status')
    .eq('workspace_id', ctx.workspace.id).in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  const eligible = (rows ?? []).filter(r => ['draft', 'changes_requested', 'rejected'].includes(r.approval_status))
  if (eligible.length === 0) return fail('Select draft or returned assets to submit — approved or pending assets are skipped.')
  const P = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium'
  await ctx.supabase.from('media_assets').update({ approval_status: 'pending' }).in('id', eligible.map(e => e.id)).eq('workspace_id', ctx.workspace.id)
  await ctx.supabase.from('asset_approvals').insert(eligible.map(e => ({ workspace_id: ctx.workspace.id, asset_id: e.id, status: 'pending', priority: P, requested_by: ctx.userId, note: text(note, 500) || null })))
  await activity(ctx, { entity_type: 'approval', entity_id: null, action: 'requested', summary: `Requested approval for ${eligible.length} asset${eligible.length === 1 ? '' : 's'}` })
  done(ctx)
  return { ok: true, data: { count: eligible.length }, message: `${eligible.length} asset${eligible.length === 1 ? '' : 's'} sent for approval.` }
}

export async function decideAssetApproval(workspaceType: string, approvalId: string, decision: 'approved' | 'changes_requested' | 'rejected', note?: string): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.assets.approve'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: ap } = await ctx.supabase.from('asset_approvals').select('id, status, asset_id, asset:media_assets(file_name, rights_state, brand_id)')
    .eq('id', approvalId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!ap) return fail('Approval request not found.')
  if (ap.status !== 'pending') return fail('This request has already been decided.')
  const asset = (Array.isArray(ap.asset) ? ap.asset[0] : ap.asset) as { file_name: string; rights_state: string; brand_id: string | null } | null
  // Rights gate: an asset with expired or restricted rights cannot be approved for use.
  if (decision === 'approved' && asset && ['expired', 'restricted'].includes(asset.rights_state)) {
    return fail(`${asset.file_name} has ${asset.rights_state} rights and cannot be approved until the licence is resolved.`)
  }
  const now = new Date().toISOString()
  await ctx.supabase.from('asset_approvals').update({ status: decision, reviewer_id: ctx.userId, note: text(note, 500) || null, decided_at: now, updated_at: now }).eq('id', approvalId)
  await ctx.supabase.from('media_assets').update({ approval_status: decision }).eq('id', ap.asset_id).eq('workspace_id', ctx.workspace.id)
  const verb = decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Requested changes on'
  await activity(ctx, { entity_type: 'asset', entity_id: ap.asset_id, brand_id: asset?.brand_id ?? null, action: decision, summary: `${verb} ${asset?.file_name ?? 'asset'}`, href: `${ctx.basePath}/brand/assets/${ap.asset_id}` })
  done(ctx)
  return { ok: true, data: null, message: `${verb} ${asset?.file_name ?? 'asset'}.` }
}

export async function requestAssetUsage(workspaceType: string, input: {
  assetId: string; purpose: string; channels: string[]; territories: string[]; startsOn: string; endsOn: string; modification: boolean
}): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.usage_requests.create'); if ('error' in g) return g.error
  const { ctx } = g
  const purpose = text(input.purpose, 500)
  if (purpose.length < 5) return fail('Describe how the asset will be used.', 'purpose')
  if (!ISO_DATE.test(input.startsOn) || !ISO_DATE.test(input.endsOn) || input.endsOn < input.startsOn) return fail('Choose a valid date range.', 'dates')
  const { data: asset } = await ctx.supabase.from('media_assets').select('id, file_name, brand_id').eq('id', input.assetId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!asset) return fail('Asset not found.')
  const { error } = await ctx.supabase.from('asset_usage_requests').insert({
    workspace_id: ctx.workspace.id, asset_id: asset.id, requested_by: ctx.userId, status: 'submitted', purpose,
    channels: input.channels.map(c => text(c, 30)).slice(0, 12), territories: input.territories.map(t => text(t, 30)).slice(0, 12),
    starts_on: input.startsOn, ends_on: input.endsOn, modification_requested: !!input.modification,
  })
  if (error) return fail('The usage request could not be submitted.')
  await activity(ctx, { entity_type: 'usage_request', entity_id: asset.id, brand_id: asset.brand_id, action: 'requested', summary: `Requested usage of ${asset.file_name}` })
  done(ctx)
  return { ok: true, data: null, message: 'Usage request submitted.' }
}

export async function setAssetArchived(workspaceType: string, assetId: string, archived: boolean): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.assets.archive'); if ('error' in g) return g.error
  const { ctx } = g
  const { data } = await ctx.supabase.from('media_assets').update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', assetId).eq('workspace_id', ctx.workspace.id).select('id, file_name, brand_id').maybeSingle()
  if (!data) return fail('Asset not found.')
  await activity(ctx, { entity_type: 'asset', entity_id: assetId, brand_id: data.brand_id, action: archived ? 'archived' : 'restored', summary: `${archived ? 'Archived' : 'Restored'} ${data.file_name}` })
  await recalcStorage(ctx)
  done(ctx)
  return { ok: true, data: null, message: archived ? 'Asset archived.' : 'Asset restored.' }
}

/** Signed, audited download. Rights restrictions block the download itself. */
export async function downloadAsset(workspaceType: string, assetId: string): Promise<ActionResult<{ url: string }>> {
  const g = await gate(workspaceType, 'brand.assets.download'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: a } = await ctx.supabase.from('media_assets').select('id, file_name, file_path, rights_state, version_no, download_count')
    .eq('id', assetId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!a) return fail('Asset not found.')
  if (a.rights_state === 'expired') return fail('This asset\'s licence has expired, so it cannot be downloaded for use.')
  if (!a.file_path?.startsWith(`${R2_PREFIX}brand-assets/${ctx.workspace.id}/`)) return fail('The original file is not available for this asset.')
  if (!isR2Configured()) return fail('File storage is not connected for this environment, so the original cannot be downloaded yet.')
  const head = await inspectObject(a.file_path).catch(() => null)
  if (!head) return fail('The original file is not available for this asset. Upload a new version to restore it.')
  const signed = await signReadUrls([a.file_path], 120)
  const url = signed.get(a.file_path)
  if (!url) return fail('The download link could not be created.')
  await ctx.supabase.from('asset_downloads').insert({ workspace_id: ctx.workspace.id, asset_id: a.id, user_id: ctx.userId, version_no: a.version_no })
  await ctx.supabase.from('media_assets').update({ download_count: (a.download_count ?? 0) + 1 }).eq('id', a.id).eq('workspace_id', ctx.workspace.id)
  await activity(ctx, { entity_type: 'asset', entity_id: a.id, action: 'downloaded', summary: `Downloaded ${a.file_name}` })
  return { ok: true, data: { url } }
}

// ===========================================================================
// RIGHTS
// ===========================================================================

const LICENSE_TYPES = ['exclusive', 'standard', 'non_exclusive', 'campaign', 'royalty_free', 'design', 'trademark', 'video', 'image', 'music', 'other']

export async function createLicense(workspaceType: string, input: {
  name: string; reference?: string; licenseType: string; licensor?: string; licensee?: string
  assetId?: string | null; productId?: string | null; brandId?: string | null
  startsOn: string; expiresOn?: string | null; territoryIds: string[]; channelIds: string[]
  usageScope?: string; exclusivity: boolean; modificationAllowed: boolean; notes?: string; submit: boolean
}): Promise<ActionResult<{ id: string; conflicts: string[] }>> {
  const g = await gate(workspaceType, 'brand.rights.create'); if ('error' in g) return g.error
  const { ctx } = g
  const name = text(input.name, 160)
  if (name.length < 2) return fail('Name the licence.', 'name')
  if (!LICENSE_TYPES.includes(input.licenseType)) return fail('Choose a licence type.', 'licenseType')
  if (!ISO_DATE.test(input.startsOn)) return fail('Choose a start date.', 'startsOn')
  if (input.expiresOn && (!ISO_DATE.test(input.expiresOn) || input.expiresOn < input.startsOn)) return fail('Expiry must be on or after the start date.', 'expiresOn')
  if (!input.territoryIds?.length) return fail('Add at least one territory.', 'territories')
  if (!input.channelIds?.length) return fail('Add at least one channel.', 'channels')

  // Linked records must be in this workspace.
  let assetId: string | null = null, productId: string | null = null
  if (input.assetId) {
    const { data } = await ctx.supabase.from('media_assets').select('id').eq('id', input.assetId).eq('workspace_id', ctx.workspace.id).maybeSingle()
    if (!data) return fail('The selected asset is not in this workspace.', 'assetId'); assetId = data.id
  }
  if (input.productId) {
    const { data } = await ctx.supabase.from('products').select('id').eq('id', input.productId).eq('workspace_id', ctx.workspace.id).maybeSingle()
    if (!data) return fail('The selected product is not in this workspace.', 'productId'); productId = data.id
  }
  const [{ data: terr }, { data: chan }] = await Promise.all([
    ctx.supabase.from('rights_territories').select('id, name').in('id', input.territoryIds).or(`workspace_id.is.null,workspace_id.eq.${ctx.workspace.id}`),
    ctx.supabase.from('rights_channels').select('id, name').in('id', input.channelIds).or(`workspace_id.is.null,workspace_id.eq.${ctx.workspace.id}`),
  ])
  if (!terr?.length || !chan?.length) return fail('Choose valid territories and channels.')

  // Conflict checks — exclusivity clash and duplicate reference.
  const conflicts: string[] = []
  if (input.reference) {
    const { data: dup } = await ctx.supabase.from('rights_licenses').select('id').eq('workspace_id', ctx.workspace.id).eq('reference', text(input.reference, 60)).maybeSingle()
    if (dup) return fail('A licence with that reference already exists.', 'reference')
  }
  if (assetId) {
    const { data: excl } = await ctx.supabase.from('rights_licenses').select('id, name').eq('workspace_id', ctx.workspace.id)
      .eq('asset_id', assetId).eq('exclusivity', true).in('status', ['active', 'expiring_soon'])
    if (excl?.length && input.exclusivity) conflicts.push(`Exclusive licence already active: ${excl[0].name}`)
  }

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const status = !input.submit ? 'draft'
    : input.startsOn > today ? 'pending'
      : input.expiresOn && input.expiresOn < today ? 'expired'
        : input.expiresOn && input.expiresOn <= in30 ? 'expiring_soon' : 'active'

  const { data: lic, error } = await ctx.supabase.from('rights_licenses').insert({
    workspace_id: ctx.workspace.id, brand_id: ownBrand(ctx, input.brandId), asset_id: assetId, product_id: productId,
    name, reference: text(input.reference, 60) || null, license_type: input.licenseType,
    licensor: text(input.licensor, 120) || null, licensee: text(input.licensee, 120) || null,
    status, starts_on: input.startsOn, expires_on: input.expiresOn || null,
    renewal_due_on: input.expiresOn ? new Date(new Date(input.expiresOn).getTime() - 30 * 86_400_000).toISOString().slice(0, 10) : null,
    usage_scope: text(input.usageScope, 120) || null, exclusivity: !!input.exclusivity, modification_allowed: !!input.modificationAllowed,
    risk_level: conflicts.length ? 'high' : 'low', owner_id: ctx.userId, notes: text(input.notes, 2000) || null,
    created_by: ctx.userId, updated_by: ctx.userId,
  }).select('id').single()
  if (error || !lic) return fail('The licence could not be saved.')

  await Promise.all([
    ctx.supabase.from('rights_license_territories').insert(terr.map(t => ({ workspace_id: ctx.workspace.id, license_id: lic.id, territory_id: t.id }))),
    ctx.supabase.from('rights_license_channels').insert(chan.map(c => ({ workspace_id: ctx.workspace.id, license_id: lic.id, channel_id: c.id }))),
    conflicts.length ? ctx.supabase.from('rights_conflicts').insert({ workspace_id: ctx.workspace.id, license_id: lic.id, asset_id: assetId, conflict_type: 'exclusivity_clash', severity: 'high', detail: conflicts[0] }) : Promise.resolve(),
    assetId && status === 'active' ? ctx.supabase.from('media_assets').update({ rights_state: 'licensed' }).eq('id', assetId).eq('rights_state', 'unspecified') : Promise.resolve(),
  ])
  await activity(ctx, { entity_type: 'license', entity_id: lic.id, action: 'created', summary: `Added licence ${name}`, href: `${ctx.basePath}/brand/rights/${lic.id}` })
  done(ctx)
  return { ok: true, data: { id: lic.id, conflicts }, message: conflicts.length ? `Licence saved with ${conflicts.length} conflict flagged.` : 'Licence saved.' }
}

export async function renewLicense(workspaceType: string, licenseId: string, newExpiry: string, terms?: string): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.rights.renew'); if ('error' in g) return g.error
  const { ctx } = g
  if (!ISO_DATE.test(newExpiry)) return fail('Choose the new expiry date.', 'expiresOn')
  const { data: lic } = await ctx.supabase.from('rights_licenses').select('id, name, expires_on, status').eq('id', licenseId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!lic) return fail('Licence not found.')
  if (lic.status === 'cancelled') return fail('Cancelled licences cannot be renewed.')
  if (lic.expires_on && newExpiry <= lic.expires_on) return fail('The new expiry must be later than the current one.', 'expiresOn')
  const now = new Date().toISOString()
  await ctx.supabase.from('rights_licenses').update({ expires_on: newExpiry, status: 'active', risk_level: 'low', updated_by: ctx.userId, updated_at: now,
    renewal_due_on: new Date(new Date(newExpiry).getTime() - 30 * 86_400_000).toISOString().slice(0, 10) }).eq('id', licenseId)
  await ctx.supabase.from('rights_renewals').update({ status: 'completed', completed_at: now, new_terms: text(terms, 1000) || null })
    .eq('license_id', licenseId).in('status', ['pending', 'in_progress'])
  await ctx.supabase.from('rights_conflicts').update({ resolved_at: now, resolved_by: ctx.userId }).eq('license_id', licenseId).eq('conflict_type', 'expired_licence').is('resolved_at', null)
  await activity(ctx, { entity_type: 'license', entity_id: licenseId, action: 'renewed', summary: `Renewed ${lic.name} to ${newExpiry}`, href: `${ctx.basePath}/brand/rights/${licenseId}` })
  done(ctx)
  return { ok: true, data: null, message: `${lic.name} renewed.` }
}

export async function setLicenseStatus(workspaceType: string, licenseId: string, status: 'restricted' | 'suspended' | 'active' | 'cancelled', reason?: string): Promise<ActionResult> {
  const g = await gate(workspaceType, status === 'active' ? 'brand.rights.edit' : 'brand.rights.restrict'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: lic } = await ctx.supabase.from('rights_licenses').update({ status, updated_by: ctx.userId, updated_at: new Date().toISOString(), risk_level: status === 'active' ? 'low' : 'high' })
    .eq('id', licenseId).eq('workspace_id', ctx.workspace.id).select('id, name, asset_id').maybeSingle()
  if (!lic) return fail('Licence not found.')
  if (lic.asset_id && status !== 'active') await ctx.supabase.from('media_assets').update({ rights_state: 'restricted' }).eq('id', lic.asset_id)
  await activity(ctx, { entity_type: 'license', entity_id: licenseId, action: status, summary: `${status === 'active' ? 'Reactivated' : status.charAt(0).toUpperCase() + status.slice(1)} ${lic.name}${reason ? ` — ${text(reason, 120)}` : ''}` })
  done(ctx)
  return { ok: true, data: null, message: `${lic.name} is now ${status}.` }
}

// ===========================================================================
// PRODUCTS
// ===========================================================================

export async function createProduct(workspaceType: string, input: {
  name: string; sku: string; brandId?: string | null; categoryId?: string | null; description?: string
  productLine?: string; markets: string[]; submit: boolean
}): Promise<ActionResult<{ id: string }>> {
  const g = await gate(workspaceType, 'brand.products.create'); if ('error' in g) return g.error
  const { ctx } = g
  const name = text(input.name, 160)
  if (name.length < 2) return fail('Name the product.', 'name')
  const sku = text(input.sku, 40).toUpperCase()
  if (!SKU.test(sku)) return fail('SKUs are 2–40 letters, numbers, dots, dashes or underscores.', 'sku')
  const { data: dup } = await ctx.supabase.from('products').select('id, name').eq('workspace_id', ctx.workspace.id).eq('sku', sku).maybeSingle()
  if (dup) return fail(`SKU ${sku} is already used by ${dup.name}.`, 'sku')
  let categoryId: string | null = null
  if (input.categoryId) {
    const { data } = await ctx.supabase.from('product_categories').select('id').eq('id', input.categoryId).eq('workspace_id', ctx.workspace.id).maybeSingle()
    categoryId = data?.id ?? null
  }
  const markets = [...new Set((input.markets ?? []).map(m => text(m, 3).toUpperCase()).filter(m => /^[A-Z]{2,3}$/.test(m)))].slice(0, 30)

  const { data: p, error } = await ctx.supabase.from('products').insert({
    workspace_id: ctx.workspace.id, brand_id: ownBrand(ctx, input.brandId), category_id: categoryId, name, sku,
    description: text(input.description, 2000) || null, product_line: text(input.productLine, 80) || null,
    status: input.submit ? 'review' : 'draft', owner_id: ctx.userId, created_by: ctx.userId, updated_by: ctx.userId,
  }).select('id').single()
  if (error || !p) return fail('The product could not be saved.')
  if (markets.length) await ctx.supabase.from('product_markets').insert(markets.map(m => ({ workspace_id: ctx.workspace.id, product_id: p.id, market_code: m })))
  await ctx.supabase.from('product_variants').insert({ workspace_id: ctx.workspace.id, product_id: p.id, sku: `${sku}-STD`, name: `${name} — Standard`, status: 'draft' })
  await recalcReadiness(ctx, p.id)
  await activity(ctx, { entity_type: 'product', entity_id: p.id, action: 'created', summary: `Created ${name}`, href: `${ctx.basePath}/brand/products/${p.id}` })
  done(ctx)
  return { ok: true, data: { id: p.id }, message: `${name} created.` }
}

export async function linkAssetsToProduct(workspaceType: string, productId: string, links: { assetId: string; linkType: string }[]): Promise<ActionResult<{ linked: number; warnings: string[] }>> {
  const g = await gate(workspaceType, 'brand.products.edit'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: product } = await ctx.supabase.from('products').select('id, name, primary_asset_id').eq('id', productId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!product) return fail('Product not found.')
  const ids = [...new Set(links.map(l => l.assetId))].slice(0, 100)
  const { data: assets } = await ctx.supabase.from('media_assets').select('id, file_name, rights_state, approval_status, thumbnail_path, asset_kind')
    .eq('workspace_id', ctx.workspace.id).in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  const byId = new Map((assets ?? []).map(a => [a.id, a]))
  const TYPES = ['primary_image', 'packshot', 'lifestyle', 'video', 'three_sixty', 'packaging', 'spec_sheet', 'social', 'presentation', 'localised', 'other']
  const warnings: string[] = []
  const rows = links.filter(l => byId.has(l.assetId)).map(l => {
    const a = byId.get(l.assetId)!
    if (['expired', 'restricted'].includes(a.rights_state)) warnings.push(`${a.file_name} has ${a.rights_state} rights — linked, but flagged for review.`)
    return { workspace_id: ctx.workspace.id, product_id: productId, asset_id: l.assetId, link_type: TYPES.includes(l.linkType) ? l.linkType : 'other', linked_by: ctx.userId }
  })
  if (rows.length === 0) return fail('Choose assets from this workspace to link.')
  const { error } = await ctx.supabase.from('product_assets').upsert(rows, { onConflict: 'product_id,asset_id,link_type,market_code', ignoreDuplicates: true })
  if (error) {
    // The unique index is an expression index; fall back to one-by-one inserts, skipping duplicates.
    for (const r of rows) await ctx.supabase.from('product_assets').insert(r)
  }
  if (!product.primary_asset_id) {
    const primary = rows.find(r => ['primary_image', 'packshot'].includes(r.link_type) && byId.get(r.asset_id)?.asset_kind === 'image')
    if (primary) await ctx.supabase.from('products').update({ primary_asset_id: primary.asset_id }).eq('id', productId)
  }
  await recalcReadiness(ctx, productId)
  await activity(ctx, { entity_type: 'product', entity_id: productId, action: 'linked', summary: `Linked ${rows.length} asset${rows.length === 1 ? '' : 's'} to ${product.name}`, href: `${ctx.basePath}/brand/products/${productId}` })
  done(ctx)
  return { ok: true, data: { linked: rows.length, warnings }, message: `Linked ${rows.length} asset${rows.length === 1 ? '' : 's'} to ${product.name}.` }
}

export async function unlinkProductAsset(workspaceType: string, productId: string, assetId: string): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.products.edit'); if ('error' in g) return g.error
  const { ctx } = g
  await ctx.supabase.from('product_assets').delete().eq('workspace_id', ctx.workspace.id).eq('product_id', productId).eq('asset_id', assetId)
  await ctx.supabase.from('products').update({ primary_asset_id: null }).eq('id', productId).eq('primary_asset_id', assetId)
  await recalcReadiness(ctx, productId)
  done(ctx)
  return { ok: true, data: null, message: 'Asset unlinked.' }
}

export async function setProductStatus(workspaceType: string, productId: string, status: 'draft' | 'review' | 'active' | 'inactive' | 'archived' | 'discontinued'): Promise<ActionResult> {
  const cap: BrandCapability = status === 'active' ? 'brand.products.approve' : status === 'archived' ? 'brand.products.archive' : 'brand.products.edit'
  const g = await gate(workspaceType, cap); if ('error' in g) return g.error
  const { ctx } = g
  const { data: p } = await ctx.supabase.from('products').select('id, name, readiness_state').eq('id', productId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!p) return fail('Product not found.')
  if (status === 'active' && p.readiness_state === 'not_ready') return fail(`${p.name} is not campaign ready yet — resolve the failed readiness checks before activating it.`)
  await ctx.supabase.from('products').update({ status, archived_at: status === 'archived' ? new Date().toISOString() : null, updated_by: ctx.userId, updated_at: new Date().toISOString() }).eq('id', productId)
  await activity(ctx, { entity_type: 'product', entity_id: productId, action: status, summary: `Set ${p.name} to ${status}`, href: `${ctx.basePath}/brand/products/${productId}` })
  done(ctx)
  return { ok: true, data: null, message: `${p.name} is now ${status}.` }
}

/**
 * Campaign readiness is computed in one place: the database function
 * brand_product_readiness(), which evaluates the weighted checks from real
 * linked records. The nightly sweep uses the same function.
 */
async function recalcReadiness(ctx: BrandContext, productId: string) {
  const { error } = await ctx.supabase.rpc('brand_product_readiness', { p_product: productId })
  if (error) console.error('[brand] readiness recalculation failed', { productId, code: error.code })
}

// ===========================================================================
// AGREEMENTS — signed agreement files backing a licence (private, in R2)
// ===========================================================================

export async function requestAgreementUpload(workspaceType: string, input: { licenseId: string; fileName: string; contentType: string; size: number }): Promise<ActionResult<{ url: string; storedPath: string }>> {
  const g = await gate(workspaceType, 'brand.rights.edit'); if ('error' in g) return g.error
  const { ctx } = g
  if (!isR2Configured()) return fail('File storage is not configured for this environment. Ask an administrator to connect Cloudflare R2.')
  const { data: lic } = await ctx.supabase.from('rights_licenses').select('id').eq('id', input.licenseId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!lic) return fail('Choose a licence in this workspace.', 'licenseId')
  const fileName = text(input.fileName, 200)
  if (input.contentType !== 'application/pdf' || !fileName.toLowerCase().endsWith('.pdf')) return fail('Agreements must be PDF files.')
  if (!(input.size > 0) || input.size > 50 * 1024 * 1024) return fail('Agreements must be between 1 byte and 50 MB.')
  const { url, storedPath } = await createUploadUrl({ area: 'brand-assets', workspaceId: ctx.workspace.id, fileName, contentType: 'application/pdf' })
  return { ok: true, data: { url, storedPath } }
}

export async function finaliseAgreement(workspaceType: string, input: { licenseId: string; storedPath: string; fileName: string; title: string; signedOn?: string; expiresOn?: string }): Promise<ActionResult> {
  const g = await gate(workspaceType, 'brand.rights.edit'); if ('error' in g) return g.error
  const { ctx } = g
  if (!input.storedPath.startsWith(`${R2_PREFIX}brand-assets/${ctx.workspace.id}/`) || input.storedPath.includes('..')) return fail('That upload does not belong to this workspace.')
  const { data: lic } = await ctx.supabase.from('rights_licenses').select('id, name, brand_id').eq('id', input.licenseId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!lic) return fail('Licence not found.')
  const head = await inspectObject(input.storedPath)
  if (!head || head.size <= 0) return fail('The upload did not complete. Please try again.')
  if (head.contentType !== 'application/pdf') { await deleteObject(input.storedPath); return fail('Agreements must be PDF files.') }
  if (input.signedOn && !ISO_DATE.test(input.signedOn)) return fail('Signed date is not valid.', 'signedOn')
  if (input.expiresOn && !ISO_DATE.test(input.expiresOn)) return fail('Expiry date is not valid.', 'expiresOn')
  const fileName = text(input.fileName, 200)
  const { data: asset, error } = await ctx.supabase.from('media_assets').insert({
    workspace_id: ctx.workspace.id, brand_id: lic.brand_id, owner_id: ctx.userId, uploaded_by: ctx.userId,
    file_name: fileName, file_path: input.storedPath, file_url: `r2://${fileName}`, file_type: 'pdf', file_size: head.size,
    mime_type: 'application/pdf', asset_kind: 'pdf', approval_status: 'approved', rights_state: 'internal_use',
    usage_scope: 'Legal — restricted', storage_bucket: 'r2', tags: ['agreement'], processing_state: 'ready', scan_state: 'pending',
  }).select('id').single()
  if (error || !asset) { await deleteObject(input.storedPath); return fail('The agreement could not be saved.') }
  await ctx.supabase.from('rights_agreements').insert({
    workspace_id: ctx.workspace.id, license_id: lic.id, title: text(input.title, 160) || fileName, asset_id: asset.id,
    signed_on: input.signedOn || null, expires_on: input.expiresOn || null, uploaded_by: ctx.userId,
  })
  // A licence that now has an agreement no longer carries a "missing agreement" conflict.
  await ctx.supabase.from('rights_conflicts').update({ resolved_at: new Date().toISOString(), resolved_by: ctx.userId })
    .eq('license_id', lic.id).eq('conflict_type', 'missing_agreement').is('resolved_at', null)
  await activity(ctx, { entity_type: 'agreement', entity_id: lic.id, brand_id: lic.brand_id, action: 'uploaded', summary: `Uploaded agreement for ${lic.name}`, href: `${ctx.basePath}/brand/rights/${lic.id}` })
  done(ctx)
  return { ok: true, data: null, message: `Agreement attached to ${lic.name}.` }
}

// ===========================================================================
// PRODUCTS — favourite + CSV import
// ===========================================================================

export async function toggleProductFavourite(workspaceType: string, productId: string): Promise<ActionResult<{ favourite: boolean }>> {
  const g = await gate(workspaceType, 'brand.products.view'); if ('error' in g) return g.error
  const { ctx } = g
  const { data: p } = await ctx.supabase.from('products').select('is_favourite').eq('id', productId).eq('workspace_id', ctx.workspace.id).maybeSingle()
  if (!p) return fail('Product not found.')
  const { error } = await ctx.supabase.from('products').update({ is_favourite: !p.is_favourite }).eq('id', productId).eq('workspace_id', ctx.workspace.id)
  if (error) return fail('Could not update the bookmark.')
  done(ctx)
  return { ok: true, data: { favourite: !p.is_favourite } }
}

export interface ImportRowResult { row: number; sku: string; status: 'created' | 'skipped' | 'error'; message: string }

/**
 * Imports products from parsed CSV rows. Each row is validated independently,
 * so good rows are created and bad rows are reported — partial success, never
 * all-or-nothing. Workspace and brand come from the session, never the file.
 */
export async function importProducts(workspaceType: string, rows: { name: string; sku: string; category?: string; description?: string; markets?: string; brand?: string }[]): Promise<ActionResult<{ results: ImportRowResult[]; created: number }>> {
  const g = await gate(workspaceType, 'brand.products.import'); if ('error' in g) return g.error
  const { ctx } = g
  if (!Array.isArray(rows) || rows.length === 0) return fail('The file has no product rows.')
  if (rows.length > 1000) return fail('Import up to 1,000 products at a time.')

  const [{ data: existing }, { data: cats }] = await Promise.all([
    ctx.supabase.from('products').select('sku').eq('workspace_id', ctx.workspace.id),
    ctx.supabase.from('product_categories').select('id, name').eq('workspace_id', ctx.workspace.id),
  ])
  const taken = new Set(((existing ?? []) as { sku: string }[]).map(r => r.sku.toUpperCase()))
  const catByName = new Map(((cats ?? []) as { id: string; name: string }[]).map(c => [c.name.toLowerCase(), c.id]))
  const brandByName = new Map(ctx.brands.map(b => [b.name.toLowerCase(), b.id]))
  const results: ImportRowResult[] = []
  let created = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const name = text(r.name, 160)
    const sku = text(r.sku, 40).toUpperCase()
    if (name.length < 2) { results.push({ row: i + 2, sku, status: 'error', message: 'Name is missing' }); continue }
    if (!SKU.test(sku)) { results.push({ row: i + 2, sku, status: 'error', message: 'SKU is missing or invalid' }); continue }
    if (taken.has(sku)) { results.push({ row: i + 2, sku, status: 'skipped', message: 'SKU already exists' }); continue }
    const markets = [...new Set((r.markets ?? '').split(/[;|, ]+/).map(m => m.trim().toUpperCase()).filter(m => /^[A-Z]{2,3}$/.test(m)))].slice(0, 30)
    const { data: p, error } = await ctx.supabase.from('products').insert({
      workspace_id: ctx.workspace.id, name, sku, description: text(r.description, 2000) || null,
      category_id: r.category ? catByName.get(text(r.category, 80).toLowerCase()) ?? null : null,
      brand_id: r.brand ? brandByName.get(text(r.brand, 120).toLowerCase()) ?? null : null,
      status: 'draft', owner_id: ctx.userId, created_by: ctx.userId, updated_by: ctx.userId,
    }).select('id').single()
    if (error || !p) { results.push({ row: i + 2, sku, status: 'error', message: 'Could not be saved' }); continue }
    if (markets.length) await ctx.supabase.from('product_markets').insert(markets.map(m => ({ workspace_id: ctx.workspace.id, product_id: p.id, market_code: m })))
    await recalcReadiness(ctx, p.id)
    taken.add(sku); created++
    results.push({ row: i + 2, sku, status: 'created', message: 'Created as draft' })
  }
  await activity(ctx, { entity_type: 'product', entity_id: null, action: 'imported', summary: `Imported ${created} product${created === 1 ? '' : 's'} from CSV`,
    metadata: { detail: `${results.filter(r => r.status !== 'created').length} rows skipped or rejected` } })
  done(ctx)
  return { ok: true, data: { results, created }, message: `${created} of ${rows.length} products imported.` }
}
