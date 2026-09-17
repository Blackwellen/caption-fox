import Link from 'next/link'
import {
  AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2,
  Circle, Clock, FileText, Globe, Inbox, Info, Mail, Megaphone, MessageSquare,
  Rocket, Send, ShieldAlert, Sparkles, TrendingUp, Users, Video, XCircle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { hasBrand } from '@/lib/brand/brands'
import type { Priority, ScheduleKind, ScheduleStatus } from '@/lib/calendar/types'

// ── Design tokens ───────────────────────────────────────────────────────────
// Shared so a systematic spacing/width change is made in one place rather than
// scattered per-page overrides.

export const T = {
  // The shell's <main> already provides the gutter; the page only caps width on very wide screens.
  // -5px: reference breadcrumb sits 23px under the top bar; the locked shell pads 28px.
  page: 'mx-auto -mt-[5px] lg:-mt-[11px] w-full max-w-[1440px]',
  // Reference: 1px hairline (#e8ebf0), 12px radius, barely-there lift.
  card: 'rounded-xl border border-[#e8ebf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
  cardPad: 'p-4',
  // Reference controls are 32px tall with an 8px radius.
  control: 'h-8 rounded-lg border border-[#e3e7ed] bg-white px-2.5 text-[11.5px] lg:text-[10px] text-slate-700 shadow-[0_1px_1px_rgba(16,24,40,0.03)]',
  controlHover: 'hover:border-slate-300 hover:bg-slate-50',
  label: 'text-[11px] lg:text-[9.5px] font-medium uppercase tracking-wide text-slate-500',
  sectionTitle: 'text-[15px] font-semibold text-slate-900',
  muted: 'text-[12px] lg:text-[10.5px] text-slate-500',
  focus: 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
} as const

// ── Semantic colour system ──────────────────────────────────────────────────
// Status is never communicated by colour alone — every badge carries a label,
// and event blocks carry a text status too.

export const STATUS_TOKENS: Record<ScheduleStatus, { label: string; chip: string; dot: string; block: string }> = {
  draft:       { label: 'Draft',       chip: 'bg-slate-100 text-slate-600 ring-slate-200',   dot: 'bg-slate-400',   block: 'bg-slate-50 border-slate-200 text-slate-700' },
  in_review:   { label: 'In review',   chip: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500',  block: 'bg-violet-50 border-violet-200 text-violet-800' },
  pending:     { label: 'Pending',     chip: 'bg-amber-50 text-amber-700 ring-amber-200',    dot: 'bg-amber-500',   block: 'bg-amber-50 border-amber-200 text-amber-800' },
  approved:    { label: 'Approved',    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', block: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  scheduled:   { label: 'Scheduled',   chip: 'bg-blue-50 text-blue-700 ring-blue-200',       dot: 'bg-blue-500',    block: 'bg-blue-50 border-blue-200 text-blue-800' },
  in_progress: { label: 'In progress', chip: 'bg-sky-50 text-sky-700 ring-sky-200',          dot: 'bg-sky-500',     block: 'bg-sky-50 border-sky-200 text-sky-800' },
  published:   { label: 'Published',   chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', block: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  completed:   { label: 'Completed',   chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', block: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  failed:      { label: 'Failed',      chip: 'bg-red-50 text-red-700 ring-red-200',          dot: 'bg-red-500',     block: 'bg-red-50 border-red-200 text-red-800' },
  cancelled:   { label: 'Cancelled',   chip: 'bg-slate-100 text-slate-500 ring-slate-200',   dot: 'bg-slate-400',   block: 'bg-slate-50 border-slate-200 text-slate-500' },
}

export const PRIORITY_TOKENS: Record<Priority, { label: string; className: string; arrow: 'up' | 'down' | 'flat' }> = {
  urgent: { label: 'Urgent', className: 'text-red-600', arrow: 'up' },
  high:   { label: 'High',   className: 'text-orange-600', arrow: 'up' },
  medium: { label: 'Medium', className: 'text-amber-600', arrow: 'flat' },
  low:    { label: 'Low',    className: 'text-emerald-600', arrow: 'down' },
}

export const SEVERITY_TOKENS = {
  critical: { label: 'Critical', chip: 'bg-red-100 text-red-800 ring-red-300', bar: 'bg-red-500' },
  high:     { label: 'High',     chip: 'bg-red-50 text-red-700 ring-red-200',  bar: 'bg-red-400' },
  medium:   { label: 'Medium',   chip: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-400' },
  low:      { label: 'Low',      chip: 'bg-sky-50 text-sky-700 ring-sky-200',  bar: 'bg-sky-400' },
  info:     { label: 'Info',     chip: 'bg-slate-100 text-slate-600 ring-slate-200', bar: 'bg-slate-300' },
} as const

const CHANNEL_ICONS: Record<string, { icon: typeof Globe; className: string; label: string }> = {
  instagram: { icon: Sparkles, className: 'text-pink-600 bg-pink-50', label: 'Instagram' },
  tiktok:    { icon: Video,    className: 'text-slate-900 bg-slate-100', label: 'TikTok' },
  linkedin:  { icon: Users,    className: 'text-[#0A66C2] bg-blue-50', label: 'LinkedIn' },
  facebook:  { icon: Users,    className: 'text-[#1877F2] bg-blue-50', label: 'Facebook' },
  x:         { icon: MessageSquare, className: 'text-slate-900 bg-slate-100', label: 'X' },
  youtube:   { icon: Video,    className: 'text-red-600 bg-red-50', label: 'YouTube' },
  pinterest: { icon: Circle,   className: 'text-red-700 bg-red-50', label: 'Pinterest' },
  threads:   { icon: MessageSquare, className: 'text-slate-900 bg-slate-100', label: 'Threads' },
  email:     { icon: Mail,     className: 'text-blue-600 bg-blue-50', label: 'Email' },
  blog:      { icon: FileText, className: 'text-violet-600 bg-violet-50', label: 'Blog' },
  website:   { icon: Globe,    className: 'text-emerald-600 bg-emerald-50', label: 'Website' },
  sms:       { icon: MessageSquare, className: 'text-amber-600 bg-amber-50', label: 'SMS' },
  push:      { icon: Zap,      className: 'text-orange-600 bg-orange-50', label: 'Push notification' },
  internal:  { icon: Inbox,    className: 'text-slate-600 bg-slate-100', label: 'Internal' },
}

const KIND_ICONS: Record<ScheduleKind, typeof Globe> = {
  content: FileText, publishing: Send, campaign: Megaphone, task: CheckCircle2,
  approval: ShieldAlert, meeting: Users, reminder: Clock, milestone: Rocket, event: CalendarDays,
}


export function ChannelIcon({ channel, size = 16, className }: { channel: string | null | undefined; size?: number; className?: string }) {
  const config = channel ? CHANNEL_ICONS[channel] : undefined
  const Icon = config?.icon ?? Globe
  const label = config?.label ?? (channel ? channel : 'No channel')
  // Platforms render their real logo from the shared brand registry.
  if (channel && hasBrand(channel)) {
    return (
      <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size + 8, height: size + 8 }} title={label}>
        <BrandLogo brand={channel} size={size + 4} decorative />
        <span className="sr-only">{label}</span>
      </span>
    )
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-md', config?.className ?? 'bg-slate-100 text-slate-500', className)}
      style={{ width: size + 8, height: size + 8 }}
      title={label}
    >
      <Icon size={size} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function KindIcon({ kind, size = 15 }: { kind: ScheduleKind; size?: number }) {
  const Icon = KIND_ICONS[kind] ?? CalendarDays
  return <Icon size={size} aria-hidden className="shrink-0" />
}

/**
 * Reference uses two status treatments: a soft rounded-rectangle pill (tables,
 * agenda rows) and a coloured "• Label" text form (agenda preview).
 */
export function StatusBadge({ status, className, variant = 'pill' }: { status: ScheduleStatus; className?: string; variant?: 'pill' | 'dot' }) {
  const token = STATUS_TOKENS[status] ?? STATUS_TOKENS.scheduled
  if (variant === 'dot') {
    const text = token.chip.split(' ').find(c => c.startsWith('text-')) ?? 'text-slate-600'
    return (
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] lg:text-[9px] font-medium', text, className)}>
        <span className={cn('h-[5px] w-[5px] rounded-full', token.dot)} aria-hidden />
        {token.label}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md px-2 py-[3px] text-[10.5px] lg:text-[9px] font-medium leading-[14px]', token.chip.replace(/ring-\S+/g, ''), className)}>
      {token.label}
    </span>
  )
}

const KIND_TILE: Record<ScheduleKind, string> = {
  content: 'bg-blue-50 text-blue-600', publishing: 'bg-blue-50 text-blue-600',
  // Reference: tasks and approvals are solid green check tiles; meetings a grey calendar tile.
  campaign: 'bg-violet-50 text-violet-600', task: 'bg-emerald-500 text-white',
  approval: 'bg-emerald-500 text-white', meeting: 'bg-slate-100 text-slate-600',
  reminder: 'bg-amber-50 text-amber-600', milestone: 'bg-violet-50 text-violet-600',
  event: 'bg-slate-100 text-slate-600',
}

/** 26px tinted icon tile used in the reference's Next Actions list. */
export function KindTile({ kind, soft = false }: { kind: ScheduleKind; soft?: boolean }) {
  return (
    <span className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md', soft && (kind === 'task' || kind === 'approval') ? 'bg-emerald-50 text-emerald-600' : KIND_TILE[kind] ?? KIND_TILE.event)} aria-hidden>
      <KindIcon kind={kind} size={13} />
    </span>
  )
}

const ACTIVITY_TILE = {
  success: { className: 'bg-emerald-500', icon: CheckCircle2 },
  danger: { className: 'bg-red-500', icon: XCircle },
  warning: { className: 'bg-orange-500', icon: AlertTriangle },
  info: { className: 'bg-blue-600', icon: CalendarDays },
  neutral: { className: 'bg-violet-500', icon: Clock },
} as const

/** Solid 26px icon tile used in the reference's Recent Activity list. */
export function ActivityTile({ tone }: { tone: keyof typeof ACTIVITY_TILE | string }) {
  const token = ACTIVITY_TILE[tone as keyof typeof ACTIVITY_TILE] ?? ACTIVITY_TILE.neutral
  const Icon = token.icon
  return (
    <span className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-white', token.className)} aria-hidden>
      <Icon size={14} />
    </span>
  )
}

export function PriorityTag({ priority }: { priority: Priority }) {
  const token = PRIORITY_TOKENS[priority]
  const Arrow = token.arrow === 'up' ? ArrowUpRight : token.arrow === 'down' ? ArrowDownRight : TrendingUp
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap text-[10.5px] lg:text-[9px] font-medium', token.className)}>
      <Arrow size={11} aria-hidden />
      {token.label}
      <span className="sr-only">priority</span>
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: keyof typeof SEVERITY_TOKENS }) {
  const token = SEVERITY_TOKENS[severity]
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md px-2 py-[3px] lg:py-[2px] text-[10.5px] lg:text-[9px] font-semibold leading-[14px] lg:leading-[12px]', token.chip.replace(/ring-\S+/g, ''))}>
      {token.label}
    </span>
  )
}

export function Avatar({ name, size = 22 }: { name: string | null | undefined; size?: number }) {
  const label = name?.trim() || 'Unassigned'
  const initials = label.split(/\s+/).map(part => part[0]).join('').toUpperCase().slice(0, 2)
  // Deterministic tint so the same person keeps the same colour across pages.
  const palette = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700']
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-[10px] lg:text-[9px] font-semibold', palette[hash % palette.length])}
      style={{ width: size, height: size }}
      title={label}
    >
      {initials || '?'}
      <span className="sr-only">{label}</span>
    </span>
  )
}

// ── Layout primitives ───────────────────────────────────────────────────────

export function Panel({
  title, count, action, footer, children, className, bodyClassName, hint,
}: {
  title: string
  count?: number | null
  action?: { label: string; href: string } | null
  /** Centred footer link above a hairline, as on the reference Agenda panels. */
  footer?: { label: string; href: string } | null
  hint?: string | null
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn(T.card, 'flex min-w-0 flex-col', className)}>
      {/* Reference panel headers: 40px, no divider — the list starts directly under the title. */}
      <header className="flex h-9 lg:h-8 shrink-0 items-center justify-between gap-3 px-3.5 pt-0.5">
        <h2 className="flex items-center gap-2 text-[13px] lg:text-[11.5px] font-semibold text-slate-900">
          {title}
          {typeof count === 'number' && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] lg:text-[9.5px] font-medium text-slate-600">{count}</span>
          )}
          {hint && <span title={hint} className="text-slate-300"><Info size={13} aria-hidden /><span className="sr-only">{hint}</span></span>}
        </h2>
        {action && (
          <Link href={action.href} className={cn('shrink-0 text-[11.5px] lg:text-[10px] font-medium text-blue-600 hover:text-blue-700', T.focus)}>
            {action.label}
          </Link>
        )}
      </header>
      <div className={cn('min-w-0 flex-1', bodyClassName ?? 'px-3.5 pb-3.5 lg:pb-3')}>{children}</div>
      {footer && (
        <div className="border-t border-[#eef0f4] py-2.5 text-center">
          <Link href={footer.href} className={cn('text-[11.5px] lg:text-[10px] font-medium text-blue-600 hover:text-blue-700', T.focus)}>
            {footer.label}
          </Link>
        </div>
      )}
    </section>
  )
}

