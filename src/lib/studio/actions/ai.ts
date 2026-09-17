'use server'

// Studio → AI Generate mutations.

//
// The generation call itself lives in POST /api/studio/ai/generate (gated by
// Studio permissions, plan credits and the AI rate limit). These actions cover the surrounding
// workflow: saved prompts, output state, and moving an output into Studio as a
// real, editable draft.

import { studioBase } from '@/lib/studio/paths'
import {
  authorise, dbFail, fail, logActivity, logAudit, ownsRecord, revalidateStudio, type ActionResult,
} from '@/lib/studio/action-helpers'
import { STUDIO_CHANNELS, captionLimitFor } from '@/lib/studio/constants'

export async function savePrompt(input: {
  id?: string
  name: string
  prompt: string
  channel?: string
  tone?: string
  objective?: string
  audience?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('managePrompts')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const name = input.name?.trim() ?? ''
  const prompt = input.prompt?.trim() ?? ''
  if (!name) return fail('Name this prompt.', { name: 'A name is required.' })
  if (!prompt) return fail('The prompt cannot be empty.', { prompt: 'Write a prompt first.' })
  if (prompt.length > 3000) return fail('Prompts are limited to 3000 characters.', { prompt: 'Too long.' })

  const payload = {
    workspace_id: ctx.workspaceId, name: name.slice(0, 120), prompt,
    channel: input.channel?.slice(0, 40) ?? null,
    tone: input.tone?.slice(0, 40) ?? null,
    objective: input.objective?.slice(0, 40) ?? null,
    audience: input.audience?.slice(0, 120) ?? null,
  }

  if (input.id) {
    if (!(await ownsRecord(supabase, 'studio_prompts', input.id, ctx.workspaceId))) {
      return fail('That prompt is not part of this workspace.')
    }
    const { error: updateError } = await supabase
      .from('studio_prompts').update(payload).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('savePrompt/update', updateError)
    revalidateStudio()
    return { ok: true, id: input.id, message: 'Prompt saved.' }
  }

  const { data, error: insertError } = await supabase
    .from('studio_prompts').insert({ ...payload, created_by: userId }).select('id').single()
  if (insertError) {
    if (insertError.code === '23505') {
      return fail('A saved prompt with that name already exists.', { name: 'Already in use.' })
    }
    return dbFail('savePrompt/insert', insertError)
  }

  revalidateStudio()
  return { ok: true, id: data.id, message: 'Prompt saved.' }
}

export async function deletePrompt(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('managePrompts')
  if (!session) return fail(error!)
  const { supabase, ctx } = session

  const { error: updateError } = await supabase
    .from('studio_prompts').update({ archived_at: new Date().toISOString() })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('deletePrompt', updateError)

  revalidateStudio()
  return { ok: true, message: 'Prompt removed.' }
}

export async function setAiOutputState(
  input: { id: string; bookmarked?: boolean; status?: 'draft' | 'used' | 'discarded'; output?: string },
): Promise<ActionResult> {
  const { session, error } = await authorise('viewAi')
  if (!session) return fail(error!)
  const { supabase, ctx } = session

  if (!(await ownsRecord(supabase, 'ai_generations', input.id, ctx.workspaceId))) {
    return fail('That output is not part of this workspace.')
  }

  const patch: Record<string, unknown> = {}
  if (input.bookmarked !== undefined) patch.bookmarked = input.bookmarked
  if (input.status) patch.status = input.status
  if (input.output !== undefined) {
    const text = input.output.trim()
    if (!text) return fail('An output cannot be empty.', { output: 'Write something or discard the output.' })
    if (text.length > 20_000) return fail('Outputs are limited to 20,000 characters.', { output: 'Too long.' })
    patch.output = text
    patch.word_count = text.split(/\s+/).filter(Boolean).length
  }
  if (Object.keys(patch).length === 0) return fail('Nothing to update.')

  const { error: updateError } = await supabase
    .from('ai_generations').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('setAiOutputState', updateError)

  revalidateStudio()
  return { ok: true, message: 'Updated.' }
}

/** Moves an AI output into Studio as a real draft the user can then edit. */
export async function useAiOutput(input: { id: string; title?: string }): Promise<ActionResult> {
  const { session, error } = await authorise('createContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: output } = await supabase
    .from('ai_generations').select('id, output, channel, platform, topic, tone, used_content_id')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!output) return fail('That output is not part of this workspace.')
  if (output.used_content_id) {
    return { ok: true, id: output.used_content_id, message: 'This output is already in Studio.' }
  }

  const channel = output.channel ?? output.platform ?? 'instagram'
  const platforms = (STUDIO_CHANNELS as readonly string[]).includes(channel) ? [channel] : ['instagram']
  const caption = (output.output ?? '').slice(0, captionLimitFor(platforms))
  const hashtags = [...new Set(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 30)
  const title = (input.title?.trim() || output.topic || 'AI draft').slice(0, 200)

  const { data: content, error: insertError } = await supabase
    .from('content_posts')
    .insert({
      workspace_id: ctx.workspaceId,
      title, internal_title: title, caption, hashtags, platforms,
      tone: output.tone, status: 'draft', source: 'ai',
      owner_id: userId, created_by: userId, updated_by: userId,
    })
    .select('id').single()
  if (insertError) return dbFail('useAiOutput', insertError)

  await supabase.from('ai_generations')
    .update({ status: 'used', used_content_id: content.id })
    .eq('id', output.id).eq('workspace_id', ctx.workspaceId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: content.id, action: 'ai_used',
    summary: `moved an AI output into Studio as “${title}”`,
    link: `${studioBase(ctx)}/compose?id=${content.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.ai.output_used', resourceType: 'ai_generation', resourceId: output.id,
    metadata: { content_id: content.id },
  })
  revalidateStudio()
  return { ok: true, id: content.id, message: 'Draft created.' }
}
