'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'content', label: 'Content' },
  { id: 'audience', label: 'Audience' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'performance', label: 'Performance' },
  { id: 'versions', label: 'Versions' },
] as const

export default function MessageDetailTabs() {
  const pathname = usePathname()
  const params = useSearchParams()
  const active = params.get('tab') || 'content'

  return (
    <nav aria-label="Message sections" className="mb-3 -mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {TABS.map(tab => (
          <li key={tab.id}>
            <Link
              href={tab.id === 'content' ? pathname : `${pathname}?tab=${tab.id}`}
              aria-current={active === tab.id ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors',
                active === tab.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
