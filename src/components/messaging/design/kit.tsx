import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, ChevronRight, Mail, MessageSquareText, Smartphone } from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import type { MessagingChannel } from '@/lib/messaging/constants'
import type { PersonLite } from '@/lib/messaging/types'
import { DASH, fmtDelta } from '@/lib/messaging/metrics'

// Shared visual primitives for the eight Messaging pages, sized from the
// approved 1448x1086 designs. Dense desktop sizes sit behind `lg:` so tablet and
// phone keep legible type and touch targets.

/** Page gutter measured from the designs: 28px sides, 16px below the top bar. */
export const MESSAGING_DESIGN_PAGE = 'mx-auto w-full px-4 pb-8 pt-4 sm:px-6 lg:px-[28px] lg:pb-[24px] lg:pt-[14px]'

export const T = {
  title: 'text-[13px] font-semibold text-slate-900 lg:text-[10.5px]',
  label: 'text-[11.5px] text-slate-500 lg:text-[9px]',
  body: 'text-[12px] text-slate-700 lg:text-[9.5px]',
  strong: 'text-[12px] font-medium text-slate-900 lg:text-[9.5px]',
  tiny: 'text-[11px] text-slate-400 lg:text-[8.5px]',
  head: 'text-[11px] font-normal text-slate-400 lg:text-[8.5px]',
}

export function Card({
  title, action, children, className, bodyClassName, as: Tag = 'section', titleClassName,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  titleClassName?: string
  as?: 'section' | 'div'
}) {
  return (
    <Tag className={cn('flex min-w-0 flex-col rounded-[10px] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]', className)}>
      {(title || action) && (
        <header className={cn('flex min-h-[20px] items-center justify-between gap-2 px-3 pt-2.5 lg:px-2.5 lg:pt-2', titleClassName)}>
          {title && <h2 className={T.title}>{title}</h2>}
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1 px-3 pb-3 lg:px-2.5 lg:pb-2.5', bodyClassName)}>{children}</div>
    </Tag>
  )
}

/** Centred "View all … →" footer link used under rail lists and panels. */
export function ViewLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('mx-auto flex w-fit items-center gap-1 rounded text-[12px] font-medium text-blue-600 hover:text-blue-700 hover:underline lg:text-[9px]', className)}>
      {children}
      <ArrowRight className="h-3 w-3 lg:h-2.5 lg:w-2.5" aria-hidden />
    </Link>
  )
}

export function CornerLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-[12px] font-medium text-blue-600 hover:underline lg:text-[8.5px]">{children}</Link>
}

const PILL_TONE = {
  green: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-500',
  outline: 'border border-slate-200 bg-white text-slate-500',
} as const
export type PillTone = keyof typeof PILL_TONE

export function Pill({ tone = 'slate', children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 max-w-full items-center truncate rounded px-1.5 text-[11px] font-medium lg:h-[15px] lg:text-[8px]', PILL_TONE[tone], className)}>
      {children}
    </span>
  )
}

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  sending: { label: 'Active', tone: 'green' },
  active: { label: 'Active', tone: 'green' },
  sent: { label: 'Completed', tone: 'green' },
  completed: { label: 'Completed', tone: 'blue' },
  paused: { label: 'Paused', tone: 'amber' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  draft: { label: 'Draft', tone: 'slate' },
  pending_approval: { label: 'In review', tone: 'violet' },
  in_review: { label: 'In review', tone: 'amber' },
  published: { label: 'Published', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  archived: { label: 'Archived', tone: 'slate' },
}

export function StatusPill({ status, completedTone }: { status: string; completedTone?: PillTone }) {
  const s = STATUS[status] ?? { label: status.replace(/_/g, ' '), tone: 'slate' as PillTone }
  const tone = status === 'sent' && completedTone ? completedTone : s.tone
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11px] font-medium lg:h-[16px] lg:text-[8px]', PILL_TONE[tone])}>
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  )
}

export function HealthPill({ health }: { health: string }) {
  const map: Record<string, [string, PillTone]> = { good: ['Good', 'green'], at_risk: ['At risk', 'amber'], critical: ['Critical', 'red'] }
  const [label, tone] = map[health] ?? [health, 'slate']
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-medium lg:h-[15px] lg:text-[8px]', PILL_TONE[tone])}>
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden />{label}
    </span>
  )
}

/** Provider-reported operational state; "Not connected" when no provider is configured. */
export function OperationalPill({ status }: { status: string }) {
  const map: Record<string, [string, PillTone]> = {
    connected: ['Operational', 'green'], operational: ['Operational', 'green'], healthy: ['Healthy', 'green'],
    degraded: ['Degraded', 'amber'], warning: ['Warning', 'amber'], error: ['Error', 'red'], not_connected: ['Not connected', 'slate'],
    verified: ['Verified', 'green'], connected_agent: ['Connected', 'green'],
  }
  const [label, tone] = map[status] ?? [status, 'slate']
  return <Pill tone={tone} className="lg:h-[14px] lg:text-[7.5px]">{label}</Pill>
}

// ── Channel glyphs ───────────────────────────────────────────────────────────

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z" />
      <path d="M9 8.6c.3 2.4 2.1 4.6 4.6 5.4l1.1-1.1 1.9.9c-.2 1.2-1.1 1.8-2.2 1.7-3.3-.4-6-3.2-6.3-6.4-.1-1.1.5-2 1.7-2.2l.9 1.9z" />
    </svg>
  )
}

