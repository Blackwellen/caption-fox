'use server'

// Studio → Templates mutations.

import { studioBase } from '@/lib/studio/paths'
import {
  authorise, dbFail, fail, cleanArray, logActivity, ownsRecord, revalidateStudio, type ActionResult,
} from '@/lib/studio/action-helpers'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import {
  STUDIO_CHANNELS, POST_TYPES, TEMPLATE_CATEGORIES, TEMPLATE_STATUSES, captionLimitFor,
} from '@/lib/studio/constants'

export interface TemplateInput {
  id?: string
  name: string
  description?: string
  captionTemplate?: string
  channel?: string
  category?: string
  platforms?: string[]
  hashtags?: string[]
  tags?: string[]
  postType?: string
  /** A workspace media asset whose preview becomes the template cover. */
  coverAssetId?: string | null
}

export async function saveTemplate(input: TemplateInput): Promise<ActionResult> {
  const { session, error } = await authorise(input.id ? 'editTemplates' : 'createTemplates')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const name = input.name?.trim() ?? ''
  if (!name) return fail('Name the template.', { name: 'A name is required.' })
  if (name.length > 160) return fail('Names are limited to 160 characters.', { name: 'Too long.' })

  const payload = {
    workspace_id: ctx.workspaceId,
    name,
    description: input.description?.slice(0, 1000) ?? null,
    caption_template: input.captionTemplate?.slice(0, 20_000) ?? null,
    channel: input.channel && (STUDIO_CHANNELS as readonly string[]).includes(input.channel) ? input.channel : null,
    category: input.category && (TEMPLATE_CATEGORIES as readonly string[]).includes(input.category) ? input.category : null,
    platforms: cleanArray(input.platforms, STUDIO_CHANNELS),
    hashtags: cleanArray(input.hashtags, undefined, 40),
    tags: cleanArray(input.tags, undefined, 20),
    post_type: input.postType && (POST_TYPES as readonly string[]).includes(input.postType) ? input.postType : 'post',
  }

  // The cover must be a media asset in this workspace; its stored path is reused.
  let cover: { cover_url: string | null } | Record<string, never> = {}
  if (input.coverAssetId !== undefined) {
    if (!input.coverAssetId) cover = { cover_url: null }
    else {
      const { data: asset } = await supabase.from('media_assets').select('thumbnail_path, file_path, file_type')
        .eq('id', input.coverAssetId).eq('workspace_id', ctx.workspaceId).maybeSingle()
      if (!asset) return fail('That cover image is not part of this workspace.', { cover: 'Choose an image from the media library.' })
      cover = { cover_url: asset.thumbnail_path ?? (asset.file_type === 'image' ? asset.file_path : null) }
    }
  }

  if (input.id) {
    if (!(await ownsRecord(supabase, 'content_templates', input.id, ctx.workspaceId))) {
      return fail('That template is not part of this workspace.')
    }
    const { error: updateError } = await supabase
      .from('content_templates').update({ ...payload, ...cover }).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('saveTemplate/update', updateError)
    revalidateStudio()
    return { ok: true, id: input.id, message: 'Template updated.' }
  }

  const { data: duplicate } = await supabase
    .from('content_templates').select('id')
    .eq('workspace_id', ctx.workspaceId).eq('name', name).is('archived_at', null).maybeSingle()
  if (duplicate) return fail('A template with that name already exists.', { name: 'Already in use.' })

  const { data, error: insertError } = await supabase
    .from('content_templates')
    .insert({ ...payload, ...cover, status: 'draft', owner_id: userId, created_by: userId })
    .select('id').single()
  if (insertError) return dbFail('saveTemplate/insert', insertError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: data.id, action: 'created',
    summary: `created the template “${name}”`, link: `${studioBase(ctx)}/templates?selected=${data.id}`,
  })
  revalidateStudio()
  return { ok: true, id: data.id, message: 'Template created.' }
}

export async function setTemplateStatus(
  input: { id: string; status: string; note?: string },
): Promise<ActionResult> {
  if (!(TEMPLATE_STATUSES as readonly string[]).includes(input.status)) return fail('Unknown status.')

  const needsApproval = input.status === 'approved' || input.status === 'changes_requested'
  const capability: keyof StudioCapabilities = input.status === 'published'
    ? 'publishTemplates' : needsApproval ? 'approveTemplates' : 'editTemplates'

  const { session, error } = await authorise(capability)
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase
    .from('content_templates').select('id, name, status')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That template is not part of this workspace.')

  if (input.status === 'published' && !['approved', 'published'].includes(current.status)) {
    return fail('A template must be approved before it can be published.')
  }

  const patch: Record<string, unknown> = {
    status: input.status, review_note: input.note?.slice(0, 500) ?? null,
  }
  if (input.status === 'approved') {
    patch.brand_approved = true
    patch.approved_by = userId
    patch.approved_at = new Date().toISOString()
  }
  if (input.status === 'changes_requested') patch.brand_approved = false
  if (input.status === 'archived') patch.archived_at = new Date().toISOString()
  if (current.status === 'archived' && input.status !== 'archived') patch.archived_at = null

  const { error: updateError } = await supabase
    .from('content_templates').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('setTemplateStatus', updateError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: input.id, action: input.status,
    summary: `set “${current.name}” to ${input.status.replace('_', ' ')}`,
    link: `${studioBase(ctx)}/templates?selected=${input.id}`,
  })
  revalidateStudio()
  return { ok: true, message: `Template ${input.status.replace('_', ' ')}.` }
}

