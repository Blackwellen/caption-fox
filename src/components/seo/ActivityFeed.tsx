import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/seo/format'
import type { SeoActivityItem } from '@/lib/seo/types'
import { Card, CardHeader, EmptyPanel } from './primitives'

const SEVERITY_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, critical: XCircle } as const
const SEVERITY_TONE = {
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  critical: 'bg-red-50 text-red-600',
} as const

export function ActivityFeed({
  title = 'Activity & Alerts', items, viewAllHref,
}: { title?: string; items: SeoActivityItem[]; viewAllHref?: string }) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={viewAllHref && items.length > 0 ? <Link href={viewAllHref} className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link> : undefined}
      />
      {items.length === 0
        ? <EmptyPanel title="No recent activity" description="Actions in this area will appear here as they happen." />
        : (
          <ul className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {items.map(item => {
              const Icon = SEVERITY_ICON[item.severity]
              const body = (
                <div className="flex items-start gap-2.5">
                  <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', SEVERITY_TONE[item.severity])}>
                    <Icon size={14} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-slate-800">{item.summary}</p>
                    {item.detail && <p className="mt-0.5 truncate text-xs text-slate-500">{item.detail}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">{relativeTime(item.created_at)}</p>
                  </div>
                </div>
              )
              return (
                <li key={item.id}>
                  {item.link ? <Link href={item.link} className="block rounded-lg -m-1 p-1 hover:bg-slate-50">{body}</Link> : body}
                </li>
              )
            })}
          </ul>
        )}
    </Card>
  )
}
