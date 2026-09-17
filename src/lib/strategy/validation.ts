// Input validation for Strategy server actions and API routes. Pure and
// dependency-free so the same rules run in unit tests. Every validator returns
// either a cleaned value or a human-readable error bound to a field name.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class FieldErrors {
  errors: Record<string, string> = {}
  add(field: string, message: string) { if (!this.errors[field]) this.errors[field] = message }
  get ok() { return Object.keys(this.errors).length === 0 }
  get first() { return Object.values(this.errors)[0] ?? null }
}

/** Trimmed text; strips control characters. Returns null when blank and optional. */
export function text(
  errors: FieldErrors, field: string, value: unknown,
  opts: { label: string; required?: boolean; max?: number; min?: number },
): string | null {
  const raw = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  if (!cleaned) {
    if (opts.required) errors.add(field, `${opts.label} is required.`)
    return null
  }
  if (opts.min && cleaned.length < opts.min) errors.add(field, `${opts.label} must be at least ${opts.min} characters.`)
  if (opts.max && cleaned.length > opts.max) errors.add(field, `${opts.label} must be ${opts.max} characters or fewer.`)
  return cleaned
}

export function oneOf<T extends string>(
  errors: FieldErrors, field: string, value: unknown, allowed: readonly T[],
  opts: { label: string; fallback?: T; required?: boolean },
): T | null {
  if (value === undefined || value === null || value === '') {
    if (opts.required && opts.fallback === undefined) errors.add(field, `${opts.label} is required.`)
    return opts.fallback ?? null
  }
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  errors.add(field, `Choose a valid ${opts.label.toLowerCase()}.`)
  return opts.fallback ?? null
}

export function isoDate(
  errors: FieldErrors, field: string, value: unknown, opts: { label: string; required?: boolean },
): string | null {
  if (value === undefined || value === null || value === '') {
    if (opts.required) errors.add(field, `${opts.label} is required.`)
    return null
  }
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.add(field, `${opts.label} must be a valid date.`)
    return null
  }
  const [y, m, d] = value.split('-').map(Number)
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    errors.add(field, `${opts.label} must be a valid date.`)
    return null
  }
  if (y < 2000 || y > 2100) {
    errors.add(field, `${opts.label} must be between 2000 and 2100.`)
    return null
  }
  return value
}

export function dateOrder(errors: FieldErrors, field: string, start: string | null, end: string | null, message: string) {
  if (start && end && end < start) errors.add(field, message)
}

export function integer(
  errors: FieldErrors, field: string, value: unknown,
  opts: { label: string; min: number; max: number; required?: boolean; fallback?: number },
): number | null {
  if (value === undefined || value === null || value === '') {
    if (opts.required && opts.fallback === undefined) errors.add(field, `${opts.label} is required.`)
    return opts.fallback ?? null
  }
  const number = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    errors.add(field, `${opts.label} must be a whole number.`)
    return opts.fallback ?? null
  }
  if (number < opts.min || number > opts.max) {
    errors.add(field, `${opts.label} must be between ${opts.min} and ${opts.max}.`)
    return opts.fallback ?? null
  }
  return number
}

/** Money / numeric amount: accepts "£1,240.50", "1240.5", "-600000". */
export function amount(
  errors: FieldErrors, field: string, value: unknown,
  opts: { label: string; required?: boolean; min?: number; max?: number },
): number | null {
  if (value === undefined || value === null || value === '') {
    if (opts.required) errors.add(field, `${opts.label} is required.`)
    return null
  }
  const cleaned = typeof value === 'number' ? value : Number(String(value).replace(/[£$€,\s]/g, ''))
  if (!Number.isFinite(cleaned)) {
    errors.add(field, `${opts.label} must be a number.`)
    return null
  }
  const min = opts.min ?? -1e13
  const max = opts.max ?? 1e13
  if (cleaned < min || cleaned > max) {
    errors.add(field, `${opts.label} is out of range.`)
    return null
  }
  return Math.round(cleaned * 100) / 100
}

export function uuid(errors: FieldErrors, field: string, value: unknown, opts: { label: string; required?: boolean }): string | null {
  if (value === undefined || value === null || value === '') {
    if (opts.required) errors.add(field, `${opts.label} is required.`)
    return null
  }
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    errors.add(field, `${opts.label} is not valid.`)
    return null
  }
  return value
}

export function uuidList(value: unknown, max = 200): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(list.map(item => String(item).trim()).filter(item => UUID_RE.test(item)))].slice(0, max)
}

/** Tags: trimmed, de-duplicated, 1–40 chars each, at most 12. */
export function tags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(list.map(item => String(item).replace(/\s+/g, ' ').trim()).filter(item => item.length > 0 && item.length <= 40))].slice(0, 12)
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(field); field = ''
      if (row.some(cell => cell.trim() !== '')) rows.push(row)
      row = []
    } else field += char
  }
  row.push(field)
  if (row.some(cell => cell.trim() !== '')) rows.push(row)
  return rows
}

/** Neutralises spreadsheet formula injection in exported cells. */
export function csvCell(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let textValue = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value)
  if (/^[=+\-@\t\r]/.test(textValue)) textValue = `'${textValue}`
  return /[",\n\r]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n')
}

// ── Uploads ──────────────────────────────────────────────────────────────────

/** Safe storage filename: ASCII word chars, dots and dashes; keeps the extension. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const dot = base.lastIndexOf('.')
  const stem = (dot > 0 ? base.slice(0, dot) : base).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'file'
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : ''
  return ext ? `${stem}.${ext}` : stem
}

const MAGIC: Record<string, (bytes: Uint8Array) => boolean> = {
  'application/pdf': b => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  'image/png': b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  // OOXML documents are zip containers.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': b => b[0] === 0x50 && b[1] === 0x4b,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': b => b[0] === 0x50 && b[1] === 0x4b,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': b => b[0] === 0x50 && b[1] === 0x4b,
  'application/vnd.ms-excel': b => b[0] === 0xd0 && b[1] === 0xcf,
}

/** Confirms a file's leading bytes match its declared type; text types must be valid UTF-8 without NULs. */
export function contentMatchesType(mime: string, bytes: Uint8Array): boolean {
  const check = MAGIC[mime]
  if (check) return bytes.length >= 4 && check(bytes)
  if (mime === 'text/csv' || mime === 'text/plain') {
    if (bytes.includes(0)) return false
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 65536), { stream: true }); return true } catch { return false }
  }
  return false
}
