'use server'

// Studio → Content mutations (Compose, Content Library, Overview composer).

import { studioBase } from '@/lib/studio/paths'
import {
  authorise, cleanArray, dbFail, fail, isValidUrl, logActivity, logAudit,
  ownsRecord, revalidateStudio, scoreContent, type ActionResult,
} from '@/lib/studio/action-helpers'
import { withinLimit, type StudioCapabilities } from '@/lib/studio/entitlements'
import {
  CONTENT_STATUSES, POST_TYPES, STUDIO_CHANNELS,
  canTransitionContent, captionLimitFor, type ContentStatus,
} from '@/lib/studio/constants'

export interface ContentInput {
  id?: string
  title?: string
  internalTitle?: string
  caption?: string
  platforms?: string[]
  hashtags?: string[]
  tags?: string[]
  postType?: string
  tone?: string
  ctaLabel?: string
  ctaUrl?: string
  /** Button style shown on channel previews, e.g. learn_more. */
  ctaButton?: string
  /** Which composer created the draft, so each surface resumes its own work. */
  origin?: 'quick_composer' | 'compose'
  utmEnabled?: boolean
  campaignId?: string | null
  scheduledAt?: string | null
  source?: string
  templateId?: string | null
  ideaId?: string | null
  assetIds?: string[]
}

const CTA_BUTTONS = ['learn_more', 'shop_now', 'sign_up', 'book_now', 'contact_us', 'download']

function validateContent(input: ContentInput): Record<string, string> | null {
  const errors: Record<string, string> = {}
  const title = (input.internalTitle ?? input.title ?? '').trim()
  if (!title) errors.title = 'Give this content an internal title so your team can find it.'
  else if (title.length > 200) errors.title = 'Titles are limited to 200 characters.'

  const platforms = cleanArray(input.platforms, STUDIO_CHANNELS)
  if (platforms.length === 0) errors.platforms = 'Select at least one channel.'

  const caption = input.caption ?? ''
  const limit = captionLimitFor(platforms)
  if (caption.length > limit) {
    errors.caption = `This caption is ${caption.length} characters. The selected channels allow ${limit}.`
  }

  if (input.ctaUrl && !isValidUrl(input.ctaUrl)) errors.ctaUrl = 'Enter a valid http(s) link.'
  if (input.postType && !(POST_TYPES as readonly string[]).includes(input.postType)) {
    errors.postType = 'Unsupported content type.'
  }
  if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) {
    errors.scheduledAt = 'Enter a valid date and time.'
  }

  return Object.keys(errors).length ? errors : null
}

