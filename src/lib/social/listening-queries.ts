import 'server-only'
import type { SocialSession } from './server'
import { eachDay, type DateRange } from './metrics'

// Listening aggregates for the design's summary panels: keyword volume for the
// word cloud, daily series per trending topic, influencer authors and alert
// counts by severity. One mentions read per request, grouped in memory, so the
// page never fans out a query per keyword or topic.

export interface ListeningAggregates {
  keywords: { keyword: string; count: number }[]
  topicSeries: Map<string, number[]>
  influencers: { handle: string; name: string | null; avatar: string | null }[]
  influencerCount: number
  alertCounts: { high: number; medium: number; low: number; total: number; newThisPeriod: number }
  hashtags: { tag: string; count: number }[]
}

export async function getListeningAggregates(session: SocialSession, range: DateRange): Promise<ListeningAggregates> {
  const workspaceId = session.ctx.workspaceId
  const [{ data: mentions }, { data: keywordRows }, { data: alerts }] = await Promise.all([
    session.supabase.from('brand_mentions')
      .select('content, topic, mentioned_at, is_influencer, author_handle, author_name, author_avatar_url, author_followers')
      .eq('workspace_id', workspaceId)
      .gte('mentioned_at', range.from.toISOString()).lte('mentioned_at', range.to.toISOString())
      .limit(20_000),
    session.supabase.from('listening_keywords').select('keyword').eq('workspace_id', workspaceId).eq('is_active', true),
    session.supabase.from('listening_alerts').select('severity, triggered_at').eq('workspace_id', workspaceId).eq('status', 'active'),
  ])

  type Row = { content: string | null; topic: string | null; mentioned_at: string; is_influencer: boolean; author_handle: string | null; author_name: string | null; author_avatar_url: string | null; author_followers: number | null }
  const rows = (mentions ?? []) as Row[]
  const days = eachDay(range)
  const dayIndex = new Map(days.map((day, index) => [day, index]))

  const keywordCounts = ((keywordRows ?? []) as { keyword: string }[]).map(({ keyword }) => {
    const needle = keyword.toLowerCase()
    return { keyword, count: rows.filter(row => (row.content ?? '').toLowerCase().includes(needle)).length }
  }).sort((a, b) => b.count - a.count)

  const topicSeries = new Map<string, number[]>()
  const hashtagCounts = new Map<string, number>()
  const influencerByHandle = new Map<string, { handle: string; name: string | null; avatar: string | null; followers: number }>()
  for (const row of rows) {
    const index = dayIndex.get(row.mentioned_at.slice(0, 10))
    if (row.topic && index !== undefined) {
      const series = topicSeries.get(row.topic) ?? days.map(() => 0)
      series[index] += 1
      topicSeries.set(row.topic, series)
    }
    for (const tag of (row.content ?? '').match(/#[\p{L}\p{N}_]{2,40}/gu) ?? []) {
      const key = tag.toLowerCase()
      hashtagCounts.set(key, (hashtagCounts.get(key) ?? 0) + 1)
    }
    if (row.is_influencer && row.author_handle && !influencerByHandle.has(row.author_handle)) {
      influencerByHandle.set(row.author_handle, { handle: row.author_handle, name: row.author_name, avatar: row.author_avatar_url, followers: row.author_followers ?? 0 })
    }
  }

  const alertRows = (alerts ?? []) as { severity: string; triggered_at: string }[]
  return {
    keywords: keywordCounts,
    topicSeries,
    influencers: [...influencerByHandle.values()].sort((a, b) => b.followers - a.followers),
    influencerCount: rows.filter(row => row.is_influencer).length,
    alertCounts: {
      high: alertRows.filter(row => row.severity === 'high').length,
      medium: alertRows.filter(row => row.severity === 'medium').length,
      low: alertRows.filter(row => row.severity === 'low').length,
      total: alertRows.length,
      newThisPeriod: alertRows.filter(row => new Date(row.triggered_at) >= range.from).length,
    },
    hashtags: [...hashtagCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
  }
}
