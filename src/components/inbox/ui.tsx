import Link from 'next/link'
import { ChevronLeft, ChevronRight, Globe, Mail, MessageCircle, MessageSquare, MessagesSquare, Smartphone, type LucideIcon } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { cn } from '@/lib/utils'
import { CHANNEL_LABEL, initials } from '@/lib/inbox/format'

// Shared Inbox primitives. Dense sizes apply from `lg:` so tablet and phone keep
// legible type and 40px+ touch targets.

export function Avatar({ name, src, size = 32, className, ring }: { name: string | null | undefined; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  const style = { width: size, height: size }
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} style={style} className={cn('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-white', className)} />
    )
  }
  return (
    <span aria-hidden style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700', ring && 'ring-2 ring-white', className)}>
      {initials(name)}
    </span>
  )
}

const LUCIDE_CHANNEL: Record<string, { icon: LucideIcon; tone: string }> = {
  email: { icon: Mail, tone: 'text-[#1769ff]' },
  sms: { icon: Smartphone, tone: 'text-[#1769ff]' },
  rcs: { icon: MessageSquare, tone: 'text-[#1769ff]' },
  live_chat: { icon: MessagesSquare, tone: 'text-[#1769ff]' },
  push: { icon: MessageCircle, tone: 'text-[#1769ff]' },
}

/** Channel glyph: real brand logos for social platforms, lucide icons for owned channels. */
export function ChannelGlyph({ channel, size = 16, className }: { channel: string; size?: number; className?: string }) {
  const lucide = LUCIDE_CHANNEL[channel]
  const label = CHANNEL_LABEL[channel] ?? channel
  if (lucide) {
    const Icon = lucide.icon
    return <Icon aria-label={label} role="img" style={{ width: size, height: size }} strokeWidth={1.9} className={cn('shrink-0', lucide.tone, className)} />
  }
  if (['whatsapp', 'instagram', 'facebook', 'x', 'tiktok', 'youtube', 'linkedin', 'messenger'].includes(channel)) {
    return <span role="img" aria-label={label} className={cn('inline-flex shrink-0', className)}><BrandLogo brand={channel} size={size} decorative /></span>
  }
  return <Globe aria-label={label} role="img" style={{ width: size, height: size }} className={cn('shrink-0 text-slate-400', className)} />
}

/** Channel glyph in the soft rounded tile used by list rows. */
export function ChannelTile({ channel, className }: { channel: string; className?: string }) {
  const owned = Boolean(LUCIDE_CHANNEL[channel])
  return (
    <span className={cn('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md', owned && 'bg-blue-50', className)}>
      <ChannelGlyph channel={channel} size={owned ? 13 : 18} />
    </span>
  )
}

export type PillTone = 'purple' | 'green' | 'orange' | 'red' | 'blue' | 'slate' | 'amber' | 'teal' | 'pink'
const PILL: Record<PillTone, string> = {
  purple: 'bg-violet-50 text-violet-600',
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-rose-50 text-rose-600',
  blue: 'bg-blue-50 text-blue-600',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-600',
  teal: 'bg-teal-50 text-teal-600',
  pink: 'bg-pink-50 text-pink-600',
}

export function Pill({ tone = 'slate', children, className, bordered }: { tone?: PillTone; children: React.ReactNode; className?: string; bordered?: boolean }) {
  return (
    <span className={cn('inline-flex h-[18px] items-center whitespace-nowrap rounded-[5px] px-1.5 text-[10px] font-medium leading-none lg:text-[9.5px]', PILL[tone], bordered && 'border border-current/20', className)}>
      {children}
    </span>
  )
}

const TAG_TONES: PillTone[] = ['red', 'blue', 'green', 'purple', 'amber', 'teal', 'pink', 'orange']
export function tagTone(tag: string): PillTone {
  let h = 0
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TAG_TONES[h % TAG_TONES.length]
}

export function Panel({ children, className, as: As = 'section', ...rest }: { children: React.ReactNode; className?: string; as?: 'section' | 'div' | 'aside' } & React.HTMLAttributes<HTMLElement>) {
  return <As className={cn('rounded-xl border border-[#e6ebf2] bg-white', className)} {...rest}>{children}</As>
}

