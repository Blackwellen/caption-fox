import type { ReactNode } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compactNumber } from '@/lib/social/metrics'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { hasBrand } from '@/lib/brand/brands'

// Server-renderable building blocks shared by all six Social pages and their
// detail routes. Sizes follow the approved references at 1491 × 1055: dense
// type behind `lg:` so tablet and phone keep legible text and touch targets.
// Charts are plain SVG + HTML labels — no chart library, no hydration cost,
// fixed heights from first paint, and every chart carries a text summary.

export const DASH = '—'

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({ children, className, as: Tag = 'section', ...rest }: {
  children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      {...rest}
      className={cn(
        'min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function CardTitle({ title, hint, count, children, className, level = 'h2' }: {
  title: string; hint?: string; count?: number | string; children?: ReactNode; className?: string; level?: 'h2' | 'h3'
}) {
  const Heading = level
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Heading className="truncate text-[14px] font-semibold text-slate-900 lg:text-[12.5px]">{title}</Heading>
        {count !== undefined && (
          <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500 lg:text-[10px]">{count}</span>
        )}
        {hint && <Hint label={hint} />}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

export function Hint({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 cursor-help text-slate-400" title={label}>
      <Info size={12} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('whitespace-nowrap rounded text-[12.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline lg:text-[10.5px]', className)}>
      {children}
    </Link>
  )
}

// ── Numbers ──────────────────────────────────────────────────────────────────

export function fmtCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? DASH : compactNumber(value)
}

export function fmtRate(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? DASH : `${(value * 100).toFixed(digits)}%`
}

/** "↑ 18.6%" / "↓ 2.4pp". Colour follows direction unless `inverse` (e.g. response time). */
export function Delta({ value, unit = '%', inverse = false, digits = 1, className }: {
  value: number | null | undefined; unit?: '%' | 'pp'; inverse?: boolean; digits?: number; className?: string
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn('text-[11px] text-slate-300 lg:text-[9.5px]', className)} title="No comparison data for the previous period">{DASH}</span>
  }
  const up = value > 0
  const down = value < 0
  const good = inverse ? down : up
  const bad = inverse ? up : down
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium tabular-nums lg:text-[9.5px]',
      good && 'text-emerald-600', bad && 'text-red-500', !good && !bad && 'text-slate-400', className,
    )}>
      <span aria-hidden>{up ? '↑' : down ? '↓' : ''}</span>
      <span className="sr-only">{up ? 'up' : down ? 'down' : 'unchanged'}</span>
      {Math.abs(value).toFixed(digits)}{unit}
    </span>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────────

export type Tone = 'green' | 'blue' | 'violet' | 'amber' | 'red' | 'slate' | 'orange'

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium lg:h-[15px] lg:text-[9px]', TONES[tone], className)}>
      {children}
    </span>
  )
}

export const POST_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'slate' },
  pending_approval: { label: 'Pending', tone: 'amber' },
  approved: { label: 'Approved', tone: 'violet' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  queued: { label: 'Queued', tone: 'blue' },
  publishing: { label: 'Publishing', tone: 'blue' },
  published: { label: 'Published', tone: 'green' },
  partially_published: { label: 'Partially published', tone: 'amber' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  archived: { label: 'Archived', tone: 'slate' },
}

export const HEALTH: Record<string, { label: string; tone: Tone; text: string; dot: string }> = {
  healthy: { label: 'Healthy', tone: 'green', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  watch: { label: 'Watch', tone: 'orange', text: 'text-orange-500', dot: 'bg-orange-400' },
  warning: { label: 'Warning', tone: 'orange', text: 'text-orange-500', dot: 'bg-orange-400' },
  syncing: { label: 'Syncing', tone: 'blue', text: 'text-blue-600', dot: 'bg-blue-500' },
  error: { label: 'Error', tone: 'red', text: 'text-red-600', dot: 'bg-red-500' },
  expired: { label: 'Expired', tone: 'red', text: 'text-red-600', dot: 'bg-red-500' },
  disconnected: { label: 'Disconnected', tone: 'slate', text: 'text-slate-500', dot: 'bg-slate-400' },
}

export const SENTIMENT: Record<string, { label: string; tone: Tone; color: string }> = {
  positive: { label: 'Positive', tone: 'green', color: '#22C55E' },
  neutral: { label: 'Neutral', tone: 'slate', color: '#94A3B8' },
  negative: { label: 'Negative', tone: 'red', color: '#EF4444' },
}

export function PostStatusBadge({ status }: { status: string }) {
  const style = POST_STATUS[status] ?? { label: status, tone: 'slate' as Tone }
  return <Badge tone={style.tone}>{style.label}</Badge>
}

// ── People and providers ─────────────────────────────────────────────────────

export function Avatar({ src, name, size = 28, className, ring }: {
  src?: string | null; name?: string | null; size?: number; className?: string; ring?: boolean
}) {
  const initials = (name ?? '?').replace(/[@_.]/g, ' ').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?'
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-semibold text-slate-600', ring && 'ring-2 ring-white', className)}
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.36) }}
    >
      {src
        // eslint-disable-next-line @next/next/no-img-element -- storage-backed avatar, sized by the parent
        ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        : <span aria-hidden>{initials}</span>}
      <span className="sr-only">{name ?? 'Unknown'}</span>
    </span>
  )
}

