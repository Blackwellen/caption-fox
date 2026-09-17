'use server'

import type { ActionResult } from '../action-types'
import { authorise, dbError, fail, invalid, ownsRecord, rateLimited, record, revalidateStrategy } from '../server'
import {
  canTransitionResearch, IMPACT_LEVELS, RESEARCH_FILE_MAX_BYTES, RESEARCH_FILE_TYPES, RESEARCH_METHODS, RESEARCH_SOURCE_TYPES,
} from '../constants'
import { contentMatchesType, FieldErrors, integer, oneOf, tags as cleanTags, text, UUID_RE, uuid } from '../validation'
import { notifyStrategy } from '../notify'

const BUCKET = 'strategy-research'

/**
 * Registers a file the browser has just uploaded to the private research
 * bucket (storage RLS already limited the write to this workspace's folder).
 * The object is re-inspected server-side — real size, declared type and the
 * file's leading bytes — and removed if anything does not match.
 */
export async function registerResearchFile(input: ResearchInput & { path?: string; file_name?: string; file_type?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'uploadResearch')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  const path = String(input.path ?? '')
  const prefix = `${ctx.workspaceId}/research/`
  const discard = async () => { await supabase.storage.from(BUCKET).remove([path]) }

  if (!path.startsWith(prefix) || path.includes('..') || !UUID_RE.test(path.slice(prefix.length, prefix.length + 36))) {
    return fail('That upload path is not valid for this workspace.')
  }
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'uploaded', 40, 60)) {
    await discard()
    return fail('Upload limit reached. Try again in an hour.')
  }
  const errors = new FieldErrors()
  const values = parse(input, errors)
  const mime = oneOf(errors, 'file', input.file_type, RESEARCH_FILE_TYPES, { label: 'File type', required: true })
  if (!errors.ok) { await discard(); return invalid(errors) }

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(path)
  if (downloadError || !blob) return fail('The uploaded file could not be found. Please upload it again.')
  if (blob.size <= 0 || blob.size > RESEARCH_FILE_MAX_BYTES) { await discard(); return fail('Files must be between 1 byte and 25 MB.') }
  const head = new Uint8Array(await blob.slice(0, 65_536).arrayBuffer())
  if (!contentMatchesType(mime!, head)) { await discard(); return fail('The file contents do not match its type, so it was rejected.', { file: 'Unsupported or mislabelled file.' }) }
  if (values.collection_id && !(await ownsRecord(supabase, 'strategy_research_collections', values.collection_id, ctx.workspaceId))) {
    await discard(); return fail('Collection not found.')
  }

  const fileName = text(errors, 'file_name', input.file_name, { label: 'File name', max: 200 }) ?? path.split('/').pop()!
  const { data, error: insertError } = await supabase.from('strategy_research_items').insert({
    ...values, owner_id: values.owner_id ?? userId, status: 'draft', workspace_id: ctx.workspaceId,
    created_by: userId, uploaded_by: userId, file_path: path, file_name: fileName, file_type: mime, file_size: blob.size,
  }).select('id').single()
  if (insertError || !data) { await discard(); return fail(dbError(insertError, 'Could not save the uploaded research.')) }
  await record(session, { entityType: 'research', entityId: data.id, action: 'uploaded', summary: values.title ?? fileName, surface: 'research', metadata: { size: blob.size, mime } })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'File uploaded as a draft.' }
}

/** Short-lived signed link for a research file; every download is audited. */
export async function getResearchFileUrl(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'view')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: item } = await supabase.from('strategy_research_items').select('title, file_path, file_name').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!item) return fail('Research item not found.')
  if (!item.file_path) return fail('This research item has no attached file.')
  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(item.file_path, 120, { download: item.file_name ?? true })
  if (signError || !data) return fail('The file is missing or was deleted. Upload it again to restore access.')
  await record(session, { entityType: 'research', entityId: id, action: 'downloaded file', summary: item.title, surface: 'research', audit: 'strategy.research.file_downloaded' })
  return { ok: true, message: data.signedUrl }
}

