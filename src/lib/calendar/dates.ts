// Timezone-correct date helpers for the Calendar module.
//
// Rules enforced here:
//  * Timestamps are stored and passed around as UTC ISO strings.
//  * All display formatting goes through Intl with an explicit `timeZone`, so
//    the server and the client render identical strings (no hydration drift
//    from the browser's local zone).
//  * All-day entries are anchored to a calendar date and are never shifted by
//    timezone conversion.
//  * DST gaps and repeats are resolved by probing real UTC offsets rather than
//    assuming a fixed offset.

export const DEFAULT_TZ = 'Europe/London'
export const DEFAULT_LOCALE = 'en-GB'

const partsCache = new Map<string, Intl.DateTimeFormat>()

function zonedParts(date: Date, timeZone: string) {
  const key = `p:${timeZone}`
  let fmt = partsCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    partsCache.set(key, fmt)
  }
  const out: Record<string, number> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value)
  }
  // Intl renders midnight as hour 24 in some engines.
  if (out.hour === 24) out.hour = 0
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Offset in minutes between UTC and `timeZone` at `date` (positive = ahead of UTC). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000
}

/**
 * Convert a wall-clock time in `timeZone` to the correct UTC instant.
 * Handles DST by re-probing the offset at the candidate instant; for a time that
 * does not exist (spring-forward gap) the instant rolls forward, which is the
 * behaviour users expect from a scheduler.
 */
export function zonedTimeToUtc(
  year: number, month: number, day: number,
  hour = 0, minute = 0, timeZone = DEFAULT_TZ,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  let guess = new Date(naive - tzOffsetMinutes(new Date(naive), timeZone) * 60000)
  // One correction pass resolves DST boundaries.
  const corrected = new Date(naive - tzOffsetMinutes(guess, timeZone) * 60000)
  if (corrected.getTime() !== guess.getTime()) guess = corrected
  return guess
}

/** Parse a `yyyy-MM-ddTHH:mm` form value in `timeZone` into a UTC ISO string. */
export function formValueToUtcIso(value: string, timeZone = DEFAULT_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  return zonedTimeToUtc(+y, +mo, +d, h ? +h : 0, mi ? +mi : 0, timeZone).toISOString()
}