export async function saveContent(input: ContentInput): Promise<ActionResult<{ score: number }>> {
  const { session, error } = await authorise(input.id ? 'editContent' : 'createContent')
  if (!session) return fail(error!)

  const invalid = validateContent(input)
  if (invalid) return fail('Please fix the highlighted fields.', invalid)

  const { supabase, ctx, userId } = session
  const platforms = cleanArray(input.platforms, STUDIO_CHANNELS)
  const hashtags = cleanArray(input.hashtags, undefined, 40).map(h => (h.startsWith('#') ? h : `#${h}`))
  const tags = cleanArray(input.tags, undefined, 20)
  const assetIds = cleanArray(input.assetIds, undefined, 20)
  const caption = (input.caption ?? '').slice(0, 65_000)
  const title = (input.internalTitle ?? input.title ?? '').trim()

  const quality = scoreContent({
    caption, platforms, hashtags, ctaLabel: input.ctaLabel, assetCount: assetIds.length,
  })

  if (input.campaignId && !(await ownsRecord(supabase, 'campaigns', input.campaignId, ctx.workspaceId))) {
    return fail('That campaign is not part of this workspace.')
  }

  const payload = {
    workspace_id: ctx.workspaceId,
    title,
    internal_title: title,
    caption,
    hashtags,
    tags,
    platforms,
    post_type: input.postType && (POST_TYPES as readonly string[]).includes(input.postType) ? input.postType : 'post',
    tone: input.tone?.slice(0, 40) ?? null,
    cta_label: input.ctaLabel?.slice(0, 80) ?? null,
    cta_url: input.ctaUrl?.slice(0, 500) ?? null,
    utm_enabled: Boolean(input.utmEnabled),
    campaign_id: input.campaignId || null,
    template_id: input.templateId || null,
    idea_id: input.ideaId || null,
    source: input.source ?? 'manual',
    quality_score: quality.score,
    quality_checks: quality.checks,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }

  let contentId = input.id

  if (contentId) {
    if (!(await ownsRecord(supabase, 'content_posts', contentId, ctx.workspaceId))) {
      return fail('That content record is not part of this workspace.')
    }

    // Snapshot the previous state before overwriting, so history is never lost.
    const { data: current } = await supabase
      .from('content_posts').select('caption, hashtags, platforms, status, metadata')
      .eq('id', contentId).eq('workspace_id', ctx.workspaceId).single()

    if (current) {
      const { count } = await supabase
        .from('post_versions').select('id', { count: 'exact', head: true })
        .eq('post_id', contentId).eq('workspace_id', ctx.workspaceId)
      await supabase.from('post_versions').insert({
        post_id: contentId, workspace_id: ctx.workspaceId,
        version_number: (count ?? 0) + 1,
        caption: current.caption, hashtags: current.hashtags,
        platforms: current.platforms, status: current.status,
        changed_by: userId, change_note: 'Saved before edit',
      })
    }

    const metadata = { ...((current?.metadata ?? {}) as Record<string, unknown>), ...(input.ctaButton !== undefined ? { cta_button: CTA_BUTTONS.includes(input.ctaButton) ? input.ctaButton : null } : {}) }
    const { error: updateError } = await supabase
      .from('content_posts').update({ ...payload, metadata })
      .eq('id', contentId).eq('workspace_id', ctx.workspaceId)
    if (updateError) return dbFail('saveContent/update', updateError)
  } else {
    const { data, error: insertError } = await supabase
      .from('content_posts')
      .insert({
        ...payload, status: 'draft', owner_id: userId, created_by: userId,
        metadata: { origin: input.origin ?? 'compose', cta_button: input.ctaButton && CTA_BUTTONS.includes(input.ctaButton) ? input.ctaButton : null },
      })
      .select('id').single()
    if (insertError) return dbFail('saveContent/insert', insertError)
    contentId = data.id
  }

  // Re-link attached assets in one deterministic pass, scoped to this workspace
  // so a forged asset id from another workspace can never be attached.
  await supabase.from('studio_content_assets').delete()
    .eq('content_id', contentId).eq('workspace_id', ctx.workspaceId)
  if (assetIds.length) {
    const { data: owned } = await supabase.from('media_assets').select('id')
      .eq('workspace_id', ctx.workspaceId).in('id', assetIds)
    const valid = new Set((owned ?? []).map(a => a.id))
    const links = assetIds
      .filter(id => valid.has(id))
      .map((assetId, position) => ({
        content_id: contentId as string, asset_id: assetId, workspace_id: ctx.workspaceId, position,
      }))
    if (links.length) await supabase.from('studio_content_assets').insert(links)
  }

  if (input.scheduledAt) {
    const result = await scheduleContent({ id: contentId as string, scheduledAt: input.scheduledAt })
    if (!result.ok) return { ...result, id: contentId } as ActionResult<{ score: number }>
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: contentId, action: input.id ? 'updated' : 'created',
    summary: `${input.id ? 'updated' : 'created'} content “${title}”`,
    link: `${studioBase(ctx)}/compose?id=${contentId}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: input.id ? 'studio.content.updated' : 'studio.content.created',
    resourceType: 'content_post', resourceId: contentId,
    metadata: { platforms, quality: quality.score },
  })

  revalidateStudio()
  return { ok: true, id: contentId, message: 'Draft saved.', data: { score: quality.score } }
}

export async function setContentStatus(input: { id: string; status: string }): Promise<ActionResult> {
  if (!(CONTENT_STATUSES as readonly string[]).includes(input.status)) return fail('Unknown status.')
  const target = input.status as ContentStatus

  // Approving, publishing and scheduling are distinct privileges from editing.
  const capability: keyof StudioCapabilities =
    target === 'approved' ? 'approveContent'
      : target === 'published' ? 'publishContent'
        : target === 'scheduled' ? 'scheduleContent'
          : 'editContent'

  const { session, error } = await authorise(capability)
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase
    .from('content_posts').select('id, status, title')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That content record is not part of this workspace.')

  if (!canTransitionContent(current.status as ContentStatus, target)) {
    return fail(`Content cannot move from ${current.status.replace('_', ' ')} to ${target.replace('_', ' ')}.`)
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: target, updated_by: userId, updated_at: now }
  if (target === 'approved') { patch.approved_by = userId; patch.approved_at = now }
  if (target === 'published') patch.published_at = now
  if (target === 'archived') patch.archived_at = now

  const { error: updateError } = await supabase
    .from('content_posts').update(patch).eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('setContentStatus', updateError)

  if (target === 'pending_approval') {
    await supabase.from('approvals').insert({
      workspace_id: ctx.workspaceId, post_id: input.id, requested_by: userId, status: 'pending',
    })
  }
  if (target === 'approved' || target === 'draft') {
    await supabase.from('approvals')
      .update({
        status: target === 'approved' ? 'approved' : 'changes_requested',
        reviewed_by: userId, updated_at: now,
      })
      .eq('post_id', input.id).eq('workspace_id', ctx.workspaceId).eq('status', 'pending')
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: input.id, action: target,
    summary: `moved “${current.title ?? 'Untitled'}” to ${target.replace('_', ' ')}`,
    link: `${studioBase(ctx)}/compose?id=${input.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.content.${target}`, resourceType: 'content_post', resourceId: input.id,
    metadata: { from: current.status, to: target },
  })

  revalidateStudio()
  return { ok: true, id: input.id, message: `Moved to ${target.replace('_', ' ')}.` }
}

export async function scheduleContent(input: { id: string; scheduledAt: string }): Promise<ActionResult> {
  const { session, error } = await authorise('scheduleContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const at = Date.parse(input.scheduledAt)
  if (Number.isNaN(at)) return fail('Enter a valid date and time.', { scheduledAt: 'Invalid date.' })
  if (at < Date.now() - 60_000) {
    return fail('Choose a time in the future.', { scheduledAt: 'This time has already passed.' })
  }

  const { data: current } = await supabase
    .from('content_posts').select('id, status, title')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That content record is not part of this workspace.')

  // Plan gate: scheduled posts are metered per calendar month.
  if (session.limits.scheduledPostsMonthly >= 0) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('content_posts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).eq('status', 'scheduled')
      .gte('updated_at', monthStart.toISOString())
    if (!withinLimit(count ?? 0, session.limits.scheduledPostsMonthly)) {
      return fail(`This plan includes ${session.limits.scheduledPostsMonthly} scheduled posts a month. Upgrade to schedule more.`)
    }
  }

  const { error: updateError } = await supabase
    .from('content_posts')
    .update({
      scheduled_at: new Date(at).toISOString(), status: 'scheduled',
      updated_by: userId, updated_at: new Date().toISOString(),
    })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('scheduleContent', updateError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: input.id, action: 'scheduled',
    summary: `scheduled “${current.title ?? 'Untitled'}”`,
    link: `${studioBase(ctx)}/compose?id=${input.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.content.scheduled', resourceType: 'content_post', resourceId: input.id,
    metadata: { scheduled_at: new Date(at).toISOString() },
  })

  revalidateStudio()
  return { ok: true, id: input.id, message: 'Scheduled.' }
}

export async function archiveContent(input: { id: string; restore?: boolean }): Promise<ActionResult> {
  const { session, error } = await authorise('editContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'content_posts', input.id, ctx.workspaceId))) {
    return fail('That content record is not part of this workspace.')
  }

  const { error: updateError } = await supabase
    .from('content_posts')
    .update({
      archived_at: input.restore ? null : new Date().toISOString(),
      status: input.restore ? 'draft' : 'archived',
      updated_by: userId,
    })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('archiveContent', updateError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: input.restore ? 'studio.content.restored' : 'studio.content.archived',
    resourceType: 'content_post', resourceId: input.id,
  })
  revalidateStudio()
  return { ok: true, message: input.restore ? 'Restored.' : 'Archived.' }
}

