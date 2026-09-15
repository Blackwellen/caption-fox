import Link from 'next/link'
import { AlertTriangle, Lock, SearchX, Sparkles, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { ModuleAccess } from '@/lib/community/entitlements'

/**
 * Canonical blocked / upgrade state for a Community module the workspace or
 * role cannot open. Rendered by the route itself, so a pasted deep link is
 * protected rather than merely hidden from navigation. Mirrors
 * src/components/creators/states.tsx.
 */
export function AccessBlocked({ access }: { access: Extract<ModuleAccess, { allowed: false }> }) {
  const isUpgrade = access.upgrade
  return (
    <div className={cn(CARD, CARD_SHADOW, 'mx-auto max-w-lg px-6 py-10 text-center')}>
      <span className={cn(
        'mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl',
        isUpgrade ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500',
      )}>
        {isUpgrade ? <Sparkles size={20} /> : <Lock size={20} />}
      </span>
      <h2 className="text-base font-semibold text-slate-900">
        {isUpgrade ? 'Upgrade to unlock this area' : 'You do not have access to this area'}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">{access.message}</p>
      {isUpgrade && (
        <Link
          href="/app/settings/billing"
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          View plans &amp; billing
        </Link>
      )}
    </div>
  )
}

/** Empty state used when a surface genuinely has no records yet. */
export function CommunityEmpty({
  title, message, action, icon = 'community', className,
}: {
  title: string
  message: string
  action?: React.ReactNode
  icon?: 'community' | 'search'
  className?: string
}) {
  const Icon = icon === 'search' ? SearchX : Users
  return (
    <div className={cn(CARD, CARD_SHADOW, 'flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Icon size={20} />
      </span>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Small in-panel empty state so a side panel never renders as a blank box. */
export function PanelEmpty({ message, className }: { message: string; className?: string }) {
  return (
    <p className={cn('py-6 text-center text-[13px] text-slate-400', className)}>{message}</p>
  )
}

/**
 * Surfaces a query failure without swallowing it or hanging on a spinner. The
 * support reference is safe to quote: it identifies the surface, not the data.
 */
export function LoadError({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn(CARD, 'border-red-200 bg-red-50/50 px-4 py-3', className)} role="alert">
      <p className="flex items-start gap-2 text-[13px] text-red-800">
        <AlertTriangle size={15} className="mt-px shrink-0 text-red-500" />
        <span>
          <span className="font-medium">We could not load this data.</span>{' '}
          {message} If this keeps happening, contact support with reference{' '}
          <code className="rounded bg-red-100 px-1 font-mono text-[11px]">CF-COMMUNITY</code>.
        </span>
      </p>
    </div>
  )
}

/** Skeleton used by every route-level `loading.tsx` under Community. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={cn(CARD, CARD_SHADOW, 'overflow-hidden')}>
      <div className="border-b border-slate-100 px-4 py-3">
        <span className="block h-3 w-32 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-100" />
            <span className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
            <span className="hidden h-3 w-16 animate-pulse rounded bg-slate-100 sm:block" />
            <span className="hidden h-3 w-20 animate-pulse rounded bg-slate-100 md:block" />
            <span className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