export function RcsIcon({ className }: { className?: string }) {
  return <MessageSquareText className={className} aria-hidden />
}

export const CHANNEL_COLOR: Record<MessagingChannel, string> = {
  email: 'text-blue-600', sms: 'text-blue-500', whatsapp: 'text-emerald-600', rcs: 'text-violet-600', push: 'text-violet-500',
}
export const CHANNEL_TILE: Record<MessagingChannel, string> = {
  email: 'bg-blue-50 text-blue-600', sms: 'bg-blue-50 text-blue-600', whatsapp: 'bg-emerald-50 text-emerald-600',
  rcs: 'bg-violet-50 text-violet-600', push: 'bg-violet-50 text-violet-600',
}
export const CHANNEL_HEX: Record<MessagingChannel, string> = {
  email: '#2563eb', sms: '#22c55e', whatsapp: '#34d399', rcs: '#a78bfa', push: '#8b5cf6',
}

export function ChannelIcon({ channel, className }: { channel: MessagingChannel; className?: string }) {
  const cls = cn('h-4 w-4 lg:h-3 lg:w-3', className)
  switch (channel) {
    case 'email': return <Mail className={cls} aria-hidden />
    case 'sms': return <Smartphone className={cls} aria-hidden />
    case 'whatsapp': return <WhatsAppIcon className={cls} />
    case 'rcs': return <RcsIcon className={cls} />
    default: return <Bell className={cls} aria-hidden />
  }
}

export function IconTile({ children, className, size = 'md' }: { children: ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-10 w-10 lg:h-[34px] lg:w-[34px] rounded-lg' : size === 'md' ? 'h-7 w-7 lg:h-[18px] lg:w-[18px] rounded-md' : 'h-6 w-6 lg:h-[15px] lg:w-[15px] rounded'
  return <span className={cn('flex shrink-0 items-center justify-center', dim, className)} aria-hidden>{children}</span>
}

// ── People ───────────────────────────────────────────────────────────────────

export function Avatar({ person, size = 16, className }: { person?: PersonLite | null; size?: number; className?: string }) {
  const name = person?.full_name ?? person?.email ?? 'Unassigned'
  if (person?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatar_url} alt="" width={size} height={size} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600', className)} style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.42)) }} aria-hidden>
      {initials(name)}
    </span>
  )
}

export function OwnerCell({ person }: { person?: PersonLite | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar person={person} size={20} className="lg:!h-[16px] lg:!w-[16px]" />
      <span className="truncate text-[12px] text-slate-600 lg:text-[8.5px]">{person?.full_name ?? person?.email ?? 'Unassigned'}</span>
    </span>
  )
}

// ── Deltas ───────────────────────────────────────────────────────────────────

export function Delta({
  value, unit, inverse, className, suffix,
}: { value: number | null; unit: 'pp' | '%' | 'count'; inverse?: boolean; className?: string; suffix?: ReactNode }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn('text-[11px] text-slate-300 lg:text-[8px]', className)} title="No comparison data for the previous period">{DASH}</span>
  }
  const up = value > 0, down = value < 0
  const good = inverse ? down : up
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium lg:text-[8px]', good ? 'text-emerald-600' : down || up ? 'text-red-500' : 'text-slate-400', className)}>
      <span aria-hidden>{up ? '↑' : down ? '↓' : ''}</span>
      <span className="sr-only">{up ? 'Up' : down ? 'Down' : 'No change'}</span>
      {fmtDelta(value, unit)}
      {suffix}
    </span>
  )
}

/** A value with its change below it, as in the programme tables. */
export function RateCell({ value, delta, inverse }: { value: string; delta: number | null; inverse?: boolean }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[12px] text-slate-800 lg:text-[9.5px]">{value}</span>
      <Delta value={delta} unit="pp" inverse={inverse} />
    </span>
  )
}

// ── Rail rows ────────────────────────────────────────────────────────────────

export interface NextAction {
  id: string
  label: string
  sub: string
  count?: number | null
  href: string
  icon: ReactNode
  tone: string
  countTone?: string
}

export function NextActionList({ items, emptyLabel = 'Nothing needs your attention right now.' }: { items: NextAction[]; emptyLabel?: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-[12px] text-slate-400 lg:text-[9px]">{emptyLabel}</p>
  return (
    <ul className="space-y-0.5">
      {items.map(item => (
        <li key={item.id}>
          <Link href={item.href} className="flex items-center gap-2.5 rounded-md py-1.5 hover:bg-slate-50 lg:gap-2 lg:py-[5px]">
            <IconTile size="md" className={cn('rounded-md lg:h-[20px] lg:w-[20px]', item.tone)}>{item.icon}</IconTile>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-medium text-slate-800 lg:text-[8.5px]">{item.label}</span>
              <span className="block truncate text-[11px] text-slate-400 lg:text-[7.5px]">{item.sub}</span>
            </span>
            {item.count !== undefined && item.count !== null && (
              <span className={cn('flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold lg:h-[14px] lg:min-w-[14px] lg:text-[8px]', item.countTone ?? 'bg-blue-50 text-blue-600')}>{item.count}</span>
            )}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 lg:h-2.5 lg:w-2.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0', className)}>{children}</div>
}

/** Label/value row used in audience and summary panels. */
export function FieldRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[26px] items-center gap-2 lg:min-h-[22px]', className)}>
      <span className="w-20 shrink-0 text-[11.5px] text-slate-500 lg:w-[48px] lg:text-[8.5px]">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}
