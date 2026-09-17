import Link from 'next/link'
import { AlertTriangle, Inbox, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD } from './primitives'

/** Empty state sized to sit inside the panel it replaces, so layout never jumps. */
export function EmptyState({
  title, description, action, compact, filtered, className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
  /** Filters produced no matches (different icon + copy intent). */
  filtered?: boolean
  className?: string
}) {
  const Icon = filtered ? SearchX : Inbox
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5 py-5' : 'gap-2 py-10', className)}>
      <span className={cn('flex items-center justify-center rounded-full bg-slate-50 text-slate-400 ring-1 ring-sg-line', compact ? 'h-9 w-9' : 'h-11 w-11')}>
        <Icon aria-hidden className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </span>
      <p className={cn('font-semibold text-sg-ink', compact ? 'text-[13px] lg:text-[11.5px]' : 'text-[14px]')}>{title}</p>
      {description && <p className={cn('max-w-sm text-sg-muted', compact ? 'text-[12px] lg:text-[10px]' : 'text-[13px]')}>{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

export function PanelError({ message = 'This panel could not load. Refresh to try again.' }: { message?: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2.5 text-[12.5px] text-red-700 lg:text-[10.5px]">
      <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
      {message}
    </div>
  )
}

export function EmptyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-[13px] font-medium text-sg-blue hover:underline lg:text-[11px]">{children}</Link>
}

/** Skeletons mirror final geometry: header, 6 KPI tiles, filter row and panels. */
export function StrategyPageSkeleton({ panels = 3 }: { panels?: number }) {
  const bar = 'animate-pulse rounded bg-slate-200/70 motion-reduce:animate-none'
  return (
    <div aria-busy="true" aria-label="Loading" className="pt-[54px]">
      <div className={cn(bar, 'h-6 w-40')} />
      <div className={cn(bar, 'mt-2 h-3 w-72')} />
      <div className="mt-6 h-[38px] border-b border-sg-line" />
      <ul className="mt-[15px] grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 xl:gap-[18px]">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className={cn(CARD, 'flex h-[88px] items-start gap-3 p-3')}>
            <span className={cn(bar, 'h-10 w-10 rounded-[10px]')} />
            <span className="flex-1 space-y-2"><span className={cn(bar, 'block h-2.5 w-20')} /><span className={cn(bar, 'block h-4 w-12')} /><span className={cn(bar, 'block h-2 w-24')} /></span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-3">{Array.from({ length: 4 }).map((_, index) => <span key={index} className={cn(bar, 'h-[30px] w-40 rounded-[7px]')} />)}</div>
      <div className="mt-[13px] grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: panels }).map((_, index) => <div key={index} className={cn(CARD, 'h-[230px]')} />)}
      </div>
    </div>
  )
}
