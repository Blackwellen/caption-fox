import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, Link2Off, Globe, Hash, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { relative } from '@/lib/link-in-bio/format'
import type { ActivityItem, GovernanceAlert } from '@/lib/link-in-bio/server/collections'
import { Avatar, Panel, PanelTitle, TextLink } from './ui'

export function ActivityRail({ items, viewAllHref, title = 'Recent activity', empty = 'No activity yet.' }: { items: ActivityItem[]; viewAllHref: string; title?: string; empty?: string }) {
  return (
    <Panel className="p-4">
      <PanelTitle title={title} action={<TextLink href={viewAllHref}>View all</TextLink>} />
      {items.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">{empty}</p> : (
        <ul className="mt-3.5 space-y-3.5">
          {items.map(item => (
            <li key={item.id} className="flex items-start gap-2.5">
              <Avatar member={item.actor} size={20} className="mt-0.5" />
              <div className="min-w-0 flex-1 text-[10.5px] leading-snug">
                <p className="text-slate-600"><span className="font-semibold text-slate-900">{item.actor?.name ?? 'System'}</span> {item.summary}</p>
                {item.entityName && (item.href
                  ? <Link href={item.href} className="block truncate text-slate-500 hover:text-[#1a5cff]">{item.entityName}</Link>
                  : <p className="truncate text-slate-500">{item.entityName}</p>)}
              </div>
              <time dateTime={item.createdAt} className="shrink-0 pt-0.5 text-[10px] text-slate-500">{relative(item.createdAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function QuickActionsRail({ items, title = 'Quick actions' }: { items: { label: string; href: string; icon: ReactNode }[]; title?: string }) {
  return (
    <Panel className="p-4">
      <PanelTitle title={title} />
      <ul className="mt-3 space-y-1">
        {items.map(item => (
          <li key={item.label}>
            <Link href={item.href} className="flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[10.5px] text-slate-700 hover:bg-slate-50 hover:text-[#1a5cff]">
              <span className="text-[#1a5cff] [&>svg]:h-[15px] [&>svg]:w-[15px]" aria-hidden>{item.icon}</span>{item.label}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

const ALERT_ICON = { review: AlertCircle, broken: Link2Off, utm: Hash, domain: Globe }
const ALERT_TONE = { danger: 'text-red-500 bg-red-50', warning: 'text-orange-500 bg-orange-50', info: 'text-blue-600 bg-blue-50' }

export function GovernanceRail({ alerts, viewAllHref }: { alerts: GovernanceAlert[]; viewAllHref: string }) {
  return (
    <Panel className="p-4">
      <PanelTitle title="Governance alerts" action={<TextLink href={viewAllHref}>View all</TextLink>} />
      {alerts.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[11.5px] text-emerald-700"><CircleAlert size={14} aria-hidden className="text-emerald-500" /> Everything looks healthy.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {alerts.map(alert => {
            const Icon = ALERT_ICON[alert.icon]
            return (
              <li key={alert.id}>
                <Link href={alert.href} className="flex items-start gap-2.5 rounded-md hover:bg-slate-50">
                  <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ALERT_TONE[alert.tone])} aria-hidden><Icon size={13} /></span>
                  <span className="min-w-0 text-[10.5px] leading-snug">
                    <span className="block font-medium text-slate-900">{alert.title}</span>
                    <span className="block text-slate-500">{alert.detail}</span>
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
