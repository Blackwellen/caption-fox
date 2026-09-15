'use client'

import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatAxisDay, formatCurrency, formatMonth, formatNumber } from '@/lib/events/format'
import type { TrendPoint } from '@/lib/events/types'

/**
 * Chart wrappers for the Events module.
 *
 * Every chart is fed a server-computed series — no random or placeholder data.
 * Each one carries an accessible text summary because a canvas alone is not
 * readable by assistive technology.
 */

const AXIS = { fontSize: 11, fill: '#94a3b8' }
const GRID = { stroke: '#f1f5f9', vertical: false }

function EmptySeries({ label }: { label: string }) {
  return (
    <div className="flex h-[190px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
      <p className="text-[12.5px] text-slate-500">
        No {label} recorded in this period yet. The chart appears as soon as data arrives.
      </p>
    </div>
  )
}

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12,
      boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    },
    labelStyle: { color: '#0f172a', fontWeight: 600 },
  }
}

export function RegistrationTrendChart({ data, height = 190 }: { data: TrendPoint[]; height?: number }) {
  const total = data.reduce((sum, point) => sum + Number(point.registrations ?? 0), 0)
  if (!data.length || total === 0) return <EmptySeries label="registrations" />

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Registrations and attendees per day. {formatNumber(total)} registrations across {data.length} days.
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" tickFormatter={formatAxisDay} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip {...tooltipStyle()} labelFormatter={value => formatAxisDay(String(value))} />
          <Line type="monotone" dataKey="registrations" name="Registrations" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="attendees" name="Attendees" stroke="#7c3aed" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function AttendanceRateChart({ data, height = 190 }: { data: TrendPoint[]; height?: number }) {
  const measured = data.filter(point => Number(point.rate ?? 0) > 0)
  if (measured.length === 0) return <EmptySeries label="webinar attendance" />

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Webinar attendance rate per day across {data.length} days.
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" tickFormatter={formatAxisDay} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={value => `${value}%`} domain={[0, 100]} />
          <Tooltip
            {...tooltipStyle()}
            labelFormatter={value => formatAxisDay(String(value))}
            formatter={(value: unknown) => [`${Number(value).toFixed(1)}%`, 'Attendance rate'] as [string, string]}
          />
          <Area type="monotone" dataKey="rate" name="Attendance rate" stroke="#10b981" strokeWidth={2} fill="url(#attendance-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function ListenerTrendChart({ data, height = 190 }: { data: TrendPoint[]; height?: number }) {
  const total = data.reduce((sum, point) => sum + Number(point.listens ?? 0), 0)
  if (!data.length || total === 0) return <EmptySeries label="listens" />

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Listens and unique listeners per day. {formatNumber(total)} listens across {data.length} days.
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" tickFormatter={formatAxisDay} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={value => formatNumber(Number(value))} />
          <Tooltip {...tooltipStyle()} labelFormatter={value => formatAxisDay(String(value))} />
          <Line type="monotone" dataKey="listens" name="Listens" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="unique" name="Unique listeners" stroke="#7c3aed" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function OutreachChart({ data, height = 200 }: { data: TrendPoint[]; height?: number }) {
  const total = data.reduce((sum, point) => sum + Number(point.sent ?? 0), 0)
  if (!data.length || total === 0) return <EmptySeries label="outreach" />

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Emails sent, opened and replied per day across {data.length} days.
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" tickFormatter={formatAxisDay} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={50} tickFormatter={value => formatNumber(Number(value))} />
          <Tooltip {...tooltipStyle()} labelFormatter={value => formatAxisDay(String(value))} />
          <Line type="monotone" dataKey="sent" name="Emails sent" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="opened" name="Opens" stroke="#7c3aed" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="replied" name="Replies" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function RevenueChart({
  data, currency = 'GBP', height = 195,
}: { data: TrendPoint[]; currency?: string; height?: number }) {
  const total = data.reduce((sum, point) => sum + Number(point.thisYear ?? 0), 0)
  if (!data.length || total === 0) return <EmptySeries label="sponsorship revenue" />

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Contracted sponsorship revenue by month, this year against last year.
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" tickFormatter={value => formatMonth(String(value))} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS} tickLine={false} axisLine={false} width={62}
            tickFormatter={value => formatCurrency(Number(value), currency, true)}
          />
          <Tooltip
            {...tooltipStyle()}
            labelFormatter={value => formatMonth(String(value))}
            formatter={(value: unknown, name: unknown) => [formatCurrency(Number(value), currency), String(name ?? '')] as [string, string]}
          />
          <Line type="monotone" dataKey="thisYear" name="This year" stroke="#4f46e5" strokeWidth={2.4} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="lastYear" name="Last year" stroke="#a5b4fc" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export function ChartLegend({ items }: { items: { label: string; colour: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: item.colour }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
