'use client'

import { useId, useMemo, useState } from 'react'
import { compact, integer } from '@/lib/link-in-bio/format'

// SVG charts for Link in Bio analytics. Each chart renders from aggregated
// server data, exposes a text summary to screen readers, and a visually
// hidden data table so values are reachable without the pointer.

const niceMax = (value: number) => {
  if (value <= 0) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s * 4 >= value) ?? magnitude * 10
  return step * 4
}

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

export type SeriesPoint = { day: string; a: number; b: number }

export function DualLineChart({ points, labelA, labelB, colorA = '#1a5cff', colorB = '#8b5cf6', height = 170, summary }: {
  points: SeriesPoint[]; labelA: string; labelB: string; colorA?: string; colorB?: string; height?: number; summary: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  const width = 440
  const pad = { l: 26, r: 6, t: 8, b: 20 }
  const max = niceMax(Math.max(1, ...points.flatMap(p => [p.a, p.b])))
  const x = (i: number) => pad.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (width - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b)
  const path = (key: 'a' | 'b') => points.map((p, i) => {
    if (i === 0) return `M${x(i)},${y(p[key])}`
    const [x0, y0, x1, y1] = [x(i - 1), y(points[i - 1][key]), x(i), y(p[key])]
    const cx = (x0 + x1) / 2
    return `C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }).join(' ')
  const tickEvery = Math.max(1, Math.round(points.length / 7))
  const active = hover !== null ? points[hover] : null

  return (
    <figure className="relative m-0">
      <figcaption className="sr-only" id={`${id}-cap`}>{summary}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-cap`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={event => {
          const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((event.clientX - rect.left) / rect.width) * width
          const i = Math.round(((px - pad.l) / (width - pad.l - pad.r)) * (points.length - 1))
          setHover(Math.max(0, Math.min(points.length - 1, i)))
        }}>
        {[0, 1, 2, 3, 4].map(t => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y((max / 4) * t)} y2={y((max / 4) * t)} stroke="#eef2f7" strokeWidth={1} />
            <text x={pad.l - 6} y={y((max / 4) * t) + 3} textAnchor="end" fontSize={8.5} fill="#64748b">{compact((max / 4) * t)}</text>
          </g>
        ))}
        {points.map((p, i) => i % tickEvery === 0 && (
          <text key={p.day} x={x(i)} y={height - 5} textAnchor="middle" fontSize={8.5} fill="#64748b">{dayLabel(p.day)}</text>
        ))}
        <path d={path('a')} fill="none" stroke={colorA} strokeWidth={1.8} />
        <path d={path('b')} fill="none" stroke={colorB} strokeWidth={1.8} />
        {active && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#94a3b8" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(active.a)} r={3.5} fill="#fff" stroke={colorA} strokeWidth={2} />
            <circle cx={x(hover)} cy={y(active.b)} r={3.5} fill="#fff" stroke={colorB} strokeWidth={2} />
          </g>
        )}
      </svg>
      {active && hover !== null && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10.5px] shadow-md"
          style={{ left: `${Math.min(70, (x(hover) / width) * 100)}%`, top: `${(y(Math.max(active.a, active.b)) / height) * 100}%`, transform: 'translate(8px, 8px)' }}>
          <p className="font-medium text-slate-900">{dayLabel(active.day, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <p className="mt-1 flex items-center justify-between gap-4 text-slate-600"><span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: colorA }} />{labelA}</span><span className="font-medium text-slate-900">{integer(active.a)}</span></p>
          <p className="flex items-center justify-between gap-4 text-slate-600"><span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: colorB }} />{labelB}</span><span className="font-medium text-slate-900">{integer(active.b)}</span></p>
        </div>
      )}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead><tr><th>Day</th><th>{labelA}</th><th>{labelB}</th></tr></thead>
        <tbody>{points.map(p => <tr key={p.day}><td>{p.day}</td><td>{p.a}</td><td>{p.b}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

export function HorizontalBars({ rows, color = '#1a5cff', summary }: { rows: { label: string; value: number; href?: string }[]; color?: string; summary: string }) {
  const max = niceMax(Math.max(1, ...rows.map(r => r.value)))
  return (
    <figure className="m-0">
      <figcaption className="sr-only">{summary}</figcaption>
      <ul className="space-y-2.5">
        {rows.map(row => (
          <li key={row.label} className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[10.5px]">
            {row.href ? <a href={row.href} className="truncate text-right text-slate-600 hover:text-[#1a5cff]">{row.label}</a> : <span className="truncate text-right text-slate-600">{row.label}</span>}
            <span className="flex items-center gap-2">
              <span className="h-3.5 rounded-sm" style={{ width: `${Math.max(2, (row.value / max) * 82)}%`, background: color }} aria-hidden />
              <span className="shrink-0 text-slate-700 tabular-nums">{compact(row.value)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-[9.5px] text-slate-500" aria-hidden>
        <span />
        <span className="flex justify-between pr-[18%]">{[0, 1, 2, 3].map(t => <span key={t}>{compact((max / 3) * t)}</span>)}</span>
      </div>
    </figure>
  )
}

export function Donut({ segments, centerValue, centerLabel, size = 124, summary }: {
  segments: { label: string; value: number; color: string }[]; centerValue: string; centerLabel: string; size?: number; summary: string
}) {
  // Legend values stay on one line; the ring shrinks slightly to make room.
  size = Math.min(size, 108)
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const r = 40, c = 2 * Math.PI * r
  const arcs = useMemo(() => {
    let offset = 0
    return segments.map(s => {
      const length = total ? (s.value / total) * c : 0
      const arc = { ...s, length, offset }
      offset += length
      return arc
    })
  }, [segments, total, c])
  return (
    <figure className="m-0 flex items-center gap-5">
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={50} cy={50} r={r} fill="none" stroke="#f1f5f9" strokeWidth={16} />
          {arcs.map(arc => arc.length > 0 && (
            <circle key={arc.label} cx={50} cy={50} r={r} fill="none" stroke={arc.color} strokeWidth={16}
              strokeDasharray={`${arc.length} ${c - arc.length}`} strokeDashoffset={-arc.offset} />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden>
          <span className="text-[16px] font-semibold text-slate-900">{centerValue}</span>
          <span className="text-[9.5px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map(s => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-[10.5px]">
            <span className="flex items-center gap-2 text-slate-700"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />{s.label}</span>
            <span className="whitespace-nowrap text-slate-600 tabular-nums">{compact(s.value)} ({total ? ((s.value / total) * 100).toFixed(1) : '0.0'}%)</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
