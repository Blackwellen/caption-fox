import Link from 'next/link'
import { Star, BadgeCheck, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { coverGradient, type MarketplaceProfile } from '@/lib/marketplace/module'

/** Standard white surface used by every Marketplace panel. */
export function Panel({
  title, subtitle, action, children, className, bodyClassName, padded = true,
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  padded?: boolean
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5 lg:px-4 lg:py-[7px]">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900 lg:text-[11.5px]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 lg:text-[9.5px] lg:leading-tight">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-5 lg:p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-blue-600 hover:text-blue-700 lg:text-[10px]">
      {children}
    </Link>
  )
}

/**
 * The KPI strip. The approved references draw a single 77px-tall card split by
 * hairline dividers rather than six detached boxes, so the strip owns the
 * surface and each StatTile renders as a cell inside it.
 */
export function KpiStrip({ children, className, columns = 6 }: { children: React.ReactNode; className?: string; columns?: 5 | 6 }) {
  return (
    <section
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:divide-y-0',
        columns === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-6',
        className,
      )}
      aria-label="Summary"
    >
      {children}
    </section>
  )
}

/** KPI tile matching the reference stat strip. */
export function StatTile({
  icon, label, value, delta, tone = 'blue', hint, cell = false, iconRight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: { value: string; up: boolean }
  tone?: 'blue' | 'violet' | 'amber' | 'emerald' | 'red' | 'slate'
  hint?: string
  /** Render as a cell of <KpiStrip> instead of a standalone card. */
  cell?: boolean
  /** Label above the value with the icon tile on the right (Saved reference). */
  iconRight?: boolean
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  if (iconRight) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:px-3 lg:py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-500 lg:text-[9px] lg:leading-none">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 lg:mt-1.5 lg:text-[17px] lg:leading-none">{value}</p>
          {hint && <p className="mt-1 truncate text-[11px] text-slate-400 lg:text-[8.5px]">{hint}</p>}
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-8 lg:w-8 [&>svg]:lg:h-[15px] [&>svg]:lg:w-[15px]', tones[tone])}>
          {icon}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 lg:gap-2.5 lg:px-3.5',
        cell ? 'lg:h-[77px] lg:py-0' : 'rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:py-3',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-7 lg:w-7 [&>svg]:lg:h-[15px] [&>svg]:lg:w-[15px]', tones[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 lg:gap-1.5">
          <p className="truncate text-xl font-bold tracking-tight text-slate-900 lg:text-[17px] lg:leading-none">{value}</p>
          {delta && (
            <span className={cn('text-[11px] font-semibold lg:text-[9px]', delta.up ? 'text-emerald-600' : 'text-red-600')}>
              {delta.up ? '↑' : '↓'} {delta.value}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 lg:mt-1 lg:text-[9px] lg:leading-none">{label}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 lg:text-[9px]">{hint}</p>}
      </div>
    </div>
  )
}

export function Rating({ value, count, className }: { value: number; count?: number | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-slate-600 lg:text-[10px]', className)}>
      <Star size={12} className="fill-amber-400 text-amber-400 lg:h-[11px] lg:w-[11px]" />
      <span className="font-semibold text-slate-800">{Number(value ?? 0).toFixed(1)}</span>
      {count !== undefined && count !== null && <span className="text-slate-400">({count})</span>}
    </span>
  )
}

export function VerifiedMark({ verified }: { verified: boolean }) {
  if (!verified) return null
  return <BadgeCheck size={14} className="shrink-0 text-blue-600" aria-label="Verified supplier" />
}

export function LocationLine({ location }: { location: string | null }) {
  if (!location) return null
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-500 lg:text-[10px]">
      <MapPin size={11} className="shrink-0 lg:h-2.5 lg:w-2.5" /><span className="truncate">{location}</span>
    </span>
  )
}

export function Chip({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'violet' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium lg:text-[9px]', tones[tone])}>{children}</span>
}

export function StatusPill({ label, cls, dot }: { label: string; cls: string; dot?: string }) {
  return (
    <span title={label} className={cn('inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium lg:gap-1 lg:px-1.5 lg:text-[9px]', cls)}>
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />}
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Three-up metric row used inside supplier cards (response / on-time / projects). */
export function MetricRow({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100">
      {items.map(item => (
        <div key={item.label} className="px-2 py-2 text-center lg:px-1 lg:py-1.5">
          <p className="text-xs font-semibold text-slate-900 lg:text-[10.5px] lg:leading-none">{item.value}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-400 lg:mt-1 lg:text-[7.5px] lg:leading-[1.15]">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

/** Profile cover: real image when present, deterministic brand gradient otherwise. */
export function ProfileCover({
  profile, className, children,
}: {
  profile: Pick<MarketplaceProfile, 'slug' | 'display_name' | 'cover_url'>
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn('relative overflow-hidden bg-slate-100', className)}
      style={profile.cover_url
        ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { backgroundImage: coverGradient(profile.slug) }}
      role="img"
      aria-label={`${profile.display_name} cover image`}
    >
      {children}
    </div>
  )
}

export function ProfileAvatar({
  profile, size = 44,
}: {
  profile: Pick<MarketplaceProfile, 'slug' | 'display_name' | 'avatar_url'>
  size?: number
}) {
  const initials = profile.display_name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url} alt={profile.display_name}
        width={size} height={size}
        className="shrink-0 rounded-full object-cover ring-2 ring-white"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white"
      style={{ width: size, height: size, backgroundImage: coverGradient(profile.slug), fontSize: Math.max(10, size / 3.2) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

/** Trust strip shown at the foot of the discovery surfaces. */
export function TrustStrip({ items }: { items: { icon: React.ReactNode; title: string; note: string }[] }) {
  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3 lg:px-4 lg:py-2.5">
      {items.map(item => (
        <div key={item.title} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 lg:h-7 lg:w-7 [&>svg]:lg:h-3.5 [&>svg]:lg:w-3.5">{item.icon}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 lg:text-[10.5px]">{item.title}</p>
            <p className="truncate text-xs text-slate-500 lg:text-[9px]">{item.note}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
