import Link from 'next/link'
import {
  Archive, CheckCircle2, FileEdit, FlaskConical, Globe2, Plus, Trash2, TrendingUp,
} from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import type { ActivityRow } from '@/lib/web/types'

/** Icon + tone per activity entity, so the feed scans quickly. */
function iconFor(item: ActivityRow): { Icon: typeof Plus; tone: string } {
  if (item.entity_type === 'funnel') return { Icon: TrendingUp, tone: 'bg-violet-50 text-violet-600' }
  if (item.entity_type === 'form') return { Icon: FileEdit, tone: 'bg-blue-50 text-blue-600' }
  if (item.entity_type === 'experiment') return { Icon: FlaskConical, tone: 'bg-amber-50 text-amber-600' }
  if (item.action === 'created' || item.action === 'duplicated') return { Icon: Plus, tone: 'bg-blue-50 text-blue-600' }
  if (item.action === 'archived') return { Icon: Archive, tone: 'bg-slate-100 text-slate-500' }
  if (item.action === 'deleted') return { Icon: Trash2, tone: 'bg-red-50 text-red-600' }
  if (item.action.includes('published') || item.action.includes('fixed')) return { Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' }
  return { Icon: Globe2, tone: 'bg-slate-100 text-slate-500' }
}

export default function ActivityFeed({
  items, emptyMessage = 'No Web & Conversion activity yet. Actions you take here will appear in this feed.',
  className,
}: { items: ActivityRow[]; emptyMessage?: string; className?: string }) {
  if (items.length === 0) {
    return <p className={cn('py-6 text-center text-[13px] text-slate-400', className)}>{emptyMessage}</p>
  }

  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map(item => {
        const { Icon, tone } = iconFor(item)
        const actor = item.actor?.full_name ?? item.actor?.email ?? 'System'
        const body = (
          <>
            <span className={cn('mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', tone)}>
              <Icon size={12} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] leading-snug text-slate-600">
                <span className="font-semibold text-slate-900">{actor}</span>{' '}
                {item.summary}
              </span>
            </span>
            <time dateTime={item.created_at} className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
              {formatRelative(item.created_at)}
            </time>
          </>
        )

        return (
          <li key={item.id}>
            {item.link
              ? <Link href={item.link} className="flex items-start gap-2 rounded-lg px-1 py-0.5 -mx-1 transition-colors hover:bg-slate-50">{body}</Link>
              : <span className="flex items-start gap-2 px-1 py-0.5">{body}</span>}
          </li>
        )
      })}
    </ul>
  )
}
