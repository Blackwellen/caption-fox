'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { PERMISSIONS } from '@/lib/permissions'
import { assertCapability, assertOwnedRecord, checkSocialRateLimit, getSocialSession, logSocialActivity, type SocialSession } from './server'
import { canAccessSocialCapability, canAccessSocialSurface, connectionCanAct, type SocialSurface } from './entitlements'
import { capabilitiesFor, validateDraft } from './providers'
import { slaStateFor } from './metrics'
import type { SocialProvider } from '@/types/social'

export interface ActionResult<T = undefined> {
  ok: boolean
  message: string
  /** Safe support reference shown in error states; never leaks internals. */
  reference?: string
  data?: T
}

function fail<T = undefined>(message: string): ActionResult<T> {
  return { ok: false, message, reference: randomUUID().slice(0, 8) }
}

/**
 * Every action resolves the session server-side and then checks that the
 * surface it belongs to is open for this workspace (type, plan, flag, role)
 * before any capability check — so a hidden area cannot be driven by calling
 * the action directly.
 */
async function run<T>(surface: SocialSurface, fn: (session: SocialSession) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const session = await getSocialSession()
    const open = canAccessSocialSurface(session.ctx, surface)
    if (!open.allowed) return fail<T>(open.message)
    return await fn(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return fail<T>(message)
  }
}

/** Every Social page and detail route sits under one layout per workspace type. */
function revalidateSocial(session: SocialSession) {
  revalidatePath(session.basePath, 'layout')
}

// ── Publishing ───────────────────────────────────────────────────────────────

/**
 * One queue row per channel, keyed idempotently (post · channel · time) so a
 * double submit, a retry or approving twice can never create two deliveries.
 * Channels default to the post's own channel plus one workspace channel for
 * each platform the post lists.
 */
async function queueDeliveries(session: SocialSession, postId: string, scheduledAt: string, channelIds?: string[]) {
  let ids = channelIds
  if (!ids) {
    const [{ data: post }, { data: channels }] = await Promise.all([
      session.supabase.from('content_posts')
        .select('channel_id, platforms').eq('id', postId).eq('workspace_id', session.ctx.workspaceId).maybeSingle(),
      session.supabase.from('social_channels')
        .select('id, platform').eq('workspace_id', session.ctx.workspaceId).eq('is_active', true),
    ])
    const byPlatform = new Map<string, string>()
    for (const channel of channels ?? []) if (!byPlatform.has(channel.platform)) byPlatform.set(channel.platform, channel.id)
    const own = channels?.find(channel => channel.id === post?.channel_id)
    ids = [...new Set([
      own?.id,
      ...((post?.platforms ?? []) as string[]).filter(platform => platform !== own?.platform).map(platform => byPlatform.get(platform)),
    ].filter((id): id is string => Boolean(id)))]
  }
  if (ids.length === 0) return
  const when = new Date(scheduledAt).toISOString()
  await session.supabase.from('publishing_queue').upsert(
    ids.map(channelId => ({
      workspace_id: session.ctx.workspaceId,
      post_id: postId,
      channel_id: channelId,
      scheduled_at: when,
      status: 'queued',
      idempotency_key: `${postId}:${channelId}:${when}`,
    })),
    { onConflict: 'idempotency_key', ignoreDuplicates: true },
  )
}


async function loadChannels(session: SocialSession, ids: string[]) {
  if (ids.length === 0) return []
  const { data } = await session.supabase
    .from('social_channels')
    .select('id, platform, health, account_name, permission_mode')
    .eq('workspace_id', session.ctx.workspaceId)
    .in('id', ids)
  return (data ?? []) as { id: string; platform: SocialProvider; health: string; account_name: string; permission_mode: string }[]
}

