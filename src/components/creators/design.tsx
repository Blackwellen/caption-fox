// Creators & UGC design system, measured from the six approved references
// (designs/Universal Sections/UGC & CReators, 1448 x 1086). Server-safe: no
// hooks, so every page can render these on the server with zero hydration
// cost. Interactive controls live in ./controls.
//
// Reference geometry (content column ~1145px wide):
//   header    title 22px/600, subtitle 12.5px, actions 40px tall
//   KPI row   6 cards, 118px tall, 13px gutter, 36px tinted icon, sparkline
//   controls  34px tall, 8px radius
//   panels    12px radius, 1px #e6e9f0 border, title 13px/600, "View all" 11px

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowDownRight, ArrowUpRight, BadgeCheck, CalendarClock, CircleDollarSign, Clock,
  FileText, Hourglass, RefreshCw, ShieldAlert, ShieldCheck, Target, Users, Wallet,
  CheckCircle2, CreditCard, Receipt, FileSignature, Timer,
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { AreaTrend, type AreaSeries } from './charts'

export const CARD = 'rounded-xl border border-[#e6e9f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

// ── Tones ───────────────────────────────────────────────────────────────────
export type Tone = 'blue' | 'violet' | 'amber' | 'green' | 'red' | 'slate' | 'sky' | 'orange'

export const TONE: Record<Tone, { chip: string; stroke: string; fill: string; text: string; dot: string; soft: string }> = {
  blue: { chip: 'bg-[#eef3ff] text-[#2563eb]', stroke: '#3b82f6', fill: '#3b82f6', text: 'text-[#2563eb]', dot: 'bg-[#3b82f6]', soft: 'bg-[#eef4ff] text-[#2563eb] ring-[#dbe6ff]' },
  violet: { chip: 'bg-[#f3efff] text-[#7c3aed]', stroke: '#8b5cf6', fill: '#8b5cf6', text: 'text-[#7c3aed]', dot: 'bg-[#8b5cf6]', soft: 'bg-[#f4f0ff] text-[#7c3aed] ring-[#e6dcff]' },
  amber: { chip: 'bg-[#fff5e8] text-[#f59e0b]', stroke: '#f59e0b', fill: '#f59e0b', text: 'text-[#d97706]', dot: 'bg-[#f59e0b]', soft: 'bg-[#fff7eb] text-[#d97706] ring-[#fde7c3]' },
  orange: { chip: 'bg-[#fff1e8] text-[#f97316]', stroke: '#f97316', fill: '#f97316', text: 'text-[#ea580c]', dot: 'bg-[#f97316]', soft: 'bg-[#fff3eb] text-[#ea580c] ring-[#fedcc5]' },
  green: { chip: 'bg-[#ebf9f1] text-[#16a34a]', stroke: '#22c55e', fill: '#22c55e', text: 'text-[#16a34a]', dot: 'bg-[#22c55e]', soft: 'bg-[#ecfbf2] text-[#15803d] ring-[#ccf1db]' },
  red: { chip: 'bg-[#fdeeee] text-[#ef4444]', stroke: '#ef4444', fill: '#ef4444', text: 'text-[#dc2626]', dot: 'bg-[#ef4444]', soft: 'bg-[#fef0f0] text-[#dc2626] ring-[#fbd5d5]' },
  sky: { chip: 'bg-[#eaf6fd] text-[#0284c7]', stroke: '#0ea5e9', fill: '#0ea5e9', text: 'text-[#0284c7]', dot: 'bg-[#0ea5e9]', soft: 'bg-[#eaf7fe] text-[#0369a1] ring-[#cdebfb]' },
  slate: { chip: 'bg-slate-100 text-slate-500', stroke: '#94a3b8', fill: '#94a3b8', text: 'text-slate-500', dot: 'bg-slate-400', soft: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

// ── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title, subtitle, actions, nav,
}: { title: string; subtitle: string; actions?: ReactNode; nav?: ReactNode }) {
  return (
    <div className="mb-[18px]">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 pt-[3px]">
          <h1 className="text-[22px] font-semibold leading-[28px] tracking-[-0.01em] text-[#0b1220]">{title}</h1>
          <p className="mt-[5px] text-[12.5px] leading-4 text-[#5b6577]">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-3 max-sm:grid max-sm:w-full max-sm:grid-cols-1 max-sm:[&>*]:w-full">{actions}</div>}
      </header>
      {nav && <div className="mt-3">{nav}</div>}
    </div>
  )
}

