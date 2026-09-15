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
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-blue-600 hover:text-blue-700">
      {children}
    </Link>
  )
}

/** KPI tile matching the reference stat strip. */
export function StatTile({
  icon, label, value, delta, tone = 'blue', hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: { value: string; up: boolean }
  tone?: 'blue' | 'violet' | 'amber' | 'emerald' | 'red' | 'slate'
  hint?: string
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>{icon}</span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
          {delta && (
            <span className={cn('text-[11px] font-semibold', delta.up ? 'text-emerald-600' : 'text-red-600')}>
              {delta.up ? '↑' : '↓'} {delta.value}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{label}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

export function Rating({ value, count, className }: { value: number; count?: number | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-slate-600', className)}>
      <Star size={12} className="fill-amber-400 text-amber-400" />
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
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <MapPin size={11} />{location}
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
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>
}

export function StatusPill({ label, cls, dot }: { label: string; cls: string; dot?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', cls)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
    </span>
  )
}

/** Three-up metric row used inside supplier cards (response / on-time / projects). */
export function MetricRow({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100">
      {items.map(item => (
        <div key={item.label} className="px-2 py-2 text-center">
          <p className="text-xs font-semibold text-slate-900">{item.value}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{item.label}</p>
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
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(item => (
        <div key={item.title} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{item.icon}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="truncate text-xs text-slate-500">{item.note}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