export const PROVIDER_NAMES: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube',
  x: 'X (Twitter)', pinterest: 'Pinterest', threads: 'Threads', reddit: 'Reddit', blogs: 'Blogs', web: 'Web',
}

/** Platforms whose own logo is the mark itself (no app tile), per the references. */
const BARE_MARK = new Set(['facebook', 'youtube'])

/** Platform app-icon tiles as used in the references — each platform's real logo. */
export function ProviderIcon({ provider, size = 20, className, decorative = false }: {
  provider: string; size?: number; className?: string; decorative?: boolean
}) {
  const label = PROVIDER_NAMES[provider] ?? provider
  if (hasBrand(provider)) {
    return <BrandLogo brand={provider} variant={BARE_MARK.has(provider) ? 'mark' : 'app'} size={size} className={className} title={label} decorative={decorative} />
  }
  // Non-platform sources (blogs, web) keep a neutral tile.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
    >
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#10B981" />
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ── Time ─────────────────────────────────────────────────────────────────────

/** Server-rendered relative time: "2m", "3h", "4d". Absolute UTC in the tooltip. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return DASH
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`
}

export function Ago({ iso, className }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return <span className={className}>{DASH}</span>
  return (
    <time dateTime={iso} title={`${fmtDateTime(iso)} UTC`} className={cn('whitespace-nowrap tabular-nums', className)}>
      {timeAgo(iso)}
    </time>
  )
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const TIME_ONLY = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })

export const fmtDateTime = (iso: string) => DATE_TIME.format(new Date(iso)).replace(' am', ' AM').replace(' pm', ' PM')
export const fmtDate = (iso: string) => DATE_ONLY.format(new Date(iso))
export const fmtDayMonth = (iso: string) => DAY_MONTH.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso))
export const fmtTime = (iso: string) => TIME_ONLY.format(new Date(iso)).replace(' am', ' AM').replace(' pm', ' PM')

// ── Charts ───────────────────────────────────────────────────────────────────

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const exponent = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / exponent
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 4 ? 4 : fraction <= 5 ? 5 : fraction <= 7.5 ? 7.5 : 10
  return step * exponent
}

function smooth(points: [number, number][]): string {
  if (points.length === 0) return ''
  let path = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    path += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return path
}

export type ChartSeries = {
  key: string; label: string; color: string; values: (number | null)[]; axis?: 'left' | 'right'
  /** Draw this series scaled into its own vertical band [bottom, top] (fractions of the plot). */
  band?: [number, number]
  format?: (value: number) => string
}

/**
 * Multi-series smooth line chart with dots, a left axis and an optional right
 * axis (used for Engagement Rate beside volume metrics). Null values break the
 * line instead of dropping to zero.
 */
