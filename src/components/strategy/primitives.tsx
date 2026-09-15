import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { CHANNEL_LABELS, CHANNEL_TINT, MONETARY_METRICS, type ForecastMetric } from '@/lib/strategy/constants'
import type { PersonLite } from '@/lib/strategy/types'

// ── Shared layout tokens ─────────────────────────────────────────────────────
// Every Strategy surface aligns to these so the header, KPI strip, filter bar
// and content grid share one width and one gutter with the rest of the product.
export const STRATEGY_PAGE = 'px-6 py-5 lg:px-8'
export const CARD = 'rounded-xl border border-slate-200 bg-white'
export const CARD_SHADOW = 'shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]'

// ── Panel ────────────────────────────────────────────────────────────────────

interface PanelProps {
  title?: string
  info?: string
  subtitle?: string
  action?: React.ReactNode
  viewAllHref?: string
  viewAllLabel?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  /** Rendered pinned to the bottom of the panel, below the body. */
  footer?: React.ReactNode
}

export function Panel({
  title, info, subtitle, action, viewAllHref, viewAllLabel = 'View all',
  children, className, bodyClassName, footer,
}: PanelProps) {
  return (
    <section className={cn(CARD, CARD_SHADOW, 'flex flex-col overflow-hidden', className)}>
      {(title || action || viewAllHref) && (
        <header className="flex items-start gap-2 px-4 pt-3.5 pb-2">
          {title && (
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                {title}
                {info && (
                  <span title={info} className="inline-flex">
                    <Info size={12} className="text-slate-300" aria-hidden />
                    <span className="sr-only">{info}</span>
                  </span>
                )}
              </h2>
              {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
      {footer && <div className="border-t border-slate-100 px-4 py-2.5">{footer}</div>}
    </section>
  )
}

/** The centred "View all X →" link used at the foot of several panels. */
export function PanelFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
    >
      {children}
      <ArrowRight size={12} />
    </Link>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({ person, size = 20, className }: { person?: PersonLite | null; size?: number; className?: string }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  if (person?.avatar_url) {
    return (
      // Avatars come from arbitrary storage hosts; a plain img avoids a
      // next/image remote-pattern allowlist for every provider.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatar_url} alt={name} width={size} height={size}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-label={name} title={name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600', className)}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) }}
    >
      {initials(name)}
    </span>
  )
}

export function OwnerChip({ person, className, size = 18 }: { person?: PersonLite | null; className?: string; size?: number }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar person={person} size={size} />
      <span className="truncate text-xs text-slate-600">{name}</span>
    </span>
  )
}

/** Overlapping avatar stack used for linked audiences / personas. */
export function AvatarStack({
  people, max = 3, label,
}: { people: { id: string; name: string; avatar_url?: string | null }[]; max?: number; label?: string }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  if (people.length === 0) return <span className="text-xs text-slate-400">—</span>

  return (
    <span className="flex items-center" aria-label={label ?? people.map(p => p.name).join(', ')}>
      {shown.map((person, index) => (
        <span key={person.id} className={cn(index > 0 && '-ml-1.5')}>
          <Avatar
            person={{ id: person.id, full_name: person.name, email: null, avatar_url: person.avatar_url ?? null }}
            size={18} className="ring-2 ring-white"
          />
        </span>
      ))}
      {extra > 0 && (
        <span className="ml-1 text-[10px] font-medium text-slate-400">+{extra}</span>
      )}
    </span>
  )
}

// ── Channel chips ────────────────────────────────────────────────────────────

export function ChannelChips({ channels, max = 3, className }: { channels?: string[] | null; max?: number; className?: string }) {
  const list = channels ?? []
  if (list.length === 0) return <span className="text-xs text-slate-400">—</span>
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

// ── Progress ─────────────────────────────────────────────────────────────────

const PROGRESS_TONE: Record<string, string> = {
  on_track: 'bg-emerald-500', completed: 'bg-blue-500', at_risk: 'bg-amber-500',
  off_track: 'bg-red-500', blocked: 'bg-red-500', not_started: 'bg-slate-300', draft: 'bg-slate-300',
}

export function ProgressBar({
  value, status = 'on_track', className, label,
}: { value: number; status?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      aria-label={label ?? `Progress ${pct}%`}
    >
      <div
        className={cn('h-full rounded-full transition-all', PROGRESS_TONE[status] ?? 'bg-blue-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Horizontal labelled bar used by channel affinity, themes and engagement panels. */
export function BarRow({
  label, value, max, suffix, tone = 'bg-blue-500', trailing,
}: { label: string; value: number; max: number; suffix?: string; tone?: string; trailing?: React.ReactNode }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <li className="flex items-center gap-2.5 text-[11px]">
      <span className="w-[38%] shrink-0 truncate text-slate-600">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-9 shrink-0 text-right font-medium text-slate-900">
        {value}{suffix}
      </span>
      {trailing}
    </li>
  )
}

// ── Score ring ───────────────────────────────────────────────────────────────

/**
 * Circular score used by audience fit and audience–message fit. Rendered as an
 * SVG so it stays crisp and needs no chart library, with the value also exposed
 * as text for screen readers.
 */
export function ScoreRing({
  value, size = 46, stroke = 4, colour = '#10b981', label,
}: { value: number; size?: number; stroke?: number; colour?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img" aria-label={label ?? `Score ${pct} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colour} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
        />
      </svg>
      <span
        className="absolute font-bold leading-none text-slate-900"
        style={{ fontSize: Math.round(size * 0.32) }}
        aria-hidden
      >
        {Math.round(pct)}
      </span>
    </span>
  )
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatMoney(value: number | null | undefined, currency = 'GBP'): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function formatCompactMoney(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
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

/** Formats a forecast value in the right unit for its metric. */
export function formatMetric(value: number, metric: string, currency = 'GBP', compact = true): string {
  if (MONETARY_METRICS.includes(metric as ForecastMetric)) {
    return compact ? formatCompactMoney(value, currency) : formatMoney(value, currency)
  }
  return compact ? formatCompact(value) : formatNumber(value)
}

/** Percentage-point delta, e.g. "8pp vs last month". Never renders "NaN". */
export function formatPp(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.abs(Math.round(value))}pp`
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(value))
}

export function formatDayMonth(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function formatMonth(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(value))
}

/** "2h ago" / "Yesterday" / "3d ago", matching the activity feeds in the design. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return '—'
  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`
}

/** Days between now and a due date. Negative means overdue. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const target = new Date(`${value}T00:00:00`).getTime()
  if (Number.isNaN(target)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today.getTime()) / 86_400_000)
}

/** "In 5 days" / "Today" / "3 days overdue" for milestone lists. */
export function formatDueIn(value: string | null | undefined): string {
  const days = daysUntil(value)
  if (days === null) return '—'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 0) return `In ${days} days`
  return `${Math.abs(days)} days overdue`
}