export const BUTTON_BASE = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] px-[18px] text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-55'
export const BUTTON_PRIMARY = cn(BUTTON_BASE, 'bg-[#1d6bf3] text-white shadow-[0_1px_2px_rgba(29,107,243,0.35)] hover:bg-[#165ad6]')
export const BUTTON_SECONDARY = cn(BUTTON_BASE, 'border border-[#dfe3ea] bg-white text-[#1f2937] hover:bg-slate-50')

/** Disabled header action that explains itself instead of disappearing. */
export function DisabledAction({ label, reason, icon, primary }: { label: string; reason: string; icon?: ReactNode; primary?: boolean }) {
  return (
    <button type="button" disabled title={reason} className={primary ? BUTTON_PRIMARY : BUTTON_SECONDARY}>
      {icon}{label}<span className="sr-only">. Unavailable: {reason}</span>
    </button>
  )
}

// ── KPI cards ───────────────────────────────────────────────────────────────

const KPI_ICONS = {
  users: Users, file: FileText, clock: Clock, shield: ShieldCheck, shieldAlert: ShieldAlert,
  money: CircleDollarSign, target: Target, calendar: CalendarClock, badge: BadgeCheck,
  wallet: Wallet, refresh: RefreshCw, hourglass: Hourglass, check: CheckCircle2, card: CreditCard,
  receipt: Receipt, signature: FileSignature, timer: Timer,
} as const
export type KpiIconName = keyof typeof KPI_ICONS

export interface Kpi {
  id: string
  label: string
  value: string
  /** e.g. "12.5% vs last 30 days". Omit when there is no honest comparison. */
  delta?: string
  trend?: 'up' | 'down' | 'flat'
  /** Arrow colour follows the card tone, as in the reference. */
  tone: Tone
  icon: KpiIconName
  spark?: number[]
  href?: string
  tooltip?: string
}

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="mb-[17px] grid grid-cols-1 gap-[13px] min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {items.map(item => <KpiCard key={item.id} item={item} />)}
    </div>
  )
}

function KpiCard({ item }: { item: Kpi }) {
  const Icon = KPI_ICONS[item.icon]
  const tone = TONE[item.tone]
  const body = (
    <>
      <div className="flex items-start gap-[10px]">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone.chip)} aria-hidden>
          <Icon size={17} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('overflow-hidden whitespace-nowrap font-medium leading-4 text-[#1f2937]', item.label.length > 24 ? 'text-[9px] tracking-[-0.035em]' : item.label.length > 18 ? 'text-[10px] tracking-[-0.02em]' : 'text-[11px] tracking-[-0.01em]')} title={item.tooltip ?? item.label}>{item.label}</p>
          <p className="mt-[5px] truncate text-[21px] font-semibold leading-[24px] tracking-[-0.01em] text-[#0b1220]">{item.value}</p>
        </div>
      </div>
      <p className="mt-[9px] flex h-4 items-center gap-1 truncate text-[10.5px] text-[#667085]">
        {item.delta && item.trend === 'down'
          ? <ArrowDownRight size={12} className={cn('shrink-0', tone.text)} aria-hidden />
          : item.delta && item.trend !== 'flat' ? <ArrowUpRight size={12} className={cn('shrink-0', tone.text)} aria-hidden /> : null}
        <span className="truncate">{item.delta ?? ' '}</span>
      </p>
      <Sparkline values={item.spark} colour={tone.stroke} className="mt-[7px] h-[26px]" />
    </>
  )
  const className = cn(CARD, 'flex h-[118px] flex-col overflow-hidden pl-[13px] pr-[8px] pt-[16px] transition-colors')
  return item.href
    ? <Link href={item.href} aria-label={`${item.label}: ${item.value}`} className={cn(className, 'hover:border-[#cfd6e2] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500')}>{body}</Link>
    : <div className={className}>{body}</div>
}

