'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCompactMoney } from '@/lib/strategy/format'

// Lightweight SVG charts for Strategy. Each renders from real series props,
// scales to its container, exposes a hover/focus tooltip and always ships the
// same figures as a visually hidden table for assistive technology.

export interface LineSeries {
  key: string
  label: string
  colour: string
  dashed?: boolean
  area?: boolean
  /** Show the final value as a callout badge at the line's end. */
  endBadge?: boolean
  dotted?: boolean
}

type Row = Record<string, number | string | null>

/**
 * Container width for responsive SVG. Observes after mount only, and ignores
 * sub-2px changes so a scrollbar appearing/disappearing can never start a
 * resize → re-render → resize loop.
 */
function useSize(defaultWidth: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(defaultWidth)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(entries => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (next > 0) setWidth(current => (Math.abs(current - next) >= 2 ? next : current))
      })
    })
    observer.observe(node)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [])
  return { setRef: ref, width }
}

function niceMax(value: number, steps = 4): number {
  if (value <= 0) return steps
  const raw = value / steps
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalised = raw / magnitude
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10
  return nice * magnitude * steps
}

export function SrTable({ caption, columns, rows }: { caption: string; columns: { key: string; label: string }[]; rows: Row[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>{columns.map(column => <td key={column.key}>{row[column.key] ?? '—'}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

export function Legend({ items, className }: { items: { label: string; colour: string; dashed?: boolean; shape?: 'line' | 'square' | 'dot' | 'diamond' }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-sg-body lg:gap-x-[14px] lg:text-[9.5px]', className)} aria-hidden>
      {items.map(item => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.shape === 'square' ? <span className="h-2 w-2 rounded-[2px]" style={{ background: item.colour }} />
            : item.shape === 'dot' ? <span className="h-2 w-2 rounded-full" style={{ background: item.colour }} />
              : item.shape === 'diamond' ? <span className="h-2 w-2 rotate-45 border-[1.5px]" style={{ borderColor: item.colour }} />
                : (
                  <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={item.colour} strokeWidth="2" strokeDasharray={item.dashed ? '4 3' : undefined} /></svg>
                )}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// ── Line chart ───────────────────────────────────────────────────────────────

/** Serializable value formats, so server components can choose one. */
export type ValueFormat = 'plain' | 'compact' | 'percent' | { money: string }

function formatterFor(format: ValueFormat): (value: number) => string {
  if (format === 'compact') return value => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value).toUpperCase()
  if (format === 'percent') return value => `${Math.round(value)}%`
  if (typeof format === 'object') return value => formatCompactMoney(value, format.money, 1)
  return value => String(Math.round(value * 10) / 10)
}

export function LineChart({
  data, series, xKey, height = 130, yMax, yTicks = 5, valueFormat = 'plain',
  caption, className, padLeft = 30, showDots = true, highlightIndex,
}: {
  data: Row[]
  series: LineSeries[]
  xKey: string
  height?: number
  yMax?: number
  yTicks?: number
  valueFormat?: ValueFormat
  caption: string
  className?: string
  padLeft?: number
  showDots?: boolean
  highlightIndex?: number
}) {
  const { setRef, width } = useSize(360)
  const [hover, setHover] = useState<number | null>(highlightIndex ?? null)
  const gradientId = useId().replace(/:/g, '')
  const padTop = 8
  const padBottom = 20
  const padRight = 40
  const values = data.flatMap(row => series.map(s => Number(row[s.key])).filter(Number.isFinite))
  const minValue = Math.min(0, ...values)
  const max = yMax ?? niceMax(Math.max(...values, 1), yTicks - 1)
  const innerW = Math.max(40, width - padLeft - padRight)
  const innerH = height - padTop - padBottom
  const x = (index: number) => padLeft + (data.length <= 1 ? innerW / 2 : (index / (data.length - 1)) * innerW)
  const y = (value: number) => padTop + innerH - ((value - minValue) / (max - minValue || 1)) * innerH
  const formatY = formatterFor(valueFormat)
  const fmt = formatY

  return (
    <div ref={setRef} className={cn('relative w-full', className)}>
      <svg width={width} height={height} role="img" aria-label={caption} className="block overflow-visible"
        onMouseLeave={() => setHover(highlightIndex ?? null)}>
        <defs>
          {series.filter(s => s.area).map(s => (
            <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.colour} stopOpacity="0.14" />
              <stop offset="100%" stopColor={s.colour} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {Array.from({ length: yTicks }).map((_, index) => {
          const value = minValue + ((max - minValue) / (yTicks - 1)) * index
          return (
            <g key={index}>
              <line x1={padLeft} x2={padLeft + innerW} y1={y(value)} y2={y(value)} stroke="#eef2f6" strokeDasharray={value === 0 ? undefined : '0'} />
              <text x={padLeft - 8} y={y(value) + 3} textAnchor="end" className="fill-slate-400 text-[10px] lg:text-[9px]">{formatY(value)}</text>
            </g>
          )
        })}
        {data.map((row, index) => (
          <text key={index} x={x(index)} y={height - 4} textAnchor="middle" className="fill-slate-400 text-[10px] lg:text-[9px]">{String(row[xKey])}</text>
        ))}
        {series.map(s => {
          const points = data.map((row, index) => ({ index, value: Number(row[s.key]) })).filter(point => Number.isFinite(point.value))
          if (points.length === 0) return null
          const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.index)},${y(point.value)}`).join(' ')
          const last = points[points.length - 1]
          return (
            <g key={s.key}>
              {s.area && (
                <path d={`${path} L${x(last.index)},${y(minValue)} L${x(points[0].index)},${y(minValue)} Z`} fill={`url(#${gradientId}-${s.key})`} />
              )}
              <path d={path} fill="none" stroke={s.colour} strokeWidth={s.dashed ? 1.5 : 2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {showDots && points.map(point => (
                <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r={hover === point.index ? 4 : 3} fill={s.colour} stroke="white" strokeWidth={1.2} />
              ))}
              {s.endBadge && (
                (() => {
                  const label = fmt(last.value)
                  const badgeWidth = Math.max(24, label.length * 5.6 + 8)
                  return (
                    <g transform={`translate(${Math.min(x(last.index) + 10, width - badgeWidth - 1)},${y(last.value) - 8})`}>
                      <rect width={badgeWidth} height="15" rx="3.5" fill={s.dashed ? '#e2e8f0' : s.colour} />
                      <text x={badgeWidth / 2} y="10.8" textAnchor="middle" className={cn('text-[9px] font-semibold', s.dashed ? 'fill-slate-600' : 'fill-white')}>{label}</text>
                    </g>
                  )
                })()
              )}
            </g>
          )
        })}
        {hover !== null && data[hover] && (
          <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + innerH} stroke="#cbd5e1" strokeDasharray="3 3" />
        )}
        {data.map((_, index) => (
          <rect key={index} x={x(index) - innerW / Math.max(1, data.length - 1) / 2} y={padTop} width={innerW / Math.max(1, data.length - 1)} height={innerH}
            fill="transparent" onMouseEnter={() => setHover(index)} />
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute z-10 min-w-[120px] -translate-x-1/2 rounded-lg border border-sg-line bg-white px-2.5 py-2 text-[11px] shadow-sg-pop"
          style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: 0 }} aria-hidden>
          <p className="mb-1 font-semibold text-sg-ink">{String(data[hover][xKey])}</p>
          {series.map(s => (
            <p key={s.key} className="flex items-center justify-between gap-3 text-sg-body">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.colour }} />{s.label}</span>
              <span className="font-medium tabular-nums">{Number.isFinite(Number(data[hover][s.key])) ? fmt(Number(data[hover][s.key])) : '—'}</span>
            </p>
          ))}
        </div>
      )}
      <SrTable caption={caption} columns={[{ key: xKey, label: 'Period' }, ...series.map(s => ({ key: s.key, label: s.label }))]} rows={data} />
    </div>
  )
}

// ── Donut ────────────────────────────────────────────────────────────────────

export interface DonutSlice { key: string; label: string; value: number; colour: string }

export function Donut({
  slices, size = 130, thickness = 22, center, caption, gap = 1.5, className,
}: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  center?: React.ReactNode
  caption: string
  gap?: number
  className?: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0)
  const radius = size / 2 - thickness / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const active = slices.find(slice => slice.key === hover)

  return (
    <div className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={caption} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef2f6" strokeWidth={thickness} />
        {total > 0 && slices.map(slice => {
          const length = (Math.max(0, slice.value) / total) * circumference
          const dash = Math.max(0, length - (slices.filter(s => s.value > 0).length > 1 ? gap : 0))
          const element = (
            <circle key={slice.key} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={slice.colour}
              strokeWidth={hover === slice.key ? thickness + 3 : thickness} strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset} onMouseEnter={() => setHover(slice.key)} onMouseLeave={() => setHover(null)}
              className="transition-[stroke-width]" />
          )
          offset += length
          return element
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active ? (
          <>
            <span className="text-[16px] font-semibold text-sg-ink">{active.value}</span>
            <span className="max-w-[70%] text-[10px] leading-tight text-sg-muted">{active.label}</span>
          </>
        ) : center}
      </div>
      <SrTable caption={caption} columns={[{ key: 'label', label: 'Segment' }, { key: 'value', label: 'Value' }]}
        rows={slices.map(slice => ({ label: slice.label, value: slice.value }))} />
    </div>
  )
}

// ── Variance (bars above/below target + variance % line on a second axis) ────

export function VarianceChart({
  data, currency, height = 170, caption, className,
}: { data: { label: string; variance: number; pct: number }[]; currency: string; height?: number; caption: string; className?: string }) {
  const { setRef, width } = useSize(420)
  const [hover, setHover] = useState<number | null>(null)
  const padLeft = 40
  const padRight = 34
  const padTop = 8
  const padBottom = 18
  const innerW = Math.max(60, width - padLeft - padRight)
  const innerH = height - padTop - padBottom
  const moneyMax = niceMax(Math.max(1, ...data.map(row => Math.abs(row.variance))), 2)
  const pctMax = Math.max(10, Math.ceil(Math.max(...data.map(row => Math.abs(row.pct))) / 10) * 10)
  const band = innerW / Math.max(1, data.length)
  const yMoney = (value: number) => padTop + innerH / 2 - (value / moneyMax) * (innerH / 2)
  const yPct = (value: number) => padTop + innerH / 2 - (value / pctMax) * (innerH / 2)
  const money = (value: number) => formatCompactMoney(value, currency, 0)
  const line = data.map((row, index) => `${index === 0 ? 'M' : 'L'}${padLeft + band * index + band / 2},${yPct(row.pct)}`).join(' ')
  return (
    <div ref={setRef} className={cn('relative w-full', className)}>
      <svg width={width} height={height} role="img" aria-label={caption} className="block" onMouseLeave={() => setHover(null)}>
        {[-1, -0.5, 0, 0.5, 1].map(step => (
          <g key={step}>
            <line x1={padLeft} x2={padLeft + innerW} y1={yMoney(step * moneyMax)} y2={yMoney(step * moneyMax)} stroke={step === 0 ? '#cbd5e1' : '#eef2f6'} />
            <text x={padLeft - 6} y={yMoney(step * moneyMax) + 3} textAnchor="end" className="fill-slate-400 text-[9px] lg:text-[8px]">{money(step * moneyMax)}</text>
            <text x={padLeft + innerW + 6} y={yMoney(step * moneyMax) + 3} className="fill-slate-400 text-[9px] lg:text-[8px]">{Math.round(step * pctMax)}%</text>
          </g>
        ))}
        {data.map((row, index) => {
          const x = padLeft + band * index + band / 2 - 7
          const top = Math.min(yMoney(row.variance), yMoney(0))
          return (
            <g key={row.label} onMouseEnter={() => setHover(index)}>
              <rect x={padLeft + band * index} y={padTop} width={band} height={innerH} fill="transparent" />
              <rect x={x} y={top} width={14} height={Math.max(1, Math.abs(yMoney(row.variance) - yMoney(0)))} rx={1.5} fill={row.variance >= 0 ? '#16a34a' : '#ef4444'} opacity={hover === null || hover === index ? 1 : 0.6} />
              <text x={padLeft + band * index + band / 2} y={height - 3} textAnchor="middle" className="fill-slate-400 text-[9px] lg:text-[8px]">{row.label}</text>
            </g>
          )
        })}
        <path d={line} fill="none" stroke="#3f6ff8" strokeWidth={1.5} />
        {data.map((row, index) => <circle key={index} cx={padLeft + band * index + band / 2} cy={yPct(row.pct)} r={2.5} fill="white" stroke="#3f6ff8" strokeWidth={1.3} />)}
      </svg>
      {hover !== null && data[hover] && (
        <div aria-hidden className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-sg-line bg-white px-2.5 py-1.5 text-[11px] shadow-sg-pop"
          style={{ left: Math.min(Math.max(padLeft + band * hover + band / 2, 60), width - 60), top: 0 }}>
          <p className="font-semibold text-sg-ink">{data[hover].label}</p>
          <p className="text-sg-body">Variance {data[hover].variance >= 0 ? '+' : ''}{money(data[hover].variance)} ({data[hover].pct >= 0 ? '+' : ''}{data[hover].pct}%)</p>
        </div>
      )}
      <SrTable caption={caption} columns={[{ key: 'label', label: 'Month' }, { key: 'variance', label: 'Variance' }, { key: 'pct', label: 'Variance %' }]} rows={data} />
    </div>
  )
}

// ── Capacity (allocated vs capacity bars + utilisation line) ─────────────────

export function CapacityChart({
  data, height = 110, caption, className,
}: { data: { label: string; allocated: number; capacity: number }[]; height?: number; caption: string; className?: string }) {
  const { setRef, width } = useSize(220)
  const padLeft = 30
  const padTop = 6
  const padBottom = 16
  const max = 150
  const innerW = Math.max(40, width - padLeft - 6)
  const innerH = height - padTop - padBottom
  const band = innerW / Math.max(1, data.length)
  const y = (value: number) => padTop + innerH - (Math.min(max, value) / max) * innerH
  const utilisation = data.map((row, index) => ({ x: padLeft + band * index + band / 2 + 4, y: y(row.capacity ? (row.allocated / row.capacity) * 100 : 0) }))
  return (
    <div ref={setRef} className={cn('relative w-full', className)}>
      <svg width={width} height={height} role="img" aria-label={caption} className="block">
        {[0, 50, 100, 150].map(tick => (
          <g key={tick}>
            <line x1={padLeft} x2={padLeft + innerW} y1={y(tick)} y2={y(tick)} stroke="#eef2f6" />
            <text x={padLeft - 6} y={y(tick) + 3} textAnchor="end" className="fill-slate-400 text-[9px] lg:text-[8px]">{tick}%</text>
          </g>
        ))}
        {data.map((row, index) => {
          const left = padLeft + band * index + band / 2 - 12
          const allocated = row.capacity ? (row.allocated / row.capacity) * 100 : 0
          return (
            <g key={row.label}>
              <rect x={left} y={y(allocated)} width={12} height={padTop + innerH - y(allocated)} fill="#3f6ff8" rx={1.5}><title>{`${row.label}: ${Math.round(allocated)}% allocated`}</title></rect>
              <rect x={left + 14} y={y(100)} width={12} height={padTop + innerH - y(100)} fill="#dbe4fe" rx={1.5} />
              <text x={padLeft + band * index + band / 2} y={height - 3} textAnchor="middle" className="fill-slate-400 text-[9px] lg:text-[8px]">{row.label}</text>
            </g>
          )
        })}
        <polyline points={utilisation.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#14b8a6" strokeWidth={1.5} />
        {utilisation.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={2.5} fill="#14b8a6" />)}
      </svg>
      <SrTable caption={caption} columns={[{ key: 'label', label: 'Month' }, { key: 'allocated', label: 'Allocated' }, { key: 'capacity', label: 'Capacity' }]} rows={data} />
    </div>
  )
}

// ── Grouped bars ─────────────────────────────────────────────────────────────

export function GroupedBars({
  data, series, xKey, height = 140, currency, caption, className, padLeft = 34,
  barWidth = 16, groupGap = 5, yTicks = 4,
}: {
  data: Row[]
  series: { key: string; label: string; colour: string }[]
  xKey: string
  height?: number
  /** Formats the axis and tooltip as compact money (a code, so it can cross the RSC boundary). */
  currency?: string
  caption: string
  className?: string
  padLeft?: number
  barWidth?: number
  groupGap?: number
  yTicks?: number
}) {
  const { setRef, width } = useSize(300)
  const [hover, setHover] = useState<number | null>(null)
  const formatY = (value: number) => (currency ? formatCompactMoney(value, currency, 0) : String(value))
  const padTop = 6
  const padBottom = 18
  const values = data.flatMap(row => series.map(s => Number(row[s.key]) || 0))
  const max = niceMax(Math.max(...values, 1), yTicks - 1)
  const innerW = Math.max(40, width - padLeft - 8)
  const innerH = height - padTop - padBottom
  const band = innerW / Math.max(1, data.length)
  const y = (value: number) => padTop + innerH - (value / max) * innerH

  return (
    <div ref={setRef} className={cn('relative w-full', className)}>
      <svg width={width} height={height} role="img" aria-label={caption} className="block" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: yTicks }).map((_, index) => {
          const value = (max / (yTicks - 1)) * index
          return (
            <g key={index}>
              <line x1={padLeft} x2={padLeft + innerW} y1={y(value)} y2={y(value)} stroke="#eef2f6" />
              <text x={padLeft - 8} y={y(value) + 3} textAnchor="end" className="fill-slate-400 text-[10px] lg:text-[9px]">{formatY(value)}</text>
            </g>
          )
        })}
        {data.map((row, index) => {
          const groupWidth = series.length * barWidth + (series.length - 1) * groupGap
          const left = padLeft + band * index + (band - groupWidth) / 2
          return (
            <g key={index} onMouseEnter={() => setHover(index)}>
              <rect x={padLeft + band * index} y={padTop} width={band} height={innerH} fill="transparent" />
              {series.map((s, seriesIndex) => {
                const value = Number(row[s.key]) || 0
                return (
                  <rect key={s.key} x={left + seriesIndex * (barWidth + groupGap)} y={y(value)} width={barWidth}
                    height={Math.max(0, padTop + innerH - y(value))} rx={2} fill={s.colour} opacity={hover === null || hover === index ? 1 : 0.55} />
                )
              })}
              <text x={padLeft + band * index + band / 2} y={height - 4} textAnchor="middle" className="fill-slate-400 text-[10px] lg:text-[9px]">{String(row[xKey])}</text>
            </g>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute z-10 min-w-[110px] -translate-x-1/2 rounded-lg border border-sg-line bg-white px-2.5 py-2 text-[11px] shadow-sg-pop"
          style={{ left: Math.min(Math.max(padLeft + band * hover + band / 2, 60), width - 60), top: -6 }} aria-hidden>
          <p className="mb-1 font-semibold text-sg-ink">{String(data[hover][xKey])}</p>
          {series.map(s => (
            <p key={s.key} className="flex justify-between gap-3 text-sg-body">
              <span>{s.label}</span><span className="font-medium tabular-nums">{formatY(Number(data[hover][s.key]) || 0)}</span>
            </p>
          ))}
        </div>
      )}
      <SrTable caption={caption} columns={[{ key: xKey, label: 'Period' }, ...series.map(s => ({ key: s.key, label: s.label }))]} rows={data} />
    </div>
  )
}