export function KpiTile({ label, value, icon, tone, delta, deltaText, footnote, href }: {
  label: string
  value: string
  icon: React.ReactNode
  tone: 'purple' | 'orange' | 'red' | 'blue' | 'green' | 'teal'
  /** Positive = good. */
  delta?: { direction: 'up' | 'down'; good: boolean; text: string } | null
  deltaText?: string
  footnote?: string
  href?: string
}) {
  const tones = {
    purple: 'bg-violet-50 text-violet-600', orange: 'bg-orange-50 text-orange-500', red: 'bg-rose-50 text-rose-500',
    blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', teal: 'bg-teal-50 text-teal-600',
  }
  const body = (
    <div className="flex h-full min-h-[84px] items-center gap-3 rounded-xl border border-[#e6ebf2] bg-white px-3.5 py-3 transition-colors hover:border-slate-300 lg:gap-[18px] lg:px-[13px]">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]', tones[tone])} aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-slate-600 lg:text-[10.5px]">{label}</p>
        <p className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-slate-900 lg:text-[19px]">{value}</p>
        {delta ? (
          <p className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-500 lg:text-[9px]">
            <span aria-hidden className={cn('font-semibold', delta.good ? 'text-emerald-600' : 'text-rose-500')}>{delta.direction === 'up' ? '↑' : '↓'}</span>
            <span className={cn('font-medium', delta.good ? 'text-emerald-600' : 'text-rose-500')}>{delta.text}</span>
            <span>{deltaText ?? 'vs yesterday'}</span>
          </p>
        ) : footnote ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500 lg:text-[9px]">{footnote}</p>
        ) : null}
      </div>
    </div>
  )
  return href ? <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{body}</Link> : body
}

export function PageHeader({ title, subtitle, breadcrumb, titleAddon, actions }: {
  title: string; subtitle: string; breadcrumb?: { label: string; href?: string }[]; titleAddon?: React.ReactNode; actions?: React.ReactNode
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {breadcrumb ? (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-2 text-[11px] text-slate-500 lg:text-[9.5px]">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-2">
                {i > 0 ? <ChevronRight size={11} aria-hidden /> : null}
                {crumb.href ? <Link href={crumb.href} className="hover:text-slate-800">{crumb.label}</Link> : <span className="text-slate-700" aria-current="page">{crumb.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex items-center gap-2.5">
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 lg:text-[22px]">{title}</h1>
          {titleAddon}
        </div>
        <p className="mt-1 text-[13px] text-slate-500 lg:text-[10.5px]">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Pagination({ page, pageSize, total, hrefFor, label = 'conversations', compact, stacked }: {
  page: number; pageSize: number; total: number; hrefFor: (page: number) => string; label?: string; compact?: boolean; stacked?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)
  const window = pages <= 6 ? Array.from({ length: pages }, (_, i) => i + 1)
    : page <= 4 ? [1, 2, 3, 4, 5, -1, pages]
    : page >= pages - 3 ? [1, -1, pages - 4, pages - 3, pages - 2, pages - 1, pages]
    : [1, -1, page - 1, page, page + 1, -1, pages]
  const btn = 'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-medium lg:h-[22px] lg:min-w-[22px] lg:text-[10px]'
  return (
    <div className={cn('flex flex-col gap-2', stacked ? 'items-stretch' : 'items-center', compact || stacked ? '' : 'sm:flex-row sm:justify-between')}>
      {!compact ? <p className="text-[11px] text-slate-500 lg:text-[9.5px]">Showing {from} to {to} of {total.toLocaleString('en-GB')} {label}</p> : null}
      <nav aria-label="Pagination" className={cn('flex items-center gap-1.5', stacked && 'justify-center pt-1')}>
        {page > 1 ? <Link href={hrefFor(page - 1)} aria-label="Previous page" className={cn(btn, 'text-slate-500 hover:bg-slate-100')}><ChevronLeft size={13} /></Link>
          : <span aria-hidden className={cn(btn, 'text-slate-300')}><ChevronLeft size={13} /></span>}
        {window.map((p, i) => p === -1
          ? <span key={`gap-${i}`} className={cn(btn, 'text-slate-400')}>…</span>
          : <Link key={p} href={hrefFor(p)} aria-current={p === page ? 'page' : undefined}
              className={cn(btn, p === page ? 'bg-[#1769ff] text-white' : 'text-slate-600 hover:bg-slate-100')}>{p}</Link>)}
        {page < pages ? <Link href={hrefFor(page + 1)} aria-label="Next page" className={cn(btn, 'border border-slate-200 text-slate-500 hover:bg-slate-100')}><ChevronRight size={13} /></Link>
          : <span aria-hidden className={cn(btn, 'border border-slate-100 text-slate-300')}><ChevronRight size={13} /></span>}
      </nav>
      {compact ? <p className="text-[11px] text-slate-500 lg:text-[9.5px]">{from}–{to} of {total}</p> : null}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={20} aria-hidden /></span>
      <p className="text-[13px] font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-xs text-[12px] text-slate-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Progress({ value, tone = 'green' }: { value: number; tone?: 'green' | 'orange' | 'red' | 'blue' }) {
  const color = { green: 'bg-emerald-500', orange: 'bg-orange-400', red: 'bg-rose-500', blue: 'bg-blue-600' }[tone]
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export const btnPrimary = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1769ff] px-3.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5ce5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 lg:h-[33px] lg:text-[11px]'
export const btnSecondary = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#e1e6ee] bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 lg:h-[33px] lg:text-[11px]'
export const iconBtn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e1e6ee] bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 lg:h-[29px] lg:w-[29px]'
