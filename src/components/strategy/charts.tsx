'use client'

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

const AXIS = { fontSize: 10, fill: '#94a3b8' }
const GRID = '#f1f5f9'
const TOOLTIP = {
  fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
}

function compact(value: number): string {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function plain(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value)
}

/** Formats an axis tick as compact money for monetary series. */
function money(currency: string) {
  return (value: number) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Recharts' Tooltip formatter generic resolves to a very wide union that our
 * narrow (number, string) formatters do not structurally satisfy. The values
 * we feed these charts are always numeric, so we adapt once here rather than
 * widening every call site.
 */
type TooltipFormatter = React.ComponentProps<typeof Tooltip>['formatter']
function fmt(fn: (value: number, name: string) => [string, string]): TooltipFormatter {
  return ((value: unknown, name: unknown) => fn(Number(value), String(name))) as TooltipFormatter
}

export interface Series { key: string; label: string; colour: string; dashed?: boolean }

/**
 * Accessible fallback for every chart: the same data as a visually hidden
 * table, so the figures are never available only as pixels.
 */
function DataTable({
  caption, rows, series, labelKey,
}: {
  caption: string
  rows: Record<string, string | number>[]
  series: Series[]
  labelKey: string
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map(item => <th key={item.key} scope="col">{item.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row[labelKey]}-${index}`}>
            <th scope="row">{String(row[labelKey])}</th>
            {series.map(item => <td key={item.key}>{row[item.key] ?? 0}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Empty({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center px-4 text-center text-[13px] text-slate-400"
      style={{ height }}
    >
      {message}
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────────────────────

export function ChartLegend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-3', className)}>
      {series.map(item => (
        <li key={item.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {item.dashed
            ? (
              <span
                className="h-0 w-3.5 border-t-[1.5px] border-dashed"
                style={{ borderColor: item.colour }} aria-hidden
              />
            )
            : <span className="h-2 w-2 rounded-full" style={{ background: item.colour }} aria-hidden />}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// ── Trend line ───────────────────────────────────────────────────────────────

/**
 * Multi-series trend. Used by the Overview strategy health chart, the Objectives
 * performance trend and the audience growth panel. Series marked `dashed`
 * render as a comparison/benchmark line.
 */
export function TrendChart({
  data, series, xKey = 'label', height = 190, area = false, currency,
  emptyMessage = 'No trend data for this period yet.', caption = 'Trend data',
  yMax,
}: {
  data: Record<string, string | number>[]
  series: Series[]
  xKey?: string
  height?: number
  area?: boolean
  currency?: string
  emptyMessage?: string
  caption?: string
  yMax?: number
}) {
  const hasData = data.length > 0 && data.some(point => series.some(item => Number(point[item.key] ?? 0) !== 0))
  if (!hasData) return <Empty height={height} message={emptyMessage} />

  const tickFormatter = currency ? money(currency) : compact
  const Chart = area ? AreaChart : LineChart

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
            <defs>
              {area && series.map(item => (
                <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.colour} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={item.colour} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
            <YAxis
              tick={AXIS} tickLine={false} axisLine={false} width={46}
              tickFormatter={tickFormatter} domain={yMax ? [0, yMax] : undefined}
            />
            <Tooltip
              contentStyle={TOOLTIP}
              formatter={fmt((value: number, name: string) => [
                currency ? money(currency)(value) : plain(value), name,
              ])}
            />
            {series.map(item => area
              ? (
                <Area
                  key={item.key} type="monotone" dataKey={item.key} name={item.label}
                  stroke={item.colour} strokeWidth={2} fill={`url(#fill-${item.key})`}
                  strokeDasharray={item.dashed ? '5 4' : undefined} dot={false} activeDot={{ r: 3 }}
                />
              )
              : (
                <Line
                  key={item.key} type="monotone" dataKey={item.key} name={item.label}
                  stroke={item.colour} strokeWidth={2}
                  strokeDasharray={item.dashed ? '5 4' : undefined}
                  dot={{ r: 2.5, strokeWidth: 0, fill: item.colour }} activeDot={{ r: 4 }}
                />
              ))}
          </Chart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} rows={data} series={series} labelKey={xKey} />
    </>
  )
}

