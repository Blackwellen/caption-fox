// Studio design-system primitives.
//
// The eight Studio pages were built 1:1 against approved 1491×1055 references.
// Those references use a dense type scale (≈10–13px body, 26px H1), so the dense
// sizes apply from `lg` up; tablet and phone keep legible type and 36px+ touch
// targets. Every Studio surface composes these tokens rather than one-off CSS.

import Link from 'next/link'
import { ArrowDown, ArrowUp, AlertTriangle, SearchX, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonLite } from '@/lib/studio/types'

// ── Tokens ───────────────────────────────────────────────────────────────────
export const S_CARD = 'rounded-[10px] border border-[#e6e9f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
export const S_BORDER = 'border-[#e6e9f0]'
export const S_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1'
export const S_TITLE_BASE = 'text-[15px] font-semibold tracking-[-0.01em] text-slate-900'
export const S_TITLE = `${S_TITLE_BASE} lg:text-[14px]`
export const S_MUTED = 'text-slate-500'
export const S_LABEL = 'text-[12px] text-slate-500 lg:text-[10px]'
export const S_TH = 'h-9 px-3 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-slate-500 lg:h-[30px] lg:text-[8.5px]'
/** Sentence-case table header (Compose, Templates, Media tables). */
export const S_TH_PLAIN = 'h-9 px-3 text-left text-[12px] font-medium text-slate-500 lg:h-[30px] lg:text-[9.5px]'
export const S_TD = 'px-3 text-[13px] text-slate-700 lg:text-[10px]'

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, as: Tag = 'section', ...rest }: {
  children: React.ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
} & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={cn(S_CARD, className)} {...rest}>{children}</Tag>
}

export function CardHeader({ title, action, className, titleClassName, id }: {
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
  titleClassName?: string
  id?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* A titleClassName supplies its own desktop size (cn does not merge conflicting classes). */}
      <h2 id={id} className={cn(titleClassName && /lg:text-\[/.test(titleClassName) ? S_TITLE_BASE : S_TITLE, titleClassName)}>{title}</h2>
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  )
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('whitespace-nowrap text-[12px] font-medium text-blue-600 hover:text-blue-700 lg:text-[10px]', S_FOCUS, className)}>
      {children}
    </Link>
  )
}

// ── Buttons ──────────────────────────────────────────────────────────────────
export type BtnVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
export type BtnSize = 'xs' | 'sm' | 'md' | 'lg'

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-[#1a5cff] text-white hover:bg-[#1450e6] border border-[#1a5cff] shadow-[0_1px_2px_rgba(26,92,255,0.25)]',
  secondary: 'border border-[#dfe3ea] bg-white text-slate-700 hover:bg-slate-50',
  soft: 'border border-[#d6e2ff] bg-[#f2f6ff] text-[#1a5cff] hover:bg-[#e8efff]',
  ghost: 'border border-transparent text-slate-600 hover:bg-slate-100',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
}
const BTN_SIZE: Record<BtnSize, string> = {
  xs: 'h-8 px-2.5 text-[12px] lg:h-[22px] lg:px-2 lg:text-[9px] rounded-md',
  sm: 'h-9 px-3 text-[13px] lg:h-7 lg:px-2.5 lg:text-[10px] rounded-md',
  md: 'h-10 px-3.5 text-[13px] lg:h-8 lg:px-3 lg:text-[11px] rounded-lg',
  lg: 'h-11 px-4 text-[14px] lg:h-9 lg:px-3.5 lg:text-[12px] rounded-lg',
}

export function btnClass(variant: BtnVariant = 'secondary', size: BtnSize = 'sm', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    S_FOCUS, BTN_VARIANT[variant], BTN_SIZE[size], className,
  )
}

export function Btn({ variant, size, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  size?: BtnSize
}) {
  return <button type="button" className={btnClass(variant, size, className)} {...props} />
}

