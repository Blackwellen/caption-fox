import Link from 'next/link'
import { Avatar, Panel, PanelFooterLink, formatRelative } from './primitives'
import { EmptyState } from './states'
import { ACTIVITY_ENTITY_HREF, type ActivityEntity } from '@/lib/strategy/constants'
import type { ActivityRow } from '@/lib/strategy/types'

/**
 * The shared Strategy activity feed. Entries are workspace-scoped audit rows —
 * never fixtures — and each links back to the record it describes, falling back
 * to the module route when the specific record is gone.
 */
export default function ActivityPanel({
  rows, title = 'Recent activity', viewAllHref = '/app/strategy?view=table', action, className,
}: {
  rows: ActivityRow[]
  title?: string
  viewAllHref?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Panel
      title={title}
      action={action}
      className={className}
      footer={rows.length > 0 ? <PanelFooterLink href={viewAllHref}>View all activity</PanelFooterLink> : undefined}
    >
      {rows.length === 0
        ? (
          <EmptyState
            compact
            title="No activity yet"
            message="Changes to objectives, research, positioning, plans and forecasts appear here."
          />
        )
        : (
          <ul className="space-y-3">
            {rows.map(row => {
              const href = row.link ?? ACTIVITY_ENTITY_HREF[row.entity_type as ActivityEntity] ?? '/app/strategy'
              const actor = row.actor?.full_name ?? row.actor?.email ?? 'A teammate'
              return (
                <li key={row.id}>
                  <Link href={href} className="group flex items-start gap-2.5 rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-50">
                    <Avatar person={row.actor} size={26} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-slate-700">
                        <span className="font-semibold text-slate-900">{shortName(actor)}</span>
                        {' '}
                        <span className="text-slate-500">{row.action}</span>
                      </p>
                      <p className="truncate text-[11px] text-slate-500 group-hover:text-slate-600">{row.summary}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                      {formatRelative(row.created_at)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
    </Panel>
  )
}

/** "Mikasa Ackerman" → "Mikasa A." to match the compact feed rows in the design. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] ?? name
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}
