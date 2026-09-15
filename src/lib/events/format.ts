// Presentation helpers for the Events module.
// UK locale and workspace timezone are applied in exactly one place so no
// component formats a date, currency or rate inline.

const UK_LOCALE = 'en-GB'

export function formatEventDate(
  value: string | null | undefined,
  timeZone = 'Europe/London',
): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(UK_LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone,
  }).format(new Date(value))
}

export function formatEventTime(
  value: string | null | undefined,
  timeZone = 'Europe/London',
): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(UK_LOCALE, {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone,
  }).format(new Date(value))
}

export function formatEventDateTime(
  value: string | null | undefined,
  timeZone = 'Europe/London',
): string {
  if (!value) return '—'
  return `${formatEventDate(value, timeZone)} · ${formatEventTime(value, timeZone)}`
}

/** Short axis label, e.g. "12 May". */
export function formatAxisDay(value: string): string {
  return new Intl.DateTimeFormat(UK_LOCALE, { day: 'numeric', month: 'short' })
    .format(new Date(`${value}T00:00:00Z`))
}

export function formatMonth(value: string): string {
  return new Intl.DateTimeFormat(UK_LOCALE, { month: 'short' })
    .format(new Date(value))
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'GBP',
  compact = false,
): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(UK_LOCALE, {
    style: 'currency', currency,
    maximumFractionDigits: compact || Number.isInteger(value) ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(UK_LOCALE).format(value)
}

/** `rate` is a 0–1 fraction. Returns "—" when it is not measurable. */
export function formatRate(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}

export function formatChange(pct: number | null | undefined, digits = 1): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—'
  const sign = pct > 0 ? '' : ''
  return `${sign}${Math.abs(pct * 100).toFixed(digits)}%`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }
  return `${m}m ${String(s).padStart(2, '0')}s`
}

/** Podcast run sheets are relative offsets: 0 -> "00:00", 150 -> "02:30". */
export function formatOffset(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatEventDate(value)
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
}

const TYPE_LABELS: Record<string, string> = {
  conference: 'Conference', summit: 'Summit', in_person: 'In-Person',
  virtual: 'Virtual', hybrid: 'Hybrid', webinar: 'Webinar', podcast: 'Podcast',
  workshop: 'Workshop', roundtable: 'Roundtable', product_launch: 'Product Launch',
  networking: 'Networking', live_stream: 'Live Stream', customer_event: 'Customer Event',
  partner_event: 'Partner Event', internal_event: 'Internal Event',
}
export function eventTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? titleCase(type)
}

export function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Location for in-person events, platform for online ones. */
export function eventLocationLabel(event: {
  format: string
  location_city: string | null
  location_country: string | null
  location_name: string | null
  online_platform: string | null
}): string {
  if (event.format === 'virtual') return event.online_platform ?? 'Online'
  const city = [event.location_city, event.location_country].filter(Boolean).join(', ')
  if (event.format === 'hybrid') {
    return city ? `${city} + ${event.online_platform ?? 'Online'}` : (event.online_platform ?? 'Hybrid')
  }
  return city || event.location_name || '—'
}