export function BtnLink({ href, variant, size, className, children, ...rest }: {
  href: string
  variant?: BtnVariant
  size?: BtnSize
  className?: string
  children: React.ReactNode
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <Link href={href} className={btnClass(variant, size, className)} {...rest}>{children}</Link>
}

// ── Status pills ─────────────────────────────────────────────────────────────
export type Tone = 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate' | 'pink' | 'sky' | 'orange'

export const TONE_PILL: Record<Tone, string> = {
  blue: 'bg-[#eef3ff] text-[#2f62f5] ring-[#dbe5ff]',
  green: 'bg-[#ecfaf1] text-[#15924a] ring-[#d3f1de]',
  amber: 'bg-[#fff6e6] text-[#d27a06] ring-[#fde8c2]',
  violet: 'bg-[#f3efff] text-[#7045e6] ring-[#e4dbff]',
  red: 'bg-[#fff0f0] text-[#d93b3b] ring-[#ffd9d9]',
  slate: 'bg-[#f3f5f8] text-slate-600 ring-[#e3e7ee]',
  pink: 'bg-[#fff0f7] text-[#d02f7c] ring-[#fdd8ea]',
  sky: 'bg-[#eaf6ff] text-[#0b7cc9] ring-[#d2ebfd]',
  orange: 'bg-[#fff2ea] text-[#e0621a] ring-[#ffdcc7]',
}

export const TONE_TILE: Record<Tone, string> = {
  blue: 'bg-[#eef3ff] text-[#2f62f5]',
  green: 'bg-[#e9f8ef] text-[#1c9b52]',
  amber: 'bg-[#fff5e3] text-[#e38b06]',
  violet: 'bg-[#f2eeff] text-[#7045e6]',
  red: 'bg-[#fff0f0] text-[#e04848]',
  slate: 'bg-[#f2f4f7] text-slate-500',
  pink: 'bg-[#fff0f6] text-[#dc2f82]',
  sky: 'bg-[#e9f5ff] text-[#1683d1]',
  orange: 'bg-[#fff1e8] text-[#ec6a1f]',
}

export function Pill({ tone = 'slate', children, className, dot }: {
  tone?: Tone
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span className={cn(
      'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[5px] px-2 text-[12px] font-medium ring-1 ring-inset lg:h-[17px] lg:px-1.5 lg:text-[9px]',
      TONE_PILL[tone], className,
    )}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

export function IconTile({ tone = 'blue', children, className, round = false }: {
  tone?: Tone
  children: React.ReactNode
  className?: string
  round?: boolean
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', round ? 'rounded-full' : 'rounded-lg', TONE_TILE[tone], className)} aria-hidden>
      {children}
    </span>
  )
}

// ── Deltas ───────────────────────────────────────────────────────────────────
export interface DeltaValue { pct: number | null; direction: 'up' | 'down' | 'flat' }

/** Percentage change between two real counts. No prior period = no delta shown. */
export function delta(current: number, previous: number): DeltaValue {
  if (previous <= 0) return { pct: current > 0 ? null : 0, direction: current > 0 ? 'up' : 'flat' }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

export function Delta({ value, suffix, className, invert = false, arrowOnly = false, muted = false, short = false }: {
  value: DeltaValue
  suffix?: string
  className?: string
  /** For metrics where down is good (e.g. blockers). */
  invert?: boolean
  arrowOnly?: boolean
  /** Neutral grey arrow and figure (KPI cards that report change, not judgement). */
  muted?: boolean
  short?: boolean
}) {
  if (value.pct === null) {
    return <span className={cn('text-slate-500', className)}>{short ? 'New' : 'New in the last 7 days'}</span>
  }
  const good = invert ? value.direction === 'down' : value.direction === 'up'
  const colour = muted || value.direction === 'flat' ? 'text-slate-600 font-normal' : good ? 'text-[#16a34a]' : 'text-[#e5484d]'
  const Arrow = value.direction === 'down' ? ArrowDown : ArrowUp
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap', className)}>
      <span className={cn('inline-flex items-center gap-0.5 font-medium', arrowOnly ? colour : colour)}>
        {value.direction !== 'flat' && <Arrow className="h-3 w-3 lg:h-2.5 lg:w-2.5" strokeWidth={2.4} aria-hidden />}
        <span>{value.pct.toLocaleString('en-GB')}%</span>
        <span className="sr-only">{value.direction === 'up' ? 'increase' : value.direction === 'down' ? 'decrease' : 'no change'}</span>
      </span>
      {suffix && <span className="text-slate-500">{suffix}</span>}
    </span>
  )
}

// ── People ───────────────────────────────────────────────────────────────────
export function PersonAvatar({ person, size = 20, className }: { person?: PersonLite | null; size?: number; className?: string }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  if (person?.avatar_url) {
    return (
      // Signed R2 / storage URLs from several hosts; a plain img avoids a remote-pattern allowlist.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={person.avatar_url} alt="" title={name} width={size} height={size}
        className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
    )
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
  return (
    <span title={name} aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-[#e8edf7] font-semibold text-[#4b5b7a]', className)}
      style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.4)) }}>
      {initials || '?'}
    </span>
  )
}

export function personName(person?: PersonLite | null): string {
  return person?.full_name ?? person?.email ?? 'Unassigned'
}

/** "Sarah J." — the compact attribution style the activity feeds use. */
export function shortName(person?: PersonLite | null): string {
  const name = person?.full_name?.trim()
  if (!name) return person?.email ?? 'Someone'
  const [first, ...rest] = name.split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1]![0]}.` : first!
}

// ── Formatting (UK) ──────────────────────────────────────────────────────────
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(value))
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).format(new Date(value)).toUpperCase()
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return `${fmtDate(value)}, ${fmtTime(value)}`
}

export function fmtAgo(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return '—'
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 86_400 * 2) return 'Yesterday'
  if (seconds < 86_400 * 7) return `${Math.floor(seconds / 86_400)}d ago`
  if (seconds < 86_400 * 30) return `${Math.floor(seconds / (86_400 * 7))}w ago`
  return fmtDate(value)
}

export function fmtCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  // Hand-rolled so server (Node ICU) and browser render identical text; Intl
  // compact notation differs between runtimes ("21K" vs "21k") and breaks hydration.
  const abs = Math.abs(value)
  const unit = abs >= 1e9 ? ['B', 1e9] as const : abs >= 1e6 ? ['M', 1e6] as const : abs >= 1e3 ? ['K', 1e3] as const : null
  if (!unit) return String(Math.round(value * 10) / 10)
  return `${String(Math.round((value / unit[1]) * 10) / 10)}${unit[0]}`
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-GB')
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`
}

