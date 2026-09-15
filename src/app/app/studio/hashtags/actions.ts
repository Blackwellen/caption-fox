'use server'

// Studio → Hashtags & Keywords mutations.

import {
  authorise, blockedTermSet, cleanArray, dbFail, fail, logActivity, logAudit,
  ownsRecord, revalidateStudio, type ActionResult,
} from '@/lib/studio/action-helpers'
import { STUDIO_CHANNELS } from '@/lib/studio/constants'
import { revalidatePath } from 'next/cache'

export interface KeywordSetInput {
  id?: string
  name: string
  kind?: string
  description?: string
  platform?: string
  topic?: string
  language?: string
  hashtags?: string[]
}

export async function saveKeywordSet(input: KeywordSetInput): Promise<ActionResult> {
  const { session, error } = await authorise(input.id ? 'editHashtags' : 'createHashtags')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const name = input.name?.trim() ?? ''
  if (!name) return fail('Name this group.', { name: 'A name is required.' })

  const blocked = await blockedTermSet(supabase, ctx.workspaceId)
  const hashtags = cleanArray(input.hashtags, undefined, 100)
    .map(h => (h.startsWith('#') ? h : `#${h}`))
    .filter(h => !blocked.has(h.replace(/^#/, '').toLowerCase()))

  const payload = {
    workspace_id: ctx.workspaceId,
    name: name.slice(0, 160),
    kind: input.kind === 'cluster' ? 'cluster' : 'set',
    description: input.description?.slice(0, 1000) ?? null,
    platform: input.platform && (STUDIO_CHANNELS as readonly string[]).includes(input.platform) ? input.platform : null,
    topic: input.topic?.slice(0, 60) ?? null,
    language: input.language?.slice(0, 10) || 'en-GB',
    hashtags,
  }

  if (input.id) {
    if (!(await ownsRecord(supabase, 'hashtag_sets', input.id, ctx.workspaceId))) {
      return fail('That group is not part of this workspace.')
    }
    const { error: updateError } = await supabase
      .from('hashtag_sets').update(payload).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('saveKeywordSet/update', updateError)
    revalidateStudio()
    return { ok: true, id: input.id, message: 'Saved.' }
  }

  const { data, error: insertError } = await supabase
    .from('hashtag_sets')
    .insert({ ...payload, status: 'active', owner_id: userId, created_by: userId })
    .select('id').single()
  if (insertError) return dbFail('saveKeywordSet/insert', insertError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'keyword_set', entityId: data.id, action: 'created',
    summary: `created ${payload.kind === 'cluster' ? 'the cluster' : 'the hashtag set'} “${name}”`,
    link: `/app/studio/hashtags?selected=${data.id}`,
  })
  revalidateStudio()
  return { ok: true, id: data.id, message: 'Created.' }
}

export async function addKeywordTerms(
  input: { setId: string; terms: string[]; kind?: 'keyword' | 'hashtag' },
): Promise<ActionResult<{ added: number; blocked: number }>> {
  const { session, error } = await authorise('editHashtags')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'hashtag_sets', input.setId, ctx.workspaceId))) {
    return fail('That group is not part of this workspace.')
  }

  const blocked = await blockedTermSet(supabase, ctx.workspaceId)
  const candidates = cleanArray(input.terms, undefined, 100)
  const allowed = candidates.filter(t => !blocked.has(t.replace(/^#/, '').toLowerCase()))
  if (allowed.length === 0) {
    return fail(candidates.length ? 'Every term you added is on the blocked list.' : 'Add at least one term.')
  }

  const rows = allowed.map(term => ({
    workspace_id: ctx.workspaceId, set_id: input.setId,
    term: term.slice(0, 120), kind: input.kind ?? 'keyword', source: 'manual', created_by: userId,
  }))

  // `unique (set_id, term)` makes this idempotent: re-adding a term is a no-op,
  // so a double-click can never create duplicate rows.
  const { error: insertError } = await supabase
    .from('studio_keyword_terms').upsert(rows, { onConflict: 'set_id,term', ignoreDuplicates: true })
  if (insertError) return dbFail('addKeywordTerms', insertError)

  revalidateStudio()
  return {
    ok: true,
    message: `${allowed.length} term${allowed.length === 1 ? '' : 's'} added.`,
    data: { added: allowed.length, blocked: candidates.length - allowed.length },
  }
}

export async function removeKeywordTerm(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('editHashtags')
  if (!session) return fail(error!)
  const { supabase, ctx } = session

  const { error: deleteError } = await supabase
    .from('studio_keyword_terms').delete().eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return dbFail('removeKeywordTerm', deleteError)
  revalidateStudio()
  return { ok: true, message: 'Term removed.' }
}

export async function blockTerm(input: { term: string; reason?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('editHashtags')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const term = input.term?.trim().replace(/^#/, '') ?? ''
  if (!term) return fail('Enter a term to block.', { term: 'A term is required.' })

  const { error: insertError } = await supabase.from('studio_blocked_terms').upsert(
    {
      workspace_id: ctx.workspaceId, term: term.slice(0, 120),
      reason: input.reason?.slice(0, 200) ?? null, created_by: userId,
    },
    { onConflict: 'workspace_id,term', ignoreDuplicates: true },
  )
  if (insertError) return dbFail('blockTerm', insertError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.hashtags.term_blocked', resourceType: 'blocked_term', metadata: { term },
  })
  revalidateStudio()
  return { ok: true, message: `“${term}” blocked.` }
}

export async function unblockTerm(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('editHashtags')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { error: deleteError } = await supabase
    .from('studio_blocked_terms').delete().eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return dbFail('unblockTerm', deleteError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.hashtags.term_unblocked', resourceType: 'blocked_term', resourceId: input.id,
  })
  revalidateStudio()
  return { ok: true, message: 'Term unblocked.' }
}

export async function toggleKeywordFavourite(
  input: { id: string },
): Promise<ActionResult<{ favourite: boolean }>> {
  const { session, error } = await authorise('editHashtags')
  if (!session) return fail(error!)
  const { supabase, ctx } = session

  const { data: current } = await supabase
    .from('hashtag_sets').select('id, favourite')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That group is not part of this workspace.')

  const next = !current.favourite
  const { error: updateError } = await supabase
    .from('hashtag_sets').update({ favourite: next }).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('toggleKeywordFavourite', updateError)

  revalidatePath('/app/studio/hashtags')
  return { ok: true, data: { favourite: next } }
}

/** Appends terms to an existing draft's hashtags — the "Add to Composer" action. */
export async function addTermsToContent(
  input: { contentId: string; terms: string[] },
): Promise<ActionResult> {
  const { session, error } = await authorise('editContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: content } = await supabase
    .from('content_posts').select('id, hashtags, title')
    .eq('id', input.contentId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!content) return fail('That draft is not part of this workspace.')

  const blocked = await blockedTermSet(supabase, ctx.workspaceId)
  const incoming = cleanArray(input.terms, undefined, 60)
    .map(t => (t.startsWith('#') ? t : `#${t}`))
    .filter(t => !blocked.has(t.replace(/^#/, '').toLowerCase()))

  const merged = [...new Set([...(content.hashtags ?? []), ...incoming])].slice(0, 40)
  const { error: updateError } = await supabase
    .from('content_posts').update({ hashtags: merged, updated_by: userId })
    .eq('id', input.contentId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('addTermsToContent', updateError)

  revalidateStudio()
  return { ok: true, id: input.contentId, message: `Added to “${content.title ?? 'draft'}”.` }
}
