'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: 'Overview', href: '/app/reputation' },
  { id: 'media-lists', label: 'Media Lists', href: '/app/reputation/media-lists' },
  { id: 'pitches', label: 'Pitches', href: '/app/reputation/pitches' },
  { id: 'press-room', label: 'Press Room', href: '/app/reputation/press-room' },
  { id: 'coverage', label: 'Coverage', href: '/app/reputation/coverage' },
  { id: 'reviews', label: 'Reviews', href: '/app/reputation/reviews' },
  { id: 'crisis', label: 'Crisis', href: '/app/reputation/crisis' },
] as const

export function ReputationSubNav() {
  const pathname = usePathname()
  return (
    <div className="mb-5 overflow-x-auto border-b border-slate-200">
      <nav className="flex min-w-max gap-1" aria-label="PR & Reputation">
        {TABS.map(tab => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