export interface ResearchInput {
  title?: string
  summary?: string
  source_type?: string
  method?: string
  impact?: string
  confidence?: string | number
  theme?: string
  collection_id?: string
  owner_id?: string
  tags?: string | string[]
}

function parse(input: ResearchInput, errors: FieldErrors) {
  return {
    title: text(errors, 'title', input.title, { label: 'Title', required: true, max: 160 }),
    summary: text(errors, 'summary', input.summary, { label: 'Summary', max: 4000 }),
    source_type: oneOf(errors, 'source_type', input.source_type, RESEARCH_SOURCE_TYPES, { label: 'Source type', fallback: 'market_research' }),
    method: oneOf(errors, 'method', input.method, RESEARCH_METHODS, { label: 'Method', fallback: 'report' }),
    impact: oneOf(errors, 'impact', input.impact, IMPACT_LEVELS, { label: 'Impact', fallback: 'medium' }),
    confidence: integer(errors, 'confidence', input.confidence, { label: 'Confidence', min: 0, max: 100, fallback: 60 }),
    theme: text(errors, 'theme', input.theme, { label: 'Theme', max: 60 }),
    collection_id: uuid(errors, 'collection_id', input.collection_id, { label: 'Collection' }),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
    tags: cleanTags(input.tags),
  }
}

