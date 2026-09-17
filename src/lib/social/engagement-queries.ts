import 'server-only'
import type { SocialSession } from './server'
import type { DateRange } from './metrics'

// Tab badge counts for Social Engagement. Each is a head-only count query that
// uses the same view definitions as getConversations, so a badge always equals
// the number of rows its tab lists for the same range and filters.

export interface EngagementTabFilters { channelId?: string | null; assigneeId?: string | null; sentiment?: string | null }

export async function getEngagementTabCounts(session: SocialSession, range: DateRange, filters: EngagementTabFilters) {
  const base = () => {
    let query = session.supabase.from('inbox_threads').select('id', { count: 'exact', head: true })
      .eq('workspace_id', session.ctx.workspaceId)
      .gte('created_at', range.from.toISOString()).lte('created_at', range.to.toISOString())
    if (filters.channelId) query = query.eq('channel_id', filters.channelId)
    if (filters.assigneeId) query = query.eq('assigned_to', filters.assigneeId)
    if (filters.sentiment) query = query.eq('sentiment', filters.sentiment)
    return query
  }
  const [inbox, threads, assigned, all, flagged] = await Promise.all([
    base().eq('is_read', false).neq('status', 'resolved'),
    base().eq('type', 'dm'),
    base().not('assigned_to', 'is', null),
    base(),
    base().eq('is_flagged', true),
  ])
  return {
    inbox: inbox.count ?? 0, threads: threads.count ?? 0, assigned: assigned.count ?? 0,
    all: all.count ?? 0, flagged: flagged.count ?? 0,
  }
}