export async function deleteContent(input: { id: string }): Promise<ActionResult> {
  const { session, error } = await authorise('deleteContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: current } = await supabase
    .from('content_posts').select('id, title, status')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('That content record is not part of this workspace.')
  if (current.status === 'published') {
    return fail('Published content cannot be deleted. Archive it instead so the record is preserved.')
  }

  const { error: deleteError } = await supabase
    .from('content_posts').delete().eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return dbFail('deleteContent', deleteError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.content.deleted', resourceType: 'content_post', resourceId: input.id,
    metadata: { title: current.title },
  })
  revalidateStudio()
  return { ok: true, message: 'Deleted.' }
}

export async function bulkContentAction(
  input: { ids: string[]; action: 'archive' | 'restore' | 'status'; status?: string },
): Promise<ActionResult<{ affected: number }>> {
  const capability: keyof StudioCapabilities =
    input.action === 'status' && input.status === 'approved' ? 'approveContent' : 'editContent'
  const { session, error } = await authorise(capability)
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const ids = cleanArray(input.ids, undefined, 200)
  if (ids.length === 0) return fail('Select at least one record.')

  // Scope the id list to this workspace before mutating anything: a bulk action
  // must never touch a record the selection could not legitimately contain.
  const { data: owned } = await supabase
    .from('content_posts').select('id, status').eq('workspace_id', ctx.workspaceId).in('id', ids)
  const ownedIds = (owned ?? []).map(r => r.id)
  if (ownedIds.length === 0) return fail('None of the selected records are in this workspace.')

  let patch: Record<string, unknown>
  if (input.action === 'archive') {
    patch = { archived_at: new Date().toISOString(), status: 'archived' }
  } else if (input.action === 'restore') {
    patch = { archived_at: null, status: 'draft' }
  } else {
    if (!input.status || !(CONTENT_STATUSES as readonly string[]).includes(input.status)) {
      return fail('Unknown status.')
    }
    const target = input.status as ContentStatus
    const blocked = (owned ?? []).filter(r => !canTransitionContent(r.status as ContentStatus, target))
    if (blocked.length) {
      return fail(`${blocked.length} of the selected records cannot move to ${target.replace('_', ' ')}.`)
    }
    patch = { status: target }
  }

  const { error: updateError } = await supabase
    .from('content_posts').update({ ...patch, updated_by: userId })
    .eq('workspace_id', ctx.workspaceId).in('id', ownedIds)
  if (updateError) return dbFail('bulkContentAction', updateError)

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.content.bulk_${input.action}`, resourceType: 'content_post',
    metadata: { count: ownedIds.length, status: input.status ?? null },
  })
  revalidateStudio()
  return { ok: true, message: `${ownedIds.length} updated.`, data: { affected: ownedIds.length } }
}

export async function restoreContentVersion(
  input: { id: string; versionId: string },
): Promise<ActionResult> {
  const { session, error } = await authorise('editContent')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const { data: version } = await supabase
    .from('post_versions').select('id, post_id, caption, hashtags, platforms, version_number')
    .eq('id', input.versionId).eq('workspace_id', ctx.workspaceId).eq('post_id', input.id).maybeSingle()
  if (!version) return fail('That version does not belong to this record.')

  const { error: updateError } = await supabase
    .from('content_posts')
    .update({
      caption: version.caption, hashtags: version.hashtags, platforms: version.platforms,
      updated_by: userId, updated_at: new Date().toISOString(),
    })
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return dbFail('restoreContentVersion', updateError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: input.id, action: 'version_restored',
    summary: `restored version ${version.version_number}`,
    link: `${studioBase(ctx)}/compose?id=${input.id}`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.content.version_restored', resourceType: 'content_post', resourceId: input.id,
    metadata: { version: version.version_number },
  })
  revalidateStudio()
  return { ok: true, message: `Version ${version.version_number} restored.` }
}

export async function addContentComment(
  input: { id: string; body: string; parentId?: string },
): Promise<ActionResult> {
  const { session, error } = await authorise('view')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const body = input.body.trim()
  if (!body) return fail('Write a comment first.', { body: 'A comment cannot be empty.' })
  if (body.length > 4000) return fail('Comments are limited to 4000 characters.', { body: 'Too long.' })
  if (!(await ownsRecord(supabase, 'content_posts', input.id, ctx.workspaceId))) {
    return fail('That content record is not part of this workspace.')
  }

  const { error: insertError } = await supabase.from('post_comments').insert({
    post_id: input.id, workspace_id: ctx.workspaceId, user_id: userId,
    body, parent_id: input.parentId ?? null,
  })
  if (insertError) return dbFail('addContentComment', insertError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: input.id, action: 'commented',
    summary: 'commented on a draft', link: `${studioBase(ctx)}/compose?id=${input.id}`,
  })
  revalidateStudio()
  return { ok: true, message: 'Comment added.' }
}

export async function repurposeContent(
  input: { id: string; channels: string[]; tone?: string },
): Promise<ActionResult<{ created: number }>> {
  const { session, error } = await authorise('repurpose')
  if (!session) return fail(error!)
  const { supabase, ctx, userId } = session

  const channels = cleanArray(input.channels, STUDIO_CHANNELS, 8)
  if (channels.length === 0) return fail('Choose at least one target channel.')

  const { data: source } = await supabase
    .from('content_posts').select('id, title, caption, hashtags, tags, campaign_id, brand_id, post_type')
    .eq('id', input.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!source) return fail('That content record is not part of this workspace.')

  const rows = channels.map(channel => ({
    workspace_id: ctx.workspaceId,
    title: `${source.title ?? 'Untitled'} — ${channel}`.slice(0, 200),
    internal_title: `${source.title ?? 'Untitled'} — ${channel}`.slice(0, 200),
    // Each variant is truncated to its own channel's limit rather than the
    // narrowest one, so a long-form LinkedIn variant is not cut to X's 280.
    caption: (source.caption ?? '').slice(0, captionLimitFor([channel])),
    hashtags: source.hashtags,
    tags: source.tags,
    platforms: [channel],
    post_type: source.post_type,
    campaign_id: source.campaign_id,
    brand_id: source.brand_id,
    tone: input.tone?.slice(0, 40) ?? null,
    status: 'draft', source: 'repurpose', repurposed_from: source.id,
    owner_id: userId, created_by: userId, updated_by: userId,
  }))

  const { data, error: insertError } = await supabase.from('content_posts').insert(rows).select('id')
  if (insertError) return dbFail('repurposeContent', insertError)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'content', entityId: source.id, action: 'repurposed',
    summary: `repurposed “${source.title ?? 'Untitled'}” into ${channels.length} channel drafts`,
    link: `${studioBase(ctx)}/content`,
  })
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: 'studio.content.repurposed', resourceType: 'content_post', resourceId: source.id,
    metadata: { channels, created: data?.length ?? 0 },
  })
  revalidateStudio()
  return { ok: true, message: `${data?.length ?? 0} drafts created.`, data: { created: data?.length ?? 0 } }
}

/**
 * Places content in the workspace publishing queue. "Top" takes the next slot
 * (15 minutes from now); "bottom" goes one hour after the last scheduled post.
 * The slot is computed server-side from real scheduled times, then scheduled
 * through the same gated path as a manual schedule.
 */
export async function queueContent(input: { id: string; position: 'top' | 'bottom' }): Promise<ActionResult> {
  const { session, error } = await authorise('scheduleContent')
  if (!session) return fail(error!)
  const { supabase, ctx } = session
  if (!(await ownsRecord(supabase, 'content_posts', input.id, ctx.workspaceId))) {
    return fail('That content record is not part of this workspace.')
  }
  let slot = Date.now() + 15 * 60_000
  if (input.position === 'bottom') {
    const { data: last } = await supabase.from('content_posts').select('scheduled_at')
      .eq('workspace_id', ctx.workspaceId).eq('status', 'scheduled').neq('id', input.id)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: false }).limit(1).maybeSingle()
    slot = Math.max(Date.now() + 60 * 60_000, last?.scheduled_at ? new Date(last.scheduled_at).getTime() + 60 * 60_000 : 0)
  }
  const result = await scheduleContent({ id: input.id, scheduledAt: new Date(slot).toISOString() })
  if (!result.ok) return result
  return { ok: true, id: input.id, message: `Added to the ${input.position === 'top' ? 'top' : 'end'} of the queue.` }
}
