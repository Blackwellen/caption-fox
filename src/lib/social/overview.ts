import 'server-only'
import type { SocialSession } from './server'
import { previousRange, type DateRange } from './metrics'

// Activity & Alerts for Social Overview. Every item is derived from real rows
// at request time and links to where it can be acted on — nothing here is a
// stored placeholder notification.

export interface OverviewAlert {
  id: string
  kind: 'approval' | 'spike' | 'low_performance' | 'reminder' | 'milestone' | 'connection' | 'failure'
  title: string
  detail: string
  actionLabel: string
  href: string
  at: string
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X', pinterest: 'Pinterest', threads: 'Threads',
}

export async function getOverviewAlerts(
  session: SocialSession,
  range: DateRange,
  input: { meanRate: number | null; followerChange: number },
): Promise<OverviewAlert[]> {
  const workspaceId = session.ctx.workspaceId
  const base = session.basePath
  const now = new Date()
  const prev = previousRange(range)
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [pending, comments, prevComments, upcoming, published, issues, failed] = await Promise.all([
    session.supabase.from('content_posts').select('id, updated_at', { count: 'exact' })
      .eq('workspace_id', workspaceId).eq('status', 'pending_approval').order('updated_at', { ascending: false }).limit(1),
    session.supabase.from('inbox_threads').select('platform')
      .eq('workspace_id', workspaceId).eq('type', 'comment')
      .gte('created_at', range.from.toISOString()).lte('created_at', range.to.toISOString()),
    session.supabase.from('inbox_threads').select('platform')
      .eq('workspace_id', workspaceId).eq('type', 'comment')
      .gte('created_at', prev.from.toISOString()).lte('created_at', prev.to.toISOString()),
    session.supabase.from('content_posts').select('id, scheduled_at', { count: 'exact' })
      .eq('workspace_id', workspaceId).in('status', ['scheduled', 'queued', 'approved'])
      .gte('scheduled_at', now.toISOString()).lte('scheduled_at', in24h.toISOString()).order('scheduled_at').limit(1),
    session.supabase.from('post_analytics').select('post_id, engagement_rate')
      .eq('workspace_id', workspaceId)
      .gte('recorded_at', range.from.toISOString()).lte('recorded_at', range.to.toISOString()),
    session.supabase.from('social_connection_issues').select('id, message, detected_at, channel_id')
      .eq('workspace_id', workspaceId).eq('status', 'open').order('detected_at', { ascending: false }).limit(1),
    session.supabase.from('publishing_queue').select('post_id, last_attempt_at', { count: 'exact' })
      .eq('workspace_id', workspaceId).eq('status', 'failed').order('last_attempt_at', { ascending: false }).limit(1),
  ])

  const alerts: OverviewAlert[] = []
  if ((pending.count ?? 0) > 0) {
    alerts.push({
      id: 'approval', kind: 'approval', title: 'Approval pending',
      detail: `${pending.count} post${pending.count === 1 ? '' : 's'} waiting for approval`,
      actionLabel: 'Review', href: `${base}/publishing?view=board`, at: pending.data?.[0]?.updated_at ?? now.toISOString(),
    })
  }

  // Comment spike: the platform with the largest period-over-period rise of 25% or more.
  const count = (rows: { platform: string | null }[] | null) => {
    const counts = new Map<string, number>()
    for (const row of rows ?? []) if (row.platform) counts.set(row.platform, (counts.get(row.platform) ?? 0) + 1)
    return counts
  }
  const previousCounts = count(prevComments.data)
  const spike = [...count(comments.data).entries()]
    .map(([platform, current]) => ({ platform, current, previous: previousCounts.get(platform) ?? 0 }))
    .filter(row => row.previous >= 5 && row.current / row.previous >= 1.25)
    .sort((a, b) => b.current / b.previous - a.current / a.previous)[0]
  if (spike) {
    alerts.push({
      id: 'spike', kind: 'spike', title: 'Engagement spike',
      detail: `+${Math.round((spike.current / spike.previous - 1) * 100)}% comments on ${PLATFORM_LABEL[spike.platform] ?? spike.platform}`,
      actionLabel: 'View', href: `${base}/engagement?channelType=${spike.platform}`, at: now.toISOString(),
    })
  }

  if (input.meanRate) {
    const low = new Set((published.data ?? [])
      .filter(row => row.engagement_rate !== null && Number(row.engagement_rate) < input.meanRate! * 0.5)
      .map(row => row.post_id))
    if (low.size > 0) {
      alerts.push({
        id: 'low', kind: 'low_performance', title: 'Low performing post',
        detail: `${low.size} post${low.size === 1 ? '' : 's'} under target engagement`,
        actionLabel: 'View', href: `${base}/analytics?view=table&sort=rate_asc`, at: now.toISOString(),
      })
    }
  }

  if ((upcoming.count ?? 0) > 0) {
    alerts.push({
      id: 'reminder', kind: 'reminder', title: 'Publishing reminders',
      detail: `${upcoming.count} post${upcoming.count === 1 ? '' : 's'} scheduled in next 24h`,
      actionLabel: 'View', href: `${base}/publishing?view=queue`, at: upcoming.data?.[0]?.scheduled_at ?? now.toISOString(),
    })
  }

  if ((failed.count ?? 0) > 0) {
    alerts.push({
      id: 'failed', kind: 'failure', title: 'Publishing failures',
      detail: `${failed.count} ${failed.count === 1 ? 'delivery' : 'deliveries'} failed and need attention`,
      actionLabel: 'View', href: `${base}/publishing?view=queue&status=failed`, at: failed.data?.[0]?.last_attempt_at ?? now.toISOString(),
    })
  }

  const issue = issues.data?.[0]
  if (issue) {
    alerts.push({
      id: `issue-${issue.id}`, kind: 'connection', title: 'Connection needs attention',
      detail: issue.message, actionLabel: 'View', href: issue.channel_id ? `${base}/connections/${issue.channel_id}` : `${base}/connections`, at: issue.detected_at,
    })
  }

  // Follower milestone: net new followers crossed a round hundred in this period.
  if (input.followerChange >= 100) {
    const milestone = Math.floor(input.followerChange / 100) * 100
    alerts.push({
      id: 'milestone', kind: 'milestone', title: 'New follower milestone',
      detail: `You gained ${milestone.toLocaleString('en-GB')} new followers`,
      actionLabel: 'View', href: `${base}/analytics?view=audience`, at: range.to.toISOString(),
    })
  }

  return alerts
}