export async function schedulePost(input: {
  postId?: string
  title: string
  caption: string
  channelIds: string[]
  postType: string
  scheduledAt: string | null
  campaignId?: string | null
  mediaUrls?: string[]
  hashtags?: string[]
  timezone?: string
  requireApproval?: boolean
}): Promise<ActionResult<{ postId: string }>> {
  return run('publishing', async session => {
    assertCapability(session, input.postId ? PERMISSIONS.SOCIAL_PUBLISHING_EDIT : PERMISSIONS.SOCIAL_PUBLISHING_CREATE)

    if (input.channelIds.length === 0) return fail<{ postId: string }>('Select at least one channel.')
    const channels = await loadChannels(session, input.channelIds)
    if (channels.length !== input.channelIds.length) {
      return fail<{ postId: string }>('One or more channels are not available in this workspace.')
    }

    // Media must come from this workspace's own library (or already be on the
    // post being edited); a campaign must belong to this workspace.
    const mediaUrls = [...new Set(input.mediaUrls ?? [])].slice(0, 20)
    if (mediaUrls.length) {
      const [{ data: library }, { data: existing }] = await Promise.all([
        session.supabase.from('media_assets').select('file_path')
          .eq('workspace_id', session.ctx.workspaceId).in('file_path', mediaUrls),
        input.postId
          ? session.supabase.from('content_posts').select('media_urls').eq('workspace_id', session.ctx.workspaceId).eq('id', input.postId).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      const allowed = new Set([...(library ?? []).map(row => row.file_path as string), ...((existing?.media_urls ?? []) as string[])])
      if (mediaUrls.some(url => !allowed.has(url))) return fail<{ postId: string }>('Attach media from your Brand & Assets library.')
    }
    if (input.campaignId) {
      const { data: campaign } = await session.supabase.from('campaigns').select('id')
        .eq('workspace_id', session.ctx.workspaceId).eq('id', input.campaignId).maybeSingle()
      if (!campaign) return fail<{ postId: string }>('That campaign is not available in this workspace.')
    }
    if (input.title.length > 200 || input.caption.length > 70_000) return fail<{ postId: string }>('The title or caption is too long.')
    if (input.scheduledAt && Number.isNaN(new Date(input.scheduledAt).getTime())) return fail<{ postId: string }>('Choose a valid date and time.')

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null
    const issues = channels.flatMap(channel => validateDraft(channel.platform, {
      caption: input.caption,
      mediaCount: mediaUrls.length,
      hashtagCount: input.hashtags?.length ?? 0,
      postType: input.postType as never,
      scheduledAt,
    }))
    const blocked = channels.filter(channel => !connectionCanAct(channel.health as never))
    if (blocked.length) {
      return fail<{ postId: string }>(`${blocked.map(channel => channel.account_name).join(', ')} cannot publish until the connection is repaired.`)
    }
    const readOnly = channels.filter(channel => channel.permission_mode === 'read_only')
    if (readOnly.length) {
      return fail<{ postId: string }>(`${readOnly.map(channel => channel.account_name).join(', ')} is connected read-only. Reconnect with publishing permission first.`)
    }
    // A draft may be incomplete (e.g. media still to add); everything is enforced
    // once it is scheduled or sent for approval.
    const blocking = scheduledAt || input.requireApproval ? issues : issues.filter(issue => issue.field !== 'media')
    if (blocking.length) {
      return fail<{ postId: string }>(blocking.map(issue => `${issue.provider}: ${issue.message}`).join(' '))
    }

    const status = input.requireApproval ? 'pending_approval' : scheduledAt ? 'scheduled' : 'draft'
    const payload = {
      workspace_id: session.ctx.workspaceId,
      title: input.title || null,
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      platforms: [...new Set(channels.map(channel => channel.platform))],
      channel_id: channels[0].id,
      campaign_id: input.campaignId ?? null,
      post_type: input.postType,
      status,
      scheduled_at: scheduledAt?.toISOString() ?? null,
      media_urls: mediaUrls,
      approval_required: Boolean(input.requireApproval),
      timezone: input.timezone ?? 'UTC',
      owner_id: session.userId,
      updated_at: new Date().toISOString(),
    }

    let postId = input.postId
    if (postId) {
      await assertOwnedRecord(session, 'content_posts', postId)
      const { error } = await session.supabase.from('content_posts').update(payload).eq('id', postId)
        .eq('workspace_id', session.ctx.workspaceId)
      if (error) return fail<{ postId: string }>('The post could not be saved.')
    } else {
      const { data, error } = await session.supabase.from('content_posts')
        .insert({ ...payload, created_by: session.userId }).select('id').single()
      if (error || !data) return fail<{ postId: string }>('The post could not be created.')
      postId = data.id
    }

    // One queue row per channel, keyed idempotently so a double submit cannot
    // create two deliveries for the same post and channel.
    if (scheduledAt && status === 'scheduled') {
      await session.supabase.from('publishing_queue')
        .delete().eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).eq('status', 'queued')
      await queueDeliveries(session, postId!, scheduledAt.toISOString(), channels.map(channel => channel.id))
    }

    await logSocialActivity(session, {
      action: input.postId ? 'social.post.updated' : 'social.post.created',
      entityType: 'content_post',
      entityId: postId,
      summary: `${input.postId ? 'Updated' : 'Created'} “${input.title || 'Untitled post'}” for ${channels.map(channel => channel.account_name).join(', ')}`,
      detail: scheduledAt ? `Scheduled for ${scheduledAt.toISOString()}` : 'Saved as a draft',
      href: `${session.basePath}/posts/${postId}`,
      severity: 'success',
    })

    revalidateSocial(session)
    return { ok: true, message: scheduledAt ? 'Post scheduled.' : 'Draft saved.', data: { postId: postId! } }
  })
}

export async function reschedulePost(postId: string, scheduledAt: string): Promise<ActionResult> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_EDIT)
    await assertOwnedRecord(session, 'content_posts', postId)

    const { data: post } = await session.supabase.from('content_posts')
      .select('id, title, status, platforms').eq('id', postId)
      .eq('workspace_id', session.ctx.workspaceId).single()
    if (!post) return fail('That post is not available.')
    if (['published', 'publishing', 'cancelled'].includes(post.status)) {
      return fail('A post that is publishing or already published cannot be rescheduled.')
    }

    const when = new Date(scheduledAt)
    if (Number.isNaN(when.getTime())) return fail('Choose a valid date and time.')
    if (when.getTime() < Date.now() + 5 * 60_000) return fail('Choose a time at least 5 minutes from now.')
    const unsupported = (post.platforms ?? []).filter(
      (platform: string) => !capabilitiesFor(platform as SocialProvider).schedulePost)
    if (unsupported.length) return fail(`${unsupported.join(', ')} does not support scheduling.`)

    const { error } = await session.supabase.from('content_posts')
      .update({ scheduled_at: when.toISOString(), status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', postId).eq('workspace_id', session.ctx.workspaceId)
    if (error) return fail('The new time could not be saved.')

    await session.supabase.from('publishing_queue')
      .update({ scheduled_at: when.toISOString(), status: 'queued' })
      .eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).in('status', ['queued', 'failed'])

    await logSocialActivity(session, {
      action: 'social.post.rescheduled', entityType: 'content_post', entityId: postId,
      summary: `Rescheduled “${post.title ?? 'Untitled post'}”`,
      detail: `New time ${when.toISOString()}`,
      href: `${session.basePath}/posts/${postId}`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Post rescheduled.' }
  })
}

