import { describe, expect, it } from 'vitest'
import {
  audienceFitBands, budgetAlignment, competitorGaps, cumulative, delta, ganttOffset, ganttWindow, quarterRollup, rangeForPreset,
  resolveRange, scenarioProbabilityError, strategyHealthScore, variancePct, wouldCreateCycle,
} from './metrics'
import {
  contentMatchesType, csvCell, FieldErrors, integer, isoDate, parseCsv, safeFileName, tags, text, toCsv, uuidList, amount,
} from './validation'
import {
  formatAgoLong, formatCompactMoney, formatDate, formatDueIn, formatSignedMoney, formatSignedPercent, objectiveRef, shortName,
} from './format'
import { canAccessStrategyModule, strategyCapabilities, visibleStrategyModules } from './entitlements'
import { canTransitionObjective, canTransitionPlan, canTransitionResearch, strategyPath } from './constants'

const NOW = new Date('2026-09-16T10:00:00')

describe('date ranges', () => {
  it('aligns presets to calendar quarters and months', () => {
    expect(rangeForPreset('this_quarter', NOW)).toMatchObject({ from: '2026-07-01', to: '2026-09-30' })
    expect(rangeForPreset('last_quarter', NOW)).toMatchObject({ from: '2026-04-01', to: '2026-06-30' })
    expect(rangeForPreset('this_month', NOW)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
    expect(rangeForPreset('this_year', NOW)).toMatchObject({ from: '2026-01-01', to: '2026-12-31' })
    expect(rangeForPreset('all', NOW)).toMatchObject({ from: '', to: '' })
  })
  it('accepts valid custom ranges and rejects reversed or malformed ones', () => {
    expect(resolveRange({ range: 'custom', from: '2026-02-01', to: '2026-03-31' }, 'this_quarter', NOW)).toMatchObject({ preset: 'custom', from: '2026-02-01' })
    expect(resolveRange({ range: 'custom', from: '2026-03-31', to: '2026-02-01' }, 'this_quarter', NOW).preset).toBe('this_quarter')
    expect(resolveRange({ range: 'custom', from: 'x', to: '2026-02-01' }, 'this_month', NOW).preset).toBe('this_month')
    expect(resolveRange({ range: 'nonsense' }, 'this_year', NOW).preset).toBe('this_year')
  })
})

describe('metrics', () => {
  it('computes deltas only when a prior value exists', () => {
    expect(delta(10, 8)).toEqual({ value: 2, direction: 'up' })
    expect(delta(5, 7)).toEqual({ value: -2, direction: 'down' })
    expect(delta(5, 5)?.direction).toBe('flat')
    expect(delta(5, null)).toBeNull()
    expect(delta(Number.NaN, 3)).toBeNull()
  })
  it('weights health across present modules only', () => {
    expect(strategyHealthScore({ objectives: 80, research: 80, positioning: 80, plans: 80 })).toBe(80)
    expect(strategyHealthScore({ objectives: 100, research: null })).toBe(100)
    expect(strategyHealthScore({})).toBe(0)
  })
  it('scores budget alignment against progress', () => {
    expect(budgetAlignment([{ budget: 100, spent: 50, progress: 50 }])).toBe(100)
    expect(budgetAlignment([{ budget: 100, spent: 90, progress: 50 }])).toBe(60)
    expect(budgetAlignment([{ budget: null, spent: 10, progress: 5 }])).toBe(100)
  })
  it('bands audience fit by size', () => {
    const bands = audienceFitBands([{ fit_score: 90, audience_size: 300 }, { fit_score: 75, audience_size: 100 }, { fit_score: 40, audience_size: 100 }])
    expect(bands).toMatchObject({ high: 60, aligned: 20, low: 20, strongFit: 80 })
    expect(audienceFitBands([]).strongFit).toBe(0)
  })
  it('counts competitor gaps only where we are strong and they are weak', () => {
    const competitors = [{ id: 'us', is_self: true }, { id: 'them', is_self: false }]
    const scores = [
      { competitor_id: 'us', attribute_id: 'a', score: 'strong' }, { competitor_id: 'them', attribute_id: 'a', score: 'weak' },
      { competitor_id: 'us', attribute_id: 'b', score: 'moderate' }, { competitor_id: 'them', attribute_id: 'b', score: 'na' },
    ]
    expect(competitorGaps(competitors, scores)).toBe(1)
    expect(competitorGaps([{ id: 'them', is_self: false }], scores)).toBe(0)
  })
  it('validates scenario probabilities', () => {
    expect(scenarioProbabilityError([25, 50, 25])).toBeNull()
    expect(scenarioProbabilityError([25, 50, 20])).toMatch(/total 100%/)
    expect(scenarioProbabilityError([50.5, 49.5])).toMatch(/whole number/)
    expect(scenarioProbabilityError([])).toMatch(/at least one/)
  })
  it('computes variance and running totals', () => {
    expect(variancePct(23.8, 22)).toBe(8.2)
    expect(variancePct(10, 0)).toBe(0)
    const running = cumulative([
      { date: '2026-01-01', label: 'Jan', target: 10, forecast: 12, actual: 11 },
      { date: '2026-02-01', label: 'Feb', target: 10, forecast: 8, actual: null },
    ])
    expect(running[1]).toMatchObject({ target: 20, forecast: 20, actual: null })
    expect(running[0].actual).toBe(11)
  })
  it('rolls months into quarters with a full-year total', () => {
    const { quarters, total } = quarterRollup(['01', '02', '04'].map(month => ({ date: `2026-${month}-01`, target: 1, forecast: 2 })))
    expect(quarters.map(row => row.label)).toEqual(['Q1 2026', 'Q2 2026'])
    expect(total).toMatchObject({ target: 3, forecast: 6, label: 'FY 2026' })
  })
  it('detects dependency cycles, including self-dependency', () => {
    const edges = [{ plan_id: 'a', depends_on_plan_id: 'b' }, { plan_id: 'b', depends_on_plan_id: 'c' }]
    expect(wouldCreateCycle(edges, 'c', 'a')).toBe(true)
    expect(wouldCreateCycle(edges, 'a', 'a')).toBe(true)
    expect(wouldCreateCycle(edges, 'a', 'c')).toBe(false)
  })
  it('builds a padded Gantt window and clamps offsets', () => {
    const window = ganttWindow(['2026-09-01', '2026-10-15'], 'months', NOW)
    expect(window.start.getDate()).toBe(1)
    expect(window.columns.length).toBeGreaterThanOrEqual(2)
    expect(ganttOffset('1999-01-01', window.start, window.end)).toBe(0)
    expect(ganttOffset('2099-01-01', window.start, window.end)).toBe(1)
  })
})

describe('validation', () => {
  it('trims text, strips control characters and enforces limits', () => {
    const errors = new FieldErrors()
    expect(text(errors, 'name', `  Hello${String.fromCharCode(7)} `, { label: 'Name', required: true, max: 10 })).toBe('Hello')
    text(errors, 'blank', '   ', { label: 'Blank', required: true })
    text(errors, 'long', 'x'.repeat(11), { label: 'Long', max: 10 })
    expect(errors.errors).toMatchObject({ blank: 'Blank is required.', long: 'Long must be 10 characters or fewer.' })
  })
  it('rejects impossible dates and out-of-range numbers', () => {
    const errors = new FieldErrors()
    expect(isoDate(errors, 'a', '2026-02-30', { label: 'Date' })).toBeNull()
    expect(isoDate(errors, 'b', '2026-02-28', { label: 'Date' })).toBe('2026-02-28')
    expect(integer(errors, 'c', '101', { label: 'Progress', min: 0, max: 100 })).toBeNull()
    expect(integer(errors, 'd', '4.5', { label: 'Progress', min: 0, max: 100 })).toBeNull()
    expect(amount(errors, 'e', '£1,240.50', { label: 'Budget' })).toBe(1240.5)
    expect(Object.keys(errors.errors)).toEqual(['a', 'c', 'd'])
  })
  it('cleans tags and uuid lists', () => {
    expect(tags(' Gen Z , gen z,Gen Z,  ,' + 'x'.repeat(41))).toEqual(['Gen Z', 'gen z'])
    expect(uuidList('not-a-uuid,d7b7c61e-7685-4b15-8a0c-d9fa85f25103')).toEqual(['d7b7c61e-7685-4b15-8a0c-d9fa85f25103'])
  })
  it('parses quoted CSV and neutralises formula injection on export', () => {
    expect(parseCsv('name,notes\r\n"Acme, Ltd","said ""hi"""\n\n')).toEqual([['name', 'notes'], ['Acme, Ltd', 'said "hi"']])
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell(-12.5)).toBe('-12.5')
    expect(csvCell(['a', 'b'])).toBe('a; b')
    expect(toCsv(['A'], [['+cmd']])).toBe("A\r\n'+cmd")
  })
  it('checks file signatures and sanitises names', () => {
    expect(contentMatchesType('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true)
    expect(contentMatchesType('application/pdf', new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBe(false)
    expect(contentMatchesType('text/csv', new Uint8Array([0x61, 0x00, 0x62]))).toBe(false)
    expect(contentMatchesType('application/x-msdownload', new Uint8Array([0x4d, 0x5a, 0, 0]))).toBe(false)
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('Q3 report (final).PDF')).toBe('Q3-report-final.pdf')
  })
})

describe('formatting', () => {
  it('formats UK money, percentages and dates', () => {
    expect(formatCompactMoney(23_800_000)).toBe('£23.8M')
    expect(formatSignedMoney(-600_000)).toBe('-£600.0K')
    expect(formatSignedPercent(8.64)).toBe('+8.6%')
    expect(formatSignedPercent(-0.01)).toBe('0.0%')
    expect(formatDate('2026-09-30')).toMatch(/30 Sept? 2026/)
    expect(formatDate(null)).toBe('—')
  })
  it('describes relative dates', () => {
    expect(formatDueIn('2026-09-21', NOW)).toBe('In 5 days')
    expect(formatDueIn('2026-09-15', NOW)).toBe('1 day overdue')
    expect(formatAgoLong('2026-09-14T09:00:00', NOW)).toBe('2 days ago')
    expect(shortName('Emma Davis')).toBe('Emma D.')
    expect(shortName('')).toBe('Unassigned')
    expect(objectiveRef(7)).toBe('OBJ-07')
  })
})

describe('entitlements and workflow rules', () => {
  const base = { workspaceId: 'w', workspaceType: 'brand', plan: 'team', planStatus: 'active', role: 'owner', isPlatformAdmin: false, flags: {} }
  it('hides Strategy from creator workspaces and forecasts from Business below Brand plan', () => {
    expect(canAccessStrategyModule({ ...base, workspaceType: 'creator' }, 'overview').allowed).toBe(false)
    expect(visibleStrategyModules(base)).toContain('forecasts')
    expect(visibleStrategyModules({ ...base, workspaceType: 'small_business' })).not.toContain('forecasts')
  })
  it('gives viewers read + export only (same as every other module), never a mutation', () => {
    const caps = strategyCapabilities({ ...base, role: 'viewer' })
    expect(caps.view).toBe(true)
    expect(caps.export).toBe(true)
    const mutations = Object.entries(caps).filter(([key, value]) => value && key !== 'view' && key !== 'export').map(([key]) => key)
    expect(mutations).toEqual([])
  })
  it('keeps members read-only and lets managers edit without approving deletions', () => {
    const member = strategyCapabilities({ ...base, role: 'member' })
    expect(member.view).toBe(true)
    expect(member.createObjective || member.editPlan || member.uploadResearch).toBe(false)
    const manager = strategyCapabilities({ ...base, role: 'manager' })
    expect(manager.createObjective && manager.editPlan).toBe(true)
  })
  it('enforces status transitions', () => {
    expect(canTransitionObjective('completed', 'at_risk')).toBe(false)
    expect(canTransitionObjective('on_track', 'completed')).toBe(true)
    expect(canTransitionResearch('draft', 'approved')).toBe(false)
    expect(canTransitionResearch('in_review', 'approved')).toBe(true)
    expect(canTransitionPlan('archived', 'on_track')).toBe(false)
  })
  it('builds canonical routes', () => {
    expect(strategyPath('brand')).toBe('/brand/strategy')
    expect(strategyPath('agency', 'plans', 'abc')).toBe('/agency/strategy/plans/abc')
  })
})
