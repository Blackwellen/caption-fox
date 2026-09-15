'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { PERMISSIONS } from '@/lib/permissions'
import { assertCapability, assertOwnedRecord, getSocialSession, logSocialActivity, type SocialSession } from './server'
import { canAccessSocialCapability, connectionCanAct } from './entitlements'
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

async function run<T>(fn: (session: SocialSession) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const session = await getSocialSession()
    return await fn(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return fail<T>(message)
  }
}

function revalidateSocial() {
  for (const path of ['/app/social', '/app/social/publishing', '/app/social/engagement', '/app/social/listening', '/app/social/connections', '/app/social/analytics']) {
    revalidatePath(path)
  }
}

// ── Publishing ───────────────────────────────────────────────────────────────

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
  return run(async session => {
    assertCapability(session, input.postId ? PERMISSIONS.SOCIAL_PUBLISHING_EDIT : PERMISSIONS.SOCIAL_PUBLISHING_CREATE)

    if (input.channelIds.length === 0) return fail<{ postId: string }>('Select at least one channel.')
    const channels = await loadChannels(session, input.channelIds)
    if (channels.length !== input.channelIds.length) {
      return fail<{ postId: string }>('One or more channels are not available in this workspace.')
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null
    const issues = channels.flatMap(channel => validateDraft(channel.platform, {
      caption: input.caption,
      mediaCount: input.mediaUrls?.length ?? 0,
      hashtagCount: input.hashtags?.length ?? 0,
      postType: input.postType as never,
      scheduledAt,
    }))
    const blocked = channels.filter(channel => !connectionCanAct(channel.health as never))
    if (blocked.length) {
      return fail<{ postId: string }>(`${blocked.map(channel => channel.account_name).join(', ')} cannot publish until the connection is repaired.`)
    }
    if (issues.length) {
      return fail<{ postId: string }>(issues.map(issue => `${issue.provider}: ${issue.message}`).join(' '))
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
      media_urls: input.mediaUrls ?? [],
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
      await session.supabase.from('publishing_queue').upsert(
        channels.map(channel => ({
          workspace_id: session.ctx.workspaceId,
          post_id: postId!,
          channel_id: channel.id,
          scheduled_at: scheduledAt.toISOString(),
          status: 'queued',
          idempotency_key: `${postId}:${channel.id}:${scheduledAt.toISOString()}`,
        })),
        { onConflict: 'idempotency_key', ignoreDuplicates: true },
      )
    }

    await logSocialActivity(session, {
      action: input.postId ? 'social.post.updated' : 'social.post.created',
      entityType: 'content_post',
      entityId: postId,
      summary: `${input.postId ? 'Updated' : 'Created'} “${input.title || 'Untitled post'}” for ${channels.map(channel => channel.account_name).join(', ')}`,
      detail: scheduledAt ? `Scheduled for ${scheduledAt.toISOString()}` : 'Saved as a draft',
      href: `/app/social/publishing?post=${postId}`,
      severity: 'success',
    })

    revalidateSocial()
    return { ok: true, message: scheduledAt ? 'Post scheduled.' : 'Draft saved.', data: { postId: postId! } }
  })
}

export async function reschedulePost(postId: string, scheduledAt: string): Promise<ActionResult> {
  return run(async session => {
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
      href: `/app/social/publishing?post=${postId}`,
    })
    revalidateSocial()
    return { ok: true, message: 'Post rescheduled.' }
  })
}

export async function setApprovalDecision(
  postId: string,
  decision: 'approve' | 'request_changes' | 'reject',
  note?: string,
): Promise<ActionResult> {
  return run(async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_PUBLISHING_APPROVE)
    await assertOwnedRecord(session, 'content_posts', postId)

    const { data: post } = await session.supabase.from('content_posts')
      .select('id, title, status, scheduled_at').eq('id', postId)
      .eq('workspace_id', session.ctx.workspaceId).single()
    if (!post) return fail('That post is not available.')
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
    }

    await logSocialActivity(session, {
      action: `social.post.${decision}`, entityType: 'content_post', entityId: postId,
      summary: `${decision === 'approve' ? 'Approved' : decision === 'reject' ? 'Rejected' : 'Requested changes on'} “${post.title ?? 'Untitled post'}”`,
      detail: note ?? null,
      href: `/app/social/publishing?post=${postId}`,
      severity: decision === 'approve' ? 'success' : 'warning',
    })
    revalidateSocial()
    return { ok: true, message: decision === 'approve' ? 'Post approved.' : 'Feedback recorded.' }
  })
}

