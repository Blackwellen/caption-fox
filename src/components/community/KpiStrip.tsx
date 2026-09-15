import Link from 'next/link'
import {
  ArrowDownRight, ArrowUpRight, BadgeCheck, CalendarClock, CircleDollarSign, ClipboardList,
  Clock, FileCheck2, Flag, Gauge, Gift, Heart, Layers, MessageSquare, PieChart, ShieldAlert,
  ShieldCheck, Star, Target, TrendingUp, UserCheck, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { KpiValue } from '@/lib/community/types'

const ICONS = {
  users: Users, userCheck: UserCheck, flag: Flag, calendar: CalendarClock,
  shieldCheck: ShieldCheck, shieldAlert: ShieldAlert, clock: Clock, gauge: Gauge,
  pie: PieChart, trend: TrendingUp, target: Target, star: Star, layers: Layers,
  checks: FileCheck2, tasks: ClipboardList, money: CircleDollarSign, badge: BadgeCheck,
  gift: Gift, heart: Heart, message: MessageSquare,
} as const
export type KpiIcon = keyof typeof ICONS

const TONES: Record<KpiValue['tone'], { chip: string; stroke: string; fill: string }> = {
  blue: { chip: 'bg-blue-50 text-blue-600', stroke: '#3b82f6', fill: '#dbeafe' },
  green: { chip: 'bg-emerald-50 text-emerald-600', stroke: '#10b981', fill: '#d1fae5' },
  amber: { chip: 'bg-amber-50 text-amber-600', stroke: '#f59e0b', fill: '#fef3c7' },
  violet: { chip: 'bg-violet-50 text-violet-600', stroke: '#8b5cf6', fill: '#ede9fe' },
  red: { chip: 'bg-red-50 text-red-600', stroke: '#ef4444', fill: '#fee2e2' },
  slate: { chip: 'bg-slate-100 text-slate-500', stroke: '#94a3b8', fill: '#e2e8f0' },
}

/** Inline SVG sparkline — no chart library, no layout shift, server-rendered. */
function Sparkline({ values, stroke, fill }: { values: number[]; stroke: string; fill: string }) {
  const points = values.length >= 2 ? values : [0, 0]
  const width = 100
  const height = 26
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)

  const coords = points.map((value, index) => {
    const x = index * step
    const y = height - ((value - min) / span) * (height - 3) - 1.5
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      className="mt-2.5 h-7 w-full" aria-hidden focusable="false"
    >
      <polygon points={`0,${height} ${coords.join(' ')} ${width},${height}`} fill={fill} opacity={0.45} />
      <polyline
        points={coords.join(' ')} fill="none" stroke={stroke}
        strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function KpiCard({ item }: { item: KpiValue }) {
  const Icon = ICONS[(item.icon as KpiIcon)] ?? Users
  const tone = TONES[item.tone]

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone.chip)}>
          <Icon size={17} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-500">{item.label}</p>
      </div>
      <p className="mt-2 truncate text-[26px] font-bold leading-none tracking-tight text-slate-900">{item.value}</p>
      {item.hint && (
        <p className={cn(
          'mt-2 flex items-center gap-0.5 truncate text-[11px]',
          item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-red-500' : 'text-slate-400',
        )}>
          {item.trend === 'up' && <ArrowUpRight size={12} className="shrink-0" />}
          {item.trend === 'down' && <ArrowDownRight size={12} className="shrink-0" />}
          <span className="truncate">{item.hint}</span>
        </p>
      )}
      {item.spark && item.spark.length > 1 && (
        <Sparkline values={item.spark} stroke={tone.stroke} fill={tone.fill} />
      )}
    </>
  )

  const className = cn(
    CARD, CARD_SHADOW, 'flex flex-col px-4 pb-3 pt-3.5 transition-colors',
    item.href && 'hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
  )

  if (item.href) {
    return <Link href={item.href} className={className} aria-label={`${item.label}: ${item.value}`}>{body}</Link>
  }
  return <div className={className}>{body}</div>
}

/** The KPI row shared by every Community surface. Values always come from
 * workspace-scoped aggregates computed by the page; this component only formats them. */
export default function KpiStrip({ items, className }: { items: KpiValue[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6', className)}>
      {items.map(item => <KpiCard key={item.id} item={item} />)}
    </div>
  )
}

export function KpiStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(CARD, CARD_SHADOW, 'flex flex-col px-4 pb-3 pt-3.5')}>
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />
            <span className="h-3 w-20 animate-pulse rounded bg-slate-100" />
          </div>
          <span className="mt-2 block h-6 w-16 animate-pulse rounded bg-slate-100" />
          <span className="mt-2 block h-2.5 w-24 animate-pulse rounded bg-slate-100" />
          <span className="mt-2.5 block h-7 w-full animate-pulse rounded bg-slate-50" />
        </div>
      ))}
    </div>
  )
}
