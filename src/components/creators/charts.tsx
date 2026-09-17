'use client'

import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { StatusCount } from '@/lib/creators/types'

const AXIS = { fontSize: 10, fill: '#94a3b8' }
const GRID = '#f1f5f9'

/**
 * Deterministic compact number ("1.2M", "143K"). Intl's compact notation differs
 * between Node and browser ICU builds ("143K" vs "143k"), which breaks hydration.
 */
export function compact(value: number): string {
  const abs = Math.abs(value)
  const units: [number, string][] = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  for (const [size, suffix] of units) {
    if (abs >= size) return `${Number((value / size).toFixed(1))}${suffix}`
  }
  return Number(value.toFixed(1)).toLocaleString('en-GB')
}

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
    .format(new Date(value))
}

export interface TrendSeries { key: string; label: string; colour: string; dashed?: boolean }

/**
 * Multi-series daily trend. An accessible summary table renders alongside the
 * chart so the same data is available to screen readers, and an all-zero
 * series shows an explicit empty message rather than a flat misleading line.
 */
export function TrendChart({
  data, series, xKey = 'date', height = 190, valueFormatter,
  emptyMessage = 'No activity in this period yet.',
}: {
  data: Record<string, string | number>[]
  series: TrendSeries[]
  xKey?: string
  height?: number
  valueFormatter?: (value: number) => string
  emptyMessage?: string
}) {
  const hasData = data.some(point => series.some(s => Number(point[s.key] ?? 0) > 0))
  const format = valueFormatter ?? ((value: number) => new Intl.NumberFormat('en-GB').format(value))

  if (!hasData) {
    return (
      <div className="flex items-center justify-center text-center text-[13px] text-slate-400" style={{ height }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }}
              tickFormatter={dayLabel} minTickGap={28}
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={46} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)' }}
              labelFormatter={label => dayLabel(String(label))}
              formatter={(value, name) => [format(Number(value)), String(name)]}
            />
            {series.map(s => (
              <Line
                key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.colour} strokeWidth={2} dot={false} activeDot={{ r: 3 }}
                strokeDasharray={s.dashed ? '4 4' : undefined}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Trend data</caption>
        <thead>
          <tr><th scope="col">Date</th>{series.map(s => <th key={s.key} scope="col">{s.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map(point => (
            <tr key={String(point[xKey])}>
              <th scope="row">{dayLabel(String(point[xKey]))}</th>
              {series.map(s => <td key={s.key}>{format(Number(point[s.key] ?? 0))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** Rolling mean so sparse daily series read as a trend rather than spikes. */
export function rolling(values: number[], window = 5): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export interface AreaSeries { key: string; label: string; colour: string; dashed?: boolean; area?: boolean }

/**
 * Reference-style trend chart: centred line legend, light grid, 9px axis text,
 * soft area under solid series. Values are a 5-day rolling mean of the real
 * daily series; the accessible table lists the raw daily values.
 */
export function AreaTrend({
  data, series, height = 120, yMode = 'compact', currency = 'GBP', smooth = 5, legend = true, xTicks = 5,
}: {
  data: Record<string, string | number>[]
  series: AreaSeries[]
  height?: number
  yMode?: 'compact' | 'money'
  currency?: string
  smooth?: number
  legend?: boolean
  xTicks?: number
}) {
  const fmt = yMode === 'money'
    ? (v: number) => `${currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `}${compact(v)}`
    : compact
  const hasData = data.some(point => series.some(s => Number(point[s.key] ?? 0) > 0))
  const smoothed = data.map((point, i) => {
    const next: Record<string, string | number> = { ...point }
    for (const s of series) {
      const raw = data.map(p => Number(p[s.key] ?? 0))
      next[s.key] = smooth > 1 ? Number(rolling(raw, smooth)[i].toFixed(2)) : raw[i]
    }
    return next
  })
  const interval = Math.max(0, Math.round(data.length / xTicks) - 1)

  return (
    <div>
      {legend && (
        <div className="mb-1 flex items-center justify-center gap-5 text-[10px] text-[#475467]" aria-hidden>
          {series.map(s => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={s.colour} strokeWidth="2" strokeDasharray={s.dashed ? '3 2' : undefined} /></svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      {!hasData ? (
        <div className="flex items-center justify-center text-[12px] text-slate-400" style={{ height }}>No activity in this period yet.</div>
      ) : (
        <div style={{ height }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={smoothed} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <defs>
                {series.map(s => (
                  <linearGradient key={s.key} id={`cf-area-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={s.colour} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={s.colour} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#667085' }} tickLine={false} axisLine={false} tickFormatter={dayLabel} interval={interval} />
              <YAxis tick={{ fontSize: 9, fill: '#667085' }} tickLine={false} axisLine={false} tickFormatter={v => fmt(Number(v))} width={42} tickCount={5} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                labelFormatter={label => dayLabel(String(label))}
                formatter={(value, name) => [fmt(Number(value)), String(name)]}
              />
              {series.map(s => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.colour} strokeWidth={1.6}
                  strokeDasharray={s.dashed ? '4 3' : undefined} fill={s.area ? `url(#cf-area-${s.key})` : 'transparent'}
                  dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="sr-only">
        <caption>Daily values</caption>
        <thead><tr><th scope="col">Date</th>{series.map(s => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>
          {data.map(point => (
            <tr key={String(point.date)}><th scope="row">{dayLabel(String(point.date))}</th>{series.map(s => <td key={s.key}>{fmt(Number(point[s.key] ?? 0))}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ChartLegend({ series, className }: { series: TrendSeries[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {series.map(s => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: s.colour, opacity: s.dashed ? 0.55 : 1 }}
            aria-hidden
          />
          {s.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Donut with a centred total. Slices come straight from the page's status
 * counts, so the legend percentages always add up to the records on screen.
 */
export function DonutChart({
  slices, total, caption, size = 176, thickness = 22,
}: { slices: StatusCount[]; total: number; caption?: string; size?: number; thickness?: number }) {
  const data = slices.filter(slice => slice.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-[13px] text-slate-400" style={{ height: size }}>
        Nothing to chart yet.
      </div>
    )
  }

  return (
    <div className="relative" style={{ height: size }} role="img" aria-label={`${caption ?? 'Distribution'}: total ${total}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="label"
            innerRadius={size / 2 - thickness} outerRadius={size / 2 - 4}
            paddingAngle={1.5} stroke="none" isAnimationActive={false}
          >
            {data.map(slice => <Cell key={slice.key} fill={slice.colour} />)}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
            formatter={(value, name) => [new Intl.NumberFormat('en-GB').format(Number(value)), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold leading-none text-slate-900">
          {new Intl.NumberFormat('en-GB').format(total)}
        </span>
        {caption && <span className="mt-1 text-[11px] text-slate-400">{caption}</span>}
      </div>
    </div>
  )
}

export function DonutLegend({
  slices, total, className, valueFormatter,
}: { slices: StatusCount[]; total: number; className?: string; valueFormatter?: (value: number) => string }) {
  const format = valueFormatter ?? ((value: number) => new Intl.NumberFormat('en-GB').format(value))
  return (
    <ul className={cn('space-y-2', className)}>
      {slices.map(slice => (
        <li key={slice.key} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.colour }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-slate-600">{slice.label}</span>
          <span className="font-medium text-slate-900">{format(slice.value)}</span>
          <span className="w-14 text-right text-slate-400">
            {total > 0 ? `${((slice.value / total) * 100).toFixed(1)}%` : '0.0%'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Horizontal bar list — used by "Spend by Campaign" and rights coverage. */
export function BarList({
  items, total, valueFormatter, className, colour = '#3b82f6',
}: {
  items: { key: string; label: string; value: number; href?: string }[]
  total: number
  valueFormatter?: (value: number) => string
  className?: string
  colour?: string
}) {
  const format = valueFormatter ?? ((value: number) => new Intl.NumberFormat('en-GB').format(value))
  if (items.length === 0) {
    return <p className={cn('py-6 text-center text-[13px] text-slate-400', className)}>No data for this period yet.</p>
  }
  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map(item => {
        const pct = total > 0 ? (item.value / total) * 100 : 0
        return (
          <li key={item.key} className="flex items-center gap-3 text-[12px]">
            <span className="w-36 shrink-0 truncate text-slate-600" title={item.label}>{item.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
            </span>
            <span className="w-20 shrink-0 text-right font-medium text-slate-900">{format(item.value)}</span>
            <span className="w-12 shrink-0 text-right text-slate-400">{pct.toFixed(1)}%</span>
          </li>
        )
      })}
    </ul>
  )
}
