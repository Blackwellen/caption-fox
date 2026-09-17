import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ACTIVITY_ENTITY_MODULE, strategyPath, type ActivityEntity, type StrategyModule } from '@/lib/strategy/constants'
import { formatRelative, shortName } from '@/lib/strategy/format'
import type { ActivityRow } from '@/lib/strategy/types'
import { Avatar } from './primitives'
import { EmptyState } from './states'

export function activityHref(kind: string, row: Pick<ActivityRow, 'entity_type' | 'surface'>): string {
  const area = (row.surface as StrategyModule | null) ?? ACTIVITY_ENTITY_MODULE[row.entity_type as ActivityEntity] ?? 'overview'
  return strategyPath(kind, area)
}

/**
 * Human-readable activity feed. Every row links back to the surface the
 * change happened on; the timestamp carries the exact time for screen readers.
 */
export function ActivityList({
  kind, rows, layout = 'stacked', avatarSize = 26, className, emptyText = 'Changes to strategy records appear here.',
}: {
  kind: string
  rows: ActivityRow[]
  /** stacked: actor+action on line 1, summary line 2. inline: single row. */
  layout?: 'stacked' | 'inline' | 'inline-sub'
  avatarSize?: number
  className?: string
  emptyText?: string
}) {
  if (rows.length === 0) return <EmptyState compact title="No activity yet" description={emptyText} />
  return (
    <ul className={cn('space-y-3 lg:space-y-[13px]', className)}>
      {rows.map(row => {
        const name = shortName(row.actor?.full_name ?? row.actor?.email)
        return (
          <li key={row.id} className="flex items-start gap-2.5 lg:gap-2">
            <Avatar person={row.actor} size={avatarSize} className="mt-0.5" />
            <Link href={activityHref(kind, row)} className="group min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-sg-blue">
              {layout === 'inline' ? (
                <p className="truncate text-[12.5px] text-sg-muted lg:text-[9.5px]">
                  <span className="font-semibold text-sg-ink">{name}</span> {row.action}{' '}
                  <span className="text-sg-body group-hover:underline">{row.summary}</span>
                </p>
              ) : (
                <>
                  <p className="truncate text-[12.5px] text-sg-muted lg:text-[9.5px]">
                    <span className="font-semibold text-sg-ink">{name}</span>{' '}{row.action}
                  </p>
                  <p className="truncate text-[12.5px] text-sg-body group-hover:underline lg:text-[9.5px]">{row.summary}</p>
                </>
              )}
            </Link>
            <time dateTime={row.created_at} title={new Date(row.created_at).toLocaleString('en-GB')}
              className="shrink-0 text-[11.5px] text-sg-subtle lg:text-[9px]">{formatRelative(row.created_at)}</time>
          </li>
        )
      })}
    </ul>
  )
}