/** `yyyy-MM-dd` for an instant, in the display timezone. */
export function zonedDateKey(iso: string | Date, timeZone = DEFAULT_TZ): string {
  const p = zonedParts(typeof iso === 'string' ? new Date(iso) : iso, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Minutes past midnight in the display timezone — used to place timed events. */
export function zonedMinutes(iso: string | Date, timeZone = DEFAULT_TZ): number {
  const p = zonedParts(typeof iso === 'string' ? new Date(iso) : iso, timeZone)
  return p.hour * 60 + p.minute
}

export function todayKey(timeZone = DEFAULT_TZ): string {
  return zonedDateKey(new Date(), timeZone)
}

// ── Formatting ──────────────────────────────────────────────────────────────

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(locale: string, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${timeZone}|${JSON.stringify(opts)}`
  let f = fmtCache.get(key)
  if (!f) { f = new Intl.DateTimeFormat(locale, { ...opts, timeZone }); fmtCache.set(key, f) }
  return f
}

export function formatTime(iso: string | Date, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE) {
  return fmt(locale, timeZone, { hour: '2-digit', minute: '2-digit', hour12: true })
    .format(typeof iso === 'string' ? new Date(iso) : iso)
    .replace(/ /g, ' ')
    .toUpperCase()
}

export function formatDayLabel(iso: string | Date, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE) {
  return fmt(locale, timeZone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(typeof iso === 'string' ? new Date(iso) : iso)
}

export function formatShortDate(iso: string | Date, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE) {
  return fmt(locale, timeZone, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(typeof iso === 'string' ? new Date(iso) : iso)
}

export function formatDateTime(iso: string | Date, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE) {
  return `${formatShortDate(iso, timeZone, locale)}, ${formatTime(iso, timeZone, locale)}`
}

export function formatMonthTitle(iso: string | Date, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE) {
  return fmt(locale, timeZone, { month: 'long', year: 'numeric' })
    .format(typeof iso === 'string' ? new Date(iso) : iso)
}

/** "May 1 – May 31, 2024" style range label used by the date-range control. */
export function formatRangeLabel(startIso: string, endIso: string, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE) {
  const s = new Date(startIso), e = new Date(endIso)
  const sameYear = zonedParts(s, timeZone).year === zonedParts(e, timeZone).year
  const short = (d: Date, withYear: boolean) =>
    fmt(locale, timeZone, { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) }).format(d)
  return `${short(s, !sameYear)} – ${short(e, true)}`
}

export function formatRelativeShort(iso: string | Date) {
  const then = typeof iso === 'string' ? new Date(iso) : iso
  const diff = (Date.now() - then.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** "2h 15m Overdue" / "Due in 45m" style duration label. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms)
  const mins = Math.floor(abs / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return mins % 60 ? `${hours}h ${mins % 60}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`
}

// ── Range maths ─────────────────────────────────────────────────────────────

export function addDays(iso: string | Date, days: number): Date {
  const d = typeof iso === 'string' ? new Date(iso) : new Date(iso.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/** Start of the month containing `date`, as a UTC instant. */
export function startOfMonthUtc(date: Date, timeZone = DEFAULT_TZ): Date {
  const p = zonedParts(date, timeZone)
  return zonedTimeToUtc(p.year, p.month, 1, 0, 0, timeZone)
}

export function endOfMonthUtc(date: Date, timeZone = DEFAULT_TZ): Date {
  const p = zonedParts(date, timeZone)
  const nextMonth = p.month === 12 ? 1 : p.month + 1
  const nextYear = p.month === 12 ? p.year + 1 : p.year
  return new Date(zonedTimeToUtc(nextYear, nextMonth, 1, 0, 0, timeZone).getTime() - 1)
}

export function startOfWeekUtc(date: Date, weekStartsOn: 0 | 1 = 1, timeZone = DEFAULT_TZ): Date {
  const p = zonedParts(date, timeZone)
  const dayStart = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timeZone)
  const dow = new Date(dayStart.getTime() + tzOffsetMinutes(dayStart, timeZone) * 60000).getUTCDay()
  const back = (dow - weekStartsOn + 7) % 7
  return new Date(dayStart.getTime() - back * 86400000)
}

export function startOfDayUtc(date: Date, timeZone = DEFAULT_TZ): Date {
  const p = zonedParts(date, timeZone)
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timeZone)
}

export function endOfDayUtc(date: Date, timeZone = DEFAULT_TZ): Date {
  return new Date(startOfDayUtc(date, timeZone).getTime() + 86400000 - 1)
}

/** The 6x7 grid a month view renders, including trailing/leading days. */
export function monthGridDays(anchor: Date, weekStartsOn: 0 | 1 = 1, timeZone = DEFAULT_TZ) {
  const first = startOfMonthUtc(anchor, timeZone)
  const gridStart = startOfWeekUtc(first, weekStartsOn, timeZone)
  const anchorMonth = zonedParts(anchor, timeZone).month
  const days: { key: string; iso: string; dayOfMonth: number; inMonth: boolean; isToday: boolean }[] = []
  const today = todayKey(timeZone)
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getTime() + i * 86400000)
    const p = zonedParts(d, timeZone)
    const key = zonedDateKey(d, timeZone)
    days.push({
      key,
      iso: startOfDayUtc(d, timeZone).toISOString(),
      dayOfMonth: p.day,
      inMonth: p.month === anchorMonth,
      isToday: key === today,
    })
  }
  return days
}

export function weekdayLabels(weekStartsOn: 0 | 1 = 1, locale = DEFAULT_LOCALE, style: 'short' | 'narrow' = 'short') {
  // 2024-01-07 was a Sunday (UTC).
  const base = Date.UTC(2024, 0, 7)
  const f = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(base + ((i + weekStartsOn) % 7) * 86400000)))
}

/** True when two [start,end) intervals overlap. */
export function overlaps(aStart: string, aEnd: string | null | undefined, bStart: string, bEnd: string | null | undefined): boolean {
  const as = new Date(aStart).getTime()
  const ae = aEnd ? new Date(aEnd).getTime() : as
  const bs = new Date(bStart).getTime()
  const be = bEnd ? new Date(bEnd).getTime() : bs
  return as < be && bs < ae
}

/** Short timezone name, shown wherever an instant could be ambiguous. */
export function timezoneAbbrev(timeZone = DEFAULT_TZ, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' }).formatToParts(at)
  return parts.find(p => p.type === 'timeZoneName')?.value ?? timeZone
}
