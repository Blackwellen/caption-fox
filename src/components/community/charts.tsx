'use client'

import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { StatusCount } from '@/lib/community/types'

// Chart primitives shared by the six Community surfaces. Mirrors
// src/components/creators/charts.tsx so trend lines, donuts and bar lists
// look identical across every Campaign Manager module.

const AXIS = { fontSize: 10, fill: '#94a3b8' }
const GRID = '#f1f5f9'

function compact(value: number): string {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
    .format(new Date(value))
}

export interface TrendSeries { key: string; label: string; colour: string; dashed?: boolean }

/**
 * Converts a plain daily-count array (oldest first, one entry per day up to
 * today) into dated points `TrendChart` can render. Lives here rather than in
 * a page component so the `Date.now()` call happens during data preparation,
 * not inside a component's render body.
 */
export function seriesToPoints(series: number[], key: string): Record<string, string | number>[] {
  const today = Date.now()
  return series.map((value, index) => ({
    date: new Date(today - (series.length - 1 - index) * 86_400_000).toISOString(),
    [key]: value,
  }))
}

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

/** Horizontal bar list — used by "Top advocacy channels" and policy coverage. */
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
