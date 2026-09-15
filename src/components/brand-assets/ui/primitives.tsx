import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ChevronRight, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCount, kpiTone, toneFor, humanise } from '../tokens'

// ---------------------------------------------------------------------------
// Page header — title, subtitle, actions. Shared by all five routes so the
// baseline and action alignment are identical across the module.
// ---------------------------------------------------------------------------
export function PageHeading({
  title, subtitle, actions,
}: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type ButtonTone = 'primary' | 'secondary'

export function ActionLink({
  href, icon: Icon, children, tone = 'secondary', disabled, title,
}: {
  href: string
  icon?: React.ComponentType<{ size?: number }>
  children: React.ReactNode
  tone?: ButtonTone
  disabled?: boolean
  title?: string
}) {
  const cls = cn(
    'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors',
    tone === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    disabled && 'pointer-events-none opacity-50',
  )
  if (disabled) {
    return <span className={cls} title={title} aria-disabled="true">{Icon && <Icon size={16} />}{children}</span>
  }
  return <Link href={href} className={cls} title={title}>{Icon && <Icon size={16} />}{children}</Link>
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------
export interface KpiSpec {
  key: string
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone: keyof typeof kpiTone
  delta: number | null
  deltaSuffix: string
  /** true when an increase is a good thing. Drives arrow direction + colour. */
  riseIsGood: boolean
  href: string | null
  tooltip: string
  /** Renders a progress ring instead of a wash icon (compliance, storage). */
  ring?: number
}

export function KpiStrip({ items }: { items: KpiSpec[] }) {
  return (
    <section
      aria-label="Key metrics"
      className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
    >
      {items.map(({ key, ...kpi }) => <KpiCard key={key} kpiKey={key} {...kpi} />)}
    </section>
  )
}

function KpiCard(kpi: Omit<KpiSpec, 'key'> & { kpiKey: string }) {
  const tone = kpiTone[kpi.tone] ?? kpiTone.blue
  const Icon = kpi.icon
  const up = (kpi.delta ?? 0) >= 0
  const good = up === kpi.riseIsGood
  const body = (
    <div className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      {kpi.ring !== undefined
        ? <ProgressRing value={kpi.ring} className={tone.ring} />
        : (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone.wash)}>
            <Icon size={18} className={tone.icon} />
          </span>
        )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-500">{kpi.label}</p>
        <p className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">{kpi.value}</p>
        {kpi.delta !== null && (
          <p className={cn('mt-1 flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(kpi.delta)} {kpi.deltaSuffix}
          </p>
        )}
      </div>
      <span className="text-slate-300" aria-hidden="true"><MoreVertical size={16} /></span>
    </div>
  )
  if (!kpi.href) return <div title={kpi.tooltip}>{body}</div>
  return <Link href={kpi.href} title={kpi.tooltip} className="block h-full focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl">{body}</Link>
}

export function ProgressRing({
  value, className, size = 40, stroke = 4,
}: { value: number; className?: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label={`${value}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-200" />
      <circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        className={cn('fill-none', className)}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Panel — the standard bordered card with an optional header link
// ---------------------------------------------------------------------------
export function Panel({
  title, action, actionHref, children, className, count, dense,
}: {
  title?: string
  action?: string
  actionHref?: string
  children: React.ReactNode
  className?: string
  count?: number
  dense?: boolean
}) {
  return (
    <section className={cn('flex flex-col rounded-xl border border-slate-200 bg-white', className)}>
      {title && (
        <div className={cn('flex items-center justify-between border-b border-slate-100', dense ? 'px-4 py-3' : 'px-5 py-3.5')}>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {formatCount(count)}
              </span>
            )}
          </h2>
          {action && actionHref && (
            <Link href={actionHref} className="inline-flex items-center gap-0.5 text-[13px] font-medium text-blue-600 hover:text-blue-700">
              {action}
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Status badge — colour always paired with a text label
// ---------------------------------------------------------------------------
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
      toneFor(status),
    )}>
      {label ?? humanise(status)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export function EmptyPanel({
  title, body, action, actionHref, icon: Icon,
}: {
  title: string
  body: string
  action?: string
  actionHref?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <Icon size={20} className="text-slate-400" />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      {action && actionHref && (
        <Link href={actionHref} className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
          {action}
        </Link>
      )}
    </div>
  )
}

export function BlockedState({
  title, message, actionLabel, actionHref,
}: { title: string; message: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{message}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-5 inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

/** Skeletons mirror the final layout so nothing shifts when data lands. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-slate-100', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-2.5 w-1/5 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row / list helpers
// ---------------------------------------------------------------------------
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
      {children}
    </Link>
  )
}

export function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-center gap-1 border-t border-slate-100 py-3 text-[13px] font-semibold text-blue-600 hover:bg-slate-50">
      {label} <ChevronRight size={14} />
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Pagination — server-driven via links so state survives refresh and sharing
// ---------------------------------------------------------------------------
export function Pagination({
  page, pageSize, total, hrefFor,
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (patch: Record<string, string | number | null>) => string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const window: (number | '…')[] = []
  const push = (n: number | '…') => window.push(n)
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) push(i)
  } else {
    push(1)
    if (page > 3) push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) push(i)
    if (page < pages - 2) push('…')
    push(pages)
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3" aria-label="Pagination">
      <p className="text-[13px] text-slate-500">
        Showing {formatCount(from)} to {formatCount(to)} of {formatCount(total)} results
      </p>
      <div className="flex items-center gap-1">
        <PageBtn href={hrefFor({ page: page - 1 })} disabled={page <= 1} label="Previous">‹</PageBtn>
        {window.map((p, i) =>
          p === '…'
            ? <span key={`gap-${i}`} className="px-2 text-sm text-slate-400">…</span>
            : (
              <Link
                key={p}
                href={hrefFor({ page: p })}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium',
                  p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {p}
              </Link>
            ),
        )}
        <PageBtn href={hrefFor({ page: page + 1 })} disabled={page >= pages} label="Next">›</PageBtn>
        <select
          className="ml-2 h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600"
          defaultValue={pageSize}
          aria-label="Results per page"
          disabled
        >
          <option value={pageSize}>{pageSize} / page</option>
        </select>
      </div>
    </nav>
  )
}

function PageBtn({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return <span aria-disabled="true" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300">{children}</span>
  }
  return (
    <Link href={href} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100">
      {children}
    </Link>
  )
}
