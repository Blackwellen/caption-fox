// Formatting and metric maths for Link in Bio. UK locale throughout; null
// means "no data" and renders as an em dash, never as zero.

export const DASH = '—'

export function ctr(clicks: number, views: number): number | null {
  return views > 0 ? (clicks / views) * 100 : null
}

export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : null
  return ((current - previous) / previous) * 100
}

export function ppChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return current - previous
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  if (Math.abs(value) < 1000) return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value).replace('k', 'K')
}

export function integer(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)
}

export function percent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return `${value.toFixed(decimals)}%`
}

export function signedPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function pounds(pence: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (pence === null || pence === undefined || !Number.isFinite(pence)) return DASH
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    ...(opts.compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }),
  }).format(pence / 100)
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return DASH
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return DASH
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(date)
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return DASH
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return DASH
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London' }).format(date)
}

export function relative(value: string | Date | null | undefined, now = new Date()): string {
  if (!value) return DASH
  const date = typeof value === 'string' ? new Date(value) : value
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return shortDate(date)
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
