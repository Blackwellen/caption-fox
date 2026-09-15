import { cn } from '@/lib/utils'

// Ring chart with a centred total and a legend, used by Source Health,
// Audience Composition, Conversions by Platform, Budget Distribution and
// Audience Breakdown. Pure SVG so it server-renders at a fixed size.
// Slices carry their own labels and values in the legend — colour is never
// the only way to read the chart.

export type DonutSlice = { key: string; label: string; value: number; color: string; detail?: string }

export default function Donut({
  slices, centerValue, centerLabel, size = 132, thickness = 16, className, legendClassName, summary, stacked = false,
}: {
  /** Label on one line, value beneath it (Reports design); for narrow panels. */
  stacked?: boolean
  slices: DonutSlice[]
  centerValue: string
  centerLabel: string
  size?: number
  thickness?: number
  className?: string
  legendClassName?: string
  summary: string
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className={cn('flex items-center', stacked ? 'gap-4' : 'gap-5', className)}>
      <figure className="relative m-0 shrink-0" style={{ width: size, height: size }} aria-label={summary}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
          {total > 0 && slices.map(slice => {
            const length = (Math.max(0, slice.value) / total) * circumference
            const dash = `${length} ${circumference - length}`
            const circle = (
              <circle
                key={slice.key} cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={slice.color} strokeWidth={thickness} strokeDasharray={dash} strokeDashoffset={-offset}
              />
            )
            offset += length
            return circle
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {/* Long values (e.g. £380.5K) step down so they stay inside the ring. */}
          <span className={`font-semibold leading-none text-slate-900 tabular-nums ${centerValue.length > 6 ? 'text-[15px]' : centerValue.length > 4 ? 'text-[17px]' : 'text-[19px]'}`}>{centerValue}</span>
          {/* Kept inside the ring's hole on small donuts. */}
          <span className="mt-1 truncate text-slate-500" style={{ maxWidth: size - thickness * 2 - 8, fontSize: size < 120 ? 9.5 : 10.5 }}>{centerLabel}</span>
        </div>
        <figcaption className="sr-only">{summary}</figcaption>
      </figure>
      <ul className={cn('min-w-0 flex-1', stacked ? 'space-y-1.5' : 'space-y-2', legendClassName)}>
        {stacked ? slices.map(slice => (
          <li key={slice.key} className="min-w-0 text-[11px] leading-4">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-800">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="block pl-3.5 tabular-nums text-slate-500">
              {slice.detail ?? `${total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0.0'}%`}
            </span>
          </li>
        )) : slices.map(slice => (
          <li key={slice.key} className="flex items-start justify-between gap-3 text-[12px]">
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {slice.detail ?? `${total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0.0'}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