export async function cancelScheduledPost(postId: string): Promise<ActionResult> {
  return run(async session => {
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
      href: '/app/social/publishing',
    })
    revalidateSocial()
    return { ok: true, message: 'Scheduled post cancelled.' }
  })
}

/** Retries only the channels that failed — successful channels are never re-sent. */
export async function retryFailedDeliveries(postId: string): Promise<ActionResult> {
  return run(async session => {
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
      href: '/app/social/publishing?view=queue',
    })
    revalidateSocial()
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
  return run(async session => {
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
      href: `/app/social/engagement?conversation=${input.conversationId}`,
      severity: 'success',
    })
    revalidatePath('/app/social/engagement')
    return { ok: true, message: isNote ? 'Note added.' : 'Reply queued for delivery.' }
  })
}

export async function assignConversation(conversationId: string, assigneeId: string | null): Promise<ActionResult> {
  return run(async session => {
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
      href: `/app/social/engagement?conversation=${conversationId}`,
    })
    revalidatePath('/app/social/engagement')
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
  return run(async session => {
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
      href: `/app/social/engagement?conversation=${input.conversationId}`,
    })
    revalidatePath('/app/social/engagement')
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
  return run(async session => {
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
    revalidatePath('/app/social/listening')
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
  return run(async session => {
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
      href: '/app/social/listening?view=alerts', severity: 'success',
    })
    revalidatePath('/app/social/listening')
    return { ok: true, message: 'Alert created.', data: { id: data.id } }
  })
}

export async function setAlertRuleActive(ruleId: string, isActive: boolean): Promise<ActionResult> {
  return run(async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_LISTENING_MANAGE_ALERT)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'listening_alert_rules', ruleId)
    await session.supabase.from('listening_alert_rules')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', ruleId).eq('workspace_id', session.ctx.workspaceId)
    revalidatePath('/app/social/listening')
    return { ok: true, message: isActive ? 'Alert enabled.' : 'Alert paused.' }
  })
}

export async function resolveListeningAlert(alertId: string): Promise<ActionResult> {
  return run(async session => {
    const access = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_LISTENING_MANAGE_ALERT)
    if (!access.allowed) return fail(access.message)
    await assertOwnedRecord(session, 'listening_alerts', alertId)
    await session.supabase.from('listening_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), is_read: true })
      .eq('id', alertId).eq('workspace_id', session.ctx.workspaceId)
    revalidatePath('/app/social/listening')
    return { ok: true, message: 'Alert resolved.' }
  })
}

// ── Connections ──────────────────────────────────────────────────────────────

export async function syncChannelNow(channelId: string): Promise<ActionResult> {
  return run(async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_CONNECTIONS_SYNC)
    await assertOwnedRecord(session, 'social_channels', channelId)

    const { data: running } = await session.supabase.from('social_sync_runs')
      .select('id').eq('workspace_id', session.ctx.workspaceId)
      .eq('channel_id', channelId).eq('status', 'running').maybeSingle()
    if (running) return fail('A sync is already running for this channel.')

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
      channelId, summary: 'Started a manual sync', href: '/app/social/connections',
    })
    revalidatePath('/app/social/connections')
    return { ok: true, message: 'Sync started. Progress appears in Sync History.' }
  })
}

export async function disconnectChannel(channelId: string): Promise<ActionResult> {
  return run(async session => {
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
      href: '/app/social/connections',
    })
    revalidateSocial()
    return { ok: true, message: 'Channel disconnected. Queued posts for it were cancelled.' }
  })
}

export async function resolveConnectionIssue(issueId: string): Promise<ActionResult> {
  return run(async session => {
    assertCapability(session, PERMISSIONS.SOCIAL_CONNECTIONS_EDIT)
    await assertOwnedRecord(session, 'social_connection_issues', issueId)
    await session.supabase.from('social_connection_issues')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', issueId).eq('workspace_id', session.ctx.workspaceId)
    revalidatePath('/app/social/connections')
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
  return run(async session => {
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
      summary: `Saved report “${input.name.trim()}”`, href: '/app/social/analytics', severity: 'success',
    })
    revalidatePath('/app/social/analytics')
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
  return run(async session => {
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
      href: '/app/social/analytics', severity: 'success',
    })
    revalidatePath('/app/social/analytics')
    return { ok: true, message: 'Report scheduled.' }
  })
}