// ── States ───────────────────────────────────────────────────────────────────
export function EmptyBlock({ title, message, action, search = false, className }: {
  title: string
  message: string
  action?: React.ReactNode
  search?: boolean
  className?: string
}) {
  const Icon = search ? SearchX : Wand2
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400" aria-hidden>
        <Icon size={18} />
      </span>
      <p className="text-[14px] font-semibold text-slate-900 lg:text-[12px]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500 lg:text-[11px]">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorBlock({ message, className }: { message?: string; className?: string }) {
  return (
    <div role="alert" className={cn('m-3 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-[13px] text-red-800 lg:text-[11px]', className)}>
      <p className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-px shrink-0 text-red-500" aria-hidden />
        <span>
          <span className="font-medium">We could not load this data.</span>{' '}
          {message ? 'Try refreshing the page. ' : ''}If this keeps happening, contact support with reference{' '}
          <code className="rounded bg-red-100 px-1 font-mono text-[11px] lg:text-[10px]">CF-STUDIO</code>.
        </span>
      </p>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('block animate-pulse rounded bg-slate-100 motion-reduce:animate-none', className)} aria-hidden />
}

// ── KPI tile (dense strip used by the Studio sub-pages) ──────────────────────
export function KpiTile({ icon, tone, value, label, trend, suffix = 'vs last 7 days', invert = false, href, className, labelFirst = false, note, valueSuffix }: {
  icon: React.ReactNode
  tone: Tone
  value: number | string
  label: string
  trend?: { current: number; previous: number }
  suffix?: string
  invert?: boolean
  href?: string
  className?: string
  /** AI Generate style: label above a larger value, icon aligned to the label. */
  labelFirst?: boolean
  /** Replaces the delta line, e.g. "37% used". */
  note?: string
  valueSuffix?: string
}) {
  const shown = typeof value === 'number' ? value.toLocaleString('en-GB') : value
  const trendLine = note
    ? <span className="mt-0.5 block text-[11px] text-slate-500 lg:mt-[4px] lg:text-[9.5px]">{note}</span>
    : trend && <Delta value={delta(trend.current, trend.previous)} suffix={suffix} invert={invert} className="mt-0.5 block text-[11px] lg:mt-[2px] lg:text-[9.5px]" />
  const body = labelFirst ? (
    <>
      <IconTile tone={tone} round className="h-9 w-9 self-start lg:-mr-[3px] lg:mt-[1px] lg:h-[22px] lg:w-[22px]">{icon}</IconTile>
      <span className="min-w-0">
        <span className="block truncate text-[12px] text-slate-600 lg:overflow-visible lg:whitespace-nowrap lg:text-[8.5px]" title={label}>{label}</span>
        <span className="block text-[20px] font-semibold leading-tight text-slate-900 lg:mt-[2px] lg:text-[17px]">
          {shown}{valueSuffix && <span className="ml-1 text-[13px] font-normal text-slate-500 lg:text-[11px]">{valueSuffix}</span>}
        </span>
        {trendLine}
      </span>
    </>
  ) : (
    <>
      <IconTile tone={tone} className="h-10 w-10 rounded-[9px] lg:h-[34px] lg:w-[34px]">{icon}</IconTile>
      <span className="min-w-0">
        <span className="block text-[20px] font-semibold leading-tight text-slate-900 lg:text-[15px]">{shown}</span>
        <span className="block truncate text-[12px] text-slate-600 lg:text-[10px]">{label}</span>
        {trendLine}
      </span>
    </>
  )
  const cls = cn(S_CARD, 'flex h-full items-center gap-3 px-4 py-3 lg:h-[70px] lg:gap-[12px] lg:px-[14px] lg:py-0', href && 'transition-colors hover:border-[#c9d8ff]', className)
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
