import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { fmtCompact } from '@/lib/messaging/metrics'

// Server-rendered SVG charts for the Messaging dashboards. Each chart carries a
// text summary for screen readers; values come straight from the data layer.

export interface Series { key: string; label: string; color: string }

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {series.map(s => (
        <li key={s.key} className="flex items-center gap-1 text-[11px] text-slate-500 lg:text-[7.5px]">
          <span className="h-2 w-2 rounded-[2px] lg:h-[6px] lg:w-[6px]" style={{ background: s.color }} aria-hidden />{s.label}
        </li>
      ))}
    </ul>
  )
}

function niceMax(value: number) {
  if (value <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const n = value / exp
  const step = n <= 1.2 ? 1.2 : n <= 1.6 ? 1.6 : n <= 2 ? 2 : n <= 2.4 ? 2.4 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 6 ? 6 : n <= 8 ? 8 : 10
  return step * exp
}

const shortDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

/**
 * Multi-series line chart with point markers. `format` controls the y axis
 * (compact counts or percentages). An empty dataset renders a quiet empty state.
 */
export function LineChart({
  data, series, height = 120, format = 'compact', max, ticks = 4, markers = true, xLabelCount = 5, emptyLabel = 'No sends in this period yet.', rightAxis,
}: {
  data: Record<string, number | string>[]
  series: Series[]
  height?: number
  format?: 'compact' | 'percent'
  max?: number
  ticks?: number
  markers?: boolean
  xLabelCount?: number
  emptyLabel?: string
  rightAxis?: { key: string; max: number; format: 'percent' }
}) {
  if (data.length === 0) return <div className="flex items-center justify-center text-[12px] text-slate-400 lg:text-[9px]" style={{ height }}>{emptyLabel}</div>
  const W = 300, H = height, left = 26, right = rightAxis ? 22 : 6, top = 6, bottom = 16
  const primary = series.filter(s => s.key !== rightAxis?.key)
  const peak = max ?? niceMax(Math.max(...data.flatMap(d => primary.map(s => Number(d[s.key]) || 0))))
  const x = (i: number) => left + (data.length === 1 ? 0 : (i * (W - left - right)) / (data.length - 1))
  const y = (v: number, m = peak) => top + (H - top - bottom) * (1 - Math.min(v, m) / m)
  const label = (v: number) => format === 'percent' ? `${Math.round(v)}%` : fmtCompact(v)
  const xIdx = Array.from({ length: Math.min(xLabelCount, data.length) }, (_, i) => Math.round((i * (data.length - 1)) / Math.max(1, Math.min(xLabelCount, data.length) - 1)))
  const summary = series.map(s => `${s.label} from ${label(Number(data[0][s.key]) || 0)} to ${label(Number(data[data.length - 1][s.key]) || 0)}`).join('; ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={summary}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (peak * i) / ticks
        return (
          <g key={i}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="#eef2f7" strokeWidth={0.6} />
            <text x={left - 4} y={y(v) + 2} textAnchor="end" fontSize={6.5} fill="#94a3b8">{label(v)}</text>
            {rightAxis && <text x={W - right + 4} y={y(v) + 2} fontSize={6.5} fill="#94a3b8">{Math.round((rightAxis.max * i) / ticks)}%</text>}
          </g>
        )
      })}
      {series.map(s => {
        const m = s.key === rightAxis?.key ? rightAxis.max : peak
        const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(Number(d[s.key]) || 0, m).toFixed(1)}`)
        return (
          <g key={s.key}>
            <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={1.1} strokeLinejoin="round" />
            {markers && data.map((d, i) => <circle key={i} cx={x(i)} cy={y(Number(d[s.key]) || 0, m)} r={1.1} fill={s.color} />)}
          </g>
        )
      })}
      {xIdx.map(i => (
        <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize={6.5} fill="#94a3b8">{shortDay(String(data[i].date))}</text>
      ))}
    </svg>
  )
}

export interface Slice { key: string; label: string; value: number; color: string }

/** Ring chart with an HTML centre label so the text stays crisp. */
export function Donut({ slices, size = 96, thickness = 14, center, sub, emptyLabel = 'No data yet', className }: {
  slices: Slice[]; size?: number; thickness?: number; center?: ReactNode; sub?: ReactNode; emptyLabel?: string; className?: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img"
        aria-label={total ? slices.map(s => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ') : emptyLabel}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth={thickness} />
        {total > 0 && slices.map(s => {
          const len = (s.value / total) * c
          const el = <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${Math.max(0, len - 0.8)} ${c}`} strokeDashoffset={-offset} />
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        {total > 0 ? <>{center}{sub}</> : <span className="text-[10px] text-slate-400">{emptyLabel}</span>}
      </div>
    </div>
  )
}

