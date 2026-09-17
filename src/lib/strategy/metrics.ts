// Pure Strategy calculations. No I/O — the data layer feeds rows in, pages
// render what comes out, and every rule here is covered by unit tests.

// ── Date ranges ──────────────────────────────────────────────────────────────

export const RANGE_PRESETS = ['this_quarter', 'last_quarter', 'this_month', 'this_year', 'last_12_months', 'all'] as const
export type RangePreset = typeof RANGE_PRESETS[number]

export interface DateRange { from: string; to: string; label: string; preset: RangePreset | 'custom' }

function iso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const SHORT_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Calendar-aligned range for a preset, evaluated in the server's local time. */
export function rangeForPreset(preset: RangePreset, now: Date = new Date()): DateRange {
  const y = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3)
  switch (preset) {
    case 'this_quarter': {
      const from = new Date(y, q * 3, 1)
      const to = new Date(y, q * 3 + 3, 0)
      return { from: iso(from), to: iso(to), preset, label: `This quarter (${SHORT.format(from)} – ${SHORT.format(to)})` }
    }
    case 'last_quarter': {
      const from = new Date(y, q * 3 - 3, 1)
      const to = new Date(y, q * 3, 0)
      return { from: iso(from), to: iso(to), preset, label: `Last quarter (${SHORT.format(from)} – ${SHORT.format(to)})` }
    }
    case 'this_month': {
      const from = new Date(y, now.getMonth(), 1)
      const to = new Date(y, now.getMonth() + 1, 0)
      return { from: iso(from), to: iso(to), preset, label: `This month (${SHORT.format(from)} – ${SHORT.format(to)})` }
    }
    case 'this_year': {
      const from = new Date(y, 0, 1)
      const to = new Date(y, 11, 31)
      return { from: iso(from), to: iso(to), preset, label: `FY${y} (${SHORT.format(from)} – ${SHORT_YEAR.format(to)})` }
    }
    case 'last_12_months': {
      const from = new Date(y, now.getMonth() - 11, 1)
      const to = new Date(y, now.getMonth() + 1, 0)
      return { from: iso(from), to: iso(to), preset, label: 'Last 12 months' }
    }
    case 'all':
    default:
      return { from: '', to: '', preset: 'all', label: 'All time' }
  }
}

/** Resolves `?range=` / `?from=&to=` into a concrete range. Invalid input falls back. */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  fallback: RangePreset,
  now: Date = new Date(),
): DateRange {
  const isIso = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
  if (params.range === 'custom' && isIso(params.from) && isIso(params.to) && params.from! <= params.to!) {
    const from = new Date(`${params.from}T00:00:00`)
    const to = new Date(`${params.to}T00:00:00`)
    return { from: params.from!, to: params.to!, preset: 'custom', label: `${SHORT.format(from)} – ${SHORT_YEAR.format(to)}` }
  }
  const preset = (RANGE_PRESETS as readonly string[]).includes(params.range ?? '') ? params.range as RangePreset : fallback
  return rangeForPreset(preset, now)
}

/** First day of the month `offset` months before `now` (0 = this month). */
export function monthStart(offset = 0, now: Date = new Date()): string {
  return iso(new Date(now.getFullYear(), now.getMonth() - offset, 1))
}

// ── Deltas ───────────────────────────────────────────────────────────────────

export interface Delta { value: number; direction: 'up' | 'down' | 'flat' }

/** current − previous, or null when there is no prior period to compare with. */
export function delta(current: number | null | undefined, previous: number | null | undefined): Delta | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  const value = Math.round((current - previous) * 10) / 10
  return { value, direction: value > 0 ? 'up' : value < 0 ? 'down' : 'flat' }
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

export function average(values: number[]): number {
  const finite = values.filter(value => Number.isFinite(value))
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0
}

// ── Scores ───────────────────────────────────────────────────────────────────

/**
 * Strategy Health Score (0–100): objectives progress weighted by confidence,
 * research health, positioning health and plan completion. Missing modules
 * are excluded from the weighting rather than counted as zero.
 */
