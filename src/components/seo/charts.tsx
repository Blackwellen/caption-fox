'use client'

import { useId, useMemo } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatCompact, formatDateShort, formatDecimal, formatNumber } from '@/lib/seo/format'

const AXIS = { fill: '#64748B', fontSize: 11 }
const GRID = '#F1F5F9'

/** Sparkline used inside KPI cards. Purely decorative — data is in the value. */
export function Spark({ data, tone = '#2563EB' }: { data: { date: string; value: number | null }[]; tone?: string }) {
  const points = data.filter(d => d.value != null)
  if (points.length < 2) return <div className="h-8" aria-hidden />
  return (
    <div className="h-8" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 3, right: 0, bottom: 3, left: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="value" stroke={tone} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface TrendSeries {
  key: string
  label: string
  colour: string
  /** Right-hand axis. Used when a series has a different unit. */
  axis?: 'left' | 'right' | 'right2'
  dashed?: boolean
  /** Lower values sit higher on the chart (rank). */
  reversed?: boolean
  formatter?: (value: number) => string
}

/**
 * The shared multi-series trend chart used by Overview, Rankings, Local and
 * AI Search. Renders an accessible data summary alongside the visual.
 */
export function TrendChart({
  data, series, height = 260, leftLabel, rightLabel, right2Label, axisTitles = false, curve = 'linear',
}: {
  data: Record<string, number | string | null>[]
  series: TrendSeries[]
  height?: number
  leftLabel?: string
  rightLabel?: string
  right2Label?: string
  /** Render axis labels as titles above each axis (reference style) instead of rotated text. */
  axisTitles?: boolean
  curve?: 'monotone' | 'linear'
}) {
  const id = useId()
  const hasRight = series.some(s => s.axis === 'right')
  const hasRight2 = series.some(s => s.axis === 'right2')
  const reversedLeft = series.some(s => s.axis !== 'right' && s.reversed)

  const summary = useMemo(() => series.map(s => {
    const values = data.map(row => row[s.key]).filter(v => typeof v === 'number') as number[]
    if (values.length === 0) return `${s.label}: no data`
    return `${s.label}: from ${formatDecimal(values[0])} to ${formatDecimal(values[values.length - 1])}`
  }).join('. '), [data, series])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        No data for this period
      </div>
    )
  }

  return (
    <figure className="m-0">
      {axisTitles && (
        <div className="flex items-end justify-between text-[10.5px] text-slate-500" aria-hidden>
          <span>{leftLabel}</span>
          <span className="flex gap-3">
            {rightLabel && <span>{rightLabel}</span>}
            {right2Label && <span className="w-[74px] whitespace-nowrap text-right">{right2Label}</span>}
          </span>
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: hasRight || hasRight2 ? 8 : 4, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={28}
              tickFormatter={value => formatDateShort(String(value))}
            />
            <YAxis
              yAxisId="left"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={44}
              reversed={reversedLeft}
              label={leftLabel && !axisTitles ? { value: leftLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94A3B8' } } : undefined}
            />
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={44}
                label={rightLabel && !axisTitles ? { value: rightLabel, angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#94A3B8' } } : undefined}
              />
            )}
            {hasRight2 && (
              <YAxis
                yAxisId="right2"
                orientation="right"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={value => formatCompactAxis(Number(value))}
              />
            )}
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 8px 24px rgb(15 23 42 / 0.08)' }}
              labelFormatter={label => formatDateShort(String(label))}
            />
            {series.map(s => (
              <Line
                key={s.key}
                yAxisId={s.axis ?? 'left'}
                type={curve}
                dataKey={s.key}
                name={s.label}
                stroke={s.colour}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4 3' : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only" id={id}>{summary}</figcaption>
    </figure>
  )
}

export function ChartLegend({ series }: { series: { label: string; colour: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {series.map(s => (
        <li key={s.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: s.colour, opacity: s.dashed ? 0.6 : 1 }}
            aria-hidden
          />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

/** Ranking-distribution bar chart with value labels. */
export function DistributionBars({
  data, height = 200,
}: { data: { label: string; count: number; colour: string }[]; height?: number }) {
  if (data.every(d => d.count === 0)) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No ranked keywords yet</div>
  }
  return (
    <figure className="m-0">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={v => formatCompact(Number(v))} />
            <Tooltip
              cursor={{ fill: '#F8FAFC' }}
              contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
              formatter={(value) => [formatNumber(Number(value)), 'Keywords']}
            />
            <defs>
              <linearGradient id="cf-dist-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3B82F6" />
                <stop offset="1" stopColor="#93C5FD" />
              </linearGradient>
            </defs>
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={26} fill="url(#cf-dist-bar)" isAnimationActive={false}>
              <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: '#334155', fontWeight: 500 }} formatter={(v: unknown) => (Number(v) > 0 ? formatCompact(Number(v)) : '')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map(d => `${d.label}: ${formatNumber(d.count)} keywords`).join('. ')}
      </figcaption>
    </figure>
  )
}

/** Donut used by keyword clusters, rank distribution and AI source mix. */
export function Donut({
  data, centreValue, centreLabel, size = 176,
}: {
  data: { label: string; value: number; colour: string }[]
  centreValue?: string
  centreLabel?: string
  size?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: size }}>No data</div>
  }
  return (
    <figure className="relative m-0" style={{ height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={size * 0.3}
            outerRadius={size * 0.44}
            paddingAngle={1.5}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map(entry => <Cell key={entry.label} fill={entry.colour} />)}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
            formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      {centreValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="text-[15px] font-bold leading-none text-slate-900">{centreValue}</span>
          {centreLabel && <span className="mt-0.5 text-[9px] leading-tight text-slate-500">{centreLabel}</span>}
        </div>
      )}
      <figcaption className="sr-only">
        {data.map(d => `${d.label}: ${formatNumber(d.value)}`).join('. ')}
      </figcaption>
    </figure>
  )
}

/** Stacked area used by the keyword rankings-trend panel. */
export function StackedTrend({
  data, series, height = 180,
}: { data: Record<string, number | string>[]; series: { key: string; label: string; colour: string }[]; height?: number }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No data</div>
  }
  return (
    <figure className="m-0">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} stackOffset="expand" margin={{ top: 4, right: 4, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={30} tickFormatter={v => formatDateShort(String(v))} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={v => `${Math.round(Number(v) * 100)}%`} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
              labelFormatter={label => formatDateShort(String(label))}
              formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
            />
            {series.map(s => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="1" stroke={s.colour} fill={s.colour} fillOpacity={0.25} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Share of tracked keywords by ranking band over time.</figcaption>
    </figure>
  )
}

/** Grouped bars used by New vs Lost links. */
export function GroupedBars({
  data, series, height = 180,
}: { data: Record<string, number | string>[]; series: { key: string; label: string; colour: string }[]; height?: number }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No data</div>
  }
  return (
    <figure className="m-0">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={20} tickFormatter={v => formatDateShort(String(v))} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={v => formatCompact(Number(v))} />
            <Tooltip
              cursor={{ fill: '#F8FAFC' }}
              contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
              labelFormatter={label => formatDateShort(String(label))}
            />
            {series.map(s => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.colour} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {series.map(s => s.label).join(' and ')} per period.
      </figcaption>
    </figure>
  )
}

/** Small inline trend used in competitor rows. */
export function MiniTrend({
  data, colour, reversed = false, wide = false,
}: { data: { value: number | null }[]; colour: string; reversed?: boolean; wide?: boolean }) {
  const points = data.filter(d => d.value != null)
  const box = wide ? 'h-8 w-full' : 'h-5 w-14'
  if (points.length < 2) return <div className={box} aria-hidden />
  return (
    <div className={box} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} reversed={reversed} />
          <Line type="monotone" dataKey="value" stroke={colour} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatCompactAxis(value: number) {
  if (!Number.isFinite(value)) return ''
  return Math.abs(value) >= 1000 ? `${Math.round(value / 100) / 10}K`.replace('.0K', 'K') : String(value)
}
