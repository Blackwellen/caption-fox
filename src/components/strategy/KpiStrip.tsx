import {
  AlertTriangle, ArrowDown, ArrowUp, Award, BadgeCheck, BarChart3, Blocks, CalendarClock, CheckCircle2, Clock,
  CircleDollarSign, FileText, FlaskConical, Gauge, Globe, Link2, Minus, Network, ShieldCheck, Sparkles, Star, Target,
  TrendingUp, Users, UserRound, Archive, ClipboardList, LineChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD } from './primitives'

const ICONS = {
  sparkles: Sparkles, target: Target, users: Users, user: UserRound, flask: FlaskConical, star: Star,
  trend: TrendingUp, line: LineChart, alert: AlertTriangle, check: CheckCircle2, clock: Clock, calendar: CalendarClock,
  file: FileText, archive: Archive, gauge: Gauge, globe: Globe, link: Link2, blocks: Blocks, network: Network,
  money: CircleDollarSign, chart: BarChart3, award: Award, shield: ShieldCheck, badge: BadgeCheck, list: ClipboardList,
} as const
export type KpiIcon = keyof typeof ICONS

export type KpiTone = 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'orange' | 'teal' | 'slate'

const TILE: Record<KpiTone, string> = {
  blue: 'bg-[#e6edff] text-sg-blue',
  green: 'bg-[#dcf7e6] text-emerald-500',
  amber: 'bg-amber-50 text-amber-500',
  orange: 'bg-[#ffecd9] text-orange-500',
  violet: 'bg-[#ece7ff] text-violet-600',
  red: 'bg-red-50 text-red-500',
  teal: 'bg-teal-50 text-teal-500',
  slate: 'bg-slate-100 text-slate-500',
}

export interface KpiItem {
  id: string
  label: string
  value: React.ReactNode
  icon: KpiIcon
  tone: KpiTone
  /** Signed change vs the prior period. `good` decides the colour, not the sign. */
  delta?: { value: number; unit?: string; comparison: string; good?: 'up' | 'down' } | null
  /** Plain secondary line when there is no delta (e.g. "Needs review"). */
  note?: React.ReactNode
  noteTone?: 'muted' | 'green' | 'amber' | 'red'
  bar?: { pct: number; label: React.ReactNode }
}

/**
 * KPI row shared by every Strategy surface. Values are computed server-side
 * from workspace-scoped data; this only lays them out. Deltas always pair the
 * arrow with text so direction is never conveyed by colour alone.
 */
export default function KpiStrip({ items, className, itemClassName }: { items: KpiItem[]; className?: string; itemClassName?: string }) {
  return (
    <ul className={cn('grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 xl:gap-[18px]', className)} aria-label="Key metrics">
      {items.map(item => {
        const Icon = ICONS[item.icon]
        const d = item.delta
        const good = d ? (d.good ?? 'up') : 'up'
        const positive = d ? (d.value === 0 ? null : (d.value > 0) === (good === 'up')) : null
        return (
          <li key={item.id} className={cn(CARD, 'flex min-h-[92px] items-start gap-3 px-3.5 py-3.5 lg:h-[88px] lg:min-h-0 lg:gap-[11px] lg:overflow-hidden lg:px-3 lg:py-[13px]', itemClassName)}>
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] lg:h-10 lg:w-10', TILE[item.tone])}>
              <Icon aria-hidden className="h-5 w-5 lg:h-[19px] lg:w-[19px]" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight tracking-[-0.005em] text-sg-body lg:text-[10.5px]">{item.label}</p>
              <p className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-[-0.01em] text-sg-ink lg:mt-[3px] lg:text-[19.5px]">{item.value}</p>
              {item.bar ? (
                <div className="mt-1 lg:mt-[2px]">
                  <p className="truncate text-[12px] leading-tight text-sg-muted lg:text-[10px]">{item.bar.label}</p>
                  <span className="mt-1 block h-1 w-full max-w-[110px] overflow-hidden rounded-full bg-slate-100" role="progressbar"
                    aria-valuenow={Math.round(item.bar.pct)} aria-valuemin={0} aria-valuemax={100}>
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, item.bar.pct))}%` }} />
                  </span>
                </div>
              ) : d ? (
                <p className="mt-1 flex items-center gap-1 truncate text-[12px] leading-tight text-sg-muted lg:mt-[5px] lg:text-[9.5px]">
                  {d.value > 0 ? <ArrowUp aria-hidden className={cn('h-3 w-3 shrink-0', positive ? 'text-emerald-500' : 'text-red-500')} />
                    : d.value < 0 ? <ArrowDown aria-hidden className={cn('h-3 w-3 shrink-0', positive ? 'text-emerald-500' : 'text-red-500')} />
                      : <Minus aria-hidden className="h-3 w-3 shrink-0 text-slate-400" />}
                  <span className={cn('font-semibold', positive === null ? 'text-slate-500' : positive ? 'text-emerald-600' : 'text-red-500')}>
                    <span className="sr-only">{d.value > 0 ? 'up ' : d.value < 0 ? 'down ' : 'no change '}</span>
                    {Math.abs(d.value).toLocaleString('en-GB')}{d.unit ?? ''}
                  </span>
                  <span className="truncate">{d.comparison}</span>
                </p>
              ) : item.note ? (
                <p className={cn('mt-1 truncate text-[12px] lg:mt-[5px] lg:text-[9.5px]', {
                  muted: 'text-sg-muted', green: 'font-medium text-emerald-600', amber: 'font-medium text-amber-600', red: 'font-medium text-red-500',
                }[item.noteTone ?? 'muted'])}>{item.note}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
