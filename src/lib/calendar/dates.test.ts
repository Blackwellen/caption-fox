import { describe, expect, it } from 'vitest'
import {
  formValueToUtcIso, formatCompactWhen, monthGridDays, overlaps, timezoneLabel,
  zonedDateKey, zonedMinutes, zonedTimeToUtc,
} from './dates'

const LONDON = 'Europe/London'

describe('zonedTimeToUtc', () => {
  it('converts London summer time (BST, UTC+1)', () => {
    expect(zonedTimeToUtc(2026, 7, 1, 9, 0, LONDON).toISOString()).toBe('2026-07-01T08:00:00.000Z')
  })
  it('converts London winter time (GMT, UTC+0)', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, LONDON).toISOString()).toBe('2026-01-15T09:00:00.000Z')
  })
  it('rolls a non-existent spring-forward time forward instead of producing an invalid instant', () => {
    // 01:30 on 29 March 2026 does not exist in London (clocks jump 01:00 → 02:00).
    const result = zonedTimeToUtc(2026, 3, 29, 1, 30, LONDON)
    expect(Number.isNaN(result.getTime())).toBe(false)
    expect(zonedMinutes(result, LONDON)).toBe(2 * 60 + 30)
  })
})

describe('formValueToUtcIso', () => {
  it('parses a datetime-local value in the workspace timezone', () => {
    expect(formValueToUtcIso('2026-09-15T10:30', LONDON)).toBe('2026-09-15T09:30:00.000Z')
  })
  it('treats a date-only value as local midnight', () => {
    expect(formValueToUtcIso('2026-09-15', LONDON)).toBe('2026-09-14T23:00:00.000Z')
  })
  it('rejects malformed input rather than guessing', () => {
    expect(formValueToUtcIso('15/09/2026', LONDON)).toBeNull()
    expect(formValueToUtcIso('', LONDON)).toBeNull()
  })
})

describe('zonedDateKey', () => {
  it('uses the display timezone, not UTC, to decide the calendar day', () => {
    // 23:30 UTC on 1 July is 00:30 on 2 July in London.
    expect(zonedDateKey('2026-07-01T23:30:00.000Z', LONDON)).toBe('2026-07-02')
    expect(zonedDateKey('2026-07-01T23:30:00.000Z', 'UTC')).toBe('2026-07-01')
  })
})

describe('monthGridDays', () => {
  it('starts on the configured week start and marks trailing days', () => {
    const days = monthGridDays(new Date('2026-09-15T12:00:00.000Z'), 0, LONDON)
    expect(days).toHaveLength(42)
    expect(days[0].key).toBe('2026-08-30')
    expect(days[0].inMonth).toBe(false)
    expect(days[2].key).toBe('2026-09-01')
  })
  it('only needs a sixth row when the month genuinely spans six weeks', () => {
    // September 2026 fits in five rows; August 2026 (starts on a Saturday) needs six.
    expect(monthGridDays(new Date('2026-09-15T12:00:00.000Z'), 0, LONDON)[35].inMonth).toBe(false)
    expect(monthGridDays(new Date('2026-08-15T12:00:00.000Z'), 0, LONDON)[35].inMonth).toBe(true)
  })
})

describe('formatCompactWhen', () => {
  const now = new Date('2026-09-15T10:00:00.000Z')
  it('labels today and tomorrow relative to now, in the workspace timezone', () => {
    expect(formatCompactWhen('2026-09-15T14:00:00.000Z', LONDON, 'en-GB', now)).toMatch(/^Today, 03:00\sPM$/)
    expect(formatCompactWhen('2026-09-16T08:00:00.000Z', LONDON, 'en-GB', now)).toMatch(/^Tomorrow, 09:00\sAM$/)
  })
  it('falls back to a short date further out', () => {
    expect(formatCompactWhen('2026-09-21T09:00:00.000Z', LONDON, 'en-GB', now)).toMatch(/^21 Sept, 10:00\sAM$/)
  })
})

describe('timezoneLabel', () => {
  it('does not repeat a zone name that is its own abbreviation', () => {
    expect(timezoneLabel('UTC')).toBe('UTC')
  })
  it('adds the abbreviation where it is informative', () => {
    expect(timezoneLabel(LONDON, new Date('2026-07-01T12:00:00.000Z'))).toMatch(/^Europe\/London \(.+\)$/)
  })
})

describe('overlaps', () => {
  it('detects overlapping and back-to-back intervals correctly', () => {
    expect(overlaps('2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z', '2026-09-15T09:30:00Z', '2026-09-15T11:00:00Z')).toBe(true)
    expect(overlaps('2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z', '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z')).toBe(false)
  })
})
