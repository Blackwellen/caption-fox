import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { PersonLite } from '@/lib/strategy/types'

// ── Layout tokens ────────────────────────────────────────────────────────────
// One definition for every Strategy surface so the header, KPI strip, filter
// bar and content grid share the same width, gutter, radius and elevation.
// Dense desktop sizing (the approved designs) applies from `lg`; tablet and
// phone keep legible type and 40px+ touch targets.

export const CARD = 'rounded-xl border border-sg-line bg-white shadow-sg-card'
export const GRID_GAP = 'gap-3 lg:gap-4'

// ── Pills / badges ───────────────────────────────────────────────────────────

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate' | 'orange' | 'teal'

export const TONE_PILL: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-sg-blue-soft text-sg-blue',
  violet: 'bg-violet-50 text-violet-600',
  teal: 'bg-teal-50 text-teal-700',
  slate: 'bg-slate-100 text-slate-500',
}

export const TONE_DOT: Record<Tone, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-400', orange: 'bg-orange-500', red: 'bg-red-500',
  blue: 'bg-sg-blue', violet: 'bg-violet-500', teal: 'bg-teal-500', slate: 'bg-slate-300',
}

export const TONE_HEX: Record<Tone, string> = {
  green: '#22c55e', amber: '#f59e0b', orange: '#f97316', red: '#ef4444',
  blue: '#3f6ff8', violet: '#8b5cf6', teal: '#14b8a6', slate: '#cbd5e1',
}

export function Pill({
  tone = 'slate', children, className, dot,
}: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn(
      'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-medium leading-none lg:h-[18px] lg:text-[9.5px]',
      TONE_PILL[tone], className,
    )}>
      {dot && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />}
      {children}
    </span>
  )
}

/** Status shown as a coloured dot + text (colour is never the only signal). */
export function DotLabel({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-sg-body lg:text-[10px]', className)}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
      {children}
    </span>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function Panel({
  title, info, subtitle, action, children, className, headerClassName, bodyClassName, footer, footerClassName, as: Tag = 'section', id,
}: {
  title?: React.ReactNode
  info?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerClassName?: string
  bodyClassName?: string
  footer?: React.ReactNode
  footerClassName?: string
  as?: 'section' | 'div'
  id?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <Tag className={cn(CARD, 'flex min-w-0 flex-col', className)} aria-labelledby={headingId} id={id}>
      {(title || action) && (
        <header className={cn('flex items-start gap-2 px-4 pt-3.5 lg:px-3.5 lg:pt-3', headerClassName)}>
          {title && (
            <div className="min-w-0">
              <h2 id={headingId} className="flex items-center gap-1 text-[14px] font-semibold text-sg-ink lg:text-[12px]">
                {title}
                {info && <InfoTip text={info} />}
              </h2>
              {subtitle && <p className="mt-0.5 text-[12px] text-sg-muted lg:text-[9.5px]">{subtitle}</p>}
            </div>
          )}
          {action && <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('flex-1 px-4 pb-4 pt-2.5 lg:px-3.5 lg:pb-3 lg:pt-2', bodyClassName)}>{children}</div>
      {footer && <div className={cn('px-4 pb-3 lg:px-3.5 lg:pb-2.5', footerClassName)}>{footer}</div>}
    </Tag>
  )
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex" tabIndex={0} aria-label={text} role="note">
      <Info aria-hidden className="h-3.5 w-3.5 text-slate-400 lg:h-3 lg:w-3" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-5 z-30 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-sg-pop group-hover:block group-focus:block"
      >
        {text}
      </span>
    </span>
  )
}

/** Centred "View all … →" footer link. */
export function FooterLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'mx-auto flex min-h-9 w-fit items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-sg-blue hover:text-sg-blue-hover focus-visible:outline-2 focus-visible:outline-sg-blue lg:min-h-0 lg:text-[10.5px]',
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
    </Link>
  )
}

/** Right-aligned header link, e.g. "View all activity →". */
export function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-8 items-center gap-1 text-[12px] font-medium text-sg-blue hover:text-sg-blue-hover lg:min-h-0 lg:text-[10px]">
      {children}
      <ArrowRight aria-hidden className="h-3 w-3" />
    </Link>
  )
}

// ── People ───────────────────────────────────────────────────────────────────

/** Only http(s) and same-origin URLs render as images; storage refs fall back to initials. */
function renderableAvatar(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('/') ? url : null
}