export function LineChart({
  labels, series, height = 150, leftFormat = compactNumber, rightFormat, dots = true, summary, className, ticks = 4, leftMax: fixedLeftMax,
}: {
  leftMax?: number
  labels: string[]
  series: ChartSeries[]
  height?: number
  leftFormat?: (value: number) => string
  rightFormat?: (value: number) => string
  dots?: boolean
  summary: string
  className?: string
  ticks?: number
}) {
  const W = 600
  const left = series.filter(item => item.axis !== 'right')
  const right = series.filter(item => item.axis === 'right')
  const maxOf = (items: ChartSeries[]) => niceCeil(Math.max(0, ...items.filter(item => !item.band).flatMap(item => item.values.filter((v): v is number => v !== null))) * 1.08)
  const leftMax = fixedLeftMax ?? maxOf(left)
  const rightMax = right.length ? maxOf(right) : 1
  const n = labels.length
  const x = (index: number) => (n <= 1 ? W / 2 : 8 + (index / (n - 1)) * (W - 16))
  const y = (value: number, max: number) => height - (value / max) * (height - 6)
  const bandY = (item: ChartSeries, value: number) => {
    if (!item.band) return y(value, item.axis === 'right' ? rightMax : leftMax)
    const known = item.values.filter((v): v is number => v !== null)
    const lo = Math.min(...known)
    const hi = Math.max(...known)
    const t = hi === lo ? 0.5 : (value - lo) / (hi - lo)
    const fraction = item.band[0] + t * (item.band[1] - item.band[0])
    return height - fraction * (height - 6)
  }

  if (n === 0 || series.every(item => item.values.every(value => value === null))) {
    return <div className={cn('flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-[12px] text-slate-400', className)} style={{ height: height + 20 }}>No data for this period</div>
  }

  return (
    <figure className={cn('m-0', className)}>
      <div className="flex">
        <div className="relative w-9 shrink-0" style={{ height }} aria-hidden>
          {Array.from({ length: ticks + 1 }, (_, index) => (
            <span key={index} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-slate-400 lg:text-[8.5px]" style={{ top: (index / ticks) * (height - 6) + 6 }}>
              {leftFormat((leftMax / ticks) * (ticks - index))}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {Array.from({ length: ticks + 1 }, (_, index) => (
            <div key={index} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ top: (index / ticks) * (height - 6) + 6 }} aria-hidden />
          ))}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden>
            {series.map(item => {
              const max = item.axis === 'right' ? rightMax : leftMax
              const segments: [number, number][][] = [[]]
              item.values.forEach((value, index) => {
                if (value === null) { if (segments.at(-1)!.length) segments.push([]) } else segments.at(-1)!.push([x(index), item.band ? bandY(item, value) : y(value, max)])
              })
              return segments.map((segment, segmentIndex) => (
                <path key={`${item.key}-${segmentIndex}`} d={smooth(segment)} fill="none" stroke={item.color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              ))
            })}
          </svg>
          {dots && series.map(item => item.values.map((value, index) => value === null ? null : (
            <span
              key={`${item.key}-${index}`}
              className="absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-white"
              style={{ left: `${(x(index) / W) * 100}%`, top: bandY(item, value), borderColor: item.color }}
              title={`${item.label} · ${labels[index]}: ${(item.format ?? (item.axis === 'right' ? rightFormat ?? leftFormat : leftFormat))(value)}`}
            />
          )))}
        </div>
        {right.length > 0 && rightFormat && (
          <div className="relative w-8 shrink-0" style={{ height }} aria-hidden>
            {Array.from({ length: ticks + 1 }, (_, index) => (
              <span key={index} className="absolute left-1.5 -translate-y-1/2 text-[10px] tabular-nums text-slate-400 lg:text-[8.5px]" style={{ top: (index / ticks) * (height - 6) + 6 }}>
                {rightFormat((rightMax / ticks) * (ticks - index))}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={cn('relative mt-1.5 h-4', right.length && rightFormat ? 'ml-9 mr-8' : 'ml-9')} aria-hidden>
        {labels.map((label, index) => (
          <span key={index} className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500 lg:text-[8.5px]" style={{ left: `${(x(index) / W) * 100}%` }}>
            {n > 10 && index % Math.ceil(n / 8) !== 0 && index !== n - 1 ? '' : label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-600 lg:text-[9.5px]', className)}>
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
          {item.label}
          {item.value !== undefined && <span className="font-semibold text-slate-800">{item.value}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Stacked daily columns, one segment per channel (Content Performance). */
export function StackedBars({ labels, stacks, height = 140, format = compactNumber, summary, className }: {
  labels: string[]
  stacks: { key: string; label: string; color: string; values: number[] }[]
  height?: number
  format?: (value: number) => string
  summary: string
  className?: string
}) {
  const totals = labels.map((_, index) => stacks.reduce((total, stack) => total + (stack.values[index] ?? 0), 0))
  const max = niceCeil(Math.max(0, ...totals) * 1.05)
  const ticks = 4
  if (totals.every(total => total === 0)) {
    return <div className={cn('flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-[12px] text-slate-400', className)} style={{ height: height + 20 }}>No data for this period</div>
  }
  return (
    <figure className={cn('m-0', className)}>
      <div className="flex">
        <div className="relative w-9 shrink-0" style={{ height }} aria-hidden>
          {Array.from({ length: ticks + 1 }, (_, index) => (
            <span key={index} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-slate-400 lg:text-[8.5px]" style={{ top: (index / ticks) * height }}>
              {format((max / ticks) * (ticks - index))}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 items-end justify-around" style={{ height }}>
          {Array.from({ length: ticks + 1 }, (_, index) => (
            <div key={index} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (index / ticks) * height }} aria-hidden />
          ))}
          {labels.map((label, index) => (
            <div key={label + index} className="relative z-[1] flex w-[27px] flex-col-reverse overflow-hidden rounded-t-[3px]" style={{ height: (totals[index] / max) * height }} title={`${label}: ${format(totals[index])}`}>
              {stacks.map(stack => (
                <div key={stack.key} style={{ height: `${totals[index] ? ((stack.values[index] ?? 0) / totals[index]) * 100 : 0}%`, backgroundColor: stack.color }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-9 mt-1.5 flex justify-around" aria-hidden>
        {labels.map((label, index) => <span key={label + index} className="w-[27px] whitespace-nowrap text-center text-[10px] text-slate-500 lg:text-[8.5px]">{label}</span>)}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

/** Horizontal share bar row: label · bar · value · share. */
export function ShareBar({ value, color = '#2563EB', className }: { value: number; color?: string; className?: string }) {
  return (
    <span className={cn('relative block h-[5px] overflow-hidden rounded-full bg-slate-100', className)} aria-hidden>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, backgroundColor: color }} />
    </span>
  )
}

export function EmptyNote({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center', className)}>
      <p className="text-[13px] font-semibold text-slate-700 lg:text-[11.5px]">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-slate-500 lg:text-[10.5px]">{description}</p>}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  )
}
