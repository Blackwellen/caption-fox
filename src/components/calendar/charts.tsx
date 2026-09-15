'use client'

import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { ConflictTypeBreakdown, ThroughputPoint } from '@/lib/calendar/types'
import { EmptyState } from './primitives'

const AXIS = { fontSize: 11, fill: '#94a3b8' }

/**
 * Publishing throughput. Charts carry an accessible table summary as well as
 * the visual, so the data is never colour- or sight-only.
 */
export function ThroughputChart({ data, locale, timezone }: { data: ThroughputPoint[]; locale: string; timezone: string }) {
  if (data.every(point => point.published + point.scheduled + point.failed === 0)) {
    return <EmptyState title="No publishing activity yet" body="Once items publish, throughput for the selected period appears here." />
  }

  const formatted = data.map(point => ({
    ...point,
    label: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${point.date}T12:00:00Z`)),
  }))

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {[
          { key: 'published', label: 'Published', color: '#2563eb' },
          { key: 'scheduled', label: 'Scheduled', color: '#94a3b8' },
          { key: 'failed', label: 'Failed', color: '#ef4444' },
        ].map(series => (
          <span key={series.key} className="flex items-center gap-1.5 text-[11px] lg:text-[9.5px] text-slate-600">
            <span className="h-1.5 w-3.5 rounded-full" style={{ background: series.color }} aria-hidden />
            {series.label}
          </span>
        ))}
      </div>
      {/* Reference plot is ~150px tall; initialDimension avoids a -1 measurement before layout. */}
      <div className="h-[124px] w-full min-w-0" role="img" aria-label={`Publishing throughput across ${data.length} days`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 124 }}>
          <LineChart data={formatted} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 8px 24px rgba(15,23,42,.08)' }}
            />
            <Line type="monotone" dataKey="published" stroke="#2563eb" strokeWidth={2} dot={{ r: 2.5 }} name="Published" />
            <Line type="monotone" dataKey="scheduled" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2.5 }} name="Scheduled" />
            <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5 }} name="Failed" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Publishing throughput by day, timezone {timezone}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Published</th><th scope="col">Scheduled</th><th scope="col">Failed</th></tr></thead>
        <tbody>
          {formatted.map(point => (
            <tr key={point.date}><th scope="row">{point.label}</th><td>{point.published}</td><td>{point.scheduled}</td><td>{point.failed}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

const DONUT_COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b', '#10b981', '#0ea5e9', '#f97316', '#a3a3a3']

export function ConflictDonut({ data }: { data: ConflictTypeBreakdown[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) {
    return <EmptyState title="No open conflicts" body="Conflict types will be broken down here once the engine detects a clash." />
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-[168px] w-[168px] shrink-0" role="img" aria-label={`${total} open conflicts by type`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 168, height: 168 }}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
              {data.map((entry, index) => <Cell key={entry.type} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] lg:text-[20px] font-bold leading-6 text-slate-900">{total}</span>
          <span className="text-[11px] lg:text-[9.5px] text-slate-500">Total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((item, index) => (
          <li key={item.type} className="flex items-center gap-2 text-[12.5px] lg:text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-slate-700">{item.label}</span>
            <span className="shrink-0 font-semibold text-slate-900">{item.count}</span>
            <span className="w-10 shrink-0 text-right text-slate-400">({item.share}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