export function Avatar({
  person, name, src, size = 22, className, ring,
}: { person?: PersonLite | null; name?: string; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  const label = name ?? person?.full_name ?? person?.email ?? 'Unassigned'
  const url = renderableAvatar(src ?? person?.avatar_url)
  const style = { width: size, height: size }
  if (url) {
    return (
      // Avatars come from several storage hosts; a plain img avoids a remote-pattern per host.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={label} width={size} height={size} loading="lazy"
        className={cn('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-white', className)} style={style} />
    )
  }
  return (
    <span
      role="img" aria-label={label}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600', ring && 'ring-2 ring-white', className)}
      style={{ ...style, fontSize: Math.max(8, Math.round(size * 0.4)) }}
    >
      {initials(label)}
    </span>
  )
}

export function OwnerChip({ person, size = 20, className }: { person?: PersonLite | null; size?: number; className?: string }) {
  const full = person?.full_name ?? person?.email ?? 'Unassigned'
  const parts = full.trim().split(/\s+/)
  const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : full
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)} title={full}>
      <Avatar person={person} size={size} />
      <span className="truncate text-[12px] text-sg-body lg:text-[10px]">{short}</span>
    </span>
  )
}

export function AvatarStack({
  people, max = 2, size = 18, label, total,
}: {
  people: { id: string; name: string; avatar_url?: string | null }[]
  max?: number
  size?: number
  label?: string
  /** Real count when `people` is a preview subset. */
  total?: number
}) {
  const count = total ?? people.length
  if (count === 0) return <span className="text-[12px] text-sg-subtle lg:text-[10px]">None</span>
  const shown = people.slice(0, max)
  const extra = count - shown.length
  return (
    <span className="inline-flex items-center" aria-label={label ?? `${count} linked`} role="img">
      {shown.map((person, index) => (
        <span key={person.id} className={cn(index > 0 && '-ml-1.5')}>
          <Avatar name={person.name} src={person.avatar_url} size={size} ring />
        </span>
      ))}
      {extra > 0 && <span aria-hidden className="ml-1 text-[11px] font-medium text-sg-muted lg:text-[9.5px]">+{extra}</span>}
    </span>
  )
}

// ── Progress & scores ────────────────────────────────────────────────────────

const PROGRESS_TONE: Record<string, string> = {
  on_track: 'bg-emerald-500', completed: 'bg-emerald-500', approved: 'bg-emerald-500',
  at_risk: 'bg-amber-500', off_track: 'bg-red-500', blocked: 'bg-red-500',
  not_started: 'bg-slate-300', draft: 'bg-slate-300', blue: 'bg-sg-blue',
}

export function ProgressBar({
  value, status = 'on_track', className, label, trackClassName,
}: { value: number; status?: string; className?: string; label?: string; trackClassName?: string }) {
  const pctValue = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100 lg:h-[5px]', trackClassName, className)}
      role="progressbar" aria-valuenow={pctValue} aria-valuemin={0} aria-valuemax={100}
      aria-label={label ?? `${pctValue}% complete`}
    >
      <div className={cn('h-full rounded-full', PROGRESS_TONE[status] ?? 'bg-sg-blue')} style={{ width: `${pctValue}%` }} />
    </div>
  )
}

/** Circular score ring — SVG, with the value exposed to assistive tech. */
export function ScoreRing({
  value, size = 46, stroke = 4, colour = '#22c55e', label, className, textClassName, track = '#eef2f6',
  children,
}: {
  value: number; size?: number; stroke?: number; colour?: string; label?: string
  className?: string; textClassName?: string; track?: string; children?: React.ReactNode
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}
      role="img" aria-label={label ?? `Score ${Math.round(clamped)} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colour} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference} />
      </svg>
      <span aria-hidden className={cn('absolute text-center font-semibold leading-none text-sg-ink', textClassName)}>
        {children ?? Math.round(clamped)}
      </span>
    </span>
  )
}

// ── Table helpers ────────────────────────────────────────────────────────────

export const TH = 'whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium text-sg-muted lg:px-2.5 lg:py-1.5 lg:text-[9.5px]'
export const TD = 'whitespace-nowrap px-3 py-2.5 text-[12.5px] text-sg-body lg:px-2.5 lg:py-[7px] lg:text-[10px]'

/** Horizontal scroller for dense tables; `relative` keeps sr-only captions contained. */
export function TableScroll({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={cn('relative -mx-4 overflow-x-auto px-4 lg:-mx-3.5 lg:px-3.5', className)} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  )
}

/** Horizontal labelled bar row (channel affinity, themes, engagement). */
export function BarRow({
  label, value, max, display, tone = 'bg-sg-blue', trailing, labelWidth = 'w-[34%]',
}: {
  label: string; value: number; max: number; display?: string; tone?: string
  trailing?: React.ReactNode; labelWidth?: string
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <li className="flex items-center gap-2.5 text-[12px] lg:gap-2 lg:text-[9.5px]">
      <span className={cn('shrink-0 truncate text-sg-body', labelWidth)}>{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 lg:h-[5px]" aria-hidden>
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${width}%` }} />
      </span>
      <span className="w-9 shrink-0 text-right tabular-nums text-sg-body">{display ?? value}</span>
      {trailing}
    </li>
  )
}