export interface KpiDefinition {
  id: string
  label: string
  value: string
  delta?: { value: number; suffix?: string; goodWhenUp?: boolean } | null
  footnote?: string | null
  tone: 'blue' | 'orange' | 'red' | 'emerald' | 'violet' | 'amber' | 'sky'
  icon: React.ReactNode
}

const TONE_TILE: Record<KpiDefinition['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
}

/**
 * The six-up KPI strip shared by all four Calendar pages. One card, divided
 * cells — so the strip height and rhythm stay identical page to page.
 */
export function KpiStrip({ items }: { items: KpiDefinition[] }) {
  return (
    // Reference strip: one 80px card; cells separated by short dividers inset ~15px top and bottom.
    <div className={cn(T.card, 'grid grid-cols-1 overflow-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6')}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'relative flex min-w-0 items-center gap-2.5 px-3.5 py-3',
            index !== 0 && 'border-t border-slate-100 sm:border-t-0',
            // Short vertical divider on the left edge of every cell but the first in a row.
            'before:absolute before:left-0 before:top-[15px] before:bottom-[15px] before:w-px before:bg-[#e8ebf0]',
            index % 2 === 0 && 'before:hidden sm:before:hidden',
            index % 2 !== 0 && 'sm:before:block',
            'lg:before:block lg:[&:nth-child(3n+1)]:before:hidden xl:[&:nth-child(3n+1)]:before:block xl:first:before:hidden',
            index > 2 && 'lg:border-t xl:border-t-0',
          )}
        >
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', TONE_TILE[item.tone])} aria-hidden>
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11.5px] lg:text-[10px] leading-[14px] text-slate-700">{item.label}</p>
            <p className="mt-[3px] text-[20px] lg:text-[19px] font-bold leading-6 tracking-tight text-slate-900">{item.value}</p>
            {item.delta ? <DeltaLabel {...item.delta} /> : item.footnote ? (
              <p className="truncate text-[10.5px] lg:text-[9px] leading-[13px] text-slate-500">{item.footnote}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function DeltaLabel({ value, suffix = 'vs last week', goodWhenUp = true }: { value: number; suffix?: string; goodWhenUp?: boolean }) {
  const up = value > 0
  const flat = value === 0
  const good = flat ? true : up === goodWhenUp
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <p className={cn('flex items-center gap-1 whitespace-nowrap text-[10.5px] lg:text-[9px] font-medium leading-[13px]', flat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600')}>
      {!flat && <Arrow size={11} aria-hidden className="shrink-0" />}
      <span className="shrink-0">{flat ? 'No change' : `${Math.abs(value)}%`}</span>
      <span className="truncate font-normal text-slate-400">{suffix}</span>
    </p>
  )
}

// ── States ──────────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, body, action,
}: {
  icon?: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden>
        {icon ?? <CalendarDays size={18} />}
      </span>
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] lg:text-[11px] leading-5 text-slate-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, retryHref }: { message: string; retryHref?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500" aria-hidden>
        <AlertCircle size={18} />
      </span>
      <p className="text-[14px] font-semibold text-slate-800">We could not load this</p>
      <p className="mt-1 max-w-md text-[12.5px] lg:text-[11px] leading-5 text-slate-500">{message}</p>
      {retryHref && (
        <Link href={retryHref} className={cn('mt-4 rounded-lg bg-blue-600 px-3 py-2 text-[13px] lg:text-[11.5px] font-medium text-white hover:bg-blue-700', T.focus)}>
          Try again
        </Link>
      )}
    </div>
  )
}