export function strategyHealthScore(parts: {
  objectives?: number | null
  research?: number | null
  positioning?: number | null
  plans?: number | null
}): number {
  const weights: [number | null | undefined, number][] = [
    [parts.objectives, 0.35], [parts.research, 0.2], [parts.positioning, 0.2], [parts.plans, 0.25],
  ]
  const present = weights.filter(([value]) => value !== null && value !== undefined && Number.isFinite(value))
  const totalWeight = present.reduce((sum, [, weight]) => sum + weight, 0)
  if (totalWeight === 0) return 0
  const score = present.reduce((sum, [value, weight]) => sum + (value as number) * weight, 0) / totalWeight
  return Math.max(0, Math.min(100, Math.round(score)))
}

export const CONFIDENCE_SCORE: Record<string, number> = { low: 40, medium: 65, high: 85 }

export function confidenceLabelFromScore(score: number): 'Low' | 'Medium' | 'High' {
  return score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'
}

/** Spend within budget = 100. Overspend lowers alignment proportionally. */
export function budgetAlignment(rows: { budget: number | null; spent: number; progress: number }[]): number {
  const budgeted = rows.filter(row => (row.budget ?? 0) > 0)
  if (budgeted.length === 0) return 100
  // Spend should track progress: 50% done with 50% spent is perfectly aligned.
  const scores = budgeted.map(row => {
    const spentPct = (row.spent / (row.budget as number)) * 100
    return Math.max(0, 100 - Math.abs(spentPct - row.progress))
  })
  return Math.round(average(scores))
}

/** Audience–message fit bands, weighted by audience size. */
export function audienceFitBands(rows: { fit_score: number; audience_size: number }[]) {
  const bands = { high: 0, aligned: 0, neutral: 0, low: 0 }
  let total = 0
  for (const row of rows) {
    const size = Math.max(0, Number(row.audience_size) || 0)
    total += size
    if (row.fit_score >= 85) bands.high += size
    else if (row.fit_score >= 70) bands.aligned += size
    else if (row.fit_score >= 55) bands.neutral += size
    else bands.low += size
  }
  const share = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0)
  const result = { high: share(bands.high), aligned: share(bands.aligned), neutral: share(bands.neutral), low: share(bands.low) }
  return { ...result, strongFit: result.high + result.aligned }
}

/**
 * Competitive gaps: attributes where a competitor scores Weak or N/A while we
 * score Strong — the openings our messaging should press.
 */
export function competitorGaps(
  competitors: { id: string; is_self: boolean }[],
  scores: { competitor_id: string; attribute_id: string; score: string }[],
): number {
  const self = competitors.find(row => row.is_self)
  if (!self) return 0
  const ours = new Map(scores.filter(row => row.competitor_id === self.id).map(row => [row.attribute_id, row.score]))
  const others = new Set(competitors.filter(row => !row.is_self).map(row => row.id))
  return scores.filter(row => others.has(row.competitor_id)
    && ours.get(row.attribute_id) === 'strong'
    && (row.score === 'weak' || row.score === 'na')).length
}

// ── Forecasts ────────────────────────────────────────────────────────────────

export function variancePct(forecast: number, target: number): number {
  return target !== 0 ? Math.round(((forecast - target) / Math.abs(target)) * 1000) / 10 : 0
}

/** Scenario probabilities must be whole numbers 0–100 and total exactly 100. */
export function scenarioProbabilityError(probabilities: number[]): string | null {
  if (probabilities.length === 0) return 'Add at least one scenario.'
  if (probabilities.some(value => !Number.isInteger(value) || value < 0 || value > 100)) {
    return 'Each probability must be a whole number between 0 and 100.'
  }
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  return total === 100 ? null : `Scenario probabilities must total 100% (currently ${total}%).`
}

export interface PeriodPoint { date: string; label: string; target: number; forecast: number; actual?: number | null }

