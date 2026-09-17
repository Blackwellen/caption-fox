import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AlertTriangle, Info, Lock, Minus, TrendingDown, TrendingUp } from 'lucide-react'

// ── Shared design tokens for the SEO module ─────────────────────────────────
// Every SEO surface composes from these so widths, radii, borders, shadows and
// spacing stay identical across all seven routes.

export const SEO_TOKENS = {
  page: 'mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8',
  card: 'rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]',
  cardPadding: 'p-5',
  cardHeader: 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-2.5',
  sectionGap: 'gap-5',
  control: 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700',
  tableHead: 'whitespace-nowrap text-[11.5px] font-medium text-slate-500',
  tableRow: 'h-12 border-b border-slate-100 last:border-0',
  /** Denser row used by in-panel tables that sit beside a right rail. */
  tableRowTight: 'h-8 border-b border-slate-100 last:border-0',
} as const

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(SEO_TOKENS.card, className)} {...rest}>{children}</div>
}

export function CardHeader({
  title, subtitle, action, help,
}: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; help?: string }) {
  return (
    <div className={SEO_TOKENS.cardHeader}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 whitespace-nowrap text-[14.5px] font-semibold leading-tight text-slate-900">
          {title}
          {help && <InfoTip text={help} />}
        </h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">{action}</div>}
    </div>
  )
}

/** Accessible tooltip that works without JS — title + visible focus ring. */
export function InfoTip({ text, size = 13 }: { text: string; size?: number }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label={text}
        title={text}
        className="rounded-full text-slate-400 outline-none transition-colors hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Info size={size} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover/tip:block group-focus-within/tip:block"
      >
        {text}
      </span>
    </span>
  )
}

// ── Deltas ──────────────────────────────────────────────────────────────────

export function Delta({
  value, suffix = '', invert = false, size = 'sm',
}: { value: number | null; suffix?: string; invert?: boolean; size?: 'xs' | 'sm' }) {
  if (value == null || Number.isNaN(value)) {
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-400"><Minus size={12} aria-hidden />—</span>
  }
  const flat = Math.abs(value) < 0.05
  const good = invert ? value < 0 : value > 0
  const Icon = flat ? Minus : good ? TrendingUp : TrendingDown
  const tone = flat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600'
  const label = flat ? 'no change' : good ? 'improved' : 'worsened'
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold', tone, size === 'xs' ? 'text-[11px]' : 'text-xs')}>
      <Icon size={size === 'xs' ? 11 : 12} aria-hidden />
      <span className="sr-only">{label} by </span>
      {Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}{suffix}
    </span>
  )
}

/** Rank movement arrow used in keyword and ranking tables. */
export function RankChange({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-slate-400">—</span>
  if (value === 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Minus size={12} aria-hidden />0</span>
  }
  const up = value > 0
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
      <span aria-hidden>{up ? '↑' : '↓'}</span>
      <span className="sr-only">{up ? 'up' : 'down'} </span>
      {Math.abs(value)}
    </span>
  )
}

// ── Chips ───────────────────────────────────────────────────────────────────

