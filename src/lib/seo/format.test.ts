import { describe, expect, it } from 'vitest'
import {
  absoluteChange, dueLabel, formatCompact, formatCurrency, formatDecimal, formatNumber,
  formatPercent, formatRank, humanise, percentChange,
} from './format'

describe('formatNumber / formatCompact', () => {
  it('formats null/undefined as an em dash', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatCompact(undefined)).toBe('—')
  })
  it('formats large numbers with UK grouping', () => {
    expect(formatNumber(12345)).toBe('12,345')
  })
  it('compacts large numbers but not small ones', () => {
    expect(formatCompact(999)).toBe('999')
    expect(formatCompact(1500)).toMatch(/1\.5K/)
  })
})

describe('formatPercent / formatDecimal', () => {
  it('renders one decimal place by default', () => {
    expect(formatPercent(62.44)).toBe('62.4%')
  })
  it('handles null gracefully', () => {
    expect(formatDecimal(null)).toBe('—')
  })
})

describe('formatCurrency', () => {
  it('formats as GBP', () => {
    expect(formatCurrency(3.5)).toBe('£3.50')
  })
})

describe('formatRank', () => {
  it('never renders a null rank as position 0', () => {
    expect(formatRank(null)).toBe('Not ranking')
  })
  it('renders a real rank with a hash prefix', () => {
    expect(formatRank(6)).toBe('#6')
  })
})

describe('dueLabel', () => {
  it('flags a past date as overdue', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    expect(dueLabel(yesterday)).toEqual({ text: 'Overdue', overdue: true })
  })
  it('reports no due date distinctly from overdue', () => {
    expect(dueLabel(null)).toEqual({ text: 'No due date', overdue: false })
  })
  it('reports today distinctly', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(dueLabel(today).text).toBe('Due today')
  })
})

describe('percentChange / absoluteChange', () => {
  it('computes percent change correctly', () => {
    expect(percentChange(110, 100)).toBe(10)
  })
  it('returns null when the previous value is 0 or missing', () => {
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(10, null)).toBeNull()
  })
  it('computes absolute change to one decimal place', () => {
    expect(absoluteChange(62.44, 60.1)).toBeCloseTo(2.34, 1)
  })
})

describe('humanise', () => {
  it('uses the override table for known values', () => {
    expect(humanise('google_search_console')).toBe('Google Search Console')
    expect(humanise('not_ranking')).toBe('Not ranking')
  })
  it('title-cases unknown snake_case values', () => {
    expect(humanise('some_unknown_value')).toBe('Some Unknown Value')
  })
  it('handles null/undefined', () => {
    expect(humanise(null)).toBe('—')
  })
})
