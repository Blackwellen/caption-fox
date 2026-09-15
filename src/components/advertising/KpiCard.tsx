import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Sparkline from './Sparkline'
import {
  DASH, formatCurrency, formatNumber, formatPercent, formatRoas,
} from '@/lib/advertising/metrics'
import type { KpiValue } from '@/lib/advertising/queries/shared'

// The KPI card used across all six Advertising pages.
//
// Two details matter for honesty here:
//   - a null value renders an em dash, never a zero, so "no data" stays legible
//   - the delta colour follows the metric's own semantics; on CPA a fall is
//     good, so the colour is inverted rather than the arrow

type Props = {
  kpi: KpiValue
  icon: ReactNode
  /** Accent for the icon tile and sparkline stroke. */
  accent: string
  comparisonLabel: string
  className?: string
}

function renderValue(kpi: KpiValue): { main: string; fraction: string | null } {
  if (kpi.value === null || !Number.isFinite(kpi.value)) return { main: DASH, fraction: null }

  switch (kpi.format) {
    case 'currency': {
      const full = formatCurrency(kpi.value)
      // The reference sets the pence a shade lighter; split on the decimal.
      const index = full.lastIndexOf('.')
      return index === -1
        ? { main: full, fraction: null }
        : { main: full.slice(0, index), fraction: full.slice(index) }
    }
    case 'roas': return { main: formatRoas(kpi.value), fraction: null }
    case 'percent': return { main: formatPercent(kpi.value), fraction: null }
    case 'integer': return { main: formatNumber(kpi.value), fraction: null }
    default: return { main: formatNumber(kpi.value, { decimals: 0 }), fraction: null }
  }
}

export default function KpiCard({ kpi, icon, accent, comparisonLabel, className }: Props) {
  const { main, fraction } = renderValue(kpi)
  const hasDelta = kpi.delta !== null && Number.isFinite(kpi.delta)
  const rising = hasDelta && (kpi.delta as number) > 0
  const falling = hasDelta && (kpi.delta as number) < 0
  // On an inverse metric such as CPA, falling is the good direction.
  const good = kpi.inverse ? falling : rising
  const bad = kpi.inverse ? rising : falling

  const deltaText = hasDelta
    ? `${Math.abs(kpi.delta as number).toFixed(kpi.deltaUnit === 'pp' ? 2 : 1)}${kpi.deltaUnit === 'pp' ? 'pp' : '%'}`
    : null

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white px-4 pb-3 pt-3.5',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${accent}14`, color: accent }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="truncate text-[12.5px] font-medium text-slate-600" title={kpi.tooltip}>
          {kpi.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[26px] font-bold leading-none tracking-tight text-slate-900">
          {main}
          {fraction && <span className="text-slate-400">{fraction}</span>}
        </span>
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[12px] font-semibold leading-none',
              good && 'text-emerald-600',
              bad && 'text-red-500',
              !good && !bad && 'text-slate-400',
            )}
          >
            <span aria-hidden>{rising ? '↑' : falling ? '↓' : ''}</span>
            <span className="sr-only">{rising ? 'Up' : falling ? 'Down' : 'No change'}</span>
            {deltaText}
          </span>
        ) : (
          <span className="text-[12px] font-medium text-slate-300" title="No comparison data for the previous period">
            {DASH}
          </span>
        )}
      </div>

      <p className="mt-1.5 truncate text-[11px] text-slate-400">vs {comparisonLabel}</p>

      <div className="mt-2 h-[34px]">
        <Sparkline
          points={kpi.spark}
          color={accent}
          height={34}
          summary={`${kpi.label} trend across the selected period`}
        />
      </div>
    </div>
  )
}