export async function setApprovalDecision(
  postId: string,
  decision: 'approve' | 'request_changes' | 'reject',
  note?: string,
): Promise<ActionResult> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_APPROVE)
    await assertOwnedRecord(session, 'content_posts', postId)

    const { data: post } = await session.supabase.from('content_posts')
      .select('id, title, status, scheduled_at').eq('id', postId)
      .eq('workspace_id', session.ctx.workspaceId).single()
    if (!post) return fail('That post is not available.')
    if (decision === 'reject' && !note?.trim()) return fail('Add a short reason so the author knows what to change.')
    if (post.status !== 'pending_approval') return fail('That post is not awaiting approval.')

    const status = decision === 'approve' ? (post.scheduled_at ? 'scheduled' : 'approved') : 'draft'
    await session.supabase.from('content_posts').update({
      status,
      approved_by: decision === 'approve' ? session.userId : null,
      approved_at: decision === 'approve' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', postId).eq('workspace_id', session.ctx.workspaceId)

    if (decision === 'approve' && post.scheduled_at) {
      await session.supabase.from('publishing_queue').update({ status: 'queued' })
        .eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).eq('status', 'skipped')
      await queueDeliveries(session, postId, post.scheduled_at)
    }

    await logSocialActivity(session, {
      action: `social.post.${decision}`, entityType: 'content_post', entityId: postId,
      summary: `${decision === 'approve' ? 'Approved' : decision === 'reject' ? 'Rejected' : 'Requested changes on'} “${post.title ?? 'Untitled post'}”`,
      detail: note ?? null,
      href: `${session.basePath}/posts/${postId}`,
      severity: decision === 'approve' ? 'success' : 'warning',
    })
    revalidateSocial(session)
    return { ok: true, message: decision === 'approve' ? 'Post approved.' : 'Feedback recorded.' }
  })
}

export async function cancelScheduledPost(postId: string): Promise<ActionResult> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_CANCEL)
    await assertOwnedRecord(session, 'content_posts', postId)

    const { data: post } = await session.supabase.from('content_posts')
      .select('id, title, status').eq('id', postId).eq('workspace_id', session.ctx.workspaceId).single()
    if (!post) return fail('That post is not available.')
    if (['published', 'publishing'].includes(post.status)) {
      return fail('A post that has already reached the provider cannot be cancelled here.')
    }

    await session.supabase.from('content_posts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', postId).eq('workspace_id', session.ctx.workspaceId)
    await session.supabase.from('publishing_queue')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).in('status', ['queued', 'failed'])

    await logSocialActivity(session, {
      action: 'social.post.cancelled', entityType: 'content_post', entityId: postId,
      summary: `Cancelled “${post.title ?? 'Untitled post'}”`, severity: 'warning',
      href: `${session.basePath}/publishing`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Scheduled post cancelled.' }
  })
}

