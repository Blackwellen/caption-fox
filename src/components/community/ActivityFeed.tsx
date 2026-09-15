import Link from 'next/link'
import {
  CalendarClock, Flag, Gift, MessageSquare, ShieldAlert, UserPlus, Activity as ActivityIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, formatAgo } from './primitives'
import { PanelEmpty } from './states'
import type { ActivityRow } from '@/lib/community/types'

const ENTITY_ICON: Record<string, typeof MessageSquare> = {
  community: MessageSquare,
  member: UserPlus,
  event: CalendarClock,
  moderation: ShieldAlert,
  report: Flag,
  advocacy: Gift,
  reward: Gift,
}

const ENTITY_TINT: Record<string, string> = {
  community: 'bg-blue-50 text-blue-600',
  member: 'bg-emerald-50 text-emerald-600',
  event: 'bg-violet-50 text-violet-600',
  moderation: 'bg-red-50 text-red-600',
  report: 'bg-red-50 text-red-600',
  advocacy: 'bg-amber-50 text-amber-600',
  reward: 'bg-amber-50 text-amber-600',
}

/**
 * Workspace activity for Community. Every entry is a real audit row and links
 * back to the record it changed, so the feed is navigable rather than
 * decorative. Mirrors src/components/creators/ActivityFeed.tsx.
 */
export default function ActivityFeed({
  items, emptyMessage = 'Activity from communities, events, moderation and advocacy will appear here.',
  className,
}: { items: ActivityRow[]; emptyMessage?: string; className?: string }) {
  if (items.length === 0) return <PanelEmpty message={emptyMessage} />

  return (
    <ul className={cn('divide-y divide-slate-100', className)}>
      {items.map(item => {
        const Icon = ENTITY_ICON[item.entity_type] ?? ActivityIcon
        const actorName = item.actor?.full_name ?? item.actor?.email ?? null
        const row = (
          <span className="flex items-start gap-2.5 py-2.5">
            {actorName
              ? <Avatar name={actorName} src={item.actor?.avatar_url} size={26} className="mt-0.5" />
              : (
                <span className={cn(
                  'mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full',
                  ENTITY_TINT[item.entity_type] ?? 'bg-slate-100 text-slate-500',
                )}>
                  <Icon size={13} />
                </span>
              )}
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] leading-snug text-slate-700">{item.summary}</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">{formatAgo(item.created_at)}</span>
            </span>
          </span>
        )
        return (
          <li key={item.id}>
            {item.link
              ? (
                <Link
                  href={item.link}
                  className="block rounded-lg px-1 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {row}
                </Link>
              )
              : <div className="px-1">{row}</div>}
          </li>
        )
      })}
    </ul>
  )
}
