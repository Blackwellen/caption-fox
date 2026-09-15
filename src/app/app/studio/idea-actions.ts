'use server'

// Studio → Ideas mutations.

import {
  authorise, cleanArray, dbFail, fail, logActivity, logAudit,
  ownsRecord, revalidateStudio, type ActionResult,
} from '@/lib/studio/action-helpers'
import { IDEA_STAGES, STUDIO_CHANNELS, canTransitionIdea, type IdeaStage } from '@/lib/studio/constants'

export interface IdeaInput {
  id?: string
  title: string
  description?: string
  platforms?: string[]
  tags?: string[]
  source?: string
  score?: number | null
  stage?: string
  collectionId?: string | null
  nextStep?: string
  whyItWorks?: string[]
}

export async function saveIdea(input: IdeaInput): Promise<ActionResult> {
  const { session, error } = await authorise(input.id ? 'editIdeas' : 'createIdeas')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const title = input.title?.trim() ?? ''
  if (!title) return fail('Give the idea a title.', { title: 'A title is required.' })
  if (title.length > 200) return fail('Titles are limited to 200 characters.', { title: 'Too long.' })

  const score = input.score === undefined || input.score === null
    ? null
    : Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)))
  const stage = input.stage && (IDEA_STAGES as readonly string[]).includes(input.stage) ? input.stage : 'backlog'

  if (input.collectionId
    && !(await ownsRecord(supabase, 'studio_idea_collections', input.collectionId, ctx.workspaceId))) {
    return fail('That collection is not part of this workspace.')
  }

  const payload = {
    workspace_id: ctx.workspaceId,
    title,
    description: input.description?.slice(0, 4000) ?? null,
    platforms: cleanArray(input.platforms, STUDIO_CHANNELS),
    tags: cleanArray(input.tags, undefined, 20),
    source: input.source?.slice(0, 60) ?? 'manual',
    score,
    stage,
    collection_id: input.collectionId || null,
    next_step: input.nextStep?.slice(0, 500) ?? null,
    why_it_works: cleanArray(input.whyItWorks, undefined, 6),
  }

  if (input.id) {
    if (!(await ownsRecord(supabase, 'content_ideas', input.id, ctx.workspaceId))) {
      return fail('That idea is not part of this workspace.')
    }
    const { error: updateError } = await supabase
      .from('content_ideas').update(payload).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('saveIdea/update', updateError)
    revalidateStudio()
    return { ok: true, id: input.id, message: 'Idea updated.' }
  }

  const { data, error: insertError } = await supabase
    .from('content_ideas')
    .insert({ ...payload, owner_id: userId, created_by: userId, status: 'idea' })
    .select('id').single()
  if (insertError) return dbFail('saveIdea/insert', insertError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'idea', entityId: data.id, action: 'created',
    summary: `added the idea “${title}”`, link: `/app/studio/ideas?selected=${data.id}`,
  })
  revalidateStudio()
  return { ok: true, id: data.id, message: 'Idea added.' }
}

