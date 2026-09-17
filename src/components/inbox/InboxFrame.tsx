import Link from 'next/link'
import { AtSign, Bookmark, Inbox, UserCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INBOX_TAB_LABELS } from '@/lib/inbox/entitlements'
import type { InboxTabId } from '@/lib/inbox/types'
import InboxMobileNav from './InboxMobileNav'

const ICONS: Record<InboxTabId, LucideIcon> = {
  unified: Inbox,
  assignments: UserCheck,
  'saved-views': Bookmark,
  unassigned: AtSign,
}

/**
 * Inbox module frame. The sidebar, top bar and global search come from the
 * locked Caption Fox shell; this renders only the module's local navigation —
 * a tab row on desktop, a sliding tray on tablet and a dropdown on mobile — and
 * the page content. Tabs are entitlement-driven (hidden, never disabled).
 */
export default function InboxFrame({
  basePath, activeTab, visibleTabs, counts, children,
}: {
  basePath: string
  activeTab: InboxTabId
  visibleTabs: InboxTabId[]
  counts?: Partial<Record<InboxTabId, number>>
  children: React.ReactNode
}) {
  return (
    <>
      <div className="w-full px-4 pb-24 pt-3 sm:px-6 md:pb-10 lg:px-6">
        <nav aria-label="Inbox sections" className="mb-3 hidden border-b border-shell-border md:block">
          <div className="cf-hide-scrollbar -mb-px flex overflow-x-auto">
            {visibleTabs.map(tab => {
              const Icon = ICONS[tab]
              const active = tab === activeTab
              const count = counts?.[tab]
              return (
                <Link
                  key={tab}
                  href={`${basePath}/${tab}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] transition-colors',
                    active ? 'border-shell-blue font-semibold text-shell-blue' : 'border-transparent font-medium text-shell-text-2 hover:text-shell-text',
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {INBOX_TAB_LABELS[tab]}
                  {typeof count === 'number' && count > 0 ? (
                    <span className={cn('rounded-full px-1.5 text-[10.5px] font-semibold leading-[18px]', active ? 'bg-shell-blue-soft text-shell-blue' : 'bg-slate-100 text-slate-600')}>
                      {count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </nav>
        {children}
      </div>
      <InboxMobileNav basePath={basePath} visibleTabs={visibleTabs} activeTab={activeTab} />
    </>
  )
}
