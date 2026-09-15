import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { CHANNEL_LABELS, CHANNEL_TINT, type MessagingChannel } from '@/lib/messaging/constants'
import type { PersonLite } from '@/lib/messaging/types'

// ── Shared layout tokens ─────────────────────────────────────────────────────
// Every Messaging surface aligns to these so the header, KPI strip, filter bar
// and content grid share one width and one gutter — matching every other
// Campaign Manager module (Campaigns, Social, Advertising).
export const MESSAGING_PAGE = 'px-6 py-5 lg:px-8'
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
}

export function Panel({
  title, info, action, viewAllHref, viewAllLabel = 'View all', children, className, bodyClassName,
}: PanelProps) {
  return (
    <section className={cn(CARD, CARD_SHADOW, 'flex flex-col overflow-hidden', className)}>
      {(title || action || viewAllHref) && (
        <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
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

export function Avatar({ person, size = 20, className }: { person?: PersonLite | null; size?: number; className?: string }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  if (person?.avatar_url) {
    return (
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

export function OwnerChip({ person, className }: { person?: PersonLite | null; className?: string }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar person={person} size={18} />
      <span className="truncate text-xs text-slate-600">{name}</span>
    </span>
  )
}

// ── Channel chip ─────────────────────────────────────────────────────────────

export function ChannelChip({ channel, className }: { channel: MessagingChannel; className?: string }) {
  return (
    <span
      title={CHANNEL_LABELS[channel]}
      className={cn(
        'inline-flex h-5 items-center justify-center rounded px-1.5 text-[9px] font-bold uppercase ring-1',
        CHANNEL_TINT[channel], className,
      )}
    >
      {CHANNEL_LABELS[channel]}
    </span>
  )
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB').format(value)
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function formatPercent(numerator: number, denominator: number, digits = 1): string {
  if (denominator <= 0) return '0%'
  return `${((numerator / denominator) * 100).toFixed(digits)}%`
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
