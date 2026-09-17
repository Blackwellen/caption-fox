import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatChange } from '@/lib/events/format'
import type { KpiValue } from '@/lib/events/types'

/* ------------------------------------------------------------------ header */

export function EventsPageHeader({
  title, subtitle, actions,
}: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 pt-1">
        <h1 className="text-[23px] font-bold leading-[1.2] tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1.5 text-[12.5px] text-slate-500">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

/* --------------------------------------------------------------------- kpi */

export type KpiTone = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'orange'

const TONES: Record<KpiTone, string> = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-500',
  sky: 'bg-sky-50 text-sky-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  orange: 'bg-orange-50 text-orange-500',
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="Key metrics"
      className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {children}
    </section>
  )
}

export function KpiCard({
  label, value, kpi, tone = 'blue', icon, href, comparison = 'vs last 30 days', tooltip,
}: {
  label: string
  /** Already formatted for display; `—` when the metric is not measurable. */
  value: string
  kpi?: KpiValue
  tone?: KpiTone
  icon: ReactNode
  href?: string
  comparison?: string
  tooltip?: string
}) {
  const change = kpi?.changePct ?? null
  const abs = kpi?.changeAbs ?? null
  const positive = (change ?? abs ?? 0) >= 0
  const hasDelta = change !== null || abs !== null

  const body = (
    <div className="flex h-full min-h-[104px] gap-2.5 rounded-xl border border-slate-200/90 bg-white py-4 pl-3.5 pr-2 transition-colors hover:border-slate-300">
      <span className={cn('flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[10px]', TONES[tone])} aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[11px] font-medium leading-tight text-slate-600" title={tooltip ?? label}>{label}</p>
        <p className="mt-1.5 truncate text-[21px] font-bold leading-none tracking-tight text-slate-900">{value}</p>
        {hasDelta ? (
          <p className="mt-auto flex items-center gap-1 whitespace-nowrap pt-2 text-[10.5px] tracking-[-0.01em]">
            <DeltaTriangle positive={positive} />
            <span className={cn('font-medium', positive ? 'text-emerald-600' : 'text-rose-500')}>
              {change !== null ? formatChange(change).replace(/^[+-]/, '') : `${Math.abs(abs ?? 0)}`}
            </span>
            <span className="text-slate-500">{comparison}</span>
          </p>
        ) : (
          <p className="mt-auto truncate pt-2 text-[11px] text-slate-500">{comparison}</p>
        )}
      </div>
    </div>
  )

  return href ? <Link href={href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl">{body}</Link> : body
}

/** Small filled triangle the designs use for period-on-period deltas. */
export function DeltaTriangle({ positive }: { positive: boolean }) {
  return (
    <svg width="7" height="6" viewBox="0 0 7 6" className={cn('shrink-0', positive ? 'text-emerald-600' : 'rotate-180 text-rose-500')} aria-hidden>
      <path d="M3.5 0 7 6H0z" fill="currentColor" />
    </svg>
  )
}

/** Label-over-value stat with an optional period delta (registration strips). */
export function SummaryStat({
  label, value, change, points = false, below = false,
}: {
  label: string
  value: string
  change: number | null | undefined
  points?: boolean
  /** Label under the value (chart headers) instead of above it (stat strips). */
  below?: boolean
}) {
  const hasChange = change !== null && change !== undefined
  const positive = (change ?? 0) >= 0
  return (
    <div className={cn('flex flex-col', below ? 'pr-4' : 'px-4 first:pl-1')}>
      <dt className={cn('text-[10.5px] text-slate-500', below && 'order-last mt-1')}>{label}</dt>
      <dd className={cn('flex items-baseline gap-2 whitespace-nowrap', !below && 'mt-1')}>
        <span className="text-[16px] font-semibold leading-tight text-slate-900">{value}</span>
        {hasChange && (
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', positive ? 'text-emerald-600' : 'text-rose-500')}>
            <DeltaTriangle positive={positive} />
            {/* Rates move in percentage points; counts move in percent. */}
            {points ? `${Math.abs((change ?? 0) * 100).toFixed(1)}%` : formatChange(change).replace(/^[+-]/, '')}
          </span>
        )}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------ panels */

export function Panel({
  title, titleSuffix, action, children, className, contentClassName, description,
}: {
  title?: string
  titleSuffix?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white', className)}>
      {(title || action) && (
        <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[13px] font-semibold text-slate-900">
                {title}
                {titleSuffix && <span className="font-normal text-slate-700"> {titleSuffix}</span>}
              </h2>
            )}
            {description && <p className="mt-0.5 truncate text-[10.5px] text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {/* `cn` is plain clsx (no tailwind-merge), so a default padding plus a
          caller's padding would both apply — use one or the other. */}
      <div className={cn('flex-1', contentClassName ?? 'p-4')}>{children}</div>
    </section>
  )
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-[11px] font-medium text-blue-600 hover:text-blue-700">
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------------ badges */

const BADGE_TONES: Record<string, string> = {
  live: 'bg-blue-50 text-blue-600',
  upcoming: 'bg-indigo-50 text-indigo-600',
  scheduled: 'bg-indigo-50 text-indigo-600',
  completed: 'bg-emerald-50 text-emerald-600',
  published: 'bg-emerald-50 text-emerald-600',
  draft: 'bg-slate-100 text-slate-600',
  planned: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-600',
  failed: 'bg-rose-100 text-rose-600',
  delayed: 'bg-amber-100 text-amber-700',
  recording: 'bg-violet-100 text-violet-700',
  in_progress: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  waiting: 'bg-amber-100 text-amber-700',
  not_started: 'bg-slate-100 text-slate-600',
  premier: 'bg-violet-100 text-violet-700',
  platinum: 'bg-slate-200 text-slate-700',
  gold: 'bg-amber-100 text-amber-700',
  silver: 'bg-slate-100 text-slate-600',
  bronze: 'bg-orange-100 text-orange-700',
}

const SOLID_TONES: Record<string, string> = {
  live: 'bg-violet-600 text-white',
  upcoming: 'bg-blue-600 text-white',
  scheduled: 'bg-blue-600 text-white',
  completed: 'bg-emerald-600 text-white',
  cancelled: 'bg-rose-600 text-white',
  draft: 'bg-slate-600/85 text-white',
}

export function StatusBadge({
  status, label, dot = false, solid = false, className,
}: { status: string; label?: string; dot?: boolean; solid?: boolean; className?: string }) {
  const tone = (solid ? SOLID_TONES[status] : BADGE_TONES[status])
    ?? (solid ? 'bg-slate-600/85 text-white' : 'bg-slate-100 text-slate-600')
  const text = label ?? status.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[10px] font-medium leading-4', tone, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {text}
    </span>
  )
}

/* ------------------------------------------------------------------ states */

export function EventsEmptyState({
  title, description, action, icon,
}: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400" aria-hidden>{icon}</div>}
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function EventsErrorState({ message, reference }: { message: string; reference?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" aria-hidden />
      <div>
        <p className="text-[13.5px] font-semibold text-rose-900">{message}</p>
        {reference && (
          <p className="mt-0.5 text-[12px] text-rose-700">
            Quote reference <span className="font-mono">{reference}</span> to support.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Upgrade / permission state. Rendered ONLY where the surface itself is
 * reachable but one capability inside it is not — an entirely unavailable
 * surface is omitted from navigation instead.
 */
export function EventsLockedState({
  reason, requiredPlan, billingHref, capabilityLabel,
}: {
  reason: 'plan' | 'permission' | 'feature-flag' | 'workspace-status' | 'workspace-type'
  requiredPlan?: string | null
  billingHref: string
  capabilityLabel: string
}) {
  const copy: Record<typeof reason, { title: string; body: string }> = {
    plan: {
      title: `${capabilityLabel} is on the ${requiredPlan ?? 'paid'} plan`,
      body: `Upgrade to ${requiredPlan ?? 'a paid plan'} to unlock ${capabilityLabel.toLowerCase()} for this workspace.`,
    },
    permission: {
      title: `You do not have access to ${capabilityLabel.toLowerCase()}`,
      body: 'Your role in this workspace does not include this permission. A workspace owner or admin can grant it in Settings → People.',
    },
    'feature-flag': {
      title: `${capabilityLabel} is turned off`,
      body: 'This capability has been disabled for the workspace. A workspace admin can re-enable it in workspace settings.',
    },
    'workspace-status': {
      title: 'This workspace is suspended',
      body: 'Billing needs attention before event data can be changed.',
    },
    'workspace-type': {
      title: `${capabilityLabel} is not part of this workspace type`,
      body: 'This capability belongs to a different Caption Fox workspace type.',
    },
  }
  const { title, body } = copy[reason]

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200" aria-hidden>
        <Lock size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[13px] text-slate-500">{body}</p>
      </div>
      {reason === 'plan' && (
        <Link
          href={billingHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"
        >
          View plans <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ misc */

export function ProgressRing({
  value, size = 34, tone = 'emerald',
}: { value: number; size?: number; tone?: 'emerald' | 'blue' | 'violet' | 'amber' }) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, value))
  const colours = {
    emerald: '#10b981', blue: '#2563eb', violet: '#7c3aed', amber: '#f59e0b',
  }
  return (
    <svg width={size} height={size} role="img" aria-label={`${Math.round(clamped * 100)} percent complete`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={colours[tone]} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

export function TimelineDot({ state }: { state: 'completed' | 'live' | 'upcoming' }) {
  const tone =
    state === 'completed' ? 'bg-emerald-500'
      : state === 'live' ? 'bg-blue-600'
        : 'bg-slate-300'
  return <span className={cn('relative mt-[7px] h-2 w-2 shrink-0 rounded-full', tone)} aria-hidden />
}
