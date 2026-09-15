import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { PersonLite } from '@/lib/automations/types'

// Shared layout tokens + primitives for the Automations surfaces. Mirrors
// src/components/community/primitives.tsx.
export const AUTOMATIONS_PAGE = 'px-6 py-5 lg:px-8'
export const CARD = 'rounded-xl border border-slate-200 bg-white'
export const CARD_SHADOW = 'shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]'

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

export function Panel({ title, info, action, viewAllHref, viewAllLabel = 'View all', children, className, bodyClassName }: PanelProps) {
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
              <Link href={viewAllHref} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                {viewAllLabel}<ArrowRight size={12} />
              </Link>
            )}
          </div>
        </header>
      )}
      <div className={cn('flex-1 px-4 pb-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Avatar({ name, src, size = 20, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const label = name ?? 'Unassigned'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={label} width={size} height={size} className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200', className)} style={{ width: size, height: size }} />
  }
  return (
    <span aria-label={label} title={label} className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600', className)} style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) }}>
      {initials(label)}
    </span>
  )
}

export function PersonChip({ person, className, size = 18 }: { person?: PersonLite | null; className?: string; size?: number }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar name={name} src={person?.avatar_url} size={size} />
      <span className="truncate text-xs text-slate-600">{name}</span>
    </span>
  )
}

const UK_TZ = 'Europe/London'

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-GB').format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: UK_TZ }).format(date)
}

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
  return `${days}d ago`
}

export function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—'
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