// ── Grouped bars ─────────────────────────────────────────────────────────────

/** Forecast vs target, and any other side-by-side comparison. */
export function GroupedBarChart({
  data, series, xKey = 'label', height = 190, currency,
  emptyMessage = 'No comparison data yet.', caption = 'Comparison data',
}: {
  data: Record<string, string | number>[]
  series: Series[]
  xKey?: string
  height?: number
  currency?: string
  emptyMessage?: string
  caption?: string
}) {
  const hasData = data.length > 0 && data.some(point => series.some(item => Number(point[item.key] ?? 0) !== 0))
  if (!hasData) return <Empty height={height} message={emptyMessage} />

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 10, left: -14, bottom: 0 }} barGap={3}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis
              tick={AXIS} tickLine={false} axisLine={false} width={46}
              tickFormatter={currency ? money(currency) : compact}
            />
            <Tooltip
              cursor={{ fill: 'rgb(241 245 249 / 0.6)' }} contentStyle={TOOLTIP}
              formatter={fmt((value: number, name: string) => [
                currency ? money(currency)(value) : plain(value), name,
              ])}
            />
            {series.map(item => (
              <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.colour} radius={[3, 3, 0, 0]} maxBarSize={22} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} rows={data} series={series} labelKey={xKey} />
    </>
  )
}

// ── Variance (bars above/below zero + line overlay) ──────────────────────────

export interface VariancePoint { label: string; variance: number; variancePct: number }

/**
 * Variance to target: bars coloured by sign, with the percentage as an overlaid
 * line on a second axis. Matches the Forecasts "Variance to target" panel.
 */
export function VarianceChart({
  data, height = 200, currency = 'GBP',
  emptyMessage = 'No variance data for this period yet.',
}: { data: VariancePoint[]; height?: number; currency?: string; emptyMessage?: string }) {
  if (data.length === 0 || data.every(point => point.variance === 0)) {
    return <Empty height={height} message={emptyMessage} />
  }

  const series: Series[] = [
    { key: 'variance', label: 'Variance', colour: '#10b981' },
    { key: 'variancePct', label: 'Variance %', colour: '#3b82f6' },
  ]

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis yAxisId="value" tick={AXIS} tickLine={false} axisLine={false} width={46} tickFormatter={money(currency)} />
            <YAxis
              yAxisId="pct" orientation="right" tick={AXIS} tickLine={false} axisLine={false}
              width={40} tickFormatter={(value: number) => `${Math.round(value)}%`}
            />
            <ReferenceLine yAxisId="value" y={0} stroke="#e2e8f0" />
            <Tooltip
              cursor={{ fill: 'rgb(241 245 249 / 0.6)' }} contentStyle={TOOLTIP}
              formatter={fmt((value: number, name: string) => [
                name === 'Variance %' ? `${value.toFixed(1)}%` : money(currency)(value), name,
              ])}
            />
            <Bar yAxisId="value" dataKey="variance" name="Variance" radius={[3, 3, 0, 0]} maxBarSize={20}>
              {data.map(point => (
                <Cell key={point.label} fill={point.variance >= 0 ? '#10b981' : '#f87171'} />
              ))}
            </Bar>
            <Line
              yAxisId="pct" type="monotone" dataKey="variancePct" name="Variance %"
              stroke="#3b82f6" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: '#3b82f6' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Variance to target by period"
        rows={data as unknown as Record<string, string | number>[]}
        series={series} labelKey="label"
      />
    </>
  )
}

// ── Capacity (bars + utilisation line) ───────────────────────────────────────

