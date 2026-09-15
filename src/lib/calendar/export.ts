// Export + import serialisation for the Calendar module.
//
// Exports always reflect the caller's current workspace, route, view, date
// range, filters, search and permissions — the caller passes the already
// filtered, already permission-checked rows.

import type { CalendarConflict, QueueItem, ScheduleEntry } from './types'
import { CONFLICT_TYPE_LABELS } from './queries'
import { formatDateTime, formatShortDate } from './dates'

// ── CSV ─────────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Guard against CSV/formula injection in spreadsheet apps.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  // BOM so Excel opens UTF-8 correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function scheduleToCsv(entries: ScheduleEntry[], timeZone: string, locale: string): string {
  return toCsv(
    ['Title', 'Type', 'Start', 'End', 'All day', 'Timezone', 'Status', 'Priority', 'Channel', 'Campaign', 'Owner', 'Team', 'Conflicts'],
    entries.map(e => [
      e.title, e.kind,
      e.allDay ? formatShortDate(e.startAt, timeZone, locale) : formatDateTime(e.startAt, timeZone, locale),
      e.endAt ? formatDateTime(e.endAt, timeZone, locale) : '',
      e.allDay ? 'Yes' : 'No', e.timezone, e.status, e.priority,
      e.channel ?? '', e.campaignName ?? '', e.ownerName ?? '', e.team ?? '',
      e.conflictIds.length,
    ]),
  )
}

export function queueToCsv(items: QueueItem[], timeZone: string, locale: string): string {
  return toCsv(
    ['Item', 'Channel', 'Campaign', 'Owner', 'Scheduled time', 'Approval status', 'Delivery status', 'Priority', 'Provider account', 'Attempts', 'Published at', 'Failure'],
    items.map(i => [
      i.title, i.channel ?? '', i.campaignName ?? '', i.ownerName ?? '',
      i.scheduledAt ? formatDateTime(i.scheduledAt, timeZone, locale) : '',
      i.approvalStatus, i.deliveryStatus, i.priority,
      i.providerAccountName ?? '', i.attemptCount,
      i.publishedAt ? formatDateTime(i.publishedAt, timeZone, locale) : '',
      i.failureCode ?? '',
    ]),
  )
}

export function conflictsToCsv(conflicts: CalendarConflict[], timeZone: string, locale: string): string {
  return toCsv(
    ['ID', 'Conflict title', 'Type', 'Severity', 'Impact', 'Channels', 'Campaign', 'Owner', 'Assignee', 'Detected', 'Due date', 'Status', 'Resolution notes'],
    conflicts.map(c => [
      c.reference, c.title, CONFLICT_TYPE_LABELS[c.type], c.severity, c.impact,
      c.channels.join(' / '), c.campaignName ?? '', c.ownerName ?? '', c.assigneeName ?? '',
      formatDateTime(c.detectedAt, timeZone, locale),
      c.dueAt ? formatShortDate(c.dueAt, timeZone, locale) : '',
      c.status, c.resolutionNotes ?? '',
    ]),
  )
}

// ── ICS (RFC 5545) ──────────────────────────────────────────────────────────

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545 requires lines to be folded at 75 octets. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) { parts.push(` ${rest.slice(0, 74)}`); rest = rest.slice(74) }
  if (rest) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsDate(iso: string): string {
  return icsStamp(iso).slice(0, 8)
}

export function scheduleToIcs(entries: ScheduleEntry[], opts: { workspaceName: string; timeZone: string }): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Caption Fox//Campaign Manager Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.workspaceName)} — Caption Fox Calendar`,
    `X-WR-TIMEZONE:${opts.timeZone}`,
  ]

  for (const entry of entries) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${entry.id}@captionfox`)
    lines.push(`DTSTAMP:${icsStamp(new Date().toISOString())}`)
    if (entry.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(entry.startAt)}`)
      const end = entry.endAt ?? new Date(new Date(entry.startAt).getTime() + 86400000).toISOString()
      lines.push(`DTEND;VALUE=DATE:${icsDate(end)}`)
    } else {
      lines.push(`DTSTART:${icsStamp(entry.startAt)}`)
      const end = entry.endAt ?? new Date(new Date(entry.startAt).getTime() + 30 * 60000).toISOString()
      lines.push(`DTEND:${icsStamp(end)}`)
    }
    lines.push(`SUMMARY:${icsEscape(entry.title)}`)
    const description = [
      entry.subtitle,
      entry.campaignName ? `Campaign: ${entry.campaignName}` : null,
      entry.ownerName ? `Owner: ${entry.ownerName}` : null,
      `Status: ${entry.status}`,
    ].filter(Boolean).join('\n')
    if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`)
    if (entry.channel) lines.push(`CATEGORIES:${icsEscape(entry.channel)}`)
    lines.push(`STATUS:${entry.status === 'cancelled' ? 'CANCELLED' : entry.status === 'draft' ? 'TENTATIVE' : 'CONFIRMED'}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

