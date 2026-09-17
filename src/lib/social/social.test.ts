import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { crc32, toCsv, toPdf, toXlsx, zipStored } from './export-formats'
import { compactNumber, performanceTier, toWeekly } from './metrics'
import { parseDays, parseEnum, parseId, parsePage, parseSearch, withParams } from './url-state'
import { safeReturnPath } from './oauth'

describe('url-state parsers', () => {
  it('clamps days to 1–365 and falls back on junk', () => {
    expect(parseDays('30')).toBe(30)
    expect(parseDays('9999')).toBe(365)
    expect(parseDays('0')).toBe(7)
    expect(parseDays('abc')).toBe(7)
    expect(parseDays(['14', '30'])).toBe(14)
    expect(parseDays(undefined, 30)).toBe(30)
  })

  it('only accepts listed enum values', () => {
    expect(parseEnum('queue', ['calendar', 'queue'] as const, 'calendar')).toBe('queue')
    expect(parseEnum('toString', ['calendar', 'queue'] as const, 'calendar')).toBe('calendar')
  })

  it('caps pages and rejects negative or non-numeric pages', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage('-2')).toBe(1)
    expect(parsePage('1e9')).toBe(1)
    expect(parsePage('99999999')).toBe(10_000)
  })

  it('accepts only UUIDs as ids', () => {
    expect(parseId('F07A1971-B495-4F4B-AD3B-6690CF58C75E')).toBe('f07a1971-b495-4f4b-ad3b-6690cf58c75e')
    expect(parseId("1' or '1'='1")).toBeNull()
    expect(parseId('../etc/passwd')).toBeNull()
  })

  it('strips PostgREST filter syntax from search and caps length', () => {
    expect(parseSearch('  caption,content.ilike.%admin%  ')).toBe('caption content.ilike. admin')
    expect(parseSearch('a'.repeat(500))?.length).toBe(120)
    expect(parseSearch('   ')).toBeNull()
  })

  it('rebuilds query strings, removing null keys', () => {
    expect(withParams({ view: 'queue', page: '3' }, { page: null, status: 'failed' })).toBe('?view=queue&status=failed')
    expect(withParams({}, {})).toBe('')
  })
})

describe('metrics formatting', () => {
  it('keeps trailing zeros on whole numbers (20K is not 2K)', () => {
    expect(compactNumber(20_000)).toBe('20K')
    expect(compactNumber(100_000)).toBe('100K')
    expect(compactNumber(1_500_000)).toBe('1.5M')
    expect(compactNumber(12_300)).toBe('12.3K')
    expect(compactNumber(1_240_000)).toBe('1.24M')
    expect(compactNumber(950)).toBe('950')
  })

  it('tiers content against the period mean and refuses to guess without data', () => {
    expect(performanceTier(0.0561, 0.0356)).toBe('top')
    expect(performanceTier(0.0214, 0.0356)).toBe('good')
    expect(performanceTier(0.0112, 0.0356)).toBe('average')
    expect(performanceTier(0.005, 0.0356)).toBe('low')
    expect(performanceTier(null, 0.0356)).toBeNull()
    expect(performanceTier(0.04, 0)).toBeNull()
  })

  it('rolls days into Monday-start weeks', () => {
    const weeks = toWeekly(
      [{ date: '2026-09-13', value: 1 }, { date: '2026-09-14', value: 2 }, { date: '2026-09-15', value: 3 }],
      items => ({ value: items.reduce((sum, item) => sum + item.value, 0) }),
    )
    expect(weeks).toEqual([{ date: '2026-09-07', value: 1 }, { date: '2026-09-14', value: 5 }])
  })
})

describe('export encoders', () => {
  it('escapes CSV quoting and blocks formula injection', () => {
    expect(toCsv([['name', 'note'], ['A, B', 'say "hi"'], ['=HYPERLINK("x")', 5]]))
      .toBe('name,note\r\n"A, B","say ""hi"""\r\n"\'=HYPERLINK(""x"")",5')
  })

  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926)
  })

  it('writes a valid stored ZIP with an end-of-central-directory record', () => {
    const zip = zipStored([{ name: 'a.txt', data: 'hello' }])
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034B50)
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054B50)
    expect(view.getUint16(zip.length - 12, true)).toBe(1)
  })

  it('produces an XLSX package with escaped cell text', () => {
    const bytes = toXlsx([['Title'], ['<script>&']], 'Posts/2026')
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('xl/worksheets/sheet1.xml')
    expect(text).toContain('&lt;script&gt;&amp;')
    expect(text).not.toContain('<script>&')
    expect(text).toContain('name="Posts 2026"')
  })

  it('produces a paginated PDF', () => {
    const rows = [['Name', 'Value'], ...Array.from({ length: 120 }, (_, index) => [`Row (${index})`, index])]
    const text = new TextDecoder('latin1').decode(toPdf(rows, 'Report', 'Subtitle'))
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toMatch(/\/Count [2-9]/)
    expect(text).toContain('Row \\(0\\)')
  })
})

describe('OAuth return path', () => {
  it('only allows same-origin relative paths', () => {
    expect(safeReturnPath('/brand/social/connections')).toBe('/brand/social/connections')
    expect(safeReturnPath('//evil.example')).toBe('/app/social/connections')
    expect(safeReturnPath('/\\evil.example')).toBe('/app/social/connections')
    expect(safeReturnPath('https://evil.example')).toBe('/app/social/connections')
    expect(safeReturnPath('/ok\nSet-Cookie: x')).toBe('/app/social/connections')
    expect(safeReturnPath(null)).toBe('/app/social/connections')
  })
})
