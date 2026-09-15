import Link from 'next/link'
import {
  ArrowDownRight, ArrowUpRight, Bell, CheckCircle2, Clock, Layers, ShieldAlert,
  TrendingUp, Users, XCircle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { KpiValue } from '@/lib/automations/types'

const ICONS = { users: Users, zap: Zap, checks: CheckCircle2, failed: XCircle, bell: Bell, clock: Clock, trend: TrendingUp, layers: Layers, shieldAlert: ShieldAlert } as const
export type KpiIcon = keyof typeof ICONS

const TONES: Record<KpiValue['tone'], { chip: string }> = {
  blue: { chip: 'bg-blue-50 text-blue-600' }, green: { chip: 'bg-emerald-50 text-emerald-600' },
  amber: { chip: 'bg-amber-50 text-amber-600' }, violet: { chip: 'bg-violet-50 text-violet-600' },
  red: { chip: 'bg-red-50 text-red-600' }, slate: { chip: 'bg-slate-100 text-slate-500' },
}

function KpiCard({ item }: { item: KpiValue }) {
  const Icon = ICONS[(item.icon as KpiIcon)] ?? Zap
  const tone = TONES[item.tone]
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone.chip)}><Icon size={17} /></span>
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-500">{item.label}</p>
      </div>
      <p className="mt-2 truncate text-[26px] font-bold leading-none tracking-tight text-slate-900">{item.value}</p>
      {item.hint && (
        <p className={cn('mt-2 flex items-center gap-0.5 truncate text-[11px]', item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-red-500' : 'text-slate-400')}>
          {item.trend === 'up' && <ArrowUpRight size={12} className="shrink-0" />}
          {item.trend === 'down' && <ArrowDownRight size={12} className="shrink-0" />}
          <span className="truncate">{item.hint}</span>
        </p>
      )}
    </>
  )
  const className = cn(CARD, CARD_SHADOW, 'flex flex-col px-4 pb-3 pt-3.5 transition-colors', item.href && 'hover:border-slate-300')
  if (item.href) return <Link href={item.href} className={className} aria-label={`${item.label}: ${item.value}`}>{body}</Link>
  return <div className={className}>{body}</div>
}

export default function KpiStrip({ items, className }: { items: KpiValue[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6', className)}>
      {items.map(item => <KpiCard key={item.id} item={item} />)}
    </div>
  )
}
