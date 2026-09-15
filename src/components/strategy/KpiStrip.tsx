import {
  AlertTriangle, Archive, ArrowDownRight, ArrowUpRight, Award, BarChart3, Blocks,
  CalendarClock, CheckCircle2, Clock, Compass, DollarSign, FileText, Gauge, Globe,
  Layers, Link2, Sparkles, Star, Target, TrendingUp, Users, Users2, Shield, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { KpiValue } from '@/lib/strategy/types'

const ICONS = {
  sparkles: Sparkles, target: Target, users: Users, users2: Users2, flask: Compass,
  star: Star, trend: TrendingUp, alert: AlertTriangle, check: CheckCircle2,
  clock: Clock, calendar: CalendarClock, file: FileText, archive: Archive,
  gauge: Gauge, globe: Globe, link: Link2, layers: Layers, blocks: Blocks,
  money: DollarSign, wallet: Wallet, chart: BarChart3, award: Award, shield: Shield,
} as const
export type KpiIcon = keyof typeof ICONS

const TONES: Record<KpiValue['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-500',
}

const BAR_TONES: Record<KpiValue['tone'], string> = {
  blue: 'bg-blue-500', green: 'bg-emerald-500', amber: 'bg-amber-500',
  violet: 'bg-violet-500', red: 'bg-red-500', slate: 'bg-slate-400',
}

/**
 * The KPI row shared by every Strategy surface. Values are always calculated
 * from workspace-scoped data by the page; this component only formats them.
 * Cards are separate tiles (not a divided strip) to match the Strategy design.
 */
export default function KpiStrip({ items, className }: { items: KpiValue[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6', className)}>
      {items.map(item => {
        const Icon = ICONS[(item.icon as KpiIcon)] ?? Target
        return (
          <div key={item.id} className={cn(CARD, CARD_SHADOW, 'flex items-start gap-3 px-3.5 py-3')}>
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONES[item.tone])}>
              <Icon size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-slate-500">{item.label}</p>
              <p className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">
                {item.value}
              </p>
              {item.bar
                ? (
                  <div className="mt-1.5">
                    <span
                      className="block h-1 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar" aria-valuenow={Math.round(item.bar.pct)}
                      aria-valuemin={0} aria-valuemax={100} aria-label={item.bar.label}
                    >
                      <span
                        className={cn('block h-full rounded-full', BAR_TONES[item.tone])}
                        style={{ width: `${Math.max(0, Math.min(100, item.bar.pct))}%` }}
                      />
                    </span>
                    <p className="mt-1 truncate text-[10px] font-medium text-emerald-600">{item.bar.label}</p>
                  </div>
                )
                : item.hint && (
                  <p className={cn(
                    'mt-0.5 flex items-center gap-0.5 truncate text-[11px]',
                    item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-red-500' : 'text-slate-400',
                  )}>
                    {item.trend === 'up' && <ArrowUpRight size={11} className="shrink-0" />}
                    {item.trend === 'down' && <ArrowDownRight size={11} className="shrink-0" />}
                    <span className="truncate">{item.hint}</span>
                  </p>
                )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Matches the final layout exactly, so the strip never causes a layout shift. */
export function KpiStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn(CARD, CARD_SHADOW, 'flex items-start gap-3 px-3.5 py-3')}>
          <span className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-2.5 w-20 animate-pulse rounded bg-slate-100" />
            <span className="block h-5 w-12 animate-pulse rounded bg-slate-100" />
            <span className="block h-2 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
