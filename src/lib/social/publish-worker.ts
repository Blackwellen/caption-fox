import 'server-only'
import { socialServiceClient } from './service-client'
import { publishToProvider } from './publish-adapters'
import { workspaceKindFromType } from '@/lib/navigation/resolver'
import type { FailureType, SocialProvider } from '@/types/social'

// Background publishing worker.
//
// Runs outside the browser request that created the post. Claims due queue rows
// one at a time, calls the provider, records an attempt, and only then updates
// the delivery and its parent post. A post whose channels finish with a mix of
// success and failure becomes `partially_published`; retrying it re-sends only
// the failed channels, so a successful channel is never posted to twice.

/** Failures worth retrying. Validation and permission errors need a human. */
const RETRYABLE: FailureType[] = ['rate_limit', 'network', 'timeout', 'provider_rejection', 'media_processing']

/** Exponential backoff with a ceiling, in minutes, indexed by attempt number. */
function backoffMinutes(attempt: number): number {
  return Math.min(2 ** attempt * 5, 240)
}

export interface WorkerResult {
  claimed: number
  published: number
  failed: number
  skipped: number
}

interface QueueRow {
  id: string
  workspace_id: string
  post_id: string
  channel_id: string
  attempt_count: number
  max_attempts: number
}

export async function runPublishingWorker(options: { limit?: number; now?: Date } = {}): Promise<WorkerResult> {
  const service = socialServiceClient()
  const now = options.now ?? new Date()
  const result: WorkerResult = { claimed: 0, published: 0, failed: 0, skipped: 0 }

  const { data: due } = await service
    .from('publishing_queue')
    .select('id, workspace_id, post_id, channel_id, attempt_count, max_attempts')
    .eq('status', 'queued')
    .lte('scheduled_at', now.toISOString())
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .order('scheduled_at')
    .limit(options.limit ?? 25)

  for (const row of (due ?? []) as QueueRow[]) {
    // Conditional claim: only one worker can move a row out of `queued`, so a
    // concurrent run cannot publish the same delivery twice.
    const { data: claimed } = await service
      .from('publishing_queue')
      .update({ status: 'processing', last_attempt_at: now.toISOString(), attempt_count: row.attempt_count + 1 })
      .eq('id', row.id).eq('status', 'queued')
      .select('id').maybeSingle()
    if (!claimed) continue
    result.claimed += 1

    await processDelivery(row, now, result)
  }

  return result
}

async function processDelivery(row: QueueRow, now: Date, result: WorkerResult): Promise<void> {
  const service = socialServiceClient()
  const attemptNo = row.attempt_count + 1

  const [{ data: post }, { data: channel }] = await Promise.all([
    service.from('content_posts')
      .select('id, title, caption, hashtags, media_urls, post_type, link_in_bio_url, status')
      .eq('id', row.post_id).maybeSingle(),
    service.from('social_channels')
      .select('id, platform, account_id, account_name, health, is_active')
      .eq('id', row.channel_id).maybeSingle(),
  ])

  if (!post || !channel || !channel.is_active) {
    await service.from('publishing_queue').update({
      status: 'skipped',
      failure_type: 'validation',
      error_message: !channel?.is_active ? 'The channel is disconnected.' : 'The post is no longer available.',
    }).eq('id', row.id)
    result.skipped += 1
    return
  }

  await service.from('content_posts').update({ status: 'publishing' })
    .eq('id', row.post_id).in('status', ['scheduled', 'queued'])

  const outcome = await publishToProvider({
    channelId: channel.id,
    provider: channel.platform as SocialProvider,
    providerAccountId: channel.account_id,
    caption: post.caption ?? '',
    hashtags: post.hashtags ?? [],
    mediaUrls: post.media_urls ?? [],
    postType: post.post_type ?? 'post',
    linkUrl: post.link_in_bio_url,
    title: post.title,
  })

  await service.from('social_publish_attempts').insert({
    workspace_id: row.workspace_id,
    queue_id: row.id,
    attempt_no: attemptNo,
    status: outcome.ok ? 'success' : 'failed',
    failure_type: outcome.ok ? null : outcome.failureType,
    error_message: outcome.ok ? null : outcome.message,
    provider_post_id: outcome.ok ? outcome.providerPostId : null,
    started_at: now.toISOString(),
    finished_at: new Date().toISOString(),
  })

  if (outcome.ok) {
    await service.from('publishing_queue').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_post_id: outcome.providerPostId,
      provider_permalink: outcome.permalink,
      failure_type: null,
      error_message: null,
    }).eq('id', row.id)
    result.published += 1
  } else {
    const retryable = RETRYABLE.includes(outcome.failureType) && attemptNo < row.max_attempts
    await service.from('publishing_queue').update({
      status: retryable ? 'queued' : 'failed',
      failure_type: outcome.failureType,
      error_message: outcome.message.slice(0, 500),
      next_attempt_at: retryable
        ? new Date(now.getTime() + backoffMinutes(attemptNo) * 60_000).toISOString()
        : null,
    }).eq('id', row.id)
    result.failed += 1
  }

  await reconcilePostStatus(row.workspace_id, row.post_id, channel.account_name, outcome.ok)
}

/**
 * Rolls the per-channel deliveries up into the post's own status. A post is
 * only `published` when every channel confirmed; any mix becomes
 * `partially_published` so the failed channels stay visible and retryable.
 */
async function reconcilePostStatus(
  workspaceId: string, postId: string, channelName: string, lastOk: boolean,
): Promise<void> {
  const service = socialServiceClient()
  const { data: rows } = await service.from('publishing_queue')
    .select('status, error_message').eq('post_id', postId)
  const deliveries = (rows ?? []) as { status: string; error_message: string | null }[]
  const active = deliveries.filter(row => row.status !== 'cancelled')
  if (active.length === 0) return

  const sent = active.filter(row => row.status === 'sent').length
  const settled = active.filter(row => ['sent', 'failed', 'skipped'].includes(row.status)).length
  if (settled < active.length) return

  const status = sent === active.length ? 'published' : sent === 0 ? 'failed' : 'partially_published'
  const failures = active.filter(row => row.status !== 'sent').map(row => row.error_message).filter(Boolean)

  await service.from('content_posts').update({
    status,
    published_at: sent > 0 ? new Date().toISOString() : null,
    failure_summary: failures.length ? failures.join(' · ').slice(0, 500) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', postId)

  const [{ data: post }, { data: workspace }] = await Promise.all([
    service.from('content_posts').select('title').eq('id', postId).maybeSingle(),
    service.from('workspaces').select('type').eq('id', workspaceId).maybeSingle(),
  ])
  const basePath = `/${workspaceKindFromType(workspace?.type as string | undefined)}/social`
  await service.from('social_activity').insert({
    workspace_id: workspaceId,
    actor_kind: 'system',
    action: `social.post.${status}`,
    entity_type: 'content_post',
    entity_id: postId,
    summary: status === 'published'
      ? `Published “${post?.title ?? 'Untitled post'}” to every channel`
      : status === 'partially_published'
        ? `“${post?.title ?? 'Untitled post'}” published to ${sent} of ${active.length} channels`
        : `“${post?.title ?? 'Untitled post'}” failed to publish`,
    detail: failures.length ? String(failures[0]).slice(0, 200) : `Last channel: ${channelName} ${lastOk ? 'succeeded' : 'failed'}`,
    href: `${basePath}/posts/${postId}`,
    severity: status === 'published' ? 'success' : status === 'failed' ? 'error' : 'warning',
  })
}
