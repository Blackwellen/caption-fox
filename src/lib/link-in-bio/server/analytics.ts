import 'server-only'
import type { LinksSession } from './context'

// Thin typed wrapper around the link_analytics_summary RPC. All aggregation
// happens in Postgres over daily rollups + today's raw events.

export type Summary = {
  totals: { views: number; clicks: number; conversions: number; revenue_pence: number; uniques: number }
  daily: { day: string; views: number; clicks: number; uniques: number; conversions: number; revenue_pence: number }[]
  devices: { device: string; clicks: number }[]
  sources: { source: string; clicks: number }[]
  referrers: { host: string; clicks: number }[]
  pages: { page_id: string; views: number; clicks: number; conversions: number; revenue_pence: number; uniques: number }[]
  links: { link_id: string; clicks: number; uniques: number }[]
  items: { item_id: string; clicks: number }[]
}

export const EMPTY_SUMMARY: Summary = {
  totals: { views: 0, clicks: 0, conversions: 0, revenue_pence: 0, uniques: 0 },
  daily: [], devices: [], sources: [], referrers: [], pages: [], links: [], items: [],
}

export type Window = { from: Date; to: Date }

export function lastDays(days: number, end = new Date()): Window {
  const to = new Date(end)
  const from = new Date(to.getTime() - days * 86400000)
  return { from, to }
}

export function previousWindow(window: Window): Window {
  const span = window.to.getTime() - window.from.getTime()
  return { from: new Date(window.from.getTime() - span), to: new Date(window.from) }
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function summary(
  session: LinksSession,
  window: Window,
  scope: { pageIds?: string[] | null; linkId?: string | null; source?: string | null } = {},
): Promise<{ data: Summary; error: string | null }> {
  if (scope.pageIds && scope.pageIds.length === 0) return { data: EMPTY_SUMMARY, error: null }
  const { data, error } = await session.supabase.rpc('link_analytics_summary', {
    p_workspace_id: session.workspace.id,
    p_from: window.from.toISOString(),
    p_to: window.to.toISOString(),
    p_page_ids: scope.pageIds ?? null,
    p_link_id: scope.linkId ?? null,
    p_source: scope.source ?? null,
  })
  if (error || !data) return { data: EMPTY_SUMMARY, error: error?.message ?? 'No analytics returned' }
  const raw = data as Record<string, unknown>
  const arr = <T,>(key: string, map: (row: Record<string, unknown>) => T): T[] =>
    Array.isArray(raw[key]) ? (raw[key] as Record<string, unknown>[]).map(map) : []
  const totals = (raw.totals ?? {}) as Record<string, unknown>
  return {
    error: null,
    data: {
      totals: { views: num(totals.views), clicks: num(totals.clicks), conversions: num(totals.conversions), revenue_pence: num(totals.revenue_pence), uniques: num(totals.uniques) },
      daily: arr('daily', r => ({ day: String(r.day), views: num(r.views), clicks: num(r.clicks), uniques: num(r.uniques), conversions: num(r.conversions), revenue_pence: num(r.revenue_pence) })),
      devices: arr('devices', r => ({ device: String(r.device), clicks: num(r.clicks) })),
      sources: arr('sources', r => ({ source: String(r.source), clicks: num(r.clicks) })),
      referrers: arr('referrers', r => ({ host: String(r.host), clicks: num(r.clicks) })),
      pages: arr('pages', r => ({ page_id: String(r.page_id), views: num(r.views), clicks: num(r.clicks), conversions: num(r.conversions), revenue_pence: num(r.revenue_pence), uniques: num(r.uniques) })),
      links: arr('links', r => ({ link_id: String(r.link_id), clicks: num(r.clicks), uniques: num(r.uniques) })),
      items: arr('items', r => ({ item_id: String(r.item_id), clicks: num(r.clicks) })),
    },
  }
}

/** Fills missing days with zeros so charts have a continuous axis. */
export function continuousDaily(daily: Summary['daily'], window: Window): Summary['daily'] {
  const byDay = new Map(daily.map(row => [row.day, row]))
  const out: Summary['daily'] = []
  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  for (let t = window.from.getTime(); t < window.to.getTime(); t += 86400000) {
    const day = fmt(new Date(t))
    if (out.length && out[out.length - 1].day === day) continue
    out.push(byDay.get(day) ?? { day, views: 0, clicks: 0, uniques: 0, conversions: 0, revenue_pence: 0 })
  }
  return out
}