export function BlockedState({
  title, body, action,
}: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className={cn(T.card, 'px-6 py-12 text-center')}>
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden>
        <ShieldAlert size={20} />
      </span>
      <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] lg:text-[11.5px] leading-5 text-slate-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Loading skeletons ───────────────────────────────────────────────────────
// Sized to the final layout so switching from loading to loaded causes no shift.

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} aria-hidden />
}

export function KpiStripSkeleton() {
  return (
    <div className={cn(T.card, 'grid grid-cols-1 overflow-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6')}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 border-slate-100 px-4 py-4 lg:border-l lg:first:border-l-0">
          <Shimmer className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-6 w-14" />
            <Shimmer className="h-2.5 w-20" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading key figures</span>
    </div>
  )
}

export function PanelSkeleton({ rows = 4, height = 'h-[188px]' }: { rows?: number; height?: string }) {
  return (
    <div className={cn(T.card, 'overflow-hidden')}>
      <div className="border-b border-slate-100 px-5 py-3.5"><Shimmer className="h-4 w-32" /></div>
      <div className={cn('space-y-3 p-5', height)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Shimmer className="h-6 w-6 rounded-md" />
            <div className="flex-1 space-y-1.5"><Shimmer className="h-3 w-2/3" /><Shimmer className="h-2.5 w-1/3" /></div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function GridSkeleton() {
  return (
    <div className={cn(T.card, 'overflow-hidden')}>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="px-3 py-2.5"><Shimmer className="h-3 w-8" /></div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-[74px] border-b border-r border-slate-100 p-2">
            <Shimmer className="h-2.5 w-4" />
            {i % 3 === 0 && <Shimmer className="mt-2 h-7 w-full rounded" />}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading calendar</span>
    </div>
  )
}

export { CheckCircle2, Clock, XCircle, AlertTriangle, AlertCircle, Rocket, TrendingUp, CalendarDays, Send, Users, ShieldAlert, Megaphone, Zap, Inbox }
