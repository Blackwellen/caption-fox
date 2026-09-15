/**
 * CSV cell encoding for exports. Quotes cells containing separators, quotes or
 * newlines, and neutralises text that a spreadsheet would evaluate as a
 * formula (CSV injection) by prefixing an apostrophe. Numbers — including
 * negative day counts — are left untouched.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',')
}

/** UTF-8 BOM so Excel opens accented names correctly. */
export const CSV_BOM = '﻿'
