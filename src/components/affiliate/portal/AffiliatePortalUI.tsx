import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Page frame for affiliate portal pages rendered inside the shell. */
export function AffiliatePage({ title, description, actions, children }: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-shell-text">{title}</h1>
          <p className="mt-1 text-[14px] text-shell-text-2">{description}</p>
        </div>
        {actions}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

export function AffiliateCard({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-shell-border bg-white', className)}>
      {title && <h2 className="border-b border-shell-border-soft px-5 py-3.5 text-[14px] font-semibold text-shell-text">{title}</h2>}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function AffiliateStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-shell-border bg-white p-4">
      <p className="text-[12.5px] font-medium text-shell-muted">{label}</p>
      <p className="mt-1.5 text-[22px] font-bold tabular-nums text-shell-text">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-shell-muted">{hint}</p>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'converted'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
  const label = status === 'converted' ? 'Converted' : status === 'cancelled' ? 'Cancelled' : 'Pending'
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold', tone)}>{label}</span>
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-shell-border bg-white px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-shell-text">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-shell-text-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