// ── ICS import ──────────────────────────────────────────────────────────────

export interface ParsedIcsEvent {
  uid: string | null
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  location: string | null
  recurrenceRule: string | null
}

export interface IcsParseResult {
  events: ParsedIcsEvent[]
  invalidRows: { line: number; reason: string }[]
}

function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
}

function parseIcsDate(raw: string, params: Record<string, string>): { iso: string; allDay: boolean } | null {
  const value = raw.trim()
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
    if (!m) return null
    // All-day events are anchored to the calendar date and never shifted.
    return { iso: `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`, allDay: true }
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (z) return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`, allDay: false }
  // Floating or TZID time — the caller resolves it against the workspace zone.
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}`, allDay: false }
}

export function parseIcs(text: string): IcsParseResult {
  const lines = unfold(text)
  const events: ParsedIcsEvent[] = []
  const invalidRows: { line: number; reason: string }[] = []

  let current: Partial<ParsedIcsEvent> & { _line?: number } | null = null

  lines.forEach((line, index) => {
    if (line === 'BEGIN:VEVENT') { current = { _line: index + 1 }; return }
    if (line === 'END:VEVENT') {
      if (!current) return
      if (!current.title || !current.startAt) {
        invalidRows.push({ line: current._line ?? index, reason: 'Missing SUMMARY or DTSTART' })
      } else {
        events.push({
          uid: current.uid ?? null,
          title: current.title,
          description: current.description ?? null,
          startAt: current.startAt,
          endAt: current.endAt ?? null,
          allDay: current.allDay ?? false,
          location: current.location ?? null,
          recurrenceRule: current.recurrenceRule ?? null,
        })
      }
      current = null
      return
    }
    if (!current) return

    const sep = line.indexOf(':')
    if (sep === -1) return
    const rawKey = line.slice(0, sep)
    const value = line.slice(sep + 1)
    const [key, ...paramParts] = rawKey.split(';')
    const params: Record<string, string> = {}
    for (const part of paramParts) {
      const [k, v] = part.split('=')
      if (k && v) params[k.toUpperCase()] = v
    }

    switch (key.toUpperCase()) {
      case 'UID': current.uid = value; break
      case 'SUMMARY': current.title = icsUnescape(value); break
      case 'DESCRIPTION': current.description = icsUnescape(value); break
      case 'LOCATION': current.location = icsUnescape(value); break
      case 'RRULE': current.recurrenceRule = value; break
      case 'DTSTART': {
        const parsed = parseIcsDate(value, params)
        if (!parsed) { invalidRows.push({ line: index + 1, reason: 'Unreadable DTSTART' }); break }
        current.startAt = parsed.iso
        current.allDay = parsed.allDay
        break
      }
      case 'DTEND': {
        const parsed = parseIcsDate(value, params)
        if (parsed) current.endAt = parsed.iso
        break
      }
    }
  })

  return { events, invalidRows }
}

function icsUnescape(text: string): string {
  return text.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

// ── CSV import ──────────────────────────────────────────────────────────────

export interface ParsedCsvRow { index: number; values: Record<string, string> }

export function parseCsv(text: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const clean = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let field = '', row: string[] = [], inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(field); field = ''; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    if (ch === '\r') continue
    field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const [headerRow = [], ...bodyRows] = rows.filter(r => r.some(cell => cell.trim() !== ''))
  const headers = headerRow.map(h => h.trim())
  return {
    headers,
    rows: bodyRows.map((values, index) => ({
      index: index + 2, // 1-based, accounting for the header row
      values: Object.fromEntries(headers.map((header, i) => [header, (values[i] ?? '').trim()])),
    })),
  }
}

export const CSV_IMPORT_TEMPLATE_HEADERS = [
  'Title', 'Type', 'Start', 'End', 'All day', 'Status', 'Priority', 'Channel', 'Campaign', 'Owner email', 'Description',
]

export function importTemplateCsv(): string {
  return toCsv(CSV_IMPORT_TEMPLATE_HEADERS, [[
    'Summer launch stand-up', 'meeting', '2026-09-01 09:00', '2026-09-01 09:30',
    'No', 'scheduled', 'high', 'internal', '', '', 'Weekly alignment',
  ]])
}

// ── Download helpers ────────────────────────────────────────────────────────

export const MIME = {
  csv: 'text/csv; charset=utf-8',
  ics: 'text/calendar; charset=utf-8',
} as const

export function exportFilename(prefix: string, extension: 'csv' | 'ics'): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `caption-fox-${prefix}-${stamp}.${extension}`
}