/** Retries only the channels that failed — successful channels are never re-sent. */
export async function retryFailedDeliveries(postId: string): Promise<ActionResult> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_PUBLISH)
    await assertOwnedRecord(session, 'content_posts', postId)

    const { data: rows } = await session.supabase.from('publishing_queue')
      .select('id, attempt_count, max_attempts')
      .eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).eq('status', 'failed')
    const retryable = (rows ?? []).filter(row => row.attempt_count < row.max_attempts)
    if (retryable.length === 0) return fail('There are no retryable failures on this post.')

    await session.supabase.from('publishing_queue')
      .update({ status: 'queued', next_attempt_at: new Date().toISOString(), failure_type: null, error_message: null })
      .in('id', retryable.map(row => row.id)).eq('workspace_id', session.ctx.workspaceId)

    await logSocialActivity(session, {
      action: 'social.post.retried', entityType: 'content_post', entityId: postId,
      summary: `Requeued ${retryable.length} failed ${retryable.length === 1 ? 'delivery' : 'deliveries'}`,
      href: `${session.basePath}/publishing?view=queue`,
    })
    revalidateSocial(session)
    return { ok: true, message: `${retryable.length} delivery requeued.` }
  })
}

// ── Engagement ───────────────────────────────────────────────────────────────

export async function sendReply(input: {
  conversationId: string
  body: string
  mode: 'reply' | 'note' | 'internal_comment' | 'dm'
  sentiment?: string
  tags?: string[]
}): Promise<ActionResult> {
  return run('engagement', async session => {
    const isNote = input.mode === 'note' || input.mode === 'internal_comment'
    assertCapability(session, isNote ? PERMISSIONS.SOCIAL_ENGAGEMENT_VIEW : PERMISSIONS.SOCIAL_ENGAGEMENT_REPLY)
    if (!input.body.trim()) return fail('Write something before sending.')

    const { data: thread } = await session.supabase.from('inbox_threads')
      .select('id, type, platform, channel_id, sender_name, created_at, first_response_at, sla_target_minutes')
      .eq('workspace_id', session.ctx.workspaceId).eq('id', input.conversationId).maybeSingle()
    if (!thread) return fail('That conversation is not available in this workspace.')

    if (!isNote) {
      const provider = thread.platform as SocialProvider | null
      if (provider) {
        const caps = capabilitiesFor(provider)
        const supported = input.mode === 'dm' ? caps.sendDirectMessages : caps.replyToComments
        if (!supported) return fail(`${provider} does not support sending ${input.mode === 'dm' ? 'direct messages' : 'replies'} through the API.`)
      }
    }

    // Outbound replies start as pending; the delivery worker flips them to sent
    // only once the provider confirms, so nothing is shown as sent optimistically.
    const { error } = await session.supabase.from('inbox_messages').insert({
      workspace_id: session.ctx.workspaceId,
      thread_id: input.conversationId,
      content: input.body.trim(),
      sender_type: 'internal',
      sent_by: session.userId,
      is_internal_note: isNote,
      delivery_status: isNote ? 'sent' : 'pending',
    })
    if (error) return fail('The message could not be saved.')

    if (!isNote) {
      const firstResponseAt = thread.first_response_at ?? new Date().toISOString()
      await session.supabase.from('inbox_threads').update({
        status: 'assigned',
        is_read: true,
        first_response_at: firstResponseAt,
        sla_state: slaStateFor({
          createdAt: thread.created_at,
          firstResponseAt,
          targetMinutes: thread.sla_target_minutes,
        }),
        ...(input.sentiment ? { sentiment: input.sentiment, sentiment_source: 'manual', sentiment_overridden_by: session.userId, sentiment_overridden_at: new Date().toISOString() } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', input.conversationId).eq('workspace_id', session.ctx.workspaceId)
    }

    await logSocialActivity(session, {
      action: isNote ? 'social.conversation.note_added' : 'social.conversation.replied',
      entityType: 'inbox_thread', entityId: input.conversationId, channelId: thread.channel_id,
      summary: `${isNote ? 'Added an internal note on' : 'Replied to'} ${thread.sender_name ?? 'a conversation'}`,
      href: `${session.basePath}/conversations/${input.conversationId}`,
      severity: 'success',
    })
    revalidateSocial(session)
    return { ok: true, message: isNote ? 'Note added.' : 'Reply queued for delivery.' }
  })
}

export async function assignConversation(conversationId: string, assigneeId: string | null): Promise<ActionResult> {
  return run('engagement', async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_ENGAGEMENT_ASSIGN)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'inbox_threads', conversationId)

    if (assigneeId) {
      const { data: member } = await session.supabase.from('workspace_members')
        .select('user_id').eq('workspace_id', session.ctx.workspaceId).eq('user_id', assigneeId).maybeSingle()
      if (!member) return fail('That person is not a member of this workspace.')
    }

    await session.supabase.from('inbox_threads')
      .update({ assigned_to: assigneeId, status: assigneeId ? 'assigned' : 'open', updated_at: new Date().toISOString() })
      .eq('id', conversationId).eq('workspace_id', session.ctx.workspaceId)

    await logSocialActivity(session, {
      action: 'social.conversation.assigned', entityType: 'inbox_thread', entityId: conversationId,
      summary: assigneeId ? 'Assigned a conversation' : 'Unassigned a conversation',
      href: `${session.basePath}/conversations/${conversationId}`,
    })
    revalidateSocial(session)
    return { ok: true, message: assigneeId ? 'Conversation assigned.' : 'Conversation unassigned.' }
  })
}

