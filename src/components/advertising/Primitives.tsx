import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, Lock, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shared surfaces for the Advertising module: panels, section headers, and the
// empty / error / blocked / upgrade states.
//
// Every state keeps the surrounding layout height so switching between them
// does not shift the page, and every one of them says what the user can do next
// rather than only what went wrong.

export function Panel({
  children, className, padded = true,
}: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  title, hint, action, actionHref, actionLabel, className, children,
}: {
  title: string
  hint?: string
  action?: ReactNode
  actionHref?: string
  actionLabel?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate text-[14px] font-semibold text-slate-900">{title}</h2>
        {hint && <InfoDot label={hint} />}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {action}
        {actionHref && (
          <Link
            href={actionHref}
            className="rounded text-[12.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            {actionLabel ?? 'View All'}
          </Link>
        )}
      </div>
    </div>
  )
}

/** The small circled "i" beside a heading in the reference designs. */
export function InfoDot({ label }: { label: string }) {
  return (
    <span
      className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full text-slate-400"
      title={label}
    >
      <Info size={13} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function EmptyState({
  title, description, action, icon, className, compact,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-10',
        className,
      )}
    >
      {icon && <span className="mb-2.5 text-slate-300" aria-hidden>{icon}</span>}
      <p className="text-[13.5px] font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  )
}

/**
 * Error surface. `reference` is a short support code produced server-side; the
 * underlying provider message and stack never reach the browser.
 */
export function ErrorState({
  title = 'Something went wrong loading this section',
  description,
  reference,
  action,
  className,
}: {
  title?: string
  description: string
  reference?: string | null
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-red-200 bg-red-50/70 px-4 py-4', className)} role="alert">
      <div className="flex gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-red-900">{title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-800/90">{description}</p>
          {reference && (
            <p className="mt-1.5 font-mono text-[11px] text-red-700/80">
              Support reference: {reference}
            </p>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  )
}

/** Shown when the member's role or the workspace status blocks the surface. */
export function BlockedState({
  title, description, className,
}: { title: string; description: string; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white px-6 py-10 text-center', className)}>
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden>
        <ShieldAlert size={19} />
      </span>
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}

/**
 * Shown when the block is resolvable by a plan or add-on change. Routes to
 * billing rather than dead-ending, and names the plan required.
 */
export function UpgradeState({
  title, description, planLabel, billingHref, className,
}: {
  title: string
  description: string
  planLabel: string
  billingHref: string
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-blue-200 bg-blue-50/60 px-6 py-10 text-center', className)}>
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600" aria-hidden>
        <Lock size={18} />
      </span>
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-600">{description}</p>
      <Link
        href={billingHref}
        className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        Upgrade to {planLabel}
      </Link>
    </div>
  )
}

/** Skeleton block that matches the final layout so nothing shifts on load. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} aria-hidden />
}

export function KpiStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white px-4 pb-3 pt-3.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-[22px] w-[22px]" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="mt-2.5 h-6 w-28" />
          <Skeleton className="mt-2 h-2.5 w-24" />
          <Skeleton className="mt-2.5 h-[34px] w-full" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="hidden h-3.5 w-20 sm:block" />
          <Skeleton className="hidden h-3.5 w-16 md:block" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}
