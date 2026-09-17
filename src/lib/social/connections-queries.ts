import 'server-only'
import type { SocialSession } from './server'
import { eachDay, type DateRange } from './metrics'

// Sync-run statistics for the Social Connections KPI strip: totals and daily
// series for the selected window and the previous window of the same length.

export interface SyncStats {
  runs: number; runsPrev: number
  failed: number; failedPrev: number
  daily: { date: string; total: number; success: number; failed: number }[]
}

export async function getSyncStats(session: SocialSession, range: DateRange, previous: DateRange): Promise<SyncStats> {
  const read = (window: DateRange) => session.supabase.from('social_sync_runs')
    .select('status, started_at')
    .eq('workspace_id', session.ctx.workspaceId)
    .gte('started_at', window.from.toISOString()).lte('started_at', window.to.toISOString())
    .limit(20_000)
  const [{ data: current }, { data: earlier }] = await Promise.all([read(range), read(previous)])
  const rows = (current ?? []) as { status: string; started_at: string }[]
  const prevRows = (earlier ?? []) as { status: string; started_at: string }[]
  return {
    runs: rows.length, runsPrev: prevRows.length,
    failed: rows.filter(row => row.status === 'failed').length,
    failedPrev: prevRows.filter(row => row.status === 'failed').length,
    daily: eachDay(range).map(date => {
      const day = rows.filter(row => row.started_at.slice(0, 10) === date)
      return { date, total: day.length, success: day.filter(row => row.status === 'success').length, failed: day.filter(row => row.status === 'failed').length }
    }),
  }
}