export async function updateConversation(input: {
  conversationId: string
  status?: 'open' | 'resolved' | 'spam' | 'done'
  isRead?: boolean
  isFlagged?: boolean
  flagReason?: string | null
  tags?: string[]
  sentiment?: 'positive' | 'neutral' | 'negative'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}): Promise<ActionResult> {
  return run('engagement', async session => {
    if (input.status === 'resolved' || input.status === 'done') {
      assertCapability(session, PERMISSIONS.SOCIAL_ENGAGEMENT_RESOLVE)
    } else if (input.isFlagged !== undefined || input.status === 'spam') {
      assertCapability(session, PERMISSIONS.SOCIAL_ENGAGEMENT_MODERATE)
    } else {
      assertCapability(session, PERMISSIONS.SOCIAL_ENGAGEMENT_VIEW)
    }
    await assertOwnedRecord(session, 'inbox_threads', input.conversationId)

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.status) {
      patch.status = input.status
      patch.resolved_at = input.status === 'resolved' || input.status === 'done' ? new Date().toISOString() : null
    }
    if (input.isRead !== undefined) patch.is_read = input.isRead
    if (input.isFlagged !== undefined) {
      patch.is_flagged = input.isFlagged
      patch.flag_reason = input.isFlagged ? (input.flagReason ?? 'Flagged for review') : null
    }
    if (input.tags) patch.tags = input.tags
    if (input.priority) patch.priority = input.priority
    if (input.sentiment) {
      patch.sentiment = input.sentiment
      patch.sentiment_source = 'manual'
      patch.sentiment_overridden_by = session.userId
      patch.sentiment_overridden_at = new Date().toISOString()
    }

    const { error } = await session.supabase.from('inbox_threads')
      .update(patch).eq('id', input.conversationId).eq('workspace_id', session.ctx.workspaceId)
    if (error) return fail('The conversation could not be updated.')

    await logSocialActivity(session, {
      action: 'social.conversation.updated', entityType: 'inbox_thread', entityId: input.conversationId,
      summary: input.status === 'resolved' ? 'Resolved a conversation'
        : input.isFlagged ? 'Flagged a conversation for review'
        : 'Updated a conversation',
      href: `${session.basePath}/conversations/${input.conversationId}`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Conversation updated.' }
  })
}

// ── Listening ────────────────────────────────────────────────────────────────

export async function updateMention(input: {
  mentionId: string
  isStarred?: boolean
  isRead?: boolean
  isActioned?: boolean
}): Promise<ActionResult> {
  return run('listening', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_LISTENING_VIEW)
    await assertOwnedRecord(session, 'brand_mentions', input.mentionId)
    const patch: Record<string, unknown> = {}
    if (input.isStarred !== undefined) patch.is_starred = input.isStarred
    if (input.isRead !== undefined) patch.is_read = input.isRead
    if (input.isActioned !== undefined) patch.is_actioned = input.isActioned
    if (Object.keys(patch).length === 0) return fail('Nothing to update.')

    const { error } = await session.supabase.from('brand_mentions')
      .update(patch).eq('id', input.mentionId).eq('workspace_id', session.ctx.workspaceId)
    if (error) return fail('The mention could not be updated.')
    revalidateSocial(session)
    return { ok: true, message: 'Mention updated.' }
  })
}

export async function createAlertRule(input: {
  name: string
  keywords: string[]
  topics?: string[]
  channels?: string[]
  sources?: string[]
  sentiments?: string[]
  volumeThreshold?: number | null
  reachThreshold?: number | null
  influencerThreshold?: number | null
  geography?: string[]
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly'
  recipients: string[]
  severity: 'low' | 'medium' | 'high'
  activeFrom?: string | null
  activeTo?: string | null
}): Promise<ActionResult<{ id: string }>> {
  return run('listening', async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_LISTENING_CREATE_ALERT)
    if (!access.allowed) return fail<{ id: string }>(access.message)
    if (!input.name.trim()) return fail<{ id: string }>('Give the alert a name.')
    if (input.keywords.length === 0 && (input.topics?.length ?? 0) === 0) {
      return fail<{ id: string }>('Add at least one keyword or topic.')
    }
    const invalid = input.recipients.filter(email => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    if (invalid.length) return fail<{ id: string }>(`Check these recipients: ${invalid.join(', ')}`)

    const { data, error } = await session.supabase.from('listening_alert_rules').insert({
      workspace_id: session.ctx.workspaceId,
      name: input.name.trim(),
      keywords: input.keywords,
      topics: input.topics ?? [],
      channels: input.channels ?? [],
      sources: input.sources ?? [],
      sentiments: input.sentiments ?? [],
      volume_threshold: input.volumeThreshold ?? null,
      reach_threshold: input.reachThreshold ?? null,
      influencer_threshold: input.influencerThreshold ?? null,
      geography: input.geography ?? [],
      frequency: input.frequency,
      recipients: input.recipients,
      severity: input.severity,
      active_from: input.activeFrom ?? null,
      active_to: input.activeTo ?? null,
      created_by: session.userId,
    }).select('id').single()
    if (error || !data) return fail<{ id: string }>('The alert could not be created.')

    await logSocialActivity(session, {
      action: 'social.listening.alert_created', entityType: 'listening_alert_rule', entityId: data.id,
      summary: `Created listening alert “${input.name.trim()}”`,
      detail: `${input.keywords.length} keyword${input.keywords.length === 1 ? '' : 's'}, ${input.frequency} delivery`,
      href: `${session.basePath}/listening`, severity: 'success',
    })
    revalidateSocial(session)
    return { ok: true, message: 'Alert created.', data: { id: data.id } }
  })
}