/** Inline SVG sparkline with a soft gradient under the line. */
export function Sparkline({ values, colour, className }: { values?: number[]; colour: string; className?: string }) {
  // A 5-point rolling mean keeps sparse daily counts reading as a trend.
  const points = values && values.length > 1
    ? values.map((_, i) => { const s = values.slice(Math.max(0, i - 4), i + 1); return s.reduce((a, b) => a + b, 0) / s.length })
    : null
  if (!points) return <div className={className} aria-hidden />
  const w = 160
  const h = 26
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = w / (points.length - 1)
  const coords = points.map((v, i) => [i * step, h - 3 - ((v - min) / span) * (h - 7)] as const)
  // Catmull-Rom to Bezier so the line has the reference's soft curve.
  let d = `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)}`
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[i + 2] ?? p2
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  const id = `spark-${colour.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('w-full', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.22" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={colour} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Panels ──────────────────────────────────────────────────────────────────

export function Panel({
  title, suffix, action, href, hrefLabel = 'View all', children, className, bodyClassName, id, titleClassName,
}: {
  title: string
  titleClassName?: string
  suffix?: ReactNode
  action?: ReactNode
  href?: string | null
  hrefLabel?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section className={cn(CARD, 'flex min-w-0 flex-col', className)} aria-labelledby={id}>
      <header className="flex min-h-[42px] items-center gap-2 px-[14px] pt-[13px]">
        <h2 id={id} className={cn('min-w-0 truncate font-semibold leading-4 text-[#0b1220]', titleClassName ?? 'text-[13px]')}>{title}</h2>
        {suffix}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {action}
          {href && (
            <Link href={href} className="text-[10.5px] font-medium text-[#1d6bf3] hover:text-[#165ad6] hover:underline">{hrefLabel}</Link>
          )}
        </div>
      </header>
      <div className={cn('min-h-0 flex-1 px-[14px] pb-[14px] pt-2', bodyClassName)}>{children}</div>
    </section>
  )
}

export function PanelEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('flex min-h-[80px] items-center justify-center px-4 py-6 text-center text-[12px] text-slate-400', className)}>{children}</p>
}

// ── Identity ────────────────────────────────────────────────────────────────

export function Avatar({ name, src, size = 28, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const label = name || 'Unknown'
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary creator hosts and signed storage URLs
      <img src={src} alt="" width={size} height={size} loading="lazy"
        className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
    )
  }
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-[#e8edf5] font-semibold text-[#475467]', className)}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.38)) }}>
      {initials(label)}
    </span>
  )
}

export function Person({
  name, handle, src, size = 28, href, sub, className,
}: { name: string; handle?: string | null; src?: string | null; size?: number; href?: string; sub?: ReactNode; className?: string }) {
  const body = (
    <span className={cn('flex min-w-0 items-center gap-[9px]', className)}>
      <Avatar name={name} src={src} size={size} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[11.5px] font-medium text-[#101828]">{name}</span>
        {(sub ?? handle) && (
          <span className="mt-px block truncate text-[10px] text-[#8a94a6]">{sub ?? `@${String(handle).replace(/^@/, '')}`}</span>
        )}
      </span>
    </span>
  )
  return href
    ? <Link href={href} className="min-w-0 rounded-md hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{body}</Link>
    : body
}

/** Private media preview. `src` is always a signed URL or a public demo path. */
export function Thumb({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return <span role="img" aria-label={`${alt} (no preview)`} className={cn('block bg-gradient-to-br from-slate-100 to-slate-200', className)} />
  }
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs cannot go through the image optimiser cache
  return <img src={src} alt={alt} loading="lazy" className={cn('block object-cover', className)} />
}

// ── Badges ──────────────────────────────────────────────────────────────────

/** Soft rounded status pill (text + tint, never colour alone). */
export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[19px] items-center whitespace-nowrap rounded-[5px] px-[7px] text-[9.5px] font-medium ring-1 ring-inset', TONE[tone].soft, className)}>
      {children}
    </span>
  )
}

/** Dot + label, used in legends and compact status cells. */
export function DotLabel({ tone, colour, children, className }: { tone?: Tone; colour?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[6px] whitespace-nowrap', className)}>
      <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', tone && TONE[tone].dot)} style={colour ? { backgroundColor: colour } : undefined} aria-hidden />
      {children}
    </span>
  )
}

/** Overlay chip on media thumbnails ("Waiting Review", "Approved"...). */
export function MediaChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  const tints: Record<Tone, string> = {
    amber: 'bg-[#fff4e0] text-[#b45309]', blue: 'bg-[#e8f0ff] text-[#1d4ed8]', violet: 'bg-[#efe9ff] text-[#6d28d9]',
    green: 'bg-[#e6f8ee] text-[#15803d]', red: 'bg-[#ffe6e6] text-[#dc2626]', slate: 'bg-white/90 text-slate-600',
    sky: 'bg-[#e6f5fd] text-[#0369a1]', orange: 'bg-[#fff0e5] text-[#c2410c]',
  }
  return <span className={cn('inline-flex h-[18px] items-center rounded-[5px] px-[7px] text-[9.5px] font-medium shadow-sm', tints[tone])}>{children}</span>
}

// ── Charts (server-rendered SVG) ────────────────────────────────────────────

export interface Slice { key: string; label: string; value: number; colour: string; href?: string }

/** Thick-ring donut with a centred total, matching the reference donuts. */
export function Donut({
  slices, total, caption, size = 130, thickness = 20, gap = 1.2, className, valueLabel,
}: { slices: Slice[]; total: number; caption: string; size?: number; thickness?: number; gap?: number; className?: string; valueLabel?: string }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const sum = slices.reduce((a, s) => a + s.value, 0)
  let offset = 0
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}
      role="img" aria-label={`${caption}: ${slices.map(s => `${s.label} ${s.value}`).join(', ')}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f6" strokeWidth={thickness} />
        {sum > 0 && slices.filter(s => s.value > 0).map(s => {
          const length = (s.value / sum) * c
          const dash = Math.max(0, length - (slices.length > 1 ? gap : 0))
          const el = (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.colour} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
          )
          offset += length
          return el
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold leading-none text-[#0b1220]" style={{ fontSize: size < 100 ? 13 : size < 120 ? 16 : 19 }}>{valueLabel ?? new Intl.NumberFormat('en-GB').format(total)}</span>
        <span className="mt-[4px] text-[#667085]" style={{ fontSize: size < 100 ? 8 : 9.5 }}>{caption}</span>
      </div>
    </div>
  )
}

export function Legend({
  slices, total, className, format, showPercent = true,
}: { slices: Slice[]; total: number; className?: string; format?: (v: number) => string; showPercent?: boolean }) {
  const fmt = format ?? ((v: number) => new Intl.NumberFormat('en-GB').format(v))
  return (
    <ul className={cn('min-w-0 space-y-[10px]', className)}>
      {slices.map(s => {
        const row = (
          <>
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: s.colour }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[#344054]">{s.label}</span>
            <span className="shrink-0 text-right tabular-nums text-[#344054]">
              {fmt(s.value)}{showPercent && <span className="text-[#667085]"> ({total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0'}%)</span>}
            </span>
          </>
        )
        return (
          <li key={s.key} className="text-[10.5px]">
            {s.href
              ? <Link href={s.href} className="flex items-center gap-[9px] rounded hover:bg-slate-50">{row}</Link>
              : <span className="flex items-center gap-[9px]">{row}</span>}
          </li>
        )
      })}
    </ul>
  )
}

export type LineSeries = AreaSeries

/** Trend chart used by every Creators & UGC panel (responsive, client-rendered). */
export function LineChart({
  data, series, height = 120, money, currency, className, legend = true, smooth = 5,
}: {
  data: Record<string, string | number>[]
  series: LineSeries[]
  height?: number
  money?: boolean
  currency?: string
  className?: string
  legend?: boolean
  smooth?: number
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <AreaTrend data={data} series={series} height={height} yMode={money ? 'money' : 'compact'} currency={currency} legend={legend} smooth={smooth} />
    </div>
  )
}
/** Tiny reach trend used inside table rows. */
export function MiniTrend({ values, colour = '#3b82f6' }: { values: number[]; colour?: string }) {
  if (values.length < 2 || values.every(v => v === 0)) return <span className="inline-block h-4 w-[38px]" aria-hidden />
  const max = Math.max(...values) || 1
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 38).toFixed(1)},${(14 - (v / max) * 12).toFixed(1)}`).join(' ')
  return (
    <svg width="38" height="16" viewBox="0 0 38 16" aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke={colour} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function Bar({ value, colour = '#2f6fed', className, label }: { value: number; colour?: string; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <span className={cn('block h-[5px] overflow-hidden rounded-full bg-[#edf0f5]', className)} role="progressbar"
      aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? `${Math.round(pct)}%`}>
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
    </span>
  )
}

// ── Tables ──────────────────────────────────────────────────────────────────

export const TH = 'whitespace-nowrap px-3 py-[10px] text-left text-[10px] font-medium text-[#475467]'
export const TD = 'whitespace-nowrap px-3 text-[11px] text-[#344054]'
