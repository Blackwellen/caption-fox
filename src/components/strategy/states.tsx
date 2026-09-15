import Link from 'next/link'
import { AlertTriangle, ArrowRight, Inbox, Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { ModuleAccess } from '@/lib/strategy/entitlements'

/**
 * Empty state. The CTA is only rendered when the caller passes one, so a
 * read-only user is never invited to an action they cannot perform.
 */
export function EmptyState({
  title, message, action, icon: Icon = Inbox, className, compact,
}: {
  title: string
  message: string
  action?: React.ReactNode
  icon?: typeof Inbox
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12',
      className,
    )}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
        <Icon size={18} className="text-slate-400" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Error state. `reference` is a short, safe support code — never a stack trace,
 * a table name or a raw Postgres message.
 */
export function ErrorState({
  title = 'Something went wrong', message, reference, className, compact,
}: { title?: string; message?: string; reference?: string; className?: string; compact?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'rounded-xl border border-red-100 bg-red-50/50 px-6 py-10',
      className,
    )}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-red-100">
        <AlertTriangle size={18} className="text-red-500" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">
        {message ?? 'This panel could not be loaded. Try refreshing the page.'}
      </p>
      {reference && (
        <p className="mt-2 font-mono text-[11px] text-slate-400">Reference: {reference}</p>
      )}
    </div>
  )
}

/**
 * The canonical blocked / upgrade page state. Renders whichever variant the
 * entitlement resolver returned, so a plan gate offers billing and a role gate
 * does not pretend an upgrade would help.
 */
export function AccessState({ access }: { access: Extract<ModuleAccess, { allowed: false }> }) {
  const upgrade = access.upgrade
  return (
    <div className={cn(CARD, CARD_SHADOW, 'mx-auto max-w-xl px-6 py-12 text-center')}>
      <span className={cn(
        'mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full',
        upgrade ? 'bg-blue-50' : 'bg-slate-100',
      )}>
        {upgrade
          ? <Sparkles size={20} className="text-blue-600" aria-hidden />
          : <Lock size={19} className="text-slate-500" aria-hidden />}
      </span>
      <h2 className="text-lg font-bold text-slate-900">
        {upgrade ? 'Upgrade to unlock this area' : 'You do not have access to this area'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{access.message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {upgrade && (
          <Link
            href="/app/settings/billing"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            View plans
            <ArrowRight size={14} />
          </Link>
        )}
        <Link
          href="/app/strategy"
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Back to Strategy
        </Link>
      </div>
    </div>
  )
}

/** Generic panel skeleton, sized to the panel it replaces to avoid layout shift. */
export function PanelSkeleton({ height = 190, rows }: { height?: number; rows?: number }) {
  if (rows) {
    return (
      <div className="space-y-2.5" aria-hidden>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-slate-100" />
            <span className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
            <span className="h-3 w-10 shrink-0 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }
  return <div className="animate-pulse rounded-lg bg-slate-100" style={{ height }} aria-hidden />
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn(CARD, CARD_SHADOW, 'space-y-3 p-4')}>
          <span className="block h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
          <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-100" />
          <span className="block h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
          <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