export async function setAlertRuleActive(ruleId: string, isActive: boolean): Promise<ActionResult> {
  return run('listening', async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_LISTENING_MANAGE_ALERT)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'listening_alert_rules', ruleId)
    await session.supabase.from('listening_alert_rules')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', ruleId).eq('workspace_id', session.ctx.workspaceId)
    revalidateSocial(session)
    return { ok: true, message: isActive ? 'Alert enabled.' : 'Alert paused.' }
  })
}

export async function resolveListeningAlert(alertId: string): Promise<ActionResult> {
  return run('listening', async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_LISTENING_MANAGE_ALERT)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'listening_alerts', alertId)
    await session.supabase.from('listening_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), is_read: true })
      .eq('id', alertId).eq('workspace_id', session.ctx.workspaceId)
    revalidateSocial(session)
    return { ok: true, message: 'Alert resolved.' }
  })
}

// ── Connections ──────────────────────────────────────────────────────────────

export async function syncChannelNow(channelId: string): Promise<ActionResult> {
  return run('connections', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_CONNECTIONS_SYNC)
    await assertOwnedRecord(session, 'social_channels', channelId)

    const { data: running } = await session.supabase.from('social_sync_runs')
      .select('id').eq('workspace_id', session.ctx.workspaceId)
      .eq('channel_id', channelId).eq('status', 'running').maybeSingle()
    if (running) return fail('A sync is already running for this channel.')
    const limited = await checkSocialRateLimit(session, 'social.connection.sync_started', 10, 10 * 60_000)
    if (limited) return fail(limited)

    const { data: run, error } = await session.supabase.from('social_sync_runs').insert({
      workspace_id: session.ctx.workspaceId,
      channel_id: channelId,
      kind: 'incremental',
      trigger_source: 'manual',
      status: 'running',
      triggered_by: session.userId,
    }).select('id').single()
    if (error || !run) return fail('The sync could not be started.')

    await session.supabase.from('social_channels')
      .update({ health: 'syncing', last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', channelId).eq('workspace_id', session.ctx.workspaceId)

    await logSocialActivity(session, {
      action: 'social.connection.sync_started', entityType: 'social_channel', entityId: channelId,
      channelId, summary: 'Started a manual sync', href: `${session.basePath}/connections`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Sync started. Progress appears in Sync History.' }
  })
}

export async function disconnectChannel(channelId: string): Promise<ActionResult> {
  return run('connections', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_CONNECTIONS_DISCONNECT)
    await assertOwnedRecord(session, 'social_channels', channelId)

    const { data: channel } = await session.supabase.from('social_channels')
      .select('id, account_name').eq('id', channelId).eq('workspace_id', session.ctx.workspaceId).single()

    await session.supabase.from('social_channels').update({
      is_active: false, health: 'disconnected', token_status: 'revoked',
      access_token_encrypted: null, refresh_token_encrypted: null,
      disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', channelId).eq('workspace_id', session.ctx.workspaceId)

    await session.supabase.from('publishing_queue')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('workspace_id', session.ctx.workspaceId).eq('channel_id', channelId).eq('status', 'queued')

    await logSocialActivity(session, {
      action: 'social.connection.disconnected', entityType: 'social_channel', entityId: channelId,
      channelId, severity: 'warning',
      summary: `Disconnected ${channel?.account_name ?? 'a channel'}`,
      detail: 'Queued posts for this channel were cancelled.',
      href: `${session.basePath}/connections`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Channel disconnected. Queued posts for it were cancelled.' }
  })
}

export async function resolveConnectionIssue(issueId: string): Promise<ActionResult> {
  return run('connections', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_CONNECTIONS_EDIT)
    await assertOwnedRecord(session, 'social_connection_issues', issueId)
    await session.supabase.from('social_connection_issues')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', issueId).eq('workspace_id', session.ctx.workspaceId)
    revalidateSocial(session)
    return { ok: true, message: 'Issue marked as resolved.' }
  })
}

// ── Analytics ────────────────────────────────────────────────────────────────

export async function saveReportPreset(input: {
  id?: string
  name: string
  description?: string
  config: Record<string, unknown>
  isDefault?: boolean
}): Promise<ActionResult<{ id: string }>> {
  return run('analytics', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_ANALYTICS_CREATE_REPORT)
    if (!input.name.trim()) return fail<{ id: string }>('Give the report a name.')

    if (input.isDefault) {
      await session.supabase.from('social_report_presets')
        .update({ is_default: false }).eq('workspace_id', session.ctx.workspaceId)
    }
    const payload = {
      workspace_id: session.ctx.workspaceId,
      name: input.name.trim(),
      description: input.description ?? null,
      config: input.config,
      is_default: Boolean(input.isDefault),
      updated_at: new Date().toISOString(),
    }
    let id = input.id
    if (id) {
      await assertOwnedRecord(session, 'social_report_presets', id)
      await session.supabase.from('social_report_presets').update(payload)
        .eq('id', id).eq('workspace_id', session.ctx.workspaceId)
    } else {
      const { data, error } = await session.supabase.from('social_report_presets')
        .insert({ ...payload, created_by: session.userId }).select('id').single()
      if (error || !data) return fail<{ id: string }>('The report could not be saved.')
      id = data.id
    }

    await logSocialActivity(session, {
      action: 'social.report.saved', entityType: 'social_report_preset', entityId: id,
      summary: `Saved report “${input.name.trim()}”`, href: `${session.basePath}/analytics`, severity: 'success',
    })
    revalidateSocial(session)
    return { ok: true, message: 'Report saved.', data: { id: id! } }
  })
}

