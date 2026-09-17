import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { CHANNEL_LABELS, CHANNEL_TINT } from '@/lib/campaigns/constants'
import type { PersonLite } from '@/lib/campaigns/types'

// ── Shared layout tokens ─────────────────────────────────────────────────────
// Every Campaigns surface aligns to these so the header, KPI strip, filter bar
// and content grid share one width and one gutter.
export const CAMPAIGN_PAGE = ''
export const CARD = 'rounded-xl border border-slate-200 bg-white'
export const CARD_SHADOW = 'shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]'

// ── Panel ────────────────────────────────────────────────────────────────────

interface PanelProps {
  title?: string
  info?: string
  action?: React.ReactNode
  /** Renders a "View all →" link in the panel header. */
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
        <header className="flex items-center gap-1.5 px-4 pt-3.5 pb-2 lg:px-3.5 lg:pt-3 lg:pb-1.5">
          {title && (
            <h2 className="flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-slate-900 lg:text-[9.5px]">
              {title}
              {info && <Info size={12} className="text-slate-300" aria-label={info} />}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {action}
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 lg:text-[9.5px]"
              >
                {viewAllLabel}
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </header>
      )}
      <div className={cn('flex-1 px-4 pb-4 lg:px-3.5 lg:pb-3', bodyClassName)}>{children}</div>
    </section>
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

export function OwnerChip({ person, className }: { person?: PersonLite | null; className?: string }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar person={person} size={18} />
      <span className="truncate text-xs text-slate-600">{name}</span>
    </span>
  )
}

// ── Channel chips ────────────────────────────────────────────────────────────

export function ChannelChips({ channels, max = 3, className }: { channels?: string[] | null; max?: number; className?: string }) {
  const list = channels ?? []
  if (list.length === 0) return null
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
      {extra > 0 && (
        <span className="text-[10px] font-medium text-slate-400">+{extra}</span>
      )}
    </span>
  )
}

// ── Progress ─────────────────────────────────────────────────────────────────

const PROGRESS_TONE: Record<string, string> = {
  on_track: 'bg-emerald-500', at_risk: 'bg-amber-500',
  overdue: 'bg-red-500', blocked: 'bg-red-500',
}

export function ProgressBar({
  value, health = 'on_track', className, label,
}: { value: number; health?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      aria-label={label ?? `Progress ${pct}%`}
    >
      <div
        className={cn('h-full rounded-full transition-all', PROGRESS_TONE[health] ?? 'bg-blue-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatMoney(value: number | null | undefined, currency = 'GBP'): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(value)
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

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(value))
}

export function formatDayMonth(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}
