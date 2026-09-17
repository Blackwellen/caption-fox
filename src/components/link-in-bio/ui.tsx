import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Info, Lock, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DASH, compact, integer, percent } from '@/lib/link-in-bio/format'
import type { Kpi } from '@/lib/link-in-bio/server/collections'
import type { Member } from '@/lib/link-in-bio/server/context'

// Server-safe building blocks for every Link in Bio screen. Sizes follow the
// approved designs at 1448x1086: 32px action buttons, 36px filter controls,
// 12px card radius, one-pixel slate borders and a very soft shadow.

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
          {index > 0 && <ChevronRight size={12} className="shrink-0 text-slate-400" aria-hidden />}
          {item.href
            ? <Link href={item.href} className="truncate hover:text-slate-800 hover:underline">{item.label}</Link>
            : <span className="truncate font-medium text-slate-800" aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function PageHeading({ title, subtitle, actions, crumbs, children, className }: {
  title: ReactNode; subtitle?: string; actions?: ReactNode; crumbs: { label: string; href?: string }[]; children?: ReactNode; className?: string
}) {
  return (
    <div className={cn('mb-4', className)}>
      <Breadcrumbs items={crumbs} />
      <div className="mt-2.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-[12.5px] text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

const buttonBase = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-55'
export const buttonClass = {
  primary: `${buttonBase} bg-[#1a5cff] text-white shadow-sm hover:bg-[#0f4fe8]`,
  secondary: `${buttonBase} border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50`,
  ghost: `${buttonBase} text-slate-600 hover:bg-slate-100`,
  icon: 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600',
}

export function LinkButton({ href, variant = 'secondary', children, className, disabledReason, ariaLabel }: {
  href: string; variant?: keyof typeof buttonClass; children: ReactNode; className?: string; disabledReason?: string | null; ariaLabel?: string
}) {
  if (disabledReason) {
    return (
      <button type="button" disabled title={disabledReason} className={cn(buttonClass[variant], className)} aria-label={ariaLabel}>
        {children}<span className="sr-only">. Unavailable: {disabledReason}</span>
      </button>
    )
  }
  return <Link href={href} className={cn(buttonClass[variant], className)} aria-label={ariaLabel}>{children}</Link>
}

export function Panel({ children, className, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'aside'; 'aria-label'?: string }) {
  return (
    <Tag className={cn('min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function PanelTitle({ title, hint, action, className }: { title: ReactNode; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <h2 className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-slate-900">
        {title}
        {hint && <span title={hint} className="text-slate-400"><Info size={12} aria-hidden /><span className="sr-only">{hint}</span></span>}
      </h2>
      {action}
    </div>
  )
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={cn('text-[11.5px] font-medium text-[#1a5cff] hover:underline', className)}>{children}</Link>
}

// ------------------------------------------------------------------- KPIs

export type KpiTone = 'purple' | 'green' | 'blue' | 'orange' | 'amber' | 'red' | 'indigo'
const TONES: Record<KpiTone, string> = {
  purple: 'bg-violet-50 text-violet-600',
  green: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-500',
  amber: 'bg-amber-50 text-amber-500',
  red: 'bg-red-50 text-red-500',
  indigo: 'bg-indigo-50 text-indigo-600',
}

export function formatKpi(kpi: Kpi, format: 'integer' | 'compact' | 'percent' | 'signed' | 'pounds'): string {
  if (kpi.value === null) return DASH
  switch (format) {
    case 'compact': return compact(kpi.value)
    case 'percent': return percent(kpi.value, kpi.value < 10 ? 2 : 1).replace(/(\.\d)0%$/, '$1%')
    case 'signed': return `${kpi.value > 0 ? '+' : ''}${kpi.value.toFixed(1)}%`
    case 'pounds': return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(kpi.value / 100)
    default: return integer(kpi.value)
  }
}

export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Panel className={cn('grid grid-cols-2 gap-y-3 px-1 py-3.5 sm:grid-cols-3 xl:grid-cols-6 xl:gap-y-0', className)}>
      {children}
    </Panel>
  )
}

export function KpiCell({ label, value, kpi, icon, tone, inverse = false, href }: {
  label: string; value: string; kpi: Kpi; icon: ReactNode; tone: KpiTone; inverse?: boolean; href?: string
}) {
  const delta = kpi.delta
  const hasDelta = delta !== null && Number.isFinite(delta) && delta !== 0
  const up = hasDelta && (delta as number) > 0
  const good = inverse ? !up : up
  const deltaText = !hasDelta ? null
    : kpi.deltaUnit === 'pp' ? `${Math.abs(delta as number).toFixed(1)}pp`
      : kpi.deltaUnit === 'abs' ? `${Math.abs(delta as number)}`
        : `${Math.abs(Math.round(delta as number))}%`
  const body = (
    <>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&>svg]:h-[19px] [&>svg]:w-[19px]', TONES[tone])} aria-hidden>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-slate-600">{label}</span>
        <span className="mt-0.5 block text-[19px] font-semibold leading-tight tracking-[-0.01em] text-slate-900 tabular-nums">{value}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">
          {hasDelta && (
            <span className={cn('mr-1 font-medium', good ? 'text-emerald-600' : 'text-red-500')}>
              <span aria-hidden>{up ? '↗' : '↘'}</span><span className="sr-only">{up ? 'up' : 'down'}</span> {deltaText}
            </span>
          )}
          {kpi.caption}
        </span>
      </span>
    </>
  )
  const cls = 'flex min-w-0 items-center gap-2.5 px-3.5 xl:border-l xl:border-slate-100 xl:first:border-l-0'
  return href ? <Link href={href} className={cn(cls, 'rounded-lg hover:bg-slate-50/70')}>{body}</Link> : <div className={cls}>{body}</div>
}

// ----------------------------------------------------------- badges & people

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  live: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  active: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  approved: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  performing: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  compliant: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  verified: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  draft: 'bg-blue-50 text-blue-600 ring-blue-100',
  scheduled: 'bg-blue-50 text-blue-600 ring-blue-100',
  restored: 'bg-blue-50 text-blue-600 ring-blue-100',
  edited: 'bg-blue-50 text-blue-600 ring-blue-100',
  stable: 'bg-teal-50 text-teal-600 ring-teal-100',
  in_review: 'bg-orange-50 text-orange-600 ring-orange-100',
  review: 'bg-orange-50 text-orange-600 ring-orange-100',
  pending: 'bg-orange-50 text-orange-600 ring-orange-100',
  attention: 'bg-red-50 text-red-600 ring-red-100',
  paused: 'bg-amber-50 text-amber-700 ring-amber-100',
  expired: 'bg-slate-100 text-slate-500 ring-slate-200',
  archived: 'bg-slate-100 text-slate-500 ring-slate-200',
  unpublished: 'bg-slate-100 text-slate-500 ring-slate-200',
  system: 'bg-slate-100 text-slate-500 ring-slate-200',
  pixel: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const key = status.toLowerCase().replace(/\s+/g, '_')
  const style = STATUS_STYLES[key] ?? (key.startsWith('pixel') ? STATUS_STYLES.pixel : 'bg-slate-100 text-slate-600 ring-slate-200')
  return (
    <span className={cn('inline-flex h-[19px] shrink-0 items-center whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium ring-1 ring-inset', style, className)}>
      {label ?? STATUS_TEXT[key] ?? status}
    </span>
  )
}

const STATUS_TEXT: Record<string, string> = {
  published: 'Published', active: 'Active', draft: 'Draft', in_review: 'Review', scheduled: 'Scheduled', archived: 'Archived',
  unpublished: 'Unpublished', paused: 'Paused', expired: 'Expired', performing: 'Performing', stable: 'Stable', attention: 'Needs attention',
  approved: 'Approved', pending: 'Review', review: 'Review', restored: 'Restored', live: 'Live', system: 'System', edited: 'Edited', verified: 'Verified', compliant: 'Compliant',
}

export function Avatar({ member, size = 18, className }: { member: Pick<Member, 'name' | 'avatarUrl'> | null; size?: number; className?: string }) {
  const name = member?.name ?? 'System'
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  return member?.avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={member.avatarUrl} alt="" width={size} height={size} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
    : (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600', className)}
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.4) }}
        aria-hidden
      >
        {initials}
      </span>
    )
}