const INTENT_TONE: Record<string, string> = {
  informational: 'bg-blue-50 text-blue-700 ring-blue-100',
  transactional: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  commercial: 'bg-violet-50 text-violet-700 ring-violet-100',
  navigational: 'bg-amber-50 text-amber-700 ring-amber-100',
  other: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export function IntentChip({ intent }: { intent: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset', INTENT_TONE[intent] ?? INTENT_TONE.other)}>
      {intent}
    </span>
  )
}

/** Keyword difficulty pill — colour AND number, never colour alone. */
export function DifficultyChip({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-slate-400">—</span>
  const tone = value >= 60 ? 'bg-red-50 text-red-700 ring-red-100'
    : value >= 45 ? 'bg-amber-50 text-amber-700 ring-amber-100'
      : value >= 30 ? 'bg-yellow-50 text-yellow-700 ring-yellow-100'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  return (
    <span className={cn('inline-flex h-6 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ring-1 ring-inset', tone)}>
      <span className="sr-only">Keyword difficulty </span>{value}
    </span>
  )
}

const STATUS_TONE: Record<string, string> = {
  winning: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  rising: 'bg-violet-50 text-violet-700 ring-violet-100',
  stable: 'bg-blue-50 text-blue-700 ring-blue-100',
  declining: 'bg-red-50 text-red-700 ring-red-100',
  not_ranking: 'bg-slate-50 text-slate-600 ring-slate-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  new: 'bg-blue-50 text-blue-700 ring-blue-100',
  lost: 'bg-red-50 text-red-700 ring-red-100',
  broken: 'bg-red-50 text-red-700 ring-red-100',
  redirected: 'bg-amber-50 text-amber-700 ring-amber-100',
  toxic: 'bg-red-50 text-red-700 ring-red-100',
  suspected_toxic: 'bg-amber-50 text-amber-700 ring-amber-100',
  unknown: 'bg-slate-50 text-slate-600 ring-slate-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-100',
  awaiting_review: 'bg-amber-50 text-amber-700 ring-amber-100',
  changes_requested: 'bg-orange-50 text-orange-700 ring-orange-100',
  approved: 'bg-violet-50 text-violet-700 ring-violet-100',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  archived: 'bg-slate-100 text-slate-500 ring-slate-200',
  open: 'bg-blue-50 text-blue-700 ring-blue-100',
  listed: 'bg-violet-50 text-violet-700 ring-violet-100',
  contacted: 'bg-amber-50 text-amber-700 ring-amber-100',
  healthy: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  needs_attention: 'bg-amber-50 text-amber-700 ring-amber-100',
  error: 'bg-red-50 text-red-700 ring-red-100',
  not_connected: 'bg-slate-50 text-slate-600 ring-slate-200',
  at_risk: 'bg-amber-50 text-amber-700 ring-amber-100',
  closed: 'bg-slate-100 text-slate-500 ring-slate-200',
  temporarily_closed: 'bg-amber-50 text-amber-700 ring-amber-100',
  cited: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  not_cited: 'bg-slate-50 text-slate-600 ring-slate-200',
  partial: 'bg-amber-50 text-amber-700 ring-amber-100',
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  neutral: 'bg-slate-50 text-slate-600 ring-slate-200',
  negative: 'bg-red-50 text-red-700 ring-red-100',
  mixed: 'bg-amber-50 text-amber-700 ring-amber-100',
  high: 'bg-red-50 text-red-700 ring-red-100',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100',
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  dofollow: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  nofollow: 'bg-violet-50 text-violet-700 ring-violet-100',
  ugc: 'bg-blue-50 text-blue-700 ring-blue-100',
  sponsored: 'bg-amber-50 text-amber-700 ring-amber-100',
  redirect: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export function StatusChip({
  status, label, dot = false, className,
}: { status: string; label?: string; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', STATUS_TONE[status] ?? STATUS_TONE.unknown, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {label ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  )
}


/**
 * Owner avatar used in brief lists, keyword tables and activity rows. Falls
 * back to initials when the profile has no uploaded image, and always exposes
 * the owner's name to assistive technology.
 */
export function OwnerAvatar({
  owner, size = 24,
}: { owner?: { full_name: string | null; avatar_url: string | null } | null; size?: number }) {
  const name = owner?.full_name?.trim()
  if (!owner || !name) {
    return (
      <span
        aria-label="Unassigned"
        title="Unassigned"
        className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-400"
        style={{ width: size, height: size }}
      >
        &ndash;
      </span>
    )
  }
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
  if (owner.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary storage hosts
      <img
        src={owner.avatar_url}
        alt={name}
        title={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-1 ring-slate-200"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-label={name}
      title={name}
      className="flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-100"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Completion'}
      >
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}

// ── States ──────────────────────────────────────────────────────────────────

export function EmptyPanel({
  title, description, action, icon,
}: { title: string; description: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <Info size={18} aria-hidden />}
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorPanel({ title, reference }: { title: string; reference: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle size={18} aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
        Try again in a moment. If it keeps happening, quote reference{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">{reference}</code> to support.
      </p>
    </div>
  )
}

/** Canonical blocked/upgrade state. Never a dead tab or blank page. */
export function AccessPanel({
  reason, message, planName, upgradeHref = '/app/settings/billing',
}: { reason: 'plan' | 'permission' | 'feature-flag' | 'workspace-type' | 'workspace-status'; message: string; planName?: string; upgradeHref?: string }) {
  const upgrade = reason === 'plan'
  return (
    <div className={cn(SEO_TOKENS.card, 'mx-auto max-w-xl p-8 text-center')}>
      <div className={cn('mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full', upgrade ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500')}>
        <Lock size={20} aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        {upgrade ? `Available on ${planName ?? 'a higher plan'}` : 'You do not have access to this area'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
      {upgrade && (
        <Link
          href={upgradeHref}
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          View plans and upgrade
        </Link>
      )}
    </div>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-100', className)} aria-hidden />
}

/** Demo-data disclosure. Shown wherever seeded records are displayed. */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
      Demo data
    </span>
  )
}