export function CapacityChart({
  data, height = 150, emptyMessage = 'No capacity data recorded yet.',
}: {
  data: { label: string; allocated: number; capacity: number; utilisation: number }[]
  height?: number
  emptyMessage?: string
}) {
  if (data.length === 0) return <Empty height={height} message={emptyMessage} />

  const series: Series[] = [
    { key: 'allocated', label: 'Allocated', colour: '#3b82f6' },
    { key: 'capacity', label: 'Capacity', colour: '#bfdbfe' },
    { key: 'utilisation', label: 'Utilisation', colour: '#10b981' },
  ]

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 4, left: -22, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis
              tick={AXIS} tickLine={false} axisLine={false} width={44}
              tickFormatter={(value: number) => `${Math.round(value)}%`}
            />
            <Tooltip
              cursor={{ fill: 'rgb(241 245 249 / 0.6)' }} contentStyle={TOOLTIP}
              formatter={fmt((value: number, name: string) => [`${Math.round(value)}%`, name])}
            />
            <Bar dataKey="allocated" name="Allocated" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Bar dataKey="capacity" name="Capacity" fill="#bfdbfe" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Line
              type="monotone" dataKey="utilisation" name="Utilisation"
              stroke="#10b981" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: '#10b981' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Team workload against capacity"
        rows={data as unknown as Record<string, string | number>[]}
        series={series} labelKey="label"
      />
    </>
  )
}

// ── Donut ────────────────────────────────────────────────────────────────────

export interface DonutSlice { key: string; label: string; value: number; colour: string }

export function DonutChart({
  slices, total, totalLabel = 'Total', centreValue, centreSub, size = 150,
  emptyMessage = 'Nothing to break down yet.',
}: {
  slices: DonutSlice[]
  total: number
  totalLabel?: string
  centreValue?: string
  centreSub?: string
  size?: number
  emptyMessage?: string
}) {
  const populated = slices.filter(slice => slice.value > 0)
  if (populated.length === 0) return <Empty height={size} message={emptyMessage} />

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={populated} dataKey="value" nameKey="label"
            innerRadius={size * 0.33} outerRadius={size * 0.48} paddingAngle={1.5} strokeWidth={0}
          >
            {populated.map(slice => <Cell key={slice.key} fill={slice.colour} />)}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP}
            formatter={fmt((value: number, name: string) => [plain(value), name])}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-bold leading-none text-slate-900">
          {centreValue ?? plain(total)}
        </span>
        <span className="mt-0.5 text-[10px] text-slate-400">{centreSub ?? totalLabel}</span>
      </div>
    </div>
  )
}

export function DonutLegend({
  slices, total, className, showPercent = true, trailing,
}: {
  slices: DonutSlice[]
  total: number
  className?: string
  showPercent?: boolean
  trailing?: (slice: DonutSlice) => React.ReactNode
}) {
  return (
    <ul className={cn('min-w-0 flex-1 space-y-2', className)}>
      {slices.map(slice => (
        <li key={slice.key} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.colour }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-slate-600">{slice.label}</span>
          {trailing
            ? trailing(slice)
            : (
              <>
                <span className="shrink-0 font-semibold text-slate-900">{slice.value}</span>
                {showPercent && (
                  <span className="w-11 shrink-0 text-right text-slate-400">
                    ({total > 0 ? Math.round((slice.value / total) * 100) : 0}%)
                  </span>
                )}
              </>
            )}
        </li>
      ))}
    </ul>
  )
}

// ── Simple vertical bars (demographics) ──────────────────────────────────────

export function ColumnChart({
  data, height = 100, colour = '#3b82f6', suffix = '%',
  emptyMessage = 'No demographic data yet.',
}: {
  data: { label: string; value: number }[]
  height?: number
  colour?: string
  suffix?: string
  emptyMessage?: string
}) {
  if (data.length === 0 || data.every(point => point.value === 0)) {
    return <Empty height={height} message={emptyMessage} />
  }
  const max = Math.max(...data.map(point => point.value))

  return (
    <>
      <div className="flex items-end gap-1.5" style={{ height }} aria-hidden>
        {data.map(point => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(4, (point.value / max) * (height - 18))}px`,
                background: colour,
                opacity: 0.35 + 0.65 * (point.value / max),
              }}
              title={`${point.label}: ${point.value}${suffix}`}
            />
            <span className="w-full truncate text-center text-[9px] text-slate-400">{point.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Distribution</caption>
        <thead><tr><th scope="col">Band</th><th scope="col">Share</th></tr></thead>
        <tbody>
          {data.map(point => (
            <tr key={point.label}><th scope="row">{point.label}</th><td>{point.value}{suffix}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  data, colour = '#3b82f6', height = 28,
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