export async function scheduleReport(input: {
  presetId: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  format: 'pdf' | 'csv' | 'xlsx'
  sendTime: string
  timezone: string
}): Promise<ActionResult> {
  return run('analytics', async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_ANALYTICS_SCHEDULE_REPORT)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'social_report_presets', input.presetId)

    const invalid = input.recipients.filter(email => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    if (invalid.length) return fail(`Check these recipients: ${invalid.join(', ')}`)
    if (input.recipients.length === 0) return fail('Add at least one recipient.')

    const { error } = await session.supabase.from('scheduled_reports').insert({
      workspace_id: session.ctx.workspaceId,
      name: input.name.trim(),
      report_type: 'social',
      frequency: input.frequency,
      recipients: input.recipients,
      send_time: input.sendTime,
      timezone: input.timezone,
      format: input.format,
      preset_id: input.presetId,
      created_by: session.userId,
    })
    if (error) return fail('The schedule could not be saved.')

    await logSocialActivity(session, {
      action: 'social.report.scheduled', entityType: 'scheduled_report',
      summary: `Scheduled “${input.name.trim()}” ${input.frequency}`,
      detail: `${input.recipients.length} recipient${input.recipients.length === 1 ? '' : 's'} · ${input.format.toUpperCase()}`,
      href: `${session.basePath}/analytics`, severity: 'success',
    })
    revalidateSocial(session)
    return { ok: true, message: 'Report scheduled.' }
  })
}

// ── Additional publishing workflows ──────────────────────────────────────────

/** Copies a post as a new draft. Schedule, approvals and delivery history are not copied. */
export async function duplicatePost(postId: string): Promise<ActionResult<{ postId: string }>> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_CREATE)
    const { data: post } = await session.supabase.from('content_posts')
      .select('title, caption, hashtags, platforms, channel_id, campaign_id, post_type, media_urls, thumbnail_url, timezone, first_comment, link_in_bio_url')
      .eq('id', postId).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
    if (!post) return fail<{ postId: string }>('That post is not available in this workspace.')
    const { data, error } = await session.supabase.from('content_posts').insert({
      ...post,
      workspace_id: session.ctx.workspaceId,
      title: `${post.title ?? 'Untitled post'} (copy)`,
      status: 'draft',
      scheduled_at: null,
      created_by: session.userId,
      owner_id: session.userId,
    }).select('id').single()
    if (error || !data) return fail<{ postId: string }>('The post could not be duplicated.')
    await logSocialActivity(session, {
      action: 'social.post.duplicated', entityType: 'content_post', entityId: data.id,
      summary: `Duplicated “${post.title ?? 'Untitled post'}” as a draft`, href: `${session.basePath}/posts/${data.id}`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Draft copy created.', data: { postId: data.id } }
  })
}