export function Person({ member, size = 18, className }: { member: Member | null; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600', className)}>
      <Avatar member={member} size={size} />
      <span className="truncate">{member?.name ?? 'System'}</span>
    </span>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-[19px] items-center rounded-md bg-slate-100/80 px-2 text-[10px] text-slate-600">{children}</span>
}

// ------------------------------------------------------------------ states

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center', className)}>
      {icon && <span className="mb-2.5 text-slate-300" aria-hidden>{icon}</span>}
      <p className="text-[13.5px] font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  )
}

export function BlockedState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden><ShieldAlert size={19} /></span>
      <h1 className="text-[15px] font-semibold text-slate-900">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}

export function UpgradeState({ title, description, planLabel, billingHref, compact: small }: { title: string; description: string; planLabel: string; billingHref: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-blue-200 bg-blue-50/60 text-center', small ? 'px-4 py-6' : 'px-6 py-10')}>
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600" aria-hidden><Lock size={18} /></span>
      <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-slate-600">{description}</p>
      <Link href={billingHref} className={cn(buttonClass.primary, 'mt-4')}>Upgrade to {planLabel}</Link>
    </div>
  )
}

export function ErrorNote({ reference }: { reference?: string }) {
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
      Some analytics could not be loaded. Figures shown may be incomplete.{reference && <span className="ml-1 font-mono text-[10.5px] text-red-500">Ref {reference}</span>}
    </p>
  )
}