export async function createResearch(input: ResearchInput): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parse(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  if (values.collection_id && !(await ownsRecord(supabase, 'strategy_research_collections', values.collection_id, ctx.workspaceId))) {
    return fail('Collection not found.', { collection_id: 'Choose a collection from this workspace.' })
  }
  const { data, error: insertError } = await supabase.from('strategy_research_items').insert({
    ...values, owner_id: values.owner_id ?? userId, status: 'draft',
    workspace_id: ctx.workspaceId, created_by: userId,
  }).select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not add the research item.'))
  await record(session, { entityType: 'research', entityId: data.id, action: 'added research', summary: `"${values.title}"`, surface: 'research' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Research added as a draft.' }
}

export async function updateResearch(id: string, input: ResearchInput): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parse(input, errors)
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_research_items').select('archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Research item not found.')
  if (current.archived_at) return fail('Restore this item before editing it.')
  if (values.collection_id && !(await ownsRecord(supabase, 'strategy_research_collections', values.collection_id, ctx.workspaceId))) return fail('Collection not found.')
  const { error: updateError } = await supabase.from('strategy_research_items').update(values).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not save the research item.'))
  await record(session, { entityType: 'research', entityId: id, action: 'updated', summary: `"${values.title}"`, surface: 'research' })
  revalidateStrategy()
  return { ok: true, id, message: 'Research saved.' }
}

/**
 * Review workflow. Submitting (draft/needs revision → in review) needs create
 * rights; approving or requesting revision needs the approve capability and a
 * comment when sending back.
 */
export async function setResearchStatus(id: string, status: string, comment?: string): Promise<ActionResult> {
  const reviewing = status === 'approved' || status === 'needs_revision'
  const { session, error } = await authorise('research', reviewing ? 'approveResearch' : 'createResearch')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const note = text(errors, 'comment', comment, { label: 'Comment', required: status === 'needs_revision', max: 1000 })
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data: current } = await supabase.from('strategy_research_items').select('title, status, created_by')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Research item not found.')
  if (current.status === status) return { ok: true, message: 'Status unchanged.' }
  if (!canTransitionResearch(current.status, status)) return fail('That review step is not allowed from the current status.')
  if (status === 'archived') return archiveResearch(id)

  const now = new Date().toISOString()
  const { error: updateError } = await supabase.from('strategy_research_items').update({
    status,
    ...(reviewing ? { reviewed_by: userId, reviewed_at: now, review_note: note } : {}),
  }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the review status.'))

  if (status === 'in_review') {
    await supabase.from('strategy_approvals').insert({
      workspace_id: ctx.workspaceId, entity_type: 'research', entity_id: id, stage: 'review', status: 'pending', requested_by: userId,
    })
  } else if (reviewing) {
    await supabase.from('strategy_approvals').update({ status: status === 'approved' ? 'approved' : 'changes_requested', approver_id: userId, comment: note, decided_at: now })
      .eq('workspace_id', ctx.workspaceId).eq('entity_type', 'research').eq('entity_id', id).eq('status', 'pending')
    if (note) await supabase.from('strategy_comments').insert({ workspace_id: ctx.workspaceId, entity_type: 'research', entity_id: id, body: note, author_id: userId })
    await notifyStrategy(session, {
      recipientId: current.created_by, type: 'strategy_research_review',
      title: status === 'approved' ? 'Research approved' : 'Research needs revision',
      body: `"${current.title}"${note ? ` — ${note.slice(0, 140)}` : ''}`, module: 'research', entityId: id,
    })
  }
  await record(session, {
    entityType: 'research', entityId: id,
    action: status === 'in_review' ? 'submitted for review' : status === 'approved' ? 'approved research' : status === 'needs_revision' ? 'requested revision' : 'updated',
    summary: `"${current.title}"`, surface: 'research', metadata: { from: current.status, to: status },
  })
  revalidateStrategy()
  return { ok: true, message: status === 'in_review' ? 'Submitted for review.' : status === 'approved' ? 'Research approved.' : status === 'needs_revision' ? 'Sent back for revision.' : 'Status updated.' }
}

export async function toggleResearchFavourite(id: string, favourite: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  if (!(await ownsRecord(supabase, 'strategy_research_items', id, ctx.workspaceId))) return fail('Research item not found.')
  const { error: updateError } = await supabase.from('strategy_research_items').update({ is_favourite: Boolean(favourite) }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update favourites.'))
  revalidateStrategy()
  return { ok: true, message: favourite ? 'Added to favourites.' : 'Removed from favourites.' }
}

export async function moveResearchToCollection(id: string, collectionId: string | null): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  if (!(await ownsRecord(supabase, 'strategy_research_items', id, ctx.workspaceId))) return fail('Research item not found.')
  if (collectionId && !(await ownsRecord(supabase, 'strategy_research_collections', collectionId, ctx.workspaceId))) return fail('Collection not found.')
  const { error: updateError } = await supabase.from('strategy_research_items').update({ collection_id: collectionId || null }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not move the item.'))
  await record(session, { entityType: 'research', entityId: id, action: 'moved to collection', summary: 'Research item', surface: 'research' })
  revalidateStrategy()
  return { ok: true, message: collectionId ? 'Moved to collection.' : 'Removed from collection.' }
}

export async function createCollection(name: string): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const clean = text(errors, 'name', name, { label: 'Collection name', required: true, max: 60 })
  if (!errors.ok) return invalid(errors)
  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_research_collections')
    .insert({ workspace_id: ctx.workspaceId, name: clean, created_by: userId }).select('id').single()
  if (insertError || !data) return fail(insertError?.code === '23505' ? 'A collection with this name already exists.' : dbError(insertError, 'Could not create the collection.'), { name: 'Choose a different name.' })
  await record(session, { entityType: 'research', action: 'created collection', summary: `"${clean}"`, surface: 'research' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Collection created.' }
}

export async function setResearchTags(ids: string[], add: string[], remove: string[] = []): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const addList = cleanTags(add)
  const removeList = new Set(cleanTags(remove))
  if (addList.length === 0 && removeList.size === 0) return fail('Enter a tag.')
  const { supabase, ctx } = session
  const { data: rows } = await supabase.from('strategy_research_items').select('id, tags').eq('workspace_id', ctx.workspaceId).in('id', ids.slice(0, 200))
  const scoped = (rows ?? []) as { id: string; tags: string[] }[]
  if (scoped.length === 0) return fail('Research item not found.')
  for (const row of scoped) {
    const next = cleanTags([...(row.tags ?? []).filter(tag => !removeList.has(tag)), ...addList])
    const { error: updateError } = await supabase.from('strategy_research_items').update({ tags: next }).eq('id', row.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return fail(dbError(updateError, 'Could not update tags.'))
  }
  await record(session, { entityType: 'research', action: 'updated tags', summary: `${scoped.length} item${scoped.length === 1 ? '' : 's'}`, surface: 'research' })
  revalidateStrategy()
  return { ok: true, message: 'Tags updated.' }
}

export async function setResearchLink(researchId: string, targetType: 'objective' | 'plan', targetId: string, linked: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  if (targetType !== 'objective' && targetType !== 'plan') return fail('Unsupported link type.')
  const { supabase, ctx, userId } = session
  const [a, b] = await Promise.all([
    ownsRecord(supabase, 'strategy_research_items', researchId, ctx.workspaceId),
    ownsRecord(supabase, targetType === 'objective' ? 'strategy_objectives' : 'strategy_plans', targetId, ctx.workspaceId),
  ])
  if (!a || !b) return fail('Record not found.')
  if (linked) {
    const { error: linkError } = await supabase.from('strategy_links').upsert({
      workspace_id: ctx.workspaceId, source_type: 'research', source_id: researchId, target_type: targetType, target_id: targetId, created_by: userId,
    }, { onConflict: 'source_type,source_id,target_type,target_id', ignoreDuplicates: true })
    if (linkError) return fail(dbError(linkError, 'Could not link the records.'))
  } else {
    await supabase.from('strategy_links').delete().eq('workspace_id', ctx.workspaceId)
      .eq('source_type', 'research').eq('source_id', researchId).eq('target_type', targetType).eq('target_id', targetId)
  }
  await record(session, { entityType: 'research', entityId: researchId, action: linked ? `linked ${targetType}` : `unlinked ${targetType}`, summary: 'Research item', surface: 'research' })
  revalidateStrategy()
  return { ok: true, message: linked ? 'Linked.' : 'Link removed.' }
}

export async function archiveResearch(id: string): Promise<ActionResult> {
  return setArchived(id, true)
}

export async function restoreResearch(id: string): Promise<ActionResult> {
  return setArchived(id, false)
}

async function setArchived(id: string, archive: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'createResearch')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_research_items').select('title, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Research item not found.')
  if (archive === Boolean(current.archived_at)) return { ok: true, message: 'No change.' }
  const { error: updateError } = await supabase.from('strategy_research_items')
    .update(archive ? { status: 'archived', archived_at: new Date().toISOString() } : { status: 'draft', archived_at: null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the item.'))
  await record(session, { entityType: 'research', entityId: id, action: archive ? 'archived' : 'restored', summary: `"${current.title}"`, surface: 'research' })
  revalidateStrategy()
  return { ok: true, message: archive ? 'Research archived.' : 'Research restored as a draft.' }
}

export async function deleteResearch(id: string): Promise<ActionResult> {
  const { session, error } = await authorise('research', 'deleteResearch')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_research_items').select('title, archived_at, file_path').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Research item not found.')
  if (!current.archived_at) return fail('Archive the item before deleting it permanently.')
  if (current.file_path) {
    const { error: storageError } = await supabase.storage.from('strategy-research').remove([current.file_path])
    if (storageError) return fail('Could not remove the stored file. The item was not deleted.')
  }
  await supabase.from('strategy_links').delete().eq('workspace_id', ctx.workspaceId)
    .or(`and(source_type.eq.research,source_id.eq.${id}),and(target_type.eq.research,target_id.eq.${id})`)
  const { error: deleteError } = await supabase.from('strategy_research_items').delete().eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(dbError(deleteError, 'Could not delete the item.'))
  await record(session, { entityType: 'research', entityId: id, action: 'deleted', summary: `"${current.title}"`, surface: 'research' })
  revalidateStrategy()
  return { ok: true, message: 'Research deleted.' }
}