/** Moves a draft or scheduled post into the approval queue; delivery waits for the decision. */
export async function submitForApproval(postId: string): Promise<ActionResult> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_EDIT)
    const { data: post } = await session.supabase.from('content_posts')
      .select('id, title, status').eq('id', postId).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
    if (!post) return fail('That post is not available in this workspace.')
    if (!['draft', 'approved', 'scheduled'].includes(post.status)) return fail('Only drafts and scheduled posts can be sent for approval.')
    await session.supabase.from('content_posts')
      .update({ status: 'pending_approval', approval_required: true, approved_at: null, approved_by: null, updated_at: new Date().toISOString() })
      .eq('id', postId).eq('workspace_id', session.ctx.workspaceId)
    await session.supabase.from('publishing_queue').update({ status: 'skipped' })
      .eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).eq('status', 'queued')
    await logSocialActivity(session, {
      action: 'social.post.submitted', entityType: 'content_post', entityId: postId,
      summary: `Requested approval for “${post.title ?? 'Untitled post'}”`, href: `${session.basePath}/posts/${postId}`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Sent for approval.' }
  })
}

/**
 * Queues a post for immediate delivery. The worker makes the provider call;
 * nothing is marked published until each provider confirms.
 */
export async function publishNow(postId: string): Promise<ActionResult> {
  return run('publishing', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_PUBLISH)
    const { data: post } = await session.supabase.from('content_posts')
      .select('id, title, status, platforms, approval_required, approved_at')
      .eq('id', postId).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
    if (!post) return fail('That post is not available in this workspace.')
    if (post.status === 'pending_approval' || (post.approval_required && !post.approved_at)) return fail('This post needs approval before it can be published.')
    if (!['draft', 'approved', 'scheduled', 'queued'].includes(post.status)) return fail('This post cannot be published from its current state.')
    const unsupported = ((post.platforms ?? []) as string[]).filter(platform => !capabilitiesFor(platform as SocialProvider).createPost)
    if (unsupported.length) return fail(`${unsupported.join(', ')} does not support publishing through the API.`)

    const when = new Date().toISOString()
    await session.supabase.from('content_posts')
      .update({ status: 'queued', scheduled_at: when, updated_at: when })
      .eq('id', postId).eq('workspace_id', session.ctx.workspaceId)
    await session.supabase.from('publishing_queue').update({ status: 'cancelled', cancelled_at: when })
      .eq('workspace_id', session.ctx.workspaceId).eq('post_id', postId).in('status', ['queued', 'skipped'])
    await queueDeliveries(session, postId, when)
    await logSocialActivity(session, {
      action: 'social.post.publish_requested', entityType: 'content_post', entityId: postId,
      summary: `Queued “${post.title ?? 'Untitled post'}” to publish now`, href: `${session.basePath}/posts/${postId}`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Queued for publishing. Status updates as each channel confirms.' }
  })
}

// ── Additional connection and report management ─────────────────────────────

export async function updateChannelTeam(channelId: string, teamLabel: string): Promise<ActionResult> {
  return run('connections', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_CONNECTIONS_EDIT)
    await assertOwnedRecord(session, 'social_channels', channelId)
    const label = teamLabel.trim().slice(0, 60)
    if (!label) return fail('Enter a team name.')
    await session.supabase.from('social_channels').update({ team_label: label, updated_at: new Date().toISOString() })
      .eq('id', channelId).eq('workspace_id', session.ctx.workspaceId)
    await logSocialActivity(session, {
      action: 'social.connection.mapped', entityType: 'social_channel', entityId: channelId, channelId,
      summary: `Mapped a channel to ${label}`, href: `${session.basePath}/connections/${channelId}`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Team mapping updated.' }
  })
}

export async function setReportScheduleActive(scheduleId: string, isActive: boolean): Promise<ActionResult> {
  return run('analytics', async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_ANALYTICS_SCHEDULE_REPORT)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'scheduled_reports', scheduleId)
    await session.supabase.from('scheduled_reports').update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', scheduleId).eq('workspace_id', session.ctx.workspaceId)
    await logSocialActivity(session, {
      action: isActive ? 'social.report.schedule_enabled' : 'social.report.schedule_disabled', entityType: 'scheduled_report', entityId: scheduleId,
      summary: isActive ? 'Resumed a scheduled report' : 'Paused a scheduled report', href: `${session.basePath}/analytics`,
    })
    revalidateSocial(session)
    return { ok: true, message: isActive ? 'Schedule resumed.' : 'Schedule paused.' }
  })
}

export async function deleteReportPreset(presetId: string): Promise<ActionResult> {
  return run('analytics', async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_ANALYTICS_CREATE_REPORT)
    await assertOwnedRecord(session, 'social_report_presets', presetId)
    await session.supabase.from('social_report_presets').delete().eq('id', presetId).eq('workspace_id', session.ctx.workspaceId)
    await logSocialActivity(session, {
      action: 'social.report.deleted', entityType: 'social_report_preset', entityId: presetId, severity: 'warning',
      summary: 'Deleted a saved report', href: `${session.basePath}/analytics`,
    })
    revalidateSocial(session)
    return { ok: true, message: 'Report deleted.' }
  })
}
