// Display helpers shared by the Inbox pages and the Fox AI panel. Pure.

import type { InboxCounts, KpiDelta, SlaStatus } from './types'

export const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', rcs: 'RCS', instagram: 'Instagram', facebook: 'Facebook',
  live_chat: 'Live Chat', x: 'X (Twitter)', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', push: 'Push',
}

export const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' }
/** List rows use the "Medium" wording for the middle priority band. */
export const PRIORITY_ROW_LABEL: Record<string, string> = { urgent: 'Urgent', high: 'High', normal: 'Medium', low: 'Low' }

export const SLA_LABEL: Record<SlaStatus, string> = {
  on_track: 'On track', at_risk: 'At risk', breached: 'Breached', completed: 'Completed', paused: 'Paused',
}

/** "18m 24s", "3h 42m", "2d 4h". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

/** "2m", "15m", "1h", "3d" — compact age since a timestamp. */
export function formatAge(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
  const age = formatAge(iso, now)
  if (!age) return ''
  return age === 'now' ? 'Just now' : `${age} ago`
}

/** Clock time in the workspace timezone, e.g. "11:42 AM". */
export function formatClock(iso: string | null | undefined, timeZone = 'Europe/London'): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso))
}

export function formatDayTime(iso: string | null | undefined, timeZone = 'Europe/London'): string {
  if (!iso) return ''
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(d)
  return `${date} • ${formatClock(iso, timeZone)}`
}

/** Minutes until an SLA due time (negative once breached). */
export function minutesUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - now) / 60_000)
}

export function formatCountdown(mins: number | null): string {
  if (mins == null) return '—'
  const abs = Math.abs(mins)
  const text = abs < 60 ? `${abs}m` : `${Math.floor(abs / 60)}h ${abs % 60}m`
  return mins < 0 ? `${text} overdue` : text
}

export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null
  return (current - previous) / previous
}

export function formatPct(value: number | null): string {
  if (value == null) return ''
  return `${Math.abs(value * 100).toFixed(1).replace(/\.0$/, '')}%`
}

export function deltaFor(key: keyof InboxCounts, counts: InboxCounts, yesterday: Partial<InboxCounts> | null): KpiDelta {
  const current = counts[key]
  const prev = yesterday?.[key]
  if (typeof current !== 'number' || typeof prev !== 'number') return { pct: null, abs: null }
  return { pct: percentChange(current, prev), abs: current - prev }
}

export function initials(name: string | null | undefined): string {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function shortName(name: string | null | undefined): string {
  if (!name) return ''
  const [first, last] = name.trim().split(/\s+/)
  return last ? `${first} ${last[0]}.` : first
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value)
}

export function compactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(value)
}

/** KPI arrow for a delta; `higherIsGood` flips the colour for metrics where down is better. */
export function kpiDelta(delta: KpiDelta, higherIsGood = true): { direction: 'up' | 'down'; good: boolean; text: string } | null {
  if (delta.pct == null || delta.pct === 0) return null
  const up = delta.pct > 0
  return { direction: up ? 'up' : 'down', good: up === higherIsGood, text: formatPct(delta.pct) }
}
