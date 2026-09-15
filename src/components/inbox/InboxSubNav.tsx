'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'unified', label: 'Unified Inbox', href: '/app/inbox/unified' },
  { id: 'assignments', label: 'Assignments', href: '/app/inbox/assignments' },
  { id: 'saved-views', label: 'Saved Views', href: '/app/inbox/saved-views' },
  { id: 'unassigned', label: 'Unassigned', href: '/app/inbox/unassigned' },
]

/**
 * Shared sub-navigation for the four canonical Inbox pages. Every page
 * renders this so the four routes read as one module, not four disconnected
 * dashboards.
 */
export function InboxSubNav({ counts }: { counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname()
  return (
    <div className="mb-6 border-b border-slate-200">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(tab => {
          const active = pathname?.startsWith(tab.href)
          const count = counts?.[tab.id]
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {tab.label}
              {typeof count === 'number' && count > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold', active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
