import { cn } from '@/lib/utils'

// Inline SVG sparkline. No chart library, so the KPI strip has no hydration
// cost and reserves its exact height from first paint (no layout shift).
//
// A series with no variation still renders a flat baseline rather than an empty
// box, and an empty series renders the baseline plus a text alternative, so the
// card never looks broken while data is genuinely absent.

type Props = {
  points: { date: string; value: number }[]
  color?: string
  width?: number
  height?: number
  className?: string
  /** Sentence read by assistive tech instead of the path. */
  summary?: string
  strokeWidth?: number
  fill?: boolean
}

export default function Sparkline({
  points, color = '#2563EB', width = 260, height = 34,
  className, summary, strokeWidth = 1.5, fill = false,
}: Props) {
  const values = points.map(point => point.value).filter(value => Number.isFinite(value))
  const pad = strokeWidth + 1

  if (values.length < 2) {
    return (
      <svg
        className={cn('w-full', className)} viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none" role="img" aria-label={summary ?? 'No trend data available'}
      >
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="#E2E8F0" strokeWidth={strokeWidth} strokeDasharray="3 3"
        />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const usable = height - pad * 2

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    // A flat series sits on the centre line rather than dividing by zero.
    const y = span === 0 ? height / 2 : pad + usable - ((value - min) / span) * usable
    return [x, y] as const
  })

  const path = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')

  const area = `${path} L${width} ${height} L0 ${height} Z`
  const gradientId = `spark-${color.replace('#', '')}-${values.length}`

  return (
    <svg
      className={cn('w-full', className)} viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none" role="img" aria-label={summary ?? 'Trend over the selected period'}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={path} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
