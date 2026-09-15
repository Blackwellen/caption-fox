'use client'

import {
  CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'

export { TrendChart, ChartLegend, DonutChart, DonutLegend, Sparkline } from '@/components/campaigns/charts'
export type { TrendSeries, DonutSlice } from '@/components/campaigns/charts'

const AXIS = { fontSize: 10, fill: '#94a3b8' }
const GRID = '#f1f5f9'

function compact(value: number): string {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1,
  }).format(value)
}

export interface LabelledScatterPoint {
  id: string
  name: string
  x: number
  y: number
  group?: string
}

/**
 * Generic two-axis scatter with custom axis labels/formatters — used for the
 * "Commission vs revenue", "Rebates vs revenue" and "Shared spend vs pipeline
 * revenue" panels, which each plot different metric pairs.
 */
export function LabelledScatter({
  points, xLabel, yLabel, colours, height = 180, emptyMessage = 'No data for this period yet.',
  format = 'number',
}: {
  points: LabelledScatterPoint[]
  xLabel: string
  yLabel: string
  colours?: Record<string, string>
  height?: number
  emptyMessage?: string
  /** Serializable formatter selector — a function prop can't cross the server/client boundary. */
  format?: 'number' | 'money'
}) {
  const formatValue = format === 'money' ? compactMoney : compact
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center text-center text-[13px] text-slate-400" style={{ height }}>
        {emptyMessage}
      </div>
    )
  }

  const palette = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#64748b']
  const groups = [...new Set(points.map(p => p.group ?? 'default'))]
  const colourFor = (group: string) => colours?.[group] ?? palette[groups.indexOf(group) % palette.length]

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 10, left: -14, bottom: 2 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={formatValue} />
            <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatValue} width={48} />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
              formatter={(value, name) => [formatValue(Number(value)), name === 'x' ? xLabel : yLabel]}
              labelFormatter={() => ''}
            />
            <Scatter data={points} name="Programmes">
              {points.map(point => <Cell key={point.id} fill={colourFor(point.group ?? 'default')} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{`${xLabel} against ${yLabel}`}</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">{xLabel}</th><th scope="col">{yLabel}</th></tr></thead>
        <tbody>{points.map(p => <tr key={p.id}><th scope="row">{p.name}</th><td>{p.x}</td><td>{p.y}</td></tr>)}</tbody>
      </table>
    </>
  )
}
