import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { CHANNEL_LABELS, CHANNEL_TINT, NICHE_LABELS, NICHE_TINT } from '@/lib/creators/constants'
import type { CreatorRow, PersonLite } from '@/lib/creators/types'

// ── Shared layout tokens ─────────────────────────────────────────────────────
// Every Creators & UGC surface aligns to these so the header, KPI strip,
// filter bar and content grid share one width and one gutter.
export const CREATORS_PAGE = 'px-6 py-5 lg:px-8'
export const CARD = 'rounded-xl border border-slate-200 bg-white'
export const CARD_SHADOW = 'shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]'

// ── Panel ────────────────────────────────────────────────────────────────────

interface PanelProps {
  title?: string
  info?: string
  action?: React.ReactNode
  viewAllHref?: string
  viewAllLabel?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  headerClassName?: string
}

export function Panel({
  title, info, action, viewAllHref, viewAllLabel = 'View all',
  children, className, bodyClassName, headerClassName,
}: PanelProps) {
  return (
    <section className={cn(CARD, CARD_SHADOW, 'flex flex-col overflow-hidden', className)}>
      {(title || action || viewAllHref) && (
        <header className={cn('flex items-center gap-2 px-4 pt-3.5 pb-2', headerClassName)}>
          {title && (
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
              {title}
              {info && <Info size={12} className="text-slate-300" aria-label={info} />}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {action}
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {viewAllLabel}
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </header>
      )}
      <div className={cn('flex-1 px-4 pb-4', bodyClassName)}>{children}</div>
    </section>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({
  name, src, size = 20, className,
}: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const label = name ?? 'Unassigned'
  if (src) {
    return (
      // Creator avatars come from arbitrary storage and social hosts; a plain
      // img avoids a next/image remote-pattern allowlist for every provider.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src} alt={label} width={size} height={size}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-label={label} title={label}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600', className)}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) }}
    >
      {initials(label)}
    </span>
  )
}

export function PersonChip({
  person, className, size = 18,
}: { person?: PersonLite | null; className?: string; size?: number }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar name={name} src={person?.avatar_url} size={size} />
      <span className="truncate text-xs text-slate-600">{name}</span>
    </span>
  )
}

/** Creator identity cell: avatar, display name and handle. */
export function CreatorChip({
  creator, size = 30, href, className, subtitle,
}: {
  creator?: Pick<CreatorRow, 'id' | 'name' | 'handle' | 'avatar_url'> | null
  size?: number
  href?: string
  className?: string
  subtitle?: string
}) {
  if (!creator) return <span className="text-xs text-slate-400">Unknown creator</span>
  const body = (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={creator.name} src={creator.avatar_url} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-slate-900">{creator.name}</span>
        <span className="block truncate text-[11px] text-slate-400">
          {subtitle ?? (creator.handle ? `@${creator.handle.replace(/^@/, '')}` : '—')}
        </span>
      </span>
    </span>
  )
  if (!href) return body
  return (
    <Link href={href} className="min-w-0 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {body}
    </Link>
  )
}

// ── Chips ────────────────────────────────────────────────────────────────────

export function ChannelChips({
  channels, max = 3, className,
}: { channels?: string[] | null; max?: number; className?: string }) {
  const list = channels ?? []
  if (list.length === 0) return <span className="text-xs text-slate-300">—</span>
  const shown = list.slice(0, max)
  const extra = list.length - shown.length

  return (
    <span className={cn('flex items-center gap-1', className)}>
      {shown.map(channel => (
        <span
          key={channel}
          title={CHANNEL_LABELS[channel] ?? channel}
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-bold uppercase ring-1',
            CHANNEL_TINT[channel] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
          )}
        >
          <span className="sr-only">{CHANNEL_LABELS[channel] ?? channel}</span>
          <span aria-hidden>{(CHANNEL_LABELS[channel] ?? channel).slice(0, 2)}</span>
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] font-medium text-slate-400">+{extra}</span>}
    </span>
  )
}

export function NicheChip({ niche, className }: { niche?: string | null; className?: string }) {
  if (!niche) return <span className="text-xs text-slate-300">—</span>
  const key = niche.toLowerCase()
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
      NICHE_TINT[key] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
      className,
    )}>
      {NICHE_LABELS[key] ?? niche}
    </span>
  )
}

// ── Progress ─────────────────────────────────────────────────────────────────

export function ProgressBar({
  value, tone = 'blue', className, label,
}: { value: number; tone?: 'blue' | 'green' | 'amber' | 'red'; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const colours = { blue: 'bg-blue-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      aria-label={label ?? `Progress ${pct}%`}
    >
      <div className={cn('h-full rounded-full transition-all', colours[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Formatting ───────────────────────────────────────────────────────────────
// UK formatting throughout: en-GB dates, GBP-aware currency and the
// Europe/London timezone for anything derived from a timestamp.

const UK_TZ = 'Europe/London'

export function formatMoney(value: number | null | undefined, currency = 'GBP', decimals = 2): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: currency || 'GBP',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value)
}

export function formatMoneyShort(value: number | null | undefined, currency = 'GBP'): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactMoney(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: currency || 'GBP', notation: 'compact', maximumFractionDigits: 1,
  }).format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB').format(value)
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: UK_TZ,
  }).format(date)
}

export function formatDayMonth(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: UK_TZ })
    .format(new Date(value))
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: UK_TZ,
  }).format(date)
}

/** "2h ago" / "3d ago" — used by every activity feed on these surfaces. */
export function formatAgo(value: string | null | undefined): string {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return ''
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/** Review time shown as "18h 42m" rather than a raw second count. */
export function formatHoursMinutes(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—'
  return `${days.toFixed(1)} days`
}
