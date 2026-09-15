import { cn } from '@/lib/utils'

// Area/line chart with a y-axis, date ticks and an optional dashed comparison
// series, as on the Spend Trend / ROAS Trend / Audience Growth panels.
//
// Paths are drawn in a stretchable SVG (non-scaling strokes) while all text is
// HTML, so labels stay crisp at any width. Server-renderable: no chart library,
// no hydration cost, fixed height from first paint.

export type TrendPoint = { date: string; value: number }
type Format = 'currency' | 'number' | 'roas' | 'percent'

const W = 600

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exponent = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / exponent
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 4 ? 4 : fraction <= 5 ? 5 : 10
  return step * exponent
}

function axisLabel(value: number, format: Format): string {
  if (format === 'roas') return `${Number.isInteger(value) ? value : value.toFixed(1)}x`
  if (format === 'percent') return `${value.toFixed(value < 10 ? 1 : 0)}%`
  const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return format === 'currency' ? `£${compact}` : compact
}

/** Catmull-Rom to cubic Bézier: the smooth curve used in the reference charts. */
function smoothPath(coords: [number, number][]): string {
  if (coords.length === 0) return ''
  let path = `M${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`
  for (let index = 0; index < coords.length - 1; index += 1) {
    const p0 = coords[index - 1] ?? coords[index]
    const p1 = coords[index]
    const p2 = coords[index + 1]
    const p3 = coords[index + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    path += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return path
}

export default function TrendChart({
  points, comparison, format = 'currency', color = '#2563EB', height = 170,
  ticks = 5, summary, className,
}: {
  points: TrendPoint[]
  comparison?: TrendPoint[]
  format?: Format
  color?: string
  height?: number
  ticks?: number
  summary: string
  className?: string
}) {
  const values = [...points, ...(comparison ?? [])].map(point => point.value).filter(Number.isFinite)
  const max = niceMax(Math.max(0, ...values) * 1.05)
  const steps = 4
  const gradient = `trend-${color.replace('#', '')}-${points.length}`

  const toCoords = (series: TrendPoint[]): [number, number][] =>
    series.map((point, index) => [
      series.length === 1 ? W / 2 : (index / (series.length - 1)) * W,
      height - (Math.max(0, point.value) / max) * height,
    ])

  const current = toCoords(points)
  const previous = comparison?.length ? toCoords(comparison) : null
  const line = smoothPath(current)
  const area = current.length ? `${line} L${W} ${height} L0 ${height} Z` : ''

  const tickIndexes = points.length <= 1 ? [0]
    : Array.from({ length: Math.min(ticks, points.length) }, (_, index) => Math.round((index / (Math.min(ticks, points.length) - 1)) * (points.length - 1)))

  if (points.length === 0) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-[12px] text-slate-400', className)} style={{ height: height + 22 }}>
        No data for this period
      </div>
    )
  }

  return (
    <figure className={cn('m-0', className)} aria-label={summary}>
      <div className="flex">
        <div className="relative w-10 shrink-0" style={{ height }} aria-hidden>
          {Array.from({ length: steps + 1 }, (_, index) => {
            const value = (max / steps) * (steps - index)
            return (
              <span key={index} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-slate-400" style={{ top: (index / steps) * height }}>
                {axisLabel(value, format)}
              </span>
            )
          })}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {Array.from({ length: steps + 1 }, (_, index) => (
            <div key={index} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (index / steps) * height }} aria-hidden />
          ))}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.16" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradient})`} />
            {previous && (
              <path d={smoothPath(previous)} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            )}
            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      <div className="relative ml-10 mt-1.5 h-4" aria-hidden>
        {tickIndexes.map(index => (
          <span
            key={index}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] text-slate-400"
            style={{ left: `${points.length <= 1 ? 50 : (index / (points.length - 1)) * 100}%` }}
          >
            {new Date(`${points[index].date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

/** The "—— current  - - - comparison" legend under a trend chart. */
export function TrendLegend({ current, comparison, color = '#2563EB' }: { current: string; comparison?: string; color?: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11.5px] text-slate-500">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ backgroundColor: color }} aria-hidden />{current}</span>
      {comparison && (
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed" style={{ borderColor: color, opacity: 0.5 }} aria-hidden />{comparison}
        </span>
      )}
    </div>
  )
}
