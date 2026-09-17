import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, ChartNoAxesColumnIncreasing, CircleCheck, FilePlus2, FileText, Info, MessageSquare,
  RefreshCw, Rocket, Send, TrendingDown, Trophy, XCircle, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/seo/format'
import type { SeoActivityItem } from '@/lib/seo/types'
import { Card, CardHeader, EmptyPanel } from './primitives'

const SEVERITY_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, critical: XCircle } as const
const SEVERITY_COLOUR = {
  info: 'text-blue-600',
  success: 'text-emerald-600',
  warning: 'text-amber-500',
  critical: 'text-red-600',
} as const
const SEVERITY_TILE = {
  info: 'bg-blue-50',
  success: 'bg-emerald-50',
  warning: 'bg-amber-50',
  critical: 'bg-red-50',
} as const

/** Event-specific glyphs, as in the references (chart for movement, trophy for a top-3 win…). */
const ACTION_ICON: Record<string, { icon: LucideIcon; colour: string; tile: string }> = {
  rank_improved: { icon: ChartNoAxesColumnIncreasing, colour: 'text-emerald-600', tile: 'bg-emerald-50' },
  rank_declined: { icon: TrendingDown, colour: 'text-amber-500', tile: 'bg-amber-50' },
  rank_lost: { icon: AlertTriangle, colour: 'text-amber-500', tile: 'bg-amber-50' },
  indexed: { icon: FileText, colour: 'text-blue-600', tile: 'bg-blue-50' },
  top_three: { icon: Trophy, colour: 'text-violet-600', tile: 'bg-violet-50' },
  audit_completed: { icon: Info, colour: 'text-blue-600', tile: 'bg-blue-50' },
  created: { icon: CircleCheck, colour: 'text-blue-600', tile: 'bg-blue-50' },
  synced: { icon: RefreshCw, colour: 'text-violet-600', tile: 'bg-violet-50' },
  updated: { icon: FilePlus2, colour: 'text-blue-600', tile: 'bg-blue-50' },
  submitted: { icon: Send, colour: 'text-violet-600', tile: 'bg-violet-50' },
  commented: { icon: MessageSquare, colour: 'text-amber-500', tile: 'bg-amber-50' },
  published: { icon: Rocket, colour: 'text-emerald-600', tile: 'bg-emerald-50' },
}

export function ActivityFeed({
  title = 'Activity & Alerts', items, viewAllHref, layout = 'grid',
}: { title?: string; items: SeoActivityItem[]; viewAllHref?: string; layout?: 'grid' | 'list' }) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title={title}
        action={viewAllHref && items.length > 0 ? <Link href={viewAllHref} className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link> : undefined}
      />
      {items.length === 0
        ? <EmptyPanel title="No recent activity" description="Actions in this area will appear here as they happen." />
        : (
          <ul className={layout === 'list' ? 'divide-y divide-slate-100' : 'grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}>
            {items.map(item => {
              const mapped = ACTION_ICON[item.action]
              const Icon = mapped?.icon ?? SEVERITY_ICON[item.severity]
              const colour = mapped?.colour ?? SEVERITY_COLOUR[item.severity]
              const tile = mapped?.tile ?? SEVERITY_TILE[item.severity]
              const body = layout === 'list'
                ? (
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tile, colour)}>
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium leading-snug text-slate-800">{item.summary}</p>
                      {item.detail && <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.detail}</p>}
                    </div>
                    <p className="shrink-0 text-[11px] text-slate-500">{relativeTime(item.created_at)}</p>
                  </div>
                )
                : (
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tile, colour)}>
                      <Icon size={22} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium leading-snug text-slate-800">{item.summary}</p>
                      {item.detail && <p className="mt-0.5 truncate text-[11.5px] text-slate-600">{item.detail}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-500">{relativeTime(item.created_at)}</p>
                    </div>
                  </div>
                )
              return (
                <li key={item.id} className={layout === 'list' ? 'px-3 py-2' : undefined}>
                  {item.link ? <Link href={item.link} className="-m-1 block rounded-lg p-1 hover:bg-slate-50">{body}</Link> : body}
                </li>
              )
            })}
          </ul>
        )}
    </Card>
  )
}
