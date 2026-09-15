import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { CommunityRow, PersonLite } from '@/lib/community/types'

// ── Shared layout tokens ─────────────────────────────────────────────────────
// Every Community surface aligns to these so the header, KPI strip, filter bar
// and content grid share one width and one gutter. Mirrors
// src/components/creators/primitives.tsx.
export const COMMUNITY_PAGE = 'px-6 py-5 lg:px-8'
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
      // Member/community avatars can come from arbitrary storage hosts; a
      // plain img avoids a next/image remote-pattern allowlist per provider.
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

export function AvatarStack({
  people, max = 5, size = 22,
}: { people: { display_name?: string; avatar_url?: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((person, i) => (
        <Avatar
          key={i} name={person.display_name} src={person.avatar_url}
          size={size} className={cn('ring-2 ring-white', i > 0 && '-ml-2')}
        />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
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

/** Community identity cell: cover thumbnail (or fallback), name and type. */
export function CommunityChip({
  community, size = 30, href, className,
}: {
  community?: Pick<CommunityRow, 'id' | 'name' | 'cover_image_url'> | null
  size?: number
  href?: string
  className?: string
}) {
  if (!community) return <span className="text-xs text-slate-400">Unknown community</span>
  const body = (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={community.name} src={community.cover_image_url} size={size} />
      <span className="min-w-0 truncate text-[13px] font-medium text-slate-900">{community.name}</span>
    </span>
  )
  if (!href) return body
  return (
    <Link href={href} className="min-w-0 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {body}
    </Link>
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

export function StatusDot({ className }: { className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', className)} aria-hidden />
}

// ── Formatting ───────────────────────────────────────────────────────────────
// UK formatting throughout: en-GB dates, GBP-aware currency and the
// Europe/London timezone for anything derived from a timestamp.

const UK_TZ = 'Europe/London'

export function formatMoneyShort(value: number | null | undefined, currency = 'GBP'): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: currency || 'GBP', maximumFractionDigits: 0,
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

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: UK_TZ }).format(date)
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

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(1)}h`
}
