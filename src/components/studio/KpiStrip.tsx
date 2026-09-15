import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Bookmark, Calendar, CheckCircle2,
  Clock, Eye, FileText, Folder, HardDrive, Hash, Image as ImageIcon, Layers,
  Lightbulb, Link2, Percent, Send, Sparkles, TrendingUp, Users, Wand2, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { KpiValue } from '@/lib/studio/types'

const ICONS = {
  file: FileText, eye: Eye, calendar: Calendar, sparkles: Sparkles, lightbulb: Lightbulb,
  check: CheckCircle2, clock: Clock, alert: AlertTriangle, send: Send, hash: Hash,
  layers: Layers, folder: Folder, image: ImageIcon, drive: HardDrive, link: Link2,
  bookmark: Bookmark, trend: TrendingUp, users: Users, wand: Wand2, percent: Percent, ban: Ban,
} as const
export type StudioKpiIcon = keyof typeof ICONS

const TONES: Record<KpiValue['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-500',
}

/**
 * The KPI row shared by every Studio surface. Values are always calculated
 * from workspace-scoped data by the page; this component only formats them.
 */
export default function KpiStrip({ items, className }: { items: KpiValue[]; className?: string }) {
  return (
    <div className={cn(CARD, CARD_SHADOW, 'grid grid-cols-2 divide-slate-200 sm:grid-cols-3 sm:divide-x xl:grid-cols-6', className)}>
      {items.map(item => {
        const Icon = ICONS[(item.icon as StudioKpiIcon)] ?? Sparkles
        return (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONES[item.tone])}>
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{item.label}</p>
              <p className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">{item.value}</p>
              {item.hint && (
                <p className={cn(
                  'mt-0.5 flex items-center gap-0.5 truncate text-[11px]',
                  item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-red-500' : 'text-slate-400',
                )}>
                  {item.trend === 'up' && <ArrowUpRight size={11} />}
                  {item.trend === 'down' && <ArrowDownRight size={11} />}
                  {item.hint}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function KpiStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={cn(CARD, CARD_SHADOW, 'grid grid-cols-2 divide-slate-200 sm:grid-cols-3 sm:divide-x xl:grid-cols-6')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3 w-20 animate-pulse rounded bg-slate-100" />
            <span className="block h-5 w-12 animate-pulse rounded bg-slate-100" />
            <span className="block h-2.5 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