/** Running totals, used by the "forecast over time" chart. */
export function cumulative(points: PeriodPoint[]): PeriodPoint[] {
  let target = 0
  let forecast = 0
  let actual = 0
  let actualOpen = true
  return points.map(point => {
    target += point.target
    forecast += point.forecast
    if (point.actual === null || point.actual === undefined) actualOpen = false
    else if (actualOpen) actual += point.actual
    return {
      ...point, target, forecast,
      actual: actualOpen && point.actual !== null && point.actual !== undefined ? actual : null,
    }
  })
}

/** Quarterly roll-up of monthly periods (Q1–Q4 plus a full-year row). */
export function quarterRollup(points: { date: string; target: number; forecast: number }[]) {
  const quarters = new Map<string, { key: string; label: string; target: number; forecast: number }>()
  let year = ''
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00`)
    year = String(date.getFullYear())
    const key = `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`
    const current = quarters.get(key) ?? { key, label: `Q${Math.floor(date.getMonth() / 3) + 1} ${year}`, target: 0, forecast: 0 }
    current.target += point.target
    current.forecast += point.forecast
    quarters.set(key, current)
  }
  const rows = [...quarters.values()]
  const total = rows.reduce((sum, row) => ({ target: sum.target + row.target, forecast: sum.forecast + row.forecast }), { target: 0, forecast: 0 })
  return { quarters: rows, total: { key: 'total', label: year ? `FY ${year}` : 'Total', ...total } }
}

// ── Plans ────────────────────────────────────────────────────────────────────

/** True when adding `from → dependsOn` would close a loop in the dependency graph. */
export function wouldCreateCycle(
  edges: { plan_id: string; depends_on_plan_id: string }[],
  from: string,
  dependsOn: string,
): boolean {
  if (from === dependsOn) return true
  const graph = new Map<string, string[]>()
  for (const edge of edges) {
    graph.set(edge.plan_id, [...(graph.get(edge.plan_id) ?? []), edge.depends_on_plan_id])
  }
  const stack = [dependsOn]
  const seen = new Set<string>()
  while (stack.length) {
    const node = stack.pop()!
    if (node === from) return true
    if (seen.has(node)) continue
    seen.add(node)
    stack.push(...(graph.get(node) ?? []))
  }
  return false
}

export const GANTT_SCALE_DAYS = { days: 1, weeks: 7, months: 30 } as const
export type GanttScaleId = keyof typeof GANTT_SCALE_DAYS

/** Gantt window: aligned to Monday (weeks) or the 1st (months), padded either side. */
export function ganttWindow(
  dates: (string | null | undefined)[],
  scale: GanttScaleId,
  now: Date = new Date(),
): { start: Date; end: Date; columns: Date[] } {
  const valid = dates.filter((value): value is string => !!value).map(value => new Date(`${value}T00:00:00`))
  const min = new Date(Math.min(now.getTime(), ...valid.map(date => date.getTime())))
  const max = new Date(Math.max(now.getTime(), ...valid.map(date => date.getTime())))

  const start = new Date(min)
  const end = new Date(max)
  if (scale === 'months') {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 1)
  } else if (scale === 'weeks') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7)
    end.setDate(end.getDate() + 14)
  } else {
    start.setDate(start.getDate() - 3)
    end.setDate(end.getDate() + 4)
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const columns: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end && columns.length < 400) {
    columns.push(new Date(cursor))
    if (scale === 'months') cursor.setMonth(cursor.getMonth() + 1)
    else cursor.setDate(cursor.getDate() + GANTT_SCALE_DAYS[scale])
  }
  return { start, end, columns }
}

/** Horizontal position (0–1) of a date within a window. */
export function ganttOffset(date: string | Date, start: Date, end: Date): number {
  const time = (typeof date === 'string' ? new Date(`${date}T00:00:00`) : date).getTime()
  const span = end.getTime() - start.getTime()
  return span > 0 ? Math.max(0, Math.min(1, (time - start.getTime()) / span)) : 0
}
