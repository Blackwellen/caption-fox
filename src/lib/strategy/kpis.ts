// KPI period snapshots. Each page computes its metrics live, refreshes this
// month's snapshot, and compares against the frozen snapshot for the prior
// month or quarter — so every "vs last month" figure is a real difference
// between two recorded periods, never a hard-coded number.

import type { SupabaseClient } from '@supabase/supabase-js'
import { delta, monthStart, type Delta } from './metrics'

export type MetricMap = Record<string, number>

interface SnapshotRow { period_start: string; metrics: MetricMap; updated_at: string }

/** Reads the snapshots needed for month and quarter comparisons. */
export async function loadSnapshots(supabase: SupabaseClient, workspaceId: string, now: Date = new Date()) {
  const { data } = await supabase.from('strategy_kpi_snapshots')
    .select('period_start, metrics, updated_at')
    .eq('workspace_id', workspaceId)
    .gte('period_start', monthStart(12, now))
    .order('period_start', { ascending: true })
  const rows = (data ?? []) as SnapshotRow[]
  const byMonth = new Map(rows.map(row => [row.period_start, row]))
  return {
    rows,
    current: byMonth.get(monthStart(0, now)) ?? null,
    lastMonth: byMonth.get(monthStart(1, now))?.metrics ?? null,
    lastQuarter: byMonth.get(monthStart(3, now))?.metrics ?? null,
  }
}

/**
 * Merges live metrics into this month's snapshot. Throttled to one write per
 * ten minutes, and silently skipped for read-only roles (RLS denies them).
 */
export async function refreshSnapshot(
  supabase: SupabaseClient, workspaceId: string, current: SnapshotRow | null, metrics: MetricMap, now: Date = new Date(),
): Promise<void> {
  const fresh = current && now.getTime() - new Date(current.updated_at).getTime() < 10 * 60_000
  const unchanged = current && Object.entries(metrics).every(([key, value]) => current.metrics?.[key] === value)
  const complete = current && Object.keys(metrics).every(key => key in (current.metrics ?? {}))
  // Each page contributes its own keys, so a fresh snapshot still accepts new ones.
  if (unchanged || (fresh && complete)) return
  const merged = { ...(current?.metrics ?? {}), ...metrics }
  const { error } = await supabase.from('strategy_kpi_snapshots').upsert(
    { workspace_id: workspaceId, period_start: monthStart(0, now), metrics: merged, updated_at: now.toISOString() },
    { onConflict: 'workspace_id,period_start' },
  )
  if (error && error.code !== '42501') console.error('[strategy] snapshot refresh failed', { code: error.code })
}

export function compare(current: number, previous: MetricMap | null, key: string): Delta | null {
  return delta(current, previous?.[key])
}

/** Monthly series of one metric from snapshots (oldest → newest), live value last. */
export function series(rows: SnapshotRow[], key: string, live: number, months = 6, now: Date = new Date()) {
  const points: { date: string; value: number | null }[] = []
  const byMonth = new Map(rows.map(row => [row.period_start, row.metrics]))
  for (let offset = months - 1; offset >= 1; offset -= 1) {
    const date = monthStart(offset, now)
    const value = byMonth.get(date)?.[key]
    points.push({ date, value: typeof value === 'number' ? value : null })
  }
  points.push({ date: monthStart(0, now), value: live })
  return points
}
