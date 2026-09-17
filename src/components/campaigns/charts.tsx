'use client'

import {
  CartesianGrid, Cell, Label, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

const AXIS = { fontSize: 8.5, fill: '#94a3b8' }
const GRID = '#f1f5f9'

function compact(value: number): string {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

// ── Trend ────────────────────────────────────────────────────────────────────

export interface TrendSeries { key: string; label: string; colour: string }

/**
 * Multi-series daily trend. Renders an accessible summary table alongside the
 * chart so the same data is available to screen readers.
 */
export function TrendChart({
  data, series, xKey = 'date', height = 162, emptyMessage = 'No performance data for this period yet.',
}: {
  data: Record<string, string | number>[]
  series: TrendSeries[]
  xKey?: string
  height?: number
  emptyMessage?: string
}) {
  const hasData = data.some(point => series.some(s => Number(point[s.key] ?? 0) > 0))

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
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)' }}
              labelFormatter={label => dayLabel(String(label))}
              formatter={(value, name) => [new Intl.NumberFormat('en-GB').format(Number(value)), String(name)]}
            />
            {series.map(s => (
              <Line
                key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.colour} strokeWidth={2} dot={false} activeDot={{ r: 3 }}
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
              {series.map(s => <td key={s.key}>{point[s.key] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function ChartLegend({ series, className }: { series: TrendSeries[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-3', className)}>
      {series.map(s => (
        <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-2 w-2 rounded-full" style={{ background: s.colour }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

// ── Donut ────────────────────────────────────────────────────────────────────

export interface DonutSlice { key: string; label: string; value: number; colour: string }

export function DonutChart({
  slices, total, totalLabel = 'Total', centreValue, size = 120, emptyMessage = 'Nothing to break down yet.',
}: {
  slices: DonutSlice[]
  total: number
  totalLabel?: string
  centreValue?: string
  size?: number
  emptyMessage?: string
}) {
  const populated = slices.filter(slice => slice.value > 0)
  if (populated.length === 0) {
    return (
      <div className="flex items-center justify-center text-center text-[13px] text-slate-400" style={{ height: size }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={populated} dataKey="value" nameKey="label"
            innerRadius={size * 0.32} outerRadius={size * 0.48} paddingAngle={1.5} strokeWidth={0}
          >
            {populated.map(slice => <Cell key={slice.key} fill={slice.colour} />)}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
            formatter={(value, name) => [new Intl.NumberFormat('en-GB').format(Number(value)), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[19px] font-bold leading-none text-slate-900">
          {centreValue ?? new Intl.NumberFormat('en-GB').format(total)}
        </span>
        <span className="mt-0.5 text-[10px] text-slate-400">{totalLabel}</span>
      </div>
    </div>
  )
}

export function DonutLegend({
  slices, total, className,
}: { slices: DonutSlice[]; total: number; className?: string }) {
  return (
    <ul className={cn('min-w-0 flex-1 space-y-1.5', className)}>
      {slices.map(slice => (
        <li key={slice.key} className="flex items-center gap-1.5 text-[11px] lg:text-[9px]">
          <span className="h-2 w-2 shrink-0 rounded-sm lg:h-1.5 lg:w-1.5" style={{ background: slice.colour }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-slate-600">{slice.label}</span>
          <span className="shrink-0 whitespace-nowrap font-medium text-slate-900">
            {slice.value}
            <span className="ml-1 font-normal text-slate-400">
              ({total > 0 ? Math.round((slice.value / total) * 100) : 0}%)
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Scatter (budget vs performance) ──────────────────────────────────────────

export interface ScatterPoint {
  id: string
  name: string
  spend: number
  engagements: number
  group: 'on_track' | 'underperforming' | 'over_budget'
}

const SCATTER_COLOURS: Record<ScatterPoint['group'], string> = {
  on_track: '#34d399', underperforming: '#fbbf24', over_budget: '#f87171',
}

export function BudgetScatter({
  points, height = 152, emptyMessage = 'No budget or performance data yet.',
}: { points: ScatterPoint[]; height?: number; emptyMessage?: string }) {
  if (points.length === 0) {
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
          <ScatterChart margin={{ top: 6, right: 10, left: -14, bottom: 2 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis
              type="number" dataKey="spend" name="Spend" tick={AXIS} tickLine={false}
              axisLine={{ stroke: GRID }} tickFormatter={compact} height={26}
            >
              <Label value="Spend (GBP)" position="insideBottom" offset={-2} style={{ fontSize: 8.5, fill: '#94a3b8' }} />
            </XAxis>
            <YAxis
              type="number" dataKey="engagements" name="Engagements" tick={AXIS}
              tickLine={false} axisLine={false} tickFormatter={compact} width={44}
            >
              <Label value="Engagements" angle={-90} position="insideLeft" style={{ fontSize: 8.5, fill: '#94a3b8', textAnchor: 'middle' }} />
            </YAxis>
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
              formatter={(value, name) => [new Intl.NumberFormat('en-GB').format(Number(value)), String(name)]}
              labelFormatter={() => ''}
            />
            <Scatter data={points} name="Campaigns">
              {points.map(point => <Cell key={point.id} fill={SCATTER_COLOURS[point.group]} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Campaign spend against engagements</caption>
        <thead><tr><th scope="col">Campaign</th><th scope="col">Spend</th><th scope="col">Engagements</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {points.map(point => (
            <tr key={point.id}>
              <th scope="row">{point.name}</th>
              <td>{point.spend}</td><td>{point.engagements}</td><td>{point.group.replace('_', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  data, colour = '#3b82f6', height = 30,
}: { data: number[]; colour?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />
  const points = data.map((value, index) => ({ index, value }))
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Line type="monotone" dataKey="value" stroke={colour} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