export async function duplicateTemplate(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('createTemplates')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: source } = await supabase
    .from('content_templates')
    .select('name, description, caption_template, platforms, channel, category, post_type, hashtags, tags, variables')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!source) return fail('That template is not part of this workspace.')

  const { data, error: insertError } = await supabase
    .from('content_templates')
    .insert({
      ...source, workspace_id: ctx.workspaceId,
      name: `${source.name} (copy)`.slice(0, 160),
      // A duplicate always starts unapproved — copying an approval is a forgery.
      status: 'draft', brand_approved: false, usage_count: 0,
      owner_id: userId, created_by: userId,
    })
    .select('id').single()
  if (insertError) return dbFail('duplicateTemplate', insertError)

  revalidateStudio()
  return { ok: true, id: data.id, message: 'Template duplicated.' }
}

export async function toggleTemplateFavourite(
  input: { id: string },
): Promise<ActionResult<{ favourite: boolean }>> {
  const { session, error } = await authorise('viewTemplates')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'content_templates', input.id, ctx.workspaceId))) {
    return fail('That template is not part of this workspace.')
  }

  const { data: existing } = await supabase
    .from('studio_template_favourites').select('template_id')
    .eq('template_id', input.id).eq('user_id', userId).maybeSingle()

  if (existing) {
    await supabase.from('studio_template_favourites').delete()
      .eq('template_id', input.id).eq('user_id', userId)
    revalidateStudio()
    return { ok: true, data: { favourite: false } }
  }

  const { error: insertError } = await supabase.from('studio_template_favourites')
    .insert({ template_id: input.id, user_id: userId, workspace_id: ctx.workspaceId })
  if (insertError) return dbFail('toggleTemplateFavourite', insertError)

  revalidateStudio()
  return { ok: true, data: { favourite: true } }
}

/** Using a template creates a real draft and records the usage for the performance panel. */
export async function useTemplate(
  input: { id: string; campaignId?: string | null; title?: string; variables?: Record<string, string> },
): Promise<ActionResult> {
  const { session, error } = await authorise('createContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: template } = await supabase
    .from('content_templates')
    .select('id, name, caption_template, platforms, channel, hashtags, tags, post_type, status')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!template) return fail('That template is not part of this workspace.')
  if (template.status === 'archived') return fail('Archived templates cannot be used. Restore it first.')

  if (input.campaignId && !(await ownsRecord(supabase, 'campaigns', input.campaignId, ctx.workspaceId))) {
    return fail('That campaign is not part of this workspace.')
  }

  // Fill {{variables}} the caller supplied; leave unknown tokens visible so the
  // user can see what still needs completing rather than shipping a blank.
  let caption = template.caption_template ?? ''
  for (const [key, value] of Object.entries(input.variables ?? {})) {
    caption = caption.replaceAll(`{{${key}}}`, String(value).slice(0, 500))
  }

  const platforms = cleanArray(template.platforms, STUDIO_CHANNELS)
  const resolved = platforms.length ? platforms
    : template.channel && (STUDIO_CHANNELS as readonly string[]).includes(template.channel) ? [template.channel]
      : ['instagram']
  const title = (input.title?.trim() || template.name).slice(0, 200)

  const { data: content, error: insertError } = await supabase
    .from('content_posts')
    .insert({
      workspace_id: ctx.workspaceId,
      title, internal_title: title,
      caption: caption.slice(0, captionLimitFor(resolved)),
      platforms: resolved,
      hashtags: template.hashtags ?? [], tags: template.tags ?? [],
      post_type: template.post_type ?? 'post',
      campaign_id: input.campaignId || null,
      status: 'draft', source: 'template', template_id: template.id,
      owner_id: userId, created_by: userId, updated_by: userId,
    })
    .select('id').single()
  if (insertError) return dbFail('useTemplate', insertError)

  await supabase.from('studio_template_usage').insert({
    workspace_id: ctx.workspaceId, template_id: template.id, content_id: content.id, used_by: userId,
  })

  // usage_count is a denormalised counter recomputed from the usage table,
  // which stays the source of truth for the performance chart.
  const { count } = await supabase
    .from('studio_template_usage').select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId).eq('template_id', template.id)
  await supabase.from('content_templates')
    .update({ usage_count: count ?? 0 }).eq('id', template.id).eq('workspace_id', ctx.workspaceId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'template', entityId: template.id, action: 'used',
    summary: `used the template “${template.name}”`, link: `${studioBase(ctx)}/compose?id=${content.id}`,
  })
  revalidateStudio()
  return { ok: true, id: content.id, message: 'Draft created from template.' }
}