export async function setIdeaStage(input: { id: string; stage: string }): Promise<ActionResult> {
  if (!(IDEA_STAGES as readonly string[]).includes(input.stage)) return fail('Unknown stage.')
  const { session, error } = await authorise('editIdeas')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session
  const target = input.stage as IdeaStage

  const { data: current } = await supabase
    .from('content_ideas').select('id, stage, title')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That idea is not part of this workspace.')

  // The board enforces the same workflow the backend does, so a drag that is
  // not a legal move is refused rather than silently accepted.
  if (!canTransitionIdea(current.stage as IdeaStage, target)) {
    return fail(`An idea cannot move from ${current.stage.replace('_', ' ')} to ${target.replace('_', ' ')}.`)
  }

  const patch: Record<string, unknown> = { stage: target }
  if (target === 'archived') patch.archived_at = new Date().toISOString()
  if (current.stage === 'archived' && target !== 'archived') patch.archived_at = null

  const { error: updateError } = await supabase
    .from('content_ideas').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('setIdeaStage', updateError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'idea', entityId: input.id, action: target,
    summary: `moved “${current.title}” to ${target.replace('_', ' ')}`,
    link: `/app/studio/ideas?selected=${input.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.idea.stage_changed', resourceType: 'content_idea', resourceId: input.id,
    metadata: { from: current.stage, to: target },
  })
  revalidateStudio()
  return { ok: true, message: `Moved to ${target.replace('_', ' ')}.` }
}

/**
 * Converts an idea into a real draft. The idea is only marked converted once
 * the content record actually exists, so a failure can never leave an idea
 * flagged as converted with nothing behind it.
 */
export async function convertIdeaToContent(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('convertIdeas')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: idea } = await supabase
    .from('content_ideas').select('id, title, description, platforms, tags, converted_to_post_id')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!idea) return fail('That idea is not part of this workspace.')

  // Idempotent: converting twice returns the existing draft rather than
  // creating a second one from a double-click.
  if (idea.converted_to_post_id) {
    return { ok: true, id: idea.converted_to_post_id, message: 'This idea already has a draft.' }
  }

  const platforms = cleanArray(idea.platforms, STUDIO_CHANNELS)
  const { data: content, error: insertError } = await supabase
    .from('content_posts')
    .insert({
      workspace_id: ctx.workspaceId,
      title: idea.title, internal_title: idea.title,
      caption: idea.description ?? '',
      platforms: platforms.length ? platforms : ['instagram'],
      tags: idea.tags ?? [],
      status: 'draft', source: 'idea', idea_id: idea.id,
      owner_id: userId, created_by: userId, updated_by: userId,
    })
    .select('id').single()
  if (insertError) return dbFail('convertIdeaToContent', insertError)

  await supabase.from('content_ideas')
    .update({ stage: 'converted', status: 'converted', converted_to_post_id: content.id })
    .eq('id', idea.id).eq('workspace_id', ctx.workspaceId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'idea', entityId: idea.id, action: 'converted',
    summary: `converted “${idea.title}” into a draft`,
    link: `/app/studio/compose?id=${content.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.idea.converted', resourceType: 'content_idea', resourceId: idea.id,
    metadata: { content_id: content.id },
  })
  revalidateStudio()
  return { ok: true, id: content.id, message: 'Draft created from idea.' }
}

export async function archiveIdea(input: { id: string; restore?: boolean }): Promise<ActionResult> {
  const { session, error } = await authorise('editIdeas')
  if (!session) return fail(error!)
  const { supabase, ctx } = session

  if (!(await ownsRecord(supabase, 'content_ideas', input.id, ctx.workspaceId))) {
    return fail('That idea is not part of this workspace.')
  }

  const { error: updateError } = await supabase
    .from('content_ideas')
    .update({
      archived_at: input.restore ? null : new Date().toISOString(),
      stage: input.restore ? 'backlog' : 'archived',
    })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('archiveIdea', updateError)

  revalidateStudio()
  return { ok: true, message: input.restore ? 'Restored.' : 'Archived.' }
}

export async function createIdeaCollection(
  input: { name: string; colour?: string; description?: string },
): Promise<ActionResult> {
  const { session, error } = await authorise('createIdeas')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const name = input.name?.trim() ?? ''
  if (!name) return fail('Name the collection.', { name: 'A name is required.' })

  const colours = ['blue', 'green', 'amber', 'violet', 'red', 'slate']
  const { data, error: insertError } = await supabase
    .from('studio_idea_collections')
    .insert({
      workspace_id: ctx.workspaceId,
      name: name.slice(0, 120),
      description: input.description?.slice(0, 500) ?? null,
      colour: colours.includes(input.colour ?? '') ? input.colour : 'blue',
      created_by: userId,
    })
    .select('id').single()

  if (insertError) {
    // The unique (workspace_id, name) index is what actually prevents a
    // duplicate, including from two rapid submissions.
    if (insertError.code === '23505') {
      return fail('A collection with that name already exists.', { name: 'Already in use.' })
    }
    return dbFail('createIdeaCollection', insertError)
  }

  revalidateStudio()
  return { ok: true, id: data.id, message: 'Collection created.' }
}