export function DonutLegend({ slices, format, className }: { slices: Slice[]; format?: (s: Slice, share: number) => ReactNode; className?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  return (
    <ul className={cn('min-w-0 space-y-1.5 lg:space-y-[9px]', className)}>
      {slices.map(s => {
        const share = total ? (s.value / total) * 100 : 0
        return (
          <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500 lg:text-[7.5px]">
            <span className="h-2 w-2 shrink-0 rounded-[2px] lg:h-[6px] lg:w-[6px]" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="whitespace-nowrap tabular-nums text-slate-600">{format ? format(s, share) : `${share.toFixed(1)}%`}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Horizontal bar list (Top message types, Top campaigns, Drop-off analysis). */
export function BarList({ rows, color = '#2563eb', valueFormat, labelWidth = 'w-24 lg:w-[62px]', thick }: {
  rows: { key: string; label: ReactNode; value: number; max?: number; display?: string }[]
  color?: string
  valueFormat?: (v: number) => string
  labelWidth?: string
  thick?: boolean
}) {
  const max = Math.max(1, ...rows.map(r => r.max ?? r.value))
  return (
    <ul className="space-y-2.5 lg:space-y-[11px]">
      {rows.map(r => (
        <li key={r.key} className="flex items-center gap-2">
          <span className={cn('shrink-0 truncate text-[11px] text-slate-500 lg:text-[7.5px]', labelWidth)}>{r.label}</span>
          <span className={cn('relative min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100', thick ? 'h-2 lg:h-[5px]' : 'h-1.5 lg:h-[4px]')}>
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-600 lg:w-[30px] lg:text-[7.5px]">{r.display ?? (valueFormat ? valueFormat(r.value) : r.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Tapered funnel (Engagement funnel, Conversion funnel). */
export function Funnel({ steps, colors, className }: {
  steps: { key: string; label: string; value: number; note?: string }[]
  colors: string[]
  className?: string
}) {
  const max = Math.max(1, steps[0]?.value ?? 1)
  return (
    <ol className={cn('space-y-1 lg:space-y-[3px]', className)}>
      {steps.map((step, i) => {
        const width = 100 - i * (46 / Math.max(1, steps.length - 1))
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span className="flex w-[48%] justify-center">
              <span className="flex h-6 items-center justify-center text-[11px] font-medium lg:h-[17px] lg:text-[7.5px]"
                style={{ width: `${width}%`, background: colors[i % colors.length], color: i < 2 ? '#1e40af' : '#fff', clipPath: 'polygon(0 0, 100% 0, 94% 100%, 6% 100%)' }}>
                {step.label}
              </span>
            </span>
            <span className="text-[11px] tabular-nums text-slate-700 lg:text-[8px]">{step.value.toLocaleString('en-GB')}</span>
            {step.note && <span className="text-[11px] text-slate-400 lg:text-[7.5px]">{step.note}</span>}
            <span className="sr-only">{Math.round((step.value / max) * 100)}% of first step</span>
          </li>
        )
      })}
    </ol>
  )
}
